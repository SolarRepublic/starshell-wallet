import type {Argon2Worker} from '#/crypto/argon2';
import {WorkerHost} from '#/extension/worker-host';
import {B_LOCALHOST} from '#/share/constants';

// argon worker
let k_argon_host: Argon2Worker;
export async function load_argon_worker(): Promise<Argon2Worker> {
	if(k_argon_host) return k_argon_host;

	// when testing on localhost, import argon2 directly to run on main thread
	if(B_LOCALHOST) {
		const {Argon2} = await import('#/crypto/argon2');
		return k_argon_host = {
			...Argon2,

			// override hash function by injecting preserve flag
			hash: gc_hash => Argon2.hash({
				...gc_hash,
				preserve: true,
			}),

			// no-op
			terminate: () => void 0,
		};
	}
	// otherwise use webworker so as to not block ui
	else {
		return k_argon_host = await WorkerHost.create('assets/src/script/worker-argon2');
	}
}
