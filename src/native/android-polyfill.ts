/* eslint-disable @typescript-eslint/naming-convention */

import { MemStore } from '#/app/mem-store';
import type { WebKitMessageHandlerKey, WebKitMessageHandlerRegsitry } from '#/env';
import type { Dict, JsonValue, Nilable, Promisable } from '#/meta/belt';
import type { Vocab } from '#/meta/vocab';
import type { ExtToNative, IntraExt, IntraView } from '#/script/messages';
import { B_ANDROID_NATIVE, B_CHROMIUM_ANDROID, B_DEFINED_ANDROID, B_DEFINED_WINDOW, B_MOBILE_WEBKIT_VIEW } from '#/share/constants';
import { F_IDENTITY, defer, fodemtv, timeout, timeout_exec } from '#/util/belt';
import { buffer_to_base64, text_to_base64, uuid_v4 } from '#/util/data';
import { dd } from '#/util/dom';
import { Listener } from './listener';

type StorageArea = 'local' | 'session';

declare const android: {
	storage_get(si_token: string, si_area: StorageArea, a_keys: null | string[]): void;
	storage_set(si_token: string, si_area: StorageArea, sx_data: string): void;
	storage_remove(si_token: string, si_area: StorageArea, a_keys: string[]): void;
	storage_clear(si_token: string, si_area: StorageArea): void;

	notifications_create(si_token: string, si_notification: string, sx_config: string): void;
	notifications_clear(si_token: string, si_notification: string): void;

	proxied_fetch(si_token: string, p_url: string, sx_req: string): void;
	open(si_token: string, p_url: string);
	post(si_token: string, sx_data: string): void;

	clipboard_write(si_token: string, s_text: string): void;
	clipboard_read(si_token: string): void;
};

interface Window {
	android_callback(si_token: string, w_response: any): void;
}

let debug = (s: string, ...a_args: any[]) => console.debug(`StarShell?foreground: ${s}`, ...a_args);


const B_STARSHELL_APP_BACKGROUND = B_MOBILE_WEBKIT_VIEW && location.pathname.endsWith('/background.html');
const B_STARSHELL_APP_NAVIGATION = B_MOBILE_WEBKIT_VIEW && location.pathname.endsWith('/navigation.html');
const B_STARSHELL_APP_FLOW = B_MOBILE_WEBKIT_VIEW && location.pathname.endsWith('/flow.html');

const B_STARSHELL_APP_TOP_IS_NAV = B_MOBILE_WEBKIT_VIEW && B_DEFINED_WINDOW && new URL(window.top!.location.href).pathname.endsWith('/navigation.html');

const B_STARSHELL_APP_BG_HOST = B_MOBILE_WEBKIT_VIEW && ((d_frames) => {
	for(let i_frame=0; i_frame<d_frames.length || 0; i_frame++) {
		if(new URL(d_frames[i_frame].location.href).pathname.endsWith('/background.html')) return true;
	}

	return !!globalThis['STARSHELL_IS_BACKGROUND_HOST'];
})(globalThis.window?.top?.frames || []);

const SI_FRAME = uuid_v4();


const h_callbacks = {};


const G_SENDER_SELF: chrome.runtime.MessageSender = {
	id: 'starshell-android',
	url: location.href,
	origin: 'starshell',
};


export class AndroidMessenger<
	si_handler extends WebKitMessageHandlerKey=WebKitMessageHandlerKey,
> {
	constructor(protected _si_handler: si_handler, protected _b_unidirectional=false) {}

	post<
		w_return extends JsonValue=undefined,
	>(g_msg: typeof webkit['messageHandlers'][si_handler], b_unidirectional=this._b_unidirectional): Promise<w_return> {
		return cbtj(si => android.post(si, JSON.stringify({
			id: this._si_handler,
			data: g_msg,
		})));
	}
}


/**
 * Emulates the behavior of chrome.runtime.Port for foreground <=> background connections
 */
