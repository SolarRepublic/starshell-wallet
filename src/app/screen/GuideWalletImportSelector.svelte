<script lang="ts" context="module">
	export enum WalletIntent {
		NEW=1,
		EXISTING=2,
		NEITHER=3,
	}
</script>
<script lang="ts">
	import type {SvelteComponentTyped} from 'svelte';
	
	import type {Dict} from '#/meta/belt';
	
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';

	import {ode} from '#/util/belt';
	
	import GuideWalletImportInstructions from './GuideWalletImportInstructions.svelte';
	import WalletCreateSoft from './WalletCreateSoft.svelte';
	
	import Curtain from '../ui/Curtain.svelte';
	import Tooltip from '../ui/Tooltip.svelte';


	const {k_page, a_progress, next_progress} = load_page_context();

	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;

	let b_tooltip_showing = false;
	
	const H_OPTIONS: Dict<{
		label: string;
		img?: string;
		push?: SvelteComponentTyped;
	}> = {
		'keplr': {
			label: 'Keplr',
			img: '/media/other/keplr.svg',
		},
		'cosmostation': {
			label: 'Cosmostation',
			img: '/media/other/cosmostation.svg',
		},
		'fina': {
			label: 'Fina',
			img: '/media/other/fina.png',
		},
		'citadel-one': {
			label: 'Citadel.one',
			img: '/media/other/citadel-one.svg',
		},
		'leap': {
			label: 'Leap',
			img: '/media/other/leap.svg',
		},
		'other': {
			label: `Other / I don't need a guide`,
		},
	};

	function click_option(si_option: keyof typeof H_OPTIONS) {
		const g_option = H_OPTIONS[si_option];

		if('other' === si_option) {
			k_page.push({
				creator: WalletCreateSoft,
				props: {
					xc_intent: WalletIntent.EXISTING,
					b_mandatory: true,
				},
				context: next_progress(a_progress, +0),
			});
		}
		else {
			k_page.push({
				creator: GuideWalletImportInstructions,
				props: {
					si_guide: si_option,
				},
				context: next_progress(),
			});
		}
	}
</script>

<style lang="less">
	.option {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 16px;
		border: 2px dashed var(--theme-color-border);
		margin-bottom: -2px;
		cursor: pointer;

		&:first-child {
			border-top-left-radius: 8px;
			border-top-right-radius: 8px;
		}

		&:last-child {
			border-bottom-left-radius: 8px;
			border-bottom-right-radius: 8px;
		}

		>img {
			display: flex;
			width: 18px;
		}
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops={!b_mandatory}
		title="Which wallet are you importing from?"
	/>

	<div class="selection-list">
		{#each ode(H_OPTIONS) as [si_option, g_option]}
			<div class="option" on:click={() => click_option(si_option)}>
				{#if g_option.img}
					<img src={g_option.img}>
				{/if}
				<span class="label">
					{g_option.label}
				</span>
			</div>
		{/each}
	</div>

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>