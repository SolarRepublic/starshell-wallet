import type {AminoMsg} from '@cosmjs/amino';

import type {Dict, JsonObject, JsonPrimitive, JsonValue, Promisable} from '#/meta/belt';
import type {ChainStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';
import type {IncidentStruct, IncidentType, TxError, TxSynced} from '#/meta/incident';

import type {StoreKey} from '#/meta/store';

import {decodeTxRaw} from '@cosmjs/proto-signing';

import {global_broadcast, global_receive} from './msg-global';

import type {LocalAppContext} from '#/app/svelte';
import {proto_to_amino} from '#/chain/cosmos-msgs';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
import type {TmJsonRpcWebsocket} from '#/cosmos/tm-json-rpc-ws-const';
import type {WsTxResponse, WsTxResultError, WsTxResultSuccess} from '#/cosmos/tm-json-rpc-ws-def';
import type {NotificationConfig, NotifyItemConfig} from '#/extension/notifications';
import {R_TX_ERR_ACC_SEQUENCE} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains, parse_date, TransactionNotFoundError} from '#/store/chains';
import {Incidents} from '#/store/incidents';

import {fodemtv, is_dict, is_dict_es, oderac} from '#/util/belt';
import {base64_to_buffer, base64_to_text, buffer_to_hex, sha256_sync_insecure} from '#/util/data';
import {format_amount} from '#/util/format';


export interface CosmosEvents {
	'tx.hash': [Cw.Hex];
	'tx.height': [Cw.NaturalNumber];
	'tx.acc_seq'?: `${Cw.Bech32}/${Cw.NaturalNumber}`[];
	'tx.fee'?: Cw.Coin[];
	'tm.event'?: Cw.String[];
	'tx.signature'?: Cw.Base64[];
	'message.action'?: Cw.String[];
	'message.module'?: Cw.String[];
	'message.sender'?: Cw.Bech32[];
	'message.contract_address'?: Cw.Bech32[];
	'transfer.sender'?: Cw.Bech32[];
	'transfer.recipient'?: Cw.Bech32[];
	'transfer.amount'?: Cw.Coin[];
	'coin_spent.spender'?: Cw.Bech32[];
	'coin_spent.amount'?: Cw.Coin[];
	'coin_received.receiver'?: Cw.Bech32[];
	'coin_received.amount'?: Cw.Coin[];
	'use_feegrant.granter'?: Cw.Bech32[];
	'use_feegrant.grantee'?: Cw.Bech32[];
	'set_feegrant.granter'?: Cw.Bech32[];
	'set_feegrant.grantee'?: Cw.Bech32[];
	'wasm.contract_address'?: Cw.Bech32[];
}


interface AbciExtras {
	g_synced?: TxSynced | TxError;
	si_txn?: string;

	/**
	 * Optionally, the block of the previous bulk sync
	 */
	xg_previous?: bigint;
}

interface TxDataExtra extends AbciExtras {
	si_txn: string;
	s_height: string;
	s_gas_used: string;
	s_gas_wanted: string;
	a_events: WsTxResultSuccess['events'];
	s_log: string;
}

export interface TxAbciConfig {
	type: Extract<IncidentType, 'tx_out' | 'tx_in'>;
	filter: string | string[];
	data?(a_msgs: AminoMsg[], g_extra: TxDataExtra, g_synced?: TxSynced): Promisable<void>;
	error?(a_msgs: AminoMsg[], g_error: WsTxResultError, si_txn: string): Promisable<void>;
}

export interface ReceiverError {
	code: number;
	reason: string;
	wasClean: boolean;
	error: Event | undefined;
}


export type ReceiverHooks = {
	connect?(this: TmJsonRpcWebsocket): Promisable<void>;

	error?(this: TmJsonRpcWebsocket, g_error: ReceiverError): Promisable<void>;
};

export type AbciHooks = {
	data(this: TmJsonRpcWebsocket, g_data: {}, g_extras: AbciExtras): Promisable<void>;
};

export interface AbciConfig {
	filter: string[];
	type: Extract<IncidentType, 'tx_out' | 'tx_in'>;
	hooks: AbciHooks;
}



