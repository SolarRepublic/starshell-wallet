<script lang="ts">
	import {syserr} from '../common';
	import {load_page_context} from '../svelte';
	
	import {Bip39, load_word_list} from '#/crypto/bip39';
	import RuntimeKey from '#/crypto/runtime-key';
	import {crypto_random_int, random_int, shuffle, timeout} from '#/util/belt';
	
	import {zero_out} from '#/util/data';
	
	import MnemonicSecurity from './MnemonicSecurity.svelte';
	import Screen from '../container/Screen.svelte';
	import Mnemonic from '../frag/Mnemonic.svelte';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	

	import SX_ICON_CHECK from '#/icon/tiny-check.svg?raw';


	export let atu16_indicies: Uint16Array;

	export let kr_precursor: RuntimeKey;

	export let s_hint_extension: string;

	export let b_extension = false;
	
	export let b_use_pin = false;

	let i_current = 0;

	let i_avoid = 0;

	const atu16_fake = new Uint16Array(atu16_indicies.length - 1);

	const {k_page, a_progress, next_progress} = load_page_context();

	let dm_challenge: HTMLElement;
	let b_complete = false;

	let A_WORDLIST: string[];
	(async function load() {
		// ensure wordlist is loaded
		A_WORDLIST = await load_word_list();

		prepare_challenge();
	})();


	let a_challenge: string[] = [];
	function prepare_challenge() {
		atu16_fake.set(atu16_indicies.subarray(0, i_current), 0);
		atu16_fake.set(atu16_indicies.subarray(i_current+1), i_current);

		// populate challenge with correct response, 2 fakes from mnemonic and 1 random from wordlist
		const a_prechallenge = shuffle([
			atu16_indicies[i_current],
			...shuffle(atu16_fake).slice(0, 2),
			crypto_random_int(A_WORDLIST.length),
		]);

		// aovid putting correct word in the cell user just clicked
		if(i_avoid >=0 && atu16_indicies[i_current] === a_prechallenge[i_avoid]) {
			a_prechallenge.reverse();
		}

		// convert into text
		a_challenge = a_prechallenge.map(i_word => A_WORDLIST[i_word]);
	}

	const a_mnemonic: string[] = [];
	async function answer(s_response: string, i_cell: number) {
		// lookup word
		const i_response = Bip39.findIndex(s_response);

		if(i_response === atu16_indicies[i_current]) {
			i_avoid = -1;

			i_current += random_int(3, 6);

			if(i_current >= atu16_indicies.length) {
				zero_out(atu16_fake);

				b_complete = true;

				// automatically advance to next screen
				await timeout(500);
				void next();
				return;
			}

			prepare_challenge();

			const d_classes = (dm_challenge.childNodes[i_cell] as HTMLElement).classList;
			dm_challenge.classList.add('nodding');
			d_classes.add('flashing');

			await timeout(200);

			if(dm_challenge) {
				dm_challenge.classList.remove('nodding');
				d_classes.remove('flashing');
			}
		}
		else {
			dm_challenge.classList.add('shaking');
			await timeout(150);

			// avoid that cell
			i_avoid = i_cell;

			// shuffle challenge
			i_current = i_current;

			prepare_challenge();
			await timeout(150);
			dm_challenge.classList.remove('shaking');
		}
	}


	async function next() {
		// convert indicies to expanded
		const kn_expanded = Bip39.inndiciesToExpanded(atu16_indicies.slice(0, atu16_indicies.length));

		// double check checksum; protecting against false valid flag
		if(!await Bip39.validateExpanded(kn_expanded)) {
			throw syserr({
				title: `Mnemonic checksum failure`,
			});
		}

		// complete transformation into padded mnemonic and create runtime key
		const kr_mnemonic = await RuntimeKey.create(async() => {
			const kn_mnemonic = await Bip39.expandedToPaddedMnemonic(kn_expanded);

			return kn_mnemonic.data;
		}, Bip39.maxMnemonicBufferSize() << 3);

		k_page.push({
			creator: MnemonicSecurity,
			props: {
				kr_mnemonic,
				kr_precursor,
				s_hint_extension,
				b_use_pin,
			},
			context: next_progress(),
		});
	}
