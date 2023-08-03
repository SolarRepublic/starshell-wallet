import type {Readable} from 'svelte/store';

import type {Nameable, Pfpable} from '#/meta/able';
import type {AccountStruct, AccountPath} from '#/meta/account';
import type {AppStruct, AppPath} from '#/meta/app';
import type {Dict, Nilable} from '#/meta/belt';
import type {ChainStruct, ChainPath, Bech32} from '#/meta/chain';
import type {Resource} from '#/meta/resource';
import type {ParametricSvelteConstructor} from '#/meta/svelte';

import {getContext} from 'svelte';
import {cubicOut} from 'svelte/easing';

import {detach, insert, noop} from 'svelte/internal';

import {syserr} from './common';
import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_network, yw_progress} from './mem';

import {FeeGrants} from '#/chain/fee-grant';
import {Argon2, Argon2Type} from '#/crypto/argon2';
import {NB_ARGON2_MEMORY} from '#/crypto/vault';
import type {IntraExt} from '#/script/messages';
import {global_receive} from '#/script/msg-global';
import {A_COURTESY_ACCOUNTS} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Apps, G_APP_STARSHELL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {NB_ARGON2_PIN_MEMORY, N_ARGON2_PIN_ITERATIONS} from '#/store/secrets';
import {Settings} from '#/store/settings';
import {ode, ofe, timeout_exec} from '#/util/belt';
import {text_to_buffer} from '#/util/data';
import {dd} from '#/util/dom';

import type {Page} from '##/nav/page';

import PfpDisplay from './frag/PfpDisplay.svelte';


export function once_store_updates(yw_store: Readable<any>, b_truthy=false): (typeof yw_store) extends Readable<infer w_out>? Promise<w_out>: never {
	return new Promise((fk_resolve) => {
		// ignore initialization call
		let b_initialized = false;

		// subscribe
		const f_unsubscribe = yw_store.subscribe((w_value) => {
			// runner gets called immediately, but wait for the update
			if(!b_initialized) {
				b_initialized = true;
				return;
			}

			// 
			if(!b_truthy || w_value) {
				// unsubscribe
				f_unsubscribe();

				// resolve with value
				fk_resolve(w_value);
			}
		});
	});
}

export function s2r_slide(dm_node: Element, {
	delay: xt_delay=0,
	duration: xt_duration=400,
	easing: f_easing=cubicOut,
	minHeight: x_height_min=0,
}: SvelteTransitionConfig & {minHeight?: number}): SvelteTransitionReturnType {
	const d_style = getComputedStyle(dm_node);
	const x_opacity = +d_style.opacity;
	const x_height = parseFloat(d_style.height);
	const x_padding_top = parseFloat(d_style.paddingTop);
	const x_padding_bottom = parseFloat(d_style.paddingBottom);
	const x_margin_top = parseFloat(d_style.marginTop);
	const x_margin_bottom = parseFloat(d_style.marginBottom);
	const x_border_top_width = parseFloat(d_style.borderTopWidth);
	const x_border_bottom_width = parseFloat(d_style.borderBottomWidth);

	return {
		delay: xt_delay,
		duration: xt_duration,
		easing: f_easing,
		css: xt => ''
			+'overflow: hidden;'
			+`opacity: ${Math.min(xt * 20, 1) * x_opacity};`
			+`height: ${(xt * (x_height - x_height_min)) + x_height_min}px;`
			+`padding-top: ${xt * x_padding_top}px;`
			+`padding-bottom: ${xt * x_padding_bottom}px;`
			+`margin-top: ${xt * x_margin_top}px;`
			+`margin-bottom: ${xt * x_margin_bottom}px;`
			+`border-top-width: ${xt * x_border_top_width}px;`
			+`border-bottom-width: ${xt * x_border_bottom_width}px;`,
	};
}

export function svelte_to_dom(
	dc_creator: ParametricSvelteConstructor,
	h_props: ParametricSvelteConstructor.Parts<typeof dc_creator>['params'],
	si_event?: string
): Promise<HTMLElement> {
	const dm_div = dd('div');

	const yc_component = new dc_creator({
		target: dm_div,
		props: h_props,
	});

	return new Promise((fk_resolve) => {
		if(si_event) {
			yc_component.$on(si_event, () => {
				fk_resolve(dm_div.firstChild as HTMLElement);
			});
		}
		else {
			fk_resolve(dm_div.firstChild as HTMLElement);
		}
	});
}


export async function load_pfps<
	p_res extends Resource.Path,
	g_res extends (Nameable & Pfpable),
