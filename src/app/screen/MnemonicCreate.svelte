<script lang="ts">
	import {load_page_context} from '../svelte';
	
	import {Bip39} from '#/crypto/bip39';
	import RuntimeKey from '#/crypto/runtime-key';
	
	import {text_to_buffer} from '#/util/data';
	
	import MnemonicVerify from './MnemonicVerify.svelte';
	import Screen from '../container/Screen.svelte';
	import Mnemonic from '../frag/Mnemonic.svelte';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
    import { B_DEVELOPMENT } from '#/share/constants';

	export let atu16_indicies: Uint16Array;

	let sh_extension = '';

	let s_hint_extension = '';

	const {k_page} = load_page_context();

	async function next() {
		// text encode passphrase
		const atu8_extension = text_to_buffer(sh_extension);

		// encode extension into package precursor
		const atu8_encoded = Bip39.encodeExtension(atu8_extension);

		// create runtime key for pacakge precursor
		const kr_precursor = await RuntimeKey.createRaw(atu8_encoded, atu8_encoded.byteLength << 3);

		k_page.push({
			creator: MnemonicVerify,
			props: {
				atu16_indicies,
				kr_precursor,
				s_hint_extension,
				b_extension: !!sh_extension.length,
			},
		});
	}
</script>

<Screen progress={[1, 5]}>
	<Mnemonic b_readonly
		bind:atu16_indicies={atu16_indicies}
		bind:sh_extension={sh_extension}
		bind:s_hint={s_hint_extension}
	/>
	
	<p>
		You will be asked to verify the entire mnemonic on the next screen.
	</p>

	<ActionsLine back confirm={['Next', next]} wait={B_DEVELOPMENT? 1e3: 10e3} />
</Screen>
