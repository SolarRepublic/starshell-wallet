<script lang="ts">
	
	import type {AppStruct} from '#/meta/app';
	import {AppApiMode} from '#/meta/app';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {createEventDispatcher} from 'svelte';

	import {yw_account_ref, yw_chain_ref} from '../mem';
	
	import {global_receive} from '#/script/msg-global';
	import {P_STARSHELL_DAPPS} from '#/share/constants';
	import {H_STORE_INIT_APPS} from '#/store/_init';
	import {Apps} from '#/store/apps';

	import {Chains} from '#/store/chains';
	import type {StarShellAppEntry} from '#/store/web-resource-cache';
	import {WebResourceCache} from '#/store/web-resource-cache';
	import {ode, timeout_exec} from '#/util/belt';
	import {uuid_v4} from '#/util/data';
	
	import PfpDisplay from './PfpDisplay.svelte';
	

	export let s_app_filter = '';

	// The constants used by the LCG formula
	const X_PRNG_A = 1664525;
	const X_PRNG_C = 1013904223;
	const X_PRNG_M = Math.pow(2, 32);

	// discover sort seed
	let x_seed = Math.random();

	function prng() {
		// Generate the next pseudo-random number
		x_seed = ((X_PRNG_A * x_seed) + X_PRNG_C) % X_PRNG_M;

		// Return a value between 0 and 1
		return x_seed / X_PRNG_M;
	}


	let h_categories = {
		account: {
			title: 'Current Account',
			apps: [] as AppStruct[],
		},

		chain: {
			title: 'Current Chain',
			apps: [] as AppStruct[],
		},

		other: {
			title: 'Other Accs/Chains',
			apps: [] as AppStruct[],
		},

		discover: {
			title: 'Discover',
			apps: [] as AppStruct[],
		},

		filter: {
			title: 'Filter',
			apps: [] as AppStruct[],
		},
	};

	function shuffle_discover() {
		const a_apps_discover = h_categories.discover.apps;

		// determinstically shuffle discover list
		for(let i_app=a_apps_discover.length-1; i_app>0; i_app--) {
			const i_swap = Math.floor(prng() * (i_app + 1));
			const g_swap = a_apps_discover[i_swap];
			a_apps_discover[i_swap] = a_apps_discover[i_app];
			a_apps_discover[i_app] = g_swap;
		}
	}

	const distinct = a => Array.from(new Set([...a]));

	$: if(s_app_filter) {
		let s_filter = s_app_filter.toLowerCase();

		const a_rank_top: AppStruct[] = [];
		const a_rank_med: AppStruct[] = [];
		const a_rank_low: AppStruct[] = [];

		for(const [si_category, g_category] of ode(h_categories)) {
			if('filter' === si_category) continue;

			for(const g_app of g_category.apps) {
				if(g_app.name.toLowerCase().startsWith(s_filter)) {
					a_rank_top.push(g_app);
				}
				else if(g_app.name.includes(s_filter)) {
					a_rank_med.push(g_app);
				}
				else if(g_app.host.includes(s_filter)) {
					a_rank_low.push(g_app);
				}
			}
		}

		h_categories.filter.apps = distinct([
			...a_rank_top,
			...a_rank_med,
			...a_rank_low,
		]);

		h_categories = h_categories;
	}

	async function reload_apps() {
		console.log(`reloading apps on ${$yw_chain_ref}`);

		const {
			account: {
				apps: a_apps_account,
			},
			chain: {
				apps: a_apps_chain,
			},
			other: {
				apps: a_apps_other,
			},
			discover: {
				apps: a_apps_discover,
			},
		} = h_categories;

		// reset
		a_apps_account.length = 0;
		a_apps_chain.length = 0;
		a_apps_other.length = 0;

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
					a_apps_other.push(g_app);
				}
			}
			// app is not on but is a built-in app
			else if(p_app in H_STORE_INIT_APPS) {
				a_apps_discover.push(g_app);
			}
			// else {
			// 	a_apps_off.push(g_app);
			// }
		}

		h_categories.account.apps = distinct(a_apps_account);
		h_categories.chain.apps = distinct(a_apps_chain);
		h_categories.other.apps = distinct(a_apps_other);
		h_categories.discover.apps = distinct(a_apps_discover);

		shuffle_discover();
		h_categories = h_categories;
	}

	void reload_apps();

	global_receive({
		'updateStore'({key:si_store}) {
			if('apps' === si_store) {
				void reload_apps();
			}
		},
	});

	yw_chain_ref.subscribe(reload_apps, null, true);
	yw_account_ref.subscribe(reload_apps, null, true);

	async function entry_to_app(g_entry: StarShellAppEntry): Promise<AppStruct> {
		// load its pfp
		const d_url = new URL(P_STARSHELL_DAPPS);
		const p_pfp = `img:${d_url.origin}${d_url.pathname.replace(/\/[^/]*$/, `/${g_entry.icon}`)}` as PfpTarget;

		return {
			scheme: 'https',
			host: g_entry.host,
			name: g_entry.name,
			api: AppApiMode.UNKNOWN,
			connections: {},
			on: 0,
			pfp: p_pfp,
		};
	}


	async function load_dapps_registry() {
		// update defaults
		try {
			const [a_dapps_all, xc_timeout] = await timeout_exec(10e3, () => WebResourceCache.get(P_STARSHELL_DAPPS));

			if(!xc_timeout) {
				const ks_apps = await Apps.read();

				// chain path as caip-2
				const si_caip2 = Chains.caip2For($yw_chain_ref);

				// add each to suggestions list if not already registered
				const a_discover = (a_dapps_all as unknown as StarShellAppEntry[])
					.filter(g_entry => !ks_apps.at(Apps.pathFor(g_entry.host, 'https'), true)?.on && g_entry.chains.includes(si_caip2));

				const a_apps = h_categories.discover.apps = [] as AppStruct[];

				for(const g_entry of a_discover) {
					a_apps.push(await entry_to_app(g_entry));

					h_categories = h_categories;
				}
			}
		}
		catch(e_update) {
			console.warn(`Apps registry update failed: ${e_update.message}`);
		}

		shuffle_discover();

		h_categories = h_categories;
	}

	void load_dapps_registry();


	const dispatch = createEventDispatcher();

	function launch_app(g_app: AppStruct) {
		const p_launch = `${g_app.scheme}://${g_app.host}/`;

		dispatch('launch', p_launch);
	}
