
import type {Secp256k1} from '@solar-republic/wasm-secp256k1';

import {instantiateSecp256k1Bytes} from '@solar-republic/wasm-secp256k1';

import RuntimeKey from './runtime-key';

import {sha256, zero_out} from '#/util/data';


function F_DESTROYED(): never {
	throw new Error('The Secp256k1 instance being called has been destroyed');
}


// shared secp256k1 instance
let y_secp256k1: Secp256k1 | undefined;

// callbacks waiting for init
let a_wait_secp256k1: ((y: Secp256k1) => void)[] | null = null;

// request to initialize secp256k1
async function init_secp256k1(): Promise<Secp256k1> {
	// already initialized
	if(y_secp256k1) return y_secp256k1;

	// already in the process of initializing
	if(a_wait_secp256k1) {
		// add to callback list
		return new Promise((fk_resolve) => {
			a_wait_secp256k1!.push(fk_resolve);
		});
	}

	// start accepting additional listeners
	a_wait_secp256k1 = [];

	// fetch wasm bytes from resource
	const ab_wasm_bytes = await (await fetch('/bin/secp256k1.wasm')).arrayBuffer();

	// initialize
	try {
		y_secp256k1 = await instantiateSecp256k1Bytes(ab_wasm_bytes, crypto.getRandomValues(new Uint8Array(32)));
	}
	catch(e_instantiate) {
		debugger;
		console.error(`Failed to instantiate WASM module for secp256k1;\n${e_instantiate.stack || e_instantiate}`);
		throw e_instantiate;
	}

	// copy list
	const a_execs = a_wait_secp256k1.slice();

	// don't allow more pushing
	a_wait_secp256k1 = null;

	// execute callbacks
	for(const fk_callback of a_execs) {
		fk_callback(y_secp256k1);
	}

	// return instance
	return y_secp256k1;
}


interface Secp256k1KeyFields {
	// private key
	kk_sk: RuntimeKey;

	// compressed public key
	atu8_pk33: Uint8Array;

	// uncompressed public key
	atu8_pk65: Uint8Array;

	// exportable flag
	b_exportable: boolean;
}

// private fields
const hm_privates = new Map<Secp256k1Key, Secp256k1KeyFields>();

export interface SigningKey {
	exportPublicKey(b_uncompressed?: boolean): Uint8Array;
	sign(atu8_message: Uint8Array, b_extra_entropy?: boolean): Promise<Uint8Array>;
	ecdh(atu8_pk: Uint8Array): Promise<Uint8Array>;
}

/**
 * Encapsulates a secp256k1 private key.
 */
// export class Secp256k1Key<si_type extends KeyType> extends ManagedKey<si_type> {
export class Secp256k1Key {
	/**
	 * Validate the given secp256k1 private key is within curve order
	 */
	static validatePrivateKey(atu8_sk: Uint8Array): boolean {
		// assertion error
		if(!y_secp256k1) throw new Error('Secp256k1 WASM module was never initialized');

		// validate key
		return y_secp256k1.validatePrivateKey(atu8_sk) || false;
	}

	/**
	 * Initializes the WASM instance
	 */
	static async init(): Promise<void> {
		// secp256k1 not yet initialized; initialize it
		if(!y_secp256k1) await init_secp256k1();
	}

	/**
	 * Verifies the given public key produced the given signature for the given message.
	 */
	static async verify(atu8_signature: Uint8Array, atu8_message: Uint8Array, atu8_pk: Uint8Array): Promise<boolean> {
		// secp256k1 not yet initialized; initialize it
		if(!y_secp256k1) await init_secp256k1();

		// compute message digest
		const atu8_digest = await sha256(atu8_message);

		// verify signature
		return y_secp256k1!.verifySignatureCompactLowS(atu8_signature, atu8_pk, atu8_digest);
	}


	/**
	 * Generates a new secp256k1 private key pair using CSPRNG.
	 */
	static async generatePrivateKey(b_exportable=false): Promise<[RuntimeKey, Secp256k1Key]> {
		// secp256k1 not yet initialized; initialize it
		if(!y_secp256k1) await init_secp256k1();

		// generate an original private key in an explicit, self-contained scope
		const kk_sk = await RuntimeKey.create(() => {
			// generate private key according to FIPS 186-4 B.4.2 <https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf>
			let atu8_sk: Uint8Array;
			while(!y_secp256k1!.validatePrivateKey(atu8_sk=crypto.getRandomValues(new Uint8Array(32))));

			// return private key data (will automatically get zero-ed out by caller)
			return atu8_sk;
		});

		// import into new instance
		return [kk_sk, await Secp256k1Key.import(kk_sk, b_exportable)];
	}


	/**
	 * Uncompresses a public key
	 */
	static uncompressPublicKey(atu8_pubkey: Uint8Array): Uint8Array {
		return y_secp256k1!.uncompressPublicKey(atu8_pubkey);
	}


	/**
	 * Imports a secp256k1 private key to be used for signing/verifying.
	 * @param kk_sk - the private key
	 * @param b_exportable - whether or not the _public key_ can be exported
	 * @returns a new {@linkcode Secp256k1} instance
	 */
	static async import(kk_sk: RuntimeKey, b_exportable=false): Promise<Secp256k1Key> {
		// secp256k1 not yet initialized; initialize it
		if(!y_secp256k1) await init_secp256k1();

		// create instance and import key
		return await new Secp256k1Key(y_secp256k1!).import(kk_sk, b_exportable);
	}


	// whether the instance has been initialized
	protected _b_init = false;
	protected _b_destroyed = false;

