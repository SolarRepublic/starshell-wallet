<script lang="ts">
	import type {Page} from '../nav/page';
	
	import type {Dict} from '#/meta/belt';
	import type {Bech32, ChainPath, ContractPath, ContractStruct} from '#/meta/chain';
	
	import {deduce_token_interfaces, Snip2xToken} from '#/schema/snip-2x-const';
	
	import {getContext} from 'svelte';
	
	import {Header, Screen} from './_screens';
	import {syserr} from '../common';
	import {validate_contract} from '../helper/contract-validator';
	
	import {yw_account, yw_account_ref, yw_context_popup, yw_navigator, yw_network, yw_popup} from '../mem';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Chains} from '#/store/chains';
	import {Contracts, ContractRole} from '#/store/contracts';
	import {CoinGecko} from '#/store/web-apis';
	
	import {F_NOOP, ode} from '#/util/belt';
	
	import ContractView from './ContractView.svelte';
	import Address from '../frag/Address.svelte';
	import IconEditor from '../frag/IconEditor.svelte';
	import InlineTags from '../frag/InlineTags.svelte';
	import NumericInput from '../frag/NumericInput.svelte';
	import PopupNotice from '../popup/PopupNotice.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Field from '../ui/Field.svelte';
	import Info from '../ui/Info.svelte';
	import Load from '../ui/Load.svelte';
	import type {SelectOption} from '../ui/StarSelect.svelte';
	import StarSelect from '../ui/StarSelect.svelte';
    import { Accounts } from '#/store/accounts';
	
	let h_interface_registry: Dict<{
		title: string;
		label: string;
		checked: boolean;
		disabled: boolean;
	}> = {};

	const k_page = getContext<Page>('page');

	/**
	 * Contract resource path
	 */
	export let p_contract: ContractPath | '' = '';

	const {
		yw_contract,
		yw_contract_name,
		yw_contract_bech32,
		yw_contract_on,
		yw_contract_pfp,
		yw_contract_type,

		yw_token_symbol,
		yw_token_decimals,
		yw_token_coingecko,
		yw_contract_chain,

		yw_err_contract_name,
		yw_err_contract_bech32,
		yw_wrn_contract_bech32,
		yw_err_token_symbol,
		yw_err_token_decimals,

		test_contract_name,

		yw_locked,
	} = validate_contract(p_contract as ContractPath);
	
	// derive token state from contract type
	$: b_token = ContractRole.TOKEN & $yw_contract_type;

	// inherit interfaces from contract def
	$: h_interfaces = $yw_contract?.interfaces || {} as ContractStruct['interfaces'];

	// prep coingecko error text
	const s_err_coingecko = '';

	// define reactive form validity
	$: b_form_valid = $yw_contract_name && !$yw_err_contract_name
		&& yw_contract_bech32 && !$yw_err_contract_bech32
		&& (b_token
			? $yw_token_symbol && !$yw_err_token_symbol
				&& $yw_token_decimals && !$yw_err_token_decimals
			: true);

	// selected coingecko id
	let g_selected_coingecko: SelectOption;

	// all coingecko select options
	let a_coingecko_registry: SelectOption[];

	// coingecko data loading state
	let b_coingecko_loading = false;

	// load interface registry depending on chain
	yw_contract_chain.subscribe((g_chain) => {
		if(!g_chain) return;

		const a_excluded = h_interfaces.excluded || [];

		if(g_chain.features.secretwasm) {
			h_interface_registry = {
				snip20: {
					title: 'SNIP-20',
					label: 'Fungible Token',
					checked: true,
					disabled: a_excluded.includes('snip20'),
				},
				snip21: {
					title: 'SNIP-21',
					label: 'Improved SNIP-20',
					checked: !!h_interfaces.snip21,
					disabled: a_excluded.includes('snip21'),
				},
				snip22: {
					title: 'SNIP-22',
					label: 'Batch Operations',
					checked: !!h_interfaces.snip22,
					disabled: a_excluded.includes('snip22'),
				},
				snip23: {
					title: 'SNIP-23',
					label: 'Enhanced Send',
					checked: !!h_interfaces.snip23,
					disabled: a_excluded.includes('snip23'),
				},
				snip24: {
					title: 'SNIP-24',
					label: 'Query Permits',
					checked: !!h_interfaces.snip24,
					disabled: a_excluded.includes('snip24'),
				},
				snip25: {
					title: 'SNIP-25',
					label: 'Security Update',
					checked: !!h_interfaces.snip25,
					disabled: a_excluded.includes('snip25'),
				},
				snip721: {
					title: 'SNIP-721',
					label: 'Non-Fungible Token',
					checked: !!h_interfaces.snip721,
					disabled: a_excluded.includes('snip721'),
				},
				snip722: {
					title: 'SNIP-722',
					label: 'Badges, POAPS & Non-Txferable',
					checked: !!h_interfaces.snip722,
					disabled: a_excluded.includes('snip722'),
				},
				snip1155: {
					title: 'SNIP-1155',
					label: 'Multitoken',
					checked: !!h_interfaces.snip1155,
					disabled: a_excluded.includes('snip1155'),
				},
			};
		}
	});

	// react to coingecko id updates
	yw_token_coingecko.subscribe((si_coingecko) => {
		// do not load unnecessarily
		void navigator.locks.request(`ui:coingecko:all-ids`, async() => {
			// already loaded
			if(a_coingecko_registry) {
				// clear selection
				// @ts-expect-error no undefined type
				g_selected_coingecko = void 0;

				// token has a coingecko id
				if(si_coingecko) {
					// search for existing selection
					for(const g_option of a_coingecko_registry) {
						// found match; set selection
						if(si_coingecko === g_option.value) {
							g_selected_coingecko = g_option;
						}
					}
				}

				// done
				return;
			}

			// start loading
			b_coingecko_loading = true;

			// load all coingecko ids
			const a_coins = await CoinGecko.allCoins();

			// update registry of select options
			a_coingecko_registry = a_coins.map((g_coin) => {
				const g_option = {
					primary: g_coin.id,
					secondary: `${g_coin.symbol.toUpperCase()} (${g_coin.name})`,
					value: g_coin.id,
				};

				if(si_coingecko && si_coingecko === g_coin.id) {
					g_selected_coingecko = g_option;
				}

				return g_option;
			});

			// loading done
			b_coingecko_loading = false;
		});
	});

	// counter for triggering dormant validations
	let c_show_validations = 0;

	// token's hidden state for this account
	let b_token_hidden = false;
	yw_contract.once(() => {
		b_token_hidden = !!$yw_account.assets[$yw_contract.chain]?.data[$yw_contract.bech32].hidden;
	});

	// user attempt to save
	async function save() {
		// ref current contract def
		let g_contract = $yw_contract;

		// update hidden state
		await Accounts.update($yw_account_ref, g_latest => ({
			...g_latest,
			assets: {
				...g_latest.assets,
				[$yw_contract.chain]: {
					...g_latest.assets[$yw_contract.chain],
					data: {
						...g_latest.assets[$yw_contract.chain]?.data,
						[$yw_contract.bech32]: {
							...g_latest.assets[$yw_contract.chain]?.data[$yw_contract.bech32],
							hidden: b_token_hidden,
						},
					},
				},
			},
		}));

		// fill contract properties from store
		const g_contract_fill = {
			name: $yw_contract_name,
			pfp: $yw_contract_pfp,
			on: $yw_contract_on,
			interfaces: h_interfaces,
		};

		// contract is snip20
		if(h_interfaces.snip20) {
			Object.assign(h_interfaces.snip20, {
				symbol: $yw_token_symbol,
				decimals: $yw_token_decimals,
				extra: {
					...h_interfaces.snip20.extra,
					coingeckoId: $yw_token_coingecko,
				},
			});
		}

		// form is invalid
		if(!b_form_valid) {
			c_show_validations++;
			console.log('invalid form');

			return;
		}
		// contract is being updated
		else if(p_contract && g_contract) {
			Object.assign(g_contract, g_contract_fill);
		}
		// contract is being created
		else if($yw_contract_chain) {
			g_contract = Object.assign(g_contract_fill, {
				chain: Chains.pathFrom($yw_contract_chain),
				bech32: $yw_contract_bech32,
				origin: 'user' as const,
				interfaces: h_interfaces,
				hash: '',
			});
		}

		// no contract; nothing to save
		if(!g_contract) {
			throw syserr({
				title: 'Cannot save empty data',
				text: 'Missing contract struct',
			});
		}

		// lock the form
		$yw_locked = true;
		try {
			// save contract def to store
			await Contracts.merge(g_contract);

			// reset thread
			k_page.reset();

			// immediately open new contract
			$yw_navigator.activePage.push({
				creator: ContractView,
				props: {
					contractPath: p_contract,
				},
			});
		}
		catch(e_write) {
			throw syserr(e_write as Error);
		}
		finally {
			$yw_locked = false;
		}
	}

	// update the coingecko id when user clears or selects something different
	function select_coingecko_id(g_option: SelectOption) {
		$yw_token_coingecko = g_option.value;
	}

	let b_editting_interfaces = false;

	function edit_interfaces() {
		$yw_context_popup = {
			title: 'Editting Contract Interfaces',
			infos: [
				'This is an advanced option. Only enable interfaces if you are absolutely sure the contract implements them, otherwise parts of the wallet may break.',
				'If an option is still disabled, it means the wallet has definitively concluded that interface is not applicable to the contract.',
			],
			ok() {
				b_editting_interfaces = true;
			},
		};

		$yw_popup = PopupNotice;
	}

	let b_deducing_interfaces = false;

	async function deduce_interfaces() {
		b_deducing_interfaces = true;

		try {
			await deduce_token_interfaces(yw_contract.get()!, yw_network.get() as SecretNetwork, yw_account.get());
		}
		catch(e_deduce) {}

		// reload the contract struct to trigger interface update
		const g_contract = await Contracts.at(p_contract as ContractPath);
		$yw_contract = g_contract!;

		b_deducing_interfaces = false;
	}
