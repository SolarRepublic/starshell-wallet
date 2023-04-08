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
	
	import {Bip39} from '#/crypto/bip39';
	
	import MnemonicCreate from './MnemonicCreate.svelte';
	import MnemonicImport from './MnemonicImport.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';

	import CheckboxField from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_SEED_DERIVATION from '#/icon/seed-derivation.svg?raw';


	const {k_page, a_progress, next_progress} = load_page_context();

	// push args forwarded to all 'next' screens
	const gc_push_all = {
		context: next_progress(),
	};


	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;

	/**
	 * Intent is to create new mnemonic, restore existing, or neither
	 */
	export let xc_intent: WalletIntent = WalletIntent.NEITHER;


	let b_tooltip_showing = false;

	let b_use_pin = false;

	async function create_new_wallet() {
		k_page.push({
			creator: MnemonicCreate,
			props: {
				atu16_indicies: await Bip39.entropyToIndicies(),
				b_use_pin,
			},
			...gc_push_all,
		});
	}

	function import_mnemonic() {
		k_page.push({
			creator: MnemonicImport,
			props: {
				b_use_pin,
			},
			...gc_push_all,
		});
	}

	const s_title = WalletIntent.NEW === xc_intent
		? 'What is a mnemonic seed?'
		: WalletIntent.EXISTING === xc_intent
			? 'Get ready to enter your mnemonic'
			: 'Create new seed or restore from existing?';
</script>

<style lang="less">
	.seed-derivation {
		--icon-diameter: 80%;
		display: flex;
		justify-content: center;
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops
		title={s_title}
	/>

	<p>
		{#if WalletIntent.EXISTING !== xc_intent}
			A mnemonic "seed" is a secret phrase that can create multiple, distinct accounts.
			A single seed is like a master password for all your funds.
		{:else}
			You only need to import your mnemonic once to create multiple Accounts. For better security, you can also protect it with a custom PIN.
		{/if}
	</p>

	<div class="global_svg-icon seed-derivation flex_1">
		{@html SX_ICON_SEED_DERIVATION}
	</div>

	<ActionsWall>
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

		{#if WalletIntent.NEW & xc_intent}
			<button class="primary" on:click={() => create_new_wallet()}>
				Create new seed
			</button>
		{/if}

		{#if WalletIntent.EXISTING & xc_intent}
			<button on:click={() => import_mnemonic()}>
				Restore existing seed
			</button>
		{/if}
	</ActionsWall>

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>