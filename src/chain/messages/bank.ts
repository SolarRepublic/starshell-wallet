import type {MessageDict, ReviewedMessage} from './_types';
import type {Coin} from '@cosmjs/amino';

import type {Bech32, ChainStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';
import type {FieldConfig} from '#/meta/field';

import BigNumber from 'bignumber.js';

import {address_to_name, add_coins} from './_util';

import {global_broadcast} from '#/script/msg-global';
import {Chains} from '#/store/chains';
import {ode} from '#/util/belt';
import {format_amount} from '#/util/format';

export interface AminoMsgSend {
	from_address: Bech32;
	to_address: Bech32;
	amount: Coin[];
}


function coin_to_payload(g_amount: Coin, g_chain: ChainStruct): Cw.Amount {
	// locate coin
	for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
		// found definition in chain
		if(g_amount.denom === g_coin_test.denom) {
			const x_amount = new BigNumber(g_amount.amount).shiftedBy(-g_coin_test.decimals).toNumber();
			return `${format_amount(x_amount, true)} ${si_coin_test}` as Cw.Amount;
		}
	}

	// unknown coin
	return `${g_amount.amount} ${g_amount.denom}` as Cw.Amount;
}


export const BankMessages: MessageDict = {
	'cosmos-sdk/MsgSend'(g_msg, {p_chain, g_chain, g_account, sa_owner}) {
		const {
			from_address: sa_sender,
			to_address: sa_recipient,
			amount: a_coins,
		} = g_msg as unknown as AminoMsgSend;

		const a_payloads = a_coins.map(g => coin_to_payload(g, g_chain));

		let s_payload = 'nothing';

		if(1 === a_payloads.length) {
			s_payload = a_payloads[0];
		}
		else if(2 === a_payloads.length) {
			s_payload = a_payloads.join(' + ');
		}
		else if(a_payloads.length > 2) {
			s_payload = `${a_payloads.length} various amounts`;
		}

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					{
						type: 'contacts',
						label: 'Recipient',
						bech32s: [sa_recipient],
						g_chain,
					},
				];

				const as_coins = new Set<string>();

				add_coins({
					g_chain,
					coins: a_coins,
					set: as_coins,
				}, a_fields);

				const s_coins = [...as_coins].join(', ');

				return {
					title: `Send ${s_coins}`,
					tooltip: `Sends coins from your account to the designated recipient.`,
					fields: a_fields,
				};
			},

			async apply() {
				// broadcast event
				global_broadcast({
					type: 'coinSent',
					value: {
						p_chain,
						sa_sender,
						a_amounts: a_coins,
					},
				});

				return {
					group: nl => `Payment${1 === nl? '': 's'} Sent`,
					title: `✅ Sent ${s_payload} on ${g_chain.name}`,
					message: `${s_payload} sent to ${await address_to_name(sa_recipient, g_chain)} from ${g_account.name} account`,
				};
			},

			affects: () => sa_recipient === sa_owner,

			async review(b_pending, b_incoming) {
				const s_recipient = await address_to_name(sa_recipient, g_chain, true);
				const s_sender = await address_to_name(sa_sender, g_chain, true);

				return {
					title: b_incoming
						? `Received ${s_payload}`
						: `Sen${b_pending? 'ding': 't'} ${s_payload}`,
					infos: [`to ${b_incoming? s_recipient: s_sender} on ${g_chain.name}`],
					fields: [
						{
							type: 'key_value',
							key: 'Amount',
							value: s_payload,
							// subvalue: to_fiat
						},
						b_incoming
							? {
								type: 'contacts',
								bech32s: [sa_sender],
								label: 'Sender',
								g_chain,
								short: true,
							}
							: {
								type: 'contacts',
								bech32s: [sa_recipient],
								label: 'Recipient',
								g_chain,
								short: true,
							},
					],
					resource: {
						name: Object.values(g_chain.coins)[0].name,
						pfp: g_chain.pfp,
					},
				} as ReviewedMessage;
			},

			async receive() {
				// broadcast event
				global_broadcast({
					type: 'coinReceived',
					value: {
						p_chain,
						sa_recipient,
						a_amounts: a_coins,
					},
				});

				return {
					group: nl => `Payment${1 === nl? '': 's'} Received`,
					// 💵💸
					title: `💵 Received ${s_payload} on ${g_chain.name}`,
					message: `${await address_to_name(sa_sender, g_chain)} sent ${s_payload} to your ${g_account.name} account`,
				};
			},

			test: () => sa_recipient === Chains.addressFor(g_account.pubkey, g_chain),
		};
	},

	'cosmos-sdk/MsgMultiSend'(g_msg, {g_chain}) {
		const {
			inputs: a_inputs,
			outputs: a_outputs,
		} = g_msg as unknown as {
			inputs: {
				address: Bech32;
				coins: Coin[];
			}[];
			outputs: {
				address: Bech32;
				coins: Coin[];
			}[];
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				const as_coins = new Set<string>();

				// there are other inputs
				if(a_inputs.length > 1) {
					// each input
					for(let i_input=0, nl_inputs=a_inputs.length; i_input<nl_inputs; i_input++) {
						const {
							address: sa_sender,
							coins: a_coins,
						} = a_inputs[i_input];

						// create subfields
						const a_subfields: FieldConfig[] = [];

						// add contact
						a_subfields.push({
							type: 'contacts',
							label: `Sender #${i_input+1}`,
							bech32s: [sa_sender],
							g_chain,
						});

						add_coins({
							g_chain,
							coins: a_coins,
							label_prefix: '└─ ',
							set: as_coins,
						}, a_subfields);

						// push group
						a_fields.push({
							type: 'group',
							fields: a_subfields,
						});
					}
				}

				// insert gap to break between senders and receivers
				a_fields.push({
					type: 'gap',
				});

				// each output
				for(let i_output=0, nl_outputs=a_outputs.length; i_output<nl_outputs; i_output++) {
					const {
						address: sa_recipient,
						coins: a_coins,
					} = a_outputs[i_output];

					// create subfields
					const a_subfields: FieldConfig[] = [];

					// add contact
					a_subfields.push({
						type: 'contacts',
						label: `Recipient #${i_output+1}`,
						bech32s: [sa_recipient],
						g_chain,
					});

					add_coins({
						g_chain,
						coins: a_coins,
						label_prefix: '└─ ',
						set: as_coins,
					}, a_subfields);

					// push group
					a_fields.push({
						type: 'group',
						fields: a_subfields,
					});
				}

				// insert gap to break end of receivers
				a_fields.push({
					type: 'gap',
				});

				const s_coins = [...as_coins].join(', ');
				return {
					title: `Multi-Send ${s_coins}`,
					tooltip: `Sends coins from the given inputs (which include your account) to the designated recipients.`,
					fields: a_fields,
				};
			},
		};
	},
};