</script>

<style lang="less">
	@import '../_base.less';

	#chain-namespace {
		:global(&) {
			flex: 1;
			align-items: baseline;
			.font(tiny);
			color: var(--theme-color-text-med);

			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>

<Screen form slides leaves>
	<Header
		plain pops
		title="{p_contract? 'Edit': 'Add New'} {b_token? 'Token': 'Contract'}"
	/>

	<Field key="contract-name" name="Name">
		<input type="text" spellcheck="false" required
			placeholder="Enter a name"
			disabled={$yw_locked}
			class:invalid={$yw_err_contract_name}
			bind:value={$yw_contract_name}
			on:change={() => test_contract_name()}
		>

		{#if $yw_err_contract_name}
			<span class="validation-message">
				{$yw_err_contract_name}
			</span>
		{/if}
	</Field>

	{#if b_token}
		<div class="global_flex-1" style="align-items:flex-start; gap:var(--ui-padding);">
			<Field key='token-symbol' name='Symbol'>
				<input type="text" spellcheck="false" required
					placeholder="Enter a token symbol (e.g., BTC, ETH, sSCRT)"
					disabled={$yw_locked} 
					class:invalid={!!$yw_err_token_symbol}
					bind:value={$yw_token_symbol}
				>

				{#if $yw_err_token_symbol}
					<span class="validation-message">
						{$yw_err_token_symbol}
					</span>
				{/if}
			</Field>
			
			<Field key='token-decimals' name='Decimals'>
				<NumericInput min=0 max=18 required
					disabled={$yw_locked}
					value={$yw_token_decimals+''}
					on:input={d => $yw_token_decimals = parseFloat(d.currentTarget?.['value']+'')}
					bind:error={$yw_err_token_decimals}
				/>
			</Field>
		</div>

		<Field key="coingecko-id" name="Coingecko ID (optional)">
			{#if b_coingecko_loading}
				{#if $yw_token_coingecko}
					<input type="text" disabled
						value={`${$yw_token_coingecko} - [...]`}
					/>
				{:else}
					<Load width="100%" height="48px" forever />
				{/if}
			{:else}
				<StarSelect clearable showChevron
					items={a_coingecko_registry}
					value={g_selected_coingecko}
					on:select={d => select_coingecko_id(d.detail)}
					on:clear={() => $yw_token_coingecko = ''}
				/>
			{/if}
		</Field>
	{/if}

	<Field key="contract-address" name="Address">
		{#if p_contract}
			<Info key="address">
				<Address address={$yw_contract_bech32} copyable />
			</Info>
		{/if}
	</Field>

	<Field key="contract-pfp" name="Profile Icon">
		<IconEditor intent='token' bind:pfpPath={$yw_contract_pfp} name={$yw_contract_name} />
	</Field>

	{#if b_token}
		<Field key="interfaces" name="Contract Interfaces">
			<svelte:fragment slot="right">
				{#if !b_editting_interfaces}
					<span class="link" on:click={edit_interfaces}>
						Edit (Advanced)
					</span>
				{:else if b_deducing_interfaces}
					<span>
						Deducing....
					</span>
				{:else}
					<span class="link" on:click={deduce_interfaces}>
						Re-run deduction
					</span>
				{/if}
			</svelte:fragment>
			{#each ode(h_interface_registry) as [si_interface, g_interface]}
				<div class="interface-option">
					<CheckboxField id={si_interface}
						checked={g_interface.checked}
						disabled={b_deducing_interfaces? true: b_editting_interfaces? g_interface.disabled: true}
						rootStyle={`
							margin: 0.5em 0.5em;
							display: inline-flex;
						`}
					>
						<span class="title" style="min-width: 7ch;">
							{g_interface.title}
						</span>
						<span class="label" style="color:var(--theme-color-text-med);">
							- {g_interface.label}
						</span>
					</CheckboxField>
				</div>
			{/each}
		</Field>

		<Field key="visibility" name="Visibility">
			<CheckboxField id="token-visibility" bind:checked={b_token_hidden}>
				Hide token in homepage
			</CheckboxField>
		</Field>
	{/if}

	<hr class="no-margin">

	<h3>
		{p_contract? 'Edit': 'Add'} Tags
	</h3>

	<InlineTags editable resourcePath={p_contract} />

	<ActionsLine back allowDisabledClicks confirm={[p_contract? 'Save': 'Add', save, !b_form_valid]} />
</Screen>