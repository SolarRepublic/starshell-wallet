<script lang="ts">
	import type {Dict, JsonArray, JsonObject, JsonValue, Promisable} from '#/meta/belt';
	import type {ChainStruct, ContractStruct} from '#/meta/chain';
	
	import {query_snip, type Snip2xQueryRes} from '#/schema/snip-2x-const';
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {yw_account, yw_chain, yw_network} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {fold, forever, ode} from '#/util/belt';
	
	import Fields from '../ui/Fields.svelte';
	import Header from '../ui/Header.svelte';
	import { uuid_v4 } from '#/util/data';
	import { Chains } from '#/store/chains';
	import Load from '../ui/Load.svelte';
	
	

	export let g_contract: ContractStruct;

	export let g_chain: ChainStruct;

	const {
		k_page,
	} = load_page_context();

	let s_balance_amount = '';

	let h_queries: Dict<{
		params: {};
		response: null | Promise<JsonValue>;
	}> = {};

	const s_header_title = 'Contract';
	let s_header_post_title = '';
	let s_header_subtitle = '';
	const s_main_title: Promisable<string> = forever('');
	const s_main_post_title = '';
	const s_main_subtitle: Promisable<string> = forever('');

	// let a_transfers: Awaited<Snip2xQueryRes<'transfer_history'>>['transfer_history']['txs'] = [];
	let a_transfers: Promisable<JsonArray> = forever([]);

	async function queries() {
		const si_foreign = `__query_probe_${uuid_v4().replaceAll('-', '_').slice(-7)}`;

		// attempt transaction history query
		try {
			// @ts-expect-error intentionally foreign query id
			await query_snip({
				[si_foreign]: {},
			}, {
				bech32: sa_contract,
			}, $yw_network, g_chain, $yw_account);
		}
		catch(e_info) {
			if(e_info instanceof Error) {
				const m_queries = /unknown variant `([^`]+)`, expected one of ([^"\n]+)["\n]/.exec(e_info.message);
				if(m_queries) {
					if(si_foreign !== m_queries[1]) {
						throw new Error(`Contract returned suspicious error`);
					}

					// get accepted query ids
					return m_queries[2].split(/,\s+/g).map(s => s.replace(/^`|`$/g, ''));
				}
			}
		}

		return null;
	}

	// (async function load() {
	// 	h_queries = await queries() || [];

	// 	// on secret wasm chain
	// 	if(g_chain.features.secretwasm) {
	// 		const g_disc = await Snip2xToken.discover(g_contract, $yw_network as SecretNetwork, $yw_account);
	// 		// debugger;
	// 		console.log({g_disc});

	// 		// contract implements snip-20
	// 		const k_token = Snip2xToken.from(g_contract, $yw_network as SecretNetwork, $yw_account);
	// 		if(k_token) {
	// 			s_header_post_title = 'SNIP-20';
	// 			s_header_subtitle = `${g_contract.name} token`;

	// 			s_balance_amount = (await k_token.balance()).balance.amount;

	// 			if(k_token.snip21) {
	// 				a_transfers = (await k_token.transactionHistory()).transaction_history.txs;
	// 			}
	// 			else if(k_token.snip20) {
	// 				a_transfers = (await k_token.transferHistory()).transfer_history.txs;
	// 			}
	// 		}
	// 	}
	// })();


	export let s_input = '';
	let sa_contract = '';

	$: if(Chains.isValidAddressFor($yw_chain, s_input) && s_input !== sa_contract) {
		sa_contract = s_input;
		(async() => {
			h_queries = {};

			const a_queries = await queries() || [];

			h_queries = fold(a_queries, s_query => ({
				[s_query]: {
					params: {},
					response: null,
				},
			}));
		})();
	}

	async function query_probe(s_query: string) {
		// attempt
		try {
			// @ts-expect-error intentionally foreign query id
			const dp_response = query_snip({
				[s_query]: {},
			}, {
				bech32: sa_contract,
			}, $yw_network, g_chain, $yw_account);

			h_queries[s_query].response = dp_response;
			h_queries = h_queries;

			const g_response = await dp_response;

			console.log(g_response);
		}
		catch(e_info) {
			if(e_info instanceof Error) {
				const m_error = /attempting query: ([^\n]+)/.exec(e_info.message);
				if(m_error) {
					try {
						const g_error = JSON.parse(m_error[1]);

						const g_parse_err = g_error.parse_err;
						if(g_parse_err) {
							if('string' === typeof g_parse_err.msg) {
								const m_field = /missing field `([^`]+)`/.exec(g_parse_err.msg as string);
								if(m_field) {
									debugger;
									m_field[1];
								}
							}
						}
					}
					catch(e_parse) {

					}
				}

				const m_field = /missing field `([^`]+)`/.exec(e_info.message as string);
				if(m_field) {
					debugger;
					m_field[1];
				}

				debugger;
				console.warn(e_info);
			}
		}
	}

</script>

<style lang="less">
	@import '../_base.less';

	.queries {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.query {
		padding: 4px 8px;
		border: 1px solid var(--theme-color-border);
		border-radius: 4px;

		>.query-key {
			.font-variant(mono-small);
			cursor: pointer;
		}
	}
</style>

<Screen nav>
	<Header pops account
		title={s_header_title}
		postTitle={s_header_post_title}
		subtitle={s_header_subtitle}
	/>
	
	<h3>
		Contract Inspector
	</h3>

	<input type="text" bind:value={s_input}>

	<div class="queries">
		{#each ode(h_queries) as [s_query, g_query]}
			<div class="query">
				<div class="key" on:click={() => query_probe(s_query)}>
					{s_query}
				</div>

				{#if g_query.response}
					<div class="response">
						{#await g_query.response}
							<Load forever />
						{:then g_response}
							<Fields configs={[
								JsonPreviewer.render(g_response, {
									chain: $yw_chain,
								}, {
									title: 'Response',
								}),
							]} />
						{/await}
					</div>
				{/if}
			</div>
		{/each}
<!-- 
		<Fields configs={[
			JsonPreviewer.render(a_queries, {
				chain: g_chain,
			}, {
				title: 'Queries',
			}),

			// {
			// 	type: 'key_value',
			// 	key: 'Balance',
			// 	value: s_balance_amount,
			// },
			// JsonPreviewer.render(a_transfers, {
			// 	chain: g_chain,
			// }, {
			// 	title: 'Transfers',
			// }),
		]} /> -->
	</div>
</Screen>
