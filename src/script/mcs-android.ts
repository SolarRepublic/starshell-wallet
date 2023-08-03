import type { JsonObject } from '#/meta/belt';
import type * as ImportHelper from './mcs-android-imports';
		
type StorageArea = 'local' | 'session';

declare const android: {
	storage_get(si_token: string, si_area: StorageArea, a_keys: null | string[]): void;
	storage_set(si_token: string, si_area: StorageArea, sx_data: string): void;
	storage_remove(si_token: string, si_area: StorageArea, a_keys: string[]): void;
	storage_clear(si_token: string, si_area: StorageArea): void;

	notifications_create(si_token: string, si_notification: string, sx_config: string): void;
	notifications_clear(si_token: string, si_notification: string): void;

	proxied_fetch(si_token: string, p_url: string, sx_req: string): void;
	open(si_token: string, p_url: string): void;
	post(si_token: string, sx_data: string): void;
};

interface Window {
	android_callback(si_token: string, w_response: any): void;
}

(function() {
	const {
		fodemtv,
	} = inline_require('./mcs-android-imports.ts') as typeof ImportHelper;

	const ael = window.addEventListener;
	const rel = window.removeEventListener;

	const S_UUID_V4 = 'xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxxxxxx';
	const R_UUID_V4 = /[xy]/g;

	const d_crypto = 'undefined' !== typeof globalThis.crypto? globalThis.crypto: null;
	const randomUUID = d_crypto?.randomUUID? d_crypto.randomUUID: null
	const secure_uuid_v4 = randomUUID? () => randomUUID.call(d_crypto): (): string => {
		let xt_now = Date.now();
		if('undefined' !== typeof performance) xt_now += performance.now();
		return S_UUID_V4.replace(R_UUID_V4, (s) => {
			const x_r = (xt_now + (Math.random()*16)) % 16 | 0;
			xt_now = Math.floor(xt_now / 16);
			return ('x' === s? x_r: (x_r & 0x3) | 0x8).toString(16);
		});
	};

	async function cbt<
		w_out,
	>(fk_exec: (si_token: string) => void, f_transform=w=>w): Promise<w_out> {
		const si_callback = secure_uuid_v4();
		const si_secret = secure_uuid_v4();
		const si_token = `top.${si_callback}.${si_secret}`;

		return new Promise((fk_resolve) => {
			const si_event = `starshell_${si_callback}`;
			// console.log(`Awaiting callback from android <${si_event}>`);

			ael.call(window, si_event, function f_listener(d_event: CustomEvent<w_out>) {
				// console.log(`Received callback from android <${si_event}>: `, d_event.detail);

				fk_resolve(f_transform(d_event.detail))
				rel.call(window, si_event, f_listener);
			});

			fk_exec(si_token);
		});
	}

	const cbtj = async<
		w_out,
	>(fk_exec: (si_token: string) => void) => cbt<w_out>(fk_exec, w_result => w_result? fodemtv(w_result, (sx_value: string) => {
		try {
			return JSON.parse(sx_value);
		}
		catch(e_parse) {
			debugger;
			throw new Error(`Failed to parse JSON response from android:\n${sx_value}`);
		}
	}): w_result);

	const transform_data = (h_data: Record<string, any>) => JSON.stringify(fodemtv(h_data, w_value => JSON.stringify(w_value)));


	const G_LOCAL = {
		get: (z_keys: string | string[]): Promise<Record<string, string>> => cbtj<Record<string, string>>(si => android.storage_get(si, 'local', null === z_keys? null: Array.isArray(z_keys)? z_keys: [z_keys])),
		set: (h_data: Record<string, any>): Promise<void> => cbt<void>(si => android.storage_set(si, 'local', transform_data(h_data))),
		remove: (z_keys: string | string[]): Promise<void> => cbt<void>(si => android.storage_remove(si, 'local', Array.isArray(z_keys)? z_keys: [z_keys])),
		clear: (): Promise<void> => cbt<void>(si => android.storage_clear(si, 'local')),
	};

	const G_SESSION = {
		get: (z_keys: string | string[]): Promise<Record<string, string>> => cbtj<Record<string, string>>(si => android.storage_get(si, 'session', null === z_keys? null: Array.isArray(z_keys)? z_keys: [z_keys])),
		set: (h_data: Record<string, any>): Promise<void> => cbt<void>(si => android.storage_set(si, 'session', JSON.stringify(fodemtv(h_data, w_value => JSON.stringify(w_value))))),
		remove: (z_keys: string | string[]): Promise<void> => cbt<void>(si => android.storage_remove(si, 'session', Array.isArray(z_keys)? z_keys: [z_keys])),
		clear: (): Promise<void> => cbt<void>(si => android.storage_clear(si, 'session')),
	};

	const chrome = {
		_polyfilled: true,

		storage: {
			local: G_LOCAL,
			session: G_SESSION,
		},

		runtime: {
			id: 'starshell-android',

			sendMessage: (g_msg: JsonObject) => cbt(si => android.post(si, JSON.stringify(g_msg))),
		},

		extension: {},
	};

	return {
		chrome,
	};
})();
