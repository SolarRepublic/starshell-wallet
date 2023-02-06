import type {Navigator} from './navigator';
import type {PageConfig} from './page';
import type {ThreadId} from '../def';

import {set_zindex_relatively} from './navigator';


import {Page} from './page';

import {dd} from '#/util/dom';


export interface ResetConfig {
	keepTop?: boolean;
}

export interface PopConfig {
	bypassAnimation?: boolean;
}

export interface JumpConfig {
	force?: boolean;
}

export class Thread {
	protected _dm_thread: HTMLDivElement;

	protected _a_history: Page[] = [];

	constructor(protected _si_thread: ThreadId, protected _gc_default: PageConfig, protected _k_navigator: Navigator) {
		this._dm_thread = dd('div', {
			'class': 'thread',
			'data-thread-id': this._si_thread,
			'style': 'z-index: 100;',
		});
	}

	get id(): ThreadId {
		return this._si_thread;
	}

	get default(): PageConfig {
		return this._gc_default;
	}

	get history(): Page[] {
		return this._a_history;
	}

	// allow for history transfers
	set history(a_pages: Page[]) {
		// clear thread dom
		this.dom.innerHTML = '';

		// each page in new history
		for(const g_page of a_pages.reverse()) {
			// move page dom over to thread
			this.dom.append(g_page.dom);

			// overwrite page's parent
			g_page.thread = this;
		}

		// set history
		this._a_history = a_pages;
	}

	get page(): Page {
		return this._a_history[0];
	}

	get dom(): HTMLElement {
		return this._dm_thread;
	}

	// place page
	protected _place(gc_page: PageConfig): Page {
		// create new page
		const kp_new = new Page({
			...gc_page,
			context: {
				...this._k_navigator.context,
				...gc_page.context,
			},
		}, this);

		// append to dom
		this._dm_thread.appendChild(kp_new.dom);

		// push state to front of stack
		this._a_history.unshift(kp_new);

		// return new page
		return kp_new;
	}


	reset(gc_page: PageConfig=this.default, gc_reset?: ResetConfig): Page {
		// 
		const {
			keepTop: b_keep_top,
		} = gc_reset || {};

		// ref history
		const a_history = this._a_history;

		// drop all stale states in history
		for(let i_state=b_keep_top? 1: 0; i_state<a_history.length; i_state++) {
			a_history[i_state].component.$destroy();
		}

		// reset history
		a_history.length = 0;

		// place new page
		const kp_new = this._place(gc_page);

		// fire change on new page
		void this._k_navigator.after_reset(this, kp_new, gc_reset || {});

		return kp_new;
	}

	peak(): Page | undefined {
		return this._a_history[1];
	}

	push(gc_page: PageConfig, kp_src: Page): Page {
		// caller is present but it is not the active page
		if(kp_src !== this.page) {
			throw new Error('Prevented inactive page from pushing new screen');
		}

		// get approval from parent
		if(!this._k_navigator.before_push(gc_page, kp_src, this)) {
			throw new Error('Prevented inactive thread from pushing new screen');
		}

		// place page
		const kp_new = this._place(gc_page);

		// call hooks on parent
		void this._k_navigator.after_push(this, kp_src, kp_new);

		// return new page
		return kp_new;
	}

	pop(gc_pop: PopConfig, kp_src: Page): Page {
		// caller is present but it is not the active page
		if(kp_src !== this.page) {
			throw new Error('Prevented inactive page from popping active screen');
		}

		// too short
		if(this._a_history.length < 2) {
			throw new Error(`Failed to pop empty history`);
		}

		// get approval from parent
		if(!this._k_navigator.before_pop(gc_pop, this._a_history[1], kp_src, this)) {
			throw new Error('Prevented inactive thread from popping active screen');
		}

		// shift history
		this._a_history.shift();

		// acquire destination page
		const kp_dst = this.page;

		// call hooks on parent
		void this._k_navigator.after_pop(this, kp_src, kp_dst, gc_pop);

		// return dst page
		return kp_dst;
	}

	jump(gc_page: PageConfig, gc_jump: JumpConfig, kp_src: Page): Page {
		// caller is present but it is not the active page
		if(kp_src !== this.page) {
			throw new Error('Prevented inactive page from jumping to screen');
		}

		// get approval from parent
		if(!this._k_navigator.before_jump(gc_jump, gc_page, kp_src, this)) {
			throw new Error('Prevented inactive thread from jumping to screen');
		}

		// not being forced and the previous item in history matches the target
		const kp_prev = this._a_history[1] as Page | undefined;
		if(!gc_jump.force && kp_prev?.equivalent(gc_page)) {
			// defer to pop operation
			return this.pop({}, kp_src);
		}

		// create new page
		const kp_dst = new Page(gc_page, this);

		// destroy all components further back in the stack
		this.reset();

		// move dead
		set_zindex_relatively(kp_dst.dom, kp_src.dom, +1);

		// wait for call hooks to resolve
		void this._k_navigator.after_jump(this, kp_src, kp_dst, gc_jump).then(() => {
			// attempt to destroy src page
			try {
				kp_src.destroy();
			}
			catch(e_destroy) {
				console.warn(`Failed to destroy stale component belonging to page: ${kp_src.creator.name+''}`);

				// attempt to forcibly remove the dom
				kp_src.dom.remove();
			}
		});

		// return new page
		return kp_dst;
	}

	hide(): void {
		this._dm_thread.style.display = 'none';
	}

	show(): void {
		this._dm_thread.style.display = 'initial';
	}
}
