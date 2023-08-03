import type {BrowserAction} from 'webextension-polyfill';

import type {Dict, JsonObject, JsonValue, Promisable} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';

import {SessionStorage} from './session-storage';

// import {Vault} from '#/crypto/vault';
import type {PageInfo, Pwa} from '#/script/messages';
import {
	G_USERAGENT,
	XT_SECONDS,
	N_PX_WIDTH_POPOUT,
	N_PX_HEIGHT_POPOUT,
	B_WITHIN_PWA,
	B_WEBEXT_ACTION,
	B_WEBEXT_BROWSER_ACTION,
	B_FIREFOX_ANDROID,
	B_IOS_NATIVE,
	H_PARAMS,
	B_IOS_WEBKIT,
	B_ANDROID_NATIVE,
} from '#/share/constants';

import {F_NOOP, timeout_exec} from '#/util/belt';
import {buffer_to_base64, text_to_buffer} from '#/util/data';
import {open_external_link, parse_params, stringify_params} from '#/util/dom';
import { ServiceClient } from './service-comms';


export type PopoutWindowHandle = {
	window: chrome.windows.Window | null;
	tab: chrome.tabs.Tab | null;
};

export interface ScreenInfo {
	width: number;
	height: number;
	availWidth: number;
	availHeight: number;
	orientation: JsonObject | null;
	devicePixelRatio: number;
}

export interface PositionConfig extends JsonObject {
	centered?: boolean;
	centered_x?: boolean;
	left?: number;
	top?: number;
}

// get popup URL
export const P_POPUP = chrome.runtime?.getURL?.('src/entry/popup.html');

// get flow URL
export const P_FLOW = chrome.runtime?.getURL?.('src/entry/flow.html');

/**
 * Computes the center position of the entire desktop screen
 */
async function center_over_screen(): Promise<PositionConfig> {
	// not mobile
	if(['mobile', 'wearable', 'embedded'].includes(G_USERAGENT.device.type || '')) {
		return {};
	}

	// cannot create windows
	if('function' !== typeof chrome.windows?.create) {
		return {};
	}

	// no access to chrome.system.display
	if('function' !== typeof chrome.system?.display?.getInfo) {
		return {};
	}

	// fetch displays and screen info
	const [
		a_displays,
		g_screen_info,
	] = await Promise.all([
		chrome.system.display.getInfo(),

		(async(): Promise<ScreenInfo | undefined> => {
			// create popup to determine screen dimensions
			const g_info = await SessionStorage.get('display_info');
			if(g_info) return g_info;

			// create center-gathering window
			chrome.windows.create({
				type: 'popup',
				url: P_FLOW+'?'+new URLSearchParams({headless:'info'}).toString(),
				focused: true,
				width: N_PX_WIDTH_POPOUT,
				height: N_PX_HEIGHT_POPOUT,
			}, F_NOOP);

			try {
				return (await once_storage_changes('session', 'display_info', 5*XT_SECONDS))?.newValue;
			}
			catch(e_timeout) {}
		})(),
	]);

	// create displays dict
	const h_displays = {};
	for(const g_display of a_displays) {
		if(g_display.isEnabled) {
			h_displays[g_display.bounds.width+':'+g_display.bounds.height] = g_display;
		}
	}

	// set display propertiess to be center of screen
	if(g_screen_info) {
		const si_display = g_screen_info.width+':'+g_screen_info.height;
		const g_display = h_displays[si_display];
		if(g_display) {
			return {
				centered: true,
				left: g_display.bounds.left + (g_screen_info.width / 2),
				top: g_display.bounds.top + (g_screen_info.height * 0.45),
			};
		}
	}

	return {};
}

export interface OpenWindowConfig extends JsonObject {
	/**
	 * Creates a standalone window in order to escape the popover
	 */
	popout?: boolean | undefined;

	/**
	 * Create a normal window with the URL bar
	 */
	chrome?: boolean | undefined;

	/**
	 * Open the window as a tab
	 */
	tab?: boolean | undefined;

