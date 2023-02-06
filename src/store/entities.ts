import type {Union} from 'ts-toolbelt';

import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {Values} from '#/meta/belt';
import type {Bech32, ChainStruct, ChainNamespaceKey, ChainPath, Entity, EntityPath, HoldingPath} from '#/meta/chain';
import type {Resource} from '#/meta/resource';
import type {Store} from '#/meta/store';
import type {TokenSpecKey} from '#/meta/token';
import {TokenRegistry} from '#/schema/token-registry';

import {create_store_class, WritableStoreDict} from './_base';
import {Chains} from './chains';

import {yw_chain, yw_chain_ref} from '#/app/mem';
import {SI_STORE_ENTITIES} from '#/share/constants';
import {fold} from '#/util/belt';


type EntityTree = NonNullable<Values<Store['entities']>>;

type ContractSubtree = NonNullable<Union.Merge<NonNullable<EntityTree>>['as.contract']>;

type TokenStructMap = Record<TokenSpecKey, {}>;

export type TokenDict = Record<TokenPath, Token['struct']>;

type EntityType = 'contract' | 'token' | 'holding';

export type EntityInfo = Merge<{
	chainRef: ChainPath;
	entityPath: EntityPath;
	bech32: Bech32;
}, {
	type: Extract<EntityType, 'contract' | 'token'>;
} | {
	type: Extract<EntityType, 'holding'>;
	coin: string;
}>;

