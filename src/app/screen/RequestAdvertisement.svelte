<script lang="ts">
	import type {PageConfig} from '../nav/page';

	import type {AppStruct} from '#/meta/app';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {PageInfo} from '#/script/messages';
	import {keplr_polyfill_script_add_matches} from '#/script/scripts';
	import {P_PUBLIC_SUFFIX_LIST, R_DOMAIN_IP, R_DOMAIN_LOCALHOST} from '#/share/constants';
	import {Apps} from '#/store/apps';
	import {WebResourceCache} from '#/store/web-resource-cache';
	import '#/chain/cosmos-network';
	import {microtask, timeout} from '#/util/belt';
	import {qsa} from '#/util/dom';
	
	import AdjustKeplrCompatibilityMode from './AdjustKeplrCompatibilityMode.svelte';
	import ReloadPage from './ReloadPage.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	

	const {
		k_page,
		completed,
	} = load_flow_context<undefined>();

	/**
	 * Information about the app requesting the advertisement
	 */
	export let app: AppStruct;
	const g_app = app;

	/**
	 * Tab ID of the requesting site
	 */
	export let page: PageInfo;

	// ref host
	const s_host = g_app.host;

	/**
	 * Indicates that the request is proxying in keplr compatibility mode
	 */
	export let keplr = false;

	/*

	AppsStore.subscribe((ks_apps) => {
		const p_app = ks_apps.pathFor(g_app);

	*/

	let dm_screen: HTMLElement;
	let dm_summary: HTMLElement;

	let b_busy = false;

	let b_never_again = false;

	let i_part_selected = -1;

	$: s_againness = -1 === i_part_selected? 'once': 'always';

	function ignore() {
		// user opted to never be asked again
		if(b_never_again) {
			k_page.push({
				creator: AdjustKeplrCompatibilityMode,
				props: {
					push: null,
					app: g_app,
					action: 'disable',
				},
				context: {
					completed,
				},
			});
		}
		// otherwise; done
		else {
			completed(false);
		}
	}

	async function enable_keplr_for_app() {
		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => (b_busy = false, 1);
	
		// page config for reload screen
		const gc_reload: PageConfig = {
			creator: ReloadPage,
			props: {
				app: g_app,
				page,
				preset: 'keplr',
			},
			context: {
				completed,
			},
		};

		// user opted to never be asked again
		if(b_never_again) {
			// prompt user to confirm before doing anything
			k_page.push({
				creator: AdjustKeplrCompatibilityMode,
				props: {
					push: gc_reload,
					app: g_app,
					action: 'always',
				},
				context: {
					completed,
				},
			});
		}
		// proceed per usual
		else {
			// save app def to storage
			await Apps.add(g_app);

			// ensure polyfill is enabled for this app
			await keplr_polyfill_script_add_matches([Apps.scriptMatchPatternFrom(g_app)]);

			// reload the tab
			await chrome.tabs.reload(page.tabId);

			// done
			completed(true);
		}

		// don't interupt ui slide
		await timeout(1);

		// release busy lock
		return exit();
	}

	async function allow(): Promise<1> {
		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => (b_busy = false, 1);

		// save app def to storage
		await Apps.add(g_app);

		// done
		completed(true);

		return exit();
	}

	async function parse_domain_parts(): Promise<string[]> {
		// fetch the cached suffix list
		const a_suffixes = await WebResourceCache.get(P_PUBLIC_SUFFIX_LIST);

		// prep etld
		let s_etld = '';

		// list of domains to consider for new user policy
		const a_domains: string[] = [];

		// localhost
		if(R_DOMAIN_LOCALHOST.test(s_host)) {
			// full domain
			a_domains.push(s_host);
		}
		// secure context
		else if('https' === g_app.scheme) {
			// full domain
			a_domains.push(s_host);

			// not an ip address
			if(!R_DOMAIN_IP.test(s_host)) {
				// extract port suffix if any
				const s_port_suffix = s_host.replace(/^.*?(:.+|)$/, '$1');

				// split hostname
				const a_subs = s_host.replace(/:.+$/, '').split('.');

				// each part of the domain
				for(let i_etld=a_subs.length-1; i_etld>0; i_etld--) {
					// create etld test
					const s_test = a_subs.slice(i_etld).join('.');

					// is a regsitered public suffix
					if(a_subs.includes(s_test)) {
						continue;
					}
					// reached the end of the etld
					else {
						s_etld = s_test;
						break;
					}
				}

				// org-level domain
				a_domains.push('*.'+s_etld+s_port_suffix);
			}
		}

		// // initialize all parts to enabled
		// a_parts_disabled = a_domains.map(() => false);

		// answer
		return a_domains;
	}
