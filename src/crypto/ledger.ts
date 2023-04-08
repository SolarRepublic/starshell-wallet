import type TransportWebUSBT from '@ledgerhq/hw-transport-webusb';
import type {O} from 'ts-toolbelt';

import type {Dict, Nilable} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';
import type {DeviceStruct} from '#/meta/device';

import {Buffer} from 'buffer';

Object.assign(globalThis, {
	Buffer,
});

// ensure import happens after defining global Buffer
let TransportWebUSB: typeof TransportWebUSBT;  // eslint-disable-line @typescript-eslint/naming-convention
void import('@ledgerhq/hw-transport-webusb').then((y_import) => {
	TransportWebUSB = y_import.default;
});

import {
	TransportStatusError,
	DisconnectedDeviceDuringOperation,
} from '@ledgerhq/errors';

import {pubkey_to_bech32} from './bech32';

import {buffer_to_base64, buffer_to_hex, buffer_to_text, concat, text_to_buffer} from '#/util/data';
import { Devices } from '#/store/devices';


// export async function 
// TransportWebUSB.create()

type LedgerTransport = TransportWebUSBT;

const XC_CLASS_DEVICE = 0xe0;
const XC_CLASS_APP = 0x55;
const XC_CLASS_VIR = 0xb0;

const XC_NIL = 0x00;
const XC_YES = 0x01;

enum INS_DEVICE {
	GET_INFO=0x01,
	OPEN_APP=0xd8,
}

enum INS_APP {
	GET_VERSION=0x00,
	SIGN_SECP256K1=0x02,
	GET_ADDR_SECP256K1=0x04,
	SIGN_SECP256K1_TRANSPARENT=0x42,
}

enum INS_VIR {
	GET_INFO=0x01,
}

enum P1_APP {
	INIT=0x00,
	CNT=0x01,
	EOF=0x02,
}

enum P2_APP {
	JSON=0x00,
	TEXTUAL=0x01,
}

const H_INSTRUCTIONS = {
	get_version: {
		instruction: 0x00,
		args: () => [XC_NIL, XC_NIL, XC_NIL],
	},
	get_public_key: {
		instruction: 0x42,
		args: ({
			b_confirmation=false,
			b_address=false,
			b_chain_code_and_fingerprint=false,
		}) => [
			b_confirmation? XC_YES: XC_NIL,
			(XC_NIL | (b_address? 0b10: XC_NIL)) + (b_chain_code_and_fingerprint? 1: 0),

		],
	},
};

export enum ERR_CODES {
	NONE=0x9000,
	APP_NOT_FOUND=0x6807,
	DATA_INVALID=0x6984,
	REJECTED=0x6986,
	BAD_KEY=0x6a80,
	NOT_IN_DASHBOARD=0x6e00,
}

export const H_ERROR_DESCRIPTIONS = {
	1: 'U2F: Unknown',
	2: 'U2F: Bad request',
	3: 'U2F: Configuration unsupported',
	4: 'U2F: Device Ineligible',
	5: 'U2F: Timeout',
	14: 'Timeout',
	[ERR_CODES.NONE]: '',  // no error
	0x9001: 'Device is busy',
	0x6400: 'Execution Error',
	0x6802: 'Error deriving keys',
	0x6700: 'Wrong Length',
	[ERR_CODES.APP_NOT_FOUND]: 'App not found',
	0x6982: 'Empty Buffer',
	0x6983: 'Output buffer too small',
	[ERR_CODES.DATA_INVALID]: 'Data is invalid',
	0x6985: 'Conditions not satisfied',
	[ERR_CODES.REJECTED]: 'Transaction rejected',
	[ERR_CODES.BAD_KEY]: 'Bad key handle',
	0x6b00: 'Invalid P1/P2',
	0x6d00: 'Instruction not supported',
	[ERR_CODES.NOT_IN_DASHBOARD]: 'Not in dashboard',  // 'App does not seem to be open',
	0x6f00: 'Unknown error',
	0x6f01: 'Sign/verify error',
};

function error_text(xc_return: number) {
	if(xc_return in H_ERROR_DESCRIPTIONS) {
		return H_ERROR_DESCRIPTIONS[xc_return];
	}
	else {
		return `Unknown error code :0x${xc_return.toString(16)}`;
	}
}

