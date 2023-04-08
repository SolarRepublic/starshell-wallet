import type {Bip44Path} from './bip44';
import type {LedgerApp} from './ledger';
import type {SigningKey} from './secp256k1';

import type {AccountStruct, HardwareAccountLocation, ParsedHardwareAccountLocation} from '#/meta/account';

import type {HardwareVendor} from '#/meta/device';
import type {SecretPath} from '#/meta/secret';

import {parse_bip44} from './bip44';
import {Secp256k1Key} from './secp256k1';

import {base64_to_buffer, buffer_to_base64} from '#/util/data';

/**
 * Capture groups:
 *  1. {@link HardwareVendor}
 *  2. slip44 coin type
 *  3. compressed public-key of 0th account
 *  4. bip44 hd path
 */
const R_HWA = /^\/hwa\.([^/]+)\/(\d+):([^:]+):(.+)$/;

export function hwa_for(si_vendor: HardwareVendor, ni_coin_type: number|bigint, z_pk33: Uint8Array | string, sx_bip44: Bip44Path): HardwareAccountLocation {
	return `/hwa.${si_vendor}/${ni_coin_type as bigint}:${'string' === typeof z_pk33? z_pk33: buffer_to_base64(z_pk33)}:${sx_bip44}`;
}

export function is_hwa(sx_secret: SecretPath | HardwareAccountLocation): sx_secret is HardwareAccountLocation {
	return R_HWA.test(sx_secret);
}

export function parse_hwa(sx_secret: HardwareAccountLocation): ParsedHardwareAccountLocation {
	const [, si_vendor, si_coin, sb64_acc0, sx_bip44] = R_HWA.exec(sx_secret)!;

	return {
		type: 'hwa',
		vendor: si_vendor as HardwareVendor,
		coinType: +si_coin,
		pubkey: sb64_acc0,
		bip44: sx_bip44 as Bip44Path,
	};
}

export class HardwareSigningKey implements SigningKey {
	static async init(g_account: AccountStruct): Promise<HardwareSigningKey> {
		const k_key = new HardwareSigningKey(g_account);

		await Secp256k1Key.init();

		return k_key;
	}

	constructor(protected _g_account: AccountStruct) {}

	exportPublicKey(b_uncompressed: boolean): Uint8Array {
		const atu8_pk33 = base64_to_buffer(this._g_account.pubkey);
		return b_uncompressed? Secp256k1Key.uncompressPublicKey(atu8_pk33): atu8_pk33;
	}

	async sign(atu8_message: Uint8Array, b_extra_entropy: boolean): Promise<Uint8Array> {
		const sx_secret = this._g_account.secret;

		if(!is_hwa(sx_secret)) {
			throw new Error(`Attempted to use account that is not linked to hardware`);
		}

		const {
			bip44: sx_bip44,
		} = parse_hwa(sx_secret);

		const a_path = parse_bip44(sx_bip44);

		throw new Error(`Cannot auto-sign using account backed by hardware wallet`);

		// const {
		// 	signature: atu8_signature,
		// } = await k_app.sign(a_path, atu8_message);

		// return atu8_signature;
	}

	ecdh(atu8_pk: Uint8Array): Promise<Uint8Array> {
		throw new Error('ECDH not available on current Ledger app.');
	}
}
