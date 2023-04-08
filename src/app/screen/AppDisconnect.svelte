<script lang="ts">
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AppStruct} from '#/meta/app';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	import {reloadable} from '../mem-store';
	import {load_page_context} from '../svelte';
	
	import {produce_contract} from '#/chain/contract';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Contracts} from '#/store/contracts';
	import {Secrets} from '#/store/secrets';
	
	import {ode, remove} from '#/util/belt';
	import {buffer_to_text} from '#/util/data';
	
	import RequestSignature from './RequestSignature.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import Header from '../ui/Header.svelte';
	


	/**
	 * The app being disconnected
	 */
	export let g_app: AppStruct;

	const p_app = Apps.pathFrom(g_app);

	const {
		k_page,
	} = load_page_context();

	let a_keys_global: SecretStruct<'viewing_key'>[] = [];
	let a_keys_local: typeof a_keys_global = [];
	$: nl_keys_local = a_keys_local.length;

	let a_permits_global: SecretStruct<'query_permit'>[] = [];
	let a_permits_local: typeof a_permits_global = [];
	$: nl_permits_local = a_permits_local.length;

	$: b_pending_revoke = nl_keys_local+nl_permits_local > 0;

	let b_loading = false;

	$: g_connection = g_app.connections[$yw_chain_ref];

	async function reload_context() {
		b_loading = true;

		const sa_owner = $yw_owner!;
		if(!sa_owner) return;

		await Promise.all([
			(async() => {
				a_keys_global = await Secrets.filter({
					type: 'viewing_key',
					on: 1,
					owner: sa_owner,
					outlets: [p_app],
				});

				a_keys_local = a_keys_global.filter(g => $yw_chain_ref === g.chain);
			})(),

			(async() => {
				a_permits_global = await Secrets.filter({
					type: 'query_permit',
					on: 1,
					owner: sa_owner,
					outlets: [p_app],
				});

				a_permits_local = a_permits_global.filter(g => $yw_chain_ref === g.chain);
			})(),
		]);

		b_loading = false;
	}

	async function disconnect_app() {
		// freeze ui
		b_loading = true;

		// lock refs
		const p_chain = $yw_chain_ref;
		const p_account = $yw_account_ref;

		// begin transactional update
		await Apps.update(p_app, (g_latest) => {
			// ref latest connections
			const h_connections = g_latest.connections;

			// remove account from connection
			const a_accounts = remove(h_connections[p_chain].accounts, p_account);

			// whether to disable the app
			let b_disable = false;

			// no more accounts
			if(!a_accounts.length) {
				// delete all connections for this chain
				delete h_connections[p_chain];

				// disable the app
				b_disable = true;
			}

			// return updated struct
			return {
				...b_disable? {
					on: 0,
				}: {},
				connections: h_connections,
			};
		});

		// done
		b_loading = false;

		// reset thread
		k_page.reset();
	}

	async function revoke_tokens() {
		const a_msgs: Any[] = [];

		// cache writables
		const p_account = $yw_account_ref;
		const g_account = $yw_account;
		const p_chain = $yw_chain_ref;
		const g_chain = $yw_chain;
		const y_network = $yw_network as SecretNetwork;

		// load contracts store
		const ks_contracts = await Contracts.read();

		// generate viewing key rotations
		for(const g_secret of a_keys_local) {
			const sa_contract = g_secret.contract;

			// load contract struct
			let g_contract = ks_contracts.at(Contracts.pathFor(p_chain, sa_contract));

			// contract not found
			if(!g_contract) {
				// retry with production
				g_contract = await produce_contract(sa_contract, g_chain, g_app, g_account);

				// still not found
				if(!g_contract) {
					syserr({
						title: 'Contract not found',
						text: `A viewing key references contract ${sa_contract}, but the contract was not found in your wallet.`,
					});
					continue;
				}
			}

			// get existing viewing key to use as seed for next one
			const s_viewing_key = await Secrets.borrowPlaintext(g_secret, (kn, g) => buffer_to_text(kn.data));

			// generate rotation message
			const g_rotate = await Snip2xMessageConstructor
				.generate_viewing_key(g_account, g_contract, y_network, s_viewing_key);

			// add to list
			a_msgs.push(g_rotate.proto);
		}

		// generate permit revocations
		for(const g_secret of a_permits_local) {
			// each contract
			for(const [sa_contract, s_revoked] of ode(g_secret.contracts)) {
				// permit was already revoked for this contract
				if(s_revoked) continue;

				// load contract struct
				let g_contract = ks_contracts.at(Contracts.pathFor(p_chain, sa_contract));

				// contract not found
				if(!g_contract) {
					// retry with production
					g_contract = await produce_contract(sa_contract, g_chain, g_app, g_account);

					// still not found
					if(!g_contract) {
						syserr({
							title: 'Contract not found',
							text: `Query permit ${g_secret.alias || g_secret.name} references contract ${sa_contract}, but the contract was not found in your wallet.`,
						});
						continue;
					}
				}

				// generate message
				const g_revoke = await Snip2xMessageConstructor
					.revoke_permit(g_account, g_contract, y_network, g_secret.name);

				// append to list
				a_msgs.push(g_revoke.proto);
			}
		}

		// present to user for signing
		k_page.push({
			creator: RequestSignature,
			props: {
				protoMsgs: a_msgs,
				fee: {
					limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key),
				},
				broadcast: {},
				local: true,
			},
			context: {
				app: G_APP_STARSHELL,
				chain: g_chain,
				accountPath: p_account,
			},
		});
	}

	reloadable({
		context: {
			sources: [yw_account, yw_chain],
			action: reload_context,
		},
	});
</script>

<style lang="less">
	
</style>

<Screen>
	<Header pops
		title='Disconnect App'
		subtitle="on {$yw_chain.name}"
	/>

	<div style="margin: 0 0 2em 0;">
		<AppBanner app={g_app} account={$yw_account} chains={[$yw_chain]}
			sx_cluster_style="filter: grayscale(1);"
			embedded />
	</div>

	{#if !g_connection}
		<p>
			This app is not connected to {$yw_account.name} on {$yw_chain.name}.
		</p>
	{:else}
		<div class="flex_1">
			{#if $yw_chain.features.secretwasm}
				<p>
					Keep your funds safe and your data private by disconnecting apps you no longer need or trust.
					You can always reconnect again later.
				</p>

				{#if b_pending_revoke}
					<p>
						App has access to
						{#if nl_keys_local}
							{nl_keys_local} viewing key{1 === nl_keys_local? '': 's'} {nl_permits_local? ' and ': ''}
						{/if}
						{#if nl_permits_local}
							{nl_permits_local} query permit{1 === nl_permits_local? '': 's'}
						{/if}
						belonging to this account on this chain. They will need to be revoked first.
					</p>
				{/if}
			{/if}
		</div>

		<ActionsWall>
			{#if b_pending_revoke}
				<button class="primary" disabled={!$yw_network} on:click={() => revoke_tokens()}>
					Revoke Token Access
				</button>
			{/if}

			<button class="cautionary"
				disabled={b_pending_revoke || b_loading}
				on:click={() => disconnect_app()}
			>
				Disconnect
			</button>
		</ActionsWall>
	{/if}
</Screen>
