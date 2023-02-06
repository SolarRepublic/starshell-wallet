<script lang="ts">
	import type {Dict} from '#/meta/belt';
	import type {Bech32, ChainPath, ContractStruct} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {fromBech32} from '@cosmjs/encoding';
	
	import {Screen} from './_screens';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_navigator, yw_network} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {R_BECH32, R_CONTRACT_NAME, R_TOKEN_SYMBOL} from '#/share/constants';
	import {Chains} from '#/store/chains';
	import {Contracts, ContractRole} from '#/store/contracts';
	import {timeout_exec} from '#/util/belt';
	
	import TokensAdd from './TokensAdd.svelte';
	import IconEditor from '../frag/IconEditor.svelte';
	import SenderSelect from '../frag/SenderSelect.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	

	const {k_page} = load_page_context();

	export let staged: ContractStruct[] = [];

	let p_account = $yw_account_ref;

	let b_locked = false;

	let sa_token = '';
	let s_token_name = '';
	let s_symbol = '';
	let s_decimals = '6';
	let p_pfp: PfpTarget = '';


	// load cache of existing contracts
	const h_exists_bech32s: Dict<[ContractRole, string]> = {};
	const h_exists_names: Dict<ChainPath[]> = {};
	const h_exists_symbols: Dict<number> = {};

	// asynchornously cache all existing contract defintions to check for conflicts
	(async() => {
		b_locked = true;

		try {
			for(const [, g_contract] of (await Contracts.read()).entries()) {
				// same chain
				if($yw_chain_ref === g_contract.chain) {
					// already a token
					const g_snip20 = g_contract.interfaces.snip20;
					if(g_snip20) {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractRole.FUNGIBLE, g_snip20.symbol];

						// add to symbols dict
						h_exists_symbols[g_snip20.symbol.toLocaleLowerCase()] = 1;
					}
					// not yet a token
					else {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractRole.OTHER, g_contract.name];
					}
				}

				// add to chains list
				(h_exists_names[g_contract.name] = h_exists_names[g_contract.name] || [])
					.push(g_contract.chain);
			}
		}
		finally {
			b_locked = false;
		}
	})();

	$: {
		if(sa_token && Chains.isValidAddressFor($yw_chain, sa_token)) {
			// snip-20
			if($yw_chain.features.secretwasm) {
				// lock temporarily
				b_locked = true;

				// search for locally
				void Contracts.filterTokens({
					bech32: sa_token,
					chain: $yw_chain_ref,
					interfaces: {
						snip20: {},
					},
				}).then(async(a_found) => {
					// found locally
					if(a_found.length) {
						// unlock
						b_locked = false;

						const g_found = a_found[0];

						s_token_name = g_found.name;
						const g_snip20 = g_found.interfaces.snip20;
						s_symbol = g_snip20.symbol;
						s_decimals = g_snip20.decimals+'';

						p_pfp = g_found.pfp;
					}
					// not found locally
					else {
						// query chain
						let g_info;
						try {
							[g_info] = await timeout_exec(5e3, () => ($yw_network as SecretNetwork).snip20Info($yw_account, {
								bech32: sa_token as Bech32,
							}));
						}
						catch(e_info) {}

						// unlock
						b_locked = false;

						// set info from snip-20 info
						if(g_info) {
							s_token_name = g_info.name;
							s_symbol = g_info.symbol;
							s_decimals = g_info.decimals+'';
						}
					}
				});
			}
		}
	}

	let s_err_address = '';
	let s_warn_address = '';
	function test_address() {
		s_err_address = '';

		if(!Chains.isValidAddressFor($yw_chain, sa_token)) {
			if(!R_BECH32.exec(sa_token)) {
				s_err_address = `Incomplete address`;
			}
			else {
				try {
					fromBech32(sa_token);

					s_err_address = `Account address should start with "${$yw_chain.bech32s.acc}1"`;
				}
				catch(e_checksum) {
					s_err_address = 'Invalid address checksum';
				}
			}
		}


		s_warn_address = '';

		if(!s_err_address) {
			const a_defined = h_exists_bech32s[sa_token];
			if(a_defined) {
				const [xc_contract, s_label] = a_defined;

				if(ContractRole.TOKEN === xc_contract) {
					s_err_address = `Token already defined as ${s_label}`;
				}
				else if(ContractRole.OTHER === xc_contract) {
					s_warn_address = `Contract already defined as non-token. Proceeding will overwrite`;
				}
			}
		}
	}

	function change_address() {
		if(sa_token) test_address();
	}

	$: b_errd_address = b_errd_address || !!s_err_address;
	function input_address() {
		if(b_errd_address) test_address();
	}

	function test_name() {
		s_err_name = R_CONTRACT_NAME.test(s_token_name)? '': 'Invalid token name';

		if(!s_err_name) {
			const a_chains = h_exists_names[s_token_name];

			if(a_chains.includes($yw_chain_ref)) {
				s_err_name = `Token name already in use on ${$yw_chain.name}`;
			}
		}
	}

	let s_err_name = '';
	function change_name() {
		if(s_token_name) test_name();
	}

	$: b_errd_name = b_errd_name || !!s_err_name;
	function input_name() {
		if(b_errd_name) test_name();
	}

	function test_symbol() {
		s_err_symbol = R_TOKEN_SYMBOL.test(s_symbol)? '': 'Invalid token symbol';

		if(!s_err_symbol && h_exists_symbols[s_symbol.toLocaleLowerCase()]) {
			s_err_symbol = `Token symbol already in use on ${$yw_chain.name}`;
		}
	}

	let s_err_symbol = '';
	function change_symbol() {
		if(s_symbol) test_symbol();

		// errored
		if(s_err_symbol) {
			// try upper-casing
			const s_original = s_symbol;
			s_symbol = s_symbol.toLocaleUpperCase();
			test_symbol();

			// stil an error, restore original
			if(s_err_symbol) s_symbol = s_original;
		}
	}

	$: b_errd_symbol = b_errd_symbol || !!s_err_symbol;
	function input_symbol() {
		if(b_errd_symbol) test_symbol();
	}


	$: b_form_valid = !!(sa_token && !s_err_address && s_token_name && !s_err_name && s_symbol && !s_err_symbol);

	async function submit() {
		if(!b_form_valid) return;

		b_locked = true;

		// open contracts store
		const [p_contract, g_contract] = await Contracts.open(async(ks_contracts) => {
			// create path
			const p_contract_local = Contracts.pathFor($yw_chain_ref, sa_token as Bech32);

			// get existing contract
			const g_contract_exist = ks_contracts.at(p_contract_local) || {};

			// upsert contract definition
			return await ks_contracts.merge({
				...g_contract_exist,
				on: 1,
				name: s_token_name,
				bech32: sa_token as Bech32,
				chain: $yw_chain_ref,
				hash: g_contract_exist['hash'] || '',
				origin: 'user',
				pfp: p_pfp || g_contract_exist['pfp'] || '',
				interfaces: {
					...g_contract_exist['interfaces'],
					snip20: {
						decimals: parseInt(s_decimals) as 0,
						symbol: s_symbol,
					},
				},
			});
		});

		// complete
		k_page.reset();

		$yw_navigator.activePage.push({
			creator: TokensAdd,
			props: {
				suggested: [
					g_contract,
					...staged,
				],
			},
		});
	}
