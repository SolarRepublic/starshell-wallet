import { G_BRANDS } from './brands';

const G_CHAINS_COSMOS = {
	'agoric-3': {
		denom: 'ubld',
		channels: {
			'secret-4': '10:51',
		},
	},
	'cosmoshub-4': {
		brand: G_BRANDS.Cosmos_Hub,
		bech32p: 'cosmos',
		coins: {
			ATOM: {
				denom: 'uatom',
				channels: {

				},
			},
		},
	},
	'secret-4': {
		brand: G_BRANDS.Secret,
		name: 'Secret Network',
		bech32p: 'secret',
		slip44s: [529, 118],
		coins: {
			SCRT: {
				denom: 'uscrt',
				redeemable: {
					wrap: {
						secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek: {},
					},
					stake: {

					},
				},
			},
		},
		ibc: {
			redeemable: {
				wrap: {
					secret19e75l25r6sa6nhdf4lggjmgpw0vmpfvsw5cnpe: {},
				},
			},
		},
	},
};
