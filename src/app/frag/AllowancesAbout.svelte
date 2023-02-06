<script lang="ts">
	import type {Bech32} from '#/meta/chain';
	import type {ParametricSvelteConstructor} from '#/meta/svelte';
	
	import {yw_account, yw_chain, yw_network, yw_owner, yw_shift_key} from '../mem';
	import {Screen, Header} from '../screen/_screens';
	
	import {request_feegrant} from '../svelte';
	
	import {FeeGrants} from '#/chain/fee-grant';
	import {address_to_name} from '#/chain/messages/_util';
	import {ode} from '#/util/belt';
	
	import {format_amount, format_date_long} from '#/util/format';
	
	import ChainAccount from './ChainAccount.svelte';
	import Row from '../ui/Row.svelte';
	

	let a_grants: ParametricSvelteConstructor.Parts<ParametricSvelteConstructor<Row>>['params']['$$prop_def'][] = [];

	let b_loading = false;
	let xt_reloaded = 0;

	async function reload() {
		if(b_loading) return;

		if(Date.now() - xt_reloaded < 3e3) return;

		b_loading = true;
		a_grants = [];

		const k_fee_grants = await FeeGrants.forAccount($yw_account, $yw_network);

		for(const [si_coin, g_struct] of ode(k_fee_grants.grants)) {
			for(const g_grant of g_struct.grants) {
				a_grants.push({
					name: `${format_amount(g_grant.amount.toNumber())} ${si_coin} from ${await address_to_name(g_grant.allowance.granter as Bech32, $yw_chain)}`,
					detail: Number.isFinite(g_grant.expiration)
						? `Automatically expires ${format_date_long(g_grant.expiration)}`
						: 'No expiration set',
					pfp: $yw_chain.pfp,
				});
			}
		}

		b_loading = false;
		xt_reloaded = Date.now();
		a_grants = a_grants;
	}

	yw_account.subscribe(reload, {}, true);
	yw_network.subscribe(reload, {}, true);

	void reload();

	let b_requesting_feegrant = false;
	async function do_request_feegrant() {
		b_requesting_feegrant = true;

		try {
			await request_feegrant($yw_owner!);
		}
		finally {
			b_requesting_feegrant = false;
		}

		void reload();
	}
</script>

<style lang="less">
	.rows {
		margin-top: 0.5em;
	}
</style>

<Screen>
	<Header pops network account
		title='What are Allowances?'
	/>

	<p>
		"Fee Grant" is a Cosmos feature that lets you spend coins from other accounts when paying gas fees.
	</p>

	<p>
		Allowances can be used to help new users or satellite accounts pay for initial gas fees.
	</p>

	<div>
		<p>
			Current allowances for:
		</p>

		<ChainAccount g_chain={$yw_chain} g_account={$yw_account} sx_root_style='margin-bottom:1em;' />

		{#if b_loading}
			<p>
				Checking for allowances...
			</p>
		{:else}
			{#if a_grants.length}
				<div class="rows">
					{#each a_grants as g_grant}
						<Row {...g_grant} noHorizontalPad />
					{/each}
				</div>

				{#if $yw_shift_key}
					<center>
						<button class="pill" disabled={b_requesting_feegrant} on:click={do_request_feegrant}>
							{#if b_requesting_feegrant}
								Requesting...
							{:else}
								Request fee allowance
							{/if}
						</button>
					</center>
				{/if}
			{:else}
				<p>
					No allowances currently granted to {$yw_account.name}.
				</p>

				{#if Object.keys($yw_chain.mainnet?.feegrants || {}).length}
					<center>
						<button class="pill" disabled={b_requesting_feegrant} on:click={do_request_feegrant}>
							{#if b_requesting_feegrant}
								Requesting...
							{:else}
								Request fee allowance
							{/if}
						</button>
					</center>
				{/if}
			{/if}
		{/if}
	</div>
</Screen>
