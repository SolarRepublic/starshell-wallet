import type Browser from 'webextension-polyfill';

import {AppApiMode} from '#/meta/app';

import {locate_script} from './utils';

import {Vault} from '#/crypto/vault';
import {PublicStorage} from '#/extension/public-storage';
import {SessionStorage} from '#/extension/session-storage';
import {B_IPHONE_IOS} from '#/share/constants';
import {Apps} from '#/store/apps';

export type ContentScript = Browser.Scripting.RegisteredContentScript;

const f_scripting = () => chrome.scripting as Browser.Scripting.Static;

const A_MATCH_ALL = [
	'file://*/*',
	'http://*/*',
	'https://*/*',
];

const G_SCRIPT_BASIC = {
	matches: A_MATCH_ALL,
	excludeMatches: [
		// 'http://localhost:8128/*',
	],
	runAt: 'document_start',
	persistAcrossSessions: true,
	allFrames: true,
	world: 'MAIN',
} as const;



export const H_CONTENT_SCRIPT_DEFS = {
	// inpage_waker(h_overrides) {
	// 	return {
	// 		...G_SCRIPT_BASIC,
	// 		id: 'inpage_waker',
	// 		js: [
	// 			locate_script('assets/src/script/inpage-waker'),
	// 		],
	// 		...h_overrides,
	// 	};
	// },

	// inpage_iframe(h_overrides) {
	// 	return {
	// 		...G_SCRIPT_BASIC,
	// 		id: 'inpage_iframe',
	// 		js: [
	// 			locate_script('assets/src/script/inpage-iframe'),
	// 		],
	// 		...h_overrides,
	// 	};
	// },

	ics_witness(h_overrides={}): ContentScript {
		return {
			...G_SCRIPT_BASIC,
			id: 'inpage_witness',
			js: [
				locate_script('assets/src/script/ics-witness')!,
			],
			persistAcrossSessions: true,
			world: 'ISOLATED',
			...h_overrides,
		};
	},

	mcs_keplr(h_overrides={}): ContentScript {
		return {
			...G_SCRIPT_BASIC,
			matches: [],
			id: 'keplr_polyfill',
			js: [
				locate_script('assets/src/script/mcs-keplr')!,
			],
			persistAcrossSessions: true,
			...h_overrides,
		};
	},
} as const;



/**
 * Handles the (un)registration of content scripts 
 */
export async function set_script_registration(gc_script: ContentScript, b_enabling: boolean): Promise<void> {
	// unconditionally enabled
	if(B_IPHONE_IOS) return;

	// acquire exclusive lock
	await navigator.locks.request('webext:script-registration', async() => {
		// check the current status of the script, i.e., whether or not it is enabled
		// zero length indicates no currently registered scripts match the given id
		const b_registered = !!(await f_scripting().getRegisteredContentScripts({
			ids: [gc_script.id],
		})).length;

		console.debug(`Setting script registration (currently ${b_registered}) to ${b_enabling} for %o`, gc_script);

		// script is being enabled and is not currently registered
		if(b_enabling && !b_registered) {
			async function retry(gc_attempt: ContentScript) {
				// attempt to register the content script
				try {
					await f_scripting().registerContentScripts([
						gc_attempt,
					]);
				}
				// attempt failed
				catch(e_register) {
					const s_error = e_register?.message + '';

					// something to do with persistence option
					if(/\bpersistAcrossSessions\b/.test(s_error)) {
						// unable to persist across sessions
						if(true === gc_attempt.persistAcrossSessions) {
							// retry without persistence
							return await retry({
								...gc_attempt,
								persistAcrossSessions: false,
							});
						}
					}
					// something to do with world
					else if(/\bworld\b/.test(s_error)) {
						// browser does not like world option, but able to omit
						if('ISOLATED' === gc_attempt['world']) {
							// retry without explicit world
							const gc_retry = {
								...gc_attempt,
							};

							delete gc_retry['world'];

							return await retry(gc_retry);
						}
						// main world
						else if('MAIN' === gc_attempt['world']) {
							// soft enable via mcs injection
							PublicStorage.forceMcsInjection(true);

							// done
							return;
						}
					}

					console.error(`Failed to register content script`);
					// forfeit
					throw e_register;
				}
			}

			await retry(gc_script);
		}
		// script is being disabled and is currently registered
		else if(!b_enabling && b_registered) {
			// unregister the content script
			await f_scripting().unregisterContentScripts({
				ids: [gc_script.id],
			});
		}
	});
}


/**
 * Adds origin matches to the keplr polyfill script registration and ensures it is enabled
 */