</script>

<style lang="less">
	@import '../_base.less';

	.column {
		display: flex;
		flex-flow: column;
		align-items: center;
		justify-content: center;
	}

	.request-summary {
		margin: var(--ui-padding) calc(2 * var(--ui-padding));

		.name {
			color: var(--theme-color-blue);
			font-weight: 500;
		}
	}

	.additional-info {
		.font(regular, @size:13px);
		color: var(--theme-color-text-med);
		margin: 0 var(--ui-padding);
	}

	.dont-ask {
		padding: 0.5em 0;
	}
</style>

<Screen on:dom={d_event => dm_screen = d_event.detail}>
	<AppBanner app={g_app} on:close={() => completed(false)}>
		This app 
		{#if keplr}
			might be trying to use the Keplr API. Do you intend to use your wallet with this site?
		{:else}
			wants to know<br>
			if you have StarShell installed.
		{/if}
	</AppBanner>

	<hr class="no-margin">

	{#if keplr}
		<div class="additional-info no-margin">
			For privacy and compatibility, this site will think you have Keplr installed.
			You still must review permissions before the site is able to connect to your wallet.
		</div>
	{/if}

	<div class="flex_1"></div>

	{#if !keplr}
		{#await parse_domain_parts() then a_domains}
			{#each a_domains as s_pattern, i_part}
				<CheckboxField
					containerClass='domain-part'
					id={`domain-part-${i_part}`}
					on:checked={async(d_event) => {
						// not from user input, ignore
						if(-1 !== i_part_selected && i_part !== i_part_selected) return;

						// all other parts
						const a_others = qsa(dm_screen, '.domain-part input');
						a_others[i_part] = null;

						// checked
						if(d_event.detail) {
							// check all below
							for(const dm_other of a_others.slice(0, i_part)) {
								if(!dm_other?.checked) {
									dm_other?.click();
								}
							}

							// uncheck all above
							for(const dm_other of a_others.slice(i_part+1)) {
								if(dm_other?.checked) {
									dm_other?.click();
								}
							}

							// disable all below
							i_part_selected = i_part;
						}
						// unchecked
						else {
							// enable all so they are clickable but will not trigger recursion
							i_part_selected = -2;

							// allow it to enable
							await microtask();

							// uncheck all
							for(const dm_other of a_others) {
								if(dm_other?.checked) {
									dm_other?.click();
								}
							}

							// return to normal state
							i_part_selected = -1;
						}
					}}
					disabled={i_part < i_part_selected}
				>
					Don't ask again for <code>{s_pattern}</code>
				</CheckboxField>
			{/each}
		{/await}
	{/if}

	{#if keplr}
		<ActionsWall>
			<div class="dont-ask" on:click={toggleChildCheckbox}>
				<CheckboxField
					id='never-again'
					on:change={({detail:b_checked}) => b_never_again = b_checked}
				>
					Don't ever ask again
				</CheckboxField>
			</div>
			<button disabled={b_busy} on:click={() => ignore()}>Ignore {b_never_again? 'forever': ''}</button>
			<button class="primary" disabled={b_busy} on:click={() => enable_keplr_for_app()}>Enable{b_never_again? ' forever': ''} and reload</button>
		</ActionsWall>
	{:else}
		<ActionsWall>
			<button disabled={b_busy} on:click={() => completed(false)}>Ignore {s_againness}</button>
			<button class="primary" disabled={b_busy} on:click={() => allow()}>Allow {s_againness}</button>
		</ActionsWall>
	{/if}
</Screen>
