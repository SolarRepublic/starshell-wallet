import SensitiveBytes from './sensitive-bytes';

import {zero_out} from '#/util/data';


/**
 * Callback that returns or resolves to a private key as an Uint8Array.
 */
export type KeyProducer<dc_type extends ArrayBufferView=Uint8Array> = () => dc_type | Promise<dc_type>;


/**
 * Fetch a derived key deterministically given some salt and optional info.
 */
async function fetch_derived(dk_base: CryptoKey, atu8_salt: Uint8Array, ni_bits=256, atu8_info=new Uint8Array(0)): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.deriveBits({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: atu8_salt,
		info: atu8_info,
	}, dk_base, ni_bits));
}


/**
 * Creates a one-time pad for encrypting the private key in memory.
 * {@link https://en.wikipedia.org/wiki/One-time_pad}
 * 
 * Given a private key 's', derive two 256-bit keys (v, t) such that `v XOR t = s` .
 * The purpose of creating (v, t) is to conceal the private key when secure key options are not
 * available on the system (e.g., Web Crypto does not support secp256k1 private keys).
 * 
 * Instead, generate a random base key and import it into a new CryptoKey object that is not extractable
 * and can only be used to derive bits. The reasononing behind not simply making this key extractable is
 * to be able to derive new keys of any length.
 * 
 * Using the base key object, derive bits to produce the 'derived' key 'v'.
 * 
 * The next step is to compute the delta key 't' such that `v XOR t = s`.
 * 
 * Finally, wipe all intermediate buffers. At this point, the salt needed for deriving the 'derived' key,
 * and the 'delta' key are the only relevant data stored in process memory. The complementary 'base' key
 * is accessible via reference to a CryptoKey object, ideally stored in cryptographically secure subsystems.
 * 
 * Any time the private key is needed for signing (or any other task, all of which must happen in-process),
 * the steps are:
 *   - acquire references to the base key CryptoKey and the salt Uint8Array
 *   - asynchronously derive the 'derived' key using the base key
 *   - acquire reference to the 'delta' key
 *   - compute private key by performing `derived_key XOR delta_key`
 *   - use the private key
 *   - wipe the derived key and private key buffers
 * 
 * Overall, this does not add a great deal of protection against a sufficiently privileged & capable attacker,
 * however, it does (albeit under ideal circumstances) reduce the amount of time the private key exists at
 * a single location within process memory, thus reducing its temporal footprint.
 */
async function generate_pair(fk_sk: KeyProducer, atu8_salt: Uint8Array, ni_bits=256): Promise<[CryptoKey, SensitiveBytes]> {
	// derive a random 256-bit 'one-time pad' key
	const atu8_otp = crypto.getRandomValues(new Uint8Array(Math.ceil(ni_bits / 8)));

	// import the base key into a new managed key object that can derive bits
	const dk_base = await crypto.subtle.importKey('raw', atu8_otp, {
		name: 'HKDF',
		hash: 'SHA-256',
	}, false, ['deriveBits']);

	// wipe the base key from memory
	zero_out(atu8_otp);

	// fetch the 'one-time pad' key
	const kn_derived = new SensitiveBytes(await fetch_derived(dk_base, atu8_salt, ni_bits));

	// fetch private key
	const kn_sk = new SensitiveBytes(await fk_sk());

	// compute the delta key
	const kn_xor = kn_sk.xor(kn_derived);

	// wipe the private key from memory
	kn_sk.wipe();

	// wipe the derived key from memory
	kn_derived.wipe();

	// return the base key and one-time pad key
	return [dk_base, kn_xor];
}


interface RuntimePrivateKeyFields {
	atu8_salt: Uint8Array;
	kn_xor: SensitiveBytes | null;
	dk_base: CryptoKey | null;
	ni_bits: number;
}


const hm_privates = new Map<RuntimeKey, RuntimePrivateKeyFields>();


/**
 * Maintains a private key that needs to exist in process memory when used, but can otherwise benefit from
 * cryptographic subsystem security at rest. This is necessary for elliptic curves that are not supported
 * by the Web Crypto API such as secp256k1 .
 */
