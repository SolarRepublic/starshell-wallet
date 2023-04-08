import type {BlockInfoHeader} from './common';
import type {PromptConfig} from './msg-flow';
import type {KeplrSignOptions} from '@keplr-wallet/types';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {AccountPath} from '#/meta/account';
import type {SessionRequest, ConnectionManifestV1} from '#/meta/api';
import type {AppChainConnection, AppStruct, AppPath} from '#/meta/app';
import type {
	JsonValue,
	JsonObject,
	Dict,
	OmitUnknownKeys,
	AsJson,
} from '#/meta/belt';
import type {Bech32, Caip2, ChainStruct, ChainPath, ContractPath} from '#/meta/chain';
import type {IncidentPath, TxConfirmed, TxSynced} from '#/meta/incident';
import type {ProviderPath} from '#/meta/provider';
import type {Store, StoreKey} from '#/meta/store';
import type {Vocab} from '#/meta/vocab';

import type {AdaptedAminoResponse, AdaptedStdSignDoc} from '#/schema/amino';

import type {SloppySignDoc} from '#/schema/protobuf';

import type {Argon2Config, AttackConfig} from '#/crypto/argon2';
import type {NotificationConfig} from '#/extension/notifications';
import type {ConnectionHandleConfig} from '#/provider/connection';


import type {AppProfile} from '#/store/apps';
import type { Bip44Data } from '#/crypto/bip44';
import type { DevicePath } from '#/meta/device';



/**
 * Root type for all messages.
 */
export interface TypedMessage<
	s_type extends string=string,
> extends JsonObject {
	type: s_type;
}

export interface DeepLinkMessage extends JsonObject {
	url: string;
}


export interface PageInfo extends JsonObject {
	windowId: number;
	tabId: number;
	href: string;
}

/**
 * Vocab for wallet events.
 */
export type WalletEvent = Vocab.New<{
	// sent when another page has updated the store
	updateStore: {
		value: Dict;
	};
}>;



/**
 * Messages sent from dApps to spotter
 */
export namespace AppToSpotter {
	/**
	 * Vocab for public messages sent from app to spotter
	 */
	export type WindowVocab = Vocab.New<{
		// request wallet advertisement
		requestAdvertisement: {};
	}>;
}


export type ErrorRegistry = {
	// connecting: {

	// };

	signing: {
		/**
		 * For errors relating to invalid types within the contents of messages submitted by app
		 */
		InvalidMessageContent: {
			value: {
				message: string;
			};
		};

		/**
		 * A supplied entity is incompatible with the target chain
		 */
		IncompatibleEntity: {
			value: {
				entityType: string;
				entityId: string;
				chain: Caip2.String;
			};
		};

		/**
		 * A supplied entity did not match any of the enum values of its interface
		 */
		EnumViolation: {
			value: {
				interface: string;
				actual: string;
				expected: string[];
			};
		};
	};
};


export namespace ErrorRegistry {
	export type Module = keyof ErrorRegistry;

	export type Key<
		si_module extends Module=Module,
	> = keyof ErrorRegistry[si_module];

	export type Value<
		si_module extends Module=Module,
		si_key extends Key<si_module>=Key<si_module>,
	> = ErrorRegistry[si_module][si_key] extends infer g_definition
		? g_definition extends {value: any}
			? g_definition['value']
			: never
		: never;

	export type Types<
		si_module extends Module=Module,
	> = {
		[si_key in Key<si_module>]: {
			type: si_key;
			value: ErrorRegistry[si_module][si_key] extends infer g_error
				? g_error extends {value: any}
					? g_error['value']
					: never
				: never;
		};
	}[Key<si_module>];
}
/**
 * Subvocab for commanding background to read or write session storage
 */
export type SessionCommand = Vocab.New<{
	get: {
		value: string;
		response: string | null;
	};
	set: {
		value: JsonObject;
		response: void;
	};
	remove: {
		value: string;
		response: void;
	};
	clear: {
		value?: undefined;
		response: void;
	};
}>;


/**
 * Messages sent from isolated-world content script to service
 */
export namespace IcsToService {

