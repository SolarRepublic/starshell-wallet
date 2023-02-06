<script context="module" lang="ts">
	/* eslint-disable i/order */
	import type {PfpTarget} from '#/meta/pfp';
	/* eslint-enable */

	export enum TxnContext {
		NONE='none',
		TOKEN='token',
		CONTACT='contact',
	}

	interface Detail {
		icon: HTMLElement;
		name: string;
		title: string;
		subtitle: string;
		amount?: string;
		fiat?: string;
		pfp?: PfpTarget;
		filter?: ''|'testnet';
		pending?: boolean;
		rootClasses?: string;
		childClasses?: string;
		link?: null | {
			href: string;
			text: string;
		};
	}
</script>

<script lang="ts">
	import type {LocalAppContext, PartialLocalAppContext} from '../svelte';
	import type {AminoMsg} from '@cosmjs/amino';

	import type {AccountPath} from '#/meta/account';
	import type {AppPath} from '#/meta/app';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {ChainPath} from '#/meta/chain';
	import type {Incident, IncidentType} from '#/meta/incident';
	
	import type {TransactionHistoryItem} from '#/schema/snip-2x-def';
	
	import BigNumber from 'bignumber.js';
	import {getContext} from 'svelte';
	
	import {yw_account, yw_account_ref} from '../mem';
	
	import {parse_coin_amount} from '#/chain/coin';
	import {produce_contract} from '#/chain/contract';
	import {proto_to_amino} from '#/chain/cosmos-msgs';
	import type {ReviewedMessage} from '#/chain/messages/_types';
	import type {SelectTransactionHistoryItem} from '#/chain/messages/snip-history';
	import {H_SNIP_TRANSACTION_HISTORY_HANDLER} from '#/chain/messages/snip-history';
	import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_EXTERNAL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import type {IncidentFilterConfig} from '#/store/incidents';
	import {Histories, Incidents} from '#/store/incidents';
	import {QueryCache} from '#/store/query-cache';
	import {oderac} from '#/util/belt';
	import {base93_to_buffer} from '#/util/data';
	import {dd, open_external_link} from '#/util/dom';
	import {format_amount, format_time_ago} from '#/util/format';
	
	import type {Page} from '##/screen/_screens';
	
	import PfpDisplay from './PfpDisplay.svelte';
	import IncidentView from '../screen/IncidentView.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Put from '../ui/Put.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_CONNECT from '#/icon/connect.svg?raw';
	import SX_ICON_ERROR from '#/icon/error.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_SIGNATURE from '#/icon/signature.svg?raw';
	import SX_ICON_ACC_CREATED from '#/icon/user-add.svg?raw';
	import SX_ICON_ACC_EDITED from '#/icon/user-edit.svg?raw';
    import type { Cw } from '#/meta/cosm-wasm';


	type IncidentHandler<si_type extends IncidentType=IncidentType> = (
		g_incident: Incident.Struct<si_type>,
		g_context: PartialLocalAppContext,
	) => Promisable<Detail>;

	

	export let incidents: Promisable<Incident.Struct[]> | null = null;
	export let context: TxnContext = TxnContext.NONE;

	export let filterConfig: IncidentFilterConfig = {};

	const k_page = getContext<Page>('page');

	let xt_last_seen = Infinity;
	void Histories.lastSeen().then((_xt_seen) => {
		xt_last_seen = _xt_seen;

		// mark last seen
		setTimeout(() => {
			void Histories.markAllSeen();
		}, 10e3);
	});
	

	async function load_incidents(): Promise<Incident.Struct[]> {
		if(incidents) return await incidents;

		return incidents = [...await Incidents.filter(filterConfig)].sort((g_a, g_b) => g_b.time - g_a.time);
	}


	const mk_icon = (sx_icon: string, xt_when: number, b_pending=false) => {
		const dm_icon = dd('span', {
			class: 'event-icon global_svg-icon icon-diameter_18px'
				+(b_pending? ' global_pulse': '')
				+(xt_when >= xt_last_seen? ' unseen-incident': ''),
			style: sx_icon === SX_ICON_ERROR
				? `
					color: var(--theme-color-caution);
				`: '',
		});
		dm_icon.innerHTML = sx_icon;
		return dm_icon;
	};


	const H_INCIDENT_MAP: {
		[si_type in IncidentType]: IncidentHandler<si_type>;
	} = {
		async tx_out(g_incident, g_context) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					stage: si_stage,
					hash: si_txn,
					events: h_events,
					code: xc_code,
					msgs: a_msgs,
				},
			} = g_incident;

			const g_account = $yw_account;
			const p_account = $yw_account_ref;

			const g_app = g_context.g_app || G_APP_EXTERNAL;
			const g_chain = g_context.g_chain!;

			// prep context
			const g_context_full: LocalAppContext = {
				p_app: g_context.p_app!,
				g_app,
				p_chain: g_context.p_chain!,
				g_chain,
				p_account,
				g_account,
				sa_owner: Chains.addressFor(g_account.pubkey, g_chain),
			};

			const b_pending = 'pending' === si_stage;
			const b_synced = 'synced' === si_stage;
			const b_absent = 'absent' === si_stage;
			const b_error = xc_code !== 0;

			const g_common = {
				icon: mk_icon(b_absent || b_error? SX_ICON_ERROR: SX_ICON_SEND, xt_when, b_pending),
				childClasses: b_absent? 'filter_desaturate opacity_32%': '',
				pending: b_pending || b_error,
			};

			// decode and convert messages to amino
			const a_msgs_amino: AminoMsg[] = a_msgs.map((g_msg) => {
				// destructure msg
				const {
					typeUrl: si_type,
					value: sxb93_value,
				} = g_msg;
	
				// decode to proto
				const g_proto = {
					typeUrl: si_type,
					value: base93_to_buffer(sxb93_value),
				};
	
				// convert to amino
				return proto_to_amino(g_proto, g_chain.bech32s.acc);
			});

			// multi-message
			if(a_msgs_amino.length > 1) {
				return {
					...g_common,
					title: `Sen${b_pending || b_error? 'ding': 't'} Multi-Message Transaction${b_pending? '...': ''}`,
					subtitle: format_time_ago(xt_when)+` / ${a_msgs_amino.length} Messages`,
					name: g_chain.name,
					pfp: g_chain.pfp,
					filter: g_chain.testnet? 'testnet': '',
					// TODO: merge pfps?
				};
			}
			// single message
			else if(a_msgs_amino.length) {
				// 
				const g_msg_amino = a_msgs_amino[0];

				// interpret message
				const f_interpret = H_INTERPRETTERS[g_msg_amino.type];
				if(f_interpret) {
					const g_interpretted = await f_interpret(g_msg_amino.value as JsonObject, g_context_full);

					// 
					const g_reviewed = await g_interpretted?.review?.(b_pending || b_error);

					if(g_reviewed) {
						const s_infos = (g_reviewed.infos || []).map(s => ` / ${s}`).join('');

						return {
							...g_common,
							title: g_reviewed.title+(b_pending? '...': ''),
							subtitle: format_time_ago(xt_when)+s_infos,
							name: g_reviewed.resource?.name || '?',
							pfp: g_reviewed.resource?.pfp || '',
							filter: g_reviewed.resource?.['testnet']? 'testnet': '',
						};
					}
				}
			}

			return {
				...g_common,
				title: 'Outgoing Transaction',
				name: '',
			};
		},

		async tx_in(g_incident, g_context) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					stage: si_stage,
					hash: si_txn,
				},
			} = g_incident;

			const g_account = g_context.g_account!;
			const sa_owner = g_context.sa_owner!;

			const g_app = g_context.g_app || G_APP_EXTERNAL;
			const g_chain = g_context.g_chain!;

			// prep context
			const g_context_full: LocalAppContext = {
				p_app: g_context.p_app!,
				g_app,
				p_chain: g_context.p_chain!,
				g_chain,
				p_account: g_context.p_account!,
				g_account,
				sa_owner,
			};

			const {
				events: h_events,
				code: xc_code,
				msgs: a_msgs_proto,
			} = g_data;

			const a_reviews: ReviewedMessage[] = [];

			// decode and convert messages to amino
			for(const g_msg_proto of a_msgs_proto) {
				// destructure msg
				const {
					typeUrl: si_type,
					value: sxb93_value,
				} = g_msg_proto;
	
				// decode to proto
				const g_proto = {
					typeUrl: si_type,
					value: base93_to_buffer(sxb93_value),
				};
	
				// convert to amino
				const g_msg_amino = proto_to_amino(g_proto, g_chain.bech32s.acc);

				// interpret message
				const f_interpret = H_INTERPRETTERS[g_msg_amino.type];
				if(f_interpret) {
					const g_interpretted = await f_interpret(g_msg_amino.value, g_context_full);

					// message does not affect account; skip it
					if(!await g_interpretted?.affects?.(h_events)) continue;

					// make review
					const g_reviewed = await g_interpretted?.review?.(false, true);
					if(g_reviewed) a_reviews.push(g_reviewed);
				}
			}

			// prep detail
			const g_detail: Detail = {
				icon: mk_icon(SX_ICON_RECV, xt_when),
				title: `Inbound Transaction`,
				name: '',
				subtitle: '',
			};

			// transfer event
			for(const g_event of h_events.coin_received || []) {
				const h_amounts: Dict<BigNumber> = {};
				if(sa_owner === g_event.receiver) {
					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_event.amount, g_chain);

					h_amounts[si_coin] = (h_amounts[si_coin] || BigNumber(0))
						.plus(BigNumber(xg_amount+'').shiftedBy(-g_coin.decimals));
				}

				const s_coins = oderac(h_amounts, (si_coin, yg_amount) => format_amount(yg_amount.toNumber())+' '+si_coin)
					.join(' + ');

				g_detail.title = `Received ${s_coins}`;
			}

			// only one message affects user
			if(1 === a_reviews.length) {
				const g_reviewed = a_reviews[0];

				const s_infos = (g_reviewed.infos || []).map(s => ` / ${s}`).join('');

				Object.assign(g_detail, {
					title: g_reviewed.title,
					subtitle: s_infos,
					name: g_reviewed.resource.name,
					pfp: g_reviewed.resource.pfp || '',
					filter: g_reviewed.resource['testnet']? 'testnet': '',
				});
			}
			// multiple messages affect user
			else if(a_reviews.length > 1) {
				// const h_amounts: Dict<bigint> = {};

				// // coalesce
				// for(const g_reviewed of a_reviews) {
				// 	const si_resource = g_reviewed.resource.name;
				// 	h_amounts[si_resource]
				// }

				Object.assign(g_detail, {
					title: `${a_reviews.length} Inbound Messages`,
					// subtitle: s_infos,
					// name: g_reviewed.resource.name,
					// pfp: g_reviewed.resource.pfp || '',
				});
			}

			return {
				...g_detail,
				subtitle: format_time_ago(xt_when)+g_detail.subtitle,
			};
		},


		async token_in(g_incident, {g_chain, sa_owner, g_account}) {
			const {
				time: xt_when,
				data: g_data,
				data: {
					chain: p_chain,
					account: p_account,
					bech32: sa_contract,
					hash: si_tx,
				},
			} = g_incident;

			const g_contract = await produce_contract(sa_contract, g_chain!);

			const ks_cache = await QueryCache.read();



			let g_transfer: SelectTransactionHistoryItem | null = null;

			// load from query cache
			let g_cache_txn = ks_cache.get<Dict<TransactionHistoryItem>>(p_chain, sa_owner!, `${sa_contract}:transaction_history`);
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
				let g_cache_xfr = ks_cache.get<TransferHistoryCache>(p_chain, sa_owner!, `${sa_contract}:transfer_history`);
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
					g_chain: g_chain!,
					g_account: g_account!,
				});

				const g_reviewed = await g_handled?.review?.();
				if(g_reviewed) {
					const s_infos = (g_reviewed['infos'] || []).map(s => ` / ${s}`).join('');

					return {
						...g_reviewed,
						subtitle: format_time_ago(xt_when)+s_infos,
						icon: mk_icon(SX_ICON_RECV, xt_when),
						name: g_contract.name,
						pfp: g_contract.pfp || '',
					};
				}
			}

			// return {
			// 	s_title: 'Received Transfer',
			// 	a_fields: [
			// 		...a_fields_inbound_above,
			// 		...[],
			// 		...a_fields_inbound_below,
			// 	],
			// };

			return {
				title: 'Inbound Token Transfer',
				subtitle: format_time_ago(xt_when),
				icon: mk_icon(SX_ICON_RECV, xt_when),
				name: g_contract.name,
				pfp: g_contract.pfp || '',
			};
		},


		async account_created(g_event, {g_account}) {
			const {
				time: xt_when,
				data: {
					account: p_account,
				},
			} = g_event;

			return {
				title: `Account created`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_ACC_CREATED, xt_when),
				pfp: g_account!.pfp || '',
			};
		},

		async account_edited(g_event, {g_account}) {
			const {
				time: xt_when,
				data: {
					deltas: a_deltas,
				},
			} = g_event;

			return {
				title: `Account edited`,
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_ACC_EDITED, xt_when),
				pfp: g_account!.pfp || '',
			};
		},

		async app_connected(g_event, {g_app}) {
			const {
				time: xt_when,
				data: {
					accounts: a_accounts,
					connections: h_connections,
				},
			} = g_event;

			return {
				title: `App connected`,
				subtitle: `${format_time_ago(xt_when)} / ${g_app!.host}`,
				name: g_app!.name,
				icon: mk_icon(SX_ICON_CONNECT, xt_when),
				pfp: g_app!.pfp || '',
			};
		},

		async signed_json(g_event, {g_app, g_account}) {
			const {
				time: xt_when,
				data: g_data,
			} = g_event;

			return {
				title: 'Signed Document',
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_SIGNATURE, xt_when),
				pfp: g_app?.pfp || g_account!.pfp || '',
			};
		},

		async signed_query_permit(g_event, {g_app, g_account}) {
			const {
				time: xt_when,
				data: g_data,
			} = g_event;

			return {
				title: 'Signed Query Permit',
				subtitle: `${format_time_ago(xt_when)} / ${g_account!.name}`,
				name: g_account!.name,
				icon: mk_icon(SX_ICON_SIGNATURE, xt_when),
				pfp: g_app!.pfp || g_account!.pfp || '',
			};
		},
	};


	async function detail_incident(g_incident: Incident.Struct): Promise<Detail> {
		const g_data = g_incident.data;

		const p_app = g_data['app'] as AppPath;
		const p_chain = g_data['chain'] as ChainPath;
		const p_account = g_data['account'] as AccountPath;

		const [g_app, g_chain, g_account] = await Promise.all([
			(async() => p_app? await Apps.at(p_app): null)(),
			(async() => p_chain? await Chains.at(p_chain): null)(),
			(async() => p_account? await Accounts.at(p_account): null)(),
		]);

		const g_context: PartialLocalAppContext = {
			p_app,
			p_chain,
			p_account,
			g_app,
			g_chain,
			g_account,
			sa_owner: g_account && g_chain? Chains.addressFor(g_account.pubkey, g_chain): '',
		};

		return await (H_INCIDENT_MAP[g_incident.type] as (
			g_incident: Incident.Struct,
			g_context: PartialLocalAppContext
		) => Promisable<Detail>)(g_incident, g_context);
	}
