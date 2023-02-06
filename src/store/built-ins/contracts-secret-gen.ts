import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

export const F_CONTRACTS_SECRET_GEN = (H_LOOKUP_PFP: Dict<PfpTarget>): ContractStruct[] => [
	{
		name: 'Aave',
		bech32: 'secret1yxwnyk8htvvq25x2z87yj0r5tqpev452fk6h5h',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/aave.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sAAVE',
				extra: {
					coingeckoId: 'aave',
				},
			},
		},
	},
	{
		name: 'Akash',
		bech32: 'secret168j5f78magfce5r2j4etaytyuy7ftjkh4cndqw',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/akt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sAKT',
				extra: {
					coingeckoId: 'akash-network',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Alter',
		bech32: 'secret12rcvz0umvk875kd6a803txhtlu7y0pnd73kcej',
		hash: 'D4F32C1BCA133F15F69D557BD0722DA10F45E31E5475A12900CA1E62E63E8F76',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/alter.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'ALTER',
				extra: {
					coingeckoId: 'alter',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Amber',
		bech32: 'secret1s09x2xvfd2lp2skgzm29w2xtena7s8fq98v852',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/amber.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'AMBER',
				extra: {
					coingeckoId: '',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Band Protocol',
		bech32: 'secret1p4zvqgxggrrk435nj94p6la2g4xd0rwssgzpsr',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/band.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sBAND',
				extra: {
					coingeckoId: 'band-protocol',
				},
			},
		},
	},
	{
		name: 'Binance Coin',
		bech32: 'secret1tact8rxxrvynk4pwukydnle4l0pdmj0sq9j9d5',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/bnb.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sBNB(BSC)',
				extra: {
					coingeckoId: 'binancecoin',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Binance USD (BSC)',
		bech32: 'secret1793ctg56epnzjlv7t7mug2tv3s2zylhqssyjwe',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/busd.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sBUSD(BSC)',
				extra: {
					coingeckoId: 'binance-usd',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Button',
		bech32: 'secret1yxcexylwyxlq58umhgsjgstgcg2a0ytfy4d9lt',
		hash: 'F8B27343FF08290827560A1BA358EECE600C9EA7F403B02684AD87AE7AF0F288',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/butt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 6,
				symbol: 'BUTT',
				extra: {
					coingeckoId: 'buttcoin-2',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Cardano (BSC)',
		bech32: 'secret1t6228qgqgkwhnsegk84ahljgw2cj7f9xprk9zd',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/ada.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sADA(BSC)',
				extra: {
					coingeckoId: 'cardano',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Chainlink',
		bech32: 'secret1xcrf2vvxcz8dhtgzgsd0zmzlf9g320ea2rhdjw',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/link.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sLINK',
				extra: {
					coingeckoId: 'chainlink',
				},
			},
		},
	},
	{
		name: 'Chihuahua',
		bech32: 'secret1ntvxnf5hzhzv8g87wn76ch6yswdujqlgmjh32w',
		hash: '182D7230C396FA8F548220FF88C34CB0291A00046DF9FF2686E407C3B55692E9',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/huahua.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sHUAHUA',
				extra: {
					coingeckoId: 'chihuahua-token',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Cosmos Hub',
		bech32: 'secret14mzwd0ps5q277l20ly2q3aetqe3ev4m4260gf4',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/atom.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sATOM',
				extra: {
					coingeckoId: 'cosmos',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Dai',
		bech32: 'secret1vnjck36ld45apf8u4fedxd5zy7f5l92y3w5qwq',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/dai.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sDAI',
				extra: {
					coingeckoId: 'dai',
				},
			},
		},
	},
	{
		name: 'Decentraland',
		bech32: 'secret178t2cp33hrtlthphmt9lpd25qet349mg4kcega',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/mana.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sMANA',
				extra: {
					coingeckoId: 'decentraland',
				},
			},
		},
	},
	{
		name: 'Ethereum',
		bech32: 'secret1wuzzjsdhthpvuyeeyhfq2ftsn3mvwf9rxy6ykw',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sETH',
				extra: {
					coingeckoId: 'ethereum',
				},
			},
		},
	},
	{
		name: 'Ethereum (BSC)',
		bech32: 'secret1m6a72200733a7jnm76xrznh9cpmt4kf5ql0a6t',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sETH(BSC)',
				extra: {
					coingeckoId: 'ethereum',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Evmos',
		bech32: 'secret1grg9unv2ue8cf98t50ea45prce7gcrj2n232kq',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/evmos.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 18,
				symbol: 'sEVMOS',
				extra: {
					coingeckoId: 'evmos',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Juno',
		bech32: 'secret1smmc5k24lcn4j2j8f3w0yaeafga6wmzl0qct03',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/juno.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sJUNO',
				extra: {
					coingeckoId: 'juno-network',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Kujira',
		bech32: 'secret1gaew7k9tv4hlx2f4wq4ta4utggj4ywpkjysqe8',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/kuji.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sKUJI',
				extra: {
					coingeckoId: 'kujira',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Monero',
		bech32: 'secret19ungtd2c7srftqdwgq0dspwvrw63dhu79qxv88',
		hash: '667A3DBEC9096DE530A5521A83E6090DF0956475BD4ACC8D05F382D4F8FFDD05',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/xmr.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 12,
				symbol: 'sXMR',
				extra: {
					coingeckoId: 'monero',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Ocean Protocol',
		bech32: 'secret12sjaw9wutn39cc5wqxfmkypm4n7tcerwfpvmps',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/ocean.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sOCEAN',
				extra: {
					coingeckoId: 'ocean-protocol',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Osmosis',
		bech32: 'secret1zwwealwm0pcl9cul4nt6f38dsy6vzplw8lp3qg',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/osmo.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sOSMO',
				extra: {
					coingeckoId: 'osmosis',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Polkadot (BSC)',
		bech32: 'secret1px5mtmjh072znpez4fjpmxqsv3hpevdpyu9l4v',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/dot.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sDOT(BSC)',
				extra: {
					coingeckoId: 'polkadot',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'ReserveRights',
		bech32: 'secret1vcm525c3gd9g5ggfqg7d20xcjnmcc8shh902un',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/rsr.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sRSR',
				extra: {
					coingeckoId: 'reserve-rights-token',
				},
			},
		},
	},
	{
		name: 'Secret (BSC)',
		bech32: 'secret1c7apt5mmv9ma5dpa9tmwjunhhke9de2206ufyp',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/scrt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sSCRT(BSC)',
				extra: {
					coingeckoId: 'secret',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Sentinel',
		bech32: 'secret1k8cge73c3nh32d4u0dsd5dgtmk63shtlrfscj5',
		hash: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/dvpn.png'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sDVPN',
				extra: {
					coingeckoId: 'sentinel',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Shade',
		bech32: 'secret1qfql357amn448duf5gvp9gr48sxx9tsnhupu3d',
		hash: 'FA824C4504F21FC59250DA0CDF549DD392FD862BAF2689D246A07B9E941F04A9',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/shd.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 8,
				symbol: 'SHD',
				extra: {
					coingeckoId: 'shade-protocol',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Sienna',
		bech32: 'secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4',
		hash: 'C1DC8261059FEE1DE9F1873CD1359CCD7A6BC5623772661FA3D55332EB652084',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/sienna.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'SIENNA',
				extra: {
					coingeckoId: 'sienna',
				},
			},
		},
	},
	{
		name: 'Staked SCRT Derivative (Shade)',
		bech32: 'secret1k6u0cy4feepm6pehnz804zmwakuwdapm69tuc4',
		hash: 'F6BE719B3C6FEB498D3554CA0398EB6B7E7DB262ACB33F84A8F12106DA6BBB09',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/stkd-scrt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
			],
			snip20: {
				decimals: 6,
				symbol: 'stkd-SCRT',
				extra: {
					coingeckoId: 'secret',
				},
			},
			snip24: {},
		},
	},
	{
		name: 'StakeEasy staked SCRT',
		bech32: 'secret16zfat8th6hvzhesj8f6rz3vzd7ll69ys580p2t',
		hash: '91809B72CC6A7B4A62170698630B0B0848334F0403DBA1ABA7AEC94396AF7F95',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/sescrt.png'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 6,
				symbol: 'seSCRT',
				extra: {
					coingeckoId: 'secret',
				},
			},
		},
	},
	{
		name: 'Stargaze',
		bech32: 'secret1x0dqckf2khtxyrjwhlkrx9lwwmz44k24vcv2vv',
		hash: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/stars.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [],
			snip20: {
				decimals: 6,
				symbol: 'sSTARS',
				extra: {
					coingeckoId: 'stargaze',
				},
			},
			snip21: {},
			snip24: {},
		},
	},
	{
		name: 'Tether',
		bech32: 'secret18wpjn83dayu4meu6wnn29khfkwdxs7kyrz9c8f',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 6,
				symbol: 'sUSDT',
				extra: {
					coingeckoId: 'tether',
				},
			},
		},
	},
	{
		name: 'Tether (BSC)',
		bech32: 'secret16euwqyntvsp0fp2rstmggw77w5xgz2z26cpwxj',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sUSDT(BSC)',
				extra: {
					coingeckoId: 'tether',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'THORChain',
		bech32: 'secret1el5uj9ns9sty682dem033pt50xsv5mklmsvy24',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/rune.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sRUNE',
				extra: {
					coingeckoId: 'thorchain',
				},
			},
		},
	},
	{
		name: 'Uniswap',
		bech32: 'secret1ds8850j99cf5h3hygy25f0zzs6r6s7vsgfs8te',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/uni.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sUNI',
				extra: {
					coingeckoId: 'uniswap',
				},
			},
		},
	},
	{
		name: 'USD Coin',
		bech32: 'secret1h6z05y90gwm4sqxzhz4pkyp36cna9xtp7q0urv',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 6,
				symbol: 'sUSDC',
				extra: {
					coingeckoId: 'usd-coin',
				},
			},
		},
	},
	{
		name: 'USD Coin (BSC)',
		bech32: 'secret1kf45vm4mg5004pgajuplcmkrzvsyp2qtvlklyg',
		hash: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sUSDC(BSC)',
				extra: {
					coingeckoId: 'usd-coin',
				},
			},
			snip21: {},
		},
	},
	{
		name: 'Wrapped BTC',
		bech32: 'secret1g7jfnxmxkjgqdts9wlmn238mrzxz5r92zwqv4a',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/wbtc.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 8,
				symbol: 'sWBTC',
				extra: {
					coingeckoId: 'bitcoin',
				},
			},
		},
	},
	{
		name: 'yearn.finance',
		bech32: 'secret15grq8y54tvc24j8hf8chunsdcr84fd3d30fvqv',
		hash: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
		on: 0,
		origin: 'built-in',
		pfp: H_LOOKUP_PFP['/media/token/yfi.svg'],
		chain: '/family.cosmos/chain.secret-4',
		interfaces: {
			excluded: [
				'snip21',
				'snip22',
				'snip23',
				'snip24',
			],
			snip20: {
				decimals: 18,
				symbol: 'sYFI',
				extra: {
					coingeckoId: 'yearn-finance',
				},
			},
		},
	},
];
