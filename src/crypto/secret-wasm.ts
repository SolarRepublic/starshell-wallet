
// TODO: build a version that only has the crypto_scalar_mult function

// function crypto_scalarmult() {
// 	throw new Error('scalar mult temp disabled');
// }

// function crypto_scalarmult_base() {
// 	debugger;
// 	throw new Error('scalar mult temp disabled');
// }

import type {AccountStruct, AccountPath} from '#/meta/account';
import type {JsonValue} from '#/meta/belt';
import type {ChainStruct} from '#/meta/chain';

import {
	crypto_scalarmult,
	crypto_scalarmult_base,
} from 'libsodium-wrappers';

// use compiled release so that inline-require doesn't pull ts source
import {SIV, WebCryptoProvider} from 'miscreant/release/index';

import {syserr} from '#/app/common';
import {utility_key_child} from '#/share/account';
import {R_SCRT_COMPUTE_ERROR} from '#/share/constants';
import {ContractDecryptionError} from '#/share/errors';
import {Accounts} from '#/store/accounts';
import {
	base64_to_buffer,
	base93_to_buffer,
	buffer_to_base64,
	buffer_to_hex,
	buffer_to_text,
	concat,
	hex_to_buffer,
	text_to_buffer,
	zero_out,
} from '#/util/data';

export interface DecryptedMessage {
	code_hash: string;
	message: string;
	nonce: Uint8Array;
	consensus_pk: Uint8Array;
}

const y_provider = new WebCryptoProvider(globalThis.crypto);

/**
 * Target block size interval to make constant-length messages
 */
const NB_TX_BLOCK = 32;

const ATU8_SALT_HKDF: Uint8Array = hex_to_buffer('000000000000000000024bead8df69990852c202db0e0097c1a12ea637d7e96d');


interface PrivateFields {
	atu8_sk: Uint8Array;
	atu8_pk: Uint8Array;
}

const hm_privates = new Map<SecretWasm, PrivateFields>();

const ATU8_NETSCAPE_COMMENT_OID = Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x86, 0xf8, 0x42, 0x01, 0x0d]);


const destructure_msg = (atu8_encoded: Uint8Array) => ({
	atu8_nonce: atu8_encoded.subarray(0, 32),
	atu8_pk: atu8_encoded.subarray(32, 64),
	atu8_ciphertext: atu8_encoded.subarray(64),
});

/**
 * This code was ported from {@link https://github.com/scrtlabs/secret.js}
 */
export class SecretWasm {
	static extractConsensusIoPubkey(atu8_cert: Uint8Array): Uint8Array {
		// byte offset
		let ib_offset = buffer_to_hex(atu8_cert).indexOf(buffer_to_hex(ATU8_NETSCAPE_COMMENT_OID)) / 2;

		// oid not found
		if(!Number.isInteger(ib_offset)) {
			throw new Error('Error parsing certificate - malformed certificate. OID not found');
		}

		ib_offset += 12; // 11 + TAG (0x04)

		// we will be accessing offset + 2, so make sure it's not out-of-bounds
		if(ib_offset + 2 >= atu8_cert.length) {
			throw new Error('Error parsing certificate - malformed certificate. Offset out of bounds');
		}

		let nb_part = atu8_cert[ib_offset];
		if(nb_part > 0x80) {
			nb_part = (atu8_cert[ib_offset + 1] * 0x100) + atu8_cert[ib_offset + 2];
			ib_offset += 2;
		}

		// check cert length
		if(ib_offset + nb_part + 1 >= atu8_cert.length) {
			throw new Error('Error parsing certificate - malformed certificate. Bad length');
		}

		// extract payload
		ib_offset += 1;
		const atu8_payload = atu8_cert.slice(ib_offset, ib_offset + nb_part);

		// software mode
		try {
			const atu8_pk = base64_to_buffer(buffer_to_text(atu8_payload));
			if(32 === atu8_pk.byteLength) return atu8_pk;
		}
		catch(e_sw) {}

		// hardware mode
		try {
			const sx_report = JSON.parse(buffer_to_text(atu8_payload)).report as string;

			const atu8_body = JSON.parse(buffer_to_text(base64_to_buffer(sx_report))).isvEnclaveQuoteBody as string;

			const atu8_quote = base64_to_buffer(atu8_body);

			return atu8_quote.slice(368, 400);
		}
		catch(e_hw) {
			throw new Error('Cannot extract tx io pubkey: error parsing certificate - malformed certificate');
		}
	}

