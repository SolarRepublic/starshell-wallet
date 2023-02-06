<script context="module" lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct} from '#/meta/chain';
	import type {Incident, TxSynced} from '#/meta/incident';
	import type {PfpTarget} from '#/meta/pfp';

	import type {CosmosNetwork} from '#/chain/cosmos-network';

	import {forever} from '#/util/belt';
	import {open_external_link} from '#/util/dom';

	import Address from './Address.svelte';
	import MemoReview from './MemoReview.svelte';
	import Field from '../ui/Field.svelte';
	import Load from '../ui/Load.svelte';
	

	export type SimpleField = {
		type: 'key_value';
		key: string;
		long?: boolean;
		value: Promisable<string>;
		subvalue?: Promisable<string>;
		render?: 'address' | 'mono' | 'error';
		pfp?: PfpTarget;
	} | {
		type: 'memo';
		value: string;
	} | {
		type: 'links';
		value: Promisable<{
			href: string;
			text: string;
			icon?: string;
		}[]>;
	};
</script>


<script lang="ts">
	import {decrypt_private_memo} from '#/crypto/privacy';
	import {Accounts} from '#/store/accounts';
	import {yw_chain} from '../mem';
	import PfpDisplay from './PfpDisplay.svelte';

	export let fields: SimpleField[];
	export let incident: Incident.Struct | null = null;
	export let chain: ChainStruct | null = null;
	export let network: CosmosNetwork | null = null;
	export let loaded: Promise<any> | null = null;

	async function decrypt_memo(s_memo: string): Promise<string> {
		const {
			msgs: [
				{
					events: {
						transfer: g_transfer,
					},
				},
			],
			signers: a_signers,
		} = (incident as Incident.Struct<'tx_in' | 'tx_out'>).data as TxSynced;

		const s_sequence = a_signers![0].sequence;

		const {
			recipient: sa_recipient,
			sender: sa_sender,
		} = g_transfer;


		const b_outgoing = 'tx_out' === incident!.type;

		const sa_owner = (b_outgoing? sa_sender: sa_recipient) as Bech32;
		const sa_other = (b_outgoing? sa_recipient: sa_sender) as Bech32;

		const [, g_account] = await Accounts.find(sa_owner, $yw_chain);

		return await decrypt_private_memo(s_memo, network!, sa_other, s_sequence, g_account);
	}

</script>

{#each fields as g_field}
	<hr>

	{#if 'key_value' === g_field.type}
		<Field
			short={!g_field.long && !g_field.pfp}
			key={g_field.key.toLowerCase()}
			name={g_field.key}
		>
			<div style="display:flex;">
				{#if g_field.pfp}
					<PfpDisplay dim={32} path={g_field.pfp} />
				{/if}

				<div style="display:flex; flex-flow:column;">
					{#await g_field.value}
						<Load forever />
					{:then s_value}
						{#if 'address' === g_field.render}
							<Address address={s_value} copyable />
						{:else}
							{s_value}
						{/if}
					{/await}

					{#if g_field.subvalue}
						<div class="subvalue">
							<Load input={g_field.subvalue} />
						</div>
					{/if}
				</div>
			</div>
		</Field>
	{:else if 'memo' === g_field.type}
		{#if g_field.value?.startsWith('🔒1')}
			{#await decrypt_memo(g_field.value)}
				<MemoReview
					memoPlaintext={forever('')}
					memoCiphertext={forever('')}
				/>
			{:then s_plaintext}
				<MemoReview
					memoPlaintext={s_plaintext}
					memoCiphertext={g_field.value}
				/>
			{:catch}
				<MemoReview
					memoPlaintext={null}
					memoCiphertext={g_field.value}
				/>
			{/await}
		{:else}
			<MemoReview
				memoPlaintext={g_field.value || ''}
			/>
		{/if}
	{:else if 'links' === g_field.type}
		<div class="links">
			{#await g_field.value}
				<Load forever />
			{:then a_links}
				{#each a_links as g_link}
					<span class="link" on:click={() => open_external_link(g_link.href)}>
						{#if g_link.icon}
							<span class="global_svg-icon icon-diameter_20px">
								{@html g_link.icon}
							</span>
						{/if}
						<span class="text">
							{g_link.text}
						</span>
					</span>
				{/each}
			{/await}
		</div>
	{/if}
{/each}