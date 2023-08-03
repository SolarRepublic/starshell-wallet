<script lang="ts">
	import type {AppStruct, AppPath} from '#/meta/app';
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ChainPath, ContractStruct} from '#/meta/chain';
	import type {FieldConfig} from '#/meta/field';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Snip2xMessageConstructor, Snip2xToken} from '#/schema/snip-2x-const';
	
	import {Screen, Header} from './_screens';
	import {syserr} from '../common';
	import {starshell_transaction} from '../helper/starshell';
	import {yw_account, yw_account_ref, yw_network, yw_owner} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	
	import AppView from './AppView.svelte';
	import QueryPermitCreate from './QueryPermitCreate.svelte';
	import ChainToken from '../frag/ChainToken.svelte';
	import QueryPermitRow from '../frag/QueryPermitRow.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import PasswordField from '../ui/PasswordField.svelte';
	import Row from '../ui/Row.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	
	const {
		k_page,
	} = load_page_context();

	export let contract: ContractStruct;

	let g_chain: ChainStruct;
	let p_chain: ChainPath;

	const k_token = new Snip2xToken(contract, $yw_network as SecretNetwork, $yw_account);


	const b_snip20 = !!contract.interfaces.snip20;

	const s_header_title: Promisable<string> = b_snip20? 'SNIP-20': 'SNIP-24';
	const s_header_post_title: Promisable<string> = 'Visibility';
	const s_header_subtitle: Promisable<string> = `${contract.name}${b_snip20? ' token': ''}`;

	const a_fields: FieldConfig[] = [];

	let s_viewing_key = '';
	let g_viewing_key: SecretStruct<'viewing_key'>;
	let a_outlets_vks: [AppPath, AppStruct][] = [];

	let a_permits: SecretStruct<'query_permit'>[] = [];
	let s_permit_title = '';

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;
		p_chain = Chains.pathFrom(g_chain);

		const ks_apps = await Apps.read();

		// snip-20
		if(contract.interfaces.snip20) {
			const a_viewing_key = await k_token.viewingKey();

			// not a snip-20
			if(!a_viewing_key) {
				throw syserr({
					title: 'No Viewing Key',
					text: 'You seem to be missing a viewing key for this token.',
				});
			}

			[s_viewing_key, g_viewing_key] = a_viewing_key;

			a_outlets_vks = await Promise.all(g_viewing_key.outlets.map(p => [p, ks_apps.at(p)]));
		}

		a_permits = await Secrets.filter({
			type: 'query_permit',
			owner: $yw_owner!,
			contracts: {
				[contract.bech32]: '',
			},
			chain: p_chain,
		});

		const as_apps = new Set<AppPath>();
		for(const g_permit of a_permits) {
			for(const p_app of g_permit.outlets) {
				as_apps.add(p_app);
			}
		}

		if(!a_permits.length) {
			s_permit_title = 'No query permits yet';
		}
		else {
			// s_permit_title = `${a_permits.length} permit${1 === a_permits.length? ' grants': 's grant'} ${as_apps.size} app${1 === as_apps.size? '': 's'} some query permissions`;
		}
	})();

	async function rotate_key() {
		// construct viewing key message
		const g_exec = await Snip2xMessageConstructor.generate_viewing_key($yw_account, contract, $yw_network as SecretNetwork, s_viewing_key);

		starshell_transaction([g_exec.proto], g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key);
	}

	let b_tooltip_showing = false;
</script>


<Screen nav slides>
	<Header pops search account
		title={s_header_title}
		postTitle={s_header_post_title}
		subtitle={s_header_subtitle}
	/>

	<h3 style="position:relative; z-index:16;">
		Visibility Settings
		<Tooltip bind:showing={b_tooltip_showing}>
			<p>
				{b_snip20? 'SNIP-20 tokens': 'SNIP-24 contracts'} are private, meaning that only certain agents are able to view your {b_snip20
					? 'account balance, transaction history.'
					: 'private data stored in the contract.'}
				This screen lets you control the visibility of this {b_snip20? 'token': 'contract'}.
			</p>
		</Tooltip>
	</h3>

	<ChainToken isToken={b_snip20} contract={contract} />

	{#if b_snip20}
		<PasswordField password={s_viewing_key} label="Viewing Key">
			<svelte:fragment slot="right">
				<button class="pill" on:click={() => rotate_key()}>
					Rotate Key
				</button>
			</svelte:fragment>
		</PasswordField>

		<Field key="apps-vks" name="Apps with Viewing Key">
			<div>
				{#if !a_outlets_vks.length}
					No apps have this viewing key
				{:else}
					<!-- {0 === a_outlets_vks.length? 'No': a_outlets_vks.length} app{1 === a_outlets_vks.length? ' has': 's have'} this viewing key -->
				{/if}
			</div>

			{#each a_outlets_vks as [p_outlet, g_outlet]}
				<Row
					resource={g_outlet}
					resourcePath={p_outlet}
					detail={g_outlet.host}
					on:click={() => {
						k_page.push({
							creator: AppView,
							props: {
								app: g_outlet,
							},
						});
					}}
				/>
			{/each}
		</Field>
	{/if}

	<Field key="permits" name="Query Permits">
		<svelte:fragment slot="right">
			{#if contract.interfaces.snip24}
				<button class="pill" on:click={() => k_page.push({
					creator: QueryPermitCreate,
					props: {
						contract,
					},
				})}>
					Create Permit
				</button>
			{/if}
		</svelte:fragment>

		{#if contract.interfaces.snip24}
			{#if s_permit_title}
				{s_permit_title}
			{/if}

			{#each a_permits as g_permit}
				<QueryPermitRow secret={g_permit} />
			{/each}
		{:else}
			This token does not support query permits
		{/if}
	</Field>

	<Fields configs={a_fields} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
