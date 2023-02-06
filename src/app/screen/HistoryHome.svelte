<script lang="ts">
	import {onDestroy} from 'svelte';
	
	import {Screen, Header, SubHeader} from './_screens';
	
	import {subscribe_store} from '#/store/_base';
	import {Incidents} from '#/store/incidents';
	
	import IncidentsList from '../frag/IncidentsList.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	

	let c_reloads = 1;
	subscribe_store(['incidents'], () => {
		c_reloads++;
	}, onDestroy);

	async function load_incidents() {
		const a_incidents = [...await Incidents.filter()];

		return a_incidents;
	}
</script>

<style lang="less">
	@import '../_base.less';

</style>

<Screen nav root
>
	<Header search network account
	>
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	<SubHeader
		title='History - all'
		bare
	></SubHeader>

	{#key c_reloads}
		{#await load_incidents()}
			<LoadingRows count={10} />
		{:then a_incidents}
			<IncidentsList
				incidents={a_incidents}
			/>
		{/await}
	{/key}
</Screen>
