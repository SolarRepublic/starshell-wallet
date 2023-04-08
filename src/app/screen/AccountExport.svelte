<script lang="ts">
	import type {AccountStruct, AccountPath, HardwareAccountLocation, ParsedHardwareAccountLocation} from '#/meta/account';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import AccountExportPrivateKey from '#/app/screen/AccountExport_PrivateKey.svelte';
	import {Accounts} from '#/store/accounts';
	import {Secrets} from '#/store/secrets';

	import MnemonicExport from './MnemonicExport.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import Header from '../ui/Header.svelte';
	import Load from '../ui/Load.svelte';
    import { is_hwa, parse_hwa } from '#/crypto/hardware-signing';


	export let p_account: AccountPath;

	let g_account: AccountStruct;

	let p_secret: SecretPath<'private_key' | 'bip32_node'> | HardwareAccountLocation;
	let g_hwa: ParsedHardwareAccountLocation;
	let g_secret: SecretStruct<'private_key' | 'bip32_node'>;

	let p_mnemonic: SecretPath<'mnemonic'>;
	let g_mnemonic: SecretStruct<'mnemonic'>;

	const {
		k_page,
		completed,
	} = load_flow_context();

	async function load_account() {
		// load account store
		const ks_accounts = await Accounts.read();

		// load account
		g_account = ks_accounts.at(p_account)!;

		// 
		if(!g_account) {
			throw new Error(`Account '${p_account}'' was not found in %o`, ks_accounts.raw);
		}

		p_secret = g_account.secret;

		if(is_hwa(p_secret)) {
			g_hwa = parse_hwa(p_secret);
		}
		else {
			g_secret = await Secrets.metadata(p_secret);
			if('bip32_node' === g_secret.type) {
				p_mnemonic = g_secret.mnemonic;
				g_mnemonic = await Secrets.metadata(p_mnemonic);
			}
			// automatically push to private key export
			else {
				export_private_key();
			}
		}
	}

	function export_private_key() {
		k_page.push({
			creator: AccountExportPrivateKey,
			props: {
				g_secret,
				g_account,
			},
		});
	}

	function export_mnemonic() {
		k_page.push({
			creator: MnemonicExport,
			props: {
				g_mnemonic,
			},
		});
	}

</script>

<style lang="less">
	@import '../_base.less';

</style>

<Screen>
	<Header plain
		title="Export account"
		postTitle={g_account?.name || ''}
	/>

	{#await load_account()}
		<Load forever />
	{:then}
		<p>

		</p>

		<ActionsWall>
			<button on:click={export_private_key}>
				Export private key
			</button>

			{#if g_mnemonic}
				<button on:click={export_mnemonic}>
					Export mnemonic seed phrase
				</button>
			{/if}
		</ActionsWall>
	{/await}

	<!-- <Curtain on:click={() => b_tooltip_showing = false} /> -->
</Screen>