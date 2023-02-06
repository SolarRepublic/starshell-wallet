<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {SessionRequest} from '#/meta/api';
	import type {AppChainConnection, AppStruct} from '#/meta/app';
	import {AppApiMode} from '#/meta/app';
	import type {Dict} from '#/meta/belt';
	import type {Caip2, ChainStruct, ChainPath} from '#/meta/chain';
	import type {PfpPath, PfpTarget} from '#/meta/pfp';
	
	import {quintOut} from 'svelte/easing';
	import {slide} from 'svelte/transition';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {yw_chain, yw_provider} from '../mem';
	
	import {load_flow_context, s2r_slide} from '../svelte';
	
	import {type PermissionsRegistry, process_permissions_request, add_permission_to_set} from '#/extension/permissions';
	import {SessionStorage} from '#/extension/session-storage';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_NOT_FOUND} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {Pfps} from '#/store/pfps';
	import {fodemtv, ode, ofe} from '#/util/belt';
	import {abbreviate_addr} from '#/util/format';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	
	import SX_ICON_BADGE from '#/icon/address-card.svg?raw';
	import SX_ICON_DROPDOWN from '#/icon/arrow-drop-down.svg?raw';
	import SX_ICON_TARGET from '#/icon/crosshairs.svg?raw';
	import SX_ICON_SEND from '#/icon/paper-plane.svg?raw';
	import SX_ICON_READ from '#/icon/search-plus.svg?raw';
	import SX_ICON_SERVER from '#/icon/server.svg?raw';
	import SX_ICON_CHECK from '#/icon/tiny-check.svg?raw';
	import SX_ICON_X from '#/icon/tiny-x.svg?raw';
	

	interface Permission {
		optional?: boolean;
		hidden?: boolean;
		unchecked?: boolean;
		expanded?: boolean;
		selected: boolean;
		title: string;
		icon: string;
		info: string | string[];
		benefit?: string;
		pros?: string[];
		risk?: string;
		cons?: string[];
		justifications?: string[];
		block?: HTMLElement;
	}
	
	type PermissionKey = keyof PermissionsRegistry;

	const H_PERMISSIONS: {
		[si_key in PermissionKey]: (w_value: PermissionsRegistry[si_key]) => Permission;
	} = {
		doxx_name: (): Permission => ({
			optional: true,
			selected: true,
			icon: SX_ICON_BADGE,
			title: 'View the name of your account',
			info: `includes: ${a_accounts.map(g => `"${g.name}"`).join(', ')}`,
			benefit: 'May improve UI when multiple accounts are connected',
			risk: 'Could lead to de-anonymization or tracking:',
			cons: [
				'if account name is your real name or online handle',
				'if it is unique, allowing sites to track you across the web',
			],
		}),

		dox_address: (a_justifications): Permission => ({
			// TODO: make optional once account shadowing is implemented
			optional: false,
			selected: true,
			icon: SX_ICON_TARGET,
			title: 'Record your chain address',
			info: [
				`includes: ${a_accounts.map(g => `"${abbreviate_addr(Chains.addressFor(g.pubkey, $yw_chain))}"`).join(', ')}`,
			],
			benefit: 'Needed for: bridges, airdrops, or off-chain verification',
			risk: 'Apps can use your address to:',
			cons: [
				'associate it with your geo-locatable IP address',
				'view your entire transaction history',
				'track you accross other dapps',
			],
			justifications: a_justifications,
		}),

		query_node: (): Permission => ({
			optional: true,
			selected: false,
			unchecked: true,
			icon: SX_ICON_SERVER,
			title: 'Identify your network provider',
			info: `includes: "${new URL($yw_provider.grpcWebUrl).host}"`,
			risk: `It's unclear why an app would want this information`,
		}),

		query: (): Permission => ({
			hidden: true,
			selected: true,
			icon: SX_ICON_READ,
			title: 'Read data from the chain',
			info: 'A common and safe permission',
		}),

		broadcast: (): Permission => ({
			hidden: true,
			selected: true,
			icon: SX_ICON_SEND,
			title: 'Post transactions to the chain',
			info: 'You will be prompted to sign each transaction',
		}),

		// decrypt: (): Permission => ({
		// 	optional: true,
		// 	selected: true,
		// 	icon: SX_ICON_BADGE,
		// 	title: 'Decrypt transaction data',
		// 	info: 'Some apps use this ',
		// }),
	};


	const {
		completed,
	} = load_flow_context<undefined>();

	export let app: AppStruct;

	export let chains: Record<Caip2.String, ChainStruct>;

	const a_chains = Object.values(chains);

	export let sessions: Dict<SessionRequest>;
	const h_sessions = sessions;

	export let accounts: AccountStruct[];
	const a_accounts = accounts;

	const h_connections: Record<ChainPath, AppChainConnection> = {};
	const g_set: AppChainConnection['permissions'] = {};

	// locks the ui
	let b_busy = false;

	let c_hidden = 0;
	let c_hide_safe = 0;

	// scope creation of the permissions list
	const h_permissions = (() => {
		const h_flattened: Partial<PermissionsRegistry> = {};

		const a_account_paths = a_accounts.map(g => Accounts.pathFrom(g));

		process_permissions_request({
			h_sessions,
			h_chains: chains,
			h_flattened,
			h_connections,
			a_account_paths,
		});

		// map the merged properties onto the permission rendering functions
		const h_presorted = fodemtv(h_flattened, (w, si) => H_PERMISSIONS[si!](w) as Permission);
		const a_presorted_entries = ode(h_presorted);

		// count number of hidden vs non-hidden
		{
			for(const [, g_permission] of a_presorted_entries) {
				if(g_permission.hidden) c_hidden += 1;
			}

			// there is at least 1 hideable permission and at least 2 un-hideable
			if(c_hidden && a_presorted_entries.length - c_hidden >= 2) {
				// allow the ui to hide the hidden permissions
				c_hide_safe = c_hidden;
			}
		}

		// cache permission registry keys
		const a_keys = Object.keys(H_PERMISSIONS);

		// sort permissions by their order in the registry
		return ofe(a_presorted_entries.sort(([si_a], [si_b]) => a_keys.indexOf(si_a) - a_keys.indexOf(si_b)));
	})();

	async function connect() {
		// lock the ui
		b_busy = true;

		// catch any errors and show user
		try {
			// update global permissions
			for(const [si_key, g_permission] of ode(h_permissions)) {
				if(g_permission.selected) {
					add_permission_to_set(si_key as PermissionKey, g_set);
				}
			}

			// apply permissions to connections
			for(const [, g_connection] of ode(h_connections)) {
				g_connection.permissions = g_set;
			}

			// attempt to load previous app definition
			const p_app = Apps.pathFrom(app);
			const g_app_old = await Apps.at(p_app);

			// prep new app definition
			const g_app_new = {
				// allow updates to name, pfp, api mode, etc.
				...(g_app_old === G_APP_NOT_FOUND? void 0: g_app_old) || app,
				pfp: app.pfp || g_app_old?.pfp || '' as PfpTarget,
				name: app.name || g_app_old?.name || 'Un-named App',
				api: app.api || g_app_old?.api || AppApiMode.UNKNOWN,

				// replace connections
				connections: h_connections,
			};

			// construct site URL
			const p_site = `${g_app_new.scheme}://${g_app_new.host}`;

			// update app
			{
				// prep saved pfp path
				let p_saved: PfpPath;

				// pfp exists in session storage
				const p_data = await SessionStorage.get(`pfp:${p_site}`);
				if(p_data) {
					// save pfp from session storage to persistent storage
					[p_saved] = await Pfps.addData(p_data);

					// update app definition
					g_app_new.pfp = p_saved;
				}

				// replace app definition
				await Apps.put(g_app_new);
			}

			// // save contract definitions from app profile
			// const g_profile = await SessionStorage.get(`profile:${p_site}`);
			// if(g_profile) {
			// 	// open the contracts store for writing
			// 	await Contracts.open(async(ks_contracts) => {
			// 		// each contract def in app profile
			// 		for(const [, g_contract] of ode(g_profile.contracts || {})) {
			// 			// ref contract's chain
			// 			const p_chain = g_contract.chain;

			// 			// parse chain path
			// 			const [si_family, si_chain] = Chains.parsePath(p_chain);

			// 			// prep token interfaces
			// 			const h_interfaces = (g_contract.interfaces || {}) as TokenStructDescriptor;

			// 			// construct path to contract pfp in session storage
			// 			let p_pfp = `pfp:${p_site}/${si_family}:${si_chain}`;

			// 			// caip-19 asset
			// 			const si_interface_0 = Object.keys(h_interfaces)[0];
			// 			if(si_interface_0) {
			// 				p_pfp += `/${si_interface_0}:${g_contract.bech32}`;
			// 			}
			// 			// caip-10 account
			// 			else {
			// 				p_pfp += `:${g_contract.bech32}`;
			// 			}

			// 			// save pfp
			// 			const p_data = await SessionStorage.get(p_pfp as `pfp:${string}`);
			// 			let p_saved: PfpTarget = '';
			// 			if(p_data) {
			// 				[p_saved] = await Pfps.addData(p_data);
			// 			}

			// 			// save contract to store
			// 			await ks_contracts.merge({
			// 				on: 1,
			// 				bech32: g_contract.bech32,
			// 				chain: g_contract.chain,
			// 				name: g_contract.name || 'Unlabeled',
			// 				hash: g_contract.hash || '',
			// 				interfaces: h_interfaces,
			// 				pfp: p_saved,
			// 				origin: `app:${p_app}`,
			// 			});
			// 		}
			// 	});
			// }

			// save incident
			await Incidents.record({
				type: 'app_connected',
				data: {
					app: p_app,
					accounts: a_accounts.map(g => Accounts.pathFrom(g)),
					api: g_app_new.api,
					connections: h_connections,
				},
			});
		}
		catch(e_connect) {
			throw syserr(e_connect as Error);
		}

		completed(true);
	}

