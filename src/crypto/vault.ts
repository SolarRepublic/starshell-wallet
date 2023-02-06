import '#/dev';

import type {Argon2Methods} from './argon2';

import type {JsonObject, JsonValue, Dict} from '#/meta/belt';
import type {Store, StoreKey} from '#/meta/store';

import {Argon2Type} from './argon2';

import {load_argon_worker} from './argon2-host';
import SensitiveBytes from './sensitive-bytes';

import type {StoredHashParams} from '#/extension/public-storage';
import {PublicStorage, public_storage_get, public_storage_put, public_storage_remove, storage_get, storage_get_all, storage_remove, storage_set} from '#/extension/public-storage';
import {SessionStorage} from '#/extension/session-storage';
import {global_broadcast} from '#/script/msg-global';

import {ATU8_DUMMY_PHRASE, ATU8_SHA256_STARSHELL, B_DEVELOPMENT, B_LOCALHOST, XG_64_BIT_MAX} from '#/share/constants';
import {NotAuthenticatedError} from '#/share/errors';
import {F_NOOP} from '#/util/belt';
import {
	base93_to_buffer,
	buffer_to_base93,
	buffer_to_hex,
	buffer_to_text,
	concat,
	hex_to_buffer,
	sha256_sync,
	text_to_buffer,
	zero_out,
} from '#/util/data';


// number of argon hashing iterations
export const N_ARGON2_ITERATIONS = B_LOCALHOST? 1
	: B_DEVELOPMENT? 8: 21;

export const NB_ARGON2_MEMORY = B_LOCALHOST? 256
	: B_DEVELOPMENT? 1024: 32 * 1024;  // 32 KiB

/**
 * Sets the block size to use when padding plaintext before encrypting for storage.
 */
const NB_PLAINTEXT_BLOCK_SIZE = 512;

// size of salt in bytes
const NB_SALT = 256 >> 3;

// size of derived AES key in bits
const NI_DERIVED_AES_KEY = 256;

// once this threshold is exceeded, do not enqueue any more recryption operations
const NB_RECRYPTION_THRESHOLD = 32 * 1024;  // 64 KiB

// algorithm options for deriving root signing key
const GC_DERIVE_ROOT_SIGNING = {
	name: 'HMAC',
	hash: 'SHA-256',
};

// algorithm options for deriving root encryption/decryption key
const GC_DERIVE_ROOT_CIPHER = {
	name: 'AES-GCM',
	length: NI_DERIVED_AES_KEY,
};

// params for hkdf common to all cases (salt gets overridden)
const GC_HKDF_COMMON = {
	name: 'HKDF',
	hash: 'SHA-256',
	salt: ATU8_SHA256_STARSHELL,
	info: Uint8Array.from([]),
};


interface VaultFields {
	atu8_ciphertext: Uint8Array;
	atu8_extra_salt: Uint8Array;
}


/**
 * Private fields for instances of `Vault`
 */
const hm_privates = new WeakMap<VaultEntry, VaultFields>();

/**
 * Verifies the integrity of the crypto API by checking the round trip values
 */
export async function test_encryption_integrity(
	atu8_data: Uint8Array,
	dk_cipher: CryptoKey,
	atu8_nonce: Uint8Array,
	atu8_verify=ATU8_SHA256_STARSHELL
): Promise<void> {
	try {
		const atu8_encrypted = await encrypt(atu8_data, dk_cipher, atu8_nonce, atu8_verify);
		const s_encrypted = buffer_to_base93(atu8_encrypted);
		const atu8_encrypted_b = base93_to_buffer(s_encrypted);
		const atu8_decrypted = await decrypt(atu8_encrypted_b, dk_cipher, atu8_nonce, atu8_verify);

		if(atu8_data.byteLength !== atu8_decrypted.byteLength) {
			throw new Error(`Byte length mismatch`);
		}

		for(let ib_each=0; ib_each<atu8_data.byteLength; ib_each++) {
			if(atu8_data[ib_each] !== atu8_decrypted[ib_each]) {
				throw new Error(`Buffers are not identical`);
			}
		}
	}
	catch(e_identity) {
		throw new Error(`Failed to complete round-trip encryption/decryption: ${e_identity}`);
	}
}



