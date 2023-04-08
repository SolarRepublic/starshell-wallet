import type {Ripemd160, Sha256} from '@solar-republic/wasm-secp256k1';

import type {SerializeToJson, JsonValue} from '#/meta/belt';

import {instantiateRipemd160, instantiateSha256} from '@solar-republic/wasm-secp256k1';
import {createHash} from 'sha256-uint8array';

import {is_dict, is_dict_es, ode} from './belt';

import {Ripemd160 as Ripemd160Js} from '../crypto/ripemd160';
import SensitiveBytes from '../crypto/sensitive-bytes';


const S_UUID_V4 = 'xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxxxxxx';
const R_UUID_V4 = /[xy]/g;

// @ts-expect-error in case crypto global is not defined
export const uuid_v4 = globalThis.crypto?.randomUUID? () => crypto.randomUUID(): (): string => {
	let xt_now = Date.now();
	if('undefined' !== typeof performance) xt_now += performance.now();
	return S_UUID_V4.replace(R_UUID_V4, (s) => {
		const x_r = (xt_now + (Math.random()*16)) % 16 | 0;
		xt_now = Math.floor(xt_now / 16);
		return ('x' === s? x_r: (x_r & 0x3) | 0x8).toString(16);
	});
};


/**
 * Performs SHA-256 hash on the given data.
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export async function sha256(atu8_data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-256', atu8_data));
}

/**
 * Performs SHA-256(SHA-256(data))
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export async function sha256d(atu8_data: Uint8Array): Promise<Uint8Array> {
	const atu8_1 = await sha256(atu8_data);
	const atu8_2 = await sha256(atu8_1);
	zero_out(atu8_1);
	return atu8_2;
}


/**
* Performs SHA-256 hash on the given data synchronously (only suitable for non-secure applications).
* The only reason this function is needed is in cases when a constant is declared at the top-level
* before it can await for the WASM module to load, which must happen asynchronously.
* @param atu8_data data to hash
* @returns the hash digest
*/
export const sha256_sync_insecure = (atu8_data: Uint8Array): Uint8Array => createHash().update(atu8_data).digest();


let y_sha256: Sha256;
void instantiateSha256().then(y => y_sha256 = y).catch((e_instantiate) => {
	console.warn(`Failed to instantiate WASM module for SHA-256; falling back to JavaScript implementation. \n${e_instantiate.stack || e_instantiate}`);
	y_sha256 = {
		init: () => new Uint8Array(0),
		update: (atu8_a, atu8_b) => concat([atu8_a, atu8_b]),
		final: atu8 => sha256_sync_insecure(atu8),
		hash: atu8 => sha256_sync_insecure(atu8),
	};
});

/**
* Performs SHA-256 hash on the given data synchronously
* @param atu8_data data to hash
* @returns the hash digest
*/
export const sha256_sync = (atu8_data: Uint8Array): Uint8Array => y_sha256.hash(atu8_data);


/**
* Performs SHA-256 hash on the given data synchronously (only suitable for non-secure applications).
* The only reason this function is needed is in cases when a constant is declared at the top-level
* before it can await for the WASM module to load, which must happen asynchronously.
* @param atu8_data data to hash
* @returns the hash digest
*/
export const ripemd160_sync_insecure = (atu8_data: Uint8Array): Uint8Array => new Ripemd160Js().update(atu8_data).digest();

let y_ripemd: Ripemd160;
void instantiateRipemd160().then(y => y_ripemd = y).catch((e_instantiate) => {
	console.warn(`Failed to instantiate WASM module for RIPEMD-160; falling back to JavaScript implementation. \n${e_instantiate.stack || e_instantiate}`);
	y_ripemd = {
		init: () => new Uint8Array(0),
		update: (atu8_a, atu8_b) => concat([atu8_a, atu8_b]),
		final: atu8 => ripemd160_sync_insecure(atu8),
		hash: atu8 => ripemd160_sync_insecure(atu8),
	};
});

/**
 * Performs RIPEMD-160 hash on the given data synchronously
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export const ripemd160_sync = (atu8_data: Uint8Array): Uint8Array => y_ripemd.hash(atu8_data);


/**
 * Performs SHA-512 hash on the given data.
 * @param atu8_data data to hash
 * @returns the hash digest
 */
export async function sha512(atu8_data: Uint8Array): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest('SHA-512', atu8_data));
}


