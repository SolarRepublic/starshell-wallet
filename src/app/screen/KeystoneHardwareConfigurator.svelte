<script lang="ts" context="module">
	import type {Page} from './_screens';
	
	import type {UR} from '@solar-republic/bc-ur';
	import type {CosmosSignature} from '@solar-republic/bc-ur-registry-cosmos';
	
	import type {AccountStruct, HardwareAccountLocation, ParsedHardwareAccountLocation} from '#/meta/account';
	import type {Promisable} from '#/meta/belt';
	import type {DevicePath, DeviceStruct} from '#/meta/device';

	export interface Captured {
		atu8_pk33: Uint8Array;
		atu8_signature: Uint8Array;
	}

	export interface KeystoneProgramHelper {
		status(s_status: string, s_context?: string, a_tooltip?: string[]): void;
		cancel(s_error: string): void;
		// emulate(g_doc: AdaptedStdSignDoc): void;
		play(y_ur: UR, sb64_pk33: string): Promise<Captured>;
	}

	export type KeystoneHardwareWalletExecution = (k_page: Page, k_prg: KeystoneProgramHelper) => Promisable<void | undefined | ExecutionResponse>;

	export interface ExecutionResponse {
		push?: KeystoneHardwareWalletExecution[];
	}
</script>
<script lang="ts">
	import {UREncoder} from '@solar-republic/bc-ur';
	import {ExtendedRegistryTypes} from '@solar-republic/bc-ur-registry-cosmos';
	

	import QRCode from 'qrcode-svg';
	
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {parse_hwa} from '#/crypto/hardware-signing';
	import {open_flow} from '#/script/msg-flow';
	import {B_ANDROID_NATIVE, B_IPHONE_IOS, B_WITHIN_TAB} from '#/share/constants';
	import {Devices} from '#/store/devices';
	import {timeout} from '#/util/belt';
	import {buffer_to_base64} from '#/util/data';
	
	import {open_external_link, qs} from '#/util/dom';
	
	import KeystoneLinkAccounts from './KeystoneLinkAccounts.svelte';
	import ScanQr from './ScanQr.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
    import GuideQrConnect from './GuideQrConnect.svelte';
	
	

	const XL_QR_DIM = 280;

	const {k_page, a_progress, next_progress} = load_page_context();

	/**
	 * Series of async callbacks to execute while connected to device
	 */
	export let a_program: KeystoneHardwareWalletExecution[] = [];

	/**
	 * Device must be owner of given account
	 */
	export let g_account: AccountStruct | null = null;


	// the device struct owner for the given account
	let g_device_owner: DeviceStruct | null = null;

	let ni_coin = -1;

	let b_tooltip_showing = false;

	let b_proceedable = false;

	let a_tooltip: string[] = [];

	let s_error = '';
	let s_step_now = '';
	let s_context = '';
	let g_signing = null;

	function write_status(s_status: string, _s_context='', _a_toolip: string[]=[]) {
		s_step_now = s_status;
		s_context = _s_context;
		a_tooltip = _a_toolip;
		g_signing = null;
	}

	async function manage_devices() {
		if(B_IPHONE_IOS || B_ANDROID_NATIVE) {
			k_page.push({
				creator: GuideQrConnect,
				props: {
					si_guide: 'keystone',
				},
			});
		}
		else {
			const g_request = await open_flow({
				flow: {
					type: 'requestDevice',
					value: {
						props: {
							g_intent: {
								id: 'setup-new-device',
							},
							si_autoload: 'keystone',
						},
						context: next_progress(),
					},
					page: null,
				},
				open: {
					tab: true,
				},
			});
	
			write_status('Please wait a moment');
	
			return g_request;
		}
	}

	let dm_qr: HTMLDivElement;

	async function run_program() {
	/* eslint-disable @typescript-eslint/no-loop-func */
		while(a_program.length) {
			const f_exec = a_program.shift();

			let z_exec;
			try {
				z_exec = await f_exec?.(k_page, {
					status: write_status,

					cancel(s_err) {
						s_error = s_err;
					},

					play: (y_ur, sb64_pk33) => new Promise<Captured>(async(fk_resolve) => {
						// whether to stop qr animatino
						let b_stop = false;

						// set captured resolver
						fk_captured = (g_ans) => {
							// pubkey of signer in base64
							const sb64_pk33_signed = buffer_to_base64(g_ans.atu8_pk33);

							// not the expected signer
							if(sb64_pk33 !== sb64_pk33_signed) {
								s_error = 'Signature pubkey mismatch';
								return;
							}

							// stop animating this qr
							b_stop = true;

							// ok
							fk_resolve(g_ans);
						};

						// encode UR
						const y_encoder = new UREncoder(y_ur, 213);

						// qr dom not ready yet
						for(;;) {
							if(dm_qr) break;

							await timeout(250);
						}

						// animated play
						for(;;) {
							// next part
							const sx_part = y_encoder.nextPart().toUpperCase();

							// render qr code
							const y_qrcode = new QRCode({
								content: sx_part,
								width: XL_QR_DIM,
								height: XL_QR_DIM,
								padding: 0,
								pretty: false,
								ecl: 'L',
								join: true,
							}).svg();

							// set html
							dm_qr.innerHTML = y_qrcode;

							// no need to animate
							if(1 === y_encoder.fragmentsLength || b_stop) {
								break;
							}

							// inter-frame pause
							await timeout(250);
						}
					}),
				});
			}
			catch(e_run) {
				debugger;

				s_error = e_run.message;

				return;
			}
		}
		/* eslint-enable */

		if(g_account) {
			g_hwa = parse_hwa(g_account.secret as HardwareAccountLocation);

			ni_coin = g_hwa.coinType;

			g_device_owner = await Devices.at(g_account.extra!.device!);
		}
	}

	let b_capturing = false;
	let fk_captured!: (g_captured: Captured) => void;
	function proceed() {
		b_capturing = true;

		k_page.push({
			creator: ScanQr,
			props: {
				s_instructions: `Scan the QR code shown on your Keystone device`,
				b_autostart: true,
				b_poppable: true,
				h_ur_types: {
					[ExtendedRegistryTypes.COSMOS_SIGNATURE.getType().toLowerCase()](y_signature: CosmosSignature, k_page_prg: Page) {
						// pop qr scanner screen
						k_page_prg.pop();

						// capture
						fk_captured({
							atu8_pk33: y_signature.getPublicKey(),
							atu8_signature: y_signature.getSignature(),
						});
					},
				},
			},
		});
	}

	let dm_screen: HTMLFormElement;
	function bind_screen(d_event: CustomEvent<HTMLFormElement>) {
		dm_screen = d_event.detail;
	}


	function select_device(g_device: DeviceStruct) {
		if(!g_device_owner) {
			g_device_selected = g_device;
		}

		// no program, set up new device
		if(g_device_selected && !a_program?.length) {
			k_page.push({
				creator: KeystoneLinkAccounts,
				props: {
					p_device: Devices.pathFrom(g_device_selected),
				},
				context: next_progress(a_progress, 0),
			});
		}
	}

	let a_devices_seen: [DevicePath, DeviceStruct][];
	let g_device_selected: DeviceStruct;

	let g_hwa: ParsedHardwareAccountLocation;

	let b_program = false;

	(async function init() {
		// load seen keystone devices
		a_devices_seen = await Devices.filter({
			vendor: 'keystone',
		});

		// single device; auto-select
		if(1 === a_devices_seen.length) {
			g_device_selected = a_devices_seen[0][1];
		}

		// allow ui to update
		await timeout(10);

		if(a_program?.length) {
			b_program = true;
			void run_program();
		}

		await timeout(2e3);

		b_proceedable = true;
	})();
