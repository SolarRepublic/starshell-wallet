<script lang="ts">
	import type {MemStore} from '../mem-store';

	import type {AccountPath} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	
	import type {ChainPath} from '#/meta/chain';
	
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref} from '../mem';
	
	import {load_app_profile} from '#/chain/app';
	import type {WebKitMessageHandlerRegsitry} from '#/env';
	import type {ExtToNative} from '#/script/messages';
	
	import type {WebKitMessenger} from '#/script/webkit-polyfill';
	
	import {Apps, G_APP_EXTERNAL, G_APP_NOT_FOUND} from '#/store/apps';
	
	import {ode, timeout} from '#/util/belt';
	
	import AccountContext from '../frag/AccountContext.svelte';
	import AppContext from '../frag/AppContext.svelte';
	import AppGrid from '../frag/AppGrid.svelte';
	
	import ChainContext from '../frag/ChainContext.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_LOCK from '#/icon/lock.svg?raw';
	import SX_ICON_RELOAD from '#/icon/reload-thin.svg?raw';
	import SX_ICON_SEARCH from '#/icon/search.svg?raw';
	import SX_ICON_WARNING from '#/icon/warning.svg?raw';


	$: p_account = $yw_nav_state?.account || '' as AccountPath;

	$: p_chain = $yw_nav_state?.chain || '' as ChainPath;

	$: if(p_chain) {
		$yw_chain_ref = p_chain;
	}

	$: if(p_account) {
		$yw_account_ref = p_account;
	}

	// navigation model state
	const yw_nav_state = globalThis['navigation_model_state'] as MemStore<WebKitMessageHandlerRegsitry['model']['state']>;

	// reactively update local bindings based on model state writable
	let p_url = '';
	let s_app_title = '';
	let s_stage: typeof $yw_nav_state['stage'] = 'unknown';
	yw_nav_state?.subscribe((g_model) => {
		p_url = g_model.url || '';
		s_app_title = g_model.title || '';
		s_stage = g_model.stage || 'unknown';
	});

	let p_app_prev = '';

	// parse components of url
	function parse_url(_p_url: string): URL | null {
		try {
			return new URL(_p_url);
		}
		catch(e_parse) {
			return null;
		}
	}
	
	$: d_url = parse_url(p_url);
	$: s_protocol = d_url?.protocol.replace(/:$/, '') || null;
	$: s_host = d_url?.host || null;

	// propagate url changes to input
	$: s_input = p_url;

	// on each browsing context update
	const yw_browsing_context = globalThis['browsing_context'] as MemStore<ExtToNative.BrowsingContext>;
	yw_browsing_context?.subscribe((g) => {
		// stale context
		if(!g.href || s_host !== new URL(g.href).host) return;

		// unregistered app
		if(g_app && !g_app.on) {
			// set app name
			g_app.name = g.name;

			// use temp profile
			g_app.pfp = `pfp:${s_protocol}://${s_host}`;

			// reactively update app struct
			g_app = g_app;
		}
	});


	let g_app: AppStruct | null = null;
	let b_app_connected = false;

	$: if(d_url) {
		void reload_page_app_state();
	}
	else {
		g_app = null;
	}

	async function reload_page_app_state() {
		const p_app = Apps.pathFor((d_url as URL).host, (d_url as URL).protocol.replace(/:$/, '') as 'https');

		// same app as previous
		if(p_app_prev === p_app) return;

		// update app
		p_app_prev = p_app;

		b_app_connected = false;
		g_app = null;

		console.warn(`Loading app struct for ${p_app}`);

		g_app = await Apps.at(p_app);

		if(G_APP_NOT_FOUND === g_app) {
			const g_ident = {
				scheme: s_protocol as 'https',
				host: s_host as string,
			};

			let s_app_name = $yw_nav_state?.title || '';

			const g_profile = await load_app_profile(g_ident);
			if(g_profile?.name) {
				s_app_name = g_profile.name;
			}

			g_app = {
				...g_app,
				...g_ident,
				name: s_app_name || '',
			};
		}

		let p_account_inherit: AccountPath | '' = '';
		let p_chain_inherit: ChainPath | '' = '';

		if(g_app?.on) {
			b_app_connected = true;

			const [p_chain_default, g_connection] = ode(g_app.connections)
				.sort((a_a, a_b) => a_a[1].accounts.length - a_b[1].accounts.length)[0];

			p_account_inherit = g_connection.accounts[0];
			p_chain_inherit = p_chain_default;
		}

		await yw_nav_state.update(g => ({
			...g,
			account: p_account_inherit,
			chain: p_chain_inherit,
		}));
	}

	const RT_PROTOCOL_INCLUDED = /^https?:\/\//;

	const RT_URL = new RegExp(`
		^

		# protocol
		(?:
			(?:
				(?:https?):
			)?//
		)?

		# user:pass
		(?:\\S+(?::\\S*)?@)?

		# host
		(?:
			# ip address
			(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])
			(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}
			(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))
			|

			# host name
			(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)
	
			# domain name
			(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*

			# tld identifier
			(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))
		)

		# port number
		(?::\\d{2,5})?

		# resource path
		(?:[/?#]\\S*)?

		$
	`.replace(/\n\s*#[^\n]*/g, '').replace(/\s+/g, ''));

	function can_be_url(s_test: string) {
		if(!RT_URL.test(s_test)) return false;

		// prep to validate the URL
		let p_validate = s_test;

		// protocol was omitted; fill for validation
		if(!RT_PROTOCOL_INCLUDED.test(s_test)) {
			p_validate = `https://${s_test}`;
		}

		// validate URL
		try {
			new URL(p_validate);
			return true;
		}
		catch(e_parse) {}

		return false;
	}

	$: b_input_url = can_be_url(s_input as string);

	const k_dapp = globalThis['navigation_handler'] as WebKitMessenger<'navigation'>;

	// let yw_viewing_mode = new MemStore<'collapsed' | 'expanded' | 'full'>('collapsed');

	let s_viewing_mode: 'collapsed' | 'expanded' | 'full' = 'collapsed';

	let s_display: 'drawer' | 'context' | 'frame' = 'drawer';

	let dm_controls: HTMLElement;
	let dm_input: HTMLInputElement;

	// reactively post mode changes
	$: if(s_viewing_mode) {
		void k_dapp?.post({
			type: 'mode',
			value: s_viewing_mode,
		});
	}

	// user has started filtering
	let s_app_filter = '';
	$: if(s_input && !b_input_url) {
		s_app_filter = s_input;
	}
	else {
		s_app_filter = '';
	}

	function submit_input() {
		s_viewing_mode = 'collapsed';

		dm_input.blur();

		let p_submit = s_input;

		if(!b_input_url) {
			p_submit = `https://duckduckgo.com/?${new URLSearchParams({
				q: s_input,
			}).toString()}`;
		}
		// protocol was omitted, default to https
		else if(!RT_PROTOCOL_INCLUDED.test(p_submit as string)) {
			p_submit = `https://${p_submit}`;
		}

		void k_dapp?.post({
			type: 'navigate',
			value: p_submit,
		});
	}

	async function clear_ios_toolip() {
		// still selected
		if(0 === dm_input.selectionStart && dm_input.value.length === dm_input.selectionEnd) {
			// zero-out selection
			dm_input.setSelectionRange(0, 0);

			// wait a tick
			await timeout(0);

			// re-select all
			dm_input.select();
		}
	}

	function toggle_expansion_mode(_s_display: typeof s_display) {
		// already expanded
		if('expanded' === s_viewing_mode) {
			// same display mode; collapse
			if(_s_display === s_display) {
				s_viewing_mode = 'collapsed';
			}
		}
		// collapsed
		else {
			s_viewing_mode = 'expanded';
		}

		// set display mode
		s_display = _s_display;
	}

	let dm_flow!: HTMLIFrameElement;
	function close_flow() {
		dm_flow.contentWindow?.['abort_flow']?.();

		// fail-safe ui collapse
		setTimeout(() => {
			s_viewing_mode = 'collapsed';
			s_display = 'context';
			p_flow = '';
		}, 2.5e3);
	}

	function location_click() {
		// currently in flow, close
		if('full' === s_viewing_mode) {
			return close_flow();
		}

		const d_observer = new MutationObserver(() => {
			if(!dm_controls.classList.contains('display_none')) {
				dm_input.select();

				const i_interval = (globalThis as typeof window).setInterval(clear_ios_toolip, 150);

				setTimeout(() => {
					clearInterval(i_interval);
				}, 1.5e3);
			}
		});

		d_observer.observe(dm_controls, {
			attributes: true,
		});

		// set expansion mode
		toggle_expansion_mode('drawer');

		// collapsing
		if('collapsed' === s_viewing_mode) {
			// reset urls
			s_input = p_url;
		}
	}

	function action_click() {
		// currently in flow, close
		if('full' === s_viewing_mode) {
			return close_flow();
		}

		// set expansion mode
		toggle_expansion_mode('context');
	}

	async function close() {
		const as_hostnames = new Set<string>();

		// each app
		for(const [, g_app_exempt] of await Apps.entries()) {
			// parse its hostname
			const si_hostname = new URL(`${g_app_exempt.scheme}://${g_app_exempt.host}`).hostname;

			// split by delimiter
			const a_subs = si_hostname.split('.');

			// each subpart; add to set of possible hostnames (ok to include tlds such as .co.uk)
			for(let i_sub=0; i_sub<a_subs.length-1; i_sub++) {
				as_hostnames.add(a_subs.slice(i_sub).join('.'));
			}
		}

		// instruct the host to close the view while sparing the given hostnames
		void k_dapp.post({
			type: 'close',
			value: {
				hostnames: [
					'duckduckgo.com',  // do not clear search engine data
					's2r.sh',  // keep private sharing
					...as_hostnames,
				],
			},
		});

		// collapse viewing mode
		s_viewing_mode = 'collapsed';
	}

	function reload() {
		void k_dapp.post({
			type: 'reload',
		});
	}

	let s_context_mode: 'app' | 'account' | 'chain' = 'app';
	function set_context(s_mode: typeof s_context_mode) {
		if(!$yw_chain_ref || !$yw_account_ref || !b_app_connected) {
			s_context_mode = 'app';
		}
		else {
			s_context_mode = s_mode;
		}
	}

	function app_launch(d_event: CustomEvent<string>) {
		const p_launch = d_event.detail;

		s_viewing_mode = 'collapsed';

		void k_dapp?.post({
			type: 'navigate',
			value: p_launch,
		});
	}


	// listen for flow messages
	let p_flow = '';
	addEventListener('@opener', (d_event: CustomEvent<WebKitMessageHandlerRegsitry['opener']>) => {
		const {
			url: p_url_open,
			args: a_args,
		} = d_event.detail;

		// listen for close event
		window.addEventListener('message', (d_msg) => {
			const {
				type: si_type,
				value: w_value,
			} = d_msg.data;

			// unexpected origin
			if(location.origin !== d_msg.origin) return;

			if('close' === si_type) {
				p_flow = '';
				s_display = 'context';
				s_viewing_mode = 'collapsed';
			}
		});

		// append query parameter
		const d_url_open = new URL(p_url_open);
		d_url_open.searchParams.append('iframe', 'iab-nav');
		p_flow = d_url_open.toString();

		s_display = 'frame';
		s_viewing_mode = 'full';
	});
</script>

<style lang="less">
	@import '../_base.less';

	:global(html) {
		width: 100%;
		max-width: 100%;
		height: 100%;
	}

	:global(body) {
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-around;
	}

	section.controls {
		flex: 1;

		display: flex;
		flex-direction: column;

		>* {
			flex: 1;

			display: flex;
			flex-direction: column;
			padding: 12px;

			>.drawer {
				flex: 1;
			}

			>.label {
				font-size: 12px;
				color: var(--theme-color-text-med);
				margin-bottom: 3px;
			}

			>form {
				display: flex;
				gap: 6px;
			}

			>.context {
				display: flex;
				gap: 12px;

				>.context-content {
					flex: 1;
				}

				>.column {
					display: flex;
					flex-direction: column;
					gap: 0px;

					>* {
						border: 2px solid var(--theme-color-border);
						padding: 8px;
						background-color: fade(black, 20%);

						&:first-child {
							border-top-left-radius: 6px;
							border-top-right-radius: 6px;
						}

						&:last-child {
							border-bottom-left-radius: 6px;
							border-bottom-right-radius: 6px;
						}

						&:nth-child(n+2) {
							margin-top: -2px;
						}
					}

					.off {
						opacity: 0.3;
					}
				}
			}
		}
	}

	iframe.flow {
		height: 100%;
		border: none;
	}

	nav {
		display: flex;
		width: 100%;
		justify-content: space-around;
		align-items: center;

		font-size: 16px;

		border-top: 1px solid transparent;
		&.expanded {
			min-height: 50px;
			height: 50px;
			border-top-color: var(--theme-color-border);
		}
		&.collapsed {
			height: 100%;
		}
		&.full {
			height: 50px;
		}

		>* {
			padding: 0;
			padding-left: 3.5%;
			margin-right: 3.5%;

			height: 100%;
			display: flex;
			align-items: center;
			gap: 8px;

			&:nth-child(n+2) {
				border-left: 1px solid var(--theme-color-border);
			}
		}

		>.center {
			flex: 1;
			overflow: hidden;
			white-space: pre;
			line-height: 1em;

			padding-left: calc(1% + 8px);
			margin-right: calc(1% + 8px);

			>.status {
				position: relative;
				width: 28px;
				height: 28px;

				>* {
					position: absolute;
					top: 0;
					left: 0;
					transition-delay: 0s;
					transition-duration: 0s;
					transition-timing-function: var(--ease-out-quint);
				}

				>.app-icon {
					opacity: 0;
					transition-property: opacity;
				}

				>.lock {
					transition-property: transform;
				}

				&.registered {
					>* {
						transition-delay: 1500ms;
						transition-duration: 1s;
					}

					>.app-icon {
						opacity: 1;
					}

					>.lock {
						transform: translate(4px, -4px) scale(0.4);
						transform-origin: top right;
					}
				}
			}

			>.location {
				flex: 1;
				overflow: hidden;

				display: flex;
				flex-direction: column;

				&.loading {
					.pulse();
				}

				>.title {
					color: var(--theme-color-text-med);
					font-size: 13px;
					font-weight: 300;
				}
			}

			>.action {
				background-color: black;
				border-radius: 8px;
				padding: 3px;
				border: 1px solid var(--theme-color-border);
				line-height: 0;

				filter: grayscale(1) opacity(0.5);
				transition: filter 300ms linear;

				&.connected {
					filter: grayscale(0) opacity(1);
				}
			}
		}
	}
</style>

<section class="controls" class:display_none={'collapsed' === s_viewing_mode}
	bind:this={dm_controls}
>
	<div class:display_none={'drawer' !== s_display}>
		<div class="drawer">
			<AppGrid on:launch={app_launch} {s_app_filter} />
		</div>

		<span class="label">
			Type below to filter apps, search the web, or enter a URL
		</span>

		<form class="url" action="" on:submit|preventDefault={submit_input}>
			<input type="text" spellcheck="false" autocorrect="false" autocapitalize="false" autocomplete="false"
				bind:this={dm_input}
				bind:value={s_input}
			>

			<button class="primary" style="width: 75px;">
				{#if b_input_url}
					GO
				{:else}
					<span class="global_svg-icon icon-diameter_22px">
						{@html SX_ICON_SEARCH}
					</span>
				{/if}
			</button>
		</form>
	</div>
	
	<div class:display_none={'context' !== s_display}>
		<div class="context">
			{#if 'app' === s_context_mode}
				<span class="context-content">
					<AppContext g_app={g_app || G_APP_NOT_FOUND} on:reload={reload} />
				</span>
			{:else if 'account' === s_context_mode}
				<span class="context-content">
					<AccountContext on:change={reload} />
				</span>
			{:else if 'chain' === s_context_mode}
				<span class="context-content">
					{#if b_app_connected && g_app}
						<ChainContext chains={ode(g_app.connections).map(([p]) => p)} />
					{:else}
						<h3>
							App is not connected on any chains
						</h3>
					{/if}
				</span>
			{/if}

			<div class="column" data-account={p_account} data-chain={p_chain}>
				<div class="app" on:click={() => set_context('app')}>
					<PfpDisplay dim={48}
						name={(g_app || G_APP_EXTERNAL).name}
						path={(g_app || G_APP_EXTERNAL).pfp}
					/>
				</div>

				<div class="account" on:click={() => set_context('account')} class:off={!$yw_account_ref || !b_app_connected}>
					<PfpDisplay dim={48} resource={$yw_account} />
				</div>

				<div class="chain" on:click={() => set_context('chain')} class:off={!$yw_chain_ref || !b_app_connected}>
					<PfpDisplay dim={48} resource={$yw_chain} />
				</div>
			</div>
		</div>
	</div>

	<div class:display_none={'frame' !== s_display}>
		{#if p_flow}
			<iframe bind:this={dm_flow} class="flow" title="StarShell Prompt" src={p_flow} />
		{/if}
	</div>
</section>

<nav class="navigation"
	class:collapsed={'collapsed' === s_viewing_mode}
	class:expanded={'expanded' === s_viewing_mode}
	class:full={'full' === s_viewing_mode}
>
	<span class="close global_svg-icon icon-diameter_36px"
		on:click={close}
	>
		{@html SX_ICON_CLOSE}
	</span>

	<span class="center">
		<span class="status" class:registered={b_app_connected}>
			{#if g_app}
				<span class="app-icon">
					<PfpDisplay appRelated
						dim={28}
						name={g_app.name}
						path={g_app.pfp}
					/>
				</span>
			{/if}

			<span class="lock global_svg-icon icon-diameter_28px">
				{#if 'https' === s_protocol}
					{@html SX_ICON_LOCK}
				{:else}
					{@html SX_ICON_WARNING}
				{/if}
			</span>
		</span>

		<span class="location"
			class:loading={'loading' === s_stage}
			on:click={location_click}
		>
			<div class="host">
				{s_host}
			</div>

			<div class="title">
				{s_app_title}
			</div>
		</span>

		<span class="action" class:connected={b_app_connected} on:click={action_click}>
			<img width="32"
				alt="Wallet action"
				src="/media/vendor/icon_32.png"
				srcset="/media/vendor/icon_64.png 2x"
			>
		</span>
	</span>

	<span class="reload global_svg-icon icon-diameter_36px"
		on:click={reload}
	>
		{@html SX_ICON_RELOAD}
	</span>
</nav>