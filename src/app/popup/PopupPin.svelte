<script lang="ts">
	import {yw_context_popup, yw_popup} from '../mem';
	
	import {estimate_pin_hash} from '../svelte';
	
	import {text_to_buffer} from '#/util/data';
	
	import SeedIdentity from '../frag/SeedIdentity.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import PinInput from '../ui/PinInput.svelte';
	
	import ProgressBar from '../ui/ProgressBar.svelte';
	

	let b_valid = false;
	let sh_pin = '';

	let b_busy = false;

	let s_err_pin = '';

	let x_progress = 0;

	async function enter() {
		// grab pin before locking
		const atu8_pin = text_to_buffer(sh_pin);

		b_busy = true;
		x_progress = 0;
		s_err_pin = '';

		// collect hash sample
		const xt_estimate = await estimate_pin_hash();

		x_progress = 0.02;

		// setup progress bar
		let f_done!: VoidFunction;
		{
			const x_pre = x_progress;
			const x_span = 1 - x_pre;
			const xt_start = performance.now();
			const i_interval = setInterval(() => {
				x_progress = Math.min(1, x_pre + (((performance.now() - xt_start) / xt_estimate) * x_span));
			}, 250);

			f_done = () => {
				clearInterval(i_interval);
				x_progress = 1;
			};
		}

		const b_correct = await $yw_context_popup?.enter?.(atu8_pin);

		f_done();

		if(b_correct) {
			$yw_popup = null;
			return;
		}

		s_err_pin = 'Wrong PIN';
		sh_pin = '';

		b_busy = false;
	}

	function cancel() {
		$yw_context_popup?.cancelled?.();

		$yw_popup = null;
	}
</script>

<style lang="less">
	@import '../_base.less';

	.nuclear {
		color: var(--theme-color-caution);
	}

	.info {
		.font(regular);
		text-align: left;
	}

	.no-hint {
		.font(tiny);
	}

	p {
		.font(regular, @size: 13px);
	}
</style>


<h3>
	Enter your PIN for this seed
</h3>

<div>
	<SeedIdentity s_nickname={$yw_context_popup?.seed} />
</div>

{#if $yw_context_popup?.hint}
	<span class="hint">
		Hint: {$yw_context_popup.hint}
	</span>
{:else}
	<span class="no-hint">
		No hints were saved with this PIN.
	</span>
{/if}

<PinInput s_new_title='PIN' b_no_verify b_locked={b_busy}
	bind:b_valid={b_valid}
	bind:sh_pin={sh_pin}
/>

{#if s_err_pin}
	<span class="validation-message">
		{s_err_pin}
	</span>
{/if}

{#if b_busy}
	<span class="info">
		Decrypting seed
	</span>

	<ProgressBar {x_progress} />

	<!-- <p>
		This intentionally takes time to create strong resistance to brute force attacks.
	</p> -->
{/if}

<ActionsLine cancel={() => cancel()} confirm={['Enter', enter, !b_valid]} />
	
