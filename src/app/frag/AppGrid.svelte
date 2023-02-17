<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	
	import {yw_account_ref, yw_chain_ref} from '../mem';
	
	import {global_receive} from '#/script/msg-global';
	import {H_STORE_INIT_APPS} from '#/store/_init';
	import {Apps} from '#/store/apps';
	
	import PfpDisplay from './PfpDisplay.svelte';

	const a_apps_account: AppStruct[] = [];
	const a_apps_chain: AppStruct[] = [];
	const a_apps_on: AppStruct[] = [];
	const a_apps_builtin: AppStruct[] = [];
	const a_apps_off: AppStruct[] = [];

	let a_categories = [
		a_apps_account,
		a_apps_chain,
		a_apps_on,
		a_apps_builtin,
		a_apps_off,
	];

	const h_categories = {};
	// let a_apps: AppStruct[] = [];

	async function reload_apps() {
		console.log(`reloading apps on ${$yw_chain_ref}`);


		// start with all apps
		for(const [p_app, g_app] of await Apps.entries()) {
			// app is on
			if(g_app.on) {
				// app is connected on current chain
				const g_connection = g_app.connections[$yw_chain_ref];
				if(g_connection) {
					// app is connected to current account
					if(g_connection.accounts.includes($yw_account_ref)) {
						a_apps_account.push(g_app);
					}
					else {
						a_apps_chain.push(g_app);
					}
				}
				else {
					a_apps_on.push(g_app);
				}
			}
			else if(p_app in H_STORE_INIT_APPS) {
				a_apps_builtin.push(g_app);
			}
			else {
				a_apps_off.push(g_app);
			}
		}

		a_categories = a_categories;
	}

	void reload_apps();

	global_receive({
		'updateStore'({key:si_store}) {
			if('apps' === si_store) {
				void reload_apps();
			}
		},
	});
</script>

<style lang="less">
	.app-grid {
		overflow: scroll;
		display: flex;
		gap: 6px;

		.app {
			width: 128px;
			height: 128px;

			text-align: center;
			padding: 12px;
			box-sizing: border-box;
			border: 1px solid var(--theme-color-border);
			border-radius: 6px;
			background-color: fade(black, 40%);
			font-size: 12px;
		}
	}
</style>

<div class="app-grid">
	{#each a_categories as a_apps}
		{#each a_apps as g_app}
			<div class="app">
				<div>
					<PfpDisplay dim={64} resource={g_app} />
				</div>

				<div>
					{g_app.name}
				</div>
			</div>
		{/each}
	{/each}
</div>