</script>

<style lang="less">
	@import '../_base.less';

	@keyframes shake {
		0%, 100% {
			transform: translateX(0);
		}

		10%, 20%, 50%, 70%, 90% {
			transform: translateX(-3px);
		}

		20%, 40%, 60%, 80% {
			transform: translateX(3px);
		}
	}

	@keyframes nod {
		0%, 100% {
			transform: translateY(0);
		}

		25% {
			transform: translateY(4px);
		}
	}

	.challenge {
		display: grid;
		grid-template-columns: 50% 50%;
		text-align: center;
		gap: 1px;
		// flex-basis: calc(100% - 520px);
		// max-height: 16.5%;

		&.complete {
			display: none;
		}

		&.shaking {
			>.cell {
				animation-name: shake;
				animation-timing-function: linear;
				animation-iteration-count: 1;
				animation-duration: 300ms;
				pointer-events: none;
			}
		}

		&.nodding {
			>.cell {
				animation-name: nod;
				animation-timing-function: var(--ease-out-cubic);
				animation-iteration-count: 1;
				animation-duration: 200ms;
			}
		}

		>.cell {
			padding: 1em 0;
			min-height: 00px;
			outline: 1px solid var(--theme-color-border);
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 2px;

			.hint() {
				color: var(--theme-color-primary);
				position: relative;
				display: inline-block;
				width: 0;
			}

			&.hint::before {
				.hint();
				content: '>>';
				left: -20px;
			}

			&.hint::after {
				.hint();
				content: '<<';
			}

			@keyframes flashing {
				0% {
					border-color: transparent;
				}

				100% {
					border-color: var(--theme-color-primary);
				}
			}
			
			&.flashing {
				animation: flashing 100ms linear infinite alternate;
				border: 1px solid transparent;
			}

			&:active {
				border: 1px solid var(--theme-color-primary);
				margin-top: -1px;
				margin-bottom: -2px;

				&:nth-child(n+2) {
					margin-top: -2px;
				}
			}

			>.index {
				color: var(--theme-color-text-med);
				padding-right: 0.5ex;
			}

			&:nth-child(1) {
				border-top-left-radius: 4px;
			}

			&:nth-child(2) {
				border-top-right-radius: 4px;
			}

			&:nth-child(3) {
				border-bottom-left-radius: 4px;
			}

			&:nth-child(4) {
				border-bottom-right-radius: 4px;
			}
		}
	}
</style>

<Screen progress={a_progress}>
	<Mnemonic b_readonly i_reveal={i_current}
		bind:atu16_indicies={atu16_indicies}
	/>

	{#if !b_complete}
		<div class="challenge user-select_none"
			class:visibility_hidden={b_complete}
			class:shaking={false}
			class:nodding={false}
			class:hidden={b_complete}
			bind:this={dm_challenge}
		>
			{#each a_challenge as s_challenge, i_cell}
				<span class="cell" on:click={() => answer(s_challenge, i_cell)}
					class:hint={s_challenge === a_mnemonic[i_current]}
					class:flashing={false}
				>
					<span class="index">{i_current+1}.</span>
					{s_challenge}
				</span>
			{/each}
		</div>
	{:else}
		<div class="text-align_center">
			<span class="global_svg-icon icon-diameter_18px">
				{@html SX_ICON_CHECK}
			</span>
			<span>
				Mnemonic seed phrase verified.
			</span>
		</div>

		{#if b_extension}
			<p class="text-align_center">
				Please make sure your custom extension passphrase is securely backed up as well.
			</p>
		{/if}
	{/if}
	

	<ActionsLine back confirm={['Next', next, !b_complete]} />
</Screen>
