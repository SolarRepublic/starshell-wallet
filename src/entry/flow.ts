/* eslint-disable i/order */
import {dm_log, domlog} from './fallback';

domlog(`Pre-init: registering uncaught error handler`);
window.addEventListener('error', (d_event) => {
	domlog(`Fatal uncaught error: ${d_event.message}`);
	domlog(`${d_event.filename}:${d_event.lineno}:${d_event.colno}`);
	console.error(d_event.error);
});

import AcceptConsensusKey from '#/app/screen/AcceptConsensusKey.svelte';
import HardwareDiscover from '#/app/screen/HardwareDiscover.svelte';
import IncidentView from '#/app/screen/IncidentView.svelte';
import MonitorTx from '#/app/screen/MonitorTx.svelte';
import NoticeIllegalChainsSvelte from '#/app/screen/NoticeIllegalChains.svelte';
import PageException from '#/app/screen/PageException.svelte';
import PreRegister from '#/app/screen/PreRegister.svelte';
import {B_LOCALHOST, B_WITHIN_IFRAME, XT_INTERVAL_HEARTBEAT} from '#/share/constants';

import {do_android_polyfill} from '#/native/android-polyfill';
import {do_webkit_polyfill} from '#/native/webkit-polyfill';

do_android_polyfill();
do_webkit_polyfill();
/* eslint-enable */

import type {SvelteComponent} from 'svelte';
import type {Union} from 'ts-toolbelt';
import type {Nullable} from 'ts-toolbelt/out/Object/Nullable';

import type {AccountStruct, AccountPath} from '#/meta/account';
import type {AppStruct, AppPath} from '#/meta/app';
import type {JsonValue, PlainObject} from '#/meta/belt';
import type {ChainStruct, ChainPath, Bech32} from '#/meta/chain';
import type {ParametricSvelteConstructor} from '#/meta/svelte';
import type {Vocab} from '#/meta/vocab';

import {AuthInfo, SignDoc, TxBody} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import ReloadPage from '#/app/screen/ReloadPage.svelte';
import RequestConnection_AccountsSvelte from '#/app/screen/RequestConnection_Accounts.svelte';
import RequestExposure from '#/app/screen/RequestExposure.svelte';
import RequestKeplrDecisionSvelte from '#/app/screen/RequestKeplrDecision.svelte';
import RequestSignatureSvelte from '#/app/screen/RequestSignature.svelte';
import RequestTokenAdd from '#/app/screen/RequestTokenAdd.svelte';
import RestartService from '#/app/screen/RestartService.svelte';
import ScanQrSvelte from '#/app/screen/ScanQr.svelte';

import type {CompletedAminoSignature, CompletedProtoSignature, CompletedSignature} from '#/chain/signature';
import {Vault} from '#/crypto/vault';
import {SessionStorage} from '#/extension/session-storage';
import type {ErrorRegistry, IntraExt} from '#/script/messages';
import {RegisteredFlowError} from '#/script/msg-flow';
import {global_receive} from '#/script/msg-global';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {fold, forever, F_NOOP, is_dict, ode, timeout_exec} from '#/util/belt';
import {base93_to_buffer, buffer_to_base64, buffer_to_base93} from '#/util/data';
import {parse_params, qs} from '#/util/dom';
import SystemSvelte from '##/container/System.svelte';
import AuthenticateSvelte from '##/screen/Authenticate.svelte';
import RequestAdvertisementSvelte from '##/screen/RequestAdvertisement.svelte';


export type FlowMessage = Vocab.Message<IntraExt.FlowVocab>;

export type WebPage = Union.Merge<NonNullable<Vocab.MessagePart<IntraExt.FlowVocab, 'page'>>>;

interface AppHandlerContext {
	app: AppStruct;
	chain: ChainStruct;
	account: AccountStruct;
}

type PartialContext = Partial<Nullable<AppHandlerContext>>;


export type Completed = (b_answer: boolean) => void;

const G_COMPLETED_POSITIVE: IntraExt.CompletedFlow = {
	answer: true,
};

const G_COMPLETED_NEGATIVE: IntraExt.CompletedFlow = {
	answer: false,
};

