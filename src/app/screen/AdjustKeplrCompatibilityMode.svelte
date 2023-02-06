<script lang="ts">
	import type {PageConfig} from '../nav/page';

	import type {AppStruct} from '#/meta/app';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {mute_starshell} from '#/extension/keplr';
	import {
		keplr_polyfill_script_add_matches,
		set_keplr_polyfill,
	} from '#/script/scripts';
	import {Apps, G_APP_NOT_FOUND} from '#/store/apps';
	import {Policies} from '#/store/policies';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';


	const {
		k_page,
		completed,
		g_cause,
	} = load_flow_context<undefined>();

	export let push: PageConfig | null = null;

	export let app: AppStruct | null = g_cause?.app || null;

	export let action: 'disable' | 'always';

	async function enable_once(b_bypass_only=false) {
		// save app def to storage
		if(app) {
			await Apps.add(app);

			// actually enable once
			if(!b_bypass_only) {
				// ensure polyfill is enabled for this app
				await keplr_polyfill_script_add_matches([Apps.scriptMatchPatternFrom(app)]);
			}
		}

		// prompt user to reload 
		k_page.push(push!);
	}

	async function enable_everywhere() {
		// update setting
		await set_keplr_polyfill(true);

		// continue
		await enable_once(true);
	}

	async function disable_everywhere() {
		// mute
		await mute_starshell();

		// complete
		ignore_once();
	}

	function ignore_once() {
		if(completed) {
			completed(false);
		}
		else {
			k_page.pop();
		}
	}

	async function block_site() {
		// add policy to block app
		if(app) await Policies.blockApp(app);

		// complete
		ignore_once();
	}
</script>

<style lang="less">
	@import '../_base.less';
</style>

<Screen>
	{#if 'always' === action}
		<h3>Are you sure you want to permanently enable Keplr compatibility mode?</h3>

		<hr class="no-margin">

		<p>
			Permanently enabling this feature means websites will be able to detect you have a Keplr-compatible wallet installed.
		</p>

		<p>
			Any website you visit can collect this data, build a profile of you and your interest in Cosmos blockchains, and possibly sell that to third parties.
		</p>

		<p>
			In the interest of privacy, <b>StarShell recommends selecting "Enable Once"</b>,
			so that you can review this prompt once for each website.
		</p>

		<ActionsWall>
			<button on:click={() => enable_once()}>Enable Once</button>
			<button class="primary" on:click={() => enable_everywhere()}>Enable Everywhere</button>
		</ActionsWall>
	{:else if 'disable' === action && app}
		<AppBanner app={app ?? G_APP_NOT_FOUND} on:close={() => completed(false)}>
			<span slot="default" style="display:contents;">
				🔇 Mute StarShell Prompts
			</span>

			<span slot="context" style="display:contents;">
				Do you want to apply this globally or just here?
			</span>
		</AppBanner>

		<hr class="no-margin">

		<div class="flex_1">
			{#if app}
				<p>
					“Block Site” will prevent <code>{app.host}</code> from talking to StarShell anymore and you will no longer receive prompts from this site.
				</p>
			{/if}
	
			<p>
				Disabling everywhere means that all websites will not be able to connect to StarShell anymore.
				You will have to manually re-enable this later if you want to use StarShell with dApps.
			</p>
		</div>

		<ActionsWall>
			<style lang="less">
				.line {
					display: flex;
					justify-content: space-between;
					gap: var(--ui-padding);

					>* {
						flex: 1;
					}
				}
			</style>

			<div class="line">
				<button on:click={() => k_page.pop()}>Back</button>
				<button class="cautionary" on:click={() => disable_everywhere()}>Disable Everywhere</button>
			</div>

			{#if app}
				<button class="primary" on:click={() => block_site()}>Block Site</button>
			{/if}
		</ActionsWall>
	{/if}
</Screen>
