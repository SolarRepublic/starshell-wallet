<script lang="ts">
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {load_page_context} from '../svelte';
	
	import Fields from '../ui/Fields.svelte';
	

	const {
		k_page,
	} = load_page_context();

	const h_prims = {
		bool: true,
		number: 5,
		string: 'value',
		empty_array: [],
		empty_object: {},
		null: null,
	};

	const h_demo = {
		...h_prims,
		nested: {
			...h_prims,
			deeper: {
				...h_prims,
				deepest: {
					...h_prims,
				},
			},
		},
	};
</script>

<style lang="less">
	
</style>

<Screen>
	<Fields configs={[
		JsonPreviewer.render(h_demo, {
			// chain: g_chain,
		}, {
			title: 'Arguments',
		}),
	]} />
</Screen>
