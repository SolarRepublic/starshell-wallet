import type {A, Union} from 'ts-toolbelt';
import type {If} from 'ts-toolbelt/out/Any/If';
import type {And, Or} from 'ts-toolbelt/out/Boolean/_api';
import type {Tail} from 'ts-toolbelt/out/List/_api';
import type {Merge} from 'ts-toolbelt/out/Object/_api';

declare const $_FORMAT: unique symbol;

export type PlainObject = Dict<unknown>;

export type StringFormat<
	w_type extends any=any,
> = {
	[$_FORMAT]: w_type;
} & string;

export namespace StringFormat {
	export type Resolved<
		w_input extends any,
	> = w_input extends StringFormat<infer w_type>
		? w_type
		: w_input;
}


export type Default<
	w_thing extends any,
	w_default extends any,
> = undefined extends w_thing
	? w_default
	: w_thing;

export type Auto<
	w_thing,
	w_test,
	w_else=w_test,
> = w_thing extends void
	? w_else
	: w_thing extends w_test
		? w_thing
		: w_else;

export type Access<
	h_source extends PlainObject,
	as_keys extends undefined|string,
> = as_keys extends keyof h_source
	? h_source[as_keys]
	: PlainObject;

/**
 * Cast non-null void types to another type.
 */
export type CastNonNullVoids<
	w_test extends any,
	w_cast=null,
> = If<
	Or<
		[w_test] extends [never]? 1: 0,
		And<
			[w_test] extends [void]? 1: 0,
			[w_test] extends [null]? 0: 1
		>
	>,
	w_cast,
	w_test
>;

// tests
{
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const A_any: [any] extends [CastNonNullVoids<any>] ? 1: 0 = 1;
	const A_unk: [unknown] extends [CastNonNullVoids<unknown>] ? 1: 0 = 1;
	const A_obj: [object] extends [CastNonNullVoids<object>] ? 1: 0 = 1;
	const A_voi: [null] extends [CastNonNullVoids<void>] ? 1: 0 = 1;
	const A_udf: [null] extends [CastNonNullVoids<undefined>] ? 1: 0 = 1;
	const A_nil: [null] extends [CastNonNullVoids<null>] ? 1: 0 = 1;
	const A_nvr: [null] extends [CastNonNullVoids<never>] ? 1: 0 = 1;

	const C_any: [any] extends [CastNonNullVoids<any, never>]? 1: 0 = 1;
	const C_unk: [unknown] extends [CastNonNullVoids<unknown, never>] ? 1: 0 = 1;
	const C_obj: [object] extends [CastNonNullVoids<object, never>] ? 1: 0 = 1;
	const C_voi: [never] extends [CastNonNullVoids<void, never>] ? 1: 0 = 1;
	const C_udf: [never] extends [CastNonNullVoids<undefined, never>] ? 1: 0 = 1;
	const C_nil: [null] extends [CastNonNullVoids<null, never>] ? 1: 0 = 1;
	const C_nvr: [never] extends [CastNonNullVoids<never, never>] ? 1: 0 = 1;
}


/**
 * === _**@starshell/meta**_ ===
 * 
 * Coalesce a sequence of values until a non-(never/void) type is encountered.
 */
export type Coalesce<
	w_0 extends any,
	a_rest extends any[],
> = [CastNonNullVoids<w_0, never>] extends [never]
	? Coalesce<a_rest[0], Tail<a_rest>>
	: CastNonNullVoids<w_0>;

// tests
{
	/* eslint-disable @typescript-eslint/no-unused-vars */
	const A_zro: Coalesce<0, [never]> = 0;
	const A_one: Coalesce<1, [never]> = 1;
	const A_nil: Coalesce<null, [never]> = null;
	const A_nvr: Coalesce<never, [null]> = null;
}


/**
 * === _**@starshell/meta**_ ===
 * 
 * Makes the unknown keys of an interface set to `never`.
 */
type MakeUnknownKeysNever<
	g_input extends object,
> = {
	[z_key in keyof g_input]: string extends z_key
		? never
		: number extends z_key
			? never
			: symbol extends z_key
				? never
				: z_key;
};


/**
 * === _**@starshell/meta**_ ===
 * 
 * Extracts only the known (i.e., explicit) keys of an interface.
 */
