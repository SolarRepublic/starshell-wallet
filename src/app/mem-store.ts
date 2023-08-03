import type {onDestroy} from 'svelte';
import type {Readable, Writable} from 'svelte/store';

import type {F, L} from 'ts-toolbelt';

import type {Arrayable, Dict, Promisable} from '#/meta/belt';

import {fodemtv, ode, remove} from '#/util/belt';
import AsyncLockPool2 from '#/util/async-lock-pool-2';

type Subscriber<
	w_value extends any=any,
> = (w_value: w_value) => Promisable<void>;

class Subscribable<
	w_value extends any=any,
> implements Readable<w_value> {
	protected _w_value: w_value;
	protected _a_subscribers: Subscriber<w_value>[] = [];
	protected _k_lock = new AsyncLockPool2(1);

	protected async _set(w_value: w_value, b_force=false): Promise<void> {
		if(w_value !== this._w_value || b_force) {
			this._w_value = w_value;

			const f_release = await this._k_lock.acquire();

			const a_subscribers = this._a_subscribers.slice();
			await Promise.all(a_subscribers.map(f_subscriber => f_subscriber(w_value)));

			f_release();
		}
	}

	get(): w_value {
		return this._w_value;
	}

	subscribe(f_subscription: Subscriber<w_value>, w_invalidate?: any, b_skip_initial=false): VoidFunction {
		this._a_subscribers.push(f_subscription);

		// invoke immediately
		if(true !== b_skip_initial) {  // eslint-disable-line @typescript-eslint/no-unnecessary-boolean-literal-compare
			void f_subscription(this._w_value);
		}

		return () => {
			remove(this._a_subscribers, f_subscription);
		};
	}

	// // similar to subscribe but performs initial callback
	// follow(f_subscription: Subscriber<w_value>, b_skip_initial=false): VoidFunction {
	// 	this._a_subscribers.push(f_subscription);

	// 	// invoke immediately after
	// 	if(true !== b_skip_initial) {  // eslint-disable-line @typescript-eslint/no-unnecessary-boolean-literal-compare
	// 		queueMicrotask(() => {
	// 			void f_subscription(this._w_value);
	// 		});
	// 	}

	// 	return () => {
	// 		remove(this._a_subscribers, f_subscription);
	// 	};
	// }

	once(f_callback: Subscriber<w_value>): void {
		const f_wrapper = () => {
			remove(this._a_subscribers, f_wrapper);

			// invoke once value updates
			void f_callback(this._w_value);
		};

		this._a_subscribers.push(f_wrapper);
	}

	nextUpdate(): Promise<w_value> {
		return new Promise((fk_resolve) => {
			this.once(() => {
				fk_resolve(this._w_value);
			});
		});
	}
}

type UnwrapValue<
	k_store extends Subscribable,
> = k_store extends Subscribable<infer w_value>
	? w_value
	: any;

export class MemStore<
	w_value extends any=any,
> extends Subscribable<w_value> implements Writable<w_value> {
	constructor(w_init: w_value) {
		super();

		this._w_value = w_init;
	}

	set(w_value: w_value, b_force=false): Promise<void> {
		return this._set(w_value, b_force);
	}

	update(f_update: (w_current: w_value) => w_value, b_force=false): Promise<void> {
		return this._set(f_update(this._w_value), b_force);
	}
}

type OptionalSetter<
	f_accept extends F.Function,
	b_arg extends 0|1=0,
> = F.Function<
	L.Append<F.Parameters<f_accept>, Awaited<F.Return<f_accept>>>,
	void
> extends infer f_overloaded
	? {
		0: f_accept & f_overloaded;
		1: f_overloaded;
	}[b_arg]
	: never;

export type DeriveTransform<
	w_out extends any,
	w_value extends any=any,
	z_src extends Arrayable<Subscribable<w_value>>=Arrayable<Subscribable<w_value>>,
	b_arg extends 0|1=0,
