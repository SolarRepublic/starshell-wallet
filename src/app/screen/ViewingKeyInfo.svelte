<script lang="ts">
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import TokensAdd from './TokensAdd.svelte';
	import ShieldKeyhole from '../svg/ShieldKeyhole.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Header from '../ui/Header.svelte';
	
	// import SX_ICON_SHIELD from '#/icon/shield-keyhole.svg?raw';

	const {
		k_page,
	} = load_page_context();
</script>

<style lang="less">
	div.global_svg-icon.shield-logo {
		margin: 1em auto;
		--icon-diameter: 128px;
		--svg-color-fg: var(--theme-color-graymed);
	}

	h3 {
		margin-top: 0.25em !important;
	}

	p {
		margin-bottom: 0.5em !important;
	}
</style>

<Screen>
	<Header title='Viewing Keys' pops search account />

	<div class="global_svg-icon shield-logo">
		<ShieldKeyhole />
	</div>

	<hr>

	<h3>What are Viewing Keys?</h3>
	<p>
		Tokens are private on Secret Network. A <em>Viewing Key</em> is a password that lets one view a token's balance and history.
		It can be shared with apps or other users to give them viewing access to a particular token's holdings.
	</p>

	<hr>

	<h3>Why do I need to create one?</h3>
	<p>
		Your wallet stores Viewing Keys for retrieving current token balance, its history, as well as for allowing apps to do the same.
	</p>

	<hr>

	<h3>What happens if I lose them?</h3>
	<p>
		In the event of data loss, <b>StarShell will restore all of your viewing keys automatically</b>.
		This is another unique feature of the StarShell wallet.
	</p>

	<br>

	<ActionsLine back contd={{creator:TokensAdd}} confirm={['Next']} />
</Screen>
