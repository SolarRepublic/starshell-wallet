<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {Bech32} from '#/meta/chain';
	
	import {qs} from '#/util/dom';
	
	import Address from './Address.svelte';
	import Copyable from '../ui/Copyable.svelte';
	import Load from '../ui/Load.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_AT from '#/icon/at.svg?raw';
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	

	export let address: Promisable<Bech32>;

	function resource_click(d_event: MouseEvent) {
		const dm_target = d_event.target as HTMLElement;
		const dm_control = dm_target.closest('.resource-control')!;
		const dm_copyable = qs(dm_control, '.copyable')! as HTMLElement;
		dm_copyable.click();
	}
</script>

<ResourceControl infoIcon={SX_ICON_AT} actionIcon={SX_ICON_COPY} on:click={resource_click}>
	{#await address}
		<Load forever />
	{:then sa_resource}
		<Copyable output={sa_resource} confirmation="Address copied!" let:copy>
			<Address address={sa_resource} on:click={() => copy(sa_resource)} />
		</Copyable>
	{/await}
</ResourceControl>
