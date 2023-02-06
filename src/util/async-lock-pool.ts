import type {Promisable} from '#/meta/belt';

interface AsyncLock {
	data: any;  // eslint-disable-line @typescript-eslint/no-explicit-any
	free: () => void;
}

type ConfirmableAsyncLock = AsyncLock & {
	confirm: (value: Promisable<VoidFunction>) => void;
};

export class LockTimeoutError extends Error {
	constructor() {
		super('Timed out while waiting for lock');
	}
}

/**
 * Release a lock. If there are acquire requests waiting in the queue, shift
 *   one off and pass it to user.
 * @param {AsyncLockPool} k_self - self instance
 * @param {AsyncLock} g_lock - lock object to be released
 * @return {void}
 */
function AsyncLockPool$_release(
	k_self: AsyncLockPool,
	g_lock: AsyncLock
): VoidFunction {
	return () => {
		// remove self from locks
		k_self._a_locks.splice(k_self._a_locks.indexOf(g_lock), 1);

		// free
		k_self._c_free += 1;

		queueMicrotask(() => {
			// at least one promise waiting for lock
			if(k_self._a_awaits.length) {
				const g_lock_await = k_self._a_awaits.shift()!;

				g_lock_await.confirm(g_lock_await.free);
			}
		});
	};
}

/**
 * This data structure allows checking out virtual 'locks' for multiple concurrent
 *   uses of a single/shared/limited resource such as network I/O.
 */
export class AsyncLockPool {
	_c_free: number;
	_a_awaits: ConfirmableAsyncLock[] = [];
	_a_locks: AsyncLock[] = [];


	/**
	 * Create a new AsyncLockPool
	 * @param {number} n_locks - number of locks to allocate for this pool
	 */
	constructor(n_locks: number) {
		this._c_free = n_locks;
	}


	/**
	 * Get the number of free slots available.
	 * @return number of slots available
	 */
	get free(): number {
		return this._c_free;
	}


	/**
	 * Acquire a lock. If one is free in the pool it will return immediately,
	 *   otherwise it will be queued to receive lock when one becomes avail.
	 * @param {any} w_data - data to associate with this lock
	 * @return callback function to release this lock
	 */
	acquire(w_data: any=null, xt_timeout=0): Promise<VoidFunction> {
		// at least one free lock
		if(0 < this._c_free) {
			// consume a lock
			this._c_free -= 1;

			// create lock object
			const g_lock: AsyncLock = {
				data: w_data,
			} as AsyncLock;

			// assign self-referential free function
			g_lock.free = AsyncLockPool$_release(this, g_lock);

			// push to open
			this._a_locks.push(g_lock);

			// done
			return Promise.resolve(g_lock.free);
		}
		else {
			return new Promise((fk_acquire, fe_timeout) => {
				const g_lock = {
					confirm: fk_acquire,
					data: w_data,
				} as ConfirmableAsyncLock;

				this._a_awaits.push(g_lock);

				// timeout
				if(xt_timeout > 0) {
					const i_timeout = setTimeout(() => {
						const a_awaits = this._a_awaits;

						// delete awaiter
						a_awaits.splice(a_awaits.indexOf(g_lock), 1);

						// throw
						fe_timeout(new LockTimeoutError());
					}, xt_timeout);

					g_lock.free = (...a_args) => {
						// cancel timeout
						clearTimeout(i_timeout);

						// call releaser
						AsyncLockPool$_release(this, g_lock)();
					};
				}
				// no timeout
				else {
					g_lock.free = AsyncLockPool$_release(this, g_lock);
				}
			});
		}
	}
}

export default AsyncLockPool;
