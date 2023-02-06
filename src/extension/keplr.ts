import {try_reloading_page} from './browser';
import {PublicStorage} from './public-storage';

import type {PageInfo} from '#/script/messages';
import {set_keplr_compatibility_mode, set_keplr_detection, set_keplr_polyfill} from '#/script/scripts';
import {KeplrExtensionState, keplr_extension_state} from '#/script/utils';
import {SI_EXTENSION_ID_KEPLR} from '#/share/constants';


export async function disable_keplr_extension(g_page?: PageInfo | null): Promise<void> {
	// disable keplr extension
	await chrome.management.setEnabled(SI_EXTENSION_ID_KEPLR, false);

	// unmute starshell in case muted
	await unmute_starshell();

	if(g_page) {
		await try_reloading_page(g_page);
	}
}


export async function is_keplr_extension_enabled(): Promise<boolean | undefined> {
	try {
		return KeplrExtensionState.ENABLED === await keplr_extension_state();
	}
	catch(e_status) {}
}

export async function is_starshell_muted(): Promise<boolean | undefined> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
		return false === await PublicStorage.keplrCompatibilityMode();
	}
	catch(e_status) {}
}

export async function mute_starshell(): Promise<void> {
	// do not inject window.keplr unconditionally anymore
	await set_keplr_polyfill(false);

	// disable keplr detection
	await set_keplr_detection(false);

	// disable compatibility mode
	await set_keplr_compatibility_mode(false);
}

export async function unmute_starshell(): Promise<void> {
	// enable keplr detection
	await set_keplr_detection(true);

	// enable compatibility mode
	await set_keplr_compatibility_mode(true);
}

