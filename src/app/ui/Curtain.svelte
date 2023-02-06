<script lang="ts">
	import {yw_curtain} from '../mem';

	export let rootStyle = '';
</script>

<style lang="less">
	.curtain {
		position: absolute;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100%;

		z-index: 10;
		margin: 0;

		background-color: transparent;
		transition: background-color 1s var(--ease-out-expo);
		pointer-events: none;

		&.showing {
			background-color: rgba(0, 0, 0, 0.85);
			pointer-events: initial;
		}
	}
</style>

<div class="curtain no-margin no-blur" style={rootStyle} class:showing={$yw_curtain} on:click>
	&nbsp;
</div>
