import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {AccountStruct} from '#/meta/account';
import type {JsonObject} from '#/meta/belt';
import type {ChainStruct, ContractStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';

import {
	QueryClientImpl as ComputeQueryClient,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import {
	QueryClientImpl as RegistrationQueryClient,
} from '@solar-republic/cosmos-grpc/dist/secret/registration/v1beta1/query';



import {CosmosNetwork} from './cosmos-network';


import {syserr} from '#/app/common';
import {SecretWasm} from '#/crypto/secret-wasm';
import {wgrpc_retry} from '#/extension/network';
import {utility_key_child} from '#/share/account';
import {R_SCRT_COMPUTE_ERROR} from '#/share/constants';
import {ContractDecryptionError} from '#/share/errors';
import {Chains} from '#/store/chains';
import {base64_to_buffer, base93_to_buffer, buffer_to_base93, buffer_to_json, buffer_to_text} from '#/util/data';



interface Snip20TokenInfo extends JsonObject {
	name: Cw.String;
	symbol: Cw.String;
	decimals: Cw.NaturalNumber;
	total_supply: Cw.Uint128;
}

type Queryable = Merge<
	Pick<ContractStruct, 'bech32'>,
	Partial<
		Pick<ContractStruct, 'hash'>
	>
>;

export class SecretNetwork extends CosmosNetwork {
	static uuidForQueryPermit(g_chain: ChainStruct, s_permit_name: string): string {
		return `${Chains.caip2From(g_chain)}:#query_permit:${s_permit_name}`;
	}

	async secretConsensusIoPubkeyExact(): Promise<Uint8Array> {
		if(!this._g_chain.features['secretwasm']) {
			throw new Error(`Cannot get consensus IO pubkey on non-secret chain "${this._g_chain.reference}"`);
		}

		// instantiate registration client
		const y_reg = new RegistrationQueryClient(this._y_grpc);

		// attempt to fetch tx key from node
		const g_tx = await wgrpc_retry(() => y_reg.txKey({}));

		if(32 === g_tx?.key?.byteLength) {
			return g_tx.key;
		}

		throw new Error(`Node did not return a consensus key`);
	}

	async secretConsensusIoPubkey(): Promise<Uint8Array> {
		// attempt to fetch tx key from node
		try {
			return this.secretConsensusIoPubkeyExact();
		}
		catch(e_key) {}

		// otherwise, fallback to extracting from registration
		{
			const g_registration = await wgrpc_retry(() => new RegistrationQueryClient(this._y_grpc).registrationKey({}));

			return SecretWasm.extractConsensusIoPubkey(g_registration.key);
		}
	}

	async secretWasm(g_account: AccountStruct): Promise<SecretWasm> {
		// resolve consensus io pubkey
		let sxb93_consensus_pk = this._g_chain.features.secretwasm?.consensusIoPubkey;

		// not stored
		if(!sxb93_consensus_pk) {
			try {
				// acquire from network
				const atu8_consensus_pk = await this.secretConsensusIoPubkey();

				// set locally
				sxb93_consensus_pk = buffer_to_base93(atu8_consensus_pk);

				// save permanently
				await Chains.update(this._p_chain, g_chain => ({
					...g_chain,
					features: {
						...g_chain.features,
						secretwasm: {
							...g_chain.features.secretwasm!,
							consensusIoPubkey: sxb93_consensus_pk!,
						},
					},
				}));
			}
			catch(e_acquire) {
				throw syserr({
					title: 'Missing Chain Information',
					text: `No consensus IO public key found, and an error was encountered while trying to acquire it: ${e_acquire.message}`,
				});
			}
		}

		// convert to buffer
		const atu8_consensus_pk = base93_to_buffer(sxb93_consensus_pk);

		// account has signed a wasm seed; load secretwasm
		let k_wasm = await utility_key_child(g_account, 'walletSecurity', 'transactionEncryptionKey',
			atu8_seed => new SecretWasm(atu8_consensus_pk, atu8_seed));

		// no pre-existing tx encryption key; generate a random seed
		if(!k_wasm) k_wasm = new SecretWasm(atu8_consensus_pk);

		return k_wasm;
	}

	async encryptContractMessage(g_account: AccountStruct, s_code_hash: string, h_msg: JsonObject): Promise<Uint8Array> {
		// get wasm instance
		const k_wasm = await this.secretWasm(g_account);

		// encrypt message for destination contract
		return await k_wasm.encrypt(s_code_hash, h_msg);
	}

	decryptContractMessage(g_account: AccountStruct, atu8_msg: Uint8Array): ReturnType<typeof SecretWasm['decryptMsg']> {
		return SecretWasm.decryptMsg(g_account, this._g_chain, atu8_msg);
	}

	decryptComputeError(g_account: AccountStruct, s_message: string, atu8_nonce: Uint8Array): Promise<string> {
		return SecretWasm.decryptComputeError(g_account, this._g_chain, s_message, atu8_nonce);
	}

	async snip20Info(g_account: AccountStruct, g_contract: Queryable): Promise<Snip20TokenInfo> {
		return await this.queryContract<Snip20TokenInfo>(g_account, g_contract, {
			token_info: {},
		});
	}

	async queryContract<
		g_result extends JsonObject=JsonObject,
	>(g_account: AccountStruct, g_contract: Queryable, h_query: JsonObject, g_writeback?: {atu8_nonce: Uint8Array}): Promise<g_result> {
		let si_hash = g_contract.hash;
		if(!si_hash) {
			si_hash = await this.codeHashByContractAddress(g_contract.bech32);
		}

		// encrypt query
		const atu8_query = await this.encryptContractMessage(g_account, si_hash, h_query);

		// extract nonce from query
		const atu8_nonce = atu8_query.slice(0, 32);

		// caller provided writeback; set nonce
		if(g_writeback) g_writeback.atu8_nonce = atu8_nonce;

		// submit to provider
		const g_response = await wgrpc_retry(() => new ComputeQueryClient(this._y_grpc).querySecretContract({
			contractAddress: g_contract.bech32,
			query: atu8_query,
		}));

		// decrypt response
		const atu8_plaintetxt = await SecretWasm.decryptBuffer(g_account, this._g_chain, g_response.data, atu8_nonce);

		// parse plaintext
		const sxb64_response = buffer_to_text(atu8_plaintetxt);
		const atu8_response = base64_to_buffer(sxb64_response);

		// parse and return json
		return buffer_to_json(atu8_response) as g_result;
	}
}
