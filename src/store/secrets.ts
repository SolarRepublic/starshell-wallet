import type {O} from 'ts-toolbelt';

import type {AppPath} from '#/meta/app';
import type {Promisable} from '#/meta/belt';
import type {Bech32, ChainPath} from '#/meta/chain';
import type {SecretStruct, SecretPath, SecretType, SecretSecurity} from '#/meta/secret';
import type {Snip24Permission} from '#/schema/snip-24-def';

import {fetch_cipher} from './_base';

import type {Argon2Params} from '#/crypto/argon2';
import {Argon2Type} from '#/crypto/argon2';
import {load_argon_worker} from '#/crypto/argon2-host';
import type {Bip44Path} from '#/crypto/bip44';

import SensitiveBytes from '#/crypto/sensitive-bytes';
import {decrypt, encrypt, Vault} from '#/crypto/vault';

import {storage_get_all} from '#/extension/public-storage';
import {ResourceNonExistentError} from '#/share/errors';
import {is_dict, ode, oderac} from '#/util/belt';
import {base93_to_buffer, buffer_to_base93, buffer_to_json, concat, json_to_buffer, sha256d, sha256_sync, text_to_buffer, zero_out} from '#/util/data';
import { B_DEVELOPMENT } from '#/share/constants';

type PathFrom<
	g_secret extends Pick<SecretStruct, 'type' | 'uuid'>,
> = `/secret.${g_secret['type']}/uuid.${g_secret['uuid']}`;

interface SecretFilterConfig {
	type?: SecretType;
	on?: 0 | 1;
	app?: AppPath;
	chain?: ChainPath;
	owner?: Bech32;
	contract?: Bech32;
	contracts?: Bech32[] | Record<Bech32, string>;
	mnemonic?: SecretPath<'mnemonic'>;
	name?: string;
	bip44?: Bip44Path;
	permissions?: Snip24Permission[];
	outlets?: AppPath[];
}

type StructFromFilterConfig<
	gc_filter extends SecretFilterConfig,
> = SecretStruct<
	gc_filter extends {type: SecretType}
		? gc_filter['type']
		: SecretType
	>;


export const N_ARGON2_PIN_ITERATIONS = B_DEVELOPMENT? 8: 64;
export const NB_ARGON2_PIN_MEMORY = B_DEVELOPMENT? 1024: 64 << 10;

