<script lang="ts">
	import type {ParametricSvelteConstructor} from '#/meta/svelte';

	import {B_IOS_NATIVE, P_FALLBACK_BROWSER_HOMEPAGE} from '#/share/constants';
	import {ode, oderac} from '#/util/belt';
	import {H_THREADS, ThreadId} from '##/def';
	import {
		yw_nav_collapsed,
		yw_nav_visible,
		yw_menu_expanded,
		yw_blur,
		yw_overlay_network,
		yw_overlay_account,
		yw_notifications,
		yw_navigator,
		yw_page,
		yw_thread,
	} from '##/mem';
	
	import SX_ICON_CONTACTS from '#/icon/account_box.svg?raw';
	import SX_ICON_CUBES from '#/icon/cubes.svg?raw';
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
	import SX_ICON_GLOBE from '#/icon/globe.svg?raw';
	import SX_ICON_HISTORY from '#/icon/history.svg?raw';
	import SX_ICON_MENU from '#/icon/menu.svg?raw';
	import SX_ICON_NFT from '#/icon/nfts.svg?raw';
	import SX_ICON_TOKENS from '#/icon/tokens.svg?raw';
    import { Settings } from '#/store/settings';
    import type { WebKitMessenger } from '#/script/webkit-polyfill';
	

	// nav bar definition
	const H_BUTTONS = {
		[ThreadId.HISTORY]: {
			svg: SX_ICON_HISTORY,
			label: 'History',
		},
		[ThreadId.AGENTS]: {
			svg: SX_ICON_CONTACTS,
			label: 'Contacts',
		},
		[ThreadId.TOKENS]: {
			svg: SX_ICON_TOKENS,
			label: 'Tokens',
		},
		...B_IOS_NATIVE? {
			browser: {
				svg: SX_ICON_GLOBE,
				label: 'Browser',
			},
		}: {
			[ThreadId.APPS]: {
				svg: SX_ICON_CUBES,
				label: 'Apps',
			},
		},
		menu: {
			svg: SX_ICON_MENU,
			label: 'Menu',
		},
	} as Record<string, {
		svg: string;
		label: string;
		disabled?: boolean;
	}>;

	const HM_HOMESCREENS = new Map<ParametricSvelteConstructor, ThreadId>(
		oderac(H_THREADS, (si_thread, dc_creator) => [dc_creator, si_thread as ThreadId]));

	let si_thread_head: '' | ThreadId = '';
	$: si_thread_head = $yw_page? HM_HOMESCREENS.get($yw_page.creator) || '': '';

	
	function toggle_collapsed() {
		$yw_nav_collapsed = !$yw_nav_collapsed;
	}

	function nav_click(si_button: string) {
		// remove notification
		$yw_notifications = $yw_notifications.filter(si => si_button !== si);

		// blur is active
		if($yw_blur) {
			// cancel blur
			$yw_blur = false;
		}

		// network overlay is active
		if($yw_overlay_network) {
			$yw_overlay_network = false;
		}

		// account overlay is active
		if($yw_overlay_account) {
			$yw_overlay_account = false;
		}

		// depending on button click
		switch(si_button) {
			// menu
			case 'menu': {
				// expand menu
				$yw_menu_expanded = true;

				break;
			}

			// browser
			case 'browser': {
				(async() => {
					const p_homepage = await Settings.get('p_browser_homepage') || P_FALLBACK_BROWSER_HOMEPAGE;
	
					void (globalThis.opener_handler as WebKitMessenger).post({
						url: '',
						args: [p_homepage],
					});
				})();

				break;
			}

			// current thread head loaded
			case si_thread_head: {
				// scroll to top smoothly
				$yw_navigator.activePage.dom.scrollTo({
					top: 0,
					left: 0,
					behavior: 'smooth',
				});

				break;
			}

			// within this thread
			case $yw_thread.id: {
				// previous; pop
				const k_previous = $yw_page.peak();
				if(k_previous && HM_HOMESCREENS.get(k_previous.creator) === $yw_thread.id) {
					$yw_page.pop();
				}
				// current thread won't cause update
				else {
					$yw_page.reset();
				}

				break;
			}

			// switch thread
			default: {
				// $yw_thread_id = si_button as ThreadId;
				void $yw_navigator.activateThread(si_button as ThreadId);

				break;
			}
		}
	}