	/**
	 * Vocab for unauthenticated messages sent from isolated-world content script to extension
	 */
	export type PublicVocab = Vocab.New<{
		/**
		 * Requests all available info about the _sender's_ tab and window
		 */
		whoami: {
			response: AsJson<Merge<{
				window: chrome.windows.Window;
			}, chrome.runtime.MessageSender>>;
		};

		// forwards the request for an advertisement on the current page
		requestAdvertisement: {
			value: {
				profile?: AppProfile;
			};
			response: ServiceToIcs.SessionKeys;
		};

		// forwards the request for a new connection on the current page
		requestConnection: {
			value: {
				profile?: AppProfile;
				chains: Record<Caip2.String, ChainStruct>;
				sessions: Dict<SessionRequest>;
				accountPath: AccountPath;
			};
			response: {
				result?: Record<ChainPath, AppChainConnection>;
				error?: ErrorRegistry.Types<'connecting'>;
			};
		};

		// signals a security violation from the current page
		panic: {
			value: string;
		};

		// opens a new flow
		flowBroadcast: {
			value: {
				key: string;
				config: PromptConfig;
			};
		};

		// notifies service that keplr was detected
		detectedKeplr: {
			value: {
				profile?: AppProfile;
			};
		};

		// 
		sessionStorage: {
			value: Vocab.Message<SessionCommand>;
			response: AsJson<Vocab.Response<SessionCommand>>;
		};

		// 
		proxyFlow: {
			value: AsJson<Vocab.Message<IntraExt.FlowVocab>>;
		};

		reportException: {
			value: {
				report: string;
			};
		};
	}>;


	export type AppResponse<w_value> = {
		ok?: w_value;
		error?: ErrorRegistry.Types;
	};

	/**
	 * Vocab for messages sent on behalf of App from isolated-world content script
	 */
	export type AppVocab = Vocab.New<{
		requestCosmosSignatureAmino: {
			value: {
				doc: AdaptedStdSignDoc;
				keplrSignOptions?: AsJson<KeplrSignOptions>;
			};
			response: AppResponse<AdaptedAminoResponse>;
		};

		requestCosmosSignatureDirect: {
			value: {
				doc: SloppySignDoc;
			};
			response: AppResponse<ErrorRegistry.Types>;
		};

		// requestCosmosSignatureText: {
		// 	value: {
		// 		text: string;
		// 	};
		// 	// response: 
		// };

		requestAddTokens: {
			value: {
				bech32s: Bech32[];
			};
			response: AppResponse<
				Record<Bech32, AppResponse<undefined>>
			>;
		};

		requestViewingKeys: {
			value: {
				bech32s: Bech32[];
			};
			response: AppResponse<
				Record<Bech32, AppResponse<undefined>>
			>;
		};

		requestSecretPubkey: {
			value: {};
			response: AppResponse<string>;
		};

		requestSecretEncryptionKey: {
			value: {
				nonce: string;
			};
			response: AppResponse<string>;
		};

		requestEncrypt: {
			value: {
				codeHash: string;
				exec: JsonObject;
			};
			response: AppResponse<string>;
		};

		requestDecrypt: {
			value: {
				ciphertext: string;
				nonce: string;
			};
			response: AppResponse<string>;
		};

		requestBroadcast: {
			value: {
				sxb93_tx_raw: string;
			};
			response: AppResponse<string>;
		};
	}, {
		each: {
			message: {
				value: {
					accountPath: AccountPath;
					chainPath: ChainPath;
				};
			};
		};
	}>;


	/**
	 * Vocab for delayed responses (i.e., forward thru background service which may have been killed)
	 */
	export type PublicResponseVocab = Vocab.New<{
		// spawn a flow
		flowBroadcastResponse: {
			value: {
				key: string;
				answer: boolean;
			};
		};
	}>;

}



/**
 * Messages sent from service to isolated-world content script
 */
export namespace ServiceToIcs {
	/**
	 * Delivers session keys
	 */
	export interface SessionKeys extends JsonObject {
		session: string;
	}

	export type CommandVocab = Vocab.New<{
		openFlow: {
			value: AsJson<IntraExt.FlowVocab>;
		};
	}>;
}


// /**
//  * Messages sent from service to popup script
//  */
// export namespace ServiceToPopup {
// 	export type TabsVocab = Vocab.New<{
// 		flow: Flow
// 	}>;
// }


/**
 * Messages sent from host to relay
 */
