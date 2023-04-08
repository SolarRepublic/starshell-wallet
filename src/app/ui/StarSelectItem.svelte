<script lang="ts">
	import type {Dict} from '#/meta/belt';
	
	import Put from './Put.svelte';
	
	import type {SelectOption} from './StarSelect.svelte';


	export let g_item: SelectOption;

	export let h_pfps: Dict<HTMLElement> | null = null;

	export let s_class_primary = '';
	export let s_class_secondary = '';
</script>


{#if g_item.primary}
	<span class="global_select-item">
		{#if h_pfps}
			{@const dm_pfp = h_pfps[g_item.value]}
			{#if dm_pfp}
				<Put element={h_pfps[g_item.value]} />
			{:else}
				<span></span>
			{/if}
		{/if}

		<span class="name {s_class_primary}">
			{g_item.primary}
		</span>

		{#if g_item.secondary}
			<span class="secondary {s_class_secondary}">
				{g_item.secondary || ''}
			</span>
		{/if}
	</span>
{:else}
	{g_item.value}
{/if}