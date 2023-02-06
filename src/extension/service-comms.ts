import type {Dict, JsonValue, Promisable} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';

import type {IntraExt, TypedMessage} from '#/script/messages';
import {ode, timeout} from '#/util/belt';

import {buffer_to_base93, uuid_v4} from '#/util/data';

const XT_SERVICE_WORKER_LIFETIME_TIMEOUT = 90e3;

enum ConnectionState {
	UNCONNECTED = 0,
	DISCONNECTED = 1,
	CONNECTING = 2,
	CONNECTED = 3,
	PAUSED = 4,
}

enum FrameType {
	/**
	 * Background is notifying client about connection
	 */
	CONTROL = 1,

	/**
	 * Sender does not expect response data
	 */
	SEND = 2,

	/**
	 * Background is acknowledging receipt of message
	 */
	ACK = 3,

	/**
	 * Sender expects response data
	 */
	REQUEST = 4,

	/**
	 * Response to request
	 */
	RESPONSE = 5,
}

interface ChannelStruct {
	xc_type: FrameType;
	ack?(): void;
	error?(s_error: string): Promisable<void>;
	response?(w_data: JsonValue): Promisable<void>;
}

type ConnectionType = 'self' | 'app';

type ConnectionId = `comms:${ConnectionType}:${string}` | '';

type Frame = [
	si_channel: ConnectionId,
	xc_type: FrameType,
	g_payload: TypedMessage | null,
	g_error: string | null,
];

class ServiceUnreachableError extends Error {
	constructor() {
		super(`Service worker is unreachable`);
	}
}

class NotConnectedError extends Error {
	constructor() {
		super(`Service comms are not connected`);
	}
}

function random_id(): string {
	return buffer_to_base93(crypto.getRandomValues(new Uint8Array(12)));
}

export class ServiceClient {
	static async connect(si_type: ConnectionType): Promise<ServiceClient> {
		const k_comms = new ServiceClient(`comms:${si_type}:${uuid_v4()}`);

		await k_comms._connect();

		return k_comms;
	}


	protected _d_port: chrome.runtime.Port;

	protected _xc_state = ConnectionState.DISCONNECTED;

	protected _h_channels: Dict<ChannelStruct> = {};

	protected _b_paused = true;
	protected _a_queued: VoidFunction[] = [];

	protected _d_port_expiring: chrome.runtime.Port;
	protected _h_channels_expiring: Dict<ChannelStruct> = {};

	private constructor(protected _si_connection: ConnectionId) {}

