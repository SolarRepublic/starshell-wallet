import type {Incident, TxSynced} from '#/meta/incident';
import {deduce_token_interfaces, Snip2xToken} from '#/schema/snip-2x-const';

import {NL_PASSPHRASE_MAXIMUM, NL_PASSPHRASE_MINIMUM} from './constants';
import {AlreadyRegisteredError, CorruptedVaultError, InvalidPassphraseError, RecoverableVaultError, UnregisteredError} from './errors';

import {H_SNIP_HANDLERS} from '#/chain/messages/snip';
import {SecretNetwork} from '#/chain/secret-network';
import {NB_ARGON2_MEMORY, N_ARGON2_ITERATIONS, Vault} from '#/crypto/vault';
import {PublicStorage, storage_clear, storage_remove} from '#/extension/public-storage';
import {precedes} from '#/extension/semver';
import {SessionStorage} from '#/extension/session-storage';
import {global_broadcast} from '#/script/msg-global';
import {set_keplr_compatibility_mode} from '#/script/scripts';
import {H_STORE_INIT_AGENTS, H_STORE_INIT_CHAINS, H_STORE_INIT_CONTRACTS, H_STORE_INIT_MEDIA, H_STORE_INIT_PFPS, H_STORE_INIT_PROVIDERS} from '#/store/_init';
import {Accounts} from '#/store/accounts';
import {Apps} from '#/store/apps';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {Incidents} from '#/store/incidents';
import {Providers} from '#/store/providers';
import {QueryCache} from '#/store/query-cache';
import {F_NOOP, ode, timeout} from '#/util/belt';
import {buffer_to_base93, canonicalize, text_to_buffer} from '#/util/data';
import { SecretWasm } from '#/crypto/secret-wasm';
import { open_flow } from '#/script/msg-flow';
import type { Bech32, ContractPath, ContractStruct } from '#/meta/chain';
import type { TokenStructRegistry } from '#/meta/token';
import { Agents } from '#/store/agents';
import { Medias } from '#/store/medias';
import { Pfps } from '#/store/pfps';



/**
 * Test the acceptable-ness of a given passphrase
 */
export function acceptable(sh_phrase: string): boolean {
	return 'string' === typeof sh_phrase && sh_phrase.length >= NL_PASSPHRASE_MINIMUM && sh_phrase.length <= NL_PASSPHRASE_MAXIMUM;
}


export async function dev_register(sh_phrase: string): Promise<void> {
	// set hash params
	(await PublicStorage.hashParams({
		iterations: N_ARGON2_ITERATIONS,
		memory: NB_ARGON2_MEMORY,
	}))!;

	return await register(sh_phrase);
}

/**
 * Register new credentials
 */
export async function register(sh_phrase: string, f_update: ((s_state: string) => void)=F_NOOP): Promise<void> {
	f_update('Reading from storage');

	// retrieve base
	const g_base = await Vault.getBase();

	// root is already set
	if(Vault.isValidBase(g_base)) {
		throw new AlreadyRegisteredError();
	}

	// check password requirements
	if(!sh_phrase || !acceptable(sh_phrase)) {
		throw new InvalidPassphraseError();
	}

	// encode passphrase
	const atu8_phrase = text_to_buffer(sh_phrase);

	f_update('Deriving root keys');

	// select 128 bits of entropy at random
	const atu8_entropy = crypto.getRandomValues(new Uint8Array(16));

	// select initial uint128 nonce at random 
	const dv_random = new DataView(crypto.getRandomValues(new Uint8Array(16)).buffer);

	// create uint128 by bit-shifting then OR'ing 64-tets into place
	const xg_nonce_init_hi = dv_random.getBigUint64(0, false);
	const xg_nonce_init_lo = dv_random.getBigUint64(8, false);
	const xg_nonce_init = (xg_nonce_init_hi << 64n) | xg_nonce_init_lo;

	// set last seen
	await PublicStorage.markSeen();

	// import base key from passphrase and derive the new root key
	const {
		new: {
			key: dk_root_new,
			nonce: xg_nonce_new,
		},
	} = await Vault.deriveRootKeys(atu8_phrase, atu8_entropy, xg_nonce_init);

	f_update('Generating signature');

	// generate signature
	const atu8_signature = await Vault.generateRootKeySignature(dk_root_new);

	f_update('Saving to storage');

	// save to storage
	await Vault.setParsedBase({
		entropy: atu8_entropy,
		nonce: xg_nonce_new,
		signature: atu8_signature,
	});
}


