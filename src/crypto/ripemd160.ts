/**
 * Adapted from {@link https://github.com/crypto-browserify/ripemd160/blob/master/index.js}
 */

const A_ZL = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
	7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
	3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
	1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
	4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
];

const A_ZR = [
	5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
	6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
	15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
	8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
	12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
];

const A_SL = [
	11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
	7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
	11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
	11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
	9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
];

const A_SR = [
	8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
	9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
	9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
	15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
	8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
];

const A_HL = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const A_HR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];


function rotl(xb_x: number, ni_by: number) {
	return (xb_x << ni_by) | (xb_x >>> (32 - ni_by));
}

function fn1(
	xb_a: number, xb_b: number, xb_c: number, xb_d: number, xb_e: number,
	xb_m: number, xb_k: number, ni_shift: number
) {
	return (rotl((xb_a + (xb_b ^ xb_c ^ xb_d) + xb_m + xb_k) | 0, ni_shift) + xb_e) | 0;
}

function fn2(
	xb_a: number, xb_b: number, xb_c: number, xb_d: number, xb_e: number,
	xb_m: number, xb_k: number, ni_shift: number
) {
	return (rotl((xb_a + ((xb_b & xb_c) | (~xb_b & xb_d)) + xb_m + xb_k) | 0, ni_shift) + xb_e) | 0;
}

function fn3(
	xb_a: number, xb_b: number, xb_c: number, xb_d: number, xb_e: number,
	xb_m: number, xb_k: number, ni_shift: number
) {
	return (rotl((xb_a + ((xb_b | ~xb_c) ^ xb_d) + xb_m + xb_k) | 0, ni_shift) + xb_e) | 0;
}

function fn4(
	xb_a: number, xb_b: number, xb_c: number, xb_d: number, xb_e: number,
	xb_m: number, xb_k: number, ni_shift: number
) {
	return (rotl((xb_a + ((xb_b & xb_d) | (xb_c & ~xb_d)) + xb_m + xb_k) | 0, ni_shift) + xb_e) | 0;
}

function fn5(
	xb_a: number, xb_b: number, xb_c: number, xb_d: number, xb_e: number,
	xb_m: number, xb_k: number, ni_shift: number
) {
	return (rotl((xb_a + (xb_b ^ (xb_c | ~xb_d)) + xb_m + xb_k) | 0, ni_shift) + xb_e) | 0;
}


export class Ripemd160 {
	protected _xw_0 = 0x67452301 | 0;
	protected _xw_1 = 0xefcdab89 | 0;
	protected _xw_2 = 0x98badcfe | 0;
	protected _xw_3 = 0x10325476 | 0;
	protected _xw_4 = 0xc3d2e1f0 | 0;

	protected _nb_block = 64;
	protected _atu8_block = new Uint8Array(this._nb_block);
	protected _dv_block = new DataView(this._atu8_block.buffer);
	protected _ib_offset_block = 0;
	protected _a_lens = [0, 0, 0, 0];
	protected _b_finalized = false;

