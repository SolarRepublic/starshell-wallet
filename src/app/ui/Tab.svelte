<script context="module">
	let c_tabs = 0;
</script>

<script>
	import { getContext, onMount, tick, createEventDispatcher } from 'svelte';

	// import getId from './id';
	import { TABS } from './Tabs.svelte';

	export let disabled = false;

	export let sx_style = '';

	let tabEl;

	const tab = {
		id: ++c_tabs,
	};
	const {
		registerTab,
		registerTabElement,
		selectTab,
		selectedTab,
		controls,
	} = getContext(TABS);

	let isSelected;
	$: isSelected = $selectedTab === tab;

	registerTab(tab);

	const dispatch = createEventDispatcher();

	onMount(async () => {
		await tick();
		registerTabElement(tabEl);
	});
</script>

<style>
	.svelte-tabs__tab {
		border: none;
		border-bottom: 2px solid transparent;
		color: #000000;
		cursor: pointer;
		list-style: none;
		display: inline-block;
		padding: 0.5em 0.75em;
	}
	
	.svelte-tabs__tab:focus {
		outline: thin dotted;
	}

	.svelte-tabs__selected {
		border-bottom: 2px solid #4F81E5;
		color: #4F81E5;
	}

	.disabled {
		opacity: 0.4;
	}
</style>

<li
	bind:this={tabEl}
	role="tab"
	id={''+tab.id}
	aria-controls={$controls[tab.id]}
	aria-selected={isSelected}
	tabindex="{isSelected ? 0 : -1}"
	class:svelte-tabs__selected={isSelected}
	class="svelte-tabs__tab"
	on:click={() => {
		if(disabled) return;

		dispatch('select');
		selectTab(tab);
	}}
	class:disabled={disabled}
	style={sx_style}
>
	<slot></slot>
</li>