	// static async destructureMsg() {
	// 	// destructore [nonce, pk, ciphertext]
	// 	return {
	// 		nonce: atu8_encoded.subarray(0, 32),
	// 		pubkey: atu8_encoded.subarray(32, 64),
	// 		ciphertext: atu8_encoded.subarray(64),
	// 	};
	// }

	static async decodeSecretWasmAmino(p_account: AccountPath, g_chain: ChainStruct, sxb64_msg: string) {
		// decode consensus io pk from chain
		const atu8_consensus_io_pk = base93_to_buffer(g_chain.features.secretwasm!.consensusIoPubkey);

		// decode message
		const atu8_encoded = base64_to_buffer(sxb64_msg);

		// destructore [nonce, pk, ciphertext]
		const {
			atu8_nonce,
			atu8_pk,
			atu8_ciphertext,
		} = destructure_msg(atu8_encoded);

		// fetch account
		const g_account = await Accounts.at(p_account);

		// account not found
		if(!g_account) {
			throw syserr({
				title: 'Corrupted data',
				text: `Account not found: ${p_account}`,
			});
		}

		// borrow tx encryption key and instantiate secretwasm
		const k_wasm = await utility_key_child(g_account, 'walletSecurity', 'transactionEncryptionKey',
			atu8_seed => new SecretWasm(atu8_consensus_io_pk, atu8_seed));

		// utility key missing
		if(!k_wasm) {
			throw syserr({
				title: 'No tx encryption seed',
				text: `Account "${g_account.name}" is missing a Secret WASM transaction encryption seed.`,
			});
		}

		// decrypt the ciphertex
		const atu8_plaintext = await k_wasm.decrypt(atu8_ciphertext, atu8_nonce);

		// destroy wasm instance
		k_wasm.destroy();

		// plaintext
		const sx_exec = buffer_to_text(atu8_plaintext);

		// base64 code hash
		const sx_code_hash = sx_exec.slice(0, 64);

		// contract execution msg
		const sx_json = sx_exec.slice(64);

		return {
			codeHash: sx_code_hash,
			message: sx_json,
			nonce: atu8_nonce,
		};
	}

	static async decryptBuffer(
		g_account: AccountStruct,
		g_chain: ChainStruct,
		atu8_ciphertext: Uint8Array,
		atu8_nonce: Uint8Array
	): Promise<Uint8Array> {
		// decode consensus io pk from chain
		const atu8_consensus_io_pk = base93_to_buffer(g_chain.features.secretwasm!.consensusIoPubkey);

		// borrow tx encryption key and instantiate secretwasm
		const k_wasm = await utility_key_child(g_account, 'walletSecurity', 'transactionEncryptionKey',
			atu8_seed => new SecretWasm(atu8_consensus_io_pk, atu8_seed));

		if(!k_wasm) {
			throw syserr({
				title: 'No tx encryption seed',
				text: `Account "${g_account.name}" is missing a Secret WASM transaction encryption seed.`,
			});
		}

		// decrypt the ciphertex
		const atu8_plaintext = await k_wasm.decrypt(atu8_ciphertext, atu8_nonce);

		// destroy wasm instance
		k_wasm.destroy();

		// plaintext
		return atu8_plaintext;
	}

