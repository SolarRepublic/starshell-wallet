import type {ExtToNative, IntraExt, IntraView} from './messages';
import type {F} from 'ts-toolbelt';

import type {AsJson, Dict, JsonValue, Nilable, Promisable} from '#/meta/belt';
import type {Store, StoreKey} from '#/meta/store';
import type {Vocab} from '#/meta/vocab';

import {MemStore} from '#/app/mem-store';
import type {WebKitMessageHandlerKey, WebKitMessageHandlerRegsitry} from '#/env';
import {B_DEFINED_WINDOW, B_IOS_NATIVE, B_IOS_WEBEXT, B_IOS_WEBKIT, B_MOBILE_WEBKIT_VIEW} from '#/share/constants';

import {defer, timeout, timeout_exec} from '#/util/belt';
import {dd} from '#/util/dom';

let debug = (s: string, ...a_args: any[]) => console.debug(`StarShell?foreground: ${s}`, ...a_args);


const B_STARSHELL_APP_BACKGROUND = B_MOBILE_WEBKIT_VIEW && '/background.html' === location.pathname;
const B_STARSHELL_APP_NAVIGATION = B_MOBILE_WEBKIT_VIEW && location.pathname.endsWith('/navigation.html');
const B_STARSHELL_APP_FLOW = B_MOBILE_WEBKIT_VIEW && location.pathname.endsWith('/flow.html');

const B_STARSHELL_APP_TOP_IS_NAV = B_MOBILE_WEBKIT_VIEW && new URL(window.top!.location.href).pathname.endsWith('/navigation.html');

const B_STARSHELL_APP_BG_HOST = B_MOBILE_WEBKIT_VIEW && ((d_frames) => {
	for(let i_frame=0; i_frame<d_frames.length || 0; i_frame++) {
		if('/background.html' === new URL(d_frames[i_frame].location.href).pathname) return true;
	}

	return !!globalThis['STARSHELL_IS_BACKGROUND_HOST'];
})(globalThis.window?.top?.frames || []);

const SI_FRAME = crypto.randomUUID();

export class WebKitMessenger<
	si_handler extends WebKitMessageHandlerKey=WebKitMessageHandlerKey,
> {
	protected _h_pending: Dict<(w_response: any) => Promisable<void>> = {};
	protected _c_msgs = 0;

	constructor(protected _si_handler: si_handler, protected _b_unidirectional=false) {
		// listen for responses
		if(!_b_unidirectional) {
			debug(`Registered for '${_si_handler}' events`);
			addEventListener(`@${_si_handler}`, (d_event: CustomEvent) => {
				const g_msg = d_event.detail;

				// debug(`Received webkit '${_si_handler}' event: %o`, g_msg);
				// debug(`Pending '${_si_handler}' listeners: %o`, this._h_pending);

				const si_response = g_msg.id;

				const f_respond = this._h_pending[si_response];
				if(f_respond) {
					delete this._h_pending[si_response];

					void f_respond(g_msg.data);
				}
			});
		}

		this._h_pending = globalThis[`_h_pending${_si_handler}`] = {};
	}

	post<
		w_return extends JsonValue=undefined,
	>(g_msg: typeof webkit['messageHandlers'][si_handler], b_unidirectional=this._b_unidirectional): Promise<w_return> {
		const si_msg = SI_FRAME+'.'+this._c_msgs++;

		return new Promise((fk_resolve) => {
			if(!b_unidirectional) {
				this._h_pending[si_msg] = (w_data: any) => {
					fk_resolve(w_data as w_return);
				};
			}

			// debug(`[${si_msg}] Posting message to webkit '${this._si_handler}' handler: %o`, g_msg);

			const f_handler = webkit.messageHandlers[this._si_handler];

			if(!f_handler) {
				throw new Error(`No webkit handler defined for '${this._si_handler}'`);
			}

			f_handler.postMessage({
				id: si_msg,
				...g_msg,
			});

			if(b_unidirectional) {
				fk_resolve(void 0 as w_return);
			}
		});
	}
}

