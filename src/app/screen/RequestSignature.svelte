<script lang="ts">
	import type {Coin} from '@cosmjs/amino';
	import type {KeplrSignOptions} from '@keplr-wallet/types';
	import type {TxResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/base/abci/v1beta1/abci';
	import type {SimulateResponse} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/service';
	
	import type {AccountStruct, HardwareAccountLocation} from '#/meta/account';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {Bech32, CoinInfo, FeeConfig, FeeConfigAmount, FeeConfigPriced} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {IncidentStruct, MsgEventRegistry, TxPending} from '#/meta/incident';
	import type {AdaptedStdSignDoc, GenericAminoMessage} from '#/schema/amino';
	
	import {Secp256k1Signature} from '@cosmjs/crypto';
	import {SignMode} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';
	import {Fee, TxBody, TxRaw} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
	
	
	import BigNumber from 'bignumber.js';
	import {onDestroy} from 'svelte';
	import {slide} from 'svelte/transition';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {yw_account, yw_network, yw_progress, yw_settings} from '../mem';
	
	import {type LoadedAppContext, load_app_context} from '#/app/svelte';
	import {Coins} from '#/chain/coin';
	
	import type {
		ProtoMsg,
		TypedValue,
	} from '#/chain/cosmos-msgs';
	
	import {
		proto_to_amino,
		encode_proto,
		amino_to_base,
		recase_keys_camel_to_snake,
		AminoToProtoError,
		UnmappedAminoError,
	} from '#/chain/cosmos-msgs';
	import {FeeGrants} from '#/chain/fee-grant';
	import type {DescribedMessage} from '#/chain/messages/_types';
	import {address_to_name} from '#/chain/messages/_util';
	import type {AminoMsgSend} from '#/chain/messages/bank';
	import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
	import type {CompletedSignature} from '#/chain/signature';
	import {sign_amino} from '#/chain/signing';
	import type {WsTxResultError} from '#/cosmos/tm-json-rpc-ws-def';
	import {pubkey_to_bech32} from '#/crypto/bech32';
	import {parse_bip44} from '#/crypto/bip44';
	import {is_hwa, parse_hwa} from '#/crypto/hardware-signing';
	// import type {LedgerApp} from '#/crypto/ledger';
	import {keystone_sign_request} from '#/crypto/keystone';
	import type {AppInfoResponse, LedgerApp, LedgerResponseOk} from '#/crypto/ledger';
	import {decrypt_private_memo} from '#/crypto/privacy';
	import {SecretWasm} from '#/crypto/secret-wasm';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {system_notify} from '#/extension/notifications';
	import {ServiceClient} from '#/extension/service-comms';
	import {open_flow} from '#/script/msg-flow';
	import {global_broadcast, global_receive, global_wait} from '#/script/msg-global';
	import {H_TX_ERROR_HANDLERS} from '#/script/service-tx-abcis';
	import {B_DEVELOPMENT, B_IOS_NATIVE, B_WITHIN_IAB_NAV_IFRAME, XT_MINUTES, X_SIMULATION_GAS_MULTIPLIER} from '#/share/constants';
	import {Accounts} from '#/store/accounts';
	import {Apps} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {forever, is_dict, ode, timeout, timeout_exec} from '#/util/belt';
	import {base64_to_buffer, base93_to_buffer, buffer_to_base93} from '#/util/data';
	import {format_fiat} from '#/util/format';
	
	import FatalError from './FatalError.svelte';
	import HardwareController, {type ProgramHelper} from './HardwareController.svelte';
	import KeystoneHardwareConfigurator from './KeystoneHardwareConfigurator.svelte';
	import type {KeystoneProgramHelper} from './KeystoneHardwareConfigurator.svelte';
	import SigningData from './SigningData.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import Gap from '../ui/Gap.svelte';
	import Load from '../ui/Load.svelte';
	import Row from '../ui/Row.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
    import { semver_cmp } from '#/extension/semver';

	
	const g_context = load_app_context<CompletedSignature | null>();
	const {
		g_app,
		p_app,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	// chain should always be present
	const p_chain = Chains.pathFrom(g_chain);

	const dp_account = Accounts.at(p_account) as Promise<AccountStruct>;

	/**
	 * Will be set if SIGN_MODE_LEGACY_AMINO_JSON is being used
	 */
	export let amino: AdaptedStdSignDoc | null = null;
	let g_amino = amino;

	export let protoMsgs: ProtoMsg[];
	let a_msgs_proto = protoMsgs;

	export let fee: FeeConfig;
	const gc_fee = fee;

	export let memo = '';

	export let broadcast: {} | null = null;

	/**
	 * If `true`, it means there is a previous screen to go back to instead of completing the flow
	 * and that the messages were generated by StarShell and so gas estimation can be conservative.
	 */
	export let local = false;

	const b_show_timeout_controls = false;

	export let keplrSignOptions: KeplrSignOptions = {};

	const b_use_suggested_gas = true === keplrSignOptions?.preferNoSetFee;

	let s_simulation_suspended = '';

	// get fee coin from chain
	const [si_coin, g_info] = Chains.feeCoin(g_chain);

	let s_gas_limit_revert = '0';
	let s_gas_limit = '0';
	let s_gas_price = '0';

	let g_fee_coin_info: CoinInfo;

	/**
	 * Datetime the last block was witnessed by the service monitor
	 */
	let n_block_prev = 0;
	let xt_prev_block = 0;
	let xt_prev_witness = 0;
	let xt_avg_block_time = 0;

	const a_samples: number[] = [];

	// start monitoring service broadcasts
	onDestroy(global_receive({
		blockInfo(g_block_info) {
			if(p_chain === g_block_info.chain) {
				xt_prev_witness = Date.now();

				const n_block = parseInt(g_block_info.header.height);

				// do not sample repeats
				if(n_block === n_block_prev) return;

				n_block_prev = n_block;

				const xt_block = Date.parse(g_block_info.header.time);

				if(xt_prev_block) a_samples.push(xt_block - xt_prev_block);

				xt_prev_block = xt_block;

				// recompute average block time
				if(a_samples.length > 1) {
					xt_avg_block_time = a_samples.reduce((c_out, x_value) => c_out + x_value, 0) / a_samples.length;

					// update block wait
					n_blocks_wait = Math.floor((5 * XT_MINUTES) / xt_avg_block_time);
				}
			}
		},
	}));

	/**
	 * Only true if the signature is for an offline document (i.e., not a transaction)
	 */
	let b_no_fee = false;

	let b_no_gas = false;

	let s_fee_total = '0';
	let s_fee_total_display = '0';
	let dp_fee_fiat: Promise<string> = forever();

	let b_memo_encrypted = false;
	let s_memo_decrypted = 'decrypting...';
	let b_memo_show_raw = false;
	let b_hide_memo = false;

	let s_title = 'Sign Transaction';
	let s_tooltip = '';

	/**
	 * Set to true once the document has completely loaded
	 */
	let b_loaded = false;

	// live chain settings
	let g_chain_settings = $yw_settings.h_chain_settings?.[p_chain] || {};
	$: g_chain_settings = $yw_settings.h_chain_settings?.[p_chain] || {};

	const S_WARN_TRICK = 'This is an unusual message and might have been designed to trick you.';

	type Lint = {
		warn: string;
		fix: () => Promisable<void>;
	} | {
		error: string;
	};

	let a_lint: Lint[] = [];
	let s_warn = '';
	function validate_or_warn(h_msg: JsonObject) {
		const a_keys = Object.keys(h_msg);

		if(1 !== a_keys.length) {
			s_warn = S_WARN_TRICK;
			return;
		}

		const a_lint_local = [];

		const si_root = a_keys[0];

		const z_value = h_msg[si_root];

		if(!is_dict(z_value)) {
			s_warn = S_WARN_TRICK;
			return;
		}

		const g_value: JsonObject = z_value;

		switch(si_root) {
			case 'set_viewing_key': {
				function generate_viewing_key() {
					const atu8_entropy = SensitiveBytes.random(32).data;
					g_value.key = `🔑${buffer_to_base93(atu8_entropy)}`;
					validate_or_warn(h_msg);
				}

				delete g_value.padding;

				// if non-empty, then App provided message
				if(g_value.key) {
					// suggest a fix to user
					a_lint_local.push({
						warn: `App is suggesting the viewing key's password, which is highly unusual. `,
						fix: generate_viewing_key,
					});
				}
				// generate viewing key automatically
				else {
					generate_viewing_key();
				}

				// anything else is suspect
				const as_keys = new Set(Object.keys(g_value));
				as_keys.delete('key');
				as_keys.delete('padding');
				if(as_keys.size) {
					a_lint_local.push({
						warn: `App included non-standard properties with viewing key creation.`,
						fix() {
							for(const si_key in g_value) {
								if(!['key', 'padding'].includes(si_key)) {
									delete g_value[si_key];
								}
							}
						},
					});
				}

				break;
			}

			default: {
				// 
			}
		}

		a_lint = a_lint_local;
	}

	let a_overviews: DescribedMessage[] = [];


	async function describe_message(g_msg): Promise<DescribedMessage> {
		const si_amino = g_msg.type;

		const g_account = await dp_account;

		if(!g_account) {
			throw new Error('Account does not exist?!');
		}

		const g_loaded = {
			...g_context,
			g_account,
		} as LoadedAppContext;

		if(si_amino in H_INTERPRETTERS) {
			const g_interpretted = await H_INTERPRETTERS[si_amino](g_msg.value as JsonObject, g_loaded);

			return await g_interpretted.describe();
		}

		// fallback to rendering amino message directly
		return {
			title: si_amino,
			fields: [
				JsonPreviewer.render(g_msg.value as JsonObject, {
					chain: g_chain,
				}, {
					title: 'Arguments',
				}),
			],
		};
	}

	(async() => {
		// try setting to amino if defined by default
		let a_msgs_amino = amino?.msgs;

		// proto
		if(a_msgs_proto?.length) {
			// convert to amino
			a_msgs_amino = a_msgs_proto.map(g => proto_to_amino(g, g_chain.bech32s.acc));

			// memo is present
			if(memo.length) {
				// single message is a bank send
				if(1 === a_msgs_proto.length && 'cosmos-sdk/MsgSend' === a_msgs_amino[0].type) {
					const g_signer = await $yw_network.signerData(Chains.addressFor($yw_account.pubkey, g_chain));

					const g_send = a_msgs_amino[0].value as AminoMsgSend;
					try {
						s_memo_decrypted = await decrypt_private_memo(memo, $yw_network, g_send.to_address, `${g_signer.sequence}`, $yw_account);
						b_memo_encrypted = true;
						b_memo_show_raw = true;

						b_hide_memo = !s_memo_decrypted;
					}
					catch(e_decrypt) {}
				}
			}
		}

		// messages are defined
		if(a_msgs_amino?.length) {
			// single message
			if(1 === a_msgs_amino.length) {
				// interpret message
				const g_overview = await describe_message(a_msgs_amino[0]);

				// lift properties from overview
				s_title = g_overview.title;
				s_tooltip = g_overview.tooltip || '';

				// assign
				a_overviews = [g_overview];

				// offline message
				if(g_overview.offline) {
					b_no_fee = true;
					b_loaded = true;
					return;
				}
			}
			// multiple messages
			else {
				s_title = 'Sign Multi-Message Transaction';
				s_tooltip = 'Submits multiple messages to the chain to be processed in the same block.';

				a_overviews = await Promise.all(a_msgs_amino.map(describe_message));
			}


			try {
				a_msgs_amino.map(g => amino_to_base(g as TypedValue).encode());
			}
			catch(e_translate) {
				if(e_translate instanceof AminoToProtoError) {
					throw syserr({
						title: `Invalid Amino Message`,
						text: `The app is attempting to have you sign an invalid or improperly formatted message. Since this could lead to an irrecoverable loss of funds, StarShell has blocked this message request.\n${e_translate.original.stack || e_translate.message}`,
					});
				}
				else if(e_translate instanceof UnmappedAminoError) {
					throw syserr({
						title: 'Unmapped Amino Object',
						text: `The app is requesting the wallet to sign an unknown or unmapped Amino object. For security reasons, signing these types of messages are forbidden.\n${e_translate.message}`,
					});
				}
				else {
					throw syserr(e_translate as Error);
				}
			}
		}

		b_loaded = true;

		void simulate();
	})();

	async function simulate() {
		let a_msgs;
		try {
			a_msgs = a_msgs_proto?.length? a_msgs_proto: amino?.msgs.map(g => amino_to_base(g).encode());
		}
		catch(e_translate) {
			throw syserr(e_translate as Error);
		}

		// proto
		if(a_msgs?.length) {
			// resolve account
			const g_account = await dp_account;

			// hardware; do not simulate
			if(is_hwa(g_account.secret)) {
				s_simulation_suspended = 'Cannot simulate';
				return;
			}

			let g_signed!: {auth: Uint8Array};
			try {
				// sign
				g_signed = await $yw_network.authInfoDirect(g_account, Fee.fromPartial({
					granter: await tx_granter(),
				}));
			}
			catch(e_auth) {
				if(/account .+ not found/.test((e_auth as Error)?.message || '')) {
					s_err_sim = `No gas`;
					b_no_gas = true;
				}
				else {
					s_err_sim = e_auth.message;
				}

				return;
			}

			// simulate multiple times
			return await repeat_simulation(a_msgs, g_signed.auth, Infinity);
		}
	}

	let a_sims: SimulateResponse[] = [];
	let c_samples = 0;
	let s_gas_forecast = '';
	let s_err_sim = '';

	let b_use_grant = true;
	let s_granter: Bech32 | '' = '';
	let yg_grant_amount = BigNumber(0);
	let c_grants_checked = 0;

	let b_use_expiration = true;
	let n_blocks_wait = 50;

	// fetch fee grants
	let k_fee_grants: FeeGrants;

	async function tx_granter(): Promise<string> {
		// user disabled grant usage
		if(!b_use_grant) return '';

		// granter already resolved
		if(s_granter) return s_granter;

		// resolve account
		const g_account = await dp_account;

		// load fee grants
		if(!k_fee_grants) k_fee_grants = await FeeGrants.forAccount(g_account, $yw_network);

		// ref grant corresponding to fee coin
		const g_sum = k_fee_grants.grants[si_coin];

		// prep fee denom by shifting fee coin decimals
		const yg_fee_denom = yg_fee.shiftedBy(-g_fee_coin_info.decimals);

		// resolve granter
		for(const g_grant of g_sum?.grants || []) {
			c_grants_checked += 1;

			// grant is enough to cover fee
			const yg_amount = g_grant.amount;
			if(yg_amount.gte(yg_fee_denom)) {
				yg_grant_amount = yg_amount;
				return s_granter = g_grant.allowance.granter as Bech32;
			}
		}

		return s_granter = '';
	}

	async function repeat_simulation(a_msgs: ProtoMsg[], atu8_auth: Uint8Array, n_repeats: number) {
		if(n_repeats <= 0) return;
	
		let g_sim!: SimulateResponse;
		try {
			g_sim = await $yw_network.simulate($yw_account, {
				messages: a_msgs,
				memo: ' '.repeat(memo.length),
			}, atu8_auth);
		}
		catch(e_sim) {
			if(e_sim instanceof Error) {
				// ignore account sequence mismatch errors
				if(e_sim.message.startsWith('account sequence mismatch')) return;
			}

			console.error(e_sim);

			s_err_sim = e_sim.message;
			return;
		}

		// add to responses
		a_sims = a_sims.concat([g_sim]);

		// gas info present
		if(g_sim.gasInfo) {
			// increment sample counter
			c_samples += 1;

			// update maximum returned value
			const yg_gas_used_sim = a_sims.reduce((yg_max, g_each) => {
				// gas info present
				const {gasUsed:s_gas_used} = g_each.gasInfo || {};
				if(s_gas_used) {
					const yg_used = BigNumber(s_gas_used);

					// gas used is more than previous
					if(yg_used.gt(yg_max)) {
						return yg_used;
					}
				}

				// no change
				return yg_max;
			}, BigNumber(0));

			// load gas multiplier for chain
			const x_simulation_gas_multiplier: number = g_chain_settings.x_gas_multiplier ?? X_SIMULATION_GAS_MULTIPLIER;

			// forecast appropriate gas limit
			const yg_gas_forecast = yg_gas_used_sim.times(x_simulation_gas_multiplier).integerValue(BigNumber.ROUND_CEIL);

			// save as string
			s_gas_forecast = yg_gas_forecast.toString();

			// privacy chain; pad gas limit
			if(g_chain.features.secretwasm) {
				// ref gas step paramater from chain def
				const yg_gas_step = g_chain.features.secretwasm.gasPadding.stepSize;

				// pad gas amount using step size
				const yg_gas_padded = yg_gas_forecast.dividedBy(yg_gas_step).integerValue(BigNumber.ROUND_CEIL).times(yg_gas_step);

				// save as string
				s_gas_forecast = yg_gas_padded.toString();
			}

			// update gas limit if user is not adjusting
			if(!b_show_fee_adjuster) {
				// forecast is higher than estimate provided by app; replace it
				if(BigNumber(s_gas_forecast).gt(s_gas_limit)) {
					s_gas_limit = s_gas_forecast;
				}
				// transaction was generated locally; estimate is likely safe
				else if(local) {
					s_gas_limit = s_gas_forecast;
				}
				// no `preferNoSetFee`
				else if(!b_use_suggested_gas) {
					s_gas_limit = s_gas_forecast;
				}
				// otherwise, do not risk spending below the amount
			}

			// update fee grant check
			void tx_granter();
		}

		// wait for certain number of blocks
		let c_blocks_wait = c_samples < 3? 1: c_samples < 6? 2: c_samples < 12? 3: c_samples < 18? 4: 5;
		while(c_blocks_wait-- > 0) await global_wait('blockInfo');

		// repeat simulation
		return await repeat_simulation(a_msgs, atu8_auth, n_repeats - 1);
	}

	async function view_data() {
		const a_msgs_amino = amino?.msgs || a_msgs_proto.map(w => proto_to_amino(w, g_chain.bech32s.acc));

		const a_secret_wasm_execs: {}[] = [];

		for(const g_msg of a_msgs_amino) {
			if(['wasm/MsgExecuteContract', 'wasm/MsgInstantiateContract'].includes(g_msg.type)) {
				try {
					const g_decrypted = await SecretWasm.decodeSecretWasmAmino(p_account, g_chain, g_msg.value['msg'] || g_msg.value['init_msg'] as string);

					a_secret_wasm_execs.push(JSON.parse(g_decrypted['message']) as {});
				}
				catch(e_decrypt) {}
			}
		}

		k_page.push({
			creator: SigningData,
			props: {
				amino: {msgs:a_msgs_amino},
				wasms: a_secret_wasm_execs,
			},
		});
	}

	// cancel monitoring if [tx completes or already monitoring] and ui is still open
	let b_cancel_monitor = false;
	async function monitor_tx(si_txn: string): Promise<void> {
		// do not engage the monitor
		if(b_cancel_monitor) return;

		// do not engage again
		b_cancel_monitor = true;

		// open transaction monitor
		void open_flow({
			flow: {
				type: 'monitorTx',
				value: {
					app: p_app,
					chain: p_chain,
					account: p_account,
					hash: si_txn,
				},
				page: null,
			},
			open: {
				popout: true,
			},
		});

		// give flow some time to load
		await timeout(500);
	}


	/**
	 * Handle when the cosmos CheckTx fails in sync mode
	 * @param g_response
	 */
	async function handle_check_tx_error(g_response: TxResponse) {
		const si_txn = g_response.txhash;

		// notify tx failure
		global_broadcast({
			type: 'txError',
			value: {
				hash: si_txn,
			},
		});

		// fetch pending tx from history
		const p_incident = Incidents.pathFor('tx_out', si_txn);
		const g_pending = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;

		// update incident
		await Incidents.mutateData(p_incident, {
			...g_pending.data,
			stage: 'synced',
			gas_limit: g_response.gasWanted as Cw.Uint128,
			gas_used: g_response.gasUsed as Cw.Uint128,
			gas_wanted: g_response.gasWanted as Cw.Uint128,
			code: g_response.code,
			codespace: g_response.codespace,
			timestamp: g_response.timestamp,
			raw_log: g_response.rawLog,
		});

		// attempt tx error handling
		const g_notify_tx = await H_TX_ERROR_HANDLERS[g_response.codespace]?.[g_response?.code]?.(recase_keys_camel_to_snake(g_response) as WsTxResultError);
		if(g_notify_tx) {
			void system_notify({
				id: `@incident:${p_incident}`,
				incident: p_incident,
				item: g_notify_tx,
			});
		}
		// not handled, fallback to raw log
		else {
			void system_notify({
				id: `@incident:${p_incident}`,
				incident: p_incident,
				item: {
					title: '❌ Transaction Failed',
					message: g_response.rawLog,
				},
			});
		}
	}


	let b_approving = false;

	async function approve() {
		b_approving = true;

		try {
			await attempt_approve();
		}
		catch(e_attempt) {
			throw syserr(e_attempt as Error);
		}
	}

	class UserPopError extends Error {}

	async function attempt_approve() {
		const g_account = await dp_account;

		if(!g_account) {
			throw new Error('Account does not exist?!');
		}

		// using feegrant requires a forecast; force user to wait
		if(!b_no_fee && s_granter && b_use_grant && !s_gas_forecast && !s_err_sim && !s_simulation_suspended) {
			// reset ui
			b_approving = false;

			throw syserr({
				title: 'Fee optimization required',
				text: `When using a fee grant, an optimization is required. Wait a moment for the simulation to complete or opt-out of the fee grant.`,
			});
		}

		// prep signed transaction hash
		let si_txn = '';

		// resolve tx granter
		const s_granter_local = await tx_granter();

		// prep fee struct
		const g_fee = {
			gasLimit: s_gas_limit,
			amount: [{
				denom: g_fee_coin_info.denom,
				amount: s_fee_total,
			}],
			payer: '',
			granter: s_granter_local,
		};

		const sa_sender = pubkey_to_bech32(g_account.pubkey, g_chain.bech32s.acc);

		let a_equivalent_amino_msgs!: GenericAminoMessage[];

		let g_completed!: CompletedSignature;

		// hardware
		const b_hardware = is_hwa(g_account.secret);
		if(b_hardware) {
			// need to convert to amino
			if(!g_amino) {
				g_amino = {
					msgs: a_msgs_proto.map(g_proto => proto_to_amino(g_proto, g_chain.bech32s.acc)),
					memo,
					fee: {
						amount: [{
							denom: g_fee_coin_info.denom,
							amount: s_fee_total,
						}],
					},
					chain_id: g_chain.reference,
				} as AdaptedStdSignDoc;
			}
		}

		// amino signing mode
		if(g_amino) {
			a_equivalent_amino_msgs = g_amino.msgs;

			if(!b_no_fee) {
				g_amino.fee.gas = s_gas_limit;
				g_amino.fee.amount[0].amount = s_fee_total;

				if(s_granter_local) {
					g_amino.fee.granter = s_granter_local;
				}
			}

			// attempt to sign
			try {
				const {auth:atu8_auth, signer:g_signer} = await $yw_network.authInfo(g_account, {
					amount: g_amino.fee.amount,
					gasLimit: g_amino.fee.gas,
					granter: s_granter,
				}, SignMode.SIGN_MODE_LEGACY_AMINO_JSON);

				Object.assign(g_amino, {
					account_number: g_signer.accountNumber+'',
					sequence: g_signer.sequence+'',
					chain_id: g_signer.chainId,
				});

				// sign amino
				const g_signature = await sign_amino(g_account, g_amino, b_hardware? atu8_msg => new Promise((fk_resolve, fe_reject) => {
					// parse hwa location
					const g_pwa = parse_hwa(g_account.secret as HardwareAccountLocation);

					// parse hd path
					const a_path = parse_bip44(g_pwa.bip44);

					// reset ui in case user pops
					b_approving = false;

					// prep pop bail-out
					const f_release = k_page.on({
						restore() {
							fe_reject(new UserPopError());
						},
					});

					// ledger
					if('ledger' === g_pwa.vendor) {
						// present signing UI
						k_page.push({
							creator: HardwareController,
							props: {
								g_account,
								a_program: [
									async(k_app: LedgerApp, k_page_prg, k_prg: ProgramHelper) => {
										k_prg.status(`Review and sign the transaction`);

										k_prg.emulate(g_amino!);

										let atu8_txkey!: Uint8Array;
										for(const g_msg of g_amino!.msgs) {
											if(['wasm/MsgExecuteContract', 'wasm/MsgInstantiateContract'].includes(g_msg.type)) {
												try {
													const sb64_msg = (g_msg.value['msg'] || g_msg.value['init_msg']) as string;

													atu8_txkey = await SecretWasm.encryptionKeyFromMsg(g_account, g_chain, base64_to_buffer(sb64_msg));
												}
												catch(e_derive) {}
											}
										}

										// prompt signing
										let g_signed;

										// whether or not the app supports decrypting msgs
										const b_supports_txk = await (async() => {
											try {
												// get app version
												const g_vir = await k_app.device.virInfo() as AppInfoResponse;

												// Secret app
												if(!g_vir.error && 'Secret' === g_vir.name) {
													// >= v2.35.0
													return semver_cmp(g_vir.version, '2.35.0') >= 0 || B_DEVELOPMENT;
												}
											}
											catch(e_version) {}

											return false;
										})();

										// app is capable of decrypting message
										if(atu8_txkey && b_supports_txk) {
											g_signed = await k_app.sign(a_path, atu8_msg, atu8_txkey);
										}
										// not capable of decrypting message
										else {
											g_signed = await k_app.sign(a_path, atu8_msg);
										}

										// re-disable ui
										b_approving = true;

										// release pop bail-out
										f_release();

										// pop controller page
										k_page_prg.pop();

										// signature is DER encoded
										const atu8_signature = Secp256k1Signature.fromDer(g_signed.signature).toFixedLength();

										// resolve with signature
										fk_resolve(atu8_signature);
									},
								],
							},
						});
					}
					// qr
					else {
						k_page.push({
							creator: KeystoneHardwareConfigurator,
							props: {
								a_program: [
									async(k_page_prg, k_prg: KeystoneProgramHelper) => {
										k_prg.status(`Review and sign the transaction`);

										// create sign request
										const y_request = await keystone_sign_request(g_account, atu8_msg, g_chain);

										// play request and capture signature
										const {
											atu8_signature,
										} = await k_prg.play(y_request.toUR(), g_account.pubkey);

										// release pop bail-out
										f_release();

										// pop controller page
										k_page_prg.pop();

										// resolve with signature
										fk_resolve(atu8_signature);
									},
								],
							},
						});
					}
				}): null);

				// convert amino messages to proto
				a_msgs_proto = a_equivalent_amino_msgs.map(g => amino_to_base(g).encode());

				// set completed data
				g_completed = {
					amino: {
						signed: g_amino,
						signature: g_signature,
					},
				};

				// // encode tx body
				// const atu8_body = encode_proto(TxBody, {
				// 	messages: a_msgs_proto,
				// 	memo: memo,
				// 	timeoutHeight: `${b_use_expiration && xt_prev_block? n_block_prev + n_blocks_wait: 0}`,
				// });

				// // produce transaction bytes and hash
				// const {
				// 	sxb16_hash,
				// } = $yw_network.finalizeTxRaw({
				// 	body: atu8_body,
				// 	auth: atu8_auth,
				// 	signature: base64_to_buffer(g_signature.signature),
				// });

				const {
					atu8_tx,
					sxb16_hash,
				} = $yw_network.packAmino(g_amino, atu8_auth, base64_to_buffer(g_signature.signature));

				si_txn = sxb16_hash;

				g_completed.amino.direct = atu8_tx;
				console.debug(`Produced transaction hash of ${si_txn}`);
			}
			// signing error
			catch(e_sign) {
				if(!(e_sign instanceof UserPopError)) {
					k_page.push({
						creator: FatalError,
						props: {
							text: `While attempting to sign an Amino document: ${e_sign.stack}`,
						},
					});
				}

				// do not complete
				return;
			}
		}

		// proto signing
		if(!g_amino && a_msgs_proto?.length) {
			// attempt to sign
			try {
				// encode tx body
				const atu8_body = encode_proto(TxBody, {
					messages: a_msgs_proto,
					memo: memo,
					timeoutHeight: `${b_use_expiration && xt_prev_block? n_block_prev + n_blocks_wait: 0}`,
				});

				// sign direct
				const g_signed = await $yw_network.signDirect(g_account, g_chain, atu8_body, g_fee);

				// set completed data
				g_completed = {
					proto: g_signed,
				};

				// produce transaction bytes and hash
				const {
					sxb16_hash,
				} = $yw_network.finalizeTxRaw({
					body: g_signed.doc.bodyBytes,
					auth: g_signed.doc.authInfoBytes,
					signature: g_signed.signature,
				});

				// set transaction id
				si_txn = sxb16_hash.toUpperCase();

				// produce equivalent amino messages
				a_equivalent_amino_msgs = a_msgs_proto.map(g_proto => proto_to_amino(g_proto, g_chain.bech32s.acc));
			}
			// signing error
			catch(e_sign) {
				// ref error message
				const s_error = (e_sign as Error)?.message || '';

				// account not found
				if(/^account (.+) not found$/.test(s_error)) {
					throw syserr({
						error: e_sign,
						title: 'Account does not exist',
						text: 'You need to receive gas before you can send a transaction.',
					});
				}

				k_page.push({
					creator: FatalError,
					props: {
						message: `While attempting to sign a direct protobuf transaction: ${e_sign.stack}`,
					},
				});

				// do not complete
				return;
			}
		}


		// prep context
		const g_loaded = {
			...g_context,
			g_account,
		} as LoadedAppContext;

		// prep events
		const h_events: Partial<MsgEventRegistry> = {};

		// interpret messages
		for(const g_msg of a_equivalent_amino_msgs) {
			const si_amino = g_msg.type;

			// interpretter exists for this message type
			if(si_amino in H_INTERPRETTERS) {
				// interpret
				const g_interpretted = await H_INTERPRETTERS[si_amino](g_msg.value as JsonObject, g_loaded);

				// approve
				const h_merge = await g_interpretted.approve?.(si_txn);

				// merge events
				if(h_merge) {
					for(const [si_event, a_events] of ode(h_merge)) {
						if(a_events) {
							(h_events[si_event] = h_events[si_event] || []).push(...a_events);
						}
					}
				}
			}
		}

		// transaction will be broadcast
		if(si_txn) {
			// record outgoing tx
			await Incidents.record({
				type: 'tx_out',
				id: si_txn,
				data: {
					stage: 'pending',
					app: p_app,
					chain: Chains.pathFrom(g_chain),
					account: p_account,
					msgs: a_msgs_proto.map(g => ({
						typeUrl: g.typeUrl,
						value: buffer_to_base93(g.value),
					})),
					code: 0,
					hash: si_txn,
					raw_log: '',
					gas_limit: s_gas_limit as Cw.Uint128,
					gas_wanted: '' as Cw.Uint128,
					gas_used: '' as Cw.Uint128,
					events: h_events,
				} as TxPending,
			});

			// set progress
			$yw_progress = [20, 100];

			// clear progress bar after short timeout
			async function clear_progress() {
				f_unbind();
				await timeout(1.5e3);
				$yw_progress = [0, 0];
			}

			// listen for global tx events
			const f_unbind = global_receive({
				txError() {
					b_cancel_monitor = true;
					$yw_progress = [1, 100];
					void clear_progress();
				},

				txSuccess() {
					b_cancel_monitor = true;
					$yw_progress = [100, 100];
					void clear_progress();
				},
			});

			// set interval to update it
			let n_progress = 20;
			const n_increment = 5;
			const i_interval = setInterval(() => {
				// still waiting
				if(![0, 1, 100].includes($yw_progress[0])) {
					n_progress += n_increment;
					$yw_progress = [n_progress, 100];

					// keep updating until reaching 80% progress
					if(n_progress < 80) return;
				}

				clearInterval(i_interval);
			}, 500);

			CONTACTING_BACKGROUND: {
				// skip on ios
				if(B_IOS_NATIVE || B_WITHIN_IAB_NAV_IFRAME) break CONTACTING_BACKGROUND;

				try {
					const k_client = await ServiceClient.connect('self');

					// wake the event streams, giving it time to restart if necessary
					const [, xc_timeout] = await timeout_exec(6e3, () => k_client.request({
						type: 'wake',
					}));

					// service is dead
					if(xc_timeout) throw new Error();
				}
				// service is dead or unreachable
				catch(e_connect) {
					// begin to monitor the tx and continue
					await monitor_tx(si_txn);

					break CONTACTING_BACKGROUND;
				}

				// service not dead but it has been a while since the last block was observed
				if(Date.now() - xt_prev_witness > 12e3) {
					// wait for up to 6 more seconds
					try {
						await global_wait('blockInfo', g => p_chain === g.chain, 6e3);
					}
					// timed out
					catch(e_timeout) {
						// begin to monitor the tx and continue
						await monitor_tx(si_txn);

						break CONTACTING_BACKGROUND;
					}
				}

				// set a timeout to make sure something happens within time limit
				setTimeout(() => {
					console.warn(`Confirmation timeout triggered. Opening dedicated transaction monitor`);

					void monitor_tx(si_txn);
				}, 15e3);
			}
		}
		// was just for signing
		else {
			// TODO: save signed_json incident

			// query permit
			if(g_chain.features.secretwasm && 1 === a_equivalent_amino_msgs.length && 'query_permit' === a_equivalent_amino_msgs[0].type) {
				// do not record incident here
			}
			// some document
			else {
				// record incident
				await Incidents.record({
					type: 'signed_json',
					data: {
						app: Apps.pathFrom(g_app),
						account: p_account,
						events: h_events,
					},
				});
			}
		}

		// dispatch update
		global_broadcast({
			type: 'reload',
		});

		if(g_completed) {
			// wallet should broadcast transaction
			if(broadcast) {
				const {
					proto: g_proto_tx,
					amino: g_amino_tx,
				} = g_completed;

				// amino
				if(!g_proto_tx && g_amino_tx) {
					let g_response: TxResponse;
					try {
						// broadcast transaction
						[g_response] = await $yw_network.broadcastRaw(g_completed.amino.direct);
					}
					catch(e_broadcast) {
						throw syserr(e_broadcast as Error);
					}

					// error
					if(g_response.code) {
						await handle_check_tx_error(g_response);
					}
				}
				// direct
				else if(g_proto_tx) {
					let g_response: TxResponse;
					try {
						// broadcast transaction
						[g_response] = await $yw_network.broadcastDirect({
							body: g_proto_tx.doc.bodyBytes,
							auth: g_proto_tx.doc.authInfoBytes,
							signature: g_proto_tx.signature,
						});
					}
					catch(e_broadcast) {
						throw syserr(e_broadcast as Error);
					}

					// error
					if(g_response.code) {
						await handle_check_tx_error(g_response);
					}
				}
				// // amino
				// else {
				// 	throw syserr({
				// 		title: 'Amino broadcasting not yet implemented',
				// 		text: 'At this screen only',
				// 	});
				// }
			}

			completed?.(true, g_completed);
			return;
		}

		// not in flow context; reset navigator thread
		if(!completed) {
			k_page.reset();
		}
		else {
			debugger;
		}
	}

	let b_show_fee_adjuster = false;
	let s_adjust_fee_text = 'Adjust fee';

	let a_original_gas_settings: string[];

	// reactively compute total gas fee
	$: yg_fee = BigNumber(s_gas_price).times(s_gas_limit);
	$: {
		// convert to integer string
		s_fee_total = yg_fee.integerValue(BigNumber.ROUND_CEIL).toString();

		if(g_fee_coin_info) {
			const g_coin = {
				amount: s_fee_total,
				denom: g_fee_coin_info.denom,
			};

			s_fee_total_display = Coins.summarizeAmount(g_coin, g_chain);

			dp_fee_fiat = Coins.displayInfo(g_coin, g_chain).then(g_display => `=${format_fiat(g_display.fiat, g_display.versus)}`);
		}

		// update fee grant check
		void yw_network.nextUpdate().then(tx_granter);
	}

	// parse network fee
	{
		// get fee coin from chain
		[, g_fee_coin_info] = Chains.feeCoin(g_chain);

			// a_amounts = [
			// 	{
			// 		denom: g_chain.feeCoin,
			// 		amount: BigNumber(gc_fee_price.price).times(BigNumber(String(gc_fee_price.limit)))
			// 			.integerValue(BigNumber.ROUND_CEIL).toString(),
			// 	},
			// ];

			// const a_fees = a_amounts.map(g_amount => Chains.summarizeAmount(g_amount, g_chain));
	
		// prep fee amounts
		let a_amounts: Coin[] = [];

		// start with the default gas price
		let yg_price_suggest = BigNumber(g_chain_settings.x_default_gas_price ?? g_chain.gasPrices.default);

		// as amino doc
		if(amino) {
			// inherit gas limit from doc
			s_gas_limit = s_gas_limit_revert = amino.fee.gas;

			// ref amounts
			a_amounts = amino.fee.amount;
		}
		// as proto doc
		else {
			// inherit gas limit from config
			s_gas_limit = s_gas_limit_revert = String(gc_fee.limit);

			// amounts provided
			if(gc_fee?.['amount']) {
				a_amounts = (gc_fee as FeeConfigAmount).amount;
			}
			// price provided
			else if(gc_fee?.['price']) {
				// override suggest price
				yg_price_suggest = BigNumber(String((gc_fee as FeeConfigPriced).price));
			}
		}

		// app provided gas amounts
		if(a_amounts?.length) {
			// collect prices from app
			const h_prices_app: Dict<BigNumber> = {};

			// each amount provided by app
			for(const g_coin of a_amounts) {
				if('0' !== g_coin.amount) {
					// convert to price
					h_prices_app[g_coin.denom] = BigNumber(g_coin.amount).dividedBy(s_gas_limit);
				}
			}

			// a price was provided for intended coin; override suggested price
			const yg_price = h_prices_app[g_fee_coin_info.denom];
			if(yg_price) {
				yg_price_suggest = yg_price;
			}
		}

		// set gas price
		s_gas_price = yg_price_suggest.toString();
	}


	let b_tooltip_showing = false;

	function click_adjust_fee() {
		// first time clicking
		if(!b_show_fee_adjuster) {
			a_original_gas_settings = [s_gas_limit_revert, s_gas_price];
			b_show_fee_adjuster = true;
			s_adjust_fee_text = 'Reset fee';
		}
		// user is resetting gas settings
		else {
			b_show_fee_adjuster = false;
			s_adjust_fee_text = 'Adjust fee';
			[s_gas_limit, s_gas_price] = a_original_gas_settings;

			// update limit based on forecast data
			if(s_gas_forecast && s_gas_forecast !== s_gas_limit) s_gas_limit = s_gas_forecast;
		}
	}

	// do not complete the flow if signature screen was pushed from previous
	function cancel() {
		if(completed) {
			completed(false);
		}
		else {
			k_page.pop();
		}
	}
</script>

<style lang="less">
	@import '../_base.less';

	.overview {
		position: relative;
		margin-top: 2px !important;

		>.actions {
			position: absolute;
			top: 0;
			right: 0;
			margin-top: -4px;
		}

		>.fields {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: var(--gap, var(--ui-padding));
		}
	}
</style>

<Screen>
	{#await dp_account}
		<AppBanner app={g_app} chains={[g_chain]} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				{s_title}
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:then g_account}
		<AppBanner app={g_app} chains={[g_chain]} account={g_account} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					{s_title}
				</span>
				{#if s_tooltip}
					<Tooltip bind:showing={b_tooltip_showing}>
						{s_tooltip}
					</Tooltip>
				{/if}
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/await}

	{#each a_overviews as g_overview, i_overview}
		{#if a_overviews.length > 1}
			<Gap plain />
			<h3>{i_overview+1}. {g_overview.title}</h3>
		{:else}
			<hr class="no-margin">
		{/if}

		<div class="overview">
			<div class="actions">
				<button class="pill" on:click={() => view_data()}>
					View Data
				</button>
			</div>

			<div class="fields">
				<!-- sent funds -->
				{#each (g_overview.spends || []) as g_send}
					<Field key='sent-funds' name='Send funds to contract'>
						<Row
							rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
							pfp={g_send.pfp}
							name={g_send.amounts.join(' + ')}
						/>
					</Field>
				{/each}

				<Fields {g_app} configs={[
					...g_overview.fields,
				]}>
				</Fields>
			</div>
		</div>
	{/each}

	{#if a_overviews.length > 1}
		<Gap plain />
	{:else}
		<hr style="margin: 0 var(--ui-padding);">
	{/if}

	<Field short key='gas' name='Network Fee'>
		{#if b_no_fee}
			<div>
				0.0 {si_coin}
			</div>
			<div class="global_subvalue">
				Offline signature has no fees
			</div>
		{:else}
			<div style={`
				display: flex;
				flex-direction: column;
				gap: 8px;
			`}>
				<div style={`
					display: flex;
					justify-content: space-between;
				`}>
					<div>
						<div class="fee-denom">
							{s_fee_total_display}
						</div>
						<div class="fee-fiat global_subvalue">
							<Load input={dp_fee_fiat} />
						</div>
					</div>
					<div style="text-align:right;">
						<div class="font-variant_tiny" style="color:var(--theme-color-{s_err_sim? 'caution': 'text-med'});">
							{#if s_simulation_suspended}
								{s_simulation_suspended}
							{:else if !a_sims.length}
								{#if s_err_sim}
									Simulation failed
								{:else}
									Optimizing fee...
								{/if}
							{:else if s_gas_forecast}
								{#if b_use_suggested_gas}
									✔️ Simulated txn
								{:else}
									✔️ Optimized fee
								{/if}
								({
									c_samples <= 10
										? c_samples
										: `>${Math.floor((c_samples-1) / 10) * 10}`
								})
							{:else}
								Optimization failed
							{/if}
						</div>
						<div class="link font-variant_tiny" on:click={() => click_adjust_fee()}>
							{s_adjust_fee_text}
						</div>
					</div>
				</div>

				{#if b_show_fee_adjuster}
					<div class="global_inline-form" style="margin-top: -2px;" transition:slide>
						<span class="key">
							Gas limit
						</span>
						<span class="value">
							<input class="global_compact" required type="number" min="0" step="500" bind:value={s_gas_limit}>
						</span>
						<span class="key">
							Gas price
						</span>
						<span class="value">
							<input class="global_compact" required type="number" min="0" step="0.00125" bind:value={s_gas_price}>
						</span>
					</div>
				{/if}

				{#if c_grants_checked}
					{#if s_granter}
						<CheckboxField id='fee-grant' bind:checked={b_use_grant}>
							<span class="font-variant_tiny color_text-med">
								{#await address_to_name(s_granter, g_chain)}
									<Load forever />
								{:then s_granter_name}
									Use allowance from {s_granter_name}
								{/await}
							</span>
						</CheckboxField>
					{:else}
						<CheckboxField id='fee-grant' disabled>
							<span class="font-variant_tiny color_text-med">
								{#if 1 === c_grants_checked}
									Fee exceeds grant allowance
								{:else}
									None of current grants can cover this fee
								{/if}
							</span>
						</CheckboxField>
					{/if}
				{/if}
			</div>
		{/if}
	</Field>

	{#if b_show_timeout_controls}
		<Field name='Timeout' short>
			{#if xt_avg_block_time}
				<CheckboxField id='timeout' bind:checked={b_use_expiration}>
					<span class="font-variant_tiny color_text-med">
						Abort after 5 minutes ({n_blocks_wait} blocks)
					</span>
				</CheckboxField>
			{:else}
				<CheckboxField id='timeout' bind:checked={b_use_expiration}>
					<span class="font-variant_tiny color_text-med">
						Abort after {n_blocks_wait} blocks
					</span>
				</CheckboxField>
			{/if}
		</Field>
	{/if}

	{#if memo && !b_hide_memo}
		<Field key='memo' name={`${b_memo_encrypted? b_memo_show_raw? 'Decrypted': 'Raw': 'Public'} Memo`}>
			<span slot="right">
				{#if b_memo_encrypted}
					<span class="link" on:click={() => b_memo_show_raw = !b_memo_show_raw}>Show {b_memo_show_raw? 'raw': 'decrypted'} form</span>
				{/if}
			</span>

			<span style="color:var(--theme-color-graysoft)">
				<textarea disabled
					style={b_memo_encrypted && !b_memo_show_raw? 'line-break:anywhere;': ''}
				>{b_memo_encrypted && b_memo_show_raw? s_memo_decrypted: memo}</textarea>
			</span>
		</Field>
	{/if}

	<ActionsLine disabled={b_approving} back={local} cancel={!local? () => cancel(): false} confirm={['Approve', approve, !b_loaded]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
