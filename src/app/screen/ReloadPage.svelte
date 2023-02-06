<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {PageInfo} from '#/script/messages';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	import SX_ICON_CHECK from '#/icon/tiny-check.svg?raw';
	

	// flow complete callback
	const {
		completed,
	} = load_flow_context<undefined>();

	/**
	 * The app in question
	 */
	export let app: AppStruct;

	/**
	 * Struct with info about requesting web page tab
	 */
	export let page: PageInfo;
	
	/**
	 * Struct with info about requesting web page tab
	 */
	export let preset: string;

	// destructure page
	const {
		tabId: i_tab,
		href: p_href,
	} = page;

	// complete flow
	let b_closed = false;
	function close() {
		// already closed; do not fire again
		if(b_closed) return;

		// do not fire again
		b_closed = true;

		// unregister tab update listener
		chrome.tabs.onUpdated.removeListener(listen_tab_update);

		// complete callback
		completed(true);
	}

	// filter update events for the interested tab
	function listen_tab_update(i_updated, g_change) {
		if(i_updated === i_tab && (g_change.status || g_change.url)) {
			close();
		}
	}

	// listen for tab update events
	chrome.tabs.onUpdated.addListener(listen_tab_update);

	// reload the requesting page
	async function reload_page() {
		// reload the tab
		await chrome.tabs.reload(i_tab);

		// complete flow
		close();
	}
</script>

<style lang="less">
	.summary {
		margin: var(--ui-padding) calc(2 * var(--ui-padding));

		.name {
			color: var(--theme-color-blue);
			font-weight: 500;
		}
	}
</style>

<Screen>
	<AppBanner app={app} on:close={() => close()}>
		<span style="display:contents" slot="default">
			{#if 'keplr' === preset}
				<span class="global_svg-icon icon-diameter_12px" style="margin-right:0.2em;">
					{@html SX_ICON_CHECK}
				</span>
				<span>
					Enabled Keplr API for this app
				</span>
			{:else}
				Page must reload before it<br>
				can connect to StarShell
			{/if}
		</span>
		<span style="display:contents" slot="context">
			{#if 'keplr' === preset}
				Page must reload before it can connect to StarShell
			{/if}
		</span>
	</AppBanner>

	<hr class="no-margin">

	<div class="flex_1"></div>

	<ActionsWall>
		<button on:click={() => close()}>Don't Reload</button>
		<button class="primary" on:click={() => reload_page()}>Reload</button>
	</ActionsWall>
</Screen>
