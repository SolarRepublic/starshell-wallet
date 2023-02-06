<script lang="ts">
	import {Screen} from './_screens';
	import {yw_progress} from '../mem';
	import {load_flow_context, make_progress_timer} from '../svelte';
	
	import Log, {Logger} from '#/app/ui/Log.svelte';
	import {Vault, N_ARGON2_ITERATIONS, NB_ARGON2_MEMORY} from '#/crypto/vault';
	import {PublicStorage} from '#/extension/public-storage';
	import {
		login,
		register,
	} from '#/share/auth';
	
	import {ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR} from '#/share/constants';
	import {AlreadyRegisteredError, InvalidPassphraseError} from '#/share/errors';
	
	import {open_external_link} from '#/util/dom';
	
	import RegisterWeakPasswordSvelte from './RegisterWeakPassword.svelte';
	import NewPassword from '../frag/NewPassword.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';


	// will be set if this is part of a flow
	const {
		k_page,
		completed,
	} = load_flow_context();

	// bindings
	let s_error = '';
	let s_info = '';

	let sh_phrase = '';
	let b_password_acceptable = false;

	let c_resets = 0;

	// time started registration
	let xt_start = 0;

	// logger instace
	let k_logger = new Logger();

	// log to logger
	function log(s_msg: string) {
		k_logger = k_logger.event(s_msg, Date.now() - xt_start);
	}

	// update the confirm action
	$: a_confirm_action = ['Continue', prepare_register, !b_password_acceptable] as const;

	// download top 10k list and parse it
	const dp_passwords = (async() => {
		const d_res = await fetch('/data/passwords-top-10k.txt');
		const s_list = await d_res.text();
		return s_list.split('\n');
	})();

	// prepare to register
	async function prepare_register() {
		// check against top 10k list
		const a_passwords = await dp_passwords;

		// password found in list
		if(a_passwords.includes(sh_phrase)) {
			k_page.push({
				creator: RegisterWeakPasswordSvelte,
				props: {
					attempt_register,
					password: sh_phrase,
				},
			});
		}
		// password not in list
		else {
			await attempt_register();
		}
	}

	// registration is busy
	let b_busy = false;
	
	// attempt to register
	async function attempt_register(s_password?: string): Promise<1> {
		// restore password from caller
		if(s_password) sh_phrase = s_password;

		// invalid state
		if(!b_password_acceptable) return 1;

		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const f_exit = (): 1 => {
			$yw_progress = [0, 0];
			b_busy = false;
			return 1;
		};

		// reset error
		s_error = '';

		// start timer
		xt_start = Date.now();

		// initialize progress to 1%
		$yw_progress = [1, 100];

		log('Estimating time to complete');

		// set hash params
		const g_params = (await PublicStorage.hashParams({
			iterations: N_ARGON2_ITERATIONS,
			memory: NB_ARGON2_MEMORY,
		}))!;

		// estimate time to complete
		let f_cancel!: VoidFunction;
		let xt_estimate = 0;
		{
			// start timing
			const xt_start_est = window.performance.now();

			// simulate a single iteration
			await Vault.deriveRootBitsArgon2(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, {
				...g_params,
				iterations: 1,
			});

			// stop timing
			const xt_finish_est = window.performance.now();

			// estimate total time required based on doing hash twice in serial
			const xt_elapsed = xt_finish_est - xt_start_est;
			xt_estimate = 2 * (xt_elapsed * g_params.iterations);
			log(`About ${(xt_estimate / 1e3).toFixed(1)} seconds`);

			// update progress based on sample
			$yw_progress = [5, 100];
	
			s_info = ' ';
			if(xt_estimate > 10e3) {
				const n_minutes = Math.ceil(xt_estimate / 1e3 / 60);
				s_info = `This could take up to ${n_minutes} minute${1 === n_minutes? '': 's'}.`;
			}

			f_cancel = make_progress_timer({
				estimate: xt_estimate,
				range: [5, 100],
			});
		}

		// restore password from caller (again, after restore wiped it)
		if(s_password) sh_phrase = s_password;

		// attempt to register
		try {
			await register(sh_phrase, log);
		}
		// handle error
		catch(e_register) {
			s_info = '';

			if(e_register instanceof AlreadyRegisteredError) {
				s_error = 'A passphrase is already registered';
			}
			else if(e_register instanceof InvalidPassphraseError) {
				s_error = 'Invalid passphrase';
			}
			else {
				s_error = `Unexpected error occurred while attempting to register:\n${e_register.stack || e_register.message}`;
			}

			// cancel progress 
			f_cancel();

			//  exit
			return f_exit();
		}

		log('Verifying passphrase');

		// attempt login
		try {
			await login(sh_phrase, false, log);
		}
		// failed to verify
		catch(e_login) {
			s_info = '';
			s_error = `Failed to verify passphrase immediately after registration:\n${e_login.stack}`;

			// reset vault
			await Vault.eraseBase();

			// cancel progress 
			f_cancel();

			// exit
			return f_exit();
		}

		// cancel progress
		f_cancel();

		log('Done');

		// proceed
		s_info = '';
		s_error = 'Success';

		// complete
		if(completed) completed(true);

		// done
		return f_exit();
	}

	let b_agreed_tos = false;
	let b_agreed_pp = false;
