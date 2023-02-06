import type * as DomImport from '#/util/dom';

(function() {
	// verbose
	const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.ics-webkit-bg: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const {
		dd,
	} = inline_require('#/util/dom.ts') as typeof DomImport;

	const dm_background = dd('iframe', {
		src: '/background.html?within=webview',
		style: `
			display: none;
		`,
	});

	function startup() {
		document.body.append(dm_background);
	}

	if('loading' !== document.readyState) {
		startup();
	}
	else {
		window.addEventListener('DOMContentLoaded', startup);
	}
})();