</script>

<style lang="less">
	@import '../_base.less';

	.split {
		display: flex;
		gap: 20px;
	}
</style>

<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
	submit();
}}>
	<Header pops
		title='Add Token Manually'
	/>

	<Field
		key='account'
		name='Account'
	>
		<SenderSelect
			bind:accountPath={p_account}
		/>
	</Field>

	<Field
		key='token-bech32'
		name='Token Address'
	>
		<input type="text"
			bind:value={sa_token}
			on:change={change_address}
			on:input={input_address}
			placeholder={`${$yw_chain.bech32s.acc}1...`}
		>

		{#if s_err_address || s_warn_address}
			<span class="validation-message" class:warning={!!s_warn_address}>
				{s_err_address || s_warn_address}
			</span>
		{/if}
	</Field>

	<Field
		key='token-name'
		name='Token Full Name'
	>
		<input type="text"
			bind:value={s_token_name}
			on:change={change_name}
			on:input={input_name}
			placeholder={`Bitcoin`}
		>

		{#if s_err_name}
			<span class="validation-message">
				{s_err_name}
			</span>
		{/if}
	</Field>

	<div class="split">
		<Field
			key='token-symbol'
			name='Symbol'
			rootStyle='flex:1;'
		>
			<input type="text"
				bind:value={s_symbol}
				on:change={change_symbol}
				on:input={input_symbol}
				placeholder={`BTC`}
			>

			{#if s_err_symbol}
				<span class="validation-message">
					{s_err_symbol}
				</span>
			{/if}
		</Field>
		
		<Field
			key='token-decimals'
			name='Decimals'
			rootStyle='flex:1;'
		>
			<input type="number"
				inputmode="numeric"
				bind:value={s_decimals}
				min="0" max="18" step="1"
				pattern="[0-9]*"
			>
		</Field>
	</div>

	<Field
		key='token-icon'
		name="Token Icon"
	>
		<IconEditor bind:pfpPath={p_pfp} name={s_token_name} />
	</Field>

	<ActionsLine back confirm={['Save', submit, !b_form_valid]} />
</Screen>
