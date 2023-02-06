<script lang="ts">

	export let xad_rotation = NaN;

</script>

<style lang="less">
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}

		100% {
			transform: rotate(360deg);
		}
	}


	.loading {
		margin: 0 auto;
		width: 60%;
		opacity: var(--opacity, 1);

		img {
			width: 100%;
			animation: spin 3s linear infinite;
		}
	}

	p {
		margin-top: 4em;
		text-align: center;
	}
</style>


<div class="loading">
	<img src="/media/vendor/loading.svg" alt="Loading"
		style={Number.isNaN(xad_rotation)? '': `
			animation: none;
			transition: transform 100ms;
			transform: rotate(${Math.round(xad_rotation)}deg);
		`}
	>
</div>