// parse query params
const h_query = parse_params<string>();

// override `window.close`
if(B_WITHIN_IFRAME) {
	window.close = function() {
		window.top!.postMessage({
			type: 'close',
		}, location.origin);
	};
}

// before closing the window, gracefully unload this flow
let b_unloaded = false;
async function graceful_unload() {
	// don't fire more than once
	if(b_unloaded) return;
	b_unloaded = true;

	// clear the flow value from session storage
	await SessionStorage.remove('flow');
}

let f_resolve_completion = F_NOOP;
let f_resolve_reported = F_NOOP;

// establish a regular heartbeat pulse to the service worker
function heartbeat(d_port: Vocab.TypedChromePort<IntraExt.FlowControlVocab, IntraExt.FlowControlAckVocab>, si_key: string) {
	// send a pulse every 200ms
	const i_hearbeat = setInterval(() => {
		try {
			d_port.postMessage({
				type: 'heartbeat',
			});
		}
		// port disconnected
		catch(e_post) {
			console.warn(`Service port disconnected; attempting to reconnect...`);

			// cancel heartbeat
			clearInterval(i_hearbeat);

			// type runtime for posting messages
			const d_runtime = chrome.runtime as Vocab.TypedRuntime<IntraExt.ServiceInstruction>;

			// connect to service worker
			const d_port_renew = d_runtime.connect({
				name: si_key,
			}) as Vocab.TypedChromePort<IntraExt.FlowControlVocab, IntraExt.FlowControlAckVocab>;

			// renew
			heartbeat(d_port_renew, si_key);
		}
	}, XT_INTERVAL_HEARTBEAT);

	// port was disconnected by service
	d_port.onDisconnect.addListener(() => {
		// cancel interval
		clearInterval(i_hearbeat);

		// close window
		window.close();
	});

	// listen for messages from service
	d_port.onMessage.addListener((g_msg) => {
		if('completeFlowAck' === g_msg.type) {
			f_resolve_completion?.();
		}
		else if('reportErrorAck' === g_msg.type) {
			f_resolve_reported?.();
		}
	});
}


// top-level system component
const yc_system: SvelteComponent | null = null;

// the web page associated with this flow
let g_page_extracted: WebPage | null = null;

/**
 * Renders the given screen
 */
function render<
	dc_screen extends ParametricSvelteConstructor,
>(dc_screen: dc_screen, g_props?: Omit<ParametricSvelteConstructor.Parts<dc_screen>['params'], 'k_page'>, h_context?: PlainObject) {
	// attempt to hide log
	try {
		dm_log!.style.display = 'none';
	}
	catch(e_hide) {}

	// destroy previous system
	if(yc_system) {
		try {
			yc_system.$destroy();
		}
		catch(e_destroy) {}
	}

	try {
		qs(document.body, 'main')?.remove();
	}
	catch(e_remove) {}

	// create system
	new SystemSvelte({
		target: document.body,
		props: {
			mode: 'flow',
			page: {
				creator: dc_screen,
				props: g_props || {},
			},
		},
		context: new Map(ode(h_context || {})),
	});
}


/**
 * Convenience method wraps `render` function by injecting `complete` callback function into .context object and returning as Promise
 */
function completed_render<
	w_data extends JsonValue,
	dc_screen extends ParametricSvelteConstructor=ParametricSvelteConstructor,
>(
	dc_screen: dc_screen,
	g_props?: Omit<ParametricSvelteConstructor.Parts<dc_screen>['params'], 'k_page'>,
	h_context?: PlainObject
): Promise<IntraExt.CompletedFlow<w_data>> {
	return new Promise((fk_resolve, fe_reject) => {
		// within iframe
		if(B_WITHIN_IFRAME) {
			// define global function to allow top frame to abort the flow gracefully
			globalThis.abort_flow = () => fk_resolve({
				answer: false,
			});
		}

		render(dc_screen, g_props, {
			...h_context,
			completed(b_answer: boolean, w_data?: w_data) {
				fk_resolve({
					answer: b_answer,
					data: w_data,
				});
			},
			fatal(w_error: unknown) {
				fe_reject(w_error);
			},
		});
	});
}

