<script lang="ts">
	import type {ContractStruct} from '#/meta/chain';
	
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {Contracts} from '#/store/contracts';
	
	import TokenRow from '../frag/TokenRow.svelte';
	import Header from '../ui/Header.svelte';
	import { yw_account, yw_chain, yw_chain_ref } from '../mem';
	import { ode } from '#/util/belt';
	

	const {
		k_page,
	} = load_page_context();

	let a_tokens: ContractStruct[] = [];

	(async function init() {
		const a_snips = await Contracts.filterTokens({
			interfaces: {
				snip20: {},
			},
		});

		const a_hidden = ode($yw_account.assets[$yw_chain_ref]?.data || {}).filter(([, g]) => g.hidden).map(([sa]) => sa);

		a_tokens = a_snips.filter(g => a_hidden.includes(g.bech32));
	})();
</script>

<style lang="less">
	
</style>

<Screen nav slides>
	<Header title="Hidden Tokens" pops search account />
	
	<div class="rows no-margin">
		{#each a_tokens as g_token}
			<TokenRow contract={g_token} />
		{/each}
	</div>
</Screen>
