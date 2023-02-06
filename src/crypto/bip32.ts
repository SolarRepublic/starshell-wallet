import type {KeyProducer} from './runtime-key';

import RuntimeKey from './runtime-key';
import {Secp256k1Key} from './secp256k1';
import SensitiveBytes from './sensitive-bytes';

import {buffer_to_base58, concat, hmac, ripemd160_sync, sha256, text_to_buffer, zero_out} from '#/util/data';

// create the master 'Bitcoin seed' hmac key
let DK_BIP32_KEY_MASTER_GEN: CryptoKey;
void crypto.subtle.importKey('raw', text_to_buffer('Bitcoin seed'), {
	name: 'HMAC',
	hash: {name:'SHA-512'},
}, false, ['sign']).then(dk => DK_BIP32_KEY_MASTER_GEN = dk);

function F_DESTROYED(): never {
	throw new Error('The Secp256k1 instance being called has been destroyed');
}


// 2^31
const N_BIP32_HARDENED = 0x80000000;

interface Bip32Fields {
	kk_sk: RuntimeKey;
	ks_sk: Secp256k1Key;
	atu8_pk33: Uint8Array;
	atu8_chain: Uint8Array;
	atu8_parent: Uint8Array;
	i_depth: number;
	i_index: number;
	k_parent: Bip32 | null;
}

const hm_privates = new WeakMap<Bip32, Bip32Fields>();

const ATU8_FINGERPRINT_NIL = new Uint8Array(4).fill(0);

// private mainnet
const XB_VERSION_BITCOIN_PRIVATE = 0x0488ade4;

/**
 * BIP-32
 * This proprietary implementation exclusively uses Uint8Arrays for all key material so they can be zeroed out after use.
 * This version also does not support "neutered" public keys as it is only concerned with private key generation.
 */
export class Bip32 {
	static async create(
		kk_sk: RuntimeKey,
		atu8_chain: Uint8Array,
		atu8_parent=ATU8_FINGERPRINT_NIL,
		i_depth=0,
		i_index=0,
		k_parent: Bip32 | null=null
	): Promise<Bip32> {
		const k_bip32 = new Bip32();

		return await k_bip32.init(kk_sk, atu8_chain, atu8_parent, i_depth, i_index, k_parent);
	}

	/**
	 * BIP-32: {@link https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#Master_key_generation Master Key Generation}
	 */
	static async masterKey(fk_seed: KeyProducer): Promise<Bip32> {
		// initialize WASM module
		await Secp256k1Key.init();

		// create seed
		const atu8_seed = await fk_seed();

		// safety checks
		{
			// seed too short
			if(atu8_seed.byteLength < 16) {
				// panic wipe
				zero_out(atu8_seed);
				throw new Error('Seed is too short');
			}
			// seed too long
			else if(atu8_seed.byteLength > 64) {
				// panic wipe
				zero_out(atu8_seed);
				throw new Error('Seed is too long');
			}
		}

		// generate the master `I`
		const atu8_i = new Uint8Array(await crypto.subtle.sign('HMAC', DK_BIP32_KEY_MASTER_GEN, atu8_seed));

		// wipe
		zero_out(atu8_seed);

		// split into two 32-byte sequences `I_L` and `I_R`
		const atu8_il = atu8_i.subarray(0, 32);
		const atu8_ir = atu8_i.subarray(32);

		// invalid master secret key
		if(!Secp256k1Key.validatePrivateKey(atu8_il)) {
			// panic wipe
			zero_out(atu8_i);

			throw new Error('Invalid master key');
		}

		// wrap as runtime key
		const kk_sk = await RuntimeKey.create(() => atu8_il);

		// create bip32
		return Bip32.create(kk_sk, atu8_ir);
	}

	static async import(kn_node: SensitiveBytes): Promise<Bip32> {
		const atu8_node = kn_node.data;

		if(78 !== atu8_node.byteLength) {
			throw new Error(`Invalid BIP-0032 seed buffer length`);
		}

		const dv_seed = new DataView(atu8_node.buffer);
		const ib_offset = atu8_node.byteOffset;

		const n_version = dv_seed.getUint32(ib_offset, false);
		if(XB_VERSION_BITCOIN_PRIVATE !== n_version) {
			throw new Error(`StarShell's BIP-0032 implmenetation only supports private keys. Public network version found in seed key.`);
		}

		const i_depth = atu8_node[4];

		// copy parent out to new buffer
		const atu8_parent = atu8_node.slice(5, 9);
		const i_index = dv_seed.getUint32(ib_offset+9, false);

		if(0 === i_depth) {
			if(atu8_parent.every(xb => 0 === xb)) {
				throw new Error(`BIP-0032 seed key indicates it is a master key but has a parent fingerprint.`);
			}
			else if(0 !== i_index) {
				throw new Error(`BIP-0032 seed key indicates it is a master key but has a non-zero index.`);
			}
		}

		// copy chain out to new buffer
		const atu8_chain = atu8_node.slice(13, 45);

		if(0 !== atu8_node[45]) {
			throw new Error(`Invalid BIP-0032 private seed key seed declares to be public.`);
		}

		// copy private key contents out to new buffer
		const atu8_sk = atu8_node.slice(46, 78);

		// wipe original node contents
		kn_node.wipe();

		// create private runtime key
		const kk_sk = await RuntimeKey.createRaw(atu8_sk);

		// construct node
		return await Bip32.create(kk_sk, atu8_chain, atu8_parent, i_depth, i_index);
	}

