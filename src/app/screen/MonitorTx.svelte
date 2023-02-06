<script lang="ts">
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {ChainPath, ChainStruct} from '#/meta/chain';
	
	import type {IncidentStruct} from '#/meta/incident';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import {global_wait} from '#/script/msg-global';
	import {NetworkFeed} from '#/script/service-feed';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {Providers} from '#/store/providers';
	import {timeout, timeout_exec} from '#/util/belt';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
    import { system_notify } from '#/extension/notifications';
	

	// flow complete callback
	const {
		completed,
	} = load_flow_context<undefined>();

	/**
	 * Transaction hash
	 */
	export let hash: string;

	/**
	 * Chain path
	*/
	export let chain: ChainPath;

	/**
	 * Account path
	 */
	export let account: AccountPath;

	let g_chain: ChainStruct;
	let g_account: AccountStruct;
	let k_network: CosmosNetwork;
	let k_feed!: NetworkFeed;

	let s_status = 'Loading resources';

	let s_provider = '[...]';

	// track confirmation status
	let b_confirmed = false;

	let b_critical_failure = false;

	function confirmed() {
		// stop any heal attempts
		b_confirmed = true;

		// update status
		s_status = 'Confirmed. Closing resources';

		// destroy the feed
		k_feed?.destroy();

		// complete flow
		completed?.(true);
	}

	(async function observe() {
		// limiting timeout
		const [, xc_timeout_ws] = await timeout_exec(20e3, async() => {
			// wait for tx success or error
			await Promise.race([
				global_wait('txSuccess', g => hash === g.hash),
				global_wait('txError', g => hash === g.hash),
			]);

			confirmed();
		});

		// timed out
		if(xc_timeout_ws) {
			s_status = 'Taking too long. Checking websocket health';

			let b_socket_failed = false;

			// attempt to wake feed's sockets
			try {
				await k_feed.wake(5e3, 5e3);
			}
			// network or socket issue
			catch(e_wake) {
				s_status = e_wake.message;
				b_socket_failed = true;
			}

			// already confirmed; stop
			if(b_confirmed) return;

			// no socket issue, give some time to retry
			if(!b_socket_failed) {
				s_status = 'Sockets reset. Retrying';

				// allow some more time to catch up
				await timeout(15e3);

				// succeeeded; stop
				if(b_confirmed) return;
			}

			// still no activity, resort to manually checking txhash
			try {
				const [g_inspect, xc_timeout_fetch] = await timeout_exec(10e3, () => k_network!.fetchTx(hash));

				// succeeeded; stop
				if(b_confirmed) return;

				if(xc_timeout_fetch) {
					s_status = 'Node provider is not responding';
				}
				else if('number' === typeof g_inspect?.txResponse?.code) {
					s_status = 'Transaction completed but missed event. Syncing with chain';

					try {
						await k_network!.downloadTxn(hash, account, Apps.pathFrom(G_APP_STARSHELL));

						return confirmed();
					}
					catch(e_download) {
						s_status = e_download.message;
					}
				}
				else {
					s_status = 'Node provider is healthy, but transaction appears stuck in processing';
				}
			}
			catch(e_inspect) {
				s_status = e_inspect.message;
			}

			return b_critical_failure = true;
		}
	})();

	(async function launch() {
		// load resources
		g_chain = (await Chains.at(chain))!;
		g_account = (await Accounts.at(account))!;

		s_status = 'Activating provider';

		// instantiate network for default provider for given chain
		k_network = await Providers.activateDefaultFor(g_chain);

		s_status = 'Connecting to node provider';

		s_provider = k_network.provider.grpcWebUrl;

		// create network feed
		k_feed = new NetworkFeed(g_chain, k_network.provider, {
			notify: system_notify,
		});

		// open socket
		await k_feed.open();

		s_status = 'Subscribing to event stream';

		// follow this account
		try {
			await k_feed.followAccount(g_account);
		}
		catch(e_follow) {
			s_status = `Network error: ${e_follow.message}`;

			return b_critical_failure = true;
		}

		s_status = 'Waiting for response';

		// check if tx was already synced
		const p_incident = Incidents.pathFor('tx_out', hash);
		const g_incident = await Incidents.at(p_incident) as IncidentStruct<'tx_out'>;
		if('synced' === g_incident?.data?.stage) {
			k_feed?.destroy();

			// complete flow
			completed?.(true);
		}
	})();

</script>

<style lang="less">
	@import '../_base.less';

	.summary {
		margin: var(--ui-padding) calc(2 * var(--ui-padding));

		.name {
			color: var(--theme-color-blue);
			font-weight: 500;
		}
	}
</style>

<Screen>
	<AppBanner closeable={false}
		app={G_APP_STARSHELL}
		chains={[g_chain]}
		account={g_account}
	>
		Waiting for Confirmation
	</AppBanner>
		
	<p>
		{#if b_critical_failure}
			An error occurred; unable to determine the status of the transaction. You can now close this window.
		{:else}
			Please wait until your transaction is confirmed. Do not close this window. It will automatically close itself.
		{/if}
	</p>

	<Field key='status' name='Status'>
		{s_status}...
	</Field>

	<Field key='provider' name='Provider'>
		{s_provider}
	</Field>

	{#if b_critical_failure}
		<Field key='suggestion' name='Suggestion'>
			Wait a minute, check your network connection, then try logging out and back in.
		</Field>

		<ActionsLine confirm={['Close', () => (completed?.(false), window.close())]} />
	{/if}
</Screen>
