import NavigationSvelte from '#/app/container/Navigation.svelte';
import {ode} from '#/util/belt';

const h_context = {};

// create system
new NavigationSvelte({
	target: document.body,
	props: {},
	context: new Map(ode(h_context || {})),
});
