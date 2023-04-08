<script lang="ts">	
	import {createEventDispatcher, onMount} from 'svelte';
	
	import {load_page_context} from '../svelte';
	
	import {
		yw_blur,
		yw_curtain,
		yw_nav_visible,
		yw_overscroll_pct,
		yw_progress,
	} from '#/app/mem';

	export let nav = false;
	const b_nav = nav;

	export let debug = '';
	export let progress: null | [number, number] = null;
	export let full = false;
	export let keyed = false;
	export let classNames = '';

	
	const {
		k_page,
	} = load_page_context();

	export let leaves = false;
	export let swipes = false;
	export let root = 0 === k_page.index;
	export let slides = !leaves && !swipes && !root;
	const b_slides = slides;

	export let form = false;
	const b_form = !!form;

	export let transparent = false;

	let dm_screen: HTMLElement;

	const si_exit = leaves? 'leaves': swipes? 'swipes': '';

	const dispatch = createEventDispatcher();
	onMount(() => {
		if(progress) $yw_progress = progress;

		if(!k_page) {
			console.warn(`${debug || 'unknown'} Screen missing page context`);
		}
		else {
			// listen for page events
			k_page.on({
				// on page focus
				focus() {
					// set or remove progress
					$yw_progress = progress || [0, 0];

					// set nav visibility
					$yw_nav_visible = b_nav;
				},

				// // on page blur
				// blur() {
				// 	// remove progress
				// 	if(progress) $yw_progress = [0, 0];
				// },
			});
		}

		dispatch('dom', dm_screen);

		// weighted moving average
		const a_times_wheel: number[] = [Date.now()];
		const a_deltas_wheel: number[] = [0];

		const XT_OVERSCROLL_WINDOW = 200;
		const XL_OVERSCROLL_HEIGHT = 40;

		// TODO: work on making these physics better
		// scrolling
		dm_screen.addEventListener('wheel', (de_wheel) => {
			// overscroll
			if(0 === dm_screen.scrollTop) {
				if(de_wheel.DOM_DELTA_PIXEL === de_wheel.deltaMode && de_wheel.deltaY < 0) {
					const xl_dy = Math.min(Math.abs(de_wheel.deltaY), XL_OVERSCROLL_HEIGHT);

					const xt_now = Date.now();

					// find the oldest event from the back
					for(let i_event=a_times_wheel.length-1; i_event>=0; i_event--) {
						const xt_age = xt_now - a_times_wheel[i_event];

						if(xt_age > XT_OVERSCROLL_WINDOW) {
							a_times_wheel.pop();
							a_deltas_wheel.pop();
						}
					}

					a_times_wheel.unshift(xt_now);
					a_deltas_wheel.unshift(xl_dy);

					let xl_sum = 0;

					for(let i_event=0, nl_events=a_times_wheel.length; i_event<nl_events; i_event++) {
						const xt_event = a_times_wheel[i_event];
						const xt_age = xt_now - xt_event;

						const xs_age = (1 - (xt_age / XT_OVERSCROLL_WINDOW)) / nl_events;
						// const xs_index = 1 - ((i_event+1) / nl_events);

						const xl_dy_event = a_deltas_wheel[i_event];

						const xl_weighted = xl_dy_event * xs_age;

						xl_sum += xl_weighted;
					}

					const x_result = xl_sum;
					$yw_overscroll_pct = x_result / 20;

					setTimeout(() => {
						if(Date.now() - a_times_wheel[0] > XT_OVERSCROLL_WINDOW) {
							$yw_overscroll_pct = 0;
						}
					}, XT_OVERSCROLL_WINDOW);

					// console.log({
					// 	deltaY: de_wheel.deltaY,
					// 	// wheelDeltaY: de_wheel.wheelDeltaY,
					// 	screenY: de_wheel.screenY,
					// 	mode: de_wheel.deltaMode,
					// });

					// console.log(x_result);
				}
			}
		});

		// if screen has keyed svelte components
		if(keyed) {
			let x_scroll_top = 0;

			// svelte will replace those elements when changing screens
			(new MutationObserver(async(a_mutations) => {
				// keyed component was removed
				if(a_mutations[0]?.addedNodes.length) {
					try {
						x_scroll_top = dm_screen.scrollTop;
					}
					catch(e_null) {}
				}
				// keyed component was restored
				else if(a_mutations[0]?.removedNodes.length) {
					if(dm_screen) {
						dm_screen.scrollTop = x_scroll_top;
					}
				}
			})).observe(dm_screen, {
				childList: true,
			});
		}
	});

	export let style = '';
