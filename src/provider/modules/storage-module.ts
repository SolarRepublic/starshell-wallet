import type {ConnectionChannel, ConnectionHandle, ConnectionModule} from '../connection';

import {ode} from '#/util/belt';

const XT_DEBOUNCE = 250;


interface StorageFields {
	hm_cache: Map<string, string>;
	k_channel: ConnectionChannel;
	k_handle: ConnectionHandle;
	i_debounce: number;
	b_locked: boolean;
}

const hm_fields = new WeakMap<StorageModuleImpl, StorageFields>();


function StorageModule$_push(this: StorageModuleImpl, g_fields: StorageFields) {
	// debounce
	clearTimeout(g_fields.i_debounce);
	setTimeout(async() => {
		// synchronize with extension
		await g_fields.k_channel.uploadStore(Object.fromEntries(g_fields.hm_cache.entries()));

		// TODO: warn if user closes tab while this is pending
	}, XT_DEBOUNCE);
}


async function StorageModule$_pull(this: StorageModuleImpl, g_fields: StorageFields) {
	// synchronize with extension
	const h_store = await g_fields.k_channel.downloadStore();

	// error
	if('object' !== typeof h_store) {
		throw new Error('Failed to create store; app must not have permissions');
	}

	// create cache map
	g_fields.hm_cache = new Map(ode(h_store));
}

/**
 * The storage module allows apps to synchronously get and put arbitrary key/value strings that will be encrypted at rest
 * and are private to each app's domain.
 * This module implements both the {@link https://developer.mozilla.org/en-US/docs/Web/API/Storage Storage interface} of
 * the Web Storage API, as well as the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map ES Map interface}
 * for maximum compatibility with wrapper libraries and ease-of-use.
 * 
 * ### DO NOT USE THIS MODULE TO STORE PRIVATE KEYS
 * This module is intended to replace usage of localStorage for persisting general app data that is deemed sensitive to
 * end-user privacy (e.g., records, preferences, addresses, history, etc.).
 * 
 * However, the module strikes a trade-off between security and developer-friendliness. Data is only encrypted at rest,
 * (i.e., while stored on disk) but is not secured while in-use (i.e., in RAM). This allows the API methods to be synchronous.
 * 
 * For persisting more sensitive data such as private keys, please use the keychain module
 * 
 * ### Concurrency
 * If the user opens your app in multiple tabs, you will need to think about how to coordinate with the other tabs about
 * when it is OK to write in order to avoid the lost update problem. This class stores a cached copy of the underlying store
 * in the current window in order to keep all methods synchronous (so it can be compliant with Storage/Map interfaces).
 * 
 * This implementation will automatically update the caches in other active tabs, but it does not protect against race
 * conditions. If you expect to have this problem, I suggest using
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel BroadcastChannel} or some write lock library.
 */
class StorageModuleImpl implements Storage, Map<string, string> {
	static create(k_handle: ConnectionHandle, k_channel: ConnectionChannel): StorageModuleImpl {
		// create instance
		const k_storage = new StorageModuleImpl(k_handle, k_channel);

		// download store
		StorageModule$_pull.call(this, hm_fields.get(k_storage));

		// return instance
		return k_storage;
	}


	// not for public use
	private constructor(k_handle: ConnectionHandle, k_channel: ConnectionChannel) {
		hm_fields.set(this, {
			k_handle,
			k_channel,
			hm_cache: new Map(),  // should get replaced upon init
			i_debounce: 0,
			b_locked: false,
		});
	}


	/**
	 * Implements {@link Map[Symbol.toStringTag]}.
	 */
	readonly [Symbol.toStringTag] = 'StorageModuleMap';


	/**
	 * Returns an integer representing how many entries the store has.
	 * 
	 * Implements {@link Storage.length}.
	 * @returns the number of entries in the store
	 */
	get length(): number {
		return this.size;
	}


	/**
	 * Returns an integer representing how many entries the store has.
	 * 
	 * Implements {@link Map.size}.
	 * @returns the number of entries in the store
	 */
	get size(): number {
		return [...this.keys()].length;
	}


	/**
	 * Produce a new iterator that contains the keys for each element in the store.
	 * 
	 * Implements {@link Storage.key()}.
	 * @returns the iterator
	 */
	key(i_key: number): string {
		return [...this.keys()][i_key];
	}


	/**
	 * Produce a new iterator that contains the keys for each element in the store.
	 * 
	 * Implements {@link Map.keys()}.
	 * @returns the iterator
	 */
	keys(): IterableIterator<string> {
		return hm_fields.get(this)!.hm_cache.keys();
	}


	/**
	 * When passed a key name, will return that key's value.
	 * 
	 * Implements {@link Storage.getItem()}.
	 * @param si_key string containing the name of the key you want to retrieve the value of
	 * @returns string containing the value of the key. If the key does not exist, `null` is returned.
	 */
	getItem(si_key: string): string | null {
		return hm_fields.get(this)!.hm_cache.get(si_key) ?? null;
	}