</script>

<style lang="less">
	@import '../_base.less';

	.show-hidden {
		margin: 0 var(--ui-padding);
		padding: 1em 0;
		border-top: 1px solid var(--theme-color-border);

		.global_svg-icon {
			color: var(--theme-color-primary);
			margin-left: -7px;
		}
	}

	.rows {
		>.row {
			display: flex;
			margin: 0 var(--ui-padding);
			border-top: 1px solid var(--theme-color-border);
			padding: var(--ui-padding) 0;
			justify-content: space-between;

			>.permission {
				>.title {
					.global_svg-icon {
						display: inline-flex;
						margin-right: 0.5em;
						vertical-align: middle;
						margin-top: -2.5px;
						color: var(--theme-color-text-med);
					}
				}

				>.info {
					.font(tiny);
					color: var(--theme-color-text-med);
					margin-top: 0.15em;

					.show-details {
						margin-right: 1em;
					}

					.overview {
						margin-top: 0.75em;

						// allow overview text to overflow below checkbox
						margin-right: -18px;

						.benefit,.risk {
							color: var(--theme-color-text-light);

							>.global_svg-icon {
								display: inline-flex;
								vertical-align: middle;
								margin-top: -2px;
								margin-right: 2px;
							}
						}
					}

					.justifications {
						margin-top: 0.75em;

						.appeal {
							background-color: rgba(0, 0, 0, 0.6);
							border-radius: 8px;
							margin-top: 0.5em;
							margin-bottom: 0;
							padding: 1em 1.5em;
							opacity: 0.7;
							white-space: pre-wrap;
						}
					}

					ul {
						color: var(--theme-color-text-med);
						margin: 0;
						padding: 0 0 0 calc(1 * var(--ui-padding) - 1px);
						opacity: 0.5;
					}
				}
			}

			>.checkbox-field {
				padding-top: 0.5em;
				flex-basis: content;
			}
		}
	}
