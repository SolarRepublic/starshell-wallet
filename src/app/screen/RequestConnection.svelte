<script lang="ts">
	import type {SessionRequest} from '#/meta/api';
	import type {AppStruct} from '#/meta/app';
	import type {Dict} from '#/meta/belt';
	import type {Caip2, ChainStruct} from '#/meta/chain';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {fodemtv, F_NOOP, ode} from '#/util/belt';
	
	import RequestConnectionAccounts from './RequestConnection_Accounts.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import Row from '../ui/Row.svelte';
	

	const {
		completed,
	} = load_flow_context<undefined>();

	export let app: AppStruct;

	export let chains: Record<Caip2.String, ChainStruct>;
	const h_chains = chains;

	export let sessions: Dict<SessionRequest>;

	const nl_chains = Object.keys(h_chains).length;


	// selected state of each chain
	const h_selected = fodemtv(h_chains, () => true);

	$: b_none_selected = Object.values(h_selected).every(b => !b);

</script>

<style lang="less">

</style>

<Screen>
	<AppBanner {app} on:close={() => completed(false)}>
		<svelte:fragment slot="default">
			This app wants to connect on {1 === nl_chains? 'the chain': `${nl_chains} chains`}:
		</svelte:fragment>

		<svelte:fragment slot="context">
			Choose 1 chain at a time.
		</svelte:fragment>
	</AppBanner>

	<div class="rows no-margin">
		{#each ode(h_chains) as [si_caip2, g_chain]}
			<Row
				resource={g_chain}
				name={g_chain.name}
				pfp={g_chain.pfp}
				detail={si_caip2}
				on:click={toggleChildCheckbox}
			>
				<CheckboxField id={si_caip2} slot='right' checked={h_selected[si_caip2]}
					on:change={({detail:b_checked}) => h_selected[si_caip2] = b_checked} />
			</Row>
		{/each}
	</div>

	<ActionsLine cancel={() => completed(false)} confirm={['Next', F_NOOP, b_none_selected]} contd={{
		creator: RequestConnectionAccounts,
		props: {
			app,
			chains,
			sessions,
		},
	}} />
</Screen>
