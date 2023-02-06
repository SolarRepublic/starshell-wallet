import type {Dict} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';

import type {Argon2Config, Argon2Worker, AttackConfig} from '#/crypto/argon2';
import type {Workers} from '#/script/messages';
import {locate_script} from '#/script/utils';
import {concat} from '#/util/data';

type ResponseHandler = [(atu8_hash: Uint8Array) => void, (e_reject: Error) => void];

export class WorkerHost implements Argon2Worker {
	static async create(sr_script: string): Promise<WorkerHost> {
		// 'assets/src/script/worker-argon2'
		const k_host = new WorkerHost(sr_script);

		return await k_host._init();
	}

	protected _p_script: string;
	protected _d_worker: Worker;
	protected _h_response_handlers: Dict<ResponseHandler> = {};

	constructor(sr_script: string) {
		// locate script
		const p_script = locate_script(sr_script);

		if(!p_script) {
			throw new Error(`Failed to locate worker script '${sr_script}'`);
		}

		this._p_script = '/'+p_script;
	}

	protected _init(): Promise<this> {
		// create worker
		const d_worker_raw = new Worker(this._p_script);

		// create typed worker
		const d_worker = this._d_worker = d_worker_raw as Vocab.TypedWorker<Workers.HostToArgon2, Workers.Argon2ToHost>;

		// go async
		return new Promise((fk_resolve_init, fe_reject_init) => {
			// bind to message event
			d_worker_raw.onmessage = (d_event_init) => {
				// handle initial ack message
				if('ack' === d_event_init.data.type) {
					// reassign message handler
					d_worker.onmessage = (d_event) => {
						// destructure event data
						const {
							type: si_type,
							id: si_request,
							value: w_value,
						} = d_event.data;

						// lookup response handler
						const a_response = this._h_response_handlers[si_request];
						if(a_response) {
							// destructure response promise callbacks
							const [fk_resolve, fe_reject] = a_response;

							// delete handler
							delete this._h_response_handlers[si_request];

							if('ok' === si_type) {
								fk_resolve(w_value);
							}
							else if('error' === si_type) {
								fe_reject(new Error(w_value));
							}
						}
					};

					// resolve init promise
					fk_resolve_init(this);
				}
			};

			// handler error
			d_worker_raw.onmessageerror = (d_event) => {
				fe_reject_init(d_event.data);
			};

			// init
			d_worker_raw.postMessage({
				type: 'init',
			});
		});
	}

	terminate(): void {
		this._d_worker.terminate();
	}

	hash(gc_hash: Argon2Config): Promise<Uint8Array> {
		// go async
		return new Promise((fk_resolve, fe_reject) => {
			// create transfers list
			const a_transfers = [
				gc_hash.phrase,
				gc_hash.salt,
				gc_hash.secret,
				gc_hash.ad,
			].filter(atu8 => atu8).map(atu8 => concat([atu8!]).buffer);

			// create unique request id
			const si_request = crypto.randomUUID();

			// set handler
			this._h_response_handlers[si_request] = [fk_resolve, fe_reject];

			// post message to worker
			this._d_worker.postMessage({
				type: 'hash',
				id: si_request,
				value: gc_hash,
			}, a_transfers);
		});
	}

	attack(gc_attack: AttackConfig): Promise<Uint8Array> {
		// go async
		return new Promise((fk_resolve, fe_reject) => {
			const {
				params: gc_hash,
			} = gc_attack;

			// create transfers list
			const a_transfers = [
				gc_hash.phrase,
				gc_hash.salt,
				gc_hash.secret,
				gc_hash.ad,
			].filter(atu8 => atu8).map(atu8 => concat([atu8!]).buffer);

			// create unique request id
			const si_request = crypto.randomUUID();

			// set handler
			this._h_response_handlers[si_request] = [fk_resolve, fe_reject];

			// post message to worker
			this._d_worker.postMessage({
				type: 'attack',
				id: si_request,
				value: gc_attack,
			}, a_transfers);
		});
	}
}
