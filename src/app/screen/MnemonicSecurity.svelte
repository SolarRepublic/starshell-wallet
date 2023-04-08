<script lang="ts">
	import type {SecretPath} from '#/meta/secret';
	
	import {yw_navigator} from '../mem';
	import {estimate_pin_hash, load_flow_context} from '../svelte';
	
	import type RuntimeKey from '#/crypto/runtime-key';
	import {Secrets} from '#/store/secrets';
	import {F_NOOP, microtask, timeout} from '#/util/belt';
	import {concat, sha256d, text_to_buffer, uuid_v4, zero_out} from '#/util/data';
	
	import AccountCreate from './AccountCreate.svelte';
	import Screen from '../container/Screen.svelte';
	import LoadingAnimation from '../frag/LoadingAnimation.svelte';
	import SeedIdentity from '../frag/SeedIdentity.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import PinInput from '../ui/PinInput.svelte';
	import ProgressBar from '../ui/ProgressBar.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	

	export let kr_mnemonic: RuntimeKey;

	export let kr_precursor: RuntimeKey;

	export let s_hint_extension = '';

	export let b_imported = false;

	export let b_use_pin = false;

	let b_busy = false;

	let sh_pin = '';
	let sh_password = '';
	let b_pin_valid = false;
	let b_lock_pins = false;

	let s_hint_pin = '';

	let s_status = '';
	let x_progress = 0;

	const {
		k_page,
		completed,
		a_progress,
		next_progress,
	} = load_flow_context();

	// 22 words
	const A_NICK_ADJECTIVES = `
		Artificial Asymmetric Benevolent Combatant Constructive Cooperative Delinquent Destructive Elusive Genuine Holographic Incandescent Local Loyal Malignant Planar Reactive Remote Solid Symmetric Trusted Virtual
	`.trim().split(/\s+/g);

	// 64 words
	const A_NICK_PREFIXES = `
		Arn Av Ber Blis Cat Cen Cer Civ Cosm Cry Dark Deep Dig Dread Ech Eter Exob Expl Extr Fict Gal Gany Gorg Hyper Inter Jup Keth Kill Lum Luna Mar Meg Merc Moon Myst Nebr Nova Noz Omic Orb Para Plut Por Quas Redg Ring Rub Sapp Shad Solar Spin Star Stel Terr Tron Utop Vela Ven Vix Wasp Worm Xen Yarr Zeph
	`.trim().split(/\s+/g);

	// 26 words
	const A_NICK_SUFFIXES = `
		ace ator ax cil craft cyte eer ex fir fold gate gen ian icle ine inex ite ium oid on ose ous scape tem ward wave yne zone
	`.trim().split(/\s+/g);


	// combines items from 3 wordlists using the hash of the mnemonic 'package' to create a human-readable nickname
	let s_mnemonic_nickname = '';
	async function generate_nickname() {
		// hash the package
		const atu8_hash = await kr_precursor.access(atu8_precursor => kr_mnemonic.access(async(atu8_mnemonic) => {
			// prep package buffer
			const atu8_package = concat([atu8_precursor, atu8_mnemonic]);

			// return hash result
			return await sha256d(atu8_package);
		}));

		// use hash to pick nickname
		const dv_hash = new DataView(atu8_hash.buffer);
		const i_adject = dv_hash.getUint16(0, false) % A_NICK_ADJECTIVES.length;
		const i_prefix = dv_hash.getUint16(2, false) % A_NICK_PREFIXES.length;
		const i_suffix = dv_hash.getUint16(4, false) % A_NICK_SUFFIXES.length;

		// concatenate parts to produce nickname string
		s_mnemonic_nickname = A_NICK_ADJECTIVES[i_adject]+' '+A_NICK_PREFIXES[i_prefix]+A_NICK_SUFFIXES[i_suffix];
	}

	let n_seconds = 3;

	// initiailize
	(async function load() {
		await generate_nickname();

		if(!b_use_pin) {
			let i_interval = 0;
			setTimeout(() => {
				i_interval = (globalThis as typeof window).setInterval(() => {
					n_seconds -= 1;
				}, 1e3);
			}, 0.25e3);

			// give user quick moment to cancel
			await timeout(3.25e3);

			clearInterval(i_interval);

			// still active page
			if(k_page === $yw_navigator.activePage) {
				void save_mnemonic();
			}
		}
	})();
	

	async function save_mnemonic() {
		// lock ui
		b_busy = true;

		let p_secret: SecretPath<'mnemonic'>;

		// no security
		if(!b_use_pin) {
			p_secret = await kr_precursor.access(atu8_precursor => kr_mnemonic.access(async(atu8_mnemonic) => {
				// prep package buffer
				const atu8_package = concat([atu8_precursor, atu8_mnemonic]);

				// save mnemonic package to storage
				return await Secrets.put(atu8_package, {
					type: 'mnemonic',
					uuid: uuid_v4(),
					hint: s_hint_extension,
					name: s_mnemonic_nickname,
					origin: b_imported? 'imported': 'created',
					security: {
						type: 'none',
					},
				});
			}));
		}
		else {
			s_status = 'Hashing PIN';
			x_progress = 0;

			// collect hash sample
			const xt_estimate = await estimate_pin_hash();

			// update total progress
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

			// hash PIN
			const atu8_pin = text_to_buffer(sh_pin);

			// free pin string
			b_lock_pins = true;

			// encryption step
			s_status = 'Encrypting seed phrase';

			// access both runtime keys
			p_secret = await kr_precursor.access(atu8_precursor => kr_mnemonic.access(async(atu8_mnemonic) => {
				// prep package buffer
				const atu8_package = concat([atu8_precursor, atu8_mnemonic]);

				// encrypt with pin
				const [atu8_encrypted, g_security] = await Secrets.encryptWithPop(atu8_package, atu8_pin, 'pin');

				// done with hashing and encryption
				f_done();

				// save mnemonic package to storage
				return await Secrets.put(atu8_encrypted, {
					type: 'mnemonic',
					uuid: uuid_v4(),
					hint: s_hint_extension,
					name: s_mnemonic_nickname,
					origin: b_imported? 'imported': 'created',
					security: {
						...g_security,
						hint: s_hint_pin,
					},
				});
			}));

			zero_out(atu8_pin);
		}

		// // verify 
		// await Secrets.borrow(p_secret, async(kn_encrypted, g_secret) => {
		// 	const atu8_decrypted = await Secrets.decryptWithPin(kn_encrypted.data, atu8_pin, g_secret.security as SecretSecurity.Struct<'pin'>);
		// 	debugger;
		// 	console.log(atu8_decrypted);
		// });

		// wipe secret material
		kr_mnemonic.destroy();
		kr_precursor.destroy();

		// done
		if(completed) {
			completed(true);
		}
		else {
			k_page.reset();

			await microtask();

			// open account create screen
			$yw_navigator.activePage.push({
				creator: AccountCreate,
				props: {
					p_mnemonic_selected: p_secret,
				},
				context: next_progress(a_progress, +0),
			});
		}
	}

	let b_tooltip_showing = false;
