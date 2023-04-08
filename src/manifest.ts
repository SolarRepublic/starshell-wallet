import type {Values} from './meta/belt';
import type {ContentScripts} from 'webextension-polyfill';

type ManifestV2 = chrome.runtime.ManifestV2;
type ManifestV3 = chrome.runtime.ManifestV3;

type Mv2ContentScript = Values<NonNullable<Required<ManifestV2>['content_scripts']>>;
type Mv3ContentScript = Values<NonNullable<Required<ManifestV3>['content_scripts']>>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildBrowserManifest(b_prod=false) {
	const SX_CSP_SELF = `'self'`;
	const SX_CSP_WASM_UNSAFE_EVAL = `'wasm-unsafe-eval'`;
	const SX_CSP_UNSAFE_INLINE = `'unsafe-inline'`;

	const H_CONTENT_SECURITY_POLICY = {
		'default-src': [SX_CSP_SELF],
		'script-src': [SX_CSP_SELF, SX_CSP_WASM_UNSAFE_EVAL],
		'object-src': [SX_CSP_SELF],
		'connect-src': ['https:', 'data:', 'wss:'],
		'frame-ancestors': [SX_CSP_SELF, 'https://launch.starshell.net'],
		'style-src': [SX_CSP_UNSAFE_INLINE],
		'img-src': [SX_CSP_SELF, 'blob:', 'data:', 'https://png.starshell.net', 'https://s3.amazonaws.com/keybase_processed_uploads/'],
	};

	function csp(h_merge: Record<string, string[]>={}): string {
		return Object.entries({
			...H_CONTENT_SECURITY_POLICY,
			...h_merge,
		}).reduce((a_out, [si_key, a_values]) => [
			...a_out,
			`${si_key} ${a_values.map(s => `${s}`).join(' ')}`,
		], []).join('; ');
	}

	const H_ICONS = {
		16: 'media/vendor/icon_16.png',
		19: 'media/vendor/icon_19.png',
		24: 'media/vendor/icon_24.png',
		32: 'media/vendor/icon_32.png',
		48: 'media/vendor/icon_48.png',
		64: 'media/vendor/icon_64.png',
		128: 'media/vendor/icon_128.png',
		256: 'media/vendor/icon_256.png',
	};


	const A_EXCLUDE_DEVELOPMENT = [
		'http://localhost:8128/*',
	];

	const A_MATCH_LOCALHOST = [
		'http://localhost/*',
		'http://127.0.0.1/*',
	];

	const A_MATCH_ALL = [
		'file://*/*',
		...A_MATCH_LOCALHOST,
		'https://*/*',
	];

	const A_MATCH_LAUNCH = [
		'https://launch.starshell.net/*',
	];

	const A_MATCH_LINK = [
		'https://m.s2r.sh/*',
		'https://link.starshell.net/*',
	];

	const A_MATCH_NEVER = [
		'file://__never__/*',
	];


	type ContentScriptOverrides = Partial<ContentScripts.RegisteredContentScriptOptions | {world: 'MAIN' | 'ISOLATED'}>;

	const B_ALL_FRAMES = false;

	const G_CONTENT_SCRIPT_DEFAULT = {
		...b_prod? {
			exclude_matches: A_EXCLUDE_DEVELOPMENT,
		}: {},
	};

	const G_CONTENT_SCRIPTS = {
		ics_spotter(h_overrides?: ContentScriptOverrides) {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: ['src/script/ics-spotter.ts'],
				matches: A_MATCH_ALL,
				run_at: 'document_start',
				all_frames: B_ALL_FRAMES,
				...h_overrides,
			};
		},

		mcs_relay() {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: ['src/script/mcs-relay.ts'],
				matches: A_MATCH_NEVER,
				run_at: 'document_start',
				all_frames: B_ALL_FRAMES,
			};
		},

		ics_launch(h_overrides?: ContentScriptOverrides) {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: ['src/script/ics-launch.ts'],
				matches: A_MATCH_LAUNCH,
				run_at: 'document_start',
				...h_overrides,
			};
		},

		ics_link(h_overrides?: ContentScriptOverrides) {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: ['src/script/ics-link.ts'],
				matches: A_MATCH_LINK,
				run_at: 'document_start',
				...h_overrides,
			};
		},

		ics_witness(h_overrides?: ContentScriptOverrides) {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: ['src/script/ics-witness.ts'],
				matches: A_MATCH_ALL,
				run_at: 'document_start',
				all_frames: B_ALL_FRAMES,
				...h_overrides,
			};
		},

		dynamically_importable() {
			return {
				...G_CONTENT_SCRIPT_DEFAULT,
				js: [
					'src/script/worker-argon2.ts',
					'src/script/debug.ts',
				],
				matches: A_MATCH_NEVER,
				run_at: 'document_start',
				all_frames: false,
			};
		},
		

		// ics_polyfill(h_overrides?: ContentScriptOverrides) {
		// 	return {
		// 		...G_CONTENT_SCRIPT_DEFAULT,
		// 		js: ['src/script/ics-polyfill.ts'],
		// 		matches: [],
		// 		run_at: 'document_start',
		// 		all_frames: false,
		// 		...h_overrides,
		// 	};
		// },

		// mcs_keplr(h_overrides?: ContentScriptOverrides) {
		// 	return {
		// 		js: ['src/script/mcs-keplr.ts'],
		// 		matches: A_MATCH_ALL,
		// 		run_at: 'document_start',
		// 		all_frames: true,
		// 		...h_overrides,
		// 	};
		// },

		// about_blank() {
		// 	return {
		// 		js: ['src/script/about-blank.ts'],
		// 		matches: [
		// 			'file:///:never',
		// 		],
		// 		run_at: 'document_start',
		// 		match_about_blank: true,
		// 		all_frames: true,
		// 	};
		// },
	};

	const G_MANIFEST_COMMON: Partial<chrome.runtime.ManifestBase> = {
		icons: H_ICONS,
		permissions: [
			'alarms',
			'tabs',
			'storage',
			'scripting',
			'unlimitedStorage',
			'notifications',
			'clipboardRead',
			'clipboardWrite',
			'offscreen',
		],
	};

	const A_WA_RESOURCES = [
		'src/script/mcs-relay.ts',
		'src/script/ics-witness.ts',
		'src/script/mcs-keplr.ts',
		'src/script/mcs-pwa.ts',
		'src/entry/flow.html',
		'src/entry/navigation.html',
		'src/entry/offscreen.html',

		// allow content scripts to load the word list
		'data/bip-0039-english.txt',
		'media/*',
	];

	const G_BROWSER_ACTION = {
		default_icon: H_ICONS,
		default_popup: 'src/entry/popup.html',
	};

	const GC_MANIFEST_V2: Partial<ManifestV2> = {
		...G_MANIFEST_COMMON,

		manifest_version: 2,

		browser_action: G_BROWSER_ACTION,

		permissions: [
			...G_MANIFEST_COMMON.permissions,
			'*://*/*',
		],

		web_accessible_resources: [
			...A_WA_RESOURCES,
			G_BROWSER_ACTION.default_popup,
		],

		content_scripts: [
			G_CONTENT_SCRIPTS.ics_spotter(),
			G_CONTENT_SCRIPTS.ics_launch(),
			G_CONTENT_SCRIPTS.ics_link(),
			G_CONTENT_SCRIPTS.dynamically_importable(),
		] as Mv2ContentScript[],

		background: {
			persistent: false,
			scripts: [
				'src/script/service.ts',
			],
		},

		content_security_policy: csp({
			'script-src': [
				...H_CONTENT_SECURITY_POLICY['script-src'],
				// `'unsafe-eval'`,
			],
		}),
	};

	const GC_MANIFEST_V3: Partial<ManifestV3> = {
		...G_MANIFEST_COMMON,

		manifest_version: 3,

		action: G_BROWSER_ACTION,

		// options_page: G_BROWSER_ACTION.default_popup,

		permissions: [
			...G_MANIFEST_COMMON.permissions,
			'system.display',
		],

		host_permissions: ['*://*/*'],

		web_accessible_resources: [
			{
				resources: A_WA_RESOURCES,
				matches: A_MATCH_ALL,
			},
			{
				resources: [G_BROWSER_ACTION.default_popup],
				matches: A_MATCH_LAUNCH,
			},
		],

		content_scripts: [
			G_CONTENT_SCRIPTS.ics_spotter({
				world: 'ISOLATED',
			}),
			G_CONTENT_SCRIPTS.ics_launch({
				world: 'ISOLATED',
			}),
			G_CONTENT_SCRIPTS.ics_link({
				world: 'ISOLATED',
			}),
			G_CONTENT_SCRIPTS.dynamically_importable(),
		] as Mv3ContentScript[],

		background: {
			service_worker: 'src/script/service.ts',
			type: 'module',
		},

		content_security_policy: {
			extension_pages: csp(),
		},
	};

	return {
		chrome: {
			manifest: {
				...GC_MANIFEST_V3,
				permissions: [
					...GC_MANIFEST_V3.permissions || [],
					'management',
				],
			},
		},

		firefox: {
			manifest: {
				...GC_MANIFEST_V2,
				background: GC_MANIFEST_V2.background,
				content_security_policy: csp({
					'script-src': [
						...H_CONTENT_SECURITY_POLICY['script-src'],
						// `'unsafe-eval'`,
					],
					'frame-ancestors': [
						SX_CSP_SELF,
						'https://launch.starshell.net',
					],
				}),
				permissions: [
					...GC_MANIFEST_V2.permissions || [],
					'management',
				],
				browser_specific_settings: {
					gecko: {
						id: b_prod
							? 'firefox@starshell.net'
							: 'wallet-beta@starshell.net',
					},
				},
			},
		},

		safari: {
			manifest: {
				...GC_MANIFEST_V2,
				content_security_policy: csp({
					'script-src': [
						...H_CONTENT_SECURITY_POLICY['script-src'],
						`'unsafe-eval'`,
					],
					'connect-src': [
						SX_CSP_SELF,
						...[
							'githubusercontent.com',
							'starshell.net',
						].flatMap(s => [`https://*.${s}`, `https://${s}`]),
						...[
							'raw.githubusercontent.com',
							'api.coingecko.com',
							'ping.starshell.net',
							'feegrant.starshell.net',
							'grpc-web.secret.ajax.starshell.net',
							'grpc-web.secret.brynn.starshell.net',
							'grpc-web.pulsar.apex.starshell.net',
							'faucet.starshell.net',
						].map(s => `https://${s}`),
						'wss://rpc.secret.ajax.starshell.net',
						'wss://rpc.secret.brynn.starshell.net',
						'wss://rpc.pulsar.apex.starshell.net',
						'wss:',
						'data:',
					],
				}),
				permissions: [
					...GC_MANIFEST_V2.permissions || [],
					'nativeMessaging',
				],
				// safari does not yet support dynamic script registration from `browser.scripting`
				content_scripts: [
					...GC_MANIFEST_V2.content_scripts!,
					G_CONTENT_SCRIPTS.ics_witness(),
				],

				// for the native iOS app, include the webkit content script in the build output
				web_accessible_resources: [
					...GC_MANIFEST_V2.web_accessible_resources!,
					'src/script/ics-webkit.ts',
					'src/script/ics-webkit-bg.ts',
					// 'src/script/service.ts',
				],
			},
		},
	} as const;
}
