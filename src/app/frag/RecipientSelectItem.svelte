<script lang="ts">
	import InlineContactSelection, {type ContactOption} from '../frag/InlineContactSelection.svelte';

	export let isActive = false;
	export let isFirst = false;
	export let isHover = false;
	export let isSelectable = false;
	export let getOptionLabel = void 0;
	export let item: ContactOption;
	// 	isGroupHeader?: boolean;
	// 	isGroupItem?: boolean;
	// };
	export let filterText = '';

	let itemClasses = '';

	$: {
		const classes: string[] = [];
		if(isActive) {
			classes.push('active');
		}
	
		if(isFirst) {
			classes.push('first');
		}
	
		if(isHover) {
			classes.push('hover');
		}
	
		// if(item.isGroupHeader) {
		// 	classes.push('groupHeader');
		// }
	
		// if(item.isGroupItem) {
		// 	classes.push('groupItem');
		// }
	
		if(!isSelectable) {
			classes.push('notSelectable');
		}
	
		itemClasses = classes.join(' ');
	}
</script>

<style lang="less">
	.item {
		cursor: default;
		height: var(--height, 42px);
		line-height: var(--height, 42px);
		padding: var(--item-padding, 0 20px);
		color: var(--item-color, inherit);
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
		padding-left: 8px;
	}

	.groupHeader {
		text-transform: var(--group-title-text-transform, uppercase);
	}

	.groupItem {
		padding-left: var(--group-item-padding-left, 40px);
	}

	.item:active {
		background: var(--item-active-background, #b9daff);
	}

	.item.active {
		background: var(--item-is-active-bg, #007aff);
		color: var(--item-is-active-color, #fff);
	}

	.item.notSelectable {
		color: var(--item-is-not-selectable-color, #999);
	}

	.item.first {
		border-radius: var(--item-first-border-radius, 4px 4px 0 0);
	}

	.item.hover:not(.active) {
		background: var(--item-hover-bg, #e7f2ff);
		color: var(--item-hover-color, inherit);
	}
</style>


<div class="item {itemClasses}" class:display_none={isActive || !item.value}>
	{#if item.contact}
		<InlineContactSelection contact={item.contact} address={item.value} />
	{:else if item.account}
		<InlineContactSelection account={item.account} address={item.value} />
	{/if}
</div>