</style>

<Screen>
	<AppBanner {app} chains={a_chains} account={1 === a_accounts.length? a_accounts[0]: null} on:close={() => completed(false)}>
		<span style="display:contents;" slot="default">
			Review permissions requests
		</span>

		<span slot="context">
			You can safely disable optional permissions
		</span>
	</AppBanner>

	<div class="rows no-margin">
		{#each ode(h_permissions) as [si_key, g_permission]}
			{#if !c_hide_safe || !g_permission.hidden}
				<div class="row" on:click={toggleChildCheckbox} in:s2r_slide={{duration:300, easing:quintOut, minHeight:40/c_hidden}}>
					<div class="permission">
						<div class="title">
							<span class="global_svg-icon icon-diameter_12px">
								{@html g_permission.icon}
							</span>
							<span>
								{g_permission.title}
							</span>
						</div>
						<div class="info">
							{#if g_permission.info}
								{#each [g_permission.info].flat() as s_line, i_line}
									{#if i_line}<br>{/if}
									{s_line}
								{/each}
							{/if}

							{#if (g_permission.pros || g_permission.cons || g_permission.risk || g_permission.justifications)}
								<br>
								<span class="link show-details" on:click={(d_event) => {
									g_permission.expanded = !g_permission.expanded;
									d_event.stopPropagation();
								}}>
									{#if g_permission.expanded}
										Hide details
									{:else}
										Show details
									{/if}
								</span>
							{/if}

							{#if g_permission.expanded}
								<div class="overview" transition:slide={{duration:300, easing:quintOut}}>
									{#if g_permission.benefit}
										<div class="benefit">
											<span class="global_svg-icon icon-diameter_10px">
												{@html SX_ICON_CHECK}
											</span>
											{g_permission.benefit}
										</div>
									{/if}

									{#if g_permission.pros}
										<ul class="pros">
											{#each g_permission.pros as s_pro}
												<li>{s_pro}</li>
											{/each}
										</ul>
									{/if}

									{#if g_permission.risk}
										<div class="risk">
											<span class="global_svg-icon icon-diameter_10px">
												{@html SX_ICON_X}
											</span>
											{g_permission.risk}
										</div>
									{/if}

									{#if g_permission.cons}
										<ul class="cons">
											{#each g_permission.cons as s_con}
												<li>{s_con}</li>
											{/each}
										</ul>
									{/if}
								</div>

								{#if g_permission.justifications}
									<div class="justifications">
										{#if g_permission.justifications.length}
											<span class="pretext">
												App attempts to justify this permission:
											</span>
											<pre class="appeal unglobal">{#each g_permission.justifications as s_justification}{s_justification}
{/each}</pre>
										{:else}
											<span class="pretext">
												App does not attempt to justify this permission
											</span>
										{/if}
									</div>
								{/if}
							{/if}
						</div>
					</div>	

					<span class="checkbox-field">
						<CheckboxField id={si_key} checked={g_permission.selected}
							disabled={!g_permission.optional}
							on:change={({detail:b_checked}) => g_permission.selected = b_checked}
						/>
					</span>
				</div>
			{/if}
		{/each}

		{#if c_hide_safe}
			<div class="show-hidden">
				<span class="global_svg-icon icon-diameter_24px">
					{@html SX_ICON_DROPDOWN}
				</span>
				<span on:click={() => c_hide_safe = 0}>
					Show {c_hide_safe} other common permission{1 === c_hide_safe? '': 's'}
				</span>
			</div>
		{/if}
	</div>
	

	<ActionsLine back confirm={['Connect', connect]} disabled={b_busy} />
</Screen>
