<script lang="ts">
	import type {AppPath} from '#/meta/app';
	import type {Dict, Promisable} from '#/meta/belt';
	
	import type {PfpTarget} from '#/meta/pfp';
	import type {Resource} from '#/meta/resource';
	import type {SearchItem} from '#/meta/search';
	
	import Fuse from 'fuse.js';
	import {onMount} from 'svelte';
	
	import {ClassType, ThreadId} from '#/app/def';
	import {GC_HOOKS_DEFAULT} from '#/app/nav/defaults';
	import {Navigator, type NavigatorConfig} from '#/app/nav/navigator';
	import AccountCreate from '#/app/screen/AccountCreate.svelte';
	import AccountsHome from '#/app/screen/AccountsHome.svelte';
	import AccountView from '#/app/screen/AccountView.svelte';
	import AppView from '#/app/screen/AppView.svelte';
	import BlankSvelte from '#/app/screen/Blank.svelte';
	import ContactView from '#/app/screen/ContactView.svelte';
	import ContractView from '#/app/screen/ContractView.svelte';
	import HoldingView from '#/app/screen/HoldingView.svelte';
	import ProviderView from '#/app/screen/ProviderView.svelte';
	import Send from '#/app/screen/Send.svelte';
	import SettingsMemos from '#/app/screen/SettingsMemos.svelte';
	import TokensAdd from '#/app/screen/TokensAdd.svelte';
	import WalletCreate from '#/app/screen/WalletCreate.svelte';
	import GenericRow from '#/app/ui/GenericRow.svelte';
	import {open_window, P_POPUP} from '#/extension/browser';
	import {system_notify} from '#/extension/notifications';
	import {launch_qr_scanner} from '#/extension/sensors';
	import {logout} from '#/share/auth';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Apps} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Medias} from '#/store/medias';
	import {Pfps} from '#/store/pfps';
	import {Providers} from '#/store/providers';
	import {interjoin, microtask, oderac, proper, timeout} from '#/util/belt';
	import {text_to_base64} from '#/util/data';
	import {dd, qsa} from '#/util/dom';
	import {abbreviate_addr} from '#/util/format';
	import {
		popup_receive,
		yw_account_ref,
		yw_cancel_search,
		yw_navigator,
		yw_search,
	} from '##/mem';
	import {
		Screen,
	} from '##/screen/_screens';
	
	import SX_ICON_ACCOUNTS from '#/icon/account_circle.svg?raw';
	import SX_ICON_CONNECTIONS from '#/icon/account_tree.svg?raw';
	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_BELL from '#/icon/bell.svg?raw';
	import SX_ICON_TAGS from '#/icon/bookmarks.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_CONNECT from '#/icon/connect.svg?raw';
	import SX_ICON_CUBES from '#/icon/cubes.svg?raw';
	import SX_ICON_DOWNLOAD from '#/icon/download.svg?raw';
	import SX_ICON_CHAINS from '#/icon/mediation.svg?raw';
	import SX_ICON_POPOUT from '#/icon/pop-out.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_SCAN from '#/icon/scan.svg?raw';
	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_LOGOUT from '#/icon/sensor_door.svg?raw';
	import SX_ICON_SETTINGS from '#/icon/settings.svg?raw';
	import SX_ICON_SHIELD from '#/icon/shield.svg?raw';
	import SX_ICON_SIGNATURE from '#/icon/signature.svg?raw';
	import SX_ICON_CONTACTS from '#/icon/supervisor_account.svg?raw';
	import SX_ICON_ACC_CREATED from '#/icon/user-add.svg?raw';
	import SX_ICON_ACC_EDITED from '#/icon/user-edit.svg?raw';

	const DM_BR = dd('br');

	let dm_results: HTMLElement;

	type Match = Fuse.FuseResultMatch;

	let a_fuses: Fuse<SearchItem>[] = [];

	let s_result_status = '';

	let a_hits_page: Fuse.FuseResult<SearchItem>[] = [];

	let i_selected = -1;

	async function choose_navigator(b_use_system: boolean) {
		// shift key; mimic shifted click
		if(b_use_system) {
			// activate the scratch thread
			await $yw_navigator.activateThread(ThreadId.SCRATCH);

			// reset the thread in case something else was using the scratch space
			$yw_navigator.activeThread.reset();

			// cancel search
			$yw_cancel_search?.();

			// reset selected index
			i_selected = -1;

			// allow updates to propagate
			await microtask();

			// use system navigator
			return $yw_navigator;
		}

		// use page navigator
		return k_navigator_page;
	}

	let b_listening = false;
	async function keydown(d_event: KeyboardEvent) {
		const dm_target = d_event.target as HTMLElement;
		if(['INPUT', 'TEXTAREA', 'BUTTON'].includes(dm_target?.tagName) && 'search-bar-input' !== dm_target.id) {
			return;
		}

		switch(d_event.key) {
			case 'ArrowDown': {
				i_selected += 1;
				break;
			}

			case 'ArrowUp': {
				i_selected -= 1;
				break;
			}

			case 'Tab': {
				if(d_event.shiftKey) {
					i_selected -= 1;
				}
				else {
					i_selected += 1;
				}

				break;
			}

			case 'Enter': {
				// stop event
				d_event.stopPropagation();
				d_event.preventDefault();

				const i_hit = Math.max(0, i_selected);
				const g_hit = a_hits_page[i_hit];

				const g_class = H_CATEGORIES[g_hit.item.class];

				// choose which naviagor to use depending on shift key
				const k_navigator = await choose_navigator(d_event.shiftKey);

				// simulate click on resource
				void g_class.click(g_hit.item.resourcePath, k_navigator);

				return;
			}

			default: {
				return;
			}
		}

		// stop event
		d_event.stopPropagation();
		d_event.preventDefault();

		// clamp selection
		i_selected = Math.min(a_hits_page.length, Math.max(-1, i_selected));

		// unselect previous selection(s)
		for(const dm_selected of qsa(dm_results, '.selected')) {
			dm_selected.classList.remove('selected');
		}

		// none selected
		if(i_selected < 0) {
			// scroll to top of bounding page view
			dm_results.closest('.bounds')?.scroll({
				top: 0,
				behavior: 'smooth',
			});

			// focus on search input
			dm_search.focus();
		}
		// some hit is selected
		else {
			const dm_selected = dm_results.children[i_selected];

			// add class
			dm_selected.classList.add('selected');

			// scroll into view
			dm_selected.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		}
	}

	$: {
		if($yw_search && !b_listening) {
			addEventListener('keydown', keydown);
			b_listening = true;
		}
		else {
			b_listening = false;
		}
	}

	const fuzey = (a_items: SearchItem[], a_exclude: string[]=[], h_weights: Dict<number>={}) => new Fuse(a_items, {
		includeScore: true,
		includeMatches: true,
		keys: [
			{
				name: 'name',
				weight: 1,
			},
			...Object.keys(a_items[0]?.details || {})
				.filter(s => !a_exclude.includes(s))
				.map(s => ({
					name: `details.${s}`,
					weight: h_weights[s] ?? 0.75,
				})),
		],
	});


	function highlight(g_match: Match, s_search: string, s_prefix='', s_suffix='') {
		const s_value = g_match.value!;
		const a_nodes: Array<HTMLElement | string> = [];

		const s_search_compare = s_search.toLocaleLowerCase();

		let i_prev = 0;
		for(let [i_lo, i_hi] of g_match.indices) {
			// skip short sequences
			if(i_hi - i_lo <= 1) continue;

			// prep the substring text
			let s_substring = s_value.slice(i_lo, i_hi + 1);
			const s_substring_compare = s_substring.toLocaleLowerCase();

			// inexact match
			if(s_substring_compare !== s_search_compare) {
				// search is actually a substring of the match
				const i_start = s_substring_compare.indexOf(s_search_compare);
				if(i_start >= 0) {
					// adjust leading text
					i_lo += i_start;

					// adjust trailing text
					i_hi = i_lo + s_search_compare.length - 1;

					// adjust the substring text
					s_substring = s_value.slice(i_lo, i_hi + 1);
				}
				// not a complete substring; do not highlight it
				else {
					continue;
				}
			}

			// non-empty preceeding text
			if(i_lo - i_prev > 0) {
				a_nodes.push(s_value.slice(i_prev, i_lo));
			}

			// add highlight span
			a_nodes.push(dd('mark', {}, [
				s_substring,
			]));

			i_prev = i_hi + 1;
		}

		if(i_prev < s_value.length) {
			a_nodes.push(s_value.slice(i_prev));
		}

		if(s_prefix) {
			if('string' === typeof a_nodes[0]) {
				a_nodes[0] = s_prefix+a_nodes[0];
			}
			else {
				a_nodes.unshift(s_prefix);
			}
		}

		if(s_suffix) {
			if('string' === typeof a_nodes.at(-1)) {
				a_nodes[a_nodes.length-1] += s_suffix;
			}
			else {
				a_nodes.push(s_suffix);
			}
		}

		return dd('span', {}, a_nodes);
	}

	function addr_matches(g_match: Match, s_search: string) {
		return g_match.value!.toLowerCase().includes(s_search.toLocaleLowerCase());
	}

	function detail_addresses(a_addrs: Match[], s_search: string) {
		// multiple addresses, abbreviate
		if(a_addrs.length > 1) {
			return a_addrs.map(g => abbreviate_addr(g.value!)).join(' / ');
		}
		// single address, highlight
		else if(1 === a_addrs.length) {
			return highlight(a_addrs[0], s_search);
		}
	}

	function handle_matches(a_matches: readonly Match[] | undefined, h_handlers: Dict<(g: Match) => Promisable<any>>) {
		for(const g_match of a_matches || []) {
			const si_key = g_match.key!.replace(/^details\./, '');

			const f_handler = h_handlers[si_key];
			if(f_handler) {
				f_handler(g_match);
			}
		}
	}


	type DetailItem = string | HTMLElement;
	type DetailEntry = DetailItem | DetailItem[];


	const mimic_pfp = (sx_icon: string) => `svg:data:image/svg+xml;base64,${text_to_base64(sx_icon)}` as `svg:${string}`;

	const H_ACTIONS = {
		send: {
			name: 'Send / Transfer',
			text: 'Move fungible assets between accounts',
			icon: SX_ICON_SEND,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: Send,
					props: {},
				});
			},
		},
		recv: {
			name: 'Receive',
			text: 'Displays QR code and address information',
			icon: SX_ICON_RECV,
			pfp: '',
			click() {
				popup_receive($yw_account_ref);
			},
		},
		scan: {
			name: 'QR Code Scanner',
			text: 'Uses camera to scan QR codes',
			icon: SX_ICON_SCAN,
			pfp: '',
			click() {
				void launch_qr_scanner();
			},
		},
		popout: {
			name: 'Pop out to new window',
			text: 'Opens a standalone window view',
			icon: SX_ICON_POPOUT,
			pfp: '',
			click() {
				void open_window(P_POPUP, {popout:true});
			},
		},
		add_token: {
			name: 'Add tokens',
			text: 'Declare certain contracts as fungible',
			icon: SX_ICON_ADD,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: TokensAdd,
					props: {},
				});
			},
		},
		logout: {
			name: 'Log out / Sign out',
			text: 'Locks the wallet',
			icon: SX_ICON_LOGOUT,
			pfp: '',
			async click() {
				await logout();
				await timeout(1e3);
				globalThis.close?.();
			},
		},
		notify: {
			name: 'Test Notification',
			text: 'Creates a test notification',
			icon: SX_ICON_BELL,
			pfp: '',
			click() {
				void system_notify({
					item: {
						title: `🧪 Testing, 1 2 3...`,
						message: 'This is a test notification',
					},
				});
			},
		},
		new_account: {
			name: 'Add New Account',
			text: 'Creates a new account in the wallet',
			icon: SX_ICON_ACC_CREATED,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: AccountCreate,
				});
			},
		},
		newseed: {
			name: 'Add Seed Phrase',
			text: 'Creates new or imports/restores an existing mnemonic',
			icon: SX_ICON_ACC_CREATED,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: WalletCreate,
				});
			},
		},
		export_mnemonic: {
			name: 'Export Seed Phrase',
			text: 'View mnemonic seed phrase for export',
			icon: SX_ICON_DOWNLOAD,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: AccountsHome,
				});
			},
		},
		memo_settings: {
			name: 'Private Memo Settings',
			text: 'Enable or disable private memos on specific chains',
			icon: SX_ICON_SHIELD,
			pfp: '',
			click(k_navigator: Navigator) {
				k_navigator.activePage.push({
					creator: SettingsMemos,
				});
			},
		},
	};

	const H_CATEGORIES: Dict<{
		fuse(g_context: {
			ks_chains: Awaited<ReturnType<typeof Chains['read']>>;
		}): Promisable<Fuse<SearchItem>>;

		expound?(g_result: Fuse.FuseResult<SearchItem>, s_search: string): {
			detail?: DetailEntry | DetailEntry[] | undefined;
		} | undefined;

		click(p_resource: Resource.Path, k_navigator: Navigator): Promisable<void>;
	}> = {
		// actions
		[ClassType.ACTION]: {
			fuse: () => fuzey(oderac(H_ACTIONS, (si_key, g_action) => ({
				class: ClassType.ACTION,
				name: g_action.name,
				resourcePath: si_key,
				resource: {
					name: g_action.name[0],
					pfp: mimic_pfp(g_action.icon),
				},
				details: {
					text: g_action.text,
				},
			})), [], {
				text: 0.9,
			}),

			expound(g_result, s_search) {
				const g_details = g_result.item.details;

				let w_text = g_details.text as string | HTMLElement;

				handle_matches(g_result.matches, {
					text: g => w_text = highlight(g, s_search),
				});

				return {
					detail: [w_text],
				};
			},

			click(p_resource, k_navigator) {
				return H_ACTIONS[p_resource as keyof typeof H_ACTIONS].click(k_navigator);
			},
		},

		// accounts
		[ClassType.ACCOUNT]: {
			fuse: async({ks_chains}) => fuzey((await Accounts.read()).entries().map(([p_account, g_account]) => {
				const as_addrs = new Set<string>();

				// render account address for each chain
				for(const [, g_chain] of ks_chains) {
					as_addrs.add(Chains.addressFor(g_account.pubkey, g_chain));
				}

				// convert address set to array
				const a_addrs = [...as_addrs];

				return {
					class: ClassType.ACCOUNT,
					name: g_account.name,
					resourcePath: p_account,
					resource: g_account,
					details: {
						addresses: a_addrs,
					},
				};
			}), [], {
				addresses: 0.4,
			}),

			expound(g_result, s_search) {
				const a_addrs: Match[] = [];

				handle_matches(g_result.matches, {
					addresses: g => addr_matches(g, s_search)? a_addrs.push(g): 0,
				});

				return {
					detail: detail_addresses(a_addrs, s_search),
				};
			},

			click(p_resource, k_navigator) {
				k_navigator.activePage.push({
					creator: AccountView,
					props: {
						accountPath: p_resource,
					},
				});
			},
		},

		// apps
		[ClassType.APP]: {
			fuse: async() => fuzey((await Apps.read()).entries().map(([p_app, g_app]) => ({
				class: ClassType.APP,
				name: g_app.host,
				resourcePath: p_app,
				resource: g_app,
				details: {
					host: g_app.host,
				},
			}))),

			expound(g_result, s_search) {
				const a_hosts: Match[] = [];

				handle_matches(g_result.matches, {
					host: g => a_hosts.push(g),
				});

				return {
					detail: a_hosts.map(p => highlight(p, s_search)),
				};
			},

			async click(p_resource, k_navigator) {
				const g_app = await Apps.at(p_resource as AppPath);

				k_navigator.activePage.push({
					creator: AppView,
					props: {
						app: g_app,
					},
				});
			},
		},

		// chains
		[ClassType.CHAIN]: {
			fuse: ({ks_chains}) => fuzey(ks_chains.entries().map(([p_chain, g_chain]) => ({
				class: ClassType.CHAIN,
				name: g_chain.name,
				resourcePath: p_chain,
				resource: g_chain,
				details: {
					id: g_chain.reference,
					...g_chain.blockExplorer? {blockExplorer:g_chain.blockExplorer.base}: {},
				},
			})), [], {
				id: 0.45,
				blockExplorer: 0.4,
			}),

			expound(g_result, s_search) {
				const a_details: DetailItem[] = [];

				handle_matches(g_result.matches, {
					id: g => a_details.unshift(highlight(g, s_search)),
					blockExplorer: g => a_details.push(highlight(g, s_search, '<', '>')),
				});

				return {
					detail: interjoin(a_details, ' : '),
				};
			},

			click(p_resource, k_navigator) {
				// k_navigator.activePage.push({
				// 	creator: ChainView,
				// 	props: {
				// 		accountPath: p_resource,
				// 	},
				// });
			},
		},

		// coins
		[ClassType.COIN]: {
			fuse: ({ks_chains}) => fuzey(ks_chains.entries().flatMap(([p_chain, g_chain]) => oderac(g_chain.coins, (si_coin, g_coin) => {
				const s_name = g_coin.name || proper(g_coin.extra?.coingeckoId || 'Unknown');

				return {
					class: ClassType.COIN,
					name: s_name,
					postname: si_coin,
					resourcePath: `${p_chain}/coin.${si_coin}`,
					resource: {
						...g_coin,
						name: s_name,
						pfp: g_coin.pfp || g_chain.pfp,
					},
					details: {
						symbol: `${si_coin} coin`,
						denom: `(${g_coin.denom})`,
						coingecko: g_coin.extra?.coingeckoId || '',
					},
				};
			})), ['coingecko'], {
				symbol: 0.7,
				denom: 0.7,
				coingecko: 0.8,
			}),

			expound(g_result, s_search) {
				const g_details = g_result.item.details;

				let w_symbol = g_details.symbol+' coin' as string | HTMLElement;
				let w_denom = g_details.denom as string | HTMLElement;

				handle_matches(g_result.matches, {
					symbol: g => w_symbol = highlight(g, s_search),
					denom: g => w_denom = highlight(g, s_search),
				});

				return {
					detail: [[w_symbol, w_denom]],
				};
			},

			click(p_resource, k_navigator) {
				k_navigator.activePage.push({
					creator: HoldingView,
					props: {
						holdingPath: p_resource,
					},
				});
			},
		},

		// contacts
		[ClassType.CONTACT]: {
			fuse: async({ks_chains}) => fuzey([...(await Agents.read()).contacts()].map(([p_contact, g_contact]) => ({
				class: ClassType.CONTACT,
				name: g_contact.name,
				resourcePath: p_contact,
				resource: g_contact,
				details: {
					notes: g_contact.notes,
					addresses: [...ks_chains.inNamespace(g_contact.namespace)]
						.map(([, g_chain]) => Agents.addressFor(g_contact, g_chain)),
				},
			}))),

			expound(g_result, s_search) {
				const a_addrs: Match[] = [];
				const a_excerpts: DetailItem[] = [];

				handle_matches(g_result.matches, {
					addresses: g => addr_matches(g, s_search)? a_addrs.push(g): 0,
					notes(g_match) {
						const dm_highlighted = highlight(g_match, s_search);

						// at least one mark
						const dm_mark = dm_highlighted.querySelector('mark');
						if(dm_mark) {
							// cut leading text
							const dm_leading = dm_mark.previousSibling;
							if(Node.TEXT_NODE === dm_leading?.nodeType) {
								const s_text = dm_leading.textContent!;
								if(s_text.length > 20) {
									dm_leading.textContent = '…'+s_text.slice(-20);
								}
							}

							// cut trailing text
							const dm_trailing = dm_mark.nextSibling;
							if(Node.TEXT_NODE === dm_trailing?.nodeType) {
								const s_text = dm_trailing.textContent!;
								if(s_text.length > 20) {
									dm_trailing.textContent = s_text.slice(0, 20)+'…';
								}
							}

							// remove everything else
							Array.from(dm_highlighted.childNodes).slice(3).forEach(dm_extra => dm_extra.remove());

							// push excerpt
							a_excerpts.push(dm_highlighted);
						}
						// otherwise, trim the trailing text
						else {
							a_excerpts.push(g_match.value?.slice(0, 20)+'…');
						}
					},
				});

				const a_details: DetailItem[] = [];

				// start with addresses on first line
				if(a_addrs.length) {
					a_details.push(dd('span', {}, [
						detail_addresses(a_addrs, s_search)!,
					]));
				}

				// concat any excerpts
				if(a_excerpts.length) {
					a_details.push(...a_excerpts);
				}

				// interjoin with line breaks
				return {
					detail: a_details,
				};
			},

			click(p_resource, k_navigator) {
				k_navigator.activePage.push({
					creator: ContactView,
					props: {
						contactPath: p_resource,
					},
				});
			},
		},

		// contracts (including tokens)
		[ClassType.CONTRACT]: {
			fuse: async() => fuzey((await Contracts.read()).entries().map(([p_contrct, g_contract]) => ({
				class: ClassType.CONTRACT,
				name: g_contract.name,
				resourcePath: p_contrct,
				resource: g_contract,
				details: {
					address: g_contract.bech32,
					interfaces: Object.keys(g_contract.interfaces).sort(),
					symbols: (() => {
						const a_symbols: string[] = [];
						const h_interfaces = g_contract.interfaces;

						if(h_interfaces.snip20) {
							a_symbols.push(`${h_interfaces.snip20.symbol} token`);
						}

						return a_symbols;
					})(),
				},
			})), [], {
				interfaces: 0.6,
			}),

			expound(g_result, s_search) {
				const a_addrs: Match[] = [];
				const a_interfaces: DetailItem[] = [];
				const a_symbols: DetailItem[] = [];

				handle_matches(g_result.matches, {
					address: g => addr_matches(g, s_search)? a_addrs.push(g): 0,
					interfaces: g => a_interfaces.push(highlight(g, s_search)),
					symbols: g => a_symbols.push(highlight(g, s_search)),
				});

				const a_details: DetailItem[] = [];

				if(a_interfaces.length) {
					a_details.push(dd('span', {}, interjoin(a_interfaces, '/')));
				}

				if(a_symbols.length) {
					a_details.push(dd('span', {}, interjoin(a_symbols, ', ')));
				}
				else {
					a_details.push((g_result.item.details.symbols as string[]).join(', '));
				}

				if(a_addrs.length) {
					a_details.push(detail_addresses(a_addrs, s_search)!);
				}

				return {
					detail: a_details,
				};
			},

			click(p_resource, k_navigator) {
				k_navigator.activePage.push({
					creator: ContractView,
					props: {
						contractPath: p_resource,
					},
				});
			},
		},

		// providers
		[ClassType.PROVIDER]: {
			fuse: async() => fuzey((await Providers.read()).entries().map(([p_provider, g_provider]) => ({
				class: ClassType.PROVIDER,
				name: g_provider.name,
				resourcePath: p_provider,
				resource: g_provider,
				details: {
					grpcWebUrl: (() => {
						const p_grpc = g_provider.grpcWebUrl;

						try {
							return new URL(p_grpc).host;
						}
						catch(e_parse) {
							return p_grpc;
						}
					})(),
					rpcHost: g_provider.rpcHost,
				},
			}))),

			expound(g_result, s_search) {
				let {
					grpcWebUrl: w_grpc,
					rpcHost: w_host,
				} = g_result.item.details as {
					grpcWebUrl: string | HTMLElement;
					rpcHost: string | HTMLElement;
				};

				handle_matches(g_result.matches, {
					grpcWebUrl: g => w_grpc = highlight(g, s_search),
					rpcHost: g => w_host = highlight(g, s_search),
				});

				return {
					detail: [w_grpc, w_host],
				};
			},

			click(p_resource, k_navigator) {
				k_navigator.activePage.push({
					creator: ProviderView,
					props: {
						providerPath: p_resource,
					},
				});
			},
		},
	};

	(async() => {
		const ks_chains = await Chains.read();

		a_fuses = await Promise.all(Object.values(H_CATEGORIES).map(g => g.fuse({
			ks_chains,
		})));
	})();


	function search(s_search: string) {
		const a_groups: {top: number; hits: Fuse.FuseResult<SearchItem>[]}[] = [];
		const a_hits: Fuse.FuseResult<SearchItem>[] = [];
		let c_total = 0;

		for(const y_fuse of a_fuses) {
			const a_hits_local = y_fuse.search(s_search);

			if(a_hits_local.length) {
				c_total += a_hits.length;

				a_hits.push(...a_hits_local);

				a_groups.push({
					top: a_hits_local[0].score!,
					hits: a_hits_local,
				});
			}
		}

		// sort all hits (0 = perfect match, 1 = mismatch)
		a_hits.sort((g_a, g_b) => g_a.score! - g_b.score!);

		// set result status
		s_result_status = `Found ${a_hits.length} results across ${a_groups.length} categories`;

		a_hits_page = a_hits;
		console.log(a_hits);

		// prepare replacement element
		const dm_replace = dd('div');

		// each search result hit
		for(const g_hit of a_hits)	{
			let dm_detail!: HTMLSpanElement;

			// expound on the hit
			const g_expounded = H_CATEGORIES[g_hit.item.class].expound?.(g_hit, s_search);
			const z_detail = g_expounded?.detail;
			if(z_detail) {
				if('string' === typeof z_detail) {
					dm_detail = dd('span', {}, [z_detail]);
				}
				else if(Array.isArray(z_detail)) {
					const a_nodes = interjoin((z_detail as DetailEntry[]).map(z_item => Array.isArray(z_item)
						? dd('span', {
							style: `
								display: inline-flex;
								gap: 0.75ch;
							`,
						}, z_item)
						: z_item), DM_BR);

					dm_detail = dd('span', {}, a_nodes);
				}
				else {
					dm_detail = z_detail;
				}
			}

			// create the row
			new GenericRow({
				target: dm_replace,
				props: {
					item: g_hit.item,
					detail: dm_detail,
					pfpDim: 32,
				},
			});
		}

		// clear results list
		dm_results.innerHTML = dm_replace.innerHTML;

		// render dynamic content
		(async() => {
			// create click bindings
			for(const dm_row of qsa(dm_results, '.row[data-path]') as HTMLElement[]) {
				dm_row.addEventListener('click', click_row);
			}

			// load media store
			const ks_medias = await Medias.read();

			// iterate thru pfps
			for(const dm_placeholder of qsa(dm_results, '.dynamic-pfp') as HTMLElement[]) {
				const g_args = JSON.parse(dm_placeholder.dataset.pfpArgs!) as {
					alt: string;
					dim: number;
				};

				// load pfp
				const dm_pfp = await Pfps.load(dm_placeholder.parentElement!.dataset.path! as PfpTarget, {
					...g_args,
					medias: ks_medias,
				});

				// replace dom
				dm_placeholder.replaceWith(dm_pfp!);
			}
		})();
	}

	async function click_row(this: HTMLElement, d_event: MouseEvent) {
		const {
			class: si_class,
			path: p_resource,
		} = this.dataset;

		// choose which naviagor to use depending on shift key
		const k_navigator = await choose_navigator(d_event.shiftKey);

		// click resource
		await H_CATEGORIES[si_class!].click(p_resource!, k_navigator);
	}


	// root element binding
	let dm_search: HTMLElement;

	// create standalone navigator for search results
	let k_navigator_page: Navigator;
	onMount(() => {
		// navigator config
		const gc_navigator: NavigatorConfig = {
			// threads container
			container: dm_search,

			// set search result context
			context: {
				searching: true,
			},

			// default threads config
			threads: {
				default: () => ({
					creator: BlankSvelte,
				}),
			},

			// default hooks
			hooks: {
				...GC_HOOKS_DEFAULT,

				// if the user starts navigating away, exit the preview
				before_push(kt_context, kp_src, gc_page) {
					if(kt_context.history.length > 1) {
						// cancel the search
						$yw_cancel_search();

						// go async
						(async() => {
							// activate the scratch thread
							await $yw_navigator.activateThread(ThreadId.SCRATCH);

							// reset the thread in case something else was using the scratch space
							$yw_navigator.activeThread.reset();

							await microtask();

							const gc_root = kt_context.page;

							// replay current page creation on destination navigator
							$yw_navigator.activePage.push({
								creator: gc_root.creator,
								props: gc_root.props,
							});

							// play the new page push on the scratch thread instead
							$yw_navigator.activePage.push(gc_page);

							// reset the abandoned thread in the search navigator
							k_navigator_page.activeThread.reset();
						})();

						// cancel the current navigation
						return false;
					}
				},

				// upon any page change
				after_change(kt_context, kp_src, kp_dst, s_transition, h_extra={}) {
					// notify dst page
					void kp_dst.fire('focus');
				},
			},
		};

		k_navigator_page = new Navigator(gc_navigator);
	});

	$: {
		if($yw_search) {
			search($yw_search);
		}
		// search was cleared; reset thread
		else if(k_navigator_page) {
			// can't reset thread here 
		}
	}
</script>

<style lang="less">
	@import '../../_base.less';

	.search {
		position: absolute;
		top: 70px;
		left: 0;
		height: calc(100% - 70px);
		width: 100%;
		z-index: 1000;

		.title {
			.font(big);
		}

		.status {
			.font(regular, @size: 12px);
			color: var(--theme-color-text-med);
		}

		.results {

		}
	}

	.row[data-class="action"] {
		.global_pfp>img {
			:global(&) {
				filter: invert(1);
			}
		}
	}
</style>


<div class="search" class:display_none={!$yw_search} bind:this={dm_search}>
	<Screen debug='Search' root>
		<div class="title">
			Search Results
		</div>

		<div class="status">
			{s_result_status}
		</div>

		<div class="results no-margin" bind:this={dm_results}>
		</div>
	</Screen>
</div>
