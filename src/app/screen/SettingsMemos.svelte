<script lang="ts">
	import type {Intent} from '../svelte';
	
	import type {ChainStruct, ChainPath} from '#/meta/chain';
	
	import Toggle from '@solar-republic/svelte-toggle';
	import {getContext} from 'svelte';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_owner, yw_settings} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import {Chains} from '#/store/chains';
	import {Providers, UnpublishedAccountError} from '#/store/providers';
	import {Settings, type SettingsRegistry} from '#/store/settings';
	
	import {microtask} from '#/util/belt';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Header from '../ui/Header.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	

	const {k_page} = load_page_context();
	const g_intent = getContext<Intent | null>('intent') || null;

	// whether the settings are busy being adjusted
	let b_busy = false;

	// cached memo settings
	let h_settings: NonNullable<SettingsRegistry['e2e_encrypted_memos']> = $yw_settings.e2e_encrypted_memos || {};
	// (async function load() {
	// 	h_settings = $yw_settings.e2e_encrypted_memos || {};
	// })();

	async function toggle_chain(p_chain: ChainPath, g_chain: ChainStruct, b_state: boolean) {
		// do not apply if busy
		if(b_busy) return;

		// set toggle as busy
		b_busy = true;

		// refetch memo setting per chain
		h_settings = $yw_settings.e2e_encrypted_memos || {};

		// setting does not yet exist for chain; initialize
		if(!h_settings[p_chain]) {
			h_settings[p_chain] = {
				enabled: false,
				published: false,
			};
		}

		// ref context
		const g_setting = h_settings[p_chain]!;

		// update enabled state
		g_setting.enabled = b_state;

		// enabling
		if(b_state) {
			// check if user is published
			try {
				// create network provider
				const ks_providers = await Providers.read();
				let k_network: CosmosNetwork | undefined;
				for(const [p_provider, g_provider] of ks_providers.entries()) {
					const p_chain_test = g_provider.chain;
					if(p_chain === p_chain_test) {
						k_network = Providers.activate(g_provider, g_chain);
						break;
					}
				}

				if(!k_network) {
					throw new Error(`No network provider found for ${p_chain}`);
				}

				// lookup account
				await k_network.e2eInfoFor($yw_owner!);

				// set published status
				g_setting.published = true;
			}
			catch(e_info) {
				// update setting
				g_setting.enabled = g_setting.published = false;

				// unpublished account
				if(e_info instanceof UnpublishedAccountError) {
					syserr({
						title: 'Account Unpublished',
						text: `In order to enable private memos on ${g_chain.name}, you must first send at least one transaction.`,
					});
				}
				// other
				else {
					syserr({
						title: e_info.constructor.name,
						error: e_info,
					});
				}
			}
		}

		// update entry
		await Settings.set('e2e_encrypted_memos', h_settings);

		// reactive update
		h_settings = h_settings;

		await microtask();

		b_busy = false;
	}
</script>

<style lang="less">
	
</style>

<Screen
	debug='SettingsMemos'
>
	<Header
		plain
		pops
		account
		title='Settings'
		subtitle='Memos'
	></Header>

	<h3>Private Memos for {$yw_account.name}</h3>

	<div class="rows no-margin">
		{#await Chains.read()}
			<LoadingRows count={5} />
		{:then ks_chains}
			{#each ks_chains.entries() as [p_chain, g_chain]}
				<Row
					resource={g_chain}
					resourcePath={p_chain}
				>
					<svelte:fragment slot="right">
						<Toggle size={20}
							on="On" off="Off"
							disabled={b_busy}
							on:toggle={d_event => toggle_chain(p_chain, g_chain, d_event.detail)}
							toggled={!!(h_settings[p_chain]?.enabled && h_settings[p_chain]?.published)}
						/>
					</svelte:fragment>
				</Row>
			{/each}
		{/await}
	</div>

	{#if g_intent}
		<ActionsLine confirm={['Done', () => k_page.pop(), b_busy]} />
	{/if}
</Screen>
