<script lang="ts" context="module">
	export type Status = 'connected' | 'no_permissions' | 'disabled' | 'disconnected' | 'blocked';

	export const H_LOCALIZATION: Record<Status, {text: string}> = {
		connected: {
			text: 'Connected',
		},
		no_permissions: {
			text: 'No Permissions',
		},
		disconnected: {
			text: 'Disconnected',
		},
		disabled: {
			text: 'Disabled',
		},
		blocked: {
			text: 'Blocked',
		},
	};
</script>

<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import {AppApiMode} from '#/meta/app';
	
	import {createEventDispatcher} from 'svelte';
	
	import {ThreadId} from '../def';
	
	import {keplr_polyfill_script_add_matches} from '#/script/scripts';
	import {Apps} from '#/store/apps';
	import type {AppPolicyResult} from '#/store/policies';
	import {Policies} from '#/store/policies';
	import {Secrets} from '#/store/secrets';
	import {yw_chain_ref, yw_navigator, yw_overlay_app, yw_owner} from '##/mem';
	
	import AppView from '../screen/AppView.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_CONFIRMATION from '#/icon/confirmation.svg?raw';
	import SX_ICON_ARROW_DOWN from '#/icon/expand_more.svg?raw';
	
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	import { B_MOBILE_WEBKIT_VIEW } from '#/share/constants';
	
	
	export let g_app: AppStruct;

	$: p_app = Apps.pathFrom(g_app);
	
	let g_app_policy: AppPolicyResult;

	let b_registered = false;

	let b_blocked = false;
	
	let s_app_status: Status = 'disconnected';

	async function update_app() {
		b_registered = false;
		b_blocked = false;

		if(!g_app) {
			s_app_status = 'disconnected';
		}
		else {
			g_app_policy = await Policies.forApp(g_app);

			if(g_app_policy.blocked) {
				b_blocked = true;

				s_app_status = 'blocked';
			}
			else if(!g_app.on) {
				s_app_status = 'disabled';
			}
			else {
				b_registered = true;

				s_app_status = Object.keys(g_app.connections).length? 'connected': 'no_permissions';
			}
		}
	}

	$: if(g_app || !g_app) {
		void update_app();
	}

	function pause(dm: HTMLElement, gc?: any) {
		return {
			duration: 200,
		};
	}

	async function unblock() {
		if(await Policies.unblockApp(g_app!)) {
			// enable api on this app
			await enable_keplr_api();
		}
	}

	const dispatch = createEventDispatcher();

	async function enable_keplr_api() {
		// set api mode
		g_app.api = AppApiMode.KEPLR;

		// save app def to storage
		await Apps.add(g_app);

		// enable app
		if(!g_app.on) {
			await Apps.update(Apps.pathFrom(g_app), () => ({
				on: g_app.on=1,
			}));
		}

		// ensure polyfill is enabled for this app
		await keplr_polyfill_script_add_matches([Apps.scriptMatchPatternFrom(g_app)]);

		// reload the page
		dispatch('reload');
	}
</script>

<style lang="less">
	@import '../_base.less';

	.overlay {
		padding-left: var(--ui-padding);
		padding-right: var(--ui-padding);
		padding-bottom: var(--ui-padding);

		background-color: rgba(0, 0, 0, 0.95);
		border-radius: 8px;
		max-height: 320px;
		display: flex;
		flex-direction: column;
		overscroll-behavior: contain;
		overflow: scroll;
		.hide-scrollbar();

		box-sizing: border-box;

		>.top {
			display: flex;
			justify-content: space-between;
			align-items: center;

			>h3 {
				margin: 16px 0;
			}

			>.add-new {
				>.icon {
					--icon-diameter: 8px;
					--icon-color: var(--theme-color-primary);
				}
			}

			.status-bulb(@bg) {
				content: "\a0";
				border-radius: 6px;
				background-color: @bg;
				width: 6px;
				height: 6px;
				display: inline-flex;
				vertical-align: middle;
				margin-right: 5px;
				margin-top: -2px;
			}

			>.status {
				font-size: 12px;
				color: var(--theme-color-text-med);

				&.connected {
					color: var(--theme-color-grass);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-grass));
					}
				}

				&.no_permissions,&.disabled {
					color: var(--theme-color-caution);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-caution));
					}
				}

				&.blocked {
					color: var(--theme-color-red);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-red));
					}
				}
			}
		}

		>.rows {
			display: flex;
			flex-direction: column;
			--row-padding: 12px;


			.overlay-select.icon {
				:global(&) {
					--icon-diameter: 20px;
					align-self: center;
				}
			}

			>.row {
				:global(&) {
					padding-top: var(--row-padding) !important;
					padding-left: 0 !important;
					padding-right: var(--row-padding) !important;
					padding-bottom: var(--row-padding) !important;
				}
			}
		}
	}

	.secondary-group {
		text-align: center;
		margin: 1em;
	}
