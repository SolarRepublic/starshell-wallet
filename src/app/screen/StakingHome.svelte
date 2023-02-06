<script lang="ts">
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import Header from '../ui/Header.svelte';

	const {
		k_page,
	} = load_page_context();
</script>

<style lang="less">
	
</style>

<Screen>
	<Header title='Staking' />
	<h3>
		Staking
	</h3>
</Screen>
