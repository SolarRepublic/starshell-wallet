<script lang="ts">
	import {
		yw_navigator,
		yw_overscroll_pct,
		yw_search,
	} from '##/mem';

	let dm_overscroll: SVGSVGElement;

	let dm_progress: SVGCircleElement;

	export let progress = 0;

	export let position = 0;

	let x_overscroll = 0;

	let b_fired = false;

	// $: {
	// 	if(dm_overscroll && !$yw_search && !b_fired) {
	// 		if($yw_overscroll_pct > 0.9) {
	// 			void $yw_navigator.activePage.fire('search');
	// 			dm_overscroll.style.transition = `transform 250ms linear`;
	// 			dm_overscroll.style.transform = `translateY(0px)`;
	// 			b_fired = true;
	// 			setTimeout(() => {
	// 				b_fired = false;
	// 				dm_overscroll.style.transition = `transform 10ms linear`;
	// 			}, 2e3);
	// 		}
	// 		else {
	// 			x_overscroll = $yw_overscroll_pct;
	// 			dm_overscroll.style.transform = `translateY(${x_overscroll * 70}px)`;
	// 		}
	// 	}
	// }
</script>


<style lang="less">
	svg {
		// display: none;
		z-index: 20001;
		position: absolute;
		// top: 10px;
		top: -32px;
		left: calc(50% - 16px);
		transform: translateY(0px);
		transition: transform 10ms linear;

		.progress {
			stroke-dasharray: 62;
			stroke-dashoffset: 62;
			stroke-linecap: round;
			transition: stroke-dasharray 100ms linear;
		}
	}
</style>


<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" class="overscroll"
	bind:this={dm_overscroll}
	style={`transform: translateY(${position}px);`}
>
	<style lang="less">
		.overscroll {
			.bg {
				fill: var(--theme-color-text-light);
			}
			
			.ring {
				fill: transparent;
				stroke: #c4c4c4;
			}

			.progress {
				fill: transparent;
				stroke: black;
			}
		}
	</style>

	<circle cx="16" cy="16" r="16" class="bg" />

	<circle cx="16" cy="16" r="10" class="ring" stroke-width="3" style="opacity:0.2;" />

	<circle cx="16" cy="16" r="10" class="progress" stroke-width="3" style="stroke-dashoffset:{62 - (x_overscroll * 62)}" bind:this={dm_progress} />
</svg>