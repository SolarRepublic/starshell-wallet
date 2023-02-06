
import type * as ImportHelper from './ics-witness-imports';
import type {
	IcsToService, WitnessToKeplr,
} from './messages';


// import type {Key as KeplrExportedKey} from '@keplr-wallet/types';
import type {DirectSignResponse} from '@cosmjs/proto-signing';
import type {ProxyRequest, ProxyRequestResponse} from '@keplr-wallet/provider';
import type {
	BroadcastMode,
	ChainInfoWithoutEndpoints,
	Keplr,
	Key as KeplrKey,
	StdSignature,
} from '@keplr-wallet/types';
import type {KeplrGetKeyWalletCoonectV1Response as KeplrExportedKey} from '@keplr-wallet/wc-client';

import type {TxRaw} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
import type {L} from 'ts-toolbelt';
import type {Function} from 'ts-toolbelt/out/Function/Function';

import type {AccountStruct, AccountPath} from '#/meta/account';
import type {SessionRequest} from '#/meta/api';
import type {AppStruct, AppPermissionSet} from '#/meta/app';
import type {Dict, Promisable, JsonValue} from '#/meta/belt';
import type {Bech32, Caip2, ChainStruct, ChainPath} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';
import type {Vocab} from '#/meta/vocab';
import type {AdaptedAminoResponse} from '#/schema/amino';

import type {InternalConnectionsResponse, InternalSessionResponse} from '#/provider/connection';
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {AppProfile} from '#/store/apps';
/* eslint-enable */
import type {Consolidator} from '#/util/consolidator';


// amount of time to wait for page to request an advertisement from StarShell before applying keplr polyfill
const XT_POLYFILL_DELAY = 1.5e3;