export namespace HostToRelay {
	/**
	 * Format of the JSON payload that gets embedded into the iframe document upon creation
	 */
	export interface Payload extends JsonObject {
		session: string;
		csurl: string;
	}


	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type AuthedVocab = Vocab.New<{
		// acknowledges the MessageChannel by sending a message thru it
		acknowledgeChannel: {};

		// responds to a connection request
		respondConnect: {
			value: {
				index: number;
				answer: {
					error: string;
				} | {
					handle: string;
					config: ConnectionHandleConfig;
				};
			};
		};
	}>;



	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type ConnectionVocab = Vocab.New<{
		// service is responding to a specific action
		respondAction: {
			value: {
				index: number;
				action: Vocab.Message<RelayToHost.ConnectionVocab>['type'];
				result: JsonValue;
			};
		};

		// service is emitting an event to this page
		emitEvent: {
			value: WalletEvent;
		};
	}>;
}



/**
 * Messages sent from relay to host
 */
export namespace RelayToHost {
	/**
	 * Vocab for messages exchanged over subframe window.
	 */
	export type SubframeVocab = Vocab.New<{
		establishChannel: {};
	}, {
		each: {
			message: {
				auth: string;
			};
		};
	}>;


	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type AuthedVocab = Vocab.New<{
		requestConnect: {
			value: {
				index: number;
				manifest: ConnectionManifestV1;
			};
		};
		reportWebsiteError: {
			value: string;
		};
	}>;


	/**
	 * Vocab for messages exchanged over a connection channel.
	 */
	export type ConnectionVocab = Vocab.New<{
		downloadStore: {};
		uploadStore: {
			value: Dict;
			response: Dict;
		};
		putItem: {
			value: string;
		};
		lockStore: {};
		releaseStore: {};
	}, {
		each: {
			message: {
				count: number;
			};
		};
	}>;
}



/**
 * Messages sent from host to ratifier.
 */
export namespace HostToRatifier {
	/**
	 * Vocab for messages exchanged over window.
	 */
	export type WindowVocab = Vocab.New<{
		ratifyGlobal: {};
	}>;
}



/**
 * Messages sent from witness to main-world
 */
export namespace WitnessToKeplr {
	/**
	 * Vocab for messages exchanged over window.
	 */
	export type RuntimeVocab = Vocab.New<{
		hardenExport: {
			value: {
				interceptId: string;
			};
		};

		accountChange: {
			value: {};
		};
	}>;
}



/**
 * Messages sent between extension scripts.
 */
export namespace IntraExt {
	/**
	 * Vocab for global broadcasts
	 */
	export type GlobalVocab = Vocab.New<{
		// logged in
		login: {};

		// logout of the application
		logout: {};

		// service heartbeat
		heartbeat: {};

		// wake message
		wake: {};

		// reload all UI
		reload: {};

		// service unresponsive
		unresponsiveService: {};

		// store acquired
		acquireStore: {
			value: {
				key: StoreKey;
			};
		};

		// store released
		releaseStore: {
			value: {
				key: StoreKey;
			};
		};

		// store(s) updated
		updateStore: {
			value: {
				key: StoreKey;
				init: boolean;
			};
		};

		// spawn a flow
		flowBroadcast: {
			value: {
				key: string;
				config: PromptConfig;
			};
		};

		// responde to a flow (in query comm mode)
		flowResponse: {
			value: {
				key: string;
				response: Vocab.Message<FlowResponseVocab>;
			};
		};

		// block info
		blockInfo: {
			value: {
				header: AsJson<BlockInfoHeader>;
				chain: ChainPath;
				provider: ProviderPath;
				recents: number[];
				txCount: number;
			};
		};

		// deep link
		deepLink: {
			value: DeepLinkMessage;
		};

		// transfer receive
		coinReceived: {
			value: {
				p_chain: ChainPath;
				sa_recipient: Bech32;
				a_amounts: {
					denom: string;
					amount: string;
				}[];
			};
		};

		// transfer send
		coinSent: {
			value: {
				p_chain: ChainPath;
				sa_sender: Bech32;
				a_amounts: {
					denom: string;
					amount: string;
				}[];
			};
		};

		fungibleReceived: {
			value: {
				p_chain: ChainPath;
				sa_recipient: Bech32;
				sa_contract: Bech32;
			};
		};

		fungibleSent: {
			value: {
				p_chain: ChainPath;
				sa_sender: Bech32;
				sa_contract: Bech32;
			};
		};

		debug: {
			value: JsonValue;
		};

		// transaction error
		txError: {
			value: {
				hash: string;
			};
		};

		// transaction success
		txSuccess: {
			value: {
				hash: string;
			};
		};

		// token was added
		tokenAdded: {
			value: {
				sa_contract: Bech32;
				p_contract: ContractPath;
				p_chain: ChainPath;
				p_account: AccountPath;
			};
		};

		// fee grant received
		feegrantReceived: {
			value: {
				p_chain: ChainPath;
				sa_granter: Bech32;
				sa_grantee: Bech32;
			};
		};

		contractExecuted: {
			value: {
				p_chain: ChainPath;
				sa_owner: Bech32;
				sa_contract: Bech32;
			};
		};

		// sent once the offscreen document is ready to receive messages
		offscreenOnline: {};
	}>;


