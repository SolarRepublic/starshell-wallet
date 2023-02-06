import type {
	HostToRelay,
	RelayToHost,
	HostToRatifier,
	IcsToService,
} from './messages';
import type * as Flow from './msg-flow';
import type {HmacSHA256} from 'crypto-js';

import type {ConnectionManifestV1} from '#/meta/api';
import type {ChainStruct} from '#/meta/chain';
import type {Vocab} from '#/meta/vocab';

import {
	locate_script,
} from './utils';

import {HostConnection} from '#/provider/host-connection';
import {
	A_CHAIN_CATEGORIES,
	A_CHAIN_NAMESPACES,
	R_CHAIN_ID_VERSION,
	R_CHAIN_NAME,
} from '#/share/constants';
import {uuid_v4} from '#/util/data';

interface ScriptParams {
	session: string;
}

/**
 * The host provides a connection between the page and the extension and allows messages from the relay frame to be
 * forwarded to the service if necessary.
 * This content script is executed at runtime by the service, so the module exports a function that accepts an argument.
 * @param - a {@link ServiceToIcs.SessionKeys} object
 */
export default function({
	session: sh_session,
}: ScriptParams): void {
	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.ics-host: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const hmacSHA256 = inline_require('crypto-js/hmac-sha256') as typeof HmacSHA256;

	// typed chrome runtime for sending messages
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab, IcsToService.PublicResponseVocab> = chrome.runtime;

	/**
	 * 
	 */
	function flow_send(gc_prompt: Flow.PromptConfig): Promise<boolean> {
		return new Promise((fk_resolve) => {
			// create response key
			const si_response = uuid_v4();

			// wait for response from popup
			d_runtime.onMessage.addListener(function flow_response_handler(g_msg, g_sender) {
				// flow response message
				if('flowBroadcastResponse' === g_msg.type) {
					// responding to this request
					if(si_response === g_msg.value.key) {
						// remove listener
						d_runtime.onMessage.removeListener(flow_response_handler);

						// resolve promise
						fk_resolve(g_msg.value.answer);
					}
				}
			});

			// forward command to background
			void d_runtime.sendMessage({
				type: 'flowBroadcast',
				value: {
					key: si_response,
					config: gc_prompt,
				},
			});
		});
	}

	/**
	 * Generate a new private/shared secret key of the specified size in bytes (defaults to 512-bit key)
	 */
	function generate_key(nb_size=64): string {
		// prep space in memory
		const atu8_secret = new Uint8Array(nb_size);

		// fill with crypto random values
		crypto.getRandomValues(atu8_secret);

		// convert to hex string
		return Array.from(atu8_secret).map(x => x.toString(16).padStart(2, '0')).join('');
	}

	// subclass Error to be able to recognize object origin
	class SecurityError extends Error {}

	// message port
	let d_port: Vocab.TypedPort<HostToRelay.AuthedVocab>;

	// flag to record relay state
	let b_acquainted = false;

	// flag in case security violation occurs
	let b_aborted = false;

	/**
	 * Abort page connection and report a security error
	 */
	function abort(s_reason: string) {
		// set abort flag
		b_aborted = true;

		// notify extension
		void d_runtime.sendMessage({
			type: 'panic',
			value: ''+s_reason,
		});

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

	// declare channel message handlers
	const h_handlers_authed: Vocab.Handlers<RelayToHost.AuthedVocab> = {
		// handle connection requests
		async requestConnect(g_request) {
			// destructure request
			const {
				index: i_request,
				manifest: g_manifest,
			} = g_request;

			// respond with an error
			const err = (s_reason: string) => {
				d_port.postMessage({
					type: 'respondConnect',
					value: {
						index: i_request,
						answer: {
							error: s_reason,
						},
					},
				});
			};

			// invalid structure
			if('object' !== typeof g_manifest || 'string' !== typeof g_manifest.schema) {
				return err('Invalid manifest structure');
			}

			// unknown manifest version
			if('1' !== g_manifest.schema) {
				return err('Unknown or unsupported manifest schema version');
			}

			// missing chains
			if(!Array.isArray(g_manifest.chains) || !g_manifest.chains.length) {
				return err('No chains were specified in request');
			}

			// destructure manifest
			const {
				chains: a_chains,
			} = g_manifest as ConnectionManifestV1;

			// look out for duplicates
			const as_chains = new Set<string>();


			// interface ConnectionRequest extends UnknownChainDescriptor {
			// 	label: string;
			// }

			// 
			const a_chain_requests: ChainStruct[] = [];

			// chain answers
			const a_answers: Vocab.MessageValue<HostToRelay.AuthedVocab, 'respondConnect'>['answer'][] = [];

			// each chain
			for(let i_chain=0; i_chain<a_chains.length; i_chain++) {
				const g_chain = a_chains[i_chain];

				const cerr = (s_reason: string) => err(`${s_reason} at .chains[${i_chain}]`);

				// validate descriptor structure
				if('object' !== typeof g_chain || 'string' !== typeof g_chain.category
					|| 'string' !== typeof g_chain.namespace || 'string' !== typeof g_chain.reference) {
					return cerr('Invalid chain descriptor structure');
				}

				// family not supported
				if(!A_CHAIN_NAMESPACES.includes(g_chain.namespace)) {
					a_answers.push({
						error: 'Namespace not supported',
					});

					// move onto next chain
					continue;
				}

				// validate chain category
				if(!A_CHAIN_CATEGORIES.includes(g_chain.category)) {
					return cerr(`Invalid category value "${g_chain.category}"; must be one of (${A_CHAIN_CATEGORIES.join(', ')})`);
				}

				// validate chain id
				if(!R_CHAIN_ID_VERSION.test(g_chain.reference)) {
					return cerr(`Invalid chain id "${g_chain.reference}" for ${g_chain.namespace} family; failed to match regular expression /${R_CHAIN_ID_VERSION.source}/`);
				}

				// validate chain name
				if(g_chain.name) {
					if(!R_CHAIN_NAME.test(g_chain.name)) {
						return cerr(`Invalid chain name "${g_chain.name}"; failed to match regular expression /${R_CHAIN_NAME.source}/`);
					}

					if(g_chain.name.length > 64) {
						return cerr('Chain name too long');
					}
				}

				// chain path
				const p_chain = g_chain.namespace+'\n'+g_chain.reference;

				// duplicate
				if(as_chains.has(p_chain)) {
					return cerr(`Duplicate chain IDs in '${g_chain.namespace}' namespace: '${g_chain.reference}'`);
				}

				// set chain label
				const s_label = g_chain.name || g_chain.reference;

				// prep UI prompt
				a_chain_requests.push({
					...g_chain,
					label: s_label,
				});
			}

			void d_runtime.sendMessage({
				type: 'requestConnection',
				value: {
					chains: a_chain_requests,
				},
			});

			// // prep flow result
			// let g_result;
			// try {
			// 	// await flow
			// 	g_result = await flow_send({
			// 		flow: {
			// 			type: 'requestConnection',
			// 			value: {
			// 				chains: a_requests,
			// 			},
			// 			page: {
			// 				href: location.href,
			// 				tabId: -1,
			// 			},
			// 		},
			// 	});
			// }
			// catch(e_popup) {
			// 	// TODO: handle chrome error
			// 	// TODO: handle flow error
			// 	throw e_popup;
			// }

			// fetch from store


			// ports
			const a_ports: Array<MessagePort | null> = [];

			// no port
			a_ports.push(null);


			for(const g_chain of a_chains) {
				// create channel
				const d_channel = new MessageChannel();

				// assign port 1
				const kc_chain = await HostConnection.create(g_chain, d_channel.port1);

				// resoond with port 2
				a_ports.push(d_channel.port2);
			}


			d_port.postMessage({
				type: 'respondConnect',
				value: {
					index: i_request,
					answer: {
						config: {
							features: a_features,
						},
					},
				},
			}, a_ports);
		},

		// handle website error reporting
		reportWebsiteError(s_reson: string) {
			// TODO: handle
		},
	};
	
	// handle messages from authed port
	function authed_message_handler(d_event) {
		// destructure message data
		const {
			type: si_type,
			value: w_value,
		} = d_event.data;

		// ref handler
		const f_handler = h_handlers_authed[si_type];
		if(!f_handler) {
			console.error(`Received relay port message having an unregistered type "${si_type}"`);
			return;
		}

		// handler is registered; execute it
		debug(`Received relay port message having registered type %o`, d_event.data);
		f_handler(w_value);
	}

	// declare window message handlers
	const h_handlers_window: Vocab.HandlersPortReceivable<RelayToHost.SubframeVocab> = {
		// /**
		//  * A security test has failed. Close connection to the offending page.
		//  */
		// panic(s_reason: string) {
		// 	// no need to abort more than once
		// 	if(!b_aborted) {
		// 		return abort(s_reason);
		// 	}
		// },


		// /**
		//  * A potential bug may have been encountered.
		//  */
		//  bug(s_reason: string) {
		// 	//  TODO: handle bug reporting

		// 	// no need to abort more than once
		// 	if(!b_aborted) {
		// 		return abort(s_reason);
		// 	}
		// },


		/**
		 * The relay frame successfully declared `window.starshell` on its parent frame in the main world
		 * and is ready to establish a MessageChannel.
		 */
		establishChannel(_, a_ports) {
			assert_not_aborted();

			// replayed message
			if(b_acquainted) {
				return abort('Relay frame attempted to establish connection more than once');
			}

			// do not allow replays
			b_acquainted = true;

			// relay window is not defined
			if(!d_window_relay) {
				return abort('Reference to relay frame window not defined');
			}

			// check ports
			if(!a_ports || 1 !== a_ports.length) {
				return abort('Expected exactly one MessagePort but none were transfered from relay frame');
			}

			// accept message port
			d_port = a_ports[0];

			// bind listener
			d_port.onmessage = authed_message_handler;

			// acknowledge relay channel
			d_port.postMessage({
				type: 'acknowledgeChannel',
			});

			// request ratification
			(window as Vocab.TypedWindow<HostToRatifier.WindowVocab>).postMessage({
				type: 'ratifyGlobal',
			}, window.origin);
		},
	};

	// create and inject relay frame
	let d_window_relay: Vocab.TypedWindow<Vocab, RelayToHost.SubframeVocab>;
	let d_document_relay: Document;
	{
		// prepare the payload that will get passed to relay frame
		const g_payload: HostToRelay.Payload = {
			session: sh_session,
			csurl: chrome.runtime.getURL('assets/src/script/mcs-relay.js'),
		};

		// create a script element to carry the serialized payload
		const dm_payload = document.createElement('script');
		dm_payload.setAttribute('type', 'application/json');
		dm_payload.setAttribute('id', 'starshell-mcs-relay-payload');

		// serialize and store the payload to the script element
		dm_payload.textContent = JSON.stringify(g_payload);

		// create another script element to load the relay application
		const dm_script = document.createElement('script');

		// locate relay script
		const p_relay = locate_script('assets/src/script/mcs-relay');

		// not found
		if(!p_relay) {
			throw new Error('Unable to locate relay script!');
		}

		// set the script src
		dm_script.src = chrome.runtime.getURL(p_relay);

		// import as module
		dm_script.type = 'module';

		// create a new iframe
		const dm_iframe = document.createElement('iframe');

		// create container element to attach a new shadow dom to
		const dm_div = document.createElement('div');

		// in case it gets appended to body, make sure it does not render to screen
		dm_div.style.display = 'none !important';

		// attach new shadow dom to element in closed mode
		const dm_shadow = dm_div.attachShadow({mode:'closed'});

		// append iframe to shadow dom root
		dm_shadow.append(dm_iframe);

		// append container element to the live document to initialize iframe's content document
		try {
			document.head.append(dm_div);
		}
		// browser didn't like adding content to head; fallback to using body
		catch(e_append) {
			document.body.append(dm_div);
		}

		// save relay frame's content window & document
		d_window_relay = dm_iframe.contentWindow!;
		d_document_relay = dm_iframe.contentDocument!;

		// build relay frame's document
		d_document_relay.body.append(dm_payload);
		d_document_relay.body.append(dm_script);

		// verbose
		debug('Injected relay iframe');
	}


	// listen for messages from relay frame's main world
	d_window_relay.addEventListener('message', (d_event) => {
		// verbose
		debug(`Observed relay window message %o`, d_event);

		// event originates from trusted action
		if(!d_event.isTrusted) {
			console.warn('Ignored untrusted event %o', d_event);
			return;
		}

		// only accept messages sent to itself
		if(d_event.source !== d_event.target) {
			console.warn('Ignored cross-window message %o', d_event);
			return;
		}

		// ref message sender
		const dw_sender = d_event.target as Window;

		// validate message sender
		if(window.origin !== d_event.origin || window !== dw_sender.parent || 'about:blank' !== dw_sender.location.href) {
			console.warn('Ignored message from 3rd party %o', d_event);
			return;
		}

		// validate message data
		const g_data = d_event.data;
		if('object' !== typeof g_data || 'string' !== typeof g_data.type) {
			debug('Ignored invalid message data %o', g_data);
			return;
		}

		// destructure message data
		const {
			type: si_type,
			auth: s_auth,
		} = g_data;

		// ref handler
		const f_handler = h_handlers_window[si_type];
		if(!f_handler) {
			console.error(`Received message having an unregistered type "${si_type}"`);
			return;
		}

		// missing auth
		if('string' !== typeof s_auth) {
			debug('Ignored message missing auth data %o', g_data);
			return;
		}

		// produce correct signature
		const s_sig_msg = JSON.stringify(hmacSHA256(JSON.stringify({...g_data, auth:void 0}), sh_session));

		// authenticate
		if(s_sig_msg !== g_data.auth) {
			return abort('Relay frame sent invalid auth signature');
		}

		// handler is registered; execute it
		debug(`Received message having registered type %o`, d_event.data);
		void f_handler(null, d_event.ports);
	});
}
