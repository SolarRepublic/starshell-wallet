import type {Snip20} from './snip-20-def';
import type {Snip24} from './snip-24-def';
import type {PortableMessage, Snip2x, TransactionHistoryItem, TransferHistoryItem} from './snip-2x-def';

import type {Coin} from '@cosmjs/amino';
import type {L, N} from 'ts-toolbelt';

import type {AccountStruct} from '#/meta/account';
import type {Dict, JsonObject} from '#/meta/belt';
import type {Bech32, ChainPath, ChainStruct, ContractStruct} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';

import type {SecretStruct} from '#/meta/secret';
import type {TokenStructDescriptor, TokenStructKey} from '#/meta/token';

import {Fee} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import BigNumber from 'bignumber.js';

import {syserr, syswarn} from '#/app/common';
import type {PrebuiltMessage} from '#/chain/messages/_types';
import {H_SNIP_TRANSACTION_HISTORY_HANDLER} from '#/chain/messages/snip-history';
import type {SecretNetwork} from '#/chain/secret-network';
import {SecretWasm} from '#/crypto/secret-wasm';
import type {NotificationConfig} from '#/extension/notifications';
import {system_notify} from '#/extension/notifications';
import {global_broadcast} from '#/script/msg-global';
import {utility_key_child} from '#/share/account';

import {ATU8_SHA256_STARSHELL, R_SCRT_COMPUTE_ERROR, R_SCRT_QUERY_ERROR} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Incidents} from '#/store/incidents';
import type {Cached} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {Settings} from '#/store/settings';

import type {RateLimitConfig} from '#/store/web-resource-cache';
import {crypto_random_int, ode} from '#/util/belt';
import {
	base58_to_buffer,
	base64_to_buffer,
	buffer_to_base58,
	buffer_to_text,
	buffer_to_uint32_be,
	concat,
	json_to_buffer,
	ripemd160_sync,
	sha256_sync,
	text_to_buffer,
	uint32_to_buffer_be,
	uuid_v4,
} from '#/util/data';
import {RateLimitingPool} from '#/util/rate-limiting-pool';

export type TransferHistoryData = Dict<TransferHistoryItem>;

export type TransferHistoryCache = {
	transfers: TransferHistoryData;
	order: string[];
};

type TokenInfoResponse = Snip20.BaseQueryResponse<'token_info'>;

export class ViewingKeyError extends Error {}

export class ContractQueryError extends Error {
	constructor(protected _sx_plaintext: string) {
		super(`Contract returned error while attempting query: ${_sx_plaintext}`);
	}

	get data(): JsonObject {
		return JSON.parse(this._sx_plaintext);
	}
}

export const Snip2xUtil = {
	validate_token_info(g_token_info: TokenInfoResponse['token_info']): boolean | undefined | void {
		let n_decimals: number = g_token_info.decimals;

		if('number' !== typeof n_decimals) n_decimals = parseInt(n_decimals);

		if(!Number.isInteger(n_decimals) || n_decimals < 0 || n_decimals > 18) {
			return syswarn({
				title: 'Invalid SNIP-20 token info',
				text: `Expected 'decimals' to be an integer between 0 and 18, but contract returned "${g_token_info.decimals}"`,
			});
		}
	},

	async next_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		z_nonce: Uint8Array|string|null=null
	): Promise<string> {
		// generate the token's viewing key
		const atu8_viewing_key = await utility_key_child(g_account, 'secretNetworkKeys', 'snip20ViewingKey', async(atu8_key) => {
			// prep nonce
			let atu8_nonce = z_nonce as Uint8Array;

			// previous is defined
			DERIVE_NONCE:
			if(!(z_nonce instanceof Uint8Array) || 4 !== z_nonce.byteLength) {
				// nonce taken from previous viewing key
				if('string' === typeof z_nonce) {
					const s_previous = z_nonce;

					// previous is starshell format
					if(s_previous?.startsWith(SX_VIEWING_KEY_PREAMBLE)) {
						// attempt to parse
						try {
							// skip preamble
							const sxb58_data = s_previous.slice(SX_VIEWING_KEY_PREAMBLE.length);

							// base58-decode
							const atu8_data = base58_to_buffer(sxb58_data);

							// parse nonce
							const xg_nonce = BigInt(buffer_to_uint32_be(atu8_data));

							// produce new nonce
							atu8_nonce = uint32_to_buffer_be((xg_nonce + 1n) % (1n << 32n));

							// done
							break DERIVE_NONCE;
						}
						catch(e_parse) {}
					}

					// previous has enough entropy to use as source
					if(s_previous.length >= 4) {
						atu8_nonce = sha256_sync(text_to_buffer(s_previous)).subarray(0, 4);
					}
				}

				// derive nonce from random
				atu8_nonce = uint32_to_buffer_be(crypto_random_int(Number(1n << 32n)));
			}

			// import utility key
			const dk_input = await crypto.subtle.importKey('raw', atu8_key, 'HKDF', false, ['deriveBits']);

			// produce token info by concatenating: utf8-enc(caip-10) | nonce
			const [si_namespace, si_reference] = Chains.parsePath(g_token.chain);
			const atu8_info = concat([text_to_buffer(`${si_namespace}:${si_reference}:${g_token.bech32}:`), atu8_nonce]);

			// derive bits
			const ab_viewing_key = await crypto.subtle.deriveBits({
				name: 'HKDF',
				hash: 'SHA-256',
				salt: ATU8_SHA256_STARSHELL,
				info: atu8_info,
			}, dk_input, 256);

			// encode output vieiwng key
			return concat([atu8_nonce, new Uint8Array(ab_viewing_key)]);
		});

		if(!atu8_viewing_key) {
			throw syserr({
				title: 'No viewing key seed',
				text: `Account "${g_account.name}" is missing a Secret WASM viewing key seed.`,
			});
		}

		// base58-encode to create password
		return SX_VIEWING_KEY_PREAMBLE+buffer_to_base58(atu8_viewing_key);
	},
};


