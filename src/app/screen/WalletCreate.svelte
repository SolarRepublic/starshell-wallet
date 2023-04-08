<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {B_SUPPORTS_LEDGER} from '#/share/constants';
	
	import GuideWalletImportSelector from './GuideWalletImportSelector.svelte';
	import HardwareController from './HardwareController.svelte';
	import KeystoneHardwareConfigurator from './KeystoneHardwareConfigurator.svelte';
	import LedgerLinkAccounts from './LedgerLinkAccounts.svelte';
	import WalletCreateSoft, {WalletIntent} from './WalletCreateSoft.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	import Curtain from '../ui/Curtain.svelte';

	const {k_page, next_progress} = load_page_context();

	// progress root
	const a_progress: [number, number] = [1, 6];

	// push args forwarded to all 'next' screens
	const gc_push_all = {
		context: next_progress(a_progress),
	};

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;

	let b_tooltip_showing = false;

	function hard_wallet_ledger() {
		k_page.push({
			creator: HardwareController,
			props: {
				a_program: [
					(k_app, k_page_prg, k_prg) => {
						// bypass HardwareController on pop
						k_page_prg.on({
							restore() {
								k_page_prg.pop();
							},
						});

						// move onto linking accounts
						k_page_prg.push({
							creator: LedgerLinkAccounts,
							props: {
								k_app,
							},
							context: next_progress(a_progress, +2),
						});
					},
				],
			},
			...gc_push_all,
		});
	}

	function hard_wallet_keystone() {
		k_page.push({
			creator: KeystoneHardwareConfigurator,
			props: {},
			...gc_push_all,
		});
	}

	function soft_wallet(xc_intent: WalletIntent) {
		k_page.push({
			creator: WalletCreateSoft,
			props: {
				xc_intent,
				b_mandatory: true,
			},
			...gc_push_all,
		});
	}

	function import_wallet() {
		k_page.push({
			creator: GuideWalletImportSelector,
			...gc_push_all,
		});
	}
</script>

<style lang="less">
</style>

<Screen progress={[1, 6]}>
	<Header plain pops={!b_mandatory}
		title="Create, import, or connect a wallet?"
	/>

	<p>
		
	</p>

	<div class="flex_1" />

	<ActionsWall>
		<button class="primary" on:click={() => soft_wallet(WalletIntent.NEW)}>
			Create new wallet
		</button>

		<button on:click={() => import_wallet()}>
			Import existing wallet
		</button>

		<button disabled={!B_SUPPORTS_LEDGER} on:click={() => hard_wallet_ledger()}>
			Connect Ledger
		</button>

		<button on:click={() => hard_wallet_keystone()}>
			Connect Keystone
		</button>
	</ActionsWall>

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>