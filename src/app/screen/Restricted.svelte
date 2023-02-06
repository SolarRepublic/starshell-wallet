<script lang="ts">
	import {Screen} from './_screens';

	import {F_NOOP} from '#/util/belt';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Horizon from '../ui/Horizon.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';

	export let f_override: VoidFunction = F_NOOP;

	let c_override_clicks = 0;

	$: if(c_override_clicks >= 20) {
		f_override();
	}
</script>

<style lang="less">
	@import '../../style/util.less';

	:global(.restricted) {
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 20px;
		padding-left: 16px;
		padding-right: 16px;
		background-repeat: no-repeat;
		background-position: center top;
		background-size: cover;

		padding-top: calc(35vh - 150px);
	}

	.large {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}
</style>

<Screen root classNames='restricted'>
	<StarShellLogo dim={96} on:click={() => c_override_clicks++} />

	<StarShellTitle />

	<Horizon />

	<div class="large">
		<div>StarShell has issued an urgent restriction on the version you are currently running.</div>
		<div>This restriction prevents you from running this version of the wallet. Depending on the reason, this restriction might be temporary but is most likely permanent.</div>
	</div>

	<ActionsLine confirm={['Restart to check for Update', () => {
		chrome.runtime?.reload?.();
	}]} />
</Screen>
