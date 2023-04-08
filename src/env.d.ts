/// <reference types="@types/chrome" />
/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@samrum/vite-plugin-web-extension/client" />
/// <reference types="@types/w3c-web-usb" />

import type {AccountPath} from './meta/account';
import type {Dict, JsonValue, Nilable} from './meta/belt';
import type {ChainPath} from './meta/chain';
import type {ImageMedia} from './meta/media';
import type {Resource} from './meta/resource';
import type {Store} from './meta/store';
import type {Vocab} from './meta/vocab';
import type {ExtToNative, IntraExt} from './script/messages';
import type {SI_STORE_MEDIA} from './share/constants';

interface ImportMetaEnv {
	MV3: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export type WebKitMessageHandlerRegsitry = {
	broadcast: {
		channel: string;
		message: JsonValue;
	};

	witness: Vocab.Message<ExtToNative.WitnessVocab>;

	storage: Vocab.Message<ExtToNative.StorageVocab>;

	session: Vocab.Message<ExtToNative.StorageVocab>;

	navigation: Vocab.Message<ExtToNative.NavigationVocab>;

	notification: Vocab.Message<ExtToNative.NotificationVocab>;

	model: {
		state: {
			url: string;
			title: string;
			stage: 'unknown' | 'loading' | 'complete';
			account: AccountPath | '';
			chain: ChainPath | '';
		};
	};

	/**
	 * Content scripts in the isolated world of the dapp browser web view communicating with the background frame
	 */
	runtime: {
		id: string;
		sender: chrome.runtime.MessageSender;
		data: Vocab.Message<IntraExt.WebKitGlobal>;
	};

	/**
	 * The background frame responding to async chrome.runtime API calls
	 */
	runtime_response: {
		id: string;
		sender: chrome.runtime.MessageSender;
		data: Vocab.Message<IntraExt.WebKitGlobal>;
	};

	scripting: Vocab.Message<ExtToNative.ScriptingVocab>;

	native: {
		type: 'notificationClicked';
		value: string;
	};

	response: {
		id: string;
		data: JsonValue;
	};

	opener: {
		url: string;
		args: unknown[];
	};
};

type WebKitMessageHandlerKey = keyof WebKitMessageHandlerRegsitry;

declare global {
	/* eslint-disable @typescript-eslint/naming-convention */
	const __H_MEDIA_BUILTIN: Store.Cache<typeof SI_STORE_MEDIA>;
	const __H_MEDIA_LOOKUP: Dict<Resource.Path<ImageMedia>>;
	const __SI_VERSION: string;
	const __SI_ENGINE: string;
	const __G_MANIFEST: chrome.runtime.Manifest;

	// proprietary method for inlining code from a dependency directly into the compiled source
	declare function inline_require(s_dependency: string): any;

	type WebKitMessageHandler<h_handlers extends Dict<any>> = {
		[si_handler in keyof h_handlers]: {
			postMessage(w_msg: Merge<{
				id: string;
			}, h_handlers[si_handler]>): void;
		};
	};

	const webkit: {
		messageHandlers: WebKitMessageHandlers<WebKitMessageHandlerRegsitry>;
	};

	/* eslint-enable */
}