	/**
	 * Vocab for standalone popups that should conduct some specific flow.
	 */
	export type FlowVocab = Vocab.New<{
		// authenticate the user
		authenticate: {};

		// page is requesting advertisement
		requestAdvertisement: {
			value: {
				app: AppStruct;
				page: PageInfo;
				keplr: boolean;
			};
		};

		// page is requesting a connection
		requestConnection: {
			value: {
				app: AppStruct;
				chains: Record<Caip2.String, ChainStruct>;
				sessions: Dict<SessionRequest>;
				accountPath: AccountPath;
				profile?: AppProfile;
			};
		};

		requestKeplrDecision: {
			value: {
				page: PageInfo;
				profile: AppProfile;
				app?: AppStruct;
			};
			response: string;
		};

		illegalChains: {
			value: {
				app: AppStruct;
				chains: Record<Caip2.String, ChainStruct>;
			};
		};

		signAmino: {
			value: {
				props: {
					preset?: string;
					amino: AdaptedStdSignDoc;
					keplrSignOptions?: AsJson<KeplrSignOptions>;
				};
				appPath: AppPath;
				chainPath: ChainPath;
				accountPath: AccountPath;
			};
			response: AdaptedAminoResponse;
		};

		// page is requesting to sign transaction
		signTransaction: {
			value: {
				appPath: AppPath;
				chainPath: ChainPath;
				accountPath: AccountPath;
				doc: SloppySignDoc;
			};
		};

		addSnip20s: {
			value: {
				appPath: AppPath;
				chainPath: ChainPath;
				accountPath: AccountPath;
				bech32s: Bech32[];
			};
		};

		exposeViewingKeys: {
			value: {
				appPath: AppPath;
				chainPath: ChainPath;
				accountPath: AccountPath;
				bech32s: Bech32[];
			};

			response: Bech32[];
		};

		// user clicked notification
		inspectIncident: {
			value: {
				incident: IncidentPath;
			};
		};

		/**
		 * suggest to reload an app's tab
		 */
		reloadAppTab: {
			value: {
				app: AppStruct;
				page: PageInfo;
				preset: string;
			};
		};

		reportAppException: {
			value: {
				app: AppStruct | null;
				page: PageInfo;
				report: string;
			};
		};

		/**
		 * suggest to restart the background service
		 */
		restartService: {
			value: {};
		};

		/**
		 * QR code scan
		 */
		scanQr: {
			value: {
				id: string;
			};
		};

		/**
		 * deep link
		 */
		deepLink: {
			value: DeepLinkMessage;
		};

		/**
		 * monitor an outgoing tx
		 */
		monitorTx: {
			value: {
				app: AppPath;
				chain: ChainPath;
				account: AccountPath;
				hash: string;
			};
		};

		/**
		 * attempt to solve a proof-of-work challenge
		 */
		solver: {
			value: {
				accountPath: AccountPath;
			};
		};

		/**
		 * 
		 */
		acceptConsensusKey: {
			value: {
				chain: ChainPath;
				key: string;
			};
		};

		/**
		 * in chrome, requesting new WebUSB device requires a window with URL visible
		 */
		requestDevice: {
			value: {
				props: {
					g_intent?: {
						id: 'setup-new-device';
						props?: JsonObject;
						context?: JsonObject;
					};
				};
				context?: JsonValue;
			};
			response: DevicePath;
		};

		ledgerSign: {
			value: {
				coinType: number;
				message: string;
				path: Bip44Data;
			};
		};
	}, {
		each: {
			message: {
				page: null | PageInfo;
			};
		};
	}>;


	export interface CompletedFlow<
		w_data extends JsonValue=JsonValue,
	> extends JsonObject {
		answer: boolean;
		data?: w_data | undefined;
	}

