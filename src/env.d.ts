/// <reference types="@types/chrome" />
/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@solar-republic/vite-plugin-web-extension/client" />

import type {Dict, JsonValue} from './meta/belt';
import type {ImageMedia} from './meta/media';
import type {Resource} from './meta/resource';
import type {Store} from './meta/store';
import type {Vocab} from './meta/vocab';
import type {ExtToNative} from './script/messages';
import type {SI_STORE_MEDIA} from './share/constants';

interface ImportMetaEnv {
	MV3: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

export type WebKitMessageHandlerRegsitry = {
	storage: Vocab.Message<ExtToNative.StorageVocab>;

	notification: Vocab.Message<ExtToNative.NotificationVocab>;

	runtime: {
		id: string;
		data: JsonValue;
		sender: chrome.runtime.MessageSender;
	};

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
