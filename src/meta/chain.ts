import type {Nameable, Pfpable} from './able';
import type {AppPath} from './app';
import type {PfpTarget} from './pfp';
import type {Resource} from './resource';
import type {TokenStructDescriptor, TokenStructKey, TokenSpecKey} from './token';
import type {Coin} from '@cosmjs/amino';
import type {O} from 'ts-toolbelt';
import type {Compute} from 'ts-toolbelt/out/Any/Compute';

import type {Concat} from 'ts-toolbelt/out/List/Concat';
import type {Tail} from 'ts-toolbelt/out/List/Tail';

import type {Dict, JsonObject} from '#/meta/belt';

import type {Snip20} from '#/schema/snip-20-def';
import type {Snip21} from '#/schema/snip-21-def';
import type {Snip24} from '#/schema/snip-24-def';
import type {TokenInterfaceRuntimeSchema} from '#/schema/token-interface-const';

import type {BalanceBundle} from '#/store/providers';

/**
 * Represents an address space for a certain type of accounts (e.g., a bech32 extension)
 */
export type Bech32<
	si_hrp extends string=string,
	s_data extends string=string,
> = `${si_hrp}1${s_data}`;


/**
 * Represents a chain namespace and the defaults its chains may inherit.
 */
export type ChainNamespace<
	h_bech32s extends Dict={},
> = {
	bech32s: h_bech32s;
};

export namespace ChainNamespace {
	export type Config = {
		bech32s: Dict;
	};

	export type New<
		gc_namespace extends Config,
	> = gc_namespace['bech32s'] extends infer h_bech32s
		? h_bech32s extends Config['bech32s']
			? ChainNamespace<{
				[si_each in keyof h_bech32s]: Bech32<h_bech32s[si_each]>;
			}>
			: never
		: never;

	export type Bech32s<
		si_namespace extends ChainNamespaceKey=ChainNamespaceKey,
	> = ChainNamespaceRegistry[si_namespace]['bech32s'] extends infer h_bech32s
		? h_bech32s extends Dict<Bech32>
			? h_bech32s
			: never
		: never;

	export type Hrp<
		si_namespace extends ChainNamespaceKey,
		as_keys extends keyof Bech32s<si_namespace>=keyof Bech32s<si_namespace>,
	> = Bech32s<si_namespace>[as_keys]['hrp'];

	export type Segment<
		si_namespace extends ChainNamespaceKey,
	> = `family.${si_namespace}`;
}


export type ChainNamespaceRegistry = {
	cosmos: ChainNamespace.New<{
		bech32s: {
			acc: '';
			accpub: 'pub';
			valoper: 'valoper';
			valoperpub: 'valoperpub';
			valcons: 'valcons';
			valconspub: 'valconspub';
		};
	}>;
};

export type ChainNamespaceKey = keyof ChainNamespaceRegistry;



/**
 * Represents an absolute chain identifier <https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md>
 */
export type Caip2<
	si_namespace extends ChainNamespaceKey=ChainNamespaceKey,
	si_reference extends string=string,
> = {
	namespace: si_namespace;
	reference: si_reference;
};

export namespace Caip2 {
	export type Config = {
		namespace: ChainNamespaceKey;
		reference: string;
	};

	export type New<
		gc_chain extends Config,
	> = Caip2<gc_chain['namespace'], gc_chain['reference']>;

	export type String<
		si_namespace extends ChainNamespaceKey=ChainNamespaceKey,
		si_reference extends string=string,
	> = `${si_namespace}:${si_reference}`;
}


export type Slip44<
	n_coin_type extends number=number,
	si_symbol extends string=string,
> = {
	coinType: n_coin_type;
	symbol?: si_symbol;
};

export namespace Slip44 {
	export type Config = {
		coinType: number;
	};

	export type New<
		gc_slip44 extends Config,
	> = Slip44<
		gc_slip44['coinType']
	>;
}


export interface CoinInfo extends JsonObject {
	decimals: number;
	denom: string;
	name: string;
	pfp: PfpTarget;
	extra?: {
		coingeckoId: string;
		nativeBech32?: Bech32;
	} & Dict;
}

export interface FeeConfigPriced {
	limit: bigint | string;
	price: number | string;
}

export interface FeeConfigAmount {
	limit: bigint | string;
	amount: Coin[];
}

export type FeeConfig = O.Merge<
	Pick<FeeConfigPriced, 'limit'>,
	Partial<Omit<FeeConfigPriced, 'limit'>>
> | O.Merge<
	Pick<FeeConfigAmount, 'limit'>,
	Partial<Omit<FeeConfigAmount, 'limit'>>
>;

export interface BlockExplorerConfig extends JsonObject {
	base: string;
	block: string;
	account: string;
	contract?: string;
	validator: string;
	transaction: string;
}