export type SerializableArgon2Params = O.Merge<{
	salt: string;
}, Omit<Argon2Params, 'secret' | 'ad'>>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Secrets = {
	/**
	 * Encrypts arbitrary data using the given PIN
	 * @param atu8_data 
	 * @param atu8_pin 
	 * @returns 
	 */
	async encryptWithPin(atu8_data: Uint8Array, atu8_pin: Uint8Array): Promise<[Uint8Array, SecretSecurity.Struct<'pin'>]> {
		// generate random salt for hashing
		const atu8_salt = crypto.getRandomValues(new Uint8Array(32));

		// prep hashing params
		const gc_params = {
			salt: atu8_salt,
			type: Argon2Type.Argon2id,
			iterations: N_ARGON2_PIN_ITERATIONS,
			memory: NB_ARGON2_PIN_MEMORY,
		};

		// perform hashing
		const atu8_hash = await (await Vault.wasmArgonWorker()).hash({
			phrase: atu8_pin,
			hashLen: 32,
			...gc_params,
		});

		// derive aes encryption key
		const atu8_ikm = await sha256d(atu8_hash);

		// create crypto key instance
		const dk_encryption = await crypto.subtle.importKey('raw', atu8_ikm, 'AES-GCM', false, ['encrypt']);

		// generate random salt for encryption
		const atu8_salt_aes = crypto.getRandomValues(new Uint8Array(32));

		// encrypt
		const atu8_encrypted = await encrypt(atu8_data, dk_encryption, atu8_salt_aes);

		// return encrypted data and complemetary security object
		return [atu8_encrypted, {
			type: 'pin',
			hint: '',
			encryption: {
				algorithm: 'AES-GCM',
				salt: buffer_to_base93(atu8_salt_aes),
			},
			hashing: {
				algorithm: 'argon2',
				...gc_params,
				salt: buffer_to_base93(gc_params.salt),
			},
		}];
	},

	/**
	 * Decrypts data that was previously encrypted using the given PIN
	 * @param atu8_data 
	 * @param atu8_pin 
	 * @param g_security 
	 * @returns 
	 */
	async decryptWithPin(atu8_data: Uint8Array, atu8_pin: Uint8Array, g_security: SecretSecurity.Struct<'pin'>): Promise<Uint8Array> {
		// ref hashing params
		const g_params_hashing = g_security.hashing;

		// load worker
		const k_worker = await load_argon_worker();

		// perform hashing
		const atu8_hash = await k_worker.hash({
			phrase: atu8_pin,
			hashLen: 32,
			...g_params_hashing,
			salt: base93_to_buffer(g_params_hashing.salt),
		});

		// derive aes decryption key
		const atu8_ikm = await sha256d(atu8_hash);

		// create crypto key instance
		const dk_decryption = await crypto.subtle.importKey('raw', atu8_ikm, 'AES-GCM', false, ['decrypt']);

		// decrypt
		return await decrypt(atu8_data, dk_decryption, base93_to_buffer(g_security.encryption.salt));
	},

	pathFrom<g_secret extends Pick<SecretStruct, 'type' | 'uuid'>>(g_secret: g_secret): PathFrom<g_secret> {
		return `/secret.${g_secret.type}/uuid.${g_secret.uuid}` as PathFrom<g_secret>;
	},

	pathAndKeyFrom(g_secret: SecretStruct): [PathFrom<typeof g_secret>, `:${string}`] {
		const p_secret = Secrets.pathFrom(g_secret);
		return [p_secret, Secrets.keyFromPath(p_secret)];
	},

	keyFromPath(p_secret: SecretPath): `:${string}` {
		return `:${buffer_to_base93(sha256_sync(text_to_buffer(p_secret)))}`;
	},

	async put<g_secret extends SecretStruct>(atu8_data: Uint8Array, g_secret: g_secret): Promise<PathFrom<g_secret>> {
		// prepare path
		const [p_res, si_secret] = Secrets.pathAndKeyFrom(g_secret);

		// produce length prefix
		const ab_len = new Uint32Array(1).buffer;
		new DataView(ab_len).setUint32(0, atu8_data.byteLength);

		// serialize secret
		const atu8_secret = concat([new Uint8Array(ab_len), atu8_data, json_to_buffer(g_secret)]);

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// acquire vault entry
		const k_entry = await Vault.acquire(si_secret);

		// write to entry
		await k_entry.write(atu8_secret, dk_cipher);

		// release entry
		k_entry.release();

		// TODO: create fake entries to pad the rest with noise up to 16 entry blocks

		// return path
		return p_res as PathFrom<typeof g_secret>;
	},

	async update<g_secret extends SecretStruct>(g_secret: g_secret): Promise<PathFrom<g_secret>> {
		const p_secret = Secrets.pathFrom(g_secret);

		await Secrets.borrowPlaintext(p_secret, kn => Secrets.put(kn.data, g_secret));

		return p_secret;
	},

	async borrow<w_return extends any=any>(p_secret: SecretPath, fk_use: (kn_data: SensitiveBytes, g_secret: SecretStruct) => Promisable<w_return>): Promise<Awaited<w_return>> {
		// create key from path
		const si_secret = Secrets.keyFromPath(p_secret);

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// acquire vault entry
		const k_entry = await Vault.readonly(si_secret);

		// read entry's data
		const atu8_secret = await k_entry.read(dk_cipher);

		// // parse secret data
		// const nb_data = new DataView(atu8_secret.buffer).getUint32(atu8_secret.byteOffset, false);

		// empty (non-existant)
		if(!atu8_secret.byteLength) {
			throw new ResourceNonExistentError(p_secret);
		}

		let nb_data: number;
		try {
			nb_data = new DataView(atu8_secret.buffer).getUint32(atu8_secret.byteOffset, false);
		}
		catch(e_get) {
			debugger;
			throw e_get;
		}

		const atu8_data = atu8_secret.subarray(4, 4+nb_data);

		// rest is the complementary json
		const g_secret = buffer_to_json(atu8_secret.subarray(4+nb_data)) as SecretStruct;

		// wrap data
		const kn_data = new SensitiveBytes(atu8_data);

		// let caller use secret
		let w_return: Awaited<w_return>;
		try {
			w_return = await fk_use(kn_data, g_secret);
		}
		// wipe secret data after use
		finally {
			kn_data.wipe();
		}

		// return whatever caller wanted
		return w_return;
	},

	metadata<
		p_secret extends SecretPath,
	>(p_secret: p_secret): Promise<
		p_secret extends SecretPath<'mnemonic'>
			? SecretStruct<'mnemonic'>
			: p_secret extends SecretPath<'bip32_node'>
				? SecretStruct<'bip32_node'>
				: p_secret extends SecretPath<'private_key'>
					? SecretStruct<'private_key'>
					: p_secret extends SecretPath<'viewing_key'>
						? SecretStruct<'viewing_key'>
						: p_secret extends SecretPath<'query_permit'>
							? SecretStruct<'query_permit'>
							: SecretStruct
	> {
		// @ts-expect-error type system regression bug
		return Secrets.borrow(p_secret, (kn, g) => g);
	},

	/**
	 * Handles the extra security layer and borrows the plaintext secret as SensitiveBytes
	 * @param g_secret 
	 * @returns 
	 */
	borrowPlaintext<w_return extends any=any>(z_secret: SecretPath | SecretStruct, fk_use: (kn_data: SensitiveBytes, g_secret: SecretStruct) => Promisable<w_return>): Promise<Awaited<w_return>> {
		const p_secret = 'string' === typeof z_secret? z_secret: Secrets.pathFrom(z_secret);
		return Secrets.borrow(p_secret, (kn, g) => Secrets.plaintext(kn, g, fk_use));
	},

	/**
	 * Handles the extra security layer and borrows the plaintext secret as SensitiveBytes
	 * @param g_secret 
	 * @returns 
	 */
	async plaintext<w_return extends any=any>(kn_ciphertext: SensitiveBytes, g_secret: SecretStruct, fk_use: (kn_data: SensitiveBytes, g_secret: SecretStruct) => Promisable<w_return>): Promise<Awaited<w_return>> {
		// ref security type
		const si_security = g_secret.security.type;

		// prep to receive data
		let kn_data: SensitiveBytes;

		// otp security
		if('otp' === si_security) {
			kn_data = kn_ciphertext.xor(new SensitiveBytes(base93_to_buffer(g_secret.security.data)));
		}
		// none; clone raw
		else if('none' === si_security) {
			kn_data = kn_ciphertext.clone();
		}
		// other security
		else {
			throw new Error('Unknown security type');
		}

		// let caller use secret
		const w_return = await fk_use(kn_data, g_secret);

		// wipe secret data
		kn_data.wipe();

		// return whatever caller wanted
		return w_return;
	},

	async filter<gc_filter extends SecretFilterConfig>(gc_filter: gc_filter): Promise<StructFromFilterConfig<gc_filter>[]> {
		// TODO: replace with index store
		// fetch secrets
		const h_everything = await storage_get_all();

		// fetch cipher key
		const dk_cipher = await fetch_cipher();

		// keep only secrets
		const a_entries = await Promise.all(
			oderac(h_everything, (si_key) => {
				// only return a promise for interested items so that oderac filters out others
				if(':' === si_key[0]) {
					return (async() => {
						// read vault entry
						const k_entry = await Vault.readonly(si_key as `:${string}`);

						// read entry's data
						const atu8_secret = await k_entry.read(dk_cipher);

						// parse secret data
						const nb_data = new DataView(atu8_secret.buffer).getUint32(atu8_secret.byteOffset, false);

						// rest is the complementary json
						const g_secret = buffer_to_json(atu8_secret.subarray(4+nb_data)) as SecretStruct;

						// zero out key material
						zero_out(atu8_secret);

						// return metadata
						return g_secret;
					})();
				}
			}) as Promise<SecretStruct>[]
		);

		// no filter; return everything
		if(!Object.keys(gc_filter || {}).length) {
			return a_entries as unknown as StructFromFilterConfig<gc_filter>[];
		}

		// list of secrets matching given filter
		const a_matches: SecretStruct[] = [];

		// iterate through
		FILTERING_SECRETS:
		for(const g_secret of a_entries) {
			// each criterion in filter
			for(const [si_key, z_expect] of ode(gc_filter)) {
				// cache value
				const z_actual = g_secret[si_key];

				// cache typeof
				const si_typeof = typeof z_actual;

				// not defined; disqualified
				if('undefined' === si_typeof) {
					continue FILTERING_SECRETS;
				}
				// comparable json primitive
				else if(['boolean', 'number', 'string'].includes(si_typeof)) {
					// filter doesn't match; skip
					if(z_expect !== z_actual) continue FILTERING_SECRETS;
				}
				// actual item is array
				else if(Array.isArray(z_actual)) {
					// filter provided not array
					if(!Array.isArray(z_expect)) throw new TypeError(`Improper non-array filter type for array`);

					// ensure every item in expect is present in actual
					for(const w_check of z_expect) {
						if(!z_actual.includes(w_check)) continue FILTERING_SECRETS;
					}
				}
				// actual item is null
				else if(null === z_actual) {
					// filter is not null
					if(z_expect !== null) continue FILTERING_SECRETS;
				}
				// actual item is undefined; skip
				else if('undefined' === typeof z_actual) {
					// filter is not undefined
					if('undefined' !== typeof z_expect) continue FILTERING_SECRETS;
				}
				// contracts
				else if('contracts' === si_key) {
					// expectation given as array
					if(Array.isArray(z_expect)) {
						// each expected contract
						for(const sa_contract of z_expect as string[]) {
							// only reject if contract was never involved
							if(!(sa_contract in z_actual)) continue FILTERING_SECRETS;
						}
					}
					// expectation given as dict
					else if(is_dict(z_expect)) {
						// each expected contract
						for(const [sa_contract, sx_expect] of ode(z_expect) as [string, string][]) {
							// non-empty string indicates the tx hash that the permit was revoked, undefined means no permit
							if(sx_expect !== z_actual[sa_contract]) continue FILTERING_SECRETS;
						}
					}
				}
				// anything else
				else {
					throw new Error(`Filter type mismatch on key ${si_key}`);
				}
			}

			// passed filter
			a_matches.push(g_secret);
		}

		// return matches
		return a_matches as unknown as StructFromFilterConfig<gc_filter>[];
	},

	async filterMany(...a_filters: SecretFilterConfig[]): Promise<SecretStruct[]> {
		if(a_filters.length <= 1) return Secrets.filter(a_filters[0]);

		const as_secrets = new Set<SecretStruct>();

		for(const gc_filter of a_filters) {
			for(const g_secret of await Secrets.filter(gc_filter)) {
				as_secrets.add(g_secret);
			}
		}

		return [...as_secrets];
	},

	async deleteByStruct(g_secret: SecretStruct): Promise<void> {
		// prepare path
		const [, si_secret] = Secrets.pathAndKeyFrom(g_secret);

		// delete
		return await Secrets.deleteByKey(si_secret);
	},

	async deleteByPath(p_secret: SecretPath): Promise<void> {
		return Secrets.deleteByKey(Secrets.keyFromPath(p_secret));
	},

	async deleteByKey(si_secret: `:${string}`): Promise<void> {
		// acquire vault entry
		const k_entry = await Vault.acquire(si_secret);

		// delete entry
		await Vault.delete(si_secret);

		// release entry
		k_entry.release();
	},
};
