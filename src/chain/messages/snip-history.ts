import type {ReviewedMessage} from './_types';

import type {AccountStruct} from '#/meta/account';
import type {Promisable} from '#/meta/belt';
import type {ChainStruct, ContractStruct} from '#/meta/chain';
import type {TokenStructDescriptor} from '#/meta/token';
import type {TransferHistoryItem} from '#/schema/snip-2x-def';

import BigNumber from 'bignumber.js';

import {address_to_name} from './_util';

import type {NotifyItemConfig} from '#/extension/notifications';
import {Chains} from '#/store/chains';
import {format_amount} from '#/util/format';


export type SelectTransactionHistoryItem = Pick<TransferHistoryItem, 'from' | 'receiver' | 'coins' | 'memo'>;

type HistoryHandler = Record<'transfer', (g_tx: SelectTransactionHistoryItem, g_context: {
	g_snip20: TokenStructDescriptor<'snip20'>['snip20'];
	g_contract: ContractStruct;
	g_chain: ChainStruct;
	g_account: AccountStruct;
}) => Promisable<{
	apply?(): Promisable<NotifyItemConfig | void>;

	review?(): Promisable<ReviewedMessage>;
}>>;

export const H_SNIP_TRANSACTION_HISTORY_HANDLER: HistoryHandler = {
	async transfer(g_tx, {g_snip20, g_contract, g_chain, g_account}) {
		const sa_from = g_tx.from!;

		// attempt to parse the amount
		const xg_amount = BigNumber(g_tx.coins.amount).shiftedBy(-g_snip20.decimals);

		const s_payload = `${format_amount(xg_amount.toNumber())} ${g_snip20.symbol}`;

		const s_from = await address_to_name(sa_from, g_chain);

		const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

		const s_recipient = await address_to_name(sa_owner, g_chain);

		return {
			apply: () => ({
				group: nl => `Token${1 === nl? '': 's'} Received`,
				title: `💰 Received ${s_payload}`,
				message: `${s_from} transferred to ${s_recipient} on ${g_chain.name}`,
			}),

			review: () => ({
				title: `Received ${s_payload}`,
				infos: [
					`on ${g_chain.name}`,
					`from ${s_from}`,
				],
				resource: g_contract,
				fields: [
					{
						type: 'key_value',
						key: 'Amount',
						value: s_payload,
					},
					{
						type: 'contacts',
						bech32s: [sa_from],
						g_chain,
						label: 'Sender',
					},
					{
						type: 'memo',
						value: g_tx.memo || '',
					},
				],
			}),
		};
	},
};
