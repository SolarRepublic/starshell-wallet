import type {AppStruct, AppPath} from '#/meta/app';
import {AppApiMode} from '#/meta/app';
import type {Dict} from '#/meta/belt';
import type {ContactStruct, ContactPath} from '#/meta/contact';
import {ContactAgentType} from '#/meta/contact';
import type {PfpStruct, PfpTarget} from '#/meta/pfp';
import type {ProviderStruct, ProviderPath} from '#/meta/provider';
import type {Store, StoreKey} from '#/meta/store';
import {TokenInterfaceRuntimeSchema} from '#/schema/token-interface-const';

import {F_CONTRACTS_PULSAR_NATIVE} from './built-ins/contracts-pulsar-native';
// import {F_CONTRACTS_SECRET_GEN} from './built-ins/contracts-secret-gen';
// import {F_CONTRACTS_SECRET_NATIVE} from './built-ins/contracts-secret-native';
import {F_CONTRACTS_SECRET_GEN2, F_IBC_SECRET_GEN} from './built-ins/contracts-secret';

import {
	SI_STORE_ACCOUNTS,
	SI_STORE_AGENTS,
	SI_STORE_APPS,
	SI_STORE_APP_POLICIES,
	SI_STORE_CHAINS,
	SI_STORE_ENTITIES,
	SI_STORE_EVENTS,
	SI_STORE_INCIDENTS,
	SI_STORE_HISTORIES,
	SI_STORE_MEDIA,
	SI_STORE_PROVIDERS,
	SI_STORE_PFPS,
	SI_STORE_QUERY_CACHE,
	SI_STORE_SECRETS,
	SI_STORE_SETTINGS,
	SI_STORE_TAGS,
	SI_STORE_WEB_APIS,
	SI_STORE_WEB_RESOURCES,
	SI_STORE_CONTRACTS,
	B_RELEASE_BETA,
	SI_STORE_DEVICES,
	B_DEVELOPMENT,
} from '#/share/constants';

import {fold, ode, oderac, oderaf, oderom} from '#/util/belt';
import {buffer_to_base58, buffer_to_base64, sha256_sync_insecure, text_to_buffer} from '#/util/data';

const G_EXPLORER_MINTSCAN = {
	base: 'https://www.mintscan.io/{chain_prefix}/',
	block: '/blocks/{height}',
	account: '/account/{address}',
	contract: '/contract/{address}',
	validator: '/validators/{address}',
	transaction: '/txs/{hash}',
};

const type_check = <si_store extends StoreKey>(h_input: Store.Cache<si_store>): typeof h_input => h_input;

const H_MEDIA = __H_MEDIA_BUILTIN;
const H_MEDIA_LOOKUP = __H_MEDIA_LOOKUP;

export const H_STORE_INIT_MEDIA = type_check<typeof SI_STORE_MEDIA>(H_MEDIA);

const cosmos_bech32s = <s_prefix extends string=string>(s_prefix: s_prefix) => ({
	acc: s_prefix,
	accpub: `${s_prefix}pub`,
	valoper: `${s_prefix}valoper`,
	valoperpub: `${s_prefix}valoperpub`,
	valcons: `${s_prefix}valcons`,
	valconspub: `${s_prefix}valconspub`,
}) as const;

export const H_STORE_INIT_PFPS = type_check<typeof SI_STORE_PFPS>(
	oderom(H_MEDIA_LOOKUP, (sr_path, w_data) => /^\/media\/(token|vendor|other)\//.test(sr_path)
		? {
			[`/template.pfp/uuid.${buffer_to_base58(sha256_sync_insecure(text_to_buffer(sr_path)))}`]: {
				type: 'plain',
				image: {
					default: w_data,
				},
			},
		} as Dict<PfpStruct>
		: {}
	));

export const H_LOOKUP_PFP: Dict<PfpTarget> = {};
for(const [p_pfp, g_pfp] of ode(H_STORE_INIT_PFPS)) {
	if('plain' === g_pfp.type) {
		const g_media = H_MEDIA[g_pfp.image.default];
		H_LOOKUP_PFP[g_media.data] = p_pfp;
	}
}

const S_SNIP20_GAS_LIMIT_SLIM = `${40_000n}` as const;
const S_SNIP20_GAS_LIMIT_LOW = `${60_000n}` as const;
const S_SNIP20_GAS_LIMIT_MED = `${150_000n}` as const;
const S_SNIP20_GAS_LIMIT_MORE = `${175_000n}` as const;


