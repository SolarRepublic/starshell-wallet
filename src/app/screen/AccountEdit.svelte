<script lang="ts">
	import type {AccountStruct, AccountPath} from '#/meta/account';
	import type {Bech32} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {ThreadId} from '../def';
	import {yw_account, yw_account_ref, yw_chain, yw_navigator} from '../mem';
	import {load_flow_context} from '../svelte';
	
	import {utility_key_child} from '#/share/account';
	import {N_PX_DIM_ICON} from '#/share/constants';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {Pfps} from '#/store/pfps';
	import {text_to_base64} from '#/util/data';
	import {qsa, render_svg_squarely} from '#/util/dom';
	import Info from '##/ui/Info.svelte';
	
	import Address from '../frag/Address.svelte';
	import IconEditor from '../frag/IconEditor.svelte';
	import InlineTags from '../frag/InlineTags.svelte';
	import PfpGenerator from '../frag/PfpGenerator.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import Load from '../ui/Load.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_ARROW from '#/icon/expand_more.svg?raw';
	

	export let accountPath: AccountPath;

	let g_account: AccountStruct;

	export let oneway = false;

	export let fresh = false;

	export let b_mandatory = false;

	let s_name = '';
	let sa_account: Bech32 | string;
	let p_pfp: PfpTarget;
	let b_pfp_custom: 0 | 1 = 0;

	$: b_form_valid = !!s_name;

	$: sa_account = g_account
		? $yw_chain
			? Chains.addressFor(g_account.pubkey, $yw_chain)
			: Chains.addressFor(g_account.pubkey, 'addr').slice(0, -6)+'[...]'
		: '';

	const {
		k_page,
		completed,
	} = load_flow_context();

	let atu8_art_seed = crypto.getRandomValues(new Uint8Array(32));
	let i_offset = 0;

	let dm_svg_pfpg: SVGSVGElement;

	async function load_account() {
		// load account store
		const ks_accounts = await Accounts.read();

		// load account
		g_account = ks_accounts.at(accountPath)!;

		// 
		if(!g_account) {
			throw new Error(`Account '${accountPath}'' was not found in %o`, ks_accounts.raw);
		}

		// propagate custom pfp
		b_pfp_custom = g_account?.extra?.['customPfp'] || 0;

		// copy out art key
		await utility_key_child(g_account, 'walletSecurity', 'antiPhishingArt', atu8 => atu8_art_seed = atu8.slice());

		// use existing offset if one is set
		i_offset = g_account.extra?.pfpg?.offset || 0;

		s_name = g_account.name;
	}

	async function save_account() {
		// custom pfp not defined
		if(!b_pfp_custom) {
			// prep the square icons
			try {
				const h_renders = await render_svg_squarely(dm_svg_pfpg, [
					32,  // account switcher
					48,  // app banner
					N_PX_DIM_ICON,  // anywhere else
				]);

				// generate square pfp from aura
				p_pfp = await Pfps.open(ks => ks.upsert({
					type: 'plain',
					image: {
						...h_renders,
						default: h_renders[N_PX_DIM_ICON],
					},
				}));
			}
			// don't let runtime error prevent account creation
			catch(e_pfp) {
				syserr({
					title: 'Failed to save account PFP',
					error: e_pfp,
				});
			}
		}

		// prep aura media
		let sx_aura = '';

		// produce and save aura
		try {
			// remove all drawn elements except for the background and stars
			qsa(dm_svg_pfpg, ':scope>:not(style,defs,.background,.star)').map(dm => dm.remove());

			// remove other unnecessary svg elements
			qsa(dm_svg_pfpg, ':scope>defs>:not(#pfpg-background)').map(dm => dm.remove());

			// remove unneeded rules
			qsa(dm_svg_pfpg, 'style').forEach((dm_style) => {
				const d_sheet = dm_style.sheet;
				if(!d_sheet) return;

				// each rule in reverse order
				const a_rules = [...d_sheet.cssRules];
				for(let i_rule=a_rules.length-1; i_rule>=0; i_rule--) {
					const d_rule = a_rules[i_rule];

					// style rule
					if(d_rule instanceof CSSStyleRule) {
						// not interested; delete it
						if(!/^\*|(rect)?(\.background|\.star)?$/.test(d_rule.selectorText)) {
							d_sheet.deleteRule(i_rule);
						}
					}
				}
			});

			// remove svelte classes
			qsa(dm_svg_pfpg, '*').forEach((dm_node: SVGElement) => {
				const s_class = dm_node.getAttribute('class')?.split(/\s+/g)
					?.filter(s => !/^s-[a-zA-Z0-9]{12}$/.test(s))?.join(' ') || '';

				if(s_class) dm_node.setAttribute('class', s_class);
				else dm_node.removeAttribute('class');
			});

			// remove all classes from svg root element
			dm_svg_pfpg.removeAttribute('class');

			// save as string
			sx_aura = dm_svg_pfpg.outerHTML.replace(/(>)\s+(<)|([;:,])\s+|\s*([{}])\s*/g, '$1$2$3$4');
		}
		// don't let runtime error prevent account creation
		catch(e_remove) {
			syserr({
				title: 'Failed to render Aura',
				error: e_remove,
			});
		}

		// compute deltas
		const a_deltas: [string, string, string][] = [];
		const deltavize = (si_key: string, z_before: any, z_after: any) => {
			if(z_before !== z_after) a_deltas.push([si_key, z_before? z_before+'': '', z_after+'']);
		};

		deltavize('name', g_account.name, s_name);
		deltavize('extra.pfpg.offset', (g_account.extra?.pfpg?.offset || 0) + 1, i_offset + 1);

		// update account data
		Object.assign(g_account, {
			name: s_name,
			pfp: p_pfp,
			extra: {
				...g_account.extra,
				aura: sx_aura,
				pfpg: {
					offset: i_offset,
				},
			},
		});

		// save to account
		await Accounts.open(ks => ks.put(g_account));

		// save to incidents
		await Incidents.record({
			type: 'account_edited',
			data: {
				account: accountPath,
				deltas: a_deltas,
			},
		});

		// editted active account; reload
		if(accountPath === $yw_account_ref) {
			$yw_account_ref = accountPath;
		}

		// trigger account edit
		void yw_account.invalidate();

		if(completed) {
			completed(true);
		}
		else {
			k_page.reset();

			if(fresh) {
				void $yw_navigator.activateThread(ThreadId.TOKENS);

				// switch to new account
				$yw_account_ref = accountPath;
			}
		}
	}

	function pfpg_updated() {
		if(!g_account?.extra?.['customPfp'] && !b_pfp_custom) {
			// clone aura element
			const dm_svg_clone = dm_svg_pfpg.cloneNode(true) as SVGSVGElement;

			// adjust svg bounds
			const s_height = dm_svg_clone.getAttribute('height')!;
			dm_svg_clone.setAttribute('width', s_height);
			dm_svg_clone.setAttribute('viewBox', `0 0 ${s_height} ${s_height}`);

			// preview pfp replacement
			p_pfp = `svg:data:image/svg+xml;base64,${text_to_base64(dm_svg_clone.outerHTML)}`;
		}
	}


	let b_tooltip_showing = false;