// authenticate the user
async function authenticate(): Promise<IntraExt.CompletedFlow> {
	// verbose
	domlog(`Handling 'authenticate'.`);

	// // busy authenticating
	// return await navigator.locks.request('service:authenticate', async() => {
		// already signed in
	if(await Vault.isUnlocked()) {
		// verbose
		domlog(`Vault is already unlocked.`);

		// TODO: consider "already authenticated" dom
		// render(BlankSvelte, {});

		return G_COMPLETED_POSITIVE;
	}

	// retrieve root
	const g_root = await Vault.getBase();

	// no root set, need to register
	if(!g_root) {
		// verbose
		domlog(`No root found. Prompting registration.`);

		// allow user to register
		const b_completed = await completed_render<boolean>(PreRegister);

		// user completed registration; retry authentication
		if(b_completed) {
			return await authenticate();
		}
		// user rejected registration; cancel flow
		else {
			return G_COMPLETED_NEGATIVE;
		}
	}

	// verbose
	domlog(`Root found. Prompting login.`);

	return await completed_render(AuthenticateSvelte);
	// });
}

function flow_error<
	si_type extends ErrorRegistry.Key,
	w_value extends ErrorRegistry.Value<ErrorRegistry.Module, si_type>,
>(si_type: si_type, w_value: w_value) {
	return new RegisteredFlowError({
		type: si_type,
		value: w_value,
	});
}

