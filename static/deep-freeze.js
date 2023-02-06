if('undefined' === typeof globalThis['__starshell_deeply_frozen']) {
	// cache unfreezable items to save time
	const AS_UNFREEZABLE = new Set();

	// these exemptions are just to clean up the error log
	const AS_EXEMPT = new Set([
		`globalThis["WritableStreamDefaultWriter"]["prototype"]["closed"]`,
		`globalThis["WritableStreamDefaultWriter"]["prototype"]["ready"]`,
		`globalThis["ReadableStreamDefaultReader"]["prototype"]["closed"]`,
		`globalThis["ReadableStreamBYOBReader"]["prototype"]["closed"]`,
		`globalThis["PromiseRejectionEvent"]["prototype"]["promise"]`,
		`globalThis["NavigationTransition"]["prototype"]["finished"]`,
		`globalThis["FontFace"]["prototype"]["loaded"]`,
		`globalThis["BeforeInstallPromptEvent"]["prototype"]["userChoice"]`,
		`globalThis["Animation"]["prototype"]["finished"]`,
		`globalThis["Animation"]["prototype"]["ready"]`,
		`globalThis["MediaKeySession"]["prototype"]["closed"]`,
		`globalThis["ServiceWorkerContainer"]["prototype"]["ready"]`,
		`globalThis["WebTransport"]["prototype"]["ready"]`,
		`globalThis["WebTransport"]["prototype"]["closed"]`,
		`globalThis["ImageTrackList"]["prototype"]["ready"]`,
		`globalThis["ImageDecoder"]["prototype"]["completed"]`,
		`globalThis["PresentationReceiver"]["prototype"]["connectionList"]`,
		`globalThis["BackgroundFetchRecord"]["prototype"]["responseReady"]`,
		`globalThis["FetchEvent"]["prototype"]["preloadResponse"]`,
		`globalThis["FetchEvent"]["prototype"]["handled"]`,
	]);

	// these are expect to be unfreezable
	const AS_EXPECT_UNFREEZABLE = new Set([
		`globalThis`,
		`globalThis["localStorage"]`,
		`globalThis["sessionStorage"]`,
		`globalThis["document"]["location"]["ancestorOrigins"]`,
	]);

	// track how many things were successfully altered
	let c_items_frozen = 0;

	// make a thing immutable
	function immutate(z_thing, si_property) {
		const g_descriptor = Object.getOwnPropertyDescriptor(z_thing, si_property);

		if(!g_descriptor) return;

		g_descriptor.configurable = false;

		if(!('set' in g_descriptor || 'get' in g_descriptor)) g_descriptor.writable = false;

		Object.defineProperty(z_thing, si_property, g_descriptor);
	}

	function deep_freeze(z_thing, s_parent) {
		// cache typeof thing
		const s_type = typeof z_thing;

		// not a property-able thing; skip
		if('object' !== s_type && 'function' !== s_type) return;

		// nothing, already frozen, or unfreezablel skip
		if(!z_thing || Object.isFrozen(z_thing) || AS_UNFREEZABLE.has(z_thing)) return;

		// the globalThis object
		if(globalThis === z_thing) {
			// not at the root traversal; block
			if(s_parent !== 'globalThis') return;

			// make it immutable
			immutate(z_thing, 'globalThis');
		}
		// everything else
		else {
			try {
				// attempt to freeze the intrinsic object/function
				Object.freeze(z_thing);

				// no error thrown but freezing had no effect
				if(!Object.isFrozen(z_thing)) {
					throw new SecurityError('No effect');
				}
				// freeze succeeded; increment counter
				else {
					c_items_frozen += 1;
				}
			}
			// failed to freeze thing
			catch(e_freeze) {
				// do not try again
				AS_UNFREEZABLE.add(z_thing);

				// was not expecting freeze to fail on this thing
				if(!AS_EXPECT_UNFREEZABLE.has(s_parent)) {
					console.warn(`Freezing had no effect on ${s_parent}`);
				}
			}
		}

		// obtain all own keys on this thing
		const a_keys = Reflect.ownKeys(z_thing);

		// each own property
		for(const si_property of a_keys) {
			const s_path = s_parent+('string' === typeof si_property? `["${si_property}"]`: `[@@${si_property.toString()}]`);

			// get descriptor
			const g_descriptor = Reflect.getOwnPropertyDescriptor(z_thing, si_property);

			// has simple value; recurse
			if('value' in g_descriptor) {
				deep_freeze(g_descriptor.value, s_path);
			}
			// anything else
			else {
				// attempt to make it immutable
				try {
					immutate(z_thing, si_property);
				}
				catch(e_define) {
					console.warn(`Failed to make property ${s_path} non-configurable/non-writable`);
				}

				// exemption
				if(AS_EXEMPT.has(s_path)) {
					// native function
					if('function' === typeof g_descriptor.get && g_descriptor.get.toString().includes('[native code]')) {
						// console.warn(`Skipping ${s_path} getter since it is exempt`);
						continue;
					}
				}

				// access its getter's return value
				let z_value;
				try {
					z_value = g_descriptor.get.apply(z_thing);
				}
				catch(e_get) {
					// console.warn(`Cannot access ${s_path}`);
					continue;
				}

				deep_freeze(z_value, s_path);
			}
		}
	}

	// freeze everything
	deep_freeze(globalThis, 'globalThis');

	// log
	console.debug(`Completed deep_freeze of ${c_items_frozen} items`);

	// free pointers
	AS_UNFREEZABLE.clear();

	// tests
	{
		class SecurityError extends Error {
			constructor(s_msg) {
				super(`Security test failure: ${s_msg}`);
			}
		}

		// should not be writable
		{
			try {
				Object.defineProperty = () => 'hacked';
			}
			catch(e_write) {}

			const z_test = Object.defineProperty({}, 'test', {
				value: null,
			});
			if('hacked' === z_test) {
				throw new SecurityError(`Object.defineProperty is still writable`);
			}
		}

		// should not be configurable
		CONFIGURABLE_TEST:
		{
			try {
				Object.defineProperty(Object, 'defineProperty', {
					...Object.getOwnPropertyDescriptor(Object, 'defineProperty'),
					configurable: true,
				});
			}
			catch(e_define) {
				break CONFIGURABLE_TEST;
			}

			throw new SecurityError(`Object.defineProperty is still configurable`);
		}

		// globalThis should be extensible
		{
			try {
				globalThis['__starshell_deeply_frozen'] = 1;

				// write had no effect
				if(1 !== globalThis['__starshell_deeply_frozen']) throw new Error();
			}
			catch(e_write) {
				throw new SecurityError(`Unable to extend globalThis`);
			}
		}

		// globalThis itself should not be writable
		{
			const w_dummy = {};
			try {
				globalThis.globalThis = w_dummy;
			}
			catch(e_write) {}

			if(w_dummy === globalThis) {
				throw new SecurityError(`globalThis is overwritable`);
			}
		}
	}
}
