<script lang="ts">
	import {getContext} from 'svelte';
	
	import {Screen, SubHeader, type Page} from './_screens';
	
	import {Chains} from '#/store/chains';
	import {Providers} from '#/store/providers';
	
	import ProviderView from './ProviderView.svelte';
	import Header from '../ui/Header.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	

	const k_page = getContext<Page>('page');

	let ks_chains: Awaited<ReturnType<typeof Chains.read>>;
	let ks_providers: Awaited<ReturnType<typeof Providers.read>>;
	async function load_providers() {
		[
			ks_chains,
			ks_providers,
		] = await Promise.all([
			Chains.read(),
			Providers.read(),
		]);

		return ks_providers.entries();
	}

	// function add_new_network() {
	// 	k_page.push({
	// 		creator: ProviderCreate,
	// 	});
	// }
</script>

<style lang="less">
	
</style>

<Screen debug='ProvidersHome' nav root>
	<Header search network account />

	<SubHeader bare
		title='Providers'
	/>
		<!-- on:add_new={add_new_network} -->

	<div class="rows no-margin">
		{#await load_providers()}
			<LoadingRows count={3} />
		{:then a_providers} 
			{#each a_providers as [p_provider, g_provider]}
				{@const g_chain = ks_chains.at(g_provider.chain)}
				<Row
					resource={g_provider}
					resourcePath={p_provider}
					iconClass={'square pfp'}
					detail={`${g_chain?.name} (${g_chain?.reference})`}
					on:click={() => {
						k_page.push({
							creator: ProviderView,
							props: {
								providerPath: p_provider,
							},
						});
					}}
				>
				</Row>
			{/each}
		{/await}
	</div>
</Screen>