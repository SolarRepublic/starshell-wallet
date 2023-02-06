import type {PageInfo} from './messages';

import type {AppStruct} from '#/meta/app';
import {AppApiMode} from '#/meta/app';

import {open_flow} from './msg-flow';

import {Vault} from '#/crypto/vault';
import type {PositionConfig} from '#/extension/browser';
import {B_MOBILE, R_DOMAIN_LOCALHOST} from '#/share/constants';
import type {AppProfile} from '#/store/apps';
import {Apps} from '#/store/apps';
import type {AppPolicyResult} from '#/store/policies';
import {Policies} from '#/store/policies';
import {KeplrCompatibilityMode, Settings} from '#/store/settings';
import AsyncLockPool from '#/util/async-lock-pool';


type MessageSender = chrome.runtime.MessageSender;


export enum RetryCode {
	CONTINUE = 0,
	RETRY = 1,
	CANCEL = 2,
}


export function page_info_from_sender(g_sender: MessageSender): PageInfo {
	// destructure tab
	const {
		id: i_tab,
		url: p_page,
		windowId: i_window,
	} = g_sender.tab!;

	// prep page descriptor for reload page
	return {
		windowId: i_window,
		tabId: i_tab!,
		href: g_sender.url || p_page!,
	};
}

export function parse_sender(p_sender: string): ['file' | 'http' | 'https', string] {
	// parse sender url
	const {
		protocol: s_protocol,
		host: s_host,
	} = new URL(p_sender);

	// normalize scheme
	const s_scheme = (s_protocol || '').replace(/:$/, '');

	return [s_scheme as 'file' | 'http' | 'https', s_host];
}


export async function position_widow_over_tab(i_tab: number): Promise<{position: PositionConfig} | {}> {
	// windows API available
	if(!B_MOBILE && chrome.windows) {
		// get tab
		const g_tab = await chrome.tabs.get(i_tab);

		// not critical, bail on error
		try {
			// get window
			const g_window = await chrome.windows.get(g_tab.windowId);
			if(g_window) {
				// compute center
				return {
					position: {
						centered: true,
						top: (g_window.top || 0) + ((g_window.height || 0) * 0.45),
						left: (g_window.left || 0) + ((g_window.width || 0) / 2),
					},
				};
			}
		}
		catch(e_get) {}
	}

	return {};
}

const kl_auth = new AsyncLockPool(1);

/**
 * Prompts user to unlock wallet in order to continue with the flow
 */
export async function unlock_to_continue(g_page: PageInfo): Promise<RetryCode> {
	// wallet is locked
	if(!await Vault.isUnlocked()) {
		// busy authenticating
		return await navigator.locks.request('service:authenticate', async() => {
			// already signed in
			if(await Vault.isUnlocked()) {
				// proceed
				return RetryCode.CONTINUE;
			}

			// ask user to login
			const {answer:b_finished} = await open_flow({
				flow: {
					type: 'authenticate',
					page: g_page,
				},
				open: {
					...await position_widow_over_tab(g_page.tabId),
					popover: g_page,
				},
			});

			// user cancelled; do not advertise
			if(!b_finished) {
				return RetryCode.CANCEL;
			}
			// wallet is still locked; user rejected other flow
			else if(!await Vault.isUnlocked()) {
				return RetryCode.CANCEL;
			}

			// retry
			return RetryCode.RETRY;
		});

		// // acquire local mutex for auth window; stop waiting after 30 seconds
		// let f_release;

		// // lock pool is not free
		// if(!kl_auth.free) {
		// 	try {
		// 		f_release = await kl_auth.acquire(null, 30e3);
		// 	}
		// 	catch(e_acquire) {}

		// 	// wallet was unlocked
		// 	if(await Vault.isUnlocked()) {
		// 		// release mutex
		// 		f_release();

		// 		// proceed
		// 		return RetryCode.CONTINUE;
		// 	}
		// 	// wallet is still locked; user rejected other flow
		// 	else {
		// 		return RetryCode.CANCEL;
		// 	}
		// }

		// // ask user to login
		// const {answer:b_finished} = await open_flow({
		// 	flow: {
		// 		type: 'authenticate',
		// 		page: g_page,
		// 	},
		// 	open: {
		// 		...await position_widow_over_tab(g_page.tabId),
		// 		popover: g_page,
		// 	},
		// });

		// // release auth mutex if it exists
		// f_release?.();

		// // user cancelled; do not advertise
		// if(!b_finished) {
		// 	return RetryCode.CANCEL;
		// }

		// // retry
		// return RetryCode.RETRY;
	}

	// proceed
	return RetryCode.CONTINUE;
}


