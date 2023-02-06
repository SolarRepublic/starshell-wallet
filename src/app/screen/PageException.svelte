<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {PageInfo} from '#/script/messages';
	
	import ActionsWall from '../ui/ActionsWall.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	
	import SX_ICON_ERROR from '#/icon/error.svg?raw';
	
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
	 * Details about the exception
	 */
	export let report: string;

	// destructure page
	const {
		tabId: i_tab,
		href: p_href,
	} = page;

	// reload the requesting page
	function acknowledge() {
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
			<span class="global_svg-icon icon-diameter_18px color_caution" style="margin-right:0.2em;">
				{@html SX_ICON_ERROR}
			</span>
			<span>
				App Misused Keplr API
			</span>
		</span>
		<span style="display:contents" slot="context">

		</span>
	</AppBanner>

	<hr class="no-margin">

	<div class="flex_1">
		<p>
			StarShell prevented this app from misusing the Keplr API in a way that would produce incorrect transaction data,
			potentially leading to a loss of funds or degradation of privacy.
		</p>

		<p>
			While the Keplr wallet itself might not prevent this misuse, it does so incorrectly and at the harm of its users.
		</p>

		<p>
			It is recommended that you stop using this app immediately, report this error, and wait until the issues are resolved.
		</p>

		<code>
			{report}
		</code>
	<div class="flex_1">

	<ActionsWall>
		<button class="primary" on:click={() => acknowledge()}>Acknowledge</button>
	</ActionsWall>
</Screen>
