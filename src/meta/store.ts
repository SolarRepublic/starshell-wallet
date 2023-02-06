import type {Account} from './account';
import type {App} from './app';
import type {Agent, Chain, ChainPath, Contract, Entity, Holding, HoldingPath} from './chain';
import type {Incident, IncidentPath} from './incident';
import type {Media} from './media';
import type {Pfp} from './pfp';
import type {Provider} from './provider';
import type {Resource} from './resource';
import type {Secret} from './secret';
import type {ResponseCache, WebApi} from './web-api';
import type {String, Union} from 'ts-toolbelt';
import type {Cast} from 'ts-toolbelt/out/Any/Cast';
import type {Compute} from 'ts-toolbelt/out/Any/Compute';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {MergeAll} from 'ts-toolbelt/out/Object/MergeAll';

import type {Dict, JsonObject, JsonValue} from '#/meta/belt';

import type {AppPolicy} from '#/store/policies';
import type {SettingsRegistry} from '#/store/settings';


// associates a resource to arbitrary data in some typed category
export type DataMap<
	g_resource extends Resource=Resource,
	w_value extends JsonValue=JsonValue,
> = Record<
	Resource.Path<g_resource>,
	w_value
>;

// creates a closed set of data maps that are grouped by some quality
export interface DataMapSet<
	a_maps extends DataMap[]=DataMap[],
> {
	maps: a_maps;
}



// associates a resource to arbitrary data in some typed category
export type LinkMap1to1<
	g_src extends Resource=Resource,
	g_dst extends Resource=Resource,
> = Record<
	Resource.Path<g_src>,
	Resource.Path<g_dst>
>;

export type LinkMap1toMany<
	g_src extends Resource=Resource,
	g_dst extends Resource=Resource,
> = Record<
	Resource.Path<g_src>,
	Resource.Path<g_dst>[]
>;


export type RootDoc<
	g_resource extends Resource,
> = DataMap<g_resource, g_resource['struct']>;


export type Relative<
	g_root extends Resource=Resource,
	as_children extends Resource=Resource,
> = Resource extends g_root
	? Resource.Path<as_children>
	: String.Replace<Resource.Path<as_children>, String.Join<[Resource.Path<g_root>, '/']>, ''>;

export type LinkTree<
	g_key extends Resource=Resource,
	a_children extends any=any,
	g_parent extends Resource=Resource,
> = Compute<Partial<Record<
	Relative<g_parent, g_key>,
	a_children
>>>;

export namespace LinkTree {
	type RecurisveDescriptor = Array<
		[Resource]
		| [Resource, RecurisveDescriptor]
	>;

	/**
	 * ```ts
	 * LinkTree.New<
	 * 	root: Resource,
	 * 	pairs: RecursiveDescriptor=Array<
	 * 		[Resource, RecursiveDescriptor?]
	 * 	>,
	 * 	parent?: Resource,
	 * >
	 * ```
	 * 
	 * See also: {@link RecurisveDescriptor}
	 */
	export type New<
		g_root extends Resource=Resource,
		a_pairs extends RecurisveDescriptor=RecurisveDescriptor,
		g_parent extends Resource=Resource,
	> = LinkTree<g_root, {
		[i_each in keyof a_pairs]: a_pairs[i_each] extends infer a_pair
			? a_pair extends [infer g_key, infer a_subpairs]
				? g_key extends Resource
					? a_subpairs extends RecurisveDescriptor
						? New<g_key, a_subpairs, g_root>
						: never
					: never
				: a_pair extends [infer g_key]
					? g_key extends Resource
						? LinkTree<g_key, {}, g_root>
						: never
					: g_parent
			: never
	}[number], g_parent>;
}

// interface SubmittedTxn extends JsonObject {
// 	hash: string;
// 	chain: ChainPath;
// 	owner: Bech32;
// }

export interface SyncInfo extends JsonObject {
	height: string;
}

