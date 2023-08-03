import type {ReviewedMessage} from './_types';
import type {SecretNetwork} from '../secret-network';
import type {Coin} from '@cosmjs/amino';

import type {Promisable, Values} from '#/meta/belt';
import type {Bech32, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {Snip20} from '#/schema/snip-20-def';
import {deduce_token_interfaces, Snip2xToken} from '#/schema/snip-2x-const';

import type {Snip2x} from '#/schema/snip-2x-def';

import BigNumber from 'bignumber.js';

import {address_to_name} from './_util';

import {Coins} from '../coin';

import {produce_contract} from '../contract';

import type {LoadedAppContext} from '#/app/svelte';
import type {NotifyItemConfig} from '#/extension/notifications';

import {global_broadcast} from '#/script/msg-global';
import {Accounts} from '#/store/accounts';
import {G_APP_STARSHELL} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Providers} from '#/store/providers';
import {Secrets} from '#/store/secrets';
import {fodemtv} from '#/util/belt';
import {buffer_to_text, text_to_buffer, uuid_v4} from '#/util/data';

import {format_amount} from '#/util/format';



const XT_QUERY_TOKEN_INFO = 10e3;

interface ExecContractMsg {
	msg: string;
	contract: Bech32;
	sent_funds: Coin[];
}

type TokenInfoResponse = Snip20.BaseQueryResponse<'token_info'>;

interface Bundle<si_key extends Snip2x.AnyMessageKey=Snip2x.AnyMessageKey> extends LoadedAppContext {
	h_args: Snip2x.AnyMessageParameters<si_key>[si_key];
	g_exec: ExecContractMsg;
	p_contract: ContractPath;
	g_contract_loaded: ContractStruct | null;
	g_contract: ContractStruct;
	g_snip20: NonNullable<ContractStruct['interfaces']['snip20']> | undefined;
	sa_owner: Bech32;
}

type SnipConfigs = {
	[si_each in Snip2x.AnyMessageKey]: (
		g_bundle: Bundle<si_each>
	) => Promisable<{
		apply?(si_txn: string): Promisable<NotifyItemConfig | void>;

		review?(b_pending: boolean): Promisable<ReviewedMessage>;
	} | void>;
};

type SnipHandler = {
	apply?(si_txn: string): Promisable<NotifyItemConfig | void>;

	review?(b_pending: boolean): Promisable<ReviewedMessage>;
};

type SnipHandlers<as_keys extends string=string> = {
	[si_each in Snip2x.AnyMessageKey]: (
		h_args: Snip2x.AnyMessageParameters<si_each>[si_each],
		g_context: LoadedAppContext,
		g_exec: ExecContractMsg,
	) => Promisable<SnipHandler | void>;
};

function snip_info(g_contract: ContractStruct, g_chain: ChainStruct): string[] {
	const g_snip20 = g_contract.interfaces.snip20!;

	return [`${g_snip20.symbol} token on ${g_chain.name}`];
}

function wrap_handlers<as_keys extends string>(h_configs: Partial<SnipConfigs>): SnipHandlers<as_keys> {
	return fodemtv(h_configs, (f_action, si_action) => async(
		h_args: Values<Snip2x.AnyMessageParameters>,
		g_context: LoadedAppContext,
		g_exec: ExecContractMsg
	) => {
		const {g_chain, p_chain, p_account, g_account, g_app, p_app} = g_context;

		// ref contract address
		const sa_contract = g_exec.contract;

		// construct contract path
		const p_contract = Contracts.pathFor(p_chain, sa_contract);

		// check if it exists
		const g_contract_loaded = await Contracts.at(p_contract);

		// load contract def
		const g_contract = g_contract_loaded || await produce_contract(sa_contract, g_chain, g_app, g_account);

		// prep snip20 struct
		const g_snip20 = g_contract.interfaces?.snip20;

		const g_wrapped = await f_action({
			h_args: h_args as Bundle['h_args'],
			p_app,
			g_app,
			p_chain,
			g_chain,
			p_account,
			g_account,
			p_contract,
			g_contract_loaded,
			g_contract,
			g_snip20,
			g_exec,
			sa_owner: Chains.addressFor(g_account.pubkey, g_chain),
		});

		if(!g_wrapped) return g_wrapped;

		// proxy certain actions
		const g_proxy = {
			...g_wrapped,
		} as SnipHandler;

		// contract isn't defined in store and is now being executed
		if(!g_contract_loaded && g_proxy.apply) {
			// proxy the handler
			g_proxy.apply = async function(...a_args: any) {
				// commit contract struct to store
				await Contracts.merge(g_contract);

				// apply proxied handler
				return await g_wrapped.apply!.apply(this, a_args);
			};
		}

		return g_proxy;
	}) as SnipHandlers<as_keys>;
}


