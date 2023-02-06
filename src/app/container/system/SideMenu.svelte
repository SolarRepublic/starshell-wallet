<script lang="ts">	
	import {onDestroy, onMount} from 'svelte';
	
	import {ThreadId} from '#/app/def';
	import {
		yw_menu_expanded, yw_navigator, yw_popup,
	} from '#/app/mem';
	
	import PopupFactoryReset from '#/app/popup/PopupFactoryReset.svelte';
	import {open_window, P_POPUP} from '#/extension/browser';
	import {launch_qr_scanner} from '#/extension/sensors';
	import {logout} from '#/share/auth';
	import {B_WITHIN_WEBEXT_POPOVER} from '#/share/constants';
	
	import SX_ICON_ACCOUNTS from '#/icon/account_circle.svg?raw';
	import SX_ICON_CONNECTIONS from '#/icon/account_tree.svg?raw';
	import SX_ICON_TAGS from '#/icon/bookmarks.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_CUBES from '#/icon/cubes.svg?raw';
	import SX_ICON_CHAINS from '#/icon/mediation.svg?raw';
	import SX_ICON_NUCLEAR from '#/icon/nuclear.svg?raw';
	import SX_ICON_POPOUT from '#/icon/pop-out.svg?raw';
	import SX_ICON_SCAN from '#/icon/scan.svg?raw';
	import SX_ICON_LOGOUT from '#/icon/sensor_door.svg?raw';
	import SX_ICON_SETTINGS from '#/icon/settings.svg?raw';
	import SX_ICON_CONTACTS from '#/icon/supervisor_account.svg?raw';
	

	interface Item {
		click: VoidFunction;
		label: string;
		icon: string;
	}

	// listen for keyevents
	let b_show_reset = false;
	{
		function keydown(d_event: KeyboardEvent) {
			if($yw_menu_expanded) {
				b_show_reset = d_event.shiftKey;

				if('Shift' === d_event.key) {
					d_event.preventDefault();
				}
			}
		}

		function keyup(d_event: KeyboardEvent) {
			b_show_reset = d_event.shiftKey;
		}

		onMount(() => {
			document.addEventListener('keydown', keydown);
			document.addEventListener('keyup', keyup);
		});

		onDestroy(() => {
			document.removeEventListener('keydown', keydown);
			document.removeEventListener('keyup', keyup);
		});
	}

	// hide reset anytime menu is expanded or colapsed
	yw_menu_expanded.subscribe(() => {
		b_show_reset = false;
	});

	function activate(si_thread: ThreadId) {
		$yw_menu_expanded = false;

		if(si_thread === $yw_navigator.activeThread.id) {
			$yw_navigator.activeThread.reset();
		}
		else {
			void $yw_navigator.activateThread(si_thread);
		}
	}

	const A_ITEMS = [
		{
			label: 'Accounts',
			icon: SX_ICON_ACCOUNTS,
			click() {
				activate(ThreadId.ACCOUNTS);
			},
		},
		{
			label: 'Providers',
			icon: SX_ICON_CHAINS,
			click() {
				activate(ThreadId.PROVIDERS);
			},
		},
		// {
		// 	label: 'Tags',
		// 	icon: SX_ICON_TAGS,
		// 	click() {
		// 		$yw_menu_expanded = false;
		// 		// k_page.push({
		// 		// 	creator: DeadEnd,
		// 		// });
		// 	},
		// },
		// {
		// 	label: 'Settings',
		// 	// icon: Icon.fromHtml(SX_ICON_SETTINGS),
		// 	icon: SX_ICON_SETTINGS,
		// 	click: () => {
		// 		$yw_menu_expanded = false;
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 		});
		// 	},
		// },
	];


	const A_UTILITY_ITEMS = [
		{
			label: 'Scan QR',
			icon: SX_ICON_SCAN,
			async click() {
				await launch_qr_scanner();

				// collapse side menu
				$yw_menu_expanded = false;
			},
		},
		{
			label: B_WITHIN_WEBEXT_POPOVER? 'Pop Out': 'New Tab',
			icon: SX_ICON_POPOUT,
			async click() {
				// open pop-out
				await open_window(P_POPUP, {popout:true});

				// close this popup
				globalThis.close();
			},
		},
	];

	const A_SESSION_ITEMS = [
		{
			label: 'Log out',
			icon: SX_ICON_LOGOUT,
			async click() {
				// logout of session
				await logout();

				// close this popup
				globalThis.close();
			},
		},
		{
			label: 'Factory reset',
			icon: SX_ICON_NUCLEAR,
			hidden: true,
			color: 'var(--theme-color-caution)',
			click() {
				$yw_popup = PopupFactoryReset;
			},
		},
	];

	let xt_prev = 0;
	let c_clicks = 0;
	let i_clicks = 0;
	function quick_click() {
		clearTimeout(i_clicks);

		const xt_now = Date.now();

		if(xt_now - xt_prev < 500) {
			if(5 === ++c_clicks) {
				b_show_reset = true;
			}
		}

		xt_prev = xt_now;

		i_clicks = window.setTimeout(() => {
			c_clicks = 0;
		}, 500);
	}
</script>

