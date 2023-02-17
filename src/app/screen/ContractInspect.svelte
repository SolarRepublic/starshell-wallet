<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ContractStruct} from '#/meta/chain';
	
	import type {Snip2xQueryRes} from '#/schema/snip-2x-const';
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {yw_account, yw_network} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {forever} from '#/util/belt';
	
	import Fields from '../ui/Fields.svelte';
	import Header from '../ui/Header.svelte';
	
	

	export let g_contract: ContractStruct;

	export let g_chain: ChainStruct;

	const {
		k_page,
	} = load_page_context();

	let s_balance_amount = '';

	const s_header_title = 'Contract';
	let s_header_post_title = '';
	let s_header_subtitle = '';
	const s_main_title: Promisable<string> = forever('');
	const s_main_post_title = '';
	const s_main_subtitle: Promisable<string> = forever('');

	let a_transfers: Awaited<Snip2xQueryRes<'transfer_history'>>['transfer_history']['txs'] = [];

	(async function load() {
		// on secret wasm chain
		if(g_chain.features.secretwasm) {
			// contract implements snip-20
			const k_token = Snip2xToken.from(g_contract, $yw_network as SecretNetwork, $yw_account);
			if(k_token) {
				s_header_post_title = 'SNIP-20';
				s_header_subtitle = `${g_contract.name} token`;

				s_balance_amount = (await k_token.balance()).balance.amount;

				if(k_token.snip21) {
					const a_txs = await k_token.transactionHistory();
				}
				else if(k_token.snip20) {
					a_transfers = (await k_token.transferHistory()).transfer_history.txs;
				}
			}
		}
	})();

</script>

<style lang="less">
	
</style>

<Screen nav>
	<Header pops account
		title={s_header_title}
		postTitle={s_header_post_title}
		subtitle={s_header_subtitle}
	/>
	
	<h3>
		Query Inspector
	</h3>

	<div>
		<Fields configs={[
			{
				type: 'key_value',
				key: 'Balance',
				value: s_balance_amount,
			},
			JsonPreviewer.render(a_transfers, {
				chain: g_chain,
			}, {
				title: 'Transfers',
			}),
		]} />
	</div>
</Screen>
