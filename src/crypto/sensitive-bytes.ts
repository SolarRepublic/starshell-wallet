import {F_NOOP} from '../util/belt';

function destroyed() {
	throw new Error('Method called on destroyed SensitiveBytes instance');
}


/**
 * Provides wrapper for Uint8Array intended to hold sensitive data such as private key material.
 * Rather than allowing key material to possibly outlive garbage collection in memory by using hex strings
 * or BigInt during cryptographic operations, use Uint8Array in order to wipe all intermediate values by 
 * zeroing them out (overwriting all bytes with 0x00) immediately after use. Except for the `wipe` method,
 * instances are immutable.
 * 
 * Some may wonder why not use Uint32Array for more efficient computations with native 32-bit ints.
 * In Chromium, `Smi` can store 31 bit signed ints on 32-bit archs, and 32 bit signed ints on 64-bit archs.
 * <https://source.chromium.org/chromium/v8/v8.git/+/main:src/objects/smi.h;l=17;drc=bf096ec960eee18c916b4bcb4d96be7b39f732ad>
 * <https://stackoverflow.com/a/57426773/1641160>
 * Meaning that 32-bit unsigned integers will always end up being "boxed", i.e., represented by pointers to
 * heap objects in V8, leading to the potential for more sensitive garbage ending up in deallocated RAM.
 * 
 * As for Uint16Array, another issue arises. It would require the use of DataView to control for endianness
 * on the platform, which _may_ introduce temporary values (some of which may allocate on the heap) depending
 * on the runtime implementation. However, this has not been thoroughly investigated and indeed may offer the
 * same protection as Uint8Array with potentially more efficient computations on big-endian platforms (little-
 * endian platforms may or may not see performance hit from DataView's endian conversion).
 * 
 * In conclusion, Uint8Array offers the safest byte-wise calculations since all integer operations on their
 * values are most likely (given all options) to never leave CPU registers and thus never end up in the heap.
 * 
 * For sake of simplicity and in the interest of avoiding human errors, the `other` instance passed to any
 * method must have exactly the same byte length.
 * For example:
 * ```ts
 * const a = Uint8Array(32); a[0] = 0x01;
 * const b = Uint8Array(64); b[0] = 0x03;
 * const sa = new SensitiveBytes(a);
 * const sb = new SensitiveBytes(b);
 * sa.xor(sb);  // throws Error since `sa` is 32 bytes while `sb` is 64 bytes
 * ```
 * 
 * One consideration that should be made is whether timing attacks are part of the user's threat model.
 * It is unclear how, or even if, the methods employed by this data structure make it susceptible to
 * timing attacks.
 */
export default class SensitiveBytes {
	/**
	 * Generate a cryptographically random value having the given number of bytes.
	 */
	static random(nb_size: number): SensitiveBytes {
		return new SensitiveBytes(crypto.getRandomValues(new Uint8Array(nb_size)));
	}


	/**
	 * Convenience method for creating nil-initialized number of given size in bytes.
	 */
	static empty(nb_size=0): SensitiveBytes {
		return new SensitiveBytes(new Uint8Array(nb_size));
	}


	/**
	 * Create an instance around a `Uint8Array`
	 * @param atu8_data the sensitive data source
	 */
	constructor(private readonly _atu8_data: Uint8Array) {}


	/**
	 * Getter for underyling buffers' byte length
	 */
	get byteLength(): number {
		return this._atu8_data.byteLength;
	}


	/**
	 * Getter for this instance's data
	 */
	get data(): Uint8Array {
		return this._atu8_data;
	}


	/**
	 * Clone this instance so that it can be destroyed without affecting the clone.
	 */
	clone(): SensitiveBytes {
		return new SensitiveBytes(Uint8Array.from(this._atu8_data));
	}


	/**
	 * Mutably clear the contents of this object and mark as destroyed.
	 */
	wipe(): void {
		// overwrite contents with 0x00
		this._atu8_data.fill(0);

		// mark as destroyed
		// @ts-expect-error for overriding all methods
		this.clone = this.diff = this.compare = this.mod = destroyed;
		this.wipe = F_NOOP;

		// override getters
		Object.defineProperties(this, {
			data: {
				get: destroyed,
			},
			digits: {
				get: destroyed,
			},
		});
	}


	/**
	 * Perform byte-by-byte XOR with other instance.
	 */
	xor(kn_other: SensitiveBytes): SensitiveBytes {
		// ref data
		const atu8_data_this = this._atu8_data;
		const atu8_data_other = kn_other._atu8_data;

		// number of bytes
		const nb_digits_this = atu8_data_this.byteLength;

		// byte length discrepancy
		if(nb_digits_this !== atu8_data_other.byteLength) {
			// panic wipes
			this.wipe();
			kn_other.wipe();

			// refuse operation
			throw new Error('Refusing to XOR buffers of different byte length');
		}

		// prep new buffer
		const atu8_output = new Uint8Array(nb_digits_this);

		// xor one byte at a time
		for(let ib_each=0; ib_each<nb_digits_this; ib_each++) {
			atu8_output[ib_each] = atu8_data_this[ib_each] ^ atu8_data_other[ib_each];
		}

		// new instance
		return new SensitiveBytes(atu8_output);
	}


	/**
	 * Split a byte array into 'words' using the given delimiter
	 * @param xb_value the delimiter value to split by
	 * @returns list of words which will all be zeroed out when the parent instance is wiped
	 */
	split(xb_value: number): Uint8Array[] {
		const atu8_data = this.data;

		// array of pointers to words as buffers
		const a_words: Uint8Array[] = [];

		// byte index start of word
		let ib_start = 0;

		// while there are words remaining
		for(;;) {
			// find next matching byte
			const ib_delim = atu8_data.indexOf(xb_value, ib_start);

			// no more matches
			if(-1 === ib_delim) break;

			// without copying data, save a reference to the word
			a_words.push(atu8_data.subarray(ib_start, ib_delim));

			// advanced the index for the start of the next word
			ib_start = ib_delim + 1;
		}

		// push final word
		a_words.push(atu8_data.subarray(ib_start));

		// return list of words
		return a_words;
	}
}
