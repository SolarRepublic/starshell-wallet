<script lang="ts">

	import SX_ICON_ASTRONAUT from '#/icon/user-astronaut.svg?raw';
	import { getContext } from 'svelte';
	import { ThreadId } from '../def';
	import { yw_navigator } from '../mem';
	import type { Page } from '../nav/page';
	import { Screen, Header } from './_screens';

	export let reset = false;
	const b_reset = reset;

	const k_page = getContext<Page>('page');

	function cont() {
		if(b_reset) {
			k_page.reset();
			void $yw_navigator.activateThread(ThreadId.TOKENS);
		}
		else {
			k_page.pop();
		}
	}
	</script>
	
	<style lang="less">
		.icon {
			padding-top: 25%;
		}
	</style>
	
	<Screen>
		<Header pops
			title="Not yet available"
		/>
	
		<h3>
			Nothing to see here!
		</h3>
	
		<p>
			This screen has not yet been implemented.
		</p>
	
		<p>
			Please continue exploring the beta.
		</p>
	
		<center>
			<span class="icon">
				{@html SX_ICON_ASTRONAUT}
			</span>
		</center>
	
		<div class="action-line">
			<button class="primary" on:click={() => cont()}>
				Continue
			</button>
		</div>
	</Screen>