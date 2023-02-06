
function defaultBech32Config(e, t='val', r='cons', n='pub', i='oper') {
	return {
		bech32PrefixAccAddr: e,
		bech32PrefixAccPub: e + n,
		bech32PrefixValAddr: e + t + i,
		bech32PrefixValPub: e + t + i + n,
		bech32PrefixConsAddr: e + t + r,
		bech32PrefixConsPub: e + t + r + n,
	};
}

export const A_TESTNETS = [
	{
		testnet: 1,
		rpc: 'https://grpc.testnet.secretsaturn.net',
		rpcConfig: void 0,
		rest: '',
		restConfig: void 0,
		chainId: 'pulsar-2',
		chainName: 'Secret Pulsar',
		stakeCurrency: {
			coinDenom: 'SCRT',
			coinMinimalDenom: 'uscrt',
			coinDecimals: 6,
			coinGeckoId: 'secret',
		},
		walletUrl: 'https://wallet.keplr.app/chains/secret-network',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/secret-network',
		bip44: {
			coinType: 529,
		},
		alternativeBIP44s: [
			{
				coinType: 118,
			},
		],
		bech32Config: defaultBech32Config('secret'),
		currencies: [
			{
				coinDenom: 'SCRT',
				coinMinimalDenom: 'uscrt',
				coinDecimals: 6,
				coinGeckoId: 'secret',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'SCRT',
				coinMinimalDenom: 'uscrt',
				coinDecimals: 6,
				coinGeckoId: 'secret',
			},
		],
		coinType: 529,
		gasPriceStep: {
			low: .0125,
			average: .1,
			high: .25,
		},
		features: ['secretwasm', 'ibc-go', 'ibc-transfer'],
	},
	{
		testnet: 1,
		rpc: 'https://rpc-cosmoshub.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-cosmoshub.keplr.app',
		restConfig: void 0,
		chainId: 'theta-testnet-001',
		chainName: 'Cosmos Hub Theta',
		stakeCurrency: {
			coinDenom: 'ATOM',
			coinMinimalDenom: 'uatom',
			coinDecimals: 6,
			coinGeckoId: 'cosmos',
		},
		walletUrl: 'https://wallet.keplr.app/chains/cosmos-hub',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/cosmos-hub',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('cosmos'),
		currencies: [
			{
				coinDenom: 'ATOM',
				coinMinimalDenom: 'uatom',
				coinDecimals: 6,
				coinGeckoId: 'cosmos',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'ATOM',
				coinMinimalDenom: 'uatom',
				coinDecimals: 6,
				coinGeckoId: 'cosmos',
			},
		],
		coinType: 118,
		features: ['ibc-transfer', 'ibc-go'],
	},
];