export const H_TX_ERROR_HANDLERS: Dict<Dict<(g_result: WsTxResultError) => Promisable<NotifyItemConfig | void>>> = {
	// TODO: fill out rest of exception messages

	sdk: {
		// ErrTxDecode                = Register(testCodespace, 2, "tx parse error")
		// ErrInvalidSequence         = Register(testCodespace, 3, "invalid sequence")
		// ErrUnauthorized            = Register(testCodespace, 4, "unauthorized")
		// ErrInsufficientFunds       = Register(testCodespace, 5, "insufficient funds")
		// ErrUnknownRequest          = Register(testCodespace, 6, "unknown request")
		// ErrInvalidAddress          = Register(testCodespace, 7, "invalid address")
		// ErrInvalidPubKey           = Register(testCodespace, 8, "invalid pubkey")
		// ErrUnknownAddress          = Register(testCodespace, 9, "unknown address")
		// ErrInvalidCoins            = Register(testCodespace, 10, "invalid coins")

		// ErrOutOfGas                = Register(testCodespace, 11, "out of gas")
		11: g_result => ({
			title: '❌ Not Enough Gas',
			message: `The transaction failed because ${format_amount(Number(g_result.gas_wanted))} GAS was not enough.`,
		}),

		// ErrInsufficientFee         = Register(testCodespace, 13, "insufficient fee")
		// ErrTooManySignatures       = Register(testCodespace, 14, "maximum number of signatures exceeded")
		// ErrNoSignatures            = Register(testCodespace, 15, "no signatures supplied")
		// ErrJSONMarshal             = Register(testCodespace, 16, "failed to marshal JSON bytes")
		// ErrJSONUnmarshal           = Register(testCodespace, 17, "failed to unmarshal JSON bytes")
		// ErrInvalidRequest          = Register(testCodespace, 18, "invalid request")
		// ErrMempoolIsFull           = Register(testCodespace, 20, "mempool is full")

		// ErrTxTooLarge              = Register(testCodespace, 21, "tx too large")
		21: g_result => ({
			title: '❌ Transaction Too Large',
			message: `The transaction was rejected because it is too large.`,
		}),

		// ErrKeyNotFound             = Register(testCodespace, 22, "key not found")
		// ErrorInvalidSigner         = Register(testCodespace, 24, "tx intended signer does not match the given signer")
		// ErrInvalidChainID          = Register(testCodespace, 28, "invalid chain-id")
		// ErrInvalidType             = Register(testCodespace, 29, "invalid type")
		// ErrUnknownExtensionOptions = Register(testCodespace, 31, "unknown extension options")
		// ErrPackAny                 = Register(testCodespace, 33, "failed packing protobuf message to Any")
		// ErrLogic                   = Register(testCodespace, 35, "internal logic error")
		// ErrConflict                = RegisterWithGRPCCode(testCodespace, 36, codes.FailedPrecondition, "conflict")
		// ErrNotSupported            = RegisterWithGRPCCode(testCodespace, 37, codes.Unimplemented, "feature not supported")
		// ErrNotFound                = RegisterWithGRPCCode(testCodespace, 38, codes.NotFound, "not found")
		// ErrIO                      = Register(testCodespace, 39, "Internal IO error")
	},

	secret_compute: {
		// // ErrInstantiateFailed error for rust instantiate contract failure
		// ErrInstantiateFailed = sdkErrors.Register(DefaultCodespace, 2, "instantiate contract failed")
		2: g_result => ({
			title: '❌ Instantiation Failed',
			message: `The contract failed to instantiate.`,
		}),

		// // ErrExecuteFailed error for rust execution contract failure
		// ErrExecuteFailed = sdkErrors.Register(DefaultCodespace, 3, "execute contract failed")

		// // ErrQueryFailed error for rust smart query contract failure
		// ErrQueryFailed = sdkErrors.Register(DefaultCodespace, 4, "query contract failed")

		// // ErrMigrationFailed error for rust execution contract failure
		// ErrMigrationFailed = sdkErrors.Register(DefaultCodespace, 5, "migrate contract failed")

		// // ErrAccountExists error for a contract account that already exists
		// ErrAccountExists = sdkErrors.Register(DefaultCodespace, 6, "contract account already exists")
		6: g_result => ({
			title: '❌ Contract Account Exists',
			message: `The contract account already exists.`,
		}),

		// // ErrGasLimit error for out of gas
		// ErrGasLimit = sdkErrors.Register(DefaultCodespace, 7, "insufficient gas")

		// // ErrInvalidGenesis error for invalid genesis file syntax
		// ErrInvalidGenesis = sdkErrors.Register(DefaultCodespace, 8, "invalid genesis")

		// // ErrNotFound error for an entry not found in the store
		// ErrNotFound = sdkErrors.Register(DefaultCodespace, 9, "not found")

		// // ErrInvalidMsg error when we cannot process the error returned from the contract
		// ErrInvalidMsg = sdkErrors.Register(DefaultCodespace, 10, "invalid CosmosMsg from the contract")

		// // ErrEmpty error for empty content
		// ErrEmpty = sdkErrors.Register(DefaultCodespace, 11, "empty")

		// // ErrLimit error for content that exceeds a limit
		// ErrLimit = sdkErrors.Register(DefaultCodespace, 12, "exceeds limit")

		// // ErrInvalid error for content that is invalid in this context
		// ErrInvalid = sdkErrors.Register(DefaultCodespace, 13, "invalid")

		// // ErrDuplicate error for content that exsists
		// ErrDuplicate = sdkErrors.Register(DefaultCodespace, 14, "duplicate")

		// // ErrCreateFailed error for wasm code that has already been uploaded or failed
		// ErrCreateFailed = sdkErrors.Register(DefaultCodespace, 15, "create contract failed")

		// // ErrSigFailed error for wasm code that has already been uploaded or failed
		// ErrSigFailed = sdkErrors.Register(DefaultCodespace, 16, "parse signature failed")

		// // ErrUnsupportedForContract error when a feature is used that is not supported for/ by this contract
		// ErrUnsupportedForContract = sdkErrors.Register(DefaultCodespace, 17, "unsupported for this contract")

		// // ErrUnknownMsg error by a message handler to show that it is not responsible for this message type
		// ErrUnknownMsg = sdkErrors.Register(DefaultCodespace, 18, "unknown message from the contract")

		// // ErrReplyFailed error for rust execution contract failure
		// ErrReplyFailed = sdkErrors.Register(DefaultCodespace, 19, "reply to contract failed")

		// // ErrInvalidEvent error if an attribute/event from the contract is invalid
		// ErrInvalidEvent = sdkErrors.Register(DefaultCodespace, 21, "invalid event")

		// // ErrMaxIBCChannels error for maximum number of ibc channels reached
		// ErrMaxIBCChannels = sdkErrors.Register(DefaultCodespace, 22, "max transfer channels")
	},

	feegrant: {
		// // ErrFeeLimitExceeded error if there are not enough allowance to cover the fees
		// ErrFeeLimitExceeded = sdkerrors.Register(DefaultCodespace, 2, "fee limit exceeded")
		2: g_result => ({
			title: '❌ Fee Limit Exceeded',
			message: `The fees for the attempted transaction exceed the limit set by the fee grant.`,
		}),

		// // ErrFeeLimitExpired error if the allowance has expired
		// ErrFeeLimitExpired = sdkerrors.Register(DefaultCodespace, 3, "fee allowance expired")
		3: g_result => ({
			title: '❌ Fee Grant Expired',
			message: `The fee grant attempting to be used has expired.`,
		}),

		// // ErrInvalidDuration error if the Duration is invalid or doesn't match the expiration
		// ErrInvalidDuration = sdkerrors.Register(DefaultCodespace, 4, "invalid duration")
		// // ErrNoAllowance error if there is no allowance for that pair
		// ErrNoAllowance = sdkerrors.Register(DefaultCodespace, 5, "no allowance")
		// // ErrNoMessages error if there is no message
		// ErrNoMessages = sdkerrors.Register(DefaultCodespace, 6, "allowed messages are empty")
		// // ErrMessageNotAllowed error if message is not allowed
		// ErrMessageNotAllowed = sdkerrors.Register(DefaultCodespace, 7, "message not allowed")
	},
};