export async function restore_as_key(
	z_data: null | number[] | CryptoKey,
	w_kdf: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm,
	b_extractable: boolean,
	a_usages: KeyUsage[]
): Promise<null | CryptoKey> {
	if(Array.isArray(z_data)) {
		return await crypto.subtle.importKey('raw', Uint8Array.from(z_data), w_kdf, false, a_usages);
	}

	return z_data;
}

export function restore_as_buffer(z_data: null | number[] | Uint8Array): null | Uint8Array {
	if(Array.isArray(z_data)) {
		return Uint8Array.from(z_data);
	}

	return z_data;
}


async function hkdf_params(): Promise<typeof GC_HKDF_COMMON> {
	// get base
	const g_base = await Vault.getBase();

	// prep salt ref
	let atu8_salt: Uint8Array;

	// base exists and is valud
	if(Vault.isValidBase(g_base)) {
		// retrieve existing salt
		atu8_salt = (await PublicStorage.salt())!;

		// does not exist
		if(!atu8_salt || NB_SALT !== atu8_salt.byteLength) {
			throw new Error('Vault is irreparably corrupted. No salt was found.');
		}
	}
	// base not yet exists
	else {
		// generate new salt
		atu8_salt = crypto.getRandomValues(new Uint8Array(NB_SALT));

		// save
		await PublicStorage.salt(atu8_salt);
	}

	// parse base, return extended HKDF params
	return {
		...GC_HKDF_COMMON,
		salt: atu8_salt,
	};
}

class DecryptionError extends Error {
	constructor(public original: Error) {
		super('Failed to decrypt data: '+original);
	}
}

export async function decrypt(atu8_data: Uint8Array, dk_key: CryptoKey, atu8_nonce: Uint8Array, atu8_verify=ATU8_SHA256_STARSHELL): Promise<Uint8Array> {
	try {
		return new Uint8Array(await crypto.subtle.decrypt({
			name: 'AES-GCM',
			iv: atu8_nonce,
			additionalData: atu8_verify,
		}, dk_key, atu8_data) as Uint8Array);
	}
	catch(e_decrypt) {
		throw new DecryptionError(e_decrypt as Error);
	}
}


class EncryptionError extends Error {
	constructor(public original: Error) {
		super('Failed to encrypt data: '+original);
	}
}

export async function encrypt(atu8_data: Uint8Array, dk_key: CryptoKey, atu8_nonce: Uint8Array, atu8_verify=ATU8_SHA256_STARSHELL): Promise<Uint8Array> {
	try {
		return new Uint8Array(await crypto.subtle.encrypt({
			name: 'AES-GCM',
			iv: atu8_nonce,
			additionalData: atu8_verify,
		}, dk_key, atu8_data) as Uint8Array);
	}
	catch(e_encrypt) {
		throw new EncryptionError(e_encrypt as Error);
	}
}

interface RootKeyStruct {
	key: CryptoKey;
	vector: Uint8Array;
	nonce: bigint;
	params: StoredHashParams;
}


interface BaseParams {
	version: number;
	entropy: string;
	nonce: string;
	signature: string;
}

interface ParsedBase {
	version: number;
	entropy: Uint8Array;
	nonce: bigint;
	signature: Uint8Array;
}

interface RootKeysData {
	old: RootKeyStruct;
	new: RootKeyStruct;
	export: SensitiveBytes | null;
}

// wait for release from local frame
const h_release_waiters_local: Dict<VoidFunction[]> = {};


/**
 * Responsible for (un)marshalling data structs between encrypted-at-rest storage and unencrypted-in-use memory.
 * 
 * Example:
 * ```ts
 * const kp_contacts = await Vault.checkout('contacts');
 * await kp_contacts.unlock('password123', Store);
 * kp_contacts.save();
 * ```
 */
