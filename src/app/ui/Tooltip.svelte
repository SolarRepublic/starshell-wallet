<script lang="ts">
	import {quintOut} from 'svelte/easing';
	import {fade} from 'svelte/transition';

	import {yw_curtain} from '../mem';
	
	import {qs} from '#/util/dom';
	
	import SX_ICON_INFO from '#/icon/info.svg?raw';

	const B_DEBUG_TOOLTIP_LEFT = true;

	export let showing = false;

	$: $yw_curtain = showing;

	let x_left_overlay = 0;

	let dm_tooltip!: HTMLElement;

	// automatically re-center
	$: if(showing) {
		queueMicrotask(() => {
			const dm_overlay = qs(dm_tooltip, '.tooltip-overlay')!;
	
			const xl_width_overlay = dm_overlay.getBoundingClientRect().width;
	
			const xl_x_toooltip = dm_overlay.closest('.tooltip')!.getBoundingClientRect().x;
	
			const xl_width_viewport = dm_overlay.closest('main.viewport')!.getBoundingClientRect().width;
	
			x_left_overlay = ((xl_width_viewport - xl_width_overlay) / 2) - xl_x_toooltip;
		});
	}
</script>

<style lang="less">
	@import '../_base.less';

	.tooltip {
		position: relative;
		vertical-align: text-bottom;
		z-index: 15;

		.global_svg-icon {
			color: var(--theme-color-primary);
			cursor: pointer;

			&.showing {
				background-color: black;
				border-radius: 4px;
				box-shadow: 0 0 13px 7px balck;
			}
		}

		.tooltip-overlay {
			background-color: fade(black, 82%);
			border-radius: 12px;
			padding: 1.25em 1.5em;

			box-shadow: 0px 1px 22px 1px fade(@theme-color-yellow, 17%);
			border: 1px solid fade(@theme-color-yellow, 17%);

			position: absolute;
			top: 28px;
			width: min(75vw, calc(0.75 * min(var(--app-window-width), var(--app-max-width))));
			max-width: calc(0.85 * var(--app-max-width));
			font-size: 13px;
			text-align: left;
		}

		.overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background-color: fade(black, 20%);
		}
	}

</style>

<span class="tooltip" bind:this={dm_tooltip}>
	<span class="global_svg-icon icon-diameter_20px" on:click={() => showing = !showing} class:highlight={showing}>
		{@html SX_ICON_INFO}
	</span>

	{#if showing}
		<div class="tooltip-overlay" style={x_left_overlay >= 0 || B_DEBUG_TOOLTIP_LEFT? `
			left: ${x_left_overlay}px;
		`: ''} transition:fade={{duration:300, easing:quintOut}}>
			<slot />
		</div>
	{/if}
</span>