/**
 * Performs HMAC signing of the given message, **not the digest**.
 * @param atu8_sk private key
 * @param atu8_message message to sign, **not the digest**.
 * @returns HMAC signature
 */
export async function hmac(atu8_sk: Uint8Array, atu8_message: Uint8Array, si_algo: 'SHA-256'|'SHA-512'='SHA-256'): Promise<Uint8Array> {
	// import signing private key
	const dk_sign = await crypto.subtle.importKey('raw', atu8_sk, {
		name: 'HMAC',
		hash: {name:si_algo},
	}, false, ['sign']);

	// construct hmac signature
	return new Uint8Array(await crypto.subtle.sign('HMAC', dk_sign, atu8_message));
}


/**
 * Wipe the contents of a buffer so that sensitive data does not outlive garbage collection.
 */
export function zero_out(atu8_data: number[] | Uint8Array | Uint16Array): void {
	// overwrite the contents
	atu8_data.fill(0);

	// make sure the engine does not optimize away the above memory wipe instruction
	// @ts-expect-error signature IS compatible with both types
	if(0 !== atu8_data.reduce((c, x) => c + x, 0)) throw new Error('Failed to zero out sensitive memory region');
}

export function serialize_private_key(kn_sk: SensitiveBytes): [Uint8Array, string] {
	// cache private key byte length
	const nb_sk = kn_sk.data.byteLength;

	// // prepopulate an array with a bunch of noise
	// let a_noise = new Array(1024);
	// for(let i_noise=0; i_noise<1024; i_noise++) {
	// 	a_noise[i_noise] = crypto.getRandomValues(new Uint8Array(nb_sk));
	// }

	// // derive an index list
	// const atu8_indices = crypto.getRandomValues(new Uint8Array(256));

	// derive a random 'one-time pad' key
	const atu8_otp = crypto.getRandomValues(new Uint8Array(nb_sk));

	// wrap as sensitive bytes
	const kn_otp = new SensitiveBytes(atu8_otp);

	// compute the delta key
	const kn_xor = kn_sk.xor(kn_otp);

	// serialize the otp to string
	const sx_otp = buffer_to_base93(kn_otp.data);

	// wipe key materials
	kn_sk.wipe();
	kn_otp.wipe();

	// return the pair
	return [kn_xor.data, sx_otp];
}


export function deserialize_private_key(kn_xor: SensitiveBytes, sx_otp: string): SensitiveBytes {
	// decode otp
	const kn_otp = new SensitiveBytes(base93_to_buffer(sx_otp));

	// apply otp
	const kn_sk = kn_xor.xor(kn_otp);

	// wipe key materials
	kn_xor.wipe();
	kn_otp.wipe();

	// return key
	return kn_sk;
}


export function encode_length_prefix_u16(atu8_data: Uint8Array): Uint8Array {
	// prep buffer to serialize encoded extension
	const atu8_encoded = concat([
		new Uint8Array(2),  // 2 bytes for length prefix
		atu8_data,
	]);

	// use big-endian to encode length prefix
	new DataView(atu8_encoded.buffer).setUint16(atu8_encoded.byteOffset, atu8_data.byteLength, false);

	// return encoded buffer
	return atu8_encoded;
}


export function decode_length_prefix_u16(atu8_encoded: Uint8Array): [Uint8Array, Uint8Array] {
	// use big-endian to decode length prefix
	const ib_terminus = new DataView(atu8_encoded.buffer).getUint16(atu8_encoded.byteOffset, false) + 2;

	// return decoded payload buffer and everything after it
	return [atu8_encoded.subarray(2, ib_terminus), atu8_encoded.subarray(ib_terminus)];
}


/**
 * UTF-8 encodes the given text to an Uint8Array.
 * @param s_text text to encode
 * @returns UTF-8 encoded Uint8Array
 */
export function text_to_buffer(s_text: string): Uint8Array {
	return new TextEncoder().encode(s_text);
}


/**
 * UTF-8 decodes the given Uint8Array to text.
 * @param atu8_text UTF-8 encoded data to decode
 * @returns text
 */
export function buffer_to_text(atu8_text: Uint8Array): string {
	return new TextDecoder().decode(atu8_text);
}


/**
 * Converts the given base64-encoded string to a buffer, then UTF-8 decodes it.
 * @param sx_buffer input base64-encoded string
 * @returns text
 */
