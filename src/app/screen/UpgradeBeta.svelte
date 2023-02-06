<script lang="ts">
	import {Screen} from './_screens';

	import {timeout} from '#/util/belt';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Horizon from '../ui/Horizon.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';

	let b_reinstallable = !!(chrome.tabs?.create && chrome.management?.uninstallSelf);

	async function reinstall() {
		await chrome.tabs?.create({
			url: 'https://install.starshell.net/',
			active: false,
		});

		await timeout(25);

		await chrome.management?.uninstallSelf?.();
	}

	let b_accepted = false;
</script>

<style lang="less">
	@import '../../style/util.less';

	:global(.upgrade-beta) {
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 20px;
		padding-left: 16px;
		padding-right: 16px;
		background-image: url('/media/vendor/orb-1.svg');
		background-repeat: no-repeat;
		background-position: center top;
		background-size: cover;

		padding-top: calc(45vh - 150px);
	}

	.large {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}
</style>

<Screen root classNames='upgrade-beta'>
	<StarShellLogo dim={96} />

	<StarShellTitle />

	<Horizon />

	<div class="large">
		<div>Thank you for being a beta tester. The beta testing period has concluded</div>
		<div>Please reinstall the extension in order to upgrade to the public release.</div>
	</div>

	<hr class="no-margin">

	{#if b_reinstallable}
		<CheckboxField id="accept" bind:checked={b_accepted}>
			I am ready to delete all beta data
		</CheckboxField>

		<ActionsLine confirm={['Reinstall', reinstall, !b_accepted]} />
	{/if}
</Screen>
