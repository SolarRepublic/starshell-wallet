<script lang="ts">
	export let plain = false;

	export let brutal = false;

	export let rootStyle = '';

	if(!plain) {
		rootStyle += `margin: -15px 0;`;
	}
</script>

<style lang="less">
	.gap {
		height: 4px;
		background-color: black;

		.notPlain {
			margin-bottom: calc(0px - var(--ui-padding));
		}

		&.brutal {
			margin: var(--ui-padding) calc(0px - var(--ui-padding));
		}
	}
</style>

<div class="gap no-margin no-flex"
	class:notPlain={!plain}
	class:brutal={brutal}
	style={rootStyle}
>&nbsp;</div>
