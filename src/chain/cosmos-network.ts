import type {SignedDoc} from './signing';
import type {AminoMsg} from '@cosmjs/amino';
import type {QueryBalanceResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/query';
import type {StringEvent, TxResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/abci/v1beta1/abci';
import type {GetLatestBlockResponse, GetNodeInfoResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import type {Grant} from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/feegrant';
import type {Proposal, TallyResult} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';
import type {ParamChange} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/params';
import type {
	QueryParamsRequest as ParamsQueryConfig} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/query';
import type {
	Params,
	Pool,
	RedelegationResponse,
	UnbondingDelegation} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/staking';
import type {
	GetTxsEventResponse,
	BroadcastTxResponse,
	GetTxResponse,
	SimulateResponse,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';


import type {ModeInfo, Tx} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';

import type {
	CodeInfoResponse,
	ContractInfoWithAddress} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';

import type {O} from 'ts-toolbelt';

import type {AccountPath, AccountStruct} from '#/meta/account';
import type {AppPath} from '#/meta/app';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {
	Bech32,
	ChainPath,
	HoldingPath,
	ChainStruct,
	ContractStruct,
} from '#/meta/chain';

import type {Cw} from '#/meta/cosm-wasm';
import type {
	Incident,
	IncidentStruct,
	IncidentType,
	MsgEventRegistry,
	TxError,
	TxModeInfo,
	TxPending,
	TxSynced,
} from '#/meta/incident';
import type {ProviderStruct} from '#/meta/provider';

import type {AdaptedStdSignDoc, GenericAminoMessage} from '#/schema/amino';

import {QueryClientImpl as AppQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/app/v1alpha1/query';
import {BaseAccount} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/auth';
import {QueryClientImpl as AuthQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/query';
import {
	GrpcWebImpl,
	QueryClientImpl as BankQueryClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/query';

import {ServiceClientImpl as NodeServiceClient} from '@solar-republic/cosmos-grpc/dist/cosmos/base/node/v1beta1/query';
import {ServiceClientImpl as TendermintServiceClient} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';
import {PubKey} from '@solar-republic/cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';
import {BasicAllowance, PeriodicAllowance} from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/feegrant';
import {
	QueryClientImpl as FeeGrantQueryClient,
} from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/query';

import {QueryClientImpl as GovQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/query';
import {QueryClientImpl as ParamsQueryClient} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/query';
import {QueryClientImpl as StakingQueryClient, QueryParamsResponse, QueryPoolResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/query';

import {
	BondStatus, bondStatusToJSON,
	Redelegation,
	type DelegationResponse,
	type Validator,
} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/staking';
import {SignMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';
import {
	ServiceClientImpl as TxServiceClient,
	OrderBy,
	BroadcastMode,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
import {Fee, AuthInfo, TxBody, TxRaw} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import {MsgClientImpl as ExecContractClient} from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/tx';

import {QueryClientImpl as ComputeQueryClient} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/query';
import {grpc} from '@solar-republic/grpc-web';

import BigNumber from 'bignumber.js';

import {amino_to_base, encode_proto} from './cosmos-msgs';
import {SecretNetwork} from './secret-network';
import {sign_direct_doc} from './signing';

import {syserr} from '#/app/common';

import type {WsTxResponse} from '#/cosmos/tm-json-rpc-ws-def';
import {Secp256k1Key} from '#/crypto/secp256k1';
import {wgrpc_retry} from '#/extension/network';
import {RT_UINT, XG_SYNCHRONIZE_PAGINATION_LIMIT} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains, TransactionNotFoundError} from '#/store/chains';
import {Entities} from '#/store/entities';
import {Histories, Incidents} from '#/store/incidents';
import type {
	BalanceBundle,
	Cached,
	E2eInfo} from '#/store/providers';
import {
	MultipleSignersError,
	NetworkTimeoutError,
	UnpublishedAccountError,
	WrongKeyTypeError,
} from '#/store/providers';
import {QueryCache} from '#/store/query-cache';
import {
	fodemtv,
	oderom,
	timeout,
	with_timeout,
} from '#/util/belt';



import {buffer_to_base64, buffer_to_base93, buffer_to_hex, sha256_sync_insecure} from '#/util/data';



export type IncidentTx = Incident.Struct<'tx_in' | 'tx_out'>;

export interface TypedEvent {
	type: 'transfer' | 'message' | 'coin_spent' | 'coin_received' | 'use_feegrant' | 'set_feegrant';
	attributes: {
		key: string;
		value: string;
	}[];
}

export interface AminoTxConfig {
	account: AccountStruct;
	messages: GenericAminoMessage[];
}

export interface TxConfig {
	chain: ChainStruct;
	msgs: Any[];
	memo: string;
	gasLimit: bigint;
	gasFee: Coin | {
		price: number | string | BigNumber;
	};
	account: AccountStruct;
	mode: BroadcastMode;
}

export interface BroadcastConfig {
	body: Uint8Array;
	auth: Uint8Array;
	signature: Uint8Array;
	mode?: BroadcastMode;
}

export interface ModWsTxResult extends WsTxResponse {
	hash: string;
}

export function fold_attrs<w_out extends object=Dict>(g_event: TypedEvent | StringEvent): w_out {
	// reduce into dict of sets
	const h_pre: Dict<Set<string>> = {};
	for(const g_attr of g_event.attributes) {
		(h_pre[g_attr.key] = h_pre[g_attr.key] || new Set()).add(g_attr.value);
	}

	// convert to strings or lists
	return fodemtv(h_pre, (as_values) => {
		const a_values = [...as_values];

		// single item
		if(1 === a_values.length) return a_values[0];

		// multiple items
		return a_values;
	}) as w_out;
}


function convert_mode_info(g_info: ModeInfo): TxModeInfo {
	if(g_info.multi) {
		return {
			multi: {
				bitarray: Array.from(g_info.multi.bitarray!.elems).reduce((s, xb) => s+xb.toString(2).padStart(8, '0'), '')
					.slice(0, -g_info.multi.bitarray!.extraBitsStored),
				modeInfos: g_info.multi.modeInfos.map(convert_mode_info),
			},
		};
	}

	return g_info as TxModeInfo;
}

interface FetchedTxConfig {
	g_chain: ChainStruct;
	p_chain: ChainPath;
	p_account: AccountPath;
	si_txn: string;
	g_tx: Tx;
	g_result: TxResponse;
	p_app?: AppPath | null;
	h_events?: Partial<MsgEventRegistry>;
}

function fetched_tx_to_synced_record(gc_fetched: FetchedTxConfig): TxSynced {
	const {
		g_tx,
		g_result,
		si_txn,
		p_chain,
		p_account,
		p_app,
		h_events,
	} = gc_fetched;

	const h_events_merged = h_events || {};

	for(const g_log_msg of g_result.logs) {
		for(const g_event of g_log_msg.events) {
			const si_event = g_event.type;

			(h_events_merged[si_event] = h_events_merged[si_event] || []).push(fold_attrs(g_event));
		}
	}

	return {
		stage: 'synced',
		app: p_app || null,
		chain: p_chain,
		account: p_account,
		hash: si_txn,
		code: g_result.code,
		raw_log: g_result.rawLog,
		fiats: {},
		events: h_events_merged,

		height: g_result.height as Cw.Uint128,
		timestamp: g_result.timestamp as Cw.String,
		gas_used: g_result.gasUsed as Cw.Uint128,
		gas_wanted: g_result.gasWanted as Cw.Uint128,

		// serialize proto messages
		msgs: g_tx.body?.messages.map(g => ({
			typeUrl: g.typeUrl,
			value: buffer_to_base93(g.value),
		})) || [],

		// authInfo
		...g_tx.authInfo
			? (g_auth => ({
				// fee
				...g_auth.fee
					? (g_fee => ({
						fee_amounts: g_fee.amount as Cw.Coin[],
						gas_limit: g_fee.gasLimit as Cw.Uint128,
						payer: g_fee.payer as Cw.Bech32,
						granter: g_fee.granter as Cw.Bech32,
					}))(g_auth.fee)
					: {
						gas_limit: '' as Cw.Uint128,
					},

				// signerInfos
				signers: g_auth.signerInfos.map(g_signer => ({
					pubkey: buffer_to_base64(g_signer.publicKey?.value || new Uint8Array(0)),
					sequence: g_signer.sequence as Cw.Uint128,
					mode_info: convert_mode_info(g_signer.modeInfo!),
				})),
			}))(g_tx.authInfo)
			: {
				gas_limit: '' as Cw.Uint128,
			},

		memo: g_tx.body?.memo || '',
	};
}


/**
 * Signing information for a single signer that is not included in the transaction.
 *
 * @see https://github.com/cosmos/cosmos-sdk/blob/v0.42.2/x/auth/signing/sign_mode_handler.go#L23-L37
 */
export interface SignerData {
	readonly accountNumber: bigint;
	readonly sequence: bigint;
	readonly chainId: string;
}

export interface JsonMsgSend extends JsonObject {
	fromAddress: string;
	toAddress: string;
	amount: Cw.Coin[];
}

export interface PendingSend extends JsonObject {
	chain: ChainPath;
	hash: string;
	owner: Bech32;
	coin: string;
	msg: JsonMsgSend;
	raw: string;
}

type KnownAllowancetype = 'BasicAllowance' | 'PeriodicAllowance';
export type DecodedAllowance = O.Merge<{
	allowance: {
		type: 'BasicAllowance';
		value: BasicAllowance;
	} | {
		type: 'PeriodicAllowance';
		value: PeriodicAllowance;
	};
}, Grant>;


async function _depaginate<
	g_row extends {},
	g_response extends {
		pagination?: {
			nextKey: Uint8Array;
			total: string;
		};
	},
>(n_limit: number, fk_each: (g_pagination: {
	limit: string;
	reverse?: boolean;
} & ({
	key: Uint8Array;
} | {
	offset: string;
})) => Promise<[g_response, (a: g_row[]) => g_row[]]>): Promise<g_row[]> {
	let atu8_key: Uint8Array | undefined = void 0;
	const i_offset = 0;
	let a_rows: g_row[] = [];

	for(;;) {
		const [g_response, f_merge] = await fk_each({
			limit: ''+n_limit,
			reverse: false,
			...atu8_key
				? {key:atu8_key}
				: {offset:''+i_offset},
		});

		atu8_key = g_response.pagination?.nextKey;
		a_rows = f_merge(a_rows);

		if(!atu8_key) break;
	}

	return a_rows;
}

export class CosmosNetwork {
	protected readonly _p_chain: ChainPath;
	protected readonly _y_grpc: GrpcWebImpl;
	protected _ks_cache: Awaited<ReturnType<typeof QueryCache.read>>;

	constructor(protected readonly _g_provider: ProviderStruct, protected readonly _g_chain: ChainStruct) {
		this._p_chain = Chains.pathFrom(_g_chain);

		this._y_grpc = new GrpcWebImpl(_g_provider.grpcWebUrl, {
			// transport: grpc.CrossBrowserHttpTransport({
			// 	withCredentials: false,
			// }),
			transport: grpc.FetchReadableStreamTransport({
				keepalive: true,
				credentials: 'omit',
			}),
		});

		void this.reloadCached();
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	protected async _update_balance(
		sa_owner: Bech32,
		si_coin: string,
		g_balance: Coin,
		xt_when: number
	): Promise<[HoldingPath, Cached<Coin> | null]> {
		// read from cache
		const g_cached = (this._ks_cache || await this.reloadCached()).get(this._p_chain, sa_owner, si_coin);

		// update cache
		await this.saveQueryCache(sa_owner, si_coin, JSON.parse(JSON.stringify(g_balance)) as JsonObject, xt_when);

		// return updated balance and cached
		const p_holding = Entities.holdingPathFor(sa_owner, si_coin, this._p_chain);
		return [p_holding, g_cached];
	}

	async saveQueryCache(sa_owner: Bech32, si_key: string, g_data: JsonObject, xt_when: number): Promise<void> {
		// update cache
		await QueryCache.open(async(ks_cache) => {
			// update entry
			await ks_cache.set(this._p_chain, sa_owner, si_key, {
				timestamp: xt_when,
				data: g_data,
			});

			// reset cached store instance
			this._ks_cache = ks_cache;
		});
	}

	async readQueryCache(sa_owner: Bech32, si_key: string): Promise<Cached | null> {
		const ks_cache = await QueryCache.read();

		return ks_cache.get(this._p_chain, sa_owner, si_key);
	}

	async signerData(sa_sender: string): Promise<SignerData> {
		// get account data
		const g_response = await wgrpc_retry(() => new AuthQueryClient(this._y_grpc).account({
			address: sa_sender,
		}));

		// destructure response
		const {
			typeUrl: si_type,
			value: atu8_data,
		} = g_response?.account || {};

		// not found
		if(!si_type) {
			throw new Error(`Account for ${sa_sender} was not found on chain. Likely has zero balance.`);
		}
		else if(si_type !== '/cosmos.auth.v1beta1.BaseAccount') {
			throw new Error(`Cannot sign with account of type "${si_type}", can only sign with BaseAccount.`);
		}

		// decode data
		const g_account = BaseAccount.decode(atu8_data!);

		return {
			chainId: this._g_chain.reference,
			accountNumber: BigInt(g_account.accountNumber),
			sequence: BigInt(g_account.sequence),
		};
	}

	async reloadCached(): Promise<typeof this._ks_cache> {
		return this._ks_cache = await QueryCache.read();
	}

	async latestBlock(): Promise<GetLatestBlockResponse> {
		return await wgrpc_retry(() => new TendermintServiceClient(this._y_grpc).getLatestBlock({}));
	}

	cachedCoinBalance(sa_owner: Bech32, si_asset: string): Cached<Coin> | null {
		if(!this._ks_cache) return null;

		return this._ks_cache.get(this._p_chain, sa_owner, si_asset);
	}

	async bankBalance(sa_owner: Bech32, si_coin?: string, xt_age=0): Promise<BalanceBundle> {
		// normalize coin id
		si_coin = si_coin || Object.keys(this._g_chain.coins)[0];

		// cache attempt
		try {
			// read cache
			const g_cached = this.cachedCoinBalance(sa_owner, si_coin);

			// cache exists and is within age limit
			if(g_cached && Date.now() - g_cached?.timestamp <= xt_age) {
				return {
					balance: g_cached.data,
					cached: g_cached,
					holding: Entities.holdingPathFor(sa_owner, si_coin, this._p_chain),
				};
			}
		}
		// ignore cache failure
		catch(e_cached) {}

		// prep balance response
		let g_response!: QueryBalanceResponse;

		// acquire lock before loading balance
		await navigator.locks.request(`net:balance:${si_coin}:${sa_owner}:${this._p_chain}`, async() => {
			// no response cache; query balance
			g_response = await wgrpc_retry(() => new BankQueryClient(this._y_grpc).balance({
				address: sa_owner,
				denom: this._g_chain.coins[si_coin!].denom,
			}));
		});

		// destructure response
		const {
			balance: g_balance,
		} = g_response;

		// no response
		if(!g_balance) {
			throw new Error(`Failed to fetch balance`);
		}

		// TODO: refactor `_update_balance`

		// return updated balance
		const [p_holding, g_cached] = await this._update_balance(sa_owner, si_coin, g_balance, Date.now());
		return {
			balance: g_balance,
			cached: g_cached,
			holding: p_holding,
		} as BalanceBundle;
	}

	async bankBalances(sa_owner: Bech32): Promise<Dict<BalanceBundle>> {
		const xt_req = Date.now();

		const g_response = await wgrpc_retry(() => new BankQueryClient(this._y_grpc).allBalances({
			address: sa_owner,
		}));

		const {
			balances: a_balances,
		} = g_response;

		// ref coins
		const h_coins = this._g_chain.coins;

		// create lookup table for denoms
		const h_denoms = oderom(h_coins, (si_coin, g_coin) => ({
			[g_coin.denom]: si_coin,
		}));

		// prep outputs
		const h_outs: Dict<BalanceBundle> = {};

		// each returned balance
		for(const g_balance of a_balances) {
			// lookup coin
			const si_coin = h_denoms[g_balance.denom];
			const g_coin = h_coins[si_coin];

			// add tuple to dict
			const [p_holding, g_cached] = await this._update_balance(sa_owner, si_coin, g_balance, xt_req);
			h_outs[si_coin] = {
				balance: g_balance,
				cached: g_cached,
				holding: p_holding,
			} as BalanceBundle;
		}

		return h_outs;
	}

	// async contractTransactionCount(g_contract: ContractStruct, s_limit='1'): Promise<void> {
	// 	const g_count = await new TxServiceClient(this._y_grpc).getTxsEvent({
	// 		events: [`wasm.contract_address='${g_contract.bech32}'`],
	// 		limit: s_limit,
	// 	});

	// 	debugger;
	// 	console.log(g_count.total);
	// }

	async feeGrants(sa_owner: Bech32): Promise<DecodedAllowance[]> {
		const g_response = await wgrpc_retry(() => new FeeGrantQueryClient(this._y_grpc).allowances({
			grantee: sa_owner,
		}));

		const {
			allowances: a_allowances,
		} = g_response;

		const a_grants: DecodedAllowance[] = [];

		for(const g_allowance of a_allowances) {
			const g_allowance_item = g_allowance.allowance;
			if(!g_allowance_item) continue;

			const m_type = /^\/cosmos\.feegrant\.v1beta1\.(.+)$/.exec(g_allowance_item.typeUrl);

			if(!m_type || !['BasicAllowance', 'PeriodicAllowance'].includes(m_type[1])) continue;

			const si_type = m_type[1] as KnownAllowancetype;

			const H_ALLOWANCE_TYPES = {
				BasicAllowance,
				PeriodicAllowance,
			};

			a_grants.push({
				grantee: g_allowance.grantee,
				granter: g_allowance.granter,
				allowance: {
					type: si_type,
					value: H_ALLOWANCE_TYPES[si_type].decode(g_allowance_item.value),
				},
			});
		}

		return a_grants;
	}

	get provider(): ProviderStruct {
		return this._g_provider;
	}

	get hasRpc(): boolean {
		return !!this._g_provider.rpcHost;
	}

	listen(a_events: string[], fke_receive: (d_kill: Event | null, g_value?: JsonObject, si_txn?: string) => Promisable<void>): Promise<() => void> {
		return new Promise((fk_resolve) => {
			const p_host = this._g_provider.rpcHost;

			if(!p_host) throw new Error('Cannot subscribe to events; no RPC host configured on network');

			const d_ws = new WebSocket(`wss://${p_host}/websocket`);

			d_ws.onopen = (d_event) => {
				d_ws.send(JSON.stringify({
					jsonrpc: '2.0',
					method: 'subscribe',
					id: '0',
					params: {
						query: a_events.join(' AND '),
					},
				}));

				fk_resolve(() => {
					b_user_closed = true;
					d_ws.close();
				});
			};

			d_ws.onmessage = (d_event: MessageEvent<string>) => {
				const g_msg = JSON.parse(d_event.data || '{}');

				const g_value = g_msg?.result?.data?.value;

				const si_txn = (g_msg?.result?.events?.['tx.hash']?.[0] as string || '').toUpperCase();

				if(g_value) {
					void fke_receive(null, g_value as JsonObject, si_txn);
				}
			};

			let b_user_closed = false;
			d_ws.onclose = (d_event) => {
				if(!b_user_closed) {
					void fke_receive(d_event);
				}
			};

			d_ws.onerror = (d_event) => {
				void fke_receive(d_event);
			};
		});
	}

	async e2eInfoFor(sa_other: Bech32, s_height_max=''): Promise<E2eInfo> {
		return await with_timeout({
			duration: 10e3,
			trip: () => new NetworkTimeoutError(),
			run: async() => {
				const g_response = await wgrpc_retry(() => new TxServiceClient(this._y_grpc).getTxsEvent({
					events: [
						`message.sender='${sa_other}'`,
						...s_height_max? [`block.height<${s_height_max}`]: [],
					],
					pagination: {
						limit: '1',
					},
					orderBy: OrderBy.ORDER_BY_DESC,
				}));

				if(!g_response?.txs?.length) {
					throw new UnpublishedAccountError(sa_other, this._g_chain);
				}

				const a_signers = g_response.txs[0].authInfo!.signerInfos;
				if(1 !== a_signers.length) {
					throw new MultipleSignersError(sa_other, this._g_chain);
				}

				const {
					typeUrl: si_pubkey_type,
					value: atu8_pubkey_35,
				} = a_signers[0].publicKey!;

				if('/cosmos.crypto.secp256k1.PubKey' !== si_pubkey_type) {
					throw new WrongKeyTypeError(sa_other, this._g_chain);
				}

				// ensure the module is initialized
				await Secp256k1Key.init();

				return {
					sequence: a_signers[0].sequence,
					height: g_response.txResponses[0].height,
					hash: g_response.txResponses[0].txhash,
					// priorSequence: a_signers[1]?.sequence,
					// priorHeight: g_response.txResponses[1]?.height,
					// priorHash: g_response.txResponses[1]?.txhash,
					pubkey: Secp256k1Key.uncompressPublicKey(atu8_pubkey_35.subarray(2)),
				};
			},
		});
	}

	async isContract(sa_account: string): Promise<boolean> {
		const g_response = await wgrpc_retry(() => new TxServiceClient(this._y_grpc).getTxsEvent({
			events: [
				`message.contract_address='${sa_account}'`,
			],
			orderBy: OrderBy.ORDER_BY_ASC,
			pagination: {
				limit: '1',
			},
		}));

		return g_response.txResponses.length > 0;
	}

	packAmino(g_amino: AdaptedStdSignDoc, atu8_auth: Uint8Array, atu8_signature: Uint8Array): ReturnType<CosmosNetwork['finalizeTxRaw']> {
		const atu8_body = encode_proto(TxBody, {
			messages: g_amino.msgs.map(g => amino_to_base(g).encode()),
			memo: g_amino.memo,
		});

		return this.finalizeTxRaw({
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
		});
	}

	async signDirectAndBroadcast(gc_tx: TxConfig): Promise<[TxResponse, Uint8Array]> {
		const {
			chain: g_chain,
			msgs: a_msgs,
			memo: s_memo,
			gasLimit: xg_gas_limit,
			gasFee: gc_fee,
			account: g_account,
			mode: xc_mode,
		} = gc_tx;

		// prep gas fee data
		let {
			amount: s_gas_fee_amount,
			denom: s_denom,
		} = gc_fee as Coin;

		// create gas fee from gas price and gas limit
		if(gc_fee['price']) {
			// compute the gas fee amount based on gas price and gas limit
			s_gas_fee_amount = new BigNumber(gc_fee['price'] as BigNumber).times(xg_gas_limit.toString()).toString();

			// use default native coin
			s_denom = Object.values(g_chain.coins)[0].denom;
		}

		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// encode txn body
		const atu8_body = encode_proto(TxBody, {
			messages: a_msgs,
			memo: s_memo,
		});

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_DIRECT,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: {
				amount: [{
					amount: s_gas_fee_amount,
					denom: s_denom,
				}],
				gasLimit: xg_gas_limit+'',
			},
		});

		// produce signed doc bytes
		const {signature:atu8_signature} = await sign_direct_doc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);

		return this.broadcastDirect({
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
			mode: xc_mode,
		});
	}

	finalizeTxRaw(gc_tx: BroadcastConfig): {atu8_tx: Uint8Array; sxb16_hash: string} {
		// deststructure args
		const {
			body: atu8_body,
			auth: atu8_auth,
			signature: atu8_signature,
		} = gc_tx;

		// produce txn raw bytes
		const atu8_tx = encode_proto(TxRaw, {
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		});

		return {
			atu8_tx,
			sxb16_hash: buffer_to_hex(sha256_sync_insecure(atu8_tx)).toUpperCase(),
		};
	}

	async broadcastDirect(gc_broadcast: BroadcastConfig): Promise<[TxResponse, Uint8Array]> {
		const {
			atu8_tx,
			sxb16_hash,
		} = this.finalizeTxRaw(gc_broadcast);

		// deststructure args
		const {
			mode: xc_mode=BroadcastMode.BROADCAST_MODE_SYNC,
		} = gc_broadcast;

		// prep response
		let g_response: BroadcastTxResponse;

		// depending on broadcast mode
		switch(xc_mode) {
			// sync mode
			case BroadcastMode.BROADCAST_MODE_SYNC: {
				g_response = await wgrpc_retry(() => new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_tx,
					mode: BroadcastMode.BROADCAST_MODE_SYNC,
				}));
				break;
			}

			// async mode
			case BroadcastMode.BROADCAST_MODE_ASYNC: {
				g_response = await wgrpc_retry(() => new TxServiceClient(this._y_grpc).broadcastTx({
					txBytes: atu8_tx,
					mode: BroadcastMode.BROADCAST_MODE_ASYNC,
				}));
				break;
			}

			default: {
				throw new Error(`Invalid broadcast mode: ${xc_mode}`);
			}
		}

		// console.debug(`Broadcast tx response: %o`, g_response);

		// if(!si_txn) {
		// 	throw syserr({
		// 		title: 'Provider Error',
		// 		text: `The ${this._g_provider.name} provider node failed to broadcast your transaction.`,
		// 	});
		// }

		return [g_response.txResponse!, atu8_tx];
	}

	// async fetchParams() {
	// 	const g_response = await new AuthQueryClient(this._y_grpc).params({});

	// 	const {
	// 		maxMemoCharacters: nl_memo_chars_max,
	// 		txSizeCostPerByte: n_cost_per_byte,
	// 	} = g_response.params!;
	// }


	async networkParam(gc_params: ParamsQueryConfig): Promise<ParamChange | undefined> {
		const g_response = await wgrpc_retry(() => new ParamsQueryClient(this._y_grpc).params(gc_params));

		return g_response.param;
	}

	async proposal(si_proposal: string): Promise<Proposal | undefined> {
		const g_response = await wgrpc_retry(() => new GovQueryClient(this._y_grpc).proposal({
			proposalId: si_proposal,
		}));

		return g_response?.proposal;
	}


	async tallyResult(si_proposal: string): Promise<TallyResult | undefined> {
		const g_response = await wgrpc_retry(() => new GovQueryClient(this._y_grpc).tallyResult({
			proposalId: si_proposal,
		}));

		return g_response.tally;
	}

	fetchTx(si_txn: string): Promise<GetTxResponse> {
		return wgrpc_retry(() => new TxServiceClient(this._y_grpc).getTx({
			hash: si_txn,
		}));
	}

	async downloadTxn(si_txn: string, p_account: AccountPath, p_app?: AppPath | null, h_events?: Partial<MsgEventRegistry>): Promise<TxSynced> {
		// download txn
		let g_response: GetTxResponse;
		try {
			g_response = await this.fetchTx(si_txn);
		}
		catch(e_fetch) {
			if(e_fetch instanceof Error) {
				if(e_fetch.message.includes('tx not found')) {
					throw new TransactionNotFoundError();
				}
			}

			throw e_fetch;
		}

		// validate response
		if(!g_response?.tx || !g_response?.txResponse) {
			throw syserr({
				title: 'Transaction not fonud',
				text: `Transaction ${si_txn} was not found`,
			});
		}

		// destructure response
		const {
			tx: g_tx,
			txResponse: g_result,
		} = g_response;

		// convert to synced record struct
		return fetched_tx_to_synced_record({
			g_tx,
			g_result,
			p_app: p_app || Apps.pathFrom(G_APP_EXTERNAL),
			p_chain: this._p_chain,
			g_chain: this._g_chain,
			p_account,
			si_txn,
			h_events: h_events || {},
		});
	}

	async* synchronize(
		si_type: IncidentType,
		a_events: string[],
		p_account: AccountPath,
		g_latest: GetLatestBlockResponse|null=null
	): AsyncIterableIterator<{
		g_tx: Tx;
		g_result: TxResponse;
		g_synced: TxSynced | TxError;
		xg_previous: bigint;
	}> {
		// create sync id
		const si_sync = a_events.join('\n');

		// fetch latest sync height
		const xg_synced = await Histories.syncHeight(this._p_chain, si_sync);

		// prep grpc client
		const y_service = new TxServiceClient(this._y_grpc);

		// fetch current block height
		if(!g_latest) g_latest = await this.latestBlock();
		const s_latest = String(g_latest.block?.header?.height || '');

		// ensure the data is good
		if(!RT_UINT.test(s_latest)) {
			throw syserr({
				title: 'Sync failed',
				text: `${this._g_provider.name} returned an invalid block`,
			});
		}

		// pagination control
		let xg_offset = 0n;
		let xg_seen = 0n;
		let atu8_key: Uint8Array | null = null;

		// // start with a single probe
		// let xg_limit = 1n;

		// start with a small probe
		let xg_limit = 6n;

		// prep context used across all paginations
		const g_apriori = {
			p_chain: this._p_chain,
			g_chain: this._g_chain,
			p_account: p_account,
		};

		for(;;) {
			// fetch in batch
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			const g_response: GetTxsEventResponse = await wgrpc_retry(() => y_service.getTxsEvent({
				events: a_events,
				orderBy: OrderBy.ORDER_BY_DESC,
				pagination: atu8_key
					? {
						limit: ''+xg_limit,
						key: atu8_key,
					}
					: {
						limit: ''+xg_limit,
						offset: ''+xg_offset,
					},
			}));

			// destructure response
			const {
				txs: a_txs,
				txResponses: a_results,
			} = g_response;

			// cache incidents store
			const ks_incidents_former = await Incidents.read();

			// height range of sync
			let xg_height_hi = 0n;
			let xg_height_lo = BigInt(s_latest);

			// process each transaction
			const nl_txns = a_txs.length;
			xg_seen += BigInt(nl_txns);
			for(let i_txn=0; i_txn<nl_txns; i_txn++) {
				// ref tx raw and info
				const g_tx = a_txs[i_txn];
				const g_result = a_results[i_txn];

				// ref transaction hash
				const si_txn = g_result.txhash.toUpperCase();

				// construct incident path
				const p_incident = Incidents.pathFor(si_type, si_txn);

				// check for existing incident
				const g_incident = ks_incidents_former.at(p_incident) as IncidentStruct<'tx_in' | 'tx_out'>;
				const g_data = g_incident?.data as TxSynced;

				// final version of transaction does not yet exist in incidents
				if('synced' !== g_data?.stage) {
					// convert to synced
					const g_synced = fetched_tx_to_synced_record({
						...g_apriori,
						g_tx,
						g_result,
						si_txn,
						p_app: g_data?.app,
						h_events: g_data?.events || {},
					});

					// yield
					yield {
						g_tx,
						g_result,
						g_synced,
						xg_previous: xg_synced,
					};
				}

				// parse height of tx
				const xg_height = BigInt(g_result.height);

				// update height range
				if(xg_height > xg_height_hi) xg_height_hi = xg_height;
				if(xg_height < xg_height_lo) xg_height_lo = xg_height;
			}

			// synced with chain
			if(xg_synced > xg_height_lo) break;

			// more results
			const s_total = g_response.pagination?.total || '0';
			if(s_total && (BigInt(s_total) - xg_seen) > 0n) {
				// use 'nextKey'
				atu8_key = g_response.pagination!.nextKey;
				xg_offset += xg_limit;

				// use full limit now
				xg_limit = XG_SYNCHRONIZE_PAGINATION_LIMIT;
				continue;
			}

			// reached very end
			break;
		}

		// there are still pending txs
		{
			const a_pending = [...await Incidents.filter({
				type: 'tx_out',
				stage: 'pending',
			})];

			// check each one explicityl
			if(a_pending.length) {
				for(const g_pending of a_pending) {
					const {
						hash: si_txn,
						app: p_app,
					} = g_pending.data as TxPending;

					const p_incident = Incidents.pathFrom(g_pending);

					let g_synced!: TxSynced;
					try {
						g_synced = await this.downloadTxn(si_txn, p_account, p_app);
					}
					catch(e_download) {
						if(e_download instanceof TransactionNotFoundError) {
							// update incident
							await Incidents.mutateData(p_incident, {
								stage: 'absent',
							});
						}
					}

					// synced with chain; merge incident
					if(g_synced) {
						await Incidents.mutateData(p_incident, g_synced);
					}
				}

				// debugger;
				// console.log(a_pending);
			}
		}

		// update histories sync info
		await Histories.updateSyncInfo(this._p_chain, si_sync, s_latest);
	}

	async delegations(sa_owner: Bech32): Promise<{
		bonded: DelegationResponse[];
		unbonding: UnbondingDelegation[];
		redelegating: RedelegationResponse[];
	}> {
		const [g_response_bonded, g_response_unbonding, g_response_redelegating] = await Promise.all([
			wgrpc_retry(() => new StakingQueryClient(this._y_grpc).delegatorDelegations({
				delegatorAddr: sa_owner,
			})),
			wgrpc_retry(() => new StakingQueryClient(this._y_grpc).delegatorUnbondingDelegations({
				delegatorAddr: sa_owner,
			})),
			wgrpc_retry(() => new StakingQueryClient(this._y_grpc).redelegations({
				delegatorAddr: sa_owner,
			})),
		]);

		return {
			bonded: g_response_bonded.delegationResponses,
			unbonding: g_response_unbonding.unbondingResponses,
			redelegating: g_response_redelegating.redelegationResponses,
		};
	}

	// return await _depaginate(200, async(g_pagination) => {
	// 	const g_res = await new StakingQueryClient(this._y_grpc).delegatorDelegations({
	// 		delegatorAddr: sa_owner,
	// 		pagination: g_pagination,
	// 	});

	// 	return [g_res, a => a.concat(g_res.delegationResponses)];
	// });

	async stakingInfo(): Promise<{
		params: Params;
		pool: Pool;
	}> {
		const [
			g_params,
			g_pool,
		] = await Promise.all([
			wgrpc_retry(() => new StakingQueryClient(this._y_grpc).params({})),
			wgrpc_retry(() => new StakingQueryClient(this._y_grpc).pool({})),
		]);

		const g_bundle = {
			...g_params,
			...g_pool,
		};

		return g_bundle as O.Compulsory<typeof g_bundle>;
	}

	async validators(): Promise<Validator[]> {
		const g_response = await wgrpc_retry(() => new StakingQueryClient(this._y_grpc).validators({
			status: bondStatusToJSON(BondStatus.BOND_STATUS_BONDED),
		}));

		return g_response.validators;
	}

	async codeInfo(si_code: `${bigint}`): Promise<CodeInfoResponse | undefined> {
		return (await wgrpc_retry(() => new ComputeQueryClient(this._y_grpc).code({
			codeId: si_code,
		}))).codeInfo;
	}

	async contractsByCode(si_code: `${bigint}`): Promise<ContractInfoWithAddress[]> {
		const g_response = await wgrpc_retry(() => new ComputeQueryClient(this._y_grpc).contractsByCodeId({
			codeId: si_code,
		}));

		return g_response.contractInfos;
	}

	async codeHashByContractAddress(sa_contract: Bech32): Promise<string> {
		const g_response = await wgrpc_retry(() => new ComputeQueryClient(this._y_grpc).codeHashByContractAddress({
			contractAddress: sa_contract,
		}));

		return g_response.codeHash;
	}

	async encodeExecuteContract(
		g_account: AccountStruct,
		sa_contract: Bech32,
		g_msg: JsonObject,
		s_code_hash: string,
		a_funds: Coin[]=[]
	): Promise<{amino: AminoMsg; proto: Any}> {
		if(!s_code_hash) {
			s_code_hash = await this.codeHashByContractAddress(sa_contract);
		}

		let atu8_msg: Uint8Array;

		// ref features
		const h_features = this._g_chain.features;

		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// secretwasm chain
		if(h_features['secretwasm']) {
			if(!(this instanceof SecretNetwork)) throw syserr(new Error(`Network instance was not created as Secret Network`));

			const k_wasm = await this.secretWasm(g_account);

			atu8_msg = await k_wasm.encrypt(s_code_hash, g_msg);
		}
		// cosmwasm chain
		else if(h_features['cosmwasm']) {
			// TODO: implement
			throw new Error('not yet implemented');
		}
		// does not support smart contracts
		else {
			throw new Error(`Chain does not support CosmWasm`);
		}

		// construct as amino message
		const g_amino: AminoMsg = {
			type: 'wasm/MsgExecuteContract',
			value: {
				sender: sa_owner,
				contract: sa_contract,
				msg: buffer_to_base64(atu8_msg),
				sent_funds: a_funds,
			},
		};

		// safely convert to proto
		const g_proto = amino_to_base(g_amino).encode();

		return {
			amino: g_amino,
			proto: g_proto,
		};
	}


	// -----------

	async authInfoDirect(g_account: AccountStruct, gc_fee: Partial<Fee>): Promise<{auth: Uint8Array; signer: SignerData}> {
		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_DIRECT,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: Fee.fromPartial(gc_fee),
		});

		return {
			auth: atu8_auth,
			signer: g_signer,
		};
	}


	async authInfoAmino(g_account: AccountStruct, gc_fee: Partial<Fee>): Promise<{auth: Uint8Array; signer: SignerData}> {
		// derive account's address
		const sa_owner = Chains.addressFor(g_account.pubkey, this._g_chain);

		// get account's signing key
		const k_secp = await Accounts.getSigningKey(g_account);

		// export its public key
		const atu8_pk = k_secp.exportPublicKey();

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		// generate auth info bytes
		const atu8_auth = encode_proto(AuthInfo, {
			signerInfos: [
				{
					publicKey: {
						typeUrl: '/cosmos.crypto.secp256k1.PubKey',
						value: encode_proto(PubKey, {
							key: atu8_pk,
						}),
					},
					modeInfo: {
						single: {
							mode: SignMode.SIGN_MODE_LEGACY_AMINO_JSON,
						},
					},
					sequence: g_signer.sequence+'',
				},
			],
			fee: Fee.fromPartial(gc_fee),
		});

		return {
			auth: atu8_auth,
			signer: g_signer,
		};
	}


	/**
	 * 
	 */
	async signDirect(g_account: AccountStruct, g_chain: ChainStruct, atu8_body: Uint8Array, g_fee: Fee): Promise<SignedDoc> {
		// fetch auth and signer info
		const {
			auth: atu8_auth,
			signer: g_signer,
		} = await this.authInfoDirect(g_account, g_fee);

		// produce signed doc bytes
		return await sign_direct_doc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);
	}


	async simulate(g_account: AccountStruct, g_body: Partial<TxBody>, atu8_auth: Uint8Array): Promise<SimulateResponse> {
		const g_chain = this._g_chain;

		const atu8_body = encode_proto(TxBody, g_body);

		const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

		// fetch latest signer info
		const g_signer = await this.signerData(sa_owner);

		const {
			signature: atu8_signature,
		} = await sign_direct_doc(g_account, g_signer.accountNumber, atu8_auth, atu8_body, g_chain.reference);


		const atu8_tx = encode_proto(TxRaw, {
			bodyBytes: atu8_body,
			authInfoBytes: atu8_auth,
			signatures: [atu8_signature],
		});

		const g_simulated = await wgrpc_retry(() => new TxServiceClient(this._y_grpc).simulate({
			txBytes: atu8_tx,
		}));

		return g_simulated;
	}

	nodeInfo(): Promise<GetNodeInfoResponse> {
		return new TendermintServiceClient(this._y_grpc).getNodeInfo({});
	}
}
