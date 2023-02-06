import type {AminoSignResponse, StdSignature, StdSignDoc} from '@cosmjs/amino';

import type {Writable} from 'ts-toolbelt/out/Object/Writable';

import type {AsJson} from '#/meta/belt';

export interface GenericAminoMessage {
	type: string;
	value: JsonValue;
}

interface InternalAdaptedStdSignDoc<
	a_msgs extends GenericAminoMessage[]=GenericAminoMessage[],
> extends Writable<StdSignDoc, string, 'deep'> {
	msgs: a_msgs;
}

export type AdaptedStdSignDoc = AsJson<InternalAdaptedStdSignDoc>;

export interface InternalAdaptedAminoResponse extends Writable<AminoSignResponse, string, 'deep'> {
	signed: AdaptedStdSignDoc;
}

export type AdaptedAminoResponse = AsJson<InternalAdaptedAminoResponse>;

export interface AdaptedStdSignature extends StdSignature {}
