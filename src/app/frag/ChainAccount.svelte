<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {ChainStruct} from '#/meta/chain';

	import {yw_overlay_account, yw_overlay_network} from '../mem';
	
	import PfpDisplay from './PfpDisplay.svelte';
	import Load from '../ui/Load.svelte';


	export let g_account: AccountStruct;

	export let g_chain: ChainStruct;

	export let sx_root_style = '';
</script>

<style lang="less">
	@import '../_base.less';

	.chain-account {
		display: flex;
		background-color: fade(@theme-color-graydark, 50%);
		padding: 0.5em;
		border-radius: 8px;
		border: 1px solid var(--theme-color-border);

		>* {
			flex: 1;
		}

		.text {
			margin-left: 4px;
			vertical-align: middle;
		}
	}
</style>

<div class="chain-account" style={sx_root_style}>
	<span on:click={() => $yw_overlay_account = true}>
		<PfpDisplay dim={18}
			resource={g_account}
		/>
		<span class="text">
			{g_account.name}
		</span>
	</span>
	<span on:click={() => $yw_overlay_network = true}>
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
</div>