</script>

<style lang="less">
	@import '../../_base.less';

	nav {
		--nav-height: 72px;

		position: absolute;
		bottom: -0.1px;  // sub-pixel space
		height: var(--nav-height);
		width: 100%;
		background: var(--theme-color-bg);
		background: linear-gradient(177deg, @theme-color-dark 55%, @theme-color-darker 188%);
		display: block;
		z-index: 1000;

		transition: bottom 1s var(--ease-out-quick);

		display: none;
		&.visible {
			display: initial;
		}

		&.collapsed {
			bottom: calc(0px - var(--nav-height));

			>.collapse.icon>svg {
				:global(&) {
					transform: rotate(-180deg);
				}
			}
		}

		>.collapse.icon {
			--button-diameter: 32px;
			--icon-diameter: 24px;
			--svg-color-fg: var(--theme-color-text-light);

			border: 1px solid transparent;
			position: absolute;
			right: 0;
			top: calc(0px - var(--button-diameter));

			border-radius: 0;
			border-bottom-width: 0;
			border-color: var(--theme-color-border);
			box-sizing: border-box;
			background-color: var(--theme-color-bg);

			>svg {
				:global(&) {
					transform: rotate(0deg);
					transition: transform 1s var(--ease-out-quick);
				}
			}

			cursor: pointer;
		}

		>.bar {
			list-style: none;
			padding: 0;
			margin: 0;

			display: flex;
			text-align: center;

			border-top: 1px solid var(--theme-color-border);

			>.button {
				flex: 1;
				padding-top: 11px;
				padding-bottom: 12px;

				--icon-diameter: 24px;
				--svg-color-fg: var(--theme-color-text-light);

				cursor: pointer;

				&.active {
					&:not(.menu) {
						--svg-color-fg: var(--theme-color-primary);
					}

					>.label {
						color: var(--theme-color-text-light);
					}
				}

				>.icon {
					.inherit(--icon-diameter);
				}

				.notification {
					position: absolute;
					width: 7px;
					height: 7px;
					background-color: var(--theme-color-sky);
					border-radius: 7px;
					margin-top: 15px;
					border: 2px solid var(--theme-color-bg);
					margin-left: -9px;
				}

				>.label {
					font-size: 11px;
					color: var(--theme-color-text-med);
				}
			}
		}
	}
</style>

<nav class:collapsed={$yw_nav_collapsed} class:visible={$yw_nav_visible}>
	<!-- <div class="collapse icon" on:click={() => toggle_collapsed()}>
		{@html SX_ICON_EXPAND}
	</div> -->
	<ul class="bar">
		{#each ode(H_BUTTONS) as [si_button, g_button]}
			{#if g_button.disabled}
				<li class="button {si_button}" class:active={si_thread_head === si_button} style="opacity: 0.5;">
					<div class="icon">
						{@html g_button.svg}

						<span class="notification" class:display_none={!$yw_notifications.includes(si_button)}></span>
					</div>
					<div class="label">
						{g_button.label}
					</div>
				</li>
			{:else}
				<li class="button {si_button}" class:active={si_thread_head === si_button} on:click={() => nav_click(si_button)}>
					<div class="icon">
						{@html g_button.svg}

						<span class="notification" class:display_none={!$yw_notifications.includes(si_button)}></span>
					</div>
					<div class="label">
						{g_button.label}
					</div>
				</li>
			{/if}
		{/each}
		</ul>
</nav>
