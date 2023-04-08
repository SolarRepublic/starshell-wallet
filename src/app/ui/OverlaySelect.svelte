<script lang="ts">
	import {yw_blur} from '##/mem';
	
	import type {Status} from '../frag/AppContext.svelte';
	import {H_LOCALIZATION} from '../frag/AppContext.svelte';
	
	import SX_ICON_ADD_SMALL from '#/icon/add-small.svg?raw';
	
	export let title: string;
	export let open = true;

	export let status: Status | null = null;

	export let s_secondary_title = '';

	$: $yw_blur = open;

	let b_showing = false;
	setTimeout(() => {
		b_showing = true;
	}, 10);

	function pause(dm: HTMLElement, gc?: any) {
		return {
			duration: 200,
		};
	}

</script>

<style lang="less">
	@import '../_base.less';

	.cancel {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: transparent;
		z-index: 5000;

		&.showing {
			>.overlay {
				opacity: 1;
				// height: auto;
				height: 320px;

				max-height: 320px;
			}
		}

		.overlay {
			position: absolute;
			top: 4em;
			right: 20px;
			z-index: 1000;
			width: 300px;
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
			opacity: 0.25;
			transition: opacity 200ms linear, height 250ms var(--ease-out-expo);
			height: 0;

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
	}

	.secondary-group {
		text-align: center;
		margin: 1em;
	}
</style>

<div class="cancel"
	class:showing={b_showing}
	on:click={() => {
		b_showing = false;
		open = false;
	}}
>
	<div class="overlay select" out:pause>
		<div class="top">
			<h3>
				{title}
			</h3>
<!-- 
			<button class="pill add-new">
				<span class="icon">
					{@html SX_ICON_ADD_SMALL}
				</span>

				<span class="text">
					Add New
				</span>
			</button> -->

			{#if status}
				<span class={`status ${status}`}>
					{H_LOCALIZATION[status].text}
				</span>
			{/if}
		</div>

		<div class="rows">
			<slot name="rows"></slot>
		</div>

		{#if $$slots.secondary_rows}
			<div class="secondary-group">
				<span>
					↓&nbsp;&nbsp;&nbsp;{s_secondary_title || 'OTHER'}&nbsp;&nbsp;&nbsp;↓
				</span>
			</div>

			<div class="rows">
				<slot name="secondary_rows"></slot>
			</div>
		{/if}
	</div>
</div>