</script>

<style lang="less">
	@import '../_base.less';

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

	.qr-code {
		padding: 10px;
		background-color: white;
		border-radius: 10px;
		margin: auto;
	}

	.guide {
		font-size: 13px;
		color: var(--theme-color-text-med);
		margin-top: 1em;
		text-align: center;
	}

	.ortho {
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;

		>img {
			width: 250px;
		}

		>.setup {
			position: absolute;
			bottom: 6em;
			padding: 0.8em 2em;
			font-size: 12px;
		}
	}
</style>

<Screen progress={a_progress} on:dom={bind_screen}>
	<Header plain pops
		title={a_program?.length? 'Transmit to hardware wallet': 'Connect hardware wallet'}
		subtitle={g_account? `for your ${g_account.name} account`: 'Keystone Essential/Pro'}
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
					<span class="status-icon"></span>
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
					{#if g_device_owner}
						Device:
					{:else}
						Devices:
					{/if}
				</span>

				{#if a_devices_seen?.length}
					<button class="pill" on:click={manage_devices} disabled={B_WITHIN_TAB}>
						Manage devices
					</button>
				{/if}
			</div>

			<div class="box">
				{#if !a_devices_seen}
					<div>
						Loading...
					</div>
				{:else if a_devices_seen.length}
					{#each a_devices_seen as [p_device, g_device] (p_device)}
						{#if !g_device_owner || g_device_owner === g_device}
							<div class="device" on:click={() => select_device(g_device)}>
								<span class="status-icon"
									class:online={[g_device_owner, g_device_selected].includes(g_device)}
								></span>
								<span class="product-name">
									{g_device.manufacturerName} {g_device.productName}
								</span>
							</div>
						{/if}
					{/each}
				{:else}
					<div>
						No devices yet.
						<!-- <span class="link" on:click={manage_devices}>Set up a new device.</span> -->
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if b_program}
		<div>
			<div class="qr-code" bind:this={dm_qr} style={`
				width: ${XL_QR_DIM}px;
				height: ${XL_QR_DIM}px;
			`} />

			<div class="guide">
				Scan the QR Code with your Keystone device
			</div>

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

		</div>

		<ActionsLine back confirm={['Scan Signature', proceed, !b_proceedable]} />
	{:else if a_devices_seen?.length}
		<div class="guide">
			Select which device to use from above
		</div>
	{:else if a_devices_seen}
		<div>
			<div class="ortho">
				<img src="/media/other/keystone/setup-ortho.svg">
				<button class="pill setup" on:click={manage_devices}>
					Set up a new device
				</button>
			</div>
		</div>
	{/if}

	<div style="text-align:center; margin-top:1em;">
		<span class="link" on:click={() => open_external_link('https://keyst.one/?rfsn=7273037.592e9d&utm_source=refersion&utm_medium=affiliate&utm_campaign=7273037.592e9d')}>
			What is a Keystone wallet?
		</span>
	</div>

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>