export const Vault = {
	async getBase(): Promise<BaseParams | undefined> {
		return await public_storage_get<BaseParams>('base') || void 0;
	},

	isValidBase(z_test: unknown): z_test is BaseParams {
		return !!z_test && 'object' === typeof z_test
			&& 'number' === typeof z_test['version']
			&& 'string' === typeof z_test['entropy']
			&& 'string' === typeof z_test['nonce']
			&& 'string' === typeof z_test['signature'];
	},

	parseBase(g_base: BaseParams): ParsedBase {
		return {
			version: g_base.version,
			entropy: hex_to_buffer(g_base.entropy),
			nonce: BigInt(g_base.nonce),
			signature: hex_to_buffer(g_base.signature),
		};
	},

	async setParsedBase(g_base: Omit<ParsedBase, 'version'>): Promise<void> {
		return await public_storage_put('base', {
			version: 1,
			entropy: buffer_to_hex(g_base.entropy),
			nonce: g_base.nonce+'',
			signature: buffer_to_hex(g_base.signature),
		});
	},

	async eraseBase(): Promise<void> {
		return await public_storage_remove('base');
	},

	/**
	 * 
	 */
	async isUnlocked(): Promise<boolean> {
		return !!await SessionStorage.get('root');
	},


	async getRootKey(): Promise<CryptoKey | null> {
		const w_root = await SessionStorage.get('root');
		if(!w_root) return null;

		return await restore_as_key(w_root, 'HKDF', false, ['deriveKey']);
	},

	async symmetricKey(a_usages: KeyUsage[]): Promise<CryptoKey> {
		const a_auth = await SessionStorage.get('auth');
		if(!a_auth) throw new NotAuthenticatedError();

		return (await restore_as_key(a_auth, {
			name: 'HMAC',
			hash: 'SHA-256',
		}, false, a_usages))!;
	},

	async symmetricSign(atu8_data: Uint8Array): Promise<Uint8Array> {
		return new Uint8Array(await crypto.subtle.sign('HMAC', await Vault.symmetricKey(['sign']), atu8_data));
	},

	async symmetricVerify(atu8_data: Uint8Array, atu8_signature: Uint8Array): Promise<boolean> {
		return await crypto.subtle.verify('HMAC', await Vault.symmetricKey(['verify']), atu8_signature, atu8_data);
	},

	async clearRootKey(): Promise<void> {
		// background page exists
		const dw_background = chrome.extension?.getBackgroundPage();
		if(dw_background) {
			delete dw_background['_dk_root'];
		}

		// global broadcast logout event
		global_broadcast({
			type: 'logout',
		});

		// in parallel
		await Promise.all([
			// clear session storage
			SessionStorage.clear(),
		]);
	},


	/**
	 * Loads the Argon2 WASM worker
	 */
	// TODO: delete in favor of direct call to function
	async wasmArgonWorker(): Promise<Argon2Methods> {
		return await load_argon_worker();
	},


	/**
	 * Create the root key by using Argon2id to derive `root0` using a WebWorker
	 */
	async deriveRootBitsArgon2(
		atu8_phrase: Uint8Array,
		atu8_nonce: Uint8Array,
		g_params: StoredHashParams
	): Promise<SensitiveBytes> {
		const k_argon_host_local = await load_argon_worker();

		return new SensitiveBytes(await k_argon_host_local.hash({
			phrase: atu8_phrase,
			salt: atu8_nonce,
			iterations: g_params.iterations,
			memory: g_params.memory,
			hashLen: 32,  // 256 bits
			parallelism: 2,
			type: Argon2Type.Argon2id,
		}));
	},


	/**
	 * Derives the old/new root keys used to decrypt/encrypt storage, respectively.
	 * @param atu8_phrase - utf-8 encoded buffer of user's plaintext passphrase
	 * @param atu8_entropy - static, 64-bit buffer (initially crypto-randomnly generated) unique to user's machine
	 * @param xg_nonce_old - the 64-bit nonce that was used to encrypt storage during the previous session
	 * @param b_export_new - if true, preserves and returns ref to new root key bytes; otherwise, wipes all key material
	 * @returns old and new: root CryptoKey object, derivation vector bytes (entropy || nonce), and the nonce as a BigInt
	 */
	async deriveRootKeys(atu8_phrase: Uint8Array, atu8_entropy: Uint8Array, xg_nonce_old: bigint, b_export_new=false): Promise<RootKeysData> {
		// prep new nonce (this is intended to be reproducible in case program exits while rotating keys)
		const xg_nonce_new = (xg_nonce_old + 1n) % (2n ** 128n);

		// prep array buffer (8 bytes for fixed entropy + 8 bytes for nonce)
		const atu8_vector_old = new Uint8Array(32);
		const atu8_vector_new = new Uint8Array(32);

		// set entropy into buffer at leading 16 bytes
		atu8_vector_old.set(atu8_entropy, 0);
		atu8_vector_new.set(atu8_entropy, 0);

		// set nonce into buffer at bottom 16 bytes
		const xg_nonce_old_hi = (xg_nonce_old >> 64n) & XG_64_BIT_MAX;
		const xg_nonce_old_lo = xg_nonce_old & XG_64_BIT_MAX;
		new DataView(atu8_vector_old.buffer).setBigUint64(16, xg_nonce_old_hi, false);
		new DataView(atu8_vector_old.buffer).setBigUint64(16+8, xg_nonce_old_lo, false);

		// set nonce into buffer at bottom 16 bytes
		const xg_nonce_new_hi = (xg_nonce_new >> 64n) & XG_64_BIT_MAX;
		const xg_nonce_new_lo = xg_nonce_new & XG_64_BIT_MAX;
		new DataView(atu8_vector_new.buffer).setBigUint64(16, xg_nonce_new_hi, false);
		new DataView(atu8_vector_new.buffer).setBigUint64(16+8, xg_nonce_new_lo, false);

		// read from stored params
		const g_params_old = (await PublicStorage.hashParams())!;

		// automatic migration; set new params from const
		const g_params_new: StoredHashParams = {
			...g_params_old,
			iterations: N_ARGON2_ITERATIONS,
			memory: NB_ARGON2_MEMORY,
		};

		// derive the two root byte sequences for this session
		const [
			kn_root_old,
			kn_root_new,
		] = await Promise.all([
			Vault.deriveRootBitsArgon2(atu8_phrase, atu8_vector_old, g_params_old),
			Vault.deriveRootBitsArgon2(atu8_phrase, atu8_vector_new, g_params_new),
		]);

		// zero out passphrase data
		zero_out(atu8_phrase);

		// derive root keys
		const [
			dk_root_old,
			dk_root_new,
		] = await Promise.all([
			crypto.subtle.importKey('raw', kn_root_old.data, 'HKDF', false, ['deriveKey']),
			crypto.subtle.importKey('raw', kn_root_new.data, 'HKDF', false, ['deriveKey']),
		]);

		// wipe root bits
		kn_root_old.wipe();
		if(!b_export_new) kn_root_new.wipe();

		return {
			old: {
				key: dk_root_old,
				vector: atu8_vector_old,
				nonce: xg_nonce_old,
				params: g_params_old,
			},
			new: {
				key: dk_root_new,
				vector: atu8_vector_new,
				nonce: xg_nonce_new,
				params: g_params_new,
			},
			export: b_export_new? kn_root_new: null,
		};
	},


	async cipherKey(dk_root: CryptoKey, b_encrypt=false): Promise<CryptoKey> {
		// return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_CIPHER, false, b_encrypt? ['encrypt', 'decrypt']: ['decrypt']);
		return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_CIPHER, true, b_encrypt? ['encrypt', 'decrypt']: ['decrypt']);
	},

	async signatureKey(dk_root: CryptoKey, b_signer=false): Promise<CryptoKey> {
		return crypto.subtle.deriveKey(await hkdf_params(), dk_root, GC_DERIVE_ROOT_SIGNING, false, b_signer? ['sign']: ['verify']);
	},

	async generateRootKeySignature(dk_root: CryptoKey): Promise<Uint8Array> {
		// derive signature key
		const dk_verify = await Vault.signatureKey(dk_root, true);

		// return signature
		return new Uint8Array(await crypto.subtle.sign('HMAC', dk_verify, ATU8_SHA256_STARSHELL));
	},

	async verifyRootKey(dk_root: CryptoKey, atu8_test: Uint8Array): Promise<boolean> {
		// derive verification key
		const dk_verify = await Vault.signatureKey(dk_root, false);

		// return verification test result
		return await crypto.subtle.verify('HMAC', dk_verify, atu8_test, ATU8_SHA256_STARSHELL);
	},

	async recryptAll(dk_root_old: CryptoKey, atu8_vector_old: Uint8Array, dk_root_new: CryptoKey, atu8_vector_new: Uint8Array): Promise<void> {
		// prep list of async operations
		const a_promises: Array<Promise<void>> = [];

		// keep running total of bytes pending to be recrypted
		let cb_pending = 0;

		// derive aes keys
		const [
			dk_aes_old,
			dk_aes_new,
		] = await Promise.all([
			Vault.cipherKey(dk_root_old, false),
			Vault.cipherKey(dk_root_new, true),
		]);

		// test encryption integrity
		{
			// prepare nonces
			const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
				vector_salt_to_nonce(atu8_vector_old, sha256_sync(text_to_buffer('dummy')), 96),
				vector_salt_to_nonce(atu8_vector_new, sha256_sync(text_to_buffer('dummy')), 96),
			]);

			await test_encryption_integrity(ATU8_DUMMY_PHRASE, await Vault.cipherKey(dk_root_old, true), atu8_nonce_old);
			await test_encryption_integrity(ATU8_DUMMY_PHRASE, dk_aes_new, atu8_nonce_new);
		}

		// read all of storage
		const h_local = await storage_get_all();

		// each key
		for(const si_key in h_local) {
			// public; skip
			if('@' === si_key[0]) continue;

			// prepare nonces
			const [atu8_nonce_old, atu8_nonce_new] = await Promise.all([
				vector_salt_to_nonce(atu8_vector_old, sha256_sync(text_to_buffer(si_key)), 96),
				vector_salt_to_nonce(atu8_vector_new, sha256_sync(text_to_buffer(si_key)), 96),
			]);

			// ready from storage
			const sx_entry = await storage_get<string>(si_key as StoreKey);

			// skip no data
			if(!sx_entry) continue;

			// deserialize
			const atu8_entry = base93_to_buffer(sx_entry);

			// byte length
			cb_pending += atu8_entry.byteLength;

			/* eslint-disable @typescript-eslint/no-loop-func */
			// enqueue async operation
			a_promises.push((async() => {
				// decrypt its data with old root key
				let atu8_data: Uint8Array;
				try {
					atu8_data = await decrypt(atu8_entry, dk_aes_old, atu8_nonce_old);
				}
				// decryption failed; retry with new key (let it throw if it fails)
				catch(e_decrypt) {
					atu8_data = await decrypt(atu8_entry, dk_aes_new, atu8_nonce_new);
				}

				// encrypt it with new root key
				const atu8_replace = await encrypt(atu8_data, dk_aes_new, atu8_nonce_new);

				// save encrypted data back to store
				await storage_set({
					[si_key]: buffer_to_base93(atu8_replace),
				});

				// done; clear bytes from pending
				cb_pending -= atu8_entry.byteLength;
			})());
			/* eslint-enable @typescript-eslint/no-loop-func */

			// exceeded threshold
			if(cb_pending > NB_RECRYPTION_THRESHOLD) {
				// wait for operations to finish
				await Promise.all(a_promises);

				// continue
				a_promises.length = 0;
			}
		}

		// wait for all operations to finish
		await Promise.all(a_promises);
	},


	async peekJson(si_key: StoreKey, dk_cipher: CryptoKey): Promise<null | Store[typeof si_key]> {
		// checkout store
		const kp_store = await Vault.readonly(si_key);

		// read from it
		const w_read = kp_store.readJson(dk_cipher);

		// return the json
		return w_read;
	},


	/**
	 * Obtain a readonly vault entry by its given key identifier.
	 */
	async readonly(si_key: StoreKey): Promise<VaultEntry> {
		// read entry ciphertext
		const sx_entry = await storage_get<string>(si_key);

		// create instance
		return new VaultEntry(si_key, sx_entry ?? '');
	},


	/**
	 * Acquires a mutally exclusive lock to a writable vault entry by its given key identifier.
	 * @param si_key key identifier
	 * @returns new vault entry
	 */
	acquire(si_key: StoreKey, c_attempts=0): Promise<WritableVaultEntry> {
		return new Promise((fk_acquired) => {
			// abort signal timeout
			const d_controller = new AbortController();
			const i_abort = (globalThis as typeof window).setTimeout(() => {
				d_controller.abort();
			}, 5e3);

			// request lock
			void navigator.locks.request(`store:${si_key}`, {
				mode: 'exclusive',
				signal: d_controller.signal,
			}, () => new Promise(async(fk_release) => {
				// cancel abort controller
				clearTimeout(i_abort);

				// broadcast global
				global_broadcast({
					type: 'acquireStore',
					value: {
						key: si_key,
					},
				});

				// read entry ciphertext
				const sx_entry = await storage_get<string>(si_key);

				// prepare release callback
				const f_release_callback = () => {
					// cancel timeout
					clearTimeout(i_lease);

					// resolve promise
					fk_release(void 0);
				};

				// create lease timeout
				const i_lease = (globalThis as typeof window).setTimeout(() => {
					// log error
					console.error(`${si_key} mutex was not released within time limit. Forcibly revoking access`);

					// neuter entry instance and allow for callback
					k_entry.release();
				}, 3e3);

				// create instance
				const k_entry = new WritableVaultEntry(si_key, sx_entry ?? '', f_release_callback);

				// return instance to caller
				fk_acquired(k_entry);
			}));
		});
	},

	async delete(si_key: StoreKey): Promise<void> {
		await storage_remove(si_key);
	},
};