	protected _update(): void {
		const words = new Array<number>(16);
		for(let i_word=0; i_word<16; ++i_word) {
			words[i_word] = this._dv_block.getUint32(i_word * 4, true);
		}

		let al = this._xw_0 | 0;
		let bl = this._xw_1 | 0;
		let cl = this._xw_2 | 0;
		let dl = this._xw_3 | 0;
		let el = this._xw_4 | 0;

		let ar = this._xw_0 | 0;
		let br = this._xw_1 | 0;
		let cr = this._xw_2 | 0;
		let dr = this._xw_3 | 0;
		let er = this._xw_4 | 0;

		// computation
		for(let i_round=0; i_round<80; i_round+=1) {
			let xb_tl: number;
			let xb_tr: number;

			if(i_round < 16) {
				xb_tl = fn1(al, bl, cl, dl, el, words[A_ZL[i_round]], A_HL[0], A_SL[i_round]);
				xb_tr = fn5(ar, br, cr, dr, er, words[A_ZR[i_round]], A_HR[0], A_SR[i_round]);
			}
			else if(i_round < 32) {
				xb_tl = fn2(al, bl, cl, dl, el, words[A_ZL[i_round]], A_HL[1], A_SL[i_round]);
				xb_tr = fn4(ar, br, cr, dr, er, words[A_ZR[i_round]], A_HR[1], A_SR[i_round]);
			}
			else if(i_round < 48) {
				xb_tl = fn3(al, bl, cl, dl, el, words[A_ZL[i_round]], A_HL[2], A_SL[i_round]);
				xb_tr = fn3(ar, br, cr, dr, er, words[A_ZR[i_round]], A_HR[2], A_SR[i_round]);
			}
			else if(i_round < 64) {
				xb_tl = fn4(al, bl, cl, dl, el, words[A_ZL[i_round]], A_HL[3], A_SL[i_round]);
				xb_tr = fn2(ar, br, cr, dr, er, words[A_ZR[i_round]], A_HR[3], A_SR[i_round]);
			}
			else { // if (i<80) {
				xb_tl = fn5(al, bl, cl, dl, el, words[A_ZL[i_round]], A_HL[4], A_SL[i_round]);
				xb_tr = fn1(ar, br, cr, dr, er, words[A_ZR[i_round]], A_HR[4], A_SR[i_round]);
			}

			al = el;
			el = dl;
			dl = rotl(cl, 10);
			cl = bl;
			bl = xb_tl;

			ar = er;
			er = dr;
			dr = rotl(cr, 10);
			cr = br;
			br = xb_tr;
		}

		// update state
		const t = (this._xw_1 + cl + dr) | 0;
		this._xw_1 = (this._xw_2 + dl + er) | 0;
		this._xw_2 = (this._xw_3 + el + ar) | 0;
		this._xw_3 = (this._xw_4 + al + br) | 0;
		this._xw_4 = (this._xw_0 + bl + cr) | 0;
		this._xw_0 = t;
	}


	_digest(): Uint8Array {
		// create padding and handle blocks
		this._dv_block[this._ib_offset_block++] = 0x80;
		if(this._ib_offset_block > 56) {
			this._atu8_block.fill(0, this._ib_offset_block, 64);
			this._update();
			this._ib_offset_block = 0;
		}

		this._atu8_block.fill(0, this._ib_offset_block, 56);
		this._dv_block.setUint32(56, this._a_lens[0], true);
		this._dv_block.setUint32(60, this._a_lens[1], true);
		this._update();

		// produce result
		const atu8_digest = new Uint8Array(20);
		const dv_digest = new DataView(atu8_digest.buffer);
		dv_digest.setUint32(0, this._xw_0, true);
		dv_digest.setUint32(4, this._xw_1, true);
		dv_digest.setUint32(8, this._xw_2, true);
		dv_digest.setUint32(12, this._xw_3, true);
		dv_digest.setUint32(16, this._xw_4, true);

		return atu8_digest;
	}

	update(atu8_data: Uint8Array): this {
		if(this._b_finalized) throw new Error('Digest already called');

		// consume data
		const atu8_block = this._atu8_block;
		let ib_offset_data = 0;
		while(this._ib_offset_block + atu8_data.length - ib_offset_data >= this._nb_block) {
			for(let ib_copy=this._ib_offset_block; ib_copy<this._nb_block;) {
				atu8_block[ib_copy++] = atu8_data[ib_offset_data++];
			}

			this._update();
			this._ib_offset_block = 0;
		}

		while(ib_offset_data < atu8_data.length) {
			atu8_block[this._ib_offset_block++] = atu8_data[ib_offset_data++];
		}

		// update length
		for(let i_part=0, nb_carry=atu8_data.length * 8; nb_carry>0; ++i_part) {
			this._a_lens[i_part] += nb_carry;
			nb_carry = (this._a_lens[i_part] / 0x0100000000) | 0;
			if(nb_carry > 0) this._a_lens[i_part] -= 0x0100000000 * nb_carry;
		}

		return this;
	}

	digest(): Uint8Array {
		if(this._b_finalized) throw new Error('Digest already called');
		this._b_finalized = true;

		const atu8_digest = this._digest();

		// reset state
		this._atu8_block.fill(0);
		this._ib_offset_block = 0;
		for(let ib_each = 0; ib_each<4; ++ib_each) {
			this._a_lens[ib_each] = 0;
		}

		return atu8_digest;
	}
}
