<script lang="ts">
	import type {AccountStruct, AccountPath, ParsedHardwareAccountLocation} from '#/meta/account';
	import type {Promisable} from '#/meta/belt';
	import type {Bech32} from '#/meta/chain';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	
	import {Screen, Header} from './_screens';
	import {popup_receive, yw_chain} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {is_hwa, parse_hwa} from '#/crypto/hardware-signing';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	import {forever, proper} from '#/util/belt';
	
	import AccountEdit from './AccountEdit.svelte';
	import AccountExport from './AccountExport.svelte';
	import MnemonicExport from './MnemonicExport.svelte';
	import Send from './Send.svelte';
	import AddressResourceControl from '../frag/AddressResourceControl.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	import Portrait, {type Actions} from '../frag/Portrait.svelte';
	import Gap from '../ui/Gap.svelte';
	

	const {k_page} = load_page_context();

	export let accountPath: AccountPath;
	const p_account = accountPath;

	let g_account: AccountStruct;
	let g_hwa: ParsedHardwareAccountLocation;
	let g_secret: SecretStruct;


	let s_header_post_title: Promisable<string> = forever('');
	$: {
		if(g_account && $yw_chain) {
			s_header_post_title = proper(g_account.family);
		}
	}

	// reactively assign account address for current chain
	$: sa_owner = g_account?.pubkey? Chains.addressFor(g_account.pubkey, $yw_chain): forever('' as Bech32);

	async function load_account() {
		const ks_accounts = await Accounts.read();

		g_account = ks_accounts.at(p_account)!;

		const p_secret = g_account.secret;

		if(is_hwa(p_secret)) {
			g_hwa = parse_hwa(p_secret);
		}
		else {
			gc_actions.export = {
				label: 'Export',
				async trigger() {
					const g_node = await Secrets.metadata(g_account.secret as SecretPath<'bip32_node'>);

					const g_mnemonic = await Secrets.metadata(g_node.mnemonic);

					k_page.push({
						creator: MnemonicExport,
						props: {
							g_mnemonic,
						},
					});
				},
			};

			g_secret = await Secrets.metadata(p_secret)!;
		}
	}

	const gc_actions: Actions = {
		send: {
			label: 'Send',
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						from: Chains.addressFor(g_account.pubkey, $yw_chain),
					},
				});
			},
		},
		recv: {
			label: 'Receive',
			trigger() {
				popup_receive(p_account);
			},
		},
		edit: {
			label: 'Edit',
			trigger() {
				k_page.push({
					creator: AccountEdit,
					props: {
						accountPath: p_account,
					},
				});
			},
		},
		// more: {
		// 	label: 'More',
		// 	trigger() {

		// 	},
		// },
	};

</script>

<Screen nav>
	<Header pops search network
		title="Account"
		postTitle={s_header_post_title}
		subtitle={`on ${$yw_chain.name}`}
	></Header>

	{#await load_account()}
		<Portrait loading
			resourcePath={p_account}
			actions={gc_actions}
		/>
	{:then}
		<Portrait
			resource={g_account}
			resourcePath={p_account}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				
			</svelte:fragment>
		</Portrait>

		<div class="resource-controls">
			<!-- account address on this chain -->
			<AddressResourceControl address={sa_owner} />
		</div>
	{/await}

	<Gap />

	<IncidentsList filterConfig={{
		account: accountPath,
	}} />
</Screen>