function emulate_port(
	d_background: Vocab.TypedBroadcast<IntraExt.WebKitGlobal>,
	kl_connect: Listener<chrome.runtime.ExtensionConnectEvent>,
	si_name: string,
	a_ports: Nilable<readonly MessagePort[]>=null
) {
	// create a listener for each type of event that can occur on Port
	const kl_disconnect = new Listener<chrome.runtime.PortDisconnectEvent>('port.disconnect');
	const kl_message = new Listener<chrome.runtime.PortMessageEvent>('port.message');

	// access the local port
	let d_port = a_ports?.[0]!;  // eslint-disable-line @typescript-eslint/no-non-null-asserted-optional-chain

	// background page
	let d_window_bg: Nilable<Window> = null;
	let [dp_find_bg, fk_found_bg] = defer();

	// initialize channel and ports
	let b_initializer = false;
	if(!d_port) {
		b_initializer = true;

		// create a new channel that will be used to communicate between the two parties
		const d_channel: Vocab.TypedChannel<IntraExt.WebKitDirect> = new MessageChannel();

		// save local port
		d_port = d_channel.port1;

		const f_find_background_frame = () => [window.top!, ...Array.from(window.top!.frames)].find(d_window => d_window.location.pathname.endsWith('/background.html'));

		// find background frame
		d_window_bg = f_find_background_frame();

		// go async
		void (async() => {
			if(!d_window_bg) {
				// wait up to 3 seconds for background frame to appear
				const [dm_iframe, xc_timeout] = await timeout_exec<HTMLIFrameElement>(3e3, () => new Promise((fk_resolve) => {
					const d_observer = new MutationObserver((d_list: MutationRecord[]) => {
						for(const d_mutation of Array.from(d_list)) {
							for(const dm_node of Array.from(d_mutation.addedNodes)) {
								if(dm_node instanceof Element && 'IFRAME' === dm_node.tagName && dm_node.getAttribute('src')?.startsWith('/background.html')) {
									// stop observing
									d_observer.disconnect();

									// resolve promise
									fk_resolve(dm_node as HTMLIFrameElement);

									// exit callback
									return;
								}
							}
						}
					});

					// start observing document body for childlist mutations
					d_observer.observe(document.body, {
						childList: true,
					});
				}));

				console.debug({
					dm_iframe,
					xc_timeout,
				});

				// iframe element added
				if(dm_iframe) {
					d_window_bg = dm_iframe.contentWindow;

					// window still initializing
					if(!d_window_bg) {
						const xt_start = performance.now();

						// continually check for window init
						for(;;) {
							// 0.5s interval
							await timeout(500);

							// window is set
							if((d_window_bg=dm_iframe.contentWindow)) break;

							// maximum of 10 seconds
							if(performance.now() - xt_start > 10e3) break;
						}
					}

					// wait for it to come online
					await timeout_exec(10e3, () => new Promise((fk_resolve) => {
						function online_monitor(d_event) {
							const {
								type: si_type,
							} = d_event.data;

							if('online' === si_type) {
								d_background.removeEventListener('message', online_monitor);

								fk_resolve(void 0);
							}
						}

						d_background.addEventListener('message', online_monitor);
					}));
				}
				// mutation attempt timed out
				else {
					// final effort to find background frame
					d_window_bg = f_find_background_frame();
				}

				// still not found
				if(!d_window_bg) {
					throw new Error(`Failed to find background frame in current page`);
				}
			}

			// send remote port
			d_window_bg.postMessage({
				type: 'connect',
				value: {
					name: si_name,
				},
			}, location.origin, [d_channel.port2]);

			// resolve promise
			fk_found_bg(d_window_bg);
		})();
	}

	// gracefully close the port
	const close_port = () => {
		// close the underlying channel
		d_port?.close();

		// dispatch the disconnect event
		kl_disconnect.dispatch(g_port);
	};

	// create port
	const g_port = {
		name: si_name,

		onDisconnect: kl_disconnect.polyfill(),
		onMessage: kl_message.polyfill(),

		/**
		 * Instructs the port to close
		 */
		disconnect() {
			// send disconnect frame to notify other party
			d_port.postMessage({
				type: 'disconnect',
			});

			// close the port
			close_port();
		},

		/**
		 * Sends a message to the other party
		 */
		postMessage(w_message: JsonValue) {
			// go async
			void (async() => {
				// no background page; wait for it to load
				if(!d_window_bg && !B_STARSHELL_APP_BACKGROUND) {
					await dp_find_bg;
				}

				// send message over channel
				d_port.postMessage({
					type: 'message',
					value: w_message,
				});
			})();
		},
	};

	// message handlers
	const h_handlers = {
		// other end is disconnecting
		disconnect: close_port,

		// handle incoming message
		message(g_msg) {
			kl_message.dispatch(g_msg, {
				...g_port,
				sender: G_SENDER_SELF,
			});
		},
	};

	// register for message events
	d_port.onmessage = (d_event: MessageEvent) => {
		const {
			type: si_type,
			value: w_value,
		} = d_event.data;

		h_handlers[si_type]?.(w_value);
	};

	// background received connection
	if(!b_initializer) {
		kl_connect.dispatch({
			...g_port,
			sender: G_SENDER_SELF,
		});
	}

	return {
		d_port,
		kl_disconnect,
		kl_message,
		g_port,
		close_port,
	};
}

