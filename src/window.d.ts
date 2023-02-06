import type {
	Window as KeplrWindow,
} from '@keplr-wallet/types';

// import type {
// 	StarShell,
// } from '@starshell-wallet/types';

declare global {
	interface Window extends KeplrWindow {
		// starshell?: StarShell;

		chrome: chrome;

		webkit: {
			messageHandlers: {
				controller: {
					postMessage(w_msg: any): void;
				};
			};
		};
	}
}
