/**
 * This data structure allows checking out virtual 'locks' for multiple concurrent
 *   uses of a single/shared/limited resource such as network I/O.
 */
export default class AsyncLockPool2 {
	protected _c_busy = 0;
	protected _a_queued: (() => void)[] = [];
	protected _a_listeners: (() => void)[] = [];

	/**
	 * Create a new AsyncLockPool
	 * @param {number} n_locks - number of locks to allocate for this pool
	 */
	constructor(protected _n_locks: number) {}

	/**
	 * Release a lock. If there are acquire requests waiting in the queue, shift
	 *   one off and pass it to user.
	*/
	protected _release() {
		const {
			_a_queued,
		} = this;

		queueMicrotask(() => {
			// a queued task is waiting
			if(_a_queued.length) {
				// pass this lock onto task
				_a_queued.shift()!();
			}
			// no queued tasks
			else {
				// return lock to pool
				this._c_busy -= 1;

				// all free, no more tasks
				if(this._c_busy <= 0) {
					// notify listeners
					let f_notify;
					while((f_notify=this._a_listeners.shift())) {
						f_notify();
					}
				}
			}
		});
	}

	/**
	 * Acquire a lock. If one is free in the pool it will return immediately,
	 *   otherwise it will be queued to receive lock when one becomes avail.
	 * @param {any} w_data - data to associate with this lock
	 * @return {Promise<Release>} - resolves with function to call when user
	 *   is ready to release this lock
	 */
	acquire(): Promise<() => void> {
		// callback state
		let b_released = false;

		// a lock is available
		if(this._c_busy < this._n_locks) {
			// claim it
			this._c_busy += 1;

			// return release callback
			return Promise.resolve(() => {
				// ensure release is not called more than once
				if(b_released) throw new Error(`Lock was already released`);
				b_released = true;

				// release the lock
				this._release();
			});
		}
		// all locks are busy
		else {
			// go async
			return new Promise((fk_acquire) => {
				// queue a task
				this._a_queued.push(() => {
					// resolve the acquiree with release callback
					fk_acquire(() => {
						// ensure release is not called more than once
						if(b_released) throw new Error(`Lock was already released`);
						b_released = true;

						// release the lock
						this._release();
					});
				});
			});
		}
	}

	/**
	 * Wait until all tasks have finished
	 */
	settled(): Promise<void> {
		// already empty; return immediately
		if(!this._c_busy) return Promise.resolve(void 0);

		// go async
		return new Promise((fk_resolve) => {
			// add listener to list
			this._a_listeners.push(fk_resolve);
		});
	}

	/**
	 * Wait for a lock, use it, and then return it to the pool
	 * @param f_use 
	 */
	async use(f_use: () => Promise<void>): Promise<void> {
		// acquire a lock
		const f_release = await this.acquire();

		// use it
		await f_use();

		// return it to the pool
		f_release();
	}
}