import AsyncLockPool from './async-lock-pool';
import {TemporalSlots} from './temporal-slots';

import type {RateLimitConfig} from '#/store/web-resource-cache';

export class RateLimitingPool {
	_k_slots: TemporalSlots;
	_kl_reqs: AsyncLockPool;

	constructor(gc_rate: RateLimitConfig) {
		this._k_slots = new TemporalSlots(gc_rate);
		this._kl_reqs = new AsyncLockPool(gc_rate.concurrency);
	}

	async acquire(): Promise<VoidFunction> {
		// first, wait for a temporal slot
		const f_release_slot = await this._k_slots.acquire();

		// limit number of concurrent operations
		const f_release_pool = await this._kl_reqs.acquire();

		// release the resources in inverse order
		return () => {
			f_release_pool();
			f_release_slot();
		};
	}
}
