import type {AgentStruct, AgentPath, Bech32, ChainStruct, ChainNamespaceKey} from '#/meta/chain';
import type {ContactStruct, ContactPath} from '#/meta/contact';

import {decodeBech32} from '@solar-republic/wasm-secp256k1';
import {bech32} from 'bech32';

import {create_store_class, WritableStoreMap} from './_base';
import {Chains} from './chains';

import {R_BECH32, SI_STORE_AGENTS} from '#/share/constants';


export const Agents = create_store_class({
	store: SI_STORE_AGENTS,
	extension: 'map',
	class: class AgentsI extends WritableStoreMap<typeof SI_STORE_AGENTS> {
		static pathForAgentFromData(s_data: string, si_family: ChainNamespaceKey='cosmos'): AgentPath {
			return `/family.${si_family}/agent.${s_data}`;
		}

		static pathForAgentFromAddress(sa_addr: Bech32, si_family: ChainNamespaceKey='cosmos'): AgentPath {
			return AgentsI.pathForAgentFromData(sa_addr.replace(R_BECH32, '$3'), si_family);
		}

		static pathForContactFromData(s_data: string, si_family: ChainNamespaceKey='cosmos'): ContactPath {
			return `${AgentsI.pathForAgentFromData(s_data, si_family)}/as.contact`;
		}

		/**
		 * Creates a ContactPath from a bech32 address and optional chain namespace
		 */
		static pathForContactFromAddress(sa_addr: Bech32, si_family: ChainNamespaceKey='cosmos'): ContactPath {
			return `${AgentsI.pathForAgentFromAddress(sa_addr, si_family)}/as.contact`;
		}

		static pathFromContact(g_contact: ContactStruct): ContactPath {
			return AgentsI.pathForContactFromData(g_contact.addressData, g_contact.namespace);
		}

		/**
		 * Loads agents store and finds the contact by its path
		 */
		static async getContact(p_contact: ContactPath): Promise<ContactStruct | null> {
			// read agents store
			const ks_agents = await Agents.read();

			// find contact
			return ks_agents.at(p_contact) as ContactStruct;
		}

		/**
		 * Produces the complete bech32 address for the given agent on the given chain (otherwise defaults to src address)
		 */
		static addressFor(g_agent: AgentStruct | ContactStruct, g_chain_dst: ChainStruct): Bech32 {
			// bech32 already defined
			if(g_agent['bech32']) {
				// wrong chain
				if(Chains.isValidAddressFor(g_chain_dst, g_agent['bech32'] as string)) {
					return g_agent['bech32'] as Bech32;
				}
			}

			// decode bech32 address data (without checksum) into words
			const a_words = decodeBech32(g_agent.addressData);

			// incompatible namespaces
			if(g_chain_dst.namespace !== g_agent.namespace) {
				throw new Error(`Refusing to convert address from "${g_agent.namespace}" namespace to incompatible "${g_chain_dst.namespace}" namespace`);
			}

			// acces the hrp for the given chain
			const si_hrp: string = g_chain_dst.bech32s[g_agent.addressSpace];

			// encode words into bech32 with hrp to create address
			const sa_contact = bech32.encode(si_hrp, a_words);

			// return complete bech32 address
			return sa_contact as Bech32;
		}

		* contacts(si_family: ChainNamespaceKey='cosmos'): IterableIterator<[ContactPath, ContactStruct]> {
			// ref cache
			const h_cache = this._w_cache;

			// filter by family prefix
			const s_agent_prefix: AgentPath = `/family.${si_family}/agent.`;

			// each agent in cache
			for(const p_agent in h_cache) {
				// agent in different family; skip
				if(!p_agent.startsWith(s_agent_prefix)) continue;

				// not a contact; skip
				if(!p_agent.endsWith('/as.contact')) continue;

				// agent is a contact
				yield [p_agent as ContactPath, h_cache[p_agent]];
			}
		}

		async putContact(g_res: ContactStruct): Promise<ContactPath> {
			// prepare contact path
			const p_res = AgentsI.pathFromContact(g_res);

			// update cache
			this._w_cache[p_res] = g_res;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}
	},
});
