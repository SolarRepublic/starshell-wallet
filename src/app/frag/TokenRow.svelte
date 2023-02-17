<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ContractStruct, FeeConfig} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {Snip20} from '#/schema/snip-20-def';
	
	import BigNumber from 'bignumber.js';
	
	import {createEventDispatcher, onDestroy, onMount} from 'svelte';
	
	import {yw_account, yw_account_ref, yw_chain, yw_network, yw_owner} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {amino_to_base} from '#/chain/cosmos-msgs';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Contracts} from '#/store/contracts';
	import {forever} from '#/util/belt';
	
	import ContractView from '../screen/ContractView.svelte';
	import RequestSignature from '../screen/RequestSignature.svelte';
	import ViewingKeyInfo from '../screen/ViewingKeyInfo.svelte';
	import Row from '../ui/Row.svelte';
	

	const {
		k_page,
	} = load_page_context();

	export let contract: ContractStruct;

	$: g_snip20 = contract.interfaces.snip20!;

	const p_contract = Contracts.pathFrom(contract);

	const dispatch = createEventDispatcher();

	export let balance: {
		b_from_cache?: boolean;
		s_amount: string;
		s_fiat: Promisable<string>;
		s_worth: Promisable<string>;
	} | true | null = null;

	export let unauthorized = false;

	export let mintable = false;

	export let pending = false;

	export let error = '';

	/**
	 * Enables drag-and-drop reordering
	 */
	export let b_draggable = false;

	export let d_intersection: IntersectionObserver | null = null;

	let dm_row: HTMLElement;

	export let s_debug = '';

	onMount(() => {
		if(d_intersection) {
			d_intersection.observe(dm_row.children[0]);
		}
	});

	onDestroy(() => {
		if(d_intersection) {
			d_intersection.unobserve(dm_row.children[0]);
		}
	});

	$: w_amount = balance? balance?.s_amount || forever(''): '';

	const g_fields = balance?.s_fiat? {fiat:balance.s_fiat}: {};

	function click_row() {
		k_page.push({
			creator: ContractView,
			props: {
				contractPath: p_contract,
			},
		});
	}

	function authorize_token() {
		if($yw_chain.features.secretwasm) {
			k_page.push({
				creator: ViewingKeyInfo,
				props: {
					suggested: [contract],
				},
			});
		}
	}

	async function mint_token() {
		if($yw_chain.features.secretwasm) {
			// ref chain
			const g_chain = $yw_chain;

			// mint message
			const g_msg: Snip20.MintableMessageParameters<'mint'> = {
				mint: {
					amount: BigNumber(1000).shiftedBy(g_snip20.decimals as number).toString() as Cw.Uint128,
					recipient: $yw_owner as Cw.Bech32,
				},
			};

			// prep snip-20 exec
			const g_exec = await $yw_network.encodeExecuteContract($yw_account, contract.bech32, g_msg, contract.hash);

			// convert to proto messages for signing
			const a_msgs_proto = [amino_to_base(g_exec.amino).encode()];

			// prep proto fee
			const gc_fee: FeeConfig = {
				limit: BigInt($yw_chain.features.secretwasm!.snip20GasLimits.set_viewing_key),
			};

			k_page.push({
				creator: RequestSignature,
				props: {
					protoMsgs: a_msgs_proto,
					fee: gc_fee,
					broadcast: {},
					local: true,
				},
				context: {
					chain: g_chain,
					accountPath: $yw_account_ref,
					app: G_APP_STARSHELL,
				},
			});
		}
	}
</script>

<div class="display_contents" bind:this={dm_row} data-contract-path={p_contract}>
	{#if unauthorized || mintable || pending}
		<Row postnameTags b_draggable on:dropRow
			name={g_snip20.symbol}
			resourcePath={p_contract}
			detail={contract.name}
			pfp={contract.pfp}
			on:click={click_row}
		>
			<svelte:fragment slot="right">
				<slot name="right">
					{#if unauthorized}
						<button class="pill" on:click|stopPropagation={() => authorize_token()}>
							Authorize
						</button>
					{:else if mintable}
						<button class="pill" on:click|stopPropagation={() => mint_token()}>
							Mint
						</button>
					{:else if pending}
						<button class="pill" disabled>
							Pending
						</button>
					{/if}
				</slot>
			</svelte:fragment>
		</Row>
	{:else if error}
		<Row postnameTags b_draggable on:dropRow
			name={g_snip20.symbol}
			resourcePath={p_contract}
			detail={contract.name}
			pfp={contract.pfp}
			on:click={click_row}
		>
			<svelte:fragment slot="right">
				<slot name="right">
					<button class="pill caution" on:click|stopPropagation={() => dispatch('click_error')}>
						{error}
					</button>
				</slot>
			</svelte:fragment>
		</Row>
	{:else}
		<Row postnameTags b_draggable on:dropRow
			b_amount_updating={balance?.b_from_cache || false}
			name={g_snip20.symbol}
			resourcePath={p_contract}
			detail={contract.name}
			pfp={contract.pfp}
			amount={w_amount}
			{...g_fields}
			on:click={click_row}
		>
			<svelte:fragment slot="right">
				<slot name="right" />
			</svelte:fragment>
		</Row>
	{/if}
</div>