export function base64_to_text(sx_buffer: string): string {
	return buffer_to_text(base64_to_buffer(sx_buffer));
}


/**
 * UTF-8 encodes the given text, then converts it to a base64-encoded string.
 * @param s_text text to encode
 * @returns output base64-encoded string
 */
export function text_to_base64(s_text: string): string {
	return buffer_to_base64(text_to_buffer(s_text));
}


/**
 * Attempts to JSON stringify the given primitive/object and subsequently UTF-8 encode it.
 * @param w_json JSON-compatible value to encode
 * @returns UTF-8 encoded Uint8Array
 */
export function json_to_buffer(w_json: JsonValue): Uint8Array {
	return text_to_buffer(JSON.stringify(w_json));
}


/**
 * UTF-8 decodes the given Uint8Array and subsequently attempts to JSON parse it.
 * @param atu8_json UTF-8 encoded JSON string data
 * @returns parsed JSON value
 */
export function buffer_to_json(atu8_json: Uint8Array): JsonValue {
	return JSON.parse(buffer_to_text(atu8_json));
}


/**
 * Encodes the given 32-bit integer in big-endian format to a new buffer.
 * @param n_uint 
 * @returns 
 */
export function uint32_to_buffer_be(n_uint: number | bigint): Uint8Array {
	// prep array buffer
	const ab_buffer = new Uint32Array(1).buffer;

	// write to buffer
	new DataView(ab_buffer).setUint32(0, Number(n_uint), false);

	// wrap as uint8array
	return new Uint8Array(ab_buffer);
}

/**
 * Decodes a 32-bit integer in big-endian format from a buffer (optionally at the given position).
 * @param n_uint 
 * @returns 
 */
export function buffer_to_uint32_be(atu8_buffer: Uint8Array, ib_offset=0): number {
	return new DataView(atu8_buffer.buffer).getUint32(atu8_buffer.byteOffset + ib_offset, false);
}

/**
 * Converts a JSON object into its canonical form.
 * @param w_json JSON-compatible value to canonicalize
 * @returns canonicalized JSON value
 */
export function canonicalize_json(w_json: JsonValue): JsonValue {
	if(is_dict(w_json)) {
		// sort all keys
		const h_sorted = Object.fromEntries(Object.entries(w_json).sort((a_a, a_b) => a_a[0] < a_b[0]? -1: 1));

		// traverse on children
		for(const si_key in h_sorted) {
			h_sorted[si_key] = canonicalize_json(h_sorted[si_key]);
		}
	}

	return w_json;
}


/**
 * Attempts to JSON stringify the canonicalized version of the primitive/object and subsequently hash it.
 * @param w_json JSON-compatible value to hash
 * @returns hashed JSON value in base64
 */
export function hash_json(w_json: JsonValue): string {
	return buffer_to_base64(sha256_sync(json_to_buffer(canonicalize_json(w_json))));
}


/**
 * Concatenate a sequence of Uint8Arrays.
 * @param a_buffers the data to concatenate in order
 * @returns the concatenated output Uint8Array
 */
export function concat(a_buffers: Uint8Array[]): Uint8Array {
	const nb_out = a_buffers.reduce((c_bytes, atu8_each) => c_bytes + atu8_each.byteLength, 0);
	const atu8_out = new Uint8Array(nb_out);
	let ib_write = 0;
	for(const atu8_each of a_buffers) {
		atu8_out.set(atu8_each, ib_write);
		ib_write += atu8_each.byteLength;
	}

	return atu8_out;
}


// cache function reference
const sfcc = String.fromCharCode;

/**
 * Converts the given buffer to a hex string format in lowercase.
 * @param atu8_buffer input buffer
 * @returns output hex string
 */
export function buffer_to_hex(atu8_buffer: Uint8Array): string {
	let sx_hex = '';
	for(const xb_byte of atu8_buffer) {
		sx_hex += xb_byte.toString(16).padStart(2, '0');
	}

	return sx_hex;
}


/**
 * Converts the given hex string into a buffer.
 * @param sx_hex input hex string
 * @returns output buffer
 */
export function hex_to_buffer(sx_hex: string): Uint8Array {
	const nl_hex = sx_hex.length;
	if(0 !== nl_hex % 2) throw new Error(`Invalid hex string length is not a multiple of 2`);
	const nb_buffer = nl_hex / 2;
	const atu8_buffer = new Uint8Array(nb_buffer);
	for(let i_byte=0; i_byte<nb_buffer; i_byte++) {
		atu8_buffer[i_byte] = parseInt(sx_hex.slice(i_byte+i_byte, i_byte+i_byte+2), 16);
	}

	return atu8_buffer;
}


