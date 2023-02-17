<script lang="ts">
	import type {CoinInfo, ContractStruct} from '#/meta/chain';

	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	
	import {Screen, Header} from './_screens';
	import {syserr} from '../common';
	import {starshell_transaction} from '../helper/starshell';
	import {yw_account, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';

	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {Secrets} from '#/store/secrets';
	import {fold} from '#/util/belt';
	
	import TokensAdd from './TokensAdd.svelte';
	import type {AssetType} from '../frag/AmountInput.svelte';
	import AmountInput from '../frag/AmountInput.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	

	const {k_page} = load_page_context();

	export let si_coin: string;

	const s_chain = $yw_chain?.name || '?';


	// bindings for AmountInput
	let s_amount: string;
	let n_decimals: number;
	let s_symbol: string;
	let xc_asset: AssetType;
	let b_use_max: boolean;

	let g_contract: ContractStruct;

	let b_wrapper_exists = false;
	
	const g_coin = $yw_chain.coins[si_coin];

	const sa_token = g_coin?.extra?.nativeBech32;

	let s_token_symbol = 'destination';

	let s_err_amount = '';
	let s_warn_amount = '';

	$: if(b_use_max) {
		s_warn_amount = 'No gas left for future transactions';
	}
	else {
		s_warn_amount = '';
	}

	$: b_form_valid = s_amount && g_coin && sa_token && !s_err_amount;

	// fee buffers
	$: h_fee_buffers = fold($yw_chain.feeCoinIds || [], si_coin => ({
		// TODO: use simulation data
		[si_coin]: BigNumber(15_000n+''),
	}));

	(async function load() {
		[g_contract] = await Contracts.filterTokens({
			chain: $yw_chain_ref,
			bech32: sa_token!,
		});

		if(!g_contract) return;

		s_token_symbol = g_contract.interfaces.snip20?.symbol || `secret version of ${si_coin}`;

		const a_secrets = await Secrets.filter({
			type: 'viewing_key',
			on: 1,
			chain: $yw_chain_ref,
			contract: g_contract.bech32,
			owner: $yw_owner,
		});

		if(!a_secrets?.length) return;

		b_wrapper_exists = true;
	})();

	function add_token() {
		k_page.push({
			creator: TokensAdd,
			props: {
				suggested: [g_contract],
			},
		});
	}

	async function submit() {
		if(!sa_token) {
			throw syserr({
				title: 'No wrap contract',
				text: `${si_coin} does not seem to be affiliated with a contract that wraps it.`,
			});
		}

		const g_deposit = await Snip2xMessageConstructor.deposit($yw_account, {
			bech32: sa_token,
			chain: $yw_chain_ref,
			hash: g_contract?.hash || '',
		}, $yw_network as SecretNetwork, [
			{
				amount: BigNumber(s_amount).shiftedBy(n_decimals).toString(),
				denom: g_coin.denom,
			},
		]);

		starshell_transaction([g_deposit.proto], $yw_chain.features.secretwasm?.snip20GasLimits.deposit);
	}
</script>

<style lang="less">
	
</style>

<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
	return false;
}}>
	<Header pops
		title={'Wrapping'}
		postTitle={si_coin}
		subtitle={s_chain}
	/>

	<p>
		{si_coin} is the native gas coin for {s_chain}, its balances and transfer histories are not private.
	</p>
	
	<p>
		In order to take advantage of Secret's privacy features, you can wrap {si_coin} by converting it 1:1 to the s{si_coin} token.
	</p>

	<hr class="no-margin">

	{#if !b_wrapper_exists}
		<p>
			First, you need to add the {s_token_symbol} token to your wallet.
		</p>

		<ActionsLine cancel='pop' confirm={['Next', () => add_token()]} />
	{:else}
		<Field short key='amount' name='Amount'>
			<AmountInput
				feeBuffers={h_fee_buffers}
				assetPath={Entities.holdingPathFor($yw_owner, si_coin, $yw_chain_ref)}
				bind:assetType={xc_asset}
				bind:symbol={s_symbol}
				bind:useMax={b_use_max}
				bind:error={s_err_amount}
				bind:value={s_amount}
				bind:decimals={n_decimals}
				coin={g_coin}
			/>
		</Field>

		<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid]} />
	{/if}
</Screen>
