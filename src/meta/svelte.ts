import type {Dict} from '#/meta/belt';

export type ParametricSvelteConstructor<
	h_params extends Dict<any>=Dict<unknown>,
	h_events extends Dict<any>=Dict<unknown>,
	h_slots extends Dict<any>=Dict<unknown>,
> = SvelteComponentConstructor<
	Svelte2TsxComponent<h_params, h_events, h_slots>,
	Svelte2TsxComponentConstructorParameters<h_params>
>;

export namespace ParametricSvelteConstructor {
	export type Parts<
		dc_component extends ParametricSvelteConstructor,
	> = dc_component extends ParametricSvelteConstructor<infer h_params, infer h_events, infer h_slots>
		? {
			params: h_params;
			events: h_events;
			slots: h_slots;
		}
		: never;
}
