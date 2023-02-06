<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {ChainStruct} from '#/meta/chain';
	
	import {getContext} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {try_reloading_page} from '#/extension/browser';
	import {disable_keplr_extension, is_keplr_extension_enabled, is_starshell_muted, unmute_starshell} from '#/extension/keplr';
	import type {PageInfo} from '#/script/messages';
	import {G_APP_STARSHELL} from '#/store/apps';
	import '#/chain/cosmos-network';
	
	import ShowProfileMethod from './ShowProfileMethod.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	

	export let page: PageInfo | null = null;

	export let app: AppStruct | null = null;

	const {
		g_cause,
		k_page,
		completed,
	} = load_flow_context<string>();

	const g_chain = getContext<ChainStruct>('chain');

	const b_busy = false;

	// is keplr extension enabled
	let b_keplr_enabled = false;
	void is_keplr_extension_enabled().then(b => b_keplr_enabled = b!);

	async function disable_keplr() {
		// disable the extension
		await disable_keplr_extension();

		// done
		void close(true);
	}

	async function close(b_completed=false) {
		let b_reloaded = false;
		if(g_cause?.tab?.id) {
			b_reloaded = await try_reloading_page({tabId:g_cause.tab.id});
		}

		if(completed) {
			completed(b_completed);
		}
		else if(b_reloaded) {
			globalThis.close();
		}
		else {
			k_page.reset();
		}
	}

	// starshell not muted
	void is_starshell_muted().then(b_muted => !b_muted? close(): null);

	function show_profile_method() {
		k_page.push({
			creator: ShowProfileMethod,
		});
	}

	async function enable_compatibility() {
		await unmute_starshell();

		void close(true);
	}

</script>

<style lang="less">
	@import '../_base.less';
</style>

<Screen>
	<AppBanner app={G_APP_STARSHELL} chains={[g_chain]} on:close={() => close}>
		<span slot="default" style="display:contents;">
			StarShell is Muted
		</span>

		<span slot="context" style="display:contents;">
			dApps are not able to connect while muted
		</span>
	</AppBanner>

	<hr class="no-margin">

	<div class="flex_1">
		{#if b_keplr_enabled}
			<p>
				You still have Keplr installed and enabled.
			</p>

			<p>
				Unmuting StarShell will cause prompts to appear again from both Keplr and StarShell.
			</p>
		{:else}
			<p>
				Unmuting StarShell will allow dApps to start connecting to your wallet again.
			</p>
		{/if}
	</div>

	<ActionsWall>
		{#if b_keplr_enabled}
			<button disabled={b_busy} on:click={show_profile_method}>Use both wallets</button>

			<button disabled={b_busy} on:click={enable_compatibility}>Unmute StarShell</button>

			<button disabled={b_busy} class="primary" on:click={disable_keplr}>Disable Keplr extension</button>
		{:else}
			<button disabled={b_busy} class="primary" on:click={enable_compatibility}>Unmute StarShell</button>
		{/if}
	</ActionsWall>
</Screen>
