<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	
	import type {SecretStruct} from '#/meta/secret';
	
	// import {default as bcryptjs} from 'bcryptjs';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {load_flow_context} from '../svelte';
	
	import {base64_to_buffer, buffer_to_base64, buffer_to_text, concat, hex_to_buffer, sha256, string8_to_buffer} from '#/util/data';
	
	import NewPassword from '../frag/NewPassword.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import { bcrypt_gen_params, bcrypt_hash } from '#/crypto/bcrypt';

	export let g_account: AccountStruct;

	export let g_secret: SecretStruct<'private_key'>;

	const {
		k_page,
		completed,
	} = load_flow_context();

	let b_disabled = false;

	let b_password_acceptable = false;

	let sh_phrase = '';

	let c_resets = 0;

	function form_submit(d_event: Event) {
		// reject attempt
		if(!b_password_acceptable) return;

		// // accept attempt
		// confirm();

		void decrypt();

		return false;
	}

	function form_keydown(d_event: KeyboardEvent) {
		// enter key was pressed; submit form
		if('Enter' === d_event.key) {
			form_submit(d_event);
		}
	}

	async function encrypt() {
		// try {
		// 	// generate salt using 12 rounds (same as cosmos-sdk)
		// 	const sx_params = bcrypt_gen_params(12);

		// 	debugger;

		// 	// hash passphrase to derive key
		// 	const sb64_key = await bcrypt_hash(sh_phrase, sx_params);

		// 	debugger;
	
		// 	// 
		// 	const atu8_key = await sha256(base64_to_buffer(sb64_key));

		// 	const atu8_plaintext = marshall(atu8_sk);

		// 	return [
		// 		sb64salt,
		// 		xsalsa20symmetric.EncryptSymmetric(atu8_plaintext, atu8_key),
		// 	];
		// }
		// catch(e_encrypt) {
		// 	throw syserr(e_encrypt as Error);
		// }


		// // clear fields
		// c_resets++;
	}

	let s_textarea = '';

	async function decrypt() {
		const a_import = s_textarea.trim().split(/\n/g);
		if('-----BEGIN TENDERMINT PRIVATE KEY-----' !== a_import[0]
			|| '-----END TENDERMINT PRIVATE KEY-----' !== a_import.at(-1)
		) throw new Error(`Invalid armored ASCII format`);

		let atu8_salt!: Uint8Array;
		let a_datas: Uint8Array[] = [];
		let a_raws: string[] = [];
		for(const sx_line of a_import.slice(1, -1)) {
			if(sx_line.startsWith('kdf: ')) {
				if(sx_line !== 'kdf: bcrypt') throw new Error(`Unsupported kdf`);
			}
			else if(sx_line.startsWith('salt: ')) {
				atu8_salt = hex_to_buffer(sx_line.slice('salt: '.length).trim());
			}
			else if(sx_line.startsWith('type: ')) {
				if(sx_line !== 'type: secp256k1') throw new Error(`Unsupported private key type`);
			}
			else {
				try {
					a_datas.push(base64_to_buffer(sx_line.trim()));
				}
				catch(e_parse) {
					a_raws.push(sx_line.trim());
				}
			}
		}


		// generate salt using 12 rounds (same as cosmos-sdk)
		const sx_params = bcrypt_gen_params(12, buffer_to_base64(atu8_salt));

		// hash passphrase to derive key
		const sx_key = await bcrypt_hash(sh_phrase, sx_params);

		// sha256(bcrypt(phrase))
		const atu8_key = await sha256(string8_to_buffer(sx_key));

		// xsalsa20(nonce, key)
		debugger;

		console.log({
			sx_key,
		});


		const atu8_data = concat(a_datas);
	}

</script>

<style lang="less">
	@import '../_base.less';

</style>

<Screen>
	<Header plain
		title="Export private key"
		postTitle={g_account.name}
	/>

	Enter a password to encrypt this key with. It can be different than your wallet password.

	<form on:submit|preventDefault={form_submit} on:keydown={form_keydown}>
		<NewPassword b_once
			bind:c_resets={c_resets}
			bind:sh_phrase={sh_phrase}
			bind:b_disabled={b_disabled}
			bind:b_acceptable={b_password_acceptable}
		/>

		<Field>
			<textarea bind:value={s_textarea} />
		</Field>
	</form>

</Screen>