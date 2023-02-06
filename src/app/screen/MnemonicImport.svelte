<script lang="ts">
	import {syserr} from '../common';
	import {yw_context_popup, yw_popup} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {Bip39} from '#/crypto/bip39';
	import RuntimeKey from '#/crypto/runtime-key';
	
	import {text_to_buffer} from '#/util/data';
	
	import MnemonicSecurity from './MnemonicSecurity.svelte';
	import Screen from '../container/Screen.svelte';
	import Mnemonic from '../frag/Mnemonic.svelte';
	
	import PopupDisclaimer from '../popup/PopupNotice.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import StaticSelect from '../ui/StaticSelect.svelte';
	

	let atu16_indicies: Uint16Array;

	let b_valid = false;

	let nl_words = 12;

	let sh_extension = '';
	let s_hint_extension = '';

	const {
		k_page,
	} = load_page_context();


	async function process_mnemonic() {
		if(!b_valid) {
			syserr({
				title: 'Invalid mnemonic',
				text: 'Unknown reason',
			});
			return;
		}

		// 12-word mnemonic and no extension is weak
		if(12 === nl_words && !sh_extension) {
			await new Promise((fk_resolve) => {
				// set context
				$yw_context_popup = {
					infos: [
						`You have a relatively weak seed phrase.`,
						`We recommended you create a new seed phrase with better security (i.e., custom extension or higher phrase count) and transfer all assets to that account.`,
						`This is only a recommendation. You are free to do whatever you want.`,
					],
					ok_text: 'Continue',
					ok: fk_resolve,
				};

				// show popup
				$yw_popup = PopupDisclaimer;
			});
		}

		// convert indicies to expanded
		const kn_expanded = Bip39.inndiciesToExpanded(atu16_indicies.slice(0, nl_words));

		// double check checksum; protecting against false valid flag
		if(!await Bip39.validateExpanded(kn_expanded)) {
			throw new Error(`Mnemonic checksum failure`);
		}

		// complete transformation into padded mnemonic and create runtime key
		const kr_mnemonic = await RuntimeKey.create(async() => {
			const kn_mnemonic = await Bip39.expandedToPaddedMnemonic(kn_expanded);

			return kn_mnemonic.data;
		}, Bip39.maxMnemonicBufferSize() << 3);

		// text encode passphrase
		const atu8_extension = text_to_buffer(sh_extension);

		// encode extension into package precursor
		const atu8_encoded = Bip39.encodeExtension(atu8_extension);

		// create runtime key for pacakge precursor
		const kr_precursor = await RuntimeKey.createRaw(atu8_encoded, atu8_encoded.byteLength << 3);

		// clear
		k_page.push({
			creator: MnemonicSecurity,
			props: {
				kr_mnemonic,
				kr_precursor,
				s_hint_extension,
				b_imported: true,
			},
		});
	}
</script>


<Screen progress={[2, 5]}>
	<Header plain
		title="Type, paste or import your mnemonic seed"
	/>

	<Field short name="Word count">
		<StaticSelect a_options={[12, 15, 18, 21, 24]} bind:z_selected={nl_words} />
	</Field>

	<Mnemonic {nl_words}
		bind:atu16_indicies={atu16_indicies}
		bind:b_valid={b_valid}
		bind:sh_extension
		bind:s_hint={s_hint_extension}
	/>

	<ActionsLine back confirm={['Next', process_mnemonic, !b_valid]} allowDisabledClicks />
</Screen>