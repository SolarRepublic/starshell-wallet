<script lang="ts">	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {G_APP_STARSHELL} from '#/store/apps';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	import SX_ICON_ERROR from '#/icon/error.svg?raw';
	

	// flow complete callback
	const {
		completed,
	} = load_flow_context<undefined>();

	function close() {
		b_disabled = true;

		// complete callback
		completed(false);
	}

	let b_disabled = false;

	function restart() {
		b_disabled = true;

		chrome.runtime?.reload?.();

		// complete callback
		completed(true);
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
	<AppBanner app={G_APP_STARSHELL} on:close={() => close()}>
		<span style="display:contents" slot="default">
			<span class="global_svg-icon icon-diameter_16px color_caution" style="margin-right:0.2em;">
				{@html SX_ICON_ERROR}
			</span>
			<span>
				Background Service Unresponsive
			</span>
		</span>
		<span style="display:contents" slot="context">
			<p>
				Something caused the wallet's background service to hang or quit.
			</p>
			<p>
				Apps will not be able to connect to your wallet until the service is back online.
			</p>
			<p>
				You will have to log in again after restarting.
			</p>
		</span>
	</AppBanner>

	<hr class="no-margin">

	<div class="flex_1" />

	<ActionsWall>
		<button disabled={b_disabled} on:click={() => close()}>Don't Restart</button>
		<button disabled={b_disabled} class="primary" on:click={() => restart()}>Restart</button>
	</ActionsWall>
</Screen>
