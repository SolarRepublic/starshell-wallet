<script lang="ts">
	import {Screen} from './_screens';
	
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	import SX_ICON_RED_CARD from '#/icon/red-card.svg?raw';
	import SX_ICON_CHECK from '#/icon/tiny-check.svg?raw';
	
	function close() {
		globalThis.close();
	}
</script>

<style lang="less">
	@import '../_base.less';

	section {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.spacer {
		flex: 1;
	}

	.scalar {
		align-items: center;
		display: flex;
		flex: 2;
		align-items: center;
		justify-content: center;
	}

	.bg {
		position: absolute;
		top: 0;
		left: 0;
		margin: 0;
		width: 100vw;
		height: 100vh;
	}
</style>

<Screen>

	<h3>
		<span class="global_svg-icon icon-diameter_12px">
			{@html SX_ICON_CHECK}
		</span>
		<span>
			Red Card obtained
		</span>
	</h3>

	<!-- svelte-ignore a11y-missing-attribute -->
	<img class="bg" src="/media/vendor/radiant-bg.svg" />

	<section class="flex_1">
		<div class="spacer" />
		<div class="flex_1 scalar">			
			<span class="global_svg-icon icon-diameter_128px">
				{@html SX_ICON_RED_CARD}
			</span>
		</div>
		<div class="spacer" />
		<div class="flex_0">
			<p>
				The Red Card has been saved to your wallet.
			</p>
		
			<p>
				Uninstalling the extension or performing a factory reset will result in the loss of your Red Card.
			</p>
		</div>
	</section>

	<ActionsWall>
		<button class="primary" on:click={close}>Done</button>
	</ActionsWall>
</Screen>
