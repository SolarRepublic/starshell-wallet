<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	import type {ChainStruct} from '#/meta/chain';
	
	import {createEventDispatcher} from 'svelte';
	
	import {yw_account, yw_chain} from '../mem';
	
	import {text_to_base64} from '#/util/data';
	
	import PfpDisplay from './PfpDisplay.svelte';
	import Close from '../ui/Close.svelte';
	import Fields from '../ui/Fields.svelte';

	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
	
	
	export let app: AppStruct;

	export let chains: ChainStruct[] = [];

	export let account: AccountStruct | null = null;

	export let embedded = false;

	export let closeable = !embedded;

	export let rootStyle = '';

	export let sx_cluster_style = '';

	let b_view_mode_detailed = false;

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

<style lang="less">
	@import '../_base.less';

	.column {
		display: flex;
		flex-flow: column;
		align-items: center;
		justify-content: center;
	}

	.app-info {
		// overflow: hidden;  // hiding overflow creates problem for tooltip
		position: relative;
		margin-bottom: calc(0px - var(--ui-padding));

		&.embedded {
			margin-bottom: 0;

			>.view-controls {
				position: absolute;
				right: 0;
				margin: 0 var(--ui-padding);

				top: unset;
				bottom: var(--ui-padding);
			}

			>.banner-view {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				transform: translateX(0%);
				transition: transform 1s var(--ease-out-quick);

				.content.column {
					border: none;
				}
			}

			&.view-mode_detailed {
				>.view-controls {
					top: 0;
				}

				>.banner-view {
					transform: translateX(-100%);
				}
			}
		}

		>.banner-view {
			.view-controls {
				position: absolute;
				z-index: 1;
				top: 110px;
				right: var(--ui-padding);

				>.show-details {
					transform: rotate(-90deg);
					color: var(--theme-color-primary);
					padding: 8px;
				}
			}

			.info-cluster {
				position: relative;
				background-color: var(--theme-color-black);
			}

			.aura {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background-color: black;

				img {
					object-fit: cover;
					width: 100%;
					height: 100%;
					opacity: 0.66;
				}
			}

			.content {
				position: relative;
				gap: 8px;
				padding: calc(1.75 * var(--ui-padding));
				padding-bottom: calc(1.25 * var(--ui-padding));
				border-bottom: 1px solid fade(black, 80%);
			}

			.bubbles {
				display: flex;
				flex-flow: row-reverse;
				position: relative;

				// safari fix
				height: 72px;

				// helps center the display on safari
				margin-left: auto;
				margin-right: auto;

				.context {
					position: relative;
					display: flex;
					align-items: center;
					aspect-ratio: 1;
					padding: 16px;
					border-radius: 51%;
					border: 1px solid transparent;
					background-color: fade(black, 63%);
					z-index: 2;

					&.overlap {
						margin-left: -10px;
					}

					&.thru {
						border: none;
						margin-left: 1em;
						margin-right: 1em;
						background-color: transparent;

						// safari fix
						height: auto;

						&::before {
							border: none !important;
						}
					}

					&::before {
						content: "\a0";

						// safari has trouble with 100%, use hard-coded, precomputed dimensinos
						width: 72px;
						height: 72px;

						position: absolute;
						// offset for the 1px transparent border set in non-pseudo element
						left: -1px;
						top: -1px;
						border-radius: 50%;
						border: 1px solid white;
						opacity: 0.2;
					}
				}

				.thru-line {
					border-top: 2px dotted var(--theme-color-border);
					content: "\a0";
					width: calc(100% - 60px);
					position: absolute;
					top: calc(50% - 1px);
					left: 30px;
					z-index: 1;
				}
			}

			.host {
				padding: 5px 12px;
				border-radius: 8px;
				// background-color: fade(black, 20%);
				// border: 1px solid black;

				.name {
					.font(tiny);
					color: var(--theme-color-graymed);
				}
			}
		}
	
		.request-summary {
			text-align: center;
			margin: calc(0.5 * var(--ui-padding)) calc(2 * var(--ui-padding));

			.name {
				color: var(--theme-color-blue);
				font-weight: 500;
			}

			.context {
				.font(tiny);
				color: var(--theme-color-text-med);
			}
		}

		>.detail-view {
			top: 0;
			left: 0;
			width: 100%;
			padding: 0 var(--ui-padding);
			box-sizing: border-box;

			.view-controls {
				position: absolute;
				top: 0;
				right: 0;
				margin: 0 var(--ui-padding);
			}
		}
	}