const G_SENDER_SELF: chrome.runtime.MessageSender = {
	id: 'starshell-webkit',
	url: location.href,
	origin: 'null',
};

type ListenerCallbackFromEvent<
	y_event extends chrome.events.Event<Function>,
> = F.Parameters<y_event['addListener']>[0] extends infer fk_listener
	? fk_listener extends Function
		? fk_listener
		: never
	: never;

class Listener<
	y_event extends chrome.events.Event<Function>,
	fk_listener extends ListenerCallbackFromEvent<y_event>=ListenerCallbackFromEvent<y_event>,
> {
	protected _as_listeners = new Set<fk_listener>();
	protected _s_debug: string;

	constructor(protected _s_prefix: string='') {
		this._s_debug = _s_prefix+':'+crypto.randomUUID().slice(0, 16);
	}

	polyfill(): y_event {
		const k_self = this;

		// @ts-expect-error shallow introspection
		return {
			addListener(fk_listener: fk_listener): void {
				console.log(`Adding listener to ${k_self._s_debug}`);
				k_self._as_listeners.add(fk_listener);
			},

			removeListener(fk_listener: fk_listener): void {
				console.log(`Removing listener from ${k_self._s_debug}`);
				k_self._as_listeners.delete(fk_listener);
			},
		};
	}

	dispatch(...a_args: F.Parameters<fk_listener>) {
		// console.log(`Dispatching listeners on ${this._s_debug}`);
		for(const fk_listener of [...this._as_listeners]) {
			fk_listener(...a_args);
		}
	}
}

// how to rewrite urls
function rewrite_url(p_remote: string): string {
	if(p_remote.startsWith('https://')) {
		return `proxy:https:${p_remote.slice('https://'.length)}`;
	}
	// else if(p_fetch.startsWith('wss://')) {
	// 	return `proxy:wss:${p_fetch.slice('wss://'.length)}`;
	// }

	return p_remote;
}

// undo rewritten urls
const R_REWRITTEN = /^proxy:([a-z-_]+):(.*)$/;
function dewrite_url(p_remote: string): string {
	const m_rewritten = R_REWRITTEN.exec(p_remote);
	if(m_rewritten) {
		return `${m_rewritten[1]}://${m_rewritten[2]}`;
	}

	return p_remote;
}

/**
 * When in the web extension environment, only polyfill certain properties of chrome that need to communicate with native host
 */
