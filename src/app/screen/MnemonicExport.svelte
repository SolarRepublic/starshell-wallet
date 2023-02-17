<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {SecretStruct} from '#/meta/secret';
	
	import {yw_context_popup, yw_popup} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {Bip39, XB_UNICODE_SPACE} from '#/crypto/bip39';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {Accounts} from '#/store/accounts';
	import {Secrets} from '#/store/secrets';
	import {buffer_to_text} from '#/util/data';
	
	import Screen from '../container/Screen.svelte';
	import SeedIdentity from '../frag/SeedIdentity.svelte';
	import PopupPin from '../popup/PopupPin.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import Row from '../ui/Row.svelte';
	


	const H_TARGET_GROUPS = {
		12: 3,
		15: 3,
		18: 2,
		21: 2,
		24: 2,
	};
	

	export let g_mnemonic: SecretStruct<'mnemonic'>;

	const p_mnemonic = Secrets.pathFrom(g_mnemonic);

	const {
		k_page,
	} = load_page_context();

	let a_subphrases: string[] = [];

	let i_visible = -1;

	let a_accounts: [AccountStruct, SecretStruct<'bip32_node'>][] = [];

	let s_extension = '';
	
	async function load_accounts() {
		for(const [, g_account] of await Accounts.entries()) {
			const p_secret = g_account.secret;

			const g_secret = await Secrets.metadata(p_secret);

			if('bip32_node' === g_secret.type) {
				if(p_mnemonic === g_secret.mnemonic) {
					a_accounts.push([
						g_account,
						g_secret,
					]);
				}
			}
		}

		// reactive assign
		a_accounts = a_accounts;
	}

	let b_pin_cancelled = false;

	(async function load() {
		void load_accounts();

		// decrypt mnemonic
		const atu8_package: Uint8Array = await new Promise((fk_resolve) => {
			const g_security = g_mnemonic.security;

			// mnemonic is protected by PIN
			if('pin' === g_security.type) {
				// set context for pin popup
				$yw_context_popup = {
					seed: g_mnemonic.name,
					hint: g_security.hint,

					// test the pin entry
					enter: (atu8_pin: Uint8Array) => Secrets.borrow(p_mnemonic, async(kn_encrypted) => {
						// attempt to decrypt with pin
						try {
							fk_resolve(await Secrets.decryptWithPin(kn_encrypted.data, atu8_pin, g_security));
							return true;
						}
						catch(e_decrypt) {
							return false;
						}
					}),

					cancelled() {
						b_pin_cancelled = true;
					},
				};

				// show popup
				$yw_popup = PopupPin;
			}
			// mnemonic is not protected
			else {
				void Secrets.borrow(p_mnemonic, (kn_package) => {
					fk_resolve(kn_package.data.slice());
				});
			}
		});

		// close popup
		$yw_popup = null;

		// decode mnemonic package
		const [atu8_extension, atu8_padded] = Bip39.decodePackage(atu8_package);

		// trim padded mnemonic
		const kn_trimmed = Bip39.trimPaddedMnemonic(new SensitiveBytes(atu8_padded));

		// ref raw mnemonic text
		const atu8_mnemonic = kn_trimmed.data;

		// create word split index list and count number of words
		const atu8_splits: Uint8Array = new Uint8Array(24);
		let c_words = 0;
		{
			let ib_write = 0;
			for(let ib_offset=0; ;) {
				// find start of next word
				const ib_next = atu8_mnemonic.indexOf(XB_UNICODE_SPACE, ib_offset) + 1;

				// no more words
				if(!ib_next) break;

				// increment word count
				c_words += 1;

				// add index to splits
				atu8_splits[ib_write++] = ib_offset = ib_next;
			}
		}

		// divide mnemonic into subphrases
		{
			const n_words_per_subphrase = Math.ceil(c_words / (H_TARGET_GROUPS[c_words] || 2));
			let ib_read = 0;
			let i_split = n_words_per_subphrase;
			for(;;) {
				// find next split
				const ib_next = atu8_splits[i_split];

				// set subphrase (`ib_next` can be undefined and it also works in finding the end)
				a_subphrases.push(buffer_to_text(atu8_mnemonic.subarray(ib_read, ib_next)));

				// no more splits; done
				if(!ib_next) break;

				// advance split pointer
				i_split += n_words_per_subphrase;

				// advance read pointer
				ib_read = ib_next;
			}
		}

		// save mnemonic extension
		s_extension = buffer_to_text(atu8_extension);

		// wipe sensitive data
		kn_trimmed.wipe();

		// reactive assign
		a_subphrases = a_subphrases;
	})();


	function done() {
		k_page.pop();
	}
</script>

<style lang="less">
	textarea {
		user-select: all;
	}
</style>

<Screen>
	<Header plain pops
		title="Export mnemonic seed"
	/>

	<div>
		<SeedIdentity s_nickname={g_mnemonic.name} />
	</div>

	<p>
		This seed derives the following accounts:
	</p>

	{#each a_accounts as [g_account, g_bip32_node]}
		<Row pfpDim={36}
			rootStyle='border:none; padding:0;'
			resource={g_account}
			detail={g_bip32_node.bip44}
		/>
	{/each}

	<hr class="no-margin">

	{#if b_pin_cancelled}
		<p>
			PIN is required to decrypt seed phrase.
		</p>
	{:else}
		{#each a_subphrases as s_subphrase, i_subphrase}
			<Field name="Seed phrase part {i_subphrase+1} of {a_subphrases.length}">
				{#if i_visible === i_subphrase}
					<textarea readonly
						value={s_subphrase}
						on:click={d_event => d_event.target?.['select']?.()}
						on:blur={() => i_visible = -1}
					/>
				{:else}
					<textarea readonly
						value={'•'.repeat(92)}
						on:focus={() => i_visible = i_subphrase}
					/>
				{/if}
			</Field>
		{/each}

		{#if s_extension}
			<Field name="Custom seed extension">
				{#if i_visible === a_subphrases.length}
					<input readonly type="text"
						value={s_extension}
						on:click={d_event => d_event.target?.['select']?.()}
						on:blur={() => i_visible = -1}
					>
				{:else}
					<input readonly type="text"
						value={'•'.repeat(64)}
						on:focus={() => i_visible = a_subphrases.length}
					>
				{/if}
			</Field>
		{/if}
	{/if}

	<ActionsLine confirm={['Done', done]} />
</Screen>