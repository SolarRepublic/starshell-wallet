import type {HostToRatifier} from './messages';

import type {Vocab} from '#/meta/vocab';

/**
 * The ratifier's sole purpose is to verify that the declared `window.starshell` global is authentic and not spoofed.
 * This content script is executed a runtime by the service, so the module exports a function that accepts an argument.
 * @param - a {@link ServiceToIcs.SessionKeys} object
 */
export default function({
	session: sh_session,
}) {
	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-ratifier: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const hmacSHA256 = inline_require('crypto-js/hmac-sha256');

	// subclass Error to be able to recognize object origin
	class SecurityError extends Error {}


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
			type: 's2r:abort',
			value: {
				reason: ''+s_reason,
				signature: hmacSHA256(''+s_reason, sh_session),
			},
		});

		// jump out of call stack
		throw new SecurityError(`StarShell threw a security error: "${s_reason}"`);
	}

	/**
	 * Silently abort the connection without communicating to the extension or anything else.
	 */
	function silent_exit(s_error: string): void {
		// only log to console since anyone could have triggered this message
		console.error(s_error);

		b_aborted = true;
	}

	// in order to prevent website from detecting extension, grab "clean" reference to requisite natives
	// in theory, a malicious co-installed extension could attack global scope to ruin this privacy feature
	const {
		addEventListener: f_add_event_listener,
		Reflect: d_reflect,
		Reflect: {
			getOwnPropertyDescriptor: f_get_own_property_descriptor,
			getPrototypeOf: f_get_prototype_of,
		},
	} = window;

	/**
	 * Use native Reflect functions to locate property descriptor
	 */
	 function locate_descriptor(w_ref: unknown, si_prop: string, a_lineage: unknown[]=[]): null | PropertyDescriptor {
		try {
			// get descriptor
			const g_descriptor = f_get_own_property_descriptor.call(d_reflect, w_ref, si_prop);

			// not defined
			if(!g_descriptor) {
				// add this to ignore set
				a_lineage.push(w_ref);

				// get parent
				const w_parent = f_get_prototype_of.call(d_reflect, w_ref);

				// end of chain
				if(!w_parent) return null;

				// block prototype chain cycles
				if(a_lineage.includes(w_parent)) return null;

				// try parent
				return locate_descriptor(w_parent, si_prop, a_lineage);
			}

			// return descriptor
			return g_descriptor;
		}
		catch(e_get) {
			return null;
		}
	}

	/**
	 * Use native Reflect functions to inspect property without tripping proxies/accessors
	 */
	 function access_silently(w_ref: any, si_prop: string, b_accessors=false): unknown {
		try {
			// try locate descriptor
			const g_descriptor = locate_descriptor(w_ref, si_prop);

			// no property
			if(!g_descriptor) return null;

			// value is not set
			if(!('value' in g_descriptor)) {
				// fallback to using accessors (not ideal, but necessary)
				if(b_accessors) return w_ref[si_prop];

				// do not touch accessors
				return null;
			}

			// okay, return value
			return g_descriptor.value;
		}
		catch(e_get) {
			return null;
		}
	}

	// prep handler map
	const h_handlers_window: Vocab.Handlers<HostToRatifier.WindowVocab> = {
		// request to ratify global from inpage content script
		ratifyGlobal() {
			// didn't receive signing key
			if(!sh_session) {
				return silent_exit('StarShell is refusing to ratify global since it never received a signing key from the extension.');
			}
			// not defined
			else if(!locate_descriptor(window, 'starshell')) {
				return silent_exit('StarShell failed to ratify global since it is not defined.');
			}

			// capture reference
			const k_starshell = window.starshell;

			// invoke synchronous verification call
			const f_ratify = k_starshell.verify((s_sig_auth: string) => {
				// already aborted
				if(b_aborted) return;

				// invalid auth signature; do not sign arbitrary data
				if(s_sig_auth !== JSON.stringify(hmacSHA256('starshell', sh_session))) {
					return abort('Invalid auth signature passed to ratifier');
				}

				// produce verifiable stack
				const g_proof = k_starshell.verifiableStack();

				// sign the proof
				return {
					proof: g_proof,
					signature: JSON.stringify(hmacSHA256(JSON.stringify(g_proof), sh_session)),
				};
			});

			// confirm global by reference
			f_ratify(k_starshell);
		},
	};

	// start listening for messages
	(window as Vocab.TypedWindow<HostToRatifier.WindowVocab>).addEventListener('message', (d_event) => {
		// verbose
		debug('Observed window message %o', d_event);

		// already aborted; silently exit
		if(b_aborted) return;

		// originates from same frame
		if(window === access_silently(d_event, 'source', true)) {
			// access event data
			const z_data = access_silently(d_event, 'data', true);

			// data item conforms
			let si_type;
			if(z_data && 'object' === typeof z_data && 'string' === typeof (si_type=access_silently(z_data, 'type'))) {
				// ref handler
				const f_handler = h_handlers_window[si_type];

				// ignore unregistered message
				if(!f_handler) return;

				// handler is registered; execute it
				debug(`Received relay port message having registered type %o`, d_event.data);
				f_handler(z_data);
			}
		}
	});
}
