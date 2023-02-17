<script lang="ts" context="module">
	export enum AssetType {
		NONE = 0,
		COIN = 1,
		TOKEN = 2,
	}
</script>

<script lang="ts">
	import type {Dict} from '#/meta/belt';
	import type {EntityPath, CoinInfo, ContractPath, HoldingPath, ContractStruct} from '#/meta/chain';
	
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import type {Snip2x} from '#/schema/snip-2x-def';
	
	import BigNumber from 'bignumber.js';
	
	import {yw_account, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {XT_MINUTES, XT_SECONDS} from '#/share/constants';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {QueryCache} from '#/store/query-cache';
	import {CoinGecko} from '#/store/web-apis';
	import {microtask} from '#/util/belt';
	import {format_amount} from '#/util/format';
	
	import NumericInput from './NumericInput.svelte';


	const YG_ZERO = new BigNumber(0);
	const YG_ONE = new BigNumber(1);

	/**
	 * Binding for the amount value string
	 */
	export let value = '';

	/**
	 * Disables the input
	 */
	export let disabled = false;

	/**
	 * Resource path to either the native holding or contract
	 */
	export let assetPath: HoldingPath | ContractPath | '' = '';

	/**
	 * Amount to leave as buffer between max and balance
	 */
	export let feeBuffers: Dict<BigNumber | number> = {};

	/**
	 * Flag to use the maximum possible amount
	 */
	export let useMax = false;

	/**
	 * Asset type
	 */
	export let assetType: AssetType = AssetType.NONE;

	/**
	 * Asset symbol
	 */
	export let symbol = '';

	/**
	 * Validation error text
	 */
	export let error = '';

	/**
	 * Expose decimal as binding
	 */
	export let decimals = -1;

	// native coin info
	export let coin: CoinInfo | null = null;

	// contract struct
	export let contract: ContractStruct | null = null;

	// asset balance in lowest denomination
	let yg_balance: BigNumber | null = null;


	// reactively assign asset balance in human-readable denomination, or indicate loading state
	$: s_balance = yg_balance && decimals >= 0
		? yg_balance.shiftedBy(-decimals).toString()
		: '[...]';

	// the step amount used for increment/decrement UI
	$: yg_step = decimals >= 0? YG_ONE.shiftedBy(-decimals): YG_ZERO;

	// approx amount of fee padding to leave when using max
	let yg_fee_buffer_approx = YG_ZERO;

	// the maximum amount allowed for selected asset
	$: yg_max = assetType && yg_balance && decimals >= 0
		? AssetType.COIN === assetType
			? BigNumber.max(0, yg_balance.shiftedBy(-decimals).minus(yg_fee_buffer_approx) as BigNumber)
			: yg_balance.shiftedBy(-decimals)
		: YG_ZERO;

	// coingecko id
	let si_coingecko = '';

	// fiat display string
	let s_fiat_equivalent = '';

	// when value reaches max, trigger the useMax flag
	$: useMax = yg_balance? BigNumber(value).eq(yg_max as BigNumber): false;

	// user clicked to use max; simply set value from defined maximum
	const use_max = () => value = yg_max?.toString() || '0';
	
	// reload asset when parent changes certain properties
	$: if(assetPath && feeBuffers) {
		void reload_asset();
	}

	// reactively update fiat string based on coingecko id
	$: {
		if(si_coingecko) {
			(async() => {
				// fetch fiat worth from coingecko with 1 minute resolution
				const h_versus = await CoinGecko.coinsVersus([si_coingecko], 'usd', 1*XT_MINUTES);

				// asset worth was found
				if(si_coingecko in h_versus) {
					const x_value = +value;

					// sub-penny amount
					if(x_value > 0 && x_value < 0.01) {
						s_fiat_equivalent = `< 0.01`;
					}
					else {
						// TODO: consider replacing with `format_fiat`
						s_fiat_equivalent = format_amount(x_value * +h_versus[si_coingecko], true);
					}
				}
				else {
					s_fiat_equivalent = '(?)';
				}
			})();
		}
		else {
			s_fiat_equivalent = '';
		}
	}

	async function reload_asset() {
		// reset asset properties
		{
			coin = contract = null;

			// reset asset type
			assetType = AssetType.NONE;

			// reset amount
			value = '';

			// clear balance
			yg_balance = null;

			// put fiat string into loading state
			s_fiat_equivalent = '[...]';

			// reset properties
			decimals = -1;
			symbol = '';
			si_coingecko = '';

			// reset fee buffer
			yg_fee_buffer_approx = YG_ZERO;
		}

		// no asset; bail
		if(!assetPath) return;

		// parse entity path
		const g_parsed = Entities.parseEntityPath(assetPath as EntityPath);

		// no entity; bail
		if(!g_parsed) return;

		// silly workaround for svelte reactivity
		await microtask();

		// ref entity type
		const s_entity_type = g_parsed.type;

		// native coin
		if('holding' === s_entity_type) {
			// set asset type
			assetType = AssetType.COIN;

			// extract coin id from parsed holding path
			const si_coin = g_parsed.coin;

			// update fields
			{
				// lookup coin info
				coin = $yw_chain.coins[si_coin];

				// silly workaround for svelte reactive update
				decimals = coin.decimals;
				symbol = si_coin;
				si_coingecko = coin.extra?.coingeckoId || '';

				// set fee buffer
				yg_fee_buffer_approx = BigNumber(feeBuffers[si_coin] || 0);
			}

			// attempt to access cached balance
			const g_cached = $yw_network.cachedCoinBalance($yw_owner, si_coin);

			// cached balance is available
			if(g_cached) {
				// age of cache
				const xt_age = Date.now() - g_cached.timestamp;

				// cache is less than 5 minutes old
				if(xt_age < 5 * XT_MINUTES) {
					// parse balance from cache and use as balance while loading from network
					yg_balance = BigNumber(g_cached.data.amount);
				}
			}

			// reload balance; use cache if it is less than 30 seconds old
			const g_bundle = await $yw_network.bankBalance($yw_owner, si_coin, 30 * XT_SECONDS);

			// still on same coin after async balance respone
			if(assetPath === g_bundle.holding) {
				// parse amount
				const yg_amount = BigNumber(g_bundle.balance.amount);

				// update balance if it is different
				if(!yg_balance?.eq(yg_amount)) yg_balance = yg_amount;
			}
		}
		// token
		else if('contract' === s_entity_type) {
			// set asset type
			assetType = AssetType.TOKEN;

			// load contract from store
			contract = await Contracts.at(assetPath as ContractPath);

			// contract is defined
			if(contract) {
				// load persistent query cache store
				const ks_cache = await QueryCache.read();

				// lookup balance cache for this contract
				const g_cached = ks_cache.get($yw_chain_ref, $yw_owner, `${contract.bech32}:balance`);

				// assume balance needs to reload
				let b_reload_balance = true;

				// cache exists
				if(g_cached) {
					// age of cache
					const xt_age = Date.now() - g_cached.timestamp;

					// cache is less than 5 minutes old
					if(xt_age < 5 * XT_MINUTES) {
						// parse balance from cache and use as balance and max while loading from network
						yg_balance = BigNumber(g_cached.data.amount as string);

						// cache is less than 30 seconds old; cache is OK
						if(xt_age <= 30 * XT_MINUTES) {
							b_reload_balance = false;
						}
					}
				}

				// on secret chain
				if($yw_chain.features.secretwasm) {
					// prepare token instance
					const k_token = new Snip2xToken(contract, $yw_network as SecretNetwork, $yw_account);
	
					// get the latest balance
					if(b_reload_balance) {
						let g_balance: Snip2x.AnyQueryResponse<'balance'>;
						try {
							g_balance = await k_token.balance();

							// balance exists
							if(g_balance) {
								// parse amount and set as max
								yg_balance = BigNumber(g_balance.balance.amount);
							}
						}
						catch(e_balance) {
							// ignore
						}
					}

					// ref snip-20 metadata
					const g_snip20 = contract.interfaces.snip20!;

					// update fields
					{
						// set properties
						decimals = g_snip20.decimals;
						symbol = g_snip20.symbol;
						si_coingecko = g_snip20.extra?.coingeckoId || '';
					}
				}
			}
		}
	}

	// check input validity, forwarding errors to binding
	function check_validity(d_event: CustomEvent<{yg_input:BigNumber}>) {
		const {yg_input} = d_event.detail;

		// amount is negative
		if(yg_input.lt(YG_ZERO)) {
			return error = 'Value must be positive';
		}
		// amount exceeds balance
		else if(yg_input.gt(yg_max as BigNumber)) {
			return error = 'Insufficient balance';
		}
	}
</script>

<style lang="less">
	@import '../_base.less';

	input[type="number"] {
		appearance: textfield;

		&::-webkit-inner-spin-button, &::-webkit-outer-spin-button {
			-webkit-appearance: none;
		}
	}

	.amount-input {
		position: relative;
	}

	.equivalent {
		.font(regular, @size: 13px, @weight: 300);

		.amount {
			color: var(--theme-color-text-med);
		}

		.fiat {
			color: var(--theme-color-text-med);
		}
	}

	.balance-line {
		.font(tiny, @size: 12px, @weight: 300);
		display: flex;
		justify-content: space-between;
		margin-top: 6px;

		>.balance {
			>.label {
				color: var(--theme-color-text-med);
			}

			>.amount {
				color: var(--theme-color-text-light);
			}
		}
	}
</style>


<NumericInput required
	disabled={!assetPath || !yg_balance || disabled}
	min=0
	max={yg_max.toString() || '0'}
	decimals={decimals}
	bind:value={value}
	bind:error={error}
	on:check={check_validity}
>
	<svelte:fragment slot="feed">
		<span class="equivalent">
			<span class="amount">
				= {s_fiat_equivalent}
			</span>
			<span class="fiat">
				USD
			</span>
		</span>
	</svelte:fragment>
</NumericInput>

<span class="balance-line">
	{#if assetPath}
		<span class="balance">
			<span class="label">
				Balance
			</span>
			<span class="amount">
				{s_balance} {symbol}
			</span>
		</span>

		<span class="use-max">
			<span class="link" class:disabled={useMax} on:click={() => use_max()}>
				USE MAX
			</span>
		</span>
	{/if}
</span>
