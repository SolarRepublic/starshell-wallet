<script context="module" lang="ts">
	export type SelectOption<
		si_value extends string=string,
		g_extra extends JsonObject={},
	> = Merge<{
		value: si_value;
		primary?: string;
		secondary?: string;
		object?: Nameable & Pfpable;
		pfp?: PfpTarget;
	}, g_extra>;
</script>

<script lang="ts">
	import type {Merge} from 'ts-toolbelt/out/Object/Merge';
	
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Dict, JsonObject} from '#/meta/belt';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {onMount} from 'svelte';
	import Select from 'svelte-select';
	
	import StarSelectItem from './StarSelectItem.svelte';
	
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';
	

	export let id = '';
	export let placeholder = '';
	export let listOffset = 1;
	export let clearable = false;
	export let showChevron = true;
	export let items: unknown[];
	export let value: unknown = void 0;

	export let searchable = true;

	export let disabled = false;

	export let pfpMap: Dict<HTMLElement> | null = null;
	const h_pfps = pfpMap;

	export let primaryClass = '';
	export let secondaryClass = '';

	export let containerClasses = '';

	let dm_star_select: HTMLElement;
	let sx_max_height = '500px';
	onMount(() => {
		setTimeout(() => {
			try {
				const x_bottom = dm_star_select.getBoundingClientRect().bottom;
				const xl_height = dm_star_select.closest('.screen')!.getBoundingClientRect().height;
				sx_max_height = Math.max(100, Math.min(xl_height - x_bottom - 20, 500))+'px';
			}
			catch(e_bounds) {}
		}, 1000);
	});

	// function filter({
	// 	loadOptions,
	// 	filterText,
	// 	items,
	// 	multiple,
	// 	value,
	// 	itemId,
	// 	groupBy,
	// 	filterSelectedItems,
	// 	itemFilter,
	// 	convertStringItemsToObjects,
	// 	filterGroupedItems,
	// 	label,
	// }) {
	// 	if(items && loadOptions) return items;
	// 	if(!items) return [];

	// 	if(items && items.length > 0 && typeof items[0] !== 'object') {
	// 		items = convertStringItemsToObjects(items);
	// 	}

	// 	let filterResults = items.filter((item) => {
	// 		let matchesFilter = itemFilter(item[label], filterText, item);
	// 		if(matchesFilter && multiple && value?.length) {
	// 			matchesFilter = !value.some(x => filterSelectedItems ? x[itemId] === item[itemId] : false);
	// 		}

	// 		return matchesFilter;
	// 	});

	// 	if(groupBy) {
	// 		filterResults = filterGroupedItems(filterResults);
	// 	}

	// 	return filterResults;
	// }

	const f_item_filter = (_s_label: unknown, s_filter: string, g_option: {
		value: string;
		primary?: string;
		secondary?: string;
	}) => `${g_option.value} ${g_option.primary || ''} ${g_option.secondary || ''}`.toLowerCase().includes(s_filter.toLowerCase());
</script>

<style lang="less">
	@import '../_base.less';

	.global_select-item {
		>.global_pfp {
			:global(&) {
				padding-right: 0.75ch;
				margin-top: -0.25em;
			}
		}
	}

	.star-select {
		position: relative;
		.style-svelte-select();
		.font(regular);

		>input {

			&::after {
				content: '';
				position: absolute;
				right: 0;
			}
		}

		>.icon {
			--icon-diameter: 24px;
			--icon-color: var(--theme-color-primary);
			position: absolute;
			top: 0;
			right: 0;
			padding: 12px;
			cursor: pointer;
		}

		.secondary {
			:global(&) {
				color: var(--theme-color-text-med);
			}

			:global(&::before) {
				content: ' - ';
				color: var(--theme-color-text-med);
			}
		}
	}
</style>

<div class="star-select {containerClasses}" bind:this={dm_star_select}>
	<Select
		{disabled}
		{clearable}
		{placeholder}
		{listOffset}
		{showChevron}
		{searchable}
		listPlacement='bottom'
		items={items}
		bind:value={value}
		--list-max-meight={sx_max_height}
		itemFilter={f_item_filter}
		on:select
		on:clear
	>
		<div slot="chevron-icon">
			{@html SX_ICON_DROPDOWN}
		</div>

		<div slot="item" let:item={g_item}>
			<StarSelectItem
				{h_pfps}
				{g_item}
				s_class_primary={primaryClass}
				s_class_secondary={secondaryClass}
			/>
		</div>

		<div slot="selection" let:selection={g_item}>
			<StarSelectItem
				{h_pfps}
				{g_item}
				s_class_primary={primaryClass}
				s_class_secondary={secondaryClass}
			/>
		</div>
	</Select>
</div>