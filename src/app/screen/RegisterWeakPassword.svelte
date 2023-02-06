<script lang="ts">
	import {Screen} from './_screens';
	
	import {load_page_context} from '../svelte';
	
	import ActionsLine from '../ui/ActionsLine.svelte';


	export let attempt_register: (s_password: string) => void;

	export let password: string;

	// copy to memory in order to pass back
	const s_password = password;

	export let weakness: number;

	// get page from context
	const {k_page} = load_page_context();

	function use_anyway() {
		attempt_register(s_password);
		k_page.pop();
	}
</script>

<Screen>
	<h3>
		Weak Password Warning
	</h3>

	<p>
		The password you entered was found on a list of the top ten thousand most commonly used passwords.
	</p>

	<p>
		In order to help prevent the loss of funds, you are encouraged to create a strong, unique password.
	</p>

	<p>
		How do you want to proceed?
	</p>

	<ActionsLine cancel='pop' confirm={['Use anyway', use_anyway]} wait={5000} />
</Screen>