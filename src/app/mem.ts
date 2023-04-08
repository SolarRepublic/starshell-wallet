import type {ThreadId} from './def';

import type {DerivedMemStore} from './mem-store';
import type {Navigator} from './nav/navigator';

import type {Page} from './nav/page';

import type {Thread} from './nav/thread';

import type {AccountStruct, AccountPath} from '#/meta/account';
import type {Dict} from '#/meta/belt';
import type {ChainPath, ChainNamespaceKey, ChainStruct} from '#/meta/chain';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';
import type {StoreKey} from '#/meta/store';
import type {ParametricSvelteConstructor} from '#/meta/svelte';



import type {Vocab} from '#/meta/vocab';

import {derived, writable} from './mem-store';
import {once_store_updates} from './svelte';

import type {CosmosNetwork} from '#/chain/cosmos-network';
import type {Pwa} from '#/script/messages';
import {global_receive} from '#/script/msg-global';
import {
	B_FIREFOX_ANDROID,
	B_MOBILE,
	B_IOS_NATIVE,
	B_SAFARI_MOBILE,
	B_WITHIN_PWA,
	B_WITHIN_WEBEXT_POPOVER,
	G_USERAGENT,
	H_PARAMS,
	N_PX_FIREFOX_TOOLBAR,
	SI_STORE_MEDIA,
	SI_STORE_TAGS,
	SI_STORE_PFPS,
	SI_STORE_ACCOUNTS,
	SI_STORE_CHAINS,
	SI_STORE_PROVIDERS,
	SI_STORE_SETTINGS,
	ConnectionHealth,
	SI_STORE_QUERY_CACHE,
} from '#/share/constants';
import type {StoreRegistry} from '#/store/_registry';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Medias} from '#/store/medias';
import {Pfps} from '#/store/pfps';
import {Providers} from '#/store/providers';
import {QueryCache} from '#/store/query-cache';
import {Settings} from '#/store/settings';
import {Tags} from '#/store/tags';
import {F_NOOP, microtask, timeout} from '#/util/belt';

import PopupReceive from './popup/PopupReceive.svelte';



/**
 * The navigator object for this window
 */
export const yw_navigator = writable<Navigator>(null! as Navigator);


/**
 * Selects the active provider
 */
export const yw_provider_ref = writable<'' | ProviderPath>('' as ProviderPath);
export const yw_provider = derived<ProviderStruct>(yw_provider_ref, p_provider => p_provider? Providers.at(p_provider as ProviderPath): null, true);
export const yw_network = derived<CosmosNetwork>(yw_provider, async(g_provider) => {
	if(!g_provider) return null as unknown as CosmosNetwork;

	const g_chain = await Chains.at(g_provider.chain as ChainPath)!;

	return Providers.activate(g_provider, g_chain);
}, true);


/**
 * Selects the active chain
 */
export const yw_chain_ref = writable<ChainPath>('' as ChainPath);
export const yw_chain = derived<ChainStruct>(yw_chain_ref, async(p_chain) => {
	(async() => {
		// propagate change of chain to default provider
		if(p_chain && p_chain !== yw_provider.get()?.chain) {
			try {
				for(const [p_provider, g_provider] of await Providers.entries()) {
					// select first compatible provider (order-favorable default)
					if(p_chain === g_provider.chain) {
						await yw_provider_ref.set(p_provider);
						return true;
					}
				}
			}
			catch(e_auth) {
				await yw_provider_ref.set('');
			}
		}
	})();

	return await Chains.at(p_chain as ChainPath);
}, true);


export const yw_connection_health = writable<ConnectionHealth>(ConnectionHealth.UNKNOWN);

/**
 * Derive namespace from chain
 */
export const yw_chain_namespace = derived<ChainNamespaceKey>(yw_chain, g => g?.namespace || '' as ChainNamespaceKey);


/**
 * Selects the active account
 */
export const yw_account_ref = writable<AccountPath>('' as AccountPath);
export const yw_account = derived<AccountStruct>(yw_account_ref, (p_account, fk_set) => {
	void Accounts.at(p_account as AccountPath).then(g => fk_set(g!))
		.catch((e_auth) => {
			fk_set(null);
		});
}, true);


export const yw_owner = derived(
	[yw_account, yw_chain] as [DerivedMemStore<AccountStruct>, DerivedMemStore<ChainStruct>],
	([g_account, g_chain]) => {
		if(g_account && g_chain) {
			return Chains.addressFor(g_account.pubkey, g_chain);
		}
		else {
			return null;
		}
	}, true);



/**
 * Shows/hides the vendor menu
 */
export const yw_menu_vendor = writable(false);

