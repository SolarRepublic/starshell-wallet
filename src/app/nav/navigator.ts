import type {PageConfig} from './page';
import type {JumpConfig, PopConfig, ResetConfig} from './thread';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {
	Dict,
	PlainObject,
	Promisable,
} from '#/meta/belt';

import {Page} from './page';
import {Thread} from './thread';
import {ThreadId} from '../def';


import {objects_might_differ} from '#/util/belt';
import {dd} from '#/util/dom';



interface Hooks {
	before_change?(kt_context: Thread, kp_src: Page, s_transition: string, h_extra?: Dict): void | boolean;

	before_push?(kt_context: Thread, kp_src: Page, gc_dst: PageConfig): void | boolean;
	before_pop?(kt_context: Thread, kp_src: Page, kp_dst: Page, gc_pop: PopConfig): void | boolean;
	before_jump?(kt_context: Thread, kp_src: Page, gc_page: PageConfig, gc_jump: JumpConfig): void | boolean;

	after_change?(kt_context: Thread, kp_src: Page | null, kp_dst: Page, s_transition: string, h_extra?: Dict): Promisable<void>;

	after_push?(kt_context: Thread, kp_src: Page, kp_dst: Page): Promisable<void | Dict>;
	after_pop?(kt_context: Thread, kp_src: Page, kp_dst: Page, gc_pop: PopConfig): Promisable<void | Dict>;
	after_jump?(kt_context: Thread, kp_src: Page, kp_dst: Page, gc_jump: JumpConfig): Promisable<void | Dict>;
	after_reset?(kt_context: Thread, kp_dst: Page, gc_jump: ResetConfig): Promisable<void | Dict>;

	before_switch?(kt_src: Thread, si_thread_dst: ThreadId): Promisable<void>;
	after_switch?(kt_src: Thread, kt_dst: Thread): Promisable<void>;
}


type ThreadSpawner = (h_params: PlainObject, h_context?: PlainObject) => PageConfig;

type ThreadsConfig = Merge<{
	default: ThreadSpawner;
}, Partial<Record<ThreadId, ThreadSpawner>>>;

export interface NavigatorConfig {
	container: HTMLElement;
	hooks: Hooks;
	threads: ThreadsConfig;

	context: PlainObject | never;
}


export function set_zindex_relatively(dm_src: HTMLElement, dm_dst: HTMLElement, n_order: number): void {
	const iz_src = +dm_src.style.zIndex;
	const iz_dst = iz_src + n_order;
	dm_src.style.zIndex = iz_src+'';
	dm_dst.style.zIndex = iz_dst+'';
}

export class Navigator {
	protected _h_threads: Partial<Record<ThreadId, Thread>> = {};
	protected _h_thread_spawners: ThreadsConfig;
	protected _dm_threads: HTMLElement;

	// buffer element
	protected _dm_buffer = dd('div');

	// hooks
	protected _g_hooks: Hooks;

	// contexts
	protected _h_context: PlainObject;

	// currently active thread id
	protected _si_thread: ThreadId = ThreadId.DEFAULT;

	// running z-index counter for new threads
	protected _c_thread_z = 200;


	constructor(protected _gc_navigator: NavigatorConfig) {
		// thread container dom
		({
			container: this._dm_threads,
			threads: this._h_thread_spawners,
			hooks: this._g_hooks,
			context: this._h_context={},
		} = _gc_navigator);

		// create default thread
		this._new_thread(ThreadId.DEFAULT, {}, this._h_context);
	}

	get context(): PlainObject {
		return this._h_context;
	}

	private _new_thread(si_thread: ThreadId, h_props: Dict<unknown>={}, h_context: PlainObject={}): Thread {
		// no such thread spawner
		const f_spawner = this._h_thread_spawners[si_thread];
		if(!f_spawner) {
			throw new Error(`Navigator has no such thread registered: '${si_thread}'`);
		}

		// create new thread
		const kt_new = new Thread(si_thread, f_spawner(h_props, h_context), this);

		// save to threads
		this._h_threads[si_thread] = kt_new;

		// append thread to container
		this._dm_threads.appendChild(kt_new.dom);

		// create new default page and merge props
		kt_new.reset({
			...kt_new.default,
			props: {
				...kt_new.default.props,
				...h_props,
			},
		});

		// return new thread
		return kt_new;
	}

	/**
	 * Gets the currently active thread.
	 */
	get activeThread(): Thread {
		return this._h_threads[this._si_thread]!;
	}

	/**
	 * Gets the currently active page.
	 */
	get activePage(): Page {
		return this.activeThread.page;
	}