> = z_src extends Subscribable<infer w_actual>
	? OptionalSetter<(w_input: w_actual) => Promisable<w_out>, b_arg>
	: z_src extends [Subscribable<infer w_1>, Subscribable<infer w_2>]
		? OptionalSetter<(a_inputs: [w_1, w_2]) => Promisable<w_out>, b_arg>
		: z_src extends Subscribable[]
			? OptionalSetter<(a_inputs: UnwrapValue<z_src[number]>[]) => Promisable<w_out>, b_arg>
			: never;

export class DerivedMemStore<
	w_out extends any,
	w_value extends any=any,
	z_src extends Arrayable<Subscribable<w_value>>=Arrayable<Subscribable<w_value>>,
> extends Subscribable<w_out> {
	protected _b_init = false;

	protected _w_latest: w_value;

	protected _a_values: w_value[];

	protected _f_unsubscribe: VoidFunction;

	constructor(protected _z_src: z_src, protected _f_transform: DeriveTransform<w_out, w_value, z_src>, b_skip_init=false) {
		super();

		// single store source
		if(!Array.isArray(_z_src)) {
			// track writes to prevent reversions
			let c_updates = 0;
			let i_latest = 0;

			// downcast transform
			const f_transform = _f_transform as DeriveTransform<w_out, w_value, Subscribable<w_value>>;

			// subscribe to source
			this._f_unsubscribe = _z_src.subscribe(async(w_value) => {
				this._w_latest = w_value;

				// transform has single-value callback
				if(_f_transform.length <= 1) {
					const w_response = f_transform(w_value);

					// tranform is asynchronous
					if(w_response instanceof Promise) {
						// generate unique incremental id
						const i_acting = ++c_updates;

						// wait for value
						const w_output = await w_response;

						// prevent old writes
						if(i_acting <= i_latest) return;

						// set latest write index
						i_latest = i_acting;

						// update value
						await this._set(w_output);
					}
					// transform was synchronous
					else {
						await this._set(w_response);
					}
				}
				// transform uses callback
				else {
					// generate unique incremental id
					const i_acting = ++c_updates;

					// go async
					return new Promise((fk_resolve) => {
						// apply transform to single value
						void f_transform(w_value, async(w_output) => {
							// prevent old writes
							if(i_acting <= i_latest) return;

							// set the latest write index
							i_latest = i_acting;

							// update value
							await this._set(w_output);

							// done
							fk_resolve();
						});
					});
				}
			}, null, b_skip_init);
		}
		// writable source argument is an array
		else {
			// create static list of cached values
			const a_values = this._a_values = _z_src.map(k => k.get());

			// each source
			for(let i_src=0; i_src<a_values.length; i_src++) {
				const k_src = _z_src[i_src];

				// track writes to prevent reversions
				let c_updates = 0;
				let i_latest = 0;

				// downcast transform
				const f_transform = _f_transform as DeriveTransform<w_out, w_value, MemStore<w_value>[]>;

				// subscribe to source
				this._f_unsubscribe = k_src.subscribe(async(w_value) => {
					// update cached values list
					a_values[i_src] = w_value;

					// transform has single-value callback
					if(f_transform.length <= 1) {
						const w_response = f_transform(a_values);

						// tranform is asynchronous
						if(w_response instanceof Promise) {
							// generate unique incremental id
							const i_acting = ++c_updates;

							// wait for value
							const w_output = await w_response;

							// prevent old writes
							if(i_acting <= i_latest) return;

							// set latest write index
							i_latest = i_acting;

							// update value
							await this._set(w_output);
						}
						// transform was synchronous
						else {
							await this._set(w_response);
						}
					}
					// transform uses callback
					else {
						// generate unique incremental id
						const i_acting = ++c_updates;

						// go async
						return new Promise((fk_resolve) => {
							// apply transform to single value
							void f_transform(a_values, async(w_output) => {
								// prevent old writes
								if(i_acting <= i_latest) return;

								// set the latest write index
								i_latest = i_acting;

								// update value
								await this._set(w_output);

								// done
								fk_resolve();
							});
						});
					}
				}, null, b_skip_init);
			}
		}
	}

	protected _refresh_source(): void {
		if(this._b_init) return;

		this._b_init = true;

		if(!Array.isArray(this._z_src)) {
			this._w_latest = this._z_src.get();
		}
		else {
			this._a_values = this._z_src.map(k_src => k_src.get());
		}
	}

	override get(): w_out {
		this._refresh_source();

		return super.get();
	}

	override subscribe(f_subscription: Subscriber<w_out>, w_invalidate?: any, b_skip_init=false): VoidFunction {
		this._refresh_source();

		return super.subscribe(f_subscription, w_invalidate, b_skip_init);
	}

	invalidate(): Promise<void> {
		return new Promise((fk_done) => {
			if(!Array.isArray(this._z_src)) {
				void (this._f_transform as DeriveTransform<w_out, w_value, MemStore<w_value>>)(this._w_latest, async(w_output) => {
					await this._set(w_output);

					fk_done();
				});
			}
			else {
				void (this._f_transform as DeriveTransform<w_out, w_value, MemStore<w_value>[]>)(this._a_values, async(w_output) => {
					await this._set(w_output);

					fk_done();
				});
			}
		});
	}

	destroy(): void {
		this._f_unsubscribe();
	}
}