// regex responsible for detecting keplr use in source code
const RT_KEPLR_DETECTOR = /([\s.]keplr\b|\[['"`]keplr['"`]\s*[\],)])/;

/**
 * The witness script listens for Keplr requests from the page and forwards them to the service.
 * It will also inspect the page to deduce if it will be using the Keplr API in order to prompt user to enable polyfill.
 * Finally, if the browser is not able to register content scripts and the polyfill is enabled either globally or for
 * this page individually, the witness script will inject the `window.keplr` polyfill object into the page.
 */
(function() {
	// verbose
	const logger = si_channel => (s: string, ...a_args: any[]) => console[si_channel](`StarShell.ics-witness: ${s}`, ...a_args as unknown[]);
	const debug = logger('debug');
	const warn = logger('warn');
	const error = logger('error');
	debug(`Launched on <${location.href}>`);

	// imports
	const {
		NL_DATA_ICON_MAX,
		N_PX_DIM_ICON,
		A_KEPLR_EMBEDDED_CHAINS,
		A_TESTNETS,
		R_CHAIN_ID_VERSION,
		R_CAIP_2,
		R_DATA_IMAGE_URL_WEB,
		G_USERAGENT,
		B_SAFARI_ANY,

		microtask,
		timeout,
		timeout_exec,
		fold,
		ode,
		oderom,
		F_NOOP,

		buffer_to_hex,
		hex_to_buffer,
		base64_to_buffer,
		serialize_to_json,
		buffer_to_base93,
		base93_to_buffer,

		Apps,
		Accounts,
		Chains,
		Contracts,
		AppApiMode,
		create_app_profile,
		PublicStorage,
		locate_script,
		Vault,

		Consolidator,
		SessionStorage,

		fromBech32,
		ServiceRouter,

		Policies,
		Secrets,
		Settings,
		Snip2xToken,

		TxRaw,
		encode_proto,
	} = inline_require('./ics-witness-imports.ts') as typeof ImportHelper;

	type KeplrResponse<w_success extends any=any> = undefined | {
		error: string;
	} | {
		return: w_success;
	};

	type AsyncKeplrResponse<w_success extends any=any> = Promise<KeplrResponse<w_success>>;

	const G_RETURN_VOID = {
		return: void 0,
	};

	const buffer_to_keplr_str = (atu8: Uint8Array) => `__uint8array__${buffer_to_hex(atu8)}`;
	const keplr_str_to_buffer = (sx_str: string) => hex_to_buffer(sx_str.replace(/^__uint8array__/, ''));

	const base93_to_keplr_str = (sxb93: string) => buffer_to_keplr_str(base93_to_buffer(sxb93));
	const keplr_str_to_base93 = (z_input: unknown) => {
		if('string' === typeof z_input) {
			try {
				return buffer_to_base93(keplr_str_to_buffer(z_input));
			}
			catch(e_decode) {}
		}

		const e_report = new Error(`Rejecting invalid argument type supplied to Keplr API: ${JSON.stringify(z_input)}`);

		// exception
		f_runtime().sendMessage({
			type: 'reportException',
			value: {
				report: e_report.message+'\n'+(e_report.stack?.split(/\n/g)?.at(2) || ''),
			},
		}, F_NOOP);

		throw e_report;
	};

	let g_registered_app: AppStruct | null = null;

	const h_keplr_connections: Dict<KeplrChainConnection> = {};

	const token_consolidator = (
		si_type: 'requestAddTokens' | 'requestViewingKeys',
		p_account: AccountPath,
		p_chain: ChainPath
	) => new Consolidator<IcsToService.AppResponse<void>>(async(a_tokens: Bech32[]) => {
		const g_response = await f_runtime_app().sendMessage({
			type: si_type,
			value: {
				accountPath: p_account,
				chainPath: p_chain,
				bech32s: a_tokens,
			},
		});

		if(g_response.error) {
			throw g_response.error;  // eslint-disable-line @typescript-eslint/no-throw-literal
		}
		else {
			return fold(a_tokens, (sa_token) => {
				const w_each = g_response.ok![sa_token];
				if(w_each.error) {
					return {
						[sa_token]: w_each,
					};
				}
				else {
					return {
						[sa_token]: {
							return: w_each.ok,
						},
					};
				}
			});
		}
	});

	class KeplrChainConnection {
		protected _g_chain: ChainStruct;
		protected _g_permissions: Partial<AppPermissionSet>;
		protected _p_account: AccountPath;
		protected _p_chain: ChainPath;
		protected _sa_owner: Bech32;

		protected _kc_add_tokens: Consolidator<IcsToService.AppResponse<void>>;
		protected _kc_viewing_keys: Consolidator<IcsToService.AppResponse<void>>;

		constructor(protected _g_session: InternalSessionResponse, protected _g_account: AccountStruct) {
			const {
				chain: g_chain,
				permissions: g_permissions,
			} = _g_session;

			this._g_chain = g_chain;
			this._g_permissions = g_permissions;

			const p_account = this._p_account = Accounts.pathFrom(_g_account);

			this._sa_owner = Chains.addressFor(_g_account.pubkey, g_chain);

			const p_chain = this._p_chain = Chains.pathFrom(g_chain);

			this._kc_add_tokens = token_consolidator('requestAddTokens', p_account, p_chain);
			this._kc_viewing_keys = token_consolidator('requestViewingKeys', p_account, p_chain);
		}

		get accountPath(): AccountPath {
			return this._p_account;
		}

		get account(): AccountStruct {
			return this._g_account;
		}

		get address(): Bech32 {
			return this._sa_owner;
		}

		getKey(): KeplrExportedKey & {intercepts?: string[]} {
			const {
				_g_permissions,
				_g_account,
				_g_chain,
			} = this;

			const atu8_pubkey = base64_to_buffer(_g_account.pubkey);
			const sa_owner = Chains.addressFor(_g_account.pubkey, _g_chain);  // TODO: bech32 type depending on session request

			// structure object in same order as Keplr (which alphabetizes it)
			return {
				address: buffer_to_keplr_str(fromBech32(sa_owner).data),
				algo: 'secp256k1',
				bech32Address: sa_owner,
				isNanoLedger: false,
				name: _g_permissions.doxx?.name? _g_account?.name: `Anonymous User ${sa_owner.slice(0, -7)}`,  // TODO: fill with random name?
				pubKey: buffer_to_keplr_str(atu8_pubkey),
				// intercepts: ['address', 'bech32Address', 'pubbKey'],
			};
		}

		async suggestToken(sa_token: Bech32) {
			const g_response = await this._kc_add_tokens.queue(sa_token);

			// no error but not ok; reject
			if(!g_response.error && !g_response.ok) {
				return {
					error: 'Request rejected',
				};
			}

			return g_response;
		}

		viewingKey(sa_token: Bech32) {
			return this._kc_viewing_keys.queue(sa_token);
		}

		broadcast(g_tx: TxRaw, xc_broadcast_mode: BroadcastMode): Promise<IcsToService.AppResponse<string>> {
			return f_runtime_app().sendMessage({
				type: 'requestBroadcast',
				value: {
					accountPath: this._p_account,
					chainPath: this._p_chain,
					sxb93_tx_raw: buffer_to_base93(encode_proto(TxRaw, g_tx)),
				},
			});
		}
	}



	// ref and cast browser runtime
	const f_runtime: () => Vocab.TypedRuntime<IcsToService.PublicVocab> = () => chrome.runtime;
	const f_runtime_app: () => Vocab.TypedRuntime<IcsToService.AppVocab> = () => chrome.runtime;

	// listen for messages from popup
	f_runtime().onMessage?.addListener((g_msg, g_sender, fk_respond) => {
		// message originates from extension
		const b_origin_verified = g_sender.url?.startsWith(chrome.runtime.getURL('')) || false;
		if(chrome.runtime.id === g_sender.id && (b_origin_verified || 'null' === g_sender.origin)) {
			fk_respond?.(null);

			if('notifyAccountChange' === g_msg.type) {
				// no connections
				if(!Object.keys(h_keplr_connections).length) {
					console.debug(`Ignoring account change since there are no active connections`);
					return;
				}

				const {
					// accountPathOld: p_account_old,
					// accountPathNew: p_account_new,
					accountPath: p_account_new,
				} = g_msg.value;

				// no actual account change
				if(p_account_new === Object.values(h_keplr_connections)[0].accountPath) {
					return;
				}

				for(const [si_chain, k_connection] of ode(h_keplr_connections)) {
					// remove connection
					delete h_keplr_connections[si_chain];
				}

				console.debug(`Notifying main-world content script of account change`);

				// post message to main-world content script
				(window as Vocab.TypedWindow<WitnessToKeplr.RuntimeVocab>).postMessage({
					type: 'accountChange',
					value: {},
				}, window.location.origin);
			}
		}
		else {
			warn(`Ignored message from unknown sender: ${JSON.stringify(g_sender)}`);
		}
	});

	// browser cannot (un)register content scripts dynamically
	if(B_SAFARI_ANY) {
		// Keplr compatibility mode is globally disabled; exit
		if(SessionStorage.synchronously?.get('keplr_compatibility_mode_disabled')) {
			warn('Shutdown due to being globally disabled');
			return;
		}
	}

	// profile for the app
	let g_profile: AppProfile | null = null;

	// scope the bulk chain request singleton
	const add_chain_req = (() => {
		// amount of time to wait before sending bulk keys request
		// const XT_ACCUMULATE_KEYS_DELAY = 25;
		const XT_ACCUMULATE_KEYS_DELAY = 0;

		// max amount of time to wait before forcing bulk request
		// const XT_ACCUMULATE_MAX = 250;
		const XT_ACCUMULATE_MAX = 0;

		// dict of chains from Keplr with exact id matches
		const H_CHAINS_KEPLR_EXACT = fold(A_KEPLR_EMBEDDED_CHAINS, g_chain => ({
			[g_chain.chainId]: g_chain,
		}));

		// dict of chains from Keplr with same core chain id (without version)
		const H_CHAINS_KEPLR_INEXACT = fold(A_KEPLR_EMBEDDED_CHAINS, (g_chain) => {
			// parse chain id & version
			const m_chain_version = R_CHAIN_ID_VERSION.exec(g_chain.chainId);

			// key by core chain id without version suffix
			if(m_chain_version) {
				return {
					[m_chain_version[1]]: g_chain,
				};
			}

			// do not produce entry for unversioned chain id
			return {};
		});

		// set of chains to request in bulk
		const as_chains = new Set<string>();

		// queue pending callbacks
		const h_pending: Record<Caip2.String, Array<(k_connection: KeplrChainConnection) => void>> = {};

		// 
		let xt_bulk_req = 0;
		let i_bulk_req = 0;

		async function send_bulk_req() {
			// clear timeout
			clearTimeout(i_bulk_req);
			i_bulk_req = 0;

			// convert set to list
			const a_chains = [...as_chains];

			// clear the set for next bulk operation
			as_chains.clear();

			// preapproved Keplr chains
			const a_chains_keplr: string[] = [];

			// collect chain version mismatches
			const a_chains_inexact: {
				requested: string;
				known: string;
			}[] = [];

			// others
			const a_chains_other: string[] = [];

			// invalid
			const a_chains_invalid: string[] = [];

			// sort chains
			for(const si_chain of a_chains) {
				// exact chain id match from Keplr
				if(H_CHAINS_KEPLR_EXACT[si_chain]) {
					a_chains_keplr.push(si_chain);
					continue;
				}

				// versioned chain id
				const m_chain_version = R_CHAIN_ID_VERSION.exec(si_chain);
				if(m_chain_version) {
					// destructure chain core id and version
					const [, si_chain_core, s_version] = m_chain_version;

					// match found in Keplr's list
					const g_chain_inexact = H_CHAINS_KEPLR_INEXACT[si_chain_core];
					if(g_chain_inexact) {
						// log version difference
						a_chains_inexact.push({
							requested: si_chain,
							known: g_chain_inexact.chainId,
						});

						continue;
					}
				}

				// valid CAIP-2; push to others
				const m_caip2 = R_CAIP_2.exec(`cosmos:${si_chain}`);
				if(m_caip2) {
					a_chains_other.push(si_chain);
					continue;
				}

				// invalid
				a_chains_invalid.push(si_chain);
			}

			// log invalid chains
			if(a_chains_invalid.length) {
				error('The following chain IDs are considered invalid: %o', a_chains_invalid);
			}

			// convert Keplr chains to StarShell format
			const h_chains = fold(a_chains_keplr, (si_chain): Record<Caip2.String, ChainStruct> => {
				// ref chain def from Keplr's export
				const g_chain_keplr = H_CHAINS_KEPLR_EXACT[si_chain];

				// ref bech32 config
				const gc_bech32 = g_chain_keplr.bech32Config;

				// prep CAIP-2 identifier
				const si_caip2 = `cosmos:${si_chain}` as const;

				// StarShell format
				return {
					[si_caip2]: {
						// all chains imported from Keplr are in the cosmos namespace
						namespace: 'cosmos',

						// chain id becomes the CAIP-2 reference identifier
						reference: si_chain,

						// testnet
						...g_chain_keplr.beta && {
							testnet: {},
						},

						// human parts
						name: g_chain_keplr.chainName,
						pfp: '' as PfpTarget,

						// dict of "built-in" coins for chain
						coins: fold(g_chain_keplr.currencies, g_coin => ({
							[g_coin.coinDenom]: {
								name: g_coin.coinDenom,
								denom: g_coin.coinMinimalDenom,
								decimals: g_coin.coinDecimals,
								pfp: '' as PfpTarget,
								extra: {
									...g_coin['coinGeckoId'] && {
										coingeckoId: g_coin['coinGeckoId'],
									},
								},
							},
						})),

						// transform fee and stake currencies to coin identifiers
						feeCoinIds: g_chain_keplr.feeCurrencies.map(g => g.coinDenom),
						stakeCoinIds: [g_chain_keplr.stakeCurrency.coinDenom],

						// gas prices
						gasPrices: g_chain_keplr.gasPriceStep && {
							default: g_chain_keplr.gasPriceStep.average,
							steps: [
								g_chain_keplr.gasPriceStep.low,
								g_chain_keplr.gasPriceStep.average,
								g_chain_keplr.gasPriceStep.high,
							],
						},


						// adapt bip44 to slip44s
						slip44s: [
							{
								coinType: g_chain_keplr.bip44.coinType || g_chain_keplr.coinType || 118,
							},
							...g_chain_keplr.alternativeBIP44s || [],
						],

						// convert Keplr's bech32 config to StarShell's more agnostic format
						bech32s: {
							acc: gc_bech32.bech32PrefixAccAddr,
							accpub: gc_bech32.bech32PrefixAccPub,
							valoper: gc_bech32.bech32PrefixValAddr,
							valoperpub: gc_bech32.bech32PrefixValPub,
							valcons: gc_bech32.bech32PrefixConsAddr,
							valconspub: gc_bech32.bech32PrefixConsPub,
						},

						// TODO: define mapping from Keplr `features` to interfaces
						tokenInterfaces: [],

						// use mintscan by default
						blockExplorer: {
							base: 'https://mintscan.io/{chain_prefix}',
							block: '/blocks/{height}',
							account: '/account/{address}',
							contract: '/account/{address}',
							validator: '/validators/{address}',
							transaction: '/txs/{hash}',
						},
					},
				};
			});

			// read from accounts store
			const [p_account, g_account] = await Accounts.selected();

			// send message to service
			const h_responses = await ServiceRouter.connect({
				schema: '1',
				accountPath: p_account,
				chains: h_chains,
				sessions: oderom(h_chains, (si_caip2: Caip2.String): Dict<SessionRequest> => ({
					[si_caip2]: {
						caip2: si_caip2,
						query: {},
						broadcast: {},
						doxx: {
							name: true,
							address: {
								justification: '',
							},
						},
					},
				})),
			}) as InternalConnectionsResponse;

			if(h_responses) {
				// // read from accounts store
				// const [, g_account] = await Accounts.selected();

				// 1:1 chain session request
				for(const [p_chain, g_session] of ode(h_responses)) {
					const k_connection = new KeplrChainConnection(g_session, g_account);

					const si_chain = g_session.chain.reference;

					h_keplr_connections[si_chain] = k_connection;

					// callback each pending promise with exported keys
					h_pending[si_chain].forEach(f => f(k_connection));
				}
			}
		}

		// iiaf result
		return function(si_chain: string): Promise<KeplrChainConnection> {
			// go async
			return new Promise((fk_resolve) => {
				// chain not "recognized" by Keplr's default (nor our testnets)
				if(!A_TESTNETS.filter(g => si_chain === g.chainId).length && !A_KEPLR_EMBEDDED_CHAINS.filter(g => si_chain === g.chainId).length) {
					return {
						error: `There is no chain info for ${si_chain}`,
					};
				}

				// add chain to outgoing set
				as_chains.add(si_chain);

				// add callback
				(h_pending[si_chain] = h_pending[si_chain] || []).push((k_connection: KeplrChainConnection) => {
					fk_resolve(k_connection);
				});

				// accumulation time maxed out
				if(i_bulk_req && Date.now() - xt_bulk_req > XT_ACCUMULATE_MAX) {
					warn('Accumulation time maxed out');
					void send_bulk_req();

					// do not add it again
					return;
				}

				// no accumulator yet; set start time
				if(!i_bulk_req) {
					xt_bulk_req = Date.now();
				}

				// create or extend timeout
				clearTimeout(i_bulk_req);
				i_bulk_req = window.setTimeout(send_bulk_req, XT_ACCUMULATE_KEYS_DELAY);
			});
		};
	})();



	/* eslint-disable @typescript-eslint/no-throw-literal,no-throw-literal */
	async function check_chain(si_chain: string): Promise<KeplrChainConnection> {
		// chain is not registered
		if(!h_keplr_connections[si_chain]) {
			// warn(`The developer of the app running on ${location.origin} did not bother calling \`window.keplr.enable()\` before attempting to use the API. Rejecting the request.`);

			// app did not request it first, but keplr still counts it as a request
			const g_enable = await h_handlers_keplr.enable([si_chain]);

			// there was an error, exit
			if(!g_enable || !('return' in g_enable)) {
				throw g_enable?.['error'] || 'Request rejected';
			}
		}

		// lookup connection
		const k_connection = h_keplr_connections[si_chain];

		// connection does not exist
		if(!k_connection) throw 'Request rejected';

		// return connection
		return k_connection;
	}

	function app_to_keplr<w_out extends any>(
		g_response: IcsToService.AppResponse<JsonValue | undefined>,
		f_transform=(w_in: any): w_out => w_in
	): KeplrResponse<w_out> {
		if(g_response?.error) {
			throw g_response.error;
		}
		else if(g_response?.ok) {
			return {
				return: f_transform(g_response.ok),
			};
		}
	}

	type ProxiedMethods<w_keplr extends Keplr=Keplr> = Pick<w_keplr, {
		[si_method in keyof w_keplr]-?: w_keplr[si_method] extends Function<any[], Promise<any>>
			? si_method extends 'getOfflineSignerAuto'
				? never
				: si_method
			: never;
	}[keyof w_keplr]>;

	type DeKeplrified<w_thing> = w_thing extends Uint8Array
		? string
		: w_thing extends any[]
			? L.Replace<w_thing, Uint8Array, string>
			: w_thing extends object
				? [object] extends [w_thing]
					? w_thing
					: {
						[si_key in keyof w_thing]: w_thing[si_key] extends infer z_value
							? z_value extends Uint8Array
								? string
								: z_value
							: w_thing[si_key];
					}
				: w_thing;

	type ImplementedProxiedMethods<w_keplr extends Keplr=Keplr> = {
		[si_method in keyof ProxiedMethods<w_keplr>]: w_keplr[si_method] extends infer f_method
			? f_method extends Function<any[], Promise<any>>
				? Function<[DeKeplrified<Parameters<f_method>>], Promisable<KeplrResponse<DeKeplrified<Awaited<ReturnType<f_method>>>>>>
				: never
			: never;
	};

	type ProxyArgs<si_method extends keyof ImplementedProxiedMethods> = Parameters<ImplementedProxiedMethods[si_method]>[0];

	/* eslint-disable class-methods-use-this */
	class KeplrHandler implements ImplementedProxiedMethods {
		// dapp is requesting to enable connection for a specific chain
		async enable(a_args: ProxyArgs<'enable'>): AsyncKeplrResponse<undefined> {
			const z_arg_0 = a_args[0];

			// emulate Keplr's response
			if(!z_arg_0) throw 'chain id not set';

			// validate string
			if('string' === typeof z_arg_0) {
				await add_chain_req(z_arg_0);
			}
			// validate array
			else if(Array.isArray(z_arg_0)) {
				// each item in list
				for(const z_test of z_arg_0) {
					if('string' === typeof z_test) {
						await add_chain_req(z_test);
					}
					else {
						// emulate exact same error keplr would throw
						const e = z_test;
						try {
							// @ts-expect-error intentionally inducing TypeError
							e.split(/(.+)-([\d]+)/);
						}
						catch(e_runtime) {
							return {
								error: e_runtime.message,
							};
						}
					}
				}
			}
			// other type; emulate Keplr's response
			else {
				throw 't is not iterable';
			}

			// succeed
			return G_RETURN_VOID;
		}

		// dapp is suggesting a chain
		async experimentalSuggestChain(a_args: ProxyArgs<'experimentalSuggestChain'>): AsyncKeplrResponse<void> {
			const [g_suggest] = a_args;

			const si_chain = g_suggest?.chainId;
			if('string' === typeof si_chain) {
				const p_chain = Chains.pathFor('cosmos', si_chain);

				const g_chain = await Chains.at(p_chain);
				if(g_chain) {
					console.debug(`Approving chain suggestion since it already exists`);
					return G_RETURN_VOID;
				}

				// let service handle denying it
				void add_chain_req(si_chain);
			}

			throw `Refusing chain suggestion "${si_chain}" until support is added`;
		}

		// dapp is requesting the public key for the currently connected account on the given chain
		async getKey(a_args: ProxyArgs<'getKey'>): AsyncKeplrResponse<DeKeplrified<KeplrKey>> {
			// emulate Keplr's response (yes, it includes the "parmas" typo!)
			if(1 !== a_args.length) throw 'Invalid parmas';

			// ref arg 0
			const si_chain = a_args[0];

			// invalid param; emulate Keplr's response (yes, it includes the "parmas" typo!)
			if(!si_chain || 'string' !== typeof si_chain) throw 'Invalid parmas';

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// succeed
			return {
				return: k_connection.getKey(),
			};
		}

		// dapp is requesting a signature of the given amino document
		async signAmino(a_args: ProxyArgs<'signAmino'>): AsyncKeplrResponse<AdaptedAminoResponse> {
			const [si_chain, sa_signer, g_doc, gc_sign] = a_args;

			if(!si_chain) throw 'chain id not set';

			if(!sa_signer) throw 'signer not set';

			if(g_doc.chain_id !== si_chain) throw 'Chain id in the message is not matched with the requested chain id';

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// wrong signer, reject emulating Keplr's response
			if(sa_signer !== k_connection.address) throw 'Signer mismatched';

			// serialize the signDoc
			const g_doc_serialized = serialize_to_json(g_doc);

			debug(`Submitting cosmos amino signature request: ${JSON.stringify(g_doc_serialized)}`);

			// request signature
			const g_response = await f_runtime_app().sendMessage({
				type: 'requestCosmosSignatureAmino',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					doc: g_doc_serialized,
					keplrSignOptions: gc_sign,
				},
			});

			debug(`Received cosmos amino signature response: ${JSON.stringify(g_response?.ok)}`);

			return app_to_keplr(g_response);
		}

		// dapp is requesting a signature of the given proto document
		async signDirect(a_args: ProxyArgs<'signDirect'>): AsyncKeplrResponse<DirectSignResponse> {
			const [si_chain, sa_signer, g_doc] = a_args;

			const gc_sign = a_args[3]!;

			if(!si_chain) throw 'chain id not set';

			if(!sa_signer) throw 'signer not set';

			if(g_doc.chainId !== si_chain) throw 'Chain id in the message is not matched with the requested chain id';

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// wrong signer, reject emulating Keplr's response
			if(sa_signer !== k_connection.address) throw 'Signer mismatched';

			// serialize the signDoc
			const g_doc_serialized = serialize_to_json({
				...g_doc,
				chainId: si_chain,
				accountNumber: g_doc.accountNumber? g_doc.accountNumber+'': void 0,
			});

			// request the actual signing
			const g_response = await f_runtime_app().sendMessage({
				type: 'requestCosmosSignatureDirect',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					doc: g_doc_serialized,
				},
			});

			debug(`Received direct signature response: ${JSON.stringify(g_response?.ok)}`);

			return app_to_keplr(g_response);
		}

		// dapp is requesting the wallet broadcast the given transaction to the chain
		async sendTx(a_args: ProxyArgs<'sendTx'>): AsyncKeplrResponse<string> {
			const [si_chain, sx_tx, xc_broadcast_mode] = a_args;

			debugger;

			console.log({
				si_chain,
				sx_tx,
				xc_broadcast_mode,
			});

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing to sendTx for unknown chain "${si_chain}"`;

			// decode the proto
			if('string' !== typeof sx_tx) throw `Invalid type supplied for tx argument`;

			let g_tx!: TxRaw;
			try {
				g_tx = TxRaw.decode(keplr_str_to_buffer(sx_tx));
			}
			catch(e_decode) {
				throw `Failed to decode tx data`;
			}

			return app_to_keplr(
				await k_connection.broadcast(g_tx, xc_broadcast_mode),
				si_txn => buffer_to_keplr_str(base64_to_buffer(si_txn))
			);
		}

		// dapp is suggesting a token be added to the user's wallet
		async suggestToken(a_args: ProxyArgs<'suggestToken'>): AsyncKeplrResponse<void> {
			const [si_chain, sa_contract] = a_args as [string, Bech32];

			// validate message format
			if('string' !== typeof si_chain || 'string' !== typeof sa_contract) {
				throw 'Invalid request';
			}

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing token suggestion for unknown chain "${si_chain}"`;

			// contract already exists
			const p_contract = Contracts.pathOn('cosmos', si_chain, sa_contract);
			const g_contract = await Contracts.at(p_contract);
			if(g_contract) {
				// account has token in assets dict
				if(k_connection.account.assets[p_chain]?.data?.[sa_contract]) {
					return G_RETURN_VOID;
				}
			}

			// suggest token
			const g_suggest = await k_connection.suggestToken(sa_contract);

			return app_to_keplr(g_suggest);
		}

		// dapp is requesting a SNIP-20 viewing key
		async getSecret20ViewingKey(a_args: ProxyArgs<'getSecret20ViewingKey'>): AsyncKeplrResponse<string> {
			const [si_chain, sa_contract] = a_args as [string, Bech32];

			// validate message format
			if('string' !== typeof si_chain || 'string' !== typeof sa_contract) {
				throw 'Invalid request';
			}

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing token suggestion for unknown chain "${si_chain}"`;

			// contract does not exist
			const p_contract = Contracts.pathOn('cosmos', si_chain, sa_contract);
			const g_contract = await Contracts.at(p_contract);
			if(!g_contract) {
				warn(`User has no viewing keys set for ${sa_contract}`);
				throw 'Request rejected';
			}

			if(!g_registered_app) {
				// find matching app
				const a_apps = await Apps.filter({
					scheme: location.protocol.replace(/:$/, '') as 'https',
					host: location.host,
				});

				if(!(g_registered_app = a_apps[0]?.[1])) {
					throw 'App is not registered';
				}
			}

			const p_app = Apps.pathFrom(g_registered_app);

			// look for existing viewing key
			const a_vks = await Secrets.filter({
				type: 'viewing_key',
				on: 1,
				chain: p_chain,
				contract: sa_contract,
				owner: k_connection.address,
			});

			// viewing key does not exist
			if(!a_vks.length) {
				throw `Viewing key does not exist for ${sa_contract}`;
			}

			// viewing key exists
			const [s_viewing_key] = (await Snip2xToken.viewingKeyFor(g_contract, g_chain, k_connection.account))!;

			// prep success response
			const g_approve = {
				return: s_viewing_key,
			};

			// already approved for this app
			if(a_vks.filter(g => g.outlets.includes(p_app)).length) {
				return g_approve;
			}

			// app is not listed as an outlet, request user approval
			const g_key = await k_connection.viewingKey(sa_contract);

			if(g_key.ok) {
				return g_approve;
			}
		}

		// dapp is requesting the secretwasm chain's public key
		async getEnigmaPubKey(a_args: ProxyArgs<'getEnigmaPubKey'>): AsyncKeplrResponse<string> {
			const [si_chain] = a_args;

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing public key request for unknown chain "${si_chain}"`;

			// chain is not secretwasm compatible
			if(!g_chain?.features.secretwasm) {
				throw `Refusing public key request for non-secretwasm compatible chain "${si_chain}"`;
			}

			// ask service for pubkey
			const g_response = await f_runtime_app().sendMessage({
				type: 'requestSecretPubkey',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
				},
			});

			return app_to_keplr(g_response, base93_to_keplr_str);
		}

		// dapp is requesting a user's private transaction encryption key for some given nonce
		async getEnigmaTxEncryptionKey(a_args: ProxyArgs<'getEnigmaTxEncryptionKey'>): AsyncKeplrResponse<string> {
			const [si_chain, sx_nonce] = a_args;

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing encryption key request for unknown chain "${si_chain}"`;

			// chain is not secretwasm compatible
			if(!g_chain?.features.secretwasm) {
				throw `Refusing encryption key request for non-secretwasm compatible chain "${si_chain}"`;
			}

			// ask service for encryption key
			const g_response = await f_runtime_app().sendMessage({
				type: 'requestSecretEncryptionKey',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					nonce: keplr_str_to_base93(sx_nonce),
				},
			});

			return app_to_keplr(g_response, base93_to_keplr_str);
		}

		// dapp is requesting to encrypt some contract execution JSON for some given contract's code hash
		async enigmaEncrypt(a_args: ProxyArgs<'enigmaEncrypt'>): AsyncKeplrResponse<string> {
			const [si_chain, s_code_hash, h_exec] = a_args;

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing encryption request for unknown chain "${si_chain}"`;

			// chain is not secretwasm compatible
			if(!g_chain?.features.secretwasm) {
				throw `Refusing encryption request for non-secretwasm compatible chain "${si_chain}"`;
			}

			// ask service to encrypt
			const g_encrypt = await f_runtime_app().sendMessage({
				type: 'requestEncrypt',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					codeHash: s_code_hash,
					exec: h_exec,
				},
			});

			return app_to_keplr(g_encrypt, base93_to_keplr_str);
		}

		// dapp is requesting to decrypt some contract execution response JSON for some given nonce
		async enigmaDecrypt(a_args: ProxyArgs<'enigmaDecrypt'>): AsyncKeplrResponse<string> {
			const [si_chain, sx_ciphertext, sx_nonce] = a_args;

			// ensure the chain was enabled first
			const k_connection = await check_chain(si_chain);

			// lookup chain
			const g_chain = await Chains.at(Chains.pathFor('cosmos', si_chain));
			if(!g_chain) throw `Refusing decryption request for unknown chain "${si_chain}"`;

			// chain is not secretwasm compatible
			if(!g_chain?.features.secretwasm) {
				throw `Refusing encryption request for non-secretwasm compatible chain "${si_chain}"`;
			}

			// ask service to dcrypt
			const g_decrypt = await f_runtime_app().sendMessage({
				type: 'requestDecrypt',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					ciphertext: keplr_str_to_base93(sx_ciphertext),
					nonce: keplr_str_to_base93(sx_nonce),
				},
			});

			return app_to_keplr(g_decrypt, base93_to_keplr_str);
		}

		// dapp is requesting ADR-36 "arbitrary content" signature
		signArbitrary(a_args: ProxyArgs<'signArbitrary'>): AsyncKeplrResponse<DeKeplrified<StdSignature>> {
			const [si_chain, sa_signer, z_data] = a_args;

			debugger;

			console.log({
				si_chain,
				sa_signer,
				z_data,
			});

			throw `ADR-36 not supported`;
		}

		// dapp is requesting the wallet to verify an ADR-36 "arbitrary content" signature
		verifyArbitrary(a_args: ProxyArgs<'verifyArbitrary'>): AsyncKeplrResponse<boolean> {
			const [si_chain, sa_signer, z_data] = a_args;

			debugger;

			console.log({
				si_chain,
				sa_signer,
				z_data,
			});

			throw `ADR-36 not supported`;
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		signICNSAdr36(args_0: [
			chainId: string,
			contractAddress: string,
			owner: string,
			username: string,
			addressChainIds: string[],
		]): Promisable<
			{error: string;}
			| {
				return: {
					chainId: string;
					bech32Prefix: string;
					bech32Address: string;
					addressHash: 'cosmos' | 'ethereum';
					pubKey: Uint8Array;
					signatureSalt: number;
					signature: Uint8Array;
				}[];
			} | undefined
		> {
			throw new Error(`Not supported.`);
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		getChainInfosWithoutEndpoints(args_0: []): Promisable<{error: string} | {return: ChainInfoWithoutEndpoints[];} | undefined> {
			throw new Error(`Not supported.`);
		}

		signEthereum(): KeplrResponse<string> {
			throw new Error(`Not supported`);
		}

		experimentalSignEIP712CosmosTx_v0(): KeplrResponse<AdaptedAminoResponse> {
			throw new Error(`Not supported`);
		}

		changeKeyRingName(args_0: [opts: { defaultName: string; editable?: boolean; }]): Promisable<{ error: string; } | { return: string; } | undefined> {
			throw new Error(`Not supported`);
		}

		disable(a_args: ProxyArgs<'disable'>): AsyncKeplrResponse<void> {
			const [a_chains] = a_args as [string[]];

			// TODO: disconnect app
		}
	}


	const h_handlers_keplr = new KeplrHandler();

	// whether to cancel polyfill after the witness has loaded
	let b_cancel_polyfill = false;

	// time at which keplr polyfill was initialized
	let xt_polyfill_init = 0;

	// prep handler map
	const h_handlers_window = {
		// app is capable of connecting to StarShell without Keplr polyfill
		requestAdvertisement() {
			// cancel polyfill
			b_cancel_polyfill = true;
		},

		// request to keplr
		async 'proxy-request'(g_data: ProxyRequest) {
			// minimum init time has not yet elapsed; wait it out
			const xt_elapsed = Date.now() - xt_polyfill_init;
			if(xt_elapsed < XT_POLYFILL_DELAY) {
				await timeout(XT_POLYFILL_DELAY - xt_elapsed);
			}

			// polyfill disabled
			if(b_cancel_polyfill) return;

			// app profile has not been made
			if(!g_profile) {
				try {
					const [g_attempt, xc_timed_out] = await timeout_exec(6e3, () => create_app_profile());
					if(xc_timed_out) {
						throw new Error('App profile took too long to load');
					}

					g_profile = g_attempt!;
				}
				catch(e_create) {
					console.error(`Failed to create app profile for ${location.origin}; this error negatively impacts UX. If you are the app developer, please fix the above errors for better load times.\n${e_create}`);
				}
			}

			// ensure that keplr-clash has been handled
			await detected_keplr();

			// polyfill disabled
			if(b_cancel_polyfill) return;

			// destructure data
			const {
				args: a_args,
				id: si_request,
				method: si_method,
			} = g_data;

			// lookup method
			const f_keplr = h_handlers_keplr[si_method];

			// route exists
			if(f_keplr) {
				debug(`Routing Keplr request for '${si_method}': %o`, g_data);
				// invoke method asynchronously
				let w_result: KeplrResponse;
				try {
					w_result = await f_keplr(a_args);
				}
				catch(e_call) {
					w_result = {
						error: (e_call instanceof Error? e_call.message || e_call: e_call)+'',
					};
				}

				// polyfill disabled
				if(b_cancel_polyfill) return;

				// method returned a result or threw an error
				if(w_result) {
					// type-check response
					const g_response: ProxyRequestResponse = {
						id: si_request,
						result: w_result,
						type: 'proxy-request-response',
					};

					if(w_result['error']) {
						warn(`Responding to Keplr '${si_method}' request with error %o`, w_result['error']);
					}
					else {
						debug(`Responding to Keplr '${si_method}' request with result %o`, w_result);

						if('signAmino' === si_method) {
							console.log(JSON.stringify(w_result));
						}
					}

					// respond
					window.postMessage(g_response);
				}
				// otherwise, ignore
				else {
					warn(`Ignoring proxy-request for %o`, g_data);
				}
			}
			// no route exists
			else {
				warn(`Unrouted Keplr proxy request: ${si_method}: %o`, g_data);
			}
		},
	};

	let b_polyfill_executed = false;

	async function inject_keplr_polyfill() {
		// polyfill was cancelled or already executed
		if(b_cancel_polyfill || b_polyfill_executed) return;

		// notify
		debug('Injecting Keplr API polyfill');

		// polyfill was executed
		b_polyfill_executed = true;

		// create another script element to load the relay application
		const dm_script = document.createElement('script');

		// locate keplr script
		const p_keplr = locate_script('assets/src/script/mcs-keplr');

		// not found
		if(!p_keplr) {
			throw new Error('Unable to locate Keplr script!');
		}

		// set the script src
		dm_script.src = chrome.runtime.getURL(p_keplr);

		// import as module
		dm_script.type = 'module';

		// wait for head/body to be constructed
		let c_retries = 0;
		while(!document.body) {
			warn('document.body not ready');
			c_retries++;
			await timeout(0);
			if(c_retries > 1000) {
				throw new Error(`Failed to read from document.body`);
			}
		}

		// set initialization time
		xt_polyfill_init = Date.now();

		// append container element to the live document to initialize iframe's content document
		try {
			document.head.append(dm_script);
		}
		// browser didn't like adding content to head; fallback to using body
		catch(e_append) {
			document.body.append(dm_script);
		}

		// hide element
		await microtask();
		dm_script.remove();
	}


	async function keplr_detected_in_script(dm_script: HTMLScriptElement): Promise<{} | null> {
		// only javascript
		const s_type = dm_script.getAttribute('type');
		if(!s_type || /javascript|^module$/.test(s_type)) {
			// read script string
			let sx_content = dm_script.textContent;

			// no inline script
			if(!sx_content) {
				// src attribute
				const sr_src = dm_script.getAttribute('src');

				// no src either; skip
				if(!sr_src) return null;

				// parse url
				const du_src = new URL(sr_src, location.href);

				// prep response
				let d_res: Response;

				// request
				FETCHING: {
					// same origin
					if(du_src.origin === location.origin) {
						debug(`Fetching page script <${du_src.href}> from cache...`);

						// use cache optimization
						try {
							d_res = await fetch(du_src.href, {
								method: 'GET',
								credentials: 'include',
								mode: 'same-origin',
								redirect: 'follow',
								cache: 'only-if-cached',
							});
						}
						catch(e_fetch) {
							// // firefox content script requests initiate from different context
							// if('Firefox' === G_USERAGENT.browser.name) {

							// retry without cache
							try {
								d_res = await fetch(du_src.href, {
									method: 'GET',
									credentials: 'include',
									mode: 'same-origin',
									redirect: 'follow',
								});

								// do not err
								break FETCHING;
							}
							// catch error and replace
							catch(e_retry) {
								e_fetch = e_retry;
							}

							debugger;
							error(e_fetch as string);
							return null;
						}
					}
					// different origin
					else {
						// ignore
						return null;

						// // fallback to cors mode
						// try {
						// 	d_res = await fetch(p_src, {
						// 		method: 'GET',
						// 		credentials: 'include',
						// 		mode: 'cors',
						// 	});
						// }
						// catch(e_fetch) {
						// 	debugger;
						// 	console.error(e_fetch);
						// 	continue;
						// }
					}
				}

				// response not ok; skip it
				if(!d_res?.ok) return null;

				// load script content as string
				sx_content = await d_res.text();
			}

			// find target string
			// const b_keplr_window = /window(\.keplr|\[['"`]keplr['"`]\])/.test(sx_content);
			const b_keplr_window = RT_KEPLR_DETECTOR.test(sx_content);

			// found
			if(b_keplr_window) {
				return {};
			}

			// try not to block the thread
			await timeout(0);
		}

		return null;
	}


	let b_detected = false;

	async function detected_keplr() {
		await microtask();

		await dp_bootstrap;

		// prevent redundant detection
		if(b_detected) return;
		b_detected = true;

		debug('🛰 Keplr was detected!');

		// start initialization timer
		xt_polyfill_init = Date.now();

		// attempt to create app's profile
		if(!g_profile) {
			try {
				debug(`Creating app profile...`);
				g_profile = await create_app_profile();
			}
			catch(e_create) {}
		}

		// give the script a chance to request advertisement
		await timeout(Math.max(0.5e3, XT_POLYFILL_DELAY - (Date.now() - xt_polyfill_init)));

		// polyfill has been disabled
		if(b_cancel_polyfill) return;

		// notify service
		f_runtime().sendMessage({
			type: 'detectedKeplr',
			value: {
				profile: g_profile || {},
			},
		}, F_NOOP);
	}


	const dp_bootstrap = (async function keplr_compatibility() {
		debug('Running keplr compatibility check');

		const p_host = location.host;
		const s_protocol = location.protocol.replace(/:$/, '') as 'https';

		// check for block
		try {
			// lookup policy
			const g_policy = await Policies.forApp({
				host: p_host,
				scheme: s_protocol,
			});

			// app is blocked by policy
			if(g_policy.blocked) {
				// do not polyfill, do not respond to proxy requests
				b_cancel_polyfill = true;

				// do not proceed with compatibility check
				return;
			}
		}
		catch(e_read) {}

		// synchronous session storage is available
		if(SessionStorage.synchronously) {
			// unconditional polyfill of keplr is enabled; polyfill immediately
			if(SessionStorage.synchronously.get('keplr_polyfill_mode_enabled')) {
				debug(`Polyfilling keplr unconditionally`);

				return void inject_keplr_polyfill();
			}
		}
		// must check setting asynchronously
		else {
			void SessionStorage.get('keplr_polyfill_mode_enabled').then((b_unconditional: boolean) => {
				// polyfill is unconditional; polyfill immediately
				if(b_unconditional) return void inject_keplr_polyfill();
			});
		}

		// wallet is unlocked
		if(await Vault.isUnlocked()) {
			debug('Searching for matching app');

			// find matching app
			const a_apps = await Apps.filter({
				scheme: s_protocol,
				host: p_host,
			});

			// app is already registered
			if(a_apps.length) {
				// ref app
				const g_app = a_apps[0][1];

				// app is enabled
				if(g_app.on) {
					// ref api mode
					const xc_api = g_app.api;

					// Keplr API mode is enabled; cancel detection
					if(AppApiMode.KEPLR === xc_api) {
						g_registered_app = g_app;
						debug(`Exitting detection mode since app is already registered: %o`, g_registered_app);

						// force mcs injection enabled; inject keplr
						if(await PublicStorage.forceMcsInjection()) {
							await inject_keplr_polyfill();
						}
					}
					// another API mode is enabled
					else if(AppApiMode.UNKNOWN !== xc_api) {
						b_cancel_polyfill = true;
						debug(`Cancelling polyfill since app is in alternate mode: %o`, g_app);
					}
					// unknown API mode
					else {
						debug(`App is registered in an unknown API mode`);
					}
				}
				// app is disabled
				else {
					b_cancel_polyfill = true;
					debug(`Cancelling polyfill since app is disabled`);
				}

				// do not attempt to detect keplr
				b_detected = true;
				return;
			}
			else {
				debug(`App is not registered`);
			}
		}
		else {
			debug(`Vault is locked`);
		}

		// attempt to detect keplr
		DETECT_KEPLR: {
			debug('Checking keplr detection mode');

			// fetch Keplr automatic detection setting
			const b_detect_mode = await PublicStorage.keplrDetectionMode();

			debug(`Keplr detection mode is ${b_detect_mode? 'enabled': 'disabled'}`);

			// detection is disabled; exit
			if(!b_detect_mode) return;

			// document not yet loaded
			if(!['interactive', 'complete'].includes(document.readyState)) {
				debug(`Document not ready: ${document.readyState}`);
				await new Promise((fk_resolve) => {
					window.addEventListener('DOMContentLoaded', () => {
						setTimeout(() => {
							fk_resolve(void 0);
						}, 100);
					});
				});
			}

			debug(`Document load complete, ${b_cancel_polyfill? 'but cancelling polyfill': ''}`);

			// polyfill has been disabled
			if(b_cancel_polyfill) break DETECT_KEPLR;

			debug('Attempting to detect Keplr');

			// attempt to find usage (0-1 confidence)
			let x_detected = 0;

			// search all scripts
			for(const dm_script of document.getElementsByTagName('script')) {
				// attempt to detect keplr in script
				if(await keplr_detected_in_script(dm_script)) {
					x_detected = 1;
					break;
				}
			}

			// detected
			if(x_detected) {
				void detected_keplr();
			}
			// not detected
			else {
				debug('Keplr was not detected upon document load. Attaching MutationObserver...');

				// start new mutation observer
				const d_observer = new MutationObserver(async(a_mutations: MutationRecord[]) => {
					// each mutation
					for(const d_mutation of a_mutations) {
						// mutation was to DOM tree
						if('childList' === d_mutation.type) {
							// each node added
							for(const dm_node of d_mutation.addedNodes) {
								// node is a script
								if('SCRIPT' === dm_node.nodeName) {
									// attempt to detect keplr in script
									const b_found = await keplr_detected_in_script(dm_node as HTMLScriptElement);

									// first keplr detection
									if(b_found) {
										// disconnect observer
										d_observer.disconnect();

										// trigger detection
										void detected_keplr();

										// stop searching
										return;
									}
								}
							}
						}
					}
				});

				// start observing
				d_observer.observe(document, {
					childList: true,
					subtree: true,
				});
			}
		}
	})();


	// start listening for messages
	window.addEventListener('message', (d_event) => {
		// // verbose
		// debug('Observed window message %o', d_event);

		// originates from same frame
		if(window === d_event.source) {
			// access event data
			const z_data = d_event.data;

			// data item conforms
			let si_type;
			if(z_data && 'object' === typeof z_data && 'string' === typeof (si_type=z_data.type)) {
				// ref handler
				const f_handler = h_handlers_window[si_type];

				// ignore all other messages
				if(!f_handler) return;

				// debug(`Received relay port message having registered type %o`, z_data);

				// handler is registered; execute it
				f_handler(z_data);
			}
		}
	});
})();
