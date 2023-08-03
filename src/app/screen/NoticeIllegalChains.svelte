<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {Caip2, ChainStruct} from '#/meta/chain';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import {F_NOOP, ode} from '#/util/belt';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';

	import Row from '../ui/Row.svelte';
	

	const {
		completed,
	} = load_flow_context<undefined>();

	export let app: AppStruct;

	export let chains: Record<Caip2.String, ChainStruct>;

</script>

<style lang="less">

</style>

<Screen>
	<AppBanner {app} on:close={() => completed(false)}>
		<span slot="default" style="display:contents;">
			🚫 StarShell does not yet allow<br>
			connecting to foreign chains
		</span>
		<span slot="context" style="display:contents;">
			Request support by joining our discord
		</span>
	</AppBanner>

	<div class="rows no-margin">
		{#each ode(chains) as [si_caip2, g_chain]}
			<Row
				resource={g_chain}
				detail={si_caip2}
			>
			</Row>
		{/each}
	</div>

	<ActionsLine cancel={() => completed(true)} confirm={['Next', F_NOOP, true]} />
</Screen>