</script>

<style lang="less">
</style>


<Screen progress={a_progress}>
	{#if b_use_pin}
		<Header plain
			title='Set a PIN code for this mnemonic seed'
		/>

		<div>
			<SeedIdentity s_nickname={s_mnemonic_nickname}>
				<Tooltip bind:showing={b_tooltip_showing}>
					This is a nickname generated for your mnemonic seed phrase. It will be used to reference this mnemonic and distinguish it from others.
				</Tooltip>
			</SeedIdentity>
		</div>

		<p>
			A short PIN encrypts your seed phrase with an additional layer of security.
			It will only be required when creating new accounts or exporting the mnemonic.
		</p>

		<PinInput bind:sh_pin bind:b_valid={b_pin_valid} b_disabled={b_busy} b_locked={b_lock_pins} />

		<Field name='PIN hint (optional)'>
			<input type="text"
				autocomplete="off"
				bind:value={s_hint_pin}
			>
		</Field>

		{#if s_status}
			<p>
				{s_status}
			</p>

			<ProgressBar {x_progress} />
		{/if}

		<ActionsLine back confirm={['Save', save_mnemonic, !b_pin_valid || b_busy]} />
	{:else}
		<h3>
			Saving seed in {n_seconds}...
		</h3>

		<div class="flex_1">
			<SeedIdentity s_nickname={s_mnemonic_nickname}>
				<Tooltip bind:showing={b_tooltip_showing}>
					This is a nickname generated for your mnemonic seed phrase. It will be used to reference this mnemonic and distinguish it from others.
				</Tooltip>
			</SeedIdentity>
		</div>

		<section>
			<LoadingAnimation />
		</section>

		<ActionsLine disabled={b_busy} back confirm={['Saving', F_NOOP, true]} />
	{/if}

	<Curtain on:click={() => b_tooltip_showing = false} />
		
</Screen>