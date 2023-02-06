import type {AccountStruct, AccountPath, UtilityKeyType, UtilityKey} from '#/meta/account';
import type {Promisable} from '#/meta/belt';
import type {PfpTarget} from '#/meta/pfp';
import type {SecretPath} from '#/meta/secret';

import type {Bip32} from '#/crypto/bip32';
import RuntimeKey from '#/crypto/runtime-key';
import {Secp256k1Key} from '#/crypto/secp256k1';
import type SensitiveBytes from '#/crypto/sensitive-bytes';
import {ATU8_SHA256_STARSHELL} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Incidents} from '#/store/incidents';
import {Secrets} from '#/store/secrets';
import {buffer_to_base64, sha256_sync, text_to_buffer, uuid_v4, zero_out} from '#/util/data';
import { fodemtv, fold } from '#/util/belt';


export async function create_account(
	p_secret: SecretPath<'bip32_node' | 'private_key'>,
	sxb64_pubkey: string,
	p_pfp: PfpTarget
): Promise<[AccountPath, AccountStruct]> {
	// determine by number of accounts
	let i_citizen = (await Accounts.read()).entries().length + 1;

	// find an unused name
	for(;;) {
		const a_accounts = await Accounts.filter({
			name: `Citizen ${i_citizen}`,
		});

		if(!a_accounts.length) break;

		i_citizen += 1;
	}

	// read chains
	const a_chains = await Chains.entries();

	// open accounts store and save new account
	const p_account = await Accounts.open(ks_accounts => ks_accounts.put({
		family: 'cosmos',
		pubkey: sxb64_pubkey,
		secret: p_secret,
		name: `Citizen ${i_citizen}`,
		assets: fold(a_chains, ([p_chain]) => ({
			[p_chain]: {
				totalFiatCache: '??',
				fungibleTokens: [],
				data: {},
			},
		})),
		utilityKeys: {},
		pfp: p_pfp,
	}));

	// verify account was created
	let g_account: AccountStruct;
	{
		const ks_accounts = await Accounts.read();
		const g_test = ks_accounts.at(p_account);

		if(!g_test) {
			throw new Error(`Failed to access account immediately after creating it`);
		}

		g_account = g_test;
	}

	// create event
	await Incidents.record({
		type: 'account_created',
		data: {
			account: p_account,
		},
	});

	return [p_account, g_account];
}

export async function create_private_key() {
	// generate new private key
	const [kk_sk, k_secp] = await Secp256k1Key.generatePrivateKey(true);

	// generate new uuid for the secret
	const s_uuid = uuid_v4();

	// save private key to secrets store
	const p_secret = await kk_sk.access(atu8_sk => Secrets.put(atu8_sk, {
		type: 'private_key',
		name: 'Auto-generated private key for beta',
		uuid: s_uuid,
		security: {
			type: 'none',
		},
	}));

	// export public key
	const atu8_pk = k_secp.exportPublicKey();

	// 
	const [p_account, g_account] = await create_account(p_secret, buffer_to_base64(atu8_pk), '');

	// // set account
	// $yw_account_ref = p_account;
}

export function bip32_test_signature(k_node: Bip32): Promise<string> {
	return k_node.privateKey.access(async(atu8_sk) => {
		// create runtime key for secp256k1 instance
		const kk_sk = await RuntimeKey.createRaw(atu8_sk);

		// import private key
		const k_secp = await Secp256k1Key.import(kk_sk);

		// sign some arbitrary piece of data
		const atu8_signature = await k_secp.sign(ATU8_SHA256_STARSHELL);

		// serialize
		return buffer_to_base64(atu8_signature);
	});
}

