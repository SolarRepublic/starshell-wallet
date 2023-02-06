<script lang="ts" context="module">
	import {qs} from '#/util/dom';

	// symbol to use when marking a click event as already handled
	const _$_CLICK_HANDLED = Symbol('Checkbox click handled');

	/**
	 * Handles click events for parent nodes that want to set their child checkbox value
	 */
	export function toggleChildCheckbox(d_event: MouseEvent | KeyboardEvent): void {
		// event was not explicitly handled by the child svelte component
		if(!d_event[_$_CLICK_HANDLED] && d_event.currentTarget) {
			qs(d_event.currentTarget as HTMLElement, 'fieldset')?.click();
		}
	}
</script>

<script lang="ts">
	/* eslint-disable i/order */
	import {createEventDispatcher} from 'svelte';

	import SX_ICON_CHECKED from '#/icon/checked.svg?raw';
	import SX_ICON_UNCHECKED from '#/icon/unchecked.svg?raw';

	/**
	 * HTML element id
	 */
	export let id: string;
	const s_id = id;

	/**
	 * Sets the class of the fieldset container element
	 */
	export let containerClass = '';

	/**
	 * Exposed binding of the checked value
	 */
	export let checked = false;

	/**
	 * Whether the checkbox is disabled
	 */
	export let disabled = false;

	/**
	 * Sets the style of the root element
	 */
	export let rootStyle = '';


	let dm_label: HTMLLabelElement;

	function handle_fieldset_keydown(d_event: KeyboardEvent) {
		
	}

	// handle click events on the fieldset
	function handle_fieldset_click(d_event: MouseEvent) {
		// already handled; exit
		if(d_event[_$_CLICK_HANDLED]) return;

		// not disabled
		if(!disabled) {
			// ref target
			const dm_target = d_event.target as HTMLElement;

			// handle click on field set
			if(dm_input !== dm_target) {
				dm_input.checked = !dm_input.checked;
				handle_change();
			}

			// prevent default on label
			if('LABEL' === (dm_target)?.tagName || dm_label === dm_target?.closest?.('label')) {
				d_event.preventDefault();
			}
		}

		// mark the event as handled
		d_event[_$_CLICK_HANDLED] = true;

		// do not propagate to parent
		d_event.stopPropagation();
	}

	// dispatch change event when it changes
	const dispatch = createEventDispatcher();

	// input element
	let dm_input: HTMLInputElement;

	// handle input events on checkbox element
	function handle_change() {
		// update checked state
		checked = dm_input.checked;

		// dispatch event to parent component
		dispatch('change', checked);
	}
</script>

<style lang="less">
	fieldset {
		display: flex;
		gap: 8px;
		// margin: 0;
		padding: 0;
		border: 0;

		&.disabled {
			opacity: 0.3;
		}

		.checkbox {
			position: relative;
			width: 18px;
			height: 18px;
			margin-top: 1px;

			&>* {
				display: block;
				width: 18px;
				height: 18px;
				margin: 0;
				padding: 0;
				cursor: pointer;
			}

			&>input {
				position: absolute;
				top: 0;
				right: 0;
			}

			input {
				opacity: 0;
			}

			.icon {
				--icon-diameter: 18px;
				--icon-color: var(--theme-color-primary);
				vertical-align: middle;
			}
		}

		label {
			padding-left: 0.25em;
		}
	}
</style>


<fieldset class="checkbox-field {containerClass}"
	on:click={handle_fieldset_click}
	on:keydown={handle_fieldset_keydown}
	class:disabled={disabled}
	style={rootStyle}
>
	<span class="checkbox">
		<span class="icon">
			{@html checked? SX_ICON_CHECKED: SX_ICON_UNCHECKED}
		</span>
		<input id={s_id} type="checkbox" bind:this={dm_input}
			checked={checked}
			disabled={disabled}
			on:change={handle_change}
		>
	</span>

	{#if $$slots.default}
		<label bind:this={dm_label} for={s_id}>
			<slot />
		</label>
	{/if}
</fieldset>