/**
 * Unlock the vault using the given passphrase
 */
export async function login(sh_phrase: string, b_recover=false, f_update: ((s_state: string) => void)=F_NOOP): Promise<void> {
	f_update('Reading from storage');

	// retrieve base
	const g_base = await Vault.getBase();

	// no base set, need to register
	if(!g_base) {
		throw new UnregisteredError();
	}

	// base is corrupt
	if(!Vault.isValidBase(g_base)) {
		throw new CorruptedVaultError(`Storage is corrupt; base object is missing or partially damaged`);
	}

	// parse base fields
	const {
		entropy: atu8_entropy,
		nonce: xg_nonce_old,
		signature: atu8_signature_old,
		version: n_version,
	} = Vault.parseBase(g_base);

	// incompatible version
	if(n_version < 1) {
		throw new CorruptedVaultError(`Vault reports to be encrypted with an unknown version identifier`);
	}
	// newer version
	else if(n_version > 1) {
		throw new CorruptedVaultError(`Vault reports to be encrypted with a newer version identifier`);
	}

	// empty; reject
	if(!sh_phrase) throw new InvalidPassphraseError();

	// convert to buffer
	const atu8_phrase = text_to_buffer(sh_phrase);

	f_update('Deriving root keys');

	// import base key from passphrase and derive old and new root keys
	const {
		old: {
			key: dk_root_old,
			vector: atu8_vector_old,
			params: g_params_old,
		},
		new: {
			key: dk_root_new,
			vector: atu8_vector_new,
			nonce: xg_nonce_new,
			params: g_params_new,
		},
		export: kn_root_new,
	} = await Vault.deriveRootKeys(atu8_phrase, atu8_entropy, xg_nonce_old, true);

	// before any failures, zero out key material
	try {
		// invalid old root key
		if(!await Vault.verifyRootKey(dk_root_old, atu8_signature_old)) {
			// new root does not work either; bad passphrase
			if(!await Vault.verifyRootKey(dk_root_new, atu8_signature_old)) {
				throw new InvalidPassphraseError();
			}
			// program was for closed amid recryption
			else if(!b_recover) {
				throw new RecoverableVaultError();
			}
		}

		f_update('Rotating keys');

		// recrypt everything
		try {
			await Vault.recryptAll(dk_root_old, atu8_vector_old, dk_root_new, atu8_vector_new);
		}
		// handle errors
		catch(e_recrypt) {
			console.error(`Recovering from error during recryption: ${e_recrypt}`);

			// logout
			await logout();

			await timeout(5e3);
			globalThis.close();
			return;
		}

		f_update('Generating signature');

		// generate new signature
		const atu8_signature_new = await Vault.generateRootKeySignature(dk_root_new);

		f_update('Saving to storage');

		// update base
		await Vault.setParsedBase({
			entropy: atu8_entropy,
			nonce: xg_nonce_new,
			signature: atu8_signature_new,
		});

		// change in params detected, update
		if(JSON.stringify(canonicalize(g_params_old)) !== JSON.stringify(canonicalize(g_params_new))) {
			await PublicStorage.hashParams({
				iterations: N_ARGON2_ITERATIONS,
				memory: NB_ARGON2_MEMORY,
			});
		}

		// create session auth private key
		const atu8_auth = crypto.getRandomValues(new Uint8Array(32));

		// set session
		await SessionStorage.set({
			root: Array.from(kn_root_new!.data),
			vector: Array.from(atu8_vector_new),
			auth: Array.from(atu8_auth),
		});

		// wipe root key material
		kn_root_new?.wipe();

		// migrations
		await run_migrations();

		// kick-off async checks
		void run_async_checks();

		// fire logged in event
		global_broadcast({
			type: 'login',
		});

		f_update('Done');
	}
	// intercept error
	catch(e_thrown) {
		// zero out key material
		kn_root_new?.wipe();

		// rethrow
		throw e_thrown;
	}
}

