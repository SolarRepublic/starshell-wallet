<script lang="ts">
	import {slide} from 'svelte/transition';
	
	import {NL_PIN_MAXIMUM, NL_PIN_MINIMUM} from '#/share/constants';
	
	
	import Field from './Field.svelte';


	export let s_new_title = 'New PIN';
	export let s_verify_title = 'Verify PIN';

	let s_err_password = '';
	let s_err_verify = '';

	export let sh_pin = '';
	export let sh_verify = '';

	export let b_locked = false;

	export let b_disabled = false;

	export let b_valid = false;

	export let b_no_verify = false;

	$: b_valid = sh_pin.length >= NL_PIN_MINIMUM && sh_pin.length <= NL_PIN_MAXIMUM && !s_err_password && (b_no_verify || sh_pin === sh_verify);

	$: if(b_locked) sh_verify = sh_pin = '0'.repeat(64);

	const R_NOT_NUMERIC = /[^0-9]+/g;

	$: if(R_NOT_NUMERIC.test(sh_pin)) {
		sh_pin = sh_pin.replace(R_NOT_NUMERIC, '');
	}

	$: if(R_NOT_NUMERIC.test(sh_verify)) {
		sh_verify = sh_verify.replace(R_NOT_NUMERIC, '');
	}

	function check_pin(): boolean {
		if(b_locked) return false;

		if(sh_pin) {
			if(sh_pin.length < NL_PIN_MINIMUM) {
				s_err_password = `PIN must be at least ${NL_PIN_MINIMUM} digits`;
				return false;
			}
			else if(sh_pin.length > 10) {
				s_err_password = `PIN should be no more than ${NL_PIN_MAXIMUM} digits`;
				return false;
			}
		}

		s_err_password = '';
		return true;
	}

	function check_verify() {
		if(b_locked) return false;

		if(sh_pin && !s_err_password && sh_pin !== sh_verify) {
			s_err_verify = 'PINs do not match';
			return false;
		}

		s_err_verify = '';
		return true;
	}
</script>

<div class="form flex-rows">
	<Field key="pin" name={s_new_title}>
		<input
			type="password"
			inputmode="numeric"
			maxlength="{NL_PIN_MAXIMUM}"
			placeholder="PIN code between {NL_PIN_MINIMUM} to {NL_PIN_MAXIMUM} digits"
			on:blur={() => check_pin()}
			bind:value={sh_pin}
			disabled={b_disabled}
		>

		{#if s_err_password}
			<div class="validation-message" transition:slide={{duration:300}}>
				{s_err_password}
			</div>
		{/if}
	</Field>

	{#if !b_no_verify}
		<Field key="verify-pin" name={s_verify_title}>
			<input
				type="password"
				inputmode="numeric"
				maxlength="{NL_PIN_MAXIMUM}"
				placeholder="Re-enter same PIN code"
				on:blur={() => check_verify()}
				bind:value={sh_verify}
				disabled={b_disabled}
			>

			{#if s_err_verify}
				<div class="validation-message" transition:slide={{duration:300}}>
					{s_err_verify}
				</div>
			{/if}
		</Field>
	{/if}
</div>