/**
 * Converts the given buffer to a base64-encoded string.
 * @param atu8_buffer input buffer
 * @returns output base64-encoded string
 */
export function buffer_to_base64(atu8_buffer: Uint8Array): string {
	return globalThis.btoa(buffer_to_string8(atu8_buffer));
}


/**
 * Converts the given base64-encoded string to a buffer.
 * @param sx_buffer input base64-encoded string
 * @returns output buffer
 */
export function base64_to_buffer(sx_buffer: string): Uint8Array {
	return string8_to_buffer(globalThis.atob(sx_buffer));
}


/**
 * Converts the given buffer to a UTF-8 friendly compact string.
 * @param atu8_buffer input buffer
 * @returns output string
 */
export function buffer_to_string8(atu8_buffer: Uint8Array): string {
	// benchmarks indicate string building performs better than array map/join
	let sx_buffer = '';
	for(const xb_byte of atu8_buffer) {
		sx_buffer += sfcc(xb_byte);
	}

	return sx_buffer;
}


/**
 * Converts the given UTF-8 friendly compact string to a buffer.
 * @param sx_buffer input string
 * @returns output buffer
 */
export function string8_to_buffer(sx_buffer: string): Uint8Array {
	const nl_pairs = sx_buffer.length;
	const atu8_buffer = new Uint8Array(nl_pairs);
	for(let i_read=0; i_read<nl_pairs; i_read++) {
		atu8_buffer[i_read] = sx_buffer.charCodeAt(i_read);
	}

	return atu8_buffer;
}


// inspired by <https://github.com/ticlo/jsonesc/blob/master/dist/base93.js>
const SX_CHARS_BASE93 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&'()*+,-./:;<=>?@[]^_`{|}~ ";

/**
 * Converts the given buffer to a base93-encoded string.
 * @param atu8_buffer input buffer
 * @returns output base93-encoded string
 */
export function buffer_to_base93(atu8_buffer: Uint8Array): string {
	let s_out = '';
	const nb_buffer = atu8_buffer.byteLength;

	let xb_encode = 0;
	let ni_shift = 0;

	for(let ib_each=0; ib_each<nb_buffer; ib_each++) {
		const xb_each = atu8_buffer[ib_each];
		xb_encode |= xb_each << ni_shift;
		ni_shift += 8;

		if(ni_shift > 13) {
			let xb_local = xb_encode & 0x1fff;
			if(xb_local > 456) {
				xb_encode >>= 13;
				ni_shift -= 13;
			}
			else {
				xb_local = xb_encode & 0x3fff;
				xb_encode >>= 14;
				ni_shift -= 14;
			}

			s_out += SX_CHARS_BASE93[xb_local % 93]+SX_CHARS_BASE93[(xb_local / 93) | 0];
		}
	}

	if(ni_shift > 0) {
		s_out += SX_CHARS_BASE93[xb_encode % 93];
		if(ni_shift > 7 || xb_encode > 92) {
			s_out += SX_CHARS_BASE93[(xb_encode / 93) | 0];
		}
	}

	return s_out;
}


/**
 * Converts the given base93-encoded string to a buffer.
 * @param sx_buffer input base93-encoded string
 * @returns output buffer
 */
export function base93_to_buffer(sx_buffer: string): Uint8Array {
	const nl_buffer = sx_buffer.length;
	const a_out: number[] = [];

	let xb_decode = 0;
	let ni_shift = 0;
	let xb_work = -1;

	for(let i_each=0; i_each<nl_buffer; i_each++) {
		const xb_char = SX_CHARS_BASE93.indexOf(sx_buffer[i_each]);

		if(-1 === xb_char) throw new Error(`Invalid base93 string`);

		if(-1 === xb_work) {
			xb_work = xb_char;
			continue;
		}

		xb_work += xb_char * 93;
		xb_decode |= xb_work << ni_shift;
		ni_shift += (xb_work & 0x1fff) > 456? 13: 14;

		do {
			a_out.push(xb_decode & 0xff);
			xb_decode >>= 8;
			ni_shift -= 8;
		} while(ni_shift > 7);

		xb_work = -1;
	}

	if(-1 !== xb_work) a_out.push(xb_decode | (xb_work << ni_shift));

	return Uint8Array.from(a_out.slice(0, Math.ceil(sx_buffer.length * 7 / 8)));
}