</script>

<style lang="less">
	.app-grid {
		overflow: scroll;
		display: flex;
		gap: 12px;

		>.app-group {
			&:not(:last-child) {
				padding-right: 10px;
				border-right: 1px dashed var(--theme-color-border);
			}

			display: flex;
			flex-direction: column;
			gap: 6px;
			
			>.group-title {
				font-size: 13px;
				color: var(--theme-color-text-med);
				white-space: nowrap;
			}

			>.group-list {
				display: flex;
				gap: 16px;
			}
		}

		.app {
			width: 112px;
			height: 112px;

			text-align: center;
			padding: 6px;
			box-sizing: border-box;
			border: 1px solid var(--theme-color-border);
			border-radius: 6px;
			background-color: fade(black, 40%);
			font-size: 12px;

			display: flex;
			flex-direction: column;
			gap: 6px;
			justify-content: space-evenly;
		}

		.app-name {
			display: block;
			overflow: hidden;
			line-height: 14px;
		}
	}
</style>

<div class="app-grid">
	{#each ode(h_categories).filter(([, g]) => g.apps.length) as [si_category, g_category]}
		{#if !s_app_filter !== ('filter' === si_category)}
			<div class="app-group">
				<div class="group-title">
					{g_category.title}
				</div>

				<div class="group-list">
					{#each g_category.apps as g_app (g_app? Apps.pathFrom(g_app): uuid_v4())}
						<div class="app" on:click={() => launch_app(g_app)}>
							<div class="app-pfp">
								<PfpDisplay dim={64} name={g_app.name} path={g_app.pfp} />
							</div>
			
							<div class="app-name">
								{g_app.name}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/each}
</div>