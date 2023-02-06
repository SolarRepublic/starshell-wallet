import type {Resource} from '#/meta/resource';

export class NotAuthenticatedError extends Error {}

export class AlreadyRegisteredError extends Error {}

export class InvalidPassphraseError extends Error {}

export class UnregisteredError extends Error {}

export class RecoverableVaultError extends Error {}

export class CorruptedVaultError extends Error {}

export class ContractDecryptionError extends Error {}

export class ResourceNonExistentError extends Error {
	constructor(p_resource: Resource.Path) {
		super(`The request resource does not exist: ${p_resource}`);
	}
}

export class HttpResponseError extends Error {
	constructor(protected _d_res: Response, protected _s_text: null|string=null) {
		super(`The HTTP response returned a non-OK status code: ${_d_res.status}`);
	}

	async text(): Promise<null|string> {
		if(null === this._s_text) {
			try {
				this._s_text = await this._d_res.text();
			}
			catch(e_read) {}

			return null;
		}
		else {
			return this._s_text;
		}
	}
}
