<script lang="ts">
	import type {Bech32, ContractStruct} from '#/meta/chain';
	import type {SecretStruct} from '#/meta/secret';
	import {Snip24} from '#/schema/snip-24-const';
	import type {Snip24Permission} from '#/schema/snip-24-def';
	
	import {Screen, Header} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {Contracts} from '#/store/contracts';
	import {ode} from '#/util/belt';
	
	import {buffer_to_base58} from '#/util/data';
	
	import QueryPermitExport from './QueryPermitExport.svelte';
	import RecipientSelect from '../frag/RecipientSelect.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	
	import SX_ICON_BAN from '#/icon/ban.svg?raw';
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
	
	const {k_page} = load_page_context();
	
	
	export let permit: SecretStruct<'query_permit'>;
	
	const a_permissions = (() => {
		const a_original = permit.permissions.slice();
		const a_sorted: Snip24Permission[] = [];

		debugger;

		for(const si_permission of Snip24.PERMISSIONS) {
			const i_original = a_original.indexOf(si_permission);

			if(i_original >= 0) {
				a_sorted.push(si_permission);
				a_original.splice(i_original, 1);
			}
		}

		return [...a_sorted, ...a_original];
	})();

	const s_permissions = a_permissions.length <= 1? a_permissions.join('')
		: a_permissions.slice(0, -1).join(', ')+' and '+a_permissions.at(-1);

	const s_password_export = buffer_to_base58(crypto.getRandomValues(new Uint8Array(10)));

	const b_disabled = true;

	function send_permit() {

	}

	let sa_recipient: Bech32 = '';

	let a_contracts: ContractStruct[] = [];
	(async function load() {
		const ks_contracts = await Contracts.read();
		for(const [sa_contract] of ode(permit.contracts)) {
			const p_contract = Contracts.pathFor(permit.chain, sa_contract);
			const g_contract = ks_contracts.at(p_contract)!;
			a_contracts.push(g_contract);
		}

		// reactively update
		a_contracts = a_contracts;
	})();
</script>

<style lang="less">
	.chain-account {
		display: flex;

		>* {
			flex: auto;
		}
	}

	.actions {
		color: var(--theme-color-primary);
	}

	.permissions {
		display: flex;
		justify-content: space-between;
	}
</style>

<Screen slides>
	<Header title='Query Permit' postTitle='Share' pops search />

	<h3>
		Share Query Permit
	</h3>

	<p>
		Securely send this query permit to someone over the blockchain. The recipient will be able to use it to view the up-to-date <b>{s_permissions || 'private data'}</b> for the token{1 === a_contracts.length? '': 's'} shown below.
	</p>

	<p>
		You can still revoke this permit after sharing it.
	</p>

	<Field
		key='recipient-select'
		name='Recipient'
	>
		<RecipientSelect
			bind:address={sa_recipient}
		/>

		<!-- <RecipientSelect
			bind:error={s_err_recipient}
			bind:address={sa_recipient}
			showValidation={c_show_validations}
		/> -->
	</Field>

	<Field key='tokens' name='Tokens / Contracts'>
		{#each a_contracts as g_contract}
			<TokenRow contract={g_contract} />
		{/each}
	</Field>

	<span class="link" on:click={() => {
		k_page.push({
			creator: QueryPermitExport,
			props: {
				permit,
			},
		});
	}}>
		Export Permit
	</span>

	<ActionsLine cancel confirm={['Send', () => send_permit(), b_disabled]} />
</Screen>
