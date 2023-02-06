<script lang="ts">
	import SX_ICON_FINGERPRINT from '#/icon/fingerprint.svg?raw';

	export let s_nickname: string;
</script>

<style lang="less">
	@import '../_base.less';

	.identity {
		display: flex;
		gap: 6px;
		align-items: center;
		.font(regular);

		>.global_svg-icon {
			color: var(--theme-color-graysoft);
		}

		>.label {
			color: var(--theme-color-graymed);
		}
	}
</style>

<span class="identity">
	<span class="global_svg-icon icon-diameter_18px">
		{@html SX_ICON_FINGERPRINT}
	</span>
	<span class="label">
		Seed Identity:
	</span>
	<span class="value">
		{s_nickname}
	</span>
	<slot />
</span>