<script lang="ts">
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AccountPath} from '#/meta/account';
	import type {Bech32, Chain, CoinInfo, ContractPath, ContractStruct, FeeConfig, HoldingPath} from '#/meta/chain';
	import type {ContactPath} from '#/meta/contact';
	import {ContactAgentType} from '#/meta/contact';
	
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import {MsgSend} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
	import BigNumber from 'bignumber.js';
	import {getContext, onDestroy} from 'svelte';
	import {slide} from 'svelte/transition';
	
	import {Screen, type Page} from './_screens';
	
	import {ThreadId} from '../def';
	
	import AmountInput, {AssetType} from '#/app/frag/AmountInput.svelte';
	import AssetSelect from '#/app/frag/AssetSelect.svelte';
	import {encode_proto} from '#/chain/cosmos-msgs';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {encrypt_private_memo} from '#/crypto/privacy';
	import {NB_MAX_MEMO, R_BECH32, XT_MINUTES} from '#/share/constants';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {fold, microtask} from '#/util/belt';
	import {buffer_to_base93, text_to_buffer} from '#/util/data';
	import {
		yw_account,
		yw_account_ref,
		yw_chain,
		yw_chain_ref,
		yw_navigator,
		yw_network,
		yw_owner,
		yw_settings,
	} from '##/mem';
	
	import CheckboxField from '##/ui/CheckboxField.svelte';
	import Field from '##/ui/Field.svelte';
	import Header from '##/ui/Header.svelte';
	
	import ContactEdit from './ContactEdit.svelte';
	import ContactsHome from './ContactsHome.svelte';
	import ContractEdit from './ContractEdit.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import SettingsMemos from './SettingsMemos.svelte';
	import RecipientSelect from '../frag/RecipientSelect.svelte';
	import SenderSelect from '../frag/SenderSelect.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Collapsable from '../ui/Collapsable.svelte';
	import Notice from '../ui/Notice.svelte';
	
	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import SX_ICON_LOADING from '#/icon/loading.svg?raw';
	import SX_ICON_SHIELD from '#/icon/shield.svg?raw';
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	
	

	const G_SLIDE_IN = {
		duration: 350,
		delay: 110,
	};

	const G_SLIDE_OUT = {
		duration: 150,
	};

	const k_page = getContext<Page>('page');

	/**
	 * Token to use for transfer (instead of native coin)
	 */
	export let assetPath: HoldingPath | ContractPath | '' = '';


	/**
	 * Address of initial receiver
	 */
	export let recipient: Bech32 | '' = '';
	let sa_recipient: Bech32 | '' = recipient;

	// address to contact lookup cache
	let h_addr_to_contact: Record<Chain.Bech32String, ContactPath>;

	// address to account lookup cache
	let h_addr_to_account: Record<Chain.Bech32String, AccountPath>;

	// bindings for AmountInput
	let s_amount: string;
	let n_decimals: number;
	let s_symbol: string;
	let xc_asset: AssetType;
	let b_use_max: boolean;

	// native coin info
	let g_coin: CoinInfo | null = null;
	
	$: b_asset_coin = AssetType.COIN === xc_asset;
	$: b_asset_token = AssetType.TOKEN === xc_asset;

	let g_contract: ContractStruct | null = null;
	// $: if(b_asset_token) {
	// 	// reset struct
	// 	g_contract = null;

	// 	const p_contract = assetPath as ContractPath;
	// 	Contracts.at(p_contract).then((_g_contract) => {
	// 		// asset hasn't changed while loading contract
	// 		if(p_contract === assetPath) {
	// 			g_contract = _g_contract;
	// 		}
	// 	});
	// }

	// fee buffers
	$: h_fee_buffers = fold($yw_chain.feeCoinIds || [], si_coin => ({
		// TODO: use simulation data
		[si_coin]: BigNumber(15_000n+''),
	}));


	let b_busy_agents = false;
	async function reload_agents(b_init=false) {
		// already busy reloading
		if(b_busy_agents) return;

		// now it's busy
		b_busy_agents = true;

		// load agents store
		const ks_agents = await Agents.read();

		// read contact entries
		const a_contacts = [...ks_agents.contacts()];

		// // replace cache
		// h_contacts = ofe(a_contacts);

		// replace address lookup cache
		h_addr_to_contact = fold(a_contacts, ([p_contact, g_contact]) => ({
			[Agents.addressFor(g_contact, $yw_chain)]: p_contact,
		}));

		// replace address lookup cache
		h_addr_to_account = fold(await Accounts.entries(), ([p_account, g_account]) => ({
			[Chains.addressFor(g_account.pubkey, $yw_chain)]: p_account,
		}));

		// no longer busy
		b_busy_agents = false;
	}

	// subscriptions
	{
		// reload agents when agents store updates
		subscribe_store('agents', reload_agents, onDestroy);

		// reload agents when chain changes
		const f_unsub_chain = yw_chain.subscribe(reload_agents as VoidFunction);

		// unsubscribe when screen is destroyed
		onDestroy(() => {
			f_unsub_chain();
		});
	}


	const H_ADDRESS_TYPES = {
		none: {
			icon: '<svg></svg>',
			text: '',
		},

		unknown: {
			icon: SX_ICON_LOADING,
			text: 'Determining address type...',
		},

		personal: {
			icon: SX_ICON_PERSONAL,
			text: 'Personal address',
		},

		contract: {
			icon: SX_ICON_CONTRACT,
			text: 'Contract address',
		},
	} as const;

	let si_address_type: keyof typeof H_ADDRESS_TYPES = 'none';
	$: g_address_type = H_ADDRESS_TYPES[si_address_type];

	// whether the user has enabled encryption
	let b_private_memo_enabled = false;
	let b_private_memo_published = false;
	let b_private_memo_recipient_published = false;

	let b_memo_expanded = false;
	let b_memo_private = false;
	let s_memo = '';

	// 
	async function reload_settings() {
		const h_e2es = $yw_settings.e2e_encrypted_memos || null;
		if(h_e2es?.[$yw_chain_ref]) {
			const g_config = h_e2es[$yw_chain_ref];
			({
				enabled: b_private_memo_enabled,
				published: b_private_memo_published,
			} = g_config);

			check_recipient_publicity();
		}
	}

	void reload_settings();
	subscribe_store('settings', () => reload_settings, onDestroy);

	const h_recipient_publicities: Record<Bech32, number> = {};

	function check_recipient_publicity() {
		// ref cached value
		const xt_cached = h_recipient_publicities[sa_recipient];

		// recipient is published
		if(xt_cached < 0) {
			b_private_memo_recipient_published = true;
			return;
		}
		// recipient wasn't published as of 1 minute ago
		else if(xt_cached > 0 && Date.now() - xt_cached < 1 * XT_MINUTES) {
			b_private_memo_recipient_published = false;
			return;
		}

		// cache selected recipient in case it changes while request is underway
		const sa_check = sa_recipient;

		// fetch recipient's account sequence
		$yw_network.e2eInfoFor(sa_check as Bech32).then((g_info) => {
			// parse and cache published state
			const b_published = h_recipient_publicities[sa_check] = !!g_info.sequence;

			// same recipient still selected
			if(sa_recipient === sa_check) {
				b_private_memo_recipient_published = b_published;
			}
		}).catch(() => {
			b_memo_private = false;
		});
	}

	$: {
		if(!sa_recipient) {
			si_address_type = 'none';
		}
		else {
			si_address_type = 'unknown';

			void $yw_network.isContract(sa_recipient as Bech32).then((b_contract) => {
				if(b_contract) {
					si_address_type = 'contract';
				}
				else {
					si_address_type = 'personal';
				}
			});

			check_recipient_publicity();
		}
	}


	async function submit() {
		let g_msg!: Any;
		let gc_props: {
			fee?: FeeConfig;
			memo?: string;
		} = {};

		const s_amount_denom = BigNumber(s_amount).shiftedBy(n_decimals).toString();

		if(!b_form_valid) {
			c_show_validations++;
			return;
		}

		// prep final memo string
		let s_memo_final = s_memo;

		// private memo
		if((b_memo_private || (!s_memo.length && b_private_memo_enabled && b_private_memo_published)) && b_private_memo_recipient_published) {
			s_memo_final = await encrypt_private_memo(
				s_memo,
				$yw_chain,
				$yw_account_ref,
				sa_recipient as Bech32,
				$yw_network
			);
		}

		if(b_asset_coin) {
			// TODO: support use max to send entire balance

			g_msg = {
				typeUrl: '/cosmos.bank.v1beta1.MsgSend',
				value: encode_proto(MsgSend, {
					fromAddress: $yw_owner,
					toAddress: sa_recipient,
					amount: [{
						amount: s_amount_denom,
						denom: g_coin!.denom,
					}],
				}),
			};

			// TODO: get gas limit from chain struct
			gc_props = {
				fee: {
					limit: 15_000n,
				} as FeeConfig,
				memo: s_memo_final,
			};


			// k_page.push({
			// 	creator: SendNative,
			// 	props: {
			// 		accountPath: $yw_account_ref,
			// 		coin: si_native,
			// 		recipient: sa_recipient,
			// 		amount: s_amount,
			// 		memoPlaintext: s_memo,
			// 		encryptMemo: (b_memo_private || (!s_memo.length && b_private_memo_enabled && b_private_memo_published)) && b_private_memo_recipient_published,
			// 		fee: x_fee+'',
			// 	},
			// });
		}
		else {
			// secret-wasm
			const g_secretwasm = $yw_chain.features.secretwasm;
			if(g_secretwasm) {
				const k_token = new Snip2xToken(g_contract!, $yw_network as SecretNetwork, $yw_account);

				const xg_transfer = BigInt(s_amount_denom);
				const g_prebuilt = await k_token.transfer(xg_transfer, sa_recipient as Bech32, s_memo);

				g_msg = g_prebuilt.proto;

				gc_props = {
					fee: {
						limit: g_secretwasm.snip20GasLimits.transfer,
					} as FeeConfig,
				};
			}
		}

		if(g_msg) {
			k_page.push({
				creator: RequestSignature,
				props: {
					...gc_props,
					protoMsgs: [g_msg],
					broadcast: {},
					local: true,
				},
				context: {
					chain: $yw_chain,
					accountPath: $yw_account_ref,
					app: G_APP_STARSHELL,
					async completed(b_completed) {
						// pop twice
						{
							$yw_navigator.activePage.pop();

							await microtask();

							$yw_navigator.activePage.pop();
						}

						if(b_completed && b_checked_save_contact) {
							await microtask();

							await $yw_navigator.activateThread(ThreadId.AGENTS);

							$yw_navigator.activeThread.reset();

							$yw_navigator.activePage.push({
								creator: ContactsHome,
							});

							$yw_navigator.activePage.push({
								creator: ContactEdit,
								props: {
									g_contact: {
										addressData: sa_recipient.replace(R_BECH32, '$3'),
										addressSpace: 'acc',
										namespace: 'cosmos',
										chains: [$yw_chain_ref],
										name: s_new_contact,
										agentType: ContactAgentType.PERSON,
										notes: '',
										pfp: '',
										origin: 'user',
									},
								},
							});
						}
					},
				},
			});
		}
	}

	let c_show_validations = 0;

	let b_checked_save_contact = false;


	let s_err_recipient = '';
	let s_err_amount = '';

	$: b_new_address = sa_recipient && !h_addr_to_contact?.[sa_recipient] && !h_addr_to_account?.[sa_recipient];


	const R_CONTACT_NAME = /^\S.{0,1023}$/;
	
	let s_new_contact = '';
	$: s_err_new_contact = b_checked_save_contact && (c_show_validations || true)
		? s_new_contact
			? R_CONTACT_NAME.test(s_new_contact)
				? ''
				: s_new_contact.length > 1024
					? 'That name is way too long'
					: 'Cannot begin with space'
			: 'Enter an agent name to save new address'
		: '';

	$: {
		if(b_checked_save_contact && !c_show_validations) {
			s_err_new_contact = '';
		}
	}

	// form validation state
	$: b_form_valid = (sa_recipient
		&& s_amount
		&& !s_err_recipient
		&& !s_err_amount
		&& (!b_new_address || !b_checked_save_contact || (s_new_contact && !s_err_new_contact))
	) || false;

	function input_new_contact(d_event: Event) {
		s_new_contact = (d_event.target as HTMLInputElement).value;
	}

	function adjust_memo_settings() {
		k_page.push({
			creator: SettingsMemos,
			context: {
				intent: {
					id: 'send_adjust_memo_settings',
				},
			},
		});
	}

	// when the page reappears, reload settings
	k_page.on({
		restore() {
			void reload_settings();
		},
	});

	function adjust_contract_settings() {
		k_page.push({
			creator: ContractEdit,
			props: {
				p_contract: assetPath as ContractPath,
			},
		});
	}

	// reactively update account if user switches in select
	let p_account_select: AccountPath = $yw_account_ref;
	$: if(p_account_select) {
		$yw_account_ref = p_account_select;
	}

	const sx_style_private_memo_checkbox = `
		position: absolute;
		right: 0;
		margin-top: -23px;
	`;