	before_push(gc_page: PageConfig, kp_src: Page, kt_child: Thread): boolean {
		// not active thread; deny
		if(this.activeThread !== kt_child) return false;

		// call prepush hooks
		if(false === this._g_hooks.before_change?.(kt_child, kp_src, 'push')) return false;
		if(false === this._g_hooks.before_push?.(kt_child, kp_src, gc_page)) return false;

		// approved
		return true;
	}


	before_pop(gc_pop: PopConfig, kp_dst: Page, kp_src: Page, kt_child: Thread): boolean {
		// not active thread; deny
		if(this.activeThread !== kt_child) return false;

		// call prepush hooks
		if(false === this._g_hooks.before_change?.(kt_child, kp_src, 'pop')) return false;
		if(false === this._g_hooks.before_pop?.(kt_child, kp_src, kp_dst, gc_pop)) return false;

		// approved
		return true;
	}

	before_jump(gc_jump: JumpConfig, gc_page: PageConfig, kp_src: Page, kt_child: Thread): boolean {
		// not active thread; deny
		if(this.activeThread !== kt_child) return false;

		// call prejump hooks
		if(false === this._g_hooks.before_change?.(kt_child, kp_src, 'jump')) return false;
		if(false === this._g_hooks.before_jump?.(kt_child, kp_src, gc_page, gc_jump)) return false;

		// approved
		return true;
	}

	async before_switch(kt_src: Thread, si_thread: ThreadId): Promise<void> {
		if(false === this._g_hooks.before_change?.(kt_src, kt_src.page, 'switch')) throw new Error('Cannot stop thread switch');

		await this._g_hooks.before_switch?.(kt_src, si_thread);
	}

	async after_push(kt_child: Thread, kp_src: Page, kp_dst: Page): Promise<void> {
		const h_extra = await this._g_hooks.after_push?.(kt_child, kp_src, kp_dst);

		await this._g_hooks.after_change?.(kt_child, kp_src, kp_dst, 'push', h_extra || {});
	}

	async after_pop(kt_child: Thread, kp_src: Page, kp_dst: Page, gc_pop: PopConfig): Promise<void> {
		const h_extra = await this._g_hooks.after_pop?.(kt_child, kp_src, kp_dst, gc_pop);

		await this._g_hooks.after_change?.(kt_child, kp_src, kp_dst, 'pop', h_extra || {});
	}

	async after_jump(kt_child: Thread, kp_src: Page, kp_dst: Page, gc_jump: JumpConfig): Promise<void> {
		const h_extra = await this._g_hooks.after_jump?.(kt_child, kp_src, kp_dst, gc_jump);

		await this._g_hooks.after_change?.(kt_child, kp_src, kp_dst, 'jump', h_extra || {});
	}

	async after_reset(kt_child: Thread, kp_dst: Page, gc_reset: ResetConfig): Promise<void> {
		const h_extra = await this._g_hooks.after_reset?.(kt_child, kp_dst, gc_reset);

		await this._g_hooks.after_change?.(kt_child, null, kp_dst, 'reset', h_extra || {});
	}

	async after_switch(kt_src: Thread, kt_dst: Thread): Promise<void> {
		await this._g_hooks.after_switch?.(kt_src, kt_dst);
	}

	/**
	 * Activates a thread by the given thread id.
	 */
	async activateThread(si_thread: ThreadId, h_props: PlainObject={}): Promise<boolean> {
		// ref current thread
		const kt_src = this.activeThread;

		// ref previous page
		const kp_src = this.activePage;

		// lookup existing thread
		let kt_dst = this._h_threads[si_thread];

		// thread change
		if(si_thread !== this._si_thread) {
			// // single thread mode; abort
			// if(this._b_mode_single_thread) {
			// 	throw new Error(`Navigator operating in single thread mode refusing to activate thead '${si_thread}'.`);
			// }

			// call preswitch hooks
			await this.before_switch(kt_src, si_thread);

			// prev thread
			const si_thread_prev = this._si_thread;

			// no existing thread; create new one
			if(!kt_dst) {
				kt_dst = this._new_thread(si_thread, h_props);
			}
			// props differ
			else if(objects_might_differ(kt_dst.default.props || {}, h_props)) {
				// create new page
				const kp_dst = new Page({
					...kt_dst.default,
					props: h_props,
					context: this._h_context,
				}, kt_dst);

				// reset thread history
				kt_dst.reset(kp_dst, {
					keepTop: true,
				});

				// place incoming state below
				set_zindex_relatively(kp_src.dom, kp_dst.dom, -1);
			}

			// update thread
			this._si_thread = si_thread;

			// place thread in front
			this.activeThread.show();
			this.activeThread.dom.style.zIndex = this._c_thread_z++ +'';

			// call postswitch hooks
			await this.after_switch(kt_src, kt_dst);

			return true;
		}

		return false;
	}
}