	export interface ErroredFlow extends JsonObject {
		error: JsonValue;
	}

	export type FlowErrorRegistry = {
		InvalidMessageContent: {
			value: string;
		};
	};

	export type FlowError = {
		[si_type in keyof FlowErrorRegistry]: {
			type: si_type;
			value: FlowErrorRegistry[si_type]['value'];
		};
	}[keyof FlowErrorRegistry];


	/**
	 * Vocab for messages sent from flow over chrome runtime port back to service
	 */
	export type FlowControlVocab = Vocab.New<{
		// continuous heartbeat message
		heartbeat: {};

		// request retransmission
		retransmit: {};

		// indicates the flow was completed
		completeFlow: {
			value: CompletedFlow | ErroredFlow;
		};

		// report an error back to the flow requester
		reportError: {
			value: string;
		};
	}>;

	export type FlowControlAckVocab = Vocab.New<{
		completeFlowAck: {};

		reportErrorAck: {};
	}>;


	/**
	 * Vocab for messages exchanged over window.
	 */
	export type WindowVocab = Vocab.New<{
		conductFlow: {
			value: AsJson<Vocab.Message<FlowVocab>>;
		};
	}>;


	export type Cause = OmitUnknownKeys<NonNullable<Vocab.Response<ServiceInstruction, 'whoisit'>>>;

	/**
	 * Vocab for instructions to be given directly to service worker.
	 */
	export type ServiceInstruction = Vocab.New<{
		// 
		// ==== send-only messages ====
		// 

		/**
		 * Pings the service to check resource liveliness and for ACK
		 */
		wake: {};

		/**
		 * Reloads the tab with the given tab id
		 */
		reloadTab: {
			value: {
				tabId: number;
			};
		};

		/**
		 * Routes a deep link request
		 */
		deepLink: {
			value: AsJson<DeepLinkMessage>;
		};

		// 
		// ==== request messages ====
		// 

		/**
		 * Asynchronous session storage commands
		 */
		sessionStorage: {
			value: AsJson<Vocab.Message<SessionCommand>>;
			response: AsJson<Vocab.Response<SessionCommand>>;
		};

		/**
		 * Requests all avilable info about the _current_ tab and window, used by popups to determine which app is under.
		 */
		whoisit: {
			response: AsJson<{
				tab: chrome.tabs.Tab;
				window: chrome.windows.Window;
				app: AppStruct | null;
				registered: boolean;
				authenticated: boolean;
			} | null>;
		};

		scheduleBroadcast: {
			value: {
				delay?: number;
				broadcast: AsJson<Vocab.Message<GlobalVocab>>;
			};
		};

		/**
		 * Instructs the service worker to read from the clipboard
		 */
		readClipboard: {
			value: {
				format: 'text';
			};
			response: string | null;
		};

		/**
		 * Instructs the service worker to read from the clipboard
		 */
		writeClipboard: {
			value: {
				format: 'text';
				data: string;
			};
			response: string | null;
		};
	}>;

	export type OffscreenVocab = Vocab.New<{
		ping: {
			value: JsonValue;
			response: JsonValue;
		};

		/**
		 * Read data from the clipboard
		 */
		readClipboardOffscreen: {
			value: {
				format: 'text';
			};
			response: string | null;
		};

		/**
		 * Write data to the clipboard
		 */
		writeClipboardOffscreen: {
			value: {
				format: 'text';
				data: string;
			};
			response: string | null;
		};
	}>;

	export type WebKitGlobal = Vocab.New<{
		/**
		 * Notifies other frames that the background frame is ready to receive connection requests
		 */
		online: {};

		/**
		 * Requests a new connection
		 */
		connect: {
			value: {
				name: string;
			};
		};

		/**
		 * Sends a single message, proxying `chrome.runtime.sendMessage`
		 */
		sendMessage: {
			value: {
				id: string;
				sender: AsJson<chrome.runtime.MessageSender>;
				data: JsonValue;
			};
		};

		/**
		 * Responds to a single message, proxying the callback of `chrome.runtime.sendMessage`
		 */
		respondMessage: {
			value: {
				id: string;
				sender: AsJson<chrome.runtime.MessageSender>;
				data: JsonValue;
			};
		};
	}>;

	export type WebKitDirect = Vocab.New<{
		establish: {};
		disconnect: {};
		message: {
			value: JsonValue;
		};
	}>;
}