	position?: PositionConfig | undefined;

	/**
	 * If set to non-zero integer, describes the tab id to open a popover above
	 */
	popover?: PageInfo | undefined;

	/**
	 * Overrides the width of the standalone popout window to create
	 */
	width?: number;

	/**
	 * Overrides the height of the standalone popout window to create
	 */
	height?: number;
}

/**
 * Computes the center position of the current popup
 */
function center_over_current() {
	const x_left = globalThis.screenLeft;
	const x_top = globalThis.screenTop;

	return {
		centered_x: true,
		left: x_left + (globalThis.outerWidth / 2),
		top: x_top - 20,  // account for roughly 20px of window chrome
	};
}

/**
 * Opens a new window. Position defaults to the center of the currently active screen
 */
export async function open_window(p_url: string, gc_open?: OpenWindowConfig): Promise<PopoutWindowHandle> {
	// parse url
	const d_url = new URL(p_url);

	// parse params
	const h_params = parse_params(d_url.search.slice(1));

	// determine center screen position for new window
	let g_window_position: PositionConfig = {};
	if(gc_open?.position) {
		g_window_position = gc_open.position;
	}
	else if(gc_open?.popout && 'number' === typeof globalThis.screenLeft) {
		g_window_position = center_over_current();
	}
	else {
		g_window_position = await center_over_screen();
	}

	// use popover
	if(gc_open?.popover && !B_FIREFOX_ANDROID && !B_IOS_NATIVE && !B_IOS_WEBKIT && !B_ANDROID_NATIVE) {
		// update url with extended search params
		const d_url_popover = new URL(p_url);
		d_url_popover.search = stringify_params({
			...h_params,
			within: 'popover',
		});

		// reserialize
		const p_url_popover = d_url_popover.toString();

		// attempt to open popover
		try {
			if(B_WEBEXT_ACTION) {
				await chrome.action.setPopup({
					popup: p_url_popover,
					tabId: gc_open.popover.tabId,
				});

				await chrome.action.openPopup({
					windowId: gc_open.popover.windowId,
				});
			}
			else if(B_WEBEXT_BROWSER_ACTION) {
				await chrome.browserAction.setPopup({
					popup: p_url_popover,
					tabId: gc_open.popover.tabId,
				});

				await (chrome.browserAction as BrowserAction.Static).openPopup();
			}
			else {
				throw new Error('no action available');
			}

			// popover is not referencable
			return {
				window: null,
				tab: null,
			};
		}
		// error opening popover, user may have navigated to other tab
		catch(e_open) {
			// procced with fallback
			console.warn(`Popover attempt failed: ${e_open}; using fallback`);
		}
		// reset popover
		finally {
			if(B_WEBEXT_ACTION) {
				void chrome.action.setPopup({
					popup: P_POPUP,
					tabId: gc_open.popover.tabId,
				});
			}
			else if(B_WEBEXT_BROWSER_ACTION) {
				void chrome.browserAction.setPopup({
					popup: P_POPUP,
					tabId: gc_open.popover.tabId,
				});
			}
		}
	}

	// within pwa
	if(B_WITHIN_PWA) {
		debugger;

		// prep URL
		const f_url = (h_hash_params: Dict) => `https://launch.starshell.net/?pwa#${new URLSearchParams(Object.entries({
			flow: p_url,
			...h_hash_params,
		}))}`;

		// sign URL
		const p_presigned = f_url({});
		const {Vault} = await import('#/crypto/vault');
		const atu8_signature = await Vault.symmetricSign(text_to_buffer(p_presigned));

		// append to hash params
		const p_signed = f_url({
			signature: buffer_to_base64(atu8_signature),
		});

		// // open as if a remote page
		// window.open(p_signed, '_blank');

		// instruct top to open popup
		(window.top as Vocab.TypedWindow<Pwa.IframeToTop>).postMessage({
			type: 'openPopup',
			value: p_url,
		}, 'https://launch.starshell.net');

		return {
			window: null,
			tab: null,
		};
	}
	// windows is available
	else if('function' === typeof chrome.windows?.create && !gc_open?.tab) {
		// extend search params
		h_params.within = 'popout';

		// update url
		d_url.search = new URLSearchParams(h_params as Dict).toString();

		// reserialize
		p_url = d_url.toString();

		// set dimensinos
		const n_px_width = gc_open?.width || N_PX_WIDTH_POPOUT;
		const n_px_height = gc_open?.height || N_PX_HEIGHT_POPOUT;

		// whether position should be centered
		const b_centered = true === g_window_position.centered;

		// window position top
		let n_px_top = 0;
		if('number' === typeof g_window_position.top) {
			n_px_top = Math.round(g_window_position.top - (b_centered? n_px_height / 2: 0));
		}

		// window position left
		let n_px_left = 0;
		if('number' === typeof g_window_position.left) {
			n_px_left = Math.round(g_window_position.left - (b_centered || g_window_position.centered_x? n_px_width / 2: 0));
		}

		// create window
		const g_window = await chrome.windows.create({
			type: gc_open?.chrome? 'normal': 'popup',
			url: p_url,
			focused: true,
			width: n_px_width,
			height: n_px_height,
			top: n_px_top,
			left: n_px_left,
		});

		// window was not created
		if('number' !== typeof g_window.id) {
			throw new Error('Failed to create popup window');
		}

		try {
			// fetch its view
			const dv_popup = await chrome.windows.get(g_window.id);

			// no view
			if(!dv_popup) {
				throw new Error('Failed to locate popup window');
			}

			// wait for tab to load
			const dt_created: chrome.tabs.Tab = await new Promise((fk_created) => {
				// tab update event
				chrome.tabs.onUpdated.addListener(function tab_update(i_tab, g_info, dt_updated) {
					// is the target tab
					if(g_window.id === dt_updated.windowId && 'number' === typeof i_tab) {
						// loading compelted
						if('complete' === g_info.status) {
							// remove listener
							chrome.tabs.onUpdated.removeListener(tab_update);

							// resolve promise
							fk_created(dt_updated);
						}
					}
				});
			});

			return {
				window: g_window,
				tab: dt_created,
			};
		}
		catch(e_create) {
			console.warn({
				e_create,
			});
		}
	}

	// cannot create windows, but can create tabs
	if('function' === typeof chrome.tabs?.create) {
		// set viewing mode
		h_params.within = 'tab';

		// reserialize url
		d_url.search = stringify_params(h_params);

		return {
			window: null,
			tab: await chrome.tabs.create({
				url: d_url.toString(),
			}),
		};
	}
	// open as link
	else {
		// within iOS native
		if(B_IOS_NATIVE || B_ANDROID_NATIVE) {
			// extend search params by copying `within` query parameter
			h_params.within = H_PARAMS.within;

			// update url
			d_url.search = new URLSearchParams(h_params as Dict).toString();

			// reserialize
			p_url = d_url.toString();
		}

		// treat as external link
		void open_external_link(p_url);

		return {
			window: null,
			tab: null,
		};
	}
}