// prep handlers
const H_HANDLERS_AUTHED: Vocab.Handlers<Omit<IntraExt.FlowVocab, 'authenticate'>, [PartialContext]> = {
	requestAdvertisement: g_value => completed_render(RequestAdvertisementSvelte, {
		app: g_value.app,
		page: g_value.page,
		keplr: g_value.keplr,
	}),

	async requestConnection(g_value) {
		// verbose
		domlog(`Handling 'requestConnection' on ${JSON.stringify(g_value)}`);

		const g_props = {
			app: g_value.app,
			chains: g_value.chains,
			sessions: g_value.sessions,
			accountPath: g_value.accountPath,
		};

		// only one chain
		if(1 === Object.keys(g_value.chains).length) {
			return completed_render(RequestConnection_AccountsSvelte, g_props);
		}
		// multiple chains
		else {
			// return completed_render(RequestConnectionSvelte, g_props);

			const a_results: IntraExt.CompletedFlow[] = [];

			// handle each one at a time
			for(const [si_chain, g_session] of ode(g_value.sessions)) {
				const w_res = await completed_render(RequestConnection_AccountsSvelte, {
					...g_props,
					chains: {
						[si_chain]: g_value.chains[si_chain],
					},
					sessions: {
						[si_chain]: g_session,
					},
				});

				a_results.push(w_res);
			}

			// TODO: fix multi-chain requests
			return {
				answer: a_results.some(g => g.answer),
				data: void 0,
			};
		}
	},

	requestKeplrDecision: g_value => completed_render(RequestKeplrDecisionSvelte, g_value),

	illegalChains: g_value => completed_render(NoticeIllegalChainsSvelte, g_value),

	reloadAppTab: g_value => completed_render(ReloadPage, g_value),

	reportAppException: g_value => completed_render(PageException, g_value),

	restartService: g_value => completed_render(RestartService, g_value),

	monitorTx: g_value => completed_render(MonitorTx, g_value),

	async signAmino(g_value, g_context) {
		// verbose
		domlog(`Handling 'signAmino' on ${JSON.stringify(g_value)}\n\nwith context ${JSON.stringify(g_context)}`);

		const g_completed = await completed_render<CompletedAminoSignature>(RequestSignatureSvelte, g_value.props, {
			app: g_context.app,
			chain: g_context.chain,
			accountPath: g_value.accountPath,
		});

		return {
			...g_completed,
			data: g_completed.data?.amino,
		};
	},

	async signTransaction(g_value, g_context) {
		// verbose
		domlog(`Handling 'signTransaction' on ${JSON.stringify(g_value)}`);

		const g_sloppy = g_value.doc;

		const g_doc = SignDoc.fromPartial({
			chainId: g_sloppy.chainId,
			accountNumber: 'number' === typeof g_sloppy.accountNumber? g_sloppy.accountNumber+'': g_sloppy.accountNumber ?? void 0,
			authInfoBytes: g_sloppy.authInfoBytes? base93_to_buffer(g_sloppy.authInfoBytes): void 0,
			bodyBytes: g_sloppy.bodyBytes? base93_to_buffer(g_sloppy.bodyBytes): void 0,
		});

		const g_body = TxBody.decode(g_doc.bodyBytes);
		const g_auth = AuthInfo.decode(g_doc.authInfoBytes);

		const a_msgs = g_body.messages;

		const g_completed = await completed_render<CompletedProtoSignature>(RequestSignatureSvelte, {
			protoMsgs: a_msgs,
			fee: g_auth.fee? {
				limit: g_auth.fee?.gasLimit,
				amount: g_auth.fee?.amount,
			}: null,
		}, {
			app: g_context.app,
			chain: g_context.chain,
			accountPath: g_value.accountPath,
		});

		const g_data = g_completed.data;
		if(g_data) {
			return {
				...g_completed,
				data: {
					...g_data,
					proto: {
						...g_data.proto,
						doc: {
							...g_data.proto.doc,
							authInfoBytes: buffer_to_base93(g_data.proto.doc.authInfoBytes),
							bodyBytes: buffer_to_base93(g_data.proto.doc.bodyBytes),
						},
						signature: buffer_to_base64(g_data.proto.signature),
					},
				},
			};
		}

		return g_completed;
	},

	inspectIncident: g_value => completed_render(IncidentView, {
		incident: g_value.incident,
	}),

	scanQr: (g_value, g_context) => completed_render(ScanQrSvelte, g_value, {
		app: g_context.app,
		chain: g_context.chain,
		accountPath: g_value.accountPath,
	}),

	addSnip20s: (g_value, g_context) => new Promise(async(fk_resolve, fe_reject) => {
		try {
			// prep lists of tokens awaiting
			let a_awaiting: Bech32[] = [];

			// init tokens confirmed to list of those already added
			const p_app = g_value.appPath;
			const p_chain = g_value.chainPath;
			const p_account = g_value.accountPath;

			const g_app = g_context.app;
			const g_chain = g_context.chain;
			const g_account = g_context.account;

			// const g_app = (await Apps.at(p_app));
			// const g_account = (await Accounts.at(p_account))!;

			// list of new tokens added from app during this session
			const a_confirmed = g_account.assets[p_chain]?.fungibleTokens.slice() || [];

			const f_check_confirmed = async() => {
				// check all tokens in confirmed list
				for(const sa_contract of a_confirmed.slice()) {
					// token is awaiting confirmation
					const i_awaiting = a_awaiting.indexOf(sa_contract);
					if(i_awaiting >= 0) {
						// remove from awaiting
						a_awaiting.splice(i_awaiting, 1);

						// respond to pending request
						if(!a_awaiting.length) {
							// stop listening for global events
							f_unsubscribe();

							// // install accepted tokens
							// const a_installed = a_confirmed.filter(sa => a_reqs.includes(sa));
							// if(a_installed.length) {
							// 	debugger;
							// 	await install_contracts(a_installed, g_context.chain!, g_context.app!);
							// }

							// resolve promise with response
							fk_resolve({
								answer: true,
								data: fold(a_reqs, sa_request => ({
									[sa_request]: {
										ok: a_confirmed.includes(sa_request),
									},
								})),
							});

							// stop
							return;
						}
					}
				}
			};

			const a_reqs = g_value.bech32s;

			// start listening for token added events before transaction broadcast suceeds
			const f_unsubscribe = global_receive({
				// tokenAdded(g_added) {
				// 	// record token in case it is missed later
				// 	a_confirmed.push(g_added.sa_contract);

				// 	void f_check_confirmed();
				// },

				txSuccess() {
					// // let user know that app is waiting for confirmation
					// yw_navigator.get().activePage.push({
					// 	creator: AwaitConfirmation,
					// });

					// resolve promise with response
					fk_resolve({
						answer: true,
						data: fold(a_reqs, sa_request => ({
							[sa_request]: {
								ok: true,
							},
						})),
					});
				},
			});

			// wait for user to add tokens
			const g_completion = await completed_render(RequestTokenAdd, g_value, {
				app: g_context.app,
				chain: g_context.chain,
				accountPath: g_value.accountPath,
			});

			// user rejected all
			if(!g_completion.answer) {
				f_unsubscribe();
				fk_resolve(g_completion);
				return;
			}

			// // user accepted adding certain tokens
			// const g_data = g_completion.data as any;
			// if(g_data['amino']) {
			// 	const g_signed = (g_data as CompletedAminoSignature).amino.signed;

			// 	// set list of tokens awaiting
			// 	a_awaiting = g_signed.msgs.map(g_msg => g_msg.value.contract) as Bech32[];

			// 	// TODO: manually update viewing key so that flow can close right away
			// 	// // tx was a success, manually install vks
			// 	// for(const g_msg of g_signed.msgs) {
			// 	// 	H_SNIP_HANDLERS.set_viewing_key({
			// 	// 		h_args: {},
			// 	// 		p_app, g_app,
			// 	// 		p_chain, g_chain,
			// 	// 		p_account, g_account,
			// 	// 		p_contract,
			// 	// 		g_snip20
			// 	// 	});
			// 	// }
			// }
			// // decode into amino format
			// else if(g_data['proto']) {
			// 	const a_aminos = TxBody.decode((g_data as CompletedProtoSignature).proto.doc.bodyBytes).messages
			// 		.map(g => proto_to_amino(g, g_context.chain?.bech32s.acc || ''));

			// 	// set list of tokens awaiting
			// 	a_awaiting = a_aminos.map(g => g.value.contract).filter(s => s) as Bech32[];
			// }

			// // re-check all confirmed
			// void f_check_confirmed();
		}
		catch(e_any) {
			console.error(e_any);

			fe_reject(e_any);
		}
	}),

	async exposeViewingKeys(g_value, g_context) {
		return await completed_render(RequestExposure, g_value, {
			app: g_context.app,
			chain: g_context.chain,
			accountPath: g_value.accountPath,
		});
	},

	solver({accountPath:p_account}) {
		// render(Solver, {
		// 	p_account,
		// });

		return forever();
	},

	async acceptConsensusKey(g_value, g_context) {
		return await completed_render(AcceptConsensusKey, g_value, {
			chain: g_context.chain,
		});
	},

	async requestDevice(g_value, g_context) {
		return await completed_render(HardwareDiscover, g_value.props, g_value.context);
	},

	// // handles cases where code just wants to await for SigningKey to sign
	// async ledgerSign() {
	// 	const {
	// 		path: a_path,
	// 		coinType: ni_coin,
	// 		message: sb64_document,
	// 	} = g_value;

	// 	return await completed_render(HardwareController, {
	// 		ni_coin,
	// 		a_program: [
	// 			async(k_app: LedgerApp, k_page: Page, f_status) => {
	// 				f_status(`Review and sign the message`);

	// 				const {
	// 					signature: atu8_signature,
	// 				} = await k_app.sign(a_path, base64_to_buffer(sb64_document));

	// 				return {
	// 					push: [],
	// 				};
	// 			},
	// 		],
	// 	});
	// },
} as const;


