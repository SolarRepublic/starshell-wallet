<script lang="ts">
	import type {AccountPath} from '#/meta/account';
	
	import {yw_context_popup, yw_popup} from '../mem';
	
	import {open_flow} from '#/script/msg-flow';
	
	import SenderSelect from '../frag/SenderSelect.svelte';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	
	import ProgressBar from '../ui/ProgressBar.svelte';

	function cancel() {
		$yw_popup = null;
	}

	let p_account: AccountPath;

	function open_solver() {
		void open_flow({
			flow: {
				type: 'solver',
				value: {
					accountPath: p_account,
				},
				page: null,
			},
			open: {
				popout: true,
			},
		});
	}
</script>

<h3>
	<span class="red-card" /> Unlock the "Red Card"
</h3>

<div>
	<p>
		You found an Easter Egg! From here, you can unlock the "Red Card".
	</p>

	<p>
		Red Card holders may become eligible to access certain features or promotions in the future.
	</p>

	<hr>

	<Field key='account' name='Choose an account with at least 1 SCRT'>
		<SenderSelect p_chain={`/family.cosmos/chain.secret-4`} bind:accountPath={p_account} />
	</Field>

	<p>
		Per our Privacy Policy, your address and public key will NOT be retained by our servers.
		Instead, your wallet will submit a verifiable signature which cannot be traced back to your account, but will allow you to later prove ownership.
	</p>

	<p>
		To unlock the Red Card you must run the solver until it completes, but you can cancel at anytime.
	</p>
</div>

<ActionsLine {cancel} confirm={['Run Solver', open_solver]} />
