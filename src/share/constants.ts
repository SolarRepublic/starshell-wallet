import type {BrowserAction} from 'webextension-polyfill';

import type {Dict} from '#/meta/belt';
import type {StoreKey} from '#/meta/store';

import UAParser from 'ua-parser-js';

import {sha256_sync_insecure, text_to_buffer} from '#/util/data';


export const B_IS_BACKGROUND = 'clients' in globalThis && 'function' === typeof globalThis['Clients'] && globalThis['clients'] instanceof globalThis['Clients'];
export const B_IS_SERVICE_WORKER = 'function' === typeof globalThis['ServiceWorkerGlobalScope'] && globalThis instanceof globalThis['ServiceWorkerGlobalScope'];

export const SI_VERSION = __SI_VERSION;
export const SI_ENGINE = __SI_ENGINE;

export function parse_params<w_values extends string|string[]=string|string[]>(sx_params=location.search.slice(1)): Dict<w_values> {
	const h_params = {};

	// firefox-android gets polyfilled with a broken entries iterator for some reason...
	new URLSearchParams(sx_params.replace(/^[?#]?/, '')).forEach((s_value, si_param) => {
		if(si_param in h_params) {
			if(Array.isArray(h_params[si_param])) {
				h_params[si_param].push(s_value);
			}
			else {
				h_params[si_param] = [h_params[si_param], s_value];
			}
		}
		else {
			h_params[si_param] = s_value;
		}
	});

	return h_params;
}

// get URL params
export const H_PARAMS = parse_params();

export const G_USERAGENT = new UAParser().getResult();

// parse major version
export const N_BROWSER_VERSION_MAJOR = (() => {
	const m_version = /^(\d+)(?:\.|$)/.exec(G_USERAGENT.browser.version || '');
	if(m_version) {
		return +m_version[1];
	}

	return 0;
})();

/**
 * Indicates that chrome/browser web extension gloal is available
 */
export const B_WEBEXT = 'undefined' !== typeof chrome;

/**
 * Indicates the device type is mobile
 */
export const B_MOBILE = 'mobile' === G_USERAGENT.device.type;

/**
 * Indicates the browser is WebKit
 */
export const B_WEBKIT = 'WebKit' === G_USERAGENT.browser.name;
export const B_SAFARI_MOBILE = 'Mobile Safari' === G_USERAGENT.browser.name;
export const B_SAFARI_ANY = G_USERAGENT.browser.name?.includes('Safari') || B_WEBKIT;
export const B_IPHONE_IOS = 'iPhone' === G_USERAGENT.device.model && 'iOS' === G_USERAGENT.os.name;
export const B_FIREFOX_ANDROID = 'Firefox' === G_USERAGENT.browser.name && 'Android' === G_USERAGENT.os.name;
export const B_CHROMIUM_ANDROID = 'Chrome' === G_USERAGENT.browser.name && 'Android' === G_USERAGENT.os.name;
export const B_CHROME_SESSION_CAPABLE = 'Chrome' === G_USERAGENT.browser.name && (N_BROWSER_VERSION_MAJOR >= 108);


export const B_LOCALHOST = 'object' === typeof location && 'localhost' === location.hostname;
const H_ENV = import.meta.env;
export const B_DEVELOPMENT = 'development' === H_ENV?.MODE;
export const B_RELEASE_BETA = 'beta' === H_ENV?.MODE;

export const N_FIREFOX_ANDROID_BETA_VERSION = 104;
export const N_FIREFOX_ANDROID_NIGHTLY_ABOVE = N_FIREFOX_ANDROID_BETA_VERSION;

interface WebExtParams {
	/**
	 * Identifies the containing browser viewport mode
	 *  - _(undefined)_: the native popover
	 *  - popout: an independently positionable singleton desktop window
	 *  - pwa: installed PWA (on android firefox)
	 *  - tab: `{vendor}-extension://` browser tab
	 */
	within?: 'popout' | 'pwa' | 'tab' | 'webview';
}

export const B_WITHIN_IFRAME = 'object' === typeof window && globalThis === window && window.top !== window;

// set to true if the window is within a web extension popover
export const B_WITHIN_WEBEXT_POPOVER = !('within' in H_PARAMS) || 'popover' === H_PARAMS.within;

// set to true if the window is within a pwa
export const B_WITHIN_PWA = B_WITHIN_IFRAME && 'pwa' === H_PARAMS.within;

export const B_WITHIN_WEBVIEW = 'webview' === H_PARAMS.within;


// web ext API mode
export const B_WEBEXT_ACTION = B_WEBEXT && 'function' === typeof chrome.action?.openPopup;
export const B_WEBEXT_BROWSER_ACTION = B_WEBEXT && 'function' === typeof (chrome.browserAction as BrowserAction.Static)?.openPopup;

/**
 * Indicates the app is operating as the native iOS app
 */
export const B_IOS_NATIVE = !B_WEBEXT && B_WEBKIT && B_WITHIN_WEBVIEW;

/**
 * Indicates the app is operating as the web extension on iOS
 */
 export const B_IOS_WEBEXT = B_WEBEXT && B_IPHONE_IOS;

 
// firefox android toolbar is 56px high
export const N_PX_FIREFOX_TOOLBAR = 56;


export const XT_SECONDS = 1e3;
export const XT_MINUTES = 60 * XT_SECONDS;
export const XT_HOURS = 60 * XT_MINUTES;
export const XT_DAYS = 24 * XT_HOURS;

// default popup dimensions are limited to a maximum set by chrome
export const N_PX_WIDTH_POPUP = 360;
export const N_PX_HEIGHT_POPUP = 600;

// popout dimensions can be slightly larger for flows
export const N_PX_WIDTH_POPOUT = 390;
export const N_PX_HEIGHT_POPOUT = 690;

// maximum data icon size in characters
export const NL_DATA_ICON_MAX = 2 * 1024 * 1024;  // approximately 2 MiB

// square dimensions at which to render icon
export const N_PX_DIM_ICON = 256;

// maximum byte length of a memo's input
export const NB_MAX_MEMO = 188;

// maximum byte length of a serialized message to accept from a web page
export const NB_MAX_MESSAGE = 2 * 1024 * 1024;  // 2 MiB maximum

// localhost pattern
export const R_DOMAIN_LOCALHOST = /^(localhost|127.0.0.1)(:\d+)?$/;

// ip address pattern
export const R_DOMAIN_IP = /^\d+(?:.\d+){3}(:\d+)?$/;

export const RT_UINT = /^(0|[1-9][0-9]*)$/;

// export const RT_IRI = /^[a-z](?:[-a-z0-9+.])*:(?:\/\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!$&'()*+,;=:])*@)?(?:\[(?:(?:(?:[0-9a-f]{1,4}:){6}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|::(?:[0-9a-f]{1,4}:){5}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3})|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|v[0-9a-f]+\.[-a-z0-9\._~!\$&'\(\)\*\+,;=:]+)\]|(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])(?:\.(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])){3}|(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=])*)(?::[0-9]*)?(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*|\/(?:(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*)?|(?:(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))+)(?:\/(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@]))*)*|(?!(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])))(?:\?(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])|[\x{E000}-\x{F8FF}\x{F0000}-\x{FFFFD}\x{100000}-\x{10FFFD}\/\?])*)?(?:\#(?:(?:%[0-9a-f][0-9a-f]|[-a-z0-9\._~\x{A0}-\x{D7FF}\x{F900}-\x{FDCF}\x{FDF0}-\x{FFEF}\x{10000}-\x{1FFFD}\x{20000}-\x{2FFFD}\x{30000}-\x{3FFFD}\x{40000}-\x{4FFFD}\x{50000}-\x{5FFFD}\x{60000}-\x{6FFFD}\x{70000}-\x{7FFFD}\x{80000}-\x{8FFFD}\x{90000}-\x{9FFFD}\x{A0000}-\x{AFFFD}\x{B0000}-\x{BFFFD}\x{C0000}-\x{CFFFD}\x{D0000}-\x{DFFFD}\x{E1000}-\x{EFFFD}!\$&'\(\)\*\+,;=:@])|[\/\?])*)?$/i;
export const RT_URI_LIKELY = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/;

/**
 * BIP-44 parsing regex. {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki BIP-44 specification}
 * 
 * Capture groups:
 *  1. Coin type
 *  2. Account
 *  3. Change
 *  4. AddressIndex
 */
export const R_BIP_44 = /^m\/44'\/([0-9]+)'\/([0-9]+)'\/([0-9]+)\/([0-9]+)$/;

/** 
 * Bech32 parsing regex. {@link https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki BIP-173 specification}
 * 
 * Capture groups:
 *  1. HRP
 *  2. separator
 *  3. data
 *  4. checksum
 */
export const R_BECH32 = /^(.{0,32})(1)([02-9ac-hj-np-z]{1,84}?)(.{6})$/;


/**
 * CAIP-2 chain_namespace
 */
export const RT_CAIP_2_NAMESPACE = /^[-a-z0-9]{3,8}$/;


/**
 * CAIP-2 chain_reference
 */
export const RT_CAIP_2_REFERENCE = /^[-a-zA-Z0-9]{1,32}$/;


/**
 * CAIP-2 parsing regex. {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md CAIP-2 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 */
export const R_CAIP_2 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32})$/;


