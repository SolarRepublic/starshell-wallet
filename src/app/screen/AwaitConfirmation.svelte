<script lang="ts">
	import Screen from '../container/Screen.svelte';
	import LoadingAnimation from '../frag/LoadingAnimation.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';

	let b_wait = true;

	setTimeout(() => {
		b_wait = false;
	}, 12e3);

	function close() {
		window.close();
	}
</script>

<style lang="less">
</style>


<Screen>
	<h3>
		Transaction Succeeded
	</h3>

	<div class="flex_1">
		<p>
			Waiting for chain synchronization...
		</p>

		{#if !b_wait}
			<p>
				You can safely close this window if it is taking a while. The transaction succeeded but the event has not yet been synchronized.
			</p>
		{/if}
	</div>

	<section>
		<LoadingAnimation />
	</section>

	<ActionsLine wait={12e3} confirm={['Close', close]} />
</Screen>