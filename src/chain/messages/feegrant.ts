import type {MessageDict} from './_types';
import type {Coin} from '@cosmjs/amino';

import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';

import {address_to_name, add_coins} from './_util';
import {Coins} from '../coin';

import {global_broadcast} from '#/script/msg-global';
import {format_date_long} from '#/util/format';

export const FeegrantMessages: MessageDict = {

	async 'cosmos-sdk/MsgGrantAllowance'(g_msg, {p_chain, g_chain, p_account, g_account}) {
		const {
			granter: sa_granter,
			grantee: sa_grantee,
			allowance: g_allowance,
		} = g_msg as unknown as {
			granter: Bech32;
			grantee: Bech32;
			allowance: {
				type: 'cosmos-sdk/BasicAllowance';
				value: {
					expiration?: string;
					spend_limit: Coin[];
				};
			} | {
				type: 'cosmos-sdk/PeriodicAllowance';
				value: {
					basic?: {
						expiration?: string;
						spend_limit: Coin[];
					};
					period?: {};
					period_spend_limit: Coin[];
					period_can_spend: Coin[];
					period_reset?: string;
				};
			};
		};

		const s_granter = (await address_to_name(sa_granter, g_chain)).replace(/fee-?grant|faucet$/gi, '').trim();

		const b_basic = 'cosmos-sdk/BasicAllowance' === g_allowance.type;

		let a_coins: Coin[] = [];
		let s_amount = '';
		let xt_expires = Infinity;

		if(b_basic) {
			a_coins = g_allowance.value.spend_limit;

			s_amount = a_coins.map(g_coin => Coins.summarizeAmount(g_coin, g_chain)).join(' + ');

			const s_expiration = g_allowance.value.expiration;
			if(s_expiration) {
				xt_expires = new Date(s_expiration).getTime();
			}
		}

		return {
			describe() {
				const a_fields_describe: FieldConfig[] = [];

				add_coins({
					g_chain,
					coins: a_coins,
				}, a_fields_describe);

				return {
					title: 'Issue Fee Grant Allowance',
					value: `Allows the grantee to spend coins from this account when paying for gas fees.`,
					fields: a_fields_describe,
				};
			},

			affects(h_events) {
				return (h_events.set_feegrant?.findIndex(g => g.grantee === sa_grantee) ?? -1) >= 0;
			},

			review() {
				const a_fields_review: FieldConfig[] = [];

				let s_summary = '';

				if(b_basic) {
					s_summary = `${s_granter} granted ${s_amount}`;

					a_fields_review.push(...[
						{
							type: 'key_value',
							key: 'Amount',
							value: s_amount,
						},
						{
							type: 'contacts',
							bech32s: [sa_granter],
							label: 'Granter',
							short: true,
							g_chain,
						},
						{
							type: 'accounts',
							paths: [p_account],
							label: 'Grantee',
							short: true,
						},
						{
							type: 'key_value',
							key: 'Expires',
							value: Number.isFinite(xt_expires)? format_date_long(xt_expires): 'Never',
						},
					] as FieldConfig[]);
				}

				return {
					title: `Received Fee Grant Allowance`,
					infos: [
						`${s_summary}`,
					],
					resource: g_chain,
					fields: [
						{
							type: 'key_value',
							key: 'Type',
							value: g_allowance.type.replace(/^[^/]+\//, ''),
						},
						...a_fields_review,
					],
				};
			},

			receive() {
				const s_grant_summary = b_basic
					? `with ${s_amount} worth of fees`
					: `a periodic allowance`;

				// broadcast
				global_broadcast({
					type: 'feegrantReceived',
					value: {
						p_chain,
						sa_grantee,
						sa_granter,
					},
				});

				return {
					group: nl => `Fee Grant Allowance${1 === nl? '': 's'} Received`,
					title: `💳 Received Fee Grant Allowance`,
					message: `${s_granter} granted ${g_account.name} ${s_grant_summary}.`
						+(Number.isFinite(xt_expires)? `\nExpires ${format_date_long(xt_expires)}`: '\nNever expires'),
				};
			},
		};
	},
};
