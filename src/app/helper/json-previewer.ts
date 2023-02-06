import type {Arrayable} from 'vitest';

import type {Dict, JsonValue, Promisable} from '#/meta/belt';
import type {ChainStruct, ContractStruct} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';

import BigNumber from 'bignumber.js';

import {RT_UINT, RT_URI_LIKELY, R_BECH32} from '#/share/constants';
import {Chains} from '#/store/chains';
import {is_dict_es} from '#/util/belt';
import {base64_to_text, uuid_v4} from '#/util/data';
import {dd} from '#/util/dom';
import {format_amount} from '#/util/format';

export interface PreviewerConfig {
	chain?: ChainStruct;
	formats?: Dict<FormatConfig>;
}

export interface FormatConfig {
	expect: 'uint';
	unit: string;
	decimals: number;
	classes?: string;
}

export function classify(z_value: Arrayable<string | Element>, s_class=''): HTMLSpanElement {
	return dd('span', {
		class: s_class,
	}, Array.isArray(z_value)? z_value: [z_value]);
}

function render_string(s_value: string): HTMLSpanElement {
	return classify(JSON.stringify(s_value).replace(/^"|"$/g, ''), 'json-string');
}

const A_SNIP_MESSAGES_AMOUNTS = [
	'transfer',
	'send',
	'increase_allowance',
	'decrease_allowance',
	'transfer_from',
	'send_from',
	'mint',
	'burn',
	'burn_from',
	'redeem',
];

const A_SNIP_BATCH_MESSAGES_AMOUNTS = [
	'batch_transfer',
	'batch_send',
	'batch_transfer_from',
	'batch_send_from',
	'batch_mint',
	'batch_burn_from',
];


export function snip_json_formats(g_contract: undefined|null|ContractStruct, si_action: string): Dict<FormatConfig> {
	// special formatting
	const h_formats: Dict<FormatConfig> = {};
	const g_snip20 = g_contract?.interfaces.snip20;
	if(g_snip20) {
		const g_format_token = {
			expect: 'uint',
			unit: g_snip20.symbol,
			decimals: g_snip20.decimals,
			classes: 'token-amount',
		} as const;

		if(A_SNIP_MESSAGES_AMOUNTS.includes(si_action)) {
			h_formats['amount'] = g_format_token;
		}
		else if(A_SNIP_BATCH_MESSAGES_AMOUNTS.includes(si_action)) {
			h_formats['actions.*.amount'] = g_format_token;
		}
	}

	return h_formats;
}

export type RenderValue = JsonValue<Promise<JsonValue> | (() => Promisable<JsonValue>)>;

let xt_global_delay = 0;

function decode_and_expand(z_value) {
	if(is_dict_es(z_value)) {
		const h_expanded = {};

		for(const si_key in z_value) {
			h_expanded[si_key] = decode_and_expand(z_value[si_key]);
		}

		return h_expanded;
	}
	else if(Array.isArray(z_value)) {
		return z_value.map(decode_and_expand);
	}
	else if('string' === typeof z_value) {
		// numeric, skip
		if(/^-?[\d.]+$/.test(z_value)) return z_value;

		// base-64 encoded json; unwrap
		try {
			return decode_and_expand(JSON.parse(base64_to_text(z_value)));
		}
		catch(e_decode) {}

		// JSON-parseable string; unwrap
		try {
			return decode_and_expand(JSON.parse(z_value) as JsonValue);
		}
		catch(e_decode) {}
	}

	return z_value;
}

export class JsonPreviewer {
	static render(
		z_value: JsonValue<Promise<JsonValue>>,
		gc_previewer: PreviewerConfig={},
		gc_field?: Dict<JsonValue>
	): FieldConfig<'dom'> {
		const k_previewer = new JsonPreviewer(gc_previewer || {});

		const z_expanded = decode_and_expand(z_value);

		return {
			type: 'dom',
			dom: k_previewer.render(z_expanded),
			...gc_field,
		} as const;
	}

