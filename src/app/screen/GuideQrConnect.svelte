<script lang="ts">
	import type {Page} from './_screens';
	
	import type {CryptoMultiAccounts} from '@solar-republic/bc-ur-registry-cosmos';

	import {RegistryTypes} from '@solar-republic/bc-ur-registry-cosmos';

	import {Header, Screen} from './_screens';
	import {syserr} from '../common';
	import {load_page_context} from '../svelte';
	
	import type {Bip44Path} from '#/crypto/bip44';
	
	import {Devices} from '#/store/devices';
	import {buffer_to_base58, buffer_to_base93, buffer_to_hex} from '#/util/data';
	
	import KeystoneLinkAccounts from './KeystoneLinkAccounts.svelte';
	import type {KeystoneAccountTarget} from './KeystoneLinkAccounts.svelte';
	import ScanQr from './ScanQr.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Curtain from '../ui/Curtain.svelte';
	

	const {k_page, a_progress, next_progress} = load_page_context();

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;


	export let si_guide: 'keystone';

	const b_use_pin = false;

	let b_tooltip_showing = false;

	const H_GUIDES = {
		keystone: {
			label: 'Keystone',
			steps: [
				{
					html: `Make sure you have Keystone's Multi-Coin Firmware installed on your device. Then, from the home screen, click the "three-bar" button in the upper-left corner of the screen`,
					img: '/media/other/keystone/assets.png',
				},
				{
					html: `From the side menu that slides out, click "Connect Software Wallet" at the bottom`,
					img: '/media/other/keystone/menu-cropped.png',
				},
				{
					html: `Click on "Keplr", then continue here once the QR code is showing`,
					img: '/media/other/keystone/apps.png',
				},
			],
		},
	};

	function next() {
		k_page.push({
			creator: ScanQr,
			props: {
				s_instructions: `Scan the QR code shown on your Keystone device`,
				b_autostart: true,
				b_poppable: true,
				h_ur_types: {
					async [RegistryTypes.CRYPTO_MULTI_ACCOUNTS.getType().toLowerCase()](y_multi: CryptoMultiAccounts, k_page_prg: Page) {
						const si_vendor = y_multi.getDevice();
						const si_product = buffer_to_base58(y_multi.getMasterFingerprint());
						const sb16_fingerprint = buffer_to_hex(y_multi.getMasterFingerprint());

						// device not yet defined
						const p_device = Devices.pathFor('keystone', si_product);
						if(!await Devices.at(p_device)) {
							// define device struct and save it
							await Devices.put({
								vendor: 'keystone',
								productId: si_product,
								manufacturerName: si_vendor,
								productName: si_product,
								name: `${si_vendor} ${si_product}`,
								pfp: '',
								features: {
									wallet: {
										fingerprint: sb16_fingerprint,
										offer: {
											type: y_multi.getRegistryType().getType(),
											cbor: buffer_to_base93(y_multi.toCBOR() as Uint8Array),
										},
									},
								},
							});
						}

						// bypass ScanQr on pop
						k_page_prg.on({
							restore() {
								k_page_prg.pop();
							},
						});

						// move onto linking accounts
						k_page_prg.push({
							creator: KeystoneLinkAccounts,
							props: {
								p_device,
								sb16_fingerprint,
							},
							context: next_progress(),
						});

						return true;
					},
				},
			},
		});
	}
	
</script>

<style lang="less">
	.steps {
		display: flex;
		flex-direction: column;
		gap: 1.75em;
		margin: 0 auto;
		margin-bottom: 2em;
		max-width: 350px;

		>.step {
			display: flex;
			flex-direction: column;
			gap: 0.75em;

			>img {
				border-radius: 16px;
				width: 100%;
				max-width: 300px;
				margin: auto;
			}
		}
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops={!b_mandatory}
		title="Connect Guide for {H_GUIDES[si_guide]?.label}"
	/>

	<div class="steps">
		{#if H_GUIDES[si_guide]}
			{@const g_guide = H_GUIDES[si_guide]}
			{#each g_guide.steps as g_step, i_step}
				<div class="step">
					<div class="text">
						<span class="number">
							{i_step+1}.
						</span>
						<span class="instruction">
							{@html g_step.html}
						</span>
					</div>

					<img src={g_step.img} alt={g_step.html}>
				</div>
			{/each}
		{/if}
	</div>

	<ActionsLine back confirm={['Next', next]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>