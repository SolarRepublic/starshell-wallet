<script lang="ts">
	// target width
	export let width = 180;
</script>

<style lang="less">
	.title {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		user-select: none;

		margin-left: auto;
		margin-right: auto;

		height: auto;

		img {
			width: 100%;
		}
	}
</style>

<div class="no-margin title" style="width:{width}px;">
	<img alt="StarShell title" src="/media/vendor/title.svg" />
</div>