	constructor(protected _gc_previewer: PreviewerConfig) {}

	render(z_value: RenderValue, a_terms: boolean[]=[], a_path: Array<string|number>=[]): HTMLElement {
		const {
			formats: h_formats={},
		} = this._gc_previewer;

		const n_depth = a_terms.length;

		if(is_dict_es(z_value)) {
			if(!Object.keys(z_value).length) {
				return dd('span', {
					class: 'json-empty-object',
				}, [
					dd('span', {}, ['{ }']),
				]);
			}

			const a_entries_dst: HTMLSpanElement[] = [];

			// begin by sorting the fields based on types
			const a_entries_src = Object.entries(z_value).sort(([si_key_a, z_item_a], [si_key_b, z_item_b]) => {
				const n_sort = si_key_a.localeCompare(si_key_b);

				// string order: bech32, url, other, uint
				if('string' === typeof z_item_a) {
					if('string' === typeof z_item_b) {
						if(RT_UINT.test(z_item_a)) {
							return RT_UINT.test(z_item_b)? n_sort: 1;
						}
						else if(R_BECH32.test(z_item_a)) {
							return R_BECH32.test(z_item_b)? n_sort: -1;
						}
						else if(RT_UINT.test(z_item_b)) {
							return -1;
						}
						else if(R_BECH32.test(z_item_b)) {
							return 1;
						}
						else if(RT_URI_LIKELY.test(z_item_a)) {
							return RT_URI_LIKELY.test(z_item_b)? n_sort: -1;
						}
						else if(RT_URI_LIKELY.test(z_item_b)) {
							return 1;
						}

						return n_sort;
					}

					return -1;
				}

				if('string' === typeof z_item_b) {
					return 1;
				}
				else if('number' === typeof z_item_a) {
					return 'number' === typeof z_item_b? n_sort: -1;
				}

				if('number' === typeof z_item_b) {
					return 1;
				}
				else if('boolean' === typeof z_item_a) {
					return 'boolean' === typeof z_item_b? n_sort: -1;
				}

				if('boolean' === typeof z_item_b) {
					return 1;
				}
				else if(null === z_item_a) {
					return null === z_item_b? n_sort: -1;
				}

				if(null === z_item_b) {
					return 1;
				}
				else if(is_dict_es(z_item_a)) {
					if(!Object.keys(z_item_a).length) return -1;

					if(is_dict_es(z_item_b)) {
						if(!Object.keys(z_item_b).length) return 1;

						return n_sort;
					}
					else if(Array.isArray(z_item_b)) {
						return z_item_b.length? -1: 1;
					}
				}

				if(is_dict_es(z_item_b)) {
					if(!Object.keys(z_item_b).length && Array.isArray(z_item_a) && !z_item_a.length) return -1;

					return 1;
				}
				else if(Array.isArray(z_item_a)) {
					return Array.isArray(z_item_b)? n_sort: -1;
				}

				if(Array.isArray(z_item_b)) {
					return 1;
				}

				return n_sort;
			});

			for(let i_key=0, nl_keys=a_entries_src.length; i_key<nl_keys; i_key++) {
				const [si_key, z_item] = a_entries_src[i_key];
				const b_terminal = i_key === nl_keys - 1;

				let a_spaces: never[] | [HTMLElement] = [];

				if(a_terms.length) {
					const a_drawings = a_terms.slice(1).map(b => dd('span', {
						class: 'drawing-block',
					}, [
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b? '0': '1',
						}, []),
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b? '0': '1',
						}, []),
					]));

