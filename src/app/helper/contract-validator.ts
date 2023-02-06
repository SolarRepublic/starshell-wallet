import type {Dict} from '#/meta/belt';
import type {Bech32, ChainPath, ChainStruct, ContractPath, ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

import {fromBech32} from '@cosmjs/encoding';

import {writable} from '../mem-store';

import {R_BECH32, R_CONTRACT_NAME, R_TOKEN_SYMBOL} from '#/share/constants';
import {Chains} from '#/store/chains';
import {Contracts, ContractRole} from '#/store/contracts';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function validate_contract(_p_contract: ContractPath) {
	// prep cache of existing contracts
	const h_exists_bech32s: Dict<[ContractRole, string]> = {};
	const h_exists_names: Dict<ChainPath[]> = {};
	const h_exists_symbols: Dict<number> = {};

	// prep edittable stores
	const yw_contract = writable(null as unknown as ContractStruct);
	const yw_contract_chain = writable(null as unknown as ChainStruct);
	const yw_contract_name = writable('');
	const yw_contract_bech32 = writable('' as Bech32);
	const yw_contract_pfp = writable<PfpTarget>('');
	const yw_contract_on = writable<0 | 1>(0);
	const yw_contract_type = writable(ContractRole.UNKNOWN);
	const yw_token_symbol = writable('');
	const yw_token_decimals = writable(0);
	const yw_token_coingecko = writable('');

	// prep validation stores
	const yw_err_contract_name = writable('');
	const yw_err_contract_bech32 = writable('');
	const yw_wrn_contract_bech32 = writable('');
	const yw_err_token_symbol = writable('');
	const yw_err_token_decimals = writable('');

	// form locked state
	const yw_locked = writable(true);

	// helper function
	const is_token = () => 0 !== (ContractRole.TOKEN & yw_contract_type.get());

	// when contract chain is updated
	yw_contract_chain.subscribe((g_chain: ChainStruct) => {
		if(!g_chain) return;

		const g_contract = yw_contract.get()!;

		// chain supports secret wasm
		if(g_chain.features.secretwasm) {
			// contract implements secret fungible token
			if(g_contract.interfaces.snip20) {
				// ref snip-20 def
				const g_snip20 = g_contract.interfaces.snip20;

				// set contract type
				yw_contract_type.set(ContractRole.FUNGIBLE);

				// populate token fields from snip-20 def
				yw_token_symbol.set(g_snip20.symbol);
				yw_token_decimals.set(g_snip20.decimals);
				yw_token_coingecko.set(g_snip20.extra?.coingeckoId || '');
			}
		}

		void validate_load(g_contract.chain, g_chain);
	});

	// when contract struct updates
	yw_contract.subscribe(async(g_contract) => {
		if(!g_contract) return;

		// populate contract fields from contract def
		yw_contract_name.set(g_contract.name);
		yw_contract_bech32.set(g_contract.bech32);
		yw_contract_pfp.set(g_contract.pfp);
		yw_contract_on.set(g_contract.on);

		// ref chain
		const _p_chain = g_contract.chain;

		// load chain
		const _g_chain = (await Chains.at(_p_chain))!;
		yw_contract_chain.set(_g_chain);
	});

	// go async
	(async() => {
		// load contract from store
		const _g_contract = (await Contracts.at(_p_contract))!;

		// write to store
		yw_contract.set(_g_contract);
	})();

	async function validate_load(p_chain: ChainPath, g_chain: ChainStruct) {
		// cache all existing contract defintions to check for conflicts
		try {
			for(const [p_contract, g_contract] of (await Contracts.read()).entries()) {
				// do not conflict with itself
				if(_p_contract === p_contract) continue;

				// same chain
				if(p_chain === g_contract.chain) {
					// already a token
					const g_snip20 = g_contract.interfaces.snip20;
					if(g_snip20) {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractRole.FUNGIBLE, g_snip20.symbol];

						// add to symbols dict
						h_exists_symbols[g_snip20.symbol.toLocaleLowerCase()] = 1;
					}
					// not yet a token
					else {
						// add to bech32 dict
						h_exists_bech32s[g_contract.bech32] = [ContractRole.UNKNOWN, g_contract.name];
					}
				}

				// add to chains list
				(h_exists_names[g_contract.name] = h_exists_names[g_contract.name] || [])
					.push(g_contract.chain);
			}
		}
		finally {
			// unlock form
			yw_locked.set(false);
		}

		// conflict validation logic
		{
			// check the contract name for conflicts
			function check_contract_name(s_name: string) {
				// ref chains where contract name is defined
				const a_chains = h_exists_names[s_name];

				// contract name already defined on target chain
				if(a_chains?.includes(p_chain)) {
					yw_err_contract_name.set(`${is_token()? 'Token': 'Contract'} name already in use on ${g_chain.name}`);
				}
				// no conflict, but there was a previous validation error; force retest
				else if(yw_err_contract_name.get()) {
					test_contract_name(s_name);
				}
				// reset error
				else {
					yw_err_contract_name.set('');
				}
			}

			// subscribe to changes on contract name
			yw_contract_name.subscribe((s_name) => {
				// provide immediate validation feedback on naming conflict
				if(s_name) check_contract_name(s_name);
			});

			// check the contract's bech32 address
			function test_contract_bech32(sa_bech32=yw_contract_bech32.get()) {
				// prep error text
				let s_err_bech32 = '';

				// invalid address for chain
				if(!Chains.isValidAddressFor(g_chain, sa_bech32)) {
					// address is incomplete
					if(!R_BECH32.exec(sa_bech32)) {
						s_err_bech32 = 'Incomplete address';
					}
					else {
						// see if parser throws
						try {
							fromBech32(sa_bech32);

							// didn't throw, must be hrp mismatch
							s_err_bech32 = `Account address should start with "${g_chain.bech32s.acc}1"`;
						}
						// parser threw; invalid checksum
						catch(e_checksum) {
							s_err_bech32 = 'Invalid address checksum';
						}
					}
				}

				// set or clear error
				yw_err_contract_bech32.set(s_err_bech32);

				// no error
				if(!s_err_bech32) {
					// find existing contracts
					const a_defined = h_exists_bech32s[sa_bech32];

					// bech32 conflict
					if(a_defined) {
						// destructure its properties
						const [xc_contract, s_label] = a_defined;

						// other is the same type
						if(yw_contract_type.get() === xc_contract) {
							yw_err_contract_bech32.set(`${is_token()? 'Token': 'Contract'} already defined as ${s_label}`);
						}
						// other is different type
						else {
							yw_wrn_contract_bech32.set(`Contract already defined. Proceeding will overwrite`);
						}
					}
				}
			}

			// subscribe to changes on contract bech32
			yw_contract_bech32.subscribe((sa_bech32) => {
				test_contract_bech32(sa_bech32);
			});

			// check the token symbol for conflicts
			function check_token_symbol(s_symbol: string) {
				// ref state of token symbol defined elsewhere
				const xc_defined = h_exists_symbols[s_symbol];

				// token symbol already defined in wallet
				if(xc_defined) {
					yw_err_token_symbol.set('Token symbol already in use');
				}
				// no conflict; clear error
				else {
					yw_err_token_symbol.set('');
				}
			}

			// validate the token symbol
			function test_token_symbol(s_symbol=yw_token_symbol.get()) {
				// test symbol or set error
				if(!R_TOKEN_SYMBOL.test(s_symbol)) {
					yw_err_token_symbol.set('Invalid token symbol');
				}
				// check for conflicts
				else {
					check_token_symbol(s_symbol);
				}
			}

			// subscribe to changes on token symbol
			yw_token_symbol.subscribe((s_symbol) => {
				// provide immediate validation feedback on symbol conflict
				if(s_symbol) test_token_symbol(s_symbol);
			});
		}
	}

	// validate the contract name
	function test_contract_name(s_name=yw_contract_name.get()) {
		// clear error
		yw_err_contract_name.set('');

		// test name or set error
		if(!R_CONTRACT_NAME.test(s_name)) {
			yw_err_contract_name.set(`Invalid ${is_token()? 'token': 'contract'} name`);
		}
	}

	return {
		yw_contract,
		yw_contract_name,
		yw_contract_bech32,
		yw_contract_pfp,
		yw_contract_on,
		yw_contract_type,
		yw_token_symbol,
		yw_token_decimals,
		yw_token_coingecko,
		yw_contract_chain,

		yw_err_contract_name,
		yw_err_contract_bech32,
		yw_wrn_contract_bech32,
		yw_err_token_symbol,
		yw_err_token_decimals,

		test_contract_name,

		yw_locked,
	};
}
