import type {A, O, U} from 'ts-toolbelt';

import type {Cw, Cwm} from '#/meta/cosm-wasm';

export namespace Snip20 {
	interface BaseMessageRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> {
		transfer: {
			message: {
				recipient: s_bech32;
				amount: Cw.Uint128;
			};
		};

		send: {
			message: {
				recipient: s_bech32;
				amount: Cw.Uint128;
				msg?: Cw.Base64 | undefined;
			};
		};

		register_receive: {
			message: {
				code_hash: Cw.Hex;
			};
		};

		create_viewing_key: {
			message: {
				entropy: Cw.String;
			};

			response: {
				key: Cw.ViewingKey;
			};
		};

		set_viewing_key: {
			message: {
				key: Cw.ViewingKey;
			};
		};
	}

	export type BaseMessageKey = keyof BaseMessageRegistry;

	export type BaseMessageParameters<
		as_keys extends BaseMessageKey=BaseMessageKey,
	> = Cwm.RenderSnipMessages<BaseMessageRegistry, as_keys>;

	export type BaseMessageResponse<
		as_keys extends BaseMessageKey=BaseMessageKey,
	> = Cwm.RenderResponses<BaseMessageRegistry, as_keys>;


	interface BaseQueryRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> {
		balance: {
			query: {
				key: Cw.ViewingKey;
				address: s_bech32 | Cw.String;
			};

			response: {
				amount: Cw.Uint128;
			};
		};

		token_info: {
			query: {};

			response: {
				name: Cw.String;
				symbol: Cw.String;
				decimals: Cw.NaturalNumber;
				totaly_supply: Cw.Uint128;
			};
		};

		transfer_history: {
			query: {
				key: Cw.ViewingKey;
				address: s_bech32 | Cw.String;
				page_size: Cw.WholeNumber;
				page?: Cw.WholeNumber | undefined;
			};

			response: {
				txs: {
					id?: Cw.String;
					from?: s_bech32;
					receiver: s_bech32;
					coins: {
						denom: Cw.String;
						amount: Cw.Uint128;
					};
				}[];
			};
		};
	}

	export type BaseQueryKey = keyof BaseQueryRegistry;

	export type BaseQueryParameters<
		as_keys extends BaseQueryKey=BaseQueryKey,
	> = Cwm.RenderQueries<BaseQueryRegistry, as_keys>;

	export type BaseQueryResponse<
		as_keys extends BaseQueryKey=BaseQueryKey,
	> = Cwm.RenderResponses<BaseQueryRegistry, as_keys>;


	type AllowanceMessageRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> = {
		increase_allowance: {
			message: {
				spender: s_bech32;
				amount: Cw.Uint128;
				expiration?: Cw.NaturalNumber | undefined;
			};

			response: {
				spender: s_bech32;
				owner: s_bech32;
				allowance: Cw.Uint128;
			};
		};

		decrease_allowance: {
			message: {
				spender: s_bech32;
				amount: Cw.Uint128;
				expiration?: Cw.NaturalNumber | undefined;
			};

			response: {
				spender: s_bech32;
				owner: s_bech32;
				allowance: Cw.Uint128;
			};
		};

		transfer_from: {
			message: {
				owner: s_bech32;
				recipient: s_bech32;
				amount: Cw.Uint128;
			};
		};

		send_from: {
			message: {
				owner: s_bech32;
				recipient: s_bech32;
				amount: Cw.Uint128;
				msg?: Cw.Base64 | undefined;
			};
		};
	};

	export type AllowanceMessageKey = keyof AllowanceMessageRegistry;

	export type AllowanceMessageParameters<
		as_keys extends AllowanceMessageKey=AllowanceMessageKey,
	> = Cwm.RenderSnipMessages<AllowanceMessageRegistry, as_keys>;

	export type AllowanceMessageResponse<
		as_keys extends AllowanceMessageKey=AllowanceMessageKey,
	> = Cwm.RenderResponses<AllowanceMessageRegistry, as_keys>;


	interface AllowanceQueryRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> {
		allowance: {
			query: {
				owner: s_bech32;
				spender: s_bech32;
				key: Cw.ViewingKey;
			};

			response: {
				spender: s_bech32;
				owner: s_bech32;
				allowance: Cw.Uint128;
				expiration?: Cw.NaturalNumber | null | undefined;
			};
		};
	}

	export type AllowanceQueryKey = keyof AllowanceQueryRegistry;

	export type AllowanceQueryParameters<
		as_keys extends AllowanceQueryKey=AllowanceQueryKey,
	> = Cwm.RenderQueries<AllowanceQueryRegistry, as_keys>;

	export type AllowanceQueryResponse<
		as_keys extends AllowanceQueryKey=AllowanceQueryKey,
	> = Cwm.RenderResponses<AllowanceQueryRegistry, as_keys>;


	type MintableMessageRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> = {
		mint: {
			message: {
				recipient: s_bech32;
				amount: Cw.Uint128;
			};
		};

		set_minters: {
			message: {
				minters: s_bech32[];
			};
		};

		burn: {
			message: {
				amount: Cw.Uint128;
			};
		};

		burn_from: {
			message: {
				owner: s_bech32;
				amount: Cw.Uint128;
			};
		};
	};

	export type MintableMessageKey = keyof MintableMessageRegistry;

