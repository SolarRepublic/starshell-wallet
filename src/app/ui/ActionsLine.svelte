<script lang="ts">
	import type {Page, PageConfig} from '../screen/_screens';
	
	import type {Promisable} from '#/meta/belt';
	
	import {getContext} from 'svelte';
	
	import {F_NOOP} from '#/util/belt';
	

	type PromisableIgnoreFunction = () => Promisable<any>;

	/**
	 * If `true`, includes a cancel button
	 */
	export let cancel: VoidFunction | 'pop' | boolean = false;
	const b_cancel = !!cancel;
	const f_cancel = 'function' === typeof cancel? cancel: F_NOOP;

	/**
	 * If `true`, sets the cancel button to pop the page from the stack
	 */
	export let back = false;
	const b_back = back;

	export let deny = false;

	/**
	 * Sets the confirmation label and optionally its action and disabled state
	 */
	export let confirm: readonly [string, PromisableIgnoreFunction?, boolean?] = ['Done', F_NOOP, false];
	const [s_confirm, f_confirm] = confirm;

	export let allowDisabledClicks = false;

	/**
	 * Disables primary class for confirm action
	 */
	export let noPrimary = false;

	// append text to confirmation label
	let s_confirm_append = '';

	// reactive confirmation text
	$: s_confirm_final = s_confirm+s_confirm_append;

	/**
	 * Force the user to wait for some duration
	 */
	export let wait: boolean | number = 0;
	const xt_wait = true === wait? 5000: wait || 0;

	// waiting state
	let b_waiting = xt_wait > 0;

	// setup waiting
	if(b_waiting) {
		// human-readable seconds
		let n_seconds = Math.round(xt_wait / 1000);
		s_confirm_append = ` (${n_seconds}s)`;

		// interval to update label
		const i_interval = setInterval(() => {
			n_seconds -= 1;
			s_confirm_append = ` (${n_seconds}s)`;
		}, 1000);

		// timeout to stop waiting
		setTimeout(() => {
			b_waiting = false;
			s_confirm_append = '';
			clearInterval(i_interval);
		}, xt_wait);
	}

	// reactive disabled flag on confirmation only
	$: b_disabled = confirm[2] || false;

	// busy flag
	let b_busy = false;

	// re-entry blocking flag
	let b_cooldown = false;

	// reactive disabled flag for all entries
	export let disabled = false;

	/**
	 * Overrides the confirm button to push the given screen or callback
	 */
	export let contd: PageConfig | null = null;
	const f_continue = contd? () => k_page.push(contd!): null;

	$: b_greyed_out = b_disabled || disabled || b_waiting || b_busy;


	// get page from context
	const k_page = getContext<Page>('page');

	// handle cancel action
	function cancel_action() {
		// begin cooldown
		b_cooldown = true;

		// cancellation handler is set; call it
		if(b_cancel && f_cancel) {
			f_cancel();
		}

		// back is set
		if(b_back || 'pop' === cancel) {
			k_page.pop();
		}

		// reset cooldown
		setTimeout(() => {
			b_cooldown = false;
		}, 1e3);
	}

	// handle confirm action
	async function confirm_action() {
		// assume confirmation goes fine
		let b_continue = true;

		// disable everything while awaiting
		b_busy = true;
		b_cooldown = true;

		// await for confirmation
		try {
			await (f_confirm || F_NOOP as PromisableIgnoreFunction)();
		}
		// do not continue in case of error
		catch(e_confirm) {
			b_continue = false;
			console.error(e_confirm);
		}

		// re-enable
		b_busy = false;

		// continue action set
		if(f_continue && b_continue) {
			f_continue();
		}

		// reset cooldown
		setTimeout(() => {
			b_cooldown = false;
		}, 1e3);
	}
</script>

<style lang="less">
	div.actions-line {
		display: flex;
		flex-direction: row;
		justify-content: space-evenly;
		gap: var(--ui-padding);
		padding-bottom: calc(1.75 * var(--ui-padding));
		align-items: flex-end;
		flex: auto;

		text-align: center;

		&>button {
			flex: 1;
		}
	}
</style>

<div class="actions-line">
	<slot>
		{#if b_cancel || b_back}
			<button type="button" disabled={disabled || b_busy} on:click={() => cancel_action()}>
				{deny? 'Deny': b_cancel? 'Cancel': 'Back'}
			</button>
		{/if}

		<button
			readonly={allowDisabledClicks? b_greyed_out: false}
			disabled={allowDisabledClicks? false: b_greyed_out}
			class:primary={!noPrimary} on:click={() => confirm_action()}
		>
			{s_confirm_final}
		</button>
	</slot>
</div>