function do_native_bridge_polyfill() {
	async function post(w_msg: JsonValue): Promise<Nilable<JsonValue>> {
		const w_response = await chrome.runtime.sendNativeMessage('starshell', w_msg as Object);
		// debugger;

		if(w_response) {
			if(w_response._json) {
				return JSON.parse(w_response._json as string);
			}

			return w_response;
		}

		return void 0;
	}

	function post_storage(w_msg: JsonValue): Promise<JsonValue> {
		return post({
			type: 'storage',
			value: w_msg,
		});
	}

	function post_notification(w_msg: JsonValue): Promise<JsonValue> {
		return post({
			type: 'notification',
			value: w_msg,
		});
	}

	const kl_storage_changed = new Listener<chrome.storage.StorageChangedEvent>('storage.change');

	const G_LOCAL = {
		get(z_keys: StoreKey | StoreKey[]): Promise<Dict<any>> {
			return post_storage({
				type: 'get',
				value: 'string' === typeof z_keys? [z_keys]: z_keys,
			}) as Promise<Dict<any>>;
		},

		async set(h_set: Partial<Store>) {
			// get the values first
			const h_old = await G_LOCAL.get(Object.keys(h_set) as StoreKey[]);

			// set new values
			await post_storage({
				type: 'set',
				value: h_set,
			});

			// merge into change object
			const h_changes = {};
			for(const si_key in h_set) {
				h_changes[si_key] = {
					oldValue: h_old[si_key],
					newValue: h_set[si_key],
				};
			}

			// fire storage change event
			queueMicrotask(() => kl_storage_changed.dispatch(h_changes, 'local'));

			return;
		},

		async remove(si_key: StoreKey) {
			await post_storage({
				type: 'remove',
				value: si_key,
			});
		},

		async clear() {
			await post_storage({
				type: 'clear',
			});
		},
	};

	const kl_notification_click = new Listener<chrome.notifications.NotificationClickedEvent>('notification.click');

	chrome.notifications = {
		...chrome.notifications,
	};

	Object.assign(chrome.notifications, {
		onClicked: kl_notification_click.polyfill(),

		async create(si_notification: string, gc_notification: chrome.notifications.NotificationOptions, fk_created?: (si_confirmed: string) => void): Promise<void> {
			if(!si_notification) si_notification = crypto.randomUUID();

			await post_notification({
				type: 'create',
				value: {
					id: si_notification,
					options: gc_notification,
				},
			} as JsonValue);

			fk_created?.(si_notification);
		},

		// no-op
		async clear(si_notification: string, fk_cleared?: (b_cleared: boolean) => void): Promise<void> {
			await post_notification({
				type: 'clear',
				value: si_notification,
			});

			fk_cleared?.(true);
		},
	});

	Object.assign(chrome.storage.local, G_LOCAL);

	chrome.storage.onChanged = kl_storage_changed.polyfill();
}

