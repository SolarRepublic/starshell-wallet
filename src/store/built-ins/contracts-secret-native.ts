import type {Dict} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';

export const F_CONTRACTS_SECRET_NATIVE = (H_LOOKUP_PFP: Dict): ContractStruct[] => [
	{
		name: 'Secret Secret',
		bech32: 'secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek',
		hash: 'AF74387E276BE8874F07BEC3A87023EE49B0E7EBE08178C49D0A49C3C98ED60E',
		pfp: H_LOOKUP_PFP['/media/token/sscrt.svg'],
		snip20: {
			symbol: 'sSCRT',
			extra: {
				coingeckoId: 'secret',
			},
		},
	},
].map(g => ({
	name: g.name,
	bech32: g.bech32,
	on: 0,
	pfp: g.pfp,
	chain: '/family.cosmos/chain.secret-4',
	origin: 'built-in',
	interfaces: {
		excluded: ['snip21', 'snip22', 'snip23', 'snip24'],
		snip20: {
			decimals: g['decimals'] || 6,
			...g.snip20,
		},
	},
	hash: g.hash,
}) as ContractStruct);
