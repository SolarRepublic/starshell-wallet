<script lang="ts" context="module">
	type StatusCallback = (s_status: string, s_context?: string) => void;

	type CancelCallback = (s_error: string) => void;

	export interface ProgramHelper {
		status(s_status: string, s_context?: string, a_tooltip?: string[]): void;
		cancel(s_error: string): void;
		rejected(): void;
		emulate(g_doc: AdaptedStdSignDoc): void;
	}

	export type HardwareWalletExecution = (k_app: LedgerApp, k_page: Page, k_prg: ProgramHelper) => Promisable<void | undefined | ExecutionResponse>;

	export interface ExecutionResponse {
		push?: HardwareWalletExecution[];
	}
</script>
<script lang="ts">
	import type {Page} from './_screens';
	
	import type {LedgerScreenConfig} from '../helper/ledger-screen';
	
	import type {AccountPath, AccountStruct, HardwareAccountLocation, ParsedHardwareAccountLocation} from '#/meta/account';
	import type {Nilable, Promisable} from '#/meta/belt';
	import type {DevicePath, DeviceStruct} from '#/meta/device';
	
	import type {AdaptedStdSignDoc} from '#/schema/amino';
	
	import {
		DisconnectedDeviceDuringOperation,
		StatusCodes,
	} from '@ledgerhq/errors';
	
	import {Header, Screen} from './_screens';
	
	import {load_page_context} from '../svelte';
	
	import {parse_bip44} from '#/crypto/bip44';
	import {parse_hwa} from '#/crypto/hardware-signing';
	import type {AppInfoResponse, ProbeResult, PublicKeyResponse} from '#/crypto/ledger';
	import {SignRejectedError, ERR_CODES, LedgerApp, LedgerDevice} from '#/crypto/ledger';
	import {open_flow} from '#/script/msg-flow';
	import {B_WEBEXT, B_WITHIN_TAB, H_LEDGER_COIN_TYPE_DEFAULTS} from '#/share/constants';
	import {Devices} from '#/store/devices';
	import {timeout, timeout_exec} from '#/util/belt';
	
	import {buffer_to_base64} from '#/util/data';
	
	import {open_external_link} from '#/util/dom';
	
	import LedgerScreen, {H_LEDGER_DEVICE_SCREENS} from '../frag/LedgerScreen.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	
	import Tooltip from '../ui/Tooltip.svelte';
	

	const {k_page, a_progress, next_progress} = load_page_context();

	/**
	 * Series of async callbacks to execute while connected to device
	 */
	export let a_program: HardwareWalletExecution[] = [];

	/**
	 * Device must be owner of given account
	 */
	export let g_account: AccountStruct | null = null;

	export let k_app: LedgerApp | null = null;

	// the device struct owner for the given account
	let g_device_owner: DeviceStruct | null = null;

	let ni_coin = -1;

	let b_tooltip_showing = false;

	let a_tooltip: string[] = [];

	const S_STEP_CONNECT = 'Plug-in your hardware wallet & unlock it';

	let s_step_now = S_STEP_CONNECT;

	let s_context = '';

	const A_STEPS_CORE = [
		'',
		S_STEP_CONNECT,
	];

	const A_STEPS_DEFAULT = [
		...A_STEPS_CORE,
		// 'Follow instructions on your Ledger',
	];

	const a_steps: string[] = [...A_STEPS_DEFAULT];

	const S_STEP_OPEN_APP = 'Open the Cosmos or Secret Network app';
	const S_STEP_FOLLOW_INSTRUCTIONS = 'Follow instructions on your Ledger';
	const S_STEP_UNLOCK = 'Unlock the device using your PIN';

	async function proceed() {
		if(!a_devices_seen.length || !a_devs_live.length) {
			await manage_devices();
		}
	}

	let b_missing_apps = false;

	let k_device: Nilable<LedgerDevice> = k_app?.device;

	let b_connected = false;
	let b_online = false;

	let s_error = '';

	let b_deviceless = false;

	let g_signing: Nilable<AdaptedStdSignDoc>;
	let si_device: 'nanoS' | 'nanoSP' | 'nanoX' | '' = '';

	function reset(e_probe?: Error) {
		// reset device
		k_device = null;

		// reset app
		k_app = null;

		// reset steps
		write_status(S_STEP_CONNECT);

		// reset connection status
		b_connected = b_online = false;

		// error
		if(e_probe?.message) {
			s_error = e_probe.message;
		}

		// retry
		setTimeout(() => {
			void load();
		}, 1e3);
	}
	
	function write_status(s_status: string, _s_context='', _a_toolip: string[]=[]) {
		s_step_now = s_status;
		s_context = _s_context;
		a_tooltip = _a_toolip;
		g_signing = null;
	}

	async function use_device(si_app: string) {
		if(!k_device) return reset();

		write_status('Please wait a moment');

		if(!k_app) k_app = await LedgerApp.open(k_device, si_app);

		si_device = (k_device?.transport.deviceModel?.id || '') as typeof si_device;

		if(g_hwa) {
			// ask device for corresponding public key
			let g_get: PublicKeyResponse;
			try {
				g_get = await k_app.getPublicKey(H_LEDGER_COIN_TYPE_DEFAULTS[ni_coin].hrp, parse_bip44(g_hwa.bip44));
			}
			catch(e_get) {
				s_error = e_get.message;
				throw e_get;
			}

			if(g_get.error) {
				s_error = g_get.error;
				throw new Error(s_error);
			}

			if(g_account?.pubkey !== buffer_to_base64(g_get.publicKey)) {
				s_error = `Wrong device. Mismatching public key.`;
				return;
			}
		}

		await run_program();
	}

	async function suggest_open(d_dev: USBDevice, si_app: string, f_not_found?: () => Promisable<boolean|void>): Promise<boolean> {
		// instruct user to follow prompt
		write_status(`Follow prompt to open ${si_app} App`);

		// try opening app
		try {
			// attempt to open the app
			await k_device!.open(si_app);

			// wait a moment
			await timeout(750);

			// get the app info
			const g_app_info = await k_device!.virInfo() as AppInfoResponse;

			// success; proceed
			if(!g_app_info.error) {
				void use_device(g_app_info.name);
				return true;
			}
		}
		catch(e_open) {
			// app not installed
			if(ERR_CODES.APP_NOT_FOUND === e_open.statusCode) {
				// let callback handle
				return await f_not_found?.() || false;
			}
			// user refused
			else if(StatusCodes.USER_REFUSED_ON_DEVICE === e_open.statusCode) {
				write_status(`Open the ${si_app} app`);

				await timeout(3e3);

				void scan(d_dev, si_app);
				return true;
			}
			// device disconnected
			else if(e_open instanceof DisconnectedDeviceDuringOperation) {
				reset();

				return true;
			}
			else {
				debugger;
				console.warn(e_open);
			}
		}

		return false;
	}

	let b_aborted = false;
	function abort() {
		b_aborted = true;
	}

	let b_rejected = false;
	async function run_program() {
		// page is no longer active; retire
		if(b_aborted) return;

		if(!k_app) reset();

		b_connected = b_online = true;

		// cache program
		const a_program_retry = a_program.slice();

		b_aborted = true;

		/* eslint-disable @typescript-eslint/no-loop-func */
		while(a_program.length) {
			const f_exec = a_program[0];
			a_program = a_program.slice(1);

			let b_cancelled = false;

			let z_exec!: Nilable<ExecutionResponse> | void;
			try {
				z_exec = await f_exec?.(k_app!, k_page, {
					status: write_status,

					cancel(s_err) {
						b_cancelled = true;
						s_error = s_err;
					},

					rejected() {
						b_rejected = b_cancelled = true;
						write_status('User rejected request');

						// restore original program for retry
						a_program = a_program_retry;
					},

					emulate(g_doc) {
						g_signing = g_doc;
					},
				});
			}
			catch(e_run) {
				if(e_run instanceof SignRejectedError) {
					b_rejected = b_cancelled = true;

					write_status('User rejected request');

					// restore original program for retry
					a_program = a_program_retry;
				}
				else {
					s_error = e_run.message;
				}

				return;
			}

			if(b_cancelled) {
				return;
			}

			if(z_exec?.push) {
				a_program = [...a_program, ...z_exec.push];
			}
		}
		/* eslint-enable */
	}

	async function click_device(g_device: DeviceStruct) {
		// device already selected
		if(k_device) return;

		a_devs_live = await navigator.usb.getDevices();

		if(a_devs_live.length > 1) {
			for(const d_dev of a_devs_live) {
				if(LedgerDevice.match(Devices.fromUsbDevice(d_dev), g_device)) {
					return await scan(d_dev);
				}
			}
		}

		// refresh
		void load();
	}

	type USBDevice = Awaited<ReturnType<Navigator['usb']['requestDevice']>>;

	async function scan(d_dev: USBDevice, si_app_prefer='') {
		if(!k_device) k_device = await LedgerDevice.connect(d_dev);

		// wrong app
		const si_app_expect = ni_coin >=0? H_LEDGER_COIN_TYPE_DEFAULTS[ni_coin].app: '';

		// device is connected
		if(k_device) {
			b_connected = true;

			// promote step text to unlock while waitig for probe to return
			if(S_STEP_CONNECT === s_step_now) {
				write_status(S_STEP_UNLOCK);
			}

			// begin probe
			const dp_probe = k_device.probe();

			// allow some time for a response
			const z_resolved = await Promise.race([
				dp_probe,
				timeout(1e3).then(() => Symbol('timeout')),
			]);

			// presume probe result
			let g_probe = z_resolved as ProbeResult;

			// timed out
			if('symbol' === typeof z_resolved) {
				write_status(`Device is busy; exit app or reset`);

				// wait for probe to finish
				g_probe = await dp_probe;
			}

			// not OK
			if(!g_probe.ok) return reset();

			// device is online
			if(g_probe.info) {
				b_online = true;

				// user has an app loaded
				if(ERR_CODES.NOT_IN_DASHBOARD === g_probe.info.code) {
					// try cosmos/secret app version
					try {
						const g_version = await k_device.appVersion();

						// no errors
						if(!g_version.error) {
							// device is locked
							if(g_version.locked) {
								write_status(S_STEP_UNLOCK);

								await timeout(1e3);
								return void scan(d_dev);
							}
							// device is not locked
							else {
								// fetch app info
								const g_app = await k_device.virInfo() as AppInfoResponse;

								// no error
								if(!g_app.error) {
									// a specific app is required
									if(si_app_expect && g_app.name !== si_app_expect) {
										b_online = false;

										write_status(`Quit the ${g_app.name} app, then open ${si_app_expect}`);

										await timeout(1e3);
										return void scan(d_dev);
									}

									return use_device(g_app.name);
								}
							}
						}
					}
					catch(e_version) {
						debugger;
						console.warn({e_version});
					}

					if(si_app_expect) {
						b_online = false;

						write_status(`Open the ${si_app_expect} app`);
					}
					else {
						write_status(S_STEP_OPEN_APP);
					}

					try {
						// get the app info
						const g_app_info = await k_device.virInfo() as AppInfoResponse;

						// secret network or cosmos app
						if(['Secret', 'Cosmos'].includes(g_app_info?.name || '') && (!si_app_expect || si_app_expect === g_app_info?.name)) {
							return use_device(g_app_info.name);
						}
						// some other app
						else {
							b_online = false;
							write_status(`Exit out of the ${g_app_info?.name || 'current'} app`);
						}

						return;
					}
					catch(e_app) {
						debugger;
						console.warn({e_app});
					}
				}
				// user is in dashboard
				else {
					b_online = false;

					// still waiting for user to open app manually
					if(si_app_prefer) {
						await timeout(1e3);

						return scan(d_dev, si_app_prefer);
					}

					// Secret app
					if(!si_app_expect || 'Secret' === si_app_expect) {
						if(await suggest_open(d_dev, 'Secret')) return;
					}

					// Cosmos app
					if(!si_app_expect || 'Cosmos' === si_app_expect) {
						if(await suggest_open(d_dev, 'Cosmos', () => {
							// suggest Secret Network app
							b_missing_apps = true;

							write_status('Install a supported app to your Ledger');
						})) return;
					}
				}
			}
			// device is on lockscreen or dashboard
			else {
				b_online = false;
				write_status(S_STEP_UNLOCK);

				debugger;



				await timeout(1e3);

				return await scan(d_dev);

				// const y_app = await LedgerApp.open(k_device, 'Cosmos');

				// try {
				// 	if(await y_app.isLocked()) {
				// 		i_progress = 2;
				// 	}
				// 	else {
				// 		i_progress = 3;
				// 	}
				// }
				// catch(e_check) {
				// 	if(e_check instanceof TransportStatusError) {
				// 		// app is not open
				// 		if(0x6e01 === e_check['statusCode']) {
				// 			i_progress = 3;
				// 			debugger;
				// 			await timeout(1e3);

				// 			return await load();
				// 		}
				// 	}

				// 	debugger;

				// 	console.error({
				// 		e_check,
				// 	});
				// }

				// console.log({k_device, y_app});
			}
		}
		else {
			// reset progress
			write_status(S_STEP_CONNECT);

			setTimeout(() => {
				void scan(d_dev);
			}, 750);
		}
	}

	async function manage_devices() {
		const g_request = await open_flow({
			flow: {
				type: 'requestDevice',
				value: {
					props: {
						g_intent: {
							id: 'setup-new-device',
						},
					},
					context: next_progress(),
				},
				page: null,
			},
			open: {
				tab: true,
				// popout: true,
				// chrome: true,
				// width: 620,
				// height: 550,
			},
		});

		console.log({
			g_request,
		});

		write_status('Please wait a moment');

		// retry program
		await load();

		return g_request;
	}

	let a_devices_seen!: [DevicePath, DeviceStruct][];
	let a_devs_live: USBDevice[] = [];

	async function load(b_retry=false) {
		if(b_retry) b_aborted = false;

		// page is no longer active; retire
		if(b_aborted) return;

		b_rejected = false;

		a_devices_seen = await Devices.filter({
			vendor: 'ledger',
		});
		k_device = k_device;

		a_devs_live = (await navigator.usb.getDevices()).filter(g_dev => 11415 === g_dev.vendorId);

		console.log({
			k_app,
			k_device,
		});

		if(!a_devices_seen.length) {
			b_deviceless = true;
		}
		else {
			b_deviceless = false;

			// no devs connected
			if(!a_devs_live.length) {
				b_connected = b_online = false;
				write_status(S_STEP_CONNECT);
			}
			// at least 1 dev connected
			else {
				try {
					// app was given by parent
					if(k_app) {
						// inherit device from app
						k_device = k_device || k_app.device;

						// execute program
						await run_program();
					}
					// expecting specific dev
					else if(g_device_owner) {
						// each connected dev
						for(const g_dev of a_devs_live) {
							// found the target dev
							if(LedgerDevice.match(g_device_owner, Devices.fromUsbDevice(g_dev))) {
								// proceed with dev and stop load
								return await scan(g_dev);
							}
						}

						// did not find target dev
						b_connected = b_online = false;
						write_status(S_STEP_CONNECT);
					}
					// only single dev connected; proceed with dev and stop load
					else if(1 === a_devs_live.length) {
						return await scan(a_devs_live[0]);
					}
					// mutliple devs connected
					else {
						// require user choice
						write_status('Select which device to use from above');

						// stop retrying
						return;
					}
				}
				catch(e_load) {}
			}

			// retry periodically
			await timeout(1e3);
			void load();
		}
	}

	let g_hwa: ParsedHardwareAccountLocation;
	(async function init() {
		if(g_account) {
			g_hwa = parse_hwa(g_account.secret as HardwareAccountLocation);

			ni_coin = g_hwa.coinType;

			g_device_owner = await Devices.at(g_account.extra!.device as DevicePath);
		}

		void load();
	})();
