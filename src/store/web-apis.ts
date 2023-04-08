import type {Values, Dict} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
import type {WebApi, WebApiPath} from '#/meta/web-api';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {Settings} from './settings';

import {SI_STORE_WEB_APIS, XT_HOURS, XT_MINUTES} from '#/share/constants';

import {HttpResponseError} from '#/share/errors';
import {fodemtv, ode, timeout} from '#/util/belt';
import {buffer_to_base64, sha256_sync, text_to_buffer} from '#/util/data';
import {RateLimitingPool} from '#/util/rate-limiting-pool';

type CoinGeckoSimplePrice<
	si_coin extends string=string,
	si_versus extends CoinGeckoFiat=CoinGeckoFiat,
> = Record<si_coin, {
	[si_v in si_versus]: number;
}>;

type CoinGeckoCoinstList = {
	id: string;
	symbol: string;
	name: string;
	platforms: Dict;
}[];

const P_COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const SI_CACHE_COINGECKO = 'coingecko';

// default rate limits config reflects coingecko's 50 calls/minute rate limiting rule
const GC_DEFAULT_RATE_LIMITS = {
	concurrency: 10,
	capacity: 20,
	resolution: 60e3,
};

export const A_COINGECKO_VS = [
	'btc',
	'eth',
	'ltc',
	'bch',
	'bnb',
	'eos',
	'xrp',
	'xlm',
	'link',
	'dot',
	'yfi',
	'usd',
	'aed',
	'ars',
	'aud',
	'bdt',
	'bhd',
	'bmd',
	'brl',
	'cad',
	'chf',
	'clp',
	'cny',
	'czk',
	'dkk',
	'eur',
	'gbp',
	'hkd',
	'huf',
	'idr',
	'ils',
	'inr',
	'jpy',
	'krw',
	'kwd',
	'lkr',
	'mmk',
	'mxn',
	'myr',
	'ngn',
	'nok',
	'nzd',
	'php',
	'pkr',
	'pln',
	'rub',
	'sar',
	'sek',
	'sgd',
	'thb',
	'try',
	'twd',
	'uah',
	'vef',
	'vnd',
	'zar',
	'xdr',
	'xag',
	'xau',
	'bits',
	'sats',
];

export type CoinGeckoFiat = Values<typeof A_COINGECKO_VS>;

const h_limiters: Dict<RateLimitingPool> = {};

const h_limits_hit: Dict<number> = {};

async function cached_fetch(p_url: string, gc_req: RequestInit, xt_max_age: number, c_retries=0): Promise<Response> {
	// open cache
	const d_cache = await caches.open(SI_CACHE_COINGECKO);

	// attempt to match cache
	let d_res = await d_cache.match(p_url);

	// cache hit
	CACHE_HIT:
	if(d_res) {
		// check cache info
		const sx_cache_info = sessionStorage.getItem(`@cache:${p_url}`);

		// non-existant, don't trust
		if(!sx_cache_info) break CACHE_HIT;

		// parse
		let g_cache_info: {time: number};
		try {
			g_cache_info = JSON.parse(sx_cache_info);
		}
		catch(e_parse) {
			break CACHE_HIT;
		}

		// invalid type
		if('number' !== typeof g_cache_info?.time) break CACHE_HIT;

		// parse cache time
		const xt_cache = +g_cache_info.time;

		// expired cache
		if(Date.now() - xt_cache > xt_max_age) break CACHE_HIT;

		// cache still valid, use it
		return d_res;
	}

	// get request origin
	const p_origin = new URL(p_url).origin;

	// create/ref slots and lock pool
	const k_limiter = h_limiters[p_origin] || await (async() => {
		const gc_defaults = await Settings.get('gc_rate_limit_queries_default');
		return h_limiters[p_origin] = h_limiters[p_origin] || new RateLimitingPool(gc_defaults || GC_DEFAULT_RATE_LIMITS);
	})();

	// wait for an opening
	const f_release = await k_limiter.acquire();

	// rate limit hit; cool off
	if(h_limits_hit[p_origin]) {
		await timeout(62e3 - (Date.now() - h_limits_hit[p_origin]));
	}

	// make fetch
	try {
		d_res = await fetch(p_url, gc_req);
	}
	finally {
		f_release();
	}

	// success
	if(d_res.ok) {
		// save to cache
		await d_cache.put(p_url, d_res.clone());

		// save time of cache
		sessionStorage.setItem(`@cache:${p_url}`, JSON.stringify({
			time: Date.now(),
		}));

		// retry
		return await cached_fetch(p_url, gc_req, xt_max_age, c_retries+1);
	}
	// haven't exceeded retries yet
	else if(c_retries < 6) {
		// rate-limiting
		if(429 === d_res.status) {
			h_limits_hit[p_origin] = Date.now();
			await timeout(60e3);
			h_limits_hit[p_origin] = 0;
		}
		else {
			// exponential back-off
			await timeout(5e3 * Math.pow(2, c_retries));
		}

		// retry
		return await cached_fetch(p_url, gc_req, xt_max_age, c_retries+1);
	}
	// throw
	else {
		throw new HttpResponseError(d_res);
	}
}