/**
 * Shows/hides the account selector overlay
 */
export const yw_overlay_account = writable(false);

/**
 * Shows/hides the network selector overlay
 */
export const yw_overlay_network = writable(false);

/**
 * Shows/hides the app selector overlay
 */
export const yw_overlay_app = writable(false);

/**
 * Store caches
 */

const store_cache = <
	si_store extends StoreKey,
>(si_store: si_store) => writable<InstanceType<StoreRegistry<si_store>> | null>(null);

const H_STORE_INVALIDATORS = {
	async [SI_STORE_MEDIA]() {
		await yw_store_medias.set(await Medias.read(), true);
	},

	async [SI_STORE_TAGS]() {
		await yw_store_tags.set(await Tags.read(), true);
	},

	async [SI_STORE_PFPS]() {
		await yw_store_pfps.set(await Pfps.read(), true);
	},

	async [SI_STORE_QUERY_CACHE]() {
		await yw_store_query_cache.set(await QueryCache.read(), true);
	},

	async [SI_STORE_SETTINGS]() {
		await yw_store_settings.set(await Settings.read(), true);
	},

	async [SI_STORE_ACCOUNTS]() {
		await yw_account.invalidate();
	},

	async [SI_STORE_CHAINS]() {
		await yw_chain.invalidate();
	},

	async [SI_STORE_PROVIDERS]() {
		await yw_network.invalidate();
	},
};

// reload a given store
async function reload_store(si_store?: StoreKey): Promise<void> {
	if(si_store) {
		if(si_store in H_STORE_INVALIDATORS) {
			await H_STORE_INVALIDATORS[si_store]();
		}
	}
	else {
		await Promise.all(Object.values(H_STORE_INVALIDATORS).map(f => f()));
	}
}


export const yw_store_medias = store_cache(SI_STORE_MEDIA);
export const yw_store_tags = store_cache(SI_STORE_TAGS);
export const yw_store_pfps = store_cache(SI_STORE_PFPS);
export const yw_store_settings = store_cache(SI_STORE_SETTINGS);
export const yw_store_query_cache = store_cache(SI_STORE_QUERY_CACHE);

// expose settings as live registry
export const yw_settings = derived(yw_store_settings, ks_settings => ks_settings?.raw || {});


// register for updates
global_receive({
	async 'updateStore'({key:si_store}) {
		await reload_store(si_store);
	},

	async reload() {
		// reload all stores
		await reload_store();

		// trigger updates on pages
		await yw_update.update(c_updates => c_updates + 1);
	},
});

export async function initialize_store_caches(): Promise<void> {
	await Promise.all([
		reload_store(SI_STORE_MEDIA),
		reload_store(SI_STORE_TAGS),
		reload_store(SI_STORE_PFPS),
		reload_store(SI_STORE_SETTINGS),
	]);
}


export const yw_page = writable<Page>(null! as Page);

export const yw_thread = writable<Thread>(null! as Thread);


export const yw_notifications = writable<Array<string | ThreadId>>([]);

export const yw_nav_collapsed = writable(false);

export const yw_nav_visible = writable(false);

export const yw_progress = writable([0, 0] as [number, number]);



export const yw_search = writable('');

export const yw_cancel_search = writable<VoidFunction>(F_NOOP);

export const yw_task = writable(0);

export const yw_header_props = writable<Dict>({});

export const yw_exitting_dom = writable<HTMLElement>(null!);

export const yw_menu_expanded = writable(false);


export const yw_overscroll_pct = writable(0);

/**
 * Provide arbitrary context to the popup
 */
export const yw_context_popup = writable<Dict<any> | null>(null);

/**
 * Sets the component to use as the popup and shows it
 */
export const yw_popup = writable<ParametricSvelteConstructor | null>(null);


export function popup_receive(p_account: AccountPath): void {
	void yw_context_popup.set({
		account: p_account,
	});

	void yw_popup.set(PopupReceive);
}


/**
 * Toggles the curtain flag for screens that use the Curtain component
 */
export const yw_curtain = writable<boolean>(false);

/**
 * Incrementing declares all UI state as dirty as triggers reload on pages that support it 
 */
export const yw_update = writable(0);


export const yw_blur = writable(false);

export const yw_doc_visibility = writable('unset');
if('object' === typeof document) {
	document.addEventListener('visibilitychange', () => {
		yw_doc_visibility.set(document.visibilityState);
	});
}


export const hm_arrivals: WeakMap<HTMLElement, VoidFunction> = new Map();
export function arrival(dm_screen: HTMLElement, fk_arrive: VoidFunction) {
	hm_arrivals.set(dm_screen, fk_arrive);
}