export interface ChainFeatureRegistry {
	secretwasm: {
		struct: {
			consensusIoPubkey: string;
			snip20GasLimits: {
				[si_key in Snip20.AnyMessageKey | Snip21.AnyMessageKey | Snip24.AnyMessageKey]: `${bigint}`;
			};
			gasPadding: {
				stepSize: `${bigint}`;
			};
			interfaceSchemas: Dict<Dict<TokenInterfaceRuntimeSchema>>;
		};
	};
	'ibc-go': {};
	'ibc-transfer': {};
}

export type ChainFeatureKey = keyof ChainFeatureRegistry;

export type ChainFeaturesConfig = {
	[si_key in ChainFeatureKey]?: ChainFeatureRegistry[si_key] extends {struct: JsonObject}
		? ChainFeatureRegistry[si_key]['struct']
		: {};
};

export type Chain<
	si_namespace extends ChainNamespaceKey=ChainNamespaceKey,
	si_reference extends string=string,
	h_bech32s extends Record<keyof ChainNamespace.Bech32s<si_namespace>, string>=Record<keyof ChainNamespace.Bech32s<si_namespace>, string>,  // Family.Bech32s<si_family>,
	a_slip44s extends Slip44[]=Slip44[],
> = Resource.New<{
	segments: [ChainNamespace.Segment<si_namespace>, Chain.Segment<si_reference>];
	struct: [{
		/**
		 * The chain's CAIP-2 namespace identifier <https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md>
		 */
		namespace: si_namespace;

		/**
		 * The chain's CAIP-2 reference identifier <https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md>
		 */
		reference: si_reference;

		/**
		 * SLIP-0044 <https://github.com/satoshilabs/slips/blob/master/slip-0044.md>
		 */
		slip44s: a_slip44s;

		bech32s: h_bech32s;

		/**
		 * Specifies all "built-in" assets for the chain. By default, the first entry will be used as fee and stake currency.
		 * To specify different currenc(ies) for fee or stake, provide entries for `feeCoinIds` and `stakeCoinIds` respectively.
		 */
		coins: Dict<CoinInfo>;

		/**
		 * Optionally specifies the list of coins in `coins` with the corresponding ids to be used for fees.
		 * If omitted, fee currency will default to the first entry in `coins`.
		 */
		feeCoinIds?: string[];

		/**
		 * Optionally specifies the list of coins in `coins` with the corresponding ids to be used for staking.
		 * If omitted, stake currency will default to the first entry in `coins`.
		 */
		stakeCoinIds?: string[];

		/**
		 * Specifies an order to provider preferences
		 */
		providers: `/provider.${string}`[];


		gasPrices: {
			default: number;
			steps: number[];
		};

		features: ChainFeaturesConfig;

		fungibleTokenInterfaces: TokenSpecKey[];
		nonFungibleTokenInterfaces: TokenSpecKey[];
		testnet?: {
			faucets?: Dict<{}>;
		};
		mainnet?: {
			feegrants?: Dict<{}>;
		};
		blockExplorer: BlockExplorerConfig;
	}, Nameable, Pfpable];
}>;


/**
 * Resource path for a StarShell Chain
 */
export type ChainPath = Resource.Path<Chain>;


/**
 * Interface struct for a StarShell Chain
 */
export type ChainStruct = Chain['struct'];

export namespace Chain {
	export type Config = {
		namespace: ChainNamespaceKey;
		reference: string;
		bech32s: string | {
			// provide explicit map of bech32s
			bech32s: Record<keyof ChainNamespace.Bech32s, string>;
		};
		slip44s: Slip44.Config[];
	};

	/**
	 * === _**@starshell/meta**_ ===
	 * 
	 * ```ts
	 * Chain.New<{
	 * 	namespace: ChainNamespaceKey;
	 * 	reference: string;
	 * 	bech32s: string | {
	 * 		[AddressNamespace: string]: string;
	 * 	};
	 * 	bip44: {
	 * 		coinType: number;
	 * 	};
	 * }>
	 * ```
	 * 
	 * 
	 */
	export type New<
		gc_chain extends Config,
	> = Chain<
		gc_chain['namespace'],
		gc_chain['reference'],
		gc_chain['bech32s'] extends string
			? ChainNamespace.Bech32s<gc_chain['namespace']> extends infer h_bech32s
				? h_bech32s extends Dict
					? {
						[si_each in keyof h_bech32s]: Bech32<`${gc_chain['bech32s']}${h_bech32s[si_each]}`>;
					}
					: never
				: never
			: gc_chain['bech32s'] extends Record<keyof ChainNamespace.Bech32s<gc_chain['namespace']>, Bech32>
				? gc_chain['bech32s']
				: never,
		Array<Slip44.New<gc_chain['slip44s'][Extract<gc_chain['slip44s'], number>]>>
	>;

