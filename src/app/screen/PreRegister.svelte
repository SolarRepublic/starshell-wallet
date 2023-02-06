<script lang="ts">
	import {Screen} from './_screens';

	import {load_page_context} from '../svelte';
	
	import {PublicStorage} from '#/extension/public-storage';
	
	import Register from './Register.svelte';
	import UpgradeBeta from './UpgradeBeta.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Horizon from '../ui/Horizon.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';
	

	const {
		k_page,
	} = load_page_context();

	(async() => {
		try {
			const g_seen = await PublicStorage.lastSeen();

			if(g_seen && !g_seen.version.startsWith('1.')) {
				k_page.push({
					creator: UpgradeBeta,
				});
			}
		}
		catch(e_seen) {}
	})();
</script>

<style lang="less">
	@import '../../style/util.less';

	:global(.preregister) {
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

		padding-top: calc(50vh - 150px);
	}

	.large {
		display: flex;
		flex-direction: column;
		gap: 1em;
	}
</style>

<Screen root classNames='preregister'>
	<StarShellLogo dim={96} />

	<StarShellTitle />

	<Horizon />

	<div class="large">
		<div>Welcome to the only wallet extension that puts privacy and security above all else.</div>
		<div>Please allow 10 - 20 minutes to complete the set up process.</div>
	</div>

	<ActionsLine confirm={['Get Started']} contd={{creator:Register}} />
</Screen>
