<script lang="ts">
	import {onDestroy} from 'svelte';
	import {slide} from 'svelte/transition';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {yw_popup, yw_progress} from '../mem';
	import {load_flow_context, make_progress_timer} from '../svelte';
	
	import ActionsLine from '#/app/ui/ActionsLine.svelte';
	import Field from '#/app/ui/Field.svelte';
	import Log, {Logger} from '#/app/ui/Log.svelte';
	import {NB_ARGON2_MEMORY, N_ARGON2_ITERATIONS, Vault} from '#/crypto/vault';
	
	import {P_POPUP} from '#/extension/browser';
	import {PublicStorage} from '#/extension/public-storage';
	import {global_receive} from '#/script/msg-global';
	import {login} from '#/share/auth';
	
	import {ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, B_DEVELOPMENT, B_FIREFOX_ANDROID, B_WITHIN_WEBEXT_POPOVER} from '#/share/constants';
	import {CorruptedVaultError, InvalidPassphraseError, RecoverableVaultError, UnregisteredError} from '#/share/errors';
	import {stringify_params} from '#/util/dom';
	
	import PopupFactoryReset from '../popup/PopupFactoryReset.svelte';
	

	// will be set if part of flow
	const {
		completed,
	} = load_flow_context();

	// password value binding
	let sh_password = '';

	// password error
	let s_err_password = '';

	// busy attempting unlock
	let b_busy = false;

	// listen for login events
	const f_relase = global_receive({
		login() {
			// from external sources
			if(!b_busy) {
				// job is done
				login_success();
			}
		},
	});

	onDestroy(() => {
		// release global listener
		f_relase();
	});

	// success
	function login_success() {
		// release global listener
		f_relase();

		// escape the popup modal on firefox for android
		if(B_FIREFOX_ANDROID && B_WITHIN_WEBEXT_POPOVER) {
			chrome.tabs?.create({
				url: `${P_POPUP}?${stringify_params({
					within: 'tab',
				})}`,
			}, () => {
				globalThis.close();
			});
		}
		else if(completed) {
			completed(true);
		}
	}

	let xt_start = 0;
	let k_logger = new Logger();
	function log(s_msg: string) {
		k_logger = k_logger.event(s_msg, Date.now() - xt_start);
	}

	async function attempt_unlock(b_recover=false, fk_sample?: (xt_estimate: number) => void): Promise<1> {
		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => (b_busy = false, 1);  // eslint-disable-line no-sequences

		// reset error
		s_err_password = '';

		// start timer
		xt_start = Date.now();

		log('Estimating time to complete');

		// fetch hash params
		let g_params = await PublicStorage.hashParams();

		// not there
		if(!g_params) {
			// attempt to recover with default values
			try {
				g_params = (await PublicStorage.hashParams({
					iterations: N_ARGON2_ITERATIONS,
					memory: NB_ARGON2_MEMORY,
				}))!;
			}
			catch(e_restore) {
				throw syserr(e_restore as Error);
			}

			s_err_password = 'Vault is partially corrupted (missing hash params); attempting to sign in with recovered params...';
		}

		// estimate time to complete
		{
			// warm worker before timing
			await Vault.deriveRootBitsArgon2(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, {
				...g_params,
				iterations: 2,
			});

			// time a trial run
			const xt_start_est = window.performance.now();
			await Vault.deriveRootBitsArgon2(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, {
				...g_params,
				iterations: 2,
			});
			const xt_finish_est = window.performance.now();
			const xt_elapsed = xt_finish_est - xt_start_est;

			// the hashing happens twice, once for the decryption key, and again for the new encryption key
			const xt_estimate = xt_elapsed * g_params.iterations;  // parallelization multiplier
			fk_sample?.(xt_estimate);
			console.log(`Estimating ${(xt_estimate / 1e3).toFixed(1)} seconds; elapsed sample was ${xt_elapsed}`);
		}

		// attempt login
		try {
			const xt_start_est = window.performance.now();
			await login(sh_password, b_recover, log);
			console.debug(`Actual login took ${Math.round(window.performance.now() - xt_start_est)/1e3} seconds`);
		}
		// handle error
		catch(e_login) {
			if(e_login instanceof UnregisteredError) {
				s_err_password = 'No accounts detected';
			}
			else if(e_login instanceof InvalidPassphraseError) {
				s_err_password = 'Invalid passphrase';
			}
			else if(e_login instanceof RecoverableVaultError) {
				s_err_password = 'Vault is partially corrupted; attempting recovery...';
				return await attempt_unlock(true, fk_sample);
			}
			else if(b_recover) {
				s_err_password = `Recovery failed. Vault may be irreparably corrupted.\n${e_login.message!}`;
			}
			else if(e_login instanceof CorruptedVaultError) {
				s_err_password = `Vault appears to be irreparably corrupted.\n${e_login.message}`;
			}
			else {
				s_err_password = `Unknown error occurred: ${e_login.stack || e_login.message}`;
			}

			// exit
			return exit();
		}

		// success
		login_success();

		// exit
		return exit();
	}

	let b_factory_reset_showing = false;
	let c_logo_clicks = 0;
	function logo_click() {
		if(B_DEVELOPMENT && ++c_logo_clicks >= 2) {
			sh_password = ' '.repeat(8);
			void attempt_unlock();
		}

		if(++c_logo_clicks >= 5) {
			b_factory_reset_showing = true;
		}
	}

	async function track_unlock() {
		$yw_progress = [1, 100];
		let f_cancel!: VoidFunction;

		await attempt_unlock(true, (xt_estimate) => {
			$yw_progress = [5, 100];

			f_cancel = make_progress_timer({
				estimate: xt_estimate,
				range: [5, 100],
			});
		});

		f_cancel();
	}
