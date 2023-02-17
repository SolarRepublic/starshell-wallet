<script lang="ts">
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AccountStruct} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	import type {Bech32, ContractStruct} from '#/meta/chain';
	
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {yw_account} from '../mem';
	import {load_app_context} from '../svelte';
	
	import {produce_contracts} from '#/chain/contract';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Providers} from '#/store/providers';
	
	import {SecretNodes} from '#/store/web-apis';
	import {fold, F_NOOP, oderac, remove} from '#/util/belt';
	import {open_external_link} from '#/util/dom';
	import {format_amount} from '#/util/format';
	
	import RequestSignature from './RequestSignature.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Load from '../ui/Load.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	
	import SX_ICON_EXTERNAL from '#/icon/launch.svg?raw';
	

	const {
		g_chain,
		p_chain,
		p_account,
		k_page,
		g_app,
		g_cause,
		completed,
	} = load_app_context();

	export let bech32s: Bech32[] = [];

	let f_request_signature: null|VoidFunction = null;

	let g_account!: AccountStruct;

	let k_network!: SecretNetwork;

	let a_contracts: ContractStruct[] = [];

	const g_app_cover = g_cause?.['app'] || g_app;

	const dp_load = (async function load() {
		// init fields
		await Promise.all([
			produce_contracts(bech32s, g_chain, g_app_cover, g_account || $yw_account).then(a => a_contracts = a),
			Accounts.at(p_account).then(g => g_account = g!),
			Providers.activateStableDefaultFor<SecretNetwork>(g_chain).then(async(_k_network) => {
				k_network = _k_network;

				// do a quick test
				try {
					await Providers.quickTest(k_network.provider, g_chain);
				}
				catch(e_check) {
					throw syserr(e_check as Error);
				}
			}).catch((e_activate) => {
				syserr(e_activate as Error);
			}),
		]);

		// build messages
		void init_build();
	})();


	const h_msgs: Record<Bech32, Any> = {};

	let h_errors: Record<Bech32, string> = {};

	let b_disabled = true;

	async function init_build() {
		if(g_chain?.features.secretwasm) {
			// generate viewing key messages
			for(const g_contract of a_contracts) {
				// construct wasm message
				try {
					const g_exec = await Snip2xMessageConstructor.generate_viewing_key(g_account, g_contract, k_network);

					h_msgs[g_contract.bech32] = g_exec.proto;
				}
				catch(e_generate) {
					let s_error = 'Unknown error occurred while validating';

					// contract does not exist on chain
					if(e_generate instanceof Error) {
						const n_code = e_generate['code'] || NaN;
						const s_grpc_msg = e_generate['metadata']?.['headersMap']?.['grpc-message'] || '';

						if('not found' === s_grpc_msg || 2 === n_code) {
							s_error = `Contract does not exist on ${g_chain.reference}`;
						}
						else {
							s_error = `Provider said about contract: ${s_grpc_msg}`;
						}
					}
					// something else
					else {
						s_error = e_generate.message;
					}

					// add to nonexistant
					h_errors[g_contract.bech32] = s_error;

					// remove from adding
					remove(a_adding, g_contract.bech32);

					// reactively update lists
					h_errors = h_errors;
					a_adding = a_adding;

					// next contract
					continue;
				}
			}
		}

		// enable ui
		b_disabled = false;

		rebuild();
	}

	function rebuild() {
		// reset
		f_request_signature = null;

		// nothing checked
		if(!a_adding.length) return;

		// secretwasm
		if(g_chain?.features.secretwasm) {
			const a_msgs_proto = a_adding.map(sa => h_msgs[sa]);

			f_request_signature = () => {
				k_page.push({
					creator: RequestSignature,
					props: {
						protoMsgs: a_msgs_proto,
						fee: {
							// TODO: support non-secretwasm chains
							limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key) * BigInt(a_msgs_proto.length),
						},
						local: true,
						broadcast: true,
					},
					context: {
						completed,
					},
				});
			};
		}
		else {
			throw syserr(new Error('Chain not supported'));
		}
	}

	function reject() {
		b_disabled = true;
		completed(false);
	}

	function accept() {
		f_request_signature?.();
	}

	let b_tooltip_showing = false;

	const h_checked: Record<Bech32, boolean> = fold(bech32s, sa_contract => ({
		[sa_contract]: true,
	}));

	let a_adding = bech32s;
	function update_checked() {
		a_adding = oderac(h_checked, (sa_contract, b_checked) => b_checked? sa_contract: void 0) as Bech32[];
		rebuild();
	}

	$: s_token_plurality = 1 === a_adding.length? '': 's';
