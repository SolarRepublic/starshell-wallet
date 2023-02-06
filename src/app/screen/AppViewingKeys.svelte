<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {Bech32, ContractStruct} from '#/meta/chain';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {onDestroy} from 'svelte';
	
	import {Screen} from './_screens';
	import {yw_account, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	import {reloadable} from '../mem-store';
	import {load_page_context} from '../svelte';
	
	import {produce_contracts} from '#/chain/contract';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Secrets} from '#/store/secrets';
	import {buffer_to_text} from '#/util/data';
	
	import AppDisconnect from './AppDisconnect.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import Header from '../ui/Header.svelte';
	import SubHeader from '../ui/SubHeader.svelte';
	

	export let g_app: AppStruct;

	const p_app = Apps.pathFrom(g_app);

	const {
		k_page,
	} = load_page_context();

	let a_keys: SecretStruct<'viewing_key'>[] = [];
	let h_contracts: null|Record<Bech32, ContractStruct> = null;

	async function reload() {
		h_contracts = null;

		a_keys = await Secrets.filter({
			type: 'viewing_key',
			on: 1,
			owner: $yw_owner!,
			chain: $yw_chain_ref,
			outlets: [p_app],
		});

		// produce contracts for each bech32 referenced
		const a_contracts = await produce_contracts(a_keys.map(g => g.contract), $yw_chain);

		// initialize staging object
		const h_staging = {};
		for(const g_contract of a_contracts) {
			h_staging[g_contract.bech32] = g_contract;
		}

		// reactive assign
		h_contracts = h_staging;
	}

	reloadable({
		context: {
			sources: [yw_account, yw_chain],
			action: reload,
		},
	}, onDestroy);

	async function revoke(g_secret: SecretStruct<'viewing_key'>) {
		// cache context before going async
		const k_network = $yw_network as SecretNetwork;
		const g_account = $yw_account;
		const g_chain = $yw_chain;

		// lookup contract struct
		const g_contract = h_contracts![g_secret.contract];

		// get viewing key text for rotation seed
		const s_viewing_key = await Secrets.borrowPlaintext(g_secret, kn => buffer_to_text(kn.data));

		// build rotation message
		const g_rotate = await Snip2xMessageConstructor.set_viewing_key(g_account, g_contract, k_network, s_viewing_key);

		// request user signature
		k_page.push({
			creator: RequestSignature,
			props: {
				protoMsgs: [g_rotate.proto],
				fee: {
					limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key),
				},
				broadcast: {},
				local: true,
			},
			context: {
				app: G_APP_STARSHELL,
				chain: g_chain,
				accountPath: Accounts.pathFrom(g_account),
			},
		});
	}
</script>

<style lang="less">
	
	.top-controls {
		display: flex;
		margin-top: 1.5em;
		align-self: end;
	}
</style>

<Screen>
	<Header account network pops
		title='App Viewing Keys'
		subtitle="on {$yw_chain.name}"
	/>

	<AppBanner app={g_app} account={$yw_account} chains={[$yw_chain]} embedded />

	{#if h_contracts && $yw_network}
		<div class="top-controls">
			<!-- TODO: add toolip explaining that other apps will be able to access viewing key next time they are visited -->


			{#if a_keys.length}
				<button class="pill" on:click={() => k_page.push({
					creator: AppDisconnect,
					props: {g_app},
				})}>
					Revoke All
				</button>
			{/if}
		</div>

		<div class="rows no-margin">
			{#if !a_keys.length}
				<center class="color_text-med">
					App does not have access to any viewing keys belonging to {$yw_account.name} on {$yw_chain.name}.
				</center>
			{/if}

			{#each a_keys as g_key}
				<TokenRow contract={h_contracts[g_key.contract]}>
					<svelte:fragment slot="right">
						<button class="pill" on:click|stopPropagation={() => revoke(g_key)}>
							Revoke
						</button>
					</svelte:fragment>
				</TokenRow>
			{/each}
		</div>
	{/if}
</Screen>