export const H_STORE_INIT_CHAINS = type_check<typeof SI_STORE_CHAINS>({
	...!B_RELEASE_BETA? {
		'/family.cosmos/chain.secret-4': {
			on: 1,
			name: 'Secret Network',
			pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
			namespace: 'cosmos',
			reference: 'secret-4',
			bech32s: cosmos_bech32s('secret'),
			slip44s: [
				{
					coinType: 529,
				},
				{
					coinType: 118,
				},
			],
			coins: {
				SCRT: {
					decimals: 6,
					denom: 'uscrt',
					name: 'Secret',
					pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
					extra: {
						coingeckoId: 'secret',
						nativeBech32: 'secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek',
					},
				},
				stOSMO: {
					decimals: 6,
					denom: 'ibc/B0988C39E7418C644FDFD41682A59D22DCAD1BCC7A6429B2EAAA195FB726A2D7',
					name: 'stOSMO',
					pfp: H_LOOKUP_PFP['/media/token/osmo.svg'],
					extra: {
						coingeckoId: 'osmosis',
						nativeBech32: 'secret1jrp6z8v679yaq65rndsr970mhaxzgfkymvc58g',
					},
				},
				USK: {
					decimals: 6,
					denom: 'ibc/C84076353ADA602528AC211EE626AE95FC4E091A0033B93CA5E1F6BE17070BBE',
					name: 'USK',
					pfp: '',
					extra: {
						coingeckoId: 'usk',
						nativeBech32: 'secret1cj2fvj4ap79fl9euz8kqn0k5xlvck0pw9z9xhr',
					},
				},
				// EVMOS: {
				// 	decimals: 18,
				// 	denom: 'ibc/F3AA7EF362EC5E791FE78A0F4CCC69FEE1F9A7485EB1A8CAB3F6601C00522F10',
				// 	name: 'Evmos',
				// 	pfp: H_LOOKUP_PFP['/media/token/evmos.svg'],
				// 	extra: {
				// 		coingeckoId: 'evmos',
				// 		nativeBech32: 'secret1grg9unv2ue8cf98t50ea45prce7gcrj2n232kq',
				// 	},
				// },
				// STARS: {
				// 	decimals: 6,
				// 	denom: 'ibc/4F393C3FCA4190C0A6756CE7F6D897D5D1BE57D6CCB80D0BC87393566A7B6602',
				// 	name: 'Stargaze',
				// 	pfp: H_LOOKUP_PFP['/media/token/stars.svg'],
				// 	extra: {
				// 		coingeckoId: 'stargaze',
				// 		nativeBech32: 'secret1x0dqckf2khtxyrjwhlkrx9lwwmz44k24vcv2vv',
				// 	},
				// },
				axlUSDC: {
					decimals: 6,
					denom: 'ibc/295548A78785A1007F232DE286149A6FF512F180AF5657780FC89C009E2C348F',
					name: 'axlUSDC',
					pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
					extra: {
						coingeckoId: 'usd-coin',
						nativeBech32: 'secret1vkq022x4q8t8kx9de3r84u669l65xnwf2lg3e6',
					},
				},
				...F_IBC_SECRET_GEN(H_LOOKUP_PFP),
			},
			gasPrices: {
				default: 0.1,
				steps: [
					0.0125,
					0.1,
					0.25,
				],
			},
			features: {
				'secretwasm': {
					consensusIoPubkey: ']`om+}D]q1rtJy;NRzd^GQ#+ZQ!PV5d,kRqy5XSB',
					gasPadding: {
						stepSize: `${10_000n}`,
					},
					interfaceSchemas: {
						snip20: {
							name: TokenInterfaceRuntimeSchema.String,
							symbol: TokenInterfaceRuntimeSchema.TokenSymbol,
							decimals: TokenInterfaceRuntimeSchema.NaturalNumber,
						},
						snip21: {},
						snip22: {},
						snip23: {},
						snip24: {},
						snip25: {},
						snip721: {
							name: TokenInterfaceRuntimeSchema.String,
							symbol: TokenInterfaceRuntimeSchema.String,
						},
						snip722: {},
					},
					snip20GasLimits: {
						transfer: S_SNIP20_GAS_LIMIT_LOW,  // 60k
						send: S_SNIP20_GAS_LIMIT_MORE,
						register_receive: S_SNIP20_GAS_LIMIT_MED,
						create_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
						set_viewing_key: S_SNIP20_GAS_LIMIT_SLIM,  // 40k
						increase_allowance: S_SNIP20_GAS_LIMIT_MED,
						decrease_allowance: S_SNIP20_GAS_LIMIT_MED,
						transfer_from: S_SNIP20_GAS_LIMIT_MED,
						send_from: S_SNIP20_GAS_LIMIT_MORE,
						mint: S_SNIP20_GAS_LIMIT_MED,
						set_minters: S_SNIP20_GAS_LIMIT_MED,
						burn: S_SNIP20_GAS_LIMIT_MED,
						burn_from: S_SNIP20_GAS_LIMIT_MED,
						deposit: S_SNIP20_GAS_LIMIT_LOW,
						redeem: S_SNIP20_GAS_LIMIT_LOW,
						revoke_permit: S_SNIP20_GAS_LIMIT_MED,
					},
				},
				'ibc-go': {},
				'ibc-transfer': {},
			},
			fungibleTokenInterfaces: ['snip20', 'snip21', 'snip22', 'snip23', 'snip24'],
			nonFungibleTokenInterfaces: ['snip721', 'snip722'],
			blockExplorer: {
				base: 'https://ping.pub/{chain_prefix}',
				block: '/block/{height}',
				account: '#not-available',
				contract: '#not-available',
				validator: '/staking/{address}',
				transaction: '/tx/{hash}',
			},
			mainnet: {
				feegrants: {
					'https://faucet.starshell.net/': {},
				},
			},
			providers: [],
		},

		// ...B_DEVELOPMENT? {
		// 	'/family.cosmos/chain.osmosis-1': {
		// 		on: 1,
		// 		name: 'Osmosis',
		// 		pfp: H_LOOKUP_PFP['/media/token/osmo.svg'],
		// 		namespace: 'cosmos',
		// 		reference: 'osmosis-1',
		// 		bech32s: cosmos_bech32s('osmo'),
		// 		slip44s: [
		// 			{
		// 				coinType: 118,
		// 			},
		// 		],
		// 		coins: {
		// 			OSMO: {
		// 				decimals: 6,
		// 				denom: 'uosmo',
		// 				name: 'Osmosis',
		// 				pfp: H_LOOKUP_PFP['/media/token/osmo.svg'],
		// 				extra: {
		// 					coingeckoId: 'osmosis',
		// 					nativeBech32: 'secret1zwwealwm0pcl9cul4nt6f38dsy6vzplw8lp3qg',
		// 				},
		// 			},
		// 		},
		// 		gasPrices: {
		// 			default: 0,
		// 			steps: [
		// 				0,
		// 				0.025,
		// 				0.04,
		// 			],
		// 		},
		// 		features: {
		// 			'ibc-go': {},
		// 			'ibc-transfer': {},
		// 		},
		// 		fungibleTokenInterfaces: [],
		// 		nonFungibleTokenInterfaces: [],
		// 		blockExplorer: G_EXPLORER_MINTSCAN,
		// 		mainnet: {},
		// 		providers: [],
		// 	},
		// }: {},
	}: {},

	'/family.cosmos/chain.pulsar-2': {
		on: 1,
		name: 'Secret Pulsar 2',
		pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
		namespace: 'cosmos',
		reference: 'pulsar-2',
		bech32s: cosmos_bech32s('secret'),
		slip44s: [
			{
				coinType: 529,
			},
			{
				coinType: 118,
			},
		],
		coins: {
			SCRT: {
				decimals: 6,
				denom: 'uscrt',
				name: 'Secret',
				pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
				extra: {
					coingeckoId: 'secret',
					nativeBech32: 'secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg',
				},
			},
		},
		gasPrices: {
			default: 0.1,
			steps: [
				0.0125,
				0.1,
				0.25,
			],
		},
		features: {
			'secretwasm': {
				consensusIoPubkey: 'Q/-p<DzxO`MwIky9B{_ LKgQ]hr=3dp45Yk9~J!',
				gasPadding: {
					stepSize: `${10_000n}`,
				},
				interfaceSchemas: {
					snip20: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
						decimals: TokenInterfaceRuntimeSchema.NaturalNumber,
					},
					snip21: {},
					snip22: {},
					snip23: {},
					snip24: {},
					snip721: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
					},
					snip722: {},
				},
				// gasLimits: fodemtv({
				// 	'cosmos-sdk/MsgSend': 13_000n,
				// }, xg => xg+''),
				snip20GasLimits: {
					transfer: `${180_000n}`,
					send: S_SNIP20_GAS_LIMIT_MORE,
					register_receive: S_SNIP20_GAS_LIMIT_MED,
					create_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					set_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					increase_allowance: S_SNIP20_GAS_LIMIT_MED,
					decrease_allowance: S_SNIP20_GAS_LIMIT_MED,
					transfer_from: S_SNIP20_GAS_LIMIT_MED,
					send_from: S_SNIP20_GAS_LIMIT_MORE,
					mint: S_SNIP20_GAS_LIMIT_MED,
					set_minters: S_SNIP20_GAS_LIMIT_MED,
					burn: S_SNIP20_GAS_LIMIT_MED,
					burn_from: S_SNIP20_GAS_LIMIT_MED,
					deposit: S_SNIP20_GAS_LIMIT_MED,  // 150k
					redeem: S_SNIP20_GAS_LIMIT_MED,
					revoke_permit: S_SNIP20_GAS_LIMIT_MED,
				},
			},
			'ibc-go': {},
			'ibc-transfer': {},
		},
		fungibleTokenInterfaces: ['snip20', 'snip21', 'snip22', 'snip23', 'snip24'],
		nonFungibleTokenInterfaces: ['snip721', 'snip722'],
		blockExplorer: {
			base: 'https://ping.pub/{chain_prefix}',
			block: '/block/{height}',
			account: '#not-available',
			contract: '#not-available',
			validator: '/staking/{address}',
			transaction: '/tx/{hash}',
		},
		testnet: {
			faucets: {
				'https://faucet.starshell.net/': {},
				'https://faucet.pulsar.scrttestnet.com/': {},
				'https://pulsar.faucet.trivium.network/': {},
				'https://faucet.secrettestnet.io/': {},
			},
		},
		providers: [],
	},

	'/family.cosmos/chain.pulsar-3': {
		on: 1,
		name: 'Secret Pulsar 3',
		pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
		namespace: 'cosmos',
		reference: 'pulsar-3',
		bech32s: cosmos_bech32s('secret'),
		slip44s: [
			{
				coinType: 529,
			},
			{
				coinType: 118,
			},
		],
		coins: {
			SCRT: {
				decimals: 6,
				denom: 'uscrt',
				name: 'Secret',
				pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
				extra: {
					coingeckoId: 'secret',
					// nativeBech32: 'secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg',
				},
			},
		},
		gasPrices: {
			default: 0.1,
			steps: [
				0.0125,
				0.1,
				0.25,
			],
		},
		features: {
			'secretwasm': {
				consensusIoPubkey: 't5z&[67mklrWU.IZle:Q/JnD(m67[epw6_,fnZzA',
				gasPadding: {
					stepSize: `${10_000n}`,
				},
				interfaceSchemas: {
					snip20: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
						decimals: TokenInterfaceRuntimeSchema.NaturalNumber,
					},
					snip21: {},
					snip22: {},
					snip23: {},
					snip24: {},
					snip721: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
					},
					snip722: {},
				},
				// gasLimits: fodemtv({
				// 	'cosmos-sdk/MsgSend': 13_000n,
				// }, xg => xg+''),
				snip20GasLimits: {
					transfer: `${180_000n}`,
					send: S_SNIP20_GAS_LIMIT_MORE,
					register_receive: S_SNIP20_GAS_LIMIT_MED,
					create_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					set_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					increase_allowance: S_SNIP20_GAS_LIMIT_MED,
					decrease_allowance: S_SNIP20_GAS_LIMIT_MED,
					transfer_from: S_SNIP20_GAS_LIMIT_MED,
					send_from: S_SNIP20_GAS_LIMIT_MORE,
					mint: S_SNIP20_GAS_LIMIT_MED,
					set_minters: S_SNIP20_GAS_LIMIT_MED,
					burn: S_SNIP20_GAS_LIMIT_MED,
					burn_from: S_SNIP20_GAS_LIMIT_MED,
					deposit: S_SNIP20_GAS_LIMIT_MED,  // 150k
					redeem: S_SNIP20_GAS_LIMIT_MED,
					revoke_permit: S_SNIP20_GAS_LIMIT_MED,
				},
			},
			'ibc-go': {},
			'ibc-transfer': {},
		},
		fungibleTokenInterfaces: ['snip20', 'snip21', 'snip22', 'snip23', 'snip24'],
		nonFungibleTokenInterfaces: ['snip721', 'snip722'],
		blockExplorer: {
			base: 'https://explorer-pulsar3.vercel.app/',
			block: '/block/{height}',
			account: '#not-available',
			contract: '#not-available',
			validator: '/staking/{address}',
			transaction: '/tx/{hash}',
		},
		testnet: {
			faucets: {
				'https://faucet-ui-pulsar3.vercel.app/': {},
			},
		},
		providers: [],
	},

	'/family.cosmos/chain.secretdev-1': {
		on: 0,
		name: 'Secret Local Dev',
		pfp: H_LOOKUP_PFP['/media/token/scrt-dev.svg'],
		namespace: 'cosmos',
		reference: 'secretdev-1',
		bech32s: cosmos_bech32s('secret'),
		slip44s: [
			{
				coinType: 529,
			},
			{
				coinType: 118,
			},
		],
		coins: {
			SCRT: {
				decimals: 6,
				denom: 'uscrt',
				name: 'Secret',
				pfp: H_LOOKUP_PFP['/media/token/scrt-dev.svg'],
			},
		},
		gasPrices: {
			default: 0.1,
			steps: [
				0.0125,
				0.1,
				0.25,
			],
		},
		features: {
			'secretwasm': {
				consensusIoPubkey: '',
				gasPadding: {
					stepSize: `${10_000n}`,
				},
				interfaceSchemas: {
					snip20: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
						decimals: TokenInterfaceRuntimeSchema.NaturalNumber,
					},
					snip21: {},
					snip22: {},
					snip23: {},
					snip24: {},
					snip721: {
						name: TokenInterfaceRuntimeSchema.String,
						symbol: TokenInterfaceRuntimeSchema.String,
					},
					snip722: {},
				},
				// gasLimits: fodemtv({
				// 	'cosmos-sdk/MsgSend': 13_000n,
				// }, xg => xg+''),
				snip20GasLimits: {
					transfer: `${180_000n}`,
					send: S_SNIP20_GAS_LIMIT_MORE,
					register_receive: S_SNIP20_GAS_LIMIT_MED,
					create_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					set_viewing_key: S_SNIP20_GAS_LIMIT_MORE,  // 175k
					increase_allowance: S_SNIP20_GAS_LIMIT_MED,
					decrease_allowance: S_SNIP20_GAS_LIMIT_MED,
					transfer_from: S_SNIP20_GAS_LIMIT_MED,
					send_from: S_SNIP20_GAS_LIMIT_MORE,
					mint: S_SNIP20_GAS_LIMIT_MED,
					set_minters: S_SNIP20_GAS_LIMIT_MED,
					burn: S_SNIP20_GAS_LIMIT_MED,
					burn_from: S_SNIP20_GAS_LIMIT_MED,
					deposit: S_SNIP20_GAS_LIMIT_MED,  // 150k
					redeem: S_SNIP20_GAS_LIMIT_MED,
					revoke_permit: S_SNIP20_GAS_LIMIT_MED,
				},
			},
			'ibc-go': {},
			'ibc-transfer': {},
		},
		fungibleTokenInterfaces: ['snip20', 'snip21', 'snip22', 'snip23', 'snip24'],
		nonFungibleTokenInterfaces: ['snip721', 'snip722'],
		testnet: {
			faucets: {},
		},
		devnet: {},
		providers: [],
	},

	// '/family.cosmos/chain.theta-testnet-001': {
	// 	name: 'Cosmos Hub Theta',
	// 	pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
	// 	namespace: 'cosmos',
	// 	reference: 'theta-testnet-001',
	// 	bech32s: cosmos_bech32s('cosmos'),
	// 	slip44s: [{
	// 		coinType: 118,
	// 	}],
	// 	coins: {
	// 		ATOM: {
	// 			decimals: 6,
	// 			denom: 'uatom',
	// 			name: 'Cosmos',
	// 			pfp: H_LOOKUP_PFP['/media/chain/cosmos-hub.svg'],
	// 			extra: {
	// 				coingeckoId: 'cosmos-hub',
	// 			},
	// 		},
	// 	},
	// 	gasPrices: {
	// 		default: 0.025,
	// 		steps: [
	// 			0,
	// 			0.025,
	// 			0.04,
	// 		],
	// 	},
	// 	features: {
	// 		'ibc-go': {},
	// 		'ibc-transfer': {},
	// 	},
	// 	fungibleTokenInterfaces: ['cw-20'],
	// 	nonFungibleTokenInterfaces: [],
	// 	blockExplorer: {
	// 		base: 'https://testnet.cosmos.bigdipper.live',
	// 		block: '/blocks/{height}',
	// 		account: '/accounts/{address}',
	// 		contract: '/contracts/{address}',
	// 		validator: '/validators/{address}',
	// 		transaction: '/transactions/{hash}',
	// 	},
	// 	testnet: {
	// 		faucets: [
	// 			'https://discord.com/channels/669268347736686612/953697793476821092',
	// 		],
	// 	},
	// 	providers: [],
	// },
});

