/* eslint-disable @typescript-eslint/naming-convention */
const NB_BLOCK = 64;

const ATU8_RHO = Uint8Array.from([7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8]);
const ATU8_0_16 = new Uint8Array(16).map((xb, i) => i);
const ATU8_PI = ATU8_0_16.map(i => ((9 * i) + 5) % 16);

const A_INDEXES_L = [ATU8_0_16];
const A_INDEXES_R = [ATU8_PI];

for(let i_index=0; i_index<4; i_index++) {
	for(const a_indexes of [A_INDEXES_L, A_INDEXES_R]) {
		a_indexes.push(a_indexes[i_index].map(xb => ATU8_RHO[xb]));
	}
}

const A_SHIFTS = [
	[11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
	[12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
	[13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
	[14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
	[15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5],
].map(a_words => new Uint8Array(a_words));

const A_SHIFTS_L = A_INDEXES_L.map((idx, i) => idx.map(j => A_SHIFTS[i][j]));
const A_SHIFTS_R = A_INDEXES_R.map((idx, i) => idx.map(j => A_SHIFTS[i][j]));

const ATU8_KL = new Uint32Array([0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]);
const ATU8_KR = new Uint32Array([0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]);
/* eslint-enable */

const rotl = (xn_word: number, n_shift: number) => (xn_word << n_shift) | (xn_word >>> (32 - n_shift));

const twid = (i_group: number, xn_x: number, xn_y: number, xn_z: number): number => {
	if(0 === i_group) return xn_x ^ xn_y ^ xn_z;
	else if(1 === i_group) return (xn_x & xn_y) | (~xn_x & xn_z);
	else if(2 === i_group) return (xn_x | ~xn_y) ^ xn_z;
	else if(3 === i_group) return (xn_x & xn_z) | (xn_y & ~xn_z);
	else return xn_x ^ (xn_y | ~xn_z);
};

/* eslint-disable prefer-const */
export const ripemd160 = (atu8_data: Uint8Array): Uint8Array => {
	/* eslint-disable @typescript-eslint/naming-convention */
	let _nb_data = atu8_data.length;
	let _dv_data = new DataView(atu8_data.buffer, atu8_data.byteOffset, _nb_data);

	let _a_state = [
		0x67452301,
		0xefcdab89,
		0x98badcfe,
		0x10325476,
		0xc3d2e1f0,
	];

	let _a_words: number[] = [];
	/* eslint-enable @typescript-eslint/naming-convention */

	let atu8_block = new Uint8Array(NB_BLOCK);
	let dv_block = new DataView(atu8_block.buffer);

	let ib_write = 0;

	const _round = (dv_read: DataView, ib_offset: number) => {
		for(let i_word=0; i_word<16; i_word++) {
			_a_words[i_word] = dv_read.getUint32(ib_offset + (i_word * 4), true);
		}

		let [xn_al, xn_bl, xn_cl, xn_dl, xn_el] = _a_state;
		let [xn_ar, xn_br, xn_cr, xn_dr, xn_er] = _a_state;

		for(let i_group=0; i_group<5; i_group++) {
			let [
				xn_hbl, xn_hbr,
				atu8_rl, atu8_rr,
				atu8_sl, atu8_sr,
			] = [
				ATU8_KL, ATU8_KR,
				A_INDEXES_L, A_INDEXES_R,
				A_SHIFTS_L, A_SHIFTS_R,
			].map(atu8 => atu8[i_group]) as [
				number, number,
				Uint8Array, Uint8Array,
				Uint8Array, Uint8Array,
			];

			for(let i_round=0; i_round<16; i_round++) {
				let xn_tl = rotl(xn_al + twid(i_group, xn_bl, xn_cl, xn_dl) + _a_words[atu8_rl[i_round]] + xn_hbl, atu8_sl[i_round]) + xn_el;
				xn_al = xn_el;
				xn_el = xn_dl;
				xn_dl = rotl(xn_cl, 10);
				xn_cl = xn_bl;
				xn_bl = xn_tl;
			}

			for(let i_round=0; i_round<16; i_round++) {
				let xn_tr = rotl(xn_ar + twid(4-i_group, xn_br, xn_cr, xn_dr) + _a_words[atu8_rr[i_round]] + xn_hbr, atu8_sr[i_round]) + xn_er;
				xn_ar = xn_er;
				xn_er = xn_dr;
				xn_dr = rotl(xn_cr, 10);
				xn_cr = xn_br;
				xn_br = xn_tr;
			}
		}

		_a_state = [
			_a_state[1] + xn_cl + xn_dr,
			_a_state[2] + xn_dl + xn_er,
			_a_state[3] + xn_el + xn_ar,
			_a_state[4] + xn_al + xn_br,
			_a_state[0] + xn_bl + xn_cr,
		];
	};


	// update
	for(let ib_read=0; ib_read<_nb_data;) {
		let nb_chunk = Math.min(NB_BLOCK - ib_write, _nb_data - ib_read);

		if(nb_chunk === NB_BLOCK) {
			for(; ib_read+NB_BLOCK<=_nb_data; ib_read+=NB_BLOCK) {
				_round(_dv_data, ib_read);
			}

			continue;
		}

		atu8_block.set(atu8_data.subarray(ib_read, ib_read + nb_chunk), ib_write);
		ib_write += nb_chunk;
		ib_read += nb_chunk;
		if(ib_write === NB_BLOCK) {
			_round(dv_block, 0);
			ib_write = 0;
		}
	}


	// create padding and handle blocks
	atu8_block[ib_write++] = 0x80;
	if(ib_write > NB_BLOCK - 8) {
		atu8_block.fill(0, ib_write);
		_round(dv_block, 0);
		ib_write = 0;
	}

	atu8_block.fill(0, ib_write);

	dv_block.setBigUint64(NB_BLOCK - 8, BigInt(_nb_data * 8), true);
	_round(dv_block, 0);


	// produce result
	let atu8_digest = new Uint8Array(20);
	let dv_digest = new DataView(atu8_digest.buffer);
	_a_state.map((xn, i) => dv_digest.setUint32(i * 4, xn, true));

	return atu8_digest;
};