>(h_resources: Record<p_res, g_res>, h_props: PfpDisplay['$$prop_def']): Promise<Record<p_res, HTMLElement>> {
	return ofe(
		await Promise.all(
			ode(h_resources).map(([_, g_resource]) => new Promise(
				(fk_resolve: (a_entry: [p_res, HTMLElement]) => void) => {
					const dm_dummy = dd('span');
					const yc_pfp = new PfpDisplay({
						target: dm_dummy,
						props: {
							...h_props,
							resource: g_resource,
							settle() {
								const dm_pfp = dm_dummy.firstChild?.cloneNode(true) as HTMLElement;
								yc_pfp.$destroy();
								fk_resolve([g_resource.pfp as p_res, dm_pfp]);
							},
						},
					});
				}
			))
		));
}


export interface Intent {
	id: string;
}

type Completable<w_complete extends any=any> = (b_answer: boolean, w_value?: w_complete) => void;

type ProgressTracker = [number, number];

export interface PageContext {
	k_page: Page;
	g_cause: IntraExt.Cause | null;
	b_searching: boolean;
	a_progress: ProgressTracker | null;
	next_progress: (this: void, a_progress?: [number, number] | null, n_delta?: number) => {progress?: ProgressTracker};
}

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export function load_page_context(): PageContext {
	const k_page = getContext<Page>('page');
	const g_cause = getContext<IntraExt.Cause | null>('cause') || null;
	const b_searching = getContext<boolean>('searching') || false;
	const a_progress = getContext<ProgressTracker>('progress') || null;

	return {
		k_page,
		g_cause,
		b_searching,
		a_progress,
		next_progress: (a=a_progress, c_delta=+1): ReturnType<PageContext['next_progress']> => a? {
			progress: [a[0]+c_delta, a[1]],
		}: {},
	};
}

export interface FlowContext<w_complete extends any=never> extends PageContext {
	completed: Completable<w_complete> | ([w_complete] extends [never]? undefined: never);
}

export function load_flow_context<w_complete extends any=never>(): FlowContext<w_complete> {
	// eslint-disable-next-line @typescript-eslint/no-extra-parens
	const completed = getContext<Completable<w_complete> | ([w_complete] extends [never]? undefined: never)>('completed');

	return {
		...load_page_context(),
		completed,
	};
}

export interface AppContext<w_complete extends any=any> extends FlowContext<w_complete> {
	g_app: AppStruct;
	p_app: AppPath;
	g_chain: ChainStruct;
	p_chain: ChainPath;
	p_account: AccountPath;
}

export interface LocalAppContext {
	p_app: AppPath;
	g_app: AppStruct;
	p_chain: ChainPath;
	g_chain: ChainStruct;
	p_account: AccountPath;
	g_account: AccountStruct;
	sa_owner: Bech32;
}

export interface PartialLocalAppContext {
	p_app: AppPath | undefined;
	g_app: AppStruct | null;
	p_chain: ChainPath | undefined;
	g_chain: ChainStruct | null;
	p_account: AccountPath | undefined;
	g_account: AccountStruct | null;
	sa_owner: Bech32 | undefined;
}

export interface LoadedAppContext<w_complete extends any=any> extends AppContext<w_complete>, LocalAppContext {
	g_account: AccountStruct;
}

export function load_app_context<w_complete extends any=any>() {
	const g_app = getContext<AppStruct>('app') || G_APP_STARSHELL;
	const p_app = Apps.pathFrom(g_app);
	const g_chain = getContext<ChainStruct>('chain');
	const p_chain = Chains.pathFrom(g_chain);
	const p_account = getContext<AccountPath>('accountPath');

	return {
		...load_flow_context<w_complete>(),
		g_app,
		p_app,
		g_chain,
		p_chain,
		p_account,
	};
}

/* eslint-enable */

export interface ProgressTimerConfig {
	estimate: number;
	range: [number, number];
	interval?: number;
}

export function make_progress_timer(gc_timer: ProgressTimerConfig): (b_no_reset?: boolean) => void {
	const {
		estimate: xt_estimate,
		range: [x_range_lo, x_range_hi],
		interval: xt_interval=250,
	} = gc_timer;

	const x_range_gap = x_range_hi - x_range_lo;

	let b_done = false;

	const xt_start = performance.now();
	const i_interval = setInterval(() => {
		if(!b_done) {
			// remove 400ms to offset css transition delay
			const x_filled = ((performance.now() - xt_start) / (xt_estimate - 400)) * x_range_gap;
			yw_progress.set([
				Math.min(x_range_hi, Math.round(x_range_lo + x_filled)),
				100,
			]);
		}
	}, xt_interval);

	return (b_no_reset=false) => {
		b_done = true;

		clearInterval(i_interval);

		yw_progress.set([x_range_hi, 100]);

		if(!b_no_reset) {
			setTimeout(() => {
				// only clear if another part of the ui isn't using progress for steps
				if(100 === yw_progress.get()[1]) {
					yw_progress.set([0, 0]);
				}
			}, xt_interval);
		}
	};
}

export interface HashSampleConfig {
	nl_input?: number;
	nb_memory?: number;
}