</script>

<style lang="less">
	@import '../../style/util.less';

	.registration-info {
		text-align: center;
		margin-left: auto;
		margin-right: auto;
	}

	.intro {
		margin-top: 1em;
		margin-bottom: 0;

		.lead {
			margin-top: 1em;
			margin-bottom: 0;
		}

		.title {
			letter-spacing: 1px;
			font-weight: 100;
			font-size: 27px;
			color: #d0d0d0;
			margin: 0;

			em {
				font-size: 32px;
				font-style: normal;
			}
		}

		.logo {
			height: 34vh;
			width: auto;
		}

		.icon {
			--svg-color-fg: silver;
			width: calc(100% - 60px);
			height: auto;

			.graphic({
				:global(&) {
					width: 172px;
					height: 137px;
					margin: 10px 0;
				}
			});

			>svg {
				:global(&) {
					margin: 0;
				}
			}
		}
		
	}

	.narrow {
		color: var(--theme-color-text-med);
		font-weight: 300;
		max-width: 18em;
	}

	.agree-tos {
		display: flex;
		flex-direction: column;
		gap: 8px;

		font-size: 13px;
		margin-bottom: 8px;
		color: var(--theme-color-text-med);
	}
</style>

<Screen>
	<center>
		<div class="intro">
			<StarShellLogo dim={96} />

			<StarShellTitle width={150} />
		</div>

		<p class="narrow">
			Create a new password for signing into your wallet.
		</p>
	</center>

	<NewPassword b_disabled={b_busy} bind:sh_phrase={sh_phrase} bind:b_acceptable={b_password_acceptable} bind:c_resets={c_resets} />

	{#if s_info}
		<div class="registration-info">
			{s_info}<br>
			Do not leave this screen
		</div>
	{/if}

	<Log latest bind:items={k_logger.items} />

	{#if s_error}
		<pre>{s_error}</pre>
	{/if}

	<ActionsWall>
		<div class="agree-tos" on:click={toggleChildCheckbox}>
			<CheckboxField id="tos" disabled={b_busy} bind:checked={b_agreed_tos}>
				<span class="text-align_left">
					I have read agree to the <span class="link" on:click|stopPropagation={() => open_external_link('https://starshell.net/terms-of-service.html')}>Terms of Service</span>.
				</span>
			</CheckboxField>
			<CheckboxField id="pp" disabled={b_busy} bind:checked={b_agreed_pp}>
				<span class="text-align_left">
					I have read and agree to the <span class="link" on:click|stopPropagation={() => open_external_link('https://starshell.net/privacy-policy.html')}>Privacy Policy</span>.
				</span>
			</CheckboxField>
		</div>

		<button class="primary" disabled={!b_password_acceptable || !b_agreed_tos || !b_agreed_pp || b_busy} on:click={() => prepare_register()}>
			Continue
		</button>
	</ActionsWall>
</Screen>