// inspired by <https://github.com/pur3miish/base58-js>
const SX_CHARS_BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const A_CHARS_BASE58 = (() => {
	const a_out: number[] = Array(256).fill(-1);
	for(let i_char=0; i_char<SX_CHARS_BASE58.length; i_char++) {
		a_out[SX_CHARS_BASE58.charCodeAt(i_char)] = i_char;
	}

	return a_out;
})();

export function buffer_to_base58(atu8_buffer: Uint8Array): string {
	const a_out: number[] = [];

	for(const xb_char of atu8_buffer) {
		let xb_carry = xb_char;
		for(let ib_sweep = 0; ib_sweep<a_out.length; ++ib_sweep) {
			const x = (A_CHARS_BASE58[a_out[ib_sweep]] << 8) + xb_carry;
			a_out[ib_sweep] = SX_CHARS_BASE58.charCodeAt(x % 58);
			xb_carry = (x / 58) | 0;
		}

		while(xb_carry) {
			a_out.push(SX_CHARS_BASE58.charCodeAt(xb_carry % 58));
			xb_carry = (xb_carry / 58) | 0;
		}
	}

	for(const xb_char of atu8_buffer) {
		if(xb_char) {
			break;
		}
		else {
			a_out.push('1'.charCodeAt(0));
		}
	}

	a_out.reverse();

	return String.fromCharCode(...a_out);
}

export function base58_to_buffer(sxb58_buffer: string): Uint8Array {
	if(!sxb58_buffer || 'string' !== typeof sxb58_buffer) {
		throw new Error(`Expected base58 string but got “${sxb58_buffer}”`);
	}

	const m_invalid = sxb58_buffer.match(/[IOl0]/gmu);
	if(m_invalid) {
		throw new Error(`Invalid base58 character “${String(m_invalid)}”`);
	}

	const m_lz = sxb58_buffer.match(/^1+/gmu);
	const nl_psz = m_lz ? m_lz[0].length : 0;
	const nb_out = (((sxb58_buffer.length - nl_psz) * (Math.log(58) / Math.log(256))) + 1) >>> 0;

	return new Uint8Array([
		...new Uint8Array(nl_psz),
		...sxb58_buffer
			.match(/.{1}/gmu)!
			.map(sxb58 => SX_CHARS_BASE58.indexOf(sxb58))
			.reduce((atu8_out, ib_pos) => atu8_out.map((xb_char) => {
				const x = (xb_char * 58) + ib_pos;
				ib_pos = x >> 8;
				return x;
			}), new Uint8Array(nb_out))
			.reverse()
			.filter((b_last => xb_each => (b_last = b_last || !!xb_each))(false)),
	]);
}


interface SerializableObject {
	[si_key: string]: JsonValue | Uint8Array | SerializableObject;
}

export function serialize_to_json<
	z_input extends any,
>(z_input: z_input): SerializeToJson<z_input> {
	if(!z_input) return z_input;

	if(Array.isArray(z_input)) return z_input.map(w => serialize_to_json(w));

	if(z_input instanceof Uint16Array) return buffer_to_base93(z_input);

	if('object' === typeof z_input) {
		const h_out = {};

		for(const si_key in z_input) {
			h_out[si_key] = serialize_to_json(z_input[si_key]);
		}

		return h_out;
	}

	return z_input;
}


export function canonicalize<
	z_input extends JsonValue,
>(z_input: z_input): z_input {
	if(Array.isArray(z_input)) {
		return z_input.map(w => canonicalize(w)) as z_input;
	}
	else if(is_dict_es(z_input)) {
		const h_out = {};

		for(const si_key of Object.keys(z_input).sort()) {
			h_out[si_key] = canonicalize(z_input[si_key]);
		}

		return h_out as z_input;
	}

	return z_input;
}



function json_stringify_sort(si_key: string, z_value: JsonValue) {
	return is_dict(z_value)? Object.fromEntries(ode(z_value).sort(([s_a], [s_b]) => s_a < s_b? -1: 1)): z_value;
}

export function canonicalize_and_serialize_json(w_json: JsonValue): Uint8Array {
	return text_to_buffer(JSON.stringify(w_json, json_stringify_sort));
}