// ref viewport object
const d_viewport = globalThis.visualViewport || {
	width: globalThis.window?.innerWidth || 0,
	height: globalThis.window?.innerHeight || 0,
} as VisualViewport;

// fits the app to the full viewport dimensions
function fit_viewport(xl_offset_height=0, xl_max_width=Infinity) {
	const d_style_root = document.documentElement.style;
	if(d_viewport) {
		const xl_width = Math.min(xl_max_width, d_viewport.width);
		const xl_height = d_viewport.height + xl_offset_height;

		if(xl_width * xl_height > 100) {
			d_style_root.setProperty('--app-window-width', Math.floor(xl_width)+'px');
			d_style_root.setProperty('--app-window-height', Math.floor(xl_height)+'px');
		}
	}
}

// watches the viewport height for changes and updates the view accordingly
function continually_adjust_height(xl_offset=0, fk_resized?: VoidFunction) {
	// anytime browser resizes the visual viewport (e.g., keyboard overlay or toolbar visibility)
	d_viewport.addEventListener?.('resize', () => {
		function readjust() {
			// adjust window height variable
			document.documentElement.style.setProperty('--app-window-height', Math.floor(d_viewport.height+xl_offset)+'px');
		}

		readjust();

		// callback
		fk_resized?.();

		setTimeout(() => {
			readjust();
		}, 1e3);
	});
}

// states of scrollable area
enum SCROLLABLE {
	NONE=0,
	EXTENDED=1,
	COLLAPSED=2,
}

/**
 * Whether or not the shift key is down
 */
export const yw_shift_key = writable<boolean>(false);