</script>

<style lang="less">
	@import '../../style/util.less';

	.welcome {
		:global(&) {
			align-items: center;
			justify-content: center;
			text-align: center;
			gap: 20px;
			padding-left: 16px;
			padding-right: 16px;
			// padding-top: calc(50vh - 200px);
			padding-top: calc((0.45 * var(--app-window-height)) - 132px);  // 132px is half the computed height of the login prompt
		}

		form&.screen {
			:global(&) {
				background-image: url('/media/vendor/orb-1.svg');
				background-repeat: no-repeat;
				background-position: center top;
				background-size: cover;
			}
		}

		>div {
			&.logo,&.title {
				:global(&) {
					margin-left: auto !important;
					margin-right: auto !important;
				}
			}
		}
	}


	.large {
		.font(big);
	}

	p {
		.font(regular);
		padding: 8px 0;
	}

	.line {
		width: calc(100% - 40px);
		height: 1px;
		background: radial-gradient(50% 50% at 50% 50%, #FFC700 0%, rgba(255, 199, 0, 0) 100%);
	}

	.actions-line {
		width: 100%;
	}

	.off-screen {
		position: absolute;
		top: calc(var(--app-window-width) * 100);
	}
</style>

{#if false}
	<span
		class:welcome={true}
	/>
{/if}

<Screen debug='Authenticate' classNames='welcome'>
	<div class="logo" on:click={() => logo_click()}>
		<img width="96"
			alt="StarShell"
			src="/media/vendor/logo-96px.png"
			srcset="/media/vendor/logo-192px.png 2x"
		>
	</div>

	<div class="title">
		<img src="/media/vendor/title.svg" alt="" />
	</div>

	<div class="line">&nbsp;</div>

	<div class="form flex-rows">
		<Field key="password" name="">
			<!-- svelte-ignore a11y-autofocus -->
			<input
				type="password"
				name="password"
				autofocus
				placeholder="Password"
				disabled={b_busy}
				bind:value={sh_password}
				class:invalid={s_err_password}
			/>

			{#if s_err_password}
				<div class="validation-message" transition:slide={{duration:300}}>
					{s_err_password}
				</div>
			{/if}
		</Field>
	</div>

	{#if b_factory_reset_showing}
		<ActionsLine noPrimary confirm={['Factory Rest', () => {
			$yw_popup = PopupFactoryReset;
		}]} />
	{/if}

	<ActionsLine confirm={['Unlock', track_unlock, b_busy]} />

	<Log bind:items={k_logger.items} hide />

</Screen>