const coingecko_url = (sr_url: string, h_params: Dict) => `${P_COINGECKO_BASE}${sr_url}?`+new URLSearchParams(ode(h_params));

export const CoinGecko = {
	async coinsVersus(a_coins: string[], si_versus: CoinGeckoFiat='usd', xt_max_age=15*XT_MINUTES): Promise<Dict<number>> {
		// fetch from api
		const d_res = await cached_fetch(coingecko_url('/simple/price', {
			ids: a_coins.join(','),
			vs_currencies: si_versus,
			include_last_updated_at: 'true',
		}), {}, xt_max_age);

		// load response
		const h_response = await d_res.json() as CoinGeckoSimplePrice;

		// transform by selecting the versus coin
		return fodemtv(h_response, g_coin => g_coin[si_versus]);
	},

	async allCoins(xt_max_age=12*XT_HOURS): Promise<CoinGeckoCoinstList> {
		// fetch from api
		const d_res = await cached_fetch(coingecko_url('/coins/list', {
			include_platform: 'false',
		}), {}, xt_max_age);

		// load response
		return await d_res.json() as CoinGeckoCoinstList;
	},
};


export interface ContractStats {
	accounts_count: number;
	address: Bech32;
	chain_id: number;
	code_id: number;
	contract_category: number;
	creator: Bech32;
	data_hash: string;
	description: null|string;
	discussion_url: null|string;
	id: number;
	label: string;
	source_url: null|string;
	txs_count: number;
	value_locked: string;
}

export const SecretNodes = {
	urlFor(g_chain: ChainStruct, g_contract: ContractStruct): string {
		return `https://core.spartanapi.dev/secret/chains/${g_chain.reference}/contracts/${g_contract.bech32}`;
	},

	async contractStats(g_chain: ChainStruct, g_contract: ContractStruct, xt_max_age=6*XT_HOURS): Promise<ContractStats> {
		// fetch from api
		const d_res = await cached_fetch(SecretNodes.urlFor(g_chain, g_contract), {
			headers: {
				accept: 'application/json',
			},
		}, xt_max_age);

		// load response
		return await d_res.json() as ContractStats;
	},
};

export const WebApis = create_store_class({
	store: SI_STORE_WEB_APIS,
	extension: 'map',
	class: class WebApisI extends WritableStoreMap<typeof SI_STORE_WEB_APIS> {
		static pathFor(si_method: WebApi['struct']['method'], p_api: string): WebApiPath {
			// generate hash
			const s_hash = buffer_to_base64(sha256_sync(text_to_buffer(si_method+' '+p_api)));

			// produce path
			return `/cache.web-api/sha256.${s_hash}`;
		}

		static pathFrom(g_api: WebApi['struct']): WebApiPath {
			return WebApisI.pathFor(g_api.method, g_api.path);
		}
	},
});