</script>


<style lang="less">
	@import '../_base.less';

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	#field-recipient-status {
		:global(&) {
			margin-top: -12px;
			margin-bottom: 0;
		}

		.field-value {
			margin-left: -2px;
		}

		.status {
			:global(&.unknown>.icon) {
				animation: spin 1s linear infinite;
			}
			:global(&.contract>.icon) {
				transform: rotate(90deg);
			}
			:global(&.contract>.icon) {
				transform: rotate(90deg);
			}
		}
	}

	.status {
		color: var(--theme-color-graymed);
		display: flex;
		align-items: center;
		gap: 3px;
		margin-left: -1px;

		>.icon {
			--proxy-icon-diameter: 20px;
			--icon-color: var(--theme-color-graymed);

			:global(svg) {
				width: var(--icon-diameter);
				height: var(--icon-diameter);
			}
		}

		>.text {
			.font(tiny);
		}
	}

	.fee-fiat {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	#field-fee-manual {
		.field-value {
			:global(&) {
				flex: 1;
			}
		}

		.manual-fee {
			:global(&) {
				flex: 2;
			}
		}
	}

	#field-manual-fee {
		:global(&) {
			margin-top: -12px;
		}
	}

	.manual-fee {
		display: flex;
		align-items: center;
		gap: 0.5em;

		>.icon.info {
			--icon-diameter: 18px;
			padding: 2px;
		}
	}

	.memo {
		display: flex;
		flex-direction: column;
		@memo-gap: 0.75em;
		gap: @memo-gap;

		:global(fieldset.encrypt) {
			margin-left: auto;
			margin-right: 0.5em;
		}

		.submemo {
			position: relative;

			.disclaimer {
				.font(tiny);
				color: var(--theme-color-text-med);
				text-align: left;
				position: absolute;
				bottom: 1.25em;
			}

			.memo-length-indicator {
				position: absolute;
				right: 18px;
				bottom: 3em;
				background-color: fade(black, 40%);
				padding: 2px 6px;
				border-radius: 6px;
			}
		}

		.input {
			margin-bottom: 1.5em;
		}
	}

	.new-address {
		margin-top: 12px;
	}