	protected _connect(): Promise<void> {
		console.debug(`Attempting to connect to background...`);

		return new Promise((fk_resolve, fe_reject) => {
			// hoist timeout handle
			let i_timeout = 0;

			// initiate connection to service worker
			let d_port!: chrome.runtime.Port;
			try {
				d_port = this._d_port = chrome.runtime.connect({
					name: this._si_connection,
				});

				// error
				if(chrome.runtime.lastError) {
					console.error(`Failed to connect to background: %o`, chrome.runtime.lastError);
				}
			}
			catch(e_connect) {
				console.error(`Failed to connect to background: ${e_connect.message}`);
			}

			// no port connection
			if(!d_port) {
				throw new Error(`Failed to connect to background service`);
			}

			// set connection state
			let xc_state_local = this._xc_state = ConnectionState.CONNECTING;

			// bind to disconnect event
			d_port.onDisconnect.addListener(() => {
				console.debug(`Client side of port disconnected`);

				// failed to connect
				if(ConnectionState.CONNECTING === this._xc_state) {
					fe_reject(new ServiceUnreachableError());
				}

				// alert
				console.error(`Browser killed background`);

				// update connection state
				xc_state_local = this._xc_state = ConnectionState.DISCONNECTED;
			});

			// error
			if(chrome.runtime.lastError) {
				console.error(`Failed to bind disconnect listener to background: %o`, chrome.runtime.lastError);
			}

			// route subsequent response messages
			const f_router = (a_frame: Frame) => {
				const [si_channel, xc_type, w_payload, w_error] = a_frame;

				console.debug(`%c▶%c received from background: ${JSON.stringify(a_frame)}`, 'color: lime;', '');

				// control frame
				if(FrameType.CONTROL === xc_type) {
					if('refresh' === w_payload?.type) {
						// open channels exist
						if(Object.keys(this._h_channels).length) {
							debugger;
							console.error(`💥 Background is refreshing but there are open connections!`);
						}

						// disconnect port
						this._d_port.disconnect();

						// pause connection
						xc_state_local = this._xc_state = ConnectionState.PAUSED;

						// wait for background to re-initialize
						setTimeout(() => {
							// reconnect
							void this._connect();
						}, 100);
					}
					else {
						console.warn(`Failed to parse control frame from background`);
					}

					// exit
					return;
				}

				// ref channel
				const g_channel = this._h_channels[si_channel];

				// message is not routable
				if(!g_channel) {
					console.error(`Foreground received unroutable frame from background: %o`, a_frame);
					return;
				}

				// whether or not to delete the channel
				let b_persist = false;
				try {
					// error
					if(w_error) {
						// channel can handle error
						if(g_channel.error) {
							void g_channel.error(w_error);
						}
						// channel cannot handle
						else {
							throw new Error(`Service reported an error while handling message and no error handler present in foreground: ${w_error}`);
						}
					}
					// type calls for ack
					else if(FrameType.ACK === xc_type) {
						// channel is awaiting response; purpose not fulfilled, don't delete channel yet
						if(FrameType.REQUEST === g_channel.xc_type) b_persist = true;

						// execute ACK if defined
						g_channel.ack?.();
					}
					// type calls for response
					else if(FrameType.RESPONSE === xc_type) {
						void g_channel.response!(w_payload);
					}
					// other
					else {
						throw new Error(`Received unexpected frame type from background: ${xc_type}`);
					}
				}
				finally {
					// delete channel
					if(!b_persist) delete this._h_channels[si_channel];
				}
			};

			// handle first incoming message
			const f_init = (a_ack: Frame) => {
				console.debug(`Received initial frame from background: %o`, a_ack);

				// clear timeout
				clearTimeout(i_timeout);

				if(!Array.isArray(a_ack) || '' !== a_ack[0] || FrameType.CONTROL !== a_ack[1] || 'ack' !== a_ack[2]?.type) {
					console.error(`Received invalid init ACK from background: %o`, a_ack);
				}

				// update connection state
				xc_state_local = this._xc_state = ConnectionState.CONNECTED;

				// replace listener
				d_port.onMessage.addListener(f_router);
				d_port.onMessage.removeListener(f_init);

				// empty queue
				while(this._a_queued.length) this._a_queued.shift()!();

				// resolve promise
				fk_resolve();
			};

			// bind to message event
			d_port.onMessage.addListener(f_init);

			// error
			if(chrome.runtime.lastError) {
				console.error(`Failed to bind onMessage listener to background: %o`, chrome.runtime.lastError);
			}

			// set timeout for connection
			i_timeout = (globalThis as typeof window).setTimeout(() => {
				if(xc_state_local < ConnectionState.CONNECTED) {
					console.warn(`Forcefully disconnecting port from client side`);

					// force disonnect
					d_port.disconnect();

					// reject
					fe_reject(new ServiceUnreachableError());
				}
			}, 5e3);
		});
	}

	protected _post(xc_type: FrameType, g_payload: TypedMessage, g_channel: Omit<ChannelStruct, 'xc_type'>): void {
		// prep new channel id
		const si_channel = random_id();

		// create channel
		this._h_channels[si_channel] = {
			...g_channel,
			xc_type,
		};

		// wrap message with control frame
		const a_frame = [si_channel, xc_type, g_payload];

		const f_post = () => {
			console.debug(`%c◀%c sent to background: ${JSON.stringify(a_frame)}`, 'color: red;', '');

			// post message
			this._d_port.postMessage(a_frame);
		};

		// background is refreshing
		if(ConnectionState.PAUSED === this._xc_state) {
			console.debug(`Queueing frame: ${JSON.stringify(a_frame)}`);
			this._a_queued.push(f_post);
		}
		else {
			f_post();
		}
	}