function VaultEntry$_fields(kv_this: VaultEntry): VaultFields {
	// lookup private fields
	const g_privates = hm_privates.get(kv_this);

	// store is not loaded
	if(!g_privates) {
		throw new Error(`Attempted to use '${kv_this._si_key}' store after it was released or it was never opened for writing.`);
	}

	return g_privates;
}

async function vector_salt_to_nonce(atu8_vector: Uint8Array, atu8_salt: Uint8Array, ni_bits=96): Promise<Uint8Array> {
	const dk_hkdf = await crypto.subtle.importKey('raw', atu8_vector, 'HKDF', false, ['deriveBits']);

	return new Uint8Array(await crypto.subtle.deriveBits({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: atu8_salt,
		info: new Uint8Array(0),
	}, dk_hkdf, 96));
}

export class VaultEntry<
	si_key extends StoreKey=StoreKey,
	w_entry extends Store[si_key]=Store[si_key],
> {
	/**
	 * Not for public use. Instead, use static method {@linkcode Vault.acquire}
	 */
	constructor(public _si_key: si_key, sx_store: string) {
		hm_privates.set(this, {
			atu8_ciphertext: base93_to_buffer(sx_store),
			atu8_extra_salt: sha256_sync(text_to_buffer(_si_key)),
		});
	}


	/**
	 * Reads raw byte stream from decrypted storage entry
	 */
	async read(dk_cipher: CryptoKey): Promise<Uint8Array> {
		// load decryption vector
		const atu8_vector = restore_as_buffer(await SessionStorage.get('vector'));
		if(!atu8_vector) {
			throw new NotAuthenticatedError();
		}

		// ref private field struct
		const g_privates = VaultEntry$_fields(this);

		// nothing to decrypt; return blank data
		if(!g_privates.atu8_ciphertext.byteLength) {
			return new Uint8Array(0);
		}

		// recreate nonce
		const atu8_nonce = await vector_salt_to_nonce(atu8_vector, g_privates.atu8_extra_salt);

		// decrypt
		const atu8_decrypted = await decrypt(g_privates.atu8_ciphertext, dk_cipher, atu8_nonce);

		// decode
		const dv_decrypted = new DataView(atu8_decrypted.buffer);
		const nb_data = dv_decrypted.getUint32(0);
		try {
			return atu8_decrypted.subarray(4, nb_data+4);
		}
		// bizarre firefox bug thinks the uint8array came from another origin
		catch(e_read) {
			console.warn(`Recovering from subarray access bug`);
			return new Uint8Array(atu8_decrypted).subarray(4, nb_data+4);
		}
	}


	/**
	 * Reads decrypted storage entry as JSON
	 */
	async readJson(dk_cipher: CryptoKey): Promise<null | w_entry> {
		// read
		let h_store: JsonObject = {};
		try {
			// decrypt
			const atu8_store = await this.read(dk_cipher);

			// empty
			if(!atu8_store.byteLength) return null;

			// deserialize
			h_store = JSON.parse(buffer_to_text(atu8_store));

			// zero out
			zero_out(atu8_store);
		}
		// read error
		catch(e_read) {
			// attempt to release store
			try {
				if(this instanceof WritableVaultEntry) {
					this.release();
				}
			}
			catch(e_ignore) {}

			// throw
			throw e_read;
		}

		// return deserialized object
		return h_store as w_entry;
	}
}


