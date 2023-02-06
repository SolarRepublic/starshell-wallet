import type {Vocab} from '#/meta/vocab';

import type {HostToRelay, RelayToHost} from '#/script/messages';
import {fodemtv, oderom} from '#/util/belt';

type Features = {
	storage: {};
	hotWallet: {};
};

class PermissionError extends Error {}

export class HostConnection {
	static async create() {

	}

	protected _h_features: Record<keyof Features, boolean>;
	protected _h_handlers: Vocab.Handlers<RelayToHost.ConnectionVocab>;

	constructor(g_chain: ChainDescriptor, d_port: Vocab.TypedPort<HostToRelay.ConnectionVocab, RelayToHost.ConnectionVocab>) {
		const h_handlers = this._h_handlers = oderom({
			storage: {
				downloadStore() {
				},
			},
		}, (si_feature, h_handlers) => fodemtv(h_handlers, f_entry =>
			// wrap with module access control guard
			 (...a_args: any[]) => {
				// check permission
				if(!this._h_features[si_feature]) {
					return;
				}

				// forward to handler
				return f_entry.apply(null, a_args);
			}
		));

		d_port.onmessage = (d_event) => {

		};
	}

	private _allows_storage() {
		if(!this._h_features.storage) throw new PermissionError();
	}
}
