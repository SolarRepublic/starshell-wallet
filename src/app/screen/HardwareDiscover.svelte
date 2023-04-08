<script lang="ts" context="module">
	export interface HardwareSetupIntent {
		id: 'setup-new-device';
		props?: JsonObject;
		context?: JsonObject;
	}
</script>
<script lang="ts">
	import type {JsonObject, Nilable} from '#/meta/belt';
	
	import type {DevicePath, HardwareVendor} from '#/meta/device';
	
	import {Header, Screen} from './_screens';
	import {yw_context_popup, yw_popup} from '../mem';
	import {load_flow_context} from '../svelte';
	
	import {LedgerDevice} from '#/crypto/ledger';
	
	import {B_SUPPORTS_LEDGER} from '#/share/constants';
	import {Devices} from '#/store/devices';
	import {F_NOOP, microtask, timeout} from '#/util/belt';
	
	
	import GuideQrConnect from './GuideQrConnect.svelte';
	import HardwareController from './HardwareController.svelte';
	import LedgerLinkAccounts from './LedgerLinkAccounts.svelte';
	import PopupNotice from '../popup/PopupNotice.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	
	

	const {
		k_page,
		completed,
		a_progress,
		next_progress,
	} = load_flow_context<DevicePath>();

	export let g_intent: HardwareSetupIntent | null = null;

	export let si_autoload: HardwareVendor | '' = '';

	let b_tooltip_showing = false;

	let s_error = '';

	async function search_ledger() {
		s_error = '';

		if(!B_SUPPORTS_LEDGER) {
			$yw_context_popup = {
				title: 'Ledger not supported here',
				infos: [
					`Firefox does not allow extensions to use USB devices.`,
					`Ledger devices on desktop require a Chromium-based browser.`,
				],
			};

			$yw_popup = PopupNotice;
			return;
		}

		let g_request: Nilable<LedgerDevice>;
		try {
			g_request = await LedgerDevice.request();
		}
		catch(e_request) {
			s_error = e_request.message;

			console.warn({e_request});
			return;
		}

		if(g_request) {
			const g_dev = g_request.transport.device;

			const g_device = Devices.fromUsbDevice(g_dev);

			g_device.features.wallet = {};

			const p_device = await Devices.put(g_device);

			if(g_intent) {
				if('setup-new-device' === g_intent.id) {
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
										context: next_progress(),
									});
								},
							],
						},
						context: next_progress(),
					});
				}
			}
			// no intent, respond to flow
			else {
				completed?.(true, p_device);

				await timeout(1e3);

				window.close();
			}
		}
	}

	function search_keystone() {
		k_page.push({
			creator: GuideQrConnect,
			props: {
				si_guide: 'keystone',
			},
		});
	}

	function notice_other() {
		$yw_context_popup = {
			title: 'Other hardware wallets',
			infos: [
				`We strive to support any hardware wallet compatible with Cosmos chains.`,
				`As of now, there are a very limited number of vendors that support Cosmos.`,
			],
		};

		$yw_popup = PopupNotice;
	}


	function cancel() {
		completed?.(false);
	}

	// auto-load
	(async function init() {
		await microtask();

		if('keystone' === si_autoload) {
			search_keystone();
		}
	})();
</script>

<style lang="less">
	@import '../_base.less';

	.vendors {
		display: flex;
		gap: 16px;

		.vendor {
			background-color: fade(black, 20%);
			padding: 8px 12px;
			border: 1px solid var(--theme-color-border);

			cursor: pointer;

			width: 192px;
			height: 72px;
			display: flex;
			box-sizing: border-box;

			>* {
				width: 100%;

				&.other {
					font-size: 20px;
					font-style: italic;
					display: flex;
					align-items: center;
					justify-content: center;
				}
			}
		}
	}
</style>

<Screen progress={a_progress}>
	<Header plain
		title="Manage hardware devices"
	/>

	<p>
		Select the type of device from below:
	</p>

	<div class="vendors">
		<div class="vendor" on:click={search_ledger}>
			<img style="filter:invert(1);" src="/media/other/ledger.svg" width="200" alt="Ledger">
		</div>

		<div class="vendor" on:click={search_keystone}>
			<img src="/media/other/keystone.svg" width="200" alt="Keystone">
		</div>

		<div class="vendor" on:click={notice_other}>
			<div class="other">
				Other
			</div>
		</div>
	</div>

	<div class="error-text">
		{s_error}
	</div>

	<div style="flex:1;"></div>

	<ActionsLine cancel={cancel} confirm={['Next', F_NOOP, true]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>