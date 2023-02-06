<script lang="ts">
	import Row from './Row.svelte';

	export let count = 1;
</script>

<style lang="less">
	
</style>

<div class="rows">
	{#each Array(count) as w_ignore, i_item}
		<Row
			name='Loading...'
		>
		</Row>
	{/each}
</div>