	/**
	 * Sends a message in one direction, expecting only ACK that it was received
	 * @param g_msg 
	 */
	send(g_payload: TypedMessage): Promise<void> {
		// go async
		return new Promise((fk_resolve, fe_reject) => {
			// not connected
			if(this._xc_state < ConnectionState.CONNECTED) {
				return fe_reject(new NotConnectedError());
			}

			// post
			this._post(FrameType.SEND, g_payload, {
				// handle ACK; resolve promise
				ack: fk_resolve,
			});
		});
	}

	/**
	 * Sends a message, expecting a particular response
	 * @param g_msg 
	 */
	request(g_payload: TypedMessage): Promise<JsonValue> {
		// go async
		return new Promise((fk_resolve, fe_reject) => {
			// not connected
			if(this._xc_state < ConnectionState.CONNECTED) {
				return fe_reject(new NotConnectedError());
			}

			// post
			this._post(FrameType.REQUEST, g_payload, {
				response: fk_resolve,
			});
		});
	}
}


type MessageSender = chrome.runtime.MessageSender;

type SendResponse = (w_data?: any) => void;

type MessageHandler<w_msg=any> = (g_msg: w_msg, g_sender: MessageSender, fk_respond: SendResponse) => void | boolean;


enum PortState {
	OPENED = 1,
	DISCONNECTED = 2,
	ONLINE = 3,
}

type Handler = (w_data: JsonValue, si_channel: string) => Promisable<TypedMessage>;

interface ServiceRouters {
	self?: Vocab.HostHandlersChrome<IntraExt.ServiceInstruction>;
}

interface ServicePort extends chrome.runtime.Port {
	postMessage(a_frame: Frame): void;
}


interface PortStruct {
	// i_refresh: number;

	/**
	 * Connection state of the port
	 */
	xc_state: PortState;

	/**
	 * The port handle
	 */
	d_port: ServicePort;
}

export class ServiceHost {
	static open(g_routers: ServiceRouters): ServiceHost {
		const k_host = new ServiceHost(g_routers);

		k_host._open();

		return k_host;
	}

	protected _h_ports: Dict<PortStruct> = {};

	protected _i_expire: number;

	protected _c_handling = 0;

	constructor(protected _g_routers: ServiceRouters) {

	}

	protected _delete(si_port: string): void {
		// ref port struct; port exists
		const g_port = this._h_ports[si_port];
		if(g_port) {
			// update state for anything that still holds ref to struct
			g_port.xc_state = PortState.DISCONNECTED;

			// // clear timeout
			// clearTimeout(g_port.i_refresh);

			// delete port
			delete this._h_ports[si_port];
		}
	}