/**
 * CAIP-10: {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-10.md CAIP-10 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 *  3. caip10 account_address
 */
export const R_CAIP_10 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32}):([a-zA-Z0-9]{1,64})/;


/**
 * CAIP-19 {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-19.md CAIP-19 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 *  3. caip19 asset_namespace
 *  4. caip19 asset_reference
 */
export const R_CAIP_19 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32})\/([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,64})$/;

export const R_FAULTY_CAIP_19 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32}):([-a-z0-9]{3,8})\/([-a-zA-Z0-9]{1,64})$/;


// chain id pattern w/ versioning (cosmos standard pending) <https://github.com/cosmos/cosmos-sdk/issues/5363>
export const R_CHAIN_ID_VERSION = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)-([1-9][0-9]{0,44})$/;

// chain name pattern
export const R_CHAIN_NAME = /^[\p{L}\p{S}](\p{Zs}?[\p{L}\p{N}\p{S}._:/-])+$/u;

// contract name pattern (same as chain name but with extra special characters allowed and different length limits)
export const R_CONTRACT_NAME = /^[\p{L}\p{S}](\p{Zs}?[\p{L}\p{N}\p{S}!@#$%^&*()-=_+[\]{}|;':",./<>?]){3,33}$/u;

/**
 * The token symbol pattern is the most complex of all the expressions. It is designed to encourage concise and consistent
 * naming conventions to make symbols simple and predictable to the end user, while also allowing certain edge cases for
 * developers.
 * 
 * The approximate grammar for this pattern:
 * 
 * SYMBOL: opening subsequent{0,2}
 * opening: lowercase-letter{0,3} plain-symbol{1,12}
 * plain-symbol: uppercase-letter | numeric-character
 * subsequent: (symbol | punctuation | separator) supplemental
 * supplemental: lowercase-letter{0,3} (plain-symbol | "(" | ")" | "[" | "]"){1,12}
 */
export const R_TOKEN_SYMBOL = /^([\p{Ll}]{0,3}[\p{Lu}\p{N}]{1,12})([\p{S}\p{P}\p{Z}]{1,2}[\p{Ll}]{0,3}[\p{Lu}\p{N}()[\]]{1,12}){0,2}$/u;

/**
 * Data image URL for acceptable formats from the web
 */
export const R_DATA_IMAGE_URL_WEB = /^data:image\/(png|webp);base64,(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/;

/**
 * Data image URL for acceptable formats internally (i.e., in trusted contexts)
 */
export const R_DATA_IMAGE_URL_ANY = /^data:image\/(png|webp|jpeg|svg\+xml);base64,(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/;

export const R_SCRT_COMPUTE_ERROR = /;\s*message index: (\d+):\s*encrypted:\s*([A-Za-z\d+/=]+):\s*([\w-.]+) contract failed/;

export const R_SCRT_QUERY_ERROR = /encrypted:\s*([A-Za-z\d+/=]+):\s*([\w-.]+) contract failed/;

// public suffix list
export const P_PUBLIC_SUFFIX_LIST = 'https://raw.githubusercontent.com/publicsuffix/list/master/public_suffix_list.dat';

// global decrees
export const P_STARSHELL_DECREES = 'https://raw.githubusercontent.com/SolarRepublic/wallet-decrees/main/global.json';

// defaults repo
export const P_STARSHELL_DEFAULTS = 'https://raw.githubusercontent.com/SolarRepublic/wallet-defaults-registry/main/global.json';

// dapps repo
export const P_STARSHELL_DAPPS = 'https://raw.githubusercontent.com/SolarRepublic/wallet-apps-registry/main/global.json';

// transfer amount string regex
export const R_TRANSFER_AMOUNT = /^(\d+)(.+)/;

// size of pagination limit for synchronization queries
export const XG_SYNCHRONIZE_PAGINATION_LIMIT = 16n;


// cache dummy values to estimate time to completion
export const ATU8_DUMMY_PHRASE = text_to_buffer('32-character-long-dummy-password');
export const ATU8_DUMMY_VECTOR = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));

// minimum password length
export const NL_PASSPHRASE_MINIMUM = 8;

// maximum password length
export const NL_PASSPHRASE_MAXIMUM = 1024;

export const NL_PIN_MINIMUM = 4;

export const NL_PIN_MAXIMUM = 10;

// sha256("starshell")
export const ATU8_SHA256_STARSHELL = sha256_sync_insecure(text_to_buffer('starshell'));

// sha512("starshell")
export const ATU8_SHA512_STARSHELL = sha256_sync_insecure(text_to_buffer('starshell'));


export const XT_INTERVAL_HEARTBEAT = 200;


export const XG_64_BIT_MAX = (2n ** 64n) - 1n;

export const X_SIMULATION_GAS_MULTIPLIER = 1.1;

export const XT_TIMEOUT_APP_PERMISSIONS = 5 * XT_MINUTES;
export const XT_TIMEOUT_SERVICE_REQUEST = 5 * XT_MINUTES;

export const XT_TIMEOUT_DEFALUT_NOTIFICATION = 5.5 * XT_SECONDS;

// default chain namepsaces
export const A_CHAIN_NAMESPACES = [
	'cosmos',
];

// default chain categories
export const A_CHAIN_CATEGORIES = [
	'mainnet',
	'testnet',
];


export const SI_STORE_SECRETS: StoreKey<'secrets'> = 'secrets';
export const SI_STORE_APPS: StoreKey<'apps'> = 'apps';
export const SI_STORE_APP_POLICIES: StoreKey<'app_policies'> = 'app_policies';
export const SI_STORE_AGENTS: StoreKey<'agents'> = 'agents';
export const SI_STORE_CONTRACTS: StoreKey<'contracts'> = 'contracts';
export const SI_STORE_SETTINGS: StoreKey<'settings'> = 'settings';
export const SI_STORE_ACCOUNTS: StoreKey<'accounts'> = 'accounts';
export const SI_STORE_QUERY_CACHE: StoreKey<'query_cache'> = 'query_cache';
export const SI_STORE_TAGS: StoreKey<'tags'> = 'tags';
export const SI_STORE_MEDIA: StoreKey<'media'> = 'media';
export const SI_STORE_PFPS: StoreKey<'pfps'> = 'pfps';
export const SI_STORE_CHAINS: StoreKey<'chains'> = 'chains';
export const SI_STORE_PROVIDERS: StoreKey<'providers'> = 'providers';
export const SI_STORE_ENTITIES: StoreKey<'entities'> = 'entities';
export const SI_STORE_EVENTS: StoreKey<'events'> = 'events';
export const SI_STORE_INCIDENTS: StoreKey<'incidents'> = 'incidents';
export const SI_STORE_HISTORIES: StoreKey<'histories'> = 'histories';
export const SI_STORE_WEB_RESOURCES: StoreKey<'web_resources'> = 'web_resources';
export const SI_STORE_WEB_APIS: StoreKey<'web_apis'> = 'web_apis';

export {A_KEPLR_EMBEDDED_CHAINS, A_TESTNETS} from './keplr-exports';

export const R_TX_ERR_ACC_SEQUENCE = /account sequence/;

export const SI_EXTENSION_ID_KEPLR = 'dmkamcknogkgcdfhhbddcghachkejeap';

export const A_COURTESY_ACCOUNTS = [
	'secret13220hzfrxxd6zrdl5qm78xm4aacvyvlskx0jnn',
];


export enum ConnectionHealth {
	UNKNOWN = 0,
	LOADING = 1,
	CONNECTING = 2,
	CONNECTED = 3,
	DELINQUENT = 4,
	DISCONNECTED = 5,
}