async function upsert_agents() {
	// add new agents
	const ks_agents = await Agents.read();
	for(const [p_agent, g_agent] of ode(H_STORE_INIT_AGENTS)) {
		if(!ks_agents.at(p_agent)) {
			await Agents.putAt(p_agent, g_agent);
		}
	}
}

async function upsert_media() {
	// add new media
	const ks_medias = await Medias.read();
	for(const [p_media, g_media] of ode(H_STORE_INIT_MEDIA)) {
		if(!ks_medias.at(p_media)) {
			await Medias.putAt(p_media, g_media);
		}
	}
}

async function upsert_pfps() {
	// add new pfps
	const ks_pfps = await Pfps.read();
	for(const [p_pfp, g_pfp] of ode(H_STORE_INIT_PFPS)) {
		if(!ks_pfps.at(p_pfp)) {
			await Pfps.putAt(p_pfp, g_pfp);
		}
	}
}

async function upsert_providers() {
	// upgrade providers
	for(const [p_provider, g_provider] of ode(H_STORE_INIT_PROVIDERS)) {
		if(g_provider.on) {
			try {
				await Providers.putAt(p_provider, g_provider);
			}
			catch(e_replace) {}
		}
	}
}

async function upsert_chains() {
	// upgrade chains
	for(const [p_chain, g_chain] of ode(H_STORE_INIT_CHAINS)) {
		if(g_chain.on) {
			try {
				await Chains.putAt(p_chain, g_chain);
			}
			catch(e_replace) {}
		}
	}
}

