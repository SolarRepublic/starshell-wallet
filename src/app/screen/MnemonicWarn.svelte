<script lang="ts">
	import Screen from '../container/Screen.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
    import Header from '../ui/Header.svelte';

</script>

<Screen progress={[4, 5]}>
	<Header bare title='Disclaimer about 12-word mnemonic'
	/>

	<p>
		In order to provide the best security for your funds, and for generations to come, it it recommended that you create a new seed phrase using a 24-word mnemonic and transfer your assets to that account.
	</p>

	<ActionsLine contd={} />
</Screen>
