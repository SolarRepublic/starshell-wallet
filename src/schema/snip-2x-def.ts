import type {Snip20} from './snip-20-def';
import type {Snip21} from './snip-21-def';
import type {Snip24} from './snip-24-def';
import type {AminoMsg} from '@cosmjs/amino';
import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
import type {A, O, U} from 'ts-toolbelt';

import type {Explode} from '#/meta/belt';
import type {Cwm} from '#/meta/cosm-wasm';

export interface PortableMessage {
	amino: AminoMsg;
	proto: Any;
}

export type TransactionHistoryItem = Snip21.BaseQueryResponse<'transaction_history'>['transaction_history']['txs'][number];

export type TransferHistoryItem = Snip21.BaseQueryResponse<'transfer_history'>['transfer_history']['txs'][number];

export namespace Snip2x {
	export type AnyMessageKey = Snip20.AnyMessageKey | Snip21.AnyMessageKey | Snip24.AnyMessageKey;

	export type AnyMessageParameters<
		as_keys extends AnyMessageKey=AnyMessageKey,
	> = Explode<Pick<Cwm.MergeInterfaces<[
		Snip24.AnyMessageParameters,
		Snip21.AnyMessageParameters,
		Snip20.AnyMessageParameters,
	]>, as_keys>>;

	export type AnyMessageResponse<
		as_keys extends AnyMessageKey=AnyMessageKey,
	> = Explode<Pick<Cwm.MergeInterfaces<[
		Snip24.AnyMessageResponse,
		Snip21.AnyMessageResponse,
		Snip20.AnyMessageResponse,
	]>, as_keys>>;


	export type AnyQueryKey = Snip20.AnyQueryKey | Snip21.AnyQueryKey | Snip24.AnyQueryKey;

	export type AnyQueryParameters<
		as_keys extends AnyQueryKey=AnyQueryKey,
	> = Explode<Pick<Cwm.MergeInterfaces<[
		Snip24.AnyQueryParameters,
		Snip21.AnyQueryParameters,
		Snip20.AnyQueryParameters,
	]>, as_keys>>;

	export type AnyQueryResponse<
		as_keys extends AnyQueryKey=AnyQueryKey,
	> = Explode<Pick<Cwm.MergeInterfaces<[
		Snip24.AnyQueryResponse,
		Snip21.AnyQueryResponse,
		Snip20.AnyQueryResponse,
	]>, as_keys>>;
}
