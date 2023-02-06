<script lang="ts">

	export let rootClasses = '';
	export let rootStyle = '';

	export let infoIcon = '';
	export let actionIcon = '';

	export let s_icon_dim = '16px';

	export let b_hr_less = false;
</script>

<style lang="less">
	@import '../_base.less';

	.resource-control {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: default;
		padding: 14px 0;

		.font(tiny);

		>.global_svg-icon {
			flex: 1;
			max-width: fit-content;
			padding-bottom: 1px;

			&.info-icon {
				color: var(--theme-color-text-med);
			}

			&.action-icon {
				color: var(--theme-color-primary);
			}
		}

		>.info {
			flex: auto;
			max-width: calc(100% - 52px);
		}
	}
</style>

{#if !b_hr_less}
	<hr class="no-margin">
{/if}

<div class={`resource-control ${rootClasses}`} style={rootStyle} on:click>
	{#if infoIcon}
		<span class="global_svg-icon icon-diameter_{s_icon_dim} info-icon">
			{@html infoIcon}
		</span>
	{/if}

	<span class="info">
		<slot />
	</span>

	{#if actionIcon}
		<span class="global_svg-icon icon-diameter_20px action-icon">
			{@html actionIcon}
		</span>
	{/if}
</div>