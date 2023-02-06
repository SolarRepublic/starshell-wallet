<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {Bip39} from '#/crypto/bip39';
	
	import MnemonicCreate from './MnemonicCreate.svelte';
	import MnemonicImport from './MnemonicImport.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';

	import SX_ICON_SEED_DERIVATION from '#/icon/seed-derivation.svg?raw';


	const {k_page} = load_page_context();

	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;


	async function create_new_wallet() {
		k_page.push({
			creator: MnemonicCreate,
			props: {
				atu16_indicies: await Bip39.entropyToIndicies(),
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
		<button class="primary" on:click={() => create_new_wallet()}>
			Create new seed
		</button>

		<button on:click={() => import_mnemonic()}>
			Restore existing seed
		</button>
	</ActionsWall>
</Screen>