export const SX_VIEWING_KEY_PREAMBLE = '🔑1';
export const ATU8_VIEWING_KEY_PREAMBLE = text_to_buffer(SX_VIEWING_KEY_PREAMBLE);
export const NB_VIEWING_KEY_PREAMBLE = ATU8_VIEWING_KEY_PREAMBLE.byteLength;
export const NB_VIEWING_KEY_STARSHELL = ATU8_VIEWING_KEY_PREAMBLE.byteLength + 4 + 32;


export const Snip2xMessageConstructor = {
	async set_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		s_viewing_key: string
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.BaseMessageParameters<'set_viewing_key'> = {
			set_viewing_key: {
				key: s_viewing_key as Cw.ViewingKey,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},

	async generate_viewing_key(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		z_nonce: Uint8Array|string|null=null
	): Promise<PortableMessage> {
		return await Snip2xMessageConstructor.set_viewing_key(
			g_account,
			g_token,
			k_network,
			await Snip2xUtil.next_viewing_key(g_account, g_token, z_nonce)
		);
	},

	async revoke_permit(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		si_permit: string
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip24.BaseMessageParameters = {
			revoke_permit: {
				permit_name: si_permit,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},

	async deposit(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		a_funds: Coin[]
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.NativeMessageParameters<'deposit'> = {
			deposit: {},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash, a_funds);
	},

	async redeem(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		s_amount: Cw.Uint128,
		s_denom?: Cw.String
	): Promise<PortableMessage> {
		// prep snip-20 message
		const g_msg: Snip20.NativeMessageParameters<'redeem'> = {
			redeem: {
				amount: s_amount,
				...s_denom? {denom:s_denom}: {},
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	async mint(
		g_account: AccountStruct,
		g_token: {bech32: Bech32; hash: string; chain: ChainPath},
		k_network: SecretNetwork,
		sa_recipient: Cw.Bech32,
		s_amount: Cw.Uint128
	) {
		const g_msg: Snip20.MintableMessageParameters<'mint'> = {
			mint: {
				amount: s_amount,
				recipient: sa_recipient,
			},
		};

		// prep snip-20 exec
		return await k_network.encodeExecuteContract(g_account, g_token.bech32, g_msg, g_token.hash);
	},
};

export type Snip2xQueryRes<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey> = Promise<Snip2x.AnyQueryResponse<si_key>>;

const GC_DEFAULT_RATE_LIMITS: RateLimitConfig = {
	concurrency: 6,
	capacity: 16,
	resolution: 10e3,
};

const h_limiters: Dict<RateLimitingPool> = {};


/**
 * Queries the given snip
 */
async function query_snip<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey>(
	g_query: Snip2x.AnyQueryParameters<si_key>,
	g_contract: ContractStruct,
	k_network: SecretNetwork,
	g_chain: ChainStruct,
	g_account: AccountStruct
): Snip2xQueryRes<si_key> {
	const g_writeback: {atu8_nonce?: Uint8Array} = {};

	// ref grpc-web URL
	const p_host = k_network.provider.grpcWebUrl;

	// create/ref slots and lock pool
	const k_limiter = h_limiters[p_host] || await (async() => {
		const gc_defaults = await Settings.get('gc_rate_limit_queries_default');
		return h_limiters[p_host] = h_limiters[p_host] || new RateLimitingPool(gc_defaults || GC_DEFAULT_RATE_LIMITS);
	})();

	// wait for an opening
	const f_release = await k_limiter.acquire();

	try {
		return await k_network.queryContract<Snip2x.AnyQueryResponse<si_key>>(g_account, {
			bech32: g_contract.bech32,
			hash: g_contract.hash,
		}, g_query, g_writeback);
	}
	catch(e_query) {
		// ref query nonce
		const atu8_nonce = g_writeback.atu8_nonce;

		// compute error
		if(2 === e_query['code']) {
			// parse contract error
			const m_error = R_SCRT_QUERY_ERROR.exec(e_query['message'] as string || '');

			// able to decrypt
			if(m_error && atu8_nonce) {
				const [, sxb64_error_ciphertext] = m_error;

				const atu8_ciphertext = base64_to_buffer(sxb64_error_ciphertext);

				// use nonce to decrypt
				const atu8_plaintext = await SecretWasm.decryptBuffer(g_account, g_chain, atu8_ciphertext, atu8_nonce);

				// utf-8 decode
				const sx_plaintext = buffer_to_text(atu8_plaintext);

				// throw decrypted error
				throw new ContractQueryError(sx_plaintext);
			}
		}

		throw e_query;
	}
	finally {
		f_release();
	}
}

type DeductionConfig = {
	queries: string[];
	extensions?: Partial<Record<TokenStructKey, DeductionConfig>>;
};

const H_DEDUCTIONS: NonNullable<DeductionConfig['extensions']> = {
	snip20: {
		queries: [
			'token_info',
			'exchange_rate',
			'allowance',
			'balance',
			'transfer_history',
		],
		extensions: {
			snip21: {
				queries: [
					'transaction_history',
				],
			},

			snip24: {
				queries: [
					'with_permit',
				],
			},
		},
	},

	snip721: {
		queries: [
			'contract_info',
			'num_tokens',
			'owner_of',
			'nft_info',
			'all_nft_info',
			'private_metadata',
			'nft_dossier',
			'token_approvals',
			'approved_for_all',
			'inventory_approvals',
			'tokens',
			'transaction_history',
			// 'with_permit',  // allow snip24 interface to separately discover
			'all_tokens',
			'minters',
			'royalty_info',
			'is_unwrapped',
			'verify_transfer_approval',
		],
		extensions: {
			snip722: {
				queries: [
					'implements_token_subtype',
					'nft_dossier',
					'is_transferable',
					'implements_non_transferable_tokens',
				],
			},
		},
	},

	snip1155: {
		queries: [
			'contract_info',
			'token_id_public_info',
			'registered_code_hash',
		],
	},
};

/**
 * Attempt to deduce which interfaces the contract implements
 */
export async function deduce_token_interfaces(
	g_contract: ContractStruct,
	k_network: SecretNetwork,
	g_account: AccountStruct
): Promise<string[]> {
	// destructure chain from network
	const g_chain = k_network.chain;

	// promote the contract's implementation set
	async function _promote(si_interface: Exclude<TokenStructKey, 'snip20'>): Promise<void> {
		g_contract.interfaces[si_interface] = {};
		await Contracts.merge(g_contract);
	}

	// demote the contract's implementation set and exclude the given interface
	async function _demote(si_interface: TokenStructKey): Promise<void> {
		// make set from list of existing excluded
		const as_excluded = new Set<TokenStructKey>(g_contract.interfaces.excluded || []);

		// add interface to excluded set
		as_excluded.add(si_interface);

		// update excluded list on struct
		g_contract.interfaces.excluded = [...as_excluded];

		// remove interface from contract struct if it exists
		delete g_contract.interfaces[si_interface];

		// update contract struct
		await Contracts.merge(g_contract);
	}


	const a_deductions: TokenStructKey[] = [];

	const si_foreign = `__interface_check_${uuid_v4().replaceAll('-', '_').slice(-7)}`;

	// TODO: add simulation to deduce interfaces that do not specify queries

	// attempt transaction history query
	try {
		// @ts-expect-error intentionally foreign query id
		await query_snip({
			[si_foreign]: {},
		}, g_contract, k_network, g_chain, g_account);
	}
	catch(e_info) {
		if(e_info instanceof Error) {
			const m_queries = /unknown variant `([^`]+)`, expected one of ([^"]+)"/.exec(e_info.message);
			if(m_queries) {
				if(si_foreign !== m_queries[1]) {
					throw new Error(`Contract returned suspicious error`);
				}

				// get accepted query ids
				const a_queries = m_queries[2].split(/,\s+/g).map(s => s.replace(/^`|`$/g, ''));

				// each deductable interface
				DEDUCTIONS:
				for(const [si_interface, g_deduction] of ode(H_DEDUCTIONS)) {
					// each query in spec
					for(const si_query of g_deduction!.queries) {
						// query not present in contract
						if(!a_queries.includes(si_query)) {
							// avoid demoting built-in snip-20
							if('snip20' === si_interface) {
								debugger;
							}
							else {
								await _demote(si_interface);
							}

							continue DEDUCTIONS;
						}
					}

					// contract implements all queries in spec (snip20 needs extra data)
					if('snip20' === si_interface) {
						try {
							await Snip2xToken.promoteSnip20(g_contract, k_network, g_account);
						}
						catch(e_discover) {}
					}
					else {
						await _promote(si_interface);
					}

					a_deductions.push(si_interface);
				}
			}
		}
	}

	return a_deductions;
}


export class Snip2xToken {
	static async promoteSnip20(g_contract: ContractStruct, k_network: SecretNetwork, g_account: AccountStruct): Promise<void> {
		// construct token as if it is already snip-20
		const k_token = new Snip2xToken(g_contract, k_network, g_account);

		const {
			_g_contract,
		} = k_token;

		// attempt token info query
		const g_info = (await k_token.tokenInfo()).token_info;

		// passing implies snip-20; update contract
		_g_contract.name = _g_contract.name || g_info.name || '';
		if(_g_contract.name.startsWith('Unknown Contract')) _g_contract.name = g_info.name || '';
		_g_contract.interfaces.snip20 = {
			decimals: g_info.decimals as 0,
			symbol: g_info.symbol,
		};

		await Contracts.merge(_g_contract);
	}

	static async discover(g_contract: ContractStruct, k_network: SecretNetwork, g_account: AccountStruct): Promise<Snip2xToken | null> {
		// construct token as if it is already snip-20
		const k_token = new Snip2xToken(g_contract, k_network, g_account);

		// snip-20 interface not defined
		if(!g_contract.interfaces.snip20) {
			try {
				await Snip2xToken.promoteSnip20(g_contract, k_network, g_account);
			}
			catch(e_promote) {
				return null;
			}
		}

		// discover other snip interfaces
		const a_deductions = await deduce_token_interfaces(g_contract, k_network, g_account);
		if(!a_deductions.includes('snip20')) {
			throw new Error(`Contract does not seem to be a SNIP-20`);
		}

		return k_token;
	}

	static async viewingKeyFor(g_contract: ContractStruct, g_chain: ChainStruct, g_account: AccountStruct): Promise<readonly [Cw.ViewingKey, SecretStruct<'viewing_key'>] | null> {
		const a_keys = await Secrets.filter({
			type: 'viewing_key',
			on: 1,
			contract: g_contract.bech32,
			chain: Chains.pathFrom(g_chain),
			owner: Chains.addressFor(g_account.pubkey, g_chain),
		});

		if(!a_keys?.length) return null;

		return await Secrets.borrowPlaintext(a_keys[0], (kn, g) => [
			buffer_to_text(kn.data) as Cw.ViewingKey,
			g as SecretStruct<'viewing_key'>,
		] as const);
	}

	static from(g_contract: ContractStruct, k_network: SecretNetwork, g_account: AccountStruct): Snip2xToken | null {
		if(!g_contract.interfaces.snip20) return null;

		return new Snip2xToken(g_contract, k_network, g_account);
	}

	protected _g_chain: ChainStruct;

	protected _sa_owner: ''|Cw.Bech32;

	protected _g_snip20: TokenStructDescriptor<'snip20'>['snip20'];

	constructor(protected _g_contract: ContractStruct, protected _k_network: SecretNetwork, protected _g_account: null|AccountStruct) {
		this._g_chain = _k_network.chain;
		this._g_snip20 = _g_contract.interfaces.snip20!;
		this._sa_owner = _g_account? Chains.addressFor(_g_account.pubkey, _k_network.chain) as Cw.Bech32: '';
	}

	get bech32(): Bech32 {
		return this._g_contract.bech32;
	}

	get contract(): ContractStruct {
		return this._g_contract;
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	get account(): null|AccountStruct {
		return this._g_account;
	}

	get owner(): null|Bech32 {
		return this._sa_owner || null;
	}

	get symbol(): string {
		return this._g_snip20.symbol;
	}

	get decimals(): L.UnionOf<N.Range<0, 18>> {
		return this._g_snip20.decimals;
	}

	get coingeckoId(): string | null {
		return this._g_snip20.extra?.coingeckoId || null;
	}

	get snip20(): TokenStructDescriptor['snip21'] {
		return this._g_snip20;
	}

	get snip21(): TokenStructDescriptor['snip21'] | null {
		return this._g_contract.interfaces.snip21 || null;
	}

	get snip22(): TokenStructDescriptor['snip22'] | null {
		return this._g_contract.interfaces.snip22 || null;
	}

	get snip23(): TokenStructDescriptor['snip23'] | null {
		return this._g_contract.interfaces.snip23 || null;
	}

	get snip24(): TokenStructDescriptor['snip24'] | null {
		return this._g_contract.interfaces.snip24 || null;
	}

	protected async _viewing_key_plaintext(): Promise<Cw.ViewingKey> {
		const a_viewing_key = await this.viewingKey();

		if(null === a_viewing_key) {
			throw new Error(`Viewing key is not set or missing for ${Contracts.pathFrom(this._g_contract)}`);
		}

		return a_viewing_key[0];
	}

	// /**
	//  * Checks if the contract implements the SNIP-21 interface
	//  */
	// async checkSnip21(b_force=false): Promise<boolean> {
	// 	const {_g_contract} = this;

	// 	// snip-21 interface defined
	// 	if(_g_contract.interfaces.snip21 && !b_force) return true;

	// 	// attempt transaction history query
	// 	try {
	// 		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	// 		(await this.transactionHistory(1)).transaction_history.total;
	// 	}
	// 	catch(e_info) {
	// 		return false;
	// 	}

	// 	// passing implies snip-21; update contract
	// 	_g_contract.interfaces.snip21 = {};
	// 	await Contracts.merge(_g_contract);

	// 	return true;
	// }


	async mintable(): Promise<boolean> {
		const {
			_g_chain,
			_g_account,
			_g_contract,
			_k_network,
			_g_snip20,
		} = this;

		// prep nonce
		let atu8_nonce!: Uint8Array;

		// attempt to simulate minting
		try {
			const sa_recipient = Chains.addressFor(_g_account.pubkey, _g_chain) as Cw.Bech32;
			const s_amount = BigNumber('1').shiftedBy(_g_snip20.decimals).toString() as Cw.Uint128;

			const g_mint = await Snip2xMessageConstructor.mint(_g_account, _g_contract, _k_network, sa_recipient, s_amount);

			atu8_nonce = base64_to_buffer((g_mint.amino.value as {msg: string}).msg).slice(0, 32);

			// sign
			const {
				auth: atu8_auth,
				signer: g_signer,
			} = await _k_network.authInfoDirect(_g_account, Fee.fromPartial({}));

			// if this does not throw an error, then the token is mintable
			await _k_network.simulate(_g_account, {
				messages: [
					g_mint.proto,
				],
			}, atu8_auth);
		}
		// contract execution threw an error
		catch(e_simulate) {
			// helpful for future remote debugging
			try {
				if(e_simulate instanceof Error && atu8_nonce) {
					console.warn(await _k_network.decryptComputeError(_g_account, e_simulate.message, atu8_nonce));
				}
			}
			catch(e_parse) {}

			// not mintable
			return false;
		}

		// mintable
		return true;
	}

	async query<si_key extends Snip2x.AnyQueryKey=Snip2x.AnyQueryKey>(g_query: Snip2x.AnyQueryParameters<si_key>): Snip2xQueryRes<si_key> {
		return await query_snip<si_key>(g_query, this._g_contract, this._k_network, this._g_chain, this._g_account);
	}

	viewingKey(): Promise<readonly [Cw.ViewingKey, SecretStruct<'viewing_key'>] | null> {
		return Snip2xToken.viewingKeyFor(this._g_contract, this._g_chain, this._g_account);
	}

	tokenInfo(): Snip2xQueryRes<'token_info'> {
		return this.query({
			token_info: {},
		});
	}

	async balance(): Snip2xQueryRes<'balance'> {
		const g_balance = await this.query({
			balance: {
				address: this._sa_owner,
				key: await this._viewing_key_plaintext(),
			},
		});

		// save to query cache
		await this.writeCache('balance', g_balance.balance);

		return g_balance;
	}

	readCache<w_return>(si_key: string): Promise<Cached<w_return> | null> {
		return this._k_network.readQueryCache(this._sa_owner, `${this._g_contract.bech32}:${si_key}`);
	}

	writeCache(si_key: string, g_data: JsonObject): Promise<void> {
		return this._k_network.saveQueryCache(this._sa_owner, `${this._g_contract.bech32}:${si_key}`, g_data, Date.now());
	}

	async transferHistory(nl_page_size=16): Snip2xQueryRes<'transfer_history'> {
		nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));

		// read from cache
		const g_cache = await this.readCache<TransferHistoryCache>('transfer_history');

		// new transfer cache
		const h_trs: TransferHistoryData = g_cache?.data?.transfers || {};
		const a_order = g_cache?.data?.order || [];

		// count number of new trs
		let c_new = 0;

		// page index
		let i_page = 0;

		// number of transfers total
		let nl_total: number | undefined = 0;

		// collect notifications
		const a_notifs: NotificationConfig[] = [];

		// loop while there are more pages
		for(;;) {
			// query for latest
			const g_response = await this.query({
				transfer_history: {
					address: this._sa_owner,
					key: await this._viewing_key_plaintext(),
					page_size: nl_page_size as Cw.WholeNumber,
					page: i_page as Cw.WholeNumber,
				},
			});

			// destructure transfer history response
			const g_history = g_response.transfer_history || {
				total: 0,
				txs: [],
			};

			// update total
			nl_total = g_history.total;
			if('number' !== typeof nl_total) nl_total = Infinity;

			// each item in this response
			for(const g_tx of g_history.txs) {
				// hash tx
				const si_tx = buffer_to_base58(ripemd160_sync(sha256_sync(json_to_buffer(g_tx))));

				// item already exists in cache; skip
				if(si_tx in h_trs) continue;

				// new item
				h_trs[si_tx] = g_tx;
				a_order.push(si_tx);
				c_new++;

				// push to notif
				const gc_notif = await this._handle_new_transfer(g_tx, si_tx);
				if(gc_notif) a_notifs.push(gc_notif);
			}

			// total count in cache
			const nl_cached = a_order.length;

			// more items in history and result was full
			if(nl_cached < nl_total && g_history.txs.length === nl_page_size) {
				i_page += 1;
				continue;
			}

			// done
			break;
		}

		// commit cache
		await this.writeCache('transfer_history', {
			transfers: h_trs,
			order: a_order,
		});

		// trigger notifications
		if(a_notifs.length) {
			// TODO: group multiple inbound transfers
			for(const gc_notif of a_notifs) {
				void system_notify(gc_notif);
			}
		}

		// return complete cache
		return {
			transfer_history: {
				total: a_order.length as Cw.WholeNumber,
				txs: a_order.reverse().map((si_tx: string) => h_trs[si_tx]),
			},
		};
	}


	async transactionHistory(nl_page_size=16): Snip2xQueryRes<'transaction_history'> {
		if(!this.snip21) throw new Error(`'transaction_history' not available on non SNIP-21 contract`);

		type TransactionHistoryCache = Dict<TransactionHistoryItem>;

		nl_page_size = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, nl_page_size));

		// read from cache
		const g_cache = await this.readCache<TransactionHistoryCache>('transaction_history');

		// new tx cache
		const h_txs: TransactionHistoryCache = {...g_cache?.data};

		// count number of new txs
		let c_new = 0;

		// page index
		let i_page = 0;

		// number of transactions total
		let nl_total = 0;

		// collect notifications
		const a_notifs: NotificationConfig[] = [];

		// loop while there are more pages
		for(;;) {
			// query for latest
			const g_response = await this.query({
				transaction_history: {
					address: this._sa_owner,
					key: await this._viewing_key_plaintext(),
					page_size: nl_page_size as Cw.WholeNumber,
					page: i_page as Cw.WholeNumber,
				},
			});

			// destructure transaction history response
			const g_history = g_response.transaction_history || {
				total: 0,
				txs: [],
			};

			// update total
			nl_total = g_history.total;

			// each item in this response
			for(const g_tx of g_history.txs) {
				// hash tx
				const si_tx = buffer_to_base58(ripemd160_sync(sha256_sync(json_to_buffer(g_tx))));

				// item already exists in cache; skip
				if(si_tx in h_txs) continue;

				// new item
				h_txs[si_tx] = g_tx;
				c_new++;

				// push to notif
				const g_transfer = g_tx.action?.transfer;
				if(g_transfer) {
					const gc_notif = await this._handle_new_transfer({
						from: g_transfer.from,
						receiver: g_transfer.recipient,
						coins: g_tx.coins,
						block_time: g_tx.block_time,
						memo: g_tx.memo,
					}, si_tx);
					if(gc_notif) a_notifs.push(gc_notif);
				}
			}

			// total count in cache
			const nl_cached = Object.keys(h_txs).length;

			// more items in history and result was full
			if(nl_cached < nl_total && g_history.txs.length === nl_page_size) {
				i_page += 1;
				continue;
			}

			// done
			break;
		}

		// commit cache
		await this.writeCache('transaction_history', h_txs);

		// trigger notifications
		if(a_notifs.length) {
			// TODO: group multiple inbound transfers
			for(const gc_notif of a_notifs) {
				void system_notify(gc_notif);
			}
		}

		// return complete cache
		return {
			transaction_history: {
				total: nl_total as Cw.WholeNumber,
				txs: ode(h_txs).sort(([si_a, g_a], [si_b, g_b]) => {
					const n_block_diff = g_b.block_height - g_a.block_height;
					if(n_block_diff) return n_block_diff;

					if('number' === typeof g_b.id && 'number' === typeof g_a.id) return g_b.id - g_a.id;

					return si_a < si_b? -1: 1;
				}).map(([, g]) => g),
			},
		};
	}

	async _handle_new_transfer(g_transfer: TransferHistoryItem, si_tx: string): Promise<NotificationConfig | void> {
		const {
			_sa_owner,
			_g_snip20,
			_g_chain,
			_g_account,
			_g_contract,
		} = this;

		// incoming transfer
		if(_sa_owner === g_transfer.receiver) {
			const g_handled = await H_SNIP_TRANSACTION_HISTORY_HANDLER.transfer(g_transfer, {
				g_snip20: _g_snip20,
				g_contract: _g_contract,
				g_chain: _g_chain,
				g_account: _g_account,
			});

			const p_incident = await Incidents.record({
				type: 'token_in',
				data: {
					chain: _g_contract.chain,
					account: Accounts.pathFrom(_g_account),
					bech32: _g_contract.bech32,
					hash: si_tx,
				},
				time: g_transfer.block_time || Date.now(),
			});

			// broadcast event
			global_broadcast({
				type: 'fungibleReceived',
				value: {
					p_chain: _g_contract.chain,
					sa_recipient: _sa_owner,
					sa_contract: _g_contract.bech32,
				},
			});

			const g_notif = await g_handled?.apply?.();
			if(g_notif) {
				return {
					id: `@incident:${p_incident}`,
					incident: p_incident,
					item: g_notif,
				};
			}
		}
	}

	execute(g_msg: Snip2x.AnyMessageParameters): Promise<PrebuiltMessage> {
		return this._k_network.encodeExecuteContract(this._g_account, this._g_contract.bech32, g_msg, this._g_contract.hash);
	}

	async transfer(xg_amount: bigint, sa_recipient: Bech32, s_memo=''): Promise<PrebuiltMessage> {
		// prep snip-20 message
		const g_msg: Snip2x.AnyMessageParameters<'transfer'> = {
			transfer: {
				amount: xg_amount+'' as Cw.Uint128,
				recipient: sa_recipient as Cw.Bech32,
				memo: s_memo as Cw.String || void 0,
			},
		};

		// prep snip-20 exec
		return await this.execute(g_msg);
	}

	async exchangeRate(): Snip2xQueryRes<'exchange_rate'> {
		return this.query({
			exchange_rate: {},
		});
	}
}
