import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';

import {yw_account_ref, yw_chain, yw_navigator} from '../mem';

import {G_APP_STARSHELL} from '#/store/apps';

import RequestSignature from '../screen/RequestSignature.svelte';


export function starshell_transaction(a_msgs_proto: Any[], s_gas_limit: `${bigint}` | ''=''): void {
	yw_navigator.get().activePage.push({
		creator: RequestSignature,
		props: {
			protoMsgs: a_msgs_proto,
			fee: {
				limit: s_gas_limit || '',
			},
			broadcast: true,
			local: true,
		},
		context: {
			chain: yw_chain.get(),
			accountPath: yw_account_ref.get(),
			app: G_APP_STARSHELL,
		},
	});
}
