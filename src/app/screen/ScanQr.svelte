
<script lang="ts">
	import type {CameraDevice} from 'html5-qrcode/esm/camera/core';

	import {Html5Qrcode, Html5QrcodeSupportedFormats} from 'html5-qrcode';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	
	import {ThreadId} from '../def';
	import {yw_navigator} from '../mem';
	import {load_flow_context} from '../svelte';
	
	import {R_BECH32} from '#/share/constants';
	import {timeout} from '#/util/belt';
	import {qs} from '#/util/dom';
	
	import DeepLink from './DeepLink.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	
	import SX_ICON_SCAN from '#/icon/scan.svg?raw';
	

	const {
		completed,
		k_page,
	} = load_flow_context();

	export let exittable = false;

	let b_ready = false;
	let b_attempted = false;
	let b_rejected = false;
	let b_retrying = false;
	let b_cycling = false;

	let i_camera = 0;

	let a_cameras: CameraDevice[] = [];

	let y_scanner: Html5Qrcode;

	async function start_camera(w_camera: string | MediaTrackConstraints) {
		await y_scanner.start(w_camera, {
			fps: 8,
			qrbox: {
				width: 200,
				height: 200,
			},
		}, (s_decoded, g_result) => {
			console.log(s_decoded);

			// stop the scanner
			void y_scanner.stop();

			// starshell deep link
			if(s_decoded.startsWith('https://link.starshell.net/')) {
				k_page.push({
					creator: DeepLink,
					context: {
						completed,
					},
					props: {
						url: s_decoded,
					},
				});

				// // schedule
				// void (chrome.runtime as Vocab.TypedRuntime<IntraExt.ServiceInstruction>).sendMessage({
				// 	type: 'deepLink',
				// 	value: {
				// 		url: s_decoded,
				// 	},
				// });

				// // accept
				// return completed(true);

				// do not complete
				return;
			}
			// passes as bech32 address
			else if(R_BECH32.test(s_decoded)) {
				// TODO: create deep link?

				k_page.push({
					creator: DeepLink,
					context: {
						completed,
					},
					props: {
						address: s_decoded,
					},
				});
			}

			completed(false);
		}, (z_error) => {
			if('string' === typeof z_error) {
				// ignore frame errors
				if(z_error.includes('able to detect the code')) {
					return;
				}
			}

			console.error(z_error);
		});

		b_cycling = false;
	}

	async function open_qr_code_scanner(b_retry=false) {
		b_attempted = true;
		b_retrying = b_retry;

		// first invocation
		if(!b_retrying) {
			await timeout(1e3);
		}

		try {
			a_cameras = await Html5Qrcode.getCameras();
		}
		catch(e_reject) {
			b_rejected = true;
			b_retrying = false;
			console.error(e_reject);
			return;
		}

		b_ready = true;
		b_retrying = false;

		await timeout(100);

		// set width
		{
			const dm_scanner = qs(document.body, '#qrcode-scanner') as HTMLDivElement;
			dm_scanner.style.width = `${window.innerWidth}px`;
		}

		y_scanner = new Html5Qrcode('qrcode-scanner', {
			verbose: false,
			formatsToSupport: [
				Html5QrcodeSupportedFormats.QR_CODE,
			],
		});

		await start_camera({
			facingMode: 'environment',
		});
	}

	// open_qr_code_scanner();

	$: {
		if(i_camera) {
			i_camera %= a_cameras.length;
			y_scanner.stop().then(async() => {
				await start_camera(a_cameras[i_camera].id);
			}).catch((e_stop) => {
				throw syserr({
					title: 'Camera Error',
					error: e_stop,
				});
			});
		}
	}

	function exit() {
		$yw_navigator.activateThread(ThreadId.TOKENS);
	}
</script>

<style lang="less">
	@import '../_base.less';

	.container {
		.absolute(100%) !important;
		display: flex;
	}

	#qrcode-scanner {
		margin: auto;
	}

	.cameras {
		position: absolute;
		bottom: 5%;
		width: calc(100% - 2 * var(--ui-padding));
		margin: 0 var(--ui-padding);
		height: max-content;
	}

	.pending {
		display: flex;
		flex-flow: column;
		align-items: center;
		justify-content: center;
		margin-top: 50%;
	}

	.scan {
		color: var(--theme-color-primary);
	}
</style>

<Screen>
	{#if b_ready}
		<div class="container no-margin">
			<div id="qrcode-scanner" class="no-margin" />
			{#if a_cameras.length > 1}
				<div class="cameras">
					<ActionsLine noPrimary confirm={[`${2 === a_cameras.length? 'Other': 'Next'} Camera`, () => {
						b_cycling = true;
						i_camera++;
					}, b_cycling]} />
				</div>
			{/if}
		</div>
	{:else}
		<div class="pending no-margin">
			<div class="global_svg-icon icon-diameter_128px scan">
				{@html SX_ICON_SCAN}
			</div>

			<h3>
				QR Code Scanner
			</h3>
		</div>

		{#if b_rejected || !b_attempted}
			<ActionsLine cancel={exittable? exit: false} confirm={[b_attempted? 'Retry': 'Start Camera', () => open_qr_code_scanner(true), b_retrying]} />
		{/if}
	{/if}
</Screen>