function block_app(g_sender: MessageSender, s_msg: string): undefined {
	console.warn(`${s_msg}; blocked request from <${g_sender.url}>`);
	return void 0;
}

export async function app_blocked(s_scheme: string, s_host: string, g_sender: MessageSender): Promise<AppPolicyResult | undefined> {
	// non-secure contexts only allowed at localhost
	if('http' === s_scheme) {
		// not localhost
		if(!R_DOMAIN_LOCALHOST.test(s_host)) {
			return block_app(g_sender, 'Non-secure HTTP contexts are not allowed to connect to wallet except for localhost');
		}
	}
	// file
	else if('file' === s_scheme) {
		// check policy
		const b_allowed = await Settings.get('allow_file_urls');
		if(!b_allowed) {
			return block_app(g_sender, `File URLs are not allowed to connect to wallet, unless 'allow_file_urls' setting is enabled`);
		}
	}
	// anything else
	else if('https' !== s_scheme) {
		return block_app(g_sender, `Scheme not allowed "${s_scheme}"`);
	}

	// lookup policy for app
	const g_policy = await Policies.forApp({
		scheme: s_scheme,
		host: s_host,
	});

	// blocked by policy
	if(g_policy.blocked) {
		return block_app(g_sender, `App is blocked by ${g_policy.source || 'some'} policy`);
	}

	return g_policy;
}


export interface AppStatus {
	g_app: AppStruct;
	b_registered: boolean;
	g_policy: AppPolicyResult;
	g_page: PageInfo;
}

/**
 * Checks an app's permissions
 * @returns `void` if the user cancelled sign-in or app is blocked, otherwise returns `AppStatus`
 */
export async function check_app_permissions(
	g_sender: chrome.runtime.MessageSender,
	g_profile?: AppProfile | null | undefined,
	b_keplr=false,
	c_retries=0
): Promise<AppStatus | undefined> {
	// unknown source, silently reject
	if(!g_sender.url) {
		console.warn('Silently ignoring app request from unknown source');
		return;
	}

	// parse sender url
	const [s_scheme, s_host] = parse_sender(g_sender.url);

	// prep page descriptor for restores
	const g_page = page_info_from_sender(g_sender);

	// unlock wallet if locked
	const xc_retry = await unlock_to_continue(g_page);

	// non-zero retry code
	if(xc_retry) {
		// retry
		if(RetryCode.RETRY === xc_retry && c_retries < 5) {
			return await check_app_permissions(g_sender, g_profile, b_keplr, c_retries+1);
		}

		// otherwise, cancel
		return;
	}

	// lookup policy for app
	const g_policy = await app_blocked(s_scheme, s_host, g_sender);

	// app is blocked; exit
	if(!g_policy) return;

	// prep app struct
	let g_app: AppStruct | null = null;

	// lookup app in store
	g_app = await Apps.get(s_host, s_scheme);

	// app registration state
	let b_registered = false;

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

		console.debug(`✅ App "${s_host}" is already registered: %o`, g_app);
	}
	// app is not yet registered; create temporary app object in memory
	else {
		console.debug(`🟡 App "${s_host}" is not yet registered`);

		// attempt to fetch favicon
		g_app = {
			on: 1,
			api: AppApiMode.UNKNOWN,
			name: '',
			scheme: s_scheme,
			host: s_host,
			connections: {},
			pfp: `pfp:${new URL(g_page.href).origin}`,
		};
	}

	// allow certain properties to be updated by the app each time a request comes in
	{
		g_app.name = g_profile?.name || g_app.name || g_sender.tab!.title || '';
		g_app.api = b_keplr? AppApiMode.KEPLR: g_app.api;
	}

	// return struct of app's status
	return {
		g_app,
		b_registered,
		g_policy,
		g_page,
	};
}


