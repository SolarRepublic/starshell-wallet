export interface SlotsConfig {
	/**
	 * Total slot capcity
	 */
	capacity: number;

	/**
	 * The minimum amount of time between a slot's reusability
	 */
	resolution: number;
}

export class TemporalSlots {
	protected _nl_capacity: number;
	protected _xt_resolution: number;
	protected _c_slots_free: number;
	protected _a_queue: VoidFunction[] = [];

	constructor(gc_slots: SlotsConfig) {
		this._nl_capacity = gc_slots.capacity;
		this._xt_resolution = gc_slots.resolution;

		this._c_slots_free = this._nl_capacity;
	}

	protected _dequeue(): void {
		const {_a_queue} = this;

		// there is at least one item waiting for a slot; immediately reuse the released slot by invoking the item
		if(_a_queue.length) {
			_a_queue.shift()!();
		}
		// nothing queued; return slot to available
		else {
			this._c_slots_free += 1;
		}
	}

	async acquire(): Promise<VoidFunction> {
		// prep delayed dequeuing
		const f_delayed_dequeue = () => setTimeout(() => {
			this._dequeue();
		}, this._xt_resolution);

		// a slot is already available
		if(this._c_slots_free > 0) {
			// remove slot availability
			this._c_slots_free -= 1;

			// start a timeout to make the slot available after
			return () => {
				f_delayed_dequeue();
			};
		}

		// give caller a promise
		return new Promise((fk_resolve) => {
			// add to queue
			this._a_queue.push(() => {
				// resolve
				fk_resolve(f_delayed_dequeue);
			});
		});
	}
}
