import type {Dict, JsonObject, PlainObject} from '#/meta/belt';

/**
 * The frequently-used "no-operation" function
 */
export const F_NOOP = () => {};  // eslint-disable-line


/**
 * The seldomnly-used "identity" function
 */
export const F_IDENTITY =(w: any) => w;  // eslint-disable-line


/**
 * Creates a proper-case string
 */
export const proper = (s_input: string): string => s_input.split(/[\s_]+/g).map(s => s[0].toUpperCase()+s.slice(1)).join(' ');


/**
 * Compares two objects using keys and strict equality.
 */
export function objects_might_differ(h_a: PlainObject, h_b: PlainObject): boolean {
	const a_keys_a = Object.keys(h_a);
	const a_keys_b = Object.keys(h_b);

	const nl_keys = a_keys_a.length;

	if(nl_keys !== a_keys_b.length) return true;

	for(const si_key in h_a) {
		if(h_b[si_key] !== h_a[si_key]) return true;
	}

	return false;
}


/**
 * Simple test for whether a deserialized JSON value is a plain object (dict) or not
 */
export const is_dict = (z: unknown): z is JsonObject => z? 'object' === typeof z && !Array.isArray(z): false;

/**
 * More advanced test for whether an ES object is a plain object (dict) or not
 */
export const is_dict_es = (z: unknown): z is JsonObject => z? 'object' === typeof z && Object === z.constructor: false;


/**
 * Fold array into an object
 */
export function fold<w_out, w_value>(a_in: w_value[], f_fold: (z_value: w_value, i_each: number) => Dict<w_out>): Dict<w_out> {
	const h_out = {};
	let i_each = 0;
	for(const z_each of a_in) {
		Object.assign(h_out, f_fold(z_each, i_each++));
	}

	return h_out;
}


/**
 * Creates a new array by inserting an item in between every existing item
 */
export function interjoin<
	w_item extends any,
	w_insert extends any,
>(a_input: w_item[], w_insert: w_insert): Array<w_item | w_insert> {
	const a_output: Array<w_item | w_insert> = [];

	for(let i_each=0, nl_items=a_input.length; i_each<nl_items-1; i_each++) {
		a_output.push(a_input[i_each]);
		a_output.push(w_insert);
	}

	if(a_input.length) a_output.push(a_input.at(-1)!);

	return a_output;
}

/**
 * Removes duplicates from an array, keeping only the first occurrence.
 * @param z_identify - if specified and a string, identifies the key of each item to use as an identifier
 * if specified and a function, used as a callback to produce the comparison key
 * if omitted, compares items using full equality `===`
 */
export function deduplicate<
	z_item extends any,
	s_key extends keyof z_item=keyof z_item,
>(a_items: z_item[], z_identify?: s_key | ((z_item: z_item) => any)): typeof a_items {
	// compare items exactly by default
	let a_keys: any[] = a_items;

	// identify argument
	if(z_identify) {
		// use object property
		if('string' === typeof z_identify) {
			a_keys = a_items.map(w => w[z_identify]);
		}
		// use identity function
		else if('function' === typeof z_identify) {
			a_keys = a_items.map(z_identify);
		}
		else {
			throw new TypeError(`Invalid identifier argument value: ${String(z_identify)}`);
		}
	}

	// each item in list
	for(let i_item=0, nl_items=a_items.length; i_item<nl_items; i_item++) {
		const si_item = a_keys[i_item];

		// compare against all higher-indexed items
		for(let i_test=i_item+1; i_test<nl_items; i_test++) {
			// found duplicate
			if(si_item === a_keys[i_test]) {
				// remove duplicate
				a_items.splice(i_test, 1);
				a_keys.splice(i_test, 1);

				// update length
				nl_items -= 1;

				// update test index
				i_test -= 1;

				// repeat
				continue;
			}
		}
	}

	return a_items;
}

/**
 * Escape all special regex characters to turn a string into a verbatim match pattern
 * @param s_input input string
 * @returns escaped string ready for RegExp constructor
 */
export const escape_regex = (s_input: string): string => s_input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');


/**
 * Typed alias to `Object.entries`
 */
export function ode<
	h_object extends Record<string, any>,
	as_keys extends Extract<keyof h_object, string>=Extract<keyof h_object, string>,