	/**
	 * Not for public use. Instead, use static method {@linkcode Secp256k1Key.import} or
	 * {@linkcode Secp256k1Key.generatePrivateKey}.
	 */
	private constructor(protected _y_secp256k1: Secp256k1) {}


	/**
	 * Imports a secp256k1 private key.
	 * @param kk_sk - the private key
	 * @param b_exportable - whether or not the _public key_ can be exported
	 * @returns `this`
	 */
	async import(kk_sk: RuntimeKey, b_exportable=false): Promise<this> {
		const _y_secp256k1 = this._y_secp256k1;

		// access private key
		await kk_sk.access((atu8_sk) => {
			// validate private key
			if(!this._y_secp256k1.validatePrivateKey(atu8_sk)) {
				throw new Error(`Failed to validate secp256k1 private key`);
			}

			// store private fields
			hm_privates.set(this, {
				kk_sk,
				atu8_pk33: _y_secp256k1.derivePublicKeyCompressed(atu8_sk),
				atu8_pk65: _y_secp256k1.derivePublicKeyUncompressed(atu8_sk),
				b_exportable,
			});
		});

		// validate pubkeys
		const {
			atu8_pk33,
			atu8_pk65,
		} = hm_privates.get(this)!;

		// validate the compressed public key
		if(!_y_secp256k1.validatePublicKey(atu8_pk33)) {
			throw new Error(`Failed to validate secp256k1 compressed public key`);
		}

		// validate the uncompressed public key
		if(!_y_secp256k1.validatePublicKey(atu8_pk65)) {
			throw new Error(`Failed to validate secp256k1 uncompressed public key`);
		}

		// save initialization state
		this._b_init = true;

		// enable chaining
		return this;
	}


	/**
	 * Whether or not this key has been destroyed
	 */
	get isDestroyed(): boolean {
		return this._b_destroyed;
	}


	/**
	 * Destroys all key material
	 */
	destroy(): void {
		const {
			kk_sk,
			atu8_pk33,
			atu8_pk65,
		} = hm_privates.get(this)!;

		// wipe all key material
		kk_sk.destroy();
		zero_out(atu8_pk33);
		zero_out(atu8_pk65);

		// delete private refs
		hm_privates.delete(this);

		// mark as destroyed
		this._b_destroyed = true;

		// safe-guard against mistakes
		this.import = this.exportPublicKey = this.add = this.ecdh = this.sign = this.verify = F_DESTROYED;
	}


	/**
	 * Exports the public key iff instance was constructed with exportable set to `true`.
	 * Otherwise throws an error.
	 * @param b_uncompressed - pass `true` to return the uncompressed 65-byte key, otherwise returns the compressed 33-byte key by default.
	 */
	exportPublicKey(b_uncompressed=false): Uint8Array {
		const {
			atu8_pk33,
			atu8_pk65,
			b_exportable,
		} = hm_privates.get(this)!;

		// public key is exportable
		if(true === b_exportable) {  // eslint-disable-line @typescript-eslint/no-unnecessary-boolean-literal-compare
			// user wants the uncompressed public key
			if(b_uncompressed) {
				return atu8_pk65;
			}
			// otherwise return the compressed public key by default
			else {
				return atu8_pk33;
			}
		}
		// public key is not exportable
		else {
			throw new Error('Public key is not exportable');
		}
	}


	/**
	 * Signs arbitrary message using this private key, returning the compact, non-malleable signature.
	 */
	async sign(atu8_message: Uint8Array, b_extra_entropy=false): Promise<Uint8Array> {
		// hash message
		const atu8_digest = await sha256(atu8_message);

		// destructure private field(s)
		const {
			kk_sk,
		} = hm_privates.get(this)!;

		// access the private key; sign the message `r || S` where `S` is in lower-S form
		return await kk_sk.access((atu8_sk) => {
			if(b_extra_entropy) {
				return this._y_secp256k1.signMessageHashCompact(atu8_sk, atu8_digest, crypto.getRandomValues(new Uint8Array(32)));
			}
			else {
				return this._y_secp256k1.signMessageHashCompact(atu8_sk, atu8_digest);
			}
		});
	}


	/**
	 * Verifies that this key produced the given signature for the given message.
	 */
	async verify(atu8_signature: Uint8Array, atu8_message: Uint8Array): Promise<boolean> {
		// compute message digest
		const atu8_digest = await sha256(atu8_message);

		// destructure private field
		const {
			atu8_pk65,
		} = hm_privates.get(this)!;

		// perform signature verification
		return this._y_secp256k1.verifySignatureCompactLowS(atu8_signature, atu8_pk65, atu8_digest);
	}


	/**
	 * Performs ECDH to get a shared secret with another public key.
	 */
	async ecdh(atu8_pk: Uint8Array): Promise<Uint8Array> {
		// destructure private field(s)
		const {
			kk_sk,
		} = hm_privates.get(this)!;

		// access the private key; perform ecdh; return secret
		return await kk_sk.access(atu8_sk => this._y_secp256k1.ecdh(atu8_sk, atu8_pk));
	}


	/**
	 * Tweaks a private key by adding a value to it
	 */
	add(atu8_tweak: Uint8Array): Promise<Uint8Array> {
		// destructure private field(s)
		const {
			kk_sk,
		} = hm_privates.get(this)!;

		// access the private key; add tweak private key
		return kk_sk.access(atu8_sk => this._y_secp256k1.addTweakPrivateKey(atu8_sk, atu8_tweak));
	}
}
