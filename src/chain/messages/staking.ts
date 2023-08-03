import type {MessageDict} from './_types';
import type {Coin} from '@cosmjs/amino';

import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';

import {add_coins} from './_util';
import { AbbreviationLevel } from '#/util/format';

export const StakingMessages: MessageDict = {
	'cosmos-sdk/MsgBeginRedelegate'(g_msg, {g_chain}) {
		const {
			delegator_address: sa_owner,
			validator_src_address: sa_src,
			validator_dst_address: sa_dst,
			amount: g_amount,
		} = g_msg as unknown as {
			delegator_address: Bech32;
			validator_src_address: Bech32;
			validator_dst_address: Bech32;
			amount: Coin;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				a_fields.push({
					type: 'contacts',
					bech32s: [sa_src],
					label: 'Source Validator',
					abbrv: AbbreviationLevel.SOME,
					g_chain,
				});

				a_fields.push({
					type: 'contacts',
					bech32s: [sa_dst],
					label: 'Destination Validator',
					abbrv: AbbreviationLevel.SOME,
					g_chain,
				});

				add_coins({
					g_chain,
					coins: [g_amount],
				}, a_fields);

				return {
					title: 'Redelgate',
					tooltip: 'Moves staked coins from current validator to a different validator without missing any rewards.',
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgDelegate'(g_msg, {g_chain}) {
		const {
			delegator_address: sa_owner,
			validator_address: sa_validator,
			amount: g_amount,
		} = g_msg as unknown as {
			delegator_address: Bech32;
			validator_address: Bech32;
			amount: Coin;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				a_fields.push({
					type: 'contacts',
					bech32s: [sa_validator],
					label: 'Validator',
					abbrv: AbbreviationLevel.SOME,
					g_chain,
				});

				add_coins({
					g_chain,
					coins: [g_amount],
				}, a_fields);

				return {
					title: 'Delegate',
					tooltip: 'Stakes coins with the given validator(s), which also increases their voting power.',
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgUndelegate'(g_msg, {g_chain}) {
		const {
			delegator_address: sa_owner,
			validator_address: sa_validator,
			amount: g_amount,
		} = g_msg as unknown as {
			delegator_address: Bech32;
			validator_address: Bech32;
			amount: Coin;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				a_fields.push({
					type: 'contacts',
					bech32s: [sa_validator],
					label: 'Validator',
					abbrv: AbbreviationLevel.SOME,
					g_chain,
				});

				add_coins({
					g_chain,
					coins: [g_amount],
				}, a_fields);

				return {
					title: 'Undelegate',
					tooltip: 'Returns staked coins to your wallet, allowing them to be spent only after the unbonding period has passed.',
					fields: a_fields,
				};
			},
		};
	},

};
