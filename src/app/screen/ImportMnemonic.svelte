<script lang="ts">
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import Mnemonic from '##/frag/Mnemonic.svelte';

	const {
		k_page,
	} = load_page_context();

	export let atu16_indicies: Uint16Array;
</script>

<style lang="less">
	
</style>

<Screen>
	<Mnemonic b_readonly {atu16_indicies} />
</Screen>
