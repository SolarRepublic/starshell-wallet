<script lang="ts">
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import ActionsLine from '../ui/ActionsLine.svelte';

	const {
		k_page,
	} = load_page_context();

	export let text: string;

	function submit_bug_report() {
		// TODO: implemenet
	}
</script>

<style lang="less">

</style>

<Screen>
	<h3>Fatal Error</h3>
	<p>
		A fatal error has occurred that prevents the wallet from continuing.
	</p>

	<pre class="error-stack"><code>{text}</code></pre>

	<ActionsLine back confirm={['Submit Bug Report', submit_bug_report, false]} />
</Screen>
