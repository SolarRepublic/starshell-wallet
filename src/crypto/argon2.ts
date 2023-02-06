import type {O} from 'ts-toolbelt';

import {buffer_to_text, concat, zero_out} from '#/util/data';

export interface Argon2Methods {
	hash(gc_hash: Argon2Config): Promise<Uint8Array>;
	attack(gc_attack: AttackConfig): Promise<Uint8Array>;
}

export interface Argon2Worker extends Argon2Methods {
	terminate(): void;
}

export type Argon2Params = {
	type: Argon2Type;
	salt: Uint8Array;
	iterations: number;
	memory: number;

	hashLen?: number;
	parallelism?: number;
	secret?: Uint8Array;
	ad?: Uint8Array;
};

export type Argon2Config = O.Merge<Argon2Params, {
	phrase: Uint8Array;

	/**
	 * Do not zero-out passphrase (caller still needs to use it)
	 */
	preserve?: boolean;
}>;

export type AttackConfig = {
	attempts: number;
	difficulty: number;
	params: Omit<Argon2Config, 'salt'> & {
		salt?: Argon2Config['salt'];
	};
};

interface Argon2WasmInstance {
	mem: ProgramMemory;

	alloc(atu8_data: Uint8Array): number;
	alloc_cstr(atu8_data: Uint8Array): number;
	read_cstr(ib_ptr: number): string;

	// eslint-disable-next-line @typescript-eslint/member-ordering
	calls: {
		_free(ib_ptr: number): number;
		_malloc(xb_size: number): number;

		_argon2_encodedlen(
			n_iterations: number,
			xb_memory: number,
			n_parallelism: number,
			nb_salt: number,
			nb_hash: number,
			i_argon_type: Argon2Type,
		): number;

		_argon2_hash_ext(
			n_iterations: number,
			xb_memory: number,
			n_parallelism: number,
			atu8_phrase: number,
			nb_phrase: number,
			atu8_salt: number,
			nb_salt: number,
			atu8_hash: number,
			nb_hash: number,
			atu8_encoded: number,
			nb_encoded: number,
			i_argon_type: Argon2Type,
			atu8_secret: number,
			nb_secret: number,
			atu8_ad: number,
			nb_ad: number,
			ni_version: number,
		);

		_argon2_error_message(
			xc_error: number,
		): number;
	};
}

const NB_KIB = 1 << 10;
const NB_MIB = NB_KIB << 10;
const NB_GIB = NB_MIB << 10;

const NB_WASM_PAGE = 64 * NB_KIB;

const NB_HEAP_MAX = (2 * NB_GIB) - NB_WASM_PAGE;

const I_ARGON2_VERSION = 0x13;

export enum Argon2Type {
	Argon2d = 0,
	Argon2i = 1,
	Argon2id = 2,
}

class ProgramError extends Error {
	constructor(s_msg: string) {
		super(`The WASM program threw an error: ${s_msg}`);
	}
}

const f_align_mem = (nb_size: number, nb_page: number) => nb_size + ((nb_page - (nb_size % nb_page)) % nb_page);

/**
 * Rezize logic derived from emscripten
 */
class ProgramMemory {
	protected _ab_memory: ArrayBuffer;
	protected _atu8_heap: Uint8Array;

	constructor(protected _y_wasm_memory: WebAssembly.Memory) {
		this._ab_memory = _y_wasm_memory.buffer;
		this._atu8_heap = new Uint8Array(this._ab_memory);
	}

	get heap(): Uint8Array {
		return this._atu8_heap;
	}

	memcpy_big(ib_dst: number, ib_src: number, nb_size: number): void {
		this._atu8_heap.copyWithin(ib_dst, ib_src, ib_src+nb_size);
	}

	realloc_buffer(nb_size: number): 1 | undefined {
		try {
			const n_pages = (nb_size - this._ab_memory.byteLength + NB_WASM_PAGE) >>> 16;
			this._y_wasm_memory.grow(n_pages);
			const ab_mem = this._ab_memory = this._y_wasm_memory.buffer;
			this._atu8_heap = new Uint8Array(ab_mem);
			return 1;
		}
		catch(e) {}
	}

	resize_heap(nb_request: number): boolean {
		const nb_old = this._atu8_heap.length;
		nb_request >>>= 0;
		if(nb_request > NB_HEAP_MAX) {
			return false;
		}

		for(let x_reduce=1; x_reduce<=4; x_reduce*=2) {
			const nb_overgrown = Math.min(nb_old * (1 + (.2 / x_reduce)), nb_request + 100663296);
			const nb_new = Math.min(NB_HEAP_MAX, f_align_mem(Math.max(nb_request, nb_overgrown), NB_WASM_PAGE));
			if(this.realloc_buffer(nb_new)) {
				return true;
			}
		}

		return false;
	}
}


let dp_wasm: Promise<Argon2WasmInstance> | undefined;
let g_wasm: Argon2WasmInstance;