export function do_webkit_polyfill(f_debug?: typeof debug, g_extend?: Partial<typeof window>): void {
	// wrong scope
	if(!B_DEFINED_WINDOW) return;

	// in iOS Safari; do native bridge polyfill
	if(B_IOS_WEBEXT) {
		return do_native_bridge_polyfill();
	}

	// not in a webkit environment; do not polyfill
	if(!B_IOS_NATIVE && !B_IOS_WEBKIT) return;

	// already polyfilled
	if('undefined' !== typeof globalThis.chrome?.['_polyfilled']) return;

	// set debug function
	if(f_debug) debug = f_debug;

	// scripting
	const k_scripting = new WebKitMessenger('scripting');
	globalThis.scripting_handler = k_scripting;

	// native iOS app handles messages related to local (persistent) storage
	const k_storage = new WebKitMessenger('storage');
	globalThis.storage_handler = k_storage;

	// native iOS app handles messages related to session storage
	const k_session = new WebKitMessenger('session');
	globalThis.session_handler = k_session;

	// forward notification instructions to native iOS app
	const k_notification = new WebKitMessenger('notification');
	globalThis.notification_handler = k_notification;

	// native iOS app handles the opening of web views
	const k_opener = new WebKitMessenger('opener', true);
	globalThis.opener_handler = k_opener;

	// communication with the view host
	if(B_STARSHELL_APP_NAVIGATION) {
		// sending navigation commands to host
		const k_navigation = new WebKitMessenger('navigation', true);
		globalThis.navigation_handler = k_navigation;

		// local copy of navigation model state
		const yw_state = globalThis.navigation_model_state = new MemStore<WebKitMessageHandlerRegsitry['model']['state']>({
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

			console.debug(`Service received model message from webkit host: %o`, d_event.detail);

			// update local model state
			void yw_state.update(_h_state => ({
				..._h_state,
				...h_update,
			}));
		});


		// local copy of browsing context
		const yw_browsing_context = globalThis.browsing_context = new MemStore<ExtToNative.BrowsingContext>({
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

			console.debug(`Service received witness message from webkit host: %o`, d_event.detail);

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


	const kl_storage_changed = new Listener<chrome.storage.StorageChangedEvent>('storage.change');

	const G_LOCAL = {
		debug() {
			return k_storage.post({
				type: 'debug',
			});
		},

		get(z_keys: StoreKey | StoreKey[]): Promise<Dict<any>> {
			return k_storage.post({
				type: 'get',
				value: 'string' === typeof z_keys? [z_keys]: z_keys,
			});
		},

		async set(h_set: Partial<Store>) {
			// get the values first
			const h_old = await G_LOCAL.get(Object.keys(h_set) as StoreKey[]);

			// set new values
			await k_storage.post({
				type: 'set',
				value: h_set,
			});

			// merge into change object
			const h_changes = {};
			for(const si_key in h_set) {
				h_changes[si_key] = {
					oldValue: h_old[si_key],
					newValue: h_set[si_key],
				};
			}

			// fire storage change event
			queueMicrotask(() => kl_storage_changed.dispatch(h_changes, 'local'));

			return;
		},

		async remove(si_key: StoreKey) {
			await k_storage.post({
				type: 'remove',
				value: si_key,
			});
		},

		async clear() {
			await k_storage.post({
				type: 'clear',
			});
		},
	};

	const G_SESSION = {
		get(a_keys: StoreKey[]): Promise<Dict<any>> {
			return k_session.post({
				type: 'get',
				value: a_keys,
			});
		},

		async set(h_set: Partial<Store>) {
			// get the values first
			const h_old = await G_SESSION.get(Object.keys(h_set) as StoreKey[]);

			// set new values
			await k_session.post({
				type: 'set',
				value: h_set,
			});

			// // merge into change object
			// const h_changes = {};
			// for(const si_key in h_set) {
			// 	h_changes[si_key] = {
			// 		oldValue: h_old[si_key],
			// 		newValue: h_set[si_key],
			// 	};
			// }

			// // fire storage change event
			// queueMicrotask(() => kl_storage_changed.dispatch(h_changes, 'local'));

			return;
		},

		async remove(si_key: StoreKey) {
			await k_session.post({
				type: 'remove',
				value: si_key,
			});
		},

		async clear() {
			await k_session.post({
				type: 'clear',
			});
		},
	};

	// ref original fetch function
	const f_fetch = fetch;
	globalThis.rawFetch = f_fetch;

	// define patched version
	function fetch_patched(z_input: RequestInfo | URL, w_init?: RequestInit): Promise<Response> {
		if('string' === typeof z_input) {
			return f_fetch(rewrite_url(z_input), w_init);
		}
		else if(z_input instanceof URL) {
			return f_fetch(new URL(rewrite_url(z_input+'')), w_init);
		}
		else {
			return f_fetch(new Request(rewrite_url(z_input.url), z_input), w_init);
		}
	}

	// overwrite close
	if(globalThis['location']) {
		globalThis.close = () => {
			location.reload();
		};
	}


	// post frame_capture
	debug(`Posted frame_capture message [${window.top === window? 'top': 'sub-frame'}] from <${location.href}>`);
	webkit.messageHandlers.frame_capture?.postMessage({
		top: window.top === window,
		frame: B_STARSHELL_APP_BACKGROUND? 'background'
			: 'other',
		path: location.pathname,
	});


	// runtime message listeners for background
	const kl_runtime_connect = new Listener<chrome.runtime.ExtensionConnectEvent>('runtime.connect');
	const kl_runtime_message = new Listener<chrome.runtime.ExtensionMessageEvent>('runtime.message');
	const kl_notification_click = new Listener<chrome.notifications.NotificationClickedEvent>('notification.click');


	// webext runtime extensions
	let g_webext_runtime: Partial<typeof chrome.runtime> = {};

	// response handlers
	const h_response_handlers = {};

	// in app
	if(B_MOBILE_WEBKIT_VIEW) {
		// the global channel used for sending/receiving control messages to/fro background frame
		const d_background: Vocab.TypedBroadcast<IntraExt.WebKitGlobal> = new BroadcastChannel('webkit-background');

		// background page
		debug(`WebKit polyfill: Is background page? ${B_STARSHELL_APP_BACKGROUND}`);
		if(B_STARSHELL_APP_BACKGROUND) {
			// listen for native messages from iOS
			addEventListener('@native', (d_event: CustomEvent<WebKitMessageHandlerRegsitry['native']>) => {
				const {
					type: si_type,
					value: z_value,
				} = d_event.detail;

				if('notificationClicked' === si_type && 'string' === typeof z_value) {
					kl_notification_click.dispatch(z_value);
				}
			});

			const k_runtime_response = new WebKitMessenger('runtime_response', true);

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
						void k_runtime_response.post({
							id: si_msg,
							sender: G_SENDER_SELF,
							data: w_response,
						});
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

		// attempt to load manifest
		try {
			fetch('/manifest.json').then(d_res => d_res.json()).then((g_manifest: chrome.runtime.Manifest) => {
				chrome.runtime.getManifest = () => g_manifest;
			}).catch(() => {/**/});
		}
		catch(e_scheme) {}

		// overwrite global fetch
		globalThis.fetch = fetch_patched;

		// runtime messenger applies to both foreground and background, allowing them to exchange messages
		if(B_STARSHELL_APP_BG_HOST) {
			// outgoing runtime message id issuer
			let c_msgs_runtime = 0;

			// set runtime methods
			g_webext_runtime = {
				sendMessage(g_msg: JsonValue): Promise<any> {
					return new Promise((fk_resolve) => {
						// generate unique message id
						const si_msg = `${SI_FRAME}:runtime:${++c_msgs_runtime}`;

						// prepare single message
						const g_send = {
							id: si_msg,
							sender: G_SENDER_SELF,
							data: g_msg,
						};

						// associate callback listener
						h_response_handlers[si_msg] = fk_resolve;

						// send message
						return d_background.postMessage({
							type: 'sendMessage',
							value: g_send,
						});
					});
				},

				sendNativeMessage(g_msg: JsonValue): Promise<any> {
					// TODO: setup response handling and message id
					return k_native.post({
						data: g_msg,
						sender: G_SENDER_SELF,
					});
				},

				// @ts-expect-error overloaded
				connect(gc_connect?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
					const si_name = gc_connect?.name || crypto.randomUUID();

					const {
						g_port,
					} = emulate_port(d_background, kl_runtime_connect, si_name);

					return g_port;
				},
			};
		}
		// not a background host, must propagate thru native hosting controller
		else {
			const k_runtime = new WebKitMessenger('runtime');

			// set runtime methods
			g_webext_runtime = {
				async sendMessage(g_msg: JsonValue): Promise<any> {
					// send message
					return await k_runtime.post({
						type: 'sendMessage',
						value: g_msg,
					});

					// debugger;

					// return w_response;
				},

				sendNativeMessage(g_msg: JsonValue): Promise<any> {
					debugger;

					// // TODO: setup response handling and message id
					// return k_native.post({
					// 	data: g_msg,
					// 	sender: G_SENDER_SELF,
					// });
				},

				// @ts-expect-error overloaded
				connect(gc_connect?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
					debugger;

					console.log(gc_connect);

					// const {
					// 	g_port,
					// } = emulate_crossport(k_runtime, kl_runtime_connect, gc_connect, true);

					// return g_port;

					// const si_name = gc_connect?.name || crypto.randomUUID();

					// const {
					// 	g_port,
					// } = emulate_port(d_background, kl_runtime_connect, si_name, true);

					// return g_port;
				},
			};
		}
	}
	// isolated world in web frame
	else {
		// for getting messages to background from main world of web frame
		const k_runtime = new WebKitMessenger('runtime');

		g_webext_runtime = {
			// content script sending a message to background service
			async sendMessage(g_msg: JsonValue): Promise<any> {
				// send message
				const w_response = await k_runtime.post({
					sender: G_SENDER_SELF,
					data: {
						type: 'sendMessage',
						value: g_msg,
					},
				});

				debugger;

				return w_response;
			},

			sendNativeMessage(g_msg: JsonValue): Promise<any> {
				// // TODO: setup response handling and message id
				// return k_native.post({
				// 	data: g_msg,
				// 	sender: G_SENDER_SELF,
				// });
			},

			connect(gc_connect?: chrome.runtime.ConnectInfo | undefined): chrome.runtime.Port {
				debugger;
				// const si_name = gc_connect?.name || crypto.randomUUID();

				// const {
				// 	g_port,
				// } = emulate_port(d_background, kl_connect, si_name, true);

				// return g_port;
			},
		};
	}


	// for communicating with native host
	const k_native = new WebKitMessenger('native');


	Object.assign(globalThis, {
		...g_extend,

		chrome: {
			...g_extend?.chrome,

			_polyfilled: true,

			_original: globalThis['chrome'],

			storage: {
				...g_extend?.chrome?.storage,

				onChanged: kl_storage_changed.polyfill(),

				local: G_LOCAL,

				session: G_SESSION,
			},

			notifications: {
				onClicked: kl_notification_click.polyfill(),

				async create(si_notification: string, gc_notification: chrome.notifications.NotificationOptions, fk_created?: (si_confirmed: string) => void): Promise<void> {
					if(!si_notification) si_notification = crypto.randomUUID();

					await k_notification.post({
						type: 'create',
						value: {
							id: si_notification,
							options: gc_notification,
						},
					});

					fk_created?.(si_notification);
				},

				// no-op
				async clear(si_notification: string, fk_cleared?: (b_cleared: boolean) => void): Promise<void> {
					await k_notification.post({
						type: 'clear',
						value: si_notification,
					});

					fk_cleared?.(true);
				},
			},

			runtime: {
				...g_extend?.chrome?.runtime,

				id: 'starshell-webkit',

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
					return `proxy:/${p_asset}`;
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

				async registerContentScripts(a_scripts: chrome.scripting.RegisteredContentScript[]): Promise<chrome.scripting.RegisteredContentScript[]> {
					// const w_result = await k_scripting.post({
					// 	type: 'registerContentScripts',
					// 	value: a_scripts,
					// });

					debugger;

					// return w_result;
				},

				getRegisteredContentScripts(gc_get: chrome.scripting.ContentScriptFilter) {

				},

				async executeScript<a_args extends any[], w_result>(
					g_details: chrome.scripting.ScriptInjection<a_args, w_result>
				): Promise<chrome.scripting.InjectionResult<Awaited<w_result>>> {
					const w_result = await k_scripting.post<AsJson<chrome.scripting.InjectionResult<Awaited<w_result>>>>({
						type: 'executeScript',
						value: g_details,
					});

					debugger;

					return w_result.result;
				},
			},
		},

		...B_STARSHELL_APP_TOP_IS_NAV? {
			open(p_open: string, ...a_args: any[]) {
				// capture opens and replay laterally on top frmae
				window.top!.dispatchEvent(new CustomEvent('@opener', {
					detail: {
						url: p_open,
						args: a_args,
					},
				}));
			},
		}: {
			open(p_open: string, ...a_args: any[]) {
				void k_opener.post({
					url: dewrite_url(p_open),
					args: a_args,
				});
			},
		},
	});
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


// // runtime connections id issuer
// let c_connections = 0;

// /**
//  * Emulates the behavior of chrome.runtime.Port across web views when background is hosted by another view
//  */
// function emulate_crossport(
// 	k_runtime: WebKitMessenger<'runtime' | 'runtime_response'>,
// 	kl_connect: Listener<chrome.runtime.ExtensionConnectEvent>,
// 	gc_connect?: chrome.runtime.ConnectInfo,
// 	b_init=false
// ) {
// 	// create a listener for each type of event that can occur on Port
// 	const kl_disconnect = new Listener<chrome.runtime.PortDisconnectEvent>('port.disconnect');
// 	const kl_message = new Listener<chrome.runtime.PortMessageEvent>('port.message');

// 	// gracefully close the port
// 	const close_port = () => {
// 		// dispatch the disconnect event
// 		kl_disconnect.dispatch(g_port);
// 	};

// 	// issue port id
// 	const si_port = gc_connect?.name || `${SI_FRAME}:runtime.cross:${++c_connections}`;

// 	// create port
// 	const g_port = {
// 		name: si_port,

// 		onDisconnect: kl_disconnect.polyfill(),
// 		onMessage: kl_message.polyfill(),

// 		/**
// 		 * Instructs the port to close
// 		 */
// 		disconnect() {
// 			// send disconnect frame to notify other party
// 			void k_runtime.post({
// 				type: 'disconnect',
// 			}, true);

// 			// close the port
// 			close_port();
// 		},

// 		/**
// 		 * Sends a message to the other party
// 		 */
// 		postMessage(w_message: JsonValue) {
// 			// send message over channel
// 			void k_runtime.post({
// 				type: 'postMessage',
// 				value: w_message,
// 			}, true);
// 		},
// 	};

// 	// message handlers
// 	const h_handlers = {
// 		// other end is disconnecting
// 		disconnect: close_port,

// 		// handle incoming message
// 		message(g_msg) {
// 			kl_message.dispatch(g_msg, g_port);
// 		},
// 	};

// 	// handle incoming messages
// 	addEventListener('@runtime_port', (d_event: CustomEvent<IntraView.RuntimePortMessage>) => {
// 		debugger;

// 		const {
// 			id: si_port_incoming,
// 			data: g_data,
// 		} = d_event.detail;

// 		// not meant for this port
// 		if(si_port !== si_port_incoming) return;

// 		// route
// 		h_handlers[g_data.type]?.(g_data['value']);
// 	});

// 	if(b_init) {
// 		// initiate new connection
// 		k_runtime.post({
// 			type: 'connect',
// 			value: {
// 				name: si_port,
// 			},
// 		}).then((g_establish) => {
// 			debugger;

// 			// dispatch connection event
// 			kl_connect.dispatch(g_port);
// 		}).catch((e_post) => {
// 			debugger;
// 			console.error(`Failed to connect to background via crossport: ${e_post.message}`);
// 		});
// 	}
// 	else {
// 		debugger;

// 		// d_direct.onmessage = f_handler_online;
// 	}

// 	return {
// 		// d_direct,
// 		kl_disconnect,
// 		kl_message,
// 		g_port,
// 		close_port,
// 	};
// }


// /**
//  * Creates an instance that echoes broadcast messages out of the webkit view to adjacent views
//  */
// export class WebkitMobileBroadcastChannel extends BroadcastChannel {
// 	protected _k_broadcast: WebKitMessenger;

// 	constructor(protected _si_channel: string) {
// 		super(_si_channel);

// 		// global broadcast
// 		this._k_broadcast = new WebKitMessenger('broadcast');
// 		globalThis.broadcast_handler = this._k_broadcast;

// 		// receiving navigation updates from host
// 		addEventListener('@broadcast', (d_event: CustomEvent<WebKitMessageHandlerRegsitry['broadcast']>) => {
// 			const {
// 				channel: si_channel,
// 				message: w_message,
// 			} = d_event.detail;

// 			console.debug(`Service received broadcast message from webkit host: %o`, d_event.detail);

// 			// dispatch message
// 			if(si_channel === this._si_channel) {
// 				this.dispatchEvent(new CustomEvent('message', {
// 					detail: w_message,
// 				}));
// 			}
// 		});
// 	}

// 	override postMessage(w_message: unknown): void {
// 		// broadcast out to webkit host
// 		void this._k_broadcast.post({
// 			channel: this._si_channel,
// 			message: w_message,
// 		});

// 		// play to broadcast as well
// 		super.postMessage(w_message);
// 	}
// }
