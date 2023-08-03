import { uuid_v4 } from '#/util/data';
import type {F} from 'ts-toolbelt';

type ListenerCallbackFromEvent<
	y_event extends chrome.events.Event<Function>,
> = F.Parameters<y_event['addListener']>[0] extends infer fk_listener
	? fk_listener extends Function
		? fk_listener
		: never
	: never;


export class Listener<
	y_event extends chrome.events.Event<Function>,
	fk_listener extends ListenerCallbackFromEvent<y_event>=ListenerCallbackFromEvent<y_event>,
> {
	protected _as_listeners = new Set<fk_listener>();
	protected _s_debug: string;

	constructor(protected _s_prefix: string='') {
		this._s_debug = _s_prefix+':'+uuid_v4().slice(0, 16);
	}

	polyfill(): y_event {
		const k_self = this;

		// @ts-expect-error shallow introspection
		return {
			addListener(fk_listener: fk_listener): void {
				console.log(`Adding listener to ${k_self._s_debug}`);
				k_self._as_listeners.add(fk_listener);
			},

			removeListener(fk_listener: fk_listener): void {
				console.log(`Removing listener from ${k_self._s_debug}`);
				k_self._as_listeners.delete(fk_listener);
			},
		};
	}

	dispatch(...a_args: F.Parameters<fk_listener>) {
		// console.log(`Dispatching listeners on ${this._s_debug}`);
		for(const fk_listener of [...this._as_listeners]) {
			fk_listener(...a_args);
		}
	}
}