import type * as UtilsImport from './utils';

import type * as DataImport from '#/util/data';
import type * as DomImport from '#/util/dom';

console.log(`StarShell.ics-link: Launched on <${location.href}>`);

(function() {
	const {uuid_v4} = inline_require('#/util/data.ts') as typeof DataImport;
	const {qs, dd} = inline_require('#/util/dom.ts') as typeof DomImport;
	const {locate_script} = inline_require('./utils.ts') as typeof UtilsImport;

	function init() {
		document.body.innerHTML = '';
		document.body.style.margin = '0';

		// pwa parent script
		{
			// construct script
			const dm_script = document.createElement('script');

			// locate pwa helper script
			const p_pwa = locate_script('assets/src/script/mcs-pwa');

			// not found
			if(!p_pwa) {
				throw new Error('Unable to locate pwa script!');
			}

			// set the script src
			dm_script.src = chrome.runtime.getURL(p_pwa);
		}

		// construct iframe
		const dm_iframe = dd('iframe', {
			id: 'starshell-app',
			src: `${chrome.runtime.getURL('src/entry/flow.html')}?${new URLSearchParams(Object.entries({
				comm: 'query',
				key: uuid_v4(),
				data: JSON.stringify({
					type: 'deepLink',
					value: {
						url: location.href,
					},
				}),
			})).toString()}`,
			style: `
				margin: 0;
				padding: 0;
				width: 100%;
				height: 100%;
				border: none;
			`,
		});

		// inject iframe
		document.body.appendChild(dm_iframe);
	}

	window.addEventListener('DOMContentLoaded', () => {
		// TODO: re-enable link script once deep-linking is ready
		// init();
	});
})();