	export type Bech32String<
		h_bech32s extends ChainStruct['bech32s']=ChainStruct['bech32s'],
		as_keys extends keyof h_bech32s=keyof h_bech32s,
		s_data extends string=string,
	> = Compute<{
		[si_each in keyof h_bech32s]: h_bech32s[si_each] extends Bech32
			? `${Bech32<h_bech32s[si_each], s_data>}`
			: string;
	}[as_keys]>;

	export type Segment<
		si_chain extends string=string,
	> = `chain.${si_chain}`;

		// : [z_chain] extends [ChainLike]
		// 	? Segment<z_chain['struct']['id']>
		// 	: never;
}


export namespace KnownChain {
	export type SecretNetwork = Chain.New<{
		namespace: 'cosmos';
		reference: 'secret-4';
		bech32s: 'secret';
		slip44s: [
			Slip44<118>,
		];
	}>;

	export type SecretNetworkStruct = SecretNetwork['struct'];
}



export type AgentOrEntityOrigin =
	| `app:${AppPath}`
	| 'user' | 'built-in';
	// data: string;  (for privacy, this should only come from historic records)



/**
 * === _**@starshell/meta**_ ===
 * 
 * ```ts
 * Agent<
 * 	namespace?: ChainNamespaceKey,
 * 	pubkey?: string,
 * >
 * ```
 * 
 * An agent is a cross-chain sender or recipient of transactions (it presumably holds a private key)
 */
export type Agent<
	si_namespace extends ChainNamespaceKey=ChainNamespaceKey,
	si_agent extends string=string,
	si_addr_space extends keyof ChainNamespace.Bech32s<si_namespace>=keyof ChainNamespace.Bech32s<si_namespace>,
> = Resource.New<{
	segments: [ChainNamespace.Segment<si_namespace>, `agent.${si_agent}`];
	struct: {
		/**
		 * the chain namespace within which this agent operates
		 */
		namespace: si_namespace;

		/** 
		 * compatible chains (first one is the source chain)
		 */
		chains: [ChainPath, ...ChainPath[]];

		/**
		 * the bech32 address space config key
		 */
		addressSpace: si_addr_space extends `${infer s}`? s: string;

		/**
		 * address data (without checksum)
		 */
		addressData: si_agent;

		/**
		 * what created this agent 
		 */
		origin: AgentOrEntityOrigin;
	};
}>;

export type AgentPath = Resource.Path<Agent>;
export type AgentStruct = Agent['struct'];

export namespace Agent {
	export type ProxyFromEntity = Resource.New<{
		extends: Entity;
		segment: 'as.agent';
		struct: {};
	}>;
}


/**
 * === _**@starshell/meta**_ ===
 * 
 * ```ts
 * Entity<
 * 	chain?: Chain,
 * 	spaces?: keyof chain['struct']['bech32s'],
 * 	pubkey?: string,
 * >
 * ```
 * 
 * Anything that is addressable on a specific chain
 */
export type Entity<
	g_chain extends Chain=Chain,
	as_spaces extends keyof g_chain['struct']['bech32s']=keyof g_chain['struct']['bech32s'],
	s_pubkey extends string=string,
> = Chain.Bech32String<g_chain['struct']['bech32s'], as_spaces, s_pubkey> extends infer sa_entity
	? sa_entity extends Chain.Bech32String<g_chain['struct']['bech32s'], as_spaces, s_pubkey>
		? Resource.New<{
			segments: Concat<Tail<g_chain['segments']>, [`bech32.${sa_entity}`]>;
			struct: {
				bech32: sa_entity & Bech32;

				// where the entity came from
				origin: AgentOrEntityOrigin;
			};
		}>
		: never
	: never;

export type EntityPath = Resource.Path<Entity>;
export type EntityStruct = Entity['struct'];


export type Holding<
	g_chain extends Chain=Chain,
	s_pubkey extends string=string,
	si_coin extends string=string,
> = Resource.New<{
	extends: Entity<g_chain, 'acc', s_pubkey>;

	segments: [`holding.${si_coin}`];

	struct: {
		chain: Resource.Path<g_chain>;
		balance: BalanceBundle;
	};
}>;

export type HoldingPath = Resource.Path<Holding>;

// a contract only exists on one specific chain
export type Contract<
	g_chain extends Chain=Chain,
	s_pubkey extends string=string,
	as_tokens extends TokenStructKey=TokenStructKey,
> = Resource.New<{
	extends: Entity<g_chain, 'acc', s_pubkey>;

	segments: ['as.contract'];

	struct: [{
		// whether or not the contract is enabled
		on: 0 | 1;

		// which chain the contract exists on
		chain: Resource.Path<g_chain>;

		// code hash
		hash: string;

		// interfaces the contract implements
		interfaces: O.Merge<
			Partial<TokenStructDescriptor<as_tokens>>,
			{
				excluded: TokenStructKey[];
			}
		>;

		// log events associate this contract with sites that have used it
		// ...
	}, Nameable, Pfpable];
}>;


export type ContractPath = Resource.Path<Contract>;
export type ContractStruct = Contract['struct'];
