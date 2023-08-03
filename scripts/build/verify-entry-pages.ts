/**
 * This script runs in Deno. It's purpose is to verify that each built entry HTML file is set to load the
 * appropriate security scripts before loading any generated bundles, which may possibly contain malicious
 * supply-chain attack payloads. This effectively mitigates supply-chain attacks from devDependencies.
 */
import {DOMParser} from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts';

const S_ENGINE = Deno.args[0];

const pd_entry = `dist/${S_ENGINE}/src/entry`;

/**
 * can be verified using ```sh
 * $ echo "sha384-$(shasum -b -a 384 $FILE | awk '{ print $1 }' | xxd -r -p | base64)"
 * ```
 */ 
const H_SCRIPTS = {
	'/src/entry/lockdown-install.js': 'sha384-G5P8OYnLPyyhZ2vAEVoTqi36BuVZ9yinIeC3cwCaVHf/QTYRbE6cbfpWsfADQWIK',
	'/src/entry/lockdown-init.js': 'sha384-dtiQvjNLfEt9ok5Icb0H6LnTWBtJW4a/2ZjFXAGv+S6EWl+ePpQSxLXQhPvuWK5N',
	...'safari' === S_ENGINE? {
		'/src/entry/pre-exempt-ios.js': 'sha384-dL8b/uXWArq1VfbVpJJl1VFLaejCZ4agE1kl3rkIjRQI5ubI7ZQ1kKJi+Patr9V6',
	}: {},
	'/src/entry/pre-exempt-debug.js': 'sha384-GT4DjdVNneaYMpxGqzzOtHgstMZn3Re0nPfryl8A4vmmd6x5SkBRUlDVf9GuUIKw',
	'/src/entry/deep-freeze.js': 'sha384-qz/Qk+yDu0kZRTqs+Mtm2/tCYp5QXF+PQVU90G8Y/jPynWRjteAaugM9jEwBlSFy',
};

for(const g_entry of Deno.readDirSync(pd_entry)) {
	const sr_file = g_entry.name;
	if(g_entry.isFile && sr_file.endsWith('.html')) {
		const p_file = pd_entry+'/'+sr_file;
		const sx_html = new TextDecoder('utf-8').decode(Deno.readFileSync(p_file));
		
		const y_doc = new DOMParser().parseFromString(sx_html, 'text/html');
		const a_scripts = y_doc.querySelectorAll('script');

		if(!a_scripts.length) {
			throw new Error(`Entry page ${p_file} missing scripts`);
		}

		// assert exact order
		const a_entries = Object.entries(H_SCRIPTS);
		for(let i_script=0; i_script<a_entries.length; i_script++) {
			const [sr_src, sx_integrity] = a_entries[i_script];
			const dm_script = a_scripts[i_script];

			if(!dm_script) {
				throw new Error(`Entry page ${p_file} missing expected script "${sr_src}"`);
			}

			// mismatched source
			const p_src = dm_script.getAttribute('src');
			if(p_src !== sr_src) {
				throw new Error(`Script element at index [${i_script}] expected to have src="${sr_src}" but found "${p_src}"`);
			}

			// unexpected attributes (ensures the script tags haven't been sabotaged)
			const a_attr_names = dm_script.getAttributeNames();
			if('src:integrity' !== a_attr_names.join(':')) {
				throw new Error(`Script element [${i_script}] in entry page ${p_file} includes unexpected attribute(s): ${a_attr_names.join(', ')}`);
			}
		}
	}
}
