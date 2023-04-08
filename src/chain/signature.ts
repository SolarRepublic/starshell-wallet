import type {SignedDoc} from './signing';

import type {U} from 'ts-toolbelt';

import type {AdaptedAminoResponse} from '#/schema/amino';

export type SignaturePreset = '' | 'snip24' | 'snip20ViewingKey'
| 'wasm/MsgExecuteContract' | 'wasm/MsgInstantiateContract';

export interface CompletedProtoSignature {
	proto: SignedDoc;
}

export interface CompletedAminoSignature {
	amino: AdaptedAminoResponse;
}

export type CompletedSignature = Partial<U.Merge<CompletedAminoSignature | CompletedProtoSignature>>;
