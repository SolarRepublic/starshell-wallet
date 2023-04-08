<script lang="ts">
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {Dict} from '#/meta/belt';
	import type {Bech32, ChainStruct} from '#/meta/chain';
	
	import {slide} from 'svelte/transition';
	
	import {load_page_context} from '../svelte';

	import H_SLIP44S from '@metamask/slip44';
	
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import type {Bip44Path} from '#/crypto/bip44';
	import {parse_bip44, serialize_bip44, mutate_bip44, MutableBip44Part} from '#/crypto/bip44';
	import {hwa_for, is_hwa, parse_hwa} from '#/crypto/hardware-signing';
	import type {HdPath, PublicKeyResponse} from '#/crypto/ledger';
	import {LedgerApp, LedgerDevice, SignRejectedError} from '#/crypto/ledger';
	
	import {create_account, root_utility_document_set, save_root_utility_key} from '#/share/account';
	import {H_LEDGER_COIN_TYPE_DEFAULTS} from '#/share/constants';
	import {H_STORE_INIT_CHAINS} from '#/store/_init';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {Devices} from '#/store/devices';
	import {Providers} from '#/store/providers';
	import {ode, oderac, timeout, timeout_exec} from '#/util/belt';
	import {buffer_to_base64} from '#/util/data';
	
	import AccountEdit from './AccountEdit.svelte';
	import type {HardwareWalletExecution, ProgramHelper} from './HardwareController.svelte';
	import HardwareController from './HardwareController.svelte';
	import Screen from '../container/Screen.svelte';
	import Address from '../frag/Address.svelte';
	import Bip44Input from '../frag/Bip44Input.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Field from '../ui/Field.svelte';
	import Header from '../ui/Header.svelte';
	import Load from '../ui/Load.svelte';
	
	import SX_ICON_ADD from '#/icon/add.svg?raw';
    import { syswarn } from '../common';
	
	const {k_page, a_progress, next_progress} = load_page_context();

	export let k_app!: LedgerApp;

	export let ni_coin: number | -1 = k_app?.coinType ?? -1;

	const s_hrp_app = H_LEDGER_COIN_TYPE_DEFAULTS[ni_coin].hrp;
	let sa_next = '';

	let s_status = '';

	interface Discovered {
		selected: boolean;
		disabled?: boolean;
		address: Bech32;
		chains: ChainStruct[];
		pubkey: string;
		name: string;
	}

	let h_discovered: Dict<Discovered> = {};


	let b_valid_bip44 = true;
	let sx_bip44_next: Bip44Path = `m/44'/${ni_coin >= 0? ni_coin: 529}'/0'/0/0`;
	let s_err_bip44 = '';

	$: if(b_valid_bip44) {
		s_err_bip44 = '';

		CHECK_COLLISON: {
			for(const p_path of Object.keys(h_discovered)) {
				if(sx_bip44_next === p_path) {
					s_err_bip44 = 'Account already shown above';
					break CHECK_COLLISON;
				}
			}
		}
	}

	let b_discover_loading = true;


	async function fetch_pubkey_for_bip44(sx_bip44: Bip44Path) {
		// ask device for corresponding public key
		let g_get;
		try {
			g_get = await k_app.getPublicKey(s_hrp_app, parse_bip44(sx_bip44));
		}
		catch(e_get) {
			s_error = e_get.message;
			throw e_get;
		}

		if(g_get.error) {
			s_error = g_get.error;
			throw new Error(s_error);
		}

		// cast type
		return g_get as PublicKeyResponse;
	}

	const h_accounts: Dict<AccountStruct> = {};

	// root account public key
	let g_key0!: PublicKeyResponse;

	async function discover_accounts() {
		s_status = 'Please wait while accounts load...';

		// ref coin type for current ledger app
		const ni_coin_local = k_app?.coinType ?? ni_coin;

		// set initial bip44 path
		sx_bip44_next = `m/44'/${ni_coin_local}'/0'/0/0`;

		// load account 0
		g_key0 = await fetch_pubkey_for_bip44(sx_bip44_next);
		const sb64_pk33_0 = buffer_to_base64(g_key0.publicKey);

		// load local accounts
		const ks_accounts = await Accounts.read();
		for(const [, g_account] of ks_accounts.entries()) {
			h_accounts[g_account.pubkey] = g_account;

			const sx_secret = g_account.secret;

			// account does not originate from hardware device
			if(!is_hwa(sx_secret)) continue;

			// parse
			const {
				coinType: ni_coin_parsed,
				pubkey: sb64_acc0,
				bip44: sx_bip44_this,
			} = parse_hwa(sx_secret);

			// different coin type
			if(ni_coin_parsed !== ni_coin_local) continue;

			// account originates from same device; show it in list
			if(sb64_pk33_0 === sb64_acc0) {
				sx_bip44_next = sx_bip44_this;
				await add_account(g_key0);
			}
		}

		// reset pathh
		sx_bip44_next = `m/44'/${ni_coin_local}'/0'/0/0`;

		// prep networks
		const a_networks_all = (await Promise.all((await Chains.entries()).map(([, g]) => g)
			.filter(g => g.on && !g.devnet && g.slip44s.find(g_slip => ni_coin_local === g_slip.coinType))
			.map(async(g_chain) => {
				try {
					const [k_network] = await timeout_exec(8e3, () => Providers.activateStableDefaultFor(g_chain));

					if(k_network) return k_network;
				}
				catch(e_activate) {}
			}))).filter(k => k) as CosmosNetwork[];

		// actually discovered
		let c_discovered = 0;

		// extract hrps
		const h_hrps: Dict<CosmosNetwork[]> = {};
		{
			// each network
			for(const k_network of a_networks_all) {
				// ref chain
				const g_chain = k_network.chain;

				// ref hrp
				const s_hrp = g_chain.bech32s.acc;

				// no hrp?!
				if(!s_hrp) continue;

				// upsert hrp dict
				const a_networks = h_hrps[s_hrp] = h_hrps[s_hrp] || [];

				// push network
				a_networks.push(k_network);
			}
		}

		// while there are accounts (up to a limit)
		let i_account = 0;
		ACCOUNTS:
		for(; i_account<10; i_account++) {
			// prep bip44 path
			sx_bip44_next = `m/44'/${ni_coin_local}'/${i_account}'/0/0`;

			// path already covered
			if(h_discovered[sx_bip44_next]) continue;

			// each hrp associated with current coin type
			for(const [s_hrp, a_networks] of ode(h_hrps)) {
				// ask device for corresponding public key
				let g_key: PublicKeyResponse;
				const a_path_attempt: HdPath = [44, ni_coin_local, i_account, 0, 0];
				try {
					g_key = await k_app.getPublicKey(s_hrp, a_path_attempt);
					if(g_key.error) throw new Error(g_key.error);
				}
				catch(e_get) {
					syswarn({
						title: `Ledger Device Error: getPublicKey(${s_hrp}, [${a_path_attempt.join(', ')}])`,
						text: e_get.stack,
					});
					break ACCOUNTS;
				}

				// account's public key identity
				const sb64_pk33 = buffer_to_base64(g_key.publicKey);

				// ref bech32
				const sa_test = g_key.bech32;

				// number of chains account has been spotted on
				let c_spotted = 0;

				// each network
				for(const k_network of a_networks) {
					// see if that account exists
					try {
						const [g_result, xc_timeout] = await timeout_exec(5e3, () => k_network.findAccount(sa_test));

						// timed out; skip network
						if(xc_timeout) {
							continue;
						}
						// no account data
						else if(!g_result?.account?.value?.length) {
							continue;
						}
						else {
							console.log(`Found existing account for Ledger on chain: ${sa_test}`);
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
					const g_discovered: Discovered = h_discovered[sx_bip44_next] = h_discovered[sx_bip44_next] || {
						selected: true,
						address: sa_test,
						chains: [],
						name: '',
						pubkey: sb64_pk33,
					};

					// account already linked
					if(h_accounts[sb64_pk33]) {
						Object.assign(g_discovered, {
							selected: true,
							disabled: true,
							name: h_accounts[sx_bip44_next].name,
						});
					}
					else {
						// update selection
						set_select(sx_bip44_next, true);

						c_discovered += 1;
					}

					// add chain
					g_discovered.chains.push(k_network.chain);

					// invalidate uil
					h_discovered = h_discovered;

					// spotted
					c_spotted += 1;
				}

				// account not spotted on chain
				if(!c_spotted) {
					break ACCOUNTS;
				}
			}
		}

		// read address of next path
		NEXT_ADDRESS: {
			// ask device for corresponding public key
			let g_key: PublicKeyResponse;
			try {
				const g_get = await k_app.getPublicKey(s_hrp_app, [44, ni_coin_local, i_account, 0, 0]);
				if(g_get.error) throw new Error(g_get.error);

				g_key = g_get as PublicKeyResponse;
			}
			catch(e_get) {
				console.warn({e_get});
				break NEXT_ADDRESS;
			}

			// address of key
			sa_next = g_key.bech32;
		}

		// add a new account by default
		if(!c_discovered) {
			await add_account();
		}

		s_status = `Select which accounts should be linked:`;

		b_discover_loading = false;
	}

	let s_error = '';

	// discover initial accounts from device
	async function init_discover(c_retries=0) {
		try {
			await discover_accounts();
		}
		catch(e_discover) {
			const s_msg = e_discover?.message;

			if('string' === typeof s_msg) {
				if(s_msg.includes('GrpcWebError')) {
					debugger;
					console.warn({s_msg});
				}

				if(/transfer(In|Out)/.test(s_msg)) {
					console.warn(`Recovering from "${s_msg}"...`);

					if(c_retries < 2) {
						await timeout(500);

						return await init_discover(c_retries+1);
					}
				}

				s_error = e_discover.message;
			}
			else {
				s_error = 'Unknown error occurred';
			}

			console.warn({e_discover});
		}
	}

	async function init_dev_app() {
		const k_device = await LedgerDevice.connect();

		if(!k_device) {
			await timeout(2e3);
			return void init_dev_app();
		}

		k_app = await LedgerApp.open(k_device, H_LEDGER_COIN_TYPE_DEFAULTS[ni_coin].app);
	}

	// init
	(async function init() {
		if(!k_app) {
			await init_dev_app();
		}

		const sx_bip44_test: Bip44Path = `m/44'/${ni_coin}'/0'/0/0`;
		if(sx_bip44_next !== sx_bip44_test) {
			sx_bip44_next = sx_bip44_test;
		}

		void init_discover();
	})();


	async function link_accounts() {
		// lock ui
		b_busy = true;

		const a_accounts: AccountPath[] = [];

		const a_program: HardwareWalletExecution[] = [];

		// each selected account that is not yet linked
		for(const [sx_bip44, g_discovered] of ode(h_discovered)) {
			// skip unselected and disabled accounts
			if(!g_discovered.selected || g_discovered.disabled) continue;

			// canonicalize hardware account location
			const p_secret = hwa_for('ledger', k_app.coinType, g_key0.publicKey, sx_bip44 as Bip44Path);

			// prep account path
			const p_account = Accounts.pathFor('cosmos', g_discovered.pubkey);

			// enqueue account
			a_accounts.push(p_account);

			// parse hd path
			const a_path = parse_bip44(sx_bip44 as Bip44Path);

			// get root utility document set
			const g_set = root_utility_document_set(g_discovered.address, true);

			// parse bip44
			const [,, ni_account] = parse_bip44(sx_bip44 as Bip44Path);

			// // prep account name?
			// const s_name = `Ledger ${k_app.device.transport.device.productName || ''} ${k_app.name} ${serialize_bip44(a_path)}'`;

			// eslint-disable-next-line @typescript-eslint/no-loop-func
			a_program.push(...oderac(g_set, (si_name, atu8_doc, i_entry) => async(k_app_prg, k_page_prg, k_prg: ProgramHelper) => {
				k_prg.status(`Review and sign the StarShell utility key`, `to link account ${serialize_bip44(a_path)}`, [
					`Your signature is required in order to create a StarShell utility key.`,
					`Approving this action produces a private, offline signature. It does not cost any gas. It does not spend any tokens. It does not get broadcast to any chain.`,
					`StarShell uses this signature to derive secret keys that are unique to your hardware wallet in order to generate reproducible transaction keys, anti-phishing art, and consistent identifiers.`,
				]);

				try {
					const {
						error: s_error_sign,
						signature: atu8_signature,
					} = await k_app.sign(a_path, atu8_doc);

					if(s_error_sign) {
						k_prg.cancel(s_error_sign);
					}
					else {
						// create account
						const [, g_account] = await create_account(p_secret, g_discovered.pubkey, {
							device: Devices.pathFrom(Devices.fromUsbDevice(k_app.device.transport.device)),
						}, {
							name: `Ledger ${H_SLIP44S[ni_coin]?.symbol || ni_coin} #${ni_account}`,
						});

						await save_root_utility_key(g_account, atu8_signature, si_name);
					}
				}
				catch(e_sign) {
					if(e_sign instanceof Error) {
						if(e_sign instanceof SignRejectedError) {
							k_prg.rejected();
						}
						else {
							k_prg.cancel(`Device error: ${e_sign?.message || e_sign}`);
						}
					}
					else {
						k_prg.cancel(`Unexpected error: ${e_sign?.message || e_sign}`);
					}
				}
			}));
		}


		if(a_accounts.length) {
			a_program.push((k_app_prg, k_page_prg) => {
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

		k_page.push({
			creator: HardwareController,
			props: {
				a_program,
				k_app,
			},
			context: next_progress(),
		});

		// reset in case user pops
		b_busy = false;
	}


	// busy adding new account state
	let b_busy = false;

	// add a new account from the hardware device
	async function add_account(g_key?: PublicKeyResponse) {
		if(!b_valid_bip44 || s_err_bip44 || b_busy) return;

		// enter busy state
		b_busy = true;

		// existing account
		const b_disabled = !!g_key;

		// fetch public key from device
		if(!g_key) g_key = await fetch_pubkey_for_bip44(sx_bip44_next);

		// add discovered entry
		h_discovered[sx_bip44_next] = {
			selected: true,
			disabled: b_disabled,
			address: g_key.bech32,
			pubkey: buffer_to_base64(g_key.publicKey),
			chains: [],
			name: '',
		};

		// update selections
		set_select(sx_bip44_next, true);

		// invalidate ui
		h_discovered = h_discovered;

		// mutate next bip44 path
		sx_bip44_next = mutate_bip44(sx_bip44_next, MutableBip44Part.AccountType, +1);

		// reset busy state
		b_busy = false;
	}

	let b_some_selected = false;
	function set_select(sx_bip44: string, b_selected: boolean) {
		h_discovered[sx_bip44].selected = b_selected;
		b_some_selected = Object.values(h_discovered).some(g => g.selected && !g.disabled);
	}

	let b_advanced = false;
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
		title="Manage account(s) with Ledger"
		subtitle="on the {k_app?.name ?? '[...]'} app"
	/>

	<p>
		{s_status}
	</p>

	{#if s_error}
		<div class="error-text">
			{s_error}
		</div>
	{:else}
		<div class="list">
			{#if ode(h_discovered).length}
				{#each ode(h_discovered) as [sx_bip44, g_discovered] (sx_bip44)}
					{@const a_chains = g_discovered.chains}

					<CheckboxField id={sx_bip44}
						checked={g_discovered.selected}
						disabled={!!g_discovered.disabled}
						on:change={d => set_select(sx_bip44, !!d.detail)}
					>
						<div class="label">
							<span class="title">
								<span class="path">
									{sx_bip44}{g_discovered.name? ` - ${g_discovered.name}`: ''}
								</span>

								<span class="chains">
									{#if g_discovered.disabled}
										<span class="text">
											linked
										</span>
									{:else if a_chains.length}
										{#each a_chains as g_chain}
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
								<Address address={g_discovered.address} />
							</span>
						</div>
					</CheckboxField>
				{/each}
			{:else}
				<Load forever height='2.5em' width='100%' />
			{/if}


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
		
			<div class="line">
				<span class="link" on:click={() => b_advanced = !b_advanced}>
					{b_advanced? 'Hide': 'Show'} advanced
				</span>

				<button class="pill" on:click={() => add_account()} disabled={b_discover_loading || b_busy}>
					{b_advanced? 'Add': 'New'} account
				</button>
			</div>

		</div>
	{/if}

	<ActionsLine back confirm={['Link', link_accounts, b_discover_loading || b_busy || !b_some_selected || !!s_error]} />
</Screen>