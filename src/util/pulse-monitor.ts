import {F_NOOP} from './belt';


interface PulseMonitorConfig {
	/**
	 * Maximum amount of time to allow in between events
	 */
	grace?: number;

	/**
	 * Callback to fire when an event has not been seen for `grace` amount of time
	 */
	tardy: VoidFunction;

	/**
	 * Maximum cumulative time allotted after the first event
	 */
	allot?: number;

	/**
	 * Callback to fire when `allot` amount of time has passed since first event
	 */
	limit?: VoidFunction;
}

export class PulseMonitor {
	protected readonly _xt_grace: number = 100;
	protected readonly _xt_allot: number = Infinity;

	protected readonly _f_tardy: VoidFunction = F_NOOP;
	protected readonly _f_limit: VoidFunction = F_NOOP;

	protected _i_pulse = 0;
	protected _i_limitter = 0;

	protected _b_limiting = true;
	protected _b_enabled = true;

	constructor(gc_monitor: PulseMonitorConfig) {
		if(gc_monitor.grace) this._xt_grace = gc_monitor.grace;
		if(gc_monitor.tardy) this._f_tardy = gc_monitor.tardy;
		if(gc_monitor.allot) this._xt_allot = gc_monitor.allot;
		if(gc_monitor.limit) this._f_limit = gc_monitor.limit;

		this._b_limiting = Number.isFinite(this._xt_allot) && !!this._f_limit;
	}

	pulse(): void {
		// should be limiting allotted time
		if(this._b_limiting) {
			// set and save limit timeout
			this._i_limitter = (globalThis as typeof window).setTimeout(() => {
				this._f_limit();
			}, this._xt_allot);

			// don't do again
			this._b_limiting = false;
		}

		// create or extend timeout
		clearTimeout(this._i_pulse);
		this._i_pulse = (globalThis as typeof window).setTimeout(() => {
			// clear timeout and reset indicator
			clearTimeout(this._i_pulse);
			this._i_pulse = 0;

			// trigger tardy callback
			this._f_tardy();
		}, this._xt_grace);
	}

	/**
	 * Cancel and pending timeouts
	 */
	cancel(): void {
		clearTimeout(this._i_pulse);
		clearTimeout(this._i_limitter);
	}
}
