import type {Dict} from '#/meta/belt';

import {fodemtv} from '#/util/belt';


export interface Brand {
	name: string;
	pfp: string;
	symbol: string;
	decimals: number;
	coingeckoId: string;

	ibc?: {
		chain: string;
		denom: string;
		channels: Dict<`${number}:${number}`>;
	};
}


const G_BRANDS_CONFIG = {
	Aave: {
		pfp: 'aave.svg',
		decimals: 18,
		symbol: 'AAVE',
		coingeckoId: 'aave',
	},
	Agoric: {
		pfp: 'bld.svg',
		symbol: 'BLD',
		coingeckoId: 'agoric',
		ibc: {
			chain: 'agoric-3',
			denom: 'ubld',
			channels: {
				'secret-4': '10:51',
			},
		},
	},
	Akash: {
		pfp: 'akt.svg',
		symbol: 'AKT',
		coingeckoId: 'akash-network',
		ibc: {
			chain: 'akashnet-2',
			denom: 'uakt',
			channels: {
				'secret-4': '43:21',
			},
		},
	},
	Alter: {
		pfp: 'alter.svg',
		decimals: 6,
		symbol: 'ALTER',
		coingeckoId: 'alter',
	},
	Amber: {
		pfp: 'amber.svg',
		decimals: 6,
		symbol: 'AMBER',
		coingeckoId: '',
	},
	Axelar: {
		pfp: 'axl.svg',
		symbol: 'AXL',
		coingeckoId: 'axelar',
		ibc: {
			chain: 'axelar-dojo-1',
			denom: 'uaxl',
			channels: {
				'secret-4': '12:20',
			},
		},
	},
	Band: {
		pfp: 'band.svg',
		decimals: 18,
		symbol: 'BAND',
		coingeckoId: 'band-protocol',
	},
	Binance_Coin: {
		pfp: 'bnb.svg',
		decimals: 18,
		symbol: 'BNB',
		coingeckoId: 'binancecoin',
	},
	Binance_USD: {
		pfp: 'busd.svg',
		decimals: 18,
		symbol: 'BUSD',
		coingeckoId: 'binance-usd',
	},
	Button: {
		pfp: 'butt.svg',
		decimals: 6,
		symbol: 'BUTT',
		coingeckoId: 'buttcoin-2',
	},
	Cardano: {
		pfp: 'ada.svg',
		decimals: 18,
		symbol: 'ADA',
		coingeckoId: 'cardano',
	},
	Chainlink: {
		pfp: 'link.svg',
		decimals: 18,
		symbol: 'LINK',
		coingeckoId: 'chainlink',
	},
	Chihuahua: {
		pfp: 'huahua.svg',
		symbol: 'HUAHUA',
		coingeckoId: 'chihuahua-token',
		ibc: {
			chain: 'chihuahua-1',
			denom: 'uhuahua',
			channels: {
				'secret-4': '16:11',
			},
		},
	},
	Comdex: {
		pfp: 'comdex.svg',
		symbol: 'CMDX',
		coingeckoId: 'comdex',
		ibc: {
			chain: 'comdex-1',
			denom: 'ucmdx',
			channels: {
				'secret-4': '65:63',
			},
		},
	},
	Composite: {
		pfp: 'cmst.svg',
		symbol: 'CMST',
		coingeckoId: 'composite',
	},
	Cosmos_Hub: {
		pfp: 'atom.svg',
		symbol: 'ATOM',
		coingeckoId: 'cosmos',
		ibc: {
			chain: 'cosmoshub-4',
			denom: 'uatom',
			channels: {
				'secret-4': '235:0',
			},
		},
	},
	Crescent: {
		pfp: 'cre.svg',
		symbol: 'CRE',
		coingeckoId: 'crescent-network',
	},
	Dai: {
		pfp: 'dai.svg',
		decimals: 18,
		symbol: 'DAI',
		coingeckoId: 'dai',
	},
	Decentraland: {
		pfp: 'mana.svg',
		decimals: 18,
		symbol: 'MANA',
		coingeckoId: 'decentraland',
	},
	Dogecoin: {
		pfp: 'doge.svg',
		decimals: 18,
		symbol: 'DOGE',
		coingeckoId: 'dogecoin',
	},
	Ethereum: {
		pfp: 'eth.svg',
		decimals: 18,
		symbol: 'ETH',
		coingeckoId: 'ethereum',
	},
	Evmos: {
		pfp: 'evmos.svg',
		decimals: 18,
		symbol: 'EVMOS',
		coingeckoId: 'evmos',
		ibc: {
			chain: 'evmos_9001-2',
			denom: 'aevmos',
			channels: {
				'secret-4': '15:18',
			},
		},
	},
	Harbor: {
		pfp: 'dai.svg',
		symbol: 'HARBOR',
		coingeckoId: '',
	},
	InterStable_Token: {
		pfp: 'ist.svg',
		symbol: 'IST',
		coingeckoId: 'inter-stable-token',
	},
	Frax: {
		pfp: 'frax.svg',
		decimals: 18,
		symbol: 'FRAX',
		coingeckoId: 'frax',
	},
	Gravity_Bridge: {
		pfp: 'grav.svg',
		symbol: 'GRAV',
		coingeckoId: 'gravity-bridge',
		ibc: {
			chain: 'gravity-bridge-3',
			denom: 'ugraviton',
			channels: {
				'secret-4': '79:17',
			},
		},
	},
	Injective: {
		pfp: 'inj.svg',
		decimals: 18,
		symbol: 'INJ',
		coingeckoId: 'injective-protocol',
		ibc: {
			chain: 'injective-1',
			denom: 'inj',
			channels: {
				'secret-4': '88:23',
			},
		},
	},
	Jackal: {
		pfp: 'jkl.svg',
		symbol: 'JKL',
		coingeckoId: 'jackal-protocol',
		ibc: {
			chain: 'jackal-1',
			denom: 'jkl',
			channels: {
				'secret-4': '2:62',
			},
		},
	},
	Juno: {
		pfp: 'juno.svg',
		symbol: 'JUNO',
		coingeckoId: 'juno-network',
		ibc: {
			chain: 'juno-1',
			denom: 'ujuno',
			channels: {
				'secret-4': '48:8',
			},
		},
	},
	Kujira: {
		pfp: 'kuji.svg',
		symbol: 'KUJI',
		coingeckoId: 'kujira',
		ibc: {
			chain: 'kaiyo-1',
			denom: 'ukuji',
			channels: {
				'secret-4': '10:22',
			},
		},
	},
	Monero: {
		pfp: 'xmr.svg',
		decimals: 12,
		symbol: 'XMR',
		coingeckoId: 'monero',
	},
	Ocean_Protocol: {
		pfp: 'ocean.svg',
		decimals: 18,
		symbol: 'OCEAN',
		coingeckoId: 'ocean-protocol',
	},
	Osmosis: {
		pfp: 'osmo.svg',
		symbol: 'OSMO',
		coingeckoId: 'osmosis',
		ibc: {
			chain: 'osmosis-1',
			denom: 'uosmo',
			channels: {
				'cosmoshub-4': '0:141',
				'secret-4': '88:1',
				'juno-1': '42:0',
				'juno-1/cw20': '169:49',
				'stargaze-1': '75:0',
				'akashnet-2': '1:9',
				'axelar-dojo-1': '208:3',
			},
		},
	},
	Persistence: {
		pfp: 'xprt.svg',
		symbol: 'XPRT',
		coingeckoId: 'persistence',
	},
	Polkadot: {
		pfp: 'dot.svg',
		decimals: 18,
		symbol: 'DOT',
		coingeckoId: 'polkadot',
	},
	pStake_Finance: {
		pfp: 'pstake.svg',
		symbol: 'pSTAKE',
		coingeckoId: 'pstake-finance',
	},
	Quicksilver: {
		pfp: 'qck.svg',
		symbol: 'QCK',
		coingeckoId: 'quicksilver',
	},
	ReserveRights: {
		pfp: 'rsr.svg',
		decimals: 18,
		symbol: 'RSR',
		coingeckoId: 'reserve-rights-token',
	},
	Secret: {
		pfp: 'scrt.svg',
		symbol: 'SCRT',
		coingeckoId: 'secret',
	},
	SecretSecret: {
		pfp: 'sscrt.svg',
		symbol: 'sSCRT',
		coingeckoId: 'secret',
	},
	Sentinel: {
		pfp: 'dvpn.png',
		symbol: 'DVPN',
		coingeckoId: 'sentinel',
		ibc: {
			chain: 'sentinelhub-2',
			denom: 'udvpn',
			channels: {
				'secret-4': '50:3',
			},
		},
	},
	Shade: {
		pfp: 'shd.svg',
		decimals: 8,
		symbol: 'SHD',
		coingeckoId: 'shade-protocol',
	},
	Sienna: {
		pfp: 'sienna.svg',
		decimals: 18,
		symbol: 'SIENNA',
		coingeckoId: 'sienna',
	},
	Silk: {
		pfp: 'silk.svg',
		symbol: 'SILK',
		coingeckoId: '',
	},
	Staked_Secret_Shade: {
		name: 'Staked SCRT (Shade)',
		pfp: 'stkd-scrt.svg',
		symbol: 'stkd-SCRT',
		coingeckoId: '',
	},
	Staked_Secret_StakeEasy: {
		name: 'Staked SCRT (StakeEasy)',
		pfp: 'sescrt.png',
		symbol: 'seSCRT',
		coingeckoId: '',
	},
	Stargaze: {
		pfp: 'stars.svg',
		symbol: 'STARS',
		coingeckoId: 'stargaze',
		ibc: {
			chain: 'stargaze-1',
			denom: 'ustars',
			channels: {
				'secret-4': '48:19',
			},
		},
	},
	Stride: {
		pfp: 'strd.svg',
		symbol: 'STRD',
		coingeckoId: 'stride',
		ibc: {
			chain: 'stride-1',
			denom: 'ustrd',
			channels: {
				'secret-4': '40:37',
			},
		},
	},
	TerraClassic: {
		pfp: 'luna.svg',
		symbol: 'LUNC',
		coingeckoId: 'terra-luna',
	},
	TerraClassicUSD: {
		pfp: 'ust.svg',
		symbol: 'USTC',
		coingeckoId: 'terrausd',
	},
	Terra: {
		pfp: 'luna2.svg',
		symbol: 'LUNA',
		coingeckoId: 'terra-luna-2',
		ibc: {
			chain: 'phoenix-1',
			denom: 'uluna',
			channels: {
				'secret-4': '3:16',
			},
		},
	},
	Tether: {
		pfp: 'usdt.svg',
		symbol: 'USDT',
		coingeckoId: 'tether',
	},
	THORChain: {
		pfp: 'rune.svg',
		decimals: 18,
		symbol: 'RUNE',
		coingeckoId: 'thorchain',
	},
	Uniswap: {
		pfp: 'uni.svg',
		decimals: 18,
		symbol: 'UNI',
		coingeckoId: 'uniswap',
	},
	USD_Coin: {
		pfp: 'usdc.svg',
		symbol: 'USDC',
		coingeckoId: 'usd-coin',
		decimals: 18,
	},
	USK: {
		pfp: 'usk.svg',
		symbol: 'USK',
		coingeckoId: 'usk',
	},
	Vesting_Secret: {
		name: 'Vesting SCRT (Shade)',
		pfp: 'vscrt.svg',
		symbol: 'vSCRT',
		coingeckoId: '',
	},
	Wrapped_BNB: {
		pfp: 'bnb.svg',
		decimals: 18,
		symbol: 'WBNB',
		coingeckoId: 'binancecoin',
	},
	Wrapped_BTC: {
		pfp: 'wbtc.svg',
		decimals: 8,
		symbol: 'WBTC',
		coingeckoId: 'bitcoin',
	},
	Wrapped_ETH: {
		pfp: 'eth.svg',
		decimals: 18,
		symbol: 'WETH',
		coingeckoId: 'ethereum',
	},
	Yearn_Finance: {
		pfp: 'yfi.svg',
		decimals: 18,
		symbol: 'YFI',
		coingeckoId: 'yearn-finance',
	},
} as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
const G_ASSERT_BRANDS_CONFIG: Record<string, {
	name?: string;
	pfp: string;
	decimals?: number;
	symbol: string;
	coingeckoId: string;
	ibc?: {
		chain: string;
		denom: string;
		channels: Dict<`${bigint}:${bigint}`>;
	};
}> = G_BRANDS_CONFIG;
void G_ASSERT_BRANDS_CONFIG;

export const G_BRANDS = fodemtv(G_BRANDS_CONFIG, (g_info, s_brand) => ({
	name: g_info['name'] ?? s_brand!.replace(/_/g, ' '),
	pfp: g_info.pfp,
	decimals: g_info['decimals'] ?? 6,
	symbol: g_info.symbol,
	coingeckoId: g_info.coingeckoId || '',
	ibc: g_info['ibc'] || null,
})) as Record<keyof typeof G_BRANDS_CONFIG, Brand>;