export async function request_advertisement(g_profile: AppProfile | undefined, g_sender: MessageSender, b_keplr=false): Promise<AppStatus | undefined> {
	// check the app
	const g_check = await check_app_permissions(g_sender, g_profile, b_keplr);

	// cancelled or blocked
	if(!g_check) {
		console.warn(`Aborting advertisement request for ${new URL(g_sender?.url || 'void://none').host}`);
		return;
	}

	console.debug(`Proceeding with advertisement request for %o`, g_check);

	// destructure
	const {
		g_app,
		b_registered,
		g_policy,
		g_page,
	} = g_check;

	// app is not registered and not trusted; requires user approval
	REQUEST_ADVERTISEMENT:
	if(!b_registered && !g_policy.trusted) {
		// request is via keplr polyfill
		if(b_keplr) {
			// read compatibility mode setting
			const xc_compatibility_mode = await Settings.get('keplr_compatibility_mode');

			// allow from everywhere
			if(KeplrCompatibilityMode.EVERYWHERE === xc_compatibility_mode) {
				break REQUEST_ADVERTISEMENT;
			}
			// block
			else if(KeplrCompatibilityMode.NOWHERE === xc_compatibility_mode) {
				console.debug('Keplr compatibility mode is disabled');
				return;
			}
		}

		// request approval from user
		const {answer:b_approved} = await open_flow({
			flow: {
				type: 'requestAdvertisement',
				value: {
					app: g_app,
					page: g_page,
					keplr: b_keplr,
				},
				page: g_page,
			},
			open: {
				...await position_widow_over_tab(g_page.tabId),
				popover: B_MOBILE? g_page: void 0,
			},
		});

		// user approved
		if(b_approved) {
			break REQUEST_ADVERTISEMENT;
		}

		// user aborted
		console.debug('User cancelled request');
		return;
	}

	// TODO: consider what will happen if prompt closes but serice worker becomes inactive

	// verbose
	console.debug(`Allowing <${g_sender.url}> to receive advertisement`);

	return g_check;
}

export async function request_keplr_decision(g_profile: AppProfile, g_sender: chrome.runtime.MessageSender): Promise<string> {
	const g_page = page_info_from_sender(g_sender);

	// parse sender url
	const [s_scheme, s_host] = parse_sender(g_sender.url);

	const {
		answer: b_approved,
		data: s_action,
	} = await open_flow({
		flow: {
			type: 'requestKeplrDecision',
			value: {
				app: {
					on: 1,
					api: AppApiMode.UNKNOWN,
					name: '',
					scheme: s_scheme,
					host: s_host,
					connections: {},
					pfp: `pfp:${new URL(g_page.href).origin}`,
				},
				profile: g_profile,
				page: g_page,
			},
			page: g_page,
		},
		open: {
			...await position_widow_over_tab(g_page.tabId),
			popover: B_MOBILE? g_page: void 0,
		},

		// in case this gets queued, ensure app is still not blocked when it gets dequeued
		async condition() {
			const g_policy = await Policies.forApp({
				scheme: s_scheme,
				host: s_host,
			});

			if(g_policy.blocked) return false;

			return true;
		},
	});

	// console.log({
	// 	b_approved,
	// 	s_action,
	// });

	return (s_action as string) || '';
}
