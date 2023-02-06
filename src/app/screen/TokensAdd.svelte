<script lang="ts">
	import type {ContractStruct, FeeConfig} from '#/meta/chain';

	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import Fuse from 'fuse.js';
	
	import {Screen} from './_screens';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_navigator, yw_network} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Secrets} from '#/store/secrets';
	import {deduplicate} from '#/util/belt';
	
	import RequestSignature, {type CompletedSignature} from './RequestSignature.svelte';
	import TokenManualAdd from './TokenManualAdd.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	import Header from '../ui/Header.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	

	const {
		k_page,
	} = load_page_context();
	
	/**
	 * Adds the given contracts to the suggestions and automatically stages them
	 */
	export let suggested: ContractStruct[] = [];

	let a_tokens_inaccessible: ContractStruct[] = [...suggested];
	let a_filtered: ContractStruct[] = [];

	let s_filter = '';

	let y_fuse: Fuse<ContractStruct>;

	(async() => {
		// create list of all accessible tokens
		const a_accessible = (await Secrets.filter({
			type: 'viewing_key',
			on: 1,
			owner: Chains.addressFor($yw_account.pubkey, $yw_chain),
			chain: $yw_chain_ref,
		})).map(g => g.contract);

		const a_tokens_known = await Contracts.filterTokens({
			chain: $yw_chain_ref,
			interfaces: {
				snip20: {},
			},
		});

		// const a_tokens_registry = Object.values(H_CONTRACT_REGSTRY)
		// 	.filter(g_token => -1 === a_tokens_known.findIndex(g => g.bech32 === g_token.bech32));

		// subtract accessible tokens from list of all tokens for this chain
		a_tokens_inaccessible = deduplicate(a_tokens_inaccessible.concat(a_tokens_known), 'bech32')
			.filter(g => !a_accessible.includes(g.bech32));

		a_filtered = a_tokens_inaccessible;
	
		// update search
		y_fuse = new Fuse(a_tokens_inaccessible, {
			keys: [
				'name',
				'interfaces.snip20.symbol',
				'bech32',
			],
		});
	})();

	$: {
		if(s_filter && y_fuse) {
			a_filtered = y_fuse.search(s_filter).map(g => g.item);
			console.log(a_filtered);
		}
		else {
			a_filtered = a_tokens_inaccessible;
		}
	}

	let a_staged: ContractStruct[] = [...suggested];
	function toggle(g_token: ContractStruct) {
		const i_staged = a_staged.indexOf(g_token);

		if(i_staged >= 0) {
			a_staged.splice(i_staged, 1);
			a_staged = a_staged;
		}
		else {
			a_staged = a_staged.concat(g_token);
		}
	}

	// disable button once submission has started
	let b_submitting = false;

	async function submit_tokens() {
		b_submitting = true;

		const g_chain = $yw_chain;
		const p_account = $yw_account_ref;
		const g_account = $yw_account;

		// generate viewing key messages
		const a_msgs_proto = await Promise.all(a_staged.map(async(g_token) => {
			// construct wasm message
			const g_exec = await Snip2xMessageConstructor.generate_viewing_key(g_account, g_token, $yw_network as SecretNetwork);

			// as proto
			return g_exec.proto;
		}));

		// prep proto fee
		const gc_fee: FeeConfig = {
			limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key) * BigInt(a_msgs_proto.length),
		};

		// prompt user for signature
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
				accountPath: p_account,
				app: G_APP_STARSHELL,
				async completed(b_answer: boolean, g_completed: CompletedSignature) {
					// approved
					if(b_answer) {
						// ensure each token is enabled
						await Contracts.open(async(ks_contracts) => {
							for(const g_contract of a_staged) {
								g_contract.on = 1;
								await ks_contracts.merge(g_contract);
							}
						});
					}

					$yw_navigator.activePage.reset();
				},
			},
		});

		// reset
		b_submitting = false;
	}
	
</script>

