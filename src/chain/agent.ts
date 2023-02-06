import type {AppStruct} from '#/meta/app';
import type {Nilable} from '#/meta/belt';
import type {Bech32, ChainStruct} from '#/meta/chain';
import type {ContactStruct} from '#/meta/contact';
import {ContactAgentType} from '#/meta/contact';

import type {PfpTarget} from '#/meta/pfp';

import {load_app_profile} from './app';

import {SessionStorage} from '#/extension/session-storage';
import {R_BECH32} from '#/share/constants';
import {H_STORE_INIT_AGENTS} from '#/store/_init';
import {Agents} from '#/store/agents';

import type {AppProfile} from '#/store/apps';
import {Apps, G_APP_EXTERNAL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {ode} from '#/util/belt';


/**
 * Produces a of contract struct from the given address, either loading it from storage or creating it from session profile
 */
export async function produce_agent(
	sa_agent: Bech32,
	g_chain: ChainStruct,
	g_app?: Nilable<AppStruct>,
	b_void_unknowns=false
): Promise<ContactStruct> {
	return (await produce_agents([sa_agent], g_chain, g_app, b_void_unknowns))[0];
}

/**
 * Produces a list of contact structs from the given addresses, either loading them from storage or creating them from session profile
 */
export async function produce_agents(
	a_bech32s: Bech32[],
	g_chain: ChainStruct,
	g_app?: Nilable<AppStruct>,
	b_void_unknowns=false
): Promise<ContactStruct[]> {
	// prep list of loaded contracts
	const a_loaded: ContactStruct[] = [];

	// prep app profile
	let g_profile: AppProfile | undefined;

	const ks_agents = await Agents.read();

	// each bech32
	for(const sa_agent of a_bech32s) {
		// create agent path
		const p_agent = Agents.pathForContactFromAddress(sa_agent);

		// prep agent struct
		let g_agent!: ContactStruct|null;

		// definition already exists in store; add to list and move on
		g_agent = ks_agents.at(p_agent) as ContactStruct;
		if(g_agent) {
			a_loaded.push(g_agent);
			continue;
		}

		// agent is built-in; add to list and move on
		g_agent = H_STORE_INIT_AGENTS[p_agent] as ContactStruct;
		if(g_agent) {
			a_loaded.push(g_agent);
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

		// find agent def in app profile
		const h_agents = g_profile?.accounts;
		if(h_agents) {
			for(const [, g_def] of ode(h_agents)) {
				if(sa_agent === Agents.addressFor(g_def, g_chain)) {
					// copy agent def from profile
					g_agent = g_def;

					// find its pfp
					FIND_PFP:
					if(g_app) {
						const sx_pfp_ctx = `${g_app.scheme}://${g_app.host}/${g_chain.namespace}:${g_chain.reference}`;

						// build full pfp target
						const p_test = `pfp:${sx_pfp_ctx}:${sa_agent}` as const;

						// test if app defined icon for agent as caip-10
						const sx_found = await SessionStorage.get(p_test);

						if(sx_found) {
							g_agent.pfp = p_test;
							break FIND_PFP;
						}
					}
				}
			}
		}

		// do not add unknowns
		if(!g_agent && b_void_unknowns) continue;

		// parse address
		const m_bech32 = R_BECH32.exec(sa_agent);

		// invalid bech32
		if(!m_bech32) continue;

		// deduce address space
		let si_space: ContactStruct['addressSpace'];
		{
			const si_hrp = m_bech32[1];

			FIND_ADDRESS_SPACE: {
				for(const [_si_space, si_hrp_each] of ode(g_chain.bech32s)) {
					// found matching address space
					if(si_hrp_each === si_hrp) {
						si_space = _si_space as typeof si_space;
						break FIND_ADDRESS_SPACE;
					}
				}

				// did not find matching address space
				continue;
			}
		}

		// add to list
		a_loaded.push({
			agentType: ContactAgentType.UNKNOWN,
			namespace: g_chain.namespace,
			addressSpace: 'acc',
			addressData: m_bech32?.[3] || '',
			chains: [Chains.pathFrom(g_chain)],
			name: g_agent?.name || `Unknown Contact${g_app? ` from ${g_app.host}`: ''}`,
			origin: `app:${Apps.pathFrom(g_app || G_APP_EXTERNAL)}`,
			pfp: g_agent?.pfp || '' as PfpTarget,
			notes: '',
		});
	}

	return a_loaded;
}
