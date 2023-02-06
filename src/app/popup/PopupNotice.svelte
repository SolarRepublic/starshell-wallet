<script lang="ts">
	import {yw_context_popup, yw_popup} from '../mem';
	
	import ActionsLine from '../ui/ActionsLine.svelte';

	function acknowledge() {
		$yw_popup = null;
		$yw_context_popup?.ok?.();
	}
</script>

<style lang="less">
	@import '../_base.less';

	.nuclear {
		color: var(--theme-color-caution);
	}

	.info {
		.font(regular);
		text-align: left;
	}
</style>


<h3>
	<span class="text">
		{$yw_context_popup?.title || 'Notice'}
	</span>
</h3>

<div class="info">
	{#each $yw_context_popup?.infos || [$yw_context_popup?.info || ''] as s_info}
		<p>
			{s_info}
		</p>
	{/each}
</div>

<ActionsLine confirm={[$yw_context_popup?.ok_text || 'OK', acknowledge]} />
	
