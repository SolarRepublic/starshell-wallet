<script lang="ts">
	import type {ProviderStruct} from '#/meta/provider';
	
	import {Screen, Header} from './_screens';

	import {Chains} from '#/store/chains';
	
	import Portrait from '../frag/Portrait.svelte';
	

	export let provider: ProviderStruct;
</script>

<style lang="less">

</style>


<Screen nav slides>
	<Header pops search network account
		title='Provider Details'
	>
	</Header>

	{#await Chains.read()}		
		<Portrait loading />
	{:then ks_chains}
		<Portrait
			resource={provider}
		>
			<!-- subtitle={g_chain.def.label} -->
		</Portrait>
	{/await}



</Screen>