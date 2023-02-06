<script lang="ts">
	import {slide} from 'svelte/transition';
	
	import {yw_context_popup, yw_popup, yw_progress} from '../mem';
	import {make_progress_timer} from '../svelte';
	
	import {Argon2, Argon2Type} from '#/crypto/argon2';
	import {Bip39} from '#/crypto/bip39';
	import {ATU8_DUMMY_PHRASE, ATU8_SHA256_STARSHELL} from '#/share/constants';
	import {F_NOOP, microtask, timeout} from '#/util/belt';
	import {open_external_link} from '#/util/dom';
	
	import MnemonicInput from './MnemonicInput.svelte';
	import PopupExportFile from '../popup/PopupExportFile.svelte';
	import PopupProcessing from '../popup/PopupProcessing.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_DOWNLOAD from '#/icon/download.svg?raw';
	import SX_ICON_GEAR from '#/icon/settings.svg?raw';
	import SX_ICON_UPLOAD from '#/icon/upload.svg?raw';
	
	
	
	export let atu16_indicies: Uint16Array = new Uint16Array(24).fill(0xff_ff);

	export let b_readonly = false;

	export let b_valid = false;

	export let i_reveal = 0xff_ff;

	let b_revealing = 0xff_ff !== i_reveal;

	export let nl_words = 24;

	export let sh_extension = '';
	export let s_hint = '';

	const nl_indicies = atu16_indicies.length;
	const nl_rows = Math.floor(nl_indicies / 2);

	const a_absents = new Array(nl_rows).fill(false);
	const a_valids = new Array(nl_rows).fill(false);

	const N_GROUPS = 2;
	const N_WORDS_PER_GROUP = 3;
	const atu16_indicies_fake = crypto.getRandomValues(new Uint16Array(24 * N_GROUPS * N_WORDS_PER_GROUP)).map(n => n % 2048);
	const atu8_noise = crypto.getRandomValues(new Uint8Array(24 * N_GROUPS));

	function noise(i_word: number): number[] {
		return Array.from({
			length: atu8_noise[i_word] % N_WORDS_PER_GROUP,
		}, (w, i_pos) => i_word+i_pos);
	}

	let b_tooltip_showing = false;
	
	async function export_backup(atu8_phrase: Uint8Array) {
		// loading
		$yw_popup = null;

		await timeout(10);

		let x_progress = 0;

		// estimate time to complete hashing
		let xt_estimate = 0;
		{
			$yw_context_popup = {
				status: 'Estimating time to complete...',
				progress: 0.01,
			};

			$yw_popup = PopupProcessing;

			// perform sample
			{
				const xt_start = Date.now();
				await Argon2.hash({
					type: Argon2Type.Argon2id,
					phrase: ATU8_DUMMY_PHRASE,
					salt: ATU8_SHA256_STARSHELL,
					hashLen: 32,
					memory: 1 << 10,
					iterations: 1,
				});
				const xt_elapsed = Date.now() - xt_start;
				xt_estimate = xt_elapsed * 64;
			}

			$yw_context_popup = {
				status: 'Hardening password...',
				progress: x_progress=0.02,
			};
		}

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

		// mnemonic length
		const g_exported = await Bip39.exportIndicies(() => atu16_indicies, atu8_phrase);

		// done processing
		f_done();

		// close popup
		$yw_popup = null;

		// download file
		{
			const d_blob = new Blob([JSON.stringify(g_exported, null, '\t')], {type:'octet/stream'});
			const d_url = URL.createObjectURL(d_blob);
			const dm_a = document.createElement('a');
			dm_a.href = d_url;
			dm_a.download = 'starshell-wallet-mnemonic.json';
			dm_a.click();
		}
	}

	function show_export_popup() {
		$yw_context_popup = {
			title: 'Save Mnemonic to Encrypted File',
			save(atu8_phrase: Uint8Array) {
				void export_backup(atu8_phrase);
			},
		};

		$yw_popup = PopupExportFile;
	}

	let dm_input_file: HTMLInputElement;

	// TODO: finish implementing
	function import_file() {
		const a_files = Array.from(dm_input_file.files || []);
		console.log(a_files);
		debugger;
	}
	
	function inputs_changed() {
		b_valid = false;
		const b_valid_words = a_valids.slice(0, nl_words).every(b => b);

		if(b_valid_words) {
			const atu16_indicies_test = atu16_indicies.slice(0, nl_words);

			const kn_expanded = Bip39.inndiciesToExpanded(atu16_indicies_test);
			(async() => {
				if(await Bip39.validateExpanded(kn_expanded)) {
					b_valid = true;
				}
			})();
		}
	}

	let b_advanced = false;
	function toggle_advanced() {
		b_advanced = !b_advanced;
		if(!b_advanced) sh_extension = '';
	}
</script>

