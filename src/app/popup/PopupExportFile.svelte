<script lang="ts">
	import {yw_context_popup, yw_popup} from '../mem';
	
	import {text_to_buffer} from '#/util/data';
	
	import NewPassword from '../frag/NewPassword.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';

	const g_context = $yw_context_popup as {
		title?: string;
		once?: boolean;
		save: (atu8: Uint8Array) => void;
	};

	export let s_title = g_context.title || 'Export to encrypted file';

	const b_busy = false;
	let sh_phrase = '';
	let b_password_acceptable = false;

	let c_resets = 0;

	function confirm() {
		// create runtime phrase from input
		const atu8_phrase = text_to_buffer(sh_phrase);

		// clear fields
		c_resets++;

		// callback
		g_context.save(atu8_phrase);
	}

	// update the confirm action
	$: a_confirm_action = ['Save to Downloads', confirm, !b_password_acceptable] as const;


	function form_submit(d_event: Event) {
		// reject attempt
		if(!b_password_acceptable) return;

		// accept attempt
		confirm();

		return false;
	}

	function form_keydown(d_event: KeyboardEvent) {
		// enter key was pressed; submit form
		if('Enter' === d_event.key) {
			form_submit(d_event);
		}
	}
</script>

<h3>
	{s_title}
</h3>

Enter a password to encrypt this file with. It can be different than your wallet password.

<form on:submit|preventDefault={form_submit} on:keydown={form_keydown}>
	<NewPassword b_disabled={b_busy} c_resets={c_resets} b_once={g_context.once || false}
		bind:sh_phrase={sh_phrase} bind:b_acceptable={b_password_acceptable}
		/>
</form>

<ActionsLine cancel={() => $yw_popup = null} confirm={a_confirm_action} />
