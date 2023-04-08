<script lang="ts">
	import type {AppPath, AppStruct} from '#/meta/app';
	
	import type {ChainPath} from '#/meta/chain';
	
	import {getContext} from 'svelte';
	
	import {Screen, SubHeader, type Page} from './_screens';
	
	import {yw_chain, yw_chain_ref, yw_network} from '../mem';
	
	import {W_FILTER_ACCEPT_ANY} from '#/store/_base';
	import {Apps} from '#/store/apps';
	import {open_external_link} from '#/util/dom';
	
	import AppView from './AppView.svelte';
	import Header from '../ui/Header.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';


	const k_page = getContext<Page>('page');

	let a_apps_other: [AppPath, AppStruct][];

	let nl_other_apps = 0;
	let nl_chains = 0;

	async function load_apps() {
		// select all apps on current chain
		const a_apps = await Apps.filter({
			on: 1,
			connections: {
				[$yw_chain_ref]: W_FILTER_ACCEPT_ANY,
			},
		});

		// convert to set
		const as_apps = new Set(a_apps.map(([p_app]) => p_app));

		// select all other apps
		a_apps_other = (await Apps.filter({on:1})).filter(([p_app]) => !as_apps.has(p_app));
		nl_other_apps = a_apps_other.length;

		// union of chains touched by other apps
		let as_chains = new Set<ChainPath>();
		for(const [, g_app] of a_apps_other) {
			as_chains = new Set([...as_chains, ...Object.keys(g_app.connections) as ChainPath[]]);
		}

		// exclude this chain
		as_chains.delete($yw_chain_ref);

		// cache size
		nl_chains = as_chains.size;

		return a_apps.reverse();
	}

	let c_updates = 0;
	yw_network.subscribe(() => c_updates++);
</script>

<style lang="less">
	.other-apps {
		text-align: center;
		padding: 1.5em 0;
		color: var(--theme-color-text-med);
		font-size: 13px;
	}
</style>

<Screen nav root debug='AppsHome' classNames="apps">
	<Header search network account />

	<SubHeader bare
		title='Apps - {$yw_chain.name}'
	/>

	<div class="rows no-margin">
		{#key c_updates}
			{#await load_apps()}
				<LoadingRows count={3} />
			{:then a_apps} 
				{#each a_apps as [p_app, g_app]}
					<Row
						pfp={g_app.pfp}
						name={g_app.name}
						detail={g_app.host}
						resourcePath={p_app}
						iconClass={'square pfp'}
						on:click={() => {
							k_page.push({
								creator: AppView,
								props: {
									app: g_app,
								},
							});
						}}
					>
						<svelte:fragment slot="right">
							<button class="pill" on:click|stopPropagation={() => open_external_link(`${g_app.scheme}://${g_app.host}/`, {exitPwa:true})}>
								Launch
							</button>
						</svelte:fragment>

						<!-- TODO: enable tags -->
						<!-- <svelte:fragment slot="tags">
							<InlineTags subtle resourcePath={p_app} />
						</svelte:fragment> -->
					</Row>
				{/each}

				{#if !a_apps.length}
					<div class="other-apps">
						You don't have any apps on this chain yet.
					</div>
				{/if}

				<div class="other-apps">
					{0 === nl_other_apps? 'No': nl_other_apps}{a_apps.length? ' more': ''} app{1 === nl_other_apps? '': 's'} on other chain{1 === nl_chains? '': 's'}.
				</div>
			{/await}
		{/key}
	</div>
</Screen>