					a_drawings.push(dd('span', {
						class: 'drawing-block',
					}, [
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': '1',
							'data-draw-bottom': '1',
						}, []),
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b_terminal? '0': '1',
						}, []),
					]));

					a_spaces = [dd('span', {
						class: 'drawing-space',
					}, a_drawings)];
				}

				const b_nester = is_dict_es(z_item) && Object.keys(z_item).length;

				a_entries_dst.push(dd('div', {
					class: `json-entry ${b_nester? 'nester': ''}`,
				}, [
					// key column
					dd('span', {
						class: 'json-key',
					}, [
						...a_spaces,

						dd('span', {
							class: 'text',
						}, [si_key]),
					]),

					// tree-break
					...b_nester? [
						dd('span', {
							class: 'tree-break',
						}),
					]: [],

					// next row
					this.render(z_item, [...a_terms, b_terminal], [...a_path, si_key]),
				]));
			}

			const dm_grid = dd('div', {
				'class': `json-object ${n_depth? 'nested': ''}`,
				'data-json-depth': n_depth,
			}, a_entries_dst);

			return dm_grid;
		}
		else if(Array.isArray(z_value)) {
			const a_items: HTMLElement[] = [];

			for(let i_item=0; i_item<z_value.length; i_item++) {
				a_items.push(dd('li', {}, [
					this.render(z_value[i_item], [...a_terms, false], [...a_path, i_item]),
				]));
			}

			if(!z_value.length) {
				a_items.push(dd('span', {
					class: 'json-empty-array',
				}, [
					dd('span', {}, ['[ ]']),
				]));
			}

			const dm_list = dd('ul', {
				'class': `json-array ${n_depth? 'nested': ''}`,
				'data-json-depth': n_depth,
			}, a_items);

			return dm_list;
		}
		else if('string' === typeof z_value) {
			// check formats
			const g_format = h_formats?.[a_path.join('.')]
				|| h_formats?.[a_path.map(z => 'number' === typeof z? '*': z).join('.')];

			// unsigned integer
			if(RT_UINT.test(z_value)) {
				if('uint' === g_format?.expect) {
					const s_amount = format_amount(BigNumber(z_value).shiftedBy(-g_format.decimals).toNumber());
					return classify(
						classify(s_amount+' '+g_format.unit),
						`formatted ${g_format.classes || ''}`
					);
				}

				return classify(BigInt(z_value).toLocaleString(), 'uint');
			}

			// bech32
			const m_bech32 = R_BECH32.exec(z_value);
			if(m_bech32) {
				return dd('span', {
					'class': 'dynamic-inline-bech32',
					'data-bech32': z_value,
					'data-chain-path': this._gc_previewer.chain? Chains.pathFrom(this._gc_previewer.chain): '',
				}, [
					render_string(z_value),
				]);
			}
			// uri
			else if(RT_URI_LIKELY.test(z_value)) {
				if(z_value.startsWith('https://')) {
					return dd('a', {
						class: 'link',
						href: z_value,
					}, [
						z_value,
					]);
				}

				return classify(z_value, 'url');
			}
			// empty string
			else if('' === z_value) {
				return classify('empty string', 'empty-string');
			}
			// any other string
			else {
				return render_string(z_value);
			}
		}
		else if('number' === typeof z_value) {
			return classify(z_value+'', 'json-number');
		}
		else if('boolean' === typeof z_value) {
			return classify(z_value+'', 'json-boolean');
		}
		else if(null === z_value) {
			return classify(z_value+'', 'json-null');
		}
		// deferred value
		else if('function' === typeof z_value || z_value instanceof Promise) {
			const si_span = uuid_v4();

			const dm_span = dd('span', {
				id: si_span,
				class: 'dynamic-deferred-content',
				style: `
					animation-delay: ${(xt_global_delay += 150) - 150}ms;
				`,
			});

			// clean up after itself
			if(0 === xt_global_delay) {
				setTimeout(() => {
					xt_global_delay = 0;
				}, 150);
			}

			(async() => {
				const g_value = await ('function' === typeof z_value? z_value(): z_value);
				const dm_replace = this.render(g_value, a_terms, a_path);

				document.getElementById(si_span)?.replaceWith(dm_replace);
			})();

			return dm_span;
		}
		// invalid json
		else {
			return classify(z_value+'', 'invalid');
		}
	}
}
