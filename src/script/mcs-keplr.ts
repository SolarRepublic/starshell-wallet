import type * as InjectedKeplrImport from './injected-keplr';
import type {WitnessToKeplr} from './messages';
import type {Keplr as KeplrStruct} from '@keplr-wallet/types';

import type {Vocab} from '#/meta/vocab';

(function() {
	const {
		InjectedKeplr: dc_keplr,
	} = inline_require('./injected-keplr.ts') as typeof InjectedKeplrImport;

	// verbose
	// eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-keplr: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	// @ts-expect-error intentional undercall
	const keplr = new dc_keplr(__G_PACKAGE.devDependencies['@keplr-wallet/provider'].replace(/[^\d.]/g, ''), 'extension') as unknown as KeplrStruct;

	if(!window.keplr) {
		window.keplr = keplr;

		window.getOfflineSigner = (chainId: string) => keplr.getOfflineSigner(chainId);
		window.getOfflineSignerOnlyAmino = (chainId: string) => keplr.getOfflineSignerOnlyAmino(chainId);
		window.getOfflineSignerAuto = (chainId: string) => keplr.getOfflineSignerAuto(chainId);
		window.getEnigmaUtils = (chainId: string) => keplr.getEnigmaUtils(chainId);

		debug('Added ', window.keplr);
	}
	else {
		debug('Keplr API already present ', window.keplr);
	}

	const h_handlers: Vocab.Handlers<WitnessToKeplr.RuntimeVocab> = {
		hardenExport() {
			// ignore
		},

		accountChange() {
			window.dispatchEvent(new Event('keplr_keystorechange'));
		},
	};

	// listen for events from wallet
	(window as Vocab.TypedWindow<WitnessToKeplr.RuntimeVocab>).addEventListener('message', (d_event) => {
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
