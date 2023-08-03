import type {Bech32, Chain, MigrationStruct} from './chain';
import type {Cw} from './cosm-wasm';
import type {L, N} from 'ts-toolbelt';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {Dict, JsonObject} from '#/meta/belt';


export type TokenSpecRegistry = {
	snip20: {
		queries: {
			balance: {
				private: true;
				request: {
					key: Cw.ViewingKey;
					address: Cw.Bech32;
				};
				response: {
					amount: Cw.Uint128;
				};
			};

			token_info: {
				response: {
					name: Cw.String;
					symbol: Cw.String;
					decimals: Cw.NaturalNumber;
					total_supply: Cw.Uint128;
				};
			};

			transfer_history: {
				private: true;
				request: {
					key: Cw.ViewingKey;
					address: Cw.Bech32;
					page_size: Cw.NaturalNumber;
					page?: Cw.WholeNumber;
				};
				response: {
					total?: Cw.WholeNumber | null;
					txns: {
						id: Cw.String;
						from: Cw.Bech32;
						sender: Cw.Bech32;
						receiver: Cw.Bech32;
						coins: Cw.Coin;
					}[];
				};
			};

			allowance: {
				private: true;
				request: {
					owner: Cw.Bech32;
					spender: Cw.Bech32;
					key: Cw.ViewingKey;
					expiration?: Cw.UnixTime | null;
					padding?: Cw.Padding;
				};
				response: {
					spender: Cw.Bech32;
					owner: Cw.Bech32;
					allowance: Cw.Uint128;
					expiration: Cw.UnixTime;
				};
			};

			minters: {
				response: {
					minters: Cw.Bech32[];
				};
			};

			exchange_rate: {
				response: {
					rate: Cw.Uint128;
					denom: Cw.String;
				};
			};
		};
	};
	snip21: {};
	snip22: {};
	snip23: {};
	snip24: {};
	snip25: {};
	snip721: {
		// chains: KnownChain.SecretNetwork;
	};
	snip722: {};
	snip1155: {};
	cw20: {};
} extends infer gc_registry
	? {
		[si_each in keyof gc_registry]: si_each extends `${infer si_spec}`
			? gc_registry[si_each] extends infer gc_spec
				? gc_spec extends {chains: Chain}
					? TokenSpec.New<si_spec, gc_spec>
					: never
				: never
			: never;
	}
	: never;

export type TokenSpecKey = keyof TokenSpecRegistry;


export type TokenSpec<
	si_spec extends string=string,
	h_spec extends {}={},
> = Merge<{
	key: si_spec;
}, h_spec>;

export namespace TokenSpec {
	export type Config = {
		chains: Chain;
	};

	export type New<
		si_spec extends string,
		gc_spec extends Config,
	> = TokenSpec<si_spec, gc_spec>;

	export type Chains<
		si_spec extends TokenSpecKey,
	> = TokenSpecRegistry[si_spec]['chains'];

	export type Response<
		si_spec extends TokenSpecKey=TokenSpecKey,
	> = TokenSpecRegistry[si_spec]['queries'][string]['response'];
}

// // a contract which abides some standard that allows for reporting holdings
// export type Token<
// 	g_chain extends Chain=Chain,
// 	si_spec extends TokenSpecKey=TokenSpecKey,
// 	s_pubkey extends string=string,
// > = Resource.New<{
// 	extends: Contract<g_chain, s_pubkey>;

// 	// e.g., `token/snip-20/bech32.secret1${string}`
// 	segments: [`token.${si_spec}`];  // , Chain.Bech32<g_chain, 'acc'>

// 	interface: Merge<{
// 		// which specification this contract implements
// 		spec: si_spec;

// 		// high-level info global to all tokens
// 		symbol: string;
// 		name: string;
// 		extra?: Dict;
// 	}, Contract<g_chain, s_pubkey>['struct']>;
// }>;

// export type TokenPath = Resource.Path<Token>;

// // test
// {
// 	type sUSDC = Token<KnownChain.SecretNetwork, 'snip-20', '99999'>;

// 	const path: Resource.Path<sUSDC> = '/family.cosmos/chain.secret-4/bech32.secret199999/as.contract/token.snip-20';
// }

// type segs = Token['segments'];
// type sho1 = Resource.Path<Token>;


export type TokenStructRegistry = {
	snip20: {
		struct: {
			symbol: string;
			decimals: L.UnionOf<N.Range<0, 18>>;
			extra?: {
				coingeckoId?: string;
				migrate?: MigrationStruct | {};
			};
		};
	};

	snip21: {
		struct: {};
	};

	snip22: {
		struct: {};
	};

	snip23: {
		struct: {};
	};

	snip24: {
		struct: {};
	};

	snip25: {
		struct: {};
	};

	snip721: {
		struct: {};
	};

	snip722: {
		struct: {};
	};

	snip1155: {
		struct: {};
	};
};

export type TokenStructKey = keyof TokenStructRegistry;

export type TokenStructDescriptor<
	si_key extends TokenStructKey=TokenStructKey,
> = Pick<{
	[si_each in TokenStructKey]: TokenStructRegistry[si_each]['struct'];
}, si_key>;