export class LedgerError extends Error {
	static handle(e_ledger: unknown): Error {
		if(e_ledger instanceof Error) {
			return e_ledger;
		}

		return new LedgerError('Unknown error');
	}
}

export class SignRejectedError extends LedgerError {
	constructor() {
		super(`User rejected signing request`);
	}
}

// export class LedgerResponseError extends Error {
// 	constructor(xc_return: number) {
// 		super(error_text(xc_return) || 'Unknown error');
// 	}
// }

class ByteReader {
	constructor(protected _atu8_bytes: Uint8Array, protected _ib_read=0) {}

	read() {
		let {
			_ib_read,
			_atu8_bytes,
		} = this;

		const nb_chunk = _atu8_bytes[_ib_read++];
		const atu8_chunk = _atu8_bytes.subarray(_ib_read, _ib_read+nb_chunk);

		this._ib_read = _ib_read + nb_chunk;

		return atu8_chunk;
	}

	readHex(): string {
		return buffer_to_hex(this.read());
	}

	readText(): string {
		return buffer_to_text(this.read());
	}
}

const XM_HI = Number(1n << 31n);


class ByteWriter {
	protected _a_buffers: Uint8Array[] = [];

	out(): Uint8Array {
		return concat(this._a_buffers);
	}

	writeText(s_text: string) {
		const {_a_buffers} = this;
		const atu8_text = text_to_buffer(s_text);
		_a_buffers.push(Uint8Array.from([atu8_text.byteLength]));
		_a_buffers.push(atu8_text);
	}

	writeHdPath(a_path: [number, number, number, number, number]): Uint8Array {
		if(5 !== a_path?.length) throw new TypeError(`Invalid HD Path`);

		const atu8_path = new Uint8Array(5 << 2);
		const dv_path = new DataView(atu8_path.buffer);

		// first three parts of bip44 path are private
		dv_path.setUint32(0, XM_HI + a_path[0], true);
		dv_path.setUint32(4, XM_HI + a_path[1], true);
		dv_path.setUint32(8, XM_HI + a_path[2], true);

		// last two are not
		dv_path.setUint32(12, a_path[3], true);
		dv_path.setUint32(16, a_path[4], true);

		this._a_buffers.push(atu8_path);

		return atu8_path;
	}
}

export enum ProbeFailure {
	DISCONNECTED,
	OTHER_APP,
	UNKNOWN,
}

export interface DeviceInfo {
	code: number;
	error: string;
	target?: string;
}

export interface ProbeResult {
	ok: boolean;
	info?: Nilable<DeviceInfo>;
	reason?: ProbeFailure;
	error?: Error;
}

export type LedgerResponse<g_merge extends Dict<any>={}> = O.Merge<g_merge, {
	code: number;
	error: string;
}>;

export type LedgerResponseOk<g_merge extends Dict<any>> = LedgerResponse<O.Merge<{
	error: '';
	response: Uint8Array;
}, g_merge>>;

export type AppInfoResponse = LedgerResponseOk<{
	name: string;
	version: string;
	target: string;
	se_version: string;
	flags: Uint8Array;
	mcu_version: string;
	recovery: boolean;
	signed_mcu_code: boolean;
	onboarded: boolean;
	pin_validated: boolean;
}>;

export type AppVersionResponse = LedgerResponseOk<{
	test_mode: boolean;
	major: number;
	minor: number;
	patch: number;
	locked: boolean;
	target: string;
}>;

export type PublicKeyResponse = LedgerResponseOk<{
	publicKey: Uint8Array;
	bech32: Bech32;
}>;

type IdentifiableDevice = {
	vendor: string;
	productId: number|`${bigint}`|string;
};

function device_identity(g_device: IdentifiableDevice) {
	return `${g_device.vendor}:${g_device.productId}`;
}

export class LedgerDevice {
	static match(w_dev0: IdentifiableDevice, w_dev1: IdentifiableDevice): boolean {
		return device_identity(w_dev0) === device_identity(w_dev1);
	}

