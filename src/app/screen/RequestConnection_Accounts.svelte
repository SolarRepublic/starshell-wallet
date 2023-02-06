<script lang="ts">	
	import type {AccountStruct, AccountPath} from '#/meta/account';
	import type {SessionRequest} from '#/meta/api';
	import type {AppStruct} from '#/meta/app';
	import type {Dict} from '#/meta/belt';
	import type {Caip2, ChainStruct} from '#/meta/chain';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {fold, F_NOOP, ode, oderac, timeout} from '#/util/belt';
	
	import RequestConnectionPermissions from './RequestConnection_Permissions.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';


	const {
		completed,
		k_page,
	} = load_flow_context<undefined>();

	export let app: AppStruct;

	// TODO: change this to only allow a single chain request at a time
	export let chains: Record<Caip2.String, ChainStruct>;
	const h_chains = chains;

	export let sessions: Dict<SessionRequest>;

	type AccountMap = Record<AccountPath, AccountStruct>;

	let h_accounts: AccountMap;

	export let accountPath: AccountPath;

	
	// selected state of each account
	let h_selected: Record<AccountPath, boolean> = {};
	
	// disabled state of each account (because the connection already exists)
	let h_disabled: Record<AccountPath, boolean> = {};

	$: b_none_selected = Object.values(h_selected).every(b => !b);


	let dm_rows: HTMLElement;
	let b_autoselecting = false;
	async function autoselect() {
		b_autoselecting = true;

		await timeout(25);

		const f_row = () => dm_rows.querySelector('.row');

		for(let i_repeats=0; i_repeats<2; i_repeats++) {
			await timeout(120);
			f_row()?.classList.add('selected');

			await timeout(120);
			f_row()?.classList.remove('selected');
		}

		f_row()?.classList.add('selected');

		await timeout(200);

		k_page.push({
			creator: RequestConnectionPermissions,
			props: {
				app,
				chains: h_chains,
				sessions,
				accounts: Object.values(h_accounts),
			},
		});

		await timeout(1200);

		f_row()?.classList.remove('selected');

		b_autoselecting = false;
	}

	async function load_accounts() {
		const ks_accounts = await Accounts.read();
		h_accounts = ks_accounts.raw;

		// only one account; skip screen automatically
		if(1 === Object.keys(h_accounts).length) {
			void autoselect();
		}

		const p_chain = Chains.pathFrom(Object.values(chains)[0]);
		h_disabled = fold(app.connections?.[p_chain]?.accounts || [], p_account => ({
			[p_account]: true,
		}));

		// existing connections cannot be deleted on this screen
		h_selected = {...h_disabled};

		// select the requested account
		h_selected[accountPath] = true;
	}
</script>

<Screen>
	<AppBanner {app} chains={Object.values(h_chains)} on:close={() => completed(false)}>
		Which accounts do you want to use on<br>
			{#each Object.values(h_chains) as g_chain, i_chain}
				{@const nl_chains = Object.values(h_chains).length}
				<strong>{g_chain.name}</strong>
				{i_chain === nl_chains - 1? '': i_chain === nl_chains - 2? ' and ': ', '}
			{/each}
		 with this app?
	</AppBanner>

	<div class="rows no-margin" bind:this={dm_rows}>
		{#await load_accounts()}
			<LoadingRows count={3} />
		{:then}
			{#each ode(h_accounts) as [p_account, g_account]}
				<Row
					name={g_account.name}
					pfp={g_account.pfp}
					on:click={toggleChildCheckbox}
				>
					<CheckboxField id={p_account} slot='right'
						disabled={h_disabled[p_account] || b_autoselecting}
						checked={h_selected[p_account]}
						on:change={({detail:b_checked}) => h_selected[p_account] = b_checked}
						/>
				</Row>
			{/each}
		{/await}
	</div>

	<ActionsLine cancel={() => completed(false)} confirm={['Next', F_NOOP, b_none_selected || b_autoselecting]} contd={{
		creator: RequestConnectionPermissions,
		props: {
			app,
			chains: h_chains,
			sessions,
			accounts: oderac(h_selected, (p, b) => b? p: void 0).map(p => h_accounts[p]),
		},
	}} />
</Screen>