// type aliases
interface StorageChange<w_value extends JsonValue> extends chrome.storage.StorageChange {
	newValue?: w_value;
	oldValue?: w_value;
}

type StorageArea = 'local' | 'session' | 'sync' | 'managed';

const H_STORAGE_SCHEMAS = {
	sync: {
		keplr_polyfill: {},
	},
	local: {
		// apps: {},
	},
	session: {},
	managed: {},
} as const;

type StorageListener<
	si_area extends StorageArea,
> = si_area extends StorageArea
	? Record<keyof typeof H_STORAGE_SCHEMAS[si_area], (g_change: StorageChange<SV_KeplrPolyfill>) => Promise<void>>
	: void;

type StorageListenerMap = {
	[si_area in StorageArea]?: StorageListener<si_area>;
};

type SV_KeplrPolyfill = boolean;


type StorageChangeCallback = (g_change: chrome.storage.StorageChange) => Promisable<void>;

const g_awaiters: Record<StorageArea, Dict<StorageChangeCallback[]>> = {
	sync: {},
	local: {},
	session: {},
	managed: {},
};

export function once_storage_changes(si_area: StorageArea, si_key: string, xt_timeout=0): Promise<chrome.storage.StorageChange> {
	return new Promise((fk_resolve, fe_reject) => {
		const h_awaiters = g_awaiters[si_area];
		const a_awaiters = h_awaiters[si_key] = h_awaiters[si_key] || [];

		let i_awaiter = -1;
		let i_timeout = 0;
		if(xt_timeout > 0) {
			i_timeout = (globalThis as typeof window).setTimeout(() => {
				// remove awaiter
				a_awaiters.splice(i_awaiter, 1);

				// reject
				fe_reject(new Error(`Timed out`));
			}, xt_timeout);
		}

		i_awaiter = a_awaiters.push((g_change) => {
			globalThis.clearTimeout(i_timeout);
			fk_resolve(g_change);
		});
	});
}

