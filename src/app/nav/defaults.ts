import type {NavigatorConfig} from './navigator';

import {tick} from 'svelte';

import {timeout} from '#/util/belt';


export function await_transition(dm_slide: HTMLElement, xt_wait: number): Promise<void> {
	return new Promise((fk_resolve) => {
		// make sure transition runs first
		function transition_run(d_event_run) {
			// not the intended property
			if('transform' !== d_event_run.propertyName) return;

			// wait for transition to complete
			dm_slide.addEventListener('transitionend', function transition_end(d_event_end) {
				// not the intended property
				if('transform' !== d_event_end.propertyName) return;

				// remove listener
				dm_slide.removeEventListener('transitionend', transition_end);

				// complete
				fk_resolve();
			});

			// remove listener
			dm_slide.removeEventListener('transitionrun', transition_run);
		}

		// start listening
		dm_slide.addEventListener('transitionrun', transition_run);

		// timeout handler
		setTimeout(() => {
			// cancel listening for transition event
			dm_slide.removeEventListener('transitionrun', transition_run);

			// complete
			fk_resolve();
		}, xt_wait);
	});
}

export async function page_slide(dm_slide: HTMLElement, b_in=false): Promise<void> {
	// smoother, allow for previous mods to make element visible
	await timeout(2);

	// go async
	return new Promise((fk_resolve) => {
		void await_transition(dm_slide, 300).then(() => {
			// change class
			dm_slide.classList.add('slid');

			// resolve
			fk_resolve();
		});

		// apply transform
		dm_slide.style.transform = `translateX(${b_in? '0px': 'var(--app-window-width)'})`;
	});
}


export const GC_HOOKS_DEFAULT: NavigatorConfig['hooks'] = {
	before_change(kt_context, kp_src) {
		// blur on page
		void kp_src.fire('blur');
	},

	// once a new page has been pushed
	after_push(kt_context, kp_src, kp_dst) {
		// wait for svelte to render component before querying container
		void tick().then(() => {
			// query container for last element child
			void page_slide(kp_dst.dom, true);
		});
	},

	// once a page has been popped
	after_pop(kt_context, kp_src, kp_dst, gc_pop) {
		// notify dst page
		void kp_dst.fire('restore');

		// do not bypass animation
		if(!gc_pop.bypassAnimation) {
			void await_transition(kp_src.dom, 500).then(() => {
				// destroy the component
				kp_src.destroy();
			});

			// apply translation transform to src page
			kp_src.dom.style.transform = `translateX(var(--app-window-width))`;
		}
		// bypass animation; destroy component
		else {
			kp_src.destroy();
		}
	},
};