export const H_STORE_INIT_CONTRACTS = type_check<typeof SI_STORE_CONTRACTS>(fold([
	...F_CONTRACTS_PULSAR_NATIVE(H_LOOKUP_PFP),

	...!B_RELEASE_BETA? [
		...F_CONTRACTS_SECRET_GEN2(H_LOOKUP_PFP),
		// ...F_CONTRACTS_SECRET_NATIVE(H_LOOKUP_PFP),
		// ...F_CONTRACTS_SECRET_GEN(H_LOOKUP_PFP),
	]: [],
], g_each => ({
	[`${g_each.chain}/bech32.${g_each.bech32}/as.contract`]: g_each,
})));

export const H_STORE_INIT_PROVIDERS = type_check<typeof SI_STORE_PROVIDERS>(fold([
	...!B_RELEASE_BETA? [
		...oderaf({
			'secret-4': {
				label: 'Secret',
			},
			// ...B_DEVELOPMENT? {
			// 	'osmosis-1': {
			// 		label: 'Osmosis',
			// 	},
			// }: {},
		}, (si_chain, g_provider) => oderac({
			ajax: {
				label: 'Ajax',
			},
			brynn: {
				label: 'Brynn',
			},
			cavax: {
				label: 'Cavax',
			},
		}, (si_host, g_host) => ({
			name: `StarShell ${g_provider.label} Mainnet: ${g_host.label}`,
			pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
			chain: `/family.cosmos/chain.${si_chain}`,
			grpcWebUrl: `https://grpc-web.${si_chain.replace(/-.*$/, '')}.${si_host}.starshell.net`,
			rpcHost: `rpc.${si_chain.replace(/-.*$/, '')}.${si_host}.starshell.net`,
			healthCheckPath: '/health',
			on: 1,
		}))),

		// {
		// 	name: 'Osmosis Zone',
		// 	chain: '/family.cosmos/chain.osmosis-1',
		// 	rpcHost: 'rpc.osmosis.zone',
		// 	grpcWebUrl: 'https://grpc-web.osmosis.starshell.net',
		// 	lcdUrl: 'https://lcd.osmosis.zone',
		// },

		// // secret.express
		// {
		// 	name: 'Secret Express',
		// 	pfp: '',
		// 	chain: '/family.cosmos/chain.secret-4',
		// 	rpcHost: 'rpc.secret.express',
		// 	grpcWebUrl: 'https://wgrpc.secret.express',
		// 	on: 1,
		// },

		// // mainnet primary
		// {
		// 	name: 'StarShell Secret Mainnet: Ajax',
		// 	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		// 	chain: '/family.cosmos/chain.secret-4',
		// 	grpcWebUrl: 'https://grpc-web.secret.ajax.starshell.net',
		// 	rpcHost: 'rpc.secret.ajax.starshell.net',
		// 	healthCheckPath: '/health',
		// 	on: 1,
		// },

		// // mainnet fallback
		// {
		// 	name: 'StarShell Secret Mainnet: Brynn',
		// 	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		// 	chain: '/family.cosmos/chain.secret-4',
		// 	grpcWebUrl: 'https://grpc-web.secret.brynn.starshell.net',
		// 	rpcHost: 'rpc.secret.brynn.starshell.net',
		// 	healthCheckPath: '/health',
		// 	on: 1,
		// },

	]: [],

	// testnet
	{
		name: 'StarShell Pulsar 2 Testnet: Apex',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		chain: '/family.cosmos/chain.pulsar-2',
		grpcWebUrl: 'https://grpc-web.pulsar.apex.starshell.net',
		rpcHost: 'rpc.pulsar.apex.starshell.net',
		healthCheckPath: '/health',
		on: 1,
	},

	// pulsar-3 testnet
	{
		name: 'StarShell Pulsar 3 Testnet: Bitso',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		chain: '/family.cosmos/chain.pulsar-3',
		grpcWebUrl: 'https://grpc-web.pulsar3.bitso.starshell.net',
		rpcHost: 'rpc.pulsar3.bitso.starshell.net',
		healthCheckPath: '/health',
		on: 1,
	},
], g_each => ({
	[`/provider.${buffer_to_base64(sha256_sync_insecure(text_to_buffer(g_each.grpcWebUrl)))}`]: {
		...g_each,
	},
})) as Record<ProviderPath, ProviderStruct>);