export async function add_root_utility_key(
	g_account: AccountStruct,
	si_name: string,
	s_description: string
): Promise<AccountPath> {
	// intentionally not ADR-036 because apps should not be able to propose these messages
	let atu8_ikm: Uint8Array;
	{
		// get account's signing key
		const k_key = await Accounts.getSigningKey(g_account);

		// custom starshell data to be signed
		const g_doc_starshell = {
			type: 'StarShell Utility Key Signature',
			name: si_name,
			description: s_description,

			// sign using "secret" as bech32 hrp
			signer: Chains.addressFor(g_account.pubkey, 'secret'),
		};

		// serialize doc to buffer
		const atu8_bytes = text_to_buffer(JSON.stringify(g_doc_starshell));

		// sign as buffer
		const atu8_signature = await k_key.sign(atu8_bytes);

		// hash the signature to produce 32-bit ikm
		atu8_ikm = sha256_sync(atu8_signature);
	}

	// import key
	const dk_sig = await crypto.subtle.importKey('raw', atu8_ikm, 'HKDF', false, ['deriveBits']);

	// use hkdf to derive utility key
	const ab_utility_key = await crypto.subtle.deriveBits({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: ATU8_SHA256_STARSHELL,
		info: new Uint8Array(0),
	}, dk_sig, 256);

	// create tx encryption key secret
	const p_secret_tx: SecretPath = await Secrets.put(new Uint8Array(ab_utility_key), {
		type: 'private_key',
		name: 'Auto-generated private key for beta',
		uuid: uuid_v4(),
		security: {
			type: 'none',
		},
	});

	// update account cache
	g_account.utilityKeys = {
		...g_account.utilityKeys,
		[si_name]: p_secret_tx,
	};

	// add key to account
	return await Accounts.open(ks => ks.put(g_account));
}


export async function utility_key_child<
	si_name extends UtilityKeyType,
	w_return,
>(
	g_account: AccountStruct,
	si_name: si_name,
	si_child: UtilityKey.Children<si_name>,
	fk_use: (atu8_key: Uint8Array) => Promisable<w_return>
): Promise<undefined | w_return> {
	const p_secret = g_account.utilityKeys[si_name];
	if(!p_secret) return;

	// borrow data from secrets store
	return await Secrets.borrow(p_secret, async(kn_root) => {
		// import root key
		const dk_root = await crypto.subtle.importKey('raw', kn_root.data, 'HKDF', false, ['deriveBits']);

		// use hkdf to derive child key
		const ab_child_key = await crypto.subtle.deriveBits({
			name: 'HKDF',
			hash: 'SHA-256',
			salt: ATU8_SHA256_STARSHELL,
			info: text_to_buffer(si_child),
		}, dk_root, 256);

		// wrap as buffer
		const atu8_child_key = new Uint8Array(ab_child_key);

		// use child key
		const w_return = await fk_use(atu8_child_key);

		// zero out key
		zero_out(atu8_child_key);

		// return use response
		return w_return;
	}) as w_return;
}

export async function import_private_key(kn_sk: SensitiveBytes, s_name: string): Promise<[AccountPath, AccountStruct]> {
	const atu8_sk = kn_sk.data;

	const p_secret = await Secrets.put(atu8_sk, {
		type: 'private_key',
		uuid: crypto.randomUUID(),
		name: `Imported private key`,
		security: {
			type: 'none',
		},
	});

	const k_secp = await Secp256k1Key.import(await RuntimeKey.createRaw(atu8_sk), true);

	const atu8_pk = k_secp.exportPublicKey();

	// open accounts store and save new account
	const p_account = await Accounts.open(ks_accounts => ks_accounts.put({
		family: 'cosmos',
		pubkey: buffer_to_base64(atu8_pk),
		secret: p_secret,
		name: s_name,
		utilityKeys: {},
		assets: {},
		pfp: '',
	}));

	// verify account was created
	let g_account: AccountStruct;
	{
		const ks_accounts = await Accounts.read();
		const g_test = ks_accounts.at(p_account);

		if(!g_test) {
			throw new Error(`Failed to access account immediately after creating it`);
		}

		g_account = g_test;
	}

	// create event
	await Incidents.record({
		type: 'account_created',
		data: {
			account: p_account,
		},
	});

	return [p_account, g_account];
}
