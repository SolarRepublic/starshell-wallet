<script lang="ts">
	import {slide} from 'svelte/transition';
	
	import {load_page_context} from '../svelte';
	
	import {acceptable} from '#/share/auth';
	import {NL_PASSPHRASE_MAXIMUM, NL_PASSPHRASE_MINIMUM} from '#/share/constants';
	
	import Field from '../ui/Field.svelte';

	const {k_page} = load_page_context();

	export let b_disabled = false;

	/**
	 * If set, prevents browser autocomplete from prompting user to save
	 */
	export let b_once = false;

	export let b_acceptable = false;

	export let c_resets = 0;

	export let s_new_title = 'New password';
	export let s_verify_title = 'Verify password';

	const s_autocomplete = b_once? 'one-time-code': 'new-password';

	// bindings
	export let sh_phrase = '';
	let sh_verify = '';

	export let b_accept_any = false;

	let s_err_password = '';
	let s_err_verify = '';

	// continuously check the acceptability of the password
	$: b_password_acceptable = !!sh_phrase && sh_phrase === sh_verify && (b_accept_any? true: acceptable(sh_phrase));

	$: b_acceptable = b_password_acceptable;

	$: if(c_resets > 0) {
		sh_phrase = sh_verify = '';
	}

	// listen for page event restore
	k_page?.on({
		// clear passwords
		restore: () => c_resets++,
	});

	function check_password(): boolean {
		if(sh_phrase && !acceptable(sh_phrase)) {
			if(sh_phrase.length < NL_PASSPHRASE_MINIMUM) {
				s_err_password = `Password must be at least ${NL_PASSPHRASE_MINIMUM} characters`;
			}
			else if(sh_phrase.length > NL_PASSPHRASE_MAXIMUM) {
				s_err_password = `Password must be ${NL_PASSPHRASE_MAXIMUM} characters or fewer`;
			}
			else {
				s_err_password = 'Password is not acceptable';
			}

			return false;
		}

		s_err_password = '';
		return true;
	}

	function check_verify(): boolean {
		if(sh_phrase && !s_err_password && sh_phrase !== sh_verify) {
			s_err_verify = 'Passwords do not match';
			return false;
		}

		s_err_verify = '';
		return true;
	}

</script>


<div class="form flex-rows">
	<Field key="password" name={s_new_title}>
		<input
			type="password"
			autocomplete={s_autocomplete}
			name="password"
			placeholder="Password"
			on:blur={() => check_password()}
			bind:value={sh_phrase}
			disabled={b_disabled}
		>

		{#if !b_password_acceptable && s_err_password}
			<div class="validation-message" transition:slide={{duration:300}}>
				{s_err_password}
			</div>
		{/if}
	</Field>

	<Field key="verify-password" name={s_verify_title}>
		<input
			type="password"
			autocomplete={s_autocomplete}
			name="verify"
			placeholder="Password"
			on:blur={() => check_verify()}
			bind:value={sh_verify}
			disabled={b_disabled}
		>

		{#if !b_password_acceptable && s_err_verify}
			<div class="validation-message" transition:slide={{duration:300}}>
				{s_err_verify}
			</div>
		{/if}
	</Field>
</div>
