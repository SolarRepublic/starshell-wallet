import type * as ImportHelper from './ics-spotter-imports';

import type {
	AppToSpotter,
	IcsToService,
	ServiceToIcs,
} from './messages';

import type {ChainStruct} from '#/meta/chain';
import type {Vocab} from '#/meta/vocab';


/**
 * The spotter's primary purpose is to silently forward advertisement requests from the page to the service.
 * This script is also responsible for:
 *  - spotting WHIP-005 inputs
 *  - forwarding active page context data to the navigation view on mobile devices.
 */
(function() {
	// ref and cast runtime
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab, ServiceToIcs.CommandVocab> = chrome.runtime;

	// verbose
	// eslint-disable-next-line no-console
	const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.ics-spotter: ${s}`, ...a_args);
	const warn = (s: string, ...a_args: (string | number | object)[]) => console.warn(`StarShell.ics-spotter: ${s}`, ...a_args);
	const error = (s: string, ...a_args: (string | number | object)[]) => console.error(`StarShell.ics-spotter: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const {
		SI_STORE_ACCOUNTS,
		SI_STORE_CHAINS,
		B_IOS_WEBKIT,
		R_CAIP_2,

		pubkey_to_bech32,

		create_app_profile,
		load_app_pfp,

		Apps,
		Chains,
		SessionStorage,

		dd, qsa,

		create_store_class,
		WritableStoreMap,

		Vault,
		WebKitMessenger,
	} = inline_require('./ics-spotter-imports.ts') as typeof ImportHelper;


	const Accounts = create_store_class({
		store: SI_STORE_ACCOUNTS,
		extension: 'map',
		class: class AccountsI extends WritableStoreMap<typeof SI_STORE_ACCOUNTS> {},
	});

	const XL_WIDTH_OVERLAY_MAX = 160;
	const XL_WIDTH_OVERLAY_MIN = 120;
	const XS_IDEAL_OVERLAY = 0.27;

	// prep handler map
	const h_handlers_window: Vocab.Handlers<AppToSpotter.WindowVocab> = {
		// window is requesting advertismement
		async requestAdvertisement() {
			// verbose
			debug('Processing #requestAdvertisement');

			// let service worker decide what to do
			await d_runtime.sendMessage({
				type: 'requestAdvertisement',
				value: {
					profile: await create_app_profile(),
				},
			});
		},
	};

	// listen for messages from app
	(window as Vocab.TypedWindow<AppToSpotter.WindowVocab>).addEventListener('message', (d_event) => {
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

				// handler is registered; execute it
				debug(`Received relay port message having registered type %o`, z_data);
				f_handler(z_data);
			}
		}
	});

	// // Firefox on Android
	// if(B_FIREFOX_ANDROID) {
	// 	interface PopoverFields {
	// 		shadow: ShadowRoot;
	// 		iframe: HTMLIFrameElement;
	// 	}

	// 	const hm_privates = new WeakMap<Popover, PopoverFields>();

	// 	// define popover element
	// 	class Popover extends HTMLElement {
	// 		constructor() {
	// 			super();

	// 			const d_shadow = this.attachShadow({
	// 				mode: 'closed',
	// 			});

	// 			const dm_iframe = dd('iframe', {
	// 				src: 'about:blank',
	// 			});

	// 			d_shadow.append(dm_iframe);

	// 			hm_privates.set(this, {
	// 				shadow: d_shadow,
	// 				iframe: dm_iframe,
	// 			});
	// 		}

	// 		attributeChangedCallback(si_attr, s_old, s_new) {
	// 			if('params' === si_attr) {
	// 				hm_privates.get(this)!.iframe.src = chrome.runtime.getURL(`src/entry/flow.html?${s_new}`);
	// 			}
	// 		}
	// 	}

	// 	window.customElements.define('starshell-popover', Popover);

	// 	// listen for commands from service
	// 	d_runtime.onMessage.addListener((g_msg) => {
	// 		debug('Received service command: %o', g_msg);

	// 		if('openFlow' === g_msg.type) {
	// 			const dm_popover = dd('starshell-popover', {
	// 				params: stringify_params({
	// 					comm: 'query',
	// 					test: 'yes',
	// 				}),
	// 				style: `
	// 					display: block;
	// 					position: fixed;
	// 					left: 0;
	// 					bottom: 0;
	// 					width: 100vw;
	// 					height: 100vh;
	// 					transform: translateY(60%);
	// 				`,
	// 			});

	// 			document.body.append(dm_popover);
	// 		}
	// 	});
	// }


	async function add_input_overlay(dm_input: HTMLInputElement, a_chains: ChainStruct[]) {
		const {
			height: xl_height_input,
			width: xl_width_input,
		} = dm_input.getBoundingClientRect();

		const xl_width_overlay = Math.min(XL_WIDTH_OVERLAY_MAX, Math.max(XL_WIDTH_OVERLAY_MIN, Math.round(xl_width_input * XS_IDEAL_OVERLAY)));

		const g_computed = getComputedStyle(dm_input);
		const a_border = g_computed.borderRadius.split(/\s+/);
		const s_border_tr = a_border[1] || a_border[0];
		const s_border_br = a_border[3] || a_border[0];

		const a_accounts = (await Accounts.read()).entries().map(([, g]) => g);
		let i_account = 0;

		const b_multiaccount = a_accounts.length > 1;

		let sx_position = ['absolute', 'fixed', 'static'].includes(g_computed.position)
			? `margin-top: -${xl_height_input - 1}px;`
			: '';

		// attempt to compute relative offset wrt positioned ancestor
		{
			let dm_node: HTMLElement | null = dm_input;
			while(dm_node && !['absolute', 'relative'].includes(getComputedStyle(dm_node).position)) {
				dm_node = dm_node.parentElement;
			}

			if(dm_node) {
				const g_bounds_ancestor = dm_node.getBoundingClientRect();
				const g_bounds_input = dm_input.getBoundingClientRect();

				sx_position = `
					top: calc(${g_bounds_input.top - g_bounds_ancestor.top}px + ${g_computed.borderTopWidth});
					right: calc(${g_bounds_ancestor.right - g_bounds_input.right}px + ${g_computed.borderRightWidth});
				`;
			}
		}

		const dm_overlay = dd('div', {
			style: `
				position: absolute;
				background-color: rgba(0,0,0,0.6);
				height: ${xl_height_input - 2}px;
				margin-left: calc(${xl_width_input}px - ${xl_width_overlay}px);
				width: ${xl_width_overlay}px;
				filter: revert;
				font-size: 12px;
				font-family: 'Poppins',sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #f7f7f7;

				${sx_position}

				border-radius: 2em ${s_border_tr} ${s_border_br} 2em;
			`,
		}, [
			dd('span', {
				style: `
					width: 16px;
					height: 16px;
					background-image: url('${chrome.runtime.getURL('/media/vendor/icon_16.png')}');
					margin-right: 8px;
				`,
			}),
			dd('span', {
				style: `
					cursor: pointer;
					white-space: nowrap;
					overflow-x: hidden;
					text-overflow: ellipsis;
					max-width: calc(100% - 38px);

					border-radius: 1em;
					text-align: center;
					border-width: 1px;
					border-style: solid;
					border-color: #ffb61a;

					display: flex;
					${b_multiaccount /* eslint-disable @typescript-eslint/indent */
						? `
							min-width: 70%;
							justify-content: space-between;
						`
						: `
							min-width: 60%;
							padding: 3px 8px;
							justify-content: center;
						` /* eslint-enable */}
				`,
			}, b_multiaccount
				? [
					dd('span', {
						'data-starshell': 'account-name',
						'style': `
							padding: 3px 3px 3px 8px;
							flex: auto;
						`,
					}, [`${a_accounts[i_account].name}`]),

					dd('span', {
						'data-starshell': 'next',
						'style': `
							border-left: 1px solid #ffb61a;
							padding: 0px 11px 0px 0px;
							flex-basis: 23px;
							writing-mode: vertical-rl;
							font-size: 12px;
							line-height: 1px;
							color: rgba(255,255,255,0.8);
						`,
					}, [
						dd('span', {
							style: `
								margin-right: 10px;
								line-height: 1px;
							`,
						}, ['>']),
					]),
				]
				: [
					dd('span', {
						'data-starshell': 'account-name',
					}, [`${a_accounts[i_account].name}`]),
				]
			),
		]);

		// changing account
		dm_overlay.querySelector('[data-starshell="next"]')?.addEventListener('click', (d_event: MouseEvent) => {
			i_account = (i_account + 1) % a_accounts.length;

			for(const dm_span of dm_overlay.querySelectorAll('[data-starshell="account-name"]')) {
				dm_span.textContent = a_accounts[i_account].name;
			}

			d_event.stopPropagation();
		});

		dm_overlay.addEventListener('click', () => {
			const sa_owner = pubkey_to_bech32(a_accounts[i_account].pubkey, 'secret');
			dm_input.value = sa_owner;
			dm_overlay.remove();
			setTimeout(() => {
				dm_input.dispatchEvent(new InputEvent('input', {inputType:'insertText', data:'s'}));
				debug('dispatched input event onto input');
			}, 200);
		});

		dm_input.insertAdjacentElement('afterend', dm_overlay);
	}

	/**
	 * Determines if input is visible. If it is, adds overlay immediately, otherwise watches until visible and then adds overlay
	 */
	function watch_input(dm_input: HTMLInputElement, a_chains_input: ChainStruct[]) {
		const {
			height: xl_height_input,
			width: xl_width_input,
		} = dm_input.getBoundingClientRect();

		// input is visible; add input overlay
		if(xl_width_input * xl_height_input > 10) {
			void add_input_overlay(dm_input, a_chains_input);
		}
		// input not visible, wait for it to appear
		else {
			// do not add overlay more than once
			let b_overlay_added = false;

			// observer callback
			const f_observer: MutationCallback = (di_mutations, d_observer) => {
				// check input bounds in a beat
				setTimeout(() => {
					const {
						height: xl_height_input_now,
						width: xl_width_input_now,
					} = dm_input.getBoundingClientRect();

					// is visible enough now
					if(xl_width_input_now * xl_height_input_now > 100) {
						// do not add more than once
						if(b_overlay_added) return;
						b_overlay_added = true;

						// remove observer
						d_observer.disconnect();

						// add overlay in a beat
						void add_input_overlay(dm_input, a_chains_input);
					}
				}, 150);
			};

			// attach new observer to document body
			const d_observer = new MutationObserver(f_observer);
			d_observer.observe(document.body, {
				subtree: true,
				childList: true,
				attributes: true,
			});
		}
	}

	/**
	 * Waits for head to load and then finds autofillable inputs
	 */
	async function dom_ready() {
		debug('dom_ready triggered');

		// logged in
		if(await Vault.isUnlocked()) {
			// load chains store
			const ks_chains = await Chains.read();

			// check if app is registered
			const g_app = await Apps.get(location.host, location.protocol as 'https:');

			// app is registered and enabled
			if(g_app?.on) {
				debug('App is registered and enabled');

				// load the app's pfp
				await load_app_pfp(true);

				try {
					// find autofillable inputs
					qsa(document.body, 'input[type="text"]').forEach((dm_input) => {
						// whip-005 account
						if('account' === dm_input.dataset['whip-005Type']) {
							// list of chains for account
							const a_chains_input: ChainStruct[] = [];

							// each caip2
							const a_caip2s = dm_input.dataset['whip-005Chains']?.trim().split(/\s+/g) || [];
							for(const si_caip2 of a_caip2s) {
								// parse caip2
								const m_caip2 = R_CAIP_2.exec(si_caip2);

								// unparseable caip2; skip
								if(!m_caip2) continue;

								// chain path
								const p_chain = Chains.pathFor(m_caip2[1] as 'cosmos', m_caip2[2]);

								// load chain struct
								const g_chain = ks_chains.at(p_chain);

								// chain not defined; skip
								if(!g_chain) continue;

								// add chain to list
								a_chains_input.push(g_chain);
							}

							// watch input on valid chains
							watch_input(dm_input, a_chains_input);
						}
						// non-whip-005; guessable account input
						else if(/^(faucet|feegrant|account)-address$/.test(dm_input.id) || ('LABEL' === dm_input.previousElementSibling?.tagName && /wallet addr/i.test(dm_input.previousElementSibling.textContent!))) {
							// default to secret-4 mainnet for now
							watch_input(dm_input, [ks_chains.at('/family.cosmos/chain.secret-4')!]);
						}
					});
				}
				catch(e_app) {
					error(`Recovered from error: ${e_app.stack}`);
				}
			}
			else if(g_app) {
				warn(`App is disabled`);
			}
			else {
				debug(`App is not registered`);

				// TODO: show popup requesting autofill

				// // load the app's pfp
				// const g_profile = await load_app_pfp();

				// // notify service
				// f_runtime().sendMessage({
				// 	type: 'detectedWhip005',
				// 	value: {
				// 		profile: g_profile || {},
				// 	},
				// }, F_NOOP);
			}
		}
		// not logged in
		else {
			// TODO: present login prompt
		}

		// set basic app profile metadata for iOS
		if(B_IOS_WEBKIT) {
			let s_name = document.title;
			try {
				s_name = document.head?.querySelector?.('meta[name="application-name"][content]')?.['content']
					|| document.head?.querySelector?.('meta[property="og:site_name"][content]')?.['content']
					|| s_name;
			}
			catch(e_name) {}

			let s_description = '';
			try {
				s_description = document.head?.querySelector?.('meta[name="description"][content]')?.['content']
					|| document.head?.querySelector?.('meta[property="og:description"][content]')?.['content']
					|| s_description;
			}
			catch(e_name) {}

			// load app pfp
			await load_app_pfp();

			// submit page context to navigation view
			void new WebKitMessenger('witness', true).post({
				type: 'capture',
				value: {
					browsing_context: {
						href: location.href,
						name: s_name,
						description: s_description,
					},
				},
			});

			void create_app_profile();
		}
	}

	if('loading' !== document.readyState) {
		debug(`document already in ${document.readyState} ready`);
		void dom_ready();
	}
	else {
		debug(`listening for DOMContentLoaded event on window`);
		window.addEventListener('DOMContentLoaded', dom_ready);
	}
})();
