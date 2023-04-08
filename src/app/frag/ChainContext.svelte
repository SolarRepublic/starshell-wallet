<script lang="ts">	
	import type {ChainPath} from '#/meta/chain';

	import {createEventDispatcher} from 'svelte';

	import {B_IOS_WEBKIT} from '#/share/constants';
	import {Chains} from '#/store/chains';

	import PfpDisplay from './PfpDisplay.svelte';
	import Row from '../ui/Row.svelte';

	const dispatch = createEventDispatcher();

	export let chains: ChainPath[];
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

<div class="overlay select">
	<div class="top">
		<h3>
			Chain Connections
		</h3>
	</div>

	<div class="rows">
		{#await Chains.read()}
			...
		{:then ks_chains}
			{#each ks_chains.entries().filter(([p]) => chains.includes(p)) as [p_chain, g_chain]}
				<Row
					resource={g_chain}
					resourcePath={p_chain}
					detail={g_chain.reference}
					on:click={() => {
						if(B_IOS_WEBKIT) return;
					}}
				>
					<!-- <svelte:fragment slot="right">
						{#if $yw_account_ref === p_chain}
							<span class="overlay-select icon" style="--icon-color: var(--theme-color-primary);">
								{@html SX_ICON_CHECKED}
							</span>
						{/if}
					</svelte:fragment> -->

					<svelte:fragment slot="icon">
						<PfpDisplay dim={32} resource={g_chain} />
					</svelte:fragment>
				</Row>
			{/each}
		{/await}
	</div>
</div>
