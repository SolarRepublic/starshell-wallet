import type {Block as CosmosBlock} from '@solar-republic/cosmos-grpc/dist/cosmos/base/tendermint/v1beta1/types';
import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
import type {Block as TendermintBlock} from '@solar-republic/cosmos-grpc/dist/tendermint/types/block';

import type {AsJson, JsonObject} from '#/meta/belt';
import type {Bech32, ChainStruct, HoldingPath} from '#/meta/chain';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';

import {create_store_class, WritableStoreMap} from './_base';
import {Chains} from './chains';

import type {CosmosNetwork} from '#/chain/cosmos-network';
import {SecretNetwork} from '#/chain/secret-network';
import {ConnectionHealth, SI_STORE_PROVIDERS, XT_SECONDS} from '#/share/constants';
import {timeout_exec} from '#/util/belt';
import {buffer_to_base64, sha256_sync, text_to_buffer} from '#/util/data';
import {format_time_ago} from '#/util/format';


export type BalanceBundle = {
	balance: Coin;
	cached: Cached<Coin> | null;
	holding: HoldingPath;
} & JsonObject;


export interface Transfer {
	sender: Bech32 | Bech32[];
	recipient: Bech32 | Bech32[];
	amount: string;
	height: string;
	timestamp: string;
	txhash: string;
}

export interface Cached<g_wrapped=any> extends JsonObject {
	timestamp: number;
	data: AsJson<g_wrapped>;
	block?: string;
}


export interface E2eInfo {
	sequence: string;
	height: string;
	hash: string;
	pubkey: Uint8Array;
}

export const H_HEALTH_COLOR: Record<ConnectionHealth, string> = {
	[ConnectionHealth.UNKNOWN]: 'var(--theme-color-graysoft)',
	[ConnectionHealth.LOADING]: 'var(--theme-color-graysoft)',
	[ConnectionHealth.CONNECTING]: 'var(--theme-color-sky)',
	[ConnectionHealth.CONNECTED]: 'var(--theme-color-green)',
	[ConnectionHealth.DELINQUENT]: 'var(--theme-color-caution)',
	[ConnectionHealth.DISCONNECTED]: 'var(--theme-color-red)',
};


class MemoAccountError extends Error {
	constructor(s_msg: string, private readonly _sa_owner: string, private readonly _g_chain: ChainStruct) {
		super(s_msg);
	}

	get owner(): string {
		return this._sa_owner;
	}

	get chain(): ChainStruct {
		return this._g_chain;
	}
}

export class UnpublishedAccountError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Owner ${sa_owner} has not signed any messages yet on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class MultipleSignersError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Multiple accounts were discovered to be associated with ${sa_owner}.`, sa_owner, g_chain);
	}
}

export class WrongKeyTypeError extends MemoAccountError {
	constructor(sa_owner: string, g_chain: ChainStruct) {
		super(`Encountered the wrong type of key for ${sa_owner} on ${g_chain.name}.`, sa_owner, g_chain);
	}
}

export class NetworkTimeoutError extends Error {
	constructor() {
		super(`Network request timed out.`);
	}
}

export class ProviderHealthError extends Error {
	constructor(g_provider: ProviderStruct) {
		super(`Provider ${g_provider.name} in poor health.`);
	}
}

export class StaleBlockError extends Error {
	constructor(g_provider: ProviderStruct, xt_when: number) {
		super(`Most recent block from ${g_provider.name} is pretty old (${format_time_ago(xt_when)}). Possible chain, node, or network fault.`);
	}
}

export class NetworkExchangeError extends Error {
	constructor(protected _e_original: Error) {
		super(`${_e_original.constructor.name}:: ${_e_original.message}`);
	}

	get original(): Error {
		return this._e_original;
	}
}

export const Providers = create_store_class({
	store: SI_STORE_PROVIDERS,
	extension: 'map',
	class: class ProviderI extends WritableStoreMap<typeof SI_STORE_PROVIDERS> {
		static pathFor(p_base: string): ProviderPath {
			return `/provider.${buffer_to_base64(sha256_sync(text_to_buffer(p_base)))}`;
		}

		static pathFrom(g_provider: ProviderStruct) {
			return ProviderI.pathFor(g_provider.grpcWebUrl);
		}

		static activate(g_provider: ProviderStruct, g_chain: ChainStruct): SecretNetwork {
			return new SecretNetwork(g_provider, g_chain);
		}

		static async activateDefaultFor<k_network extends CosmosNetwork=CosmosNetwork>(g_chain: ChainStruct): Promise<k_network> {
			const p_chain = Chains.pathFrom(g_chain);

			const ks_providers = await Providers.read();

			for(const [p_provider, g_provider] of ks_providers.entries()) {
				if(p_chain === g_provider.chain) {
					return ProviderI.activate(g_provider, g_chain) as unknown as k_network;
				}
			}

			throw new Error(`No network provider found for chain ${p_chain}`);
		}

		static async activateStableDefaultFor<k_network extends CosmosNetwork=CosmosNetwork>(g_chain: ChainStruct): Promise<k_network> {
			const p_chain = Chains.pathFrom(g_chain);

			const ks_providers = await Providers.read();

			let e_reason!: Error;

			for(const [p_provider, g_provider] of ks_providers.entries()) {
				if(p_chain === g_provider.chain) {
					try {
						await ProviderI.quickTest(g_provider, g_chain);
					}
					catch(e_test) {
						// if(e_test instanceof NetworkExchangeError) {
						// 	if(e_test.original instanceof StaleBlockError) {
						// 		e_reason = e_test;
						// 	}
						// 	else if(e_test.original instanceof ProviderHealthError) {
						// 		if(!(e_reason instanceof NetworkExchangeError)) e_reason = e_test;
						// 	}
						// }

						e_reason = e_test;

						continue;
					}

					return ProviderI.activate(g_provider, g_chain) as unknown as k_network;
				}
			}

			throw e_reason || new Error(`No network provider found for chain ${p_chain}`);
		}

		static async quickTest(g_provider: ProviderStruct, g_chain: ChainStruct) {
			const k_network = ProviderI.activate(g_provider, g_chain);

			try {
				const [g_latest, xc_timeout] = await timeout_exec(15e3, () => k_network.latestBlock());
				let g_block: TendermintBlock | CosmosBlock | undefined;

				if(xc_timeout) {
					throw new NetworkTimeoutError();
				}
				// cosmos-sdk >= 0.47
				else if((g_block=g_latest?.sdkBlock || g_latest?.block) && g_block.header?.time) {
					const g_time = g_block.header.time;
					const xt_when = +g_time.seconds * XT_SECONDS;

					// more than a minute old
					if(Date.now() - xt_when > 60e3) {
						throw new StaleBlockError(g_provider, xt_when);
					}
				}
				// no block info
				else {
					throw new ProviderHealthError(g_provider);
				}
			}
			catch(e_latest) {
				throw new NetworkExchangeError(e_latest as Error);
			}
		}
	},
});
