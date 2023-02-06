declare let self: DedicatedWorkerGlobalScope;

import type {Workers} from './messages';

import type {Vocab} from '#/meta/vocab';

import type * as Argon2Imports from '#/crypto/argon2';

(function() {
	const {Argon2} = inline_require('#/crypto/argon2') as typeof Argon2Imports;

	self.onmessage = function(d_event_init) {
		if('init' === d_event_init.data.type) {
			const d_worker = self as unknown as Vocab.TypedWorker<Workers.Argon2ToHost, Workers.HostToArgon2>;

			d_worker.onmessage = (d_event) => {
				const {
					type: si_type,
					id: si_request,
					value: w_value,
				} = d_event.data;

				if('hash' === si_type) {
					// run hash algo
					Argon2.hash(w_value)
						.then((atu8_hash) => {
							// send success response
							self.postMessage({
								type: 'ok',
								id: si_request,
								value: atu8_hash,
							}, [atu8_hash.buffer]);
						})
						.catch((e_hash) => {
							self.postMessage({
								type: 'error',
								id: si_request,
								value: e_hash.message,
							});
						});
				}
				else if('attack' === si_type) {
					// run attack
					Argon2.attack(w_value)
						.then((atu8_answer) => {
							// send success response
							self.postMessage({
								type: 'ok',
								id: si_request,
								value: atu8_answer,
							}, [atu8_answer.buffer]);
						})
						.catch((e_hash) => {
							self.postMessage({
								type: 'error',
								id: si_request,
								value: e_hash.message,
							});
						});
				}
			};

			self.postMessage({
				type: 'ack',
			});
		}
	};
})();
