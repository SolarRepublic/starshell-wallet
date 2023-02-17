if('undefined' === typeof globalThis['__starshell_deeply_frozen']) {
	const B_WEBEXT_GLOBAL_BROWSER = 'undefined' !== typeof globalThis['browser'];

	// recursively touches all sub-properties of an object to force the browser to access it
	function access(z_thing, as_blocking=new Set()) {
		// prevent infinite recursion
		if(!z_thing || as_blocking.has(z_thing)) return;

		// cache typeof thing
		const s_type = typeof z_thing;

		// not a property-able thing; skip
		if('object' !== s_type && 'function' !== s_type) return;

		// each property
		for(const si_property of Reflect.ownKeys(z_thing)) {
			access(z_thing[si_property], new Set([...as_blocking, z_thing]));
		}
	}

	// access all `browser` sub-properties
	if(B_WEBEXT_GLOBAL_BROWSER) {
		access(globalThis['browser']);
	}

	// access all `chrome` sub-properties
	access(globalThis['chrome']);

	// cache unfreezable items to save time
	const AS_UNFREEZABLE = new Set();

	// these exemptions are just to clean up the error log
	const AS_EXEMPT = new Set([
		`globalThis["Animation"]["prototype"]["finished"]`,
		`globalThis["Animation"]["prototype"]["ready"]`,
		`globalThis["BackgroundFetchRecord"]["prototype"]["responseReady"]`,
		`globalThis["BeforeInstallPromptEvent"]["prototype"]["userChoice"]`,
		`globalThis["FetchEvent"]["prototype"]["handled"]`,
		`globalThis["FetchEvent"]["prototype"]["preloadResponse"]`,
		`globalThis["FontFace"]["prototype"]["loaded"]`,
		`globalThis["FontFaceSet"]["prototype"]["ready"]`,
		`globalThis["ImageDecoder"]["prototype"]["completed"]`,
		`globalThis["ImageTrackList"]["prototype"]["ready"]`,
		`globalThis["MediaKeySession"]["prototype"]["closed"]`,
		`globalThis["NavigationTransition"]["prototype"]["finished"]`,
		`globalThis["PresentationReceiver"]["prototype"]["connectionList"]`,
		`globalThis["PromiseRejectionEvent"]["prototype"]["promise"]`,
		`globalThis["ReadableStreamBYOBReader"]["prototype"]["closed"]`,
		`globalThis["ReadableStreamDefaultReader"]["prototype"]["closed"]`,
		`globalThis["RTCPeerConnection"]["prototype"]["peerIdentity"]`,
		`globalThis["ServiceWorkerContainer"]["prototype"]["ready"]`,
		`globalThis["WebTransport"]["prototype"]["closed"]`,
		`globalThis["WebTransport"]["prototype"]["ready"]`,
		`globalThis["WritableStreamDefaultWriter"]["prototype"]["closed"]`,
		`globalThis["WritableStreamDefaultWriter"]["prototype"]["ready"]`,
	]);

	// unfreezable globals that should be protected
	const A_GLOBAL_SHIELD = [
		...AS_UNFREEZABLE,
		...B_WEBEXT_GLOBAL_BROWSER? ['browser']: [],
		'chrome',
		'localStorage',
		'sessionStorage',
	];

	// these are expected to be unfreezable
	const AS_EXPECT_UNFREEZABLE = new Set([
		`globalThis`,
		...A_GLOBAL_SHIELD.map(s => `globalThis["${s}"]`),
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

	function deep_freeze(z_thing, s_parent, as_blocking=new Set()) {
		// block infinite recursion
		if(as_blocking.has(z_thing)) return;

		// cache typeof thing
		const s_type = typeof z_thing;

		// not a property-able thing; skip
		if('object' !== s_type && 'function' !== s_type) return;

		// nothing, already frozen
		if(!z_thing) return;

		// flag for special case
		let b_is_global_this = false;

		// the globalThis object
		if(globalThis === z_thing) {
			// not at the root traversal; block
			if(s_parent !== 'globalThis') return;

			// make it immutable
			immutate(z_thing, 'globalThis');

			// mark
			b_is_global_this = true;
		}

		// block this before recursing
		as_blocking = new Set([...as_blocking, z_thing]);

		// obtain all own keys on this thing
		const a_keys = Reflect.ownKeys(z_thing);

		// each own property; freeze properties before object since firefox will sometimes replace the reference
		for(const si_property of a_keys) {
			const s_path = s_parent+('string' === typeof si_property? `["${si_property}"]`: `[@@${si_property.toString()}]`);

			// get descriptor
			const g_descriptor = Reflect.getOwnPropertyDescriptor(z_thing, si_property);

			// skip undefined
			if(!g_descriptor) continue;

			// has simple value; recurse
			if('value' in g_descriptor) {
				deep_freeze(g_descriptor.value, s_path, as_blocking);
			}
			// anything else
			else {
				// attempt to make it immutable
				try {
					immutate(z_thing, si_property, as_blocking);
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

				deep_freeze(z_value, s_path, as_blocking);
			}
		}

		// globalThis; done
		if(b_is_global_this) return;

		// nothing, already frozen, or unfreezable skip
		if(Object.isFrozen(z_thing) || AS_UNFREEZABLE.has(z_thing)) return;

		// everything else
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

	// shield the unfreezable globals
	{
		const h_shield = {};
		for(const si_global of A_GLOBAL_SHIELD) {
			const w_shielded = globalThis[si_global];
			Object.defineProperty(h_shield, si_global, {
				get() {
					return w_shielded;
				},
			});
		}

		Object.freeze(h_shield);

		Object.defineProperty(globalThis, 'globalShield', {
			get() {
				return h_shield;
			},
		});
	}

	// freeze everything (excluding any pointers that match unfreezable)
	deep_freeze(globalThis, 'globalThis', AS_UNFREEZABLE);

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

		function test_writability(w_object, si_property, s_debug=si_property) {
			try {
				Object.defineProperty(w_object, si_property, {value:'hacked'});
			}
			catch(e_write) {}

			if('hacked' === w_object[si_property]) {
				throw new SecurityError(`${s_debug} is overwritable`);
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

			test_writability(globalThis, 'globalThis');
		}

		// `globalShield` global
		test_writability(globalThis, 'globalShield');

		// `browser` global
		if(B_WEBEXT_GLOBAL_BROWSER) {
			// `globalShield.browser` should be accessible from shield
			if(browser !== globalShield['browser']) {
				throw new Error(`Failed to adopt 'browser' global into shield`);
			}

			// `globalShield.browser` should not be writable
			test_writability(globalShield, 'browser');

			// `browser.runtime` should not be writable
			test_writability(globalShield['browser'], 'runtime');
		}
		// `chrome` global
		else if('undefined' !== typeof globalThis['chrome']) {
			// `globalShield.chrome` should not be writable
			test_writability(globalShield, 'chrome');

			// `chrome.runtime` should not be writable
			test_writability(globalShield['chrome'], 'runtime', 'chrome.runtime');
		}

		// `localStorage` global
		if('undefined' !== typeof globalThis['localStorage']) {
			// `localStorage` should not be writable
			test_writability(globalThis, 'localStorage');

			// `localStorage.getItem` should not be writable
			test_writability(localStorage, 'getItem', 'localStorage.getItem');
		}

		// `sessionStorage` global
		if('undefined' !== typeof globalThis['sessionStorage']) {
			// `sessionStorage` should not be writable
			test_writability(globalThis, 'sessionStorage');

			// `sessionStorage.getItem` should not be writable
			test_writability(sessionStorage, 'getItem', 'sessionStorage.getItem');
		}
	}
}
