<script lang="ts" context="module">
	export enum WalletIntent {
		NEW=1,
		EXISTING=2,
		NEITHER=3,
	}
</script>
<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import MnemonicImport from './MnemonicImport.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	

	const {k_page, a_progress, next_progress} = load_page_context();

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;


	export let si_guide: 'keplr' | 'cosmostation' | 'fina' | 'citadel-one' | 'leap';

	let b_use_pin = false;

	let b_tooltip_showing = false;

	const H_GUIDES = {
		'keplr': {
			label: 'Keplr',
			steps: [
				{
					html: `Open your Keplr wallet and click on the account icon in the upper right corner`,
					img: '/media/other/keplr/bar.png',
				},
				{
					html: `Click the "three-dot" button next to the account you want to export, then click "View Mnemonic Seed"`,
					img: '/media/other/keplr/account.png',
				},
				{
					html: `Keplr may prompt you for your password. Finally, highlight and copy the contents of your mnemonic seed to your clipboard`,
					img: '/media/other/keplr/mnemonic.png',
				},
			],
		},

		'cosmostation': {
			label: 'Cosmostation',
			steps: [
				{
					html: `Open your Cosmostation wallet and click on the account label near the upper left corner, then click the gear icon that appears`,
					img: '/media/other/cosmostation/bar.png',
				},
				{
					html: `Click the "three-dot" button next to the account you want to export, then click "View mnemonics"`,
					img: '/media/other/cosmostation/account.png',
				},
				{
					html: `Cosmostation may prompt you for your password. Finally, click the "Copy" button`,
					img: '/media/other/cosmostation/mnemonic.png',
				},
			],
		},

		'citadel-one': {
			label: 'Citadel.one',
			steps: [
				{
					html: `Open your Citadel.one wallet and click the "ADDRESSES" button in the top left corner of the Settings page`,
					img: '/media/other/citadel-one/bar.png',
				},
				{
					html: `Click the "Export" button near the top of the Wallets screen`,
					img: '/media/other/citadel-one/account.png',
				},
				{
					html: `Long press the mnemonic phrase to highlight it and then copy it to your clipboard`,
					img: '/media/other/citadel-one/mnemonic.png',
				},
			],
		},

		'leap': {
			label: 'Leap',
			steps: [
				{
					html: `Open your Leap wallet and click the "three-bar" menu button in the top left corner`,
					img: '/media/other/leap/bar.png',
				},
				{
					html: `Under the "Security" section, click "Show Secret Phrase"`,
					img: '/media/other/leap/account.png',
				},
				{
					html: `Clip the "Copy to clipboard" button below the mnemonic phrase`,
					img: '/media/other/leap/mnemonic.png',
				},
			],
		},

		'fina': {
			label: 'Fina',
			steps: [
				{
					html: `Open your Fina wallet and open the Settings page using the hamburger button in the bottom right corner of the screen`,
					img: '/media/other/fina/bar.png',
				},
				{
					html: `Under the "Account" section, click "View Seed Phrase" and enter your password`,
					img: '/media/other/fina/account.png',
				},
				{
					html: `Clip "Copy" on the popup dialog`,
					img: '/media/other/fina/mnemonic.png',
				},
			],
		},
	};

	function next() {
		k_page.push({
			creator: MnemonicImport,
			props: {
				b_use_pin,
			},
			context: next_progress(),
		});
	}
	
</script>

<style lang="less">
	.steps {
		display: flex;
		flex-direction: column;
		gap: 1.75em;
		margin-bottom: 2em;

		>.step {
			display: flex;
			flex-direction: column;
			gap: 0.75em;

			>img {
				border-radius: 16px;
				width: 100%;
			}
		}
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops={!b_mandatory}
		title="Import Guide for {H_GUIDES[si_guide]?.label}"
	/>

	<div class="steps">
		{#if H_GUIDES[si_guide]}
			{@const g_guide = H_GUIDES[si_guide]}
			{#each g_guide.steps as g_step, i_step}
				<div class="step">
					<div class="text">
						<span class="number">
							{i_step+1}.
						</span>
						<span class="instruction">
							{@html g_step.html}
						</span>
					</div>

					<img src={g_step.img} alt={g_step.html}>
				</div>
			{/each}
		{/if}
	</div>

	<CheckboxField id='use-pin' bind:checked={b_use_pin}>
		<span>
			<span>
				Protect my seed with a custom PIN
			</span>
			<span>
				<Tooltip bind:showing={b_tooltip_showing}>
					A short PIN encrypts your seed phrase with an additional layer of security.
					It will only be required when creating new accounts or exporting the mnemonic.
				</Tooltip>
			</span>
		</span>
	</CheckboxField>

	<ActionsLine back confirm={['Next', next]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>