</script>

<style lang="less">
	@import '../_base.less';

	.ledger-nano {
		display: flex;
		justify-content: center;
		border: 2px dashed var(--theme-color-border);
		border-radius: 4px;
	}

	// ol {
	// 	margin: 0;
	// 	margin-top: 2px;
	// 	padding: 0;
	// 	list-style-type: none;
	// 	list-style-position: inside;
	// 	.font(regular);

	// 	li {
	// 		padding: 16px 0;
			
	// 		&.future {
	// 			color: fade(@theme-color-graymed, 40%);
	// 		}
	// 	}
	// }

	.instruction {
		text-align: center;
		margin-top: 2.5em;
		padding: 16px 0;

		border: 1px solid var(--theme-color-border);
		border-width: 1px 0 1px 0;
	}

	.context {
		text-align: center;
		margin: 0;
		padding: 16px 0;

		font-size: 12px;
		color: var(--theme-color-text-med);
	}

	.devices {
		display: flex;
		flex-direction: column;
		// padding: 12px 0;
		padding: 0;
		gap: 8px;
		cursor: pointer;
		// border-bottom: 1px solid var(--theme-color-border);

		>.bar {
			display: flex;
			justify-content: space-between;
			align-items: end;

			.title {
				font-size: 13px;
				color: var(--theme-color-text-med);
			}
		}

		>.box {
			display: flex;
			gap: 8px;

			.device {
				display: flex;
				align-items: center;
				gap: 8px;

				background-color: var(--theme-color-dark);
				padding: 8px 16px;
				border: 1px solid var(--theme-color-border);
				font-size: 12px;

				.status-icon {
					margin-top: -1px;

					&::before {
						display: inline-block;
						content: "";
						width: 8px;
						height: 8px;
						border-radius: 8px;

						background-color: var(--theme-color-graymed);
					}

					&.disconnected {
						&::before {
							background-color: var(--theme-color-caution);
						}
					}

					&.online {
						&::before {
							background-color: var(--theme-color-slime);
						}
					}
				}
			}
		}
	}

	.retry {
		display: block;
		margin-left: auto;
		margin-right: auto;
		margin-top: 1em;
		padding-left: 1.5em;
		padding-right: 1.5em;
	}

	.disclaimer {
		margin-top: 6px;
		margin-bottom: -6px;
		font-size: 11px;
		color: var(--theme-color-text-med);
		text-align: center;
	}

	.ledger-apps {
		display: flex;
		justify-content: center;
		gap: 1em;
		margin-top: 1em;
		cursor: pointer;

		>div {
			border: 1px solid var(--theme-color-border);
			padding: 12px;
			border-radius: 8px;
			min-width: 6em;
			text-align: center;
			color: var(--theme-color-primary);
		}
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops
		title="Connect hardware wallet"
		subtitle={g_account? `for your ${g_account.name} account`: 'Ledger Nano S/X'}
	/>

	<div class="devices">
		{#if g_account}
			<div class="bar">
				<span class="title">
					Device:
				</span>
			</div>

			<div class="box">
				<div class="device">
					<span class="status-icon"
						class:disconnected={!b_connected}
						class:online={b_online}
					></span>
					<span class="product-name">
						{#if g_device_owner}
							{g_device_owner.manufacturerName} {g_device_owner.productName}
						{:else}
							Loading...
						{/if}
					</span>
				</div>
			</div>
		{:else}
			<div class="bar">
				<span class="title">
					Known Devices:
				</span>

				<button class="pill" on:click={manage_devices} disabled={B_WITHIN_TAB}>
					Manage devices
				</button>
			</div>

			<!-- {#key [k_device, b_connected, b_online, a_devices_seen]} -->
				<div class="box">
					{#if !a_devices_seen}
						<div>
							Loading...
						</div>
					{:else if a_devices_seen.length}
						{#each a_devices_seen as [p_device, g_device]}
							<div class="device" on:click={() => click_device(g_device)}>
								{#if k_device?.matchesDevice(g_device)}
									<span class="status-icon"
										class:disconnected={!b_connected}
										class:online={b_online}
									></span>
								{:else}
									<span class="status-icon not-device"
										class:disconnected={!a_devs_live.find(g_dev => (''+g_dev.productId) === g_device.productId)}
									/>
								{/if}
								<span class="product-name">
									{g_device.manufacturerName} {g_device.productName}
								</span>
							</div>
						{/each}
					{:else}
						<div>
							No USB devices found. <span class="link" on:click={manage_devices}>Set up a new device.</span>
						</div>
					{/if}
				</div>
			<!-- {/key} -->
		{/if}
	</div>

	{#if a_devices_seen?.length}
		<div>
			<div class="ledger-nano">
				{#if g_signing && si_device}
					<LedgerScreen g_amino={g_signing} {si_device} />
				{:else}
					<img src="/media/vendor/ledger-nano.svg">
				{/if}
			</div>

			{#if g_signing && si_device}
				<div class="disclaimer">
					Screen preview in beta, may not always line up perfectly.
				</div>
			{/if}

			<div class="instruction">
				{#if s_error}
					Error occurred
				{:else}
					{s_step_now}
					{#if a_tooltip?.length}
						<Tooltip bind:showing={b_tooltip_showing}>
							{#each a_tooltip as s_tooltip}
								{s_tooltip}<br><br>
							{/each}
						</Tooltip>
					{/if}
				{/if}
			</div>

			{#if s_error}
				<div class="error-text" style="margin-top:2em;">
					{s_error}
				</div>
			{:else if s_context}
				<div class="context">
					{s_context}
				</div>
			{/if}

			{#if b_rejected}
				<button class="pill retry" on:click={() => load(true)}>
					Retry
				</button>
			{/if}

			{#if b_missing_apps}
				<div class="ledger-apps">
					<div class="recommended" on:click={() => open_external_link('https://support.ledger.com/hc/en-us/articles/6094079699357-Secret-SCRT-?support=true')}>
						Secret
					</div>

					<div on:click={() => open_external_link('https://support.ledger.com/hc/en-us/articles/360013713840-Cosmos-ATOM-?support=true')}>
						Cosmos
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<ActionsLine back cancel={abort} confirm={['Next', proceed, true]} />
	<!-- !b_connected && !b_deviceless -->

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>