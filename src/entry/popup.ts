/* eslint-disable i/order */
import type {SvelteComponent} from 'svelte';

import type {AppStruct} from '#/meta/app';
import type {Dict, JsonObject} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';
import type {PageConfig} from '#/app/nav/page';
import type {IntraExt} from '#/script/messages';
import type {StarShellDefaults} from '#/store/web-resource-cache';

import {dm_log, domlog} from './fallback';

domlog(`Pre-init: registering uncaught error handler`);
window.addEventListener('error', (d_event) => {
	domlog(`Fatal uncaught error: ${d_event.message}`);
	domlog(`${d_event.filename}:${d_event.lineno}:${d_event.colno}`);
	console.error(d_event.error);
});

import {B_LOCALHOST, XT_SECONDS, P_STARSHELL_DEFAULTS, R_CAIP_2, B_IOS_WEBKIT} from '#/share/constants';

import {do_webkit_polyfill} from '#/script/webkit-polyfill';

do_webkit_polyfill();
/* eslint-enable */

import {AppApiMode} from '#/meta/app';

import SystemSvelte from '#/app/container/System.svelte';
import {ThreadId} from '#/app/def';
import {initialize_store_caches, yw_navigator} from '#/app/mem';
import AccountCreateSvelte from '#/app/screen/AccountCreate.svelte';
import AuthenticateSvelte from '#/app/screen/Authenticate.svelte';
import BlankSvelte from '#/app/screen/Blank.svelte';
import HardwareController from '#/app/screen/HardwareController.svelte';
import ImportMnemonicSvelte from '#/app/screen/ImportMnemonic.svelte';
import JsonPreviewDemo from '#/app/screen/JsonPreviewDemo.svelte';
import LedgerLinkAccounts from '#/app/screen/LedgerLinkAccounts.svelte';
import PreRegisterSvelte from '#/app/screen/PreRegister.svelte';
import RestrictedSvelte from '#/app/screen/Restricted.svelte';
import WalletCreateSvelte from '#/app/screen/WalletCreate.svelte';
import {Bip39} from '#/crypto/bip39';
import {Vault} from '#/crypto/vault';
import {check_restrictions} from '#/extension/restrictions';
import {ServiceClient} from '#/extension/service-comms';
import {SessionStorage} from '#/extension/session-storage';
import {global_broadcast, global_receive} from '#/script/msg-global';
import {dev_register, login} from '#/share/auth';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Secrets} from '#/store/secrets';
import {Settings} from '#/store/settings';
import {WebResourceCache} from '#/store/web-resource-cache';
import {F_NOOP, ode, timeout, timeout_exec} from '#/util/belt';
import {parse_params, qs} from '#/util/dom';
import KeystoneTest from '#/app/screen/KeystoneTest.svelte';


const debug = true? (s: string, ...a: any[]) => console.debug(`StarShell.popup: ${s}`, ...a): () => {};

function parse_rate_limit_config(g_remote: JsonObject) {
	const e_invalid = new Error('Invalid rate limit config');

	if('number' !== typeof g_remote['concurrency']) throw e_invalid;
	if('number' !== typeof g_remote['capacity']) throw e_invalid;
	if('number' !== typeof g_remote['resolution']) throw e_invalid;

	return {
		concurrency: g_remote.concurrency,
		capacity: g_remote.capacity,
		resolution: g_remote.resolution,
	};
}


// parse search params from URL
const h_params = parse_params();

const b_dev = B_LOCALHOST && h_params.autoskip;

