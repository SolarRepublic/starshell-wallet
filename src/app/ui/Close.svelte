<script lang="ts">
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';

	export let absolute = false;

	export let bgColor = '';
</script>

<style lang="less">
	.close {
		position: relative;
		top: 0;
		right: 0;
		margin: var(--margin, 12px);
		padding: 10px;
		cursor: pointer;
		--icon-diameter: 24px;
		--icon-color: var(--theme-color-primary);

		outline: 1px solid var(--theme-color-border);
		border-radius: 0px;
		transition: border-radius 650ms var(--ease-out-expo);
		pointer-events: all;

		clip-path: inset(2px);

		&.absolute {
			position: absolute;
		}

		&::before {
			--occlusion-thickness: 4px;

			content: '';
			position: absolute;
			top: calc(var(--occlusion-thickness) / 2);
			left: calc(var(--occlusion-thickness) / 2);
			width: calc(100% - var(--occlusion-thickness));
			height: calc(100% - var(--occlusion-thickness));
			box-sizing: border-box;
			pointer-events: none;
		}

		&:hover {
			border-radius: 22px;
		}
	}
</style>

<div class="close icon" class:absolute={absolute} style={bgColor? `--bg-color:${bgColor};`: ''} on:click>
	{@html SX_ICON_CLOSE}
</div>
