import type {Dict} from '#/meta/belt';


interface ConsolidatorConfig {
	/**
	 * How long to wait for an additional item to be queued before executing all pending
	 */
	delay?: number;

	/**
	 * Maximum time a pending operation can sit in the queue before it is executed
	 */
	max?: number;
}

/**
 * Consolidator is a generic tool for batching asychronous operations
 */
export class Consolidator<w_return extends any=any> {
	protected _xt_delay = 50;
	protected _xt_max = 200;

	protected _xt_checkpoint = 0;

	protected _i_accumulator = 0;

	protected _h_queue: Dict<([(w: w_return) => unknown, (e_reject: any) => unknown])[]> = {};
	protected _as_queue = new Set<string>();

	constructor(protected _f_submit: (a_items: string[]) => Promise<Dict<w_return>>, gc_consolidate: ConsolidatorConfig={}) {
		if(Number.isFinite(gc_consolidate?.delay)) this._xt_delay = Math.abs(gc_consolidate.delay!);
		if(Number.isFinite(gc_consolidate?.max)) this._xt_max = Math.abs(gc_consolidate.max!);
	}

	private _execute() {
		// clear timeout and reset indicator
		clearTimeout(this._i_accumulator);
		this._i_accumulator = 0;

		// ref bucket object and reset field
		const h_queue = this._h_queue;
		this._h_queue = {};

		// consolidate items
		const a_values = Object.keys(h_queue);

		// execute in batch
		this._f_submit(a_values)
			.then((h_routes: Dict<any>) => {
				for(const si_key in h_queue) {
					for(const [fk_resolve] of h_queue[si_key]) {
						fk_resolve(h_routes[si_key] as w_return);
					}
				}
			})
			.catch((e_reject) => {
				for(const si_key in h_queue) {
					for(const [, fe_reject] of h_queue[si_key]) {
						fe_reject(e_reject);
					}
				}
			});
	}

	queue(s_value: string): Promise<w_return> {
		// go async
		return new Promise((fk_resolve, fe_reject) => {
			// get prev checkpoint and then update
			const xt_checkpoint = this._xt_checkpoint;
			this._xt_checkpoint = Date.now();

			// add item to queue
			(this._h_queue[s_value] = this._h_queue[s_value] || []).push([fk_resolve, fe_reject]);

			// exceeded maximum time for consolidation
			if(this._i_accumulator && Date.now() - xt_checkpoint > this._xt_max) {
				// execute immediately
				this._execute();

				// done
				return;
			}

			// create or extend timeout
			clearTimeout(this._i_accumulator);
			this._i_accumulator = (globalThis as typeof window).setTimeout(() => {
				this._execute();
			}, this._xt_delay);
		});
	}
}
