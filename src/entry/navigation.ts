/* eslint-disable i/order */
import {do_android_polyfill} from '#/native/android-polyfill';
import {do_webkit_polyfill} from '#/native/webkit-polyfill';
import {
	parse_params,
} from '#/share/constants';

do_android_polyfill();
do_webkit_polyfill();
/* eslint-enable */

import {initialize_mem} from '#/app/svelte';
import {ode} from '#/util/belt';
import NavigationSvelte from '##/container/Navigation.svelte';

const h_context = {};

(async() => {
	await initialize_mem(h_context);

	const h_params = parse_params();

	// create system
	new NavigationSvelte({
		target: document.body,
		props: {
			p_account: h_params.account,
			p_chain: h_params.chain,
		},
		context: new Map(ode(h_context || {})),
	});
})();
