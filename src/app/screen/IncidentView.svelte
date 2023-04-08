<script lang="ts">
	import type {LocalAppContext} from '../svelte';

	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {AppPath, AppStruct} from '#/meta/app';
	import type {Dict, JsonObject, JsonValue, Promisable} from '#/meta/belt';
	import type {ChainStruct, ChainPath} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {FieldConfig} from '#/meta/field';
	import type {Incident, IncidentStruct, IncidentPath, IncidentType} from '#/meta/incident';
	
	import type {TransferHistoryCache} from '#/schema/snip-2x-const';
	import type {TransactionHistoryItem} from '#/schema/snip-2x-def';
	
	import {MsgSend} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
	import {PubKey} from '@solar-republic/cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';
	import {Tx} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
	
	import {Header, Screen} from './_screens';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {load_flow_context, load_page_context} from '../svelte';
	
	import {produce_contract} from '#/chain/contract';
	import {proto_to_amino} from '#/chain/cosmos-msgs';
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import type {ReviewedMessage} from '#/chain/messages/_types';
	import {_FAILED_MESSAGE_OVERRIDE} from '#/chain/messages/compute';
	import type {SelectTransactionHistoryItem} from '#/chain/messages/snip-history';
	import {H_SNIP_TRANSACTION_HISTORY_HANDLER} from '#/chain/messages/snip-history';
	import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_EXTERNAL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {Providers} from '#/store/providers';
	import {QueryCache} from '#/store/query-cache';
	import {ode, oderac} from '#/util/belt';
	import {base64_to_buffer, base93_to_buffer, buffer_to_base64, buffer_to_hex} from '#/util/data';
	import {dd} from '#/util/dom';
	import {format_date_long, format_time} from '#/util/format';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Fields from '../ui/Fields.svelte';
	import Spacer from '../ui/Spacer.svelte';
	
	import SX_ICON_LAUNCH from '#/icon/launch.svg?raw';
	import { yw_account } from '../mem';


	const {
		completed,
	} = load_flow_context();

	function complete() {
		completed!(true);
	}

	const g_context_page = load_page_context();

	export let incident: IncidentPath;
	const p_incident = incident;

	interface EventViewConfig {
		s_title: string;
		a_fields: FieldConfig[];
	}

	// setting this value causes an app banner to be displayed
	let gc_banner: {
		app: AppStruct;
		chain: ChainStruct;
		account: AccountStruct;
	};

	let g_error: FieldConfig | undefined;

	// determines view mode for app banner
	const b_banner = true;

	let b_inbound = false;

	const H_RELABELS = {
		'extra.pfpg.offset': 'pfp offset',
	};

	const relabel = s => H_RELABELS[s] ?? s;

	const H_EVENTS: {
		[si_type in IncidentType]: (g_data: Incident.Struct<si_type>['data'], g_context: LocalAppContext) => Promisable<EventViewConfig>;
	} = {
		async tx_out(g_data, g_context) {
			// error code
			if(g_data.code) {
				g_error = {
					type: 'key_value',
					key: 'Error',
					value: g_data.raw_log || JSON.stringify(g_data.log).replace(/^"|"$/g, ''),
					render: 'error',
				};
			}

			// absent
			if('absent' === g_data.stage) {
				g_error = {
					type: 'key_value',
					key: 'Error',
					value: `Transaction has not yet been confirmed. Either the provider node failed to broadcast it, or it was never witnessed in the event stream. You can continue to wait or manually force a resync.`,
					render: 'error',
				};
			}

			// interpret raw messages
			let a_reviewed = await Promise.all(g_data.msgs.map(async(g_msg_proto) => {
				const g_msg_amino = proto_to_amino({
					typeUrl: g_msg_proto.typeUrl,
					value: base93_to_buffer(g_msg_proto.value),
				}, g_context.g_chain.bech32s.acc);

				const g_interpretted = await H_INTERPRETTERS[g_msg_amino.type]?.(g_msg_amino.value, g_context);
				return await g_interpretted?.review?.('pending' === g_data.stage || !!g_error);
			}));

			// no messages, try to use starshell-generated events to describe instead
			if(!a_reviewed.length) {
				const h_events = g_data.events;

				// contract execution
				const a_executions = h_events.executions;
				if(a_executions?.length) {
					a_reviewed = a_reviewed.concat(await Promise.all(a_executions.map(async(g_exec) => {
						const g_interpretted = await H_INTERPRETTERS['wasm/MsgExecuteContract']({
							[_FAILED_MESSAGE_OVERRIDE]: g_exec,
						}, g_context);
						return await g_interpretted?.review?.('pending' === g_data.stage || !!g_error);
					})));
				}

				// bank transfer
				const a_transfers = h_events.transfer;
				if(a_transfers?.length) {
					a_reviewed = a_reviewed.concat(await Promise.all(a_transfers.map(async(g_transfer) => {
						const g_interpretted = await H_INTERPRETTERS['cosmos-sdk/MsgSend']({
							[_FAILED_MESSAGE_OVERRIDE]: g_transfer,
						}, g_context);
						return await g_interpretted?.review?.('pending' === g_data.stage || !!g_error);
					})));
				}

				// TODO: implement other outgoing tx types
			}


			// common outbound fields to place above
			const a_fields_outbound_above: FieldConfig[] = [
				{
					type: 'transaction',
					hash: g_data.hash,
					chain: g_context.g_chain,
				},
			];

			// common outbound fields to place below
			const a_fields_outbound_below: FieldConfig[] = [
				{
					type: 'memo',
					text: g_data.memo,
				},
				{
					type: 'group',
					flex: true,
					vertical: true,
					fields: [
						{
							type: 'key_value',
							key: 'Gas Payed',
							value: g_data.gas_wanted,
						},
						{
							type: 'key_value',
							key: 'Gas Used',
							value: g_data.gas_used,
						},
					],
				},
			];

			// single message
			if(1 === a_reviewed.length) {
				const g_reviewed = a_reviewed[0];

				return {
					s_title: g_reviewed?.title || 'Outbound Transaction',
					a_fields: [
						...a_fields_outbound_above,
						...g_reviewed?.fields || [],
						...a_fields_outbound_below,
					],
				};
			}

			// multiple messages
			return {
				s_title: `Sent Multi-Message Transaction`,
				a_fields: [
					...a_fields_outbound_above,
					...a_reviewed.flatMap((g, i) => [
						{
							type: 'gap',
							brutal: true,
						},
						{
							type: 'dom',
							title: `Message #${i+1}`,
							dom: dd('span'),
						},
						{
							type: 'group',
							fields: g?.fields || [],
						},
					]),
					...a_fields_outbound_below,
				],
			};
		},

		tx_in: async(g_data, g_context) => {
			b_inbound = true;

			// interpret raw messages
			const a_reviewed: ReviewedMessage[] = [];
			for(const g_msg_proto of g_data.msgs) {
				const g_msg_amino = proto_to_amino({
					typeUrl: g_msg_proto.typeUrl,
					value: base93_to_buffer(g_msg_proto.value),
				}, g_context.g_chain.bech32s.acc);

				const g_interpretted = await H_INTERPRETTERS[g_msg_amino.type]?.(g_msg_amino.value, g_context);
				const g_reviewed = await g_interpretted?.review?.(false, true);
				if(g_reviewed) {
					a_reviewed.push(g_reviewed);
				}
			}

			const a_fields_inbound_above: FieldConfig[] = [
				{
					type: 'transaction',
					hash: g_data.hash,
					chain: g_context.g_chain,
				},
			];

			const a_fields_inbound_below: FieldConfig[] = [
				{
					type: 'memo',
					text: g_data.memo,
				},
			];

			// single message
			if(1 === a_reviewed.length) {
				const g_reviewed = a_reviewed[0];

				return {
					s_title: g_reviewed?.title || 'Inbound Transaction',
					a_fields: [
						...a_fields_inbound_above,
						...g_reviewed?.fields || [],
						...a_fields_inbound_below,
					],
				};
			}

			// const h_events = g_data.events;

			// for(const g_transfer of h_events.transfer || []) {
			// 	const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

			// 	return {
			// 		s_title: `Received ${si_coin}`,
			// 		a_fields: [
			// 			{
			// 				type: 'key_value',
			// 				key: 'Status',
			// 				value: 'Confirmed',
			// 			},
			// 			{
			// 				type: 'key_value',
			// 				key: 'Sender',
			// 				value: g_transfer.sender,
			// 				render: 'address',
			// 			},
			// 			{
			// 				type: 'key_value',
			// 				key: 'Recipient',
			// 				value: g_transfer.recipient,
			// 				render: 'address',
			// 			},
			// 			{
			// 				type: 'key_value',
			// 				key: 'Amount',
			// 				value: pretty_amount(g_transfer.amount, g_data.chain),
			// 				subvalue: `${new BigNumber(''+xg_amount).shiftedBy(-g_coin.decimals).toString()} ${si_coin}`,
			// 			},
			// 			...f_send_recv(g_data),
			// 		],
			// 	};
			// }

			return {
				s_title: 'Inbound Transaction',
				a_fields: [],
			};
		},

		token_in: async(g_data, g_context) => {
			const {
				account: p_account,
				chain: p_chain,
				bech32: sa_contract,
				hash: si_tx,
			} = g_data;

			const {
				g_account,
				g_chain,
			} = g_context;

			b_inbound = true;

			const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

			const g_contract = await produce_contract(sa_contract, g_chain, null, g_account);

			const a_fields_inbound_above: FieldConfig[] = [
				{
					type: 'transaction',
					hash: buffer_to_hex(base64_to_buffer(si_tx)).toUpperCase(),
					chain: g_context.g_chain,
				},
				{
					type: 'contracts',
					bech32s: [sa_contract],
					g_chain,
					g_account,
					label: 'Token',
				},
			];

			const ks_cache = await QueryCache.read();

			const a_fields_inbound_below: FieldConfig[] = [];

			let g_transfer: SelectTransactionHistoryItem | null = null;

			// load from query cache
			const g_cache_txn = ks_cache.get<Dict<TransactionHistoryItem>>(p_chain, sa_owner, `${sa_contract}:transaction_history`);
			if(g_cache_txn) {
				const h_data = g_cache_txn.data;
				const g_tx = h_data[si_tx];
				const h_action = g_tx.action;
				if(h_action.transfer) {
					g_transfer = {
						coins: g_tx.coins,
						from: h_action.transfer.from,
						receiver: h_action.transfer.recipient,
						memo: g_tx.memo,
					};
				}
			}
			else {
				const g_cache_xfr = ks_cache.get<TransferHistoryCache>(p_chain, sa_owner, `${sa_contract}:transfer_history`);
				if(g_cache_xfr) {
					const g_xfer = g_cache_xfr.data?.transfers?.[si_tx];
					g_transfer = {
						coins: g_xfer.coins,
						from: g_xfer.from!,
						receiver: g_xfer.receiver,
						memo: '' as Cw.String,
					};
				}
				else {
					return;
				}
			}

			if(g_transfer) {
				const g_handled = await H_SNIP_TRANSACTION_HISTORY_HANDLER.transfer(g_transfer, {
					g_snip20: g_contract.interfaces.snip20!,
					g_contract,
					g_chain,
					g_account,
				});

				const g_reviewed = await g_handled?.review?.();

				if(g_reviewed) {
					return {
						s_title: g_reviewed.title,
						a_fields: [
							...a_fields_inbound_above,
							...g_reviewed?.fields || [],
							...a_fields_inbound_below,
						],
					};
				}
			}

			return {
				s_title: 'Received Transfer',
				a_fields: [
					...a_fields_inbound_above,
					...[],
					...a_fields_inbound_below,
				],
			};
		},

		account_created: g_data => ({
			s_title: `Created Account`,
			a_fields: [
				{
					type: 'key_value',
					key: 'Account',
					value: Accounts.at(g_data.account).then(g => g!.name),
				},
			],
		}),

		account_edited: g_data => ({
			s_title: `Edited Account`,
			a_fields: [
				{
					type: 'key_value',
					key: 'Account',
					value: Accounts.at(g_data.account).then(g => g!.name),
				},
				...g_data.deltas.map(a => ({
					type: 'key_value' as const,
					key: `Changed ${relabel(a[0])}`,
					value: `${a[1]} → ${a[2]}`,
					long: true,
				})),
			],
		}),

		app_connected: g_data => ({
			s_title: 'App Connected',
			a_fields: [
				{
					type: 'resource',
					resourceType: 'app',
					path: g_data.app,
					short: true,
				},
				// @ts-expect-error idk
				...oderac(g_data.connections, (p_chain: ChainPath, g_connection, i_connection) => ({
					type: 'group',
					fields: [
						...i_connection? [{
							type: 'gap',
						}]: [],
						{
							type: 'resource',
							resourceType: 'chain',
							label: 'On Chain',
							path: p_chain,
							short: true,
						},
						{
							type: 'key_value',
							key: 'Permissions',
							value: (() => {
								const a_permissions = oderac(g_connection.permissions, (si, g) => `${si}:${JSON.stringify(g)}`);
								return a_permissions.length? a_permissions.join(', '): dd('i', {}, [
									'(none)',
								]);
							})(),
						},
						{
							type: 'accounts',
							paths: g_connection.accounts,
							short: true,
						},
					],
				})),
			],
		}),

		signed_json: ({json:w_json}) => ({
			s_title: 'Signed Document',
			a_fields: [
				JsonPreviewer.render(w_json),
			],
		}),

		signed_query_permit: g_data => ({
			s_title: 'Signed Query Permit',
			a_fields: [
				{
					type: 'query_permit',
					secret: g_data.secret,
				},
			],
		}),
	};

	let g_incident!: IncidentStruct;
	let g_chain: ChainStruct | null;
	let k_network: CosmosNetwork;

	let s_time = '';
	let s_title = '';
	let a_fields: FieldConfig[] = [];

	async function reload() {
		g_incident = (await Incidents.at(p_incident))!;

		const g_data = g_incident.data;

		const p_app = g_data['app'] as AppPath;
		const p_chain = g_data['chain'] as ChainPath;
		const p_account = g_data['account'] as AccountPath;

		const [g_app, g_chain_local, g_account] = await Promise.all([
			(async() => p_app? await Apps.at(p_app): G_APP_EXTERNAL)(),
			(async() => p_chain? await Chains.at(p_chain): null)(),
			(async() => p_account? await Accounts.at(p_account): null)(),
		]);

		g_chain = g_chain_local;

		if(g_app && g_chain && g_account) {
			gc_banner = {
				app: g_app,
				chain: g_chain,
				account: g_account,
			};
		}

			// prep local app context
		const g_context = {
			p_app: p_app || '',
			g_app: g_app,
			p_chain: p_chain || '',
			g_chain,
			p_account: p_account || '',
			g_account: g_account,
		};

		if(g_chain) {
			k_network = await Providers.activateDefaultFor(g_chain);
		}

		s_time = format_time(g_incident.time);

		({
			s_title,
			a_fields,
		} = await H_EVENTS[g_incident.type](g_data, g_context));
	}

	let dp_loaded = reload();

		// const {
		// 	s_title,
		// 	a_fields,
		// } = H_EVENTS[event.type](event.data);


	const H_GRPC_MAP = {
		'/cosmos.bank.v1beta1.MsgSend': MsgSend,
		'/cosmos.crypto.secp256k1.PubKey': PubKey,
		'/cosmos.tx.v1beta1.Tx': Tx,
	};

	function recode(w_value: JsonValue) {
		if(w_value && 'object' === typeof w_value) {
				// array of values
			if(Array.isArray(w_value)) {
				return w_value.map(recode);
			}
				// raw data; replace with base64 encoding
			else if(ArrayBuffer.isView(w_value)) {
				return buffer_to_base64(w_value as unknown as Uint8Array);
			}
				// nested object
			else {
				return decode_proto(w_value);
			}
		}

		return w_value;
	}

	function decode_proto(g_top: JsonObject): JsonObject {
			// proto thing
		const si_proto = g_top.typeUrl;
		if('string' === typeof si_proto) {
				// has value
			if(ArrayBuffer.isView(g_top.value)) {
				if(si_proto in H_GRPC_MAP) {
					return {
						'@type': si_proto,
						...decode_proto(H_GRPC_MAP[si_proto].decode(g_top.value) as unknown as JsonObject),
					};
				}
			}
		}

		for(const [si_key, w_value] of ode(g_top)) {
			const si_type = typeof w_value;

				// ignore functions and undefined
			if('function' === si_type || 'undefined' === si_type) {
				delete g_top[si_key];
				continue;
			}

				// recode everything else
			g_top[si_key] = recode(w_value);
		}

		return g_top;
	}

	async function load_raw_json() {
		await dp_loaded;

		const g_response = await k_network.fetchTx(g_incident.data.hash);

		const g_formatted = decode_proto(g_response);

		return g_formatted;
	}

	let c_updates = 0;

	$: if(c_updates) {
		dp_loaded = reload();
	}
