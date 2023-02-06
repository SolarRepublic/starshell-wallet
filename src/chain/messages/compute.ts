import type {DescribedMessage, MessageDict, SpendInfo} from './_types';

import type {Coin} from '@cosmjs/amino';
import type {AccessType} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/types';
import type {CodeInfoResponse} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import type {JsonObject} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import type {Snip24PermitMsg} from '#/schema/snip-24-def';

import {AminoJsonError, kv, MalforedMessageError} from './_util';

import {H_SNIP_HANDLERS} from './snip';
import {install_contracts} from '../contract';
import {SecretNetwork} from '../secret-network';

import {syswarn} from '#/app/common';
import PfpDisplay from '#/app/frag/PfpDisplay.svelte';
import {JsonPreviewer, snip_json_formats} from '#/app/helper/json-previewer';
import {svelte_to_dom} from '#/app/svelte';
import {SecretWasm} from '#/crypto/secret-wasm';

import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {defer_many, is_dict, proper} from '#/util/belt';
import {base64_to_buffer, buffer_to_hex, sha256_sync, uuid_v4} from '#/util/data';
import {dd} from '#/util/dom';
import {abbreviate_addr} from '#/util/format';
import { R_BECH32 } from '#/share/constants';
import { SessionStorage } from '#/extension/session-storage';
import { inject_app_profile } from '../app';
import { Apps } from '#/store/apps';

export const _FAILED_MESSAGE_OVERRIDE = Symbol('failed-message-override');

interface ExecContractMsg {
	contract: Bech32;
	msg: string;
	sent_funds: Coin[];
}

