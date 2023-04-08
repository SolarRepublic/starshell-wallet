<script lang="ts">
	import type {AccountStruct, AccountPath, ParsedHardwareAccountLocation} from '#/meta/account';
	import type {SecretStruct} from '#/meta/secret';
	
	import {
		Screen,
		Header,
		SubHeader,
	} from './_screens';
	import {yw_chain} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {is_hwa, parse_hwa} from '#/crypto/hardware-signing';
	import {B_IPHONE_IOS} from '#/share/constants';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Devices} from '#/store/devices';
	import {Secrets} from '#/store/secrets';
	
	import AccountCreate from './AccountCreate.svelte';
	import AccountView from './AccountView.svelte';
	import WalletCreate from './WalletCreate.svelte';
	import Address from '../frag/Address.svelte';
	import Load from '../ui/Load.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	

	const {
		k_page,
	} = load_page_context();

	const hm_secrets = new Map<AccountStruct, SecretStruct | ParsedHardwareAccountLocation>();

	let a_accounts: [AccountPath, AccountStruct][];
	async function load_accounts(): Promise<typeof a_accounts> {
		const ks_accounts = await Accounts.read();

		a_accounts = ks_accounts.entries();

		await Promise.all(a_accounts.map(async([, g_account]) => {
			const p_secret = g_account.secret;

			hm_secrets.set(g_account, is_hwa(p_secret)? parse_hwa(p_secret): await Secrets.metadata(p_secret)!);
		}));

		return a_accounts;
	}
</script>

<style lang="less">
	@import '../_base.less';

	.hd-path {
		:global(&) {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}
</style>

<Screen nav debug='Accounts' root>
	<Header search network account
	>
	</Header>

	<SubHeader
		title="Accounts"
		on:add_new={() => {
			if(B_IPHONE_IOS) {
				k_page.push({
					creator: AccountCreate,
				});
			}
			else {
				k_page.push({
					creator: WalletCreate,
				});
			}
		}}
	>
		<svelte:fragment slot="add-new">
			Add/Import
		</svelte:fragment>
	</SubHeader>

	<div class="rows no-margin">
		{#await load_accounts()}
			<LoadingRows count={3} />
		{:then}
			{#key $yw_chain}
				{#each a_accounts as [p_account, g_account]}
					{@const g_secret = hm_secrets.get(g_account)}
					{@const sa_owner = Chains.addressFor(g_account.pubkey, $yw_chain)}
					<Row
						resource={g_account}
						resourcePath={p_account}
						address={sa_owner}
						iconClass={'square'}
						on:click={() => k_page.push({
							creator: AccountView,
							props: {
								accountPath: p_account,
							},
						})}
					>
						<svelte:fragment slot="detail">
							<div class="hd-path">
								{#if 'bip32_node' === g_secret?.type}
									{#await Secrets.metadata(g_secret.mnemonic)}
										<Load forever />
									{:then g_mnemonic}
										{g_mnemonic.name}
									{/await}
									 - {g_secret.bip44}
								{:else if g_secret?.bip44}
									{@const p_device = g_account.extra?.device}
									{#if p_device}
										{#await Devices.at(p_device)}
											<Load forever />
										{:then g_device}
											{g_device?.name || `${g_device?.manufacturerName || 'Unknown'} ${g_device?.productName || 'device'}`}
										{/await}
										- {g_secret.bip44}
									{/if}
								{/if}
							</div>

							<Address address={sa_owner} />
						</svelte:fragment>
					</Row>
				{/each}
			{/key}
		{/await}
	</div>
</Screen>