<style lang="less">
	.filter {
		padding: var(--ui-padding);
		position: relative;

		.input {
			position: relative;

			.global_svg-icon {
				position: absolute;
				right: 0;
				top: 0;
				margin-top: -5px;
				box-sizing: border-box;
				margin-right: 16px;
				border: 1px solid var(--theme-color-graysoft);
				border-radius: 8px;
				padding: 5px 8px;
				--icon-diameter: 18px;
				cursor: pointer;
			}
		}
	}

	.staging {
		height: 90px;
		overflow-y: scroll;
		display: flex;
		flex-flow: row wrap;
		padding: 0 var(--ui-padding);
		padding-bottom: 5px;
		justify-content: flex-start;
		align-content: start;
		position: sticky;
		z-index: 1;
		top: 0px;
		border-bottom: 1px solid var(--theme-color-border);
		background-color: var(--theme-color-bg);

		// leave some padding above the items when sticky'ing to the top
		padding-top: 8px;

		// offset the extra padding when not sticky'ing
		margin-top: -8px;

		.bubble {
			border: 1px solid var(--theme-color-border);
			border-radius: 20px;
			padding: 3px 8px;
			margin: 3px;
			height: fit-content;

			.symbol {

			}

			.remove {
				--icon-diameter: 16px;
				--svg-color-fg: var(--theme-color-primary);
				cursor: pointer;
			}
		}
	}

	.rows {
		overflow-y: scroll;
		margin-top: -1px;
		margin-bottom: -1px;
		
		.global_add-remove {
			cursor: pointer;

			:global(&) {
				--svg-color-fg: var(--theme-color-primary);
				transition: 1s transform var(--ease-out-quick);
			}

			&.staged {
				:global(&) {
					transform: rotate(45deg) scale(1.25);
					--svg-color-fg: var(--theme-color-caution);
				}
			}
		}
	}

	.actions-custom {
		position: sticky;
		width: 100%;
		bottom: -1px;
		display: flex;
		background-color: var(--theme-color-bg);
		border-top: 1px solid var(--theme-color-border);

		button {
			flex: auto;
			margin: var(--ui-padding);
		}
	}

	.empty-state {
		font-size: 13px;
		margin-left: auto;
		margin-right: auto;
		margin-top: 2.5em;
	}
</style>

<Screen>
	<Header title='Add Tokens' pops>
		<span slot="right">
			<button class="pill" on:click={() => {
				k_page.push({
					creator: TokenManualAdd,
					props: {
						staged: a_staged,
					},
				});
			}}>
				Add Manually
			</button>
		</span>
	</Header>

	<div class="no-margin">
		<div class="filter">
			<span class="input">
				<input type="text"
					placeholder="Filter by name, ticker, or address"
					bind:value={s_filter}
				>
				{#if s_filter}
					<span class="global_svg-icon" on:click={() => s_filter = ''}>
						{@html SX_ICON_CLOSE}
					</span>
				{/if}
			</span>
		</div>

		<div class="staging">
			{#if a_staged.length}
				{#each a_staged as g_token (g_token.bech32)}
					<span class="bubble">
						<PfpDisplay path={g_token.pfp} resource={g_token} dim={16} />
						<span class="symbol">
							{g_token.interfaces.snip20.symbol}
						</span>
						<span class="global_svg-icon remove" on:click={() => toggle(g_token)}>
							{@html SX_ICON_CLOSE}
						</span>
					</span>
				{/each}
			{:else}
				<div class="empty-state color_text-med">
					No tokens added yet
				</div>
			{/if}
		</div>

		<div class="rows">
			{#each a_filtered as g_token (g_token.bech32)}
				<Row resource={g_token} postname={g_token.interfaces.snip20.symbol} postnameDelimiter='-'
					on:click={() => toggle(g_token)}
					rootStyle={`
						transition: 100ms opacity linear;
						${a_staged.includes(g_token)? `
							opacity: 0.4;
							text-decoration: line-through;
						`: `
							opacity: 1;
						`};
					`}
				>
					<span class="global_svg-icon global_add-remove"
						class:staged={a_staged.includes(g_token)}
						slot="right"
					>
						{@html SX_ICON_ADD}
					</span>
				</Row>
			{/each}
		</div>

		<div class="actions-custom">
			<button class="primary" disabled={!a_staged.length || b_submitting} on:click={() => submit_tokens()}>
				Add Selected Tokens
			</button>
		</div>
	</div>
</Screen>
