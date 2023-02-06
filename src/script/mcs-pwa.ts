import type {Pwa} from './messages';

import type {Vocab} from '#/meta/vocab';


(function() {
	// verbose
	const debug = (s: string, ...a_args: (string | object)[]) => console.debug(`StarShell.mcs-pwa: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const d_viewport = window.visualViewport;

	function update_size() {
		// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
		const d_window = (document.querySelector('iframe#starshell-app') as HTMLIFrameElement)?.contentWindow;

		(d_window as Vocab.TypedWindow<Pwa.TopToIframe>)?.postMessage({
			type: 'visualViewportResize',
			value: d_viewport? {
				width: d_viewport.width,
				height: d_viewport.height,
				offsetLeft: d_viewport.offsetLeft,
				offsetTop: d_viewport.offsetTop,
				scale: d_viewport.scale,
			} : {
				width: innerWidth,
				height: innerHeight,
				offsetLeft: window.screenLeft,
				offsetTop: window.screenTop,
			},
		}, '*');
	}

	// listen for resize events
	d_viewport?.addEventListener('resize', update_size);

	// once dom loads, send initial viewport size
	if('complete' === document.readyState) {
		update_size();
	}
	else {
		addEventListener('DOMContentLoaded', update_size);
	}

	// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
	(document.querySelector('iframe#starshell-app') as HTMLIFrameElement)?.addEventListener('load', () => {
		debug('iframe loaded');

		update_size();
	});

	const h_handlers: Vocab.Handlers<Pwa.IframeToTop> = {
		fetchVisualViewportSize() {
			update_size();
		},

		openPopup(p_open: string) {
			window.open(p_open, '_blank');
		},
	};

	(window as Vocab.TypedWindow<Pwa.IframeToTop>).addEventListener('message', (d_event) => {
		debug('Received message: %o', d_event.data);

		const {
			type: si_type,
			value: w_value,
		} = d_event.data;

		const f_handler = h_handlers[si_type];
		if(f_handler) {
			f_handler(w_value as never);
		}
	});
})();