</script>

<style lang="less">
	@import '../_base.less';

	.tooltip {
		position: absolute;
		right: var(--ui-padding);
		margin: 1px;
		padding: 0.5em 0.75em;
		border-radius: 0 0 0 10px;
		background-color: transparent;
	}

	.pfpg-preview {
		margin-bottom: -24px;
		display: flex;

		position: relative;
		.offset {
			position: absolute;
			top: 1px;
			left: 1px;
			background-color: rgba(0,0,0,0.6);
			padding: 6px 8px;
			width: 2.5em;
			border-radius: 10px 0 8px 0px;
			color: var(--theme-color-text-med);
			.font(mono);
			border: 1px solid var(--theme-color-border);
			border-top-color: transparent;
			border-left-color: transparent;
		}
	}

	.generator {
		position: relative;
		top: -10px;
		margin: 0 8px;

		display: flex;
		// gap: 0.75em;
		justify-content: space-between;

		>* {
			flex: 1;
			max-width: 4.25em;

			.prev {
				transform: rotate(90deg) scale(1.5);
			}

			.next {
				transform: rotate(-90deg) scale(1.5);
			}
		}
	}
</style>

<Screen progress={b_mandatory? [5, 5]: null}>
	<Header plain pops={!fresh && !oneway}
		title="{accountPath && !fresh? 'Edit': 'New'} account"
		postTitle={accountPath && !fresh? s_name: ''}
	/>

	<span style="display:none" class:pfpg-preview={false} class:generator={false}></span>

	{#await load_account()}
		<Load forever />
	{:then}
		<Field key="profile-aura" name="Profile aura">
			<span class="tooltip">
				<Tooltip bind:showing={b_tooltip_showing}>
					These images are called "Auras". They are procedurally generated by your account.
					Auras are universally unique to your private key. <br><br>
					The Aura is always shown during signing requests and helps protect against phishing attacks,
					since fake sites won't be able to fake your Aura.
				</Tooltip>
			</span>

			<div class="pfpg-preview">
				<PfpGenerator offset={i_offset} seed={atu8_art_seed}
					bind:svgElement={dm_svg_pfpg}
					on:update={() => pfpg_updated()}
				/>

				<span class="offset">
					#{i_offset+1}
				</span>
			</div>

			<div class="generator">
				<button class="pill" on:click={() => i_offset--} disabled={0 === i_offset}>
					<span class="global_svg-icon icon-diameter_14px prev">
						{@html SX_ICON_ARROW}
					</span>
				</button>
				<button class="pill" on:click={() => i_offset++}>
					<span class="global_svg-icon icon-diameter_14px next">
						{@html SX_ICON_ARROW}
					</span>
				</button>
			</div>
		</Field>

		<Field key="account-name" name="Name">
			<input id="account-name" type="text" bind:value={s_name} placeholder="Satoshi">
		</Field>

		<Field key="account-address" name="Public address">
			<Info address key="account-address" b_no_scroll>
				<Address copyable address={sa_account} />
			</Info>
		</Field>

		<Field key="profile-image" name="Custom profile image (optional)">
			<div class="pfp-preview">
				<IconEditor intent='person' name={s_name}
					bind:pfpPath={p_pfp}
					on:upload={(d_event) => {
						b_pfp_custom = 1;
						p_pfp = d_event.detail;
						g_account.extra = {
							...g_account.extra,
							customPfp: 1,
						};
					}}
				/>
			</div>
		</Field>

		<h3>{accountPath && !fresh? 'Edit': 'Add'} Tags</h3>

		<InlineTags editable resourcePath={accountPath} />

		{#if oneway}
			<ActionsLine confirm={['Finish', save_account, !b_form_valid]} />
		{:else}
			<ActionsLine cancel={!completed} back confirm={['Finish', save_account, !b_form_valid]} />
		{/if}
	{/await}

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>