	static async decryptMsg(g_account: AccountStruct, g_chain: ChainStruct, atu8_msg: Uint8Array): Promise<DecryptedMessage> {
		// destructore [nonce, pk, ciphertext]
		const {
			atu8_nonce,
			atu8_pk,
			atu8_ciphertext,
		} = destructure_msg(atu8_msg);

		// decrypt the ciphertex
		const atu8_plaintext = await SecretWasm.decryptBuffer(g_account, g_chain, atu8_ciphertext, atu8_nonce);

		// plaintext
		const sx_exec = buffer_to_text(atu8_plaintext);

		// base64 code hash
		const sxb64_code_hash = sx_exec.slice(0, 64);

		// contract execution msg
		const sx_json = sx_exec.slice(64);

		return {
			code_hash: sxb64_code_hash,
			message: sx_json,
			nonce: atu8_nonce,
			consensus_pk: atu8_pk,
		};
	}

	static async encryptionKeyFromMsg(g_account: AccountStruct, g_chain: ChainStruct, atu8_msg: Uint8Array): Promise<Uint8Array> {
		// decode consensus io pk from chain
		const atu8_consensus_io_pk = base93_to_buffer(g_chain.features.secretwasm!.consensusIoPubkey);

		// borrow tx encryption key and instantiate secretwasm
		const k_wasm = await utility_key_child(g_account, 'walletSecurity', 'transactionEncryptionKey',
			atu8_seed => new SecretWasm(atu8_consensus_io_pk, atu8_seed));

		// destructure nonce
		const {
			atu8_nonce,
		} = destructure_msg(atu8_msg);

		// return encryption key
		return k_wasm!.encryptionKey(atu8_nonce);
	}

	static async decryptComputeError(g_account: AccountStruct, g_chain: ChainStruct, s_message: string, atu8_nonce: Uint8Array): Promise<string> {
		// parse contract error
		const m_error = R_SCRT_COMPUTE_ERROR.exec(s_message || '')!;
		if(m_error) {
			const [, , sxb64_error_ciphertext] = m_error;

			const atu8_ciphertext = base64_to_buffer(sxb64_error_ciphertext);

			// use nonce to decrypt
			const atu8_plaintext = await SecretWasm.decryptBuffer(g_account, g_chain, atu8_ciphertext, atu8_nonce);

			// utf-8 decode into plaintext
			return buffer_to_text(atu8_plaintext);
		}

		throw new ContractDecryptionError('Failed to decrypt the error message returned by the contract');
	}

	constructor(protected _atu8_cons_io_pk: Uint8Array, atu8_seed?: Uint8Array) {
		// correct and available consensus io pubkey
		if(32 !== _atu8_cons_io_pk.byteLength) {
			if(atu8_seed) zero_out(atu8_seed);
			throw new Error(`Invalid consensus key length`);
		}

		// validate seed
		if(!atu8_seed) {
			atu8_seed = crypto.getRandomValues(new Uint8Array(32));
		}
		// incorrect size
		else if(32 !== atu8_seed.byteLength) {
			zero_out(atu8_seed);
			throw new Error(`Invalid seed length`);
		}

		// copy seed to new private key
		const atu8_sk = atu8_seed.slice();

		// derive curve25119 public key
		const atu8_pk = crypto_scalarmult_base(atu8_sk);

		// turn secret key into correct format
		atu8_sk[0] &= 0xf8;
		atu8_sk[31] &= 0x7f;
		atu8_sk[31] |= 0x40;

		// remove sign bit from public key
		atu8_pk[31] &= 0x7f;

		const g_privates = {
			atu8_sk,
			atu8_pk,
		} as PrivateFields;

		hm_privates.set(this, g_privates);
	}

	get pubkey(): Uint8Array {
		return hm_privates.get(this)!.atu8_pk;
	}

	destroy(): void {
		const g_privates = hm_privates.get(this)!;

		zero_out(g_privates.atu8_sk);
		zero_out(g_privates.atu8_pk);

		hm_privates.delete(this);
	}