</script>

<style lang="less">
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}

		100% {
			transform: rotate(360deg);
		}
	}

	section {
		margin-top: 4em !important;
		display: flex;
		flex-direction: column;

		.loading {
			margin: 0 auto;
			width: 60%;

			img {
				width: 100%;
				animation: spin 3s linear infinite;
			}
		}

		p {
			margin-top: 4em;
			text-align: center;
		}
	}

	.contract-stats {
		font-size: 12px;
		color: var(--theme-color-graysoft);
		display: flex;
		gap: 6px;

		>*:not(:last-child) {
			padding-right: 6px;
			border-right: 1px solid var(--theme-color-border);
		}
	}

	.contract-error {
		font-size: 12px;
		color: var(--theme-color-caution);
	}
</style>

<Screen>
	{#if !g_account}
		<AppBanner app={g_app_cover} chains={[g_chain]} on:close={reject}>
			<span slot="default" style="display:contents;">
				Add {bech32s.length} Token{s_token_plurality}?
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:else}
		<AppBanner app={g_app_cover} chains={[g_chain]} account={g_account} on:close={reject}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					Add {a_adding.length} Token{s_token_plurality}?
				</span>
				<Tooltip bind:showing={b_tooltip_showing}>
					<p>
						The app is requesting you add the given token{s_token_plurality} to your wallet.
					</p>
					<p>
						This is optional, but the app might require the token{s_token_plurality} to continue.
					</p>
					<p>
						Adding the token{s_token_plurality} will not automatically grant the app viewing permissions.
					</p>
				</Tooltip>
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/if}

	{#await dp_load}
		<section>
			<div class="loading">
				<img src="/media/vendor/loading.svg" alt="Loading">
			</div>
		</section>
	{:then}
		<!-- <hr>

		<p>
			The app is suggesting to add the following token{s_token_plurality} to your wallet
		</p> -->
		
		<div class="rows no-margin">
			{#each a_contracts as g_contract}
				<!-- TODO: represent NFTs too? -->

				{#if g_contract.bech32 in h_errors}
					<Row resource={g_contract}
						name={g_contract.interfaces.snip20?.symbol || '??'}
						postname={g_contract.name}
						address={g_contract.bech32} copyable
					>
						<span slot="right" style="margin-left: 1.5em;">
							<CheckboxField id="add-${g_contract.bech32}" disabled checked={false} />
						</span>

						<span slot="below" class="contract-error">
							{h_errors[g_contract.bech32]}
						</span>
					</Row>
				{:else}
					<Row resource={g_contract}
						name={g_contract.interfaces.snip20?.symbol || '??'}
						postname={g_contract.name}
						address={g_contract.bech32} copyable
						on:click={toggleChildCheckbox}
					>
						<span slot="right" style="margin-left: 1.5em;">
							<CheckboxField id="add-${g_contract.bech32}"
								bind:checked={h_checked[g_contract.bech32]}
								on:change={update_checked}
								disabled={b_disabled}
							>
							</CheckboxField>
						</span>

						<span slot="below" class="contract-stats">
							<span class="global_svg-icon icon-diameter_18px link"
								on:click|stopPropagation={() => open_external_link(Chains.blockExplorer('contract', {
									address: g_contract.bech32,
								}, g_chain))}
							>
								{@html SX_ICON_EXTERNAL}
							</span>

							{#await SecretNodes.contractStats(g_chain, g_contract)}
								<span>
									<Load forever />
								</span>
								<span>
									<Load forever />
								</span>
								<span>
									<Load forever />
								</span>
							{:then g_stats}
								{@const x_locked = +g_stats.value_locked / 1e6}
								{@const n_txs = +g_stats.txs_count}
								{@const n_accs = +g_stats.accounts_count}
								<span class:color_caution={x_locked < 10e3 && (n_txs < 5e3 || n_accs < 1e3)}>
									{format_amount(x_locked, true)} SCRT locked
								</span>
								<span class:color_caution={x_locked < 10e3 && n_txs < 3e3}>
									{format_amount(n_txs, true)} txs
								</span>
								<span class:color_caution={x_locked < 10e3? n_accs < 100: n_accs < 1e3}>
									{format_amount(n_accs, true)} accs
								</span>
							{/await}
						</span>
					</Row>
				{/if}
			{/each}
		</div>
	{/await}


	<ActionsLine deny cancel={reject} confirm={['Accept', accept, !f_request_signature]} disabled={b_disabled} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