	static async connect(d_device?: USBDevice): Promise<Nilable<LedgerDevice>> {
		const g_device = d_device? await TransportWebUSB.open(d_device): await TransportWebUSB.openConnected();
		if(!g_device) return null;
		return new LedgerDevice(g_device);
	}

	static async request(): Promise<Nilable<LedgerDevice>> {
		const g_device = await TransportWebUSB.request();
		if(!g_device) return null;
		return new LedgerDevice(g_device);
	}

	constructor(protected _y_transport: TransportWebUSBT) {

	}

	get transport(): TransportWebUSBT {
		return this._y_transport;
	}

	async probe(): Promise<ProbeResult> {
		try {
			const g_info = await this.info();

			return {
				ok: true,
				info: g_info,
			};
		}
		catch(e_probe) {
			let xc_reason = ProbeFailure.UNKNOWN;

			// transport status error
			if(e_probe instanceof TransportStatusError) {
				// instruction not supported
				if(0x6d00 === e_probe['statusCode']) {
					// device is in another app?
					return {
						ok: true,
						reason: ProbeFailure.OTHER_APP,
					};
				}
			}
			// device connection was lost
			else if(e_probe instanceof DisconnectedDeviceDuringOperation) {
				xc_reason = ProbeFailure.DISCONNECTED;
			}

			return {
				ok: false,
				reason: xc_reason,
				error: e_probe,
			};
		}
	}

	async info() {
		const atu8_response = await this._y_transport.send(
			XC_CLASS_DEVICE, INS_DEVICE.GET_INFO, XC_NIL, XC_NIL, Buffer.from([]), [ERR_CODES.NONE, ERR_CODES.NOT_IN_DASHBOARD]);

		const nb_response = atu8_response.byteLength;

		const dv_response = new DataView(atu8_response.buffer, atu8_response.byteOffset, nb_response);

		const xc_return = dv_response.getUint16(nb_response-2);

		if(ERR_CODES.NOT_IN_DASHBOARD === xc_return) {
			return {
				code: xc_return,
				error: 'Command is only available in Dashboard',
			};
		}

		const si_target = buffer_to_hex(atu8_response.subarray(0, 4));

		const k_reader = new ByteReader(atu8_response, 4);

		const si_seversion = k_reader.readText();

		const sb16_flags = k_reader.readHex();

		const sb16_mcuversion = k_reader.readHex().replace(/00$/, '');

		// const nb_seversion = atu8_response[4];
		// let ib_read = 5 + nb_seversion;
		// const si_seversion = buffer_to_hex(atu8_response.subarray(5, ib_read));

		// const nb_flags = atu8_response[ib_read++];
		// const sb16_flags = buffer_to_hex(atu8_response.subarray(ib_read, ib_read+nb_flags));
		// ib_read += nb_flags;

		// const nb_mcuversion = atu8_response[ib_read++];
		// let atu8_mcuversion = atu8_response.subarray(ib_read, ib_read+nb_mcuversion);

		// patch mcu version issue


		// if(0 === atu8_mcuversion[atu8_mcuversion.byteLength-1]) {
		// 	atu8_mcuversion = atu8_mcuversion.subarray(0, -1);
		// }

		// const sb16_mcuversion = buffer_to_hex(atu8_mcuversion);

		return {
			code: xc_return,
			error: error_text(xc_return),
			target: si_target,
			se_version: si_seversion,
			flags: sb16_flags,
			mcu_version: sb16_mcuversion,
			response: atu8_response,
		};
	}

	async open(si_name: string): Promise<void> {
		await this._y_transport.send(
			XC_CLASS_DEVICE, INS_DEVICE.OPEN_APP, XC_NIL, XC_NIL, text_to_buffer(si_name) as Buffer);

		// for(let c_retries=0; c_retries<2; c_retries++) {
		// 	await timeout(1e3);

		// 	try {
		// 		const g_info = await this.virInfo();

		// 		if(!g_info.error) {
		// 			return si_name === g_info.name;
		// 		}

		// 		break;
		// 	}
		// 	catch(e_transport) {}

		// 	continue;
		// }

		// return false;
	}

