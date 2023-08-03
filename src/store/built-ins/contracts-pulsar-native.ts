import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';

export const F_CONTRACTS_PULSAR_NATIVE = (H_LOOKUP_PFP: Dict): ContractStruct[] => [
	{
		name: 'Pulsar Secret Secret',
		bech32: 'secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg',
		pfp: H_LOOKUP_PFP['/media/token/sscrt.svg'],
		snip20: {
			symbol: 'sSCRT',
			extra: {
				coingeckoId: 'secret',
			},
		},
		hash: '9587D60B8E6B078ACE12014CEEEE089530B9FABCD76535D93666A6C127AD8813',
	},
	{
		name: 'Pulsar USD Coin',
		bech32: 'secret1rzz7q3us7zksy3la7hjup33gvtqxyfljpaya2r',
		pfp: H_LOOKUP_PFP['/media/token/usdc.svg'],
		snip20: {
			symbol: 'pUSDC',
			extra: {
				coingeckoId: 'usd-coin',
			},
		},
	},
	{
		name: 'Pulsar Ethereum',
		bech32: 'secret1zkqumk5l9efwlfprxl0zw8fqwxz0d0pvd020pr',
		pfp: H_LOOKUP_PFP['/media/token/eth.svg'],
		snip20: {
			symbol: 'pETH',
			extra: {
				coingeckoId: 'ethereum',
			},
		},
	},
	{
		name: 'Pulsar Tether',
		bech32: 'secret1na2lzyu27zwdkkd5xcdcgnrxawj5pzvm07fa0p',
		pfp: H_LOOKUP_PFP['/media/token/usdt.svg'],
		snip20: {
			symbol: 'pUSDT',
			extra: {
				coingeckoId: 'tether',
			},
		},
	},
	{
		name: 'Pulsar Binance',
		bech32: 'secret1cf8pvts87kp424larws7vqfgd3kpd8vm84e3v4',
		pfp: H_LOOKUP_PFP['/media/token/bnb.svg'],
		snip20: {
			symbol: 'pBNB',
			extra: {
				coingeckoId: 'binancecoin',
			},
		},
	},
	{
		name: 'Pulsar Binance USD',
		bech32: 'secret18kfwq9d2k9xa7f6e40wutd6a85sjuecwk78hv8',
		pfp: H_LOOKUP_PFP['/media/token/busd.svg'],
		snip20: {
			symbol: 'pBUSD',
			extra: {
				coingeckoId: 'binance-usd',
			},
		},
	},
	{
		name: 'Pulsar Cosmos Hub',
		bech32: 'secret1phueq2prrrc6l0q5ye55csqr7zzrl99dvxqx7a',
		pfp: H_LOOKUP_PFP['/media/token/atom.svg'],
		snip20: {
			symbol: 'pATOM',
			extra: {
				coingeckoId: 'cosmos',
			},
		},
	},
	{
		name: 'Pulsar Dogecoin',
		bech32: 'secret1wsldxtnsrptfj447p0l32eepvdhap4wl6uh6hq',
		pfp: H_LOOKUP_PFP['/media/token/doge.svg'],
		snip20: {
			symbol: 'pDOGE',
			extra: {
				coingeckoId: 'dogecoin',
			},
		},
	},
	{
		name: 'Pulsar DAI',
		bech32: 'secret1gc9wg4xz97muz6clxflgt69js94g26wqm8eqqh',
		pfp: H_LOOKUP_PFP['/media/token/dai.svg'],
		snip20: {
			symbol: 'pDAI',
			extra: {
				coingeckoId: 'dai',
			},
		},
	},
	{
		name: 'Pulsar Wrapped Bitcoin',
		bech32: 'secret1h0ehf7py5r0ejatvnrpwlnykl5qe9q997u5p4t',
		pfp: H_LOOKUP_PFP['/media/token/wbtc.svg'],
		snip20: {
			symbol: 'pWBTC',
			extra: {
				coingeckoId: 'bitcoin',
			},
		},
	},
	{
		name: 'Pulsar Monero',
		bech32: 'secret1um29h7me55nmwxswkp7p55rzm56vjkzsvrdlg7',
		pfp: H_LOOKUP_PFP['/media/token/xmr.svg'],
		snip20: {
			symbol: 'pXMR',
			extra: {
				coingeckoId: 'monero',
			},
		},
	},
].map(g => ({
	name: g.name,
	bech32: g.bech32,
	// codeId: 12610
	hash: g.hash || '43EDA3A25DFAB766C6AD622828B4B780D5D31A77A344163358FFFCEAA136CFCA',
	on: 0,
	pfp: g.pfp,
	chain: '/family.cosmos/chain.pulsar-2',
	origin: 'built-in',
	interfaces: {
		snip20: {
			decimals: 6,
			...g.snip20,
		},
		snip21: {},
		snip22: {},
		snip23: {},
		snip24: {},
	},
}) as ContractStruct);
