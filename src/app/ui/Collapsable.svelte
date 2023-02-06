<script lang="ts">
	import {slide} from 'svelte/transition';
	
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';


	/**
	 * Sets the title for the collapsable section
	 */
	export let title: string;

	/**
	 * Exposed binding of the expanded state
	 */
	export let expanded = false;

	/**
	 * Injects class names into the container element
	 */
	export let classNames = '';

</script>

<style lang="less">
	@import '../_base.less';

	.collapsable {
		position: relative;
		padding-top: var(--ui-padding);
		padding-bottom: var(--ui-padding);
		border-top: 1px solid var(--theme-color-border);

		&:last-child {
			border-bottom: 1px solid var(--theme-color-border);
		}

		>.title {
			display: flex;
			gap: 4px;
			position: relative;

			.dropdown.icon {
				--icon-diameter: 24px;
				--icon-color: var(--theme-color-primary);
	
				transform: rotate(-180deg);
				transition: transform 300ms var(--ease-out-quad);
			}

			.text {
				align-self: center;
			}
		}

		&.expanded {
			.dropdown.icon {
				transform: rotate(0deg);
			}

			padding-bottom: 0;
		}
	}

</style>


<div class="collapsable {classNames}" class:expanded={expanded}>
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="title" on:click={() => expanded = !expanded}>
		<span class="icon dropdown">
			{@html SX_ICON_DROPDOWN}
		</span>
		<span class="text">
			{title}
		</span>
	</div>

	{#if expanded}
		<div transition:slide>
			<slot />
		</div>
	{/if}
</div>