export type Store = Merge<{
	// root elements
	accounts: RootDoc<Account>;
	chains: RootDoc<Chain>;
	providers: RootDoc<Provider>;
	apps: RootDoc<App>;
	media: RootDoc<Media>;
	pfps: RootDoc<Pfp>;
	secrets: RootDoc<Secret>;
	web_apis: RootDoc<WebApi>;
	contracts: RootDoc<Contract>;

	// app policies
	app_policies: {
		hq: AppPolicy[];
		user: AppPolicy[];
	};

	// settings
	settings: SettingsRegistry;

	// tags only exist as mapped references to simplify forwards-compatiblity, schema, and indexing
	tags: {
		registry: TagStruct[];
		map: DataMap<Resource, number[]>;
	};

	// query cache only exists as mapped references
	// query_cache: Record<TokenPath, TokenSpec.Response>;
	query_cache: Record<HoldingPath | TokenPath, JsonObject>;

	// incidents
	incidents: RootDoc<Incident>;

	// activity log events
	// events: LogEvent[];
	events: [];
	histories: {
		order: IncidentPath[];
		syncs: Record<ChainPath, Dict<SyncInfo>>;

		// datetime of last seen message
		seen: number;
	};


	web_resources: Dict<MergeAll<{
		etag: string;
	}, Union.ListOf<ResponseCache>>>;

	// agents exist outside of a chain
	agents: RootDoc<Agent>;

	// all chain entities including coins, contracts and tokens (and agent proxies?)
	entities: LinkTree.New<Entity, [
		[Agent.ProxyFromEntity],
		[Contract, [
			[Token],
		]],
		[Holding],
	]>;
}, Record<`:${string}`, string>>;

export namespace Store {
	export type Key<si_store extends StoreKey> = keyof Store[si_store];

	export type Value<
		si_store extends StoreKey,
		as_keys extends Key<si_store>=Key<si_store>,
	> = Store[si_store][as_keys] extends JsonValue
		? Store[si_store][as_keys]
		: never;

	// export type Cache<
	// 	si_store extends StoreKey=StoreKey,
	// 	as_keys extends Key<si_store>=Key<si_store>,
	// > = Record<si_store, Value<si_store, as_keys>>;

	export type Cache<
		si_store extends StoreKey=StoreKey,
		as_keys extends Key<si_store>=Key<si_store>,
	> = Store[si_store] extends any[]
		? Array<si_store, as_keys>
		: Map<si_store, as_keys>;

	export type Map<
		si_store extends StoreKey=StoreKey,
		as_keys extends Key<si_store>=Key<si_store>,
	> = Cast<{
		[si_key in as_keys]: Store[si_store][si_key];
	}, JsonObject>;

	export type Array<
		si_store extends StoreKey=StoreKey,
		as_keys extends Key<si_store>=Key<si_store>,
	> = Cast<Store[si_store][as_keys], JsonValue[]>;
}

export type StoreKey<
	as_keys extends keyof Store=keyof Store,
> = as_keys;

// // tests
// {

// 	const H_STORE: Store = {
// 		chains: {
// 			'/family.cosmos/chain.secret-4': {
// 				family: 'cosmos',
// 				id: 'secret-1',
// 				bech32s: {},
// 				bip44: {
// 					coinType: 1,
// 				},
// 			},
// 		},
// 		entities: {
// 			'/family.cosmos/chain.secret-4/bech32.secret199999': {
// 				'as.contract': {},
// 			},
// 			'/family.cosmos/chain.secret-4/bech32.secret1astuvx': {
// 				'as.contract': {
// 					'token.snip-20': {},
// 					'token.snip-721': {},
// 				},
// 			},
// 			'/family.cosmos/chain.secret-4/bech32.secret122222': {
// 				'as.agent': {},
// 			},
// 		},
// 		tags: {
// 			'/family.cosmos/chain.secret-4/bech32.secret122222': [1, 4],
// 		},
// 		agents: {
// 			'/family.cosmos/agent.8e14': {
// 				name: 'Musk',
// 				notes: '',
// 				pubkey: '8e14',
// 				hrp: '',
// 				chains: {
// 					'chain.secret-4': ['acc'],
// 				},
// 			},
// 		},
// 		events: [

// 		],
// 	};
// }

/*

tags in a separate dict:
pros:
 - allows resource types to easily be added as tagable things later
 - simplifies tag search indexing

cons:
 - increases storage requirement

*/
