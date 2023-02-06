import type {U} from 'ts-toolbelt';

import type {AsJson, Dict, JsonObject} from '#/meta/belt';


export interface BlockIdFrag {
	hash: string;
	parts: {
		total: number;
		hash: string;
	};
}

export interface TjrwsValueNewBlock {
	block: {
		header: {
			version: {
				block: `${bigint}`;
			};
			chain_id: string;
			height: `${bigint}`;
			time: string;
			last_block_id: BlockIdFrag;
			last_commit_hash: string;
			data_hash: string;
			validators_hash: string;
			next_validators_hash: string;
			consensus_hash: string;
			app_hash: string;
			last_results_hash: string;
			evidence_hash: string;
			proposer_address: string;
		};

		data: {
			txs: [];
		};

		evidence: {
			evidence: [];
		};

		last_commit: {
			height: `${bigint}`;
			round: number;
			block_id: BlockIdFrag;
			signatures: {
				block_id_flag: number;
				validator_address: string;
				timestamp: string;
				signature: string;
			}[];
		};
	};
	result_begin_block: {};
	result_end_block: {};
}


export interface WsTxResultAny {
	gas_used: string;
	gas_wanted: string;
	log: string;
	timestamp: string;
}

export interface WsTxResultError extends WsTxResultAny {
	code: number;
	codespace: string;
}

export interface WsTxResultSuccess extends WsTxResultAny {
	events: {
		type: string;
		attributes: {
			key: string;
			value: string;
			index?: boolean;
		}[];
	}[];
	data?: string;
}

export interface WsTxResponse {
	code?: 0;
	hash: string;
	height: string;
	tx: string;
	result: U.Strict<WsTxResultError | WsTxResultSuccess>;
}

export interface TjrwsValueTxResult {
	TxResult: WsTxResponse;
}

export interface TjrwsResult<w_value extends {}=JsonObject> {
	query: string;
	data: {
		type: string;
		value: AsJson<w_value>;
	};
	events: Dict<string[]>;
}