/**
 * Update parts of the context when underlying store changes
 */
function register_context_updates(g_context: LocalAppContext): typeof g_context {
	const h_updaters: Partial<Record<StoreKey, () => Promise<void>>> = {
		async accounts() {
			g_context.g_account = (await Accounts.at(g_context.p_account))!;
		},
		async chains() {
			g_context.g_chain = (await Chains.at(g_context.p_chain))!;
		},
		async apps() {
			g_context.g_app = (await Apps.at(g_context.p_app))!;
		},
	};

	// register for general store updates
	global_receive({
		updateStore({key:si_store}) {
			void h_updaters[si_store]?.();
		},
	});

	return g_context;
}

export function tx_abcis(g_chain: ChainStruct, h_abcis: Dict<TxAbciConfig>): Dict<AbciConfig> {
	return fodemtv(h_abcis, gc_event => ({
		type: gc_event.type,

		filter: [
			// `tm.event='Tx'`,  // this event seems to be excluded from grpc-web TxServiceClient responses
			...Array.isArray(gc_event.filter)? gc_event.filter: [gc_event.filter],
		],

		hooks: {
			async data(g_value, g_extras) {
				const {
					height: s_height,
					tx: sxb64_raw,
					result: g_result,
				} = g_value['TxResult'] as unknown as WsTxResponse;

				// decode raw txn attempted
				const atu8_raw = base64_to_buffer(sxb64_raw);
				const g_decoded_tx = decodeTxRaw(atu8_raw);

				// produce transaction hash
				const si_txn = buffer_to_hex(sha256_sync_insecure(atu8_raw)).toUpperCase();

				// hashes do not match
				if(g_extras.si_txn?.length && g_extras.si_txn !== si_txn) {
					throw new Error(`Computed transaction hash did not match hash returned by node (${g_extras.si_txn}): ${sxb64_raw}`);
				}

				// access messages as amino
				const s_hrp = g_chain.bech32s.acc;
				const a_msgs_amino = g_decoded_tx.body.messages.map(g_msg => proto_to_amino(g_msg, s_hrp));

				// tx error
				if(g_result.code) {
					console.warn(`Tx error: %o`, g_result);

					await gc_event.error?.(a_msgs_amino, g_result, si_txn);
				}
				// tx success
				else if(g_result.gas_used) {
					const {
						gas_used: s_gas_used,
						gas_wanted: s_gas_wanted,
						events: a_events,
						log: s_log,
					} = g_result;

					// data callback with msgs as amino and extras
					await gc_event.data?.(a_msgs_amino, {
						...g_extras,
						si_txn,
						s_gas_wanted,
						s_gas_used,
						s_height,
						a_events: a_events || [],
						s_log,
					});
				}
			},
		},
	}));
}