// message router
async function route_message(g_msg: FlowMessage) {
	// authenticate
	if('authenticate' === g_msg.type) {
		// verbose
		domlog(`Calling built-in handler for '${g_msg.type}'`);

		// authenticate
		return await authenticate();
	}

	// lookup handler in authed
	const f_handler = H_HANDLERS_AUTHED[g_msg.type]; // as Vocab.Handler<FlowMessage, [Completed]> | undefined;

	// no such authed handler
	if(!f_handler) {
		return domlog(`No such handler registered for '${g_msg.type}'`);
	}

	// not signed in
	if(!await Vault.isUnlocked()) {
		// verbose
		domlog(`Vault is locked. Redirecting to login.`);

		// authenticate
		await authenticate();

		// then retry
		return await route_message(g_msg);
	}

	// verbose
	domlog(`Calling registered handler for '${g_msg.type}'`);

	// ref value
	const z_value = g_msg['value'];

	// prep context struct
	const g_context: PartialContext = {};

	// struct
	if(is_dict(z_value)) {
		// contains app path; load app
		if('string' === typeof z_value['appPath']) {
			g_context.app = await Apps.at(z_value['appPath'] as AppPath);
		}

		// load chain
		if('string' === typeof z_value['chainPath']) {
			g_context.chain = await Chains.at(z_value['chainPath'] as ChainPath);
		}

		// contains account path; load account
		if('string' === typeof z_value['accountPath']) {
			g_context.account = await Accounts.at(z_value['accountPath'] as AccountPath);
		}

		// contains page reference, store for later
		if(is_dict(z_value['page'])) {
			g_page_extracted = z_value['page'] as WebPage;
		}
	}

	// call handler
	return await f_handler(z_value, g_context);
}


