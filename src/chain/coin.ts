import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import type {ChainStruct, CoinInfo} from '#/meta/chain';

import BigNumber from 'bignumber.js';

import {R_TRANSFER_AMOUNT} from '#/share/constants';
import {CoinGecko} from '#/store/web-apis';
import {ode} from '#/util/belt';
import {format_amount} from '#/util/format';


export function as_amount(g_coin: Coin, g_info: CoinInfo): string {
	const s_norm = g_coin.amount.padStart(g_info.decimals + 2, '0');

	const s_trimmed = (s_norm.slice(0, -g_info.decimals)+'.'+s_norm.slice(-g_info.decimals))
		.replace(/^(0(?!\.))+/, '')
		.replace(/([^.])0+$/, '$1');

	// absolute zero
	return '0.0' === s_trimmed? '0': s_trimmed;
}

export async function coin_to_fiat(g_balance: Coin, g_coin: CoinInfo, si_versus='usd'): Promise<BigNumber> {
	// zero
	if('0' === g_balance.amount) return new BigNumber(0);

	// lookup price
	const si_gecko = g_coin.extra!.coingeckoId;
	const g_versus = await CoinGecko.coinsVersus([si_gecko], si_versus);

	// parse balance and multiply by value
	return new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals).times(g_versus[si_gecko]);
}


export interface CoinFormats {
	/**
	 * The id of the fiat this coin is versus
	 */
	versus: string;

	/**
	 * The balance of the holding
	 */
	balance: BigNumber;

	/**
	 * The total 
	 */
	fiat: number;

	/**
	 * The worth of exactly 1 coin versus the given fiat
	 */
	worth: number;
}

export async function coin_formats(g_balance: Coin, g_coin: CoinInfo, si_versus='usd'): Promise<CoinFormats> {
	// lookup price
	const si_gecko = g_coin.extra!.coingeckoId;
	const g_versus = await CoinGecko.coinsVersus([si_gecko], si_versus);

	const x_worth = g_versus[si_gecko];

	const yg_balance = new BigNumber(g_balance.amount).shiftedBy(-g_coin.decimals).times(x_worth);

	// parse balance and multiply by value
	return {
		versus: si_versus,
		balance: yg_balance,
		fiat: yg_balance.times(x_worth).toNumber(),
		worth: x_worth,
	};
}



export class CoinParseError extends Error {}
export class DenomNotFoundError extends Error {}

export function parse_coin_amount(s_input: string, g_chain: ChainStruct): [bigint, string, CoinInfo] {
	// attempt to parse amount
	const m_amount = R_TRANSFER_AMOUNT.exec(s_input);
	if(!m_amount) {
		throw new CoinParseError(`Failed to parse transfer amount "${s_input}"`);
	}
	else {
		// destructure into amount and denom
		const [, s_amount, si_denom] = m_amount;

		// locate coin
		for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
			if(si_denom === g_coin_test.denom) {
				return [
					BigInt(s_amount),
					si_coin_test,
					g_coin_test,
				];
			}
		}

		throw new DenomNotFoundError(`Did not find "${si_denom}" denomination in ${g_chain.name}`);
	}
}

/**
 * Convenience function wraps getting info from Coin by asserting that the given Coin is defined in the chain
 */
function coin_info(g_coin: Coin, g_chain: ChainStruct): [string, CoinInfo] {
	// find coin's info
	const a_info = Coins.infoFromDenom(g_coin.denom, g_chain);
	if(!a_info) {
		throw new Error(`No coin info found for '${g_coin.denom}'`);
	}

	return a_info;
}

export const Coins = {
	infoFromDenom(si_denom: string, g_chain: ChainStruct): [string, CoinInfo] | null {
		for(const [si_coin, g_coin] of ode(g_chain.coins)) {
			if(si_denom === g_coin.denom) {
				return [si_coin, g_coin];
			}
		}

		return null;
	},

	idFromDenom(si_denom: string, g_chain: ChainStruct): string | null {
		return Coins.infoFromDenom(si_denom, g_chain)?.[0] || null;
	},


	detail(g_coin: Coin, g_chain: ChainStruct): {
		id: string;
		info: CoinInfo;
		balance: BigNumber;
	} {
		const [si_coin, g_info] = coin_info(g_coin, g_chain);
		return {
			id: si_coin,
			info: g_info,
			balance: new BigNumber(g_coin.amount).shiftedBy(-g_info.decimals),
		};
	},

	/**
	 * Extract the balance amount as a BigNumber for the given Coin
	 */
	balance(g_coin: Coin, g_chain: ChainStruct): BigNumber {
		return Coins.detail(g_coin, g_chain).balance;
	},

	/**
	 * Create a human-readable amount summary for the given Coin
	 */
	summarizeAmount(g_coin: Coin, g_chain: ChainStruct, b_imprecise=false): string {
		// lookup coin's id
		const si_coin = Coins.idFromDenom(g_coin.denom, g_chain);

		// convert balance to amount
		const x_amount = Coins.balance(g_coin, g_chain).toNumber();

		// 
		return `${format_amount(x_amount, b_imprecise)} ${si_coin!}`;
	},

	async displayInfo(g_coin: Coin, g_chain: ChainStruct, si_versus='usd'): Promise<CoinFormats> {
		const [, g_info] = coin_info(g_coin, g_chain);

		// lookup price
		const si_gecko = g_info.extra!.coingeckoId;
		const g_versus = await CoinGecko.coinsVersus([si_gecko], si_versus);

		// get fiat value
		const x_worth = g_versus[si_gecko];

		// multiply by holdings to get balance
		const yg_balance = Coins.balance(g_coin, g_chain).times(x_worth);

		// parse balance and multiply by value
		return {
			versus: si_versus,
			balance: yg_balance,
			fiat: yg_balance.times(x_worth).toNumber(),
			worth: x_worth,
		};
	},
};
