<script lang="ts">
	import type {ContractStruct} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	
	import {Header, Screen} from './_screens';
	import {starshell_transaction} from '../helper/starshell';
	
	import {yw_account, yw_chain, yw_network} from '../mem';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Contracts} from '#/store/contracts';
	
	import AmountInput from '../frag/AmountInput.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	

	export let g_contract: ContractStruct;

	const g_snip20 = g_contract.interfaces.snip20!;
	const s_symbol = g_snip20.symbol;
	const s_chain = $yw_chain.name;

	let b_use_max = false;
	let s_err_amount = '';
	let s_amount = '';
	let n_decimals = 0;

	$: b_form_valid = s_amount && !s_err_amount;
	
	async function submit() {
		const s_tokens = BigNumber(s_amount).shiftedBy(n_decimals).toString() as Cw.Uint128;

		const g_redeem = await Snip2xMessageConstructor.redeem(
			$yw_account,
			g_contract,
			$yw_network as SecretNetwork,
			s_tokens
		);

		starshell_transaction([g_redeem.proto], $yw_chain.features.secretwasm!.snip20GasLimits.redeem);
	}
</script>

<style lang="less">
	
</style>

<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
}}>
	<Header pops
		title={'Unwrapping'}
		postTitle={s_symbol}
		subtitle={s_chain}
	/>

	<p>
		Converts this privacy token back into its native coin format.
	</p>

	<hr class="no-margin">

	<Field short key='amount' name='Amount'>
		<AmountInput
			assetPath={Contracts.pathFrom(g_contract)}
			symbol={s_symbol}
			bind:useMax={b_use_max}
			bind:error={s_err_amount}
			bind:value={s_amount}
			bind:decimals={n_decimals}
		/>
	</Field>

	<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid]} />
</Screen>