type KnownKeys<
	g_input extends object,
> = MakeUnknownKeysNever<g_input> extends {
	[z_key in keyof g_input]: infer w_value
}? w_value: never;


/**
 * === _**@starshell/meta**_ ===
 * 
 * Omits the unknown (i.e., non-explicit) keys of an interface.
 */
export type OmitUnknownKeys<
	g_input extends object,
> = Union.Merge<
	Pick<g_input, KnownKeys<g_input> & keyof g_input>
>;

// tests
{
	type ExampleA = Merge<{
		known: 'a';
		1: 'b';
		[Symbol.iterator]: 'c';
	}, Dict<'z'>>;

	type ExampleB = Merge<{
		known: 'a';
		1: 'b';
		[Symbol.iterator]: 'c';
	}, Dict<'z'>>;

	type ExampleC = Merge<{
		known: 'a';
		1: 'b';
		[Symbol.iterator]: 'c';
	}, Dict<'z'>>;


	type InspectA = OmitUnknownKeys<ExampleA>;
	type InspectB = OmitUnknownKeys<ExampleB>;
	type InspectC = OmitUnknownKeys<ExampleC>;
}


/**
 * Converts an object into a union of objects for each entry
 */
export type Explode<h_object extends object> = {
	[si_each in keyof h_object]: {
		[si_key in si_each]: h_object[si_key];
	}
}[keyof h_object];


export type Values<
	w_thing extends any[] | object | Record<any, any>,
> = w_thing extends Dict<infer w_value>
	? w_value
	: w_thing extends any[]
		? w_thing[number]
		: w_thing[keyof w_thing];



export type SerializeToJson<
	z_input extends any,
> = z_input extends Record<string, any>
	? {
		[w_key in keyof z_input]: Uint8Array extends z_input[w_key]
			? Exclude<z_input[w_key], Uint8Array> | string extends infer w_excluded
				// make optional properties nullable
				? w_excluded extends undefined
					? w_excluded | null
					: w_excluded
				: never
			: SerializeToJson<z_input[w_key]>;
	}
	: z_input extends undefined? number: z_input;


/**
 * Shortcut for a very common type pattern
 */
export type Dict<w_value=string> = Record<string, w_value>;


/**
 * Shortcut for another common type pattern
 */
export type Promisable<w_value=unknown> = w_value | Promise<w_value>;

/**
 * Shortcut for another common type pattern
 */
export type Arrayable<w_value> = w_value | Array<w_value>;

/**
 * Shortcut for another common type pattern
 */
export type Nilable<w_value> = w_value | null | undefined;



/**
 * Root type for all objects considered to be parsed JSON objects
 */
export interface JsonObject<w_inject extends any=never> {  // eslint-disable-line
	[k: string]: JsonValue<w_inject>;
}

/**
 * Union of "valuable", primitive JSON value types
 */
export type JsonPrimitive =
	| boolean
	| number
	| string;

/**
 * All primitive JSON value types
 */
export type JsonPrimitiveNullable<w_inject extends any=never> =
	| JsonPrimitive
	| null
	| w_inject;

/**
 * JSON Array
 */
export type JsonArray<w_inject extends any=never> = JsonValue<w_inject>[];

/**
 * All JSON value types
 */
export type JsonValue<w_inject extends any=never> =
	| JsonPrimitiveNullable<w_inject>
	| JsonArray<w_inject>
	| JsonObject<w_inject>
	| Arrayable<undefined>;

/**
 * Removes JSON interfaces from a type
 */
export type RemoveJsonInterfaces<w_type> = Exclude<A.Compute<Exclude<Extract<w_type, object>, JsonArray>>, JsonObject>;

type DerivedJsonPrimitiveNullable = Arrayable<JsonPrimitiveNullable> | Arrayable<undefined>;

/**
 * Reinterprets the given type as being JSON-compatible
 */
export type AsJson<
	z_test extends JsonValue | {} | {}[],
> = z_test extends JsonValue? z_test
	: z_test extends Array<infer w_type>
		? AsJson<w_type>[]
		: {
			[si_each in keyof z_test]: AsJson<z_test[si_each]>;
		};
