import {ATU8_SHA512_STARSHELL} from '#/share/constants';

/**
 * Takes a given seed to determinstically derive pseudo-random bits intended for reproducibility, and then
 * produces "random" values of various types within given ranges
 */
export class EntropyProducer {
	static async create(n_variables: number, i_iterator: number, atu8_seed?: Uint8Array): Promise<EntropyProducer> {
		// no seed given, fill with 256 random bits
		if(!atu8_seed) atu8_seed = crypto.getRandomValues(new Uint8Array(32));

		// import seed as crypto key
		const dk_seed = await crypto.subtle.importKey('raw', atu8_seed, 'HKDF', false, ['deriveBits']);

		// bytes of entropy needed: 32 bits per variable
		const nb_entropy_needed = n_variables * 4;

		// round up to nearest 64 bytes for SHA-512
		const nb_derive = Math.ceil(nb_entropy_needed / 64) * 64;

		// derive bits
		const atu8_derived = await crypto.subtle.deriveBits({
			name: 'HKDF',
			hash: 'SHA-512',
			salt: ATU8_SHA512_STARSHELL,
			info: Uint32Array.from([i_iterator]),
		}, dk_seed, nb_derive * 8);

		// construct instance
		return new EntropyProducer(new Uint8Array(atu8_derived));
	}

	protected _dv_entropy: DataView;
	protected _nb_entropy: number;
	protected _ib_read = 0;

	protected constructor(protected _atu8_entropy: Uint8Array) {
		// prepare data view
		this._dv_entropy = new DataView(_atu8_entropy.buffer, 0);

		// number of bytes available
		this._nb_entropy = _atu8_entropy.byteLength;
	}

	read(nb_read: number): number {
		const ib_read = this._ib_read;

		// used up all entropy
		if(ib_read + nb_read > this._nb_entropy) {
			throw new Error(`Used up all entropy`);
		}

		this._ib_read += nb_read;

		return ib_read;
	}

	get uint8(): number {
		return this._atu8_entropy[this.read(1)];
	}

	get uint32(): number {
		return this._dv_entropy.getUint32(this.read(4), false);
	}

	get unit(): number {
		// 0 to 1 exclusive
		let n_uint32 = this.uint32 - 1;

		// neglible modulo bias
		if(n_uint32 < 0) n_uint32 = 0;

		// normalize
		return n_uint32 / 0xffffffff;
	}

	randomInt(n_hi: number, n_lo=0): number {
		return Math.floor(this.unit * (n_hi - n_lo)) + n_lo;
	}

	select<w_item extends any>(a_items: w_item[]): w_item {
		return a_items[this.randomInt(a_items.length)];
	}
}
