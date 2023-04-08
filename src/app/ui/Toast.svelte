<script lang="ts">
	import {fade, scale} from 'svelte/transition';

	export let s_text = '';

	export let xt_timeout = 1150;

	$: if(s_text) {
		setTimeout(() => {
			s_text = '';
		}, xt_timeout);
	}

</script>

<style lang="less">
	.toast { 
		position: absolute;
		z-index: 101;
		color: var(--theme-color-bg);

		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		box-sizing: border-box;

		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: -5%;

		>div {
			background-color: var(--theme-color-light);
			padding: 8px 12px;
			border-radius: 8px;
			
			box-shadow: -2px 2px 8px 2px black;
		}
	}
</style>

{#if s_text}
	<div class="toast" in:scale={{
		delay: 250,
		duration: 300,
	}} out:fade>
		<div>
			{s_text}
		</div>
	</div>
{/if}