async function suggest_reload_page(g_page: WebPage) {
	// try to get the tab that initiated this action
	let g_tab!: chrome.tabs.Tab;
	try {
		g_tab = await chrome.tabs.get(g_page.tabId);
	}
	// ignore errors
	catch(e_get) {}

	// tab no longer exists
	if(!g_tab?.url) return;

	// url has changed
	if(g_page.href !== g_tab.url) {
		return;
	}

	// suggest reload
	return new Promise((fk_resolve) => {
		// new SuggestReloadSvelte({
		// 	target: document.body,
		// 	props: {
		// 		page: g_page,
		// 		completed: fk_resolve,
		// 	},
		// });
	});
}

(async function() {
	// verbose
	domlog('Flow script init');

	// environment capture
	const si_objective = h_query.headless;
	if(si_objective) {
		if('info' === si_objective) {
			return SessionStorage.set({
				display_info: {
					width: screen.width,
					height: screen.height,
					availHeight: screen.availHeight,
					availWidth: screen.availWidth,
					orientation: JSON.parse(JSON.stringify(screen.orientation ?? null)),
					devicePixelRatio: devicePixelRatio,
				},
			}).then(() => {
				window.close();
			});
		}

		window.close();
	}

	// depending on comm method
	const si_comm = h_query.comm;

	// // use broadcast channel
	// if('broadcast' === si_comm) {
	// 	// verbose
	// 	domlog('Using broadcast comm');

	// 	// ref channel name
	// 	const si_channel = h_query.name;

	// 	// no channel name
	// 	if('string' !== typeof si_channel || !si_channel) {
	// 		return domlog('Invalid or missing channel name');
	// 	}

	// 	// verbose
	// 	domlog(`Channel name: '${si_channel}'`);

	// 	// connect to service worker
	// 	const d_port = chrome.runtime.connect({
	// 		name: si_channel,
	// 	}) as Vocab.TypedChromePort<IntraExt.FlowControlVocab>;

	// 	// register heartbeat messages
	// 	heartbeat(d_port);

	// 	// create broadcast channel
	// 	const d_broadcast: Vocab.TypedBroadcast<IntraExt.FlowResponseVocab, IntraExt.FlowVocab> = new BroadcastChannel(si_channel);
	// 	function respond_broadcast(b_answer) {
	// 		debugger;

	// 		// post to broadcast
	// 		d_broadcast.postMessage({
	// 			type: 'completeFlow',
	// 			value: {
	// 				answer: b_answer,
	// 			},
	// 		});

	// 		// if flow still exists after some time, then service worker is dead
	// 		setTimeout(async() => {
	// 			// suggest reloading the page
	// 			if(g_page_extracted) await suggest_reload_page(g_page_extracted);

	// 			// unload
	// 			await graceful_unload();

	// 			// then exit
	// 			window.close();
	// 		}, 200);
	// 	}

	// 	function report_error(e_thrown: Error) {
	// 		if(e_thrown instanceof RegisteredFlowError) {
	// 			d_broadcast.postMessage({
	// 				type: 'reportError',
	// 				value: e_thrown.detail,
	// 			});
	// 		}
	// 		else {
	// 			// otherwise, log to unhandled errors
	// 		}
	// 	}

	// 	// listen for message on broadcast channel
	// 	d_broadcast.onmessage = async function(d_event) {
	// 		// ref message data
	// 		const g_msg = d_event.data as typeof d_event.data | null | {type: undefined};

	// 		// verbose
	// 		domlog(`Received => ${JSON.stringify(g_msg)}`);

	// 		// invalid event data
	// 		if(!g_msg || !g_msg.type) {
	// 			return domlog('Invalid message');
	// 		}

	// 		// save message to storage
	// 		sessionStorage.setItem(`@flow:${si_channel}`, JSON.stringify(g_msg));

	// 		// acknowledge receipt
	// 		d_broadcast.postMessage({
	// 			type: 'acknowledgeReceipt',
	// 			value: g_msg,
	// 		});

	// 		// route message
	// 		try {
	// 			respond_broadcast(await route_message(g_msg));
	// 		}
	// 		catch(e_route) {
	// 			report_error(e_route as Error);
	// 		}
	// 	};

	// 	// verbose
	// 	domlog('Listening for message...');

	// 	// read from session storage
	// 	const s_reloaded = sessionStorage.getItem(`@flow:${si_channel}`);
	// 	if(s_reloaded) {
	// 		// verbose
	// 		domlog('Attempting to restore message after reload...');

	// 		// parse message from storage
	// 		let g_parsed: FlowMessage;
	// 		try {
	// 			g_parsed = JSON.parse(s_reloaded);
	// 		}
	// 		catch(e_parse) {
	// 			return domlog('Failed to parse message from session storage');
	// 		}

	// 		// route
	// 		try {
	// 			respond_broadcast(await route_message(g_parsed));
	// 		}
	// 		catch(e_route) {
	// 			report_error(e_route as Error);
	// 		}
	// 	}
	// }
	// // query comm
	// else if('query' === si_comm) {

	if('query' === si_comm) {
		// get response key
		const si_key = h_query.key!;

		// get data
		const sx_data = h_query.data;

		// verbose
		domlog(`Received => ${sx_data}`);

		// missing data
		if(!sx_data) {
			return domlog(`Missing flow data`);
		}

		// parse data
		let g_flow: FlowMessage;
		try {
			g_flow = JSON.parse(sx_data) as FlowMessage;
		}
		catch(e_parse) {
			return domlog('Invalid message');
		}

		// invalid event data
		if(!g_flow?.type) {
			return domlog('Invalid message');
		}

		// type runtime for posting messages
		const d_runtime = chrome.runtime as Vocab.TypedRuntime<IntraExt.ServiceInstruction>;

		// connect to service worker
		const d_port = B_LOCALHOST? null: d_runtime.connect({
			name: si_key,
		}) as Vocab.TypedChromePort<IntraExt.FlowControlVocab, IntraExt.FlowControlAckVocab>;

		// production
		if(!B_LOCALHOST) {
			// register heartbeat messages
			heartbeat(d_port!, si_key);
		}

		// 
		console.log(`Flow request port connection on ${si_key}`);

		// route message
		try {
			const g_response = await route_message(g_flow);

			console.debug(`Submitting flow response: %o`, g_response);

			// respond to flow over chrome port
			d_port?.postMessage({
				type: 'completeFlow',
				value: g_response,
			});

			// await ack
			await timeout_exec(1.5e3, () => new Promise<void>(fk => f_resolve_completion = fk));

			// unload
			await graceful_unload();

			// close self
			window.close();
		}
		catch(e_thrown) {
			// submit error report over chrome port
			d_port?.postMessage({
				type: 'reportError',
				value: e_thrown.detail,
			});

			// await ack
			await new Promise<void>(fk => f_resolve_reported = fk);

			// unload
			await graceful_unload();

			// close self
			window.close();
		}
	}
	// unknown comm
	else {
		domlog(`Unknown comm '${h_query.comm || '(null | undefined)'}'`);
	}
})();
