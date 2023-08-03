import type { A, L, S } from 'ts-toolbelt';

type Capitals = S.Split<'ABCDEFGHIJKLMNOPQRSTUVWXYZ'>;

type CapitalToSnake<s_char extends string> = L.Includes<Capitals, s_char> extends 1? `_${Lowercase<s_char>}`: s_char;

type RemapCharArray<a_chars extends string[]> = A.Cast<{
	[i_char in keyof a_chars]: CapitalToSnake<a_chars[i_char]>;
}, string[]>;

export type SnakeCaseStr<s_in extends string> = S.Join<RemapCharArray<S.Split<s_in>>>;

export type SnakeCaseKeys<h_obj extends object> = {
	[s_key in keyof h_obj as s_key extends string? SnakeCaseStr<s_key>: s_key]: SnakeCaseDeep<h_obj[s_key]>;
};

export type SnakeCaseDeep<w_item> = w_item extends Record<string, any>
	? w_item extends any[]
		? w_item
		: A.Compute<SnakeCaseKeys<w_item>>
	: w_item;

// type show = SnakeCaseDeep<{
// 	testCamel: {
// 		toSnake: true;
// 	};
// }>;

