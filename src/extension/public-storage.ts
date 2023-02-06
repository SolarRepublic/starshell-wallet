import type {JsonObject, JsonValue, Nilable, Promisable} from '#/meta/belt';
import type {Store, StoreKey} from '#/meta/store';

import {precedes} from './semver';

import {SI_VERSION} from '#/share/constants';
import {base93_to_buffer, buffer_to_base93} from '#/util/data';


interface LastSeen extends JsonObject {
	time: number;
	version: string;
}

type StorageSchema = {
	salt: {
		interface: string;
	};

	/**
	 * Hash params for password
	 */
	hash_params: {
		interface: StoredHashParams;
	};

	base: {
		interface: string;
	};

	installed: {
		interface: number;
	};

	last_seen: {
		interface: LastSeen;
	};

	/**
	 * When enabled, allows Keplr to be detected and/or polyfilled
	 */
	keplr_compatibility_mode: {
		interface: boolean;
	};

	/**
	 * When enabled, allows Keplr to be detected
	 */ 
	keplr_detection_mode: {
		interface: boolean;
	};

	/**
	 * When enabled, polyfills Keplr unconditionally
	 */
	keplr_polyfill_mode: {
		interface: boolean;
	};

	/**
	 * When enabled, forces injection of main world content scripts where appropriate
	 */
	force_mcs_injection: {
		interface: boolean;
	};
};

type PublicStorageKey = keyof StorageSchema;

export function storage_get_all(): Promise<Store> {
	return chrome.storage.local.get(null) as Promise<Store>;
}

export async function storage_get<w_value extends any=any>(si_key: StoreKey): Promise<w_value | null> {
	return (await chrome.storage.local.get([si_key]))[si_key] ?? null;
}

export function storage_set(h_set: JsonObject): Promise<void> {
	return chrome.storage.local.set(h_set);
}

export function storage_remove(si_key: string): Promise<void> {
	return chrome.storage.local.remove(si_key);
}

export function storage_clear(): Promise<void> {
	return chrome.storage.local.clear();
}


export async function public_storage_get<w_value extends any=any>(si_key: PublicStorageKey): Promise<w_value | null> {
	return await storage_get<w_value>(`@${si_key}`);
}

export function public_storage_put(si_key: PublicStorageKey, w_value: JsonValue): Promise<void> {
	return storage_set({
		[`@${si_key}`]: w_value,
	});
}

export function public_storage_remove(si_key: PublicStorageKey): Promise<void> {
	return storage_remove(`@${si_key}`);
}

async function getter_setter<
	si_key extends PublicStorageKey,
	w_value extends StorageSchema[si_key]['interface'] | null,
>(si_key: si_key, w_set?: w_value, fk_set?: () => Promisable<void>): Promise<w_value | null> {
	// set new state
	if('undefined' !== typeof w_set) {
		// update value in storage
		await public_storage_put(si_key, w_set);

		// set callback
		await fk_set?.();

		// return the set value
		return w_set;
	}
	// delete item
	else if(null === w_set) {
		await public_storage_remove(si_key);

		return null;
	}
	// getting state; fetch from storage
	else {
		return await public_storage_get(si_key) ?? null;
	}
}

async function auto_getter_setter<
	si_key extends PublicStorageKey,
	w_value extends StorageSchema[si_key]['interface'],
>(si_key: si_key, w_autoset: w_value, w_set?: Nilable<w_value>): Promise<w_value> {
	// proxy
	const z_answer = await getter_setter(si_key, w_set);

	// automatically enable if unset
	if(null === z_answer) {
		// eslint-disable-next-line @typescript-eslint/no-extra-parens
		return (await public_storage_put(si_key, w_autoset), w_autoset);
	}
	else {
		return z_answer;
	}
}

export interface StoredHashParams extends JsonObject {
	iterations: number;
	memory: number;
}

export const PublicStorage = {
	async salt(atu8_salt?: Uint8Array | null): Promise<Uint8Array | undefined> {
		const s_salt = await getter_setter('salt', atu8_salt? buffer_to_base93(atu8_salt): void 0) || '';

		return s_salt? base93_to_buffer(s_salt): void 0;
	},

	async hashParams(g_params?: StoredHashParams | null): Promise<StoredHashParams | undefined> {
		return await getter_setter('hash_params', g_params || void 0) || void 0;
	},

	// async base(atu8_salt?: Uint8Array | null): Promise<Uint8Array | undefined> {
	// 	const s_salt = await getter_setter('base', atu8_salt? buffer_to_base93(atu8_salt): void 0) || '';

	// 	return s_salt? base93_to_buffer(s_salt): void 0;
	// },

	async lastSeen(): Promise<null | LastSeen> {
		return await public_storage_get<LastSeen>('last_seen');
	},

	async isUpgrading(si_version=SI_VERSION): Promise<boolean> {
		const g_seen = await PublicStorage.lastSeen();

		return !g_seen || precedes(g_seen.version, si_version);
	},

	async markSeen(): Promise<void> {
		await public_storage_put('last_seen', {
			time: Date.now(),
			version: SI_VERSION,
		});
	},

	async installed(): Promise<number | null> {
		const xt_installed = await public_storage_get<number>('installed');

		if(!xt_installed) {
			await public_storage_put('installed', Date.now());
		}

		return xt_installed;
	},

	/**
	 * Enables/disables Keplr compatibility mode globally
	 */
	async keplrCompatibilityMode(b_enabled?: boolean): Promise<boolean> {
		return await auto_getter_setter('keplr_compatibility_mode', true, b_enabled);
	},

	/**
	 * Enables/disables Keplr detection mode globally
	 */
	async keplrDetectionMode(b_enabled?: boolean): Promise<boolean> {
		return await auto_getter_setter('keplr_detection_mode', true, b_enabled);
	},

	/**
	 * Enables/disables the unconditional polyfill of Keplr
	 */
	async keplrPolyfillMode(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('keplr_polyfill_mode', b_enabled) || false;
	},

	/**
	 * Enables/disables the unconditional polyfill of Keplr
	 */
	async forceMcsInjection(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('force_mcs_injection', b_enabled) || false;
	},
};