	// destroyed flag
	protected _b_destroyed = false;

	private constructor() {}  // eslint-disable-line @typescript-eslint/no-empty-function

	/**
	 * Whether or not this key has been destroyed
	 */
	get isDestroyed(): boolean {
		return this._b_destroyed;
	}

	get identifier(): Uint8Array {
		return ripemd160_sync(hm_privates.get(this)!.atu8_pk33);
	}

	get fingerprint(): Uint8Array {
		return this.identifier.subarray(0, 4);
	}

	get isMaster(): boolean {
		return hm_privates.get(this)!.atu8_parent.every(xb => 0 === xb);
	}

	get publicKey(): Uint8Array {
		return hm_privates.get(this)!.atu8_pk33;
	}

	get depth(): number {
		return hm_privates.get(this)!.i_depth;
	}

	async init(
		kk_sk: RuntimeKey,
		atu8_chain: Uint8Array,
		atu8_parent: Uint8Array,
		i_depth: number,
		i_index: number,
		k_parent: Bip32 | null=null
	): Promise<this> {
		const ks_sk = await Secp256k1Key.import(kk_sk, true);

		await kk_sk.access((atu8_sk) => {
			hm_privates.set(this, {
				kk_sk,
				ks_sk,
				atu8_pk33: ks_sk.exportPublicKey(),
				atu8_chain,
				atu8_parent,
				i_depth,
				i_index,
				k_parent,
			});
		});

		return this;
	}


	/**
	 * Completely destroy all key material and make the instance unusable
	 */
	destroy(): void {
		const {
			ks_sk,
			atu8_pk33,
			atu8_chain,
			atu8_parent,
		} = hm_privates.get(this)!;

		// destroy the private key via the wrapping secp class
		ks_sk.destroy();

		// wipe all key material
		zero_out(atu8_pk33);
		zero_out(atu8_chain);
		zero_out(atu8_parent);

		// delete private refs
		hm_privates.delete(this);

		// mark as destroyed
		this._b_destroyed = true;

		// safe-guard against mistakes
		this.obliterate = this.destroy = this.derive = this.deriveHardened = this.derivePath = this.serializeNode = F_DESTROYED;

		const gc_getter_destroyed = {
			get: F_DESTROYED,
		};

		Object.defineProperties(this, {
			identifier: gc_getter_destroyed,
			fingerprint: gc_getter_destroyed,
			isMaster: gc_getter_destroyed,
			privateKey: gc_getter_destroyed,
			publicKey: gc_getter_destroyed,
			depth: gc_getter_destroyed,
		});
	}


	/**
	 * Destroy this instance and all of its ancestors
	 */
	obliterate(): void {
		// destroy parent
		hm_privates.get(this)?.k_parent?.destroy();

		// destroy this
		this.destroy();
	}

	get privateKey(): RuntimeKey {
		// get runtime key from private fields
		return hm_privates.get(this)!.kk_sk;
	}


	/**
	 * Produces a serialization according to {@link https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#serialization-format the specification}
	 */
	async serializeNode(): Promise<SensitiveBytes> {
		// prep seed's serialization buffer
		const atu8_seed = new Uint8Array(78);

		// prep data view for serializing multi-byte uints
		const dv_seed = new DataView(atu8_seed.buffer);

		// destructure private fields
		const {
			kk_sk,
			atu8_chain,
			atu8_parent,
			i_depth,
			i_index,
		} = hm_privates.get(this)!;

		// safety checks
		if(32 !== atu8_chain.byteLength) {
			throw new Error(`Critical error: chain code is not exactly 32 bytes`);
		}

		// > 4 bytes: version bytes (mainnet: 0x0488B21E public, 0x0488ADE4 private; testnet: 0x043587CF public, 0x04358394 private)
		dv_seed.setUint32(0, XB_VERSION_BITCOIN_PRIVATE, false);

		// > 1 byte: depth: 0x00 for master nodes, 0x01 for level-1 derived keys, ...
		dv_seed.setUint8(4, i_depth);

		// > 4 bytes: the fingerprint of the parent's key (0x00000000 if master key)
		atu8_seed.set(atu8_parent, 5);

		// > 4 bytes: child number
		dv_seed.setUint32(9, i_index);

		// > 32 bytes: the chain code
		atu8_seed.set(atu8_chain, 13);

		// > 33 bytes: the private key data as 0x00 || ser256(k)
		dv_seed.setUint8(45, 0);
		await kk_sk.access(atu8_sk => atu8_seed.set(atu8_sk, 46));

		// 
		return new SensitiveBytes(atu8_seed);
	}

