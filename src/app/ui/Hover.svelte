<script lang="ts">
	export let text: string;
</script>

<style lang="less">
	.container {
		margin-right: -3px;

		.tooltip {
			visibility: hidden;

			position: absolute;
			background: rgba(0,0,0,0.98);
			padding: 0.5rem 1rem;
			left: 0;
			width: 100%;
			max-width: 100%;
			box-sizing: border-box;
			display: block;
			overflow: auto;
			white-space: pre-wrap;
			box-shadow: -1px 4px 6px black;
			margin-top: 4px;
		}
	
		&:hover {
			>.tooltip {
				visibility: visible;
			}
		}
	}
</style>

<span class="container">
	<span class="hover-target">
		<slot />
	</span>

	<span class="tooltip">
		{text}
	</span>
</span>