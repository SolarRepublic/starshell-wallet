import type {CosmosNetwork} from './cosmos-network';
import type {SecretNetwork} from './secret-network';

import type {AccountStruct} from '#/meta/account';
import type {ContractStruct} from '#/meta/chain';

import {Snip2xToken, ViewingKeyError} from '#/schema/snip-2x-const';

import BigNumber from 'bignumber.js';

import {R_BECH32} from '#/share/constants';
import {Chains} from '#/store/chains';
import {CoinGecko} from '#/store/web-apis';
import {format_amount, format_fiat} from '#/util/format';

export interface BalanceStruct {
	yg_amount: BigNumber;
	s_amount: string;
	yg_worth: Promise<BigNumber>;
	yg_fiat: Promise<BigNumber>;
	s_fiat: Promise<string>;
	s_worth: Promise<string>;
}

export async function token_balance(g_contract: ContractStruct, g_account: AccountStruct, k_network: CosmosNetwork): Promise<BalanceStruct | null> {
	// synchronously extract account space
	const m_bech32 = R_BECH32.exec(g_contract.bech32)!;

	// deduce owner address
	const sa_owner = Chains.addressFor(g_account.pubkey, m_bech32[1]);

	// ref chain
	const g_chain = k_network.chain;

	// deduce chain path
	const p_chain = Chains.pathFrom(g_chain);

	// lookup viewing key
	const p_viewing_key = g_account.assets[p_chain]?.data?.[g_contract.bech32]?.viewingKeyPath;
	if(p_viewing_key) {
		// instantiate snip token
		const k_snip = Snip2xToken.from(g_contract, k_network as SecretNetwork, g_account);

		// contract struct does not implement interface
		if(!k_snip) {
			throw new Error(`Not a SNIP-20 token`);
		}

		// query balance
		const g_response = await k_snip.balance();

		// viewing key error
		if(g_response['viewing_key_error']) {
			throw new ViewingKeyError((g_response['viewing_key_error'] as {msg: string}).msg);
		}

		// ref snip20 struct
		const g_snip20 = g_contract.interfaces.snip20!;

		// parse token balance amount
		const yg_amount = BigNumber(g_response.balance.amount).shiftedBy(-g_snip20.decimals);

		const dp_worth = (async() => {
			const si_coingecko = g_snip20.extra?.coingeckoId;
			if(!si_coingecko) return '';

			const h_versus = await CoinGecko.coinsVersus([si_coingecko], 'usd', 60e3);
			return String(h_versus[si_coingecko]);
		})();

		// return as struct
		return {
			yg_amount: yg_amount,
			s_amount: format_amount(yg_amount.toNumber()),
			yg_worth: dp_worth.then(s => BigNumber(s)),
			s_worth: (async() => {
				try {
					const s_worth = await dp_worth;

					return s_worth? format_fiat(BigNumber(s_worth).toNumber(), 'usd'): '';
				}
				catch(e_worth) {
					return 'temporarily unavailable';
				}
			})(),
			yg_fiat: dp_worth.then(s => yg_amount.times(BigNumber(s || '0'))),
			s_fiat: (async() => {
				try {
					const s_worth = await dp_worth;

					if(!s_worth) return '';

					const yg_fiat = yg_amount.times(s_worth);

					return format_fiat(yg_fiat.toNumber(), 'usd');
				}
				catch(e_fiat) {
					return 'temporarily unavailable';
				}
			})(),
		};
	}

	return null;
}
