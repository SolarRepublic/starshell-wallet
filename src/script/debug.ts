import type {AccountStruct, AccountPath} from '#/meta/account';
import type {Caip2} from '#/meta/chain';
import type {SecretStruct} from '#/meta/secret';
import type {StoreKey} from '#/meta/store';

import {fromBech32, toBech32} from '@cosmjs/encoding';
import {decodeTxRaw} from '@cosmjs/proto-signing';
import {MsgExecuteContract} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/tx';
import {MsgExecuteContract as SecretMsgExecuteContract} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/msg';

import BigNumber from 'bignumber.js';

import {global_broadcast, global_receive} from './msg-global';
import {set_keplr_compatibility_mode} from './scripts';

import {amino_to_base, encode_proto, proto_to_amino} from '#/chain/cosmos-msgs';
import {FeeGrants} from '#/chain/fee-grant';
import {SecretNetwork} from '#/chain/secret-network';
import {Argon2} from '#/crypto/argon2';
import {pubkey_to_bech32} from '#/crypto/bech32';
import {EntropyProducer} from '#/crypto/entropy';
import {SecretWasm} from '#/crypto/secret-wasm';
import SensitiveBytes from '#/crypto/sensitive-bytes';
import {Vault} from '#/crypto/vault';
import {PublicStorage, storage_clear, storage_get, storage_get_all, storage_remove, storage_set} from '#/extension/public-storage';
import {SessionStorage} from '#/extension/session-storage';
import {import_private_key} from '#/share/account';
import {factory_reset} from '#/share/auth';
import {
	G_USERAGENT,
	R_CAIP_2,
	ATU8_SHA256_STARSHELL,
} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Histories, Incidents} from '#/store/incidents';
import {Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {Settings} from '#/store/settings';
import {crypto_random_int, random_int, shuffle} from '#/util/belt';
import {base58_to_buffer, base64_to_buffer, base93_to_buffer, buffer_to_base58, buffer_to_base64, buffer_to_base93, buffer_to_hex, buffer_to_text, hex_to_buffer, ripemd160_sync, sha256_sync, text_to_base64, text_to_buffer, uuid_v4} from '#/util/data';
import { argon_hash_sample } from '#/app/svelte';
import { Policies } from './ics-witness-imports';
import { is_keplr_extension_enabled, is_starshell_muted } from '#/extension/keplr';
import { QueryCache } from '#/store/query-cache';


// development mode
export function enable_debug_mode(): void {
	Object.assign(globalThis.debug? globalThis.debug: globalThis.debug={}, {
		async decrypt(si_store: StoreKey) {
			// fetch the root key
			const dk_root = await Vault.getRootKey();

			// derive the cipher key
			const dk_cipher = await Vault.cipherKey(dk_root!, true);

			// read from the store
			const kv_store = await Vault.readonly(si_store);

			// read the store as json
			const w_store = await kv_store.readJson(dk_cipher);

			return w_store;
		},

		Argon2,

		Secrets,
		Accounts,
		Apps,
		Chains,
		Contracts,
		Histories,
		Incidents,
		Providers,

		EntropyProducer,
		SecretWasm,
		SecretNetwork,

		base93_to_buffer,
		base58_to_buffer,
		buffer_to_base93,
		buffer_to_base58,
		base64_to_buffer,
		buffer_to_base64,
		sha256_sync,
		ripemd160_sync,
		hex_to_buffer,
		buffer_to_hex,
		text_to_base64,
		text_to_buffer,
		buffer_to_text,
		pubkey_to_bech32,
		fromBech32,
		toBech32,
		SessionStorage,
		PublicStorage,
		G_USERAGENT,

		shuffle,
		random_int,
		crypto_random_int,

		decodeTxRaw,
		set_keplr_compatibility_mode,
		SecretMsgExecuteContract,
		MsgExecuteContract,

		amino_to_base,
		proto_to_amino,
		encode_proto,

		global_broadcast,
		global_receive,

		factory_reset,

		storage_get,
		storage_get_all,
		storage_set,
		storage_remove,
		storage_clear,

		Policies,
		Settings,
		BigNumber,
		QueryCache,

		FeeGrants,

		argon_hash_sample,

		is_starshell_muted,
		is_keplr_extension_enabled,

		async hash_passphrase() {
			await Argon2.hash({
				type: 2,
				phrase: Uint8Array.from([0, 0, 0]),
				salt: ATU8_SHA256_STARSHELL,
				hashLen: 32,
				memory: 1 << 10,
				iterations: 1,
			});

			console.log('ok');

			return 'done';
		},

		async network(si_chain='secret-4') {
			const g_chain = await Chains.at(`/family.cosmos/chain.${si_chain}`);
			return await Providers.activateStableDefaultFor(g_chain!);
		},

		async import_sk(sxb64_sk: string, s_name='Citizen '+uuid_v4().slice(0, 4)) {
			const atu8_sk = base64_to_buffer(sxb64_sk);

			const kn_sk = new SensitiveBytes(atu8_sk);

			return await import_private_key(kn_sk, s_name);
		},

		async import_account(g_account: AccountStruct): Promise<AccountPath> {
			return await Accounts.open(ks_accounts => ks_accounts.put(g_account));
		},

		async import_secrets(a_data: Array<number[]>, a_secrets: SecretStruct[]) {
			for(let i_secret=0; i_secret<a_secrets.length; i_secret++) {
				await Secrets.put(Uint8Array.from(a_data[i_secret]), a_secrets[i_secret]);
			}
		},

		async inspect_tx(si_tx: string, si_caip2: Caip2.String) {
			const [, si_namespace, si_reference] = R_CAIP_2.exec(si_caip2)!;
			const p_chain = Chains.pathFor(si_namespace as 'cosmos', si_reference);
			const g_chain = (await Chains.at(p_chain))!;
			const k_network = await Providers.activateDefaultFor(g_chain);
			return await k_network.fetchTx(si_tx);
		},
	});
}
