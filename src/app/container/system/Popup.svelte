<script lang="ts">
	import {yw_popup} from '##/mem';
</script>

<style lang="less">
	@import '../../_base.less';

	.popup {
		pointer-events: none;

		position: absolute;
		top: var(--app-window-height);
		left: 0;
		z-index: 1100;

		width: 100%;
		height: 100%;

		background-color: rgba(0, 0, 0, 0);
		transition: background-color 0.35s linear;

		&.showing {
			top: 0;
			pointer-events: initial;
			display: block;
			background-color: rgba(0, 0, 0, 0.85);

			>.content {
				// top: 24px;
				transform: translateY(24px);
			}
		}

		>.content {
			position: absolute;
			// top: var(--app-window-height);
			top: 0;
			left: var(--ui-padding);
			width: calc(100% - var(--ui-padding) - var(--ui-padding));
			height: 87%;
			overflow-y: scroll;
			.hide-scrollbar();

			background-color: var(--theme-color-bg);
			border-radius: 8px;
			box-sizing: border-box;
			padding: var(--ui-padding);

			display: flex;
			flex-direction: column;
			gap: var(--ui-padding);

			// transition: top 675ms var(--ease-out-quick);
			transition: transform 675ms var(--ease-out-quick);
			transform: translateY(var(--app-window-height));
		}
	}
</style>

<div class="popup" class:showing={null !== $yw_popup} on:click={() => $yw_popup = null}>
	<form class="screen content" on:click={(d_event) => d_event.stopPropagation()}>
		<svelte:component this={$yw_popup}></svelte:component>
	</form>
</div>
