import type {Bech32 as B32} from './chain';
import type {O, U} from 'ts-toolbelt';

import type {JsonValue} from '#/meta/belt';

/**
 * === _**@starshell/meta**_ ===
 * 
 * Unique symbol used to create opaque types for CosmWasm messages. {@link Cw}.
 */
declare const cw_type: unique symbol;

export type CwTypeRegistry = {
	string: {};
	number: {};
	whole_number: {};
	natural_number: {};
	decimal: {};
	unix_time: {};
	padding: {};

	Uint128: {};
	Bech32: {};
	ViewingKey: {};
	Coin: {};
	Amount: {};
	Base64: {};
	Hex: {};
};

export type CwTypeKey = keyof CwTypeRegistry;

export type Cw<
	w_primitive extends JsonValue=JsonValue,
	si_type extends CwTypeKey=CwTypeKey,
> = {
	[cw_type]: si_type;
} & w_primitive;

export namespace Cw {
	export type Decimal = Cw<`${bigint}`, 'decimal'>;

	export type String = Cw<`${string}`, 'string'>;

	// int53
	export type Number = Cw<number, 'number'>;

	export type WholeNumber = Cw<number, 'whole_number'>;

	export type NaturalNumber = Cw<number, 'natural_number'>;


	export type Padding = Cw<`${string}`, 'padding'>;

	export type UnixTime = Cw<number, 'unix_time'>;

	export type Uint128 = Cw<`${bigint}`, 'Uint128'>;

	export type Bech32 = Cw<B32, 'Bech32'>;

	export type ViewingKey = Cw<`${string}`, 'ViewingKey'>;

	export type Base64 = Cw<`${string}`, 'Base64'>;

	export type Hex = Cw<`${string}`, 'Hex'>;

	export type Coin = Cw<{
		amount: Uint128;
		denom: String;
	}, 'Coin'>;

	export type Amount = Cw<`${Uint128}${String}`, 'Amount'>;

}


interface OnlySuccess {
	status: 'success';
}

export namespace Cwm {
	export type RenderSnipMessages<
		h_registry extends object,
		as_keys extends keyof h_registry,
	> = {
		[si_each in as_keys]: h_registry[si_each] extends {message: object}
			? {
				[si_itself in si_each]: O.Merge<h_registry[si_each]['message'], {
					padding?: Cw.Padding | undefined;
				}>;
			}
			: never;
	}[as_keys];

	export type RenderQueries<
		h_registry extends object,
		as_keys extends keyof h_registry,
	> = {
		[si_each in as_keys]: h_registry[si_each] extends {query: object}
			? {
				[si_itself in si_each]: h_registry[si_each]['query'];
			}
			: never;
	}[as_keys];

	export type RenderResponses<
		h_registry extends object,
		as_keys extends keyof h_registry,
	> = {
		[si_each in as_keys]: h_registry[si_each] extends {message: object}
			? {
				[si_itself in si_each]: h_registry[si_itself] extends {response: object}
					? h_registry[si_itself]['response']
					: OnlySuccess;
			}
			: h_registry[si_each] extends {query: object}
				? {
					[si_itself in si_each]: h_registry[si_itself] extends {response: object}
						? h_registry[si_itself]['response']
						: never;
				}
				: void;
	}[as_keys];

	export type MergeInterfaces<a_interfaces extends object[]> = O.MergeAll<{}, U.ListOf<{
		[i_each in keyof a_interfaces]: U.Merge<a_interfaces[i_each]>;
	}[Extract<keyof a_interfaces, number>]>>;
}
