<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct, ChainPath, ContractStruct} from '#/meta/chain';
	
	import {Screen, Header} from './_screens';
	
	import {JsonPreviewer} from '../helper/json-previewer';
	
	import {yw_account} from '../mem';
	
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	
	import {ode} from '#/util/belt';
	
	import ChainToken from '../frag/ChainToken.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_DELETE from '#/icon/delete.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';

	export let contract: ContractStruct;

	let g_chain: ChainStruct;
	let p_chain: ChainPath;

	const g_snip20 = contract.interfaces.snip20;
	$: h_allowances = $yw_account.assets[p_chain]?.data?.[contract.bech32]?.allowances || {};

	let s_header_title: Promisable<string> = `Token`;
	const s_header_post_title: Promisable<string> = 'Spending';
	const s_header_subtitle: Promisable<string> = `${contract.name} token`;

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;
		p_chain = Chains.pathFrom(g_chain);

		// secret-wasm
		if(g_chain.features.secretwasm) {
			// snip-20
			if(g_snip20) {
				// set correct header title
				s_header_title = 'SNIP-20';


				// for testing
				//  = [
				// 	'secret18kfwq9d2k9xa7f6e40wutd6a85sjuecwk78hv8',  // token
				// 	'secret1htrxpd3xvhc05qcxv3np6gp6cljaep4940wuf9',  // account
				// 	'secret1hnfs6m9vnxgylt97cnw665645pwnvqrsqkanvy',  // contact
				// 	'secret1aqfw3gmp6h9e2ggtpmm7q245dwnyjggq7n32ag',  // unknown
				// ];

				// const g_query: Snip20.AllowanceQueryParameters<'allowance'> = {
				// 	allowance: {
				// 		owner: $yw_owner,
	
				// 	},
				// };
			}
		}
	})();

	async function load_agent(sa_agent: Bech32): Promise<[Pfpable & Nameable, string] | null> {
		// account
		try {
			const [p_account, g_account] = await Accounts.find(sa_agent, g_chain);

			return [g_account, 'account'];
		}
		catch(e_find) {}

		// contact
		const p_contact = Agents.pathForContactFromAddress(sa_agent);
		const g_contact = await Agents.getContact(p_contact);
		if(g_contact) {
			return [g_contact, 'contact'];
		}

		// contract
		const p_contract = Contracts.pathFor(p_chain, sa_agent);
		const g_contract = await Contracts.at(p_contract);
		if(g_contract) {
			return [g_contract, 'contract'];
		}

		// use address
		return null;
	}
</script>

<style lang="less">
	@import '../_base.less';
</style>


<Screen nav slides>
	<Header pops search account
		title={s_header_title}
		postTitle={s_header_post_title}
		subtitle={s_header_subtitle}
	/>

	<ChainToken isToken contract={contract} />

	{#if g_snip20}
		{@const nl_allowances = Object.keys(h_allowances).length}
		<Field key="spenders" name="Spenders">
			{0 === nl_allowances? 'No': nl_allowances} agent{1 === nl_allowances? ' is': 's are'} able to spend this token.
		</Field>

		{#each ode(h_allowances) as [sa_spender, g_allowance], i_spender}
			<Field key={`spender-${i_spender}`} name={`Spender #${i_spender+1}`} rootStyle={`
				margin-bottom: var(--ui-padding);
			`}>
				<span slot="right" style={`
					color: var(--theme-color-primary);
					display: flex;
					align-items: center;
					gap: 8px;
				`}>
					<span class="global_svg-icon icon-diameter_20px">
						{@html SX_ICON_EDIT}
					</span>
					<span class="global_svg-icon icon-diameter_20px">
						{@html SX_ICON_DELETE}
					</span>
				</span>

				<Fields configs={[
					JsonPreviewer.render({
						Summary: 'Able to spend your entire balance',
						Amount: '100000',
						Expires: '2022-01-04',
					}),
				]} />

				{#await load_agent(sa_spender)}
					<LoadingRows />
				{:then a_loaded}
					{#if a_loaded}
						{@const [g_agent, si_type] = a_loaded}
						<Row noHorizontalPad
							name={g_agent.name}
							detail={sa_spender}
							pfp={g_agent.pfp}
						/>
					{:else}
						<Row noHorizontalPad
							name="Unknown Agent"
							detail={sa_spender}
						/>
					{/if}
				{/await}
			</Field>
		{/each}
	{/if}
</Screen>