function merge_notifies(a_notifies: NotifyItemConfig[], g_chain: ChainStruct, s_title_multiple: string) {
	// distill into single notify item
	let g_notify_merged = a_notifies[0];

	const f_other_group = nl => `other event${1 === nl? '': 's'}`;

	// multiple notifies; merge
	if(a_notifies.length > 1) {
		// prep groups dict
		const h_groups: Dict<{group: typeof f_other_group; count: number}> = {};

		// each notify item
		for(const g_notify of a_notifies) {
			const f_group = g_notify.group || f_other_group;

			// produce grouping as if only 1
			const s_grouped = f_other_group(1);

			const g_group = h_groups[s_grouped] = h_groups[s_grouped] || {
				group: f_group,
				count: 0,
			};

			g_group.count += 1;
		}

		// transform groups
		const a_groups = oderac(h_groups, (si, {group:f_group, count:nl_items}) => nl_items+' '+f_group(nl_items));

		// final notify item
		g_notify_merged = {
			title: s_title_multiple,
			message: (1 === a_groups.length
				? a_groups[0]
				: a_groups.slice(0, -1).join(', ')+' and '+a_groups.at(-1))
				+` on ${g_chain.name}`,
		};
	}

	return g_notify_merged;
}

export function account_abcis(
	k_network: CosmosNetwork,
	g_context_vague: LocalAppContext,
	fk_notify: (gc_notify: NotificationConfig) => void
): Dict<AbciConfig> {
	const {
		p_app: _p_app,
		p_chain: _p_chain,
		p_account: _p_account,
		sa_owner: sa_agent,
	} = g_context_vague;

	// update parts of the context when underlying store changes
	register_context_updates(g_context_vague);

	async function sent_error(a_msgs: AminoMsg[], g_result: WsTxResultError, si_txn: string) {
		// notify tx failure
		global_broadcast({
			type: 'txError',
			value: {
				hash: si_txn,
			},
		});

		// copy context from outer scope
		const g_context = register_context_updates({...g_context_vague});

		// fetch pending tx from history
		const p_incident = Incidents.pathFor('tx_out', si_txn);
		const g_pending = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;

		// prep error incident data
		const g_incident_data: TxError = {
			stage: 'synced',
			account: _p_account,
			app: _p_app,
			chain: _p_chain,
			gas_limit: g_result.gas_wanted as Cw.Uint128,
			gas_used: g_result.gas_used as Cw.Uint128,
			gas_wanted: g_result.gas_wanted as Cw.Uint128,
			code: g_result.code,
			codespace: g_result.codespace,
			timestamp: g_result.timestamp,
			raw_log: g_result['rawLog'] as string,
			events: {},
			hash: g_result['txhash'],
			msgs: [],
			log: g_result.log,
		};

		// pending tx exists
		if(g_pending) {
			// set app context from pending tx record
			const p_app = g_pending.data.app!;
			if(p_app) {
				// load app
				const g_app = await Apps.at(p_app);
				if(g_app) {
					Object.assign(g_context, {
						p_app,
						g_app,
					});
				}
			}

			// update incident
			await Incidents.mutateData(p_incident, {
				...g_pending.data,
				...g_incident_data,
				app: p_app || _p_app,
			});
		}
		// insert incident
		else {
			await Incidents.record({
				type: 'tx_out',
				id: si_txn,
				data: g_incident_data,
			});
		}

		// attempt tx error handling
		const g_notify_tx = await H_TX_ERROR_HANDLERS[g_result.codespace]?.[g_result?.code]?.(g_result);
		if(g_notify_tx) {
			fk_notify({
				id: `@incident:${p_incident}`,
				incident: p_incident,
				item: g_notify_tx,
			});
		}
		// not handled, forward to message handlers
		else {
			// notify configs
			const a_notifies: NotifyItemConfig[] = [];

			// route messages
			for(const g_msg of a_msgs) {
				const si_type = g_msg.type;

				let g_notify: NotifyItemConfig | undefined;

				// interpret message
				const f_interpretter = H_INTERPRETTERS[si_type];
				if(f_interpretter) {
					const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context);

					// apply message
					g_notify = await g_interpretted.fail?.(a_msgs.length, g_result);
				}

				// not interpretted
				if(!g_notify) {
					let s_reason = g_result.log;

					// generic errors
					if(R_TX_ERR_ACC_SEQUENCE.test(g_result.log)) {
						s_reason = `Previous transaction stuck in mempool on provider.\n${g_result.log}`;
					}

					// 
					g_notify = {
						title: '❌ Transaction Failed',
						message: s_reason,
					};
				}

				if(g_notify) {
					a_notifies.push(g_notify);
				}
			}

			// merge notify items
			const g_notify_merged = merge_notifies(a_notifies, g_context_vague.g_chain, '❌ Transaction Failed');

			// notifcation
			if(g_notify_merged) {
				fk_notify({
					id: `@incident:${p_incident}`,
					incident: p_incident,
					item: g_notify_merged,
				});
			}
		}

		// TODO: finish notification impl
	}

	async function sent_data(a_msgs: AminoMsg[], g_extra: TxDataExtra) {
		// transaction hash
		const {si_txn} = g_extra;

		// notify tx success
		global_broadcast({
			type: 'txSuccess',
			value: {
				hash: si_txn,
			},
		});

		// copy context from outer scope
		const g_context = register_context_updates({...g_context_vague});

		// fetch pending tx from history
		const p_incident = Incidents.pathFor('tx_out', si_txn);
		const g_pending = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;

		// pending tx exists
		if(g_pending) {
			// set app context from pending tx record
			const p_app = g_pending.data.app!;
			if(p_app) {
				// load app
				const g_app = await Apps.at(p_app);
				if(g_app) {
					Object.assign(g_context, {
						p_app,
						g_app,
					});
				}
			}
		}

		// download all transaction data from chain
		let g_synced = g_extra.g_synced;
		if(!g_synced) {
			try {
				g_synced = await k_network.downloadTxn(si_txn, g_context.p_account, g_context.p_app, g_pending?.data.events);
			}
			catch(e_download) {
				if(e_download instanceof TransactionNotFoundError) {
					await Incidents.mutateData(p_incident, {
						stage: 'absent',
					});
				}
				else {
					console.error(e_download);
				}

				return;
			}
		}

		// TODO: move to function
		// merge all events
		const h_events: Dict<Dict<Set<null|JsonPrimitive>>> = {};
		{
			// start with rawlog
			{
				try {
					for(const g_log of JSON.parse(g_synced.raw_log)) {
						const a_events = g_log?.['events'];

						// skip non-array elements
						if(!Array.isArray(a_events)) continue;

						for(const g_event of a_events) {
							const si_type = g_event?.type;

							if('string' !== typeof si_type) continue;

							const h_attrs = h_events[si_type] = h_events[si_type] || {};

							// each attribute in rawlog
							for(const g_attr of g_event.attributes || []) {
								const si_key = g_attr?.key;

								if('string' !== typeof si_key) continue;

								const as_values = h_attrs[si_key] = h_attrs[si_key] || new Set<null|JsonPrimitive>();

								as_values.add((g_attr as {value: JsonPrimitive}).value || null);
							}
						}
					}
				}
				catch(e_rawlog) {}
			}

			// merge with extras
			{
				try {
					for(const g_event of g_extra.a_events) {
						const si_type = g_event.type;

						const h_attrs = h_events[si_type] = h_events[si_type] || {};

						for(const g_attr of g_event.attributes || []) {
							const si_key = base64_to_text(g_attr.key);

							const as_values = h_attrs[si_key] = h_attrs[si_key] || new Set<null|JsonPrimitive>();

							as_values.add(base64_to_text(g_attr.value) || null);
						}
					}
				}
				catch(e_extras) {}
			}
		}

		g_synced.event_sets = fodemtv(h_events, h_attrs => fodemtv(h_attrs, as => [...as]));

		// create/overwrite incident
		await Incidents.record({
			type: 'tx_out',
			id: si_txn,
			time: parse_date(g_synced.timestamp as string),
			data: g_synced,
		});


		// notify configs
		const a_notifies: NotifyItemConfig[] = [];

		// route messages
		for(const g_msg of a_msgs) {
			const si_type = g_msg.type;

			let g_notify: NotifyItemConfig | undefined;

			// interpret message
			const f_interpretter = H_INTERPRETTERS[si_type];
			if(f_interpretter) {
				const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context);

				// apply message
				g_notify = await g_interpretted.apply?.(a_msgs.length, si_txn, h_events);
			}
			// no interpretter
			else {
				// 
				g_notify = {
					title: '✅ Transaction Complete',
					message: '',
				};
			}

			if(g_notify) {
				a_notifies.push(g_notify);
			}
		}

		// merge notify items
		const g_notify_merged = merge_notifies(a_notifies, g_context_vague.g_chain, '🎳 Multi-Message Transaction Success');

		// notifcation
		if(g_notify_merged) {
			fk_notify({
				id: `@incident:${p_incident}`,
				incident: p_incident,
				item: g_notify_merged,
				timeout: 0,  // automatically clear notification after default timeout
			});
		}

		// broadcast reload
		global_broadcast({
			type: 'reload',
		});
	}

	return tx_abcis(g_context_vague.g_chain, {
		sent: {
			type: 'tx_out',

			filter: `message.sender='${sa_agent}'`,

			error: sent_error,
			data: sent_data,
		},

		sent_with_grant: {
			type: 'tx_out',

			filter: `use_feegrant.grantee='${sa_agent}'`,

			error: sent_error,
			async data(a_msgs: AminoMsg[], g_extra: TxDataExtra) {
				// cancel if message.sender is present in events
				for(const g_event of g_extra.a_events) {
					if('message' === g_event.type) {
						for(const g_attr of g_event.attributes) {
							if('sender' === base64_to_text(g_attr.key)) return;
						}
					}
				}

				const a_log = JSON.parse(g_extra.s_log);
				for(const g_event of a_log[0].events) {
					if('message' === g_event.type) {
						for(const g_attr of g_event.attributes) {
							if('sender' === g_attr.key) return;
						}
					}
				}

				return await sent_data(a_msgs, g_extra);
			},
		},

		receive: {
			type: 'tx_in',

			filter: `transfer.recipient='${sa_agent}'`,

			async data(a_msgs, g_extra) {
				// transaction hash
				const {si_txn} = g_extra;

				// ref or download tx
				let g_synced = g_extra.g_synced as TxSynced;
				if(!g_synced) {
					try {
						g_synced = await k_network.downloadTxn(si_txn, g_context_vague.p_account);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							try {
								await Incidents.mutateData(Incidents.pathFor('tx_in', si_txn), {
									stage: 'absent',
								});
							}
							catch(e_mutate) {}
						}

						return;
					}
				}

				// save incident
				const p_incident = await Incidents.record({
					type: 'tx_in',
					id: si_txn,
					time: parse_date(g_extra.g_synced?.timestamp as string),
					data: g_synced,
				});

				// notify configs
				const a_notifies: NotifyItemConfig[] = [];

				// scan messages for those that pertains to this account
				for(const g_msg of a_msgs) {
					const si_type = g_msg.type;

					// prep notify item
					let g_notify: NotifyItemConfig | undefined;

					// interpret message
					const f_interpretter = H_INTERPRETTERS[si_type];
					if(f_interpretter) {
						const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context_vague);

						// receive message
						g_notify = await g_interpretted.receive?.(a_msgs.length);
					}
					// no interpretter; use fallback notifiy item
					else {
						g_notify = {
							title: '💵 Received Transfer',
							message: '',
						};
					}

					// push notify item to list
					if(g_notify) a_notifies.push(g_notify);
				}

				// merge notify items
				const g_notify_merged = merge_notifies(a_notifies, g_context_vague.g_chain, '💰 Multiple Transfers Received');

				// notifcation
				if(g_notify_merged) {
					fk_notify({
						id: `@incident:${p_incident}`,
						incident: p_incident,
						item: g_notify_merged,
					});
				}
			},
		},

		granted: {
			type: 'tx_in',

			filter: `set_feegrant.grantee='${sa_agent}'`,

			async data(a_msgs, g_extra) {
				// transaction hash
				const {si_txn, a_events} = g_extra;

				// cosmos-sdk bug sometimes emits `set_feegrant` when it shouldn't
				{
					let sx_use_feegrant_attrs = '';
					let sx_set_feegrant_attrs = '';

					for(const g_event of a_events) {
						if('use_feegrant' === g_event.type) {
							sx_use_feegrant_attrs = JSON.stringify(g_event.attributes);
						}
						else if('set_feegrant' === g_event.type) {
							sx_set_feegrant_attrs = JSON.stringify(g_event.attributes);
						}
					}

					// identical events means one is false
					if(sx_use_feegrant_attrs === sx_set_feegrant_attrs) return;
				}

				// ref or download tx
				let g_synced = g_extra.g_synced as TxSynced;
				if(!g_synced) {
					try {
						g_synced = await k_network.downloadTxn(si_txn, g_context_vague.p_account);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							try {
								await Incidents.mutateData(Incidents.pathFor('tx_in', si_txn), {
									stage: 'absent',
								});
							}
							catch(e_mutate) {}
						}

						return;
					}
				}

				// save incident
				const p_incident = await Incidents.record({
					type: 'tx_in',
					id: si_txn,
					time: parse_date(g_extra.g_synced?.timestamp as string),
					data: g_synced,
				});

				// notify configs
				const a_notifies: NotifyItemConfig[] = [];

				// scan messages for those that pertains to this account
				for(const g_msg of a_msgs) {
					const si_type = g_msg.type;

					// prep notify item
					let g_notify: NotifyItemConfig | undefined;

					// interpret message
					const f_interpretter = H_INTERPRETTERS[si_type];
					if(f_interpretter) {
						const g_interpretted = await f_interpretter(g_msg.value as JsonObject, g_context_vague);

						// receive message
						g_notify = await g_interpretted.receive?.(a_msgs.length);
					}
					// no interpretter; use fallback notifiy item
					else {
						g_notify = {
							title: '💳 Received Fee Grant Allowance',
							message: '',
						};
					}

					// push notify item to list
					if(g_notify) a_notifies.push(g_notify);
				}

				// merge notify items
				const g_notify_merged = merge_notifies(a_notifies, g_context_vague.g_chain, '💳 Multiple Fee Grants Received');

				// notifcation
				if(g_notify_merged) {
					fk_notify({
						id: `@incident:${p_incident}`,
						incident: p_incident,
						item: g_notify_merged,
					});
				}

				// const g_notify = {
					// title: `🤝 Received Authorization`,
					// text: `${s_contact} granted ${s_account} the ability to ${s_action}`,
				// };
			},
		},
	});
}
