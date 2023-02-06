import { dd, qs } from '#/util/dom';

// select dom log elements
export const dm_log = qs(document, 'section#dom-log');
export const dm_log_list = qs(document, '#dom-log-list');

/**
 * Logs a message to the console and to DOM as a fallback for unhandled errors
 */
export function domlog(si_msg: string): void {
	// eslint-disable-next-line no-console
	console.log(si_msg);

	dm_log_list?.append(dd('li', {}, [
		dd('pre', {}, [si_msg]),
	]));
}