</script>

<style lang="less">
	@import '../_base.less';

	.subvalue {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	.raw-json {
		background-color: fade(@theme-color-graydark, 50%);
		color: var(--theme-color-text-light);
		overflow: scroll;
		padding: 1em;
		border-radius: 4px;
		.font(mono-tiny);
		margin-bottom: var(--ui-padding);
	}
</style>

<Screen nav={!completed}>
	<Header plain
		search={!completed}
		pops={!completed}
		title={s_title}
		subtitle={s_time}
		on:update={() => c_updates++}
	/>

	{#await dp_loaded}
		<h3 style='text-align: center;'>Loading</h3>
	{:then}
		{#key c_updates}
			{#if s_title}
				{#if b_banner && gc_banner}
					<AppBanner embedded
						app={b_inbound? null: gc_banner.app}
						chains={[gc_banner.chain]}
						account={gc_banner.account}
						rootStyle='margin-bottom: 8px;'
					/>

					<hr class="no-margin">
				{/if}

				{#if 'tx_in' === g_incident.type || 'tx_out' === g_incident.type}
					<Fields
						incident={g_incident}
						configs={[
							...g_error? [g_error]: [],
							{
								type: 'key_value',
								key: 'Date',
								value: format_date_long(g_incident.time),
							},
							...a_fields,
						]}
						chain={g_chain}
						network={k_network}
						loaded={dp_loaded}
					/>
				{:else}
					<Fields
						incident={g_incident}
						configs={[
							{
								type: 'key_value',
								key: 'Date',
								value: format_date_long(g_incident.time),
							},
							...a_fields,
						]}
						chain={g_chain}
						network={k_network}
						loaded={dp_loaded}
					/>
				{/if}
			{/if}
		{/key}
	{/await}

	<Spacer height="0px" />

	{#if completed}
		<ActionsLine confirm={['Done', complete]} />
	{/if}
</Screen>