>(h_object: h_object): Array<[as_keys, h_object[as_keys]]> {
	return Object.entries(h_object) as Array<[as_keys, h_object[as_keys]]>;
}

	// (o: {
	// 	[si_key in as_keys]: w_value;
	// }): {
	// 	[si_key in as_keys]: {
	// 		key: si_key;
	// 		value: w_value;
	// 	};
	// }[as_keys] extends infer as_pairs
	// 	? as_pairs extends {key: as_keys; value: w_value}
	// 		? Union.ListOf<as_pairs>
	// 		: never
	// 	: never;
// };


/**
 * Typed alias to `Object.fromEntries`
 */
export function ofe<
	as_keys extends string=string,
	w_values extends any=any,
>(a_entries: Array<[as_keys, w_values]>): Record<as_keys, w_values> {
	return Object.fromEntries(a_entries) as Record<as_keys, w_values>;
}


/**
 * Helper type for defining the expected type for `[].reduce` alias
 */
type ReduceParameters<
	w_value extends any=any,
> = Parameters<Array<w_value>['reduce']>;


/**
 * Reduce object entries to an arbitrary type
 */
export function oder<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_reduce: ReduceParameters[0], w_init: w_out): w_out {
	return ode(h_thing).reduce(f_reduce, w_init) as w_out;
}


/**
 * Reduce object entries to an array via concatenation
 */
export function oderac<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_concat: (si_key: string, w_value: w_value, i_entry: number) => w_out, b_add_undefs=false): w_out[] {
	return ode(h_thing).reduce<w_out[]>((a_out, [si_key, w_value], i_entry) => {
		const w_add = f_concat(si_key, w_value, i_entry);
		if('undefined' !== typeof w_add || b_add_undefs) {
			a_out.push(w_add);
		}

		return a_out;
	}, []);
}


/**
 * Reduce object entries to an array via flattening
 */
export function oderaf<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_concat: (si_key: string, w_value: w_value, i_entry: number) => w_out[]): w_out[] {
	return ode(h_thing).reduce((a_out, [si_key, w_value], i_entry) => [
		...a_out,
		...f_concat(si_key, w_value, i_entry),
	], []);
}


/**
 * Reduce object entries to an object via merging
 */
export function oderom<
	w_out extends any,
	h_thing extends Record<string | symbol, any>,
	as_keys_in extends keyof h_thing,
	w_value_in extends h_thing[as_keys_in],
	as_keys_out extends string | symbol,
>(h_thing: h_thing, f_merge: (si_key: as_keys_in, w_value: w_value_in) => Record<as_keys_out, w_out>): Record<as_keys_out, w_out> {
	return ode(h_thing).reduce((h_out, [si_key, w_value]) => ({
		...h_out,
		...f_merge(si_key as string as as_keys_in, w_value),
	}), {}) as Record<as_keys_out, w_out>;
}


/**
 * Reduce object entries to an object via transforming value function
 */
export function fodemtv<
	w_out extends any,
	w_value extends any,
>(h_thing: Dict<w_value>, f_transform: (w_value: w_value, si_key?: string) => w_out): {
	[si_key in keyof typeof h_thing]: w_out;
} {
	return Object.fromEntries(
		ode(h_thing).map(([si_key, w_value]) => [si_key, f_transform(w_value, si_key)])
	);
}


/**
 * Promise-based version of `setTimeout()`
 */
export function timeout(xt_wait: number): Promise<void> {
	return new Promise((fk_resolve) => {
		setTimeout(() => {
			fk_resolve();
		}, xt_wait);
	});
}


export function timeout_exec<
	w_return extends any=any,
>(xt_wait: number, f_attempt?: () => Promise<w_return>): Promise<[w_return | undefined, 0 | 1]> {
	return new Promise((fk_resolve, fe_reject) => {
		// infinite
		if(!Number.isFinite(xt_wait)) {
			void f_attempt?.().then(w => fk_resolve([w, 0]));
			return;
		}

		let b_timed_out = false;

		// attempt callback
		f_attempt?.()
			.then((w_return: w_return) => {
				// already timed out
				if(b_timed_out) return;

				// cancel pending timer
				clearTimeout(i_pending);

				// resolve promise
				fk_resolve([w_return, 0]);
			})
			.catch((e_attempt) => {
				fe_reject(e_attempt);
			});

		// start waiting
		const i_pending = setTimeout(() => {
			// mark as timed out
			b_timed_out = true;

			// resolve promise
			fk_resolve([void 0, 1]);
		}, xt_wait);
	});
}


