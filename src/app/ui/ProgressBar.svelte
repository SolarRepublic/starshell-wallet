<script lang="ts">

	let dm_bar: HTMLSpanElement;

	export let x_progress = 0;

	$: dm_bar?.style.setProperty('width', `${x_progress * 100}%`);
</script>

<style lang="less">
	.progress-bar {
		height: 6px;
		line-height: 6px;
		border: 1px solid var(--theme-color-primary);
		border-radius: 8px;

		>span {
			display: inline-block;
			height: 100%;
			border-radius: 6px;
			background-color: var(--theme-color-primary);
			transition: width 200ms var(--ease-out-quad);
		}
	}
</style>

<div class="progress-bar">
	<span bind:this={dm_bar}>
		&nbsp;
	</span>
</div>