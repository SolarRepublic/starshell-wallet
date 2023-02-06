// import the current package.json file
import G_PACKAGE_JSON from './package.json';

const h_package = {
	devDependencies: {
		// only used by proprietary `inline_require` to bundle dependencies
		"@rollup/plugin-commonjs": "^22.0.0",
		"@rollup/plugin-node-resolve": "^13.3.0",
		"@rollup/plugin-typescript": "^8.3.2",
		"rollup": "^2.73.0",
		"acorn-walk": "^8.2.0",
		"@types/estree": "^0.0.51",

		// content script dependencies
		"crypto-js": "^4.1.1",

		// svelte build tooling
		"@tsconfig/svelte": "^3.0.0",
		"svelte": "^3.48.0",
		"svelte-check": "^2.7.0",
		"svelte-preprocess": "^4.10.6",

		// vite build tooling
		"vite": "^2.9.9",
		"tslib": "^2.4.0",
		"typescript": "^4.6.4",
		"@sveltejs/vite-plugin-svelte": "^1.0.0-next.44",

		// web extension tooling
		"@solar-republic/vite-plugin-web-extension": "^1.0.2",
		"@types/chrome": "^0.0.185",
		"@types/webextension-polyfill": "^0.8.3",
		"web-ext": "^6.8.0",

		// runtime dependencies
		"webextension-polyfill": "^0.9.0",


		// @keplr-wallet/provider dependency mimics
		"deepmerge": "^4.2.2",
		"long": "^4.0.0",
	},
};