	async app(xc_instruction: INS_APP, xc_p1=XC_NIL, xc_p2=XC_NIL, atu8_data?: Uint8Array, a_statuses?: number[]): Promise<Uint8Array> {
		if(atu8_data) {
			const sb16_apdu = buffer_to_hex(concat([
				Uint8Array.from([XC_CLASS_APP, xc_instruction, xc_p1, xc_p2, atu8_data.byteLength]),
				atu8_data,
			]));

			console.debug(`APDU>> ${sb16_apdu}`);
		}

		return await this._y_transport.send(
			XC_CLASS_APP, xc_instruction, xc_p1, xc_p2, atu8_data as Buffer, a_statuses);
	}

	async vir(xc_instruction: INS_VIR, xc_p1=XC_NIL, xc_p2=XC_NIL, atu8_data?: Uint8Array, a_statuses?: number[]): Promise<Uint8Array> {
		return await this._y_transport.send(
			XC_CLASS_VIR, xc_instruction, xc_p1, xc_p2, atu8_data as Buffer, a_statuses);
	}

	async virInfo(): Promise<LedgerResponse | AppInfoResponse> {
		const atu8_response = await this.vir(INS_VIR.GET_INFO);

		const nb_response = atu8_response.byteLength;

		const dv_response = new DataView(atu8_response.buffer, atu8_response.byteOffset, nb_response);

		const xc_return = dv_response.getUint16(nb_response-2);

		if(1 !== atu8_response[0]) {
			return {
				code: 0x9001,
				error: 'Invalid response format ID',
			};
		}

		const k_reader = new ByteReader(atu8_response, 1);

		const si_name = k_reader.readText();
		const si_version = k_reader.readText();
		const atu8_flags = k_reader.read();
		const xc_flag = atu8_flags[0];

		return {
			code: xc_return,
			error: error_text(xc_return),
			name: si_name,
			version: si_version,
			flags: atu8_flags,
			recovery: 0 !== (xc_flag & 1),
			signed_mcu_code: 0 !== (xc_flag & 2),
			onboarded: 0 !== (xc_flag & 4),
			pin_validated: 0 !== (xc_flag & 128),
			response: atu8_response,
		};
	}

	async appVersion(): Promise<AppVersionResponse> {
		try {
			const atu8_response = await this.app(INS_APP.GET_VERSION, XC_NIL, XC_NIL);

			const nb_response = atu8_response.byteLength;

			const dv_response = new DataView(atu8_response.buffer, atu8_response.byteOffset, nb_response);

			const xc_return = dv_response.getUint16(nb_response-2);

			return {
				code: xc_return,
				error: error_text(xc_return),
				test_mode: 0 !== atu8_response[0],
				major: atu8_response[1],
				minor: atu8_response[2],
				patch: atu8_response[3],
				locked: 1 === atu8_response[4],
				target: buffer_to_hex(atu8_response.subarray(5, 9)),
				response: atu8_response,
			};
		}
		catch(e_send) {
			throw LedgerError.handle(e_send);
		}
	}

	matchesDevice(g_device: DeviceStruct): boolean {
		return device_identity(Devices.fromUsbDevice(this._y_transport.device)) === device_identity(g_device);
	}
}

const H_APP_COINTYPES = {
	Cosmos: 118,
	Secret: 529,
};

export type HdPath = [44, number, number, number, number];

const NB_CHUNK = 250;

export class LedgerApp {
	static async open(k_device: LedgerDevice, si_name: string): Promise<LedgerApp> {
		return new LedgerApp(k_device, si_name);

		// const g_version = await k_app.getVersion();

		// debugger;

		// console.log({g_version});

		// return lk_
	}

	constructor(protected _k_device: LedgerDevice, protected _si_app: string) {

	}

	get name(): string {
		return this._si_app;
	}

	get device(): LedgerDevice {
		return this._k_device;
	}

	get coinType(): number {
		return H_APP_COINTYPES[this._si_app];
	}

	async isLocked(): Promise<boolean> {
		return (await this._k_device.appVersion()).locked;
	}

