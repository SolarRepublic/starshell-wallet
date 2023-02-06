<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {ChainStruct} from '#/meta/chain';
	
	import {getContext} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {disable_keplr_extension, is_keplr_extension_enabled, is_starshell_muted} from '#/extension/keplr';
	import type {PageInfo} from '#/script/messages';
	import {G_APP_STARSHELL} from '#/store/apps';
	import '#/chain/cosmos-network';
	
	import AdjustKeplrCompatibilityMode from './AdjustKeplrCompatibilityMode.svelte';
	import ShowProfileMethod from './ShowProfileMethod.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	

	export let page: PageInfo | null = null;

	export let app: AppStruct | null = null;

	const {
		k_page,
		completed,
	} = load_flow_context<string>();

	const g_chain = getContext<ChainStruct>('chain');

	const b_busy = false;

	let b_already_muted = false;

	async function disable_keplr() {
		await disable_keplr_extension(page);

		completed?.(true, 'disabled');
	}

	function close() {
		if(completed) {
			completed(false, 'yield');
		}
		else {
			k_page.pop();
		}
	}

	// keplr not enabled
	void is_keplr_extension_enabled().then((b_enabled) => {
		if(!b_enabled) {
			completed?.(true, 'disabled');
		}
	});

	// starshell already muted
	void is_starshell_muted().then(b => b_already_muted = b!);

	function show_profile_method() {
		k_page.push({
			creator: ShowProfileMethod,
		});
	}

	function disable_compatibility() {
		k_page.push({
			creator: AdjustKeplrCompatibilityMode,
			props: {
				app: app,
				action: 'disable',
			},
		});
	}

</script>

<style lang="less">
	@import '../_base.less';
</style>

<Screen>
	<AppBanner app={G_APP_STARSHELL} chains={[g_chain]} on:close={close}>
		<span slot="default" style="display:contents;">
			Multiple Conflicting Wallets Installed
		</span>

		<span slot="context" style="display:contents;">
			StarShell is the superior wallet
		</span>
	</AppBanner>

	<hr class="no-margin">

	<div class="flex_1">
		<p>
			Looks like Keplr is also installed and enabled. We recommended disabling Keplr while using StarShell. You can always re-enable it later.
		</p>
	
		<p>
			Alternatively, you can use both wallets if you create a separate profile in your browser. Click “Use both wallets” below to see how.
		</p>
	</div>

	<ActionsWall>
		<button disabled={b_busy} on:click={show_profile_method}>Use both wallets</button>

		{#if !b_already_muted}
			<button disabled={b_busy} on:click={disable_compatibility}>Mute StarShell</button>
		{:else}
			<button disabled>StarShell is already muted</button>
		{/if}

		<button disabled={b_busy} class="primary" on:click={disable_keplr}>Disable Keplr extension</button>
	</ActionsWall>
</Screen>