// wait for window to load
if('undefined' !== typeof document) {
	document.addEventListener('keydown', (d_event) => {
		void yw_shift_key.set(d_event.shiftKey);
	});

	document.addEventListener('keyup', (d_event) => {
		void yw_shift_key.set(d_event.shiftKey);
	});

	void once_store_updates(yw_navigator).then(async() => {
		console.debug(`System navigator ready`);

		// ref html element
		const dm_html = document.documentElement;

		// get root style
		const d_style_root = dm_html.style;

		// use all available width on mobile device
		if(B_MOBILE) {
			// state of whether it is extended or collapsed
			let xc_scrollable = SCROLLABLE.NONE;

			// height offset due to browser chrome
			let xl_offset_height = 0;

			// extend the height of the document so that the use can scroll down to hide the safari toolbar
			function extend_scrollable() {
				// +200px seems to be the lowest safe amount to overflow the page in order for safari to hide the toolbar
				dm_html.style.height = 'calc(200px + 100vh)';

				xc_scrollable = SCROLLABLE.EXTENDED;
			}

			// remove the extra scrollable space at the bottom so there is no akward space
			function collapse_scrollabe() {
				// set to +1px so that scrollable height does not fit within viewport, otherwise safari will show toolbar
				dm_html.style.height = 'calc(1px + 100vh)';

				xc_scrollable = SCROLLABLE.COLLAPSED;
			}

			// resize the entire app according to viewport
			async function resize_app() {
				// delete max height temporarily
				dm_html.style.maxHeight = '';

				// start by setting dimensions to fill entire viewport
				dm_html.style.width = '100vw';

				// remove height property
				dm_html.style.removeProperty('height');

				// wait a tick
				await microtask();

				// set height property
				dm_html.style.setProperty('height', '100vh');

				// wait a tick
				await microtask();

				// update viewport
				fit_viewport(xl_offset_height);

				// scroll position is below
				if(dm_html.scrollTop > 0) {
					// scroll to nearly the top
					dm_html.scrollTo({
						top: 1,
						behavior: 'smooth',
					});
				}

				// (re)set max-height of html
				if(B_SAFARI_MOBILE && B_WITHIN_WEBEXT_POPOVER) {
					d_style_root.maxHeight = 'var(--app-window-height)';
				}
			}

			// safari mobile
			if(B_SAFARI_MOBILE) {
				// within webext popup
				if(B_WITHIN_WEBEXT_POPOVER) {
					// set padding bottom in order to clear home bar
					d_style_root.setProperty('--app-window-padding-bottom', '15px');
					d_style_root.background = 'var(--theme-color-bg)';

					// system dark theme
					if(globalThis.matchMedia('(prefers-color-scheme: dark)')) {
						document.body.style.background = 'rgb(68, 27, 0)';
					}
					// system light theme
					else {
						document.body.style.background = 'rgb(255, 159, 0)';
					}

					// show terminus
					document.getElementById('terminus')!.style.display = 'block';

					// dynamic app height
					continually_adjust_height(0, () => {
						// scroll document to nearly top
						dm_html.scrollTo({top:1, behavior:'smooth'});
					});
				}
				// within tab
				else if('tab' === H_PARAMS.within) {
					// on ios, require user to scroll down to hide UI
					extend_scrollable();

					// set body height
					document.body.style.height = '100vh';
					document.body.style.maxHeight = 'var(--app-window-height)';

					// // scroll down to hide toolbar
					// function trim_once() {
					// 	// reached bottom
					// 	if(window.innerHeight + dm_html.scrollTop >= dm_html.scrollHeight) {
					// 		// scroll document to top
					// 		dm_html.scrollTo({top:1, behavior:'smooth'});

					// 		// remove self
					// 		document.removeEventListener('scroll', trim_once);
					// 	}
					// }

					// listen for scroll events
					document.addEventListener('scroll', async() => {
						// scrollable area is extended
						if(SCROLLABLE.EXTENDED === xc_scrollable) {
							// user scrolled past bottom
							if(dm_html.scrollTop >= 10) {
								console.log('scrolled beyond bottom while extended');

								// collapse scrollable (view will automatically smooth scroll to top)
								collapse_scrollabe();

								// pause
								await timeout(2e3);

								console.log('extended scrollable again');

								// make collapsible again
								extend_scrollable();
							}
						}
					});

					// dynamic app height
					continually_adjust_height(0, () => {
						// scroll document to nearly top
						dm_html.scrollTo({top:1, behavior:'smooth'});
					});
				}

				// // 
				// if(B_WITHIN_WEBEXT_POPOVER) {
				// 	// viewport is resized (e.g., from virtual keyboard overlay)
				// 	d_viewport.addEventListener('resize', () => {
				// 		console.log('#resize %o', {
				// 			viewportHeight: d_viewport.height,
				// 			innerHeight: window.innerHeight,
				// 			scrollHeight: document.documentElement.scrollHeight,
				// 			scrollTop: document.documentElement.scrollTop,
				// 		});

				// 		// returning to actual height, resize immediately
				// 		if(d_viewport.height === dm_html.scrollHeight) {
				// 			void resize_app();
				// 		}
				// 		// viewport is shrinking, debounce rapid resize events
				// 		else if(d_viewport.height < window.innerHeight) {
				// 			void resize_app();
				// 		}
				// 		// within native popup
				// 		else if(B_WITHIN_WEBEXT_POPOVER) {
				// 			void resize_app();
				// 		}
				// 	});
				// }
			}
			// firefox for android
			else if(B_FIREFOX_ANDROID) {
				// // set padding bottom in order to clear home bar
				// d_style_root.setProperty('--app-window-padding-bottom', '15px');

				// in PWA mode
				if(B_WITHIN_PWA) {
					// listen for resize messages from top frame
					(window as Vocab.TypedWindow<Pwa.TopToIframe>).addEventListener('message', (d_event) => {
						const {
							type: si_type,
							value: g_value,
						} = d_event.data;

						if('visualViewportResize' === si_type) {
							// adjust window height variable
							document.documentElement.style.setProperty('--app-window-height', Math.floor(g_value.height)+'px');
						}
					});

					// request size
					(window.top as Vocab.TypedWindow<Pwa.IframeToTop>).postMessage({
						type: 'fetchVisualViewportSize',
					}, 'https://launch.starshell.net');
				}
				// in firefox
				else {
					// // adjust window height
					// let xl_height = Math.floor(d_viewport.height);

					// in browser tab
					if(!B_WITHIN_WEBEXT_POPOVER) {
						// adjust window height by offset
						xl_offset_height = -N_PX_FIREFOX_TOOLBAR;
					}

					// // make sure height is reasonable
					// if(xl_height > 100) {
					// 	console.log(`Adjusting new height to ${Math.floor(xl_height)}`);
					// 	d_style_root.setProperty('--app-window-height', `${Math.floor(xl_height)}px`);
					// }

					// // fit viewport
					// fit_viewport(xl_offset_height);

					// dynamic app height. firefox toolbar takes up about 56 pixels
					continually_adjust_height(xl_offset_height);
				}

				// set body height
				document.body.style.height = '100vh';
				document.body.style.maxHeight = 'var(--app-window-height)';
			}
			// within native ios webkit view
			else if(B_IOS_NATIVE) {
				fit_viewport();

				// set body height
				document.body.style.height = '100vh';
				document.body.style.maxHeight = 'var(--app-window-height)';

				// set padding bottom in order to clear home bar
				d_style_root.setProperty('--app-window-padding-bottom', '20px');

				// dynamic app height
				continually_adjust_height(0, () => {
					// scroll document to nearly top
					dm_html.scrollTo({top:0, behavior:'smooth'});
				});

				// prevent weird keyboard layout issues
				setInterval(async() => {
					document.documentElement.style.removeProperty('height');
					await timeout(1e3);
					document.documentElement.style.setProperty('height', '100vh');
				}, 5e3);
			}

			// resize app on mobile
			await resize_app();

			// expose resize functions
			Object.assign(globalThis, {
				resize_app,
				fit_viewport,
			});
		}
		// desktop
		else {
			fit_viewport();

			// window
			if(['popout', 'tab'].includes(H_PARAMS.within as string)) {
				// take up entire viewing width
				document.documentElement.style.setProperty('--app-window-width', '100vw');

				// take up fill window
				d_style_root.width = d_style_root.height = '100%';

				continually_adjust_height();
			}
			// popover
			else if(B_WITHIN_WEBEXT_POPOVER) {
				// ensure consistent max width (affects firefox)
				fit_viewport(0, 360);

				// firefox
				if('Firefox' === G_USERAGENT.browser.name) {
					document.body.style.width = 'var(--app-window-width)';
					document.body.style.height = 'var(--app-window-height)';
				}
			}
		}

		// const c_resizes = 0;

		// let x_prev_width = N_PX_WIDTH_POPUP;
		// let x_prev_height = N_PX_HEIGHT_POPUP;

		// function resize(i_resize: number) {
		// 	// ignore late delayed resizes
		// 	if(c_resizes !== i_resize) return;

		// 	const x_window_width = window.innerWidth;
		// 	const x_window_height = window.innerHeight;

		// 	let x_app_width = 0;
		// 	let x_app_height = 0;

		// 	console.log(`Window resize event: [${x_window_width}, ${x_window_height}]`);

		// 	// on mobile
		// 	if(B_MOBILE) {
		// 		// temporarily assign full width/height
		// 		maximize_viewport();

		// 		// get full viewport dimensions
		// 		const {
		// 			width: sx_viewport_width,
		// 			height: sx_viewport_height,
		// 		} = globalThis.getComputedStyle(dm_html);

		// 		console.log(`Full viewport dimensions: [${sx_viewport_width}, ${sx_viewport_height}]`);

		// 		// width or height is being constrained by viewport
		// 		if(x_window_width < +sx_viewport_width.replace(/px$/, '')) {
		// 			x_app_width = x_window_width;
		// 			console.log(`width ${x_window_width} < ${+sx_viewport_width.replace(/px$/, '')}`);
		// 		}

		// 		if(x_window_height < +sx_viewport_height.replace(/px$/, '')) {
		// 			x_app_height = x_window_height;
		// 			console.log(`height ${x_window_height} < ${+sx_viewport_height.replace(/px$/, '')}`);
		// 		}
		// 	}
		// 	else {
		// 		x_app_width = x_window_width;
		// 		x_app_height = x_window_height;
		// 	}

		// 	console.log({
		// 		x_prev_width,
		// 		x_prev_height,
		// 		x_app_width,
		// 		x_app_height,
		// 	});

		// 	if(x_app_width && x_app_width !== x_prev_width) {
		// 		d_style_root.setProperty('--app-window-width', `${x_app_width}px`);
		// 		x_prev_width = x_window_width;
		// 	}

		// 	if(x_app_height && x_app_height !== x_prev_height) {
		// 		d_style_root.setProperty('--app-window-height', `${x_app_height}px`);
		// 		x_prev_height = x_window_height;
		// 	}
		// }

		// // respond to window resize events in order to update root css variable
		// const d_style_root = dm_html.style;
		// window.addEventListener('resize', () => {
		// 	const i_resize = ++c_resizes;

		// 	console.log({
		// 		innerWidth: window.innerWidth,
		// 		innerHeight: window.innerHeight,
		// 		outerWidth: window.outerWidth,
		// 		outerHeight: window.outerHeight,
		// 	});

		// 	resize(i_resize);

		// 	setTimeout(() => resize(i_resize), 250);
		// 	setTimeout(() => resize(i_resize), 750);
		// 	setTimeout(() => resize(i_resize), 1000);
		// });

		// // // continuously adjust size since mobile devices don't always fire the event
		// // setInterval(() => {
		// // 	resize(++c_resizes);
		// // }, 2e3);

		// // initialize
		// window.dispatchEvent(new Event('resize'));

		// global key events
		window.addEventListener('keydown', (d_event) => {
			// escape key
			if('Escape' === d_event.key) {
				// popup is open; close it
				if(yw_popup.get()) {
					yw_popup.set(null);
				}
			}
		});
	});
}
