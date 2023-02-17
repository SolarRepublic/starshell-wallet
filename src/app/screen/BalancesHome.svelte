<script lang="ts">
	import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	
	import type {AccountPath} from '#/meta/account';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {ContractStruct, CoinInfo, FeeConfig, ContractPath, Bech32, ChainPath} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {TxPending} from '#/meta/incident';
	import type {Snip20} from '#/schema/snip-20-def';
	
	import {Snip2xToken, ViewingKeyError} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	import {getContext, onDestroy} from 'svelte';
	
	import {Header, Screen, type Page} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, popup_receive, yw_network, yw_owner, yw_doc_visibility, yw_popup, yw_context_popup, yw_navigator, yw_store_query_cache} from '../mem';
	
	import {request_feegrant} from '../svelte';
	
	import {as_amount, coin_to_fiat} from '#/chain/coin';
	import {amino_to_base} from '#/chain/cosmos-msgs';
	import {FeeGrants} from '#/chain/fee-grant';
	import {address_to_name} from '#/chain/messages/_util';
	import type {SecretNetwork} from '#/chain/secret-network';
	import type {BalanceStruct} from '#/chain/token';
	import {token_balance} from '#/chain/token';
	import {open_window} from '#/extension/browser';
	import {global_receive} from '#/script/msg-global';
	import {XT_SECONDS} from '#/share/constants';
	import {Accounts} from '#/store/accounts';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {Incidents} from '#/store/incidents';
	import type {BalanceBundle} from '#/store/providers';
	import {forever, microtask, ode, remove, timeout_exec} from '#/util/belt';
	import {abort_signal_timeout, open_external_link, qs} from '#/util/dom';
	import {format_amount, format_fiat} from '#/util/format';
	
	import HoldingView from './HoldingView.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import Send from './Send.svelte';
	import TokensAdd from './TokensAdd.svelte';
	import AddressResourceControl from '../frag/AddressResourceControl.svelte';
	import AllowanceResourceControl from '../frag/AllowanceResourceControl.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import PopupNotice from '../popup/PopupNotice.svelte';
	import PopupSolver from '../popup/PopupSolver.svelte';
	import Row from '../ui/Row.svelte';	
    import type { O } from 'ts-toolbelt';
	
	const G_RETRYING_TOKEN = {
		name: 'Retrying...',
	};

	interface AccountBalanceFields {
		// dict of balances for both native assets and fungible tokens
		h_balances: Dict<Promisable<BigNumber>>;

		h_token_balances: Dict<BalanceStruct>;
		h_token_errors: Dict<Error | {
			name?: string;
			message?: string;
		}>;

		// token load states
		h_token_states: Dict<{
			loading: boolean;
			retries: number;
		}>;

		// native balances
		a_balances: [string, CoinInfo, Coin][];

		// dict of fiat equivalents 
		h_fiats: Dict<Promise<BigNumber>>;

		// account's total worth in selected fiat
		dp_total: Promisable<string>;

		// list of coin ids that are empty and normally used as gas tokens
		a_no_gas: string[];

		// track which tokens have outgoing txs pending
		h_pending_txs: Record<Bech32, JsonObject>;

		// keep list of testnet tokens for batch minting
		a_mintable: ContractStruct[];

		// load all token defs from store belonging to current account
		a_tokens_display: ContractPath[];
		a_tokens: ContractStruct[];

		// identify assets currently loaded
		si_assets_cached: string;
	}

	// get page from context
	const k_page = getContext<Page>('page');
	
	// [account+chain]-specific fields
	const h_fields: Record<`${AccountPath}\n${ChainPath}`, AccountBalanceFields> = {};

	// --- <fields> ---

	// dict of balances for both native assets and fungible tokens
	let h_balances: Dict<Promisable<BigNumber>> = {};

	let h_token_balances: Dict<O.Merge<{
		b_from_cache?: boolean;
	}, O.Optional<BalanceStruct, 's_worth' | 'yg_worth' | 's_fiat' | 'yg_fiat'>>> = {};

	let h_token_errors: Dict<Error | {
		name?: string;
		message?: string;
	}> = {};

	let h_token_states: Dict<{
		loading: boolean;
		retries: number;
	}> = {};

	// native balances
	let a_balances: [string, CoinInfo, Coin][] = [];

	// dict of fiat equivalents
	let h_fiats: Dict<Promise<BigNumber>> = {};

	// account's total worth in selected fiat
	let dp_total: Promisable<string> = forever('');

	// list of coin ids that are empty and normally used as gas tokens
	let a_no_gas: string[] = [];

	// track which tokens have outgoing txs pending
	let h_pending_txs: Record<Bech32, JsonObject> = {};

	// keep list of testnet tokens for batch minting
	let a_mintable: ContractStruct[] = [];

	// load all token defs from store belonging to current account
	let a_tokens_display: ContractPath[] = [];
	let a_tokens: ContractStruct[] = [];
	
	// identify assets currently loaded
	let si_assets_cached = '';


	// --- </fields> ---


	const d_intersection = new IntersectionObserver(async(a_intersections: IntersectionObserverEntry[]) => {
		const ks_contracts = await Contracts.read();

		for(const g_intersection of a_intersections) {
			// ignore non-intersecting events
			if(!g_intersection.isIntersecting) continue;

			// ref target element
			const dm_target = g_intersection.target;

			// contract contract path
			// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
			const p_contract = (dm_target.closest('[data-contract-path]') as HTMLElement).dataset.contractPath as ContractPath;

			// load contract struct
			const g_contract = ks_contracts.at(p_contract)!;

			// token already loading
			if(h_token_states[g_contract.bech32]?.loading) continue;

			// init load token balance
			void load_token_balance(g_contract);
		}
	}, {
		root: qs(document.body, '.viewport'),
		rootMargin: '0px 0px 64px 0px',
	});

	// make type-safe version of owner bech32
	let sa_owner: Bech32 = $yw_owner!;
	$: sa_owner = $yw_owner!;

	// fields handle
	let g_fields: AccountBalanceFields = h_fields[$yw_account_ref+'\n'+$yw_chain_ref] = {
		h_balances,
		h_token_balances,
		h_token_errors,
		h_token_states,
		a_balances,
		h_fiats,
		dp_total,
		a_no_gas,
		h_pending_txs,
		a_mintable,
		a_tokens_display,
		a_tokens,
		si_assets_cached,
	};

	// cached state
	let si_state_cached = '';

	let b_loading_natives = true;

	// tokens loading flag
	let b_loading_tokens = false;

	// best testnet faucet for a given chain
	const h_best_faucets: Record<ChainPath, string> = {};
	let p_best_faucet = '';

	// switch field state to a new or previously cached one
	function switch_fields() {
		// new state identifier
		const si_state = $yw_account_ref+'\n'+$yw_chain_ref;

		// determine if this is a change of state
		let b_change = si_state !== si_state_cached;

		// save current fields
		Object.assign(g_fields, {
			h_balances,
			h_token_balances,
			h_token_errors,
			h_token_states,
			a_balances,
			h_fiats,
			dp_total,
			a_no_gas,
			h_pending_txs,
			a_mintable,
			a_tokens_display,
			a_tokens,
			si_assets_cached,
		});

		// load existing fields of new account
		g_fields = h_fields[si_state];

		// none existing; create new
		if(!g_fields) {
			g_fields = h_fields[si_state] = {
				h_balances: {},
				h_token_balances: {},
				h_token_errors: {},
				h_token_states: {},
				a_balances: [],
				h_fiats: {},
				dp_total: forever(''),
				a_no_gas: [],
				h_pending_txs: {},
				a_mintable: [],
				a_tokens_display: [],
				a_tokens: [],
				si_assets_cached: '',
			};

			// save new flag
			b_change = true;
		}

		// save statey
		si_state_cached = si_state;

		// reactively assign
		({
			h_balances,
			h_token_balances,
			h_token_errors,
			h_token_states,
			a_balances,
			h_fiats,
			dp_total,
			a_no_gas,
			h_pending_txs,
			a_mintable,
			a_tokens_display,
			a_tokens,
			si_assets_cached,
		} = g_fields);

		// reload all
		if(b_change) {
			void update_remote();
		}
	}

	// allows for updating the account without trigerring a ui reload
	let c_ignore_account_update = 0;

	const a_unsubscribes = [
		// upon chain change
		yw_chain.subscribe((g_chain) => {
			// new chain is testnet with faucets
			if(Object.keys(g_chain.testnet?.faucets || {}).length) {
				// load cached best faucet
				p_best_faucet = h_best_faucets[yw_chain_ref.get()];

				// none yet, find the best faucet
				if(!p_best_faucet) {
					// reset faucet to default
					p_best_faucet = Object.keys(g_chain.testnet!.faucets!)[0];

					// attempt to find best faucet
					void best_faucet().then(p => p_best_faucet = h_best_faucets[yw_chain_ref.get()] = p);
				}
			}
		}),

		// upon network change; reload fields
		yw_network.subscribe(() => {
			switch_fields();
		}),

		// upon account update or change
		yw_account.subscribe(() => {
			// ignore this update
			if(c_ignore_account_update > 0) {
				c_ignore_account_update--;
				return;
			}

			// switch fields
			switch_fields();
		}),

		(() => {
			const XT_WINDOW = 750;
			const N_THRESHOLD = 10;

			let xt_prev = 0;
			let c_trips = 0;
			let i_trip = 0;
			let b_unlocked = false;

			function quick_trip() {
				// do nothing if the user just unlocked it
				if(b_unlocked) return;

				clearTimeout(i_trip);

				const xt_now = Date.now();

				if(!c_trips || xt_now - xt_prev < XT_WINDOW) {
					if(N_THRESHOLD === ++c_trips) {
						b_unlocked = true;
						setTimeout(() => {
							b_unlocked = false;
						}, 5e3);

						if(k_page === $yw_navigator.activePage) {
							// $yw_popup = PopupSolver;
							void open_window(chrome.runtime.getURL('src/entry/navigation.html'), {
								popout: true,
								height: 75 + 26,
							});
						}
					}

					console.log(c_trips);
				}

				xt_prev = xt_now;

				i_trip = window.setTimeout(() => {
					console.warn(`Missing it`);
					c_trips = 0;
				}, XT_WINDOW);
			}

			let b_down = false;
			const f_listener_down = (d_event) => {
				if(!b_down && 'Shift' === d_event.key) {
					b_down = true;
					quick_trip();
				}
			};

			const f_listener_up = (d_event) => {
				if(b_down && 'Shift' === d_event.key) {
					b_down = false;
				}
			};

			document.addEventListener('keydown', f_listener_down);
			document.addEventListener('keyup', f_listener_up);

			return () => {
				document.removeEventListener('keydown', f_listener_down);
				document.removeEventListener('keyup', f_listener_up);
			};
		})(),
	];

	onDestroy(() => {
		for(const f_unsubscribe of a_unsubscribes) {
			f_unsubscribe();
		}
	});

	// whenever the fiats dict is updated, begin awaiting for all to resolve
	$: if(h_fiats) {
		void navigator.locks.request('ui:holdings:total-balance', () => timeout_exec(30e3, async() => {
			let p_account = $yw_account_ref;
			let g_account = $yw_account;
			const p_chain = $yw_chain_ref;

			// account change
			if(p_account !== Accounts.pathFrom(g_account)) {
				g_account = await yw_account.nextUpdate();
				p_account = Accounts.pathFrom(g_account);
			}

			// resolve all fiat promises
			const a_fiats = await Promise.all(ode(h_fiats).map(([, dp_fiat]) => dp_fiat));

			// no fiats yet; wait for some to populate
			if(!a_fiats.length) return;

			// reduce to sum
			const yg_total = a_fiats.reduce((yg_sum, yg_balance) => yg_sum.plus(yg_balance), BigNumber(0));

			// format to string and resolve
			const s_total = dp_total = format_fiat(yg_total.toNumber(), 'usd');

			// save to cache if different
			if(s_total !== g_account.assets[p_chain]?.totalFiatCache) {
				// commit to accounts store
				void Accounts.update(p_account, (_g_account) => {
					// do not react to the next account store update
					c_ignore_account_update++;

					return {
						assets: {
							..._g_account.assets,
							[p_chain]: {
								..._g_account.assets[p_chain],
								totalFiatCache: dp_total,
							},
						},
					};
				});
			}
		}));
	}

	let c_updates = 0;
	{
		// react to page visibility changes
		yw_doc_visibility.subscribe((s_state) => {
			if('visible' === s_state) {
				c_updates += 1;
			}
		});

		// // react to switch changes
		// yw_account.subscribe(() => c_updates++);
		// yw_chain.subscribe(() => c_updates++);
		// yw_network.subscribe(() => c_updates++);


		const f_unregister = global_receive({
			async txSuccess() {
				await reload_native_balances();
			},

			async coinReceived({p_chain, sa_recipient}) {
				if(p_chain !== $yw_chain_ref || sa_recipient !== $yw_owner) return;

				await reload_native_balances();
			},

			async coinSent({p_chain, sa_sender}) {
				if(p_chain !== $yw_chain_ref || sa_sender !== $yw_owner) return;

				await reload_native_balances();
			},

			async tokenAdded({p_chain, p_account, sa_contract, p_contract}) {
				if(p_chain !== $yw_chain_ref || p_account !== $yw_account_ref) return;

				const g_contract = await Contracts.at(p_contract);

				await update_remote(true);

				await load_token_balance(g_contract!);

				delete h_pending_txs[sa_contract];
				h_pending_txs = h_pending_txs;
			},

			async feegrantReceived({p_chain, sa_grantee}) {
				if(p_chain !== $yw_chain_ref || sa_grantee !== $yw_owner) return;

				await check_fee_grants();
			},

			async fungibleReceived({p_chain, sa_recipient}) {
				if(p_chain !== $yw_chain_ref || sa_recipient !== $yw_owner) return;

				await update_remote(true);
			},
		});

		onDestroy(() => {
			f_unregister();
		});
	}

	// fetch all bank balances for current account
	async function reload_native_balances() {
		b_loading_natives = true;

		// reset locals
		h_balances = {};
		h_fiats = {};
		dp_total = forever('');

		// network not yet available; wait for it to update
		if(!yw_network.get()) await yw_network.nextUpdate();

		// attempt to load all bank balances from network
		let h_balances_native: Dict<BalanceBundle>;
		try {
			h_balances_native = await $yw_network.bankBalances($yw_owner!);
		}
		// network error
		catch(e_network) {
			// no longer loading
			b_loading_natives = false;

			// orderly error
			if(e_network instanceof Error) {
				// provider offline
				if(e_network.message.includes('Response closed without headers')) {
					// test network connectivity
					const d_abort = new AbortController();
					let xc_aborted = 0;
					try {
						[, xc_aborted] = await timeout_exec(15e3, async() => await fetch('https://ping.starshell.net', {
							signal: d_abort.signal,
						}));

						if(xc_aborted) {
							d_abort.abort();

							// merge with network error code path
							throw new Error();
						}
					}
					// network error
					catch(e_fetch) {
						syserr({
							title: 'Internet Connection Error',
							text: `It appears that your device is not connected to the internet, or traffic is being blocked to API providers and network health checkers.`,
						});

						// abort
						return a_balances = [];
					}

					// ref provider struct
					const g_provider = $yw_network.provider;

					syserr({
						title: 'Network Error',
						text: `Your network provider "${g_provider.name}" is offline: <${g_provider.grpcWebUrl}>`,
					});
				}
				// other network error
				else {
					debugger;

					syserr({
						title: 'Network Error',
						text: `While trying to retrieve your account balance on ${yw_network.get().chain.name}: ${e_network.metadata?.statusCode}`,
					});
				}
			}
			// other
			else {
				syserr({
					title: 'Unknown Error',
					text: e_network+'',
				});
			}

			// no balances available
			return a_balances = [];
		}

		// prep output
		const a_outs: [string, CoinInfo, Coin][] = [];

		// reset no-gas tracker
		a_no_gas.length = 0;

		const a_no_gas_tmp: string[] = [];

		// each coin returned in balances
		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			const g_bundle = h_balances_native[si_coin];

			// parse balance
			const yg_balance = BigNumber(g_bundle?.balance.amount || '0');

			// save to dict
			h_balances[si_coin] = yg_balance;

			// missing or zero balance
			if(yg_balance.eq(0)) {
				// coin is a gas token
				if(Chains.allFeeCoins($yw_chain).find(([si]) => si === si_coin)) {
					a_no_gas_tmp.push(si_coin);
				}

				// set balance (no need to fetch worth of coin)
				h_fiats[si_coin] = Promise.resolve(BigNumber(0));
			}
			// non-zero balance
			else {
				// asynchronously convert to fiat
				h_fiats[si_coin] = coin_to_fiat(g_bundle.balance, $yw_chain.coins[si_coin]);
			}

			// add to outputs
			a_outs.push([
				si_coin,
				$yw_chain.coins[si_coin],
				g_bundle?.balance || {amount:'0', denom:g_coin.denom},
			]);
		}

		// done loading
		b_loading_natives = false;

		// update balances field
		a_balances = a_outs;

		// trigger update on balances and fiats dicts
		h_balances = h_balances;
		h_fiats = h_fiats;

		try {
			await check_fee_grants(a_no_gas_tmp);
		}
		catch(e_query) {}

		// update gas
		a_no_gas = a_no_gas_tmp;
	}


	let k_fee_grants: FeeGrants | undefined;

	let a_gas_grants: string[] = [];
	let s_grant_status = 'Loading allowances...';
	let s_grant_summary = '';

	async function check_fee_grants(a_tmp: string[]=[]) {
		k_fee_grants = await FeeGrants.forAccount($yw_account, $yw_network);

		// clear list from previous load
		a_gas_grants.length = 0;

		const h_grants = k_fee_grants.grants;

		const a_grant_coins: string[] = [];

		// each gas coin
		for(const [si_coin] of Chains.allFeeCoins($yw_chain)) {
			const g_grant = h_grants[si_coin];

			// non-zero grant amount
			if(g_grant?.amount.gt(0)) {
				// remove coin from no gas list
				if(a_tmp.includes(si_coin)) remove(a_tmp, si_coin);

				const a_granters = g_grant.grants.map(g => g.allowance.granter);
				let s_granters = 'multiple parties';
				if(1 === a_granters.length) {
					s_granters = await address_to_name(a_granters[0] as Bech32, $yw_chain);
					s_granters = s_granters.replace(/fee-?grant|faucet$/gi, '').trim();
				}

				a_gas_grants.push(`Fees granted by ${s_granters}: ${format_amount(g_grant.amount.toNumber())} ${si_coin}`);
				a_grant_coins.push(si_coin);
			}
		}

		// single coin allowance
		if(1 === a_gas_grants.length) {
			s_grant_status = '';
			s_grant_summary = a_gas_grants[0];
		}
		// multiple coins
		else if(a_gas_grants.length > 1) {
			s_grant_status = '';
			s_grant_summary = `Able to spend allowances for ${a_grant_coins.join(', ')}`;
		}
		// no allowances
		else {
			s_grant_status = 'No allowances granted to this account';
		}

		// reactive assign
		a_gas_grants = a_gas_grants;
	}

	// 
	async function reload_tokens(b_remote=false) {
		// load assets from account struct
		const g_assets = $yw_account?.assets?.[$yw_chain_ref];

		// hash assets
		const si_state = $yw_account_ref+'\n'+$yw_chain_ref;
		const si_assets = si_state+'\n'+JSON.stringify(g_assets?.fungibleTokens?.slice()?.sort() || []);

		// something changed (most likely new token added)
		const b_change = si_assets !== si_assets_cached;

		// exact same; do nothing
		if(!b_remote && si_assets === si_assets_cached) return;

		// replace cache identifier
		si_assets_cached = si_assets;

		// reset pending txs
		h_pending_txs = {};

		// reset mintable tokensr
		a_mintable = [];

		// reset fiats
		h_fiats = {};

		// no assets
		if(!g_assets) return a_tokens = [];

		// start loading
		b_loading_tokens = true;

		// ref contract addresses
		const a_bech32s = g_assets?.fungibleTokens || [];

		// render contract addresses
		const a_contract_paths = a_bech32s.map(sa => Contracts.pathFor($yw_chain_ref, sa));

		// read contracts store
		const ks_contracts = await Contracts.read();

		// update tokens list
		a_tokens = a_contract_paths.map(p => ks_contracts.at(p)!);

		// h_token_balances = {};
		// h_token_balances = fold(a_tokens, g_token => ({
		// 	[g_token.bech32]: forever<BalanceStruct>(),
		// }));

		// pending transactions
		{
			// load pending incidents
			const a_pending = await Incidents.filter({
				type: 'tx_out',
				stage: 'pending',
				account: $yw_account_ref,
				chain: $yw_chain_ref,
			});

			// each pending outgoing tx
			for(const g_pending of a_pending) {
				// ref events
				const h_events = (g_pending.data as TxPending).events;

				// each indexed execution event; associate by contract address
				for(const g_exec of h_events.executions || []) {
					h_pending_txs[g_exec.contract] = g_exec.msg;
				}
			}
		}

		// recent transactions
		{
			// load recent
			const a_recent = await Incidents.filter({
				type: 'tx_out',
				stage: 'synced',
				account: $yw_account_ref,
				chain: $yw_chain_ref,
			});

			// each recent outgoing tx
			const xt_recent = Date.now() - (12.5 * XT_SECONDS);
			for(const g_recent of a_recent) {
				if(g_recent.time <= xt_recent) continue;

				// ref events
				const h_events = (g_recent.data as TxPending).events;

				// each indexed execution event; associate by contract address
				for(const g_exec of h_events.executions || []) {
					h_pending_txs[g_exec.contract] = g_exec.msg;
				}
			}
		}

		// update pending txs
		h_pending_txs = h_pending_txs;

		// set token display list
		a_tokens_display = a_tokens.map(g => Contracts.pathFrom(g));

		// done loading
		b_loading_tokens = false;

		// each token
		for(const g_token of a_tokens) {
			const sa_contract = g_token.bech32;

			// skip pending
			if(h_pending_txs[sa_contract]) continue;

			// not remote and already has balance; skip
			if(!b_remote && h_token_balances[sa_contract]) continue;
		}
	}

	// fetch an individual token's current balance
	async function load_token_balance(g_contract: ContractStruct) {
		// ref token address
		const sa_token = g_contract.bech32;

		const h_cache = $yw_store_query_cache?.at(`${Chains.caip2For(g_contract.chain)}:${sa_owner}`) || {};
		const s_amount = h_cache[`${sa_token}:balance`]?.data?.amount as string;

		if(s_amount) {
			h_token_balances[sa_token] = {
				b_from_cache: true,
				s_amount,
				yg_amount: new BigNumber(s_amount).shiftedBy(g_contract.interfaces.snip20?.decimals),
			};
			h_token_balances = h_token_balances;
		}
		else if(h_token_balances[sa_token]) {
			delete h_token_balances[sa_token];
			h_token_balances = h_token_balances;
		}

		if(h_token_errors[sa_token]) {
			delete h_token_errors[sa_token];
			h_token_errors = h_token_errors;
		}

		Object.assign(h_token_states[sa_token] = h_token_states[sa_token] || {
			retries: -1,
		}, {
			loading: true,
		});

		try {
			// indicate that token fiat is loading
			let fk_fiat: (yg_fiat: BigNumber) => void;
			h_fiats[sa_token] = new Promise(fk => fk_fiat = fk);

			// let other tokens create dict entry, then trigger reactive update to fiats dict
			await microtask();
			h_fiats = h_fiats;

			// load token balance
			const g_balance = await token_balance(g_contract, $yw_account, $yw_network);

			if(g_balance) {
				// set balance
				h_balances[sa_token] = g_balance.yg_amount;

				// reactively assign
				h_balances = h_balances;

				h_token_balances[sa_token] = g_balance;
				h_token_balances = h_token_balances;

				// set fiat promise
				void g_balance.yg_fiat.then(yg => fk_fiat(yg));

				// determine if it is mintable
				if(g_balance.yg_amount.eq(0) && $yw_network.chain.testnet) {
					const k_token = Snip2xToken.from(g_contract, $yw_network as SecretNetwork, $yw_account);
					void k_token?.mintable().then((b_mintable) => {
						if(b_mintable && !a_mintable.find(g => g.bech32 === g_contract.bech32)) {
							a_mintable = a_mintable.concat([g_contract]);
						}
					});
				}

				return;
			}
			// no balance; load forever
			else {
				fk_fiat!(BigNumber(0));
			}
		}
		catch(e_load) {
			h_token_states[sa_token].retries += 1;
			h_token_errors[sa_token] = e_load;
			h_token_errors = h_token_errors;
		}
	}



	async function update_remote(b_force_account=false) {
		// forcefully reload account
		if(b_force_account) await yw_account.invalidate();

		await Promise.all([
			reload_native_balances(),
			reload_tokens(true),
		]);

		// // trigger ui update
		// c_updates++;
	}

	async function mint_tokens() {
		if($yw_chain.features.secretwasm) {
			// ref chain
			const g_chain = $yw_chain;

			// mint message
			const a_msgs_proto = await Promise.all(a_mintable.map(async(g_contract) => {
				const g_msg: Snip20.MintableMessageParameters<'mint'> = {
					mint: {
						amount: BigNumber(1000).shiftedBy(g_contract.interfaces.snip20!.decimals).toString() as Cw.Uint128,
						recipient: $yw_owner as Cw.Bech32,
					},
				};

				// prep snip-20 exec
				const g_exec = await $yw_network.encodeExecuteContract($yw_account, g_contract.bech32, g_msg, g_contract.hash);

				// convert to proto message for signing
				return amino_to_base(g_exec.amino).encode();
			}));

			// prep proto fee
			const gc_fee: FeeConfig = {
				limit: BigInt($yw_chain.features.secretwasm!.snip20GasLimits.mint) * BigInt(a_msgs_proto.length),
			};

			k_page.push({
				creator: RequestSignature,
				props: {
					protoMsgs: a_msgs_proto,
					fee: gc_fee,
					broadcast: {},
					local: true,
				},
				context: {
					chain: g_chain,
					accountPath: $yw_account_ref,
					app: G_APP_STARSHELL,
				},
			});
		}
	}

	// perform tests to deduce best faucet based on availability
	async function best_faucet(): Promise<string> {
		const a_faucets = Object.keys($yw_chain.testnet?.faucets || {});

		// ping each faucet to find best one
		try {
			// bias StarShell since it gives 100 SCRT and no IP limiting
			try {
				const d_res_0 = await fetch(a_faucets[0], {
					headers: {
						accept: 'text/html',
					},
					method: 'HEAD',
					credentials: 'omit',
					cache: 'no-store',
					referrer: '',
					mode: 'no-cors',
					redirect: 'error',
					signal: abort_signal_timeout(2e3).signal,
				});

				return d_res_0.url;
			}
			catch(e_req) {}

			// send preflight requests
			const d_res = await Promise.any(a_faucets.map(async p => fetch(p, {
				headers: {
					accept: 'text/html',
				},
				method: 'HEAD',
				credentials: 'omit',
				cache: 'no-store',
				referrer: '',
				mode: 'no-cors',
				redirect: 'error',
				signal: abort_signal_timeout(6e3).signal,
			})));

			// return first valid response
			return d_res.url;
		}
		// ignore network errors and timeouts
		catch(e) {}

		// default to original
		return a_faucets[0];
	}

	let b_requesting_feegrant = false;
	async function do_request_feegrant() {
		b_requesting_feegrant = true;

		try {
			await request_feegrant(sa_owner);
		}
		finally {
			b_requesting_feegrant = false;
		}
	}

	async function drop_row(d_event: CustomEvent<{
		src: {
			p_resource: ContractPath;
		};
		dst: {
			p_resource: ContractPath;
		};
		relation: -1 | 0 | 1;
	}>) {
		const {
			src: {
				p_resource: p_contract_src,
			},
			dst: {
				p_resource: p_contract_dst,
			},
			relation: xc_above_below,
		} = d_event.detail;

		const i_src = a_tokens_display.indexOf(p_contract_src);
		const i_dst = a_tokens_display.indexOf(p_contract_dst);

		// cut src
		a_tokens_display.splice(i_src, 1);
		a_tokens.splice(i_src, 1);

		// fix ins position
		const i_ins = i_dst > i_src
			? -1 === xc_above_below
				? i_dst - 1
				: i_dst
			: 1 === xc_above_below
				? i_dst + 1
				: i_dst;

		// reinsert
		a_tokens_display.splice(i_ins, 0, p_contract_src);
		const g_contract = await Contracts.at(p_contract_src);
		a_tokens.splice(i_ins, 0, g_contract!);

		// update display
		a_tokens_display = a_tokens_display;
		a_tokens = a_tokens;

		// save token display order to account storage
		await Accounts.update($yw_account_ref, (g_account) => {
			// ref latest list
			const a_tokens_latest = g_account.assets[$yw_chain_ref]?.fungibleTokens || [];

			// prep replacement
			const a_tokens_replace = a_tokens.map(g => g.bech32);

			// ensure that the data is identical
			const sx_latest = JSON.stringify(a_tokens_latest.sort());
			const sx_display = JSON.stringify(a_tokens_replace.slice().sort());
			if(sx_latest !== sx_display) {
				throw syserr({
					title: 'Failed to reorder',
					text: 'Cached display list mismatch',
				});
			}

			// do not react to the next account store update
			c_ignore_account_update++;

			// apply update
			return {
				assets: {
					...g_account.assets,
					[$yw_chain_ref]: {
						...g_account.assets[$yw_chain_ref],
						fungibleTokens: a_tokens_replace,
					},
				},
			};
		});
	}

	(async function load() {
		// network not yet available, wait it to update
		if(!yw_network.get()) await yw_network.nextUpdate();

		await update_remote();
	})();
