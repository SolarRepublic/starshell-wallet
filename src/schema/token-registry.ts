import type { TokenSpecKey } from '#/meta/token';

type TokenEntry = {
	extends?: TokenSpecKey;
	attributes: {
		fungible: boolean;
	};
};

export const TokenRegistry: Record<TokenSpecKey, TokenEntry> = {
	cw20: {
		attributes: {
			fungible: false,
		},
	},

	snip20: {
		attributes: {
			fungible: true,
		},
	},

	snip21: {
		extends: 'snip20',
		attributes: {
			fungible: true,
		},
	},

	snip22: {
		extends: 'snip20',
		attributes: {
			fungible: true,
		},
	},

	snip23: {
		extends: 'snip20',
		attributes: {
			fungible: true,
		},
	},

	snip24: {
		extends: 'snip20',
		attributes: {
			fungible: true,
		},
	},

	snip721: {
		attributes: {
			fungible: false,
		},
	},

	snip722: {
		extends: 'snip721',
		attributes: {
			fungible: false,
		},
	},

	snip1155: {
		attributes: {
			fungible: false,
		},
	},
};
