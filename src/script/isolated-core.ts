import type {IcsToService} from './messages';

import type {ConnectionManifestV1, SessionRequest} from '#/meta/api';

import type {Dict, JsonObject, JsonValue} from '#/meta/belt';

import type {Bech32, Caip2, ChainStruct, ChainNamespaceKey, ContractStruct, AgentStruct, ChainPath} from '#/meta/chain';

import type {ContactSpace, ContactStruct} from '#/meta/contact';
import {ContactAgentType} from '#/meta/contact';
import type {PfpTarget} from '#/meta/pfp';


import type {Vocab} from '#/meta/vocab';

import {TokenInterfaceRuntimeSchema} from '#/schema/token-interface-const';

import toml from 'toml';

import {open_flow} from './msg-flow';

import {load_icon_data} from './utils';

import {load_word_list} from '#/crypto/bip39';
import {SessionStorage} from '#/extension/session-storage';
import {
	A_CHAIN_NAMESPACES,
	B_DESKTOP,
	B_IPHONE_IOS,
	N_PX_DIM_ICON,
	RT_CAIP_2_NAMESPACE,
	RT_CAIP_2_REFERENCE,
	RT_UINT,
	R_BECH32,
	R_CAIP_10,
	R_CAIP_19,
	R_CAIP_2,
	R_CHAIN_ID_VERSION,
	R_CHAIN_NAME,
	R_CONTRACT_NAME,
	R_DATA_IMAGE_URL_WEB,
	R_FAULTY_CAIP_19,
	R_TOKEN_SYMBOL,
} from '#/share/constants';
import {AppProfile, Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {ode, is_dict} from '#/util/belt';
import {concat, sha256_sync, text_to_buffer, uuid_v4} from '#/util/data';
import {qsa} from '#/util/dom';



// verbose
const logger = si_channel => (s: string, ...a_args: any[]) => console[si_channel](`StarShelll.isolated-core: ${s}`, ...a_args as unknown[]);
const debug = logger('debug');
const warn = logger('warn');
const error = logger('error');
// const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.isolated-core: ${s}`, ...a_args as unknown[]);
// const error = (s: string, ...a_args: any[]) => console.error(`StarShell.isolated-core: ${s}`, ...a_args as unknown[]);

const R_CHAIN_ID_WHITELIST = /^(?:(kava_[1-9]\d*-|shentu-[1-9][0-9]*\.|evmos_[0-9]+-)[1-9]\d*|bostrom)$/;


const f_runtime = () => chrome.runtime as Vocab.TypedRuntime<IcsToService.PublicVocab>;

export const ServiceRouter = {
	async connect(g_manifest: ConnectionManifestV1): Promise<{}> {
		debug(`Evaluating connection manifest: %o`, g_manifest);

		// invalid structure
		if(!is_dict(g_manifest) || 'string' !== typeof g_manifest.schema) {
			throw new Error('Invalid manifest structure');
		}

		// unknown manifest version
		if('1' !== g_manifest.schema) {
			throw new Error('Unknown or unsupported manifest schema version');
		}

		// missing chains
		if(!is_dict(g_manifest.chains) || !Object.keys(g_manifest.chains).length) {
			throw new Error('No chains were specified in request');
		}

		// destructure manifest
		const {
			chains: h_chains_manifest,
			sessions: h_sessions_manifest,
			accountPath: p_account,
		} = g_manifest;

		// valid chains
		const h_chains_valid: Record<Caip2.String, ChainStruct> = {};

		// chain errors
		const h_chains_error: Dict<{
			error: string;
			chain: unknown;
		}> = {};

		// // chain answers
		// const a_answers: Vocab.MessageValue<HostToRelay.AuthedVocab, 'respondConnect'>['answer'][] = [];

		// // read existing chains from store
		// const ks_chains = await Chains.read();

		// each chain
		for(const si_key in h_chains_manifest) {
			// ref supplied chain value
			const g_chain = h_chains_manifest[si_key as Caip2.String];

			// prep error handling convenience methods
			const creject = (s_reason: string) => h_chains_error[si_key] = {error:s_reason, chain:g_chain};
			const cerr = (s_reason: string) => new Error(`${s_reason} at .chains["${si_key}"]`);

			// validate descriptor structure
			if(!is_dict(g_chain) || 'string' !== typeof g_chain.namespace || 'string' !== typeof g_chain.reference) {
				throw cerr('Invalid chain identification');
			}

			// CAIP-2 identifier
			const si_caip2 = `${g_chain.namespace}:${g_chain.reference}` as const;

			// key mismatch
			if(si_key !== si_caip2) {
				throw cerr(`Chain's CAIP-2 identifiers do not match: "${si_key}" != "${si_caip2}"`);
			}

			// family not supported
			if(!A_CHAIN_NAMESPACES.includes(g_chain.namespace)) {
				creject(`"${g_chain.namespace}" namespace not supported`);

				// move onto next chain
				continue;
			}

			// // validate chain category
			// if(!A_CHAIN_CATEGORIES.includes(g_chain.category)) {
			// 	return cerr(`Invalid category value "${g_chain.category}"; must be one of (${A_CHAIN_CATEGORIES.join(', ')})`);
			// }

			// validate chain id
			if(!R_CHAIN_ID_VERSION.test(g_chain.reference)) {
				// whitelisted
				if(R_CHAIN_ID_WHITELIST.test(g_chain.reference)) {
					// ignore it
					creject(`"${g_chain.reference}" does not follow the CAIP-2 chain id specification and is not supported at this time`);

					// move onto next chain
					continue;
				}
				// invalid chin id
				else {
					// ignore it
					creject(`Invalid chain id "${g_chain.reference}" for ${g_chain.namespace} family; failed to match regular expression /${R_CHAIN_ID_VERSION.source}/`);

					// move onto next chain
					continue;
				}
			}

			// validate chain name if defined
			if('name' in g_chain && 'undefined' !== typeof g_chain) {
				if('string' !== typeof g_chain.name) {
					throw cerr('Invalid chain name is not a string');
				}

				if(!R_CHAIN_NAME.test(g_chain.name)) {
					// ignore it
					creject(`Invalid chain name "${g_chain.name}"; failed to match regular expression /${R_CHAIN_NAME.source}/`);

					// move onto next chain
					continue;
				}

				if(g_chain.name.length > 64) {
					// ignore it
					creject('Chain name too long');

					// move onto next chain
					continue;
				}
			}

			// fix chain name
			const s_name = g_chain.name?.replace(/^\s+|\s+$/g, '') || g_chain.reference;

			// sanitize chain pfp if defined
			if('pfp' in g_chain) {
				const s_pfp = '' as PfpTarget;

				// truthy
				if(g_chain.pfp) {
					// not a string
					if('string' !== typeof g_chain.pfp) {
						throw cerr('Invalid chain pfp is not a string');
					}

					// must be a valid data URL
					if(!R_DATA_IMAGE_URL_WEB.test(g_chain.pfp)) {
						throw cerr('Invalid chain pfp must be "data:image/png;base64,..."');
					}
				}

				g_chain.pfp = s_pfp;
			}

			// // chain already exists in wallet
			// const p_chain = Chains.pathFrom(g_chain);
			// const g_chain_existing = ks_chains.at(p_chain);
			// if(g_chain_existing) {
			// 	// replace with existing
			// 	g_chain = g_chain_existing;

			// 	// TODO: find differences
			// }

			// commit to valid chains
			h_chains_valid[si_caip2] = {
				...g_chain,
				name: s_name,
			};
		}

		// valid session requests
		const h_sessions_valid: Dict<SessionRequest> = {};

		// invalid session requests
		const h_sessions_error: Dict<{
			error: string;
			session: unknown;
		}> = {};

		// set of used chains
		const as_chains_used = new Set<Caip2.String>();

		// each session request
		for(const si_key in h_sessions_manifest) {
			// ref supplied session request value
			const g_req_read = h_sessions_manifest[si_key];

			// prep error handling convenience methods
			const creject = (s_reason: string) => h_sessions_error[si_key] = {error:s_reason, session:g_req_read};
			const cerr = (s_reason: string) => new Error(`${s_reason} at .sessions["${si_key}"]`);

			// validate request structure
			if(!is_dict(g_req_read)) throw cerr('Invalid session request');

			// validate caip2 identifier
			const si_caip2 = g_req_read.caip2;
			if('string' !== typeof si_caip2) {
				throw cerr('Missing .caip2 identifier');
			}

			// chain isn't valid
			if(!h_chains_valid[si_caip2]) {
				// chain is missing from manifest
				if(!(si_caip2 in h_chains_manifest)) {
					creject(`No "${si_caip2}" chain was found in the manifest`);
					continue;
				}
				// chain had an invalid definition
				else {
					creject(`The "${si_caip2}" chain definition was invalid`);
					continue;
				}
			}

			// prep sanitized version
			const g_req_write: SessionRequest = {
				caip2: si_caip2,
			};

			// only keep recognized members
			if('doxx' in g_req_read) {
				const g_doxx_read = g_req_read.doxx;

				// validate
				if(!is_dict(g_doxx_read)) throw cerr(`Invalid type for .doxx property`);

				// prep sanitized version
				const g_doxx_write: SessionRequest['doxx'] = g_req_write.doxx = {};

				// address property
				if('address' in g_doxx_read) {
					const g_addr_read = g_doxx_read.address;

					// validate
					if(!is_dict(g_addr_read)) throw cerr(`Invalid type for .doxx.address property`);

					// missing justification
					if('string' !== typeof g_addr_read.justification) {
						throw cerr(`Missing string value for .doxx.address.justification`);
					}

					// too long
					if(g_addr_read.justification.length > 280) {
						throw cerr(`Justification string limited to 280 characters maximum.`);
					}

					// copy to sanitized version
					g_doxx_write.address = {
						justification: g_addr_read.justification,
					};
				}

				// name property exists and is truthy
				if(g_doxx_read.name) {
					g_doxx_write.name = {};
				}
			}

			// 
			if('query' in g_req_read) {
				const g_query_read = g_req_read.query;

				// validate
				if(!is_dict(g_query_read)) throw cerr(`Invalid type for .query property`);

				// prep sanitized version
				const g_query_write: SessionRequest['query'] = g_req_write.query = {};

				// node property
				if('node' in g_query_read) {
					const g_node_read = g_query_read.node;

					// validate
					if(!is_dict(g_node_read)) throw cerr(`Invalid type for .query.node property`);

					// missing justification
					if('string' !== typeof g_node_read.justification) {
						throw cerr(`Missing string value for .query.node.justification`);
					}

					// too long
					if(g_node_read.justification.length > 280) {
						throw cerr(`Justification string limited to 280 characters maximum.`);
					}

					// copy to sanitized version
					g_query_write.node = {
						justification: g_node_read.justification,
					};
				}
			}

			// 
			if('broadcast' in g_req_read) {
				const g_broadcast_read = g_req_read.broadcast;

				// validate
				if(!is_dict(g_broadcast_read)) throw cerr(`Invalid type for .broadcast property`);

				// set
				g_req_write.broadcast = {};
			}

			// TODO: validate other request members

			// set sanitized version
			h_sessions_valid[si_key] = g_req_write;
		}

		// check background service is alive on desktop
		if(B_DESKTOP) {
			// await new Promise((fk_resolve, fe_reject) => {
			// 	// service timeout
			// 	const i_whoami = setTimeout(() => {
			// 		void open_flow({
			// 			flow: {
			// 				type: 'restartService',
			// 				page: {
			// 					href: location.href,
			// 					tabId: -1,
			// 					windowId: -1,
			// 				},
			// 				value: {},
			// 			},
			// 		});
			// 	}, 3e3);

			// 	// contact service
			// 	f_runtime().sendMessage({
			// 		type: 'whoami',
			// 	}, () => {
			// 		// cancel timeout
			// 		clearTimeout(i_whoami);

			// 		fk_resolve(void 0);
			// 	});
			// });

			// service timeout
			const i_whoami = setTimeout(() => {
				void open_flow({
					flow: {
						type: 'restartService',
						page: {
							href: location.href,
							tabId: -1,
							windowId: -1,
						},
						value: {},
					},
				});
			}, 3e3);

			// contact service
			await f_runtime().sendMessage({
				type: 'whoami',
			});

			// cancel timeout
			clearTimeout(i_whoami);
		}

		// // go async
		// return new Promise((fk_resolve, fe_reject) => {
		// 	// send connection request to service
		// 	f_runtime().sendMessage({
		// 		type: 'requestConnection',
		// 		value: {
		// 			chains: h_chains_valid,
		// 			sessions: h_sessions_valid,
		// 			accountPath: p_account,
		// 		},
		// 	}, (w_response) => {
		// 		fk_resolve(w_response);
		// 	});
		// });

		// send connection request to service
		return await f_runtime().sendMessage({
			type: 'requestConnection',
			value: {
				chains: h_chains_valid,
				sessions: h_sessions_valid,
				accountPath: p_account,
			},
		});
	},
};


interface DestructuredLink {
	href: string;
	value: string;
}

export function* destructure_links(si_data_key: string): IterableIterator<DestructuredLink> {
	for(const dm_link of qsa(document.head, `link[rel="prefetch"][as="image"][data-${si_data_key}]`)) {
		const g_link = {
			href: dm_link.getAttribute('href'),
			value: dm_link.dataset[si_data_key],
		};

		if(g_link.href && g_link.value) yield g_link as DestructuredLink;
	}
}

function abbreviate_word(s_word: string) {
	// shorten
	if(s_word.length > 4) {
		// remove vowels that do not start word
		s_word = s_word.replace(/(.)[aeiou]/g, '$1');

		// still too long; truncate
		if(s_word.length > 6) s_word = s_word.slice(0, 6);
	}

	return s_word.toUpperCase();
}

async function generate_token_symbol(sa_token: Bech32) {
	// load word list
	const a_wordlist = await load_word_list();

	// contract suffix
	let s_contract_suffix = '';

	// abbreviate host parts
	const a_host = location.host.split(/[^\p{L}\p{N}]/u).map(abbreviate_word).reverse();

	// hash token address
	const atu8_sha256 = sha256_sync(text_to_buffer(sa_token));

	// wordlist available
	if(a_wordlist?.length) {
		// use the first 3 bytes (24 bits) of hash to pick from wordlist so there is no modulo bias in 2048 words
		const ab_entropy = concat([Uint8Array.from([0]), atu8_sha256.subarray(0, 3)]).buffer;

		// convert to 24-bit index and module by length of word list (2048)
		const i_word = new DataView(ab_entropy).getUint32(0) % a_wordlist.length;

		// find word and abbreviate it
		s_contract_suffix = abbreviate_word(a_wordlist[i_word]);
	}
	// wordlist not available; fallback to using random entropy
	else {
		s_contract_suffix = abbreviate_word(uuid_v4().replace(/[ae-]/g, ''));
	}

	// construct final output
	return [...a_host.slice(1, 3), s_contract_suffix].join('-');
}

/**
 * Pre-emptively renders and loads the page's pfp in case the user decides to interact with the page
 */
export async function load_app_pfp(b_reload=false): Promise<void> {
	// able to use cache
	if(!b_reload) {
		// check cache
		const g_cached = await SessionStorage.get(`profile:${location.origin}`);

		// already cached, do not reload
		if(g_cached) return;
	}

	// grab site pfp
	const sq_icons = ['icon', 'apple-touch-icon'].map(s => `link[rel="${s}"]`).join(',');
	const a_icons = [...document.head.querySelectorAll(sq_icons)] as HTMLLinkElement[];

	// prep icon data
	let p_data = '';

	// some found
	if(a_icons.length) {
		// 
		let dm_selected: HTMLLinkElement | null = null;
		let x_max = 0;

		// each icon
		for(const dm_icon of a_icons) {
			// icon has sizes attribute set
			const sx_sizes = dm_icon.getAttribute('sizes');
			if(sx_sizes) {
				// each size listed
				for(const sx_size of sx_sizes.split(/\s+/)) {
					// parse dimensions
					const m_dims = /^(\d+)x(\d+)$/.exec(sx_size);

					// failed to parse or not square; skip
					if(!m_dims || m_dims[1] !== m_dims[2]) continue;

					// parse integer
					const x_dim = +m_dims[1];

					// larger than largest but still within range; select icon
					if(x_dim > x_max && x_dim <= 2 * N_PX_DIM_ICON) {
						x_max = x_dim;
						dm_selected = dm_icon;
					}
				}
			}
			// nothing else is selected yet
			else if(!dm_selected) {
				dm_selected = dm_icon;
			}
			// this variant is a (typically) higher resolution apple-touch-icon
			else if('apple-touch-icon' === dm_icon.getAttribute('rel')) {
				if(dm_selected.getAttribute('type')?.startsWith('image/png')) {
					dm_selected = dm_icon;
				}
			}
			// svg can be scaled; prefer it
			else if(dm_icon.getAttribute('type')?.startsWith('image/svg')) {
				dm_selected = dm_icon;
			}
		}

		// an icon was selected
		if(dm_selected) {
			// load its image data into a data URL
			p_data = await load_icon_data(dm_selected.href, N_PX_DIM_ICON) || '';
		}
	}
	else {
		const p_og_image = document.head.querySelector('meta[property="og:image"]')?.getAttribute('content');

		if(p_og_image) {
			// load its image data into a data URL
			p_data = await load_icon_data(p_og_image, N_PX_DIM_ICON) || '';
		}
	}

	// okay to use
	if(p_data) {
		// save pfp data URL to session storage
		const p_pfp = `pfp:${location.origin}` as const;

		// set pfp
		await SessionStorage.set({
			[p_pfp]: p_data,
		});
	}

	// set basic profile
	await SessionStorage.set({
		[`profile:${location.origin}`]: {
			...await SessionStorage.get(`profile:${location.origin}`),
			name: document.head?.querySelector('meta[name="application-name"]')?.getAttribute('content'),
		},
	});
}


export async function create_app_profile(): Promise<AppProfile> {
	// load all links, capturing entity icons
	const [, a_res_entries] = await Promise.all([
		load_app_pfp(),
		Promise.all([
			// each caip-2 link
			...[...destructure_links('caip-2')].map(async({href:p_href, value:si_caip2}) => {
				// invalid CAIP-2
				if(!R_CAIP_2.test(si_caip2)) return;

				// load its image data into a data URL
				const sx_data = await load_icon_data(p_href);

				// not okay to use
				if(!sx_data) return;

				// save pfp data URL to session storage
				const p_pfp = `pfp:${location.origin}/${si_caip2}` as const;

				// save to session
				await SessionStorage.set({
					[p_pfp]: sx_data,
				});

				// return [key, value] entry for later conversion to dict
				return [si_caip2, p_pfp];
			}),

			// each caip-10 link
			...[...destructure_links('caip-10')].map(async({href:p_href, value:si_caip10}) => {
				// invalid CAIP-10
				if(!R_CAIP_10.test(si_caip10)) return;

				// load its image data into a data URL
				const sx_data = await load_icon_data(p_href);

				// not okay to use
				if(!sx_data) return;

				// save pfp data URL to session storage
				const p_pfp = `pfp:${location.origin}/${si_caip10}` as const;

				// save to session
				await SessionStorage.set({
					[p_pfp]: sx_data,
				});

				// return [key, value] entry for later conversion to dict
				return [si_caip10, p_pfp];
			}),

			// each caip-19 link
			...[...destructure_links('caip-19')].map(async({href:p_href, value:si_caip19}) => {
				// invalid CAIP-19
				if(!R_CAIP_19.test(si_caip19)) {
					// faulty syntax; fix
					let m_faulty = R_FAULTY_CAIP_19.exec(si_caip19);
					if(m_faulty) {
						const si_corrected = `${m_faulty[1]}:${m_faulty[2]}/${m_faulty[3]}:${m_faulty[4]}`;

						// issue deprecation warning
						warn(`DEPRECATION NOTICE:  <link data-caip-19="${si_caip19}" ...>  uses an invalid CAIP-19 identifier and its value should be updated to "${si_corrected}"`);

						si_caip19 = si_corrected;
					}
					// invalid
					else {
						return;
					}
				}

				// load its image data into a data URL
				const sx_data = await load_icon_data(p_href);

				// not okay to use
				if(!sx_data) return;

				// save pfp data URL to session storage
				const p_pfp = `pfp:${location.origin}/${si_caip19}` as const;

				// save to session
				await SessionStorage.set({
					[p_pfp]: sx_data,
				});

				// return [key, value] entry for later conversion to dict
				return [si_caip19, p_pfp];
			}),
		]),
	]);

	debug(`App profiler finished scanning links in head`);

	// prep sanitized contract and account def dicts
	const h_contract_defs: Dict<ContractStruct> = {};
	const h_account_defs: Dict<AgentStruct> = {};

	// each valid whip-003 script
	for(const dm_script of qsa(document.head, ['toml', 'json'].map(s => `script[type^="application/${s}"][data-whip-003]`).join(',')) as HTMLScriptElement[]) {
		// parsed content
		let g_parsed: JsonValue = null;

		// toml script
		if(/^application\/toml\b/.test(dm_script.type.toLowerCase())) {
			// attempt to parse the script
			try {
				g_parsed = toml.parse(dm_script.textContent || '') as JsonObject;
			}
			// parsing error; log error and skip
			catch(e_parse) {
				error(`TOML parsing error on WHIP-003 script: ${e_parse.stack}`);
				continue;
			}
		}
		// json script
		else if(/^application\/json\b/.test(dm_script.type.toLowerCase())) {
			// attempt to parse the script
			try {
				g_parsed = JSON.parse(dm_script.textContent || '') as JsonObject;
			}
			// parsing error; log error and skip
			catch(e_parse) {
				error(`JSON parsing error on WHIP-003 script: ${e_parse.stack}`);
				continue;
			}
		}
		// unsupported media type; skip
		else {
			continue;
		}

		// top-level item should be a dict
		if(!is_dict(g_parsed)) {
			error(`Expected top-level WHIP-003 export to be a table`);
			continue;
		}

		// .chains given
		const h_chains = g_parsed.chains as JsonObject;
		ALL_CHAINS:
		if(h_chains) {
			// invalid shape; error and continue
			if(!is_dict(h_chains)) {
				error(`Expected .contracts property on WHIP-003 export to be a table`);
				break ALL_CHAINS;
			}

			// each chain def
			for(const [si_chain, g_chain] of ode(h_chains)) {
				// invalid shape
				if(!is_dict(g_chain)) {
					error(`Expected .chains["${si_chain}"] property on WHIP-003 export to be a table`);
					continue;
				}

				// prep sanitized form
				const g_sanitized = {
					pfp: `pfp:${location.origin}/${si_chain}`,
				} as ChainStruct;

				// .namespace property
				{
					// missing
					if(!('namespace' in g_chain)) {
						error(`Missing required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// invalid
					if('string' !== typeof g_chain.namespace) {
						error(`Invalid type for required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// syntax violation
					if(!RT_CAIP_2_NAMESPACE.test(g_chain.namespace)) {
						error(`Invalid CAIP-2 namespace syntax for required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// set property
					g_sanitized.namespace = g_chain.namespace as ChainNamespaceKey;
				}

				// .reference property
				{
					// missing
					if(!('namespace' in g_chain)) {
						error(`Missing required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// invalid
					if('string' !== typeof g_chain.reference) {
						error(`Invalid type for required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// syntax violation
					if(!RT_CAIP_2_REFERENCE.test(g_chain.reference)) {
						error(`Invalid CAIP-2 reference syntax for required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// set property
					g_sanitized.reference = g_chain.reference;
				}
			}
		}

		// .accounts given
		const h_accounts = g_parsed.accounts as JsonObject;
		if(h_accounts) {
			// valid shape
			if(is_dict(h_accounts)) {
				// each account def
				for(const [si_account, g_account] of ode(h_accounts)) {
					// valid shape
					if(is_dict(g_account)) {
						// prep sanitized form
						const g_sanitized = {
							agentType: ContactAgentType.PERSON,
							origin: `app:${location.origin}`,
							notes: '',
						} as ContactStruct;

						// missing .chain property
						if(!('chain' in g_account)) {
							error(`Missing required .accounts["${si_account}"].chain property on WHIP-003 export`);
							continue;
						}

						// invalid required .chain property type; skip def
						if('string' !== typeof g_account.chain) {
							error(`Invalid type for required .accounts["${si_account}"].chain property on WHIP-003 export`);
							continue;
						}

						// parse .chain property
						const m_caip2 = R_CAIP_2.exec(g_account.chain);

						// invalid syntax for required .chain property; skip def
						if(!m_caip2) {
							error(`Invalid CAIP-2 syntax for required .accounts["${si_account}"].chain property on WHIP-003 export`);
							continue;
						}

						// set chain property
						const p_chain: ChainPath = `/family.${m_caip2[1] as ChainNamespaceKey}/chain.${m_caip2[2]}`;
						g_sanitized.chains = [p_chain];

						// load chain definition
						const g_chain = (await Chains.at(p_chain) || h_chains[p_chain]) as ChainStruct;

						// chain not found
						if(!g_chain) {
							error(`.accounts["${si_account}"].chain references chain that was not defined/declared: "${g_account.chain}"`);
							continue;
						}

						// validate own namespace
						if('string' !== typeof g_chain.namespace) {
							error(`Invliad referenced chain namespace type: ${typeof g_chain.namespace}`);
							continue;
						}

						// copy namespace
						g_sanitized.namespace = g_chain.namespace;

						// missing .address property
						if(!('address' in g_account)) {
							error(`Missing required .accounts["${si_account}"].address property on WHIP-003 export`);
							continue;
						}

						// invalid required .address property type; skip def
						if('string' !== typeof g_account.address) {
							error(`Invalid type for required .accounts["${si_account}"].address property on WHIP-003 export`);
							continue;
						}

						// verify checksum
						if(!Chains.isValidAddressFor(g_chain, g_account.address)) {
							error(`Address checksum failure for .accounts["${si_account}"].address property on WHIP-003 export`);
							continue;
						}

						// set pfp
						g_sanitized.pfp = `pfp:${location.origin}/${g_account.chain}:${g_account.address}`;

						// parse .address property
						const m_bech32 = R_BECH32.exec(g_account.address)!;

						// deduce address space
						{
							const si_hrp = m_bech32[1];

							FIND_ADDRESS_SPACE: {
								for(const [si_space, si_hrp_each] of ode(g_chain.bech32s)) {
									// found matching address space
									if(si_hrp_each === si_hrp) {
										g_sanitized.addressSpace = si_space as ContactSpace;
										break FIND_ADDRESS_SPACE;
									}
								}

								// did not find matching address space
								error(`No address space on ${g_account.chain} chain contains the Bech32 HRP "${si_hrp}"`);
								continue;
							}
						}

						// set address property
						g_sanitized.addressData = m_bech32[3];

						// parse optional .label property
						if('label' in g_account) {
							if('string' === typeof g_account.label) {
								if(R_CONTRACT_NAME.test(g_account.label)) {
									g_sanitized.name = g_account.label;
								}
								else {
									error(`Contract label "${g_account.label}" violates the regular expression /${R_CONTRACT_NAME.source}/u`);
								}
							}
							else {
								error(`Invalid type for optional .accounts["${si_account}"].label property on WHIP-003 export`);
							}
						}

						// populate account def
						h_account_defs[si_account] = g_sanitized;
					}
					// invalid, but continue scanning other account defs
					else {
						error(`Expected .accounts["${si_account}"] property on WHIP-003 export to be a TOML Table`);
					}
				}
			}
			// invalid, but continue scanning other properties
			else {
				error(`Expected .accounts property on WHIP-003 export to be a TOML Table`);
			}
		}

		// .contracts given
		const h_contracts = g_parsed.contracts as JsonObject;
		if(h_contracts) {
			// valid shape
			if(is_dict(h_contracts)) {
				// each contract def
				for(const [si_contract, g_contract] of ode(h_contracts)) {
					// valid shape
					if(is_dict(g_contract)) {
						// prep sanitized form
						const g_sanitized = {
							on: 1,
							name: 'Unknown Contract',
							origin: `app:${Apps.pathFor(location.host, location.protocol as 'https')}`,
							pfp: '',
							interfaces: {
								excluded: [],
							},
						} as unknown as ContractStruct;

						// missing .chain property
						if(!('chain' in g_contract)) {
							error(`Missing required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// invalid required .chain property type; skip def
						if('string' !== typeof g_contract.chain) {
							error(`Invalid type for required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// parse .chain property
						const m_caip2 = R_CAIP_2.exec(g_contract.chain);

						// invalid syntax for required .chain property; skip def
						if(!m_caip2) {
							error(`Invalid CAIP-2 syntax for required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// set chain property
						const p_chain = g_sanitized.chain = `/family.${m_caip2[1] as ChainNamespaceKey}/chain.${m_caip2[2]}`;

						// load chain definition
						const g_chain = (await Chains.at(p_chain) || h_chains[p_chain]) as ChainStruct;

						// chain not found
						if(!g_chain) {
							error(`.contracts["${si_contract}"].chain references chain that was not defined/declared: "${g_contract.chain}"`);
							continue;
						}

						// ref interfaces schema
						const h_features = g_chain?.features;
						const h_interface_schemas: Dict<Dict<TokenInterfaceRuntimeSchema>> = (h_features?.secretwasm || h_features?.['wasm'])?.interfaceSchemas || {};

						// missing .address property
						if(!('address' in g_contract)) {
							error(`Missing required .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// invalid required .address property type; skip def
						if('string' !== typeof g_contract.address) {
							error(`Invalid type for required .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// verify checksum
						if(!Chains.isValidAddressFor(g_chain, g_contract.address)) {
							error(`Address checksum failure for .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// set address property
						g_sanitized.bech32 = g_contract.address as Bech32;

						// backwards-compatible snip20 interface
						if('snip20' in g_contract) {
							// issue deprecation warning
							warn(`DEPRECATION NOTICE:  .contracts["${si_contract}"].snip20  should be rewritten as  .contracts["${si_contract}"].interfaces.snip20`);

							// migrate to interfaces struct
							(g_contract.interfaces = g_contract.interfaces || {
								excluded: [],
							})['snip20'] = g_contract.snip20;
						}

						// copy interfaces
						if('interfaces' in g_contract) {
							const h_interfaces = g_contract.interfaces as Dict<Dict>;
							if(is_dict(h_interfaces)) {
								// prep output
								const h_specs: ContractStruct['interfaces'] = g_sanitized.interfaces;

								// each declared interface
								for(const [si_interface, h_interface] of ode(h_interfaces)) {
									// invalid type
									if(!is_dict(h_interface)) {
										error(`Invalid type for optional .contracts["${si_contract}"].interfaces["${si_interface}"] property on WHIP-003 export`);
										continue;
									}

									// ref runtime schema
									const h_schema = h_interface_schemas[si_interface];

									// interface not recognized for chain
									if(!h_schema) {
										warn(`Skipping .contracts["${si_contract}"].interfaces["${si_interface}"] interface definition since it is not a recognized interface id on ${g_contract.chain}`);
										continue;
									}

									// accepted; prep output interface
									const g_interface_sanitized = h_specs[si_interface] = {};

									// check each property value
									for(const [si_property, z_value] of ode(h_interface)) {
										// ref expected value type
										const si_property_type = h_schema[si_property];

										// prep property path
										const s_property_path = `.contracts["${si_contract}"].interfaces["${si_interface}"]["${si_property}"]`;

										// unexpected property value
										if(!si_property_type) {
											warn(`Skipping ${s_property_path} property since it is not a recognized property id for the ${si_interface} interface on ${g_contract.chain}`);
											continue;
										}

										// not a primitive value, ignore
										if(!['boolean', 'number', 'string'].includes(typeof z_value)) {
											error(`Invalid non-primitive value for interface property at ${s_property_path}`);
											continue;
										}

										// prep sanitized value
										let w_sanitized: boolean | number | string;

										const s_validation_error = `Property value at ${s_property_path} does not meet the expected type criteria according to schema; `;

										switch(si_property_type) {
											// expecting string
											case TokenInterfaceRuntimeSchema.String: {
												w_sanitized = z_value+'';
												break;
											}

											// expecting uint128
											case TokenInterfaceRuntimeSchema.Uint128: {
												if(!RT_UINT.test(z_value+'')) {
													error(s_validation_error+`"${z_value}" should be a Uint128 string`);
													continue;
												}

												w_sanitized = z_value+'';
												break;
											}

											// expecting natural number
											case TokenInterfaceRuntimeSchema.NaturalNumber: {
												const n_parsed = 'number' === typeof z_value? z_value: 'string' === typeof z_value? parseFloat(z_value): NaN;
												if(!Number.isInteger(n_parsed)) {
													error(s_validation_error+`"${z_value}" should be a natural number (integer)`);
													continue;
												}

												w_sanitized = n_parsed;
												break;
											}

											// expecting natural number
											case TokenInterfaceRuntimeSchema.Boolean: {
												// string given
												if('string' === z_value) {
													if(/^[t1y]|true|yes$/i.test(z_value)) {
														w_sanitized = true;
													}
													else if(/^[f0n]|false|no$/i.test(z_value)) {
														w_sanitized = false;
													}
													else {
														error(s_validation_error+`"${z_value}" should be true or false`);
														continue;
													}
												}
												// number or boolean given
												else {
													w_sanitized = !!z_value;
												}

												if(![true, false].includes(w_sanitized)) {
													error(s_validation_error+`"${z_value}" should be a boolean`);
													continue;
												}

												break;
											}

											// expecting token symbol
											case TokenInterfaceRuntimeSchema.TokenSymbol: {
												// ref symbol
												let si_symbol = ''+z_value;

												// symbol doesn't pass regex
												if(!R_TOKEN_SYMBOL.test(si_symbol)) {
													// upper-case version does
													si_symbol = si_symbol.toUpperCase();
													if(R_TOKEN_SYMBOL.test(si_symbol)) {
														debug(`Converted provided "${si_contract}" symbol to "${si_symbol}"`);
													}
													// need to generate one instead
													else {
														error(`Contract symbol "${si_contract}" does not match the acceptable pattern /${R_TOKEN_SYMBOL.source}/u\nA generated symbol will be used instead`);
														si_symbol = await generate_token_symbol(g_sanitized.bech32);
														debug(`Using generated "${si_symbol}" symbol instead of provided "${si_contract}"`);
													}
												}

												w_sanitized = si_symbol;

												break;
											}

											// error in interface schema
											default: {
												error(`Unrecognized runtime schema datatype '${si_property_type}' for property value`);
												continue;
											}
										}

										// valid, add to interface struct
										g_interface_sanitized[si_property] = w_sanitized;
									}
								}
							}
							else {
								error(`Invalid type for optional .contracts["${si_contract}"].interfaces property on WHIP-003 export`);
							}
						}

						// parse optional .label property
						if('label' in g_contract) {
							if('string' === typeof g_contract.label) {
								if(R_CONTRACT_NAME.test(g_contract.label)) {
									g_sanitized.name = g_contract.label;
								}
								else {
									error(`Contract label "${g_contract.label}" violates the regular expression /${R_CONTRACT_NAME.source}/u`);
								}
							}
							else {
								error(`Invalid type for optional .contracts["${si_contract}"].label property on WHIP-003 export`);
							}
						}

						// populate contract def
						h_contract_defs[si_contract] = g_sanitized;
					}
					// invalid, but continue scanning other contract defs
					else {
						error(`Expected .contracts["${si_contract}"] property on WHIP-003 export to be a TOML Table`);
					}
				}
			}
			// invalid, but continue scanning other properties
			else {
				error(`Expected .contracts property on WHIP-003 export to be a TOML Table`);
			}
		}
	}

	// create profile
	const g_profile = {
		name: document.head?.querySelector('meta[name="application-name"]')?.getAttribute('content'),
		pfps: Object.fromEntries(a_res_entries.filter(w => w) as [string, string][]),
		contracts: h_contract_defs,
		accounts: h_account_defs,
	};

	// save to session
	await SessionStorage.set({
		[`profile:${location.origin}` as const]: g_profile,
	});

	// return created profile
	return g_profile;
}

// // declare channel message handlers
// export const h_handlers_authed: Vocab.Handlers<RelayToHost.AuthedVocab> = {
// 	// handle connection requests
// 	async requestConnect(g_request) {
// 		void f_runtime().sendMessage({
// 			type: 'requestConnection',
// 			value: {
// 				chains: a_chain_requests,
// 			},
// 		});

// 		// // prep flow result
// 		// let g_result;
// 		// try {
// 		// 	// await flow
// 		// 	g_result = await flow_send({
// 		// 		flow: {
// 		// 			type: 'requestConnection',
// 		// 			value: {
// 		// 				chains: a_requests,
// 		// 			},
// 		// 			page: {
// 		// 				href: location.href,
// 		// 				tabId: -1,
// 		// 			},
// 		// 		},
// 		// 	});
// 		// }
// 		// catch(e_popup) {
// 		// 	// TODO: handle chrome error
// 		// 	// TODO: handle flow error
// 		// 	throw e_popup;
// 		// }

// 		// fetch from store


// 		// // ports
// 		// const a_ports: Array<MessagePort | null> = [];

// 		// // no port
// 		// a_ports.push(null);


// 		// for(const g_chain of a_chains) {
// 		// 	// create channel
// 		// 	const d_channel = new MessageChannel();

// 		// 	// assign port 1
// 		// 	const kc_chain = await HostConnection.create(g_chain, d_channel.port1);

// 		// 	// resoond with port 2
// 		// 	a_ports.push(d_channel.port2);
// 		// }


// 		// d_port.postMessage({
// 		// 	type: 'respondConnect',
// 		// 	value: {
// 		// 		index: i_request,
// 		// 		answer: {
// 		// 			config: {
// 		// 				features: a_features,
// 		// 			},
// 		// 		},
// 		// 	},
// 		// }, a_ports);
// 	},

// 	// handle website error reporting
// 	reportWebsiteError(s_reson: string) {
// 		// TODO: handle
// 	},
// };