</script>

<style lang="less">
	@import '../_base.less';

	.testnet-reminder {
		.font(tiny);
		text-align: center;
		color: var(--theme-color-text-med);
		transform: scaleX(1.25);
		margin-bottom: calc(0px - var(--ui-padding) - var(--inline-padding));
	}

	.subinfo {
		border-top: 1px solid var(--theme-color-border);
		padding-top: var(--ui-padding);
	}

	.no-gas {
		display: flex;
		flex-direction: column;
		gap: var(--inline-padding);
		.message {
			.font(tiny);
		}
	}

	.owner-address {
	}

	.grant-status {
		color: var(--theme-color-text-med);
	}
</style>

<Screen debug='BalancesHome' nav root keyed>
	<Header search network account on:update={() => c_updates++}>
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	{#if $yw_chain.testnet}
		<div class="testnet-reminder no-margin">
			TESTNET
		</div>
	{/if}

	{#key c_updates}
		<Portrait
			noPfp
			title={dp_total}
			subtitle={$yw_account.name}
			resource={$yw_account}
			resourcePath={$yw_account_ref}
			actions={{
				send: {
					label: 'Send',
					trigger() {
						k_page.push({
							creator: Send,
							props: {
								from: $yw_account,
							},
						});
					},
				},
				recv: {
					label: 'Receive',
					trigger() {
						popup_receive($yw_account_ref);
					},
				},
				add: {
					label: 'Add Token',
					trigger() {
						k_page.push({
							creator: TokensAdd,
						});
					},
				},
			}}
		/>

		<!-- {#key $yw_chain} -->
			{#if !a_gas_grants.length && a_no_gas.length}
				<div class="no-gas text-align_center subinfo">
					<div class="message">
						<span class="warning">Warning:</span> you don't have any {$yw_chain.testnet? 'testnet ':''}{a_no_gas.join(' or ')} to pay gas fees.
					</div>

					<div class="buttons">
						<!-- chain is testnet, link to faucet -->
						{#if $yw_chain.testnet}
							<button class="pill" on:click={() => open_external_link(p_best_faucet)}>Get {a_no_gas.join(' or ')} from faucet</button>
						{:else if Object.keys($yw_chain.mainnet?.feegrants || {}).length}
							<button class="pill" on:click={() => do_request_feegrant()} disabled={b_requesting_feegrant}>
								{#if b_requesting_feegrant}
									Requesting allowance...
								{:else}
									Request fee allowance
								{/if}
							</button>
						{:else}
							<button class="pill">
								Buy {a_no_gas.join(' or ')}
							</button>
						{/if}
					</div>
				</div>
			{:else if a_mintable.length > 1}
				<div class="zero-balance-tokens text-align_center subinfo">
					<div class="message">
						Want to mint all of your testnet tokens?
					</div>

					<div class="buttons">
						<button class="pill" on:click={() => mint_tokens()}>
							Mint {a_mintable.length} tokens.
						</button>
					</div>
				</div>
			{/if}

			<!-- <div class="owner-address subinfo">
				<Address address={$yw_owner} copyable='icon' />
			</div> -->

			<div class="group" style="margin-bottom:-14px;">
				{#if sa_owner}
					<AddressResourceControl address={sa_owner} />
				{/if}

				<AllowanceResourceControl>
					{#if s_grant_status}
						<span class="grant-status">
							{s_grant_status}
						</span>
					{:else}
						{s_grant_summary}
					{/if}
				</AllowanceResourceControl>
			</div>

		<!-- {/key} -->
		
		<!-- {#key $yw_network || $yw_owner} -->
		<div class="rows no-margin border-top_black-8px">
			<!-- fetch native coin balances, display known properties while loading -->
			{#if b_loading_natives}
				<!-- each known coin -->
				{#each ode($yw_chain.coins) as [si_coin, g_bundle]}
					<!-- cache holding path -->
					{@const p_entity = Entities.holdingPathFor(sa_owner, si_coin)}
					<Row lockIcon detail='Native Coin' postnameTags
						resource={$yw_chain}
						resourcePath={p_entity}
						name={si_coin}
						pfp={$yw_chain.pfp}
						amount={forever('')}
						on:click={() => {
							k_page.push({
								creator: HoldingView,
								props: {
									holdingPath: p_entity,
								},
							});
						}}
					/>
				{/each}
			<!-- all bank balances loaded -->
			{:else}
				<!-- each coin -->
				{#each a_balances as [si_coin, g_coin, g_balance] (si_coin)}
					<!-- cache holding path -->
					{@const p_entity = Entities.holdingPathFor(sa_owner, si_coin)}
					<Row lockIcon detail='Native Coin' postnameTags
						resource={$yw_chain}
						resourcePath={p_entity}
						name={si_coin}
						pfp={$yw_chain.pfp}
						amount={as_amount(g_balance, g_coin)}
						fiat={h_fiats[si_coin]?.then(yg => format_fiat(yg.toNumber(), 'usd')) || forever('')}
						on:click={() => {
							k_page.push({
								creator: HoldingView,
								props: {
									holdingPath: p_entity,
								},
							});
						}}
					>
					</Row>
				{/each}
			{/if}

			<!-- fetch fungible token defs -->
			{#if b_loading_tokens}
				<Row
					name={forever('')}
					amount={forever('')}
				/>
			{:else}
				<!-- each token -->
				{#each a_tokens.filter(g => !!g.interfaces?.['snip20']) as g_token (g_token.bech32)}
					{@const sa_token = g_token.bech32}
					
					<!-- failed to fetch balance -->
					{#if h_token_errors[sa_token]}
						<!-- viewing key error -->
						{#if h_token_errors[sa_token] instanceof ViewingKeyError}
							<TokenRow contract={g_token} error={'Viewing Key Error'} on:click_error={() => {
								k_page.push({
									creator: TokensAdd,
									props: {
										suggested: [g_token],
									},
								});
							}}
								s_debug='vk'/>
						<!-- unknown error -->
						{:else}
							{@const g_error = h_token_errors[sa_token]}
							{@const g_state = h_token_states[sa_token] || {retries:0}}
							{@const s_error_text = G_RETRYING_TOKEN === g_error || g_state.retries <= 1
								? 'Error' === g_error.name? 'Retry': g_error.name || g_error.message || 'Retry'
								: 'Inspect'}
							<TokenRow contract={g_token}
								error={s_error_text}
								on:click_error={() => {
									if(g_error !== G_RETRYING_TOKEN) {
										// inspect
										if(g_state.retries > 1) {
											$yw_context_popup = {
												title: 'Token Query Error',
												infos: [
													`Error querying token balance`,
													...ode(g_error['metadata']?.headersMap || {})
														.filter(([si_header]) => /^(grpc|proxied|x-cosmos)-/.test(si_header))
														.map(([si_header, a_values]) => ` － ${si_header}: ${a_values.join(', ')}`),
												],
											};

											$yw_popup = PopupNotice;
										}

										// retry
										h_token_errors[sa_token] = G_RETRYING_TOKEN;
										void load_token_balance(g_token);
									}
								}}
								s_debug='unknown'
							/>
						{/if}
					<!-- outgoing tx pending on contract -->
					{:else if h_pending_txs[sa_token]}
						<TokenRow contract={g_token} pending balance b_draggable on:dropRow={drop_row} />
					<!-- fully synced with chain -->
					{:else if !h_token_balances[sa_token]}
						<TokenRow contract={g_token} balance d_intersection={d_intersection} />
					<!-- balance loaded -->
					{:else if h_token_balances[sa_token]}
						<TokenRow contract={g_token} balance={h_token_balances[g_token.bech32]} b_draggable on:dropRow={drop_row}
							mintable={!!a_mintable.find(g => g.bech32 === g_token.bech32)}
						/>
					<!-- unable to view balance -->
					{:else}
						<TokenRow contract={g_token} unauthorized b_draggable on:dropRow={drop_row} />
					{/if}
				{/each}
			{/if}
		</div>
	{/key}
</Screen>
