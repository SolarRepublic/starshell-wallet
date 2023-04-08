<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {Bech32, ContractStruct} from '#/meta/chain';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	
	import {load_app_context} from '../svelte';
	
	import {produce_contracts} from '#/chain/contract';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {QueryCache} from '#/store/query-cache';
	import {Secrets} from '#/store/secrets';
	
	import {buffer_to_text} from '#/util/data';
	
	import {format_amount} from '#/util/format';
	
	import Screen from '../container/Screen.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	

	const g_context = load_app_context();
	const {
		g_app,
		p_app,
		p_chain,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	export let bech32s: Bech32[];

	const dp_account = Accounts.at(p_account) as Promise<AccountStruct>;

	const nl_tokens = bech32s.length;
	const b_plural = 1 !== nl_tokens;
	
	$: s_title = `Expose ${nl_tokens} Viewing Key${b_plural? 's': ''}?`;

	let b_loaded = false;
	const b_allowing = false;

	let b_tooltip_showing = false;

	const a_secrets: SecretStruct<'viewing_key'>[] = [];

	let a_contracts: ContractStruct[] = [];
	let a_contracts_secondary: ContractStruct[] = [];

	let g_account: AccountStruct;
	let sa_owner: Bech32;

	let h_balances: Record<Bech32, string> = {};

	async function load_contracts() {
		g_account = (await Accounts.at(p_account))!;
		sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

		a_contracts = await produce_contracts(bech32s, g_chain, g_app, g_account);

		// TODO: move this into `TokenRow`
		const ks_cache = await QueryCache.read();
		for(const g_contract of a_contracts) {
			const g_balance = ks_cache.get(p_chain, sa_owner, `${g_contract.bech32}:balance`);

			const s_amount = g_balance?.data?.amount;
			if('string' === typeof s_amount) {
				h_balances[g_contract.bech32] = format_amount(
					BigNumber(s_amount).shiftedBy(-g_contract.interfaces.snip20!.decimals).toNumber()
				)+' '+g_contract.interfaces.snip20?.symbol;
			}
		}

		h_balances = h_balances;

		void load_secondary_contracts();

		return a_contracts;
	}

	/**
	 * Since it's possible for users to reuse viewing keys for different tokens,
	 * this method finds all 'secondary' tokens affected by revealing viewing keys
	 * for the primary tokens
	 */
	async function load_secondary_contracts() {
		// set of viewing keys exposed to app
		const as_export_keys = new Set<string>();

		// set of primary contracts being exported to app
		const as_export_bech32s = new Set<Bech32>();

		// each primary token
		for(const g_contract of a_contracts) {
			// load viewing key
			const [sh_export, g_export] = (await Snip2xToken.viewingKeyFor(g_contract, g_chain, g_account))!;

			// add viewing key text to set of exposed keys
			as_export_keys.add(sh_export);

			// add token to set of exported contracts
			as_export_bech32s.add(g_export.contract);

			// prepare to update viewing key's outlets
			a_secrets.push(g_export);
		}

		// load all enabled viewing keys belonging to owner on current chain
		const a_viewing_keys = await Secrets.filter({
			type: 'viewing_key',
			on: 1,
			chain: p_chain,
			owner: sa_owner,
		});

		// set of secondary tokens affected by viewing key reveals
		const as_secondaries = new Set<Bech32>();

		// each viewing key
		for(const g_viewing_key of a_viewing_keys) {
			// load its secret
			const [sh_key, g_secret] = await Secrets.borrowPlaintext(g_viewing_key, (kn, g) => [
				buffer_to_text(kn.data),
				g as SecretStruct<'viewing_key'>,
			] as const);

			// contract already accounted for
			if(as_export_bech32s.has(g_secret.contract)) continue;

			// key is being exported
			if(as_export_keys.has(sh_key)) {
				// add token to secondary set
				as_secondaries.add(g_secret.contract);

				// add secret to list for update
				a_secrets.push(g_secret);
			}
		}

		// produce list of secondaries affected
		a_contracts_secondary = await produce_contracts([...as_secondaries], g_chain, g_app, g_account);

		// done
		b_loaded = true;
	}

	function cancel() {
		completed(false);
	}

	async function allow() {
		// add app as viewing key outlet
		for(const g_secret of a_secrets) {
			await Secrets.update({
				...g_secret,
				outlets: [...new Set([
					...g_secret.outlets,
					p_app,
				])],
			});
		}

		completed(true);
	}

</script>


<Screen>
	{#await dp_account}
		<AppBanner app={g_app} chains={[g_chain]} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				{s_title}
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:then g_account}
		<AppBanner app={g_app} chains={[g_chain]} account={g_account} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					{s_title}
				</span>
				<Tooltip bind:showing={b_tooltip_showing}>
					Once you share {b_plural? 'these': 'this'} viewing key{b_plural? 's': ''} with the app, it will be able to view your private balance and transfer history forever, or until you rotate {b_plural? 'their': 'its'} viewing key{b_plural? 's': ''}.
				</Tooltip>
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/await}

	<hr class="no-margin">

	<p>
		Do you want to allow this app to see your balance and transaction history for the following {b_plural? 'tokens': 'token'}?
	</p>
	
	<Field key='token' name='App is requesting token{b_plural? 's': ''}'>
		{#await load_contracts()}
			<LoadingRows count={bech32s.length} />
		{:then a_contracts_local}
			{#each a_contracts_local as g_contract}
				<TokenRow balance={{
					s_amount: h_balances[g_contract.bech32] || '',
					s_fiat: '',
					s_worth: '',
				}} contract={g_contract}/>
			{/each}
		{/await}
	</Field>

	{#if a_contracts_secondary?.length}
		<Field key='token' name='Tokens also using same viewing key'>
			{#each a_contracts_secondary as g_contract}
				<TokenRow balance contract={g_contract}/>
			{/each}
		</Field>
	{/if}


	<ActionsLine disabled={b_allowing} deny cancel={() => cancel()} confirm={['Allow', allow, !b_loaded || b_allowing]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>