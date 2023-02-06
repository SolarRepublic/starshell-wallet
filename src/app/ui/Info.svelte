<script lang="ts">
	import SX_ICON_COPY from '#/icon/copy.svg?raw';

	export let key: string;
	const si_key = key;

	export let address = false;
	const b_address = address;

	export let center = b_address;
	const b_center = center;

	export let copyable = false;
	const b_copyable = copyable;

	export let b_no_scroll = false;
</script>

<style lang="less">
	@import '../_base.less';

	.info {
		--icon-diameter: 24px;

		white-space: nowrap;
		height: var(--ui-row-height);
		box-sizing: border-box;
		padding: var(--ui-padding) 12px;

		border: 1px dashed var(--theme-color-border);
		border-radius: var(--ui-border-radius);

		display: flex;
		align-items: center;

		&.copyable {
			cursor: copy;
		}

		>* {
			flex: var(--flex, auto);
		}

		.info-value {
			width: 100%;
			display: flex;
			.hide-scrollbar();
			overflow-x: scroll;

			>.address {
				:global(&) {
					width: calc(100% - 1ch) !important;
					color: var(--theme-color-text-light) !important;
				}
			}
		}

		.icon {
			--icon-diameter: var(--icon-diameter);
			--icon-color: var(--theme-color-primary);
			display: inline-flex;
		}
	}
</style>

<div class="info" class:copyable={b_copyable} class:center={b_center}>
	<span id={si_key} class="info-value" style={`
		${b_no_scroll? `overflow: hidden;`: ''}
	`}>
		<slot></slot>
	</span>
	{#if b_copyable}
		<span class="icon">
			{@html SX_ICON_COPY}
		</span>
	{/if}
</div>
