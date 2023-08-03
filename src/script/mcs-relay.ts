import type {Advertisement} from './common';

import type {RelayToHost, HostToRelay} from './messages';
import type {Union} from 'ts-toolbelt';
import type {Merge} from 'ts-toolbelt/out/Object/_api';

import type {ConnectionManifest} from '#/meta/api';
import type {OmitUnknownKeys} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';

import {ConnectionHandle} from '#/provider/connection';
import {NB_MAX_MESSAGE} from '#/share/constants';
import {text_to_buffer, uuid_v4} from '#/util/data';


/**
 * Store pending requests while waitinf for extension to respond
 */
type PendingRequest = Merge<{
	resolve(kc_handle: ConnectionHandle): void;
	reject(e_reason: Error): void;
}, OmitUnknownKeys<Vocab.MessageValue<RelayToHost.AuthedVocab, 'requestConnect'>>>;


// TODO: move this to API types
/**
 * Define the connect method
 */
type ConnectMethod = (g_advertisement: Advertisement, gc_manifest: ConnectionManifest) => Promise<ConnectionHandle>;

// create a safe Window object for the inpage script
(function() {
	const hmacSHA256 = inline_require('crypto-js/hmac-sha256');

	// const {text_to_buffer} = inline_require('#/util/data.ts');
	// const {ConnectionHandle} = inline_require('../provider/connection.ts') as typeof ConnectionModule;
	// const {
	// 	N_PX_WIDTH_POPUP,
	// 	N_PX_HEIGHT_POPUP,
	// 	NB_MAX_MESSAGE,
	// } = inline_require('./constants.ts') as typeof Constants;

	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-relay: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);


	const SI_EXPORT = 'starshell';

	// list of native properties to freeze into safe bundle
	const A_SAFE_FUNCTIONS = [
		'addEventListener',
		'postMessage',
		'Error',
		'Function',
		'Object',
		'Reflect',
		'MessageChannel',
		'crypto',
	];

	// subclass Error to be able to recognize object origin
	class SecurityError extends Error {}
	class PotentialBugError extends Error {}

	// flag in case security violation occurs
	let b_aborted = false;

	/**
	 * Abort page connection and report a security error
	 */
	function abort(s_reason: string) {
		// set abort flag
		b_aborted = true;

		// notify extension
		window.postMessage({
			type: 'panic',
			value: ''+s_reason,
		}, window.origin);

		// jump out of call stack
		throw new SecurityError(`StarShell threw a security error: "${s_reason}"`);
	}

	/**
	 * Assert that the connection has not been aborted
	 */
	function assert_not_aborted() {
		// already aborted
		if(b_aborted) throw new Error('StarShell withdrew wallet access from this website due to a security violation');
	}

	/**
	 * Report a bug to the isolated content script
	 */
	function report_bug(s_info: string) {
		// notify isolated content script that relay is secured and transfer port
		window.postMessage({
			type: 'bug',
			value: ''+s_info,
		}, window.origin);

		// jump out of call stack
		throw new PotentialBugError('StarShell encountered an unexpected error that might indicate a potential bug');
	}

	// fetch the payload script element
	const dm_payload = document.querySelector('script#starshell-mcs-relay-payload');

	// element not found
	if(!dm_payload || 'script' !== dm_payload.nodeName.toLowerCase()) {
		return abort('Failed to locate payload script element within relay frame');
	}

	// extract the payload
	let g_payload: HostToRelay.Payload;
	{
		// get the payload text
		const sx_payload = dm_payload.textContent;

		// text is empty or blank
		if(!sx_payload || !sx_payload.trim()) {
			return abort('The relay frame had an empty payload');
		}

		// parse the text
		try {
			g_payload = JSON.parse(sx_payload);
		}
		catch(e_parse) {
			return abort('Failed to parse the payload text due to invalid JSON');
		}
	}

	// invalid payload type
	if('object' !== typeof g_payload) {
		return abort('The payload injected into the relay frame was not an object');
	}

	// invalid payload properties
	if('string' !== typeof g_payload.session || 'string' !== typeof g_payload.csurl) {
		return abort('The payload injected into the relay frame had an invalid shape or was missing properties');
	}

	// remove everything from the document for funsies
	dm_payload.remove();
	// Array.from(document.querySelectorAll('script')).forEach(dm => dm.remove());

	// destructure payload
	const {
		session: sh_session,
		csurl: p_content_script,
	} = g_payload;

	// create private stack-signing key
	const sh_stack = uuid_v4();

	// prep port
	let d_port: Vocab.TypedPort<RelayToHost.AuthedVocab, HostToRelay.AuthedVocab>;

	// TOOD: capture window references needed after sync in case window reference leaks to parent frame
	// via any bundled native function return values or properties

	/**
	 * Perform a deep (recursive and prototype chain) freeze on the given object
	 */
	function deep_freeze(z_object: any, h_frozen=new Map<Object, boolean>()) {
		// only freeze objects and functions
		if('object' !== typeof z_object && 'function' !== typeof z_object) return;

		// exclude null
		if(!z_object) return;

		// skip objects already encountered
		if(h_frozen[z_object]) return;

		// record entry
		h_frozen[z_object] = true;

		// freeze the item
		Object.freeze(z_object);

		// attempt to freeze its prototype
		deep_freeze(Reflect.getPrototypeOf(z_object), h_frozen);

		// iterate over its keys
		for(const w_key of Reflect.ownKeys(z_object)) {
			// fetch the value's descriptor
			const g_descriptor = Reflect.getOwnPropertyDescriptor(z_object, w_key);

			// data descriptors only; deep freeze their value
			if(g_descriptor && !g_descriptor.get) {
				deep_freeze(g_descriptor.value, h_frozen);
			}
		}

		// return frozen object
		return z_object;
	}


	/**
	 * Normalizes a call stack by removing gap lines and replacing the `:line:col` string  at the i_start row
	 */
	function normalize_stack(a_lines: string[], i_start=1): string {
		return [
			a_lines[0],
			a_lines[i_start].replace(/(:\d+:\d+)(\D*)$/, ':1:1$2'),
			...a_lines.slice(i_start+1),
		].join('\n');
	}

	// distinguish between connect accessors
	let c_access_connect = 0;

	// count number of times stack verifier is called
	let c_access_stack = 0;

	// count number of times export is accessed
	let c_access_export = 0;

	// capture stacks to make sure inpage content script bookends the receivers
	let b_access_capture = true;
	const a_stacks_init: string[] = [];

	// ratified flag
	let b_ratified = false;

	// hardened flag
	const b_hardened = false;

	// conection requests
	const hm_requests = new Map<number, PendingRequest>();

	// prep new bundle
	const h_bundle = {
		// isHardened(si_key, w_perceived): boolean {
		// 	return ('string' === typeof si_key && A_SAFE_FUNCTIONS.includes(si_key) && w_perceived === window[si_key]);
		// },

		// hardening the global can be useful when importing 3rd party libraries that use window
		// without worrying about establishing a Compartment to contain the imported module
		// however, it requires using async imports to ensure the imported module does not cache
		// any window functions before it is hardened. also, hardening the global does not preclude
		// an attacker from extending window (since it must remain configurable) by defining properties
		// that polyfill new Web APIs which are not yet supported by the browser, meaning they are
		// actually undefined, so hardening does not freeze them
		hardenGlobal() {
			// already hardened
			if(b_hardened) return true;

			const h_descriptors = Object.getOwnPropertyDescriptors(d_parent);
			for(const si_key in h_descriptors) {
				Reflect.defineProperty(d_parent, si_key, Reflect.getOwnPropertyDescriptor(h_bundle, si_key)!);
			}
		},

		// the safest way would be to create a new nested iframe for each compartment to capture a fresh window instance
		natives() {

		},

		/**
		 * Produce a stack using the trusted, native Error class and sign it
		 */
		verifiableStack() {
			// only return to first accessor
			if(0 === c_access_stack++) {
				// generate new stack
				let s_stack;
				try { throw new Error('StarShell security check'); }
				catch(e_thrown) { s_stack = e_thrown.stack; }

				// return the stack and sign it
				return {
					stack: s_stack,
					signature: JSON.stringify(hmacSHA256(s_stack, sh_stack)),
				};
			}
		},

		/**
		 * 
		 */
		verify(f_caller) {
			// generate new stack
			let s_stack_local;
			try { throw new Error('StarShell security check'); }
			catch(e_thrown) { s_stack_local = e_thrown.stack; }

			// sign auth
			const s_sig_auth = JSON.stringify(hmacSHA256('starshell', sh_session));

			// handle uncaught errors
			try {
				// invoke caller and destructure result
				const {
					proof: {
						stack: s_stack_verify,
						signature: s_sig_verify,
					},
					signature: s_sig_proof,
				} = f_caller(s_sig_auth);

				// assert types
				if('string' !== typeof s_stack_verify || 'string' !== typeof s_sig_verify || 'string' !== typeof s_sig_proof) {
					return abort('Invalid stack property types');
				}

				// split
				const a_lines_verify = s_stack_verify.split(/\n/g);
				const a_lines_local = s_stack_local.split(/\n/g);

				// page stack should be exactly 2 calls deeper
				if(a_lines_local.length + 2 !== a_lines_verify.length) {
					return abort('Call stack length mismatch');
				}

				// normalize both stacks
				const s_stack_local_norm = normalize_stack(a_lines_local, 1);
				const s_stack_page_norm = normalize_stack(a_lines_verify, 3);

				// compare stacks
				if(s_stack_local_norm !== s_stack_page_norm) {
					return abort('Unable to verify caller identity');
				}

				// make sure the user captured a reference to the export
				if(c_access_export <= 2) {
					return abort(`Website script did not capture reference to global '${SI_EXPORT}' property which is required`);
				}

				// no longer applies
				// // ensure first and last access comes from inpage content script
				// if(a_stacks_init[0] !== a_stacks_init[a_stacks_init.length-1]) {
				// 	return abort(`Failed to reliably validate Provider API entrypoint`);
				// }

				// verify the verification signature (lol)
				if(s_sig_verify !== JSON.stringify(hmacSHA256(s_stack_verify, sh_stack))) {
					return abort('Invalid verification stack signature');
				}

				// reconstruct the proof signature and verify it
				if(s_sig_proof !== JSON.stringify(hmacSHA256(JSON.stringify({
					stack: s_stack_verify,  // .replace(new RegExp(`\\(mcs-relay.ts(:[0-9]+:[0-9]+)\\)`, 'g'), '(mcs-relay.ts)')
					signature: s_sig_verify,
				}), sh_session))) {
					return abort('Invalid proof signature');
				}

				// stop capturing
				b_access_capture = false;

				// return function to trusted caller
				return (z_global: unknown) => {
					// passed reference does not match
					if(z_global !== h_bundle) {
						return abort('Failed to ratify Provider API');
					}

					// successfully ratified global
					b_ratified = true;

					// check advertisement
					check_advertisement();
				};
			}
			catch(e_uncaught) {
				if(!(e_uncaught instanceof SecurityError)) {
					return abort(`Uncaught error """${e_uncaught.stack?? e_uncaught+''}"""`);
				}
				else {
					throw e_uncaught;
				}
			}
		},

		/**
		 * Website is making a connection request
		 */
		get connect(): ConnectMethod {
			// already aborted
			if(b_aborted) throw new Error('StarShell withdrew wallet access from this website due to a security violation');

			// connect access index
			const i_access_connect = c_access_connect++;

			// function can only be used once
			let b_used = false;

			// create a new function for each connect access
			return (g_advertisement: Advertisement, gc_manifest: ConnectionManifest): Promise<ConnectionHandle> =>
				// go async
				 new Promise((fk_resolve, fe_reject) => {
					// already aborted
					if(b_aborted) return fe_reject(new Error('StarShell withdrew wallet access from this website due to a security violation'));

					// connection function already used
					if(b_used) return fe_reject(`Blocked re-use of cached 'window.starshell.connect' method`);

					// function has now been used
					b_used = true;

					// missing advertisement
					if(!g_advertisement) return fe_reject(new TypeError('Missing requisite advertisement object in arguments'));

					// advertisement did not originate from starshell
					if(g_advertisement !== g_advertisement_outgoing) return fe_reject(new Error('Ignoring request to connect using foreign advertisement'));

					// disarm user input
					let sx_manifest = '';
					try {
						sx_manifest = JSON.stringify(gc_manifest);
						gc_manifest = JSON.parse(sx_manifest);
					}
					catch(e_disarm) {
						return fe_reject(new Error(`Invalid manifest object; failed to serialize.\n${e_disarm.stack}`));
					}

					// check byte length
					if(text_to_buffer(sx_manifest).byteLength > NB_MAX_MESSAGE) {
						return fe_reject(new Error('Message exceeds maximum byte length'));
					}

					// save request
					hm_requests.set(i_access_connect, {
						index: i_access_connect,
						manifest: gc_manifest,
						resolve: fk_resolve,
						reject: fe_reject,
					});

					// advertisement is legitimate, submit connection request
					try {
						d_port.postMessage({
							type: 'requestConnect',
							value: {
								index: i_access_connect,
								manifest: gc_manifest,
							},
						});
					}
					// serialization error posting message
					catch(e_post) {
						d_port.postMessage({
							type: 'reportWebsiteError',
							value: (e_post.stack || e_post || '')+'',
						});

						// show in page console
						return fe_reject(new Error(`Invalid connection request; failed to serialize object.\n${e_post.stack}`));
					}
				});
		},
	};

	// each key to freeze on the new window object
	for(const si_key of A_SAFE_FUNCTIONS) {
		// deep freeze it onto the bundle object
		h_bundle[si_key] = deep_freeze(window[si_key]);
	}

	// freeze the bundle object
	Object.freeze(h_bundle);

	// ref parent window
	const d_parent = window.parent;

	// bundle setter
	const f_setter_starshell = () => {
		// no-op
	};

	// bundle getter
	const f_getter_starshell = () => {
		// already aborted
		if(b_aborted) throw new Error('StarShell withdrew wallet access from this website due to a security violation');

		// count access attempts
		c_access_export += 1;

		// will want to compare stacks later
		if(b_access_capture) {
			try { throw new Error('StarShell security check'); }
			catch(e_thrown) { a_stacks_init.push(e_thrown.stack); }
		}

		// return bundle
		return h_bundle;
	};

	// define non-modifiable property on parent window
	if(!Reflect.defineProperty(d_parent, SI_EXPORT, {
		enumerable: true,
		configurable: false,
		set: f_setter_starshell,
		get: f_getter_starshell,
	}) || d_parent[SI_EXPORT] !== h_bundle) {
		return abort(`Unable to define non-modifiable property '${SI_EXPORT}' on parent window`);
	}

	// redundant assertion
	if(!Object.isFrozen(window[SI_EXPORT])) {
		Object.freeze(window[SI_EXPORT]);

		// still didn't work
		if(!Object.isFrozen(window[SI_EXPORT])) {
			return abort(`Unable to freeze property '${SI_EXPORT}' on parent window`);
		}
	}

	// confirm modifiability using secondary method
	{
		const gc_confirm = Reflect.getOwnPropertyDescriptor(d_parent, SI_EXPORT);
		if('object' !== typeof gc_confirm
			|| false !== gc_confirm.configurable
			|| f_getter_starshell !== gc_confirm.get
			|| f_setter_starshell !== gc_confirm.set
		) {
			return abort(`Failed to confirm definition of non-modifiable property '${SI_EXPORT}' on parent window`);
		}
	}

	// verbose
	debug(`Defined global window.starshell %o`, d_parent.starshell);

	// create new MessageChannel to communicate with isolated content script
	const d_channel = new MessageChannel();

	// save local side of port
	d_port = d_channel.port1;

	// only allow for a single acknolwedgement
	let b_ack_relay = false;

	// the outgoing advertisement
	let g_advertisement_outgoing;

	/**
	 * Check whether app is ready to advertise in main world
	 */
	function check_advertisement() {
		// global is ratified and relay is acknowledge
		if(b_ratified && b_ack_relay) {
			// advertisement already made
			if(g_advertisement_outgoing) {
				return abort('Advertisement already made');
			}

			// create advertisement
			g_advertisement_outgoing = {
				isStarShell: true,
				features: [],
			};

			// advertise
			window.dispatchEvent.call(d_parent, new CustomEvent('walletAdvertisement', {
				detail: g_advertisement_outgoing,
			}));
		}
	}

	// prep port handlers
	// const h_handlers_port: Record<HostToRelay.ChannelMessage['type'], MessageHandler> = {
	const h_handlers_port: Vocab.HandlersPortReceivable<HostToRelay.AuthedVocab> = {
		// isolated content script acknowledged relay
		acknowledgeChannel() {
			assert_not_aborted();

			// expect exactly 1 acknowledgement
			if(b_ack_relay) {
				return abort('Received more than 1 relay acknowledgement');
			}

			// relay was acknowledged
			b_ack_relay = true;

			// check if ready to advertise
			check_advertisement();
		},

		// connection
		async respondConnect(g_response, a_ports) {
			assert_not_aborted();

			// destructure response
			const {
				index: i_response,
				answer: g_answer,
			} = g_response;

			// fetch request from map
			const g_request = hm_requests.get(i_response);
			if(!g_request) {
				return report_bug(`Connection response index "${i_response}" was not found in relay frame map`);
			}

			// destructure answer
			const {
				error: s_error,
				handle: si_handle,
				config: gc_handle,
			} = g_answer as Union.Merge<typeof g_answer>;

			// there was an error
			if(s_error) {
				return g_request.reject(new Error(s_error));
			}

			// no ports
			if(!a_ports || !a_ports.length) {
				return report_bug(`Connection response index "${i_response}" is missing MessagePorts`);
			}

			// connection success; create handle
			const k_handle = await ConnectionHandle.create(si_handle, gc_handle, a_ports[0]);

			// respond to request
			g_request.resolve(k_handle);
		},
	};

	// bind listener
	d_port.onmessage = function port_message_handler(d_event) {
		// destructure message data
		const {
			type: si_type,
			value: w_value,
		} = d_event.data as Union.Merge<typeof d_event.data>;

		// ref handler
		const f_handler = h_handlers_port[si_type] as Vocab.HandlerPortReceivable;
		if(!f_handler) {
			console.error(`Received message having an unregistered type "${si_type}"`);
			return;
		}

		// handler is registered; execute it
		debug(`Received relay port message having registered type %o`, d_event.data);
		f_handler(w_value ?? null, d_event.ports);
	};

	// type-check
	const g_establish: Omit<Vocab.Message<RelayToHost.SubframeVocab, 'establishChannel'>, 'auth'> = {
		type: 'establishChannel',
	};

	// insert auth
	g_establish['auth'] = JSON.stringify(hmacSHA256(JSON.stringify(g_establish), sh_session));

	// notify isolated content script that relay is secured and transfer port
	window.postMessage(g_establish, window.origin, [d_channel.port2]);
})();
