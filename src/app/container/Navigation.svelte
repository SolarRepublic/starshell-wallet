<script lang="ts">

	import type {MemStore} from '../mem-store';
	
	import type {AppStruct} from '#/meta/app';
	
	import type {WebKitMessageHandlerRegsitry} from '#/env';
	import type {WebKitMessenger} from '#/script/webkit-polyfill';
	
	import {Apps} from '#/store/apps';
	
	import {timeout} from '#/util/belt';
	
	import AppGrid from '../frag/AppGrid.svelte';
	
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_LOADING from '#/icon/loading.svg?raw';
	import SX_ICON_LOCK from '#/icon/lock.svg?raw';
	import SX_ICON_DOTS from '#/icon/more-vert.svg?raw';
	import SX_ICON_RELOAD from '#/icon/reload-thin.svg?raw';
	import SX_ICON_SEARCH from '#/icon/search.svg?raw';
	import SX_ICON_WARNING from '#/icon/warning.svg?raw';
	

	// navigation model state
	const yw_nav_state = globalThis['navigation_model_state'] as MemStore<WebKitMessageHandlerRegsitry['model']['state']>;

	// reactively update local bindings based on model state writable
	$: p_url = $yw_nav_state?.url || '';
	$: s_app_title = $yw_nav_state?.title;
	$: s_stage = $yw_nav_state?.stage;

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
	
	$: d_url = parse_url(p_url as string);
	$: s_protocol = d_url?.protocol.replace(/:$/, '') || null;
	$: s_host = d_url?.host || null;

	// propagate url changes to input
	$: s_input = p_url;

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

		if(!g_app?.on) return;

		b_app_connected = true;
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

	let s_mode: 'collapsed' | 'expanded' = 'collapsed';

	let s_display: 'drawer' | 'context' = 'drawer';

	$: b_expanded = 'expanded' === s_mode;

	let dm_controls: HTMLElement;
	let dm_input: HTMLInputElement;

	// reactively post mode changes
	$: if(s_mode) {
		void k_dapp?.post({
			type: 'mode',
			value: s_mode,
		});
	}

	function submit_input() {
		s_mode = 'collapsed';

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
		if('expanded' === s_mode) {
			// same display mode; collapse
			if(_s_display === s_display) {
				s_mode = 'collapsed';
			}
		}
		// collapsed
		else {
			s_mode = 'expanded';
		}

		// set display mode
		s_display = _s_display;
	}

	function location_click() {
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
		if('collapsed' === s_mode) {
			// reset urls
			s_input = p_url;
		}
	}

	function action_click() {
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
	}

	function reload() {
		void k_dapp.post({
			type: 'reload',
		});
	}
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
		}
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
			border-top-color: var(--theme-color-border);
		}
		&.collapsed {
			height: 100%;
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

<section class="controls" class:display_none={!b_expanded}
	bind:this={dm_controls}
>
	<div class:display_none={'drawer' !== s_display}>
		<div class="drawer">
			<AppGrid />
		</div>

		<span class="label">
			Type below to filter apps, search the web, or enter a URL
		</span>

		<form class="url" action="" on:submit|preventDefault={submit_input}>
			<input type="text"
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
			Context
		</div>
	</div>
</section>

<nav class="navigation" class:expanded={b_expanded} class:collapsed={!b_expanded}>
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
						resource={g_app}
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