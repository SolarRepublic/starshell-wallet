import type {AccountPath, AccountStruct} from '#/meta/account';
import type {Bech32, ChainStruct} from '#/meta/chain';

import {decrypt, encrypt} from './vault';

import {syserr} from '#/app/common';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import {ATU8_SHA256_STARSHELL} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {base93_to_buffer, buffer_to_base93, buffer_to_text, sha256, sha256_sync, text_to_buffer, zero_out} from '#/util/data';


export function ecdh_nonce(a_data: string[]): Promise<Uint8Array> {
	return sha256(text_to_buffer(['private-memo', ...a_data].join('\0')));
}

export function encode_memo_ciphertext(atu8_ciphertext: Uint8Array): string {
	return '🔒1'+buffer_to_base93(atu8_ciphertext);
}

export function extract_memo_ciphertext(s_memo: string): Uint8Array {
	if(!s_memo.startsWith('🔒1')) {
		throw syserr({
			title: 'Memo Invalid',
			text: 'Attempted to decrypt invalid memo. Unexpected preamble in ciphertext.',
		});
	}

	return base93_to_buffer(s_memo.slice(3));
}

const X_BASE93_EXPANSION_MIN = 171 / 139;
const X_BASE93_EXPANSION_MAX = 167 / 135;



async function ecdh(atu8_other_pubkey: Uint8Array, g_chain: ChainStruct, g_account: AccountStruct): Promise<CryptoKey> {
	// get account's signing key
	const k_key = await Accounts.getSigningKey(g_account);

	// derive shared secret
	const atu8_shared = await k_key.ecdh(atu8_other_pubkey);

	// import base key
	const dk_hkdf = await crypto.subtle.importKey('raw', atu8_shared, 'HKDF', false, ['deriveBits', 'deriveKey']);

	// zero out shared secret
	zero_out(atu8_shared);

	// derive encryption/decryption key
	const dk_aes = await crypto.subtle.deriveKey({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: ATU8_SHA256_STARSHELL,  // TODO: ideas for salt?
		info: sha256_sync(text_to_buffer(g_chain.reference)),
	}, dk_hkdf, {
		name: 'AES-GCM',
		length: 256,
	}, false, ['encrypt', 'decrypt']);

	return dk_aes;
}


export async function ecdh_encrypt(atu8_other_pubkey: Uint8Array, atu8_plaintext: Uint8Array, atu8_nonce: Uint8Array, g_chain: ChainStruct, g_account: AccountStruct): Promise<Uint8Array> {
	// derive encryption key
	const dk_aes = await ecdh(atu8_other_pubkey, g_chain, g_account);

	// encrypt memo
	const atu8_encrypted = await encrypt(atu8_plaintext, dk_aes, atu8_nonce);

	return atu8_encrypted;
}

export async function ecdh_decrypt(atu8_other_pubkey: Uint8Array, atu8_ciphertext: Uint8Array, atu8_nonce: Uint8Array, g_chain: ChainStruct, g_account: AccountStruct): Promise<Uint8Array> {
	// derive encryption key
	const dk_aes = await ecdh(atu8_other_pubkey, g_chain, g_account);

	// decrypt memo
	const atu8_decrypted = await decrypt(atu8_ciphertext, dk_aes, atu8_nonce);

	return atu8_decrypted;
}

export async function encrypt_private_memo(
	s_memo: string,
	g_chain: ChainStruct,
	p_account: AccountPath,
	sa_recipient: Bech32,
	k_network: CosmosNetwork
): Promise<string> {
	// load account def from storage
	const g_account = (await Accounts.at(p_account))!;

	// compute sender's address on given chain
	const sa_sender = Chains.addressFor(g_account.pubkey, g_chain);

	// prep memo character limit
	let n_chars!: number;
	try {
		// fetch max memo chars param
		const g_param = await k_network.networkParam({
			key: 'MaxMemoCharacters',
			subspace: 'auth',
		});

		// parse amount
		n_chars = parseInt(JSON.parse(g_param?.value || '') as string);
	}
	catch(e_param) {}

	// invalid
	if(!Number.isInteger(n_chars)) {
		throw syserr({
			title: 'Network error',
			text: 'Unable to fetch the maximum memo length parameter from the chain',
		});
	}

	// locate recipient's public key
	let atu8_pubkey_65: Uint8Array;
	try {
		({
			pubkey: atu8_pubkey_65,
		} = await k_network.e2eInfoFor(sa_recipient));
	}
	catch(e_info) {
		throw syserr({
			title: 'Recipient Account Unpublished',
			error: e_info,
		});
	}

	// produce e2e nonce
	let s_sequence: string;
	try {
		({
			sequence: s_sequence,
		} = await k_network.e2eInfoFor(sa_sender));
	}
	catch(e_info) {
		throw syserr({
			title: 'Invalid account for private memos',
			error: e_info,
		});
	}

	// compute ecdh nonce with recipient
	const atu8_nonce = await ecdh_nonce([`${BigInt(s_sequence) + 1n}`]);

	// convert param effective to byte limit (3 bytes for preamble + base93_overhead(16 byte GCM tag + PAYLOAD_SIZE))
	const nb_max_memo = Math.floor((n_chars - 3) / X_BASE93_EXPANSION_MAX) - 16;

	// utf8-encode memo
	const atu8_memo_in = text_to_buffer(s_memo);

	// input is too long
	if(atu8_memo_in.byteLength > nb_max_memo) {
		throw syserr({
			title: 'Invalid memo',
			text: 'Your memo text exceeds the character limitation for private memos',
		});
	}

	// populate the plaintext buffer
	const atu8_plaintext = new Uint8Array(nb_max_memo);
	atu8_plaintext.set(atu8_memo_in, 0);

	// encrypt payload
	const atu8_ciphertext = await ecdh_encrypt(atu8_pubkey_65, atu8_plaintext, atu8_nonce, g_chain, g_account);

	// exceeds chain length parameter
	if(atu8_ciphertext.byteLength > n_chars) {
		throw syserr({
			title: 'Private memo bug',
			text: 'There was a problem when calculating the memo payload size. Please report this bug',
		});
	}

	// encode ciphertext
	const s_memo_encrypted = encode_memo_ciphertext(atu8_ciphertext);

	// simulate decryption
	{
		// extract payload from ciphertext
		const atu8_published = extract_memo_ciphertext(s_memo_encrypted);

		const atu8_decrypted = await ecdh_decrypt(atu8_pubkey_65, atu8_published, atu8_nonce, g_chain, g_account);

		const s_memo_decrypted = buffer_to_text(atu8_decrypted).replace(/\0+$/, '');

		if(s_memo_decrypted !== s_memo) {
			throw syserr({
				title: 'Quality assurance failure',
				text: `Simulated decrypted memo did not match original: ${s_memo_decrypted}`,
			});
		}
	}

	return s_memo_encrypted;
}

export async function decrypt_private_memo(
	s_memo_encrypted: string,
	k_network: CosmosNetwork,
	sa_other: Bech32,
	s_sequence: string,
	g_account: AccountStruct
): Promise<string> {
	// extract payload from ciphertext
	const atu8_published = extract_memo_ciphertext(s_memo_encrypted);

	const atu8_pubkey_65 = (await k_network.e2eInfoFor(sa_other)).pubkey;

	const atu8_nonce = await ecdh_nonce([s_sequence]);

	const atu8_decrypted = await ecdh_decrypt(atu8_pubkey_65, atu8_published, atu8_nonce, k_network.chain, g_account);

	return buffer_to_text(atu8_decrypted).replace(/\0+$/, '');
}
