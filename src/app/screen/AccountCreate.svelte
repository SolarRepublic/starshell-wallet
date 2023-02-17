<script lang="ts">
	import type {O} from 'ts-toolbelt';
	
	import type {SecretPath} from '#/meta/secret';
	
	import {slide} from 'svelte/transition';
	
	import {Screen, Header} from './_screens';
	import {syserr} from '../common';
	import {yw_context_popup, yw_popup} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {Bip32} from '#/crypto/bip32';
	import {Bip39} from '#/crypto/bip39';
	import type {Bip44Path} from '#/crypto/bip44';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	
	import {global_broadcast} from '#/script/msg-global';
	import {add_root_utility_key, bip32_test_signature, create_account} from '#/share/account';
	
	import {R_BIP_44} from '#/share/constants';
	import {Secrets} from '#/store/secrets';
	import {microtask} from '#/util/belt';
	import {buffer_to_base64, serialize_private_key} from '#/util/data';
	
	import AccountEdit from './AccountEdit.svelte';
	import WalletCreate from './WalletCreate.svelte';
	import Bip44Input from '../frag/Bip44Input.svelte';
	import PopupPin from '../popup/PopupPin.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import Field from '../ui/Field.svelte';
	import type {SelectOption} from '../ui/StarSelect.svelte';
	import StarSelect from '../ui/StarSelect.svelte';
	
	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_GEAR from '#/icon/settings.svg?raw';


	const {k_page} = load_page_context();

	/**
	 * The user must create an account (means there are no existing accounts)
	 */
	export let b_mandatory = false;

	export let p_mnemonic_selected = '';

	type SeedOption = O.Merge<{
		value: SecretPath<'mnemonic'>;
	}, SelectOption>;

	let a_items: SeedOption[] = [];

	let g_selected_seed: SeedOption;

	let sx_bip44_path: Bip44Path = `m/44'/529'/0'/0/0`;

	let b_valid_bip44 = true;
	
	let b_busy = false;

	let s_err_bip44 = '';

	(async function load() {
		// load mnemonics
		const a_mnemonics = await Secrets.filter({
			type: 'mnemonic',
		});

		// fetch all bip32 nodes
		const a_nodes = await Secrets.filter({
			type: 'bip32_node',
		});

		// convert into items
		a_items = a_mnemonics.map((g_secret) => {
			const p_secret = Secrets.pathFrom(g_secret);

			// find accounts using this mnemonic
			const nl_accounts = a_nodes.filter(g_node => p_secret === g_node.mnemonic).length;
			return {
				value: p_secret,
				primary: g_secret.name,
				secondary: `${nl_accounts} account${1 === nl_accounts? '': 's'}`,
			};
		});

		// create default selection
		g_selected_seed = a_items[0];

		// default selection was provided by pusher
		if(p_mnemonic_selected) {
			for(const g_item of a_items) {
				if(p_mnemonic_selected === g_item.value) {
					g_selected_seed = g_item;
					break;
				}
			}
		}

		// initialize bip44 path
		void update_path(true);
	})();

	let b_advanced = false;
	function toggle_advanced() {
		b_advanced = !b_advanced;
	}

	async function new_account() {
		b_busy = true;

		try {
			await try_new_account();
		}
		catch(e_create) {
			throw syserr(e_create as Error);
		}
		finally {
			b_busy = false;
		}
	}

	async function try_new_account() {
		// TODO: forbid duplicates

		const p_secret_mnemonic = g_selected_seed.value as SecretPath<'mnemonic'>;

		// fetch mnemonic metadata
		const g_secret_mnemonic = await Secrets.metadata(p_secret_mnemonic);

		// decrypt mnemonic
		const atu8_package: Uint8Array = await new Promise((fk_resolve) => {
			const g_security = g_secret_mnemonic.security;

			// mnemonic is protected by PIN
			if('pin' === g_security.type) {
				// set context for pin popup
				$yw_context_popup = {
					seed: g_secret_mnemonic.name,
					hint: g_security.hint,

					// test the pin entry
					enter: (atu8_pin: Uint8Array) => Secrets.borrow(p_secret_mnemonic, async(kn_encrypted) => {
						// attempt to decrypt with pin
						try {
							const _atu8_package = await Secrets.decryptWithPin(kn_encrypted.data, atu8_pin, g_security);
							fk_resolve(_atu8_package);
							return true;
						}
						catch(e_decrypt) {
							return false;
						}
					}),
				};

				// show popup
				$yw_popup = PopupPin;
			}
			// mnemonic is not protected
			else {
				void Secrets.borrow(p_secret_mnemonic, (kn_package) => {
					fk_resolve(kn_package.data.slice());
				});
			}
		});

		// decode mnemonic package
		const [atu8_extension, atu8_padded] = Bip39.decodePackage(atu8_package);

		// trim padded mnemonic
		const kn_trimmed = Bip39.trimPaddedMnemonic(new SensitiveBytes(atu8_padded));

		// generate 512-bit seed key
		const kk_seed = await Bip39.mnemonicToSeed(() => kn_trimmed.data, () => atu8_extension);

		// create master node from seed
		const k_master = await kk_seed.access(atu8_seed => Bip32.masterKey(() => atu8_seed));

		// traverse to given node
		const k_node = await k_master.derivePath(sx_bip44_path);

		// set compressed public key
		const atu8_pk33 = k_node.publicKey.slice();

		// create a signature to verify the node gets serialized and stored correctly
		const s_signature_before = await bip32_test_signature(k_node);

		// serialize node
		const kn_node = await k_node.serializeNode();

		// create otp in order to avoid serializing the raw node as a string
		const [atu8_xor_node, sx_otp_node] = serialize_private_key(kn_node);

		// compeletely destroy the whole bip32 tree
		k_node.obliterate();

		// create private key secret
		const p_secret_node = await Secrets.put(atu8_xor_node, {
			type: 'bip32_node',
			uuid: crypto.randomUUID(),
			mnemonic: p_secret_mnemonic,
			bip44: sx_bip44_path,
			name: `${g_secret_mnemonic.name}: Private key at ${sx_bip44_path}`,
			security: {
				type: 'otp',
				data: sx_otp_node,
			},
		});

		// test the node was serialized and stored correctly
		{
			// access private node
			(await Secrets.borrowPlaintext(p_secret_node, async(kn_node_test/* , g_secret*/) => {
				// import as bip32 node
				const k_node_test = await Bip32.import(kn_node_test);

				// signatures do no match
				if(s_signature_before !== await bip32_test_signature(k_node_test)) {
					// obliterate the node
					k_node_test.obliterate();

					// error
					throw new Error(`Failed to produce matching signatures for BIP-0032 node after round-trip serialization.`);
				}
			}))!;
		}

		// create account using new seed
		const [p_account, g_account] = await create_account(p_secret_node, buffer_to_base64(atu8_pk33), '');

		// initialize utility keys
		{
			await add_root_utility_key(g_account, 'walletSecurity', `
				Allows the wallet to generate repeatable data for security features such as anti-phishing art.
			`.trim());

			await add_root_utility_key(g_account, 'secretNetworkKeys', `
				Allows the wallet to generate repeatable keys for transactions and SNIP-20s on Secret Network, its testnets, and any forks.
			`.trim());
		}

		// trigger login event globally to reload service tasks
		global_broadcast({
			type: 'login',
		});

		// proceed to account edit screen
		k_page.push({
			creator: AccountEdit,
			props: {
				accountPath: p_account,
				fresh: true,
				oneway: true,
				b_mandatory: true,
			},
		});
	}

	// react to path changes
	$: if(sx_bip44_path && g_selected_seed) void update_path();

	// the current seed and path combination conflict with an existing account
	let b_conflict = false;

	async function update_path(b_autofix=false) {
		// cache path so it can be compared after async operations complete
		const sx_path_cached = sx_bip44_path;

		await microtask();

		if(!b_valid_bip44) return;

		// reset conflict state
		b_conflict = false;

		// find all bip32 nodes using the selected seed
		const a_nodes = await Secrets.filter({
			type: 'bip32_node',
			mnemonic: g_selected_seed.value,
		});

		// different path
		if(sx_path_cached !== sx_bip44_path) return;

		// find max
		let n_max_account = 0;

		// each node
		for(const g_node of a_nodes) {
			// conflict
			if(sx_path_cached === g_node.bip44) {
				b_conflict = true;
			}

			// update max account index
			n_max_account = Math.max(n_max_account, +R_BIP_44.exec(g_node.bip44 as string)![2]);
		}

		// path conflict
		if(b_conflict) {
			// automatically resolve conflicts
			if(b_autofix) {
				sx_bip44_path = sx_bip44_path.replace(R_BIP_44, `m/44'/$1'/${n_max_account+1}'/$3/$4`) as Bip44Path;
			}
			// user manually set path; issue warning
			else {
				s_err_bip44 = 'Account already exists';
			}
		}
	}

	function use_coin_type(si_coin: string, b_quietly=false) {
		if(!b_quietly) b_advanced = true;

		sx_bip44_path = sx_bip44_path.replace(/^(m\/44'\/)[^/]+\/[^/]+(\/.+)$/, `$1${si_coin}'/0'$2`) as Bip44Path;

		void update_path(true);
	}

	function new_seed() {
		k_page.push({
			creator: WalletCreate,
		});
	}

	function select_seed() {
		// persist only the coin type
		const m_coin_type = /^m\/44'\/(\d+)'?\//.exec(sx_bip44_path);

		// quietly reset path
		use_coin_type(m_coin_type?.[1] || '529', true);
	}
</script>

<style lang="less">
	@import '../_base.less';

	.hd-path {
		:global(&) {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}

	.options {
		display: flex;
		justify-content: flex-end;

		.font(tiny, @size: 12px);

		.link {
			.text {
				vertical-align: bottom;
			}
		}
	}

	.advanced {
		margin-top: -18px;
	}
</style>

<Screen slides progress={b_mandatory? [4, 5]: null}>
	<Header plain={b_mandatory} pops={!b_mandatory}
		title={b_mandatory? 'Create new account': 'Add account'}
	/>

	<hr class="no-margin">

	{#if !b_mandatory}
		<div class="text-align_right">
			<button class="pill" on:click={new_seed}>
				<span class="global_svg-icon icon-diameter_18px">
					{@html SX_ICON_ADD}
				</span>
				Add Seed Phrase
			</button>
		</div>
	{:else}
		<p>
			Now that your wallet has a seed, you can start creating accounts to hold funds.
		</p>
	{/if}

	<Field name='Mnemonic Seed Source'>
		<StarSelect
			items={a_items}
			bind:value={g_selected_seed}
			on:select={select_seed}
		/>
	</Field>

	<div>
		<div class="options">
			<span class="link" on:click={toggle_advanced}>
				<span class="global_svg-icon icon-diameter_18px">
					{@html SX_ICON_GEAR}
				</span>
				<span class="text">
					Advanced
				</span>
			</span>
		</div>

		{#if b_advanced}
			<div class="advanced" transition:slide={{duration:300}}>
				<Field name='BIP-44 Derivation Path'>
					<Bip44Input
						bind:s_bip44={sx_bip44_path}
						bind:b_valid={b_valid_bip44}
						bind:s_err_bip44={s_err_bip44}
						on:select={() => update_path(true)}
					/>
				</Field>
			</div>
		{/if}
	</div>

	{#if g_selected_seed?.value}
		{#await Secrets.metadata(g_selected_seed.value) then g_secret}
			{#if 'imported' === g_secret['origin']}
				<p>
					If you are importing accounts from Keplr, you will want to do this once
					<span class="link" on:click={() => use_coin_type('529')}>using coin type #529</span> for Secret Network,
					and then again <span class="link" on:click={() => use_coin_type('118')}>using coin type #118</span> for all other Cosmos chains.
				</p>
			{/if}
		{/await}
	{/if}

	<div class="flex_1" />
	
	<ActionsWall>
		<button class="primary"
			disabled={!b_valid_bip44 || b_conflict || b_busy}
			on:click={new_account}
		>
			Create new account
		</button>
	</ActionsWall>
</Screen>