export default class RuntimeKey {
	/**
	 * Create a new private key object. This function will also wipe the contents of the original private key from memory.
	 * @param atu8_sk - the private key (will get zeroed out immediately after calling)
	 */
	static async create(fk_sk: KeyProducer, ni_bits=256): Promise<RuntimeKey> {
		// instantiate object
		const k_key = new RuntimeKey();

		// destructure private field(s)
		const g_private = hm_privates.get(k_key)!;

		// generate pair
		const [dk_base, kn_xor] = await generate_pair(fk_sk, g_private.atu8_salt, ni_bits);

		// update private fields
		Object.assign(g_private, {
			dk_base,
			kn_xor,
			ni_bits,
		});

		// return key object
		return k_key;
	}

	/**
	 * Create a new private key object. This function will also wipe the contents of the original private key from memory.
	 * @param atu8_sk - the private key (will get zeroed out immediately after calling)
	 */
	static async createRaw(atu8_sk: Uint8Array, ni_bits=256): Promise<RuntimeKey> {
		return RuntimeKey.create(() => atu8_sk, ni_bits);
	}


	/**
	 * Construct privately since initialization is asynchronous.
	 */
	private constructor() {
		// generate random salt to use when deriving the derived key
		const atu8_salt = crypto.getRandomValues(new Uint8Array(32));

		// intitialize private field(s)
		hm_privates.set(this, {
			atu8_salt,
			kn_xor: null,
			dk_base: null,
			ni_bits: 256,
		});
	}


	/**
	 * Recreate the private key, only allowing it to exist in stack memory within a single event loop tick.
	 */
	async access<w_return=unknown>(fk_use: (atu8_sk: Uint8Array) => w_return): Promise<Awaited<w_return>> {
		// ref and destructure private fields
		const g_privates = hm_privates.get(this)!;
		const {
			dk_base,
			atu8_salt,
			kn_xor,
			ni_bits,
		} = g_privates;

		// prepare to capture whatever the callback does
		let w_return!: w_return;
		let e_thrown: unknown;

		// prep a temporary use buffer
		let atu8_use!: Uint8Array;

		// prepare the next one-time pad
		const [dk_base_new, kn_xor_new] = await generate_pair(() => new Promise(async(fk_resolve) => {
			// fetch the 'derived' key
			const kn_derived = new SensitiveBytes(await fetch_derived(dk_base!, atu8_salt, ni_bits));

			// compute the private key
			const kn_sk = kn_xor!.xor(kn_derived);

			// wipe the derived key
			kn_derived.wipe();

			// copy the key for use
			atu8_use = kn_sk.data.slice();

			// attempt to perform synchronous callback
			try {
				// allow the caller to use the private key
				w_return = fk_use(atu8_use);
			}
			// catch whatever was thrown and save it
			catch(_e_thrown) {
				e_thrown = _e_thrown;

				// immediately wipe the use buffer
				zero_out(atu8_use);
			}

			// callback generate pair
			fk_resolve(kn_sk.data);

			// then wipe the private key (redundant because of call to generate pair)
			queueMicrotask(() => {
				kn_sk.wipe();
			});
		}), atu8_salt, ni_bits);

		// rotate keys
		g_privates.dk_base = dk_base_new;
		g_privates.kn_xor = kn_xor_new;

		// emulate whatever the callback did
		if(e_thrown) {
			throw e_thrown;  // eslint-disable-line @typescript-eslint/no-throw-literal
		}
		// return whatever the caller returned
		else {
			// resolve it first
			const w_resolved = await w_return;  // eslint-disable-line @typescript-eslint/await-thenable

			// wipe the used key
			zero_out(atu8_use);

			// return resolved value
			return w_resolved;
		}
	}

	/**
	 * Destroy the instance and any of its materials
	 */
	destroy(): void {
		// destructure fields
		const {
			atu8_salt,
			kn_xor,
		} = hm_privates.get(this)!;

		// remove otp
		kn_xor?.wipe();

		// clear salt
		zero_out(atu8_salt);

		// remove pointer
		hm_privates.delete(this);
	}

	/**
	 * Clones the instance and it's backing buffer
	 */
	clone(): Promise<RuntimeKey> {
		return this.access(atu8_sk => RuntimeKey.createRaw(atu8_sk.slice()));
	}
}
