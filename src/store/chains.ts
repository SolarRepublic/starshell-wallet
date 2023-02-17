import type {Coin} from '@cosmjs/proto-signing';

import type {Writable} from 'ts-toolbelt/out/Object/Writable';

import type {Dict} from '#/meta/belt';
import type {Bech32, BlockExplorerConfig, Chain, ChainPath, ChainNamespaceKey, ChainStruct, Caip2, ChainNamespace, CoinInfo} from '#/meta/chain';

import {fromBech32, toBech32} from '@cosmjs/encoding';
import BigNumber from 'bignumber.js';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {pubkey_to_bech32} from '#/crypto/bech32';
import {R_BECH32, SI_STORE_CHAINS} from '#/share/constants';
import {ode} from '#/util/belt';
import {format_amount} from '#/util/format';


export class TransactionNotFoundError extends Error {}

export const parse_date = (s_input: string | null): number => {
	if(s_input?.length) {
		try {
			const n_datetime = Date.parse(s_input);
			if(Number.isInteger(n_datetime) && n_datetime > 0) {
				return n_datetime;
			}
		}
		catch(e_parse) {}
	}

	return Date.now();
};

const R_CHAIN_PATH = /^\/family\.([^/]+)\/chain\.([^/]+)(\/|$)/;

type PathFor<
	si_family extends ChainNamespaceKey,
	si_chain extends string,
> = `/family.${si_family}/chain.${si_chain}`;

type PathFrom<
	g_chain extends ChainStruct,
> = PathFor<g_chain['namespace'], g_chain['reference']>;

export const Chains = create_store_class({
	store: SI_STORE_CHAINS,
	extension: 'map',
	class: class ChainsI extends WritableStoreMap<typeof SI_STORE_CHAINS> {
		static pathFor(si_family: ChainNamespaceKey, si_chain: string): PathFor<typeof si_family, typeof si_chain> {
			return `/family.${si_family}/chain.${si_chain}`;
		}

		static pathFrom(g_chain: Pick<ChainStruct, 'namespace' | 'reference'>): PathFrom<typeof g_chain> {
			return ChainsI.pathFor(g_chain.namespace, g_chain.reference);
		}

		static caip2From(g_chain: Pick<ChainStruct, 'namespace' | 'reference'>): Caip2.String {
			return `${g_chain.namespace}:${g_chain.reference}`;
		}

		static caip2For(p_chain: ChainPath): Caip2.String {
			const [si_namespace, si_reference] = ChainsI.parsePath(p_chain);

			return ChainsI.caip2From({
				namespace: si_namespace,
				reference: si_reference,
			});
		}

		static parsePath(p_chain: ChainPath): [ChainNamespaceKey, string] {
			const m_path = R_CHAIN_PATH.exec(p_chain);
			if(!m_path) throw new Error(`Invalid chain path: "${p_chain}"`);

			return [m_path[1] as ChainNamespaceKey, m_path[2]];
		}

		static addressFor(s_pubkey: string, z_context: ChainStruct | string): Bech32 {
			return pubkey_to_bech32(s_pubkey, z_context);
		}

		static transformBech32(sa_src: string, g_chain: ChainStruct, si_hrp: string=g_chain.bech32s.acc): Bech32 {
			return toBech32(si_hrp, fromBech32(sa_src).data) as Bech32;
		}

		static get(si_family: ChainNamespaceKey, si_chain: string): Promise<null | ChainStruct> {
			return Chains.read().then(ks => ks.get(si_family, si_chain));
		}

		static blockExplorer(si_type: Exclude<keyof BlockExplorerConfig, 'base'>, g_data: Dict, g_chain: ChainStruct): string {
			// prep block explorer url by concatenating base and category path
			let sx_url = g_chain.blockExplorer.base+g_chain.blockExplorer[si_type];

			// augment caller-supplied data with chain-defined variables
			const g_augmented: Dict = {
				...g_data,
				chain_prefix: g_chain.reference.replace(/-.+$/, ''),
			};

			// replace every entry in augmented data dict
			for(const si_key in g_augmented) {
				sx_url = sx_url.replace(`{${si_key}}`, g_augmented[si_key]);
			}

			// return final url string
			return sx_url;
		}

		static feeCoin(g_chain: ChainStruct): [string, CoinInfo] {
			const si_coin = g_chain.feeCoinIds?.[0] || Object.keys(g_chain.coins)[0];

			return [si_coin, g_chain.coins[si_coin]];
		}

		static allFeeCoins(g_chain: ChainStruct): [string, CoinInfo][] {
			return (g_chain.feeCoinIds || [Object.keys(g_chain.coins)[0]])
				.map(si_coin => [si_coin, g_chain.coins[si_coin]]);
		}

		// TODO: return normalized address using `normalizeBech32()`
		static isValidAddressFor(g_chain: ChainStruct, s_address: Chain.Bech32String, si_purpose: keyof ChainNamespace.Bech32s='acc') {
			if(g_chain.bech32s) {
				const m_bech32 = R_BECH32.exec(s_address);
				try {
					fromBech32(s_address);
				}
				catch(e_parse) {
					return false;
				}

				return m_bech32
					&& m_bech32[1] === g_chain.bech32s[si_purpose];
			}
			else {
				// TODO: non-bech32 chains
				return false;
			}
		}

		static summarizeAmount(g_amount: Writable<Coin>, g_chain: ChainStruct): string {
			// identify coin by its denom
			const si_coin = ChainsI.coinFromDenom(g_amount.denom, g_chain);

			// lookup coin
			const g_coin = g_chain.coins[si_coin];

			// convert to amount
			const x_amount = new BigNumber(g_amount.amount).shiftedBy(-g_coin.decimals).toNumber();

			// 
			return `${format_amount(x_amount, true)} ${si_coin}`;
		}

		static coinFromDenom(si_denom: string, g_chain: ChainStruct): string {
			for(const [si_coin, g_coin] of ode(g_chain.coins)) {
				if(si_denom === g_coin.denom) {
					return si_coin;
				}
			}

			return '';
		}

		* inNamespace(si_namespace: ChainNamespaceKey): IterableIterator<[ChainPath, ChainStruct]> {
			// create prefix
			const p_prefix = ChainsI.pathFor(si_namespace, '');

			// filter entriees
			for(const [p_chain, g_chain] of ode(this._w_cache)) {
				if(p_chain.startsWith(p_prefix)) {
					yield [p_chain, g_chain];
				}
			}
		}

		get(si_family: ChainNamespaceKey, si_chain: string): ChainStruct | null {
			// prepare path
			const p_res = ChainsI.pathFor(si_family, si_chain);

			// fetch
			return this._w_cache[p_res] ?? null;
		}

		async put(g_res: ChainStruct): Promise<PathFrom<typeof g_res>> {
			// prepare app path
			const p_res = ChainsI.pathFrom(g_res);

			// update cache
			this._w_cache[p_res] = g_res;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}
	},
});
