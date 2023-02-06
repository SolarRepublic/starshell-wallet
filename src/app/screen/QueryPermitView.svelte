<script lang="ts">
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {AppStruct} from '#/meta/app';
	import type {Bech32, ChainStruct, ContractStruct} from '#/meta/chain';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	import type {Snip24Permission} from '#/schema/snip-24-def';
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {onDestroy} from 'svelte';
	
	import {Screen, Header} from './_screens';
	import {yw_network} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {produce_contract} from '#/chain/contract';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Secrets} from '#/store/secrets';
	import {ode} from '#/util/belt';
	
	import QueryPermitEdit from './QueryPermitEdit.svelte';
	import QueryPermitShare from './QueryPermitShare.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import type {Actions} from '../frag/Portrait.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import Row from '../ui/Row.svelte';
	import Spacer from '../ui/Spacer.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_BAN from '#/icon/ban.svg?raw';
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
    import ContractView from './ContractView.svelte';
	
	

	let c_updates = 0;

	subscribe_store('secrets', () => c_updates++, onDestroy);

	const S_TOOLTIP_FRAGMENT_ALLOWANCE = `all spending allowances you've authorized and have been granted for the given token(s)`;

	const {
		k_page,
	} = load_page_context();

	export let secretPath: SecretPath<'query_permit'>;

	let s_header_subtitle = '';
	let s_portrait_title = '';
	let s_portrait_subtitle = '';

	let s_tooltip = '';
	let g_secret: SecretStruct<'query_permit'>;
	let g_chain: ChainStruct;
	let p_account: AccountPath;
	let g_account: AccountStruct;
	let a_contracts: [ContractStruct, string][];
	let a_outlets: AppStruct[];
	let sa_owner: Bech32;
	let a_permissions: Snip24Permission[] = [];

	async function load_query_permit(): Promise<void> {
		g_secret = await Secrets.metadata(secretPath);

		const p_chain = g_secret.chain;
		g_chain = (await Chains.at(p_chain))!;
		s_header_subtitle = g_chain.name;

		sa_owner = g_secret.owner;

		[p_account, g_account] = await Accounts.find(sa_owner, g_chain);

		a_contracts = [];
		const ks_contracts = await Contracts.read();
		for(const [sa_contract, si_revoked] of ode(g_secret.contracts)) {
			const p_contract = Contracts.pathFor(p_chain, sa_contract);
			a_contracts.push([
				ks_contracts.at(p_contract) || await produce_contract(sa_contract, g_chain),
				si_revoked,
			]);
		}

		a_outlets = [];
		const ks_apps = await Apps.read();
		for(const p_outlet of g_secret.outlets) {
			a_outlets.push(ks_apps.at(p_outlet));
		}

		s_portrait_title = g_secret.name;
		s_portrait_subtitle = g_secret.alias || `${a_outlets[0].host} Permit for ${a_contracts.map(a => a[0].name).join(', ')}`;

		a_permissions = g_secret.permissions;
		s_tooltip = `Listed apps are able to view `;
		if(a_permissions.includes('owner')) {
			s_tooltip += `all your private data stored in the given contracts, including balance, history, and allowances`;
		}
		else if(a_permissions.includes('history')) {
			s_tooltip += `your balance and transaction history for the given token(s)`;

			if(a_permissions.includes('allowance')) {
				s_tooltip += `, as well as ${S_TOOLTIP_FRAGMENT_ALLOWANCE}`;
			}
		}
		else if(a_permissions.includes('balance')) {
			s_tooltip += `your token balance`;

			if(a_permissions.includes('allowance')) {
				s_tooltip += ` as well as ${S_TOOLTIP_FRAGMENT_ALLOWANCE}`;
			}
		}
		else if(a_permissions.includes('allowance')) {
			s_tooltip += S_TOOLTIP_FRAGMENT_ALLOWANCE;
		}
		else {
			s_tooltip += 'nothing known by the SNIP-24 standards';
		}

		s_tooltip += '.';
	}

	async function revoke_permit_from_contracts(a_tokens: ContractStruct[]) {
		const a_msgs_proto: Any[] = [];

		for(const g_contract of a_tokens) {
			const g_encoded = await Snip2xMessageConstructor.revoke_permit(g_account, g_contract, $yw_network as SecretNetwork, g_secret.name);
			a_msgs_proto.push(g_encoded.proto);
		}

		k_page.push({
			creator: RequestSignature,
			props: {
				protoMsgs: a_msgs_proto,
				fee: {
					limit: BigInt(a_msgs_proto.length) * BigInt(g_chain.features.secretwasm!.snip20GasLimits.revoke_permit),
				},
				broadcast: {},
				local: true,
			},
			context: {
				chain: g_chain,
				accountPath: Accounts.pathFrom(g_account),
				app: G_APP_STARSHELL,
			},
		});
	}

	const gc_actions: Actions = {
		edit: {
			trigger() {
				k_page.push({
					creator: QueryPermitEdit,
					props: {
						secretPath,
					},
				});
			},
		},

		revoke: {
			async trigger() {
				await revoke_permit_from_contracts(a_contracts.map(a => a[0]));
			},
		},

		// share: {
		// 	trigger() {
		// 		k_page.push({
		// 			creator: QueryPermitShare,
		// 			props: {
		// 				permit: g_secret,
		// 			},
		// 		});
		// 	},
		// },
	};

	let b_tooltip_showing = false;
</script>

<style lang="less">
	.chain-account {
		display: flex;

		>* {
			flex: auto;
		}
	}

	.actions {
		color: var(--theme-color-primary);
	}

	.permissions {
		display: flex;
		justify-content: space-between;
	}
</style>

<Screen slides>
	{#key c_updates}
		<Header title='Query Permit' subtitle={s_header_subtitle} pops search />

		{#await load_query_permit()}
			<Portrait loading
				actions={gc_actions}
				resourcePath={secretPath}
			/>
		{:then}
			<Portrait
				pfp={a_outlets[0].pfp}
				title={s_portrait_title}
				subtitle={s_portrait_subtitle}
				actions={gc_actions}
			/>

			<Fields configs={[
				{
					type: 'accounts',
					label: 'Account',
					paths: [p_account],
					short: true,
				},
			]} />

			<Field short
				key='permissions' name='Permissions'
			>
				{@const a_permissions = g_secret.permissions}
				<span class="permissions">
					<span style="position:relative; z-index:16;">
						{a_permissions.join(', ')}
					</span>
					<Tooltip bind:showing={b_tooltip_showing}>
						{s_tooltip}
					</Tooltip>
				</span>
			</Field>

			<Field key='contracts' name='Tokens / Contracts'>
				{#each a_contracts as [g_contract, si_revoked]}
					<Row noHorizontalPad
						cancelled={!!si_revoked}
						resource={g_contract}
						address={g_contract.bech32}
						on:click={() => {
							k_page.push({
								creator: ContractView,
								props: {
									contractPath: Contracts.pathFrom(g_contract),
								},
							});
						}}
					>
						<div class="actions" slot="right" style="margin-left:var(--icon-margin);">
							<span class="global_svg-icon icon-diameter_24px"
								on:click|stopPropagation={() => revoke_permit_from_contracts([g_contract])}
							>
								{@html SX_ICON_BAN}
							</span>
						</div>
					</Row>
				{/each}
			</Field>

			<Field key='apps' name='Apps'>
				{#each a_outlets as g_app}
					<Row noHorizontalPad
						resource={g_app}
						address={g_app.host}
					>
					</Row>
				{/each}
			</Field>
		{/await}
	{/key}

	<Spacer height="1em" />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
