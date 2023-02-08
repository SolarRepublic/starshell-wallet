<script lang="ts">

	import type {WebKitMessenger} from '#/script/webkit-polyfill';
	
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_LOADING from '#/icon/loading.svg?raw';
	import SX_ICON_LOCK from '#/icon/lock.svg?raw';
	import SX_ICON_DOTS from '#/icon/more-vert.svg?raw';
	import SX_ICON_RELOAD from '#/icon/reload-thin.svg?raw';
	import SX_ICON_WARNING from '#/icon/warning.svg?raw';

	const p_url = 'https://m.s2r.sh/#caip-10:cosmos:secret-4:secret1asuv';

	const s_app_title = 'StarShell Sharing: Private Data Sharing';

	$: d_url = new URL(p_url);
	$: s_protocol = d_url.protocol.replace(/:$/, '');
	$: s_host = d_url.host;

	const k_dapp = globalThis['navigation_handler'] as WebKitMessenger<'navigation'>;

	async function location_click() {
		await k_dapp.post({
			type: 'mode',
			value: 'expanded',
		});
	}
</script>

<style lang="less">
	@import '../_base.less';

	:global(html) {
		width: 100%;
		max-width: 100%;
		height: 100%;
	}

	:global(body) {
		overflow: hidden;
	}

	main {
		display: flex;
		width: 100%;
		height: 100%;
		justify-content: space-around;
		align-items: center;

		font-size: 16px;

		>* {
			padding: 0;
			padding-left: 3.5%;
			margin-right: 3.5%;

			height: 100%;
			display: flex;
			align-items: center;
			gap: 8px;

			&:nth-child(n+2) {
				border-left: 1px solid var(--theme-color-border);
			}
		}

		>.center {
			flex: 1;
			overflow: hidden;
			white-space: pre;
			line-height: 1em;

			padding-left: calc(1% + 8px);
			margin-right: calc(1% + 8px);

			>.location {
				flex: 1;
				overflow: hidden;

				display: flex;
				flex-direction: column;

				>.title {
					color: var(--theme-color-text-med);
					font-size: 13px;
					font-weight: 300;
				}
			}

			>.action {
				background-color: black;
				border-radius: 8px;
				padding: 3px;
				border: 1px solid var(--theme-color-border);
				line-height: 0;
			}
		}
	}
</style>

<main class="navigation">
	<span class="close global_svg-icon icon-diameter_36px"
	>
		{@html SX_ICON_CLOSE}
	</span>

	<span class="center">
		<span class="global_svg-icon icon-diameter_28px">
			{#if 'https' === s_protocol}
				{@html SX_ICON_LOCK}
			{:else}
				{@html SX_ICON_WARNING}
			{/if}
		</span>

		<span class="location" on:click={location_click}>
			<div class="host">
				{s_host}
			</div>

			<div class="title">
				{s_app_title}
			</div>
		</span>

		<span class="action">
			<img width="32"
				alt="Wallet action"
				src="/media/vendor/icon_32.png"
				srcset="/media/vendor/icon_64.png 2x"
			>
		</span>
	</span>

	<span class="reload global_svg-icon icon-diameter_36px"
	>
		{@html SX_ICON_RELOAD}
	</span>
</main>