export const H_STORE_INIT_APPS = type_check<typeof SI_STORE_APPS>(fold([
	// {
	// 	host: 'app.starshell.net',
	// 	name: 'StarShell Web',
	// 	api: AppApiMode.STARSHELL,
	// 	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	// },

	// pulsar faucet
	{
		host: 'faucet.starshell.net',
		name: 'StarShell Pulsar 2 Faucet',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
	},
], g_each => ({
	[`/scheme.${g_each['scheme'] || 'https'}/host.${g_each.host.replace(/:/g, '+')}`]: {
		scheme: 'https',
		on: 1,
		connections: {
			'/family.cosmos/chain.pulsar-2': {
				accounts: [],
				permissions: {},
			},
		},
		pfp: '' as PfpTarget,
		api: AppApiMode.UNKNOWN,
		...g_each,
	},
})) as Record<AppPath, AppStruct>);


export const H_STORE_INIT_AGENTS = type_check<typeof SI_STORE_AGENTS>(fold([
	...!B_RELEASE_BETA? [
		{
			namespace: 'cosmos',
			chains: ['/family.cosmos/chain.secret-4'],
			agentType: ContactAgentType.ROBOT,
			addressSpace: 'acc',
			addressData: '3220hzfrxxd6zrdl5qm78xm4aacvyvls',
			origin: 'built-in',
			name: 'StarShell Courtesy Feegrant',
			pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
			notes: '',
		} as ContactStruct,

		{
			namespace: 'cosmos',
			chains: ['/family.cosmos/chain.secret-4'],
			agentType: ContactAgentType.ROBOT,
			addressSpace: 'acc',
			addressData: 'tq6y8waegggp4fv2fcxk3zmpsmlfadyc',
			origin: 'built-in',
			name: 'Secret Network Faucet',
			pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
			notes: '',
		} as ContactStruct,
	]: [],

	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.pulsar-2'],
		agentType: ContactAgentType.ROBOT,
		addressSpace: 'acc',
		addressData: 't6qpwwtfdxtgxyhfaevcxsd6gtp447dw',
		origin: 'built-in',
		name: 'StarShell Pulsar Faucet',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		notes: '',
	},

	{
		namespace: 'cosmos',
		chains: ['/family.cosmos/chain.secret-4'],
		agentType: ContactAgentType.ROBOT,
		addressSpace: 'valoper',
		addressData: 'yv9f4tankaktdtf8lq6rjsx9c9rpfptc',
		origin: 'built-in',
		name: 'StarShell Validator',
		pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
		notes: '',
	},

	// {
	// 	namespace: 'cosmos',
	// 	chains: ['/family.cosmos/chain.pulsar-2'],
	// 	agentType: ContactAgentType.ROBOT,
	// 	addressSpace: 'acc',
	// 	addressData: 'x0dh57m99fg2vwg49qxpuadhq4dz3gsv',
	// 	origin: 'built-in',
	// 	name: 'Secret Network Faucet',
	// 	pfp: H_LOOKUP_PFP['/media/other/secret-saturn.svg'],
	// 	notes: '',
	// } as ContactStruct,

	// {
	// 	namespace: 'cosmos',
	// 	chains: ['/family.cosmos/chain.pulsar-2'],
	// 	agentType: ContactAgentType.ROBOT,
	// 	addressSpace: 'acc',
	// 	addressData: '3fqtu0lxsvn8gtlf3mz5kt75spxv93ss',
	// 	origin: 'built-in',
	// 	name: 'faucet.secrettestnet.io',
	// 	pfp: H_LOOKUP_PFP['/media/token/secret-secret.svg'],
	// 	notes: '',
	// } as ContactStruct,
	// {
	// 	namespace: 'cosmos',
	// 	chains: ['/family.cosmos/chain.pulsar-2'],
	// 	agentType: ContactAgentType.ROBOT,
	// 	addressSpace: 'acc',
	// 	addressData: 'nhq5lntsfucw4fsj4q2rfdd5gwh593w3',
	// 	origin: 'built-in',
	// 	name: 'faucet.pulsar.scrttestnet.com',
	// 	pfp: H_LOOKUP_PFP['/media/token/secret-secret.svg'],
	// 	notes: '',
	// } as ContactStruct,

	// {
	// 	namespace: 'cosmos',
	// 	chains: ['/family.cosmos/chain.pulsar-2'],
	// 	agentType: ContactAgentType.PERSON,
	// 	addressSpace: 'acc',
	// 	addressData: '7zsfp55my52xv0qx2p0ryfull82cr3cm',
	// 	origin: 'built-in',
	// 	name: 'supdoggie',
	// 	pfp: H_LOOKUP_PFP['/media/other/supdoggie.png'],
	// 	notes: '',
	// } as ContactStruct,
], g_contact => ({
	[`/family.${g_contact.namespace}/agent.${g_contact.addressData}/as.contact`]: g_contact,
})) as Record<ContactPath, ContactStruct>);

