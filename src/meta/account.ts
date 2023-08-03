import type {Nameable, Pfpable} from './able';
import type {Bech32, ChainNamespace, ChainNamespaceKey, ChainPath} from './chain';
import type {Cw} from './cosm-wasm';
import type {DevicePath, HardwareVendor} from './device';
import type {Resource} from './resource';
import type {SecretPath} from './secret';

import type {Bip44Path} from '#/crypto/bip44';

export type HardwareAccountLocation = `/hwa.${HardwareVendor}/${bigint}:${string}:${string}`;

export interface ParsedHardwareAccountLocation {
	type: 'hwa';
	vendor: HardwareVendor;
	coinType: number;
	pubkey: string;
	bip44: Bip44Path;
}

export interface UtilityKeyRegistry {
	walletSecurity: {
		children: {
			antiPhishingArt: {};
			snip20ViewingKey: {};
			transactionEncryptionKey: {};
		};
	};

	secretNetworkKeys: {
		children: {
			snip20ViewingKey: {};
			transactionEncryptionKey: {};
		};
	};
}

export type UtilityKeyType = keyof UtilityKeyRegistry;

export namespace UtilityKey {
	export type Children<
		si_root extends UtilityKeyType,
	> = keyof UtilityKeyRegistry[si_root]['children'] & string;
}

export type UtilityKeys = {
	[si_each in UtilityKeyType]?: SecretPath;
};

export type Account<
	si_family extends ChainNamespaceKey=ChainNamespaceKey,
	s_pubkey extends string=string,
> = Resource.New<{
	segments: [ChainNamespace.Segment<si_family>, `account.${s_pubkey}`];
	struct: [{
		/**
		 * The family of chains that the account seed is compatible with (corresponds to CAIP-2 namespace)
		 */
		family: si_family;

		/**
		 * The compressed, 33-byte public key as a base64-encoded string
		 */
		pubkey: s_pubkey;

		/**
		 * Path to secret responsible for deriving account key(s)
		 */
		secret: SecretPath<'bip32_node' | 'private_key'> | HardwareAccountLocation;

		/**
		 * Keys dervied from signatures used to generate data for specific purposes
		 */
		utilityKeys: UtilityKeys;

		/**
		 * Assets belonging to this account
		 */
		assets: Partial<Record<ChainPath, {
			/**
			 * Total fiat worth of account on given chain
			 */
			totalFiatCache: string;

			/**
			 * Ordered list of fungible tokens this account wants to appear in their balance screen
			 */
			fungibleTokens: Bech32[];

			/**
			 * Arbitrary data associated with the given account-contract pair (includes all non-fungible tokens as well)
			 */
			data: Record<Bech32, {
				/**
				 * Path to the snip20's current viewing key
				 */
				viewingKeyPath?: SecretPath<'viewing_key'>;

				/**
				 * Whether the asset is hidden from the balances screen
				 */
				hidden?: boolean;

				/**
				 * Cache of the allowances 
				 */
				allowances?: Record<Bech32, {
					/**
					 * Approved token amount
					 */
					amount: Cw.Uint128;

					/**
					 * Expiration of the entire allowance
					 */
					expiration: Cw.UnixTime;
				}>;
			}>;
		}>>;

		/**
		 * Custom data extensions
		 */
		extra?: {
			/**
			 * Aura background SVG string
			 */
			aura?: string;

			/**
			 * Pfp generation params
			 */
			pfpg?: {
				offset?: number;
			};

			/**
			 * Custom pfp status
			 */
			customPfp?: 0 | 1;

			/**
			 * Reference to which device was used to link account
			 */
			device?: DevicePath;
		};
	}, Nameable, Pfpable];
}>;

export type AccountPath = Resource.Path<Account>;
export type AccountStruct = Account['struct'];


