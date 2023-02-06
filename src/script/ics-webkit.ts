import type * as WebkitPolyfillImport from './webkit-polyfill';

/**
 * The spotter's sole purpose is to silently forward advertisement requests from the page to the service.
 */
(function() {
	// verbose
	const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.ics-webkit: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const {
		do_webkit_polyfill, WebKitMessenger: WebKitMessenger,
	} = inline_require('./webkit-polyfill.ts') as typeof WebkitPolyfillImport;

	// const k_runtime = new WebKitMessenger('runtime');

	do_webkit_polyfill(debug, {
		chrome: {
			runtime: {
				// connect(g_connect?: chrome.runtime.ConnectInfo): chrome.runtime.Port {
				// 	throw new Error(`Port connection not implemented`);
				// },


				// sendMessage(g_msg: JsonValue): Promise<any> {
				// 	return k_runtime.post({
				// 		data: g_msg,
				// 		sender: {
				// 			id: 'starshell-webkit',
				// 			url: location.href,
				// 			origin: 'null',
				// 		},
				// 	});
				// },
			},

			extension: {},
		},
	});
})();