export interface WithTimeoutConfig<w_value extends any> {
	duration: number;
	trip: VoidFunction;
	run: () => Promise<w_value>;
}

export function with_timeout<w_value extends any>(g_with: WithTimeoutConfig<w_value>): Promise<w_value> {
	// go async
	return new Promise((fk_resolve, fe_reject) => {
		// state of completion
		let b_complete = false;

		// timer
		setTimeout(() => {
			// already completed
			if(b_complete) return;

			// now complete
			b_complete = true;

			// reject
			fe_reject(g_with.trip());
		}, g_with.duration);

		// run task
		g_with.run().then((w_value: w_value) => {
			// already failed
			if(b_complete) return;

			// now complete
			b_complete = true;

			// resolve
			fk_resolve(w_value);
		}).catch(fe_reject);
	});
}


/**
 * A Promise that never fulfills nor rejects
 */
export function forever<w_type=void>(w_type?: w_type): Promise<w_type> {  // eslint-disable-line @typescript-eslint/no-invalid-void-type
	return new Promise(F_NOOP);
}


/**
 * Promse-based version of `queueMicrotask()`
 */
export function microtask(): Promise<void> {
	return new Promise((fk_resolve) => {
		queueMicrotask(() => {
			fk_resolve();
		});
	});
}


export function defer<w_return extends any=any>(): [Promise<w_return>, (w_return: w_return | null, e_reject?: Error) => void] {
	let fk_resolve: (w_return: w_return) => void;
	let fe_reject: (e_reject: Error) => void;

	const dp_promise = new Promise<w_return>((fk, fe) => {
		fk_resolve = fk;
		fe_reject = fe;
	});

	return [dp_promise, (w_return: w_return, e_reject?: Error) => {
		if(e_reject) {
			fe_reject(e_reject);
		}
		else {
			fk_resolve(w_return);
		}
	}];
}

export function defer_many<
	h_input extends Dict<unknown>,
>(h_input: h_input): {
	promises: {
		[si_each in keyof typeof h_input]: Promise<typeof h_input[si_each]>;
	};
	resolve(h_resolves: {
		[si_each in keyof typeof h_input]?: typeof h_input[si_each];
	}): void;
	reject(h_rejects: {
		[si_each in keyof typeof h_input]?: Error;
	}): void;
} {
	const h_mapped = fodemtv(h_input, () => defer());

	return {
		promises: fodemtv(h_mapped, a_defer => a_defer[0]) as {
			[si_each in keyof typeof h_input]: Promise<typeof h_input[si_each]>;
		},
		resolve(h_resolves) {
			for(const si_key in h_resolves) {
				h_mapped[si_key]?.[1](h_resolves[si_key]);
			}
		},
		reject(h_rejects) {
			for(const si_key in h_rejects) {
				h_mapped[si_key]?.[1](void 0, h_rejects[si_key]);
			}
		},
	};
}


/**
 * Cryptographically strong random number
 */
export const crypto_random = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / (2**32);


/**
 * Generate a random int within a given range
 */
export function random_int(x_a: number, x_b=0): number {
	const x_min = Math.floor(Math.min(x_a, x_b));
	const x_max = Math.ceil(Math.max(x_a, x_b));

	// confine to range
	return Math.floor(Math.random() * (x_max - x_min)) + x_min;
}


/**
 * Generate a cryptographically strong random int within a given range
 */
export function crypto_random_int(x_a: number, x_b=0): number {
	const x_min = Math.floor(Math.min(x_a, x_b));
	const x_max = Math.ceil(Math.max(x_a, x_b));

	// confine to range
	return Math.floor(crypto_random() * (x_max - x_min)) + x_min;
}

type TypedArray =
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array;

/**
 * Shuffles an array
 */
export function shuffle<
	w_list extends Array<any> | TypedArray,
>(a_items: w_list, f_random=random_int): w_list {
	let i_item = a_items.length;

	while(i_item > 0) {
		const i_swap = f_random(--i_item);
		const w_item = a_items[i_item];
		a_items[i_item] = a_items[i_swap];
		a_items[i_swap] = w_item;
	}

	return a_items;
}

/**
 * Removes the first occurrence of the given item from the array
 * @param a_items 
 * @param w_item 
 * @returns 
 */
export function remove<w_item>(a_items: w_item[], w_item: w_item): w_item[] {
	const i_item = a_items.indexOf(w_item);
	if(i_item >= 0) a_items.splice(i_item, 1);
	return a_items;
}