<style lang="less">
	@import '../../_base.less';

	:root {
		--bar-width: 78.8%;
		--animation-duration: 1s;
		--animation-easing: var(--ease-out-quick);
	}

	@keyframes fade {
		0% {
			background-color: transparent;
		}

		100% {
			background-color: rgba(0, 0, 0, 0.8);
		}
	}

	@keyframes slide {
		0% {
			right: calc(0% - var(--bar-width));
		}

		100% {
			right: 0%;
		}
	}

	@keyframes offscreen {
		0% {
			top: 0;
		}

		100% {
			top: var(--app-window-height);
		}
	}

	.side-menu {
		--item-padding: 30px;

		.absolute(@from: right);
		.font(regular);
		z-index: 1001;
		user-select: none;

		>.backdrop {
			.absolute(100%);
			background-color: rgba(0, 0, 0, 0.8);
			transition: background-color var(--animation-duration) var(--ease-out-expo);
		}

		>.bar {
			position: absolute;
			top: 0;
			width: var(--bar-width);
			max-width: 320px;
			height: 100%;
			background-color: var(--theme-color-bg);
			right: 0%;
			transition: right var(--animation-duration) var(--animation-easing);

			>.menu {
				display: flex;
				flex-direction: column;
				justify-content: space-evenly;
				height: 100%;

				ul {
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column-reverse;

					>li {
						list-style: none;
						padding: 13px 0;
						padding-left: var(--item-padding);
						cursor: pointer;

						>* {
							vertical-align: middle;
						}

						>.icon {
							--icon-diameter: 24px;
							padding: 0;
							padding-right: calc(var(--item-padding) / 2);
						}

						&.hidden {
							visibility: hidden;
							opacity: 0;
							transition: opacity 250ms var(--ease-out-quad);
						}

						&.showing {
							visibility: visible;
							opacity: 1;
						}
					}

					&.items {
						.icon {
							--icon-color: var(--theme-color-primary);
						}
					}

					&.session {
						padding: calc(var(--item-padding) / 2) 0;

						.icon {
							--icon-color: var(--theme-color-text-med);
						}
					}

					&.utility {
						// padding: calc(var(--item-padding) / 2) 0;

						.icon {
							--icon-color: var(--theme-color-primary);
						}
					}
				}

				>.main {
					flex: 1;
					display: flex;
					flex-direction: column;
					justify-content: flex-end;
					padding-top: 15%;
					padding-bottom: 15%;
				}

				>.bottom,>.top {
					flex: 0;
				}

				>.top {
					// padding-top: 15%;
					padding-top: 0px;
				}
			}
		}

		&.collapsed {
			pointer-events: none;
			top: 0;
			animation: offscreen var(--animation-duration) steps(2, jump-none) both;
			
			>.backdrop {
				background-color: rgba(0, 0, 0, 0);
			}

			>.bar {
				right: calc(0% - var(--bar-width));
			}
		}


		hr {
			margin: 0 var(--item-padding);
			border: none;
			border-top: 1px solid var(--theme-color-border);
		}

		.close {
			position: absolute;
			top: 0;
			right: 0;
			margin: 10px;
			padding: 12px;
			cursor: pointer;
			--icon-diameter: 24px;
			--icon-color: var(--theme-color-primary);

			outline: 1px solid var(--theme-color-border);
			border-radius: 0px;
			transition: border-radius 650ms var(--ease-out-expo);
			pointer-events: all;

			&::before {
				--occlusion-thickness: 4px;

				content: '';
				position: absolute;
				top: calc(var(--occlusion-thickness) / 2);
				left: calc(var(--occlusion-thickness) / 2);
				width: calc(100% - var(--occlusion-thickness));
				height: calc(100% - var(--occlusion-thickness));
				outline: var(--occlusion-thickness) solid var(--theme-color-bg);
				box-sizing: border-box;
				pointer-events: none;
			}

			&:hover {
				border-radius: 22px;
			}
		}
	}
</style>

<div
	class="side-menu"
	class:collapsed={!$yw_menu_expanded}
>
	<div class="backdrop"
		on:click={() => $yw_menu_expanded = false}
	/>

	<div class="bar" on:click={() => quick_click()}>
		<div class="close icon" on:click={() => $yw_menu_expanded = false}>
			{@html SX_ICON_CLOSE}
		</div>

		<div class="menu">
			<div class="top">
				<ul class="session">
					{#each A_SESSION_ITEMS as g_item}
						<li on:click={() => g_item.click()} class:hidden={g_item.hidden} class:showing={b_show_reset}>
							<span class="icon" style={g_item.color? `color:${g_item.color};`: ''}>
								{@html g_item.icon}
							</span>
							<span class="text">
								{g_item.label}
							</span>
						</li>
					{/each}
				</ul>

				<hr>

				<ul class="utility">
					{#each A_UTILITY_ITEMS as g_item}
						<li on:click={() => g_item.click()}>
							<span class="icon">
								{@html g_item.icon}
							</span>
							<span class="text">
								{g_item.label}
							</span>
						</li>
					{/each}
				</ul>

				<hr>
			</div>

			<div class="main">
				<ul class="items">
					{#each A_ITEMS as g_item}
						<li class="" on:click={() => g_item.click()}>
							<span class="icon">
								{@html g_item.icon}
							</span>
							<span class="text">
								{g_item.label}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>