const dp_cause = (async() => {
	if(b_dev) return null;

	const a_tabs = await chrome.tabs?.query({
		active: true,
		currentWindow: true,
	});

	if(1 === a_tabs?.length) {
		const g_tab = a_tabs[0];

		// prep app struct
		let g_app: AppStruct | null = null;

		// app registration state
		let b_registered = false;

		// logged in state
		let b_authed = false;

		// page has url
		const p_tab = g_tab.url;
		if(p_tab) {
			// parse page
			const d_url = new URL(p_tab);
			const s_host = d_url.host;
			const s_scheme = d_url.protocol.replace(/:$/, '') as 'https';

			// foreign scheme
			if(!/^(file|https?)$/.test(s_scheme)) {
				return null;
			}

			// logged in
			if(await Vault.isUnlocked()) {
				b_authed = true;

				// lookup app in store
				g_app = await Apps.get(s_host, s_scheme);
			}

			// app definition exists
			if(g_app) {
				// app is registered and enabled; mark it such
				if(g_app.on) {
					b_registered = true;
				}
				// app is disabled
				else {
					// do nothing
				}
			}
			// app is not yet registered; create temporary app object in memory
			else {
				g_app = {
					on: 1,
					api: AppApiMode.UNKNOWN,
					name: (await SessionStorage.get(`profile:${d_url.origin}`))?.name
						|| g_tab.title || s_host,
					scheme: s_scheme,
					host: s_host,
					connections: {},
					pfp: `pfp:${d_url.origin}`,
				};
			}
		}

		const g_window = await chrome.windows?.get(g_tab.windowId) || null;

		return {
			tab: g_tab,
			window: g_window,
			app: g_app,
			registered: b_registered,
			authenticated: b_authed,
		};
	}
})();


// top-level system component
let yc_system: SvelteComponent | null = null;

// health check timer
let i_health = 0;

// busy reloading
let b_busy = false;

// init service client
// const dp_connect = B_IOS_NATIVE? forever<ServiceClient>(): ServiceClient.connect('self');
const dp_connect = ServiceClient.connect('self');
void dp_connect.then((k_client) => {
	globalThis._k_service_client = k_client;
});