/**
 * Messages sent between workers/hosts
 */
export namespace Workers {
	export type HostToArgon2 = Vocab.New<{
		hash: {
			value: Argon2Config;
		};
		attack: {
			value: AttackConfig;
		};
	}, {
		each: {
			message: {
				id: string;
			};
		};
	}, JsonValue<Uint8Array>>;

	export type Argon2ToHost = Vocab.New<{
		ok: {
			value: Uint8Array;
		};
		error: {
			value: string;
		};
	}, {
		each: {
			message: {
				id: string;
			};
		};
	}, JsonValue<Uint8Array>>;
}


/**
 * Messages sent from launch.starshell.net container to pwa iframe
 */
export namespace Pwa {
	export type TopToIframe = Vocab.New<{
		visualViewportResize: {
			value: {
				width: number;
				height: number;
				offsetLeft?: number;
				offsetTop?: number;
				scale?: number;
			};
		};
	}>;

	export type IframeToTop = Vocab.New<{
		fetchVisualViewportSize: {};

		openPopup: {
			value: string;
		};
	}>;
}


/**
 * Messages sent from web extension to native app.
 */
export namespace ExtToNative {
	/**
	 * Vocab for messages exchanged over window.
	 */
	export type MobileVocab = Vocab.New<{
		greet: {};

		notify: {
			value: AsJson<NotificationConfig>;
		};

		localStorage: {
			value: Vocab.Message<StorageVocab>;
		};
	}>;


	/**
	 * Vocab for storage commands
	 */
	export type StorageVocab = Vocab.New<{
		get: {
			value: StoreKey[];
		};

		set: {
			value: {
				[si_key in StoreKey]: Store[si_key]
			};
		};

		remove: {
			value: StoreKey;
		};

		clear: {
			value: undefined;
		};
	}>;


	/**
	 * Vocab for navigation commands
	 */
	export type NavigationVocab = Vocab.New<{
		/**
		 * Set the display mode for the navigation bar
		 */
		mode: {
			value: 'expanded' | 'collapsed';
		};

		/**
		 * Submits a navigation request
		 */
		navigate: {
			value: string;
		};

		/**
		 * Instructs the host to reload the web view
		 */
		reload: {};

		/**
		 * Instructs the host to close the web view
		 */
		close: {};
	}>;

	export type ScriptingVocab = Vocab.New<{
		registerContentScripts: {
			value: AsJson<chrome.scripting.RegisteredContentScript[]>;
		};

		executeScript: {
			value: AsJson<chrome.scripting.ScriptInjection<any[], unknown>>;
		};
	}>;

	export type NotificationVocab = Vocab.New<{
		create: {
			value: {
				id: string;
				options: AsJson<chrome.notifications.NotificationOptions>;
			};
		};

		clear: {
			value: {
				id: string;
			};
		};
	}>;

	export interface BrowsingContext extends JsonObject {
		href: string;
		name: string;
		description: string;
	}

	export type WitnessVocab = Vocab.New<{
		capture: {
			value: {
				browsing_context: BrowsingContext;
			};
		};
	}>;
}

/**
 * Messages sent from flow iframe to navigation view
 */
export namespace FlowToNav {
	export type WindowVocab = Vocab.New<{
		close: {
			value: {};
		};

		broadcast: {
			value: {
				data: Vocab.Message<IntraExt.GlobalVocab>;
				uuid: string;
			};
		};
	}>;
}

/**
 * Messages sent between frames within the same view (on mobile platforms when running within webkit)
 */
export namespace IntraView {
	/**
	 * Messages broadcast by the background frame
	 */
	export type BackgroundBroadcastVocab = Vocab.New<{
		/**
		 * Signals that the background frame is now ready to accept port requests
		 */
		online: {};
	}>;

	/**
	 * Messages sent directly to the background frame from another frame
	 */
	export type DirectedToBackgroundVocab = Vocab.New<{
		/**
		 * Requests a new connection
		 */
		connect: {
			value: AsJson<chrome.runtime.ConnectInfo>;
		};
	}>;


	export type RuntimePortVocab = Vocab.New<{
		disconnect: {};

		postMessage: {
			value: JsonValue;
		};
	}>;

	export type RuntimePortMessage = {
		id: string;
		data: Vocab.Message<RuntimePortVocab>;
	};
}
