<script lang="ts">
	import BigNumber from 'bignumber.js';
	import {createEventDispatcher} from 'svelte';

	import {microtask} from '#/util/belt';
	
	import SX_ICON_INCREMENT from '#/icon/expand_less.svg?raw';
	import SX_ICON_DECREMENT from '#/icon/expand_more.svg?raw';

	const YG_ZERO = new BigNumber(0);
	const YG_ONE = new BigNumber(1);

	const dispatch = createEventDispatcher();

	/**
	 * Binding for the amount value string
	 */
	export let value = '';

	/**
	 * Disables the input
	 */
	export let disabled = false;

	/**
	 * Shows the feed and control overlays within the input bounds
	 */
	export let adjustable = true;

	/**
	 * Sets the required attribute on the element
	 */
	export let required = false;

	/**
	 * Numeric precision by number of decimals
	 */
	export let decimals = 0;

	/**
	 * Minimum value for allowable input
	 */
	export let min = '0';

	/**
	 * Maximum value for allowable input
	 */
	export let max = '';

	/**
	 * Validation error text
	 */
	export let error = '';

	// parse min/max
	$: yg_min = BigNumber(min);
	$: yg_max = BigNumber(max || Infinity);

	// step amount determined by decimals
	$: yg_step = decimals >= 0? YG_ONE.shiftedBy(-decimals): YG_ZERO;

	// the input element DOM
	let dm_input: HTMLInputElement;

	// react to parent invalidation
	$: dm_input?.setCustomValidity(error);

	// check input validity, dispatching check to parent
	async function check_validity() {
		// reset error
		error = '';

		// empty input
		if(!value) {
			return error = 'Enter an amount';
		}

		// attempt to parse
		let yg_input!: BigNumber;
		try {
			yg_input = new BigNumber(value);
		}
		// non-numeric input
		catch(e_parse) {
			return error = 'Invalid number';
		}

		// dispatch check event to let parent handle error
		dispatch('check', {
			s_input: value,
			yg_input: value? BigNumber(value): null,
		});

		// wait for it to complete
		await microtask();

		// error was set by parent; exit
		if(error) return;

		// amount is below minimum
		if(yg_input.lt(yg_min as BigNumber)) {
			// minimum is zero
			if(yg_min.eq(0)) return error = 'Must be non-negative';

			// use minimum in error
			return error = `Must be no less than ${yg_min}`;
		}
		// amount exceeds maximum
		else if(yg_input.gt(yg_max as BigNumber)) {
			return error = `Must be no greater than ${yg_max}`;
		}
	}

	// sets the input value, clamping to bounds
	function set_clamped(yg_set: BigNumber) {
		// value is greater than maximum; clamp
		if(yg_set.gt(yg_max as BigNumber)) {
			value = yg_max+'';
		}
		// value is less than minimum; clamp
		else if(yg_set.lt(yg_min as BigNumber)) {
			value = yg_min+'';
		}
		// value is within bounds; set it
		else {
			value = yg_set+'';
		}

		void check_validity();
	}

	// increment the input value by the smallest allowable amount
	function increment() {
		set_clamped(yg_step.plus(value || 0) as BigNumber);
	}

	// decrement the input value by the smallest allowable amount
	function decrement() {
		set_clamped(yg_step.negated().plus(value || 0) as BigNumber);
	}

	// increment/decrement quickly on long press
	function long_press(f_action: VoidFunction) {
		// prep interval id
		let i_ticker = 0;

		// wait for long press duration to activate
		const i_buffer = window.setTimeout(() => {
			i_ticker = window.setInterval(f_action, 90);
		}, 1000);

		// once the button is released; cancel timeout & interval
		window.addEventListener('mouseup', () => {
			clearTimeout(i_buffer);
			clearInterval(i_ticker);
		}, {
			once: true,
		});
	}

	// updates exposed value from input
	function capture_input(d_event: Event) {
		value = (d_event.target as HTMLInputElement).value;
	}

</script>

<style lang="less">
	@import '../_base.less';

	input[type="number"] {
		appearance: textfield;

		&::-webkit-inner-spin-button, &::-webkit-outer-spin-button {
			-webkit-appearance: none;
		}
	}

	.numeric-input {
		position: relative;
	}

	.occupy {
		position: absolute;
		right: 0;
		top: 0;
		height: var(--ui-row-height);

		display: flex;
		align-items: center;

		.adjust {

			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 4px;
			margin-right: 8px;

			.icon {
				cursor: pointer;
				padding: 0px 8px;
				--icon-diameter: 16px;
				--icon-color: var(--theme-color-primary);

				:global(svg) {
					width: var(--icon-diameter);
					height: var(--icon-diameter);
				}

				.increment {
					padding-top: 4px;
				}

				.decrement {
					padding-bottom: 4px;
				}
			}
		}

		.feed {
			.font(regular, @size: 13px, @weight: 300);

			.amount {
				color: var(--theme-color-text-med);
			}

			.fiat {
				color: var(--theme-color-text-med);
			}
		}
	}
</style>

<div class="numeric-input">
	<input type="number"
		inputmode="numeric"
		pattern="{yg_min.lt(0)? '[-]?': ''}[0-9{decimals? '.': ''}]*"
		required={required}
		disabled={disabled}
		min={yg_min.toString() || '0'}
		max={yg_max.toString() || '0'}
		step={yg_step.toString() || '0'}
		bind:this={dm_input}
		{value}
		on:change={() => check_validity()}
		on:input
		on:input={capture_input}
		on:invalid={d => d.preventDefault()}
		class:invalid={error}
	>

	{#if !disabled && adjustable}
		<span class="occupy">
			<span class="feed">
				<slot name="feed" />
			</span>
			
			<span class="adjust">
				<span class="icon increment clickable"
					on:click={() => increment()}
					on:mousedown={() => long_press(increment)}
				>
					{@html SX_ICON_INCREMENT}
				</span>

				<span class="icon decrement clickable"
					on:click={() => decrement()}
					on:mousedown={() => long_press(decrement)}
				>
					{@html SX_ICON_DECREMENT}
				</span>
			</span>
		</span>
	{/if}

	{#if error}
		<span class="validation-message">
			{error}
		</span>
	{/if}
</div>