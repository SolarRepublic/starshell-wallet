/* eslint-disable i/order */
import {do_webkit_polyfill} from '#/script/webkit-polyfill';
import {
	B_IOS_NATIVE,
} from '#/share/constants';
/* eslint-enable */

if(B_IOS_NATIVE) {
	do_webkit_polyfill();
}

import NavigationSvelte from '#/app/container/Navigation.svelte';
import {ode} from '#/util/belt';

const h_context = {};

// create system
new NavigationSvelte({
	target: document.body,
	props: {},
	context: new Map(ode(h_context || {})),
});
