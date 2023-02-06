import {NL_PASSPHRASE_MAXIMUM, NL_PASSPHRASE_MINIMUM} from './constants';
import {AlreadyRegisteredError, CorruptedVaultError, InvalidPassphraseError, RecoverableVaultError, UnregisteredError} from './errors';

import {NB_ARGON2_MEMORY, N_ARGON2_ITERATIONS, Vault} from '#/crypto/vault';
import {PublicStorage, storage_clear, storage_remove} from '#/extension/public-storage';
import {SessionStorage} from '#/extension/session-storage';
import {global_broadcast} from '#/script/msg-global';
import {set_keplr_compatibility_mode} from '#/script/scripts';
import {F_NOOP, ode, timeout} from '#/util/belt';
import {canonicalize, text_to_buffer} from '#/util/data';
import { Contracts } from '#/store/contracts';
import { H_STORE_INIT_CONTRACTS } from '#/store/_init';
import { precedes } from '#/extension/semver';
import { Chains } from '#/store/chains';
import { QueryCache } from '#/store/query-cache';
import type { JsonObject } from '#/meta/belt';



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
	}

	// mark as seen
	await PublicStorage.markSeen();
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