	protected _open(): void {
		// if(chrome.runtime.onConnect.hasListeners()) {
		// 	console.error(`Service worker already listening to onConnect events`);
		// 	return;
		// }

		console.debug(`🌼 Opening background receiver`);

		const f_connect = (d_port: ServicePort) => {
			// ref port name
			const si_port = d_port.name;

			// not for this protocol
			if(!si_port.startsWith('comms:')) {
				return;
			}

			console.debug(`📬 New connection from ${si_port}`);

			console.debug(d_port.sender);

			const f_reject = (s_reason: string) => {
				// disconnect port
				d_port.disconnect();

				// delete port
				this._delete(si_port);

				// construct error
				return new Error(s_reason);
			};

			// parse port type
			const [, si_type] = si_port.split(':');

			// ref sender
			const g_sender = d_port.sender;

			// prep handlers dict
			let h_handlers: Dict<Handler> = {};

			// privileged
			if('self' === si_type) {
				// no sender
				if(!g_sender) throw f_reject(`Refusing to accept privileged port request from anonymous sender`);

				// message does not originate from extension
				const b_origin_verified = g_sender.url?.startsWith(chrome.runtime.getURL('')) || false;
				if(chrome.runtime.id !== g_sender.id || (!b_origin_verified && 'null' !== g_sender.origin)) {
					throw f_reject(`Refusing to accept privileged port request from foreign sender: ${JSON.stringify(g_sender)}`);
				}

				// message originates from extension
				console.debug(`Accepted privileged port request from %O`, g_sender);
				h_handlers = this._g_routers.self;

				// no handler
				if(!h_handlers) {
					throw f_reject(`Unable to route privileged port since background didn't register any handlers`);
				}
			}

			// create and save port struct
			const g_port: PortStruct = this._h_ports[si_port] = {
				// // set refresh timeout
				// i_refresh: setTimeout(() => {
				// 	// debug
				// 	console.debug(`Refrshing service lifetime`);

				// 	// disconnect
				// 	this.

				// 	// reopn
				// 	this._open();
				// }, 250e3);

				xc_state: PortState.OPENED,

				d_port,
			};

			// register disconnect listener
			d_port.onDisconnect.addListener(() => {
				console.debug(`Port was closed: ${si_port}`);

				this._delete(si_port);
			});

			// prep router
			const f_router = async(a_frame: Frame) => {
				// invalid frame
				if(!Array.isArray(a_frame)) {
					console.error(`Background received an invalid frame: %o`, a_frame);
					return;
				}

				const [si_channel, xc_type, g_payload] = a_frame;

				// ack immediately
				d_port.postMessage([si_channel, FrameType.ACK, null, null]);

				// destructure payload
				const {
					type: si_method,
					value: w_data,
				} = g_payload!;

				// ref handler
				const f_handler = h_handlers[si_method];

				// no route defined for message
				if(!f_handler) {
					console.error(`🚫 Service worker unable to route <${si_type}> message for '${si_method}'`);
					return;
				}

				// increment handling counter
				this._c_handling++;

				// handle message
				try {
					// capture response value
					const g_response = await f_handler(w_data, si_channel);

					// respond to foreground
					if(FrameType.REQUEST === xc_type) {
						d_port.postMessage([si_channel, FrameType.RESPONSE, g_response, null]);
					}
				}
				catch(e_handle) {
					// log stack to console
					console.error(e_handle);

					// foreground expecting response; report error back to foreground
					if(FrameType.REQUEST === xc_type) {
						d_port.postMessage([si_channel, FrameType.RESPONSE, null, e_handle.message]);
					}
				}
				finally {
					// decrement handling counter
					this._c_handling--;
				}
			};

			// register init handler
			d_port.onMessage.addListener(f_router);

			// send init ACK
			d_port.postMessage(['', FrameType.CONTROL, {
				type: 'ack',
			}, null]);

			// set online state
			g_port.xc_state = PortState.ONLINE;
		};

		// register connect listener
		chrome.runtime.onConnect.addListener(f_connect);

		// start sw lifetime timeout
		const f_expire = async() => {
			console.debug(`💀 Service worker lifetime expiring; ports: %o`, this._h_ports);

			// each connected port
			for(const [si_port, g_port] of ode(this._h_ports)) {
				// port not connected; skip
				if(PortState.ONLINE !== g_port.xc_state) continue;

				// notify of refresh
				g_port.d_port.postMessage(['', FrameType.CONTROL, {
					type: 'refresh',
				}, null]);
			}

			// allow to complete
			if(this._c_handling) {
				await timeout(1e3);

				// still handling
				if(this._c_handling) {
					console.warn(`💣 Background moving on from occupied handler`);
				}
			}

			// remove listener
			chrome.runtime.onConnect.removeListener(f_connect);

			// start new listener
			this._open();
		};

		this._i_expire = (globalThis as typeof window).setTimeout(f_expire, XT_SERVICE_WORKER_LIFETIME_TIMEOUT);
	}

	protected register(g_routers: ServiceRouters): void {
		for(const [si_type, h_handlers] of ode(g_routers)) {
			this._g_routers[si_type] = Object.assign(this._g_routers[si_type] || {}, h_handlers);
		}
	}
}