<style lang="less">
	@import '../_base.less';

	.mnemonic {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mnemonic-words {
		.hide-scrollbar();

		flex: 0;

		display: flex;
		flex-direction: row;
		gap: 2em;

		>.column {
			flex: 1;
			gap: 0.5em;
			display: grid;

			>.item {
				border-bottom: 1px solid fade(@theme-color-graymed, 20%);

				>.index {
					width: 1.5em;
					display: inline-block;
					text-align: center;
					color: var(--theme-color-text-med);
				}

				>.word {
					color: var(--theme-color-text-light);
				}

				&.warning {
					border-bottom-color: var(--theme-color-caution);

					>.index {
						color: var(--theme-color-caution);
					}
				}
			}
		}

		border-radius: var(--ui-border-radius);
		border: 1px dashed var(--theme-color-border);
		padding: var(--ui-padding);
		padding-top: calc(var(--ui-padding) * 0.6);
		padding-bottom: calc(var(--ui-padding) * 0.6);
	}

	.controls {
		display: flex;
		justify-content: space-between;
		font-size: 13px;

		>.wordlist {
			>.wordlist-title {
				color: var(--theme-color-text-med);
			}

			>.wordlist-value {
				border: 1px solid var(--theme-color-border);
				padding: 2px 6px;
				background-color: rgba(0,0,0,0.2);
			}
		}
	}

	.upload {
		position: relative;
		width: fit-content;

		input[type="file"] {
			position: absolute;
			width: 100%;
			opacity: 0;
		}
	}

	.extras {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		font-size: 12px;

		span {
			vertical-align: bottom;
		}
	}

	.advanced {
		display: flex;
		flex-direction: column;
		gap: var(--ui-padding);
	}
</style>

<div class="mnemonic">

	{#if !b_revealing}
		<div class="controls">
			<span class="title">
				Mnemonic Seed Phrase 
				<Tooltip bind:showing={b_tooltip_showing}>
					{#if b_readonly}
						Record your mnemonic seed phrase onto a physical medium, such as by writing it down. This phrase unlocks access to all your accounts, so keep it in a safe place.
						<br><br>
						Do NOT copy to your clipboard. We advise to NOT store this digitally. If you must, use the "export" feature to store an encrypted copy.
					{:else}
						Type your full mnemonic into the form below. Use tab or space bar to advance to the next input. Pasting and importing are also supported.
					{/if}
					<br><br>
					Only the <span class="link" on:click={() => open_external_link('https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt')}>english BIP-39 wordlist</span> is currently supported.
				</Tooltip>
			</span>

			<span class="wordlist">
				<span class="wordlist-title">
					wordlist:
				</span>
				<span class="wordlist-value">
					ENGLISH
				</span>
			</span>
		</div>
	{/if}

	<div class="mnemonic-words">
		{#each Array.from({length:2}, (w, i) => i) as i_group}
			<div class="column">
				{#each atu16_indicies.subarray(0, nl_rows) as xb_index, i_sub}
					{@const i_word = i_sub+(i_group * nl_rows)}
					{@const b_lock = i_word >= nl_words}

					<!-- create a random amount of fake inputs around each actual input to mitigate attacks on browser's field cache -->
					{#each noise(i_word * 2) as i_fake}
						<div class="display_none">
							<MnemonicInput atu16_indicies={atu16_indicies_fake} i_index={i_fake} />
						</div>
					{/each}

					<div class="item" class:warning={a_absents[i_word]} class:opacity_20%={b_lock || (b_revealing && i_word > i_reveal)}>
						<span class="index">
							{i_word+1}.
						</span>
						<MnemonicInput atu16_indicies={atu16_indicies} i_index={i_word >= i_reveal? 0xff_ff: i_word}
							b_readonly={b_readonly || b_lock}
							b_locked={b_lock}
							bind:b_valid={a_valids[i_word]}
							bind:b_absent={a_absents[i_word]}
							on:change={inputs_changed}
						/>
					</div>

					{#each noise((i_word * 2) + 1) as i_fake}
						<div class="display_none">
							<MnemonicInput atu16_indicies={atu16_indicies_fake} i_index={i_fake} />
						</div>
					{/each}
				{/each}
			</div>
		{/each}
	</div>

	{#if !b_revealing}
		<div class="extras text-align_right">
			<span class="link" on:click={toggle_advanced}>
				<span class="global_svg-icon icon-diameter_18px">
					{@html SX_ICON_GEAR}
				</span>
				<span>
					Advanced
				</span>
			</span>

			{#if b_readonly}
				<!-- <span class="link" on:click={show_export_popup}>
					<span class="global_svg-icon icon-diameter_18px">
						{@html SX_ICON_DOWNLOAD}
					</span>
					<span>
						Save to backup file
					</span>
				</span> -->
			{:else}
				<span class="upload link" on:click={() => F_NOOP}>
					<input type="file" name="import-mnemonic"
						bind:this={dm_input_file}
						accept="application/json,text/plain"
						on:change={import_file}
					/>
				</span>
			{/if}
		</div>

		{#if b_advanced}
			<div class="advanced" transition:slide={{duration:300}}>
				<Field name="Extension passphrase">
					<input type="text"
						placeholder="Leave blank if unsure"
						bind:value={sh_extension}
					>
				</Field>

				<Field name="Passphrase hint (optional)">
					<input type="text"
						placeholder="To help recall the above passphrase"
						bind:value={s_hint}
					>
				</Field>
			</div>
		{/if}
	{/if}
</div>

<Curtain on:click={() => b_tooltip_showing = false} />
