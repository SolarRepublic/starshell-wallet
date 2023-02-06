<script lang="ts">
	import type {ChainStruct, ContractStruct} from '#/meta/chain';
	import type {AdaptedAminoResponse} from '#/schema/amino';
	import {Snip24} from '#/schema/snip-24-const';
	import type {Snip24Permission} from '#/schema/snip-24-def';
	
	import {Screen, Header} from './_screens';
	import {yw_account, yw_account_ref, yw_navigator} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {save_query_permit} from '#/chain/query-permit';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	import {proper, remove} from '#/util/belt';
	
	import type {CompletedSignature} from './RequestSignature.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Field from '../ui/Field.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	
	
	
	const {
		k_page,
	} = load_page_context();


	export let contract: ContractStruct;

	let si_permit = '';

	let s_alias = '';

	let s_permissions = '';

	$: a_permissions = s_permissions.replace(/\s+/, ' ').trim().split(' ') as Snip24Permission[];

	let s_err_name = '';

	let g_chain: ChainStruct;

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;
	})();

	$: if(si_permit && g_chain) {
		void validate_permit_name();
	}

	let b_permit_name_validated = false;
	async function validate_permit_name() {
		b_permit_name_validated = false;

		const a_existing = await Secrets.filter({
			type: 'query_permit',
			chain: contract.chain,
			owner: Chains.addressFor($yw_account.pubkey, g_chain),
			name: si_permit,
			contracts: [contract.bech32],
		});

		if(a_existing.length) {
			s_err_name = 'Permit already exists with that ID';
		}
		else {
			s_err_name = '';
		}

		b_permit_name_validated = true;
	}

	function set_permission(si_permission: Snip24Permission, d_event: CustomEvent<boolean>) {
		if(d_event.detail) {
			if(!a_permissions.includes(si_permission)) {
				s_permissions = a_permissions.join(' ')+' '+si_permission;
			}
		}
		else if(a_permissions.includes(si_permission)) {
			remove(a_permissions as Snip24Permission[], si_permission);
			s_permissions = a_permissions.join(' ');
		}
	}

	$: b_form_valid = si_permit && b_permit_name_validated && !s_err_name;

	let b_disabled = false;
	function submit() {
		if(!b_form_valid) {
			if(!si_permit) s_err_name = 'Cannot be blank';

			return;
		}

		b_disabled = true;

		const g_amino = Snip24.query_permit(g_chain.reference, {
			type: 'query_permit',
			value: {
				allowed_tokens: [contract.bech32],
				permit_name: si_permit,
				permissions: a_permissions,
			},
		});

		k_page.push({
			creator: RequestSignature,
			props: {
				amino: g_amino,
				local: true,
			},
			context: {
				chain: g_chain,
				accountPath: $yw_account_ref,
				app: G_APP_STARSHELL,
				async completed(b_answer: boolean, g_completed: CompletedSignature) {
					if(b_answer) {
						const p_app = Apps.pathFrom(G_APP_STARSHELL);
						const p_chain = contract.chain;

						await save_query_permit(
							g_completed.amino! as AdaptedAminoResponse,
							p_app,
							p_chain,
							$yw_account_ref,
							si_permit,
							a_permissions as Snip24Permission[],
							[contract.bech32]
						);
					}

					$yw_navigator.activePage.reset();
				},
			},
		});

		b_disabled = false;
	}
</script>

<style lang="less">
	.permissions {
		display: flex;
		justify-content: space-between;
		margin-right: var(--ui-padding);
		margin-bottom: calc(var(--ui-padding) / 2);
	}
</style>

<Screen form slides>
	<Header title='SNIP-20' postTitle='Query Permit' subtitle={contract.name} pops search />

	<h3>
		Create new Query Permit
	</h3>

	<TokenRow contract={contract} />

	<Field key='id' name='Public Permit ID'>
		<input type="text"
			placeholder="Custom Permit for {contract.name}"
			bind:value={si_permit}
		>

		{#if s_err_name}
			<span class="validation-message">
				{s_err_name}
			</span>
		{/if}
	</Field>

	<Field key='permissions' name='Permissions'>
		<div class="permissions">
			{#each Snip24.PERMISSIONS.filter(s => 'owner' !== s) as si_permission}
				<CheckboxField id={si_permission} on:change={d => set_permission(si_permission, d)} checked={a_permissions.includes(si_permission)}>
					{proper(si_permission)}
				</CheckboxField>
			{/each}
		</div>

		<input type="text"
			bind:value={s_permissions}
		>
	</Field>

	<Field key='alias' name='Local Permit Alias (optional)'>
		<input type="text"
			placeholder={si_permit}
			bind:value={s_alias}
		>
	</Field>

	<!-- <h3>
		Add Tags
	</h3>

	<InlineTags subtle editable /> -->

	<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid || b_disabled]} />
</Screen>
