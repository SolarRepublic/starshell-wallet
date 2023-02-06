<script lang="ts">
	import type {AccountStruct, AccountPath} from '#/meta/account';
	
	import type {ChainPath} from '#/meta/chain';
	
	import {createEventDispatcher} from 'svelte';
	
	import {Accounts} from '#/store/accounts';
	import {oderac} from '#/util/belt';
	
	import {yw_account_ref, yw_chain_ref} from '##/mem';
	
	import Load from '../ui/Load.svelte';
	import StarSelect, {type SelectOption} from '../ui/StarSelect.svelte';


	export let accountPath: AccountPath = $yw_account_ref;

	export let p_chain: ChainPath = $yw_chain_ref;
	
	const dispatch = createEventDispatcher();

	const mk_account = (p_acc: AccountPath, g_acc: AccountStruct) => ({
		value: p_acc,
		primary: g_acc.name,
		secondary: g_acc.assets[p_chain]?.totalFiatCache || '(?)',
		// secondary: format_fiat(g_acc.holdings(H_HOLDINGS, $yw_chain)
			// .reduce((c_sum, k_holding) => c_sum + k_holding.toUsd(H_TOKENS, H_VERSUS_USD), 0)),
	});

	let g_selected: SelectOption<AccountPath>;
	let a_options: typeof g_selected[];

	// reactively update the exported account ref binding
	$: if(g_selected) {
		accountPath = g_selected.value;
	}

	async function load_accounts() {
		const ks_accounts = await Accounts.read();

		a_options = oderac(ks_accounts.raw, mk_account);
		g_selected = a_options.find(g => accountPath === g.value)!;

		setTimeout(() => {
			dispatch('load');
		}, 5);

		return a_options;
	}
</script>


<style lang="less">
	@import '../_base.less';
</style>


<div class="sender">
	{#await load_accounts()}
		<Load forever />
	{:then a_options}
		<StarSelect id="sender-select"
			placeholder="Select account"
			secondaryClass='balance'
			items={a_options}
			bind:value={g_selected}
		/>
	{/await}
</div>