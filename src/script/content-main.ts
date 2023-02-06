import type {
	SafeBundle,
} from './common';

export default function(g_secrets) {
	const hmacSHA256 = inline_require('crypto-js/hmac-sha256');

	// verbose
	console.debug(`StarShell running content-main on <${location.href}>`);

	// destructure secrets from args
	const {
		si_iframe,
		s_verify_iframe,
		s_secret,
		s_verify_answer,
		sx_signing,
	} = g_secrets;

	// setup console pretty printing
	const SX_CSL_PAD = 'padding:8px 0px;'
	const SX_CSL_ALL = SX_CSL_PAD + 'background:#212121; color:#f7f7f7;';
	const SX_CSL_PRM = 'color:#ffb61a;';
	const SX_CSL_BEGIN = 'padding-left:4px;';
	const SX_CSL_END = 'padding-right:4px;';
	const A_CSL = [
		SX_CSL_BEGIN,
		SX_CSL_PRM,
		SX_CSL_ALL,
		SX_CSL_END,
	].map(s => SX_CSL_ALL + s);

	const A_CSL_ERROR = [
		SX_CSL_BEGIN,
		SX_CSL_PRM,
		'',
		SX_CSL_END,
	].map(s => SX_CSL_PAD + s);

	/**
	 * Print to console that extension was unable to establish a secure channel
	 */
	function abort(s_detail) {
		console.error(`%c🚩 %cStarShell%c is unable to establish a secure channel in the current environment! This might indicate that a malicious extension installed on your browser is attempting to intercept messages. Detail: ${s_detail}%c`, ...A_CSL_ERROR);
		debugger;
	}


	let dm_port: MessagePort;

	// handle uncaught errors
	try {
		// locate iframe that isolated content script created
		const a_iframes = [...document.querySelectorAll('iframe#'+si_iframe)] as HTMLIFrameElement[];

		// failed to locate
		if(1 !== a_iframes.length) {
			return abort('Failed to locate safe iframe')
		}

		// ref iframe
		const dm_iframe = a_iframes[0];

		// ref iframe's window
		const d_window = dm_iframe.contentWindow;

		// capture safe bundle
		const d_safe_bundle = d_window['safeBundle'] as SafeBundle;

		// invoke synchronous verification call
		let f_post = d_safe_bundle.verify(() => {
			// produce verifiable stack
			const g_proof = d_safe_bundle.verifiableStack();

			// sign the proof
			return {
				proof: g_proof,
				signature: JSON.stringify(hmacSHA256(JSON.stringify(g_proof), sx_signing)),
			};
		});

		// use safe reflect on window
		debugger;
		const gd_receiver = d_safe_bundle.Reflect.getOwnPropertyDescriptor(window, 'walletAdvertisementReceiver');

		console.log(gd_receiver);
		console.log('^^ receiver');

		// test for non-configurable property
		if(!gd_receiver.configurable && 'function' === typeof gd_receiver.value) {
			// make advertisement
			gd_receiver.value.call({
				type: 'advertisement',
			});
		}
	}
	catch(e_uncaught) {
		return abort(e_uncaught);
	}
}
