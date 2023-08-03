<script lang="ts">

	import { public_storage_get } from "#/extension/public-storage";
	import { do_webkit_polyfill } from "#/native/webkit-polyfill";
	import { B_ANDROID_NATIVE, B_IOS_NATIVE } from "#/share/constants";
    import { uuid_v4 } from '#/util/data';


	do_webkit_polyfill();

	let a_output: string[] = [];

	async function test_base() {
		try {
			const g_base = await public_storage_get('base');

			a_output.push(JSON.stringify(g_base));
		}
		catch(e_send) {
			a_output.push(e_send.stack || e_send.message);
		}

		a_output = a_output;
	}

	async function test_storage() {
		try {
			const g_get = await chrome.storage.local.get(null);

			for(const si_each in g_get) {
				a_output.push(`${si_each}: ${JSON.stringify(g_get[si_each])}`);
			}
		}
		catch(e_send) {
			a_output.push(e_send.stack || e_send.message);
		}

		a_output = a_output;
	}


	async function test_native() {
		try {
			const g_get = await chrome.runtime.sendNativeMessage('starshell', {
				type: 'storage',
				value: {
					type: 'get',
					value: null,
				},
			});

			const g_entries = JSON.parse(g_get['value']);

			for(const si_each in g_entries) {
				a_output.push(`${si_each}: ${g_entries[si_each]}`);
			}
		}
		catch(e_send) {
			a_output.push(e_send.stack || e_send.message);
		}

		a_output = a_output;
	}


	async function debug_storage() {
		if(B_IOS_NATIVE || B_ANDROID_NATIVE) {
			a_output.push(JSON.stringify(await chrome.storage.local.debug()));
		}
		else {
			try {
				const g_debug = await chrome.runtime.sendNativeMessage('starshell', {
					type: 'storage',
					value: {
						type: 'debug',
					},
				});

				a_output.push(JSON.stringify(g_debug));
			}
			catch(e_send) {
				a_output.push(e_send.stack || e_send.message);
			}
		}

		a_output = a_output;
	}

	async function test_write() {
		const s_test = uuid_v4();

		await chrome.storage.local.set({
			'@test': s_test,
		});

		a_output = [...a_output, `write @test: ${s_test}`];
	}

	async function test_read() {
		const w_test = await chrome.storage.local.get('@test');

		a_output = [...a_output, `read @test: ${w_test?.['@test']}`];
	}
</script>


<div>
	<!-- <button on:click={test_base}>
		Test @base
	</button>

	<button on:click={test_storage}>
		Test Storage
	</button>

	<button on:click={test_native}>
		Test Native
	</button>

	<button on:click={debug_storage}>
		Debug Storage
	</button> -->

	<button on:click={test_write}>
		Test Write
	</button>

	<button on:click={test_read}>
		Test Read
	</button>

	{#each a_output as s_output}
		<li>
			<textarea>{s_output}</textarea>
		</li>
	{/each}
</div>