	async getPublicKey(s_hrp: string, a_path: HdPath): Promise<PublicKeyResponse> {
		const k_writer = new ByteWriter();

		k_writer.writeText(s_hrp);

		k_writer.writeHdPath(a_path);

		const atu8_response = await this._k_device.app(
			INS_APP.GET_ADDR_SECP256K1, XC_NIL, XC_NIL, k_writer.out(), [ERR_CODES.NONE]);

		const nb_response = atu8_response.byteLength;

		const dv_response = new DataView(atu8_response.buffer, atu8_response.byteOffset, nb_response);

		const xc_return = dv_response.getUint16(nb_response-2);

		const atu8_pk33 = atu8_response.subarray(0, 33);

		const atu8_addr = atu8_response.subarray(33, 33+s_hrp.length+1+38);

		// verify addresses match
		const sa_device = buffer_to_text(atu8_addr) as Bech32;
		const sa_verify = pubkey_to_bech32(atu8_pk33, s_hrp);

		if(sa_device !== sa_verify) {
			throw new Error(`Device app produced inconsistent bech32 address; pubkey: ${buffer_to_base64(atu8_pk33)}; ours: ${sa_verify}; theirs: ${sa_device}`);
		}

		if(ERR_CODES.NONE !== xc_return) {
			return {
				code: xc_return,
				error: error_text(xc_return),
			};
		}

		return {
			code: xc_return,
			error: error_text(xc_return),
			publicKey: atu8_pk33,
			bech32: sa_device,
		};
	}

	async _frame(xc_p1: P1_APP, atu8_chunk: Uint8Array, xc_ins: INS_APP=INS_APP.SIGN_SECP256K1) {
		const atu8_response = await this._k_device.app(
			xc_ins, xc_p1, 0, atu8_chunk, [ERR_CODES.NONE, ERR_CODES.DATA_INVALID, ERR_CODES.BAD_KEY]);

		const nb_response = atu8_response.byteLength;

		const dv_response = new DataView(atu8_response.buffer, atu8_response.byteOffset, nb_response);

		const xc_return = dv_response.getUint16(nb_response-2);

		const atu8_rest = atu8_response.subarray(0, -2);

		if(ERR_CODES.DATA_INVALID === xc_return || ERR_CODES.BAD_KEY === xc_return) {
			throw new LedgerError(`${H_ERROR_DESCRIPTIONS[xc_return]}: ${buffer_to_text(atu8_rest)}`);
		}

		return {
			code: xc_return,
			error: H_ERROR_DESCRIPTIONS[xc_return],
			signature: atu8_rest,
			response: atu8_response,
		};
	}

	async sign(a_path: HdPath, atu8_data: Uint8Array, atu8_txkey?: Uint8Array|undefined) {
		// mode
		// const xc_ins = atu8_txkey? INS_APP.SIGN_SECP256K1_TRANSPARENT: INS_APP.SIGN_SECP256K1;
		const xc_ins = INS_APP.SIGN_SECP256K1;

		// initial frame
		let g_out = await this._frame(P1_APP.INIT, new ByteWriter().writeHdPath(a_path), xc_ins);
		if(g_out.error) throw new LedgerError(g_out.error as string);

		// tx encryption key
		if(atu8_txkey) {
			g_out = await this._frame(P1_APP.CNT, concat([
				Uint8Array.from([32]),
				atu8_txkey,
			]));

			if(g_out.error) throw new LedgerError(g_out.error as string);
		}

		// each chunk of message
		for(let ib_read=0; ib_read<atu8_data.byteLength; ib_read+=NB_CHUNK) {
			const ib_term = ib_read+NB_CHUNK;

			const atu8_chunk = atu8_data.subarray(ib_read, ib_term);

			const xc_p1 = ib_term >= atu8_data.byteLength? P1_APP.EOF: P1_APP.CNT;

			try {
				g_out = await this._frame(xc_p1, atu8_chunk, xc_ins);
			}
			catch(e_sign) {
				if(e_sign instanceof TransportStatusError) {
					if(ERR_CODES.REJECTED === e_sign['statusCode']) {
						throw new SignRejectedError();
					}
				}

				throw e_sign;
			}

			// stop on error
			if(g_out.error) break;
		}

		if(ERR_CODES.REJECTED === g_out.code) {
			throw new SignRejectedError();
		}

		return g_out;
	}
}
