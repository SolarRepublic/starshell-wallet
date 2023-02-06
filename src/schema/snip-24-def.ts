import type {AdaptedStdSignDoc} from './amino';
import type {Snip20} from './snip-20-def';

import type {JsonObject} from '#/meta/belt';
import type {Bech32, ChainStruct} from '#/meta/chain';
import type {Cw, Cwm} from '#/meta/cosm-wasm';


export type Snip24Permission =
	| 'allowance'
	| 'balance'
	| 'history'
	| 'owner';

export interface Snip24PermitMsg<
	g_chain extends ChainStruct=ChainStruct,
	si_hrp extends string=g_chain['bech32s']['acc'],
> extends JsonObject {
	type: 'query_permit';
	value: {
		permit_name: string;
		allowed_tokens: Bech32<si_hrp>[];
		permissions: Snip24Permission[];
	};
}

export interface Snip24Tx<
	g_chain extends ChainStruct=ChainStruct,
	si_hrp extends string=g_chain['bech32s']['acc'],
	g_permit_msg extends Snip24PermitMsg<g_chain, si_hrp>=Snip24PermitMsg<g_chain, si_hrp>,
> extends AdaptedStdSignDoc {
	chain_id: g_chain['reference'];
	account_number: '0';
	sequence: '0';
	fee: {
		gas: '1';
		amount: [
			{
				denom: 'uscrt';
				amount: '0';
			},
		];
	};
	msgs: [g_permit_msg];
	memo: '';
}


export namespace Snip24 {
	interface BaseMessageRegistry {
		revoke_permit: {
			message: {
				permit_name: string;
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
		with_permit: {
			message: Snip20.BaseMessageParameters;
		};
	}

	export type BaseQueryKey = keyof BaseQueryRegistry;

	export type BaseQueryParameters<
		as_keys extends BaseQueryKey=BaseQueryKey,
	> = Cwm.RenderQueries<BaseQueryRegistry, as_keys>;

	export type BaseQueryResponse<
		as_keys extends BaseQueryKey=BaseQueryKey,
	> = Cwm.RenderResponses<BaseQueryRegistry, as_keys>;


	type AnyMessageRegistry = Cwm.MergeInterfaces<[
		BaseMessageRegistry,
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
	}

	export interface QueryRegistries {
		BaseQuery: BaseQueryRegistry;
	}

	export type Registries = Cwm.MergeInterfaces<[
		MessageRegistries,
		QueryRegistries,
	]>;

}
