/* eslint-disable i/order */
import {do_webkit_polyfill} from '#/script/webkit-polyfill';
import {
	B_IOS_NATIVE,
} from '#/share/constants';
/* eslint-enable */

if(B_IOS_NATIVE) {
	do_webkit_polyfill();
}

import {initialize_mem} from '#/app/svelte';
import {ode} from '#/util/belt';
import NavigationSvelte from '##/container/Navigation.svelte';

const h_context = {};

(async() => {
	await initialize_mem(h_context);

	// create system
	new NavigationSvelte({
		target: document.body,
		props: {},
		context: new Map(ode(h_context || {})),
	});
})();
