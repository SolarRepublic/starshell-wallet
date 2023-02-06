import type {AdaptedStdSignDoc} from './amino';

import type {Coin} from '@cosmjs/amino';

import type {JsonObject} from '#/meta/belt';
import type {Bech32, ChainStruct, KnownChain} from '#/meta/chain';
import type {Cw} from '#/meta/cosm-wasm';


export interface WasmAminoMsg<
	g_chain extends ChainStruct=ChainStruct,
	si_hrp extends string=g_chain['bech32s']['acc'],
> extends JsonObject {
	type: 'wasm/MsgExecuteContract';
	value: {
		sender: Cw.Bech32<si_hrp>;
		contract: Cw.Bech32<si_hrp>;
		msg: string;
		sent_funds?: Coin[];
	};
}

export interface WasmTx<
	g_chain extends ChainStruct=ChainStruct,
	g_wasm_msg extends WasmAminoMsg<g_chain>=WasmAminoMsg<g_chain>,
> extends AdaptedStdSignDoc {
	chain_id: g_chain['reference'];
	account_number: Cw.Uint128;
	sequence: Cw.Uint128;
	fee: {
		gas: Cw.Uint128;
		amount: [
			{
				denom: string;
				amount: Cw.Uint128;
			},
		];
	};
	msgs: [g_wasm_msg];
	memo: string;
}