export async function keplr_polyfill_script_add_matches(a_matches: string[], b_exclusive?: boolean): Promise<void> {
	// already unconditional
	if(B_IPHONE_IOS) return;

	// dynamic script registration not available
	if('function' !== typeof f_scripting()?.registerContentScripts) {
		debugger;
		// TODO: implement
		throw new Error('static script registration for app not yet implemented');
	}
	// 
	else {
		// get current script
		const a_registered = await f_scripting().getRegisteredContentScripts({
			ids: [H_CONTENT_SCRIPT_DEFS.mcs_keplr().id],
		});

		// new script registration definition
		const gc_script = H_CONTENT_SCRIPT_DEFS.mcs_keplr({
			matches: a_matches,
		});

		// mcs-keplr currently registered and matches are not exclusive (i.e., they are being added to existing)
		if(a_registered.length && !b_exclusive) {
			// concat matches
			const a_concat = a_matches.concat(a_registered[0].matches || []);

			// update matches list in registration definition by distinct items
			gc_script.matches = [...new Set(a_concat)];

			// update registration
			await f_scripting().updateContentScripts([gc_script]);
		}
		// not yet registered; register
		else {
			await set_script_registration(gc_script, true);
		}
	}
}


/**
 * Enables/disables Keplr compatibility mode globally
 */
export async function set_keplr_compatibility_mode(b_enabled?: boolean): Promise<void> {
	console.info(`${'boolean' === typeof b_enabled? b_enabled? 'Enabling': 'Disabling': 'Determining'} keplr compatibility mode`);

	// compatibility mode is being set; save setting to public storage
	if('boolean' === typeof b_enabled) {
		await PublicStorage.keplrCompatibilityMode(b_enabled);
	}
	// argument absence means to set mode based on current setting; fetch it from public storage
	else {
		b_enabled = await PublicStorage.keplrCompatibilityMode();
	}

	console.info(`Conducting script registration in order to ${b_enabled? 'enable': 'disable'}`);

	// passively init detection mode if unset
	const b_detection = await PublicStorage.keplrDetectionMode();

	// browser is able to (unr)register content scripts
	if(f_scripting()) {
		console.info('Browser scripting available');

		// compatibility mode is being enabled
		if(b_enabled) {
			// unconditional polyfill mode
			if(await PublicStorage.keplrPolyfillMode()) {
				console.info('Unconditional polyfill mode selected');

				// ensure polyfill is enabled for all secure locations
				await keplr_polyfill_script_add_matches(['https://*/*', 'file:///*'], true);
			}
			// polyfill is conditional and wallet is unlocked
			else if(await Vault.isUnlocked()) {
				console.info('Conditional polyfill mode and wallet is unlocked');

				// get all apps that depend on Keplr API
				const a_apps = await Apps.filter({
					api: AppApiMode.KEPLR,
				});

				// compute set of distinct app origins for script registration
				const as_origins = new Set(a_apps.map(([, g_app]) => Apps.scriptMatchPatternFrom(g_app)));

				// at least one app is using keplr polyfil
				if(as_origins.size) {
					// ensure polyfill is enabled for each dependent app (exhaustive list, make exclusive)
					await keplr_polyfill_script_add_matches([...as_origins], true);
				}
			}

			console.info('Ensuring witness script is enabled');

			// ensure witness script is enabled
			await set_script_registration(H_CONTENT_SCRIPT_DEFS.ics_witness(), true);
		}
		// compatibility mode is being disabled
		else {
			// unregister witness and keplr polyfill content scripts entirely
			await Promise.all([
				set_script_registration(H_CONTENT_SCRIPT_DEFS.ics_witness(), false),
				set_script_registration(H_CONTENT_SCRIPT_DEFS.mcs_keplr(), false),
			]);
		}
	}
	// browser cannot unregister the content scripts
	else {
		console.info('Browser scripting NOT available');

		// set the session flags for content scripts to read from
		return SessionStorage.set({
			keplr_compatibility_mode_disabled: !b_enabled,
			keplr_polyfill_mode_enabled: b_enabled? await PublicStorage.keplrCompatibilityMode(): false,
		});
	}
}


/**
 * Enables/disables the Keplr automatic detection feature
 */
export async function set_keplr_detection(b_enabled: boolean): Promise<void> {
	// need to enable a setting publicly, so the wallet knows to prompt user if its locked
	await PublicStorage.keplrDetectionMode(b_enabled);
}


/**
 * Enables/disables the unconditional injection of the Keplr polyfill
 */
export async function set_keplr_polyfill(b_enabled: boolean): Promise<void> {
	// set flag in public storage that will cause keplr polyfill to be injected 
	await PublicStorage.keplrPolyfillMode(b_enabled);

	// update compatibility mode
	await set_keplr_compatibility_mode();
}

