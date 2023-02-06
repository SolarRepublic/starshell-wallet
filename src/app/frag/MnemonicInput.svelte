<script lang="ts">
	import {createEventDispatcher} from 'svelte';
	
	import {Bip39, load_word_list} from '#/crypto/bip39';
	import {microtask} from '#/util/belt';
	import {qsa} from '#/util/dom';

	const dispatch = createEventDispatcher();

	/**
	 * Reference to mnemonic indicies array
	 */
	export let atu16_indicies: Uint16Array;

	/**
	 * Index of word within the indicies array
	 */
	export let i_index: number;

	/**
	 * If set, the input should be empty and readonly
	 */
	export let b_locked = false;

	/**
	 * If set, then the input is readonly
	 */
	export let b_readonly = false;

	/**
	 * Indicates that that given word does not exist, nor is a prefix in the word list
	 */
	export let b_absent = false;

	/**
	 * Indicates that the given word is valid
	 */
	export let b_valid = false;

	let dm_input: HTMLInputElement;

	let s_word = '';

	let i_refine_lo = 0;
	let i_refine_hi = 0;

	$: if(b_locked) {
		s_word = '';
	}


	let A_WORDLIST: string[] = [];
	(async function load() {
		// ensure wordlist is loaded
		A_WORDLIST = await load_word_list();

		// access index
		const i_word = atu16_indicies[i_index];

		// index is out of bounds
		if(i_index > A_WORDLIST.length) return;

		// lookup word
		s_word = A_WORDLIST[i_word] || '';

		// set initial search limit
		i_refine_hi = A_WORDLIST.length - 1;
	})();

	// in readonly mode, update word when indicies change
	$: if(b_readonly) {
		if(A_WORDLIST && i_index <= 24) {
			// access index
			const i_word = atu16_indicies[i_index];
	
			// lookup word
			s_word = A_WORDLIST[i_word] || '';
	
			// set initial search limit
			i_refine_hi = A_WORDLIST.length - 1;
		}
		else {
			s_word = '';
		}
	}

	let s_checked = '';
	let s_prediction = '';

	function reset() {
		i_refine_lo = 0;
		i_refine_hi = A_WORDLIST.length - 1;
		s_checked = s_prediction = '';
	}


	function predict_typeahead() {
		// reset absent-ness on input
		b_absent = false;

		// normalize and propagate to siblings on paste
		{
			const a_words = s_word.trim().split(/\s+/g);
			s_word = a_words[0];

			if(a_words.length > 1) {
				(async() => {
					let i_sibling = 0;
					for(const s_sibling of a_words.slice(1)) {
						const dm_sibling = sibling(++i_sibling);
						dm_sibling.focus();
						await microtask();
						dm_sibling.value = s_sibling;
						dm_sibling.dispatchEvent(new Event('input'));
						await microtask();
						dm_sibling.dispatchEvent(new KeyboardEvent('keydown', {key:' '}));
						await microtask();
					}
				})();

				return;
			}
		}

		// nothing to predict
		if(!s_word) {
			reset();
			return;
		}
		// reset search
		else if(!s_word.startsWith(s_checked)) {
			reset();
		}

		// there is already a prediction
		if(s_prediction) {
			// prediction still applies
			if(s_prediction.startsWith(s_word)) {
				return;
			}
			// prediction does not apply
			else {
				s_checked = s_word;
			}
		}

		// input is unchecked
		if(s_checked !== s_word) {
			// locate would-be position of prefix
			let i_top = i_refine_lo = Bip39.findIndex(s_word, i_refine_lo, i_refine_hi);

			// in-between
			if(!Number.isInteger(i_top)) {
				// snap up
				i_top = Math.ceil(i_top);

				// shift hi
				if(!A_WORDLIST[i_top].startsWith(s_word)) i_refine_lo = i_top += 1;
			}

			// locate hypothetical terminal position
			let i_btm = i_refine_hi = Bip39.findIndex(s_word+'\xff', i_top, i_refine_hi);

			// in-between
			if(!Number.isInteger(i_btm)) {
				// snap down
				i_btm = Math.floor(i_btm);

				// shift lo
				if(!A_WORDLIST[i_btm].startsWith(s_word)) i_refine_hi = i_btm -= 1;
			}

			// update what was last checked
			s_checked = s_word;

			// wordlist hit
			if(i_top === i_btm) {
				// lookup word
				const s_test = A_WORDLIST[i_top];

				// test matches prefix; set prediction and exit
				if(s_test.startsWith(s_word)) {
					s_prediction = s_test;
					return;
				}
			}
		}

		// reset prediction
		s_prediction = '';
	}

	function sibling(n_delta=+1): HTMLInputElement {
		const a_inputs = qsa(dm_input.closest('.screen')!, '.item input:not(:disabled)');
		const i_self = a_inputs.indexOf(dm_input);
		const dm_next = a_inputs[(i_self+n_delta) % a_inputs.length];
		return dm_next;
	}

	function accept_typeahead(d_event: KeyboardEvent) {
		if(' ' === d_event.key) {
			if(s_prediction) s_word = s_prediction;
			d_event.preventDefault();
			sibling(+1).focus();
		}
		else if(s_prediction) {
			if('Enter' === d_event.key || 'Tab' === d_event.key) {
				s_word = s_prediction;
			}
		}
	}

	function blur_input() {
		// clear prediction
		s_prediction = '';

		// normalize
		s_word = (s_word || '').trim().normalize('NFKD').toLocaleLowerCase();

		// locate word in wordlist
		const i_word = Bip39.findIndex(s_word);

		// set absent flag if word not in list
		b_absent = !Number.isInteger(i_word);

		// overwrite value at index
		if(!b_absent && !b_readonly) {
			b_valid = true;
			atu16_indicies[i_index] = i_word;
		}
		else {
			b_valid = false;
		}

		dispatch('change');
	}
</script>

<style lang="less">
	@import '../_base.less';

	.mnemonic-word {
		display: inline-block;
		width: calc(100% - 2.5em);
		position: relative;

		>* {
			position: absolute;
			bottom: -8px;
			left: 0;
			width: 100%;
			box-sizing: border-box;
			padding: 3px 6px;
		}
	}

	input {
		border: none;
		background-color: transparent;

		&:focus {
			outline: 1px solid var(--theme-color-primary);
			border-radius: 4px;
			outline-offset: 0px;
		}

		&.user-input {
			color: var(--theme-color-text-light);
		}

		&.prediction {
			// color: var(--theme-color-text-med);
			color: var(--theme-color-graysoft);
		}
	}

</style>

<span class="mnemonic-word">
	<input type="text" spellcheck="false" autocomplete="false"
		class="atypical prediction"
		disabled
		bind:value={s_prediction}
	>
	<input type="text" spellcheck="false" autocomplete="false"
		disabled={b_readonly}
		class="atypical user-input"
		bind:this={dm_input}
		bind:value={s_word}
		on:input={predict_typeahead}
		on:keydown={accept_typeahead}
		on:blur={blur_input}
		on:click={() => {
			if(s_prediction) {
				s_word = s_prediction;
			}
		}}
	>
</span>
