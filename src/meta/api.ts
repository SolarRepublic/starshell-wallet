import type {Caip2, ChainStruct} from './chain';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {Dict, JsonObject} from '#/meta/belt';
import type { AccountPath } from './account';

export type Truthy = 1 | true | {};


/**
 * Generic manifest interface will always have a schema field
 */
export interface ConnectionManifest extends JsonObject {
	schema: string;
}

// export interface Whip003Chain {
// 	namespace: ChainNamespaceKey;
// 	reference: string;
// 	label: string;
// 	bech32s: string | Dict;
// }

// export interface Whip003Coin {
// 	chain: Caip2.String;
// 	slip44: number;
// 	symbol: string;
// 	label: string;
// }


export type AugmentedChainStruct = Merge<{
	pfp: undefined | '' | `data:image/png;base64,${string}`;
}, ChainStruct>;


/**
 * V1 of the manifest for connection requests
 */
export interface ConnectionManifestV1 extends ConnectionManifest {
	/**
	 * Indicates the schema version of this connection manifest
	 */
	schema: '1';

	/**
	 * Dict of all chains involved in request, keyed by their CAIP-2 identifier. Unused chains will be ignored
	 */
	chains: Record<Caip2.String, AugmentedChainStruct>;

	/**
	 * Dict of all sessions to request, keyed by arbitrary ids supplied by application
	 */
	sessions: Dict<SessionRequest>;

	/**
	 * For now, use a single account path
	 */
	accountPath: AccountPath;
}



/**
 * 
 */
export interface SessionRequest extends JsonObject {
	/**
	 * Identifies which chain this session request is for
	 */
	caip2: Caip2.String;

	/**
	 * Requests ability to export potential personally identifiable information
	 */
	doxx?: DoxxRequest;

	/**
	 * Requests ability to query the chain
	 */
	query?: QueryRequest;

	/**
	 * 
	 */
	signature?: {};

	/**
	 * 
	 */
	broadcast?: {};
}



/**
 * 
 */
export interface DoxxRequest extends JsonObject {
	/**
	 * Requests ability to export user's address and public keys
	 */
	address?: {
		/**
		 * Apps must provide a justification for why they need to export users' address and public keys
		 */
		justification: string;
	};

	/**
	 * Requests ability to export user's given account name
	 */
	name?: Truthy;
}


export interface ContractDescriptor extends JsonObject {
	contractAddress: string;
	codeHash: string;
	label?: string;
	icon?: string;  // data URL of wither image/webp or image/png
}


export interface QueryRequest extends JsonObject {
	/**
	 * Requests ability to query information that may identify the exact node the wallet is querying
	 */
	node?: {
		/**
		 * Apps must provide a justification for why they need node information
		 */
		justification: string;
	};

	/**
	 * Requests ability to query the specified contracts
	 */
	contracts?: ContractDescriptor[];

	events?: {};

	permit?: {};

}

export interface SignatureRequest extends JsonObject {
	/**
	 * 
	 */

}


// export interface SessionResponse {
// 	query: {
// 		node?: boolean;
// 	};
// 	broadcast: {};
// 	doxx?: {
// 		name?: boolean;
// 		address?: boolean;
// 	};
// }


// export interface ConnectionResponse {
// 	accounts: {
// 		name: string;
// 		address: Bech32;
// 		pubkey: string;
// 	}[];

// 	sessions: Dict<SessionResponse>;
// }