const H_TAGS_DEFAULT = {
	// pink: '#D500F9',
	art: '#D500F9',
	hot: '#C51162',
	// orange: '#FF4D21',
	social: '#FF4D21',
	// gold: '#FF8622',
	personal: '#FF8622',
	// yellow: '#EEB521',
	speculative: '#EEB521',
	// autum: '#7E9E24',
	business: '#7E9E24',
	// grass: '#3A6F16',
	trusted: '#3A6F16',
	// teal: '#009688',
	defi: '#009688',
	// sky: '#1976D2',,
	faucet: '#1976D2',
	// violet: '#6200EA',
	gaming: '#6200EA',
	// gray: '#607D8B',
	stablecoin: '#607D8B',
	// brown: '#795548',
	sellable: '#795548',
	bright: '#ffffff',
};

const f_tag_index = (si_name: string) => ode(H_TAGS_DEFAULT).findIndex(([si]) => si_name === si);

const A_STABLECOIN_COMBOS = `
	DAI USDT USDC TUSD BUSD
`.trim().split(/\s+/g).flatMap(s => [s, `s${s}`, `s${s}(BSC)`]);

export const H_STORE_INITS: {
	[si_store in StoreKey]: Store[si_store] extends any[]
		? Store.Cache<si_store>
		: Partial<Store.Map<si_store>>;
} = {
	[SI_STORE_APPS]: H_STORE_INIT_APPS,
	[SI_STORE_APP_POLICIES]: {
		hq: [],
		user: [],
	},
	[SI_STORE_ACCOUNTS]: {},
	[SI_STORE_DEVICES]: {},
	[SI_STORE_AGENTS]: H_STORE_INIT_AGENTS,
	[SI_STORE_CHAINS]: H_STORE_INIT_CHAINS,
	[SI_STORE_CONTRACTS]: H_STORE_INIT_CONTRACTS,
	[SI_STORE_PROVIDERS]: H_STORE_INIT_PROVIDERS,
	[SI_STORE_SETTINGS]: {},
	[SI_STORE_MEDIA]: H_STORE_INIT_MEDIA,
	[SI_STORE_PFPS]: H_STORE_INIT_PFPS,
	[SI_STORE_ENTITIES]: {},
	[SI_STORE_EVENTS]: [],
	[SI_STORE_INCIDENTS]: {},
	[SI_STORE_HISTORIES]: {
		order: [],
		syncs: oderom(H_STORE_INIT_CHAINS, p_chain => ({
			[p_chain]: {},
		})),
		seen: 0,
	},
	[SI_STORE_SECRETS]: {},
	[SI_STORE_TAGS]: {
		registry: oderac(H_TAGS_DEFAULT, (si_key, s_value, i_entry) => ({
			index: i_entry,
			color: s_value,
			name: si_key,
			info: '',
		})),
		map: {
			// faucet accounts
			...oderom(H_STORE_INIT_AGENTS, (p_agent, g_agent) => {
				const g_contact = g_agent as ContactStruct;
				if('robot' === g_contact.agentType) {
					return {
						[p_agent]: [f_tag_index('faucet')],
					};
				}
			}),

			// faucet apps
			...oderom(H_STORE_INIT_APPS, p_app => ({
				[p_app]: [f_tag_index('faucet')],
			})),

			// stablecoins
			...oderom(H_STORE_INIT_CONTRACTS, (p_contract, g_contract) => {
				if(A_STABLECOIN_COMBOS.includes(g_contract.interfaces.snip20?.symbol || '')) {
					return {
						[p_contract]: [f_tag_index('stablecoin')],
					};
				}
			}),
		},
	},
	[SI_STORE_QUERY_CACHE]: {},
	[SI_STORE_WEB_RESOURCES]: {},
	[SI_STORE_WEB_APIS]: {},
};
