<script lang="ts">
	import H_SLIP44S from '@metamask/slip44';
	
	import {R_BIP_44} from '#/share/constants';
	
	import {oderac} from '#/util/belt';
	
	import Field from '../ui/Field.svelte';
	import type {SelectOption} from '../ui/StarSelect.svelte';
	import StarSelect from '../ui/StarSelect.svelte';


	const I_MAX_CHILD = Number((2n ** 32n) - 1n);

	export let s_bip44: string;

	// validation errors
	export let s_err_bip44 = '';

	// path constituents
	let s_coin_type = '';
	let s_account = '';
	let s_change = '';
	let s_address = '';

	// populate select options
	const a_items = oderac(H_SLIP44S, si_slip44 => item_from_slip(si_slip44));

	// input element binding
	let dm_path: HTMLInputElement;

	// select option binding
	let g_option_selected: SelectOption;

	// path validity
	export let b_valid = true;

	// parse bip44 into its contituent levels
	$: {
		// reset validity
		b_valid = false;
		s_err_bip44 = '';

		// path is present
		if(s_bip44) {
			// parse path
			const m_bip44 = R_BIP_44.exec(s_bip44);

			// path is valid
			if(m_bip44) {
				// set validity
				b_valid = true;

				// destructure constiuent levels
				[, s_coin_type, s_account, s_change, s_address] = m_bip44;

				// update select
				g_option_selected = item_from_slip(s_coin_type);
			}
			else {
				s_err_bip44 = 'Invalid BIP44 path';
			}
		}
	}

	// select option updated
	$: if(g_option_selected) {
		s_coin_type = g_option_selected.value;
		backflow();
	}

	// sets the path string from the contituent path values
	function backflow() {
		s_bip44 = `m/44'/${s_coin_type}'/${s_account}'/${s_change}/${s_address}`;
	}

	function item_from_slip(si_slip44: string) {
		const g_slip44 = H_SLIP44S[si_slip44];

		return {
			value: si_slip44,
			primary: `#${si_slip44}: ${g_slip44.symbol}`,
			secondary: g_slip44.name,
		};
	}

	function selection_levels(): [number, number] {
		const [i_lo, i_hi] = (() => {
			const i_start = dm_path.selectionStart || 0;
			const i_end = dm_path.selectionEnd || i_start;
			return i_start <= i_end? [i_start, i_end]: [i_end, i_start];
		})();

		return [
			s_bip44.slice(0, i_hi).split('/').length - 1,
			s_bip44.slice(0, i_lo).split('/').length - 1,
		];
	}

	function select_level(i_level: number) {
		const a_levels = s_bip44.split('/');
		const i_lo = a_levels.slice(0, i_level).join('/').length + 1;
		let i_hi = s_bip44.indexOf('/', i_lo);
		if(-1 === i_hi) i_hi = s_bip44.length;

		dm_path.setSelectionRange(i_lo, i_hi);
	}

	function mutate(s_level: string, n_delta: -1 | 1) {
		return Math.min(Math.max(0, parseInt(s_level) + n_delta), I_MAX_CHILD)+'';
	}

	function mutate_path_at_selection(n_delta: -1 | 1, d_event?: KeyboardEvent) {
		const [i_level_lo, i_level_hi] = selection_levels();

		// do not mutate if selection spans accross levels
		if(i_level_lo !== i_level_hi) return;

		// map level to constituent var
		switch(i_level_lo) {
			case 2: s_coin_type = mutate(s_coin_type, n_delta); break;
			case 3: s_account = mutate(s_account, n_delta); break;
			case 4: s_change = mutate(s_change, n_delta); break;
			case 5: s_address = mutate(s_address, n_delta); break;
			default: break;
		}

		// set path from constituents
		backflow();

		// prevent default
		d_event?.preventDefault();

		// set selection
		queueMicrotask(() => {
			select_level(i_level_lo);
		});
	}

	function input_keydown(d_event: KeyboardEvent) {
		if(!b_valid) return;

		// increment child index
		if('ArrowUp' === d_event.key) {
			mutate_path_at_selection(+1, d_event);
		}
		// decrement child index
		else if('ArrowDown' === d_event.key) {
			mutate_path_at_selection(-1, d_event);
		}
		// move levels
		else if('Tab' === d_event.key) {
			const [i_level_lo, i_level_hi] = selection_levels();

			// moving towards start
			if(d_event.shiftKey) {
				if(i_level_hi > 2) {
					select_level(i_level_lo-1);

					// prevent default
					d_event.preventDefault();
				}
			}
			// moving towards end
			else if(i_level_lo < 5) {
				select_level(i_level_lo+1);

				// prevent default
				d_event.preventDefault();
			}
		}
	}
</script>

<style lang="less">
	.coin-type {
		margin-top: calc(var(--ui-padding) / 2);
	}
</style>

<input type="text"
	bind:this={dm_path}
	bind:value={s_bip44}
	on:keydown={input_keydown}
>

{#if s_err_bip44}
	<span class="validation-message">
		{s_err_bip44}
	</span>
{/if}

<div class="coin-type">
	<Field key='coin-type' name='Coin Type (SLIP-44)'>
		<StarSelect
			items={a_items}
			bind:value={g_option_selected}
			on:select
		/>
	</Field>
</div>