function fire_storage_change(si_area: StorageArea, si_key: string, g_change: chrome.storage.StorageChange) {
	const h_awaiters = g_awaiters[si_area];
	const a_awaiters = h_awaiters[si_key];

	if(a_awaiters?.length) {
		// reset awaiters
		h_awaiters[si_key] = [];

		// call each listener
		for(const f_awaiter of a_awaiters) {
			void f_awaiter(g_change);
		}
	}
}

// 
chrome.storage.onChanged?.addListener((h_changes, si_area) => {
	const H_STORAGE_LISTENERS: StorageListenerMap = {
		sync: {
			// // 
			// keplr_polyfill(g_change) {
			// 	return set_keplr_polyfill(g_change.newValue || false);
			// },

		},

		// // local storage area change listener
		local: {},

		session: {},

		managed: {},
	};

	// lookup namespace-specific listener dict
	const h_listeners = H_STORAGE_LISTENERS[si_area];

	// listeners available
	if(h_listeners) {
		// each change changes
		for(const si_key in h_changes) {
			const g_change = h_changes[si_key];

			// fire awaiter callbacks first
			fire_storage_change(si_area, si_key, g_change);

			// listener exists for this key
			const f_listener = h_listeners[si_key];
			if(f_listener) {
				f_listener(g_change);
			}
		}
	}
});


export async function try_reloading_page(g_page: {tabId?: number|undefined}): Promise<boolean> {
	if(!g_page?.tabId) return false;

	// attempt to reload the tab
	try {
		await chrome.tabs.reload(g_page.tabId);
		return true;
	}
	catch(e_reload) {}

	return false;
}


export async function read_clipboard(): Promise<string | null> {
	try {
		// new service client
		const k_client = await ServiceClient.connect('self');

		// attempt to read from clipboard
		const [s_data, xc_timeout] = await timeout_exec(6e3, () => k_client.request({
			type: 'readClipboard',
			value: {
				format: 'text',
			},
		}));

		// service is dead
		if(xc_timeout) throw new Error(`Timed out while trying to read clipboard`);

		// attempt to close the client
		try {
			k_client.close();
		}
		catch(e_close) {}

		// return
		return s_data as string;
	}
	// service is dead or unreachable
	catch(e_connect) {
		console.warn({e_connect});
	}

	// nothing
	return null;
}


export async function write_clipboard(s_text: string): Promise<string | null> {
	try {
		// new service client
		const k_client = await ServiceClient.connect('self');

		// attempt to read from clipboard
		const [s_data, xc_timeout] = await timeout_exec(6e3, () => k_client.request({
			type: 'writeClipboard',
			value: {
				format: 'text',
				data: s_text,
			},
		}));

		// service is dead
		if(xc_timeout) throw new Error(`Timed out while trying to write clipboard`);

		// attempt to close the client
		try {
			k_client.close();
		}
		catch(e_close) {}

		// return
		return s_data as string;
	}
	// service is dead or unreachable
	catch(e_connect) {
		console.warn({e_connect});
	}

	// nothing
	return null;
}
