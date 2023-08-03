/* eslint-disable i/order */
import {domlog} from './fallback';

domlog(`Pre-init: registering uncaught error handler`);
window.addEventListener('error', (d_event) => {
	domlog(`Fatal uncaught error: ${d_event.message}`);
	domlog(`${d_event.filename}:${d_event.lineno}:${d_event.colno}`);
	console.error(d_event.error);
});

import {do_webkit_polyfill} from '#/native/webkit-polyfill';
import type {IntraExt} from '#/script/messages';
import type {Vocab} from '#/meta/vocab';
import {global_broadcast} from '#/script/msg-global';

do_webkit_polyfill();
/* eslint-enable */

type MessageSender = chrome.runtime.MessageSender;

type SendResponse = (w_data?: any) => void;

type MessageHandler<w_msg=any> = (g_msg: w_msg, g_sender: MessageSender, fk_respond: SendResponse) => void | boolean;


const H_HANDLERS: Vocab.HandlersChrome<IntraExt.OffscreenVocab> = {
	ping(gc_ping, g_sender, fk_respond) {
		fk_respond(gc_ping);
	},

	readClipboardOffscreen(gc_read, g_sender, fk_respond) {
		try {
			// create textarea element
			const dm_textarea = document.createElement('textarea');

			// append to body
			document.body.append(dm_textarea);

			// focus
			dm_textarea.focus();
			dm_textarea.select();

			// paste from clipboard
			document.execCommand('paste');

			// attempt to remove element
			try {
				dm_textarea.remove();
			}
			catch(e_remove) {}

			// read pasted data
			fk_respond(dm_textarea.value);
		}
		catch(e_read) {
			debugger;
			console.error({e_read});

			fk_respond(null);
		}
	},

	writeClipboardOffscreen(gc_write, g_sender, fk_respond) {
		try {
			// depending on format
			if('text' === gc_write.format) {
				// create textarea element
				const dm_textarea = document.createElement('textarea');

				// append to body
				document.body.append(dm_textarea);

				// set value
				dm_textarea.value = gc_write.data;

				// focus
				dm_textarea.select();

				// copy to  clipboard
				document.execCommand('copy');

				// attempt to remove element
				try {
					dm_textarea.remove();
				}
				catch(e_remove) {}

				// respond with what was copied
				fk_respond(dm_textarea.value);
			}
		}
		catch(e_read) {
			debugger;
			console.error({e_read});

			fk_respond(null);
		}
	},
};

/**
 * Handle messages from content scripts
 */
const message_router: MessageHandler = (g_msg, g_sender, fk_respond) => {
	// invalid message structure
	if('object' !== typeof g_msg || 'string' !== typeof g_msg.type) {
		fk_respond();
		return false;
	}

	// authorize the source of the message
	CHECK_SOURCE: {
		// message originates from extension
		const b_origin_verified = g_sender.url?.startsWith(chrome.runtime.getURL('')) || false;
		if(chrome.runtime.id === g_sender.id && (b_origin_verified || 'null' === g_sender.origin)) {
			break CHECK_SOURCE;
		}

		console.error(`Refusing request from unknown sender: ${JSON.stringify(g_sender)}`);

		fk_respond();
		return false;
	}

	// ref message type
	const si_type = g_msg.type;

	// registered message
	const f_handler = H_HANDLERS[si_type];
	if(f_handler) {
		let b_responded = false;

		// invoke handler
		const z_response = f_handler(g_msg.value, g_sender, (w_response) => {
			b_responded = true;

			fk_respond(w_response);
		});

		// async handler; go async
		if(z_response && 'function' === typeof z_response['then']) {
			return true;
		}

		// done
		if(b_responded) return false;
	}
	// no such handler
	else {
		console.warn(`Offscreen document ignoring unrecognized message type: ${si_type}`);
	}

	fk_respond();
	return false;
};

chrome.runtime.onMessage?.addListener(message_router);

global_broadcast({
	type: 'offscreenOnline',
});