async function run_migrations() {
	const g_seen = await PublicStorage.lastSeen();

	if(g_seen) {
		// fix stkd-scrt
		if(precedes(g_seen.version, '1.0.4')) {
			const p_stkd_scrt = '/family.cosmos/chain.secret-4/bech32.secret1k6u0cy4feepm6pehnz804zmwakuwdapm69tuc4/as.contract';
			await Contracts.open(ks => ks.update(p_stkd_scrt, (g_contract) => {
				const as_excluded = new Set(g_contract.interfaces.excluded);
				as_excluded.delete('snip20');
				g_contract.interfaces.excluded = [...as_excluded];
				g_contract.interfaces.snip20 = H_STORE_INIT_CONTRACTS[p_stkd_scrt].interfaces.snip20;
				return g_contract;
			}));
		}

		// fix transfer_history query cache
		if(precedes(g_seen.version, '1.0.7')) {
			for(const [si_caip2, h_cache] of await QueryCache.entries()) {
				for(const [si_cache, w_cache] of ode(h_cache)) {
					if(si_cache.endsWith(':transfer_history')) {
						// delete entire entry
						delete h_cache[si_cache];
					}
				}

				// overwrite
				await QueryCache.putAt(si_caip2, h_cache);
			}
		}

		// reset descriptorless snip20s
		if(precedes(g_seen.version, '1.0.12')) {
			// recover from any unforseen errors
			try {
				// cache of networks created during migration
				const h_networks: Record<string, SecretNetwork> = {};

				// start by finding contracts without any interfaces
				const a_orphans = (await Contracts.entries()).map(([, g]) => g).filter(g => !Object.keys(g.interfaces).length);

				// see if any turn up snip20
				ADOPTING_ORPHANS:
				for(const g_orphan of a_orphans) {
					const p_chain = g_orphan.chain;
					let k_network = h_networks[p_chain];
					if(!k_network) {
						const g_chain = await Chains.at(p_chain);
						k_network = h_networks[p_chain] = await Providers.activateStableDefaultFor(g_chain!);
					}

					// grab first account (only used for public query)
					const g_account_faux = (await Accounts.entries())[0][1];

					// deduce current token interfaces for orphan
					const [a_interfaces] = await deduce_token_interfaces(g_orphan, k_network, g_account_faux);

					// enabled snip20
					if(a_interfaces.includes('snip20')) {
						// replay latest viewing key transaction
						const a_incidents = [...await Incidents.filter({
							type: 'tx_out',
							stage: 'synced',
							chain: g_orphan.chain,
						})];

						a_incidents.sort((g_a, g_b) => g_b.time - g_a.time);

						for(const g_incident of a_incidents) {
							const h_events = g_incident.data?.['events'] || {};
							const a_executions = h_events.executions || [];
							for(const g_exec of a_executions) {
								// execution was made on this contract
								if(g_orphan.bech32 === g_exec.contract) {
									// found the most recent set viewing key transaction
									if(g_exec.msg?.set_viewing_key) {
										// build context
										const g_data = g_incident.data as TxSynced;
										const p_app = g_data.app;
										const p_account = g_data.account;

										if(!p_app || !p_account || !p_chain) continue;

										const g_app = await Apps.at(p_app);
										const g_account = await Accounts.at(p_account);
										const g_chain = await Chains.at(p_chain);

										if(!g_app || !g_account || !g_chain) continue;

										const g_handled = await H_SNIP_HANDLERS.set_viewing_key?.({
											key: g_exec.msg.set_viewing_key,
										}, {
											g_app,
											g_account,
											g_chain,
											p_app,
											p_account,
											p_chain,
										}, g_exec);

										// attempt to apply
										g_handled?.apply();

										continue ADOPTING_ORPHANS;
									}
								}
							}
						}
					}
				}
			}
			catch(e_resets) {}
		}

		// overwrite built-in snip20s
		if(precedes(g_seen.version, '1.0.12')) {
			for(const [, g_contract] of ode(H_STORE_INIT_CONTRACTS)) {
				try {
					await Contracts.merge(g_contract);
				}
				catch(e_merge) {}
			}
		}

		// set `on` flags for active chains
		if(precedes(g_seen.version, '1.0.13')) {
			for(const [p_chain, g_chain] of ode(H_STORE_INIT_CHAINS)) {
				// add enabled flag to existing chain
				if(g_chain.on) {
					try {
						await Chains.update(p_chain, g => ({
							...g,
							on: 1,
						}));
					}
					catch(e_merge) {}
				}
				// insert new disabled chain
				else {
					await Chains.putAt(p_chain, g_chain);
				}
			}
		}

		// migrate-able tokens and new snip25s
		if(precedes(g_seen.version, '1.0.23')) {
			try {
				// upgrade secret-4
				const p_secret4 = '/family.cosmos/chain.secret-4';
				try {
					await Chains.putAt(p_secret4, H_STORE_INIT_CHAINS[p_secret4]);
				}
				catch(e_merge) {}

				// each entry in init registry
				for(const [, g_contract] of ode(H_STORE_INIT_CONTRACTS)) {
					try {
						// add/overwrite snip25 tokens
						if(g_contract.interfaces.snip25) {
							await Contracts.merge(g_contract);
						}
						// set migrate on deprecated variants
						else if(g_contract.interfaces.snip20?.extra?.migrate) {
							const g_existing = await Contracts.at(Contracts.pathFrom(g_contract));

							// update existing
							if(g_existing) {
								// only if it has not yet been updated
								if(!g_existing.interfaces.snip20?.extra?.migrate) {
									await Contracts.merge({
										...g_existing,
										name: `${g_existing.name} (old)`,
										interfaces: {
											...g_existing.interfaces,
											snip20: {
												...g_existing.interfaces.snip20!,
												extra: {
													...g_existing.interfaces.snip20!.extra,
													migrate: g_contract.interfaces.snip20.extra.migrate,
												},
											},
										},
									});
								}
							}
							// add new
							else {
								await Contracts.merge(g_contract);
							}
						}
					}
					catch(e_merge) {}
				}

				await upsert_agents();
				await upsert_media();
				await upsert_pfps();
			}
			catch(e_merge) {}
		}

		if(precedes(g_seen.version, '1.0.25')) {
			// fix incident times
			for(const [p_incident, g_incident] of await Incidents.entries()) {
				if(g_incident.time < 1.2e12) {
					g_incident.time *= 1e3;
					await Incidents.putAt(p_incident, g_incident);
				}
			}
		}

		if(precedes(g_seen.version, '1.0.28')) {
			const p_silk = Contracts.pathFor('/family.cosmos/chain.secret-4', 'secret1fl449muk5yq8dlad7a22nje4p5d2pnsgymhjfd');

			try {
				await Contracts.merge(H_STORE_INIT_CONTRACTS[p_silk]);
			}
			catch(e_merge) {}

			function overlap(s_a: string, s_b: string): string {
				return s_a.split(' ')[0] === s_b.split(' ')[0]? s_a: s_b;
			}

			// each entry in init registry
			for(const [, g_contract] of ode(H_STORE_INIT_CONTRACTS)) {
				try {
					const g_existing = await Contracts.at(Contracts.pathFrom(g_contract));

					// update existing
					if(g_existing) {
						await Contracts.merge({
							...g_existing,
							name: overlap(g_contract.name, g_existing.name),
							hash: g_contract.hash,
							interfaces: g_contract.interfaces,
							pfp: g_contract.pfp,
						});
					}
					// add new
					else {
						await Contracts.merge(g_contract);
					}
				}
				catch(e_merge) {}
			}

			await upsert_providers();
			await upsert_media();
			await upsert_pfps();

			// add ibc coins
			for(const [p_chain, g_chain] of ode(H_STORE_INIT_CHAINS)) {
				// add enabled flag to existing chain
				try {
					await Chains.update(p_chain, g => ({
						...g,
						coins: g_chain.coins,
					}));
				}
				catch(e_merge) {}
			}
		}

		if(precedes(g_seen.version, '1.0.31')) {
			// fix shade decimals
			const a_shade_tokens = [
				'secret1qfql357amn448duf5gvp9gr48sxx9tsnhupu3d',
				'secret153wu605vvp934xhd4k9dtd640zsep5jkesstdm',
			] as const;

			// fix decimals
			for(const sa_token of a_shade_tokens) {
				const p_token = Contracts.pathFor('/family.cosmos/chain.secret-4', sa_token);
				const g_existing = await Contracts.at(p_token);
				if(!g_existing) continue;

				try {
					await Contracts.merge({
						...g_existing,
						interfaces: {
							...g_existing.interfaces,
							snip20: {
								...g_existing.interfaces.snip20!,
								decimals: H_STORE_INIT_CONTRACTS[p_token].interfaces.snip20!.decimals,
							},
						},
					});
				}
				catch(e_merge) {}
			}

			// fix coingeckoId
			const a_secret_tokens = [
				'secret1k6u0cy4feepm6pehnz804zmwakuwdapm69tuc4',
				'secret16zfat8th6hvzhesj8f6rz3vzd7ll69ys580p2t',
				'secret1dtdgpn0v8vzt2zz2an0anawxj26llne3ugl9ek',
			] as const;

			// fix coingeckoId
			for(const sa_token of a_secret_tokens) {
				const p_token = Contracts.pathFor('/family.cosmos/chain.secret-4', sa_token);
				const g_existing = await Contracts.at(p_token);
				if(!g_existing) continue;

				try {
					await Contracts.merge({
						...g_existing,
						interfaces: {
							...g_existing.interfaces,
							snip20: {
								...g_existing.interfaces.snip20!,
								extra: {
									...g_existing.interfaces.snip20!.extra,
									coingeckoId: H_STORE_INIT_CONTRACTS[p_token].interfaces.snip20!.extra!.coingeckoId!,
								},
							},
						},
					});
				}
				catch(e_merge) {}
			}
		}

		if(precedes(g_seen.version, '1.0.33')) {
			// change block explorer
			for(const [p_chain, g_chain] of ode(H_STORE_INIT_CHAINS)) {
				try {
					await Chains.update(p_chain, g => ({
						...g,
						blockExplorer: g_chain.blockExplorer,
					}));
				}
				catch(e_merge) {}
			}
		}

		// pulsar-3
		if(precedes(g_seen.version, '1.0.34')) {
			// update chains
			try {
				await upsert_chains();
			}
			catch(e_merge) {}

			// update provider(s)
			try {
				await upsert_providers();
			}
			catch(e_upsert) {}
		}
	}

	// mark as seen
	await PublicStorage.markSeen();
}


