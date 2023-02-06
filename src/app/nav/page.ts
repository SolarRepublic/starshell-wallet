import type {JumpConfig, PopConfig, Thread} from './thread';

import type {Dict, PlainObject, Promisable} from '#/meta/belt';
import type {ParametricSvelteConstructor} from '#/meta/svelte';

import {objects_might_differ, ode} from '#/util/belt';
import {uuid_v4} from '#/util/data';
import {dd} from '#/util/dom';


export interface PageConfig<
	h_props extends Dict<unknown>=Dict<unknown>,
	dc_creator extends ParametricSvelteConstructor<h_props>=ParametricSvelteConstructor<h_props>,
> {
	creator: dc_creator;
	props?: h_props;
	context?: PlainObject;
	events?: Dict<(d_event: CustomEvent<unknown>) => Promisable>;
	path?: string;
	pattern?: string;
}

export interface PageEventConfig {
	/**
	 * Fired anytime a page loses focus (including on thread switch)
	 */
	blur?(): Promisable;

	/**
	 * Fired anytime a page receives focus (including on thread switch)
	 */
	focus?(): Promisable;

	/**
	 * Fired when a previously existing page is restored from history (e.g., via pop)
	 */
	restore?(): Promisable;

	/**
	 * Fired when the system has handled a key binding or gesture to initiate a search
	 * @param fk_captured - callback to execute if the search initiation was effective
	 */
	search?(fk_captured?: () => void): Promisable;
}

type PageEventId = keyof PageEventConfig;

export class Page<
	h_props extends Dict<unknown>=Dict<unknown>,
	dc_creator extends ParametricSvelteConstructor<h_props>=ParametricSvelteConstructor<h_props>,
	yc_component extends InstanceType<dc_creator>=InstanceType<dc_creator>,
> {
	protected _dc_creator: dc_creator;
	protected _yc_component: yc_component;
	protected _h_props: h_props;
	protected _h_context: PlainObject;
	protected _dm_page: HTMLElement;

	protected _si_page: string;
	protected _h_events: Partial<Record<PageEventId, Array<(...a_args: any[]) => Promisable>>> = {};

	protected _sr_path: string;
	protected _sx_pattern: string;

	constructor(gc_page: PageConfig<h_props, dc_creator>, protected _kt_parent: Thread) {
		({
			creator: this._dc_creator,
			props: this._h_props={} as h_props,
			context: this._h_context={} as PlainObject,
			// path: this._sr_path='',
			// pattern: this._sx_pattern='',
		} = gc_page as Required<typeof gc_page>);

		// set unique page id
		this._si_page = uuid_v4();

		// create buffer element
		const dm_buffer = dd('div');

		const hm_context = new Map(ode({
			...this._h_context,
			page: this,
		}));

		// spawn component
		this._yc_component = new this._dc_creator({
			target: dm_buffer,
			props: this._h_props,
			context: hm_context,
		}) as yc_component;

		// bind events
		if(gc_page.events) {
			for(const [si_event, f_listener] of ode(gc_page.events)) {
				this._yc_component.$on(si_event, f_listener);
			}
		}

		// fetch dom
		const dm_state = dm_buffer.firstElementChild as null | HTMLElement;
		if(!dm_state) {
			throw new Error(`No DOM element was created during page component spawning using: ${JSON.stringify(gc_page)}`);
		}

		// set field
		this._dm_page = dm_state;
	}

	get id(): string {
		return this._si_page;
	}

	get index(): number {
		return this.thread.history.length;
	}

	get thread(): Thread {
		return this._kt_parent;
	}

	set thread(kt_parent: Thread) {
		this._kt_parent = kt_parent;
	}

	get creator(): dc_creator {
		return this._dc_creator;
	}

	get component(): yc_component {
		return this._yc_component;
	}

	get props(): h_props {
		return this._h_props;
	}

	get dom(): HTMLElement {
		return this._dm_page;
	}

	equivalent(w_other: Page | PageConfig): boolean {
		return w_other.creator === this.creator
			&& !objects_might_differ(w_other.props || {}, this.props);
	}

	peak(): Page | undefined {
		return this._kt_parent.peak();
	}

	push(gc_page: PageConfig): Page {
		return this._kt_parent.push(gc_page, this);
	}

	pop(gc_pop?: PopConfig): Page {
		return this._kt_parent.pop(gc_pop || {}, this);
	}

	jump(gc_page: PageConfig, gc_jump?: JumpConfig): Page {
		return this._kt_parent.jump(gc_page, gc_jump || {}, this);
	}

	on(h_events: PageEventConfig): void {
		for(const [si_event, f_listener] of ode(h_events)) {
			if(f_listener) {
				const a_listeners = this._h_events[si_event] = this._h_events[si_event] || [];
				a_listeners.push(f_listener);
			}
		}
	}

	async fire(si_event: PageEventId, ...a_args: any[]): Promise<void> {
		const a_listeners = this._h_events[si_event];

		if(a_listeners) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			await Promise.all(a_listeners.map(f => f(...a_args || [] as const)));
		}
	}

	destroy(): void {
		this._yc_component.$destroy();
	}

	reset(): void {
		this._kt_parent.reset();
	}
}
