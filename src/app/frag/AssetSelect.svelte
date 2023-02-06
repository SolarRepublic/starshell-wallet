<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {ContractPath, EntityPath, HoldingPath} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';
	
	import type {Resource} from '#/meta/resource';
	
	import {load_pfps} from '../svelte';
	
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	
	import {ode} from '#/util/belt';
	import {yw_chain, yw_chain_ref, yw_owner} from '##/mem';
	
	import Load from '../ui/Load.svelte';
	import StarSelect, {type SelectOption} from '../ui/StarSelect.svelte';


	export let assetPath: HoldingPath | ContractPath | '' = '';

	let h_asset_pfps = {} as Record<PfpTarget, HTMLElement>;

	async function load_assets() {
		const a_items: SelectOption[] = [];

		const h_pfps: Record<Resource.Path, Nameable & Pfpable> = {
			...$yw_chain.coins,
		};

		// load native coins
		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			a_items.push({
				value: Entities.holdingPathFor($yw_owner, si_coin),
				object: g_coin,
				primary: si_coin,
				secondary: g_coin.name,
				pfp: g_coin.pfp,
			});
		}

		// load tokens
		if($yw_chain.features.secretwasm) {
			// on secret-wasm; load snip-20s
			for(const g_contract of await Contracts.filterTokens({
				on: 1,
				chain: $yw_chain_ref,
				interfaces: {
					snip20: {},
				},
			})) {
				// ref snip-20 struct
				const g_snip20 = g_contract.interfaces.snip20!;

				// contract path
				const p_contract = Contracts.pathFrom(g_contract);

				h_pfps[p_contract] = g_contract;

				a_items.push({
					value: p_contract,
					object: g_contract,
					primary: g_snip20.symbol,
					secondary: g_contract.name,
					pfp: g_contract.pfp,
				});
			}
		}

		h_asset_pfps = await load_pfps(h_pfps, {
			dim: 19,
		});

		return a_items;
	}

	// the current item selected by user
	let g_item: SelectOption<EntityPath> = {
		value: assetPath as EntityPath,
		object: null!,
		primary: '',
		secondary: '',
		pfp: '' as PfpTarget,
	};
	$: {
		// propagate change back to exported binding
		assetPath = g_item?.value || '';
	}
</script>

<style lang="less">
</style>

<div class="asset">
	{#await load_assets()}
		<Load forever />
	{:then a_assets}
		<StarSelect id="asset-select"
			pfpMap={h_asset_pfps}
			placeholder="Select asset"
			items={a_assets}
			bind:value={g_item}
		/>
	{/await}
</div>