export const ComputeMessages: MessageDict = {
	query_permit(g_msg, {g_chain, p_app, g_app}) {
		const g_permit = g_msg as Snip24PermitMsg['value'];

		return {
			describe() {
				return {
					offline: true,
					title: 'Sign Query Permit',
					tooltip: 'Allows apps to view private data such as your token balance, ownership, etc. Scope and permissions are unique to each permit.',
					fields: [
						{
							type: 'key_value',
							key: 'Permissions',
							value: g_permit.permissions.map(proper).join(', '),
						},
						{
							type: 'key_value',
							key: 'Permit name',
							value: g_permit.permit_name,
						},
						{
							type: 'contracts',
							label: 'Tokens allowed to be queried',
							bech32s: g_permit.allowed_tokens,
							g_app,
							g_chain,
						},
					],
				} as DescribedMessage;
			},

			approve(si_txn) {
				return {
					query_permits: [{
						secret: Secrets.pathFrom({
							type: 'query_permit',
							uuid: SecretNetwork.uuidForQueryPermit(g_chain, g_permit.permit_name),
						}),
						action: {
							created: {
								app: p_app,
							},
						},
					}],
				};
			},
		};
	},

	'wasm/MsgStoreCode'(g_msg, {g_chain}) {
		const g_upload = g_msg as unknown as {
			sender: Bech32;
			wasm_byte_code: string;
			instantiate_permissions?: {
				permission: AccessType;
				addresses: Bech32[];
			};
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					kv('Code Size', `${Math.round(base64_to_buffer(g_upload.wasm_byte_code).byteLength / 1024 / 10) * 10} KiB`),
					kv('Code Hash', buffer_to_hex(sha256_sync(base64_to_buffer(g_upload.wasm_byte_code)))),
				];

				if(g_upload.instantiate_permissions) {
					a_fields.push(JsonPreviewer.render({
						Access: [
							'Unspecified',
							'Nobody',
							'Only Address',
							'Everybody',
							'Any of Addresses',
						][g_upload.instantiate_permissions.permission],
						Addresses: g_upload.instantiate_permissions.addresses,
					}, {
						chain: g_chain,
					}, {
						title: 'Permissions',
					}));
				}

				return {
					title: 'Upload Code',
					tooltip: `Uploads code to the chain in order to be used later when instantiatiating smart contracts.`,
					fields: a_fields,
				};
			},
		};
	},

	async 'wasm/MsgInstantiateContract'(g_msg, {
		p_chain,
		g_chain,
		p_account,
		g_account,
		g_app,
		p_app,
	}) {
		const g_instantiate = g_msg as unknown as {
			sender: Bech32;
			code_id: `${bigint}`;
			label: string;
			init_msg: string;
			init_funds: Coin[];
		};

		const s_label = g_instantiate.label;

		// ref init message json
		let sx_json = g_instantiate.init_msg;

		// secret wasm
		if(g_chain.features.secretwasm) {
			// decrypt secret wasm amino message
			({
				message: sx_json,
			} = await SecretWasm.decodeSecretWasmAmino(p_account, g_chain, g_instantiate.init_msg));
		}

		// parse message
		let h_instantiate: JsonObject;
		try {
			h_instantiate = JSON.parse(sx_json) as JsonObject;
		}
		catch(e_parse) {
			throw new AminoJsonError(sx_json);
		}

		// ref code id
		const si_instantiate = g_instantiate.code_id;

		// map spends
		const a_spends: SpendInfo[] = [];
		const a_init_funds = g_instantiate.init_funds;
		if(a_init_funds?.length) {
			a_spends.push({
				pfp: g_chain.pfp,
				amounts: a_init_funds.map(g_coin => Chains.summarizeAmount(g_coin, g_chain)),
			});
		}

		return {
			async apply(nl_msgs, si_txn, h_events) {
				// the instantiated contract address
				let sa_created: Bech32;
				try {
					const as_contracts = h_events?.['message']?.['contract_address'];
					if(!(as_contracts instanceof Set)) {
						throw new Error(`No contract address emitted in event log`);
					}

					sa_created = [...as_contracts][0] as Bech32;
					if(!R_BECH32.test(sa_created)) {
						throw new Error(`Failed to parse instantiated contract address from event log: "${sa_created}" is not understood`);
					}

					// brand new contract, fill app profile with definition automagically
					await inject_app_profile(g_app, {
						contracts: {
							[uuid_v4()]: {
								bech32: sa_created,
								chain: p_chain,
								interfaces: {
									excluded: [],
								},
								hash: '',
								name: g_instantiate.label,
								on: 1,
								origin: `app:${p_app}`,

								// inherit pfp from app
								pfp: g_app.pfp,
							},
						},
					});

					// attempt to install contract
					await install_contracts([sa_created], g_chain, g_app);
				}
				catch(e_apply) {
					syswarn({
						title: 'Contract did not install',
						text: e_apply.message,
					});
				}

				return {
					group: nl => `Contract${1 === nl? '': 's'} Instantiated`,
					title: '🚀 Contract Instantiated',
					message: `${g_account.name} created the "${s_label}" contract on ${g_chain.name}`,
				};
			},

			describe() {
				return {
					title: 'Instantiate Contract',
					tooltip: `Creates a new contract using some code that is already on chain (given by its Code ID). The configuration below will forever be part of the contract's internal settings.`,
					fields: [
						// render with deferred values
						JsonPreviewer.render((() => {
							// defer in batch
							// eslint-disable-next-line @typescript-eslint/unbound-method
							const {
								promises: h_promises,
								resolve: fk_resolve,
							} = defer_many({
								creator: '',
								codeHash: '',
								source: '',
							});

							// go async
							(async() => {
								// instantiate network
								const k_network = await Providers.activateDefaultFor(g_chain);

								// lookup code info
								const g_code = await k_network.codeInfo(si_instantiate) || {} as CodeInfoResponse;

								// resolve in batch
								fk_resolve(g_code);
							})();

							// return placeholders
							return {
								'Code ID': si_instantiate,
								'Creator': h_promises.creator,
								// 'Code Hash': h_promises.codeHash,
								'Source': h_promises.source,
							};
						})(), {
							chain: g_chain,
						}, {
							title: 'Code Info',
						}),
						{
							type: 'key_value',
							key: 'Contract label',
							value: g_instantiate.label,
							long: true,
						},
						JsonPreviewer.render(h_instantiate, {
							chain: g_chain,
						}, {
							title: 'Configuration',
						}),
					],
					spends: a_spends,
				};
			},

			async review(b_pending, b_incoming) {
				const a_funds_dom: HTMLSpanElement[] = [];
				if(a_spends?.length) {
					for(const g_spend of a_spends) {
						a_funds_dom.push(dd('span', {
							class: 'global_flex-auto',
							style: `
								gap: 6px;
							`,
						}, [
							await svelte_to_dom(PfpDisplay, {
								resource: g_chain,
								dim: 16,
							}, 'loaded'),
							g_spend.amounts.join(' + '),
						]));
					}
				}

				// merge with snip review
				return {
					title: `Instantiat${b_pending? 'ing': 'ed'} Contract`,
					infos: [
						`${s_label.replace(/\s+((smart\s+)?contract|token|minter|d?app)$/i, '')}`,
					],
					// resource: g_contract,
					fields: [
						{
							type: 'key_value',
							key: 'Label',
							value: s_label,
						},
						{
							type: 'key_value',
							key: 'Code ID',
							value: si_instantiate,
						},
						...a_spends.length? [
							{
								type: 'key_value',
								key: 'Sent funds',
								value: dd('div', {
									class: `global_flex-auto`,
									style: `
										flex-direction: column;
									`,
								}, a_funds_dom),
							},
						]: [],
						// {
						// 	type: 'contracts',
						// 	bech32s: [sa_contract],
						// 	g_app,
						// 	g_chain,
						// 	label: 'Token / Contract',
						// },
						// ...g_review?.['fields'] || [
						// 	JsonPreviewer.render(h_args, {
						// 		chain: g_chain,
						// 		formats: snip_json_formats(g_contract, si_action),
						// 	}, {
						// 		label: 'Inputs',
						// 	}),
						// ],
					],
				};
			},

			fail(nl_msgs, g_result) {
				// catch-all
				return {
					title: '❌ Instantiation Failure',
					message: g_result.log,
				};
			},
		};
	},

	async 'wasm/MsgExecuteContract'(g_msg, g_context) {
		// cast msg arg
		let g_exec = g_msg as unknown as ExecContractMsg;

		// destructure context arg
		const {
			p_chain,
			g_chain,
			g_account,
			g_app,
			p_app,
			sa_owner,
		} = g_context;

		let sa_contract = g_exec.contract;

		let a_sent_funds = g_exec.sent_funds;

		let sx_json = '';
		let h_exec!: JsonObject;
		let si_action: string;

		// secret wasm
		const g_secret_wasm = g_chain.features.secretwasm;

		// message override
		if(_FAILED_MESSAGE_OVERRIDE in g_exec) {
			let h_msg!: JsonObject;
			({
				msg: h_msg,
				contract: sa_contract,
				sent_funds: a_sent_funds=[],
			} = g_exec[_FAILED_MESSAGE_OVERRIDE] as {
				contract: Bech32;
				msg: JsonObject;
				sent_funds?: Coin[];
			});

			sx_json = JSON.stringify(h_msg);

			// TODO: improve this mechanism
			g_exec = {
				contract: sa_contract,
				msg: sx_json,
				sent_funds: a_sent_funds,
			};
		}
		// normal message
		else {
			// ref init message json
			sx_json = g_exec.msg;

			// prep nonce if on secret
			let atu8_nonce: Uint8Array;

			// secret wasm
			if(g_secret_wasm) {
				// decrypt secret wasm amino message
				({
					message: sx_json,
					nonce: atu8_nonce,
				} = await SecretWasm.decryptMsg(g_account, g_chain, base64_to_buffer(sx_json)));
			}
		}

		let h_args: JsonObject;
		try {
			h_exec = JSON.parse(sx_json) as JsonObject;

			if(!is_dict(h_exec)) throw new MalforedMessageError('Top-level parsed JSON value is not an object', h_exec);

			si_action = Object.keys(h_exec)[0];

			h_args = h_exec[si_action] as JsonObject;
			if(!is_dict(h_args)) throw new MalforedMessageError('Nested parsed JSON value is not an object', h_args);
		}
		catch(e_parse) {
			throw new AminoJsonError(sx_json);
		}

		const p_contract = Contracts.pathFor(g_context.p_chain, sa_contract);

		const g_contract = await Contracts.at(p_contract);

		const s_contract = g_contract?.name || abbreviate_addr(sa_contract);


		// map spends
		const a_spends: SpendInfo[] = [];
		if(a_sent_funds?.length) {
			a_spends.push({
				pfp: g_chain.pfp,
				amounts: a_sent_funds.map(g_coin => Chains.summarizeAmount(g_coin, g_chain)),
			});
		}

		return {
			async affects(h_events) {
				// on secret-wasm
				if(g_secret_wasm) {
					// contract
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					return await g_handled?.affects?.(h_events);
				}
			},

			describe() {
				return {
					title: 'Execute Contract',
					tooltip: `Asks the smart contract to perform some predefined action, given the inputs defined below.`,
					fields: [
						{
							type: 'contracts',
							bech32s: [sa_contract],
							label: 'Contract',
							g_app,
							g_chain,
						},
						kv('Action', si_action),
						JsonPreviewer.render(h_args, {
							chain: g_chain,
							formats: snip_json_formats(g_contract, si_action),
						}, {
							title: 'Inputs',
							unlabeled: true,
						}),
					],
					spends: a_spends,
				};
			},

			async approve() {
				try {
					await install_contracts([sa_contract], g_chain, g_app);
				}
				catch(e_install) {
					syswarn({
						title: `Failed to install contract`,
						text: e_install.message,
					});
				}

				return {
					executions: [
						{
							contract: sa_contract,
							msg: h_exec,
						},
					],
				};
			},

			async apply(nl_msgs, si_txn) {
				// on secret-wasm
				if(g_secret_wasm) {
					// contract
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					const g_applied = await g_handled?.apply?.(si_txn);

					// snip token
					if(g_applied) return g_applied;
				}

				return {
					group: nl => `Contract${1 === nl? '': 's'} Executed`,
					title: '🟢 Contract Executed',
					message: `${s_contract} → ${si_action} on ${g_chain.name}`,
				};
			},

			async review(b_pending, b_incoming) {
				let g_review = {};

				// on secret-wasm
				if(g_secret_wasm) {
					// contract 
					const g_handled = await H_SNIP_HANDLERS[si_action]?.(h_args, g_context, g_exec);
					g_review = await g_handled?.review?.(b_pending, b_incoming);
				}

				const a_funds_dom: HTMLSpanElement[] = [];
				if(a_spends?.length) {
					for(const g_spend of a_spends) {
						a_funds_dom.push(dd('span', {
							class: 'global_flex-auto',
							style: `
								gap: 6px;
							`,
						}, [
							await svelte_to_dom(PfpDisplay, {
								resource: g_chain,
								dim: 16,
							}, 'loaded'),
							g_spend.amounts.join(' + '),
						]));
					}
				}

				// merge with snip review
				return {
					title: `Execut${b_pending? 'ing': 'ed'} Contract`,
					infos: [
						`${s_contract.replace(/\s+((smart\s+)?contract|token|minter|d?app)$/i, '')} → ${si_action} on ${g_chain.name}`,
					],
					resource: g_contract,
					...g_review,
					fields: [
						...a_spends.length? [
							{
								type: 'key_value',
								key: 'Sent funds',
								value: dd('div', {
									class: `global_flex-auto`,
									style: `
										flex-direction: column;
									`,
								}, a_funds_dom),
							},
						]: [],
						{
							type: 'contracts',
							bech32s: [sa_contract],
							g_app,
							g_chain,
							label: 'Token / Contract',
						},
						{
							type: 'key_value',
							key: 'Action',
							value: si_action,
						},
						...g_review?.['fields'] || [
							JsonPreviewer.render(h_args, {
								chain: g_chain,
								formats: snip_json_formats(g_contract, si_action),
							}, {
								label: 'Inputs',
							}),
						],
					],
				};
			},

			async fail(nl_msgs, g_result) {
				// secret
				if(g_chain.features.secretwasm) {
					// parse contract error
					try {
						const sx_error = await SecretWasm.decryptComputeError(g_account, g_chain, g_result.log, atu8_nonce);

						const g_error = JSON.parse(sx_error);

						const w_msg = g_error.generic_err?.msg || sx_error;

						// ⛔ 📩 ❌ 🚫 🪃 ⚠️
						return {
							title: '⚠️ Contract Denied Request',
							message: `${s_contract}: ${w_msg}`,
						};
					}
					catch(e) {}

					// catch-all
					return {
						title: '❌ Execution Failure',
						message: g_result.log,
					};
				}
			},
		};
	},
};