</style>

<div class="app-info no-margin"
	class:embedded={embedded}
	class:view-mode_detailed={b_view_mode_detailed}
	style={rootStyle}
>
	{#if embedded}
		<div class="detail-view">
			<Fields noHrs
				configs={[
					{
						type: 'resource',
						resourceType: 'app',
						struct: app,
					},
					{
						type: 'group',
						flex: true,
						fields: [
							{
								type: 'resource',
								resourceType: 'account',
								struct: account || $yw_account,
							},
							{
								type: 'resource',
								resourceType: 'chain',
								struct: chains[0] || $yw_chain,
							},
						],
					},
				]}
			/>

			<div class="view-controls">
				<button class="pill" on:click={() => b_view_mode_detailed = false}>
					Hide Details
				</button>
			</div>
		</div>
	{/if}

	<div class="banner-view">
		<div class="info-cluster" style={sx_cluster_style}>
			{#if account?.extra?.aura}
				<div class="aura">
					<!-- svelte-ignore a11y-missing-attribute -->
					<img src={`data:image/svg+xml;base64,${text_to_base64(account.extra?.aura || '')}`}>
				</div>
			{/if}

			<div class="content column">

				<div class="bubbles">
					{#if chains?.length}
						{#if account}
							<span class="context">
								{#if 1 === chains.length}
									<PfpDisplay dim={40} resource={chains[0]} />
								{:else}
									{#each chains as g_chain, i_chain}
										<PfpDisplay dim={32 - (i_chain * 4)} resource={g_chain} />
									{/each}
								{/if}
							</span>
							<span class="context thru">
								<PfpDisplay dim={40} resource={account} rootStyle='border:1px solid rgba(255,255,255,0.08); border-radius:9px;' />
							</span>
							<span class="context">
								<PfpDisplay dim={40} resource={app} />
							</span>
							<span class="thru-line">&nbsp;</span>
						{:else}
							<span class="context overlap">
								{#if 1 === chains.length}
									<PfpDisplay dim={40} resource={chains[0]} />
								{:else}
									{#each chains as g_chain, i_chain}
										<PfpDisplay dim={32 - (i_chain * 4)} resource={g_chain} />
									{/each}
								{/if}
							</span>
							<span class="context underlap">
								<PfpDisplay dim={40} resource={app} />
							</span>
						{/if}
					{:else if account}
						<span class="context overlap">
							<PfpDisplay dim={40} resource={account} />
						</span>
						<span class="context underlap">
							<PfpDisplay dim={40} resource={app} />
						</span>
					{:else}
						<span class="context">
							<PfpDisplay dim={40} resource={app} />
						</span>
					{/if}
				</div>

				<div class="host column">
					<span class="origin">
						{app.host}
					</span>
					<span class="name">
						{#if chains?.length}
							{chains.map(g => g?.name || '').join(', ')}
						{:else if account}
							{account.name}
						{:else}
							{app.name}
						{/if}
					</span>
				</div>

				{#if closeable}
					<Close absolute bgColor='#000000' on:click={() => close()} />
				{/if}
			</div>
		</div>

		{#if $$slots.default}
			<div class="request-summary no-margin">
				<slot />

				{#if $$slots.context}
					<div class="context no-margin">
						<slot name="context" />
					</div>
				{/if}
			</div>
		{/if}

		{#if embedded}
			<div class="view-controls">
				<span class="global_svg-icon icon-diameter_20px show-details" on:click={() => b_view_mode_detailed = true}>
					{@html SX_ICON_EXPAND}
				</span>
			</div>
		{/if}
	</div>
</div>