</script>

<style lang="less">
	@import '../_base.less';

	div.bounds {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;

		// this was previously part of the form, move it out so that form children can use full relative height
		overflow: hidden;
		&.scroll {
			overflow-y: scroll;
			overscroll-behavior-y: contain;
			.hide-scrollbar();

			&.curtained {
				overflow-y: hidden;
			}
		}
	}

	.slides {
		transform: translateX(calc(var(--app-window-width) / 2));
		transition: transform 0.6s var(--ease-out-quick);
	}

	@media(prefers-reduced-motion) {
		.slides {
			transition: none 0s linear;
		}
	}

	section.screen,form.screen {
		position: relative;
		max-width: var(--app-max-width);
		top: 0;
		left: 0;

		box-sizing: border-box;

		width: 100%;
		height: auto;

		min-height: 100%;

		.font(regular);

		:where(&) {
			background: var(--theme-color-bg);
			background: radial-gradient(circle, rgb(15,19,23) 80%, rgb(1,8,15) 106%);
		}

		opacity: 1;
		filter: blur(0);

		&.transparent {
			background-color: transparent;
		}

		&.progress {
			padding-top: 22px;
		}

		&.nav {
			padding-bottom: 71px;
		}

		&.flex {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: var(--gap, var(--ui-padding));

			:global(:where(&)>:first-child:not(.no-margin)) {
				margin-top: var(--ui-padding);
			}
			// >:first-child:not(.no-margin) {
			// 	:global(:where(&)) {
			// 		margin-top: var(--ui-padding);
			// 	}
			// }

			&>* {
				:global(:where(&:not(.no-flex))) {
					flex: 0;
				}

				:global(&.flex_0) {
					flex: 0;
				}

				:global(&.flex_1) {
					flex: 1;
				}

				:global(:where(&:not(.no-margin))) {
					margin: 0 var(--ui-padding);
				}
			}
		}

		&.slid {
			transition: transform 0.5s var(--ease-out-cubic);
		}

		&[data-s2-exit]:not([data-s2-exit='']) {
			:global(&) {
				// left: 0;
				transform: translateX(0px);
				transition: transform 0.5s var(--ease-out-quint);
			}
		}

		@keyframes fade-away {
			0% {
				opacity: 1;
			}

			75% {
				opacity: 0;
			}

			100% {
				opacity: 0;
			}
		}

		@keyframes blur-away {
			0% {
				filter: blur(0);
			}

			100% {
				filter: blur(14px);
			}
		}

		@keyframes scale-up {
			0% {
				transform: scale(1);
			}

			100% {
				transform: scale(1.75);
			}
		}

		@keyframes turn-away {
			0% {
				transform: perspective(0px) rotateY(0deg);
			}

			1% {
				transform: perspective(1500px) rotateY(0deg);
			}

			100% {
				transform: perspective(1500px) rotateY(-80deg);
			}
		}

		@keyframes fade-out {
			0% {
				opacity: 1;
			}

			10% {
				opacity: 1;
			}

			80% {
				opacity: 0;
			}

			100% {
				opacity: 0;
			}
		}

		&.sublimate {
			transition: opacity 400ms var(--ease-out-quad);
			opacity: 0;
		}

		&.materialize {

		}

		>*:not(.no-blur) {
			:global(&) {
				transition: filter 400ms var(--ease-out-cubic);
			}
		}

		&.blur {
			>*:not(.no-blur) {
				:global(&) {
					filter: blur(2px);
				}
			}
		}


		/*
			Copied from screen.less
		*/
		* {
			:where(&:not([class^="font-variant"])) {
				:global(&) {
					font-family: inherit;
					user-select: none;
				}
			}
		}

	}
</style>


<div class="bounds"
	class:slides={b_slides}
	class:scroll={true}
>
	<form
		class="screen {classNames}"
		class:flex={true}
		class:nav={b_nav}
		class:progress={progress}
		class:transparent={transparent}
		class:sublimate={false}
		class:blur={$yw_blur}
		class:curtained={$yw_curtain}
		data-s2-exit={si_exit}
		bind:this={dm_screen}
		on:submit|preventDefault={() => false}
		on:submit
		style="{style}"
		autocomplete="off"
	>
		<slot></slot>
	</form>
</div>
