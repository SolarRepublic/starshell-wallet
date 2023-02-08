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
	
	import {dd} from '#/util/dom';
	
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';
	

	export let id = '';
	export let placeholder = '';
	export let listOffset = 1;
	export let isClearable = false;
	export let showIndicator = true;
	export let items: unknown[];
	export let value: unknown = void 0;

	export let disabled = false;

	export let pfpMap: Dict<HTMLElement> | null = null;
	const h_pfps = pfpMap;

	export let primaryClass = '';
	export let secondaryClass = '';

	export let containerClasses = '';

	function create_label(g_item: SelectOption) {
		if(g_item.primary) {
			return dd('span', {
				class: 'global_select-item',
			}, [
				h_pfps? h_pfps[g_item.value] || '': '',
				dd('span', {
					class: 'name '+primaryClass,
				}, [
					g_item.primary,
				]),
				...g_item.secondary? [
					dd('span', {
						class: 'secondary '+secondaryClass,
					}, [
						g_item.secondary || '',
					]),
				]: [],
			]).outerHTML;
		}

		return g_item.value;
	}

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

		.item.active {
			:global(&) {
				display: none;
			}

			.secondary {
				:global(&) {
					color: rgba(0, 0, 0, 0.5);
				}
				
				:global(&::before) {
					color: rgba(0, 0, 0, 0.5);
				}
			}
		}
	}
</style>

<div class="star-select {containerClasses}" bind:this={dm_star_select}>
	<Select id="sender-select"
		isDisabled={disabled}
		placeholder={placeholder}
		listOffset={listOffset}
		isClearable={isClearable}
		showIndicator={showIndicator}
		indicatorSvg={SX_ICON_DROPDOWN}
		listPlacement='bottom'
		items={items}
		bind:value={value}
		getOptionLabel={create_label}
		getSelectionLabel={create_label}
		--listMaxHeight={sx_max_height}
		on:select
		on:clear
	/>
</div>