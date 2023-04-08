import type {RateLimitConfig} from './web-resource-cache';

import type {AccountPath} from '#/meta/account';
import type {ChainPath} from '#/meta/chain';

import {
	create_store_class,
	WritableStoreDict,
} from './_base';

import {SI_STORE_SETTINGS} from '#/share/constants';


export enum KeplrCompatibilityMode {
	DEFAULT = 0,
	EVERYWHERE = 1,
	NOWHERE = 2,
}

export type SettingsRegistry = {
	// 
	allow_file_urls?: boolean;

	// 
	e2e_encrypted_memos?: Partial<Record<ChainPath, {
		enabled: boolean;
		published: boolean;
	}>>;

	// 
	notice_send_encrypted_memo?: boolean;

	// 
	keplr_compatibility_mode?: KeplrCompatibilityMode;

	/**
	 * For persisting the selected account
	 */
	p_account_selected?: AccountPath;

	/**
	 * For persisting the selected chain
	 */
	p_chain_selected?: ChainPath;


	gc_rate_limit_queries_default?: RateLimitConfig;

	gc_rate_limit_webapis_default?: RateLimitConfig;

	h_chain_settings?: Record<ChainPath, {
		x_default_gas_price?: number;
		x_gas_multiplier?: number;
	}>;

	p_browser_homepage?: string;
};

export type SettingsKey = keyof SettingsRegistry;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Settings = create_store_class({
	store: SI_STORE_SETTINGS,
	extension: 'dict',
	class: class SettingsI extends WritableStoreDict<typeof SI_STORE_SETTINGS> {
		// static async get<si_key extends SettingsKey>(si_key: si_key): Promise<null | SettingsRegistry[si_key]> {
		// 	return await Settings.open((ks_settings) => ks_settings.get(si_key));
		// }

		// static async put<
		// 	si_key extends SettingsKey,
		// 	w_value extends SettingsRegistry[si_key],
		// >(si_key: si_key, w_value: w_value): Promise<void> {
		// 	return await Settings.open((ks_settings) => ks_settings.put(si_key, w_value));
		// }
	},
});