async function run_async_checks() {
	// each secretwasm chain
	for(const [p_chain, g_chain] of await Chains.entries()) {
		// skip devnets
		if(g_chain.devnet) continue;

		// secret-enabled
		if(g_chain.features.secretwasm) {
			const k_network: SecretNetwork = await Providers.activateStableDefaultFor(g_chain);

			try {
				const atu8_cons_io_pk = await k_network.secretConsensusIoPubkeyExact();

				const sb93_cons_io_pk = buffer_to_base93(atu8_cons_io_pk);

				// key change
				if(sb93_cons_io_pk !== g_chain.features.secretwasm.consensusIoPubkey) {
					// new key matches init
					if(sb93_cons_io_pk === H_STORE_INIT_CHAINS[p_chain].features.secretwasm!.consensusIoPubkey) {
						// accept change without prompt
						await Chains.update(Chains.pathFrom(g_chain), (_g_chain) => {
							_g_chain.features.secretwasm!.consensusIoPubkey = sb93_cons_io_pk;
							return _g_chain;
						});
					}
					// init may be outdated
					else {
						// consent to change
						void open_flow({
							flow: {
								type: 'acceptConsensusKey',
								value: {
									chain: p_chain,
									key: sb93_cons_io_pk,
								},
								page: null,
							},
						});
					}
				}
			}
			catch(e_exact) {}
		}
	}
}


