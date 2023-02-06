import AccountHomeSvelte from './screen/AccountsHome.svelte';
import AppsHomeSvelte from './screen/AppsHome.svelte';
import BalancesHomeSvelte from './screen/BalancesHome.svelte';
import BlankSvelte from './screen/Blank.svelte';
import ContactsHomeSvelte from './screen/ContactsHome.svelte';
import HistoryHomeSvelte from './screen/HistoryHome.svelte';
import ProvidersHomeSvelte from './screen/ProvidersHome.svelte';
import RegisterSvelte from './screen/Register.svelte';

export enum ThreadId {
	DEFAULT='default',
	INIT='init',
	SEARCH='search',
	TOKENS='tokens',
	NFTS='nfts',
	AGENTS='contacts',
	HISTORY='history',
	PROVIDERS='providers',
	ACCOUNTS='accounts',

	/**
	 * Used for misc things like QR scanner
	 */
	SCRATCH='scratch',

	APPS='apps',
	TAGS='tags',
}

export const H_THREADS = {
	[ThreadId.DEFAULT]: BlankSvelte,
	[ThreadId.INIT]: RegisterSvelte,
	// [ThreadId.SEARCH]: Search,
	[ThreadId.TOKENS]: BalancesHomeSvelte,
	// [ThreadId.NFTS]: Gallery,
	[ThreadId.AGENTS]: ContactsHomeSvelte,
	[ThreadId.HISTORY]: HistoryHomeSvelte,
	[ThreadId.PROVIDERS]: ProvidersHomeSvelte,
	[ThreadId.ACCOUNTS]: AccountHomeSvelte,
	// // [ThreadId.Tags]: Tags,
	[ThreadId.APPS]: AppsHomeSvelte,
	[ThreadId.SCRATCH]: BlankSvelte,
} as const;


export enum ClassType {
	UNKNOWN = 'unknown',

	// actions that can be initiated from search
	ACTION = 'action',

	// set of chains which share a common address space, such that user accounts are translatable across members
	FAMILY = 'family',

	// specific blockchain
	CHAIN = 'chain',

	// configuration for how to communicate with chain
	PROVIDER = 'provider',

	// 
	ACCOUNT = 'account',

	// pubkey associated with distinct family 'member'
	CONTACT = 'contact',

	// on-chain resource that only exists this chain
	CONTRACT = 'contract',

	// addressable asset associated with distinct chain
	TOKEN = 'token',

	// asset holdings
	HOLDING = 'holding',

	// app connection
	APP = 'app',

	// native coin
	COIN = 'coin',

	TAG = 'tag',
	ICON = 'icon',

	IBCT = 'ibct',
	SNIP721 = 'snip721',
	TXN = 'txn',
	OTHER = 'other',
}
