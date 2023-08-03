<script lang="ts">
	import type {Dict, PlainObject} from '#/meta/belt';
	
	import {
		getAllContexts,
		onMount,
		tick,
	} from 'svelte';
	
	import {Gestures} from '../helper/gestures';
	import {await_transition, GC_HOOKS_DEFAULT, page_slide} from '../nav/defaults';
	import {initialize_mem} from '../svelte';
	
	import {Vault} from '#/crypto/vault';
	import {
		oderom,
		remove,
	} from '#/util/belt';
	
	import {H_THREADS, ThreadId} from '##/def';
	import {
		yw_navigator,
		yw_page,
		yw_thread,
	} from '##/mem';
	import {Navigator, type NavigatorConfig} from '##/nav/navigator';
	import type {PageConfig} from '##/nav/page';
	import BlankSvelte from '##/screen/Blank.svelte';
	
	import NavSvelte from './system/Nav.svelte';
	import NotificationsSvelte from './system/Notifications.svelte';
	import OverscrollSvelte from './system/Overscroll.svelte';
	import PopupSvelte from './system/Popup.svelte';
	import ProgressSvelte from './system/Progress.svelte';
	import SearchSvelte from './system/Search.svelte';
	import SideMenuSvelte from './system/SideMenu.svelte';
	import VendorMenuSvelte from './system/VendorMenu.svelte';
	
	

	export let page: PageConfig;
	const gc_page = page;

	export let mode: 'app' | 'flow';
	const b_flow = 'flow' === mode;
	const b_main = 'app' === mode;

	let dm_viewport: HTMLElement;
	let dm_threads: HTMLElement;
	let dm_content: HTMLElement;
	let dm_exitting: HTMLElement;

	// get all contexts
	const h_context_all: Dict<any> = Object.fromEntries(getAllContexts().entries());


	onMount(async() => {
		// track thread switching history
		const a_switches: ThreadId[] = [];

		// navigator config
		const gc_navigator: NavigatorConfig = {
			// threads container
			container: dm_threads,

			// forward all contexts
			context: h_context_all,

			// default threads config
			threads: {
				default: () => ({
					creator: BlankSvelte,
				}),
			},

			// default hooks
			hooks: {
				...GC_HOOKS_DEFAULT,

				async before_switch() {
					await initialize_mem(h_context_all);

					// only needs to happen once
					delete this.before_switch;
				},

				// upon any page change
				after_change(kt_context, kp_src, kp_dst, s_transition, h_extra={}) {
					// set global page and thread
					$yw_page = kp_dst;
					$yw_thread = kt_context;

					// notify dst page
					void kp_dst.fire('focus');

					// // maintain scrollTop of the src page
					// const x_scroll_top = kp_src.dom.scrollTop;

					// thread was created by transferring search result pages
					if(ThreadId.SCRATCH === kt_context.id) {
						// reached bottom of scratch thread history
						if('pop' === s_transition && 1 === kt_context.history.length) {
							// await for pop transition to complete
							void await_transition(kp_src!.dom, 500).then(() => {
								// remove scratch thread from switch history
								const i_scratch = a_switches.indexOf(ThreadId.SCRATCH);
								if(i_scratch) a_switches.splice(i_scratch, 1);

								// go back to previous thread
								void $yw_navigator.activateThread(a_switches.at(-1)!);
							});
						}
					}
				},

				// upon thread switch
				async after_switch(kt_src, kt_dst) {
					// set global page and thread
					$yw_page = kt_dst.page;
					$yw_thread = kt_dst;

					// focus on page
					void kt_dst.page.fire('focus');

					// wait for svelte to render component before querying container
					await tick();

					// record switch
					remove(a_switches, kt_dst.id);
					a_switches.push(kt_dst.id);

					// query container for last element child
					await page_slide(kt_dst.page.dom, true);
				},
			},
		};

		// prep spawner to pass props and context to default page
		const f_spawner = (h_props: PlainObject, h_context?: PlainObject) => ({
			...gc_page,
			props: {
				...gc_page.props,
				...h_props,
			},
			context: {
				...gc_page.context,
				...h_context,
			},
		});

		// specific page given
		if(b_flow) {
			// override threads config
			gc_navigator.threads = {
				default: f_spawner,
			};

			// initialize mem
			await initialize_mem(h_context_all);
		}
		// main system
		else if(b_main) {
			// override threads config
			gc_navigator.threads = oderom(H_THREADS, (si_thread, dc_screen) =>
				// // lookup router node corresponding to screen class
				// const k_node = K_ROUTER.lookup_screen(dc_screen);
	
				// // ref path pattern
				// const sx_pattern = k_node.path_pattern;
	
				({
					[si_thread]: (h_props: PlainObject) => ({
						creator: dc_screen,
						props: h_props,
						// path: k_node.reverse_resolve(h_props),
						// pattern: sx_pattern,
						// screen: dc_screen,
					}),
				} as Record<typeof si_thread, (h_props: PlainObject) => PageConfig>)
			);

			// set init
			gc_navigator.threads.init = f_spawner;
		}

		const k_navigator = new Navigator(gc_navigator);
		$yw_navigator = k_navigator;

		let xl_dx_tracking = 0;

		// gestures
		Gestures.swipe_right<{
			dom: HTMLElement;
		}>({
			init() {
				if($yw_navigator.activeThread.history.length > 1) {
					// ref page dom
					const dm_page = $yw_navigator.activePage.dom;

					// temporarily disable its transition
					dm_page.style.transition = 'unset';

					return {
						dom: dm_page,
					};
				}
			},

			move(xl_dx, g_context) {
				g_context.dom.style.transform = `translateX(${xl_dx}px)`;
				xl_dx_tracking = xl_dx;
			},

			release(g_context) {
				const xl_width = visualViewport?.width || window.innerWidth;

				// ref style
				const g_style = g_context.dom.style;

				// remove temporary 'unset' transition style property
				g_context.dom.style.removeProperty('transition');

				// cleared threshold for pop
				if(xl_dx_tracking > 0.45 * xl_width) {
					g_style.transform = `translateX(${xl_width})`;

					// pop page
					$yw_navigator.activePage.pop();
				}
				// did not clear threshold
				else {
					g_style.transform = `translateX(0px)`;
				}
			},

			cancel(g_context) {
				g_context.dom.style.transform = 'translateX(0px)';
				g_context.dom.style.removeProperty('transition');
			},
		});

		// 
		window.addEventListener('keydown', (d_event) => {
			// do not steal event from inputs
			if(['INPUT', 'TEXTAREA'].includes((d_event.target as HTMLElement)?.tagName || '')) return;

			// a slash "/" keydown initiates a search
			if(['/', 'Divide'].includes(d_event.key)) {
				void $yw_navigator.activePage.fire('search', () => {
					d_event.preventDefault();
				});
			}
		});
	});


	let x_overscroll_progress = 0;
	let x_overscroll_position = 0;
	// {
	// 	Gestures.overscroll({
	// 		init() {
	// 			if(0 === $yw_navigator.activePage.dom.scrollTop) {
	// 				return {};
	// 			}
	// 		},

	// 		move(xl_dy) {
	// 			console.log(`Overscroll position: ${xl_dy}`);
	// 			x_overscroll_progress = xl_dy / 50;
	// 			x_overscroll_position = xl_dy / 80;
	// 		},

	// 		release() {
	// 			x_overscroll_position = 0;
	// 		},

	// 		cancel() {
	// 			x_overscroll_position = 0;
	// 		},
	// 	});
	// }
	