const B_TOP = B_DEFINED_WINDOW && window === window.top;
const B_INDEX = (() => {
	try {
		return B_DEFINED_WINDOW && Array.from(window.top?.frames || []).indexOf(window);
	}
	catch(e_frame) {
		return false;
	}
})();

async function cbt<
	w_out,
>(fk_exec: (si_token: string) => void, f_transform=F_IDENTITY): Promise<w_out> {
	const si_token = `${B_TOP? 'top': B_INDEX}.${uuid_v4()}`;

	return new Promise((fk_resolve) => {
		h_callbacks[si_token] = (w_result: any) => fk_resolve(f_transform(w_result));
		fk_exec(si_token);
	});
}

const cbtj = async<
	w_out,
>(fk_exec: (si_token: string) => void) => cbt<w_out>(fk_exec, w_result => w_result? fodemtv(w_result, (sx_value: string) => {
	try {
		return JSON.parse(sx_value);
	}
	catch(e_parse) {
		debugger;
		throw new Error(`Failed to parse JSON response from android:\n${sx_value}`);
	}
}): w_result);

const transform_data = (h_data: Record<string, any>) => JSON.stringify(fodemtv(h_data, w_value => JSON.stringify(w_value)));


export function do_android_polyfill(g_target: Record<string, any>=globalThis, f_debug?: typeof debug, g_extend?: Partial<typeof window>): typeof g_target {
	// wrong scope
	if(!B_DEFINED_WINDOW) return;

	// not in an android environment; do not polyfill
	if(!B_ANDROID_NATIVE || android.dapp) return;

	// already polyfilled
	if('undefined' !== typeof g_target.chrome?.['_polyfilled']) return;


	// the global channel used for sending/receiving control messages to/fro background frame
	const d_background: Vocab.TypedBroadcast<IntraExt.WebKitGlobal> = new BroadcastChannel('android-background');


	// // load background frame
	// {
	// 	Object.assign(globalThis, {
	// 		STARSHELL_IS_BACKGROUND_HOST: true,
	// 	});;

	// 	const dm_background = dd('iframe', {
	// 		src: '/background.html?within=webview',
	// 		style: `
	// 			display: none;
	// 		`,
	// 	});

	// 	function startup() {
	// 		document.body.append(dm_background);
	// 	}

	// 	if('loading' !== document.readyState) {
	// 		startup();
	// 	}
	// 	else {
	// 		window.addEventListener('DOMContentLoaded', startup);
	// 	}
	// }

	const kl_storage_changed = new Listener<chrome.storage.StorageChangedEvent>('storage.change');

	const G_LOCAL = {
		get: (z_keys: string | string[]): Promise<Record<string, string>> => cbtj<Record<string, string>>(si => android.storage_get(si, 'local', null === z_keys? null: Array.isArray(z_keys)? z_keys: [z_keys])),
		set: (h_data: Record<string, any>): Promise<void> => cbt<void>(si => android.storage_set(si, 'local', transform_data(h_data))),
		remove: (z_keys: string | string[]): Promise<void> => cbt<void>(si => android.storage_remove(si, 'local', Array.isArray(z_keys)? z_keys: [z_keys])),
		clear: (): Promise<void> => cbt<void>(si => android.storage_clear(si, 'local')),
	};

	const G_SESSION = {
		get: (z_keys: string | string[]): Promise<Record<string, string>> => cbtj<Record<string, string>>(si => android.storage_get(si, 'session', null === z_keys? null: Array.isArray(z_keys)? z_keys: [z_keys])),
		set: (h_data: Record<string, any>): Promise<void> => cbt<void>(si => android.storage_set(si, 'session', JSON.stringify(fodemtv(h_data, w_value => JSON.stringify(w_value))))),
		remove: (z_keys: string | string[]): Promise<void> => cbt<void>(si => android.storage_remove(si, 'session', Array.isArray(z_keys)? z_keys: [z_keys])),
		clear: (): Promise<void> => cbt<void>(si => android.storage_clear(si, 'session')),
	};

	// ref original fetch function
	const f_fetch = fetch;
	g_target.rawFetch = f_fetch;

	// define patched version
	async function fetch_patched(z_input: RequestInfo | URL, w_init?: RequestInit): Promise<Response> {
		let d_url: URL;

		// normalize url arg
		if('string' === typeof z_input) {
			d_url = new URL(z_input, location.href);
		}
		// url instance
		else if(z_input instanceof URL) {
			d_url = z_input;
		}
		// request object
		else if('string' === typeof z_input?.url) {
			d_url = new URL(z_input.url, location.href);

			// merge options
			w_init = {
				headers: z_input.headers,
				integrity: z_input.integrity,
				method: z_input.method,
				redirect: z_input.redirect,
				body: z_input.body,
				...w_init,
			};
		}
		// other
		else {
			throw new TypeError(`Unsupported URL argument type: ${z_input}`);
		}

		// 
		if('https:' === d_url.protocol) {
			// remote resource
			if('starshell' !== d_url.host) {
				// serialize body if present
				const gc_init = {...w_init};

				// init given
				if(w_init) {
					// serialize body
					if(w_init.body) {
						if(w_init.body instanceof Uint8Array) {
							gc_init.body = buffer_to_base64(w_init.body);
						}
						// string
						else if('string' === typeof w_init.body) {
							gc_init.body = text_to_base64(w_init.body);
						}
						// unhandled
						else {
							debugger;
							console.error(`Unhandled body data type `, gc_init.body);
						}
					}

					// serialize headers
					if(w_init.headers?.[Symbol.iterator]) {
						gc_init.headers = Object.fromEntries([...w_init.headers as Iterable<[string, string]>]);
					}
				}

				// submit request
				const [si_token, s_error] = await cbt<[string, string | undefined]>(si => android.proxied_fetch(si, d_url.toString(), JSON.stringify(gc_init)));

				// there was an error
				if(s_error) throw new Error(s_error as string);

				// resolve queued response
				return f_fetch(`https://starshell/.queued/${si_token}`);
			}
		}

		// process as normal
		return f_fetch(z_input, w_init);
	}

	// overwrite global fetch
	g_target.fetch = fetch_patched;

	// overwrite close
	if(g_target['location']) {
		g_target.close = () => {
			location.reload();
		};
	}

	let g_webext_runtime = {

	};


	// runtime messenger applies to both foreground and background, allowing them to exchange messages
	if(B_STARSHELL_APP_BG_HOST) {
		// outgoing runtime message id issuer
		let c_msgs_runtime = 0;

		// set runtime methods
		g_webext_runtime = {
			// sendMessage(g_msg: JsonValue): Promise<any> {
			// 	return new Promise((fk_resolve) => {
			// 		// generate unique message id
			// 		const si_msg = `${SI_FRAME}:runtime:${++c_msgs_runtime}`;

			// 		// prepare single message
			// 		const g_send = {
			// 			id: si_msg,
			// 			sender: G_SENDER_SELF,
			// 			data: g_msg,
			// 		};

			// 		// associate callback listener
			// 		h_response_handlers[si_msg] = fk_resolve;

			// 		// send message
			// 		return d_background.postMessage({
			// 			type: 'sendMessage',
			// 			value: g_send,
			// 		});
			// 	});
			// },

			// sendNativeMessage(g_msg: JsonValue): Promise<any> {
			// 	// TODO: setup response handling and message id
			// 	return k_native.post({
			// 		data: g_msg,
			// 		sender: G_SENDER_SELF,
			// 	});
			// },

			// x@ts-expect-error overloaded
			connect(gc_connect?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
				const si_name = gc_connect?.name || uuid_v4();

				const {
					g_port,
				} = emulate_port(d_background, kl_runtime_connect, si_name);

				return g_port;
			},
		};
	}
	else {
		g_webext_runtime = {
			connect() {
				console.error(`Attempted to connect to service in non-bg host frame ${location.href}`);
			},
		};
	}

	// runtime message listeners for background
	const kl_runtime_connect = new Listener<chrome.runtime.ExtensionConnectEvent>('runtime.connect');
	const kl_runtime_message = new Listener<chrome.runtime.ExtensionMessageEvent>('runtime.message');
	const kl_notification_click = new Listener<chrome.notifications.NotificationClickedEvent>('notification.click');

	// response handlers
	const h_response_handlers = {};

	// background page
	debug(`Android polyfill: Is background page? ${B_STARSHELL_APP_BACKGROUND}`);
	if(B_STARSHELL_APP_BACKGROUND) {
		// listen for native messages from iOS
		addEventListener('@native', (d_event: CustomEvent<any>) => {
			const {
				type: si_type,
				value: z_value,
			} = d_event.detail;

			if('notificationClicked' === si_type && 'string' === typeof z_value) {
				kl_notification_click.dispatch(z_value);
			}
		});

		// const k_runtime_response = new WebKitMessenger('runtime_response', true);

		// listen for messages coming from content scripts in the isolated world
		addEventListener('@runtime', (d_event: CustomEvent<{
			id: string;
			sender: chrome.runtime.MessageSender;
			data: Vocab.Message<IntraView.DirectedToBackgroundVocab>;
		}>) => {
			const {
				id: si_msg,
				sender: g_sender,
				data: g_data,
			} = d_event.detail;

			// route message
			const {
				type: si_type,
				value: w_value,
			} = g_data;

			if('connect' === si_type) {
				// currently, no content scripts need to use runtime.connect
				debugger;
				// emulate_crossport(k_runtime_response, kl_runtime_connect, w_value.name);
			}
			// 
			else if('sendMessage' === si_type) {
				// dispatch message
				kl_runtime_message.dispatch(w_value, g_sender, (w_response) => {
					// send response
					void cbt(si => android.post(si, JSON.stringify({
						id: 'runtime_response',
						data: {
							token: si_msg,
							value: w_response,
						},
					})));
				});
			}
		});

		// window message from adjacent frame
		(window as Vocab.TypedWindow<IntraExt.WebKitGlobal>).addEventListener('message', (d_event) => {
			// reject foreign messages
			if(d_event.origin !== location.origin) return;

			// destructure data
			const {
				type: si_type,
				value: w_value,
			} = d_event.data;

			// new connection request from client
			if('connect' === si_type) {
				void emulate_port(d_background, kl_runtime_connect, w_value.name, d_event.ports);
			}
		});

		// setup host side of broadcast channel
		d_background.onmessage = (d_event) => {
			const g_msg = d_event.data;

			// // new connection request from client
			// if('connect' === g_msg.type) {
			// 	emulate_port(d_background, kl_runtime_connect, g_msg.value.name, d_event.ports);
			// }

			// generic message
			if('sendMessage' === g_msg.type) {
				const {
					id: si_msg,
					sender: g_sender,
					data: w_data,
				} = g_msg.value;

				// dispatch message
				kl_runtime_message.dispatch(w_data, g_sender as chrome.runtime.MessageSender, (w_response) => {
					// send response
					d_background.postMessage({
						type: 'respondMessage',
						value: {
							id: si_msg,
							sender: G_SENDER_SELF,
							data: w_response,
						},
					});
				});
			}
			else {
				debugger;
				console.log(`Unhandled message to background: %o`, g_msg);
			}
		};

		// notify top that background is online
		d_background.postMessage({
			type: 'online',
		});
	}
	// in foreground
	else {
		// register message handler on broadcast channel
		d_background.addEventListener('message', (d_event) => {
			const g_msg = d_event.data;

			// message response
			if('respondMessage' === g_msg.type) {
				const {
					id: si_msg,
					sender: g_sender,
					data: w_response,
				} = g_msg.value;

				// route response to handler
				h_response_handlers[si_msg]?.(w_response);
			}
		});
	}

	// TODO: this should be very different
	g_target.opener_handler = {
		post: (gc_post) => cbt(si => android.open(si, gc_post.args[0])),
	};

	// attempt to load manifest
	try {
		fetch('/manifest.json').then(d_res => d_res.json()).then((g_manifest: chrome.runtime.Manifest) => {
			chrome.runtime.getManifest = () => g_manifest;
		}).catch(() => {/**/});
	}
	catch(e_scheme) {}

	if(B_STARSHELL_APP_NAVIGATION) {
		// sending navigation commands to host
		const k_navigation = new AndroidMessenger('navigation', true);
		globalThis.navigation_handler = k_navigation;

		// local copy of navigation model state
		const yw_state = g_target.navigation_model_state = new MemStore<WebKitMessageHandlerRegsitry['model']['state']>({
			url: '',
			title: '',
			stage: 'unknown',
			account: '',
			chain: '',
		});

		// init model state
		void (async() => {
			try {
				const {Settings} = await import('#/store/settings');

				const ks_settings = await Settings.read();

				// select account from context, or last used account
				const p_account = ks_settings.get('p_account_selected');

				// select chain from context, or last used chain
				const p_chain = ks_settings.get('p_chain_selected');

				await yw_state.update(g => ({
					...g,
					account: p_account || '',
					chain: p_chain || '',
				}));
			}
			catch(e_settings) {}
		})();

		// receiving navigation updates from host
		addEventListener('@model', (d_event: CustomEvent<WebKitMessageHandlerRegsitry['model']>) => {
			const {
				state: h_update,
			} = d_event.detail;

			console.debug(`Service received model message from android host: %o`, h_update);

			// update local model state
			void yw_state.update(_h_state => ({
				..._h_state,
				...h_update,
			}));
		});

		// local copy of browsing context
		const yw_browsing_context = g_target.browsing_context = new MemStore<ExtToNative.BrowsingContext>({
			href: '',
			name: '',
			description: '',
		});

		// receiving messsages from witness
		addEventListener('@witness', (d_event: CustomEvent<WebKitMessageHandlerRegsitry['witness']>) => {
			const {
				type: si_type,
				value: g_value,
			} = d_event.detail;

			console.debug(`Service received witness message from android host: %o`, d_event.detail);

			// debugger;

			// context capture message
			if('capture' === si_type) {
				// update local browsing context
				void yw_browsing_context.update(g => ({
					...g,
					...g_value.browsing_context,
				}));
			}
		});
	}

	if(!g_target.navigator) g_target.navigator = {};
	if(!g_target.navigator.clipboard) g_target.navigator.clipboard = {};
	Object.assign(g_target.navigator.clipboard, {
		writeText: (s_text: string) => cbt(si => android.clipboard_write(si, s_text)),
		readText: () => cbt(si => android.clipboard_read(si)),
	});

	return Object.assign(g_target, {
		...g_extend,

		android_callback(si_token, w_response) {
			const f_callback = h_callbacks[si_token];

			if(f_callback) {
				h_callbacks[si_token]?.(w_response);
				delete h_callbacks[si_token];
			}
			else {
				debugger;
				console.warn(`Callback handler not found! `, si_token, w_response);
			}
		},

		chrome: {
			...g_extend?.chrome,

			_polyfilled: true,

			_original: g_target['chrome'],

			storage: {
				...g_extend?.chrome?.storage,

				onChanged: kl_storage_changed.polyfill(),

				local: G_LOCAL,

				session: G_SESSION,
			},

			notifications: {
				onClicked: kl_notification_click.polyfill(),

				async create(si_notification: string, gc_notification: chrome.notifications.NotificationOptions, fk_created?: (si_confirmed: string) => void): Promise<void> {
					if(!si_notification) si_notification = uuid_v4();

					await cbt(si => android.notifications_create(si, si_notification, JSON.stringify(gc_notification)));

					fk_created?.(si_notification);
				},

				// no-op
				async clear(si_notification: string, fk_cleared?: (b_cleared: boolean) => void): Promise<void> {
					await cbt(si => android.notifications_clear(si, si_notification));

					fk_cleared?.(true);
				},
			},

			runtime: {
				...g_extend?.chrome?.runtime,

				id: 'starshell-android',

				onConnect: kl_runtime_connect.polyfill(),

				onMessage: kl_runtime_message.polyfill(),

				...g_webext_runtime,

				getBackgroundPage() {
					throw new Error(`Cannot access background page`);
				},

				getManifest() {
					return __G_MANIFEST;
				},

				getURL(p_asset: string) {
					return `https://starshell/${p_asset.replace(/^\//, '')}`;
				},

				reload() {
					// background host
					if(B_STARSHELL_APP_BG_HOST) {
						// remove background page(s)
						for(const dm_background of Array.from(document.body.querySelectorAll('iframe.background-service'))) {
							dm_background.remove();
						}

						// re-initialize
						const dm_background = dd('iframe', {
							src: '/background.html?within=webview',
							style: `
								display: none;
							`,
						});

						// add to page
						document.body.append(dm_background);

						return;
					}
					// self background; reload
					else if(B_STARSHELL_APP_BACKGROUND) {
						debugger;
						location.reload();
					}

					console.warn(`Cannot restart runtime from current frame: ${location.href}`);
				},
			},

			scripting: {
				...g_extend?.chrome?.scripting,


			},
		},

		...B_STARSHELL_APP_TOP_IS_NAV? {
			open(p_open: string, ...a_args: any[]) {
				// capture opens and replay laterally on top frame
				window.top!.dispatchEvent(new CustomEvent('@opener', {
					detail: {
						url: p_open,
						args: a_args,
					},
				}));
			},
		}: {
			open: (p_open: string, ...a_args: any[]) => cbt(si => android.open(si, p_open)),
		},
	});
}