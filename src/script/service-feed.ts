import type {AbciConfig, ReceiverError} from './service-tx-abcis';

import type {GetLatestBlockResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/query';

import type {AccountStruct} from '#/meta/account';
import type {Dict, JsonObject, Promisable} from '#/meta/belt';
import type {Bech32, ChainPath, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';

import {Snip2xToken} from '#/schema/snip-2x-const';

import {global_broadcast, global_receive, global_wait} from './msg-global';
import {account_abcis} from './service-tx-abcis';

import {syserr} from '#/app/common';
import type {LocalAppContext} from '#/app/svelte';
import type {CosmosNetwork} from '#/chain/cosmos-network';
import type {SecretNetwork} from '#/chain/secret-network';
import {MaxSubscriptionsReachedError, TmJsonRpcWebsocket} from '#/cosmos/tm-json-rpc-ws-const';
import type {TjrwsResult, TjrwsValueNewBlock, TjrwsValueTxResult, WsTxResponse} from '#/cosmos/tm-json-rpc-ws-def';
import type {NotificationConfig} from '#/extension/notifications';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {NetworkTimeoutError, Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';

import {ode, timeout, timeout_exec} from '#/util/belt';
import {buffer_to_base64} from '#/util/data';
import {Limiter} from '#/util/limiter';


const XT_ERROR_THRESHOLD_RESTART = 120e3;
const XT_CONNECTION_TIMEOUT = 10e3;

const NL_WINDOW_BLOCKS = 16;

interface FeedHooks {
	notify?(gc_notify: NotificationConfig, k_feed: NetworkFeed): Promisable<void>;
}

interface TokenState {
	accounts: AccountStruct[];
}

async function average_rtt(g_provider: ProviderStruct, nl_trials=3): Promise<number> {
	const a_trials: number[] = [];

	for(let i_trial=0; i_trial<nl_trials; i_trial++) {
		try {
			const xt_start = performance.now();
			const [, xc_timeout] = await timeout_exec(15e3, async() => await fetch(g_provider.grpcWebUrl+g_provider.healthCheckPath));

			if(xc_timeout) throw new NetworkTimeoutError();

			a_trials.push(performance.now() - xt_start);

			await timeout(50);
		}
		catch(e_fetch) {
			return Infinity;
		}
	}

	return a_trials.reduce((c_out, xt_trial) => c_out + xt_trial) / a_trials.length;
}

const H_FEEDS: Record<ChainPath, NetworkFeed> = {};
const H_FEEDS_TOKENS: Record<ChainPath, NetworkFeed> = {};
export class NetworkFeed {
	static async createAll(gc_feed: FeedHooks): Promise<NetworkFeed[]> {
		// read from chains and providers stores
		const [
			ks_chains,
			ks_providers,
		] = await Promise.all([
			Chains.read(),
			Providers.read(),
		]);

		// list of feed creation promises
		const a_feeds: Promise<NetworkFeed>[] = [];

		// each chain
		for(const [p_chain, g_chain] of ks_chains.entries()) {
			// skip disabled (devnets might not support wgrpc)
			if(!g_chain.on) continue;

			// skip cosmos
			if('/family.cosmos/chain.theta-testnet-001' === p_chain) continue;

			// lock socket for chain
			await navigator.locks.request(`net:feed:${Chains.caip2From(g_chain)}`, async() => {
				// list of contending providers
				const a_contenders: [ProviderPath, ProviderStruct][] = [];

				// each provider
				for(const [p_provider, g_provider] of ks_providers.entries()) {
					// provider serves this chain
					if(p_chain === g_provider.chain) {
						// add to contending list
						a_contenders.push([p_provider, g_provider]);
					}
				}

				// filter chain provider preferences by contenders
				const a_providers: ProviderStruct[] = g_chain.providers
					.filter((p_provider) => {
						// a preferred provider exists
						const i_provider = a_contenders.findIndex(([p]) => p_provider === p);
						if(i_provider >= 0) {
							// remove from contender list
							a_contenders.splice(i_provider, 1);

							return true;
						}

						return false;
					})
					.map(p => ks_providers.at(p)!);

				// append contenders
				const a_contender_structs = a_contenders.map(([, g]) => g);
				a_providers.push(...a_contender_structs);

				// narrow down list of providers that are online
				const a_providers_online: ProviderStruct[] = [];

				// quick provider test
				const a_failures: [ProviderStruct, Error][] = [];
				for(const g_provider of a_providers) {
					// skip disabled provider
					if(!g_provider.on) continue;

					// perform a quick test on provider
					try {
						await Providers.quickTest(g_provider, g_chain);

						// success, add to online list
						a_providers_online.push(g_provider);
					}
					// provider test failed
					catch(e_test) {
						a_failures.push([g_provider, e_test as Error]);
					}
				}

				// prep failure summary
				const s_provider_errors = `Encountered errors on providers:\n\n${a_failures.map(([g, e]) => `${g.name}: ${e.message}`).join('\n\n')}`;

				// no providers passed
				if(!a_providers_online.length) {
					console.error(`All providers failed for ${p_chain}: %o`, a_failures);

					throw syserr({
						title: 'All providers offline',
						text: s_provider_errors,
					});
				}

				// some failures with attempted providers
				if(a_failures.length) {
					console.warn(s_provider_errors);
				}

				// sort non-preferential contenders by latency
				{
					const i_contender = a_providers_online.indexOf(a_contender_structs[0]);

					// reached contenders
					if(0 === i_contender) {
						const hm_latencies = new Map<ProviderStruct, number>();

						for(const g_provider of a_providers_online) {
							let xt_latency = Infinity;

							if(g_provider.healthCheckPath) {
								xt_latency = await average_rtt(g_provider);
							}

							hm_latencies.set(g_provider, xt_latency);
						}

						a_providers_online.sort((g_a, g_b) => hm_latencies.get(g_a)! - hm_latencies.get(g_b)!);
					}
				}

				// final provider selection
				const g_selected = a_providers_online[0];

				// destroy old feed
				H_FEEDS[p_chain]?.destroy?.();

				console.debug(`🌊 Creating network feed for ${Chains.caip2From(g_chain)} on <${g_selected.grpcWebUrl}>`);

				// create new feed for top chain
				const dp_feed = NetworkFeed.create(g_chain, g_selected, gc_feed);

				// create a supplemental feed for tokens only
				{
					H_FEEDS_TOKENS[p_chain]?.destroy?.();
					const k_feed = new NetworkFeed(g_chain, g_selected, gc_feed);
					(async() => {
						await k_feed.open();
						await k_feed.followTokens();
						H_FEEDS_TOKENS[p_chain] = k_feed;
					})();
				}

				a_feeds.push(dp_feed.then(k_feed => H_FEEDS[p_chain] = k_feed));
			});
		}

		// return once they have all resolved
		return await Promise.all(a_feeds);
	}

	static async pickProvider(p_chain: ChainPath, p_provider: ProviderPath, gc_feed: FeedHooks): Promise<NetworkFeed> {
		const g_chain = (await Chains.at(p_chain))!;
		const g_provider = (await Providers.at(p_provider))!;

		H_FEEDS[p_chain]?.destroy?.();

		return await NetworkFeed.create(g_chain, g_provider, gc_feed);
	}

	/**
	 * Creates a network feed for an individual chain+provider
	 * @param g_chain 
	 * @param g_provider 
	 * @param gc_feed 
	 * @returns 
	 */
	static async create(g_chain: ChainStruct, g_provider: ProviderStruct, gc_feed: FeedHooks): Promise<NetworkFeed> {
		// instantiate feed
		const k_feed = new NetworkFeed(g_chain, g_provider, gc_feed);

		// open socket
		await k_feed.open();

		try {
			// follow blocks
			await k_feed.followBlocks();

			// follow all accounts
			await k_feed.followAccounts();

			// // follow fungible tokens
			// await k_feed.followTokens();
		}
		catch(e_follow) {
			console.error(e_follow);
		}


		return k_feed;
	}

	// path to chain resource
	protected _p_chain: ChainPath;

	// path to provider resource
	protected _p_provider: ProviderPath;

	// active network instance
	protected _k_network: CosmosNetwork;

	// filled sockets
	protected _a_sockets_filled: TmJsonRpcWebsocket[] = [];

	// active socket wrapper instance
	protected _kc_socket: TmJsonRpcWebsocket | null = null;

	protected _b_subscriptions_busy = false;
	protected _a_subscriptions_waiting: VoidFunction[] = [];

	protected _as_accounts_following = new Set<Bech32>();

	constructor(protected _g_chain: ChainStruct, protected _g_provider: ProviderStruct, protected _gc_hooks: FeedHooks) {
		// infer paths
		this._p_chain = Chains.pathFrom(_g_chain);
		this._p_provider = Providers.pathFrom(_g_provider);

		// create network
		this._k_network = Providers.activate(_g_provider, _g_chain);
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}

	get provider(): ProviderStruct {
		return this._g_provider;
	}

	get sockets(): Array<TmJsonRpcWebsocket | null> {
		return [...this._a_sockets_filled, this._kc_socket];
	}

	open(fe_socket?: (this: TmJsonRpcWebsocket, e_socket: ReceiverError) => Promisable<void>): Promise<void> {
		const {
			_g_provider,
			_p_provider,
		} = this;

		// nil socket
		if(this._kc_socket) throw new Error(`Websocket resource already exists on NetworkFeed instance`);

		let xt_error_prev = 0;

		function bail(k_this: TmJsonRpcWebsocket, g_error: ReceiverError) {
			// forward error to caller
			if(fe_socket) {
				fe_socket.call(k_this, g_error);
			}
			// no handler in hook, propagate up call stack
			else {
				throw new Error(`Failed to heal from connection error in <${k_this.host}>: ${
					JSON.stringify({
						code: g_error.code,
						reason: g_error.reason,
						wasClean: g_error.wasClean,
					})
				}`);
			}
		}

		return new Promise((fk_resolve, fe_reject) => {
			// socket opened state
			let b_opened = false;

			let f_connected: VoidFunction;

			this._kc_socket = new TmJsonRpcWebsocket(_g_provider, {
				connect() {
					// websocket opened
					b_opened = true;

					f_connected?.();

					// resolve promise
					fk_resolve();
				},

				error(g_error) {
					// socket was never opened; reject promise
					if(!b_opened) return fe_reject(g_error);

					console.error(`Attempting to recover from connection error on <${this.host}>: %o`, g_error);
					// debugger;

					// infrequent error
					if(Date.now() - xt_error_prev > XT_ERROR_THRESHOLD_RESTART) {
						// start waiting for connection
						(async() => {
							// wait for up to 10 seconds for connection to be established
							const [, xc_timeout] = await timeout_exec(XT_CONNECTION_TIMEOUT, () => new Promise(fk_resolve_connect => f_connected = () => {
								// resolve promise
								fk_resolve_connect(1);
							}));

							// timeout
							if(xc_timeout) {
								// destroy the connection
								this.destroy();

								// forward original error to caller
								bail(this, g_error);
							}
						})();

						b_opened = false;

						// attempt to restart the connection automatically
						this.restart();
					}
					else {
						bail(this, g_error);
					}

					xt_error_prev = Date.now();
				},
			});
		});
	}

	/**
	 * Performs a health check on the underlying socket, recreating it if necessary
	 * @param xt_acceptable - max age to consider sockets still awake
	 * @param xt_socket - amount of time to wait for ping response
	 */
	async wake(xt_acceptable=0, xt_socket=Infinity): Promise<void> {
		for(const kc_socket of this.sockets) {
			if(kc_socket) {
				const [, xc_timeout] = await timeout_exec(xt_socket || Infinity, () => kc_socket.wake(xt_acceptable));

				if(xc_timeout) throw new NetworkTimeoutError();
			}
			else {
				throw new Error('Network Feed was already destroyed');
			}
		}
	}

	/**
	 * Recreates the current instance
	 * @returns 
	 */
	async recreate(): Promise<NetworkFeed> {
		// destroy it
		this.destroy();

		// create new feed
		return await NetworkFeed.create(this._g_chain, this._g_provider, this._gc_hooks);
	}

	/**
	 * Destroys the underyling JSON-RPC websocket connection
	 */
	destroy(): void {
		// each socket
		for(const kc_socket of this.sockets) {
			// attempt to destroy the connection
			try {
				kc_socket?.destroy();
			}
			catch(e_destroy) {}
		}

		// reset filled list
		this._a_sockets_filled.length = 0;

		// mark feed destroyed
		this._kc_socket = null;
	}

	async autoSubscribe<w_data extends {}>(a_events: string[], fk_data: (w_data: TjrwsResult<w_data>) => Promisable<void>): Promise<void> {
		const kc_socket = this._kc_socket!;

		// busy waiting for previous subscription
		if(this._b_subscriptions_busy) {
			await new Promise(fk_resolve => this._a_subscriptions_waiting.unshift(fk_resolve as VoidFunction));
		}

		this._b_subscriptions_busy = true;

		try {
			await kc_socket.subscribe<w_data>(a_events, fk_data);
		}
		catch(e_subscribe) {
			if(e_subscribe instanceof MaxSubscriptionsReachedError) {
				this._a_sockets_filled.push(kc_socket);
				this._kc_socket = null;
				await this.open();

				// retry
				await this._kc_socket!.subscribe<w_data>(a_events, fk_data);
			}
		}
		finally {
			this._b_subscriptions_busy = false;
			this._a_subscriptions_waiting.pop()?.();
		}
	}

	/**
	 * Subscribes to NewBlock events
	 */
	async followBlocks(): Promise<void> {
		const {
			_p_chain,
			_p_provider,
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// timestamps of recent blocks
		const a_recents: number[] = [];

		// subscribe to new blocks
		await this.autoSubscribe<TjrwsValueNewBlock>([
			`tm.event='NewBlock'`,
		], (g_result) => {
			// push to recents list
			a_recents.push(Date.now());

			// prune recents
			while(a_recents.length > NL_WINDOW_BLOCKS) {
				a_recents.shift();
			}

			// ref block
			const g_block = g_result.data.value.block;

			// broadcast
			global_broadcast({
				type: 'blockInfo',
				value: {
					header: g_block.header,
					chain: _p_chain,
					provider: _p_provider,
					recents: a_recents,
					txCount: g_block.data.txs.length,
				},
			});
		});
	}

	// async followBroadcasts() {
	// 	const {
	// 		_g_chain,
	// 		_g_provider,
	// 		_p_chain,
	// 		_k_network,
	// 	} = this;

	// 	// nil socket
	// 	if(!this._kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);


	// 	const h_abcis: Dict<AbciConfig> = {
	// 		...tx_abcis(_g_chain, {
	// 			gov: {
	// 				filter: `message.action='submit_proposal'`,

	// 				data() {
	// 					const s_contact = 'Someone';
	// 					const si_prop = '??';
	// 					// TODO: finish

	// 					const g_notify = {
	// 						title: `📄 New Governance Proposal`,
	// 						text: `Proposition ${si_prop}`,
	// 					};
	// 				},
	// 			},
	// 		}),
	// 	};

	// 	const kc_socket = this._kc_socket!;

	// 	await Promise.all(ode(h_abcis).map(([si_event, g_event]) => {
	// 		kc_socket.subscribe(g_event.filter, g_event.hooks.data);
	// 	}))

	// 	for(const [si_event, g_event] of ode(h_abcis)) {

	// 		await this.subscribeTendermintAbci(g_event.filter, g_event.hooks);
	// 	}
	// }

	// async sync(g_account: AccountStruct): Promise<void> {
	// 	const {
	// 		_g_chain,
	// 		_g_provider,
	// 		_p_chain,
	// 		_k_network,
	// 		_gc_hooks,
	// 		_kc_socket,
	// 	} = this;

	// 	const k_feed = this;

	// 	const g_context_vague: LocalAppContext = {
	// 		g_app: G_APP_EXTERNAL,
	// 		p_app: Apps.pathFrom(G_APP_EXTERNAL),
	// 		g_chain: _g_chain,
	// 		p_chain: Chains.pathFrom(_g_chain),
	// 		g_account,
	// 		p_account: Accounts.pathFrom(g_account),
	// 		sa_owner: Chains.addressFor(g_account.pubkey, _g_chain),
	// 	};

	// 	const h_abcis: Dict<AbciConfig> = {
	// 		...account_abcis(_k_network, g_context_vague, (gc_notify) => {
	// 			void _gc_hooks.notify?.(gc_notify, k_feed);
	// 		}),
	// 	};

	// 	for(const [si_event, g_abci] of ode(h_abcis)) {
	// 		// start to synchronize all txs since previous sync height
	// 		const di_synchronize = _k_network.synchronize(g_abci.type, g_abci.filter, g_context_vague.p_account);
	// 		for await(const {g_tx, g_result, g_synced} of di_synchronize) {
	// 			// TODO: don't imitate websocket data, make a canonicalizer for the two different data sources instead

	// 			// imitate websocket data
	// 			const g_value: WsTxResponse = {
	// 				height: g_result.height,
	// 				tx: buffer_to_base64(g_result.tx!.value),
	// 				result: {
	// 					gas_used: g_result.gasUsed,
	// 					gas_wanted: g_result.gasWanted,
	// 					log: g_result.rawLog,
	// 					...g_result,
	// 					events: [],
	// 				},
	// 			};

	// 			// apply
	// 			await g_abci.hooks.data?.call(null, {TxResult:g_value} as unknown as JsonObject, {
	// 				si_txn: g_result.txhash,
	// 				g_synced,
	// 			});
	// 		}
	// 	}
	// }

	get accountsFollowing(): Bech32[] {
		return Array.from(this._as_accounts_following);
	}

	async followAccounts(): Promise<void> {
		// read accounts store
		const a_accounts = await Accounts.entries();

		// get latest block
		const g_latest = await this._k_network.latestBlock();

		// each account (on cosmos)
		await Promise.all(a_accounts.map(([, g_account]) => this.followAccount(g_account, g_latest)));
	}

	async followAccount(g_account: AccountStruct, g_latest: GetLatestBlockResponse|null=null): Promise<Dict<TmJsonRpcWebsocket>> {
		const {
			_g_chain,
			_g_provider,
			_p_chain,
			_k_network,
			_gc_hooks,
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		const k_feed = this;

		const sa_agent = Chains.addressFor(g_account.pubkey, _g_chain);

		this._as_accounts_following.add(sa_agent);

		const g_context_vague: LocalAppContext = {
			g_app: G_APP_EXTERNAL,
			p_app: Apps.pathFrom(G_APP_EXTERNAL),
			g_chain: _g_chain,
			p_chain: Chains.pathFrom(_g_chain),
			g_account,
			p_account: Accounts.pathFrom(g_account),
			sa_owner: sa_agent,
		};

		const h_abcis: Dict<AbciConfig> = {
			...account_abcis(_k_network, g_context_vague, (gc_notify) => {
				void _gc_hooks.notify?.(gc_notify, k_feed);
			}),

			// unbonding: {
			// 	type: 'tx_in',

			// 	filter: [
			// 		`complete_unbonding.delegator='${sa_agent}'`,
			// 	],

			// 	hooks: {
			// 		data() {
			// 			debugger;
			// 			// console.log(`<${_g_provider.rpcHost}> emitted ${si_event} event: %o`, g_data);
			// 		},
			// 	},
			// },
		};

		const h_streams: Dict<TmJsonRpcWebsocket> = {};

		for(const [si_event, g_abci] of ode(h_abcis)) {
			// start listening to events
			const kc_account = await this.autoSubscribe<TjrwsValueTxResult>(g_abci.filter, (g_result) => {
				// call hook with destructured data
				g_abci.hooks.data.call(this, g_result.data.value, {
					si_txn: g_result.events['tx.hash'][0],
				});
			});

			// start to synchronize all txs since previous sync height
			const di_synchronize = _k_network.synchronize(g_abci.type, g_abci.filter, g_context_vague.p_account, g_latest);
			for await(const {g_tx, g_result, g_synced, xg_previous} of di_synchronize) {
				// TODO: don't imitate websocket data, make a canonicalizer for the two different data sources instead

				// imitate websocket data
				const g_value: WsTxResponse = {
					height: g_result.height,
					tx: buffer_to_base64(g_result.tx!.value),
					result: {
						gas_used: g_result.gasUsed,
						gas_wanted: g_result.gasWanted,
						log: g_result.rawLog,
						...g_result,
						events: [],
					},
				};

				// apply
				await g_abci.hooks.data?.call(kc_account, {TxResult:g_value} as unknown as JsonObject, {
					si_txn: g_result.txhash,
					g_synced,
					xg_previous,
				});
			}
		}

		return h_streams;
	}

	async followTokens(): Promise<void> {
		const {
			_p_chain,
			_g_chain,
			_kc_socket,
		} = this;

		const k_self = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// gather set of fungible tokens
		const h_tokens: Record<ContractPath, TokenState> = {};

		// load accounts
		const ks_accounts = await Accounts.read();

		// read contracts store
		const ks_contracts = await Contracts.read();

		// // on non-secret chains
		// await ks_contracts.filterRole(ContractRole.FUNGIBLE, {
		// 	chain: _p_chain,
		// 	on: 1,
		// });

		// on secretwasm
		if(_g_chain.features.secretwasm) {
			// select fungible tokens on this chain that are in use
			const a_candidate_keys = await Secrets.filter({
				type: 'viewing_key',
				on: 1,
				chain: _p_chain,
			});

			// reduce to map
			const hm_tokens = new Map<ContractPath, ContractStruct>();
			for(const g_secret of a_candidate_keys) {
				const p_contract = Contracts.pathFor(_p_chain, g_secret.contract);

				hm_tokens.set(p_contract, ks_contracts.at(p_contract)!);
			}

			// each token
			for(const [p_contract, g_contract] of hm_tokens.entries()) {
				// prep list of accounts that follow this token
				const g_state = h_tokens[p_contract] = {
					accounts: [] as AccountStruct[],
				};

				// list of accounts that should subscribe to this contract
				const a_accounts = g_state.accounts;

				// each account
				for(const [, g_account] of ks_accounts.entries()) {
					// account does not hold this token
					if(!g_account.assets[_p_chain]?.data[g_contract.bech32]) continue;

					// add account to list
					a_accounts.push(g_account);
				}

				// at least one account follows the contract
				if(a_accounts.length) {
					await this._subscribe_contract(g_contract, a_accounts);
				}
			}

			// new token added
			global_receive({
				async tokenAdded({p_contract, p_chain, p_account}) {
					// different chain; ignore
					if(p_chain !== k_self._p_chain) return;

					// load structs
					const [
						g_contract,
						g_chain,
						g_account,
					] = await Promise.all([
						Contracts.at(p_contract),
						Chains.at(p_chain),
						Accounts.at(p_account),
					]);

					const a_viewing_key = await Snip2xToken.viewingKeyFor(g_contract!, g_chain!, g_account!);

					// account does not hold this token
					if(!a_viewing_key) return;

					// add account to existing list of accounts that subscribe to this token
					if(h_tokens[p_contract]) {
						h_tokens[p_contract].accounts.push(g_account!);
					}
					// create new subscription
					else {
						const a_accounts = [g_account!];

						h_tokens[p_contract] = {
							accounts: a_accounts,
						};

						await k_self._subscribe_contract(g_contract!, a_accounts);
					}
				},
			});
		}
	}

	async _subscribe_contract(g_contract: ContractStruct, a_accounts: AccountStruct[]): Promise<void> {
		const {
			_kc_socket,
		} = this;

		// nil socket
		if(!_kc_socket) throw new Error(`No active websocket to subcribe to Tendermint JSON-RPC connection`);

		// prep limiter for checking contract state
		const k_limiter = new Limiter(() => {
			for(const g_account of a_accounts) {
				void this.checkSnip20(g_contract, g_account);
			}
		}, {
			resolution: 90e3,  // 90 second resolution
		});

		// subscribe to new executions
		await this.autoSubscribe<TjrwsValueNewBlock>([
			`wasm.contract_address='${g_contract.bech32}'`,
		], async() => {
			console.debug(`Sending notice to check on ${g_contract.name}`);

			await global_wait('blockInfo', ({chain:p_chain}) => p_chain === this._p_chain, 9e3);

			await timeout(1e3);

			// queue an update on this token for each account that owns it
			void k_limiter.notice();
		});

		// initialize
		void k_limiter.notice();
	}

	/**
	 * Fetch history from snip and update local cache, triggering notifications along the way
	 * @param g_contract 
	 * @param g_account 
	 * @returns 
	 */
	async checkSnip20(g_contract: ContractStruct, g_account: AccountStruct): Promise<void> {
		const {
			_k_network,
		} = this;

		const k_snip20 = Snip2xToken.from(g_contract, _k_network as SecretNetwork, g_account)!;
		if(!k_snip20) {
			console.error(`${g_contract.name} (${g_contract.bech32}) is not a SNIP-20 token`);
			return;
		}

		// transaction history method available on contract
		if(k_snip20.snip21) {
			try {
				await k_snip20.transactionHistory();

				// done
				return;
			}
			catch(e_query) {
				console.warn(`Contract @${g_contract.bech32} might not actually be a SNIP-21: ${e_query}`);
			}
		}

		// fallback to transfer history
		try {
			await k_snip20.transferHistory(16);
		}
		catch(e_query) {
			console.error(e_query);
		}
	}
}
