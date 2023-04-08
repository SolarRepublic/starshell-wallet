<script lang="ts" context="module">
	import type {CryptoHDKey} from '@solar-republic/bc-ur-registry-cosmos';

	export interface KeystoneAccountTarget {
		pubkey: Uint8Array;
		coinType: number;
		bip44: Bip44Path;
		key: CryptoHDKey;
		disabled: boolean;
		selected: boolean;
		linked: boolean;
		seen: ChainStruct[];
	}
</script>
<script lang="ts">
	import type {AccountPath, AccountStruct} from '#/meta/account';
	
	import type {Dict} from '#/meta/belt';
	
	import type {ChainStruct} from '#/meta/chain';
	
	import type {DevicePath, DeviceStruct} from '#/meta/device';

	
	import H_SLIP44S from '@metamask/slip44';
	import {CosmosSignRequest, SignDataType, RegistryTypes, CryptoMultiAccounts} from '@solar-republic/bc-ur-registry-cosmos';
	
	import {syserr} from '../common';
	import {load_page_context} from '../svelte';
	
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import {pubkey_to_bech32} from '#/crypto/bech32';
	import type {Bip44Path} from '#/crypto/bip44';
	import {parse_bip44} from '#/crypto/bip44';
	
	import {hwa_for} from '#/crypto/hardware-signing';
	import {create_account, root_utility_document_set, save_root_utility_key} from '#/share/account';
	import {H_STORE_INIT_CHAINS} from '#/store/_init';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Devices} from '#/store/devices';
	import {Providers} from '#/store/providers';
	import {ode, oderac, timeout_exec} from '#/util/belt';
	
	import {base93_to_buffer, buffer_to_base64} from '#/util/data';
	
	import AccountEdit from './AccountEdit.svelte';
	import type {KeystoneHardwareWalletExecution, KeystoneProgramHelper} from './KeystoneHardwareConfigurator.svelte';
	import KeystoneHardwareConfigurator from './KeystoneHardwareConfigurator.svelte';
	import Screen from '../container/Screen.svelte';
	import Address from '../frag/Address.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Header from '../ui/Header.svelte';
	import Load from '../ui/Load.svelte';
	
	import Tooltip from '../ui/Tooltip.svelte';
	
	

	const G_DEFAULT_CHAIN = H_STORE_INIT_CHAINS[`/family.cosmos/chain.secret-4`];

	
	/**
	 * Device to associate with new accounts
	 */
	export let p_device: DevicePath;
	
	// device struct
	let g_device: DeviceStruct;

	// device fingerprint
	let sb16_fingerprint: string;

	// accounts that were scanned from UR
	let h_scanned: Record<Bip44Path, KeystoneAccountTarget> = {};
	

	const {k_page, a_progress, next_progress} = load_page_context();

	// force ui to wait for initialization
	let b_initializing = true;

	// lock ui while app is busy
	let b_busy = false;

	let b_tooltip_showing = false;

	// generic error handling
	const s_error = '';

	let s_status = '';

	// prep association from slip44 to chain struct
	const h_slip44s: Record<number, ChainStruct[]> = {};

	let b_some_selected = false;
	function update_selection() {
		b_some_selected = Object.values(h_scanned).some(g => g.selected && !g.disabled && !g.linked);
		h_scanned = h_scanned;
	}

	function set_select(sx_bip44: string, b_selected: boolean) {
		h_scanned[sx_bip44].selected = b_selected;
		update_selection();
	}

	// create accounts
	async function link_accounts() {
		// lock ui
		b_busy = true;

		const a_accounts: AccountPath[] = [];
		const a_program: KeystoneHardwareWalletExecution[] = [];

		// each scanned account
		for(const [, g_target] of ode(h_scanned)) {
			const sx_bip44 = g_target.bip44;
			const sb64_pk33 = buffer_to_base64(g_target.pubkey);

			// skip unselected/disabled/linked
			if(!g_target.selected || g_target.disabled || g_target.linked) continue;

			// canonicalize hardware account location
			const p_secret = hwa_for('keystone', g_target.coinType, g_target.pubkey, sx_bip44);

			// prep account path
			const p_account = Accounts.pathFor('cosmos', buffer_to_base64(g_target.pubkey));

			// enqueue account
			a_accounts.push(p_account);

			const sa_signer = Chains.addressFor(sb64_pk33, 'starshell');

			// get root utility document set
			const g_set = root_utility_document_set(sa_signer);

			for(const [si_name, atu8_doc] of ode(g_set)) {
				// eslint-disable-next-line @typescript-eslint/no-loop-func
				a_program.push(async(k_page_prg, k_prg) => {
					k_prg.status(`Review and sign the StarShell utility key`, `to link account ${sx_bip44}`, [
						`Your signature is required in order to create a StarShell utility key.`,
						`Approving this action produces a private, offline signature. It does not cost any gas. It does not spend any tokens. It does not get broadcast to any chain.`,
						`StarShell uses this signature to derive secret keys that are unique to your hardware wallet in order to generate reproducible transaction keys, anti-phishing art, and consistent identifiers.`,
					]);

					// play request and capture signature
					const {
						atu8_signature,
					} = await k_prg.play(CosmosSignRequest.constructCosmosRequest(
						crypto.randomUUID(),
						[sb16_fingerprint],
						Buffer.from(atu8_doc),
						SignDataType.amino,
						[sx_bip44],
						[sa_signer],
						'StarShell'
					).toUR(), sb64_pk33);

					// parse coin type
					const [, ni_coin] = parse_bip44(sx_bip44);

					// create account
					const [, g_account] = await create_account(p_secret, sb64_pk33, {
						device: p_device,
					}, {
						name: `Keystone ${H_SLIP44S[ni_coin]?.symbol || ni_coin}`,
					});

					// save signed key
					await save_root_utility_key(g_account, atu8_signature, si_name);
				});
			}
		}

		// accounts were created
		if(a_accounts.length) {
			// make account edit screen for each account
			a_program.push((k_page_prg) => {
				k_page_prg.push({
					creator: AccountEdit,
					props: {
						accountPath: a_accounts[0],
						oneway: true,
						fresh: true,
						a_queue: a_accounts.slice(1).map(p => ({
							creator: AccountEdit,
							props: {
								accountPath: p,
								oneway: true,
								fresh: true,
							},
							context: next_progress(a_progress, +2),
						})),
					},
					context: next_progress(a_progress, +2),
				});
			});
		}

		// push keystone signer
		k_page.push({
			creator: KeystoneHardwareConfigurator,
			props: {
				a_program,
			},
			context: next_progress(),
		});

		// reset in case user pops
		b_busy = false;
	}

	let a_tooltips: string[] = [];

	async function discover_accounts() {
		s_status = 'Please wait while accounts load...';

		// load local accounts
		const h_accounts: Dict<AccountStruct> = {};
		const ks_accounts = await Accounts.read();
		for(const [, g_account] of ks_accounts.entries()) {
			h_accounts[g_account.pubkey] = g_account;
		}

		// prep networks
		const a_networks_all = (await Promise.all((await Chains.entries()).map(([, g]) => g)
			.filter(g => g.on && !g.devnet)
			.map(async(g_chain) => {
				try {
					const [k_network] = await timeout_exec(8e3, () => Providers.activateStableDefaultFor(g_chain));

					if(k_network) return k_network;
				}
				catch(e_activate) {}
			}))).filter(k => k) as CosmosNetwork[];

		// all should be deselected to start
		update_selection();
		let c_selected = 0;

		// each account
		for(const [, g_scanned] of ode(h_scanned)) {
			// base64 encode pubkey
			const sb64_pk33 = buffer_to_base64(g_scanned.pubkey);

			// already linked
			if(h_accounts[sb64_pk33]) {
				g_scanned.selected = true;
				g_scanned.linked = true;
				g_scanned.disabled = false;

				// update selection and invalidate ui
				update_selection();

				// next account
				continue;
			}

			// each network
			for(const k_network of a_networks_all) {
				// produce bech32
				const sa_test = Chains.addressFor(sb64_pk33, k_network.chain);

				// see if that account exists
				try {
					const [, xc_timeout] = await timeout_exec(5e3, () => k_network.findAccount(sa_test));

					// timed out; skip network
					if(xc_timeout) {
						continue;
					}
				}
				catch(e_find) {
					// account does not exist on this network; try next network
					if(e_find instanceof Error && /\bnot found\b/.test(e_find.message)) {
						continue;
					}
					// something else bad happened
					else {
						// TODO: show error
						debugger;
						console.warn(e_find);
						break;
					}
				}

				// account exists on chain
				g_scanned.seen.push(k_network.chain);

				// select account
				g_scanned.selected = true;

				// increment selected counter
				c_selected += 1;
			}

			// un-disable
			g_scanned.disabled = false;

			// update selection and invalidate ui
			update_selection();
		}

		// none are selected
		if(!c_selected) {
			// select 529 by default, then 118
			try {
				h_scanned[`m/44'/529'/0'/0/0`].selected = true;
			}
			catch(e_select) {
				try {
					h_scanned[`m/44'/118'/0'/0/0`].selected = true;
				}
				catch(e_select2) {
					Object.values(h_scanned)[0].selected = true;
				}
			}
		}

		// 
		s_status = `Select which accounts should be linked`;
		b_tooltip_showing = false;
		a_tooltips = [
			`A single account can be used with all Cosmos chains.`,
			`It is recommended to only link accounts that you need. If you import multiple accounts, it will complicate your user experience.`,
		];

		// update selection
		update_selection();
	}

	// init the page
	(async function init() {
		// load accounts fro device struct
		g_device = (await Devices.at(p_device))!;

		// set locals
		const g_wallet = g_device.features.wallet!;
		sb16_fingerprint = g_wallet.fingerprint!;

		// recreate offer
		const {
			type: si_type,
			cbor: sb93_cbor,
		} = g_wallet.offer;

		// not expected type
		if(RegistryTypes.CRYPTO_MULTI_ACCOUNTS.getType() !== si_type) {
			throw syserr({
				title: 'Corrupted Keystone Device Definition',
				text: `"${si_type}" is not a recognized offer type`,
			});
		}

		// multi-account
		const y_multi = CryptoMultiAccounts.fromCBOR(base93_to_buffer(sb93_cbor));

		// each account returned in UR
		const a_keys = y_multi.getKeys();
		for(const y_key of a_keys) {
			// fetch public key
			const atu8_pk33 = y_key.getKey();

			// get origin
			const y_origin = y_key.getOrigin();

			// get components
			const a_components = y_origin.getComponents();

			// get coin type
			const ni_coin = a_components[1].getIndex();

			// components may contain wildcard
			const sx_bip44 = `m/${y_origin.getPath()}` as Bip44Path;

			// not a concrete hd path
			if(sx_bip44.includes('*')) {
				throw syserr({
					title: 'Unsupported Keystone app',
					text: `The scanned QR code is not compatible with this version of StarShell`,
				});
			}

			// add to account linking
			h_scanned[sx_bip44] = {
				pubkey: atu8_pk33,
				coinType: ni_coin,
				bip44: sx_bip44,
				key: y_key,

				// unselected by default
				selected: false,

				// disable by default
				disabled: true,

				// assume not linked
				linked: false,

				seen: [],
			};
		}

		// load slip44 to chain associations
		for(const [, g_chain] of await Chains.entries()) {
			for(const g_slip44 of g_chain.slip44s) {
				(h_slip44s[g_slip44.coinType] = h_slip44s[g_slip44.coinType] || []).push(g_chain);
			}
		}

		// start discovery process
		await discover_accounts();

		// done initializing; unlock ui
		b_initializing = false;
	})();
