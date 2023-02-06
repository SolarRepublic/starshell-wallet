<script lang="ts">
	/**
	 * Renders a labeled, readonly password field with optional controls for revealing and copying.
	*/

	import {F_NOOP} from '#/util/belt';
	
	import {phrase_to_hyphenated} from '#/util/format';
	
	import Copyable from './Copyable.svelte';
	import Field from './Field.svelte';
	
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	import SX_ICON_EYE from '#/icon/visibility.svg?raw';


	/**
	 * The raw password string
	 */
	export let password: string;

	/**
	 * What to label the surrounding field
	 */
	export let label: string | undefined = '';


	// flag indicating whether password is currently revealed
	let b_password_revealed = false;
</script>

<style lang="less">
	@import '../_base.less';

	.password {
		display: flex;
		gap: 8px;
		align-items: center;
		min-height: 3em;

		>* {
			flex: auto;

			&.payload {
				.hide-scrollbar();
				overflow-x: scroll;
				user-select: all;

				.fill-available();
				padding: 0.5em 0.75em;
				border: 1px solid var(--theme-color-border);
				border-radius: 8px;

				white-space: pre;
			}
		}
	}
</style>

<Field key={phrase_to_hyphenated(label || '')} name={label}>
	<!-- pass-through slot for elements to occupy right-hand side of row -->
	<svelte:fragment slot="right">
		<slot name="right" />
	</svelte:fragment>

	<!-- default click action is to copy -->
	<Copyable let:copy>
		<div class="password">
			<span class="payload">
				{#if b_password_revealed && 'string' === typeof password}
					{password}
				{:else}
					{'•'.repeat(44)}
				{/if}
			</span>
			<span class="global_svg-icon icon-diameter_20px reveal"
				style="color:var(--theme-color-text-med);"
				on:click={() => b_password_revealed = !b_password_revealed}
				on:keydown={F_NOOP}
			>
				{@html SX_ICON_EYE}
			</span>
			<span class="global_svg-icon icon-diameter_20px copy"
				style="color:var(--theme-color-primary);"
				on:click={() => copy(password)}
				on:keydown={F_NOOP}
			>
				{@html SX_ICON_COPY}
			</span>
		</div>
	</Copyable>
</Field>