export function writable<w_value>(w_init: w_value): MemStore<w_value> {
	return new MemStore(w_init);
}

export function derived<
	w_out extends any,
	w_value extends any=any,
	z_src extends Arrayable<Subscribable<w_value>>=Arrayable<Subscribable<w_value>>,
>(z_src: z_src, f_transform: DeriveTransform<w_out, w_value, typeof z_src, 0|1>, b_skip_init=false): DerivedMemStore<w_out, w_value, typeof z_src> {
	return new DerivedMemStore(z_src, f_transform as DeriveTransform<w_out, w_value, typeof z_src>, b_skip_init);
}

export function derivations<
	w_value extends any=any,
	z_src extends Arrayable<Subscribable<w_value>>=Arrayable<Subscribable<w_value>>,
	h_rule extends Dict<DeriveTransform<any, w_value, z_src, 0|1>>=Dict<DeriveTransform<any, w_value, z_src, 0|1>>,
>(z_src: z_src, h_rule: h_rule): {
	[si_key in keyof h_rule]: DerivedMemStore<Awaited<ReturnType<h_rule[si_key]>>, w_value, typeof z_src>;
} {
	return fodemtv(h_rule, f_rule => derived(z_src, f_rule)) as {
		[si_key in keyof h_rule]: DerivedMemStore<any, w_value, typeof z_src>;
	};
}

export interface ReloadConfig {
	sources: Subscribable[];
	action: Function;
}

export function reloadable(h_defs: Dict<ReloadConfig>, f_on_destroy?: typeof onDestroy, xt_debounce=0): void {
	const a_destroys: VoidFunction[] = [];

	// each mapping
	for(const [, gc_reload] of ode(h_defs)) {
		// cache of previous sources
		let a_cached = new Array(gc_reload.sources.length);

		// whether first update has fired
		let b_init = false;

		// previous debounce timer
		let i_debounce = 0;

		// used to indicate change occurred
		let w_change = Symbol('init');

		// create derived store
		const yw_reload = derived(gc_reload.sources, (a_sources) => {
			// find change in source before triggering update
			for(let i_source=0; i_source<a_sources.length; i_source++) {
				// source changed
				if(a_cached[i_source] !== a_sources[i_source]) {
					// update sources cache
					a_cached = a_sources.slice();

					// trigger update to derived store
					return w_change = Symbol('change');
				}
			}

			// no change
			return w_change;
		});

		// subscribe to changes
		const f_unsubscribe = yw_reload.subscribe(() => {
			// always fire the first update immediately
			if(!b_init || !xt_debounce) {
				gc_reload.action();
				b_init = true;
				return;
			}

			// debounce
			clearTimeout(i_debounce);
			i_debounce = (globalThis as typeof window).setTimeout(() => {
				void gc_reload.action();
			}, xt_debounce);
		});

		// create destroy routine
		a_destroys.push(() => {
			// unsubscribe from derived updates
			f_unsubscribe();

			// destroy derived store to free source subscription
			yw_reload.destroy();
		});
	}

	// setup the destroy callback
	f_on_destroy?.(() => {
		for(const f_destroy of a_destroys) {
			f_destroy();
		}
	});
}
