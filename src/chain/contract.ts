
import type {AppStruct} from '#/meta/app';
import type {Nilable} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

import type {TokenStructDescriptor} from '#/meta/token';

import {Snip2xQueryRes, Snip2xToken} from '#/schema/snip-2x-const';

import {load_app_profile} from './app';

import {SessionStorage} from '#/extension/session-storage';
import {H_STORE_INIT_CONTRACTS} from '#/store/_init';
import type {AppProfile} from '#/store/apps';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Providers} from '#/store/providers';
import {is_dict_es, ode, oderom} from '#/util/belt';
import {uuid_v4} from '#/util/data';
import type { SecretNetwork } from './secret-network';
import type { L, N } from 'ts-toolbelt';
import type { AccountStruct } from '#/meta/account';
import { syserr } from '#/app/common';



/**
 * Produces a of contract struct from the given address, either loading it from storage or creating it from session profile
 */
export async function produce_contract(
	sa_contract: Bech32,
	g_chain: ChainStruct,
	g_app?: Nilable<AppStruct>,
	g_account?: Nilable<AccountStruct>,
	b_void_unknowns=false
): Promise<ContractStruct> {
	return (await produce_contracts([sa_contract], g_chain, g_app, g_account, b_void_unknowns))[0];
}

/**
 * Produces a list of contract structs from the given addresses, either loading them from storage or creating them from session profile
 */
export async function produce_contracts(
	a_bech32s: Bech32[],
	g_chain: ChainStruct,
	g_app?: Nilable<AppStruct>,
	g_account?: Nilable<AccountStruct>,
	b_void_unknowns=false
): Promise<ContractStruct[]> {
	// prep list of loaded contracts
	const a_loaded: ContractStruct[] = [];

	// prep app profile
	let g_profile: AppProfile | undefined;

	const ks_contracts = await Contracts.read();

	// each bech32
	for(const sa_contract of a_bech32s) {
		// create contract path
		const p_contract = Contracts.pathFor(Chains.pathFrom(g_chain), sa_contract);

		// prep contract struct
		let g_contract!: ContractStruct|null;

		// definition already exists in store; add to list and move on
		g_contract = ks_contracts.at(p_contract);
		if(g_contract) {
			a_loaded.push(g_contract);
			continue;
		}

		// contract is built-in; add to list and move on
		g_contract = H_STORE_INIT_CONTRACTS[p_contract];
		if(g_contract) {
			a_loaded.push(g_contract);
			continue;
		}

		// no app profile loaded
		if(g_app && !g_profile && 'wallet' !== g_app.scheme) {
			// acquire lock on profile
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			await navigator.locks.request('ui:fields:profile', async() => {
				// save profile
				const g_profile_loaded = await load_app_profile(g_app);

				if(!g_profile_loaded) {
					throw new Error(`Missing referenced app profile: ${JSON.stringify(g_app)}`);
				}

				g_profile = g_profile_loaded;
			});
		}

		// find contract def in app profile
		const h_contracts = g_profile?.contracts;
		if(h_contracts) {
			for(const [, g_def] of ode(h_contracts)) {
				if(sa_contract === g_def.bech32) {
					// copy contract def from profile
					g_contract = g_def;

					// find its pfp
					FIND_PFP:
					if(g_app) {
						const sx_pfp_ctx = `${g_app.scheme}://${g_app.host}/${g_chain.namespace}:${g_chain.reference}`;

						// search interfaces (caip-19)
						for(const si_interface in g_contract.interfaces) {
							// build full pfp target
							const p_test = `pfp:${sx_pfp_ctx}/${si_interface}:${g_contract.bech32}` as const;

							// test if app defined icon for contract as caip-19
							const sx_found = await SessionStorage.get(p_test);

							if(sx_found) {
								g_contract.pfp = p_test;
								break FIND_PFP;
							}
						}

						// then accounts (caip-10)
						{
							// build full pfp target
							const p_test = `pfp:${sx_pfp_ctx}:${g_contract.bech32}` as const;

							// test if app defined icon for contract as caip-10
							const sx_found = await SessionStorage.get(p_test);

							if(sx_found) {
								g_contract.pfp = p_test;
								break FIND_PFP;
							}
						}
					}
				}
			}
		}

		// do not add unknowns
		if(!g_contract && b_void_unknowns) continue;

		// sanitize
		for(const [si_inteface, w_interface] of ode(g_contract?.interfaces || {})) {
			if('snip20' === si_inteface && g_chain.features.secretwasm) {
				const g_input = is_dict_es(w_interface)? w_interface: {};

				let s_symbol = g_input?.symbol as string;

				let g_info: Awaited<Promise<Awaited<Snip2xQueryRes<'token_info'>>['token_info']>>;
				async function token_info(): Promise<typeof g_info> {
					if(g_info) return g_info;

					const k_network = await Providers.activateStableDefaultFor(g_chain);

					const k_token = new Snip2xToken(g_contract!, k_network as SecretNetwork, g_account!);

					return g_info = (await k_token.tokenInfo()).token_info;
				}

				if(!s_symbol && g_account) {
					await token_info();

					s_symbol = g_info!.symbol;
				}

				let n_decimals = g_input.decimals as L.UnionOf<N.Range<0, 18>>;
				if(!(Number.isInteger(g_input.decimals) && n_decimals >= 0 && n_decimals <= 18)) {
					if(!g_account) {
						throw syserr({
							title: 'Missing token information',
							text: `Unable to deduce critical token info for requested contract`,
						});
					}

					await token_info();

					n_decimals = g_info!.decimals as typeof n_decimals;
				}

				type Snip20Struct = TokenStructDescriptor<'snip20'>['snip20'];
				g_contract.interfaces[si_inteface] = {
					symbol: s_symbol || (uuid_v4()+uuid_v4())
						.replace(/^[^a-z]+/, '').replace(/[^a-z0-9]+/g, '').slice(0, 6).toUpperCase(),
					decimals: n_decimals,
					extra: is_dict_es(g_input?.extra)? g_input.extra as NonNullable<Snip20Struct['extra']>: {},
				};
			}
		}

		// add to list
		a_loaded.push({
			on: 1,
			chain: Chains.pathFrom(g_chain),
			hash: g_contract?.hash || '',
			bech32: sa_contract,
			interfaces: g_contract?.interfaces || {},
			name: g_contract?.name || `Unknown Contract${g_app? ` from ${g_app.host}`: ''}`,
			origin: `app:${Apps.pathFrom(g_app || G_APP_EXTERNAL)}`,
			pfp: g_contract?.pfp || '' as PfpTarget,
		});
	}

	return a_loaded;
}

