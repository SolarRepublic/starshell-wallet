import type {CosmosNetwork, DecodedAllowance} from './cosmos-network';

import type {AccountStruct} from '#/meta/account';
import type {Dict} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';

import BigNumber from 'bignumber.js';

import {Coins} from './coin';

import {Chains} from '#/store/chains';

type FeeGrantStruct = {
	amount: BigNumber;
	expiration: number;
	grants: {
		allowance: DecodedAllowance;
		amount: BigNumber;
		expiration: number;
	}[];
};


export class FeeGrants {
	static async forAccount(g_account: AccountStruct, k_network: CosmosNetwork): Promise<FeeGrants> {
		const k_fee_grants = new FeeGrants(g_account, k_network);
		await k_fee_grants._update();
		return k_fee_grants;
	}

	protected _sa_owner: Bech32;

	// coin id to struct mapping
	protected _h_grants: Dict<FeeGrantStruct> = {};

	protected _a_expired: DecodedAllowance[] = [];

	constructor(protected _g_account: AccountStruct, protected _k_network: CosmosNetwork) {
		this._sa_owner = Chains.addressFor(_g_account.pubkey, _k_network.chain);
	}

	protected async _update(): Promise<void> {
		const {
			_k_network: {
				chain: g_chain,
			},
		} = this;

		// fetch all feegrants for this account
		const a_results = await this._k_network.feeGrants(this._sa_owner);

		// prep grants dict
		const h_grants: Dict<FeeGrantStruct> = {};

		// cache now timestamp
		const xt_now = Date.now();

		// each result
		for(const g_result of a_results) {
			// basic allowance type
			if('BasicAllowance' === g_result.allowance.type) {
				// destructure allowance value
				const {
					expiration: g_expiration,
					spendLimit: a_limits,
				} = g_result.allowance.value;

				// each spend limit
				for(const g_limit of a_limits) {
					// get details on coin amount
					const {
						id: si_coin,
						balance: yg_balance,
					} = Coins.detail(g_limit, g_chain);

					const xt_expiration = g_expiration? parseFloat(g_expiration.seconds) * 1e3: Infinity;

					// expired; push and continue on
					if(xt_expiration < xt_now) {
						this._a_expired.push(g_result);
						continue;
					}

					// ref/make the grant descriptor for this coin
					const g_grant = h_grants[si_coin] = h_grants[si_coin] || {
						amount: BigNumber(0),
						expiration: Infinity,
						grants: [],
					};

					// upsert descriptor
					Object.assign(g_grant, {
						// update total
						amount: g_grant.amount.plus(yg_balance),

						// take soonest expiration
						expiration: Math.min(g_grant.expiration, xt_expiration),
					});

					// save result to dict
					g_grant.grants.push({
						allowance: g_result,
						amount: yg_balance,
						expiration: xt_expiration,
					});
				}
			}
		}

		// replace field
		this._h_grants = h_grants;
	}

	get grants(): Dict<FeeGrantStruct> {
		return this._h_grants;
	}
}
