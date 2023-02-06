<script lang="ts">
	/**
	 * Takes an HTML element, extracts only its HTML, and injects it into the DOM as a svelte component
	*/

	import {createEventDispatcher, onMount} from 'svelte';

	const dispatch = createEventDispatcher();

	export let element: HTMLElement;

	let dm_anchor: HTMLSpanElement | undefined;

	onMount(() => {
		if(dm_anchor) {
			const dm_sibling = dm_anchor.nextElementSibling;
			dm_anchor.remove();

			dispatch('mount', dm_sibling);
		}
	});
</script>

{#if element?.outerHTML}
	<span class="anchor" bind:this={dm_anchor}></span>
	{@html element.outerHTML}
{/if}
