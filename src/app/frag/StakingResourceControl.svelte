<script lang="ts">
	import type {DelegationResponse, UnbondingDelegation} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/staking';

	import type {Bech32} from '#/meta/chain';
	
	import BigNumber from 'bignumber.js';
	
	import {yw_chain, yw_network, yw_owner} from '../mem';
	
	import {Coins} from '#/chain/coin';
	import {open_external_link} from '#/util/dom';
	
	import Load from '../ui/Load.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_EXPAND_RIGHT from '#/icon/expand-right.svg?raw';
	import SX_ICON_HOURGLASS from '#/icon/hourglass.svg?raw';
	import SX_ICON_LAUNCH from '#/icon/launch.svg?raw';
	import SX_ICON_MONEY_SLOT from '#/icon/money-slot.svg?raw';
	
	

	export let si_coin: string;

	export let sa_owner: Bech32 = $yw_owner!;

	export let g_delegations: {
		bonded: DelegationResponse[];
		unbonding: UnbondingDelegation[];
	} | null = null;

	$: g_coin = $yw_chain?.coins?.[si_coin] || {};

	let s_bonded_amount = '';
	let s_unbonding_amount = '';
	const s_redelegating_amount = '';

	(async function init() {
		g_delegations = await $yw_network.delegations(sa_owner);

		// bonded
		{
			let yg_bonded = BigNumber(0);

			// each bonded delegation
			for(const g_bonded of g_delegations.bonded) {
				const g_balance = g_bonded?.balance;

				// only cumulate the currently selected coin
				if(g_coin.denom !== g_balance?.denom) continue;

				// cumulate
				yg_bonded = yg_bonded.plus(g_balance?.amount || '0');
			}

			// staking amount
			s_bonded_amount = Coins.summarizeAmount({
				denom: g_coin.denom,
				amount: yg_bonded.toString(),
			}, $yw_chain);
		}

		// unbonding
		{
			let yg_unbonding = BigNumber(0);

			// each bonded delegation
			for(const g_unbonding of g_delegations.unbonding) {
				for(const g_entry of g_unbonding.entries) {
					yg_unbonding = yg_unbonding.plus(g_entry.balance);
				}
			}

			// unbonding amount
			s_unbonding_amount = Coins.summarizeAmount({
				denom: g_coin.denom,
				amount: yg_unbonding.toString(),
			}, $yw_chain);
		}

		const g_info = await $yw_network.stakingInfo();
	})();

	function bonded_click(d_event: MouseEvent) {
		void open_external_link('https://ping.pub/secret/staking/secretvaloper1yv9f4tankaktdtf8lq6rjsx9c9rpfptc7kzhz2');
	}

	function unbonding_click(d_event: MouseEvent) {

	}
</script>

<style lang="less">
	@import '../_base.less';

	.staking {
		>.content {
			>.title {
				.font(regular);
			}

			>.info {
				.font(tiny);
				color: var(--theme-color-text-med);
			}
		}

		button {
			max-width: fit-content;
		}
	}
</style>

<ResourceControl b_hr_less
	infoIcon={SX_ICON_MONEY_SLOT}
	s_icon_dim='18px'
	on:click={bonded_click}
	actionIcon={SX_ICON_LAUNCH}
>
	<!-- actionIcon={SX_ICON_EXPAND_RIGHT} -->
	<div class="staking global_flex-auto">
		<span class="content">
			{#if !g_delegations}
				<Load forever />
			{:else}
				{@const a_delegations = g_delegations.bonded}

				{#if !a_delegations.length}
					<span class="color_text-med">
						Nothing currently staked
					</span>
				{:else}
					Currently staking: {s_bonded_amount}
				{/if}
			{/if}
		</span>
	</div>
</ResourceControl>

<hr class="no-margin">

<ResourceControl b_hr_less
	infoIcon={SX_ICON_HOURGLASS}
	s_icon_dim='18px'
	on:click={unbonding_click}
>
	<!-- actionIcon={g_delegations?.unbonding?.length? SX_ICON_EXPAND_RIGHT: ''} -->
	<div class="staking global_flex-auto">
		<span class="content">
			{#if !g_delegations}
				<Load forever />
			{:else}
				{@const a_unbondings = g_delegations.unbonding}

				{#if !a_unbondings.length}
					<span class="color_text-med">
						Nothing unbonding
					</span>
				{:else}
					Currently unbonding: {s_unbonding_amount}
				{/if}
			{/if}
		</span>
	</div>
</ResourceControl>

