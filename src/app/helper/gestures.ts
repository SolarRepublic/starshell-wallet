import type {Promisable} from '#/meta/belt';

import {F_NOOP} from '#/util/belt';

export interface GenericGestureConfig<
	g_context extends object=object,
> {
	context?: g_context | undefined;
	init(): g_context | undefined;
	move(xl_axis: number, g_context: g_context): Promisable<void>;
	release(g_context: g_context, x_velocity: number): Promisable<void>;
	cancel(g_context: g_context): Promisable<void>;
}

const a_touches_start: Touch[] = [];

let b_gesture_init_edge_left = false;
let b_gesture_active_swipe_right = false;
let b_gesture_active_overscroll = false;

const init_config = () => ({
	init: F_NOOP,
	move: F_NOOP,
	release: F_NOOP,
	cancel: F_NOOP,
} as GenericGestureConfig);

let gc_swipe_right = init_config();

let gc_overscroll = init_config();

function along_left_edge(d_touch: Touch) {
	const xl_width = visualViewport?.width || window.innerWidth;

	// touch is along left 2% of screen
	return d_touch.screenX <= xl_width * 0.02;
}

function touches_to_array(d_event: TouchEvent, a_touches: Touch[]=[]) {
	// ref touches
	const d_touches = d_event.touches;

	// clear touches array
	a_touches.length = 0;

	// add each touch to array
	for(let i_touch=0; i_touch<d_touches.length; i_touch++) {
		a_touches.push(d_touches.item(i_touch)!);
	}

	return a_touches;
}


addEventListener('touchstart', (d_event) => {
	touches_to_array(d_event, a_touches_start);

	console.debug(`#touchstart ${a_touches_start.length} touches`);

	// check start position for capable recognitions
	{
		// ref viewport dimensions
		const xl_width = visualViewport?.width || window.innerWidth;
		const xl_height = visualViewport?.height || window.innerHeight;

		// single touch
		if(1 === a_touches_start.length) {
			const d_touch = a_touches_start[0];

			// touch is along left 2% of screen
			if(along_left_edge(d_touch)) {
				console.debug('/ along left edge');
				b_gesture_init_edge_left = true;
			}
		}
		// more than one touch
		else {
			// cancel all single-touch gestures
			b_gesture_init_edge_left = false;
			b_gesture_active_swipe_right = false;
			b_gesture_active_overscroll = false;
		}
	}
});

addEventListener('touchmove', (d_event) => {
	const a_touches = touches_to_array(d_event);

	console.debug(`#touchmove ${a_touches_start.length} touches vs ${a_touches_start.length} touches`);

	// part of same gesture
	if(a_touches.length === a_touches_start.length) {
		// single touch
		if(1 === a_touches.length) {
			const g_touch = a_touches[0];
			const g_touch_init = a_touches_start[0];

			const xl_dx = g_touch.screenX - g_touch_init.screenX;
			const xl_dy = g_touch.screenY - g_touch_init.screenY;

			console.debug(`/ dx:${xl_dx}; dy:${xl_dy}; left edge init:${b_gesture_init_edge_left}; left edge now:${along_left_edge(g_touch)}`);

			// active gesture
			if(b_gesture_active_swipe_right) {
				void gc_swipe_right.move(xl_dx, gc_swipe_right.context!);
				return;
			}
			else if(b_gesture_active_overscroll) {
				void gc_overscroll.move(xl_dy, gc_overscroll.context!);
				return;
			}
			// movement from left edge
			else if(b_gesture_init_edge_left) {
				// movement escaped edge and moved minimum distance
				if(!along_left_edge(g_touch) && xl_dx >= 10) {
					// caller approved gestured
					if((gc_swipe_right.context = gc_swipe_right.init())) {
						b_gesture_active_swipe_right = true;

						// call move
						void gc_swipe_right.move(xl_dx, gc_swipe_right.context);
						return;
					}
				}
			}

			// scrolling up
			if(Math.abs(xl_dx) < 10 && xl_dy >= 10) {
				if((gc_overscroll.context = gc_overscroll.init())) {
					b_gesture_active_overscroll = true;
				}
			}
		}
	}
});


function reset_gestures() {
	b_gesture_init_edge_left = false;
	b_gesture_active_swipe_right = false;
	b_gesture_active_overscroll = false;
}

addEventListener('touchcancel', () => {
	reset_gestures();
});

addEventListener('touchend', () => {
	if(b_gesture_active_swipe_right) {
		void gc_swipe_right.release?.(gc_swipe_right.context!, 0);
	}
	else if(b_gesture_active_overscroll) {
		void gc_overscroll.release?.(gc_overscroll.context!, 0);
	}

	reset_gestures();
});


export const Gestures = {
	swipe_right<g_context extends object=object>(gc_gesture: GenericGestureConfig<g_context>): void {
		gc_swipe_right = gc_gesture;
	},

	overscroll<g_context extends object=object>(gc_gesture: GenericGestureConfig<g_context>): void {
		gc_overscroll = gc_gesture;
	},
};