export const H_SNIP_HANDLERS: Partial<SnipHandlers> = wrap_handlers<Snip2x.AnyMessageKey>({
	create_viewing_key(h_args) {
		return {
			async apply(si_txn) {
				// TODO: fetch viewing key from contract once tx succeeds
				debugger;

				return {
					title: '🔑 Viewing Key Created',
					message: '',
				};
			},
		};
	},

	decrease_allowance(h_args) {
		// TODO: implement

		return {
			apply: () => ({
				title: '🔻 Decreased Allowance',
				message: '',
			}),
		};
	},

	increase_allowance(h_args) {
		// TODO: implement
		return {
			apply: () => ({
				title: '🔺 Increased Allowance',
				message: '',
			}),
		};
	},

	/**
	 * Although intended for snip20, this is also compatible with snip721
	 */
	set_viewing_key: ({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract,
		g_snip20,
		g_snip721,
	}) => ({
		// as soon as a viewing key tx is signed
		approve(si_txn) {
			console.log({
				approved_viewing_key: true,
				g_contract,
				si_txn,
			});
		},

		async apply() {
			// whether this is a new token for the account
			let b_new_token = false;

			// contract exists
			if(g_contract_loaded) {
				// contract has snip-20 interface
				if(g_snip20 || g_snip721) {
					// previous viewing key exists
					const a_viewing_key = await Snip2xToken.viewingKeyFor(g_contract_loaded, g_chain, g_account);
					if(a_viewing_key) {
						// // delete old viewing key
						// await Secrets.deleteByStruct(a_viewing_key[1]);

						// disable old viewing key
						await Secrets.update({
							...a_viewing_key[1],
							on: 0,
						});
					}
					else {
						b_new_token = true;
					}
				}
				// contract does not have snip-20 interface, exit
				else {
					return;
				}
			}
			// contract does not yet exist
			else {
				// create contract def from token info response
				[p_contract, g_contract_loaded] = await Contracts.merge(g_contract);
			}

			const sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

			// save new viewing key
			const p_viewing_key_new = await Secrets.put(text_to_buffer(h_args.key), {
				type: 'viewing_key',
				on: 1,
				uuid: uuid_v4(),
				security: {
					type: 'none' as const,
				},
				name: `Viewing Key for ${g_snip20!.symbol}`,
				chain: p_chain,
				owner: sa_owner,
				contract: g_contract.bech32,
				outlets: g_app === G_APP_STARSHELL? []: [p_app],
			});

			// ensure asset is placed in account
			await Accounts.update(p_account, (g_account_latest) => {
				// refset assets
				const g_assets = g_account_latest.assets[p_chain] || {
					totalFiatCache: '??',
					fungibleTokens: [],
					data: {},
				};

				// destructure (non)fungibles list
				let a_fungibles = g_assets.fungibleTokens;
				let a_nonfungibles = g_assets.nonFungibleTokens;

				// ref contract address
				const sa_contract = g_contract.bech32;

				// snip20
				if(g_snip20) {
					// fungibles is currently lacking contract; append to list
					if(!a_fungibles.includes(sa_contract)) {
						a_fungibles = [...a_fungibles, sa_contract];
					}
				}
				// snip721
				else if(g_snip721) {
					// nonfungibles is currently lacking contract; append to list
					if(!a_nonfungibles.includes(sa_contract)) {
						a_nonfungibles = [...a_nonfungibles, sa_contract];
					}
				}

				// ref asset data
				const h_data = g_assets.data;

				// deepmerge everything
				return {
					assets: {
						...g_account_latest.assets,
						[p_chain]: {
							...g_account_latest.assets[p_chain],
							fungibleTokens: a_fungibles,
							nonFungibleTokens: a_nonfungibles,
							data: {
								...h_data,
								[sa_contract]: {
									...h_data?.[sa_contract],
									viewingKeyPath: p_viewing_key_new,
								},
							},
						},
					},
				};
			});

			// new token
			if(b_new_token) {
				// attempt to deduce interfaces automatically
				try {
					const k_network: SecretNetwork = await Providers.activateDefaultFor(g_chain);

					await deduce_token_interfaces(g_contract, k_network, g_account);
				}
				catch(e_deduce) {}

				// dispatch event
				global_broadcast({
					type: 'tokenAdded',
					value: {
						p_contract,
						sa_contract: g_contract.bech32,
						p_chain,
						p_account,
					},
				});
			}

			// notification summary
			return {
				group: nl => `Viewing Key${1 === nl? '': 's'} Updated`,
				title: '🔑 Viewing Key Updated',
				message: `${g_contract.name} token (${g_snip20!.symbol}) has been updated on ${g_chain.name}`,
			};
		},

		review(b_pending) {
			return {
				title: `Updat${b_pending? 'ing': 'ed'} Viewing Key`,
				infos: snip_info(g_contract, g_chain),
				fields: [
					{
						type: 'password',
						value: h_args.key,
						label: 'Viewing Key',
					},
				],
				resource: g_contract,
			};
		},
	}),

	mint: ({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract: g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		// attempt to parse the amount
		const xg_amount = BigNumber(h_args.amount).shiftedBy(-g_snip20!.decimals);

		const s_payload = `${format_amount(xg_amount.toNumber())} ${g_snip20!.symbol}`;

		return {
			apply() {
				// notification summary
				return {
					group: nl => `Token${1 === nl? '': 's'} Minted`,
					title: `🪙 Token Minted`,
					message: `Minted ${s_payload} on ${g_chain.name}`,
				};
			},

			review(b_pending) {
				return {
					title: `Mint${b_pending? 'ing': 'ed'} Token`,
					infos: snip_info(g_contract_pseudo, g_chain),
					fields: [
						{
							type: 'key_value',
							key: 'Amount',
							value: s_payload,
						},
					],
					resource: g_contract_pseudo,
				};
			},
		};
	},

	transfer: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract: g_contract_pseudo,
		sa_owner,
		g_snip20,
		g_exec,
	}) => {
		// attempt to parse the amount
		const xg_amount = BigNumber(h_args.amount).shiftedBy(-g_snip20!.decimals);

		const s_payload = `${format_amount(xg_amount.toNumber())} ${g_snip20!.symbol}`;

		const s_recipient = await address_to_name(h_args.recipient, g_chain);

		return {
			apply() {
				// broadcast event
				global_broadcast({
					type: 'fungibleSent',
					value: {
						p_chain,
						sa_sender: sa_owner,
						sa_contract: g_contract_pseudo.bech32,
					},
				});

				// notification summary
				return {
					group: nl => `Token${1 === nl? '': 's'} Sent`,
					title: `✅ Sent Tokens`,
					message: `Transferred ${s_payload} to ${s_recipient} on ${g_chain.name}`,
				};
			},

			review(b_pending, b_incoming) {
				return {
					title: b_incoming
						? `Received ${s_payload}`
						: `Transferr${b_pending? 'ing': 'ed'} ${s_payload}`,
					infos: snip_info(g_contract_pseudo, g_chain),
					fields: [
						{
							type: 'key_value',
							key: 'Amount',
							value: s_payload,
						},
						{
							type: 'contacts',
							bech32s: [h_args.recipient],
							label: 'Recipient',
							g_chain,
						},
						// private memo
						h_args.memo && {
							type: 'memo',
							value: h_args.memo,
						},
					],
					resource: g_contract_pseudo,
				};
			},
		};
	},

	revoke_permit: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract: g_contract_pseudo,
		g_exec,
	}) => {
		const sa_contract = g_exec.contract;

		// load permit metadata
		const g_secret = (await Secrets.filter({
			type: 'query_permit',
			chain: p_chain,
			owner: Chains.addressFor(g_account.pubkey, g_chain),
			name: h_args.permit_name,
			contracts: [sa_contract],
		}))![0];

		// const g_outlet = await Apps.at(g_secret.outlets[0]);

		return {
			async apply(si_txn) {
				// update query permit secret
				g_secret.contracts[sa_contract] = si_txn;
				await Secrets.update(g_secret);

				// notification summary
				return {
					group: nl => `Permit${1 === nl? '': 's'} Revoked`,
					title: `🙅 Permit Revoked`,
					message: `Apps will no longer be able to use this permit to view your private data.`,
				};
			},

			review(b_pending) {
				return {
					title: `Revok${b_pending? 'ing': 'ed'} Permit`,
					infos: [
						`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
					],
					fields: [
						{
							type: 'query_permit',
							secret: Secrets.pathFrom(g_secret),
						},
					],
					resource: {
						name: g_secret.name,
						pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
					},
				};
			},
		};
	},

	deposit: async({
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract: g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		const sa_contract = g_exec.contract;

		const a_sent = g_exec.sent_funds;

		const s_coins = Array.from(new Set(a_sent.map(g => Chains.coinFromDenom(g.denom, g_chain)))).join(' & ');
		const a_spends = a_sent.map(g => Chains.summarizeAmount(g, g_chain));
		const s_sent = a_spends.join(' + ');
		const s_symbol = g_snip20!.symbol;
		const k_network = await Providers.activateDefaultFor(g_chain);
		const k_token = Snip2xToken.from(g_contract_pseudo, k_network as SecretNetwork, g_account);
		const {
			exchange_rate: g_rate,
		} = await k_token!.exchangeRate();

		const a_tokens = a_sent.map((g_sent) => {
			const [si_coin, g_coin] = Coins.infoFromDenom(g_sent.denom, g_chain)!;

			if(g_coin.denom === g_rate.denom) {
				return BigNumber(g_sent.amount).shiftedBy(-g_coin.decimals).div(g_rate.rate).toString()+' '+s_symbol;
			}
			else {
				return `(${si_coin || '∅'}≠${g_rate.denom})`;
			}
		});

		const s_tokens = a_tokens.join(' + ');
		const s_token_names = a_tokens.map(s => s.split(/\s+/g).at(-1)).join(', ');

		return {
			apply() {
				return {
					group: nl => `Asset${1 === nl? '': 's'} Wrapped`,
					title: `🥷 Wrapped ${s_sent}`,
					message: `into ${s_token_names}.`,
				};
			},

			review(b_pending) {
				return {
					title: `Wrapp${b_pending? 'ing': 'ed'} ${s_sent}`,
					infos: [
						`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
					],
					fields: [],
					resource: {
						name: s_coins,
						pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
					},
				};
			},
		};
	},

	redeem: async({
		h_args,
		p_app, g_app,
		p_chain, g_chain,
		p_account, g_account,
		p_contract, g_contract_loaded, g_contract: g_contract_pseudo,
		g_snip20,
		g_exec,
	}) => {
		const k_network = await Providers.activateDefaultFor(g_chain);
		const k_token = Snip2xToken.from(g_contract_pseudo, k_network as SecretNetwork, g_account);
		const {
			exchange_rate: g_rate,
		} = await k_token!.exchangeRate();

		const yg_amount = BigNumber(h_args.amount).shiftedBy(-g_contract_pseudo.interfaces.snip20!.decimals);

		const s_tokens = yg_amount.toString()+' '+g_snip20!.symbol;
		const s_tokens_summary = format_amount(yg_amount.toNumber(), true)+' '+g_snip20!.symbol;

		const si_denom = g_rate.denom;
		const si_coin = Coins.idFromDenom(si_denom, g_chain);
		const s_coin_amount = yg_amount.times(g_rate.rate).toString();
		const s_coins = `${s_coin_amount} ${si_coin}`;

		return {
			affects: () => true,

			apply() {
				return {
					group: nl => `Asset${1 === nl? '': 's'} Wrapped`,
					title: `🎁 Unwrapped ${s_tokens_summary}`,
					message: `into ${si_coin}.`,
				};
			},

			review(b_pending, b_incoming) {
				if(b_incoming) {
					return {
						title: `Contract sent ${s_coins}`,
						infos: [
							`from ${g_contract_loaded?.name || 'Unknown Contract'}`,
						],
						fields: [
							{
								type: 'key_value',
								key: 'Amount',
								value: `${s_coins}`,
							},
						],
						resource: {
							name: s_coins,
							pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
						},
					};
				}
				else {
					return {
						title: `Unwrapp${b_pending? 'ing': 'ed'} ${s_tokens_summary}`,
						infos: [
							`on ${g_contract_loaded?.name || 'Unknown Contract'}`,
						],
						fields: [
							{
								type: 'key_value',
								key: 'Amount',
								value: `${s_tokens} → ${s_coins}`,
							},
						],
						resource: {
							name: s_coins,
							pfp: g_contract_loaded?.pfp || g_app?.pfp || '',
						},
					};
				}
			},
		};
	},
});