	async encryptionKey(atu8_nonce: Uint8Array): Promise<Uint8Array> {
		const {atu8_sk} = hm_privates.get(this)!;

		const atu8_tx_ikm = crypto_scalarmult(atu8_sk, this._atu8_cons_io_pk);

		const atu8_input = concat([atu8_tx_ikm, atu8_nonce]);

		const dk_input = await crypto.subtle.importKey('raw', atu8_input, 'HKDF', false, ['deriveBits']);

		const ab_encryption = await crypto.subtle.deriveBits({
			name: 'HKDF',
			hash: 'SHA-256',
			salt: ATU8_SALT_HKDF,
			info: new Uint8Array(0),
		}, dk_input, 256);

		const atu8_encryption = new Uint8Array(ab_encryption);

		return atu8_encryption;
	}

	async encrypt(s_code_hash: string, g_msg: JsonValue): Promise<Uint8Array> {
		if(64 !== s_code_hash.length) {
			throw new Error(`Missing required code hash for secret wasm message encryption`);
		}

		// construct payload
		const atu8_payload = text_to_buffer(s_code_hash.toUpperCase()+JSON.stringify(g_msg));

		// pad to make multiple of block size
		const nb_payload = atu8_payload.byteLength;
		const nb_target = Math.ceil(nb_payload / NB_TX_BLOCK) * NB_TX_BLOCK;

		// pad the end with spaces
		const atu8_padding = text_to_buffer(' '.repeat(nb_target - nb_payload));

		// construct plaintext
		const atu8_plaintext = concat([atu8_payload, atu8_padding]);

		// generate nonce
		const atu8_nonce = crypto.getRandomValues(new Uint8Array(32));

		// fetch encryption key
		const atu8_txk = await this.encryptionKey(atu8_nonce);

		// import key
		const y_siv = await SIV.importKey(atu8_txk, 'AES-SIV', y_provider);

		// encrypt
		const atu8_ciphertext = (await y_siv.seal(atu8_plaintext, [new Uint8Array(0)])) as Uint8Array;

		// get public key
		const {atu8_pk} = hm_privates.get(this)!;

		// // save nonce used for ciphertext
		// console.debug({
		// 	nonce: buffer_to_base64(atu8_nonce),
		// 	ciphertext: buffer_to_base64(atu8_ciphertext),

		// });
		// const sx93_ciphertext_hash = buffer_to_base93(sha256_sync(atu8_ciphertext));
		// await SessionStorage.set({
		// 	[`nonce:${sx93_ciphertext_hash}` as const]: {
		// 		nonce: buffer_to_base93(atu8_nonce),
		// 		time: Date.now(),
		// 	},
		// });

		// construct final message
		return concat([atu8_nonce, atu8_pk, atu8_ciphertext]);
	}

	async decrypt(atu8_ciphertext: Uint8Array, atu8_nonce: Uint8Array): Promise<Uint8Array> {
		// empty ciphertext
		if(!atu8_ciphertext.byteLength) return new Uint8Array(0);

		// fetch tx encryption key
		const atu8_txk = await this.encryptionKey(atu8_nonce);

		// import key
		const y_siv = await SIV.importKey(atu8_txk, 'AES-SIV', y_provider);

		// decrypt ciphertext
		try {
			return y_siv.open(atu8_ciphertext, [new Uint8Array(0)]);
		}
		catch(e_decrypt) {
			throw new Error(`AES-SIV decryption failed, "${e_decrypt.stack}".\nciphertext: ${buffer_to_base64(atu8_ciphertext)}\ntx key: ${buffer_to_base64(atu8_txk)}\nnonce: ${buffer_to_base64(atu8_nonce)}\nconsensus io pk: ${buffer_to_base64(this._atu8_cons_io_pk)}`);
		}
	}
}