export const A_KEPLR_EMBEDDED_CHAINS = [
	...A_TESTNETS,
	{
		rpc: 'https://rpc-cosmoshub.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-cosmoshub.keplr.app',
		restConfig: void 0,
		chainId: 'cosmoshub-4',
		chainName: 'Cosmos Hub',
		stakeCurrency: {
			coinDenom: 'ATOM',
			coinMinimalDenom: 'uatom',
			coinDecimals: 6,
			coinGeckoId: 'cosmos',
		},
		walletUrl: 'https://wallet.keplr.app/chains/cosmos-hub',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/cosmos-hub',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('cosmos'),
		currencies: [
			{
				coinDenom: 'ATOM',
				coinMinimalDenom: 'uatom',
				coinDecimals: 6,
				coinGeckoId: 'cosmos',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'ATOM',
				coinMinimalDenom: 'uatom',
				coinDecimals: 6,
				coinGeckoId: 'cosmos',
			},
		],
		coinType: 118,
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-osmosis.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-osmosis.keplr.app',
		restConfig: void 0,
		chainId: 'osmosis-1',
		chainName: 'Osmosis',
		stakeCurrency: {
			coinDenom: 'OSMO',
			coinMinimalDenom: 'uosmo',
			coinDecimals: 6,
			coinGeckoId: 'osmosis',
		},
		walletUrl: 'https://app.osmosis.zone',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/osmosis',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('osmo'),
		currencies: [
			{
				coinDenom: 'OSMO',
				coinMinimalDenom: 'uosmo',
				coinDecimals: 6,
				coinGeckoId: 'osmosis',
			},
			{
				coinDenom: 'ION',
				coinMinimalDenom: 'uion',
				coinDecimals: 6,
				coinGeckoId: 'ion',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'OSMO',
				coinMinimalDenom: 'uosmo',
				coinDecimals: 6,
				coinGeckoId: 'osmosis',
			},
		],
		gasPriceStep: {
			low: 0,
			average: .025,
			high: .04,
		},
		features: ['ibc-transfer', 'ibc-go', 'cosmwasm'],
	},
	{
		rpc: 'https://rpc-secret.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-secret.keplr.app',
		restConfig: void 0,
		chainId: 'secret-4',
		chainName: 'Secret Network',
		stakeCurrency: {
			coinDenom: 'SCRT',
			coinMinimalDenom: 'uscrt',
			coinDecimals: 6,
			coinGeckoId: 'secret',
		},
		walletUrl: 'https://wallet.keplr.app/chains/secret-network',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/secret-network',
		bip44: {
			coinType: 529,
		},
		alternativeBIP44s: [
			{
				coinType: 118,
			},
		],
		bech32Config: defaultBech32Config('secret'),
		currencies: [
			{
				coinDenom: 'SCRT',
				coinMinimalDenom: 'uscrt',
				coinDecimals: 6,
				coinGeckoId: 'secret',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'SCRT',
				coinMinimalDenom: 'uscrt',
				coinDecimals: 6,
				coinGeckoId: 'secret',
			},
		],
		coinType: 529,
		gasPriceStep: {
			low: .0125,
			average: .1,
			high: .25,
		},
		features: ['secretwasm', 'ibc-go', 'ibc-transfer'],
	},
	{
		rpc: 'https://rpc-akash.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-akash.keplr.app',
		restConfig: void 0,
		chainId: 'akashnet-2',
		chainName: 'Akash',
		stakeCurrency: {
			coinDenom: 'AKT',
			coinMinimalDenom: 'uakt',
			coinDecimals: 6,
			coinGeckoId: 'akash-network',
		},
		walletUrl: 'https://wallet.keplr.app/chains/akash',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/akash',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('akash'),
		currencies: [
			{
				coinDenom: 'AKT',
				coinMinimalDenom: 'uakt',
				coinDecimals: 6,
				coinGeckoId: 'akash-network',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'AKT',
				coinMinimalDenom: 'uakt',
				coinDecimals: 6,
				coinGeckoId: 'akash-network',
			},
		],
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-crypto-org.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-crypto-org.keplr.app',
		restConfig: void 0,
		chainId: 'crypto-org-chain-mainnet-1',
		chainName: 'Crypto.org',
		stakeCurrency: {
			coinDenom: 'CRO',
			coinMinimalDenom: 'basecro',
			coinDecimals: 8,
			coinGeckoId: 'crypto-com-chain',
		},
		walletUrl: 'https://wallet.keplr.app/chains/crypto-org',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/crypto-org',
		bip44: {
			coinType: 394,
		},
		bech32Config: {
			bech32PrefixAccAddr: 'cro',
			bech32PrefixAccPub: 'cropub',
			bech32PrefixValAddr: 'crocncl',
			bech32PrefixValPub: 'crocnclpub',
			bech32PrefixConsAddr: 'crocnclcons',
			bech32PrefixConsPub: 'crocnclconspub',
		},
		currencies: [
			{
				coinDenom: 'CRO',
				coinMinimalDenom: 'basecro',
				coinDecimals: 8,
				coinGeckoId: 'crypto-com-chain',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'CRO',
				coinMinimalDenom: 'basecro',
				coinDecimals: 8,
				coinGeckoId: 'crypto-com-chain',
			},
		],
		gasPriceStep: {
			low: .025,
			average: .03,
			high: .04,
		},
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-iov.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-iov.keplr.app',
		restConfig: void 0,
		chainId: 'iov-mainnet-ibc',
		chainName: 'Starname',
		stakeCurrency: {
			coinDenom: 'IOV',
			coinMinimalDenom: 'uiov',
			coinDecimals: 6,
			coinGeckoId: 'starname',
		},
		walletUrl: 'https://wallet.keplr.app/chains/starname',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/starname',
		bip44: {
			coinType: 234,
		},
		bech32Config: defaultBech32Config('star'),
		currencies: [
			{
				coinDenom: 'IOV',
				coinMinimalDenom: 'uiov',
				coinDecimals: 6,
				coinGeckoId: 'starname',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IOV',
				coinMinimalDenom: 'uiov',
				coinDecimals: 6,
				coinGeckoId: 'starname',
			},
		],
		gasPriceStep: {
			low: 1,
			average: 2,
			high: 3,
		},
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-sifchain.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-sifchain.keplr.app',
		restConfig: void 0,
		chainId: 'sifchain-1',
		chainName: 'Sifchain',
		stakeCurrency: {
			coinDenom: 'ROWAN',
			coinMinimalDenom: 'rowan',
			coinDecimals: 18,
			coinGeckoId: 'sifchain',
		},
		walletUrl: 'https://wallet.keplr.app/chains/sifchain',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/sifchain',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('sif'),
		currencies: [
			{
				coinDenom: 'ROWAN',
				coinMinimalDenom: 'rowan',
				coinDecimals: 18,
				coinGeckoId: 'sifchain',
			},
			{
				coinDenom: 'Tether USDT',
				coinMinimalDenom: 'cusdt',
				coinDecimals: 6,
			},
			{
				coinDenom: 'Ethereum',
				coinMinimalDenom: 'ceth',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Basic Attention Token',
				coinMinimalDenom: 'cbat',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Aragon',
				coinMinimalDenom: 'cant',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Bancor Network Token',
				coinMinimalDenom: 'cbnt',
				coinDecimals: 18,
			},
			{
				coinDenom: '0x',
				coinMinimalDenom: 'czrx',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Chainlink',
				coinMinimalDenom: 'clink',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Decentraland',
				coinMinimalDenom: 'cmana',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Loopring',
				coinMinimalDenom: 'clrc',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Enjin Coin',
				coinMinimalDenom: 'cenj',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Synthetix Network Token',
				coinMinimalDenom: 'csnx',
				coinDecimals: 18,
			},
			{
				coinDenom: 'TrueUSD',
				coinMinimalDenom: 'ctusd',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Ocean Protocol',
				coinMinimalDenom: 'cocean',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Fantom',
				coinMinimalDenom: 'cftm',
				coinDecimals: 18,
			},
			{
				coinDenom: 'sUSD',
				coinMinimalDenom: 'csusd',
				coinDecimals: 18,
			},
			{
				coinDenom: 'USD Coin',
				coinMinimalDenom: 'cusdc',
				coinDecimals: 6,
			},
			{
				coinDenom: 'Crypto com Coin',
				coinMinimalDenom: 'ccro',
				coinDecimals: 8,
			},
			{
				coinDenom: 'Wrapped Bitcoin',
				coinMinimalDenom: 'cwbtc',
				coinDecimals: 8,
			},
			{
				coinDenom: 'Swipe',
				coinMinimalDenom: 'csxp',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Band Protocol',
				coinMinimalDenom: 'cband',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Dai Stablecoin',
				coinMinimalDenom: 'cdai',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Compound',
				coinMinimalDenom: 'ccomp',
				coinDecimals: 18,
			},
			{
				coinDenom: 'UMA',
				coinMinimalDenom: 'cuma',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Balancer',
				coinMinimalDenom: 'cbal',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Yearn finance',
				coinMinimalDenom: 'cyfi',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Serum',
				coinMinimalDenom: 'csrm',
				coinDecimals: 6,
			},
			{
				coinDenom: 'Cream',
				coinMinimalDenom: 'ccream',
				coinDecimals: 18,
			},
			{
				coinDenom: 'SAND',
				coinMinimalDenom: 'csand',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Sushi',
				coinMinimalDenom: 'csushi',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Empty Set Dollar',
				coinMinimalDenom: 'cesd',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Uniswap',
				coinMinimalDenom: 'cuni',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Aave',
				coinMinimalDenom: 'caave',
				coinDecimals: 18,
			},
			{
				coinDenom: 'BarnBridge',
				coinMinimalDenom: 'cbond',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Wrapped Filecoin',
				coinMinimalDenom: 'cwfil',
				coinDecimals: 18,
			},
			{
				coinDenom: 'The Graph',
				coinMinimalDenom: 'cgrt',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Tokenlon',
				coinMinimalDenom: 'clon',
				coinDecimals: 18,
			},
			{
				coinDenom: '1inch',
				coinMinimalDenom: 'c1inch',
				coinDecimals: 18,
			},
			{
				coinDenom: 'THORChain ERC20',
				coinMinimalDenom: 'crune',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Secret ERC20',
				coinMinimalDenom: 'cwscrt',
				coinDecimals: 6,
			},
			{
				coinDenom: 'IoTeX',
				coinMinimalDenom: 'ciotx',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Reef Finance',
				coinMinimalDenom: 'creef',
				coinDecimals: 18,
			},
			{
				coinDenom: 'COCOS BCX',
				coinMinimalDenom: 'ccocos',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Keep Network',
				coinMinimalDenom: 'ckeep',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Origin Protocol',
				coinMinimalDenom: 'cogn',
				coinDecimals: 18,
			},
			{
				coinDenom: 'ODAOfi',
				coinMinimalDenom: 'cdaofi',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Linear',
				coinMinimalDenom: 'clina',
				coinDecimals: 18,
			},
			{
				coinDenom: '12Ships',
				coinMinimalDenom: 'ctshp',
				coinDecimals: 18,
			},
			{
				coinDenom: 'B.20',
				coinMinimalDenom: 'cb20',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Akropolis',
				coinMinimalDenom: 'cakro',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Rio Fuel Token',
				coinMinimalDenom: 'crfuel',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Rally',
				coinMinimalDenom: 'crly',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Convergence',
				coinMinimalDenom: 'cconv',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Render Token',
				coinMinimalDenom: 'crndr',
				coinDecimals: 18,
			},
			{
				coinDenom: 'PAID Network',
				coinMinimalDenom: 'cpaid',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Tidal',
				coinMinimalDenom: 'ctidal',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Axie Infinity',
				coinMinimalDenom: 'caxs',
				coinDecimals: 18,
			},
			{
				coinDenom: 'BitSong',
				coinMinimalDenom: 'cbtsg',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Cosmostarter',
				coinMinimalDenom: 'ccsms',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Dfyn Network',
				coinMinimalDenom: 'cdfyn',
				coinDecimals: 18,
			},
			{
				coinDenom: 'DinoSwap',
				coinMinimalDenom: 'cdino',
				coinDecimals: 18,
			},
			{
				coinDenom: 'DinoX',
				coinMinimalDenom: 'cdnxc',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Don-key',
				coinMinimalDenom: 'cdon',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Ethernity Chain',
				coinMinimalDenom: 'cern',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Frax',
				coinMinimalDenom: 'cfrax',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Frax Share',
				coinMinimalDenom: 'cfxs',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Knit Finance',
				coinMinimalDenom: 'ckft',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Lido DAO',
				coinMinimalDenom: 'cldo',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Doge Killer',
				coinMinimalDenom: 'cleash',
				coinDecimals: 18,
			},
			{
				coinDenom: 'LGCY Network',
				coinMinimalDenom: 'clgcy',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Polygon',
				coinMinimalDenom: 'cmatic',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Metis Token',
				coinMinimalDenom: 'cmetis',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Oh! Finance',
				coinMinimalDenom: 'coh',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Polkastarter',
				coinMinimalDenom: 'cpols',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Marlin',
				coinMinimalDenom: 'cpond',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Quickswap',
				coinMinimalDenom: 'cquick',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Railgun',
				coinMinimalDenom: 'crail',
				coinDecimals: 18,
			},
			{
				coinDenom: 'StaFi rATOM',
				coinMinimalDenom: 'cratom',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Saito',
				coinMinimalDenom: 'csaito',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Shiba Inu',
				coinMinimalDenom: 'cshib',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Tokemak',
				coinMinimalDenom: 'ctoke',
				coinDecimals: 18,
			},
			{
				coinDenom: 'UFO Gaming',
				coinMinimalDenom: 'cufo',
				coinDecimals: 18,
			},
			{
				coinDenom: 'UST (ERC-20)',
				coinMinimalDenom: 'cust',
				coinDecimals: 18,
			},
			{
				coinDenom: '0chain',
				coinMinimalDenom: 'czcn',
				coinDecimals: 18,
			},
			{
				coinDenom: 'Unizen',
				coinMinimalDenom: 'czcx',
				coinDecimals: 18,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'ROWAN',
				coinMinimalDenom: 'rowan',
				coinDecimals: 18,
				coinGeckoId: 'sifchain',
			},
		],
		gasPriceStep: {
			low: 1e12,
			average: 15e11,
			high: 2e12,
		},
		features: [],
	},
	{
		rpc: 'https://rpc-certik.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-certik.keplr.app',
		restConfig: void 0,
		chainId: 'shentu-2.2',
		chainName: 'Certik',
		stakeCurrency: {
			coinDenom: 'CTK',
			coinMinimalDenom: 'uctk',
			coinDecimals: 6,
			coinGeckoId: 'certik',
		},
		walletUrl: 'https://wallet.keplr.app/chains/certik',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/certik',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('certik'),
		currencies: [
			{
				coinDenom: 'CTK',
				coinMinimalDenom: 'uctk',
				coinDecimals: 6,
				coinGeckoId: 'certik',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'CTK',
				coinMinimalDenom: 'uctk',
				coinDecimals: 6,
				coinGeckoId: 'certik',
			},
		],
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-iris.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-iris.keplr.app',
		restConfig: void 0,
		chainId: 'irishub-1',
		chainName: 'IRISnet',
		stakeCurrency: {
			coinDenom: 'IRIS',
			coinMinimalDenom: 'uiris',
			coinDecimals: 6,
			coinGeckoId: 'iris-network',
		},
		walletUrl: 'https://wallet.keplr.app/chains/irisnet',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/irisnet',
		bip44: {
			coinType: 118,
		},
		alternativeBIP44s: [
			{
				coinType: 566,
			},
		],
		bech32Config: {
			bech32PrefixAccAddr: 'iaa',
			bech32PrefixAccPub: 'iap',
			bech32PrefixValAddr: 'iva',
			bech32PrefixValPub: 'ivp',
			bech32PrefixConsAddr: 'ica',
			bech32PrefixConsPub: 'icp',
		},
		currencies: [
			{
				coinDenom: 'IRIS',
				coinMinimalDenom: 'uiris',
				coinDecimals: 6,
				coinGeckoId: 'iris-network',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IRIS',
				coinMinimalDenom: 'uiris',
				coinDecimals: 6,
				coinGeckoId: 'iris-network',
			},
		],
		gasPriceStep: {
			low: .2,
			average: .3,
			high: .4,
		},
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-regen.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-regen.keplr.app',
		restConfig: void 0,
		chainId: 'regen-1',
		chainName: 'Regen',
		stakeCurrency: {
			coinDenom: 'REGEN',
			coinMinimalDenom: 'uregen',
			coinDecimals: 6,
			coinGeckoId: 'regen',
		},
		walletUrl: 'https://wallet.keplr.app/chains/regen',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/regen',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('regen'),
		currencies: [
			{
				coinDenom: 'REGEN',
				coinMinimalDenom: 'uregen',
				coinDecimals: 6,
				coinGeckoId: 'regen',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'REGEN',
				coinMinimalDenom: 'uregen',
				coinDecimals: 6,
				coinGeckoId: 'regen',
			},
		],
		gasPriceStep: {
			low: .015,
			average: .025,
			high: .04,
		},
		features: ['ibc-go', 'ibc-transfer'],
	},
	{
		rpc: 'https://rpc-persistence.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-persistence.keplr.app',
		restConfig: void 0,
		chainId: 'core-1',
		chainName: 'Persistence',
		stakeCurrency: {
			coinDenom: 'XPRT',
			coinMinimalDenom: 'uxprt',
			coinDecimals: 6,
			coinGeckoId: 'persistence',
		},
		walletUrl: 'https://wallet.keplr.app/chains/persistence',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/persistence',
		bip44: {
			coinType: 750,
		},
		bech32Config: defaultBech32Config('persistence'),
		currencies: [
			{
				coinDenom: 'XPRT',
				coinMinimalDenom: 'uxprt',
				coinDecimals: 6,
				coinGeckoId: 'persistence',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'XPRT',
				coinMinimalDenom: 'uxprt',
				coinDecimals: 6,
				coinGeckoId: 'persistence',
			},
		],
		gasPriceStep: {
			low: 0,
			average: .025,
			high: .04,
		},
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-sentinel.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-sentinel.keplr.app',
		restConfig: void 0,
		chainId: 'sentinelhub-2',
		chainName: 'Sentinel',
		stakeCurrency: {
			coinDenom: 'DVPN',
			coinMinimalDenom: 'udvpn',
			coinDecimals: 6,
			coinGeckoId: 'sentinel',
		},
		walletUrl: 'https://wallet.keplr.app/chains/sentinel',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/sentinel',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('sent'),
		currencies: [
			{
				coinDenom: 'DVPN',
				coinMinimalDenom: 'udvpn',
				coinDecimals: 6,
				coinGeckoId: 'sentinel',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'DVPN',
				coinMinimalDenom: 'udvpn',
				coinDecimals: 6,
				coinGeckoId: 'sentinel',
			},
		],
		gasPriceStep: {
			low: .1,
			average: .25,
			high: .4,
		},
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-kava.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-kava.keplr.app',
		restConfig: void 0,
		chainId: 'kava_2222-10',
		chainName: 'Kava',
		stakeCurrency: {
			coinDenom: 'KAVA',
			coinMinimalDenom: 'ukava',
			coinDecimals: 6,
			coinGeckoId: 'kava',
		},
		walletUrl: 'https://wallet.keplr.app/chains/kava',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/kava',
		bip44: {
			coinType: 459,
		},
		alternativeBIP44s: [
			{
				coinType: 118,
			},
		],
		bech32Config: defaultBech32Config('kava'),
		currencies: [
			{
				coinDenom: 'KAVA',
				coinMinimalDenom: 'ukava',
				coinDecimals: 6,
				coinGeckoId: 'kava',
			},
			{
				coinDenom: 'SWP',
				coinMinimalDenom: 'swp',
				coinDecimals: 6,
				coinGeckoId: 'kava-swap',
			},
			{
				coinDenom: 'USDX',
				coinMinimalDenom: 'usdx',
				coinDecimals: 6,
				coinGeckoId: 'usdx',
			},
			{
				coinDenom: 'HARD',
				coinMinimalDenom: 'hard',
				coinDecimals: 6,
			},
			{
				coinDenom: 'BNB',
				coinMinimalDenom: 'bnb',
				coinDecimals: 8,
			},
			{
				coinDenom: 'BTCB',
				coinMinimalDenom: 'btcb',
				coinDecimals: 8,
			},
			{
				coinDenom: 'BUSD',
				coinMinimalDenom: 'busd',
				coinDecimals: 8,
			},
			{
				coinDenom: 'XRPB',
				coinMinimalDenom: 'xrpb',
				coinDecimals: 8,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'KAVA',
				coinMinimalDenom: 'ukava',
				coinDecimals: 6,
				coinGeckoId: 'kava',
			},
		],
		gasPriceStep: {
			low: .05,
			average: .1,
			high: .25,
		},
		coinType: 459,
		beta: !0,
	},
	{
		rpc: 'https://rpc-impacthub.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-impacthub.keplr.app',
		restConfig: void 0,
		chainId: 'impacthub-3',
		chainName: 'ixo',
		stakeCurrency: {
			coinDenom: 'IXO',
			coinMinimalDenom: 'uixo',
			coinDecimals: 6,
		},
		walletUrl: 'https://wallet.keplr.app/chains/ixo',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/ixo',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('ixo'),
		currencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IXO',
				coinMinimalDenom: 'uixo',
				coinDecimals: 6,
			},
		],
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-emoney.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-emoney.keplr.app',
		restConfig: void 0,
		chainId: 'emoney-3',
		chainName: 'e-Money',
		stakeCurrency: {
			coinDenom: 'NGM',
			coinMinimalDenom: 'ungm',
			coinDecimals: 6,
			coinGeckoId: 'e-money',
		},
		walletUrl: 'https://wallet.keplr.app/chains/e-money',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/e-money',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('emoney'),
		currencies: [
			{
				coinDenom: 'NGM',
				coinMinimalDenom: 'ungm',
				coinDecimals: 6,
				coinGeckoId: 'e-money',
			},
			{
				coinDenom: 'EEUR',
				coinMinimalDenom: 'eeur',
				coinDecimals: 6,
				coinGeckoId: 'e-money-eur',
			},
			{
				coinDenom: 'EDKK',
				coinMinimalDenom: 'edkk',
				coinDecimals: 6,
			},
			{
				coinDenom: 'ESEK',
				coinMinimalDenom: 'esek',
				coinDecimals: 6,
			},
			{
				coinDenom: 'ENOK',
				coinMinimalDenom: 'enok',
				coinDecimals: 6,
			},
			{
				coinDenom: 'ECHF',
				coinMinimalDenom: 'echf',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'NGM',
				coinMinimalDenom: 'ungm',
				coinDecimals: 6,
				coinGeckoId: 'e-money',
			},
		],
		gasPriceStep: {
			low: 1,
			average: 1,
			high: 1,
		},
		features: ['ibc-transfer'],
	},
	{
		rpc: 'https://rpc-agoric.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-agoric.keplr.app',
		restConfig: void 0,
		chainId: 'agoric-3',
		chainName: 'Agoric',
		stakeCurrency: {
			coinDenom: 'BLD',
			coinMinimalDenom: 'ubld',
			coinDecimals: 6,
		},
		walletUrl: 'https://wallet.keplr.app/chains/agoric',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/agoric',
		bip44: {
			coinType: 564,
		},
		bech32Config: defaultBech32Config('agoric'),
		currencies: [
			{
				coinDenom: 'BLD',
				coinMinimalDenom: 'ubld',
				coinDecimals: 6,
			},
			{
				coinDenom: 'IST',
				coinMinimalDenom: 'uist',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'IST',
				coinMinimalDenom: 'uist',
				coinDecimals: 6,
			},
		],
		gasPriceStep: {
			low: 0,
			average: 0,
			high: 0,
		},
		features: ['ibc-go'],
	},
	{
		rpc: 'https://rpc-cyber.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-cyber.keplr.app',
		restConfig: void 0,
		chainId: 'bostrom',
		chainName: 'Bostrom',
		stakeCurrency: {
			coinDenom: 'BOOT',
			coinMinimalDenom: 'boot',
			coinDecimals: 0,
		},
		walletUrl: 'https://wallet.keplr.app/chains/bostrom',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/bostrom',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('bostrom'),
		currencies: [
			{
				coinDenom: 'BOOT',
				coinMinimalDenom: 'boot',
				coinDecimals: 0,
			},
			{
				coinDenom: 'H',
				coinMinimalDenom: 'hydrogen',
				coinDecimals: 0,
			},
			{
				coinDenom: 'V',
				coinMinimalDenom: 'millivolt',
				coinDecimals: 3,
			},
			{
				coinDenom: 'A',
				coinMinimalDenom: 'milliampere',
				coinDecimals: 3,
			},
			{
				coinDenom: 'TOCYB',
				coinMinimalDenom: 'tocyb',
				coinDecimals: 0,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'BOOT',
				coinMinimalDenom: 'boot',
				coinDecimals: 0,
			},
		],
		gasPriceStep: {
			low: 0,
			average: 0,
			high: .01,
		},
		features: ['ibc-transfer', 'cosmwasm', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-juno.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-juno.keplr.app',
		restConfig: void 0,
		chainId: 'juno-1',
		chainName: 'Juno',
		stakeCurrency: {
			coinDenom: 'JUNO',
			coinMinimalDenom: 'ujuno',
			coinDecimals: 6,
			coinGeckoId: 'juno-network',
		},
		walletUrl: 'https://wallet.keplr.app/chains/juno',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/juno',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('juno'),
		currencies: [
			{
				coinDenom: 'JUNO',
				coinMinimalDenom: 'ujuno',
				coinDecimals: 6,
				coinGeckoId: 'juno-network',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'JUNO',
				coinMinimalDenom: 'ujuno',
				coinDecimals: 6,
				coinGeckoId: 'juno-network',
			},
		],
		gasPriceStep: {
			low: .001,
			average: .0025,
			high: .004,
		},
		features: ['cosmwasm', 'ibc-transfer', 'ibc-go', 'wasmd_0.24+'],
	},
	{
		rpc: 'https://rpc-stargaze.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-stargaze.keplr.app',
		restConfig: void 0,
		chainId: 'stargaze-1',
		chainName: 'Stargaze',
		stakeCurrency: {
			coinDenom: 'STARS',
			coinMinimalDenom: 'ustars',
			coinDecimals: 6,
			coinGeckoId: 'stargaze',
		},
		walletUrl: 'https://wallet.keplr.app/chains/stargaze',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/stargaze',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('stars'),
		currencies: [
			{
				coinDenom: 'STARS',
				coinMinimalDenom: 'ustars',
				coinDecimals: 6,
				coinGeckoId: 'stargaze',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'STARS',
				coinMinimalDenom: 'ustars',
				coinDecimals: 6,
				coinGeckoId: 'stargaze',
			},
		],
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-axelar.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-axelar.keplr.app',
		restConfig: void 0,
		chainId: 'axelar-dojo-1',
		chainName: 'Axelar',
		stakeCurrency: {
			coinDenom: 'AXL',
			coinMinimalDenom: 'uaxl',
			coinDecimals: 6,
		},
		walletUrl: 'https://wallet.keplr.app/chains/axelar',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/axelar',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('axelar'),
		currencies: [
			{
				coinDenom: 'AXL',
				coinMinimalDenom: 'uaxl',
				coinDecimals: 6,
			},
			{
				coinDenom: 'WETH',
				coinMinimalDenom: 'weth-wei',
				coinDecimals: 18,
				coinGeckoId: 'weth',
			},
			{
				coinDenom: 'USDC',
				coinMinimalDenom: 'uusdc',
				coinDecimals: 6,
				coinGeckoId: 'usd-coin',
			},
			{
				coinDenom: 'FRAX',
				coinMinimalDenom: 'frax-wei',
				coinDecimals: 18,
				coinGeckoId: 'frax',
			},
			{
				coinDenom: 'DAI',
				coinMinimalDenom: 'dai-wei',
				coinDecimals: 18,
				coinGeckoId: 'dai',
			},
			{
				coinDenom: 'USDT',
				coinMinimalDenom: 'uusdt',
				coinDecimals: 6,
				coinGeckoId: 'tether',
			},
			{
				coinDenom: 'WBTC',
				coinMinimalDenom: 'wbtc-satoshi',
				coinDecimals: 8,
				coinGeckoId: 'wrapped-bitcoin',
			},
			{
				coinDenom: 'LINK',
				coinMinimalDenom: 'link-wei',
				coinDecimals: 18,
				coinGeckoId: 'chainlink',
			},
			{
				coinDenom: 'AAVE',
				coinMinimalDenom: 'aave-wei',
				coinDecimals: 18,
				coinGeckoId: 'aave',
			},
			{
				coinDenom: 'APE',
				coinMinimalDenom: 'ape-wei',
				coinDecimals: 18,
				coinGeckoId: 'apecoin',
			},
			{
				coinDenom: 'AXS',
				coinMinimalDenom: 'axs-wei',
				coinDecimals: 18,
				coinGeckoId: 'axie-infinity',
			},
			{
				coinDenom: 'MKR',
				coinMinimalDenom: 'mkr-wei',
				coinDecimals: 18,
				coinGeckoId: 'maker',
			},
			{
				coinDenom: 'RAI',
				coinMinimalDenom: 'rai-wei',
				coinDecimals: 18,
				coinGeckoId: 'rai',
			},
			{
				coinDenom: 'SHIB',
				coinMinimalDenom: 'shib-wei',
				coinDecimals: 18,
				coinGeckoId: 'shiba-inu',
			},
			{
				coinDenom: 'stETH',
				coinMinimalDenom: 'steth-wei',
				coinDecimals: 18,
				coinGeckoId: 'staked-ether',
			},
			{
				coinDenom: 'UNI',
				coinMinimalDenom: 'uni-wei',
				coinDecimals: 18,
				coinGeckoId: 'uniswap',
			},
			{
				coinDenom: 'XCN',
				coinMinimalDenom: 'xcn-wei',
				coinDecimals: 18,
				coinGeckoId: 'chain-2',
			},
			{
				coinDenom: 'WGLMR',
				coinMinimalDenom: 'wglmr-wei',
				coinDecimals: 18,
				coinGeckoId: 'wrapped-moonbeam',
			},
			{
				coinDenom: 'DOT',
				coinMinimalDenom: 'dot-planck',
				coinDecimals: 10,
				coinGeckoId: 'polkadot',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'AXL',
				coinMinimalDenom: 'uaxl',
				coinDecimals: 6,
			},
		],
		gasPriceStep: {
			low: .05,
			average: .075,
			high: .1,
		},
		features: ['ibc-transfer', 'ibc-go', 'axelar-evm-bridge'],
	},
	{
		rpc: 'https://rpc-sommelier.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-sommelier.keplr.app',
		restConfig: void 0,
		chainId: 'sommelier-3',
		chainName: 'Sommelier',
		stakeCurrency: {
			coinDenom: 'SOMM',
			coinMinimalDenom: 'usomm',
			coinDecimals: 6,
			coinGeckoId: 'sommelier',
		},
		walletUrl: 'https://wallet.keplr.app/chains/sommelier',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/sommelier',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('somm'),
		currencies: [
			{
				coinDenom: 'SOMM',
				coinMinimalDenom: 'usomm',
				coinDecimals: 6,
				coinGeckoId: 'sommelier',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'SOMM',
				coinMinimalDenom: 'usomm',
				coinDecimals: 6,
				coinGeckoId: 'sommelier',
			},
		],
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-umee.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-umee.keplr.app',
		restConfig: void 0,
		chainId: 'umee-1',
		chainName: 'Umee',
		stakeCurrency: {
			coinDenom: 'UMEE',
			coinMinimalDenom: 'uumee',
			coinDecimals: 6,
		},
		walletUrl: 'https://wallet.keplr.app/chains/umee',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/umee',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('umee'),
		currencies: [
			{
				coinDenom: 'UMEE',
				coinMinimalDenom: 'uumee',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'UMEE',
				coinMinimalDenom: 'uumee',
				coinDecimals: 6,
			},
		],
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-gravity-bridge.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-gravity-bridge.keplr.app',
		restConfig: void 0,
		chainId: 'gravity-bridge-3',
		chainName: 'Gravity Bridge',
		stakeCurrency: {
			coinDenom: 'GRAV',
			coinMinimalDenom: 'ugraviton',
			coinDecimals: 6,
		},
		walletUrl: 'https://wallet.keplr.app/chains/gravity-bridge',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/gravity-bridge',
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('gravity'),
		currencies: [
			{
				coinDenom: 'GRAV',
				coinMinimalDenom: 'ugraviton',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'GRAV',
				coinMinimalDenom: 'ugraviton',
				coinDecimals: 6,
			},
		],
		features: ['ibc-transfer', 'ibc-go'],
	},
	{
		rpc: 'https://rpc-tgrade.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-tgrade.keplr.app',
		restConfig: void 0,
		chainId: 'tgrade-mainnet-1',
		chainName: 'Tgrade',
		stakeCurrency: {
			coinDenom: 'TGD',
			coinMinimalDenom: 'utgd',
			coinDecimals: 6,
		},
		bip44: {
			coinType: 118,
		},
		bech32Config: defaultBech32Config('tgrade'),
		currencies: [
			{
				coinDenom: 'TGD',
				coinMinimalDenom: 'utgd',
				coinDecimals: 6,
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'TGD',
				coinMinimalDenom: 'utgd',
				coinDecimals: 6,
			},
		],
		gasPriceStep: {
			low: .05,
			average: .05,
			high: .075,
		},
		features: ['cosmwasm', 'ibc-transfer', 'ibc-go', 'wasmd_0.24+'],
	},
	{
		rpc: 'https://rpc-evmos.keplr.app',
		rpcConfig: void 0,
		rest: 'https://lcd-evmos.keplr.app',
		restConfig: void 0,
		chainId: 'evmos_9001-2',
		chainName: 'Evmos',
		stakeCurrency: {
			coinDenom: 'EVMOS',
			coinMinimalDenom: 'aevmos',
			coinDecimals: 18,
			coinGeckoId: 'evmos',
		},
		walletUrl: 'https://wallet.keplr.app/chains/evmos',
		walletUrlForStaking: 'https://wallet.keplr.app/chains/evmos',
		bip44: {
			coinType: 60,
		},
		bech32Config: defaultBech32Config('evmos'),
		currencies: [
			{
				coinDenom: 'EVMOS',
				coinMinimalDenom: 'aevmos',
				coinDecimals: 18,
				coinGeckoId: 'evmos',
			},
		],
		feeCurrencies: [
			{
				coinDenom: 'EVMOS',
				coinMinimalDenom: 'aevmos',
				coinDecimals: 18,
				coinGeckoId: 'evmos',
			},
		],
		gasPriceStep: {
			low: 25e9,
			average: 25e9,
			high: 4e10,
		},
		features: ['ibc-transfer', 'ibc-go', 'eth-address-gen', 'eth-key-sign'],
		beta: !0,
	},
];