	/**
	 * When passed a key name and value, will add that key to the storage, or update that key's value if it already exists.
	 * 
	 * Implements {@link Storage.setItem()}.
	 * @param si_key string containing the name of the key you want to create/update
	 * @param s_value string containing the value you want to give the key you are creating/updating
	 */
	setItem(si_key: string, s_value: string): void {
		const g_fields = hm_fields.get(this)!;

		if('string' !== typeof si_key) throw new TypeError('Key must be a string');
		if('string' !== typeof s_value) throw new TypeError('Value must be a string');

		// deletion; delete the value in the local cached map
		if(null === s_value) {
			g_fields.hm_cache.delete(si_key);
		}
		// not deletion; set the value in the local cached map
		else {
			g_fields.hm_cache.set(si_key, s_value);
		}

		// push to extension
		StorageModule$_push.call(this, g_fields);
	}


	/**
	 * When passed a key name, will remove that key from the store.
	 * 
	 * Implements {@link Storage.removeItem()}.
	 * @param si_key string containing the name of the key you want to remove
	 */
	removeItem(si_key: string): void {
		this.delete(si_key);
	}


	/**
	 * Clears all keys stored in the store.
	 * 
	 * Implements {@link Storage.clear()} and {@link Map.clear()}.
	 */
	clear(): void {
		const g_fields = hm_fields.get(this)!;

		// clear all values in the local cached map
		g_fields.hm_cache.clear();

		// push to extension
		StorageModule$_push.call(this, g_fields);
	}


	/**
	 * Returns a boolean indicating whether an element with the specified key exists or not.
	 * 
	 * Implements {@link Map.has()}.
	 * @param si_key the key of the element
	 * @returns `true` iff an element with the specified key exists, `false` otherwise
	 */
	has(si_key: string): boolean {
		return null !== this.get(si_key);
	}


	/**
	 * Gets the value associated with the given key, or null if the element does not exist.
	 * 
	 * Implements {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get Map#get()}.
	 * @param si_key the key of the element
	 * @returns the value (always a string) of the specified element if it exists, `undefined` otherwise
	 */
	get(si_key: string): string | undefined {
		return hm_fields.get(this)!.hm_cache.get(si_key) ?? void 0;
	}


	/**
	 * When passed a key name and value, will add that key to the storage, or update that key's value if it already exists.
	 * 
	 * Implements {@link Map.set()}.
	 * @param si_key string containing the name of the key you want to create/update
	 * @param s_value string containing the value you want to give the key you are creating/updating
	 */
	set(si_key: string, s_value: string): this {
		this.setItem(si_key, s_value);

		// compatibility with Map
		return this;
	}


	/**
	 * Removes the specified element from the store by key.
	 * Implements {@link Map.delete()}.
	 * @param si_key the key of the element to remove
	 */
	delete(si_key: string): boolean {
		const g_fields = hm_fields.get(this)!;

		// delete the value from the local cached map
		const b_deleted = g_fields.hm_cache.delete(si_key);

		// push to extension
		StorageModule$_push.call(this, g_fields);

		// return the same value
		return b_deleted;
	}


	/**
	 * Implements {@link Map.entries()}.
	 * @returns 
	 */
	entries(): IterableIterator<[string, string]> {
		return hm_fields.get(this)!.hm_cache.entries();
	}


	/**
	 * Implements {@link Map.values()}.
	 * @returns 
	 */
	values(): IterableIterator<string> {
		return hm_fields.get(this)!.hm_cache.values();
	}


	/**
	 * Implements {@link Map.entries()}.
	 * @returns 
	 */
	forEach(f_each: Parameters<Map<string, string>['forEach']>[0]): void {
		return hm_fields.get(this)!.hm_cache.forEach(f_each);
	}



	// /**
	//  * Acquires an exclusive write lock to the underlying store in case your application needs to support concurrent
	//  * tabs that are attempting to read/write to the same store.
	//  * @resolves callback function to release the lock
	//  */
	// async lock(): Promise<() => Promise<void>> {
	// 	const g_fields = hm_fields.get(this)!;

	// 	// wait for write lock
	// 	await g_fields.k_channel.lockStore();

	// 	// set flag
	// 	g_fields.b_locked = true;

	// 	// return release function
	// 	return async() => {
	// 		// wait for write lock to be released
	// 		await g_fields.k_channel.releaseStore();

	// 		// update flag
	// 		g_fields.b_locked = false;
	// 	};
	// }
}

// merge interface so the prototype can be extended
interface StorageModuleImpl {
	/**
	 * Alias of {@link StorageModuleImpl.set()}.
	 * @param si_key the key of the element. must be a string
	 * @param s_value the value of the new element to set. must be a string
	 */
	put(si_key: string, s_value: string): this;


	/**
	 * Implements {@link Map[Symbol.iterator]}
	 */
	[Symbol.iterator](): IterableIterator<[string, string]>;
}

/* eslint-disable @typescript-eslint/unbound-method */
StorageModuleImpl.prototype.put = StorageModuleImpl.prototype.set;
StorageModuleImpl.prototype[Symbol.iterator] = StorageModuleImpl.prototype.entries;
/* eslint-enable */

// export module with type assertion to `ConnectionModule`
export const StorageModule: ConnectionModule<StorageModuleImpl> = StorageModuleImpl;
export type StorageModule = StorageModuleImpl;
