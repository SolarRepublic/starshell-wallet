<script lang="ts">
	import type {AppStruct, AppPath} from '#/meta/app';
	import type {Dict, Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct, ChainPath, ContractStruct, ContractPath} from '#/meta/chain';
	import type {Incident, IncidentStruct} from '#/meta/incident';
	import type {SecretStruct, SecretPath} from '#/meta/secret';
	
	import {Snip2xMessageConstructor, Snip2xToken} from '#/schema/snip-2x-const';
	
	import {Screen} from './_screens';
	import {yw_account, yw_chain_ref, yw_network, yw_owner} from '../mem';
	
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {token_balance} from '#/chain/token';
	
	import {Chains} from '#/store/chains';
	import {ContractRole, Contracts} from '#/store/contracts';
	import {Incidents} from '#/store/incidents';
	import {Secrets} from '#/store/secrets';
	import {fold, forever, ode} from '#/util/belt';
	
	import ContractEdit from './ContractEdit.svelte';
	import Send from './Send.svelte';
	import TokenAllowances from './TokenAllowances.svelte';
	import TokensAdd from './TokensAdd.svelte';
	import TokenUnwrap from './TokenUnwrap.svelte';
	import TokenVisibility from './TokenVisibility.svelte';
	import AddressResourceControl from '../frag/AddressResourceControl.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	import type {Actions} from '../frag/Portrait.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import Gap from '../ui/Gap.svelte';
	import Header from '../ui/Header.svelte';
	import Load from '../ui/Load.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_CREDIT_CARD from '#/icon/credit-card.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';
	import SX_ICON_EYE from '#/icon/visibility.svg?raw';
    import HoldingWrap from './HoldingWrap.svelte';
    import ContractInspect from './ContractInspect.svelte';
	
	

	export let contractPath: ContractPath;
	const p_contract = contractPath;
	
	let sa_contract: Bech32;
	let s_wrapper_for: string;

	const s_header_title = 'Contract';
	let s_header_post_title = '';
	let s_header_subtitle = '';
	let s_main_title: Promisable<string> = forever('');
	const s_main_post_title = '';
	let s_main_subtitle: Promisable<string> = forever('');

	let g_contract: ContractStruct;
	let p_chain: ChainPath;
	let g_chain: ChainStruct;
	
	// list of relevant incidents
	let a_incidents: IncidentStruct[] = [];

	let b_unviewable = false;

	// path to viewing key
	let p_viewing_key: SecretPath;

	// viewing key metadata
	let g_viewing_key: SecretStruct;

	// query permits
	let a_permits: SecretStruct<'query_permit'>[];

	// apps
	const a_apps: AppStruct[] = [];

	const h_apps_by_permission: Dict<Set<AppPath>> = {};

	let h_apps_with_viewing_key: Dict<{}> = {};

	let xc_role = ContractRole.UNKNOWN;

	const GC_ACTION_OPTIONS = {
		send: {
			label: 'Transfer',
			trigger() {
				// ensure chain is correct
				$yw_chain_ref = g_contract.chain;

				// push send screen
				k_page.push({
					creator: Send,
					props: {
						assetPath: p_contract,
					},
				});
			},
		},

		edit: {
			label: 'Edit',
			trigger() {
				k_page.push({
					creator: ContractEdit,
					props: {
						p_contract,
					},
				});
			},
		},

		// delete: {
		// 	label: 'Delete',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 		});
		// 	},
		// },
	};

	let gc_actions: Actions = {
		edit: GC_ACTION_OPTIONS.edit,
	};

	(async function load() {
		const g_contract_local = (await Contracts.at(p_contract))!;

		sa_contract = g_contract_local.bech32;

		p_chain = g_contract_local.chain;
		g_chain = (await Chains.at(p_chain))!;

		// deduce contract role
		xc_role = Contracts.roleOf(g_contract_local, g_chain);

		// update actions if applicable
		if(ContractRole.FUNGIBLE & xc_role) {
			gc_actions.send = GC_ACTION_OPTIONS.send;
		}

		// each coin in chain
		for(const [si_coin, g_coin] of ode(g_chain.coins)) {
			const sa_wrapper = g_coin.extra?.nativeBech32;
			if(sa_wrapper && sa_wrapper === sa_contract) {
				s_wrapper_for = si_coin;

				gc_actions = {
					send: gc_actions.send!,
					wrap: {
						label: 'Deposit',
						trigger() {
							k_page.push({
								creator: HoldingWrap,
								props: {
									si_coin,
								},
							});
						},
					},
					unwrap: {
						trigger() {
							k_page.push({
								creator: TokenUnwrap,
								props: {
									g_contract: g_contract_local,
								},
							});
						},
					},
					edit: gc_actions.edit!,
				};
			}
		}

		// on secret wasm chain
		if(g_chain.features.secretwasm) {
			// contract implements snip-20
			const k_token = Snip2xToken.from(g_contract_local, $yw_network as SecretNetwork, $yw_account);
			if(k_token) {
				s_header_post_title = 'SNIP-20';
				s_header_subtitle = `${g_contract_local.name} token`;

				// viewing key exists
				const s_viewing_key = await k_token.viewingKey();
				if(s_viewing_key) {
					// load all outlets of secret
					const [g_secret] = await Secrets.filter({
						type: 'viewing_key',
						on: 1,
						chain: p_chain,
						contract: sa_contract,
						owner: $yw_owner,
					});

					h_apps_with_viewing_key = fold(g_secret.outlets, si => ({[si]:{}}));

					// load balance
					(async() => {
						const g_balance = await token_balance(g_contract_local, $yw_account, $yw_network);

						if(g_balance) {
							s_main_title = `${g_balance.s_amount} ${k_token.symbol}`;
							s_main_subtitle = Promise.all([g_balance.s_fiat, g_balance.s_worth])
								.then(([s_fiat, s_worth]) => `${s_fiat} (${s_worth} per token)`);
						}
						else {
							s_main_title = 'Unable to fetch balance';
							s_main_subtitle = '';
						}
					})();
				}
				// no viewing key set
				else {
					b_unviewable = true;

					s_main_title = 'No Viewing Key';
					s_main_subtitle = 'Viewing key required to see balance';
				}
			}
			else {
				s_main_title = g_contract_local.name;
				s_main_subtitle = await Contracts.summarizeOrigin(g_contract_local.origin);
				s_header_subtitle = g_chain.name;
			}

			// look for active query permits
			a_permits = await Secrets.filter({
				type: 'query_permit',
				owner: $yw_owner,
				contracts: {
					[sa_contract]: '',
				},
				chain: p_chain,
			});

			// // app paths
			// h_apps_by_permission: Dict<Set<AppPath>> = {};

			// each permit
			for(const g_permit of a_permits) {
				// each permission
				for(const si_permission of g_permit.permissions) {
					// apps as a set
					const as_apps = h_apps_by_permission[si_permission] = h_apps_by_permission[si_permission] || new Set();

					// each outlet
					for(const p_app of g_permit.outlets) {
						as_apps.add(p_app);
					}
				}
			}

			// // read apps
			// const ks_apps = await Apps.read();

			// // get app def
			// const g_app = ks_apps.at(p_app);
		}

		const ks_incidents = await Incidents.read();

		// each incident in store
		for(const [p_incident, g_incident] of ks_incidents.entries()) {
			// only interested in transactions
			if(!['tx_in', 'tx_out'].includes(g_incident.type)) continue;

			// destructure incident
			const {
				type: si_type,
				data: g_data,
				data: {
					stage: si_stage,
					events: h_events,
				},
			} = g_incident as Incident.Struct<'tx_in' | 'tx_out'>;

			// only this chain
			if(g_data.chain !== $yw_chain_ref) continue;

			// each execution
			const a_executions = h_events.executions || [];
			for(const g_execution of a_executions) {
				// includes this contract
				if(sa_contract === g_execution.contract) {
					// add to list
					a_incidents.push(g_incident);
				}
			}
		}

		// reactively assign list
		a_incidents = a_incidents.reverse().sort((g_a, g_b) => g_b.time - g_a.time);

		// set contract
		g_contract = g_contract_local;
	})();
	
	const {
		k_page,
	} = load_page_context();

	let xt_click_prev = 0;
	function pfp_click() {
		const xt_now = performance.now();

		if(xt_now - xt_click_prev < 250) {
			k_page.push({
				creator: ContractInspect,
				props: {
					g_contract,
					g_chain,
				},
			});
		}

		xt_click_prev = xt_now;
	}