	export type MintableMessageParameters<
		as_keys extends MintableMessageKey=MintableMessageKey,
	> = Cwm.RenderSnipMessages<MintableMessageRegistry, as_keys>;

	export type MintableMessageResponse<
		as_keys extends MintableMessageKey=MintableMessageKey,
	> = Cwm.RenderResponses<MintableMessageRegistry, as_keys>;


	type MintableQueryRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> = {
		minters: {
			query: {};

			response: {
				minters: s_bech32[];
			};
		};
	};

	export type MintableQueryKey = keyof MintableQueryRegistry;

	export type MintableQueryParameters<
		as_keys extends MintableQueryKey=MintableQueryKey,
	> = Cwm.RenderQueries<MintableQueryRegistry, as_keys>;

	export type MintableQueryResponse<
		as_keys extends MintableQueryKey=MintableQueryKey,
	> = Cwm.RenderResponses<MintableQueryRegistry, as_keys>;


	type NativeMessageRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> = {
		deposit: {
			message: {};
		};

		redeem: {
			message: {
				amount: Cw.Uint128;
				denom?: Cw.String | undefined;
			};
		};
	};

	export type NativeMessageKey = keyof NativeMessageRegistry;

	export type NativeMessageParameters<
		as_keys extends NativeMessageKey=NativeMessageKey,
	> = Cwm.RenderSnipMessages<NativeMessageRegistry, as_keys>;

	export type NativeMessageResponse<
		as_keys extends NativeMessageKey=NativeMessageKey,
	> = Cwm.RenderResponses<NativeMessageRegistry, as_keys>;


	type NativeQueryRegistry<
		s_bech32 extends Cw.Bech32=Cw.Bech32,
	> = {
		exchange_rate: {
			query: {};

			response: {
				rate: Cw.Uint128;
				denom: Cw.String;
			};
		};
	};

	export type NativeQueryKey = keyof NativeQueryRegistry;

	export type NativeQueryParameters<
		as_keys extends NativeQueryKey=NativeQueryKey,
	> = Cwm.RenderQueries<NativeQueryRegistry, as_keys>;

	export type NativeQueryResponse<
		as_keys extends NativeQueryKey=NativeQueryKey,
	> = Cwm.RenderResponses<NativeQueryRegistry, as_keys>;


	type AnyMessageRegistry = Cwm.MergeInterfaces<[
		BaseMessageRegistry,
		AllowanceMessageRegistry,
		MintableMessageRegistry,
		NativeMessageRegistry,
	]>;

	export type AnyMessageKey = keyof AnyMessageRegistry;

	export type AnyMessageParameters<
		as_keys extends AnyMessageKey=AnyMessageKey,
	> = Cwm.RenderSnipMessages<AnyMessageRegistry, as_keys>;

	export type AnyMessageResponse<
		as_keys extends AnyMessageKey=AnyMessageKey,
	> = Cwm.RenderResponses<AnyMessageRegistry, as_keys>;


	type AnyQueryRegistry = Cwm.MergeInterfaces<[
		BaseQueryRegistry,
		AllowanceQueryRegistry,
		MintableQueryRegistry,
		NativeQueryRegistry,
	]>;

	export type AnyQueryKey = keyof AnyQueryRegistry;

	export type AnyQueryParameters<
		as_keys extends AnyQueryKey=AnyQueryKey,
	> = Cwm.RenderQueries<AnyQueryRegistry, as_keys>;

	export type AnyQueryResponse<
		as_keys extends AnyQueryKey=AnyQueryKey,
	> = Cwm.RenderResponses<AnyQueryRegistry, as_keys>;


	export interface MessageRegistries {
		BaseMessage: BaseMessageRegistry;
		AllowanceMessage: AllowanceMessageRegistry,
		MintableMessage: MintableMessageRegistry,
		NativeMessage: NativeMessageRegistry,
	}

	export interface QueryRegistries {
		BaseQuery: BaseQueryRegistry,
		AllowanceQuery: AllowanceQueryRegistry,
		MintableQuery: MintableQueryRegistry,
		NativeQuery: NativeQueryRegistry,
	}

	export type Registries = Cwm.MergeInterfaces<[
		MessageRegistries,
		QueryRegistries,
	]>;

	export type ExtendGroup<
		si_category extends keyof Snip20.Registries,
		si_group extends keyof Snip20.Registries[si_category],
		h_group extends object,
	> = Snip20.Registries[si_category][si_group] extends infer h_base
		? O.Filter<{
			message: h_base extends {message:object}
				? h_group extends {message:object}
					? O.Merge<h_group['message'], h_base['message']>
					: h_base['message']
				: never;

			query: h_base extends {query:object}
				? h_group extends {query:object}
					? O.Merge<h_group['query'], h_base['query']>
					: h_base['query']
				: undefined;

			response: h_base extends {response:object}
				? h_group extends {response:object}
					? O.Merge<h_group['response'], h_base['response']>
					: h_base['response']
				: void;
		}, void>
		: never;

	export type ExtendItem<
		si_category extends keyof Snip20.Registries,
		si_group extends keyof Snip20.Registries[si_category],
		si_item extends keyof Snip20.Registries[si_category][si_group],
		h_schema extends object,
	> = Snip20.Registries[si_category][si_group][si_item] extends infer h_base
		? h_base extends object
			? O.Merge<h_schema, h_base>
			: never
		: never;
}

