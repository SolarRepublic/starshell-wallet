import type {Dict, JsonValue} from './meta/belt';
import type Browser from 'webextension-polyfill';

import {B_LOCALHOST} from './share/constants';

import {
	ode,
	fold,
} from './util/belt';

// TODO: incorporate import.meta.env.DEV
if(B_LOCALHOST) {
	const d_chrome = globalThis['chrome'];

	// polyfill storage
	if(!d_chrome['storage']) {
		function polyfill_chrome_storage(si_area: chrome.storage.AreaName): chrome.storage.StorageArea {
			return {
				/* eslint-disable @typescript-eslint/require-await */
				async get(z_keys: null | string | string[]=null, fk_respond?: (h_store: Dict<JsonValue | undefined>) => void): Promise<Dict<JsonValue | undefined>> {
					if(null === z_keys) {
						z_keys = [];
						for(let i_key=0; i_key<localStorage.length; i_key++) {
							const si_key = localStorage.key(i_key);
							if(si_key?.startsWith(`chrome.${si_area}:`)) {
								z_keys.push(si_key.replace(/^chrome\.[^:]+:/, ''));
							}
						}
					}

					const a_keys = Array.isArray(z_keys)? z_keys: [z_keys];
					const h_store = fold(a_keys, (si_key) => {
						const z_value = localStorage.getItem(`chrome.${si_area}:${si_key}`);
						return {
							[si_key]: 'string' === typeof z_value? JSON.parse(z_value) as JsonValue: void 0,
						};
					});

					fk_respond?.(h_store);
					return h_store;
				},

				async set(h_set: Dict<JsonValue | undefined>, fk_respond?: VoidCallback): Promise<void> {
					for(const [si_key, w_value] of ode(h_set)) {
						localStorage.setItem(`chrome.${si_area}:${si_key}`, JSON.stringify(w_value));
					}

					fk_respond?.();
				},

				async clear(fk_callback?: VoidCallback): Promise<void> {
					const nl_items = localStorage.length;
					for(let i_item=nl_items; i_item>=0; i_item--) {
						const si_key = localStorage.key(i_item);
						if(!si_key) continue;
						if(si_key.startsWith(`chrome.${si_area}:`)) {
							localStorage.removeItem(si_key);
						}
					}

					fk_callback?.();
				},

				async remove(z_keys: string | string[], fk_callback?: VoidCallback): Promise<void> {
					const a_keys = Array.isArray(z_keys)? z_keys: [z_keys];
					for(const si_key of a_keys) {
						localStorage.removeItem(`chrome.${si_area}:${si_key}`);
					}

					fk_callback?.();
				},
				/* eslint-enable @typescript-eslint/require-await */
			};
		}

		d_chrome.storage = {
			local: polyfill_chrome_storage('local') as chrome.storage.LocalStorageArea,
			sync: polyfill_chrome_storage('sync') as chrome.storage.SyncStorageArea,
			session: polyfill_chrome_storage('session') as chrome.storage.SessionStorageArea,
		} as typeof chrome.storage;
	}

	// polyfill runtime
	if(!d_chrome['runtime']) {
		d_chrome.runtime = {
			getURL(p_asset: string): string {
				const d_url = new URL(location.href);
				if(p_asset.startsWith('./')) {
					// d_url.pathname = d_url.pathname.replace(/\/[^/]*$/, '')+p_asset.slice(1);
					d_url.pathname = '/assets/'+p_asset.slice(2);
				}
				else {
					d_url.pathname = p_asset;
				}

				d_url.hash = '';
				d_url.search = '';
				return ''+d_url;
			},

			getManifest(): chrome.runtime.Manifest {
				return __G_MANIFEST;
			},

			sendMessage(g_msg: JsonValue): Promise<void> {
				console.warn(`Service::sendMessage(${JSON.stringify(g_msg)})`);
				// debugger;
			},

			onMessage: {
				addListener(f_listener) {
					console.warn(`Service::onMessage(%o)`, f_listener);
					// debugger;
				},

				removeListener() {
					debugger;
				},
			},

			onInstalled: {
				addListener(f_listener) {
					// f_listener();
				},

				removeListener() {
					debugger;
				},
			},

			connect() {
				return {
					onDisconnect: {
						addListener() {},
					},
					onMessage: {
						addListener() {},
					},
					disconnect() {},
				};
			},
		};
	}

	// polyfill tabs
	if(!d_chrome['tabs']) {
		d_chrome.tabs = {
			create(gc_create?: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
				window.open(gc_create!.url, '_blank');
			},

			get(i_tab: number): Promise<chrome.tabs.Tab> {
				debugger;
			},

			reload(i_tab: number): Promise<void> {
				debugger;
			},

			onUpdated: {
				addEventListener() {
					debugger;
				},

				removeListener() {
					debugger;
				},
			},

			query() {},
		};
	}

	// polyfill windows
	if(!d_chrome['windows']) {
		d_chrome.windows = {
			// create(gc_create?: chrome.windows.CreateData): Promise<chrome.windows.Window> {
			// 	window.open(gc_create!.url as string, '_blank');
			// },

			get(i_window: number): Promise<chrome.windows.Window> {
				debugger;
			},

			remove(i_window: number): Promise<void> {
				debugger;
			},

			onRemoved: {
				addEventListener() {
					debugger;
				},

				removeListener() {
					debugger;
				},
			},
		};
	}

	// polyfill extension
	if(!d_chrome['extension']) {
		d_chrome.extension = {
			getBackgroundPage() {
				return {
					sessionStorage,
				};
			},
		};
	}

	// polyfill scripting
	if(!d_chrome['scripting']) {
		const a_registered: Browser.Scripting.RegisteredContentScript[] = [];

		d_chrome.scripting = {
			executeScript(): Promise<chrome.scripting.InjectionResult> {
				debugger;
			},

			registerContentScripts(a_add: Browser.Scripting.RegisteredContentScript[]): Promise<void> {
				a_registered.push(...a_add);
				return Promise.resolve(void 0);
			},

			getRegisteredContentScripts(): Promise<Browser.Scripting.RegisteredContentScript[]> {
				return Promise.resolve(a_registered);
			},
		};
	}
}