</script>

<style lang="less">
	@import '../_base.less';

	.row .main .title {
		:global(&) {
			min-width: min-content;
		}
	}

	.row .pfp.icon {
		:global(&) {
			color: var(--theme-color-text-light);
		}
	}

	.txn-type.icon {
		vertical-align: middle;
		--icon-diameter: 18px;
		--icon-color: var(--theme-color-text-med);
	}

	:global(.event-icon) {
		display: flex;
		background: var(--theme-color-border);
		padding: 9px;
		border-radius: 18px;
	}

	:global(.txns>.row>.rest>*) {
		margin-left: -11px;
	}

	:global(.unseen-incident) {
		background-color: var(--theme-color-sky);
	}

	.pill {
		display: inline-block;
		padding: 0.4em 1em;
		color: var(--theme-color-graymed);
		border: 1px solid var(--theme-color-graydark);
		border-radius: 400em;
		margin: 0;
		margin-top: 0.5em;
	}
</style>

<div class="txns no-margin">
	<slot name="first"></slot>

	{#await load_incidents()}
		<LoadingRows />
	{:then a_incidents}
		{#each a_incidents as g_incident}
			{#await detail_incident(g_incident)}
				<LoadingRows />
			{:then g_detail}
				<Row
					rootClasses={g_detail.rootClasses || ''}
					childClasses={g_detail.childClasses || ''}
					name={g_detail.title}
					detail={g_detail.subtitle}
					amount={g_detail.amount || ''}
					fiat={g_detail.fiat || ''}
					on:click={() => {
						k_page.push({
							creator: IncidentView,
							props: {
								incident: Incidents.pathFrom(g_incident),
							},
						});
					}}
				>
					<svelte:fragment slot="icon">
						<Put element={g_detail.icon} />
					</svelte:fragment>

					<svelte:fragment slot="right">
						{#if 'string' === typeof g_detail.pfp}
							<PfpDisplay dim={36}
								filter={g_detail.filter || ''}
								name={g_detail.name}
								path={g_detail.pfp}
								circular={'pending' === g_incident.data['stage']}
								rootStyle='margin-left: 1em;'
							/>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="below">
						{#if g_detail.link}
							<span class="link">
								<a href={g_detail.link.href} on:click={() => open_external_link(g_detail.link.href)}>
									{g_detail.link.text}
								</a>
							</span>
						{/if}
					</svelte:fragment>
				</Row>
			{/await}
		{/each}
	{/await}
</div>