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
};
