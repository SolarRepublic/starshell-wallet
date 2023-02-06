<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	
	import type {SecretStruct} from '#/meta/secret';
	
	import {onDestroy} from 'svelte';

	
	import {Screen} from './_screens';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_owner} from '../mem';
	import {reloadable} from '../mem-store';
	import {load_page_context} from '../svelte';
	
	import {try_reloading_page} from '#/extension/browser';
	import {Accounts} from '#/store/accounts';
	import {Apps} from '#/store/apps';
	
	import {Policies} from '#/store/policies';
	import {Secrets} from '#/store/secrets';
	
	import AppDisconnect from './AppDisconnect.svelte';
	import AppQueryPermits from './AppQueryPermits.svelte';
	import AppViewingKeys from './AppViewingKeys.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	import Portrait, {type Actions} from '../frag/Portrait.svelte';
	import Gap from '../ui/Gap.svelte';
	import Header from '../ui/Header.svelte';
	
	
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import Tab from '../ui/Tab.svelte';
	import TabList from '../ui/TabList.svelte';
	import Tabs from '../ui/Tabs.svelte';
	
	import SX_ICON_CONFIRMATION from '#/icon/confirmation.svg?raw';
	import SX_ICON_EXPAND_RIGHT from '#/icon/expand-right.svg?raw';
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	
	

	export let app: AppStruct;
	const g_app = app;

	const p_app = Apps.pathFrom(g_app);

	const {
		k_page,
		g_cause,
	} = load_page_context();

	let h_actions: Actions = {};
	
	(function reload() {
		const h_stage: Actions = {
			// permissions: {
			// 	trigger() {
			// 		// 
			// 	},
			// },

			// accounts: {
			// 	trigger() {
			// 		//
			// 	},
			// },
		};

		if(g_app.on) {
			Object.assign(h_stage, {
				// disable: {
				// 	async trigger() {
				// 		// temporarily disable app
				// 		await SessionStorage.set({

				// 		});
				// 	},
				// },

				disconnect: {
					async trigger() {
						// no connections
						if(!Object.keys(g_app.connections).length) {
							// disable app
							await Apps.update(p_app, () => ({
								on: 0,
							}));

							// reset thread
							k_page.reset();
						}
						else {
							k_page.push({
								creator: AppDisconnect,
								props: {
									g_app,
								},
							});
						}
					},
				},
			});
		}
		else {
			Object.assign(h_stage, {
				enable: {
					async trigger() {
						//
					},
				},

				delete: {
					async trigger() {
						// delete everything that touches the app
						// TODO: go thru incidents, secrets, contracts, ...

						// delete the app
						await Apps.open(ks => ks.delete(Apps.pathFrom(g_app)));

						// reset the thread
						k_page.reset();
					},
				},
			});
		}


		(async() => {
			const g_policy = await Policies.forApp(g_app);
			if(g_policy.blocked) {
				h_actions.unblock = {
					async trigger() {
						await Policies.unblockApp(g_app);
						reload();

						if(g_cause?.tab) {
							await try_reloading_page({tabId:g_cause.tab.id});
						}
					},
				};

				h_actions = h_actions;
			}
		})();

		h_actions = h_stage;
	})();


	let a_keys: SecretStruct<'viewing_key'>[] = [];
	let a_permits: SecretStruct<'query_permit'>[] = [];

	$: nl_keys = a_keys.length;
	$: nl_permits = a_permits.length;

	function edit_viewing_keys() {
		k_page.push({
			creator: AppViewingKeys,
			props: {
				g_app,
			},
		});
	}

	function edit_query_permits() {
		k_page.push({
			creator: AppQueryPermits,
			props: {
				g_app,
			},
		});
	}

	async function reload_access() {
		const p_chain = $yw_chain_ref;
		const sa_owner = $yw_owner!;

		[a_keys, a_permits] = await Promise.all([
			Secrets.filter({
				type: 'viewing_key',
				on: 1,
				owner: sa_owner,
				chain: p_chain,
				outlets: [p_app],
			}),

			Secrets.filter({
				type: 'query_permit',
				on: 1,
				owner: sa_owner,
				chain: p_chain,
				outlets: [p_app],
			}),
		]);
	}

	let a_accounts_all: AccountStruct[] = [];
	let a_accounts_connected: AccountStruct[] = [];
	$: a_account_paths = a_accounts_connected.map(g => Accounts.pathFrom(g));

	async function reload_connections() {
		const g_app_chain = g_app.connections[$yw_chain_ref];

		const ks_accounts = await Accounts.read();

		a_accounts_all = ks_accounts.entries().map(([, g]) => g);
		a_accounts_connected = g_app_chain.accounts.map(p => ks_accounts.at(p)!);
	}

	reloadable({
		context: {
			sources: [yw_chain, yw_account],
			action: reload_access,
		},
		connections: {
			sources: [yw_chain],
			action: reload_connections,
		},
	}, onDestroy);

</script>

<style lang="less">
	.not-connected {
		font-size: 13px;
		color: var(--theme-color-text-med);
		text-align: center;
		margin: var(--ui-padding) 0;
	}

	.invert-margin {
		min-height: 0.5px;
		max-height: 0.5px;
		background-color: var(--theme-color-border);
		opacity: 0.5;
	}
</style>

<Screen>
	<Header account network pops
		title='App Info'
		subtitle="on {$yw_chain.name}"
	/>

	<Portrait
		actions={h_actions}
		resource={g_app}
		title={g_app.name}
		subtitle={g_app.host}
		resourcePath={Apps.pathFrom(g_app)}
	>

	</Portrait>

	<div class="invert-margin"></div>

	<div class="resource-controls">
		<!-- multiple accounts -->
		{#if a_accounts_all.length > 1}
			<Tabs selectedTabIndex={a_accounts_all.findIndex(g => $yw_account_ref === Accounts.pathFrom(g))}>
				<TabList>
					{#each a_accounts_all as g_account}
						<Tab sx_style={a_account_paths.includes(Accounts.pathFrom(g_account))? '': 'opacity:0.3;'} on:select={() => {
							$yw_account_ref = Accounts.pathFrom(g_account);
						}}>
							{g_account.name}
						</Tab>
					{/each}
				</TabList>
			</Tabs>
		{/if}

		{#if a_account_paths.includes($yw_account_ref)}
			<ResourceControl
				infoIcon={SX_ICON_VISIBILITY}
				actionIcon={SX_ICON_EXPAND_RIGHT}
				on:click={edit_viewing_keys}
			>
				{nl_keys} viewing key{1 === nl_keys? '': 's'} shared with app
			</ResourceControl>		

			<ResourceControl
				infoIcon={SX_ICON_CONFIRMATION}
				actionIcon={SX_ICON_EXPAND_RIGHT}
				on:click={edit_query_permits}
			>
				{nl_permits} query permit{1 === nl_permits? '': 's'} in use
			</ResourceControl>
		{:else}
			<p class="not-connected">
				App is not connected to this account.
			</p>
		{/if}
	</div>

	<Gap />

	<IncidentsList filterConfig={{app:p_app}} />
</Screen>
