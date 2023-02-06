<script lang="ts">
	import type {AppPath, AppStruct} from '#/meta/app';
	import type {Dict} from '#/meta/belt';
	import type {Bech32, ContractStruct} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	
	import {onDestroy} from 'svelte';
	
	import {Screen} from './_screens';
	import {yw_account, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	import {reloadable} from '../mem-store';
	import {load_page_context} from '../svelte';
	
	import {produce_contracts} from '#/chain/contract';
	import {Apps} from '#/store/apps';
	import {Secrets} from '#/store/secrets';
	import {ode, oderac} from '#/util/belt';
	
	import AppDisconnect from './AppDisconnect.svelte';
	import QueryPermitView from './QueryPermitView.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import Header from '../ui/Header.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_EXPAND_RIGHT from '#/icon/expand-right.svg?raw';


	export let g_app: AppStruct;

	const p_app = Apps.pathFrom(g_app);

	const {
		k_page,
	} = load_page_context();

	let h_outlet_pfps: Record<AppPath, PfpTarget> = {};

	let a_permits: SecretStruct<'query_permit'>[] = [];
	let h_contracts: null|Record<Bech32, ContractStruct> = null;
	let h_revoked: Record<SecretPath, boolean> = {};
	let h_summaries: Record<string, string> = {};

	async function reload() {
		h_contracts = null;

		h_summaries = {};

		a_permits = await Secrets.filter({
			type: 'query_permit',
			on: 1,
			owner: $yw_owner!,
			chain: $yw_chain_ref,
			outlets: [p_app],
		});

		const a_bech32s: Bech32[] = [];

		for(const g_permit of a_permits) {
			let c_unrevoked_contracts = 0;

			for(const [sa_contract, si_revoked] of ode(g_permit.contracts)) {
				if(!si_revoked && !a_bech32s.includes(sa_contract)) {
					a_bech32s.push(sa_contract);
					c_unrevoked_contracts += 1;
				}
			}

			if(!c_unrevoked_contracts) {
				h_revoked[Secrets.pathFrom(g_permit)] = true;
			}

			const p_outlet = g_permit.outlets[0];
			// eslint-disable-next-line @typescript-eslint/no-loop-func
			void Apps.at(p_outlet).then((g_outlet) => {
				if(p_outlet in h_outlet_pfps) return;

				h_outlet_pfps[p_outlet] = g_outlet?.pfp || '';
				h_outlet_pfps = h_outlet_pfps;
			});
		}

		// produce contracts for each bech32 referenced
		const a_contracts = await produce_contracts(a_bech32s, $yw_chain);

		// initialize staging object
		const h_staging = {};
		for(const g_contract of a_contracts) {
			h_staging[g_contract.bech32] = g_contract;
		}

		// create contract summary
		for(const g_permit of a_permits) {
			const h_counts: Dict<number> = {};

			for(const sa_contract in g_permit.contracts) {
				const g_contract = h_staging[sa_contract];

				const s_title = g_contract.interfaces.snip20?.symbol || g_contract.name || 'other';

				h_counts[s_title] = (h_counts[s_title] || 0) + 1;
			}

			h_summaries[g_permit.uuid] = oderac(h_counts, (s_title, n_count) => 1 === n_count? s_title: `${n_count} ${s_title}s`).join(', ');
		}

		// reactive assign
		h_contracts = h_staging;
		h_revoked = h_revoked;
	}

	reloadable({
		context: {
			sources: [yw_account, yw_chain],
			action: reload,
		},
	}, onDestroy);

	void reload();

	async function revoke(g_secret: SecretStruct<'query_permit'>) {
		// // cache context before going async
		// const k_network = $yw_network as SecretNetwork;
		// const g_account = $yw_account;
		// const g_chain = $yw_chain;

		// // lookup contract struct
		// const g_contract = h_contracts![g_secret.contract];

		// // get viewing key text for rotation seed
		// const s_viewing_key = await Secrets.borrowPlaintext(g_secret, kn => buffer_to_text(kn.data));

		// // build rotation message
		// const g_rotate = await Snip2xMessageConstructor.set_viewing_key(g_account, g_contract, k_network, s_viewing_key);

		// // request user signature
		// k_page.push({
		// 	creator: RequestSignature,
		// 	props: {
		// 		protoMsgs: [g_rotate.proto],
		// 		fee: {
		// 			limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key),
		// 		},
		// 		broadcast: {},
		// 		local: true,
		// 	},
		// 	context: {
		// 		app: G_APP_STARSHELL,
		// 		chain: g_chain,
		// 		accountPath: Accounts.pathFrom(g_account),
		// 	},
		// });
	}
</script>

<style lang="less">
	
	.top-controls {
		display: flex;
		margin-top: 1.5em;
		align-self: end;
	}
</style>

<Screen>
	<Header account network pops
		title='App Query Permits'
		subtitle="on {$yw_chain.name}"
	/>

	<AppBanner app={g_app} account={$yw_account} chains={[$yw_chain]} embedded />

	{#if h_contracts && $yw_network}
		<div class="top-controls">
			<!-- TODO: add toolip explaining that other apps will be able to access viewing key next time they are visited -->


			{#if a_permits.length}
				<button class="pill" on:click={() => k_page.push({
					creator: AppDisconnect,
					props: {g_app},
				})}>
					Revoke All
				</button>
			{/if}
		</div>

		<div class="rows no-margin">
			{#if !a_permits.length}
				<center class="color_text-med">
					App does not have access to any query permits belonging to {$yw_account.name} on {$yw_chain.name}.
				</center>
			{/if}

			{#each a_permits as g_permit}
				<Row
					name={g_permit.alias || g_permit.name}
					detail="{g_permit.permissions.join(' ')} for {h_summaries[g_permit.uuid]}"
					pfp={h_outlet_pfps[g_permit.outlets[0]] || ''}
					on:click={() => {
						k_page.push({
							creator: QueryPermitView,
							props: {
								secretPath: Secrets.pathFrom(g_permit),
							},
						});
					}}
				>
					<span slot="right" class="global_svg-icon icon-diameter_22px color_primary">
						{@html SX_ICON_EXPAND_RIGHT}
					</span>
				</Row>
			{/each}
		</div>
	{/if}
</Screen>