</script>

<style lang="less">
	.resource-controls {
		>.resource-control {
			:global(&) {
				padding: 1em 0;
			}
		}
	}
</style>

<Screen nav slides>
	<Header title={s_header_title} postTitle={s_header_post_title} subtitle={s_header_subtitle} pops search account />
	
	{#if !g_contract}
		<Portrait loading
			resourcePath={p_contract}
			actions={gc_actions}
		/>
	{:else}
		{#key gc_actions}
			<Portrait on:pfp_click={pfp_click}
				resource={g_contract}
				resourcePath={p_contract}
				title={s_main_title}
				postTitle={s_main_post_title}
				actions={b_unviewable? {}: gc_actions}
			>
				<svelte:fragment slot="subtitle">
					{#if s_main_subtitle}
						<div style='margin-bottom:0.5em;'>
							<Load input={s_main_subtitle} />
						</div>
					{/if}
				</svelte:fragment>
			</Portrait>
		{/key}

		{#if b_unviewable}
			<div class="no-viewing-key text-align_center subinfo">
				<div class="buttons">
					<button class="pill" on:click={() => {
						k_page.push({
							creator: TokensAdd,
							props: {
								suggested: [g_contract],
							},
						});
					}}>
						Add viewing key
					</button>
				</div>
			</div>
		{:else}
			{@const nl_permissions = Object.keys(h_apps_by_permission).length}
			{@const nl_vk_outlets = Object.keys(h_apps_with_viewing_key).length}

			<div class="resource-controls">
				<!-- contract address -->
				<AddressResourceControl address={sa_contract} />

				<!-- viewing abilities summary -->
				<ResourceControl infoIcon={SX_ICON_EYE} actionIcon={SX_ICON_EDIT} on:click={() => {
					k_page.push({
						creator: TokenVisibility,
						props: {
							contract: g_contract,
						},
					});
				}}>
					{#if 0 === nl_permissions + nl_vk_outlets}
						<div class="color_text-med">
							No others are able to <em>view</em> this token
						</div>
					{:else}
						{#if nl_vk_outlets}
							{@const b_singular = 1 === nl_vk_outlets}
							<div>
								{nl_vk_outlets} app{b_singular? ' has': 's have'} a copy of the current viewing key
							</div>
						{/if}

						{#if nl_permissions}
							{#each ode(h_apps_by_permission) as [si_permission, as_apps]}
								{@const b_singular = 1 === as_apps.size}
								<div>
									{as_apps.size} app{b_singular? ' has': 's have'} the {si_permission} permission
								</div>
							{/each}
						{/if}
					{/if}
				</ResourceControl>

				<!-- spending abilities summary -->
				{#if ContractRole.FUNGIBLE & xc_role}
					<ResourceControl infoIcon={SX_ICON_CREDIT_CARD} actionIcon={SX_ICON_EDIT} on:click={() => {
						k_page.push({
							creator: TokenAllowances,
							props: {
								contract: g_contract,
							},
						});
					}}>
						<div class="color_text-med">
							No others are able to <em>spend</em> this token
						</div>
					</ResourceControl>
				{/if}
			</div>
		{/if}

		<Gap />

		{#if a_incidents.length}
			<IncidentsList incidents={a_incidents} />
		{:else}
			<!-- TODO: empty state -->
		{/if}
	{/if}
</Screen>
