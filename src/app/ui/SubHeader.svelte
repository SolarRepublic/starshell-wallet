<script lang="ts">
	import {createEventDispatcher} from 'svelte';

	import {yw_popup} from '../mem';
	
	import Close from './Close.svelte';
	
	import SX_ICON_ADD from '#/icon/add-small.svg?raw';
	

	export let title: string;

	export let buttons: string[] = [];

	/**
	 * Disables the automatic "Add New" button
	 */
	export let bare = false;

	/**
	 * Enables an "X" to close/pop the page
	 */
	export let closes = false;
	const b_closes = closes;

	const dispatch = createEventDispatcher();
</script>

<style lang="less">
	.title {
		display: flex;
		align-items: center;
		justify-content: space-between;

		>.right {
			display: flex;
			gap: 8px;
		}

		.pill {
			>.icon {
				--icon-diameter: 8px;
				--icon-color: var(--theme-color-primary);
			}
		}
	}
</style>

<div class="title">
	<span class="text">
		{title}
	</span>

	<span class="right">
		{#each buttons as s_button}
			<button class="pill" on:click={() => dispatch(s_button.toLowerCase().replace(/\s/g, '_'))}>
				<span class="text">
					{s_button}
				</span>
			</button>
		{/each}

		{#if !bare}
			<button class="pill" on:click={() => dispatch('add_new')}>
				<span class="icon">
					{@html SX_ICON_ADD}
				</span>

				<span class="text">
					Add New
				</span>
			</button>
		{/if}

		{#if b_closes}
			<Close on:click={() => $yw_popup = null} />
		{/if}
	</span>
</div>
