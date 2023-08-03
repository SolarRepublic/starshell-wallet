import type {AccountStruct, HardwareAccountLocation} from '#/meta/account';
import type {ChainStruct} from '#/meta/chain';

import {Buffer} from 'buffer';

import {CosmosSignRequest, SignDataType} from '@solar-republic/bc-ur-registry-cosmos';

import {pubkey_to_bech32} from './bech32';
import {parse_hwa} from './hardware-signing';

import {Devices} from '#/store/devices';
import { uuid_v4 } from '#/util/data';


export async function keystone_sign_request(
	g_account: AccountStruct,
	atu8_msg: Uint8Array,
	z_context: string | ChainStruct
): Promise<CosmosSignRequest> {
	const g_device = await Devices.at(g_account.extra!.device!);
	const sb16_fingerprint = g_device!.features.wallet!.fingerprint!;

	const g_pwa = parse_hwa(g_account.secret as HardwareAccountLocation);

	const sa_sender = pubkey_to_bech32(g_account.pubkey, z_context);

	// play request and capture signature
	return CosmosSignRequest.constructCosmosRequest(
		uuid_v4(),
		[sb16_fingerprint],
		Buffer.from(atu8_msg),
		SignDataType.amino,
		[g_pwa.bip44],
		[sa_sender],
		'StarShell'
	);
}