/**
 * Installs contracts by saving their defs to storage (optional app for context)
 * @param a_bech32s 
 * @param g_chain 
 * @param g_app 
 */
export async function install_contracts(a_bech32s: Bech32[], g_chain: ChainStruct, g_app: undefined|AppStruct, g_account?: Nilable<AccountStruct>): Promise<void> {
	// install contracts
	for(const g_contract of await produce_contracts(a_bech32s, g_chain, g_app, g_account)) {
		// resolve expected contract path
		const p_contract = Contracts.pathFrom(g_contract);

		// attempt to load existing contract
		let g_contract_existing!: null|ContractStruct;
		try {
			g_contract_existing = await Contracts.at(p_contract);
		}
		catch(e_load) {}

		// contract does not exist in store; insert it as new entry
		if(!g_contract_existing) {
			await Contracts.merge(g_contract);
		}
		// contract already exists
		else {
			const h_interfaces_existing = g_contract_existing.interfaces;

			// TODO: allow for update mechanism

			// only fill certain metadata if it is not yet populated
			await Contracts.merge({
				...g_contract,
				pfp: g_contract_existing.pfp || g_contract.pfp,
				hash: g_contract_existing.hash || g_contract.hash,
				on: g_contract_existing.on || 1,
				origin: g_contract_existing.origin || g_contract.origin,
				interfaces: {
					...h_interfaces_existing,
					...oderom(g_contract.interfaces, (si_interface, g_interface) => ({
						[si_interface]: h_interfaces_existing[si_interface] || g_interface,
					})),
				},
			});
		}
	}
}