</script>


<style lang="less">
	@import '../_base.less';

	.full(@type) {
		position: @type;
		width: 100%;
		height: 100%;
	}

	.full(absolute) {
		top: 0;
		left: 0;
	}

	.viewport {
		.full(relative);
		overflow: hidden;

		color: var(--theme-color-text-light);
		background-color: var(--theme-color-bg);

		>.content {
			.full(relative);
			overflow: hidden;

			width: 100%;
			height: 100%;

			&.exitting {
				position: absolute;
				top: 0;
				z-index: 1001;
				user-select: none;
				pointer-events: none;
			}

			>.thread {
				:global(&) {
					.full(absolute);
				}
			}
		}
	}
</style>

<main class="viewport" bind:this={dm_viewport}>
	<div class="content threads" bind:this={dm_threads} />
	<div class="content exitting" bind:this={dm_exitting} />
	<slot></slot>

	<ProgressSvelte />
	
	{#if b_main}
		{#await Vault.isUnlocked() then b_unlocked}
			{#if b_unlocked}
				<OverscrollSvelte bind:progress={x_overscroll_progress} bind:position={x_overscroll_position} />
				<NavSvelte />
				<SearchSvelte />
				<VendorMenuSvelte />
				<SideMenuSvelte />
			{/if}
		{/await}
	{/if}

	<PopupSvelte />
	<NotificationsSvelte />
</main>
