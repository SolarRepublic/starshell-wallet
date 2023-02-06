<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ContractStruct} from '#/meta/chain';

	
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {forever} from '#/util/belt';
	
	import PfpDisplay from './PfpDisplay.svelte';
	import Field from '../ui/Field.svelte';
	import Load from '../ui/Load.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';


	export let contract: ContractStruct;

	export let isToken = false;

	export let concise = false;

	let g_chain: ChainStruct;

	let s_token_name: Promisable<string> = forever('');
	let s_token_detail = contract.name;

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;

		const g_snip20 = contract.interfaces.snip20;
		if(g_snip20) {
			s_token_name = g_snip20.symbol;
		}
		else {
			s_token_name = contract.name;
			s_token_detail = await Contracts.summarizeOrigin(contract.origin);
		}
	})();
</script>

<style lang="less">
	.chain-token {
		display: flex;

		>* {
			flex: 1;
		}

		.text {
			margin-left: 4px;
			vertical-align: middle;
		}
	}
</style>

{#if concise}
	<div class="chain-token" on:click={() => concise = !concise}>
		<span>
			{#if g_chain}
				<PfpDisplay dim={18}
					resource={g_chain}
					name={g_chain.reference}
				/>
				<span class="text">
					{g_chain.name}
				</span>
			{:else}
				<Load />
			{/if}
		</span>
		<span>
			{#await s_token_name}
				<Load />
			{:then s_token}
				<PfpDisplay dim={18}
					resource={contract}
					name={s_token}
				/>
				<span class="text">
					{s_token}
				</span>
			{/await}
		</span>
	</div>
{:else}
	<div class="chain-token" on:click={() => concise = !concise}>
		<Field key="chain" name="Chain" rootStyle="flex:auto;">
			{#if g_chain}
				<Row embedded
					resource={g_chain}
					name={g_chain.reference}
					detail={g_chain.name}
				/>
			{:else}
				<LoadingRows />
			{/if}
		</Field>

		<Field key="contract" name={isToken? 'Token': 'Contract'} rootStyle="flex:auto;">
			{#key s_token_name}
				<Row embedded
					resource={contract}
					name={s_token_name}
					detail={s_token_detail}
				/>
			{/key}
		</Field>
	</div>
{/if}
