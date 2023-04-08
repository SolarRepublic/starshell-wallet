<script lang="ts">
	import {onMount} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';

	import {RegistryTypes} from '@solar-republic/bc-ur-registry-cosmos';
	
	import {timeout} from '#/util/belt';
	
	import ScanQr from './ScanQr.svelte';

	const {
		k_page,
	} = load_page_context();

	async function action() {
		await timeout(0);

		k_page.push({
			creator: ScanQr,
			props: {
				a_ur_types: [
					RegistryTypes.CRYPTO_MULTI_ACCOUNTS.getType(),
				],
			},
		});
	}
</script>

<style lang="less">
	
</style>

<Screen>
	<button class="primary" on:click={action}>
		Read Keystone
	</button>
</Screen>
