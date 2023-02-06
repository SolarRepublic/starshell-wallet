<script lang="ts">

	export let sx_color: string;

	export let n_border = 0;

	export let sx_style_root = '';

	export let b_pulsing = false;
</script>

<style lang="less">
	.container {
		display: flex;
		align-items: center;

		>.dot {
			height: 8px;
			width: 8px;
			border-radius: 16px;
			border-style: solid;
			border-color: black;
		}
	}
</style>

<span class="container">
	<span class="dot"
		class:global_pulse={b_pulsing}
		style="background-color:{sx_color}; border-width:{n_border}px; {sx_style_root}"
	>
		&nbsp;
	</span>
</span>