</style>

<div class="overlay select" out:pause>
	<div class="top">
		<h3>
			Current App
		</h3>

		{#if s_app_status}
			<span class={`status ${s_app_status}`}>
				{H_LOCALIZATION[s_app_status].text}
			</span>
		{/if}
	</div>

	<div class="rows">
		<Row
			name={g_app.name}
			pfp={g_app.pfp}
			detail={g_app.host}
			on:click={async(d_event) => {
				if(B_MOBILE_WEBKIT_VIEW) return;

				if(b_registered) {
					$yw_overlay_app = false;

					// active apps thread
					await $yw_navigator.activateThread(ThreadId.APPS);

					// // reset thread
					// $yw_navigator.activeThread.reset();

					// await timeout(1e3);

					// push app view
					$yw_navigator.activePage.push({
						creator: AppView,
						props: {
							app: g_app,
						},
					});
				}
				else {
					d_event.stopPropagation();
				}
			}}
			rootStyle='margin-bottom:1em;'
		>
			<svelte:fragment slot="right">
				{#if b_registered && !B_MOBILE_WEBKIT_VIEW}
					<span class="overlay-select icon rotate_-90deg" style="--icon-color: var(--theme-color-primary);">
						{@html SX_ICON_ARROW_DOWN}
					</span>
				{/if}
			</svelte:fragment>
		</Row>
	</div>

	<div class="rows">
		{#if b_blocked}
			<div style={`
				display: flex;
			`.replace(/\s+/g, ' ')}>
				<button class="pill" on:click|stopPropagation={() => unblock()}>
					Unblock
				</button>
			</div>
		{:else if !g_app.on}
			<div style={`
				display: flex;
			`.replace(/\s+/g, ' ')}>
				<button class="pill" on:click|stopPropagation={() => enable_keplr_api()}>
					Enable
				</button>
			</div>
		{:else if !b_registered}
			<!-- <div style={`
				display: flex;
				gap: 1rem;
			`.replace(/\s+/g, ' ')}>
				<button class="pill" on:click|stopPropagation={() => enable_keplr_api()}>
					Enable Keplr API
				</button>
			</div> -->
		{:else}
			{#if p_app}
				{#await Secrets.filter({
					type: 'viewing_key',
					on: 1,
					owner: $yw_owner,
					chain: $yw_chain_ref,
					outlets: [p_app],
				}) then a_keys}
					{@const nl_keys = a_keys.length}
					<div class="global_header-overlay-overview viewing-keys">
						<span class="global_svg-icon icon-diameter_16px">
							{@html SX_ICON_VISIBILITY}
						</span>
						<span class="title">
							{nl_keys} viewing key{1 === nl_keys? '': 's'} shared with app
						</span>
					</div>
					<hr>
				{/await}

				{#await Secrets.filter({
					type: 'query_permit',
					on: 1,
					owner: $yw_owner,
					chain: $yw_chain_ref,
					outlets: [p_app],
				}) then a_permits}
					{@const nl_permits = a_permits.length}
					<div class="global_header-overlay-overview permits">
						<span class="global_svg-icon icon-diameter_16px">
							{@html SX_ICON_CONFIRMATION}
						</span>
						<span class="title">
							{nl_permits} query permit{1 === nl_permits? '': 's'} in use
						</span>
					</div>
					<hr>
				{/await}
			{/if}
		{/if}
	</div>
</div>
