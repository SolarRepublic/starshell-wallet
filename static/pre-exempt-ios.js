let debug = (s, ...a_args) => console.debug(`StarShell?foreground: ${s}`, ...a_args);

class WebKitMessenger {
	constructor(_si_handler, _b_unidirectional=false) {
		this._h_pending = {};
		this._c_msgs = 0;
		this._si_handler = _si_handler;
		this._b_unidirectional = _b_unidirectional || false;

		// listen for responses
		if(!_b_unidirectional) {
			debug(`Registered for '${_si_handler}' events`);
			addEventListener(`@${_si_handler}`, (d_event) => {
				const g_msg = d_event.detail;

				debug(`Received webkit '${_si_handler}' event: %o`, g_msg);
				debug(`Pending '${_si_handler}' listeners: %o`, this._h_pending);

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

	post(g_msg) {
		const si_msg = ''+this._c_msgs++;

		return new Promise((fk_resolve) => {
			this._h_pending[si_msg] = (w_data) => {
				fk_resolve(w_data);
			};

			// debug(`[${si_msg}] Posting message to webkit '${this._si_handler}' handler: %o`, g_msg);

			const f_handler = webkit.messageHandlers[this._si_handler];

			if(!f_handler) {
				throw new Error(`No webkit handler defined for '${this._si_handler}'`);
			}

			f_handler.postMessage({
				id: si_msg,
				...g_msg,
			});
		});
	}
}

const G_SENDER_SELF = {
	id: 'starshell-webkit',
	url: location.href,
	origin: 'null',
};

class Listener {
	constructor(_s_prefix) {
		this._as_listeners = new Set();
		this._s_prefix = _s_prefix;
		this._s_debug = _s_prefix+':'+crypto.randomUUID().slice(0, 16);
	}

	polyfill() {
		const k_self = this;

		// @ts-expect-error shallow introspection
		return {
			addListener(fk_listener) {
				console.log(`Adding listener to ${k_self._s_debug}`);
				k_self._as_listeners.add(fk_listener);
			},

			removeListener(fk_listener) {
				console.log(`Removing listener from ${k_self._s_debug}`);
				k_self._as_listeners.delete(fk_listener);
			},
		};
	}

	dispatch(...a_args) {
		// console.log(`Dispatching listeners on ${this._s_debug}`);
		for(const fk_listener of [...this._as_listeners]) {
			fk_listener(...a_args);
		}
	}
}

// how to rewrite urls
function rewrite_url(p_remote) {
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
function dewrite_url(p_remote) {
	const m_rewritten = R_REWRITTEN.exec(p_remote);
	if(m_rewritten) {
		return `${m_rewritten[1]}://${m_rewritten[2]}`;
	}

	return p_remote;
}

function do_webkit_polyfill(f_debug, g_extend) {
	if('undefined' !== typeof globalThis.chrome?.['_polyfilled']) return;

	if(f_debug) debug = f_debug;

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
	if(location.pathname.endsWith('/navigation.html')) {
		const k_navigation = new WebKitMessenger('navigation', true);
		globalThis.navigation_handler = k_navigation;
	}

	const kl_storage_changed = new Listener('storage.change');

	const G_LOCAL = {
		get(a_keys) {
			return k_storage.post({
				type: 'get',
				value: a_keys,
			});
		},

		async set(h_set) {
			// get the values first
			const h_old = await G_LOCAL.get(Object.keys(h_set));

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

		async remove(si_key) {
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
		get(a_keys) {
			return k_session.post({
				type: 'get',
				value: a_keys,
			});
		},

		async set(h_set) {
			// get the values first
			const h_old = await G_SESSION.get(Object.keys(h_set));

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

		async remove(si_key) {
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
	function fetch_patched(z_input, w_init) {
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

	// runtime message listeners for background
	const kl_runtime_message = new Listener('runtime.message');
	const kl_notification_click = new Listener('notification.click');

	// runtime messenger for foreground
	let k_runtime;

	// post frame_capture
	debug(`Posted frame_capture message [${window.top === window? 'top': 'frame'}] from <${location.href}>`);
	webkit.messageHandlers.frame_capture?.postMessage({});

	// background page
	const b_background = 'proxy:' === location.protocol && '' === location.host && '/background.html' === location.pathname;
	debug(`WebKit polyfill: Is background page? ${b_background}`);
	if(b_background) {
		const k_response = new WebKitMessenger('response', true);

		// listen for runtime messages from iOS
		addEventListener('@runtime', (d_event) => {
			const {
				id: si_msg,
				data: g_msg,
				sender: g_sender,
			} = d_event.detail;

			console.debug(`Service received runtime message from webkit host: %o`, d_event.detail);

			kl_runtime_message.dispatch(g_msg, g_sender, (w_response) => {
				console.debug(`Responding to webkit runtime message with: %o`, w_response);

				void k_response.post({
					id: si_msg,
					data: w_response,
				});
			});
		});

		// listen for native messages from iOS
		addEventListener('@native', (d_event) => {
			const {
				type: si_type,
				value: z_value,
			} = d_event.detail;

			if('notificationClicked' === si_type && 'string' === typeof z_value) {
				kl_notification_click.dispatch(z_value);
			}
		});
	}
	else {
		k_runtime = new WebKitMessenger('runtime');
	}

	const kl_connect = new Listener('runtime.connect');

	const d_service = new BroadcastChannel('webkit-service');

	function emulate_port(si_name, b_init=false) {
		// create new direct channel
		const d_direct = new BroadcastChannel(`@webkit:${si_name}`);

		const kl_disconnect = new Listener('port.disconnect');
		const kl_message = new Listener('port.message');

		const close_port = () => {
			d_direct.close();

			kl_disconnect.dispatch(g_port);
		};

		// create port
		const g_port = {
			name: si_name,
			onDisconnect: kl_disconnect.polyfill(),
			onMessage: kl_message.polyfill(),

			// send disconnect frame
			disconnect() {
				d_direct.postMessage({
					type: 'disconnect',
				});

				close_port();
			},

			// send message
			postMessage(w_message) {
				d_direct.postMessage({
					type: 'message',
					value: w_message,
				});
			},
		};

		// message handlers
		const h_handlers = {
			// other end is disconnecting
			disconnect: close_port,

			// handle incoming message
			message(g_msg) {
				kl_message.dispatch(g_msg, g_port);
			},
		};

		// register for message events
		const f_handler_online = (g_msg) => {
			h_handlers[g_msg.type]?.(g_msg['value']);
		};

		if(b_init) {
			// temporary stand-in message handler
			d_direct.onmessage = (g_msg_init) => {
				// handle establish frame
				if('establish' === g_msg_init.type) {
					d_direct.onmessage = f_handler_online;

					kl_connect.dispatch(g_port);
				}
			};

			// initiate new connection
			d_service.postMessage({
				type: 'connect',
				value: {
					name: si_name,
				},
			});
		}
		else {
			d_direct.onmessage = f_handler_online;
		}

		return {
			d_direct,
			kl_disconnect,
			kl_message,
			g_port,
			close_port,
		};
	}

	// setup host side of broadcast channel
	d_service.onmessage = (d_event) => {
		const g_msg_init = d_event.data;

		// new connection from client
		if('connect' === g_msg_init.type) {
			const {
				d_direct,
			} = emulate_port(g_msg_init.value.name);

			// send establish frame
			d_direct.postMessage({
				type: 'establish',
			});
		}
	};

	// within wallet app
	if('proxy:' === location.protocol) {
		// attempt to load manifest
		try {
			fetch('/manifest.json').then(d_res => d_res.json()).then((g_manifest) => {
				chrome.runtime.getManifest = () => g_manifest;
			});
		}
		catch(e_scheme) {}

		// overwrite global fetch
		globalThis.fetch = fetch_patched;
	}

	Object.assign(globalThis, {
		...g_extend,

		chrome: {
			...g_extend?.chrome,

			_polyfilled: true,

			storage: {
				...g_extend?.chrome?.storage,

				onChanged: kl_storage_changed.polyfill(),

				local: G_LOCAL,

				session: G_SESSION,
			},

			notifications: {
				async create(si_notification, gc_notificatio, fk_created) {
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
				async clear(si_notification, fk_cleared) {
					await k_notification.post({
						type: 'clear',
						value: si_notification,
					});

					fk_cleared?.(true);
				},

				onClicked: kl_notification_click.polyfill(),
			},

			runtime: {
				...g_extend?.chrome?.runtime,

				id: 'starshell-webkit',

				onMessage: kl_runtime_message.polyfill(),

				sendMessage(g_msg) {
					return k_runtime.post({
						data: g_msg,
						sender: G_SENDER_SELF,
					});
				},

				sendNativeMessage(g_msg) {
					return k_runtime.post({
						data: g_msg,
						sender: G_SENDER_SELF,
					});
				},

				onConnect: kl_connect.polyfill(),

				connect(gc_connect) {
					const si_name = gc_connect?.name || crypto.randomUUID();

					const {
						g_port,
					} = emulate_port(si_name, true);

					return g_port;
				},

				getBackgroundPage() {
					throw new Error(`Cannot access background page`);
				},

				getManifest() {
					throw new Error(`Refusing manifest access`);
				},

				getURL(p_asset) {
					return `proxy:/${p_asset}`;
				},
			},
		},

		open(p_open, ...a_args) {
			void k_opener.post({
				url: dewrite_url(p_open),
				args: a_args,
			});
		},
	});
}

// on iOS Safari
if(navigator.standalone) {
	do_webkit_polyfill();
}