</style>


<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
	return false;
}}>
	<Header pops
		title={b_asset_coin? 'Sending': 'Transferring'}
		postTitle={s_symbol}
		subtitle={$yw_chain?.name || '?'}
	/>

	<Field short
		key='sender-select'
		name='From'
	>
		<SenderSelect
			bind:accountPath={p_account_select}
		/>
	</Field>

	<Field short
		key='recipient-select'
		name='To'
	>
		<RecipientSelect
			bind:error={s_err_recipient}
			bind:address={sa_recipient}
			showValidation={c_show_validations}
		/>
	</Field>

	<Field short
		key='recipient-status'
		name=''
	>
		<span class="status {si_address_type}">
			<span class="icon">
				{@html g_address_type.icon}
			</span>
			<span class="text">
				{g_address_type.text}
			</span>
		</span>

		{#if b_new_address}
			<div class="new-address">
				<CheckboxField id="save-contact" bind:checked={b_checked_save_contact} >
					Save new contact
				</CheckboxField>
			</div>
		{/if}
	</Field>

	{#if b_new_address && b_checked_save_contact}
		<Field short slides
			key='new-contact-name'
			name='Save as'
		>
			<input id="new-contact-name-value" type="text" on:input={input_new_contact} class:invalid={s_err_new_contact}>

			{#if s_err_new_contact}
				<span class="validation-message">
					{s_err_new_contact}
				</span>
			{/if}
		</Field>
	{/if}

	<hr class="no-margin">

	<Field short
		key='asset-select'
		name='Asset'
	>
		<AssetSelect bind:assetPath={assetPath} />
	</Field>

	<Field short
		key='amount'
		name='Amount'
	>
		<AmountInput
			feeBuffers={h_fee_buffers}
			assetPath={assetPath}
			bind:assetType={xc_asset}
			bind:symbol={s_symbol}
			bind:useMax={b_use_max}
			bind:error={s_err_amount}
			bind:value={s_amount}
			bind:decimals={n_decimals}
			bind:coin={g_coin}
			bind:contract={g_contract}
		/>
	</Field>

	<div class="memo" class:expanded={b_memo_expanded}>
		<Collapsable title='Add memo' bind:expanded={b_memo_expanded}>
			{#if b_asset_coin && b_private_memo_enabled}
				{#if b_private_memo_enabled && b_private_memo_recipient_published}
					<CheckboxField containerClass='encrypt' id='encrypted'
						bind:checked={b_memo_private}
						rootStyle={sx_style_private_memo_checkbox}
					>
						Private
					</CheckboxField>
				{/if}
			{:else if b_asset_token && g_contract?.interfaces.snip21}
				<CheckboxField containerClass='encrypt' id='encrypted' checked={true} disabled
					rootStyle={sx_style_private_memo_checkbox}
				>
					Private
				</CheckboxField>
			{/if}
		</Collapsable>

		{#if b_memo_expanded}
			{#if b_asset_coin && !b_private_memo_enabled}
				<Notice
					dismissable='send_encrypted_memo'
					title='Make Your Memos Private'
					action={['Enable Private Memos', adjust_memo_settings]}
				>
					StarShell allows you to send end-to-end encrypted memos that can only be seen by you and the recipient.
					<br style="display:block; content:''; margin:0.75em;" />
					Enable this feature to send and receive encrypted memos. You can always change this later in settings.
				</Notice>
			{/if}

			<div class="input" transition:slide={{duration:350}}>
				<textarea bind:value={s_memo}></textarea>
			</div>

			<div class="submemo">
				{#if b_asset_coin}
					{#if !b_private_memo_recipient_published}
						<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
							<span class="global_svg-icon display_inline icon-diameter_18px">
								{@html SX_ICON_VISIBILITY}
							</span>
							<span class="text vertical-align_middle">
								Recipient isn't published, memo will be public. <span class="link" on:click={() => adjust_memo_settings()}>Settings</span>
							</span>
						</span>
					{:else if !b_memo_private}
						{#if !s_memo.length && b_private_memo_enabled && b_private_memo_published}
							<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
								<span class="global_svg-icon display_inline icon-diameter_18px">
									{@html SX_ICON_SHIELD}
								</span>
								<span class="text vertical-align_middle">
									Empty memos still appear encrypted. <span class="link" on:click={() => adjust_memo_settings()}>Settings</span>
								</span>
							</span>
						{:else}
							<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
								<span class="global_svg-icon display_inline icon-diameter_18px">
									{@html SX_ICON_VISIBILITY}
								</span>
								<span class="text vertical-align_middle">
									This memo will be public. <span class="link" on:click={() => adjust_memo_settings()}>Settings</span>
								</span>
							</span>
						{/if}
					{:else}
						<span class="memo-length-indicator" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
							{buffer_to_base93(text_to_buffer(s_memo || '')).length} / {NB_MAX_MEMO}
						</span>

						<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
							<span class="global_svg-icon display_inline icon-diameter_18px" style="color:var(--theme-color-sky);">
								{@html SX_ICON_SHIELD}
							</span>
							<span class="text vertical-align_middle">
								This memo will be private, using encryption. <span class="link" on:click={() => adjust_memo_settings()}>Settings</span>
							</span>
						</span>
					{/if}
				{:else if b_asset_token && g_contract?.interfaces.snip21}
					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px" style="color:var(--theme-color-sky);">
							{@html SX_ICON_SHIELD}
						</span>
						<span class="text vertical-align_middle">
							This memo will be private, using the SNIP-21 interface.
						</span>
					</span>
				{:else}
					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px">
							{@html SX_ICON_VISIBILITY}
						</span>
						<span class="text vertical-align_middle">
							This memo will be public.&nbsp;&nbsp;<span class="link" on:click={() => adjust_contract_settings()}>{s_symbol} Settings</span>
						</span>
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid]} />
</Screen>