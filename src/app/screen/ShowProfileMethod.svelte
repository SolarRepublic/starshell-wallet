<script lang="ts">
	import type {ChainStruct} from '#/meta/chain';
	
	import {getContext} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import type {PageInfo} from '#/script/messages';
	import type {AppProfile} from '#/store/apps';
	import {G_APP_STARSHELL} from '#/store/apps';
	import '#/chain/cosmos-network';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	
	
	export let profile: AppProfile;

	export let page: PageInfo;

	const {
		k_page,
		completed,
	} = load_flow_context<string>();

	const g_chain = getContext<ChainStruct>('chain');

	function close() {
		completed(false, 'surrender');
	}

</script>

<style lang="less">
	@import '../_base.less';

	.ui-snippet {
		text-align: center;

		>span {
			position: relative;
		}

		&.for-toolbar {
			.preview {
				height: 45px;
			}

			.arrow {
				position: absolute;
				right: 0;
				height: 63px;
				transform: translate(-34px, 15px) scale(1, -1) rotate(-48deg)
			}
		}

		&.for-menu {
			.preview {
				width: min(75%, 400px);
			}

			.annotation {
				position: absolute;
				left: -7%;
				width: 115%;
				bottom: -6px;
				aspect-ratio: 6;
			}
		}
	}
</style>

<Screen>
	<AppBanner app={G_APP_STARSHELL} chains={[g_chain]}>
		<span slot="default" style="display:contents;">
			Creating a Browser New Profile
		</span>

		<span slot="context" style="display:contents;">
			Allows you to use both Keplr and StarShell
		</span>
	</AppBanner>

	<hr class="no-margin">

	<p>
		This procedure will guide you through setting up two profiles in your browser so that you can use Keplr in one profile, and StarShell in the other.
	</p>

	<div class="ui-snippet for-toolbar">
		<span>
			<img class="preview" src="/media/vendor/chrome-profiles.png" alt="Preview of where to find your browser's profile button">
			<img class="arrow" src="/media/vendor/arrow.png">
		</span>
	</div>

	<p>
		First, find the profile button in the top right corner of your Chrome window.
	</p>
	
	<div class="ui-snippet for-menu">
		<span>
			<img class="preview" src="/media/vendor/chrome-profiles-new.png" alt="Preview of where to find your browser's profile button">
			<img class="annotation" src="/media/vendor/elliptic-annotation.png">
		</span>
	</div>

	<p>
		Next, click "Add" at the bottom of the popup.
	</p>

	<p>
		Follow the prompts to create a new profile.
	</p>

	<p>
		Finally, install StarShell (or Keplr) under your new browser profile.
	</p>

	<ActionsLine back confirm={['Done', close]} />
</Screen>
