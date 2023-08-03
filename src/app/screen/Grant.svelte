<script lang="ts">
	import {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
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
	import {NB_MAX_MEMO, R_BECH32, XT_DAYS, XT_HOURS, XT_MINUTES} from '#/share/constants';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {fold, microtask, oderac} from '#/util/belt';
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
	import StaticSelect from '../ui/StaticSelect.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import { MsgGrantAllowance } from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/tx';
	import { BasicAllowance, PeriodicAllowance } from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/feegrant';
	import { Duration } from '@solar-republic/cosmos-grpc/dist/google/protobuf/duration';
	import { Coin } from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	import { starshell_transaction } from '../helper/starshell';
	import NumericInput from '../frag/NumericInput.svelte';
	import StarSelect, { type SelectOption } from '../ui/StarSelect.svelte';


	enum GrantType {
		FEE_GRANT = 'Fee Grant',
		AUTHZ = 'AuthZ',
	}

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
	 * Address of initial recipient
	 */
	export let address: Bech32 | '' = '';

	let sa_recipient: Bech32 | '' = address;


	let b_tooltip_showing = false;

	// reactively update account if user switches in select
	let p_account_select: AccountPath = $yw_account_ref;
	$: if(p_account_select) {
		$yw_account_ref = p_account_select;
	}

	let si_type_grant: GrantType = GrantType.FEE_GRANT;

	let s_err_recipient = '';


	let c_show_validations = 0;

	let xn_duration_number = '0';

	let sg_limit_total: `${bigint}` = '20000';
	let s_denom = 'uscrt';

	// form validation state
	$: b_form_valid = (sa_recipient
		// && s_amount
		// && !s_err_recipient
		// && !s_err_amount
		// && (!b_new_address || !b_checked_save_contact || (s_new_contact && !s_err_new_contact))
	) || false;

	async function submit() {
		let g_allowance!: Any;

		const dt_expire = new Date(Date.now() + (+xn_duration_number * +g_duration.value));

		// fee grant
		if(GrantType.FEE_GRANT === si_type_grant) {
			// allowance type
			g_allowance = Any.fromPartial({
				typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
				value: encode_proto(BasicAllowance, {
					expiration: {
						seconds: ''+Math.round(dt_expire.getTime() / 1e3),
					},
					spendLimit: [Coin.fromPartial({
						amount: sg_limit_total,
						denom: s_denom,
					})],
				}),
			});

			// encode_proto(PeriodicAllowance, {
			// 	basic: {
			// 		expiration: {
			// 			seconds: dt_expire.toISOString(),
			// 		},
			// 	},
			// 	period: Duration.fromPartial({
			// 		seconds: `${12 * 60 * 60}`,  // 12 hours
			// 	}),
			// 	periodSpendLimit: [Coin.fromPartial({
			// 		amount: '1'+'0'.repeat(6),  // 1 SCRT
			// 		denom: 'uscrt',
			// 	})],
			// 	// periodCanSpend: [Coin.fromPartial({
			// 	// 	amount: '1'+'0'.repeat(6),
			// 	// 	denom: 'uscrt',
			// 	// })],
			// })
		}

		starshell_transaction([
			Any.fromPartial({
				typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
				value: encode_proto(MsgGrantAllowance, {
					granter: Chains.addressFor($yw_account.pubkey, $yw_chain),
					grantee: sa_recipient,
					allowance: g_allowance,
				}),
			}),
		], 25_000n);
	}


	let a_duration_options: SelectOption[] = oderac({
		minutes: XT_MINUTES,
		hours: XT_HOURS,
		days: XT_DAYS,
		weeks: 7 * XT_DAYS,
		years: 365 * XT_DAYS,
	}, (si_key, xt_duration) => ({
		value: ''+xt_duration,
		primary: si_key,
	}));

	let g_duration: SelectOption = a_duration_options[0];
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
		title={'Grant'}
		postTitle={''}
		subtitle={$yw_chain?.name || '?'}
	/>

	<Field short name="Type">
		<div style="display: flex; justify-content: space-between;">
			<StaticSelect a_options={[GrantType.FEE_GRANT, GrantType.AUTHZ]} xpx_width={90} bind:z_selected={si_type_grant} />
			<Tooltip bind:showing={b_tooltip_showing}>
				<p>
					Use Fee Grant to allow a fellow contact to spend gas from your account.
				</p>
				<p>
					Use AuthZ to grant another account with the ability to sign messages on your behalf.
					CAUTION: AuthZ may lead to a loss of funds!
					Only use it if you know exactly what you are doing.
				</p>
			</Tooltip>
		</div>
	</Field>

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
		name='For'
	>
		<RecipientSelect
			bind:error={s_err_recipient}
			bind:address={sa_recipient}
			showValidation={c_show_validations}
		/>
	</Field>

	<Field short
		key='duration'
		name='Expires'
	>
		<NumericInput required decimals={1} bind:value={xn_duration_number} />
		<StarSelect items={a_duration_options} bind:value={g_duration} />
	</Field>
<!-- 
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
	{/if} -->

	<hr class="no-margin">

	<!-- <Field short
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
	</Field> -->

	<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>