// runs the hasher on fake data to estimate the time it will take with higher iteration count
export async function argon_hash_sample(gc_sample: HashSampleConfig): Promise<void> {
	// const k_worker = await Vault.wasmArgonWorker();

	await Argon2.hash({
		phrase: text_to_buffer('0'.repeat(gc_sample.nl_input || 8)),
		salt: crypto.getRandomValues(new Uint8Array(32)),
		type: Argon2Type.Argon2id,
		iterations: 2,
		memory: gc_sample.nb_memory || NB_ARGON2_MEMORY,
		hashLen: 32,
	});
}

export async function estimate_pin_hash(): Promise<number> {
	const gc_sample = {
		nl_input: 8,
		nb_memory: NB_ARGON2_PIN_MEMORY,
	};

	// warm up the worker
	await argon_hash_sample(gc_sample);

	// perform sample run
	const xt_start = window.performance.now();
	await argon_hash_sample(gc_sample);
	const xt_elapsed = window.performance.now() - xt_start;

	return 0.5 * xt_elapsed * N_ARGON2_PIN_ITERATIONS;
}

export async function request_feegrant(sa_owner: Bech32): Promise<void> {
	const k_network = yw_network.get();

	const f_cancel_progress_req = make_progress_timer({
		estimate: 2e3,
		range: [0, 25],
	});

	let d_res: Response;
	try {
		d_res = await fetch('https://feegrant.starshell.net/claim', {
			method: 'POST',
			headers: {
				'accept': 'application/json, text/plain, */*',
				'content-type': 'application/json;charset=UTF-8',
			},
			body: JSON.stringify({
				address: sa_owner,
			}),
			mode: 'cors',
		});
	}
	catch(e_fetch) {
		throw syserr({
			title: 'Network error',
			text: e_fetch.message,
		});
	}
	finally {
		f_cancel_progress_req();
	}

	if(!d_res.ok) {
		throw syserr({
			title: 'Server denied request',
			text: `Server said: ${await d_res.text()}`,
		});
	}

	const f_cancel_chain = make_progress_timer({
		estimate: 6e3,
		range: [25, 90],
	});

	// listen for fee grant event on chain
	const [, xc_timeout] = await timeout_exec(15e3, () => new Promise((fk_resolve) => {
		global_receive({
			feegrantReceived() {
				fk_resolve(void 0);
			},
		});
	}));

	// clear progress bar
	f_cancel_chain();

	// done
	if(!xc_timeout) return;

	// timed out, check manually
	const g_chain = await Chains.at('/family.cosmos/chain.secret-4');
	const [, g_account] = await Accounts.find(sa_owner, g_chain!);
	const k_feegrants = await FeeGrants.forAccount(g_account, k_network);

	const a_grants = k_feegrants.grants['SCRT']?.grants;

	for(const g_grant of a_grants || []) {
		if(A_COURTESY_ACCOUNTS.includes(g_grant.allowance.granter)) {
			return;
		}
	}

	throw syserr({
		title: 'Fee grant failed',
		text: 'The request operation timed out',
	});
}


export function inject_svelte_slots(h_slots: Dict<HTMLElement>): {
	$$slots: Dict<Array<() => {}>>;
	$$scope: {};
} {
	const h_out: Dict<Array<() => {}>> = {};

	for(const si_slot in h_slots) {
		const dm_insert = h_slots[si_slot];

		h_out[si_slot] = [
			() => ({
				c: noop,

				m: function mount(target: Node, anchor: Node) {
					insert(target, dm_insert, anchor);
				},

				d: function destroy(detaching) {
					if(detaching) {
						detach(dm_insert);
					}
				},

				l: noop,
			}),
		];
	}

	return {
		$$slots: h_out,
		$$scope: {},
	};
}


export async function initialize_mem(h_context_all: Dict<any>={}) {
	console.debug('#initialize-mem');

	// allow these to fail in order to recover from disasters
	try {
		const ks_settings = await Settings.read();

		// select account from context, or last used account
		const p_account_selected: Nilable<AccountPath> = h_context_all.accountPath
			|| ks_settings.get('p_account_selected');

		// select chain from context, or last used chain
		const p_chain_selected: Nilable<ChainPath> = h_context_all.chain
			? Chains.pathFrom(h_context_all.chain as ChainStruct)
			: ks_settings.get('p_chain_selected');

		// attempt to load accounts
		const ks_accounts = await Accounts.read();

		// no accounts yet; don't wait for other stores to update since it may never return
		if(!Object.keys(ks_accounts.raw).length) {
			return;
		}

		// set defaults
		await Promise.all([
			// default chain
			yw_chain.get() || once_store_updates(yw_chain, true),
			Chains.read().then(ks => yw_chain_ref.set(p_chain_selected || ode(ks.raw)[0][0])),

			// default account
			yw_account.get() || once_store_updates(yw_account, true),
			(() => yw_account_ref.set(p_account_selected || ode(ks_accounts.raw)[0][0]))(),
		]);
	}
	catch(e_load_default) {
		console.warn(e_load_default);
	}
}