</script>

<style lang="less">
	.discovered {
		display: flex;
	}

	.label {
		display: flex;
		flex-direction: column;
		width: 100%;
		
		.title {
			display: flex;
			gap: 8px;
			align-items: center;
			justify-content: space-between;
		}

		.path {
			font-size: 13px;
		}
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--ui-padding);

		padding-top: var(--ui-padding);
		border-top: 1px solid var(--theme-color-border);
	}

	.chains {
		display: flex;
		gap: 8px;

		.text {
			color: var(--theme-color-text-med);
			font-size: 12px;
		}
	}

	.next {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.new {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.link {
		font-size: 12px;
	}

	.line {
		display: flex;
		gap: 12px;
		align-items: center;
		align-self: flex-end;
	}
</style>

<Screen progress={a_progress}>
	<Header plain pops
		title="Manage account(s) with Keystone"
		subtitle="on the Multi-Coin firmware"
	/>

	<p>
		{s_status}
		{#if a_tooltips.length}
			<Tooltip showing={b_tooltip_showing}>
				{#each a_tooltips as s_tooltip, i_tooltip}
					{#if i_tooltip}
						<br><br>
					{/if}
					{s_tooltip}
				{/each}
			</Tooltip>
		{/if}
	</p>

	{#if s_error}
		<div class="error-text">
			{s_error}
		</div>
	<!-- {:else if b_initializing}
		<Load forever /> -->
	{:else}
		<div class="list">
			{#if ode(h_scanned).length}
				{#each ode(h_scanned) as [sx_bip44, g_scanned] (sx_bip44)}
					{@const ni_coin = parse_bip44(g_scanned.bip44)[1]}
					{@const a_chains = h_slip44s[ni_coin] || []}
					{@const a_seen = g_scanned.seen || []}
					{@const g_slip44 = H_SLIP44S[ni_coin]}

					<CheckboxField id={sx_bip44}
						checked={g_scanned.selected}
						disabled={!!g_scanned.disabled || !!g_scanned.linked}
						on:change={d => set_select(sx_bip44, !!d.detail)}
					>
						<div class="label">
							<span class="title">
								<span class="path">
									{sx_bip44}
									{#if g_slip44}
										- {g_slip44.symbol}
									{/if}
								</span>

								<span class="chains">
									{#if g_scanned.disabled}
										<span class="text">
											...
										</span>
									{:else if g_scanned.linked}
										<span class="text">
											linked
										</span>
									{:else if a_seen.length}
										{#each a_seen as g_chain}
											<span class="chain">
												<PfpDisplay dim={18}
													resource={g_chain}
													name={g_chain.reference}
												/>
											</span>
										{/each}
									{:else}
										<span class="text">
											new
										</span>
									{/if}
								</span>
							</span>

							<span class="address">
								<Address address={pubkey_to_bech32(g_scanned.pubkey, (a_seen[0] || a_chains[0] || G_DEFAULT_CHAIN).bech32s.acc)} />
							</span>
						</div>
					</CheckboxField>
				{/each}
			{:else}
				<Load forever height='2.5em' width='100%' />
			{/if}

<!-- 
			{#if b_advanced}
				<div class="advanced" transition:slide>
					<Field name='BIP-44 Derivation Path'>
						<Bip44Input ni_coin={k_app?.coinType ?? ni_coin}
							bind:s_bip44={sx_bip44_next}
							bind:b_valid={b_valid_bip44}
							bind:s_err_bip44={s_err_bip44}
						/>
					</Field>
				</div>
			{/if}
		 -->
			<!-- <div class="line">
				<span class="link" on:click={() => b_advanced = !b_advanced}>
					{b_advanced? 'Hide': 'Show'} advanced
				</span>

				<button class="pill" on:click={() => add_account()} disabled={b_discover_loading || b_busy}>
					{b_advanced? 'Add': 'New'} account
				</button>
			</div> -->

		</div>
	{/if}

	<ActionsLine back confirm={['Link', link_accounts, b_initializing || b_busy || !b_some_selected || !!s_error]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>