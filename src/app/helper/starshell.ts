import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';

import {yw_account_ref, yw_chain, yw_navigator} from '../mem';

import {G_APP_STARSHELL} from '#/store/apps';

import RequestSignature from '../screen/RequestSignature.svelte';


export function starshell_transaction(a_msgs_proto: Any[], z_gas_limit: bigint|`${bigint}` | ''=''): void {
	yw_navigator.get().activePage.push({
		creator: RequestSignature,
		props: {
			protoMsgs: a_msgs_proto,
			fee: {
				limit: `${z_gas_limit}` || '',
			},
			broadcast: {},
			local: true,
		},
		context: {
			chain: yw_chain.get(),
			accountPath: yw_account_ref.get(),
			app: G_APP_STARSHELL,
		},
	});
}