export const Entities = create_store_class({
	store: SI_STORE_ENTITIES,
	extension: 'dict',
	class: class EntitiesI extends WritableStoreDict<typeof SI_STORE_ENTITIES> {
		static pathFrom(g_entity: Entity['struct'], g_chain=yw_chain.get()) {
			return `${Chains.pathFrom(g_chain)}/bech32.${g_entity.bech32}`;
		}

		static pathFor(
			si_family: ChainNamespaceKey,
			si_chain: string,
			sa_entity: Bech32,
			si_type: '' | EntityType
		): EntityPath {
			return `${Chains.pathFor(si_family, si_chain)}/bech32.${sa_entity}${si_type? `/as.${si_type}`: ''}`;
		}

		static parseEntityPath(p_entity: EntityPath): EntityInfo | null {
			const a_paths = p_entity.slice(1).split('/');

			// insufficient path
			if(a_paths.length < 3) return null;

			// not an entity path
			if(!a_paths[0].startsWith('family.') || !a_paths[1].startsWith('chain.') || !a_paths[2].startsWith('bech32.')) {
				return null;
			}

			let si_type: EntityInfo['type'];
			let si_coin = '';

			if('as.contract' === a_paths[3]) {
				si_type = 'contract';
			}
			else if('as.token' === a_paths[3]) {
				si_type = 'token';
			}
			else if(a_paths[3].startsWith('holding.')) {
				si_type = 'holding';
				si_coin = a_paths[3].slice(a_paths[3].indexOf('.')+1);
			}
			else {
				return null;
			}

			// parse chain segments
			const p_chain = '/'+a_paths.slice(0, 2).join('/') as ChainPath;

			return {
				chainRef: p_chain,

				entityPath: `${p_chain}/${a_paths[3]}`,

				// parse address
				bech32: a_paths[2].slice(a_paths[2].indexOf('.')+1),

				type: si_type,

				...si_coin && {
					coin: si_coin,
				},
			} as EntityInfo;
		}

		static holdingPathFor(sa_owner: Bech32, si_coin: string, p_chain=yw_chain_ref.get()): HoldingPath {
			return `${p_chain}/bech32.${sa_owner}/holding.${si_coin}`;
		}

		static async readTokens(g_chain: ChainStruct, h_interfaces: TokenStructMap|null=null) {
			// read store
			const ks_res = await Entities.read();

			// 
			return ks_res.tokens(Chains.pathFrom(g_chain), h_interfaces);
		}

		static async readFungibleTokens(g_chain: ChainStruct) {
			// read store
			const ks_res = await Entities.read();

			// all fungible tokens from chain
			const h_interfaces = fold(
				g_chain.tokenInterfaces,
				si_key => TokenRegistry[si_key].attributes.fungible? {[si_key]:{}}: {}
			) as TokenStructMap;

			// apply filter
			return ks_res.tokens(Chains.pathFrom(g_chain), h_interfaces);
		}

		static fungibleInterfacesFor(g_chain: ChainStruct) {
			// all fungible tokens from chain
			return fold(
				g_chain.tokenInterfaces,
				si_key => TokenRegistry[si_key].attributes.fungible? {[si_key]:{}}: {}
			) as TokenStructMap;
		}

		static async infoForToken(g_token: Token['struct']): TokenBasicInfo {

		}

		// static pathFor<
		// 	s_host extends string,
		// 	s_scheme extends TagSchemeKey,
		// 	g_res extends Tag<Replace<s_host, ':', '+'>, s_scheme>,
		// >(s_host: s_host, s_scheme: s_scheme): Resource.Path<g_res> {
		// 	return `/scheme.${s_scheme}/host.${s_host.replace(/:/g, '+')}` as Resource.Path<g_res>;
		// }

		// static pathFrom<
		// 	g_res extends Tag,
		// >(g_res: TagStruct): Resource.Path<g_res> {
		// 	return EntitiesI.pathFor(g_res.host, g_res.scheme);
		// }

		// static get(s_host: string, s_scheme: TagSchemeKey): Promise<null | TagStruct> {
		// 	return Entities.open(ks_ress => ks_ress.get(s_host, s_scheme));
		// }

		// get(s_host: string, s_scheme: TagSchemeKey): TagStruct | null {
		// 	// prepare res path
		// 	const p_res = EntitiesI.pathFor(s_host, s_scheme);

		// 	// fetch
		// 	return this._w_cache[p_res] ?? null;
		// }


		// async put(g_res: TagStruct): Promise<void> {
		// 	// prepare res path
		// 	const p_res = EntitiesI.pathFor(g_res.host, g_res.scheme);

		// 	// update cache
		// 	this._w_cache[p_res] = g_res;

		// 	// attempt to save
		// 	await this.save();
		// }

		filteredMap<
			w_out extends any,
			g_subtype extends Entity=Entity,
		>(
			f_map: (p_entity: EntityPath, g_entity: EntityTree) => w_out
		): Record<Resource.Path<g_subtype>, w_out> {
			// ref cache
			const h_cache = this._w_cache;

			// prep out
			const h_out = {} as Record<Resource.Path<g_subtype>, w_out>;

			// each entitiy
			for(const p_res in h_cache) {
				const w_out = f_map(p_res as EntityPath, h_cache[p_res] as EntityTree);
				if(w_out) {
					h_out[p_res] = w_out;
				}
			}

			return h_out;
		}


		every(f_every: (p_entity: EntityPath, g_entity: EntityTree) => boolean): boolean {
			// ref cache
			const h_cache = this._w_cache;

			// each entitiy
			for(const p_res in h_cache) {
				// failed test; break
				if(!f_every(p_res as EntityPath, h_cache[p_res] as EntityTree)) {
					return false;
				}
			}

			// all passed
			return true;
		}

		tokens(p_prefix: ChainPath, h_interfaces: TokenStructMap|null=null): Record<TokenSpecKey, TokenDict> {
			// output
			const h_outs = {} as Record<TokenSpecKey, TokenDict>;

			// no interfaces specified
			this.every((p_res, g_entity) => {
				// prep contract ref
				let g_contract: Values<ContractSubtree>;

				// belongs to target chain and is a contract
				if(p_res.startsWith(p_prefix) && (g_contract=g_entity['as.contract'])) {
					// each interface in contract
					for(const si_interface in g_contract) {
						// not token interface; skip
						if(!si_interface.startsWith('token.')) continue;

						// token interface id
						const si_interface_token = si_interface.slice('token.'.length);

						// token exists in map; copy to output
						if(!h_interfaces || si_interface_token in h_interfaces) {
							h_outs[si_interface_token][p_res] = g_contract[si_interface];
						}
					}
				}

				// continue
				return true;
			});

			// output
			return h_outs;
		}
	},
});


