import type {MessageDict} from './_types';
import type {Coin} from '@cosmjs/amino';

import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';

import {add_coins} from './_util';

export const DistributionMessages: MessageDict = {
	'cosmos-sdk/MsgFundCommunityPool'(g_msg, {g_chain}) {
		const {
			depositor: sa_owner,
			amount: a_coins,
		} = g_msg as unknown as {
			depositor: Bech32;
			amount: Coin[];
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				add_coins({
					g_chain,
					coins: a_coins,
				}, a_fields);

				return {
					title: 'Fund Community Pool',
					value: `Sends coins into the community pool. The community pool can be used to fund individuals or projects upon governance proposals being passed.`,
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgSetWithdrawAddress'(g_msg, {g_chain}) {
		const {
			delegator_address: sa_delegator,
			withdraw_address: sa_withdraw,
		} = g_msg as unknown as {
			delegator_address: Bech32;
			withdraw_address: Bech32;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					{
						type: 'contacts',
						bech32s: [sa_delegator],
						label: 'Delegator',
						short: true,
						g_chain,
					},
					{
						type: 'contacts',
						bech32s: [sa_withdraw],
						label: 'Receiver',
						short: true,
						g_chain,
					},
				];

				return {
					title: 'Set Withdrawal Address',
					value: `Sets the address that should receive staking rewards.`,
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgWithdrawDelegationReward'(g_msg, {g_chain}) {
		const {
			delegator_address: sa_delegator,
			validator_address: sa_validator,
		} = g_msg as unknown as {
			delegator_address: Bech32;
			validator_address: Bech32;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					{
						type: 'contacts',
						bech32s: [sa_delegator],
						label: 'Delegator',
						short: true,
						g_chain,
					},
					{
						type: 'contacts',
						bech32s: [sa_validator],
						label: 'Validator',
						short: true,
						g_chain,
					},
				];

				return {
					title: 'Withdraw Delegation Rewards',
					value: `Claims staking rewards.`,
					fields: a_fields,
				};
			},
		};
	},
};