// reload the entire system
async function reload(b_override_restriction=false) {
	domlog('(Re?)starting system load');
	debug(`reload called; busy: ${b_busy}`);
	if(b_busy) return;

	b_busy = true;

	// destroy previous system
	if(yc_system) {
		try {
			yc_system.$destroy();
		}
		catch(e_destroy) {}
	}

	// remove stale dom
	try {
		qs(document.body, 'main')?.remove();
	}
	catch(e_remove) {}

	// launch app
	let b_launch = false;

	// start page
	let gc_page_start: PageConfig;

	// context
	const g_cause = await Promise.race([
		dp_cause,
		timeout(300).then(() => null),
	]);

	const h_context: Dict<any> = {
		cause: g_cause,
	};

	// try to update cache
	domlog('Attempting to update web resource cache');
	debug('updating web resource cache');
	try {
		await timeout_exec(6e3, () => WebResourceCache.updateAll());
	}
	catch(e_update) {
		console.warn(`Failed to update web resource cache: ${e_update.message}`);
	}

	// restrictions
	debug('checking restrictions');
	const a_restrictions = await check_restrictions();

	debug('checking vault');
	if(a_restrictions.length && !b_override_restriction) {
		gc_page_start = {
			creator: RestrictedSvelte,
			props: {
				f_override: () => reload(true),
			},
		};
	}
	// vault is unlocked
	else if(await Vault.isUnlocked()) {
		domlog('Vault is unlocked');

		// register for global events
		const f_unregister = global_receive({
			// system received logout command
			logout() {
				// unregister this listener
				f_unregister();

				// reload system
				void reload();
			},
		});

		// load store caches
		debug('initializing caches');
		await initialize_store_caches();

		debug('reading account');
		// check for account(s)
		const ks_accounts = await Accounts.read();

		// check for mnemonics
		const a_mnemonics = await Secrets.filter({
			type: 'mnemonic',
		});

		// no accounts
		if(!Object.keys(ks_accounts.raw).length) {
			// mnemonic exists; load account creation
			if(a_mnemonics.length) {
				gc_page_start = {
					creator: AccountCreateSvelte,
					props: {
						b_mandatory: true,
					},
				};
	
				// set complete function in context
				h_context.completed = reload;
			}
			// no mnemonics; load wallet creation
			else {
				gc_page_start = {
					creator: WalletCreateSvelte,
					props: {
						b_mandatory: true,
					},
				};

				// set complete function in context
				h_context.completed = reload;
			}
		}
		// account exists; load default homescreen
		else {
			gc_page_start = {
				creator: BlankSvelte,
			};

			// launch homescreen
			b_launch = true;

			// update defaults
			try {
				const [g_defaults, xc_timeout] = await timeout_exec(10e3, () => WebResourceCache.get(P_STARSHELL_DEFAULTS));

				if(!xc_timeout) {
					const {
						queries: g_queries,
						webApis: g_apis,
						chainSettings: h_chain_settings_remote,
					} = g_defaults as unknown as StarShellDefaults;

					// update default rate limit for queries
					if(g_queries?.defaultRateLimit) {
						const gc_default = parse_rate_limit_config(g_queries.defaultRateLimit);

						await Settings.set('gc_rate_limit_queries_default', gc_default);
					}

					// update default rate limit for queries for web apis
					if(g_apis?.defaultRateLimit) {
						const gc_default = parse_rate_limit_config(g_apis.defaultRateLimit);

						await Settings.set('gc_rate_limit_webapis_default', gc_default);
					}

					// update chain settings
					{
						const h_chain_settings = await Settings.get('h_chain_settings') || {};
						let b_update = false;
						for(const [si_caip2, gc_chain] of ode(h_chain_settings_remote || {})) {
							const m_caip2 = R_CAIP_2.exec(si_caip2);
							if(m_caip2) {
								const p_chain = Chains.pathFor(m_caip2[1] as 'cosmos', m_caip2[2]);

								const g_settings = h_chain_settings[p_chain] = h_chain_settings[p_chain] || {};

								if('number' === typeof gc_chain.defaultGasPrice) {
									g_settings.x_default_gas_price = gc_chain.defaultGasPrice;
									b_update = true;
								}

								if('number' === typeof gc_chain.simulationGasMultiplier) {
									g_settings.x_gas_multiplier = gc_chain.simulationGasMultiplier;
									b_update = true;
								}
							}
						}

						// update chain settings
						if(b_update) {
							await Settings.set('h_chain_settings', h_chain_settings);
						}
					}
				}
			}
			catch(e_update) {
				console.warn(`Defaults update failed: ${e_update.message}`);
			}
		}
	}
	// vault is locked
	else {
		domlog('Vault is locked');

		// register for global events
		const f_unregister = global_receive({
			// system received login command
			login() {
				// unregister this listener
				f_unregister();

				// reload system
				void reload();
			},
		});

		debug('getting base');

		// retrieve root
		const g_root = await Vault.getBase();

		// no root set, need to register
		if(!g_root) {
			gc_page_start = {
				creator: PreRegisterSvelte,
			};
		}
		// root is set, need to authenticate
		else {
			gc_page_start = {
				creator: AuthenticateSvelte,
			};
		}

		// in either case, set complete function in context
		h_context.completed = F_NOOP;
	}

	function navigator_updated(k_navigator) {
		// navigator was not set
		if(!k_navigator) {
			throw new Error(`Navigator was not initialized`);
		}

		// launch to homescreen
		if(b_launch) {
			void k_navigator.activateThread(ThreadId.TOKENS).then(async() => {
				// thread activated

				// development env
				if(B_LOCALHOST) {
					if(h_params.screen) {
						switch(h_params.screen) {
							case 'mnemonic': {
								const atu16_indicies = await Bip39.entropyToIndicies();

								k_navigator.activePage.push({
									creator: ImportMnemonicSvelte,
									props: {
										atu16_indicies,
									},
								});
								break;
							}

							case 'ledger': {
								k_navigator.activePage.push({
									creator: HardwareController,
									props: {},
								});
								break;
							}

							case 'keystone': {
								k_navigator.activePage.push({
									creator: KeystoneTest,
								});
								break;
							}

							case 'ledger-import': {
								k_navigator.activePage.push({
									creator: LedgerLinkAccounts,
									props: {
										b_dev: true,
									},
								});
								break;
							}

							case 'json': {
								k_navigator.activePage.push({
									creator: JsonPreviewDemo,
								});
								break;
							}

							default: {
								// ignore
							}
						}
					}
				}
			});
		}
		// launch to init thread
		else {
			void k_navigator.activateThread(ThreadId.INIT);
		}

		// attempt to hide log
		try {
			dm_log!.style.display = 'none';
		}
		catch(e_hide) {}

		// listen for heartbeat
		// if(!B_IOS_NATIVE) {
		const d_service: Vocab.TypedRuntime<IntraExt.ServiceInstruction> = chrome.runtime;
		let i_service_health = 0;
		function health_check() {
			console.debug('Service health check');
			clearTimeout(i_service_health);

			i_service_health = window.setTimeout(async() => {
				// in webkit view
				if(B_IOS_WEBKIT) {
					console.warn(`Idle service worker`);

// 					debugger;

// 					// // notify of service delinquency
// 					// global_broadcast({
// 					// 	type: 'unresponsiveService',
// 					// });

// 					// remove background page(s)
// 					for(const dm_background of Array.from(document.body.querySelectorAll('iframe.background-service'))) {
// 						dm_background.remove();
// 					}

// 					// re-initialize
// 					const dm_background = dd('iframe', {
// 						src: '/background.html?within=webview',
// 						style: `
// 							display: none;
// 						`,
// 					});

// 					// add to page
// 					document.body.append(dm_background);

// 					await timeout(3e3);
// debugger;
// 					await ServiceClient.connect('self');
// 					debugger;
// 					await timeout(5e3);
// 					debugger;
// 					health_check();
				}
				// desktop
				else {
					console.warn(`Waking idle service worker`);

					let k_client!: ServiceClient;
					const [, xc_timeout] = await timeout_exec(2e3, async() => {
						k_client = await dp_connect;

						await k_client.send({
							type: 'wake',
						});

						console.warn(`Service worker responded`);
					});

					if(xc_timeout) {
						console.warn(`⚠️ Service worker is unresponsive. Waiting for refresh... %O`, k_client || {});

						global_broadcast({
							type: 'unresponsiveService',
						});
					}
				}
			}, 2e3);
		}

		global_receive({
			heartbeat() {
				health_check();
			},
		});

		// user is logged in, ensure the service is running
		if(b_launch) {
			health_check();
		}
		// }
	}

	yw_navigator.once(navigator_updated);

	debug('launching system');

	// create system component
	yc_system = new SystemSvelte({
		target: document.body,
		anchor: document.getElementById('terminus')!,
		props: {
			mode: 'app',
			page: gc_page_start,
		},
		context: new Map(ode(h_context)),
	});

	// clear health check
	clearTimeout(i_health);

	b_busy = false;
}

// app is running as local development for UI inspecting
if(B_LOCALHOST) {
	(async() => {
		if('autoskip' in h_params) {
			console.log('Autoskipping registration');
			const s_password = ' '.repeat(8);

			try {
				await login(s_password);
			}
			catch(e_login) {
				localStorage.clear();
				await dev_register(s_password);
				await login(s_password);
			}

			await reload();
		}
		else {
			// start system
			await reload();
		}
	})();
}
else {
	domlog('Loading system from popup');

	// start health check timer
	i_health = (globalThis as typeof window).setTimeout(() => {
		domlog('Fatal time out, likely caused by an uncaught error.');
	}, 15*XT_SECONDS);

	try {
		// start system
		void reload();
	}
	catch(e_load) {
		domlog((e_load as Error).message || e_load+'');
		debugger;
		console.error(e_load);
	}
}
