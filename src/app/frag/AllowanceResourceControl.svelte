<script lang="ts">
	import {yw_navigator} from '../mem';
	
	import AllowancesAbout from './AllowancesAbout.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_CREDIT_CARD from '#/icon/credit-card.svg?raw';
	import SX_ICON_ARROW from '#/icon/expand-right.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';

	export let s_summary = '';

	function resource_click() {
		$yw_navigator.activePage.push({
			creator: AllowancesAbout,
		});
	}
</script>

<ResourceControl infoIcon={SX_ICON_CREDIT_CARD} actionIcon={SX_ICON_ARROW} on:click={resource_click}>
	<slot />
</ResourceControl>
