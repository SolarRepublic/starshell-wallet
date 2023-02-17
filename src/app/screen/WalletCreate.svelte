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


	const {k_page} = load_page_context();

	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;

	let b_tooltip_showing = false;

	let b_use_pin = false;

	async function create_new_wallet() {
		k_page.push({
			creator: MnemonicCreate,
			props: {
				atu16_indicies: await Bip39.entropyToIndicies(),
				b_use_pin,
			},
		});
	}

	function import_mnemonic() {
		k_page.push({
			creator: MnemonicImport,
		});
	}

</script>

<style lang="less">
	.seed-derivation {
		--icon-diameter: 80%;
		display: flex;
		justify-content: center;
	}
</style>

<Screen>
	<Header plain
		title="Create new seed or restore from existing?"
	/>

	<p>
		A mnemonic "seed" is a secret phrase that can create multiple, distinct accounts.
		A single seed is like a master password for all your funds.
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

		<button class="primary" on:click={() => create_new_wallet()}>
			Create new seed
		</button>

		<button on:click={() => import_mnemonic()}>
			Restore existing seed
		</button>
	</ActionsWall>

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>