export class WritableVaultEntry<
	si_key extends StoreKey=StoreKey,
	w_entry extends Store[si_key]=Store[si_key],
> extends VaultEntry<si_key, w_entry> {
	constructor(si_key: si_key, sx_store: string, private readonly _f_release=F_NOOP) {
		super(si_key, sx_store);
	}

	/**
	 * Destroy's this instance and returns the store's key to the registry.
	 */
	release(): void {
		// assert that store is loaded
		VaultEntry$_fields(this);

		// neuter private fields
		hm_privates.delete(this);

		// console.warn(`mutex:${this._si_key}/?.${SI_FRAME_LOCAL}]: Releasing mutex`);

		// local notify
		if(this._si_key in h_release_waiters_local) {
			for(const f_notify of h_release_waiters_local[this._si_key]) {
				f_notify();
			}
		}

		// local mutex release
		this._f_release();

		// broadcast mutex removal
		global_broadcast({
			type: 'releaseStore',
			value: {
				key: this._si_key,
			},
		});
	}


	/**
	 * Save the given data to the underlying storage.
	 */
	async write(atu8_data: Uint8Array, dk_cipher: CryptoKey, b_init=false): Promise<void> {
		// ref private fields
		const g_privates = VaultEntry$_fields(this);

		// load encryption vector
		const atu8_vector = restore_as_buffer(await SessionStorage.get('vector'));
		if(!atu8_vector) {
			throw new NotAuthenticatedError();
		}

		// recreate nonce
		const atu8_nonce = await vector_salt_to_nonce(atu8_vector, g_privates.atu8_extra_salt, 96);

		// cache input data size
		const nb_data = atu8_data.byteLength;

		// compute size of output block (4 bytes for payload len + 16 bytes for AES tag)
		const nb_padded = (Math.ceil((nb_data + 4 + 16) / NB_PLAINTEXT_BLOCK_SIZE) * NB_PLAINTEXT_BLOCK_SIZE) - 4 - 16;

		// create padding to fill empty space in block
		const atu8_padding = crypto.getRandomValues(new Uint8Array(nb_padded - nb_data));

		// concat: len(msg) || msg || padding
		const atu8_padded = concat([new Uint8Array(4), atu8_data, atu8_padding]);

		// write the length of the ciphertext within the padded message
		new DataView(atu8_padded.buffer).setUint32(atu8_padded.byteOffset, nb_data);

		// encrypt the padded and encoded block
		const atu8_ciphertext = await encrypt(atu8_padded, dk_cipher, atu8_nonce);

		// save ciphertext to storage, using optimal base93 encoding for JSON
		await storage_set({
			[this._si_key]: buffer_to_base93(atu8_ciphertext),
		});

		// zero out previous data in memory
		zero_out(g_privates.atu8_ciphertext);

		// reload cache
		g_privates.atu8_ciphertext = atu8_ciphertext;

		// broadcast event
		queueMicrotask(() => {
			global_broadcast({
				type: 'updateStore',
				value: {
					key: this._si_key,
					init: b_init,
				},
			});
		});
	}


	/**
	 * Reads decrypted storage entry as JSON
	 */
	async writeJson(w_value: JsonValue, dk_cipher: CryptoKey, b_init=false): Promise<void> {
		// encode stringified json
		const atu8_data = text_to_buffer(JSON.stringify(w_value));

		// write to vault
		return await this.write(atu8_data, dk_cipher, b_init);
	}
}

