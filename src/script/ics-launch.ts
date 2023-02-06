import type * as ImportHelper from './ics-launch-imports';

import type {Dict} from '#/meta/belt';

const P_LAUNCH = 'https://launch.starshell.net/';

// verbose
const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.ics-launch: ${s}`, ...a_args);
debug(`Launched on <${location.href}>`);

(function() {
	const {
		B_FIREFOX_ANDROID,
		B_CHROMIUM_ANDROID,
		B_IPHONE_IOS,
		B_SAFARI_MOBILE,
		G_USERAGENT,

		qs, dd, parse_params, stringify_params,

		base64_to_buffer,
		text_to_buffer,

		locate_script,

		Vault,
		SessionStorage,
	} = inline_require('./ics-launch-imports.ts') as typeof ImportHelper;

	const P_POPUP = chrome.runtime?.getURL?.('src/entry/popup.html') || '/src/entry/popup.html';

	const h_params_search = parse_params(location.search);
	const h_params_hash = parse_params(location.hash);

	const b_setup = 'setup' in h_params_search;
	const b_pwa = 'pwa' in h_params_search;
	const b_installed = 'installed' in h_params_search;
	const b_debug = 'debug' in h_params_search;

	let b_started = false;

	async function startup() {
		if(b_started) return;
		if(b_debug) return;
		if(b_installed) return;

		b_started = true;

		debug('Fired startup');

		const dm_body = document.body as HTMLBodyElement;

		// setup mode
		if(b_setup) {
			debug('Initializing setup');

			// select main
			const dm_main = qs(document, 'main')!;

			// remove the main contents so that page knows extension is here
			dm_main.innerHTML = '';

			// remove query parameters in case user tries to reload or bookmark
			history.pushState({}, '', P_LAUNCH);

			// prep setup
			let si_setup = '';

			// on firefox; guide thru pwa setup
			if(B_FIREFOX_ANDROID) {
				si_setup = 'android-firefox-pwa';
			}
			// on chromium; guide thru pwa setup
			else if(B_CHROMIUM_ANDROID) {
				si_setup = 'android-chromium-pwa';
			}
			// on iphone, setup is already complete
			else if(B_IPHONE_IOS) {
				// see if can embed in iframe
				debugger;
			}

			// extension wants to use predefined setup from page
			if(si_setup) {
				debug(`Triggering setup instructions for ${si_setup}`);

				// move corresponding setup dom into place
				const dm_setup = document.getElementById(`setup-${si_setup}`)!;
				dm_main.appendChild(dm_setup);

				// firefox toolbar is on top
				if(B_FIREFOX_ANDROID && window.screenY >= 55) {
					// move arrow to top
					const dm_arrow = qs(dm_main, 'img.arrow');
					Object.assign(dm_arrow?.style || {}, {
						top: '0',
						bottom: 'initial',
						transform: 'scaleY(-1)',
					});
				}

				// watch for pwa opened status
				document.addEventListener('visibilitychange', async() => {
					if('visible' === document.visibilityState) {
						if(await SessionStorage.get('pwa')) {
							location.href = '?installed';
						}
					}
				});
			}
			// no setup needed
			else {
				debug(`No setup`);

				// redirect to launch URL
				location.href = P_LAUNCH;
			}
		}
		// pwa mode
		else if(b_pwa) {
			debug('Initializing pwa');

			// clear body
			dm_body.innerHTML = '';

			// default open target
			let p_open = P_POPUP;

			// deduce launch intent
			if(h_params_hash.flow) {
				// missing signature
				if(44 !== h_params_hash.signature?.length) {
					throw new Error(`Launch URL is missing auth signature`);
				}

				// produce presigned url
				const h_presigned = {...h_params_hash} as Dict;
				delete h_presigned.signature;
				const d_url_presigned = new URL(location.href);
				d_url_presigned.hash = `#${stringify_params(h_presigned)}`;

				// parse signature
				const atu8_signature = base64_to_buffer(h_params_hash.signature as string);

				// verify signature
				const b_verify = await Vault.symmetricVerify(text_to_buffer(d_url_presigned.toString()), atu8_signature);

				if(!b_verify) {
					throw new Error(`Failed to verify launch URL`);
				}

				// open flow
				p_open = h_params_hash.flow as string;
			}
			else {
				// note that pwa has been installed
				void SessionStorage.set({
					pwa: Date.now(),
				});
			}

			// embed extension's popup
			{
				// construct iframe
				const dm_iframe = dd('iframe', {
					id: 'starshell-app',
					src: `${p_open}?${stringify_params({
						within: 'pwa',
					})}`,
					style: `
						position: absolute;
						top: ${B_SAFARI_MOBILE? '200px': '0'};
						left: 0;
						width: 100%;
						height: 100vh;
						margin: 0;
						padding: 0;
						border: none;
					`,
					allow: 'camera',
					sandbox: [
						'downloads',
						'forms',
						'modals',
						'popups',
						'popups-to-escape-sandbox',
						'same-origin',
						'scripts',
						'top-navigation',
					].map(s => `allow-${s}`).join(' '),
				});

				// append to body
				document.body.appendChild(dm_iframe);
			}

			// pwa parent script
			{
				// construct script
				const dm_script = document.createElement('script');

				// locate pwa helper script
				const p_pwa = locate_script('assets/src/script/mcs-pwa');

				// not found
				if(!p_pwa) {
					throw new Error('Unable to locate pwa script!');
				}

				// set the script src
				dm_script.src = chrome.runtime.getURL(p_pwa);

				// inject the script
				document.head.append(dm_script);
			}
		}
		// launching app
		else {
			debug(`Launching app`);

			location.href = `${P_POPUP}?${stringify_params({
				within: 'tab',
			})}`;
		}
	}

	if('loading' !== document.readyState) {
		startup();
	}
	else {
		window.addEventListener('DOMContentLoaded', startup);
	}
})();
