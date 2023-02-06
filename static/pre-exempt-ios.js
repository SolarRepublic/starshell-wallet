// webkit polyfill for iOS
{
	class WebKitMessenger {
		constructor(_si_handler, _b_unidirectional=false) {
			this._c_msgs = 0;

			// listen for responses
			if(!_b_unidirectional) {
				debug(`Registered for '${_si_handler}' events`);
				addEventListener(`@${_si_handler}`, (d_event) => {
					const g_msg = d_event.detail;

					debug(`Recieved webkit '${_si_handler}' event: %o`, g_msg);
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

	function do_webkit_polyfill(f_debug, g_extend) {
		if(f_debug) debug = f_debug;

		const k_storage = new WebKitMessenger('storage');
		const k_opener = new WebKitMessenger('opener', true);

		globalThis.storage_handler = k_storage;
		globalThis.opener_handler = k_opener;

		const a_change_listeners = [];
		function storage_change(h_changes) {
			for(const f_listener of a_change_listeners) {
				f_listener(h_changes, 'local');
			}
		}

		const H_LOCAL = {
			get(a_keys) {
				// console.warn(`chrome.storage.local.get(%o)`, a_keys);
				// return fodemtv(await submit_msg<Dict<string | null>>('get', a_keys), s => s? JSON.parse(s): s);
				// return fodemtv(await k_storage.post<Dict<string | null>>({
				// 	type: 'get',
				// 	value: a_keys,
				// }), s => s? JSON.parse(s): s);

				return k_storage.post({
					type: 'get',
					value: a_keys,
				});
			},

			async set(h_set) {
				// console.warn(`chrome.storage.local.set(%o)`, h_set);
				// get the values first
				const h_old = await H_LOCAL.get(Object.keys(h_set));

				// set new values
				await k_storage.post({
					type: 'set',
					// value: fodemtv(h_set, w => JSON.stringify(w)),
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
				queueMicrotask(() => storage_change(h_changes));

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

		// ref original fetch function
		const f_fetch = fetch;
		globalThis.rawFetch = f_fetch;

		// how to rewrite urls
		function rewrite_url(p_fetch) {
			// if(p_fetch.startsWith('https://')) {
			// 	return `proxy:https:${p_fetch.slice('https://'.length)}`;
			// }
			// else if(p_fetch.startsWith('wss://')) {
			// 	return `proxy:wss:${p_fetch.slice('wss://'.length)}`;
			// }

			return p_fetch;
		}

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
		const a_runtime_listeners = [];

		// runtime messenger for foreground
		let k_runtime;

		// post frame_capture
		debug(`Posted frame_capture message [${window.top === window? 'top': 'frame'}] from <${location.href}>`);
		webkit.messageHandlers.frame_capture?.postMessage({});

		// background page
		const b_background = 'proxy:' === location.protocol && '' === location.host && '/background.html' === location.pathname;
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

				for(const f_callback of a_runtime_listeners) {
					f_callback(g_msg, g_sender, (w_response) => {
						console.debug(`Responding to webkit runtime message with: %o`, w_response);

						void k_response.post({
							id: si_msg,
							data: w_response,
						});
					});
				}
			});
		}
		else {
			k_runtime = new WebKitMessenger('runtime');
		}


		Object.assign(globalThis, {
			...g_extend,

			chrome: {
				...g_extend?.chrome,

				storage: {
					...g_extend?.chrome?.storage,

					onChanged: {
						addListener(fk_listener) {
							console.warn(`chrome.storage.onChanged.addListener() called`);
							a_change_listeners.push(fk_listener);
						},
					},

					local: H_LOCAL,
				},

				runtime: {
					...g_extend?.chrome?.runtime,

					id: 'starshell-webkit',

					onMessage: {
						addListener(fk_listener) {
							console.warn(`chrome.runtime.onMessage.addListener() called`);
							a_runtime_listeners.push(fk_listener);
						},
					},

					sendMessage(g_msg) {
						return k_runtime.post({
							data: g_msg,
							sender: {
								id: 'starshell-webkit',
								url: location.href,
								origin: 'null',
							},
						});
					},

					sendNativeMessage(g_msg) {
						return k_runtime.post({
							data: g_msg,
							sender: {
								id: 'starshell-webkit',
								url: location.href,
								origin: 'null',
							},
						});
					},

					getBackgroundPage() {
						throw new Error(`Cannot access background page`);
					},

					getManifest() {
						throw new Error(`Refusing manifest access`);
					},

					getURL(p_asset) {
						return `proxy:${p_asset}`;
					},
				},
			},

			fetch: fetch_patched,

			open(p_open, ...a_args) {
				void k_opener.post({
					url: p_open,
					args: a_args,
				});
			},
		});
	}

	// on iOS Safari
	if(navigator.standalone) {
		do_webkit_polyfill();
	}
}
