import type {Replace} from 'ts-toolbelt/out/String/Replace';

import type {AccountStruct, AccountPath, HardwareAccountLocation} from '#/meta/account';
import type {Bech32, ChainStruct, ChainNamespaceKey, ChainPath} from '#/meta/chain';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';


import {Chains} from './chains';
import {Secrets} from './secrets';
import {Settings} from './settings';

import {Bip32} from '#/crypto/bip32';
import {HardwareSigningKey, is_hwa} from '#/crypto/hardware-signing';
import RuntimeKey from '#/crypto/runtime-key';
import type {SigningKey} from '#/crypto/secp256k1';
import {Secp256k1Key} from '#/crypto/secp256k1';
import {SI_STORE_ACCOUNTS} from '#/share/constants';

import {ode} from '#/util/belt';


type PathFor<
	si_family extends ChainNamespaceKey,
	s_pubkey extends string,
> = `/family.${si_family}/account.${Replace<s_pubkey, ':', '+'>}`;

type PathFromAccount<
	g_account extends AccountStruct,
> = PathFor<g_account['family'], g_account['pubkey']>;

export class NoAccountOwner extends Error {}

export interface AccountFilter {
	name: string;
	family: ChainNamespaceKey;
}

export const Accounts = create_store_class({
	store: SI_STORE_ACCOUNTS,
	extension: ['map', 'filterable'],
	class: class AccountsI extends WritableStoreMap<typeof SI_STORE_ACCOUNTS> {
		static pathFor<
			si_family extends ChainNamespaceKey,
			s_pubkey extends string,
		>(si_family: si_family, s_pubkey: s_pubkey): PathFor<si_family, s_pubkey> {
			return `/family.${si_family}/account.${s_pubkey.replace(/:/g, '+')}` as PathFor<si_family, s_pubkey>;
		}

		static pathFrom(g_account: AccountStruct): PathFromAccount<typeof g_account> {
			return AccountsI.pathFor(g_account.family, g_account.pubkey);
		}

		static async get(si_family: ChainNamespaceKey, s_pubkey: string): Promise<null | AccountStruct> {
			return (await Accounts.read()).get(si_family, s_pubkey);
		}

		static async find(sa_owner: Bech32, g_chain: ChainStruct): Promise<[AccountPath, AccountStruct]> {
			return (await Accounts.read()).find(sa_owner, g_chain);
		}

		static async getSigningKey(g_account: AccountStruct): Promise<SigningKey> {
			// ref account secret path
			const p_secret = g_account.secret;

			// hardware
			if(is_hwa(g_account.secret)) {
				return HardwareSigningKey.init(g_account);
			}
			else {
				// fetch secret
				return await Secrets.borrowPlaintext(p_secret, async(kn_secret, g_secret) => {
					// depending on secret type
					const si_type = g_secret.type;

					// prep private key
					let kk_sk: RuntimeKey;

					// private key; return imported signing key
					if('private_key' === si_type) {
						kk_sk = await RuntimeKey.createRaw(kn_secret.data);
					}
					// bip32 node
					else if('bip32_node' === si_type) {
						// import node
						const k_node = await Bip32.import(kn_secret);

						// copy out it's private key
						kk_sk = await k_node.privateKey.clone();

						// destroy the bip32 node
						k_node.destroy();
					}
					// mnemonic; invalid
					else if('mnemonic' === si_type) {
						throw new Error(`Account should not directly use its mnemonic as its secret.`);
					}
					// other/unknown
					else {
						throw new Error(`Unknown secret type '${si_type as string}'`);
					}

					// return imported signing key (and allow public key to be exported)
					return await Secp256k1Key.import(kk_sk, true);
				});
			}
		}

		/**
		 * Retrieves the currently selected account (defaulting when not set)
		 */
		static async selected(): Promise<[AccountPath, AccountStruct]> {
			const [
				ks_accounts,
				p_account_selected,
			] = await Promise.all([
				Accounts.read(),
				Settings.get('p_account_selected'),
			]);

			const p_account = p_account_selected || Object.keys(ks_accounts.raw)[0] as AccountPath;

			const g_account = ks_accounts.at(p_account)!;

			return [p_account, g_account];
		}

		static async deleteAsset(p_account: AccountPath, p_chain: ChainPath, si_asset: Bech32): Promise<void> {
			return await Accounts.update(p_account, g => ({
				...g,
				assets: {
					...g.assets,
					[p_chain]: {
						...g.assets[p_chain],
						data: (() => {
							const h_assets = g.assets[p_chain]?.data || {};

							delete h_assets[si_asset];

							return h_assets;
						})(),
					},
				},
			}));
		}

		get(si_family: ChainNamespaceKey, s_pubkey: string): AccountStruct | null {
			// prepare path
			const p_res = AccountsI.pathFor(si_family, s_pubkey);

			// fetch
			return this._w_cache[p_res] ?? null;
		}

		async put(g_account: AccountStruct): Promise<PathFromAccount<typeof g_account>> {
			// prepare path
			const p_res = AccountsI.pathFrom(g_account);

			// update cache
			this._w_cache[p_res] = g_account;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}

		find(sa_owner: Bech32, g_chain: ChainStruct): [AccountPath, AccountStruct] {
			for(const [p_account, g_account] of ode(this._w_cache)) {
				const sa_test = Chains.addressFor(g_account.pubkey, g_chain);
				if(sa_test === sa_owner) {
					return [p_account, g_account];
				}
			}

			throw new NoAccountOwner(`The address ${sa_owner} does not belong to any accounts in the wallet`);
		}
	},
});
