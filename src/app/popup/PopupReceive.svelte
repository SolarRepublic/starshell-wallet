<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {Dict} from '#/meta/belt';
	import type {ChainStruct, ChainPath} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	import type {Resource} from '#/meta/resource';
	
	import QRCode from 'qrcode-svg';
	
	import {yw_popup, yw_context_popup, yw_account_ref, yw_chain_ref} from '../mem';
	
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {ode, oderac, ofe} from '#/util/belt';
	import {dd, open_external_link} from '#/util/dom';
	
	import Address from '../frag/Address.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	import Close from '../ui/Close.svelte';
	import Field from '../ui/Field.svelte';
	import Info from '../ui/Info.svelte';
	import Load from '../ui/Load.svelte';
	import StarSelect, {type SelectOption} from '../ui/StarSelect.svelte';
	
	import SX_ICON_LAUNCH from '#/icon/launch.svg?raw';

	const XL_QR_DIM = 180;

	// selected account
	let g_option_selected_account: Pick<SelectOption<AccountPath>, 'value'> = {value:$yw_account_ref};
	$: p_account_selected = g_option_selected_account.value;

	// reactively update account
	let g_account_selected: AccountStruct;
	$: {
		if(p_account_selected) {
			void Accounts.read().then((ks_accounts) => {
				g_account_selected = ks_accounts.at(p_account_selected as AccountPath)!;
			});
		}
	}

	// convert an account path+interface to a select option
	const account_to_option = (p_account: AccountPath, g_account: AccountStruct): SelectOption<AccountPath> => ({
		object: g_account,
		value: p_account,
		primary: g_account.name,
		secondary: g_account.assets[$yw_chain_ref]?.totalFiatCache || '(?)',
	});

	// prep account pfps
	let h_pfps_account: Dict<HTMLElement> = {};

	// loads account from store and produces list of select options
	async function load_account_options(): Promise<SelectOption<AccountPath>[]> {
		// load accounts store
		const ks_accounts = await Accounts.read();

		// asynchronously load all pfps
		h_pfps_account = ofe(
			await Promise.all(
				ode(ks_accounts.raw).map(([_, g_account]) => new Promise(
					(fk_resolve: (a_entry: [PfpTarget, HTMLElement]) => void) => {
						const dm_dummy = dd('span');
						const yc_pfp = new PfpDisplay({
							target: dm_dummy,
							props: {
								dim: 28,
								genStyle: 'font-size: 18px;',
								resource: g_account,
								settle() {
									const dm_pfp = dm_dummy.firstChild?.cloneNode(true) as HTMLElement;
									yc_pfp.$destroy();
									fk_resolve([g_account.pfp, dm_pfp]);
								},
							},
						});
					}
				))
			));

		// convert chain dict to list of select options
		return oderac(ks_accounts.raw, account_to_option);
	}

	// selected chain
	let g_option_selected_chain: Pick<SelectOption<ChainPath>, 'value'> = {value:$yw_chain_ref};
	$: p_chain_selected = g_option_selected_chain.value;

	// reactively update selected chain
	let g_chain_selected: ChainStruct;
	$: {
		if(p_chain_selected) {
			void Chains.read().then((ks_chains) => {
				g_chain_selected = ks_chains.at(p_chain_selected as ChainPath)!;
			});
		}
	}

	// convert a chain path+interface to a select option
	const chain_to_option = (p_chain: ChainPath, g_chain: ChainStruct) => ({
		object: g_chain,
		value: p_chain,
		primary: g_chain.name,
		secondary: g_chain.reference,
		pfp: g_chain.pfp,
	});

	// prep chain pfps
	let h_pfps_chain: Dict<HTMLElement> = {};

	// loads chain from store and produces list of select options
	async function load_chain_options(): Promise<SelectOption[]> {
		// load chains store
		const ks_chains = await Chains.read();

		// asynchronously load all pfps
		h_pfps_chain = await load_pfps(ks_chains.raw);

		// convert chain dict to list of select options
		return oderac(ks_chains.raw, chain_to_option);
	}
	
	
	// no context was provided, default to current account
	if(!$yw_context_popup?.account) {
		$yw_context_popup = {account:$yw_account_ref};
	}


	// reactively generate qrcode
	let dm_qr: HTMLElement;
	let sx_raw = '';
	let p_s2r = '';
	$: {
		if(dm_qr && g_account_selected && g_chain_selected) {
			sx_raw = `caip-10:${g_chain_selected.namespace}:${g_chain_selected.reference}:${Chains.addressFor(g_account_selected.pubkey, g_chain_selected) || ''}`;
			p_s2r = `https://m.s2r.sh/#${sx_raw}`;

			const y_qrcode = new QRCode({
				// use hash fragment to encode the data so that is never leaves device
				content: p_s2r,
				width: XL_QR_DIM,
				height: XL_QR_DIM,
				padding: 0,
				ecl: 'H',
				join: true,
			}).svg();

			dm_qr.innerHTML = y_qrcode;
		}
	}

	async function load_pfps<
		p_res extends Resource.Path,
		g_res extends (Nameable & Pfpable),
	>(h_resources: Record<p_res, g_res>): Promise<Record<p_res, HTMLElement>> {
		return ofe(
			await Promise.all(
				ode(h_resources).map(([_, g_resource]) => new Promise(
					(fk_resolve: (a_entry: [p_res, HTMLElement]) => void) => {
						const dm_dummy = dd('span');
						const yc_pfp = new PfpDisplay({
							target: dm_dummy,
							props: {
								dim: 28,
								genStyle: 'font-size: 18px;',
								resource: g_resource,
								settle() {
									const dm_pfp = dm_dummy.firstChild?.cloneNode(true) as HTMLElement;
									yc_pfp.$destroy();
									fk_resolve([g_resource.pfp as p_res, dm_pfp]);
								},
							},
						});
					}
				))
			));
	}
