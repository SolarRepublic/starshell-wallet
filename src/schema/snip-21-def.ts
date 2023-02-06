import type {Snip20} from './snip-20-def';
import type {O} from 'ts-toolbelt';

import type {Cw, Cwm} from '#/meta/cosm-wasm';

export namespace Snip21 {
	interface BaseMessageRegistry {
		transfer: Snip20.ExtendGroup<'BaseMessage', 'transfer', {
			message: {
				memo?: Cw.String | undefined;
			};
		}>;

		send: Snip20.ExtendGroup<'BaseMessage', 'send', {
			message: {
				memo?: Cw.String | undefined;
			};
		}>;
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
		transfer_history: Snip20.ExtendGroup<'BaseQuery', 'transfer_history', {
			response: {
				total?: Cw.WholeNumber | undefined;
				txs: O.Merge<{
					block_time?: Cw.NaturalNumber | undefined;
					block_height?: Cw.NaturalNumber | undefined;
					memo?: Cw.String | undefined | null;
				}, Snip20.Registries['BaseQuery']['transfer_history']['response']['txs'][number]>[];
			};
		}>;

		transaction_history: {
			query: {
				key: Cw.ViewingKey;
				address: s_bech32 | Cw.String;
				page_size: Cw.WholeNumber;
				page?: Cw.WholeNumber | undefined;
			};

			response: {
				total: Cw.WholeNumber;
				txs: {
					id?: Cw.NaturalNumber | undefined;
					block_time: Cw.NaturalNumber;
					block_height: Cw.NaturalNumber;
					coins: {
						denom: Cw.String;
						amount: Cw.Uint128;
					};
					memo?: Cw.String | undefined | null;
					action: {
						transfer?: {
							from: s_bech32;
							sender: s_bech32;
							recipient: s_bech32;
						};
						mint?: {
							minter: s_bech32;
							recipient: s_bech32;
						};
						burn?: {
							burner: s_bech32;
							owner: s_bech32;
						};
						deposit?: {};
						redeem?: {};
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


	interface AllowanceMessageRegistry {
		transfer_from: Snip20.ExtendGroup<'AllowanceMessage', 'transfer_from', {
			message: {
				memo?: Cw.String | undefined;
			};
		}>;

		send_from: Snip20.ExtendGroup<'AllowanceMessage', 'send_from', {
			message: {
				memo?: Cw.String | undefined;
			};
		}>;
	}

	export type AllowanceMessageKey = keyof AllowanceMessageRegistry;

	export type AllowanceMessageParameters<
		as_keys extends AllowanceMessageKey=AllowanceMessageKey,
	> = Cwm.RenderSnipMessages<AllowanceMessageRegistry, as_keys>;

	export type AllowanceMessageResponse<
		as_keys extends AllowanceMessageKey=AllowanceMessageKey,
	> = Cwm.RenderResponses<AllowanceMessageRegistry, as_keys>;



	type AnyMessageRegistry = Cwm.MergeInterfaces<[
		BaseMessageRegistry,
		AllowanceMessageRegistry,
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
		AllowanceMessage: AllowanceMessageRegistry;
	}

	export interface QueryRegistries {
		BaseQuery: BaseQueryRegistry;
	}

	export type Registries = Cwm.MergeInterfaces<[
		MessageRegistries,
		QueryRegistries,
	]>;

}
