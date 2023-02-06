
export interface StackProof {
	stack: string;
	signature: string;
}

export interface Verification {
	proof: StackProof;
	signature: string;
}

export type VerificationCallback = () => Verification;

export type Channel = (s_msg: string) => void;

export interface SafeBundle {
	// custom interfaces
	verifiableStack(): StackProof;
	verify(f_caller: VerificationCallback): Channel;

	// native functions and classess
	addEventListener: Window['addEventListener'];
	postMessage: Window['postMessage'];
	MessageChannel: MessageChannel;
	Error: ErrorConstructor;
	Object: ObjectConstructor;
	Reflect: typeof window['Reflect'];
}

// /**
//  * Generic manifest interface will always have a schema field
//  */
// export interface ConnectionManifest extends JsonObject {
// 	schema: string;
// }


// /**
//  * V1 of the manifest for connection requests
//  */
// export interface ConnectionManifestV1 extends ConnectionManifest {
// 	schema: '1';
// 	chains: ChainDescriptor[];
// }


// export interface ContractDescriptor extends JsonObject {
// 	contractAddress: string;
// 	codeHash: string;
// 	label?: string;
// 	icon?: string;  // data URL of wither image/webp or image/png
// }


// interface ChainPermission extends JsonObject {
// 	doxx?: {};
// 	query?: {
// 		contracts: Array<ContractDescriptor>;
// 	};
// }

interface ChainNamespaces {
	cosmos: {};
	ethereum: {};
}

interface ChainCategories {
	testnet: {};
	mainnet: {};
}

// interface ParametricChainDescriptor<
// 	si_namespace extends keyof ChainNamespaces,
// 	si_chain extends string,
// 	s_name extends string,
// 	s_category extends keyof ChainCategories='mainnet',
// > extends JsonObject {
// 	namespace: si_namespace;
// 	reference: si_chain;
// 	category: s_category;
// 	name?: s_name;
// 	icon?: string;
// 	permissions?: ChainPermission[];
// }

// export type KnownChainDescriptor = 
// 	| ParametricChainDescriptor<'cosmos', 'secret-4', 'Secret Network'>;


// export type UnknownChainDescriptor = ParametricChainDescriptor<keyof ChainNamespaces, string, string, keyof ChainCategories>;

// export type ChainDescriptor = KnownChainDescriptor | UnknownChainDescriptor;


export interface Advertisement {
	isStarShell?: boolean;

}

export interface ChainHandle {

}

export interface BlockInfoHeader {
	chain_id: string;
	time: string;
	height: string;
}


// export interface ConnectionHandle {
// 	coverage: string;
// 	approved: string[];
// 	denied: string[];
// 	native: Window;
// 	chains: ChainHandle[];
// }


