import type {Promisable} from '#/meta/belt';

export interface LimitConfig {
	/**
	 * The minimum amount of time between outputs
	 */
	resolution: number;
}

export class Limiter {
	protected _b_pending = false;
	protected _b_executing = false;
	protected _b_postponed = false;
	protected _xt_previous = 0;
	protected _xt_resolution: number;

	constructor(protected _f_execute: () => Promisable<void>, gc_limiter: LimitConfig) {
		this._xt_resolution = gc_limiter.resolution;
	}

	protected async _execute(): Promise<void> {
		// block while executing
		this._b_executing = true;
		await this._f_execute();

		// done executing
		this._b_executing = false;

		// update timestamp of previous
		this._xt_previous = Date.now();

		// operation was postponed while executing
		if(this._b_postponed) {
			// reset flag
			this._b_postponed = false;

			// create new notice
			void this.notice();
		}
	}

	async notice(): Promise<void> {
		// notice is redundant while pending
		if(this._b_pending) return;

		// notice should follow thru after execution
		if(this._b_executing) {
			this._b_postponed = true;
			return;
		}

		// how long it has been since previous execution
		const xt_gap = Date.now() - this._xt_previous;

		// beyond resolution from previous, execute immediately
		if(xt_gap > this._xt_resolution) {
			try {
				await this._execute();
			}
			catch(e_execute) {
				console.error(e_execute);
			}
		}
		// within time bounds of previous
		else {
			// now something is pending
			this._b_pending = true;

			// create timeout for remainder
			setTimeout(() => {
				void this._execute();
			}, this._xt_resolution - xt_gap);
		}
	}
}