	async exportBase58(): Promise<string> {
		const kn_serialized = await this.serializeNode();
		const atu8_hash = await sha256(await sha256(kn_serialized.data));

		// serialize(node) || checksum(serialize(node))
		const atu8_data = concat([kn_serialized.data, atu8_hash.subarray(0, 4)]);

		// wipe secret material
		kn_serialized.wipe();

		// serialize to base58
		return buffer_to_base58(atu8_data);
	}

	/**
	 * <https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#child-key-derivation-ckd-functions>
	 */
	async derive(i_child: number): Promise<Bip32> {
		// destructure private field
		const {
			kk_sk,
			ks_sk,
			atu8_pk33,
			atu8_chain,
			i_depth,
		} = hm_privates.get(this)!;

		// initialize WASM module
		await Secp256k1Key.init();

		// safety check private key
		if(!await kk_sk.access(atu8_sk => Secp256k1Key.validatePrivateKey(atu8_sk))) {
			throw new Error('Invalid private key key');
		}

		// prep data bytes
		const kn_data = SensitiveBytes.empty(1 + 32 + 4);
		const atu8_data = kn_data.data;

		// child is a hardened key
		if(i_child >= N_BIP32_HARDENED) {
			// > Data = 0x00 || ser256(kpar) || ser32(i)
			atu8_data[0] = 0x00;

			// access private key and copy it into data
			await kk_sk.access((atu8_sk) => {
				atu8_data.set(atu8_sk, 1);
			});
		}
		// child is a normal key
		else {
			// > Data = serP(point(kpar)) || ser32(i)
			atu8_data.set(atu8_pk33, 0);
		}

		// write ser32(i)
		new DataView(atu8_data.buffer).setUint32(atu8_data.byteOffset+33, i_child, false);

		// > let I = HMAC-SHA512(Key = cpar, Data
		const atu8_i = await hmac(atu8_chain, atu8_data, 'SHA-512');

		// clean up intermediate data
		kn_data.wipe();

		// > Split I into two 32-byte sequences, IL and IR.
		const atu8_il = atu8_i.subarray(0, 32);
		const atu8_ir = atu8_i.subarray(32);

		// > In case parse256(IL) ≥ n or ki = 0
		if(!Secp256k1Key.validatePrivateKey(atu8_il)) {
			// panic wipe
			zero_out(atu8_i);

			// > proceed with the next value for i
			return this.derive(i_child + 1);
		}

		// > Private parent key → private child key
		{
			// > ki = parse256(IL) + kpar (mod n)
			const atu8_ki = await ks_sk.add(atu8_il);

			// > In case parse256(IL) ≥ n or ki = 0
			if(!Secp256k1Key.validatePrivateKey(atu8_ki)) {
				// panic wipe
				zero_out(atu8_i);
				zero_out(atu8_ki);

				// > proceed with the next value for i
				return this.derive(i_child + 1);
			}

			// create child key
			const kk_child = await RuntimeKey.createRaw(atu8_ki);

			// return as child bip32 node
			return await Bip32.create(kk_child, atu8_ir, this.fingerprint, i_depth + 1, i_child);
		}
	}

	deriveHardened(i_child: number): Promise<Bip32> {
		return this.derive(i_child >= N_BIP32_HARDENED? i_child: i_child + N_BIP32_HARDENED);
	}

	async derivePath(s_path: string): Promise<Bip32> {
		const a_parts = s_path.split('/');

		// master identifier
		if('m' === a_parts[0]) {
			// currently on child
			if(!this.isMaster) {
				throw new Error('Refusing to derive path on child key');
			}

			// remove 'm'
			a_parts.splice(0, 1);
		}

		// start with this node
		let k_node: Bip32 = this;

		// iterate over each part
		for(const si_part of a_parts) {
			// hardened derivation
			if(`'` === si_part.slice(-1)) {
				k_node = await k_node.deriveHardened(+si_part.slice(0, -1));
			}
			// non-hardened
			else {
				k_node = await k_node.derive(+si_part);
			}
		}

		// return final node
		return k_node;
	}
}
