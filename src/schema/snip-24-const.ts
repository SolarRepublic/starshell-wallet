import type {Snip24PermitMsg, Snip24Permission, Snip24Tx} from './snip-24-def';

const A_SNIP_24_PERMISSIONS: Snip24Permission[] = [
	'balance',
	'history',
	'allowance',
	'owner',
];

export const Snip24 = {
	PERMISSIONS: A_SNIP_24_PERMISSIONS,

	query_permit(si_chain: string, g_permit_msg: Snip24PermitMsg): Snip24Tx {
		return {
			chain_id: si_chain,
			account_number: '0',
			sequence: '0',
			fee: {
				gas: '1',
				amount: [
					{
						denom: 'uscrt',
						amount: '0',
					},
				],
			},
			msgs: [g_permit_msg],
			memo: '',
		};
	},
};