</script>

<style lang="less">
	@import '../_base.less';

	.qr-code {
		flex-shrink: 0;
		border-radius: 8px;
		overflow: hidden;
		text-align: center;
		margin-left: auto;
		margin-right: auto;
		padding: 4px;
		background-color: white;
	}

	.info {
		.font(regular);
		text-align: center;
	}
</style>


<h3>
	Receive
</h3>

<Close absolute --margin='5px' on:click={() => $yw_popup = null} />

<Field short
	key="chain-select"
	name="Chain"
>
	{#await load_chain_options()}
		<Load forever />
	{:then a_chains_select}
		<StarSelect id="chain-select"
			pfpMap={h_pfps_chain}
			placeholder="Select chain"
			items={a_chains_select}
			bind:value={g_option_selected_chain}
		/>
	{/await}
</Field>

<Field short
	key="account-select"
	name="Account"
>
	{#await load_account_options()}
		<Load forever />
	{:then a_accounts_select}
		<StarSelect id="account-select"
			pfpMap={h_pfps_account}
			placeholder="Select account"
			secondaryClass='balance'
			items={a_accounts_select}
			bind:value={g_option_selected_account}
		/>
	{/await}
</Field>

<Info address key="receive-address">
	{#if g_account_selected && g_chain_selected}
		<Address copyable address={Chains.addressFor(g_account_selected?.pubkey, g_chain_selected) || ''} />
	{/if}
</Info>

<center>
	<span class="link">
		<span class="global_svg-icon icon-diameter_20px" style="vertical-align: middle;">
			{@html SX_ICON_LAUNCH}
		</span>

		<a href={p_s2r} on:click={() => open_external_link(p_s2r)}>
			Share as a private, permanent link
		</a>
	</span>
</center>

<div class="qr-code" bind:this={dm_qr} style={`
	width: ${XL_QR_DIM}px;
	height: ${XL_QR_DIM}px;
`} />

<!-- <div class="info">
	Scan QR code to receive to this address
</div> -->