function init_wasm(): Promise<Argon2WasmInstance> {
	if(dp_wasm) return dp_wasm;

	return dp_wasm = (async() => {
		// eslint-disable-next-line prefer-const
		let k_mem: ProgramMemory;

		const y_module = await WebAssembly.instantiateStreaming(fetch('/bin/argon2.wasm'), {
			a: {
				a: (ib_dst: number, ib_src: number, nb_size: number) => k_mem.memcpy_big(ib_dst, ib_src, nb_size),
				b: (nb_request: number) => k_mem.resize_heap(nb_request),
			},
		});

		const h_exports = y_module.instance.exports;

		k_mem = new ProgramMemory(h_exports['c'] as WebAssembly.Memory);

		const h_calls = {
			___wasm_call_ctors: h_exports.d,
			_argon2_hash: h_exports.e,
			_malloc: h_exports.f,
			_free: h_exports.h,
			_argon2_error_message: h_exports.i,
			_argon2_encodedlen: h_exports.j,
			_argon2_hash_ext: h_exports.l,
			_argon2_verify_ext: h_exports.m,
			stackAlloc: h_exports.n,
		} as unknown as Argon2WasmInstance['calls'];

		return g_wasm = {
			mem: k_mem,

			calls: h_calls,

			alloc(atu8_data: Uint8Array): number {
				// call malloc with required size
				const ib_region = h_calls._malloc(atu8_data.length);

				// copy data into heap
				k_mem.heap.set(atu8_data, ib_region);

				// return memory location
				return ib_region;
			},

			alloc_cstr(atu8_data: Uint8Array): number {
				// prep new buffer with space for terminating null byte
				const atu8_copied = new Uint8Array(atu8_data.length+1);

				// copy data into it
				atu8_copied.set(atu8_data);

				// proceed with allocation as normal
				return g_wasm.alloc(atu8_copied);
			},

			read_cstr(ib_ptr: number): string {
				const ib_end = k_mem.heap.indexOf(0, ib_ptr);
				return buffer_to_text(k_mem.heap.subarray(ib_ptr, ib_end));
			},
		};
	})();
}

export const Argon2: Argon2Methods = {
	async hash(gc_hash: Argon2Config): Promise<Uint8Array> {
		await init_wasm();

		const n_iterations = gc_hash.iterations || 1;
		const n_parallelism = gc_hash.parallelism || 1;
		const xb_memory = gc_hash.memory || 1 * NB_KIB;

		const atu8_phrase = gc_hash.phrase;
		const ib_phrase = g_wasm.alloc_cstr(atu8_phrase);
		const nb_phrase = atu8_phrase.length;

		// preservation flag not set; zero-out passphrase
		if(!gc_hash.preserve) zero_out(atu8_phrase);

		const atu8_salt = gc_hash.salt;
		const ib_salt = g_wasm.alloc_cstr(atu8_salt);
		const nb_salt = atu8_salt.length;

		const i_argon2_type = gc_hash.type || Argon2Type.Argon2id;

		const nb_hash = gc_hash.hashLen || 24;
		const ib_hash = g_wasm.alloc(new Uint8Array(nb_hash));

		const ib_secret = gc_hash.secret? g_wasm.alloc(gc_hash.secret): 0;
		const nb_secret = gc_hash.secret? gc_hash.secret.byteLength: 0;

		const ib_ad = gc_hash.ad? g_wasm.alloc(gc_hash.ad): 0;
		const nb_ad = gc_hash.ad? gc_hash.ad.byteLength: 0;

		const nb_encoded = g_wasm.calls._argon2_encodedlen(
			n_iterations,
			xb_memory,
			n_parallelism,
			nb_salt,
			nb_hash,
			i_argon2_type
		);

		const ib_encoded = g_wasm.alloc(new Uint8Array(nb_encoded+1));

		let atu8_output: Uint8Array;
		let xc_result: number;
		try {
			xc_result = g_wasm.calls._argon2_hash_ext(
				n_iterations,
				xb_memory,
				n_parallelism,
				ib_phrase,
				nb_phrase,
				ib_salt,
				nb_salt,
				ib_hash,
				nb_hash,
				ib_encoded,
				nb_encoded,
				i_argon2_type,
				ib_secret,
				nb_secret,
				ib_ad,
				nb_ad,
				I_ARGON2_VERSION
			);

			// copy result to new output buffer
			atu8_output = g_wasm.mem.heap.slice(ib_hash, ib_hash+nb_hash);
		}
		finally {
			// zero-out phrase and result
			g_wasm.mem.heap.fill(0, ib_phrase, ib_phrase+nb_phrase);
			g_wasm.mem.heap.fill(0, ib_hash, ib_hash+nb_hash);

			// release memory that was allocated for call data
			g_wasm.calls._free(ib_phrase);
			g_wasm.calls._free(ib_salt);
			g_wasm.calls._free(ib_hash);
			g_wasm.calls._free(ib_encoded);
			if(gc_hash.secret) g_wasm.calls._free(ib_secret);
			if(gc_hash.ad) g_wasm.calls._free(ib_ad);
		}

		if(0 !== xc_result) {
			throw new ProgramError(g_wasm.read_cstr(g_wasm.calls._argon2_error_message(xc_result)));
		}

		return atu8_output;
	},

	async attack(gc_attack: AttackConfig): Promise<Uint8Array> {
		const {
			attempts: n_attempts,
			difficulty: n_difficulty,
			params: gc_hash,
		} = gc_attack;

		// ref or create initial guess vector
		const atu32_guess = 32 === gc_hash.salt?.byteLength? gc_hash.salt: crypto.getRandomValues(new Uint32Array(8));

		// obtain u8 buffer view
		const atu8_guess = new Uint8Array(atu32_guess.buffer);

		// set difficulty mask
		const xm_difficulty = ~(~0 >>> n_difficulty) >>> 0;

		// make attempts
		for(let c_attempts=0; c_attempts<n_attempts; c_attempts++) {
			// run hash algo
			const atu8_hash = await Argon2.hash({
				...gc_hash,
				salt: atu8_guess,
			});

			// read highest 32 bits in BE
			const xu32_hi = new DataView(atu8_hash.buffer).getUint32(atu8_hash.byteOffset, false) >>> 0;

			// solved
			if(0 === (xu32_hi & xm_difficulty) >>> 0) {
				return concat([atu8_guess, atu8_hash]);
			}

			// move onto next guess
			atu32_guess[0] += 1;
		}

		// finished attempts, did not succeed
		return new Uint8Array(0);
	},
};

