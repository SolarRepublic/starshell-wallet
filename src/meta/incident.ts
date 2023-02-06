import type {AccountPath} from './account';
import type {AppApiMode, AppChainConnection, AppPath} from './app';
import type {Bech32, ChainPath} from './chain';
import type {Cw} from './cosm-wasm';
import type {Resource} from './resource';
import type {SecretPath} from './secret';
import type {O} from 'ts-toolbelt';
import type {Cast} from 'ts-toolbelt/out/Any/Cast';

import type {Dict, JsonObject} from '#/meta/belt';


export type SignedJsonEventRegistry = {};

export type MsgEventRegistry = {
	coin_received?: {
		receiver: Cw.Bech32;
		amount: Cw.Amount;
	}[];

	coin_spent?: {
		spender: Cw.Bech32;
		amount: Cw.Amount;
	}[];

	message?: {
		action: Cw.String;
		sender: Cw.Bech32;
		module: Cw.String;
		contract_address?: Cw.Bech32;
	}[];

	transfer?: {
		sender: Cw.Bech32;
		recipient: Cw.Bech32;
		amount: Cw.Amount;
	}[];

	// custom
	executions?: {
		contract: Cw.Bech32;
		msg: JsonObject;
	}[];

	set_feegrant?: {
		grantee: Cw.Bech32;
		granter: Cw.Bech32;
	}[];

	use_feegrant?: {
		grantee: Cw.Bech32;
		granter: Cw.Bech32;
	}[];
};

export type MsgEventKey = keyof MsgEventRegistry;

export type MsgEvent<
	si_key extends MsgEventKey=MsgEventKey,
> = MsgEventRegistry[si_key];


interface ChainAccount extends JsonObject {
	// chain that this incident occurred on
	chain: ChainPath;

	// the involved account
	account: AccountPath;
}

interface AppChainAccount extends ChainAccount {
	app: AppPath;
}


export interface TxMsg extends JsonObject {
	events: Partial<MsgEventRegistry>;
}

export type TxModeInfo = {
	single: {
		mode: number;
	};
} | {
	multi: {
		bitarray: string;
		modeInfos: TxModeInfo[];
	};
};

export interface TxSigner extends JsonObject {
	pubkey: string;
	sequence: Cw.Uint128;
	mode_info: TxModeInfo;
}


export interface TxCore extends ChainAccount {
	// txResponse.code
	code: number;

	// txResponse.rawLog
	raw_log: string;

	// // addresses that this transaction is affiliated with
	// owners: Bech32[];

	// txResponse.txhash
	hash: string;

	// tx.authInfo.fee.gasLimit
	gas_limit: Cw.Uint128;

	// txResponse.gasWanted
	gas_wanted: Cw.Uint128;

	// txResponse.gasUsed
	gas_used: Cw.Uint128;

	msgs: {
		typeUrl: string;
		value: string;
	}[];

	// txResponse.logs[]
	// events for this tx
	events: Partial<MsgEventRegistry>;

	// coin: string;
	// msg: JsonMsgSend;
	// raw: string;
}

export interface TxOutgoing {
	// app that initiated the transaction
	app: AppPath | null;
}

export interface TxPending extends TxCore, TxOutgoing {
	// indicates a pending outgoing transaction
	stage: 'pending';

	// // the account that initiated the transaction
	// owner: Bech32;
}

export interface TxPartial extends TxCore {
	// txResponse.height
	height: Cw.Uint128;

	// txResponse.timestamp
	timestamp: Cw.String;
}

export interface TxConfirmed extends TxPartial {
	stage: 'confirmed';
}

export interface TxSynced extends TxPartial, TxOutgoing {
	stage: 'synced';

	// tx.authInfo.signerInfos
	signers?: TxSigner[];

	// tx.authInfo.fee
	fee_amounts?: Cw.Coin[];

	// tx.authInfo.fee.payer
	payer?: Cw.Bech32 | '';

	// tx.authInfo.fee.granter
	granter?: Cw.Bech32 | '';

	// tx.body.memo
	memo: string;

	// approximate equivalent fiat values
	fiats: Dict<number>;
}

export interface TxError extends TxCore, TxOutgoing {
	stage: 'synced';

	codespace: string;

	log: string;
}

export interface TxAbsent extends TxCore, TxOutgoing {
	stage: 'absent';
}

type TxStageKey = (TxPending | TxConfirmed | TxSynced)['stage'];

interface InboundTokenTransfer extends ChainAccount {
	// contract bech32
	bech32: Bech32;

	// hash of tx in query cache
	hash: string;
}

export type IncidentRegistry = {
	// tx_out: {
	// 	pending: TxPending;
	// 	confirmed: TxConfirmed;
	// 	synced: TxSynced;
	// 	// [si_each in TxStageKey]: TxPending | TxConfirmed | TxSynced;
	// }[TxStageKey];

	tx_out: TxPending | TxSynced | TxError | TxAbsent;

	tx_in: TxSynced;

	token_in: InboundTokenTransfer;

	account_created: {
		account: AccountPath;
	};

	account_edited: {
		account: AccountPath;

		/**
		 * [key, before, after]
		 */
		deltas: [string, string, string][];
	};

	signed_json: O.Merge<AppChainAccount, {
		json: JsonObject;
	}>;

	signed_query_permit: O.Merge<AppChainAccount, {
		secret: SecretPath<'query_permit'>;
	}>;

	shared_query_permit: {
		secret: SecretPath<'query_permit'>;
		apps: AppPath[];
	};

	shared_viewing_key: {
		secret: SecretPath<'viewing_key'>;
		apps: AppPath[];
	};

	app_connected: {
		app: AppPath;
		accounts: AccountPath[];
		api: AppApiMode;
		connections: Record<ChainPath, AppChainConnection>;
	};
};

export type IncidentType = Cast<keyof IncidentRegistry, string>;

export namespace Incident {
	export type Struct<
		si_type extends IncidentType=IncidentType,
	> = {
		[si_each in IncidentType]: {
			type: si_each;
			id: string;
			time: number;
			data: IncidentRegistry[si_each];
		}
	}[si_type];
}

// {
// 	type IncidentTest = Incident.Struct;
// 	type merged = {
// 		[si_each in IncidentType]: Merge<Partial<Pick<Incident.Struct<si_each>, 'id' | 'time'>>, Omit<Incident.Struct<si_each>, 'id' | 'time'>>
// 	}[IncidentType];

// }


export type Incident<
	si_type extends IncidentType=IncidentType,
	si_id extends string=string,
> = Resource.New<{
	segments: [`incident.${si_type}`, `id.${si_id}`];
	struct: Incident.Struct<si_type>;
}>;

export type IncidentPath<
	si_type extends IncidentType=IncidentType,
> = Resource.Path<Incident<si_type>>;

export type IncidentStruct<
	si_type extends IncidentType=IncidentType,
> = Incident<si_type>['struct'];