/**
 * Lock the vault
 */
export async function logout(): Promise<void> {
	await Vault.clearRootKey();
}


/**
 * (Re)installs app
 */
export async function reinstall(b_install=false): Promise<void> {
	// mark event
	await PublicStorage.installed();

	console.warn(`Performing ${b_install? 'full': 'partial'} installation`);

	// set session storage access level
	await chrome.storage?.session?.setAccessLevel?.({
		accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
	});

	// for betas only
	{
		// migration; wipe everything
		if(await PublicStorage.isUpgrading('0.3.0')) {
			await storage_clear();
		}
		// selective wipe
		else if(await PublicStorage.isUpgrading('0.5.0')) {
			await storage_remove('apps');
			await storage_remove('pfps');
			await storage_remove('media');
			await storage_remove('chains');
			await storage_remove('contracts');
			await storage_remove('providers');
		}
		// selective wipe
		else if(await PublicStorage.isUpgrading('0.6.4')) {
			await storage_remove('apps');
			await storage_remove('histories');
			await storage_remove('chains');
			await storage_remove('contracts');
			await storage_remove('providers');
		}
	}

	// fresh install
	if(b_install) {
		console.info('Enabling keplr detection on fresh install');

		// enable keplr compatibility mode
		await PublicStorage.keplrCompatibilityMode(true);

		// enable detection mode by default
		await PublicStorage.keplrDetectionMode(true);
	}

	console.info('Updating keplr compatibility mode');

	// set compatibility mode based on apps and current settings
	await set_keplr_compatibility_mode();

	console.info('Installation complete');
}

/**
 * Factory reset
 */
export async function factory_reset(): Promise<void> {
	await SessionStorage.clear();
	await storage_clear();
	await reinstall(true);
}
