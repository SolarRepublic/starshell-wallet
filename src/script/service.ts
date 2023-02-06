const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.service: ${s}`, ...a_args);
// globalThis.debug = debug;
debug(`Launched on ${Date()}`);

/* eslint-disable i/order */
import {do_webkit_polyfill} from './webkit-polyfill';
import {
	B_IPHONE_IOS,
	B_IOS_NATIVE,
	G_USERAGENT,
	XT_TIMEOUT_APP_PERMISSIONS,
	XT_TIMEOUT_SERVICE_REQUEST,
	SI_EXTENSION_ID_KEPLR,
	B_DEVELOPMENT,
} from '#/share/constants';
/* eslint-enable */

if(B_IOS_NATIVE) {
	do_webkit_polyfill(debug);
}

/* eslint-disable i/order */
import type {
	ExtToNative,
	IcsToService,
	IntraExt,
	ServiceToIcs,
	SessionCommand,
} from './messages';

import type {AppStatus} from './service-apps';
import type Browser from 'webextension-polyfill';
import type {AccountPath} from '#/meta/account';
import type {AppChainConnection, AppPermissionSet} from '#/meta/app';
import type {JsonObject, JsonValue} from '#/meta/belt';
import type {Caip2, ChainStruct, ChainPath} from '#/meta/chain';
import type {IncidentPath} from '#/meta/incident';
import type {Vocab} from '#/meta/vocab';

import IcsHost from './ics-host';
import McsRatifier from './mcs-ratifier';
import {open_flow} from './msg-flow';
import {global_receive} from './msg-global';
import {set_keplr_compatibility_mode} from './scripts';

import {app_blocked, check_app_permissions, page_info_from_sender, parse_sender, position_widow_over_tab, request_advertisement, request_keplr_decision, RetryCode, unlock_to_continue} from './service-apps';
import {NetworkFeed} from './service-feed';
import {H_HANDLERS_ICS_APP} from './service-handlers-ics-app';
import {instruction_handlers} from './service-router-instruction';

import {Vault} from '#/crypto/vault';
import {system_notify} from '#/extension/notifications';
import {add_permission_to_set, process_permissions_request} from '#/extension/permissions';
import {ServiceHost} from '#/extension/service-comms';
import type {InternalConnectionsResponse} from '#/provider/connection';
import {reinstall} from '#/share/auth';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {F_NOOP, ode, timeout, timeout_exec} from '#/util/belt';
import {base64_to_buffer, buffer_to_base64, sha256d} from '#/util/data';
import {stringify_params} from '#/util/dom';

import {enable_debug_mode} from './debug';
import {KeplrExtensionState, keplr_extension_state} from './utils';



const f_runtime_ios: () => Vocab.TypedRuntime<ExtToNative.MobileVocab> = () => chrome.runtime;

const f_scripting = () => chrome.scripting as Browser.Scripting.Static;



type MessageSender = chrome.runtime.MessageSender;

type SendResponse = (w_data?: any) => void;

type MessageHandler<w_msg=any> = (g_msg: w_msg, g_sender: MessageSender, fk_respond: SendResponse) => void | boolean;


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


const H_SESSION_STORAGE_POLYFILL: Vocab.Handlers<SessionCommand> = 'function' === typeof chrome.storage?.session?.get
	? {
		async get(si_key: string): Promise<JsonValue> {
			return (await chrome.storage.session.get([si_key]))[si_key];
		},

		set(h_set: JsonObject): Promise<void> {
			return chrome.storage.session.set(h_set);
		},

		remove(si_key: string): Promise<void> {
			return chrome.storage.session.remove(si_key);
		},

		clear(): Promise<void> {
			return chrome.storage.session.clear();
		},
	}
	: {
		get(si_key: string) {
			const w_value = sessionStorage.getItem(si_key);
			return w_value? JSON.parse(w_value): null;
		},

		set(h_set: JsonObject) {
			for(const [si_key, w_value] of ode(h_set)) {
				sessionStorage.setItem(si_key, JSON.stringify(w_value));
			}
		},

		remove(si_key: string) {
			sessionStorage.removeItem(si_key);
		},

		clear() {
			sessionStorage.clear();
		},
	};

/**
 * message handlers for the public vocab from ICS
 */
const H_HANDLERS_ICS: Vocab.HandlersChrome<IcsToService.PublicVocab> = {
	async whoami(w_ignore, g_sender, fk_respond) {
		const i_window = g_sender.tab?.windowId;

		const g_window = await chrome.windows?.get(i_window!) || null;

		fk_respond({
			...g_sender,
			window: g_window,
		});
	},

	// 
	panic(g_msg, g_sender) {
		// TODO: handle
	},

	// page is requesting advertisement via ics-spotter
	async requestAdvertisement(g_msg, g_sender, fk_respond) {
		// TODO: not calling back respond handler causes issues with the receiver, create special return value for "ignore"


		const g_app = await request_advertisement(g_msg.profile, g_sender);

		// blocked or rejected
		if(!g_app) return;

		// ref tab id
		const i_tab = g_sender.tab!.id!;

		// secrets for this session
		const g_secrets: ServiceToIcs.SessionKeys = {
			session: generate_key(),
		};

		// execute isolated-world content script 'host'
		void f_scripting().executeScript({
			target: {
				tabId: i_tab,
			},
			func: IcsHost,
			args: [g_secrets],
			world: 'ISOLATED',
		});

		// execute main-world content script 'ratifier'
		void f_scripting().executeScript({
			target: {
				tabId: i_tab,
			},
			func: McsRatifier,
			args: [g_secrets],
			world: 'MAIN',
		});

		// respond to inpage content script with session secrets
		fk_respond(g_secrets);
	},

	async requestConnection(g_msg, g_sender, fk_respond) {
		// check app's permissions and normalize the object
		const g_check = await check_app_permissions(g_sender, g_msg.profile);

		// app does not have permissions; silently ignore
		if(!g_check) return;

		// keplr is installed and enabled
		if(KeplrExtensionState.ENABLED === await keplr_extension_state()) {
			await request_keplr_decision(g_msg.profile!, g_sender);
			fk_respond({});
			return;
		}

		// destructure
		const {
			g_app,
			b_registered,
			g_page,
		} = g_check;

		// cache existing chains
		const ks_chains = await Chains.read();

		const h_chains_banned: Record<Caip2.String, ChainStruct> = {};

		// review requested chains
		const h_chains_manifest = g_msg.chains;
		for(const [si_caip2, g_chain_manifest] of ode(g_msg.chains)) {
			// lookup existing chain
			const p_chain = Chains.pathFrom(g_chain_manifest);
			const g_chain_existing = ks_chains.at(p_chain);

			// chain exists; replace request with existing one
			if(g_chain_existing) {
				h_chains_manifest[si_caip2] = g_chain_existing;
			}
			// chain does not yet exist
			else {
				// in beta, do not accept arbitrary chains
				delete h_chains_manifest[si_caip2];
				h_chains_banned[si_caip2] = g_chain_manifest;
			}
		}

		// chains were deleted
		if(Object.keys(h_chains_banned).length) {
			await open_flow({
				flow: {
					type: 'illegalChains',
					value: {
						app: g_app,
						chains: h_chains_banned,
					},
					page: g_page,
				},
				open: await position_widow_over_tab(g_sender.tab!.id!),
			});
		}

		// no valid chains
		if(!Object.keys(h_chains_manifest).length) {
			fk_respond({});
			return;
		}

		// app might already have connection
		CHECK_PREAPPROVED:
		if(b_registered) {
			// ref existing connections
			const h_connections_existing = g_app.connections;

			// fetch all connected accounts
			const as_account_paths = new Set<AccountPath>();
			for(const [, g_connection] of ode(h_connections_existing)) {
				for(const p_account of g_connection.accounts) {
					as_account_paths.add(p_account);
				}
			}

			// requested account is not part of existing connections
			if(!as_account_paths.has(g_msg.accountPath)) {
				break CHECK_PREAPPROVED;
			}

			// distill the request
			const {
				h_connections: h_connections_request,
				h_flattened,
			} = process_permissions_request({
				a_account_paths: [...as_account_paths],
				h_chains: g_msg.chains,
				h_sessions: g_msg.sessions,
			});

			// generate permission set preview
			const g_set_preview: Partial<AppPermissionSet> = {};
			for(const [si_key, w_value] of ode(h_flattened)) {
				add_permission_to_set(si_key, g_set_preview);
			}

			// serialize preview
			const sx_permissions_request = JSON.stringify(g_set_preview);

			// connections that are already approved
			const h_connections_approved: Record<ChainPath, AppChainConnection> = {};

			// compare existing connections to requested ones
			for(const [p_chain, g_connection_existing] of ode(h_connections_existing)) {
				// chain not being requested; skip
				if(!(p_chain in h_connections_request)) continue;

				// permissions are identical
				const sx_permissions_existing = JSON.stringify(g_connection_existing.permissions);
				if(sx_permissions_existing === sx_permissions_request) {
					// check all requested accounts are covered
					for(const p_account of h_connections_request[p_chain].accounts) {
						// request includes an account that is not covered in existing connection
						if(!g_connection_existing.accounts.includes(p_account)) {
							// bail on comparing
							break;
						}
					}

					// approve connection using existing one
					h_connections_approved[p_chain] = g_connection_existing;

					// remove from request
					delete h_connections_request[p_chain];

					// continue comparing
					continue;
				}

				// TODO: detect upgrade/downgrade
			}

			// no remaining connection requests
			if(!Object.keys(h_connections_request).length) {
				// prep approved connections response
				const h_connections_response = h_connections_approved as InternalConnectionsResponse;

				// populate each connection with corresponding chain definition
				for(const [p_chain, g_connection] of ode(h_connections_response)) {
					g_connection.chain = ks_chains.at(p_chain)!;
				}

				// finalize request approval
				fk_respond(h_connections_approved);
				return;
			}
		}

		// open flow
		const {answer:b_approved} = await open_flow({
			flow: {
				type: 'requestConnection',
				value: {
					app: g_app,
					chains: g_msg.chains,
					sessions: g_msg.sessions,
					accountPath: g_msg.accountPath,
				},
				page: g_page,
			},
			open: await position_widow_over_tab(g_sender.tab!.id!),
		});

		if(b_approved) {
			// re-read chains since new ones may have been added
			const ks_chains_latest = await Chains.read();
			const p_app = Apps.pathFrom(g_app);
			const g_approved = await Apps.at(p_app);
			const h_connections = g_approved!.connections as InternalConnectionsResponse;

			// populate each connection with corresponding chain definition
			for(const [p_chain, g_connection] of ode(h_connections)) {
				g_connection.chain = ks_chains_latest.at(p_chain)!;
			}

			fk_respond(h_connections);
		}
	},

	// keplr was detected (similar to requestAdvertisement)
	async detectedKeplr(g_detected, g_sender, fk_respond) {
		// respond immediately, no need to wait
		fk_respond(null);

		// check if keplr is enabled
		CHECK_KEPLR_ENABLED:
		if('function' === typeof chrome.management?.get) {
			let g_keplr: chrome.management.ExtensionInfo;
			try {
				g_keplr = await chrome.management.get(SI_EXTENSION_ID_KEPLR);
			}
			// not installed
			catch(e_get) {
				break CHECK_KEPLR_ENABLED;
			}

			// keplr is installed and enabled
			if(g_keplr.enabled) {
				debug(`Content Script at "${g_sender.url}" detected Keplr API but Keplr is installed and active, ignoring polyfill.`);
				return;
			}
		}

		// // check if wallet was locked before finding out app was already registered
		// const b_preauthed = await Vault.isUnlocked();

		// check for app permissions
		const g_status = await request_advertisement(g_detected.profile, g_sender, true);

		// blocked or rejected
		if(!g_status) return;

		// get page info
		const g_page = page_info_from_sender(g_sender);

		// app was previously registered
		if(g_status.b_registered) {
			const {g_app} = g_status;

			// 
			debug('Suggesting to reload app %o', {
				g_app,
				g_sender,
			});

			// reload
			await open_flow({
				flow: {
					type: 'reloadAppTab',
					value: {
						app: g_app,
						page: g_page,
						preset: 'keplr',
					},
					page: g_page,
				},
				open: {
					...await position_widow_over_tab(g_page.tabId) || {},
					popover: g_page,
				},
			});
		}
	},

	async flowBroadcast(g_req, g_sender, fk_respond) {
		const {
			key: si_req,
			config: gc_prompt,
		} = g_req;

		// unknown source, silently reject
		if(!g_sender.url) {
			debug('Silently ignoring advertisement request from unknown source');
			return;
		}

		// get page info
		const g_page = page_info_from_sender(g_sender);

		// fallback
		if(!g_page.href) g_page.href = gc_prompt.flow.page?.href || '';

		// unlock wallet if locked
		const xc_retry = await unlock_to_continue(g_page);

		// non-zero retry code
		if(xc_retry) {
			// retry
			if(RetryCode.RETRY === xc_retry) {
				return await H_HANDLERS_ICS.flowBroadcast(g_req, g_sender, fk_respond);
			}

			// otherwise, cancel
			return;
		}

		// parse sender url
		const [s_scheme, s_host] = parse_sender(g_sender.url);

		// app is blocked; exit
		if(await app_blocked(s_scheme, s_host, g_sender)) return;

		// prep app descriptor
		const g_app = {
			scheme: s_scheme,
			host: s_host,
			connections: {},
		};

		gc_prompt.flow['value'].app = g_app;

		// forward request
		void open_flow(gc_prompt);
	},

	async sessionStorage(g_msg, g_sender, fk_respond) {
		const si_type = g_msg.type;
		const w_response = await H_SESSION_STORAGE_POLYFILL[si_type](g_msg.value);
		fk_respond(w_response);
	},

	async reportException(g_msg, g_sender, fk_respond) {
		fk_respond?.(null);

		// check the app
		let g_check!: AppStatus|undefined;
		try {
			g_check = await check_app_permissions(g_sender);
		}
		catch(e_check) {}

		// get page info
		const g_page = page_info_from_sender(g_sender);

		// reload
		await open_flow({
			flow: {
				type: 'reportAppException',
				value: {
					app: g_check?.g_app || null,
					page: g_page,
					report: g_msg.report,
				},
				page: g_page,
			},
			open: {
				...await position_widow_over_tab(g_page.tabId) || {},
				popover: g_page,
			},
		});
	},
};

const a_feeds: NetworkFeed[] = [];


/**
 * Handle messages from content scripts
 */
const message_router: MessageHandler = (g_msg, g_sender, fk_respond) => {
	// verbose
	console.debug(`Service received message %o %o`, g_msg, g_sender);

	// verify message structure
	if('object' === typeof g_msg && 'string' === typeof g_msg.type) {
		// debug message
		if('debug' === g_msg.type) {
			console.warn(`Service received debug message %o`, g_msg);
			return;
		}

		// default to ICS handlers
		let h_handlers: Vocab.HandlersChrome<IcsToService.PublicVocab | IntraExt.ServiceInstruction>;

		// ref message type
		const si_type = g_msg.type;

		// message originates from extension
		const b_origin_verified = g_sender.url?.startsWith(chrome.runtime.getURL('')) || false;
		if(chrome.runtime.id === g_sender.id && (b_origin_verified || 'null' === g_sender.origin)) {
			// for native iOS only
			if(B_IOS_NATIVE) {
				// handle session storage commands
				if('sessionStorage' === g_msg.type) {
					const g_command = g_msg.value;

					// polyfill is synchronous
					fk_respond(H_SESSION_STORAGE_POLYFILL[g_command.type](g_command.value));
					return;
				}
			}

			console.error(`Need to migrate caller to service comms for '${si_type}'`);
			return;
		}
		// message originates from tab (content script)
		else if(g_sender.tab && 'number' === typeof g_sender.tab.id) {
			// app message
			if(si_type in H_HANDLERS_ICS_APP) {
				// go async
				timeout_exec(XT_TIMEOUT_APP_PERMISSIONS, async() => {
					// check app permissions
					const g_check = await check_app_permissions(g_sender);

					// app does not have permissions; silently ignore
					if(!g_check) return fk_respond(null);

					// destructure
					const {g_app} = g_check;

					// ref chain and account paths
					const {
						chainPath: p_chain,
						accountPath: p_account,
					} = g_msg.value as {chainPath: ChainPath; accountPath: AccountPath};

					// ref connection
					const g_connection = g_app.connections[p_chain];

					// no connections on this chain; silently ignore
					if(!g_connection) return fk_respond(null);

					// app is not authorized to access this account; silently ignore
					if(!g_connection.accounts.includes(p_account)) return fk_respond(null);

					// route message to handler
					let w_return: any;
					try {
						w_return = await H_HANDLERS_ICS_APP[si_type](g_msg.value, {
							app: g_app,
							appPath: Apps.pathFrom(g_app),
							connection: g_connection,
						}, g_sender);
					}
					// catch errors
					catch(z_error) {
						fk_respond({
							error: z_error.message,
						});

						// do not respond twice
						return;
					}

					// respond with return value
					fk_respond({
						ok: w_return,
					});
				}).then(([, xc_timeout]) => {
					// service response timeout exceeded; fail
					if(xc_timeout) {
						fk_respond({
							error: 'Timed out while waiting for app permissions check',
						});
					}
				}).catch((e_handle: Error) => {
					fk_respond({
						error: `Uncaught message handler error: ${e_handle.message}`,
					});
				});

				return true;
			}
			// public message
			else {
				h_handlers = H_HANDLERS_ICS;
			}
		}
		// reject unknown senders
		else {
			console.error(`Refusing request from unknown sender: ${JSON.stringify(g_sender)}`);
			return;
		}

		// lookup handler
		const f_handler = h_handlers[si_type];

		// route message to handler
		if(f_handler) {
			// flag set once request has been terminated
			let b_terminated = false;

			// force a timeout if handler doesn't respond for some time
			const i_unresponsive = setTimeout(() => {
				// prevent tardy handler response from executing callback
				b_terminated = true;

				// respond to request
				fk_respond();
			}, XT_TIMEOUT_SERVICE_REQUEST);

			// wrap responder
			const fk_response_wrapper = (w_data?: any) => {
				// already terminated; exit
				if(b_terminated) return;

				// cancel timeout handler
				clearTimeout(i_unresponsive);

				// respond to request
				fk_respond(w_data);
			};

			// invoke handler
			const z_response = f_handler(g_msg.value, g_sender, fk_response_wrapper);

			// async handler
			if(z_response && 'function' === typeof z_response['then']) {
				return true;
			}
			// synchronous; clear unresponsive timeout
			else {
				clearTimeout(i_unresponsive);
			}
		}
		else {
			console.warn(`No service handler for ${si_type}`);
		}
	}
};

// bind message router listener
chrome.runtime.onMessage?.addListener(message_router);

ServiceHost.open({
	self: instruction_handlers(H_SESSION_STORAGE_POLYFILL, a_feeds),
});


chrome.runtime.onInstalled?.addListener(async(g_installed) => {
	debug('#runtime.onInstalled');

	// whether or not this is a fresh install
	const b_install = 'install' === g_installed.reason;

	// reinstall
	await reinstall(b_install);

	debug('Reinstall');

	// pause for ui
	await timeout(1e3);

	// immediately open launcher on android
	if('Android' === G_USERAGENT.os.name) {
		// startup
		if(b_install) {
			chrome.tabs.create({
				url: 'https://launch.starshell.net/?setup',
			}, F_NOOP);
		}
	}
	// open start page on iOS
	else if(B_IPHONE_IOS) {
		// startup
		chrome.tabs.create({
			url: `src/entry/popup.html?${stringify_params({
				within: 'tab',
			})}`,
		}, F_NOOP);

		// contact native application
		try {
			const w_response = await f_runtime_ios().sendNativeMessage('application.id', {
				type: 'greet',
			});

			console.debug(`Response from native app: %o`, w_response);
		}
		catch(e_native) {}
	}

	console.log('done');

	// // upon first install, walk the user through setup
	// await flow_broadcast({
	// 	flow: {
	// 		type: 'authenticate',
	// 		page: null,
	// 	},
	// });

	// await chrome.storage.session.setAccessLevel({
	// 	accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS,
	// });

	// console.log('ok');

	// const f_scripting() = chrome.scripting as browser.Scripting.Static;


	// const g_waker = H_CONTENT_SCRIPT_DEFS.inpage_waker();

	// await f_scripting().registerContentScripts([
	// 	{
	// 		...g_waker,
	// 		// js: [
	// 		// 	's2r.signing.key#ae4261c',
	// 		// 	...g_waker.js,
	// 		// ],
	// 	},
	// ]);

	// const a_scripts = await f_scripting().getRegisteredContentScripts();
	// for(const g_script of a_scripts) {
	// 	console.log(g_script);
	// }
});

console.log('clearing alarms');

chrome.alarms?.clearAll(() => {
	console.warn('clear all');

	chrome.alarms.create('network_feeds', {
		periodInMinutes: 3,
	});

	chrome.alarms.onAlarm.addListener((g_alarm) => {
		switch(g_alarm.name) {
			case 'network_feeds': {
				void check_network_feeds();
				break;
			}

			default: {
				break;
			}
		}
	});
});

const R_NOTIFICATION_ID = /^@([a-z]+):(.*)+/;

console.log('subscribing to notifications');

chrome.notifications?.onClicked?.addListener((si_notif) => {
	// dismiss notification
	chrome.notifications.clear(si_notif);

	// parse notification id
	const m_routable = R_NOTIFICATION_ID.exec(si_notif);

	console.log(`${si_notif} :: %o`, m_routable);

	if(m_routable) {
		const [, si_category, s_data] = m_routable;

		if('incident' === si_category) {
			void open_flow({
				flow: {
					type: 'inspectIncident',
					page: null,
					value: {
						incident: s_data as IncidentPath,
					},
				},
			});
		}
	}
});


async function check_network_feeds() {
	// 
	await navigator.locks.request(`net:feeds`, async() => {
		const b_unlocked = await Vault.isUnlocked();
		if(b_unlocked) {
			if(a_feeds.length) {
				console.debug(`Checking on existing feeds`);

				// fetch all accounts to discover new ones
				const a_account_entries = await Accounts.entries();

				// each feed
				for(const k_feed of a_feeds) {
					// remove all accounts that exist
					for(const sa_account of k_feed.accountsFollowing) {
						const i_account = a_account_entries.findIndex(
							([, g_account]) => sa_account === Chains.addressFor(g_account.pubkey, k_feed.chain));

						if(i_account >= 0) a_account_entries.splice(i_account, 1);
					}

					try {
						await k_feed.wake(30e3, 10e3);
					}
					catch(e_wake) {
						console.warn(`Problem with existing feed; destroying and recreating`);
						k_feed.destroy();

						await k_feed.recreate();
					}
				}

				// new accounts
				for(const k_feed of a_feeds) {
					for(const [sa_account, g_account] of a_account_entries) {
						await k_feed.followAccount(g_account);
					}
				}
			}
			else {
				console.debug(`Creating network feeds`);

				// start feeds
				a_feeds.push(...await NetworkFeed.createAll({
					// wire up notification hook
					notify: system_notify,
				}));
			}
		}
	});
}


// global message handler
global_receive({
	// user has authenticated
	async login() {
		// update compatibility mode based on apps and current settings
		await set_keplr_compatibility_mode();

		// start feeds
		await check_network_feeds();
	},

	// user has logged out
	logout() {
		// destroy all feeds
		for(const k_feed of a_feeds) {
			k_feed.destroy();
		}
	},

	debug(w_msg: JsonValue) {
		console.debug(`Service witnessed global debug message: %o`, w_msg);
	},
});

// init in case already unlocked
void check_network_feeds();

// set compatibility mode based on apps and current settings
void set_keplr_compatibility_mode();


if(B_DEVELOPMENT) {
	// chrome won't allow dynamic import from service worker
	enable_debug_mode();
}

// in exceptional cases, allow users to enable developer mode if they possess a developer key from a trusted owner
try {
	void chrome.storage?.local?.get?.(['@enable_developer_mode']).then(async(g_answer) => {
		try {
			const atu8_verify = await sha256d(base64_to_buffer(g_answer['@enable_developer_mode'] as string));
			if('5ASpwSBF4nQFNUnM9gY7bOk+kuumb707tuIbpWSkjAA=' === buffer_to_base64(atu8_verify)) {
				console.log('🧑‍💻 developer mode enabled');

				enable_debug_mode();
			}
		}
		catch(e_verify) {}
	}).catch(() => void 0);
}
catch(e_debug) {}
