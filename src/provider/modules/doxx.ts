import type {ConnectionChannel, ConnectionHandle, ConnectionHandleConfig, ConnectionModule} from '../connection';

import type {Dict} from '#/meta/belt';

import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';


interface DoxxFields {
	k_channel: ConnectionChannel;
	k_handle: ConnectionHandle;
	// p_account: AccountPath;

	// account name
	s_name: string;

	// dict caching bech32 hrp to corresponding address
	h_addrs: Dict;
}

const hm_fields = new WeakMap<DoxxModuleImpl, DoxxFields>();


class DoxxModuleImpl {
	static async create(k_handle: ConnectionHandle, k_channel: ConnectionChannel, gc_handle: ConnectionHandleConfig): Promise<DoxxModuleImpl> {
		// instantiate module
		const k_module = new DoxxModuleImpl(k_handle, k_channel, gc_handle);

		// ref fields 
		const g_fields = hm_fields.get(k_module)!;

		// fetch account info
		const g_account = await Accounts.at(gc_handle.account_path);

		// dox permissions
		const g_permits = gc_handle.features.doxx!;

		// set name if permitted
		if(g_permits.name) g_fields.s_name = g_account?.name || '';

		// set address data if permitted
		const s_pubkey = g_account?.pubkey;
		if(g_permits.address && s_pubkey) {
			// ref chain
			const g_chain = gc_handle.chain;

			// prep addresses output
			const h_addrs = g_fields.h_addrs = {};

			// each registered bech32
			const h_bech32s = g_chain.bech32s;
			for(const si_hrp in h_bech32s) {
				// set address for hrp
				const g_bech32 = h_bech32s[si_hrp as keyof typeof h_bech32s];
				h_addrs[si_hrp] = Chains.addressFor(s_pubkey, g_chain, g_bech32);
			}
		}

		// return module
		return k_module;
	}

	// not for public use
	private constructor(k_handle: ConnectionHandle, k_channel: ConnectionChannel, gc_handle: ConnectionHandleConfig) {
		hm_fields.set(this, {
			k_handle,
			k_channel,
			s_name: '',
			h_addrs: {},
		});
	}

	get name(): string {
		return hm_fields.get(this)!.s_name;
	}

	get addresses(): Dict {
		return hm_fields.get(this)!.h_addrs;
	}
}

export const DoxxModule: ConnectionModule<DoxxModuleImpl> = DoxxModuleImpl;
export type DoxxModule = DoxxModuleImpl;
