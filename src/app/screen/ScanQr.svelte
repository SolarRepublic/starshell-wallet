
<script lang="ts">
	import type {Page} from './_screens';
	import type {UR} from '@solar-republic/bc-ur';
	import type {CameraDevice} from 'html5-qrcode/esm/camera/core';
	
	import type {Nilable, Promisable} from '#/meta/belt';

	import {RegistryTypes, ExtendedRegistryTypes, CryptoMultiAccounts, CosmosSignature} from '@solar-republic/bc-ur-registry-cosmos';
	import {URDecoder} from '@solar-republic/bc-ur';
	import {Html5Qrcode, Html5QrcodeSupportedFormats} from 'html5-qrcode';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	
	import {ThreadId} from '../def';
	import {yw_navigator, yw_progress} from '../mem';
	import {load_flow_context} from '../svelte';
	
	import {B_DESKTOP, B_RELEASE_BETA, R_BECH32, R_UR} from '#/share/constants';
	import {timeout} from '#/util/belt';
	import {open_external_link, qs} from '#/util/dom';
	

	import DeepLink from './DeepLink.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	
	import SX_ICON_SCAN from '#/icon/scan.svg?raw';
	import Header from '../ui/Header.svelte';
	
	type UrCallback<y_methods> = (y_methods: y_methods, k_page_prg: Page) => Promisable<void>;

	type UrCallbacksMap = {
		'crypto-multi-accounts': UrCallback<CryptoMultiAccounts>;
	};

	const {
		completed,
		k_page,
	} = load_flow_context();

	export let exittable = false;

	export let h_ur_types!: UrCallbacksMap;

	export let b_poppable = false;

	export let s_instructions = '';

	export let b_autostart = false;

	let b_ready = false;
	let b_attempted = false;
	let b_rejected = false;
	let b_retrying = false;
	let b_cycling = false;

	let i_camera = 0;

	let a_cameras: CameraDevice[] = [];

	let y_scanner: Html5Qrcode;

	let dm_scanner: HTMLDivElement;

	let si_scanner = `qrcode-scanner-${crypto.randomUUID().slice(-7)}`;

	function finish(b_answer: boolean) {
		k_page.pop();

		completed?.(b_answer);
	}

	let s_error = '';

	let si_bcur_session = '';
	let y_decoder: URDecoder;

	async function start_camera(w_camera: string | MediaTrackConstraints) {
		await y_scanner.start(w_camera, {
			fps: 8,
			qrbox: (xl_w, xl_h) => ({
				width: Math.min(xl_w, xl_h) * 0.85,
				height: Math.min(xl_w, xl_h) * 0.85,
			}),
		}, (s_decoded, g_result) => {
			// do not process while busy handling
			if(b_handling) return;

			console.log(s_decoded);

			// not expecting ur
			if(!h_ur_types) {
				// starshell deep link
				if(s_decoded.startsWith('https://m.s2r.sh/#')) {
					// stop the scanner
					void try_stop();

					// dereference to use web applcation
					void open_external_link(s_decoded);

					// k_page.push({
					// 	creator: DeepLink,
					// 	context: {
					// 		completed,
					// 	},
					// 	props: {
					// 		url: s_decoded,
					// 	},
					// });

					// // schedule
					// void (chrome.runtime as Vocab.TypedRuntime<IntraExt.ServiceInstruction>).sendMessage({
					// 	type: 'deepLink',
					// 	value: {
					// 		url: s_decoded,
					// 	},
					// });

					// accept
					return finish(true);
				}

				// bech32 address
				const m_bech32 = R_BECH32.exec(s_decoded);
				if(m_bech32) {
					// stop the scanner
					void try_stop();

					if(['secret'].includes(m_bech32[1])) {
						void open_external_link(`https://m.s2r.sh/#caip-10:cosmos:${B_RELEASE_BETA? 'pulsar-2': 'secret-4'}:${s_decoded}`);

						return finish(true);
					}

					// // TODO: create deep link?

					// k_page.push({
					// 	creator: DeepLink,
					// 	context: {
					// 		completed,
					// 	},
					// 	props: {
					// 		address: s_decoded,
					// 	},
					// });
				}
			}

			// bc ur
			const m_ur = R_UR.exec(s_decoded);
			if(m_ur) {
				// destructure
				const [, si_type, s_seqnum, s_seqlen] = m_ur;

				// new or change of session
				const si_session = `${si_type}/-${s_seqnum? `${s_seqlen}`: ''}`;
				if(si_session !== si_bcur_session) {
					// reset session
					si_bcur_session = si_session;
					y_decoder = new URDecoder();
					s_error = '';
				}

				// decoder is alive
				if(y_decoder) {
					// receive part
					y_decoder.receivePart(s_decoded);

					// show progress
					$yw_progress = [y_decoder.getProgress() * 100, 100];

					// ur scan complete
					if(y_decoder.isComplete()) {
						// success
						if(y_decoder.isSuccess()) {
							// stop the scanner
							void try_stop();

							// obtain ur
							const y_ur = y_decoder.resultUR();

							// wrong type
							if(h_ur_types && !h_ur_types[y_ur.type.toLowerCase()]) {
								s_error = `Expecting a different QR code; found "${y_ur.type}" but wanted ${Object.keys(h_ur_types).map(s => `"${s}"`).join(' or ')}`;
								return;
							}

							// handle UR
							void handle_ur(y_ur);
						}
						// error
						else {
							s_error = y_decoder.resultError();
						}
					}
				}
			}

			// unrecognized QR
			if(!h_ur_types) {
				s_error = 'Unknown QR format';
			}
		}, (z_error) => {
			if('string' === typeof z_error) {
				// ignore frame errors
				if(/able to detect the code|No barcode or QR code detected/.test(z_error)) {
					return;
				}
			}

			console.error(z_error);
		});

		b_cycling = false;
	}

	// prevent duplicate handling
	let b_handling = false;
	async function handle_ur(y_ur: UR) {
		b_handling = true;

		let y_instance;

		const yb_cbor = y_ur.cbor;

		// instantiate decoder
		switch(y_ur.type.toLowerCase()) {
			case RegistryTypes.CRYPTO_MULTI_ACCOUNTS.getType().toLowerCase(): {
				y_instance = CryptoMultiAccounts.fromCBOR(yb_cbor);
				break;
			}

			case ExtendedRegistryTypes.COSMOS_SIGNATURE.getType().toLowerCase(): {
				y_instance = CosmosSignature.fromCBOR(yb_cbor);
				break;
			}

			default: {
				throw syserr({
					title: `Wrong QR Code type`,
					text: `${y_ur.type} is not an expected qr code type`,
				});
			}
		}

		// exec callback
		try {
			await h_ur_types[y_ur.type](y_instance, k_page);
		}
		catch(e_handle) {
			throw syserr(e_handle as Error);
		}

		b_handling = false;
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

		// on desktop, assume front-facing camera and flip
		if(B_DESKTOP) {
			// qs(document.body, '#qrcode-scanner')?.classList.add('flipped');
			dm_scanner.classList.add('flipped');
		}

		// // set width
		// {
		// 	const dm_scanner = qs(document.body, '#qrcode-scanner') as HTMLDivElement;
		// 	// dm_scanner.style.width = `${window.innerWidth}px`;
		// 	// dm_scanner.style.width = '100%';

		// 	// new MutationObserver((a_mutations: MutationRecord[]) => {
		// 	// 	// adjust dimensions
		// 	// 	dm_scanner.querySelector('video')?.style.setProperty('width', '100%');
		// 	// 	(dm_scanner.querySelector('.qr-shaded-region') as Nilable<HTMLDivElement>)?.style.setProperty('border-width', '40px 70px');
		// 	// }).observe(dm_scanner, {
		// 	// 	childList: true,
		// 	// });
		// }

		y_scanner = new Html5Qrcode(si_scanner, {
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

	async function try_stop() {
		try {
			await y_scanner.stop();
		}
		catch(e_stop) {}
	}

	function exit() {
		void try_stop();

		if(b_poppable) {
			k_page.pop();
		}
		else if(exittable) {
			$yw_navigator.activateThread(ThreadId.TOKENS);
		}
	}

	if(b_autostart) {
		void open_qr_code_scanner();
	}
</script>

<style lang="less">
	@import '../_base.less';

	.container {
		.absolute(100%) !important;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1em;
	}

	.qrcode-scanner {
		display: flex;
		justify-content: center;
		width: 100%;
		max-width: 600px;
		margin: 0 auto;

		&.flipped {
			video {
				:global(&) {
					transform: scaleX(-1);
				}
			}
		}

		video {
			:global(&) {
				width: 100%;
				max-height: 70vh;
			}
		}
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
		margin-top: calc(50vh - 128px);
	}

	.scan {
		color: var(--theme-color-primary);
	}

	.instructions {
		font-size: 14px;
		border: 0px solid var(--theme-color-border);
		border-width: 2px 0;
		margin: 0 auto;
		padding: 12px 24px;
		margin-top: 1em;
	}
</style>

<Screen>
	{#if b_poppable}
		<Header pops title="Scan QR Code" />
	{/if}

	{#if b_ready}
		<div class="container no-margin">
			<div bind:this={dm_scanner} id={si_scanner} class="qrcode-scanner no-margin" />

			{#if s_instructions}
				<div class="instructions">
					{s_instructions}
				</div>
			{/if}

			{#if a_cameras.length > 1}
				<div class="cameras">
					<ActionsLine noPrimary confirm={[`${2 === a_cameras.length? 'Other': 'Next'} Camera`, () => {
						b_cycling = true;
						i_camera++;
					}, b_cycling]} />
				</div>
			{/if}
			<div class="status">
				<div class="error-text" class:visibility_hidden={!s_error}>
					{s_error}
				</div>
			</div>
		</div>
	{:else}
		<slot name="pending">
			<div class="pending no-margin">
				<div class="global_svg-icon icon-diameter_128px scan">
					{@html SX_ICON_SCAN}
				</div>
	
				<h3>
					QR Code Scanner
				</h3>
			</div>
		</slot>

		{#if b_rejected || !b_attempted}
			<ActionsLine cancel={exittable || b_poppable? exit: false} confirm={[b_attempted? 'Retry': 'Start Camera', () => open_qr_code_scanner(true), b_retrying]} />
		{/if}
	{/if}
</Screen>