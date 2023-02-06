import type {Promisable} from '#/meta/belt';
import { remove } from '#/util/belt';

import {camel_to_phrase} from '#/util/format';

export interface ErrorReport {
	title: string;
	text?: string;
	error?: Error;
}

export interface WarnReport {
	title: string;
	text: string;
}


// running log of reported errors
const a_errors: string[] = [];

// error listener
type ErrorCallback = (g_report: ErrorReport) => Promisable<void>;

const a_error_listeners: ErrorCallback[] = [];

export function on_error(fe_report: ErrorCallback): VoidFunction {
	a_error_listeners.push(fe_report);

	const fk_remove = () => {
		remove(a_error_listeners, fe_report);
	};

	return fk_remove;
}


export class SysError extends Error {
	constructor(protected _e_wrapped: Error) {
		super(_e_wrapped.message);
	}

	override get stack(): string {
		return this._e_wrapped.stack || '';
	}

	override get cause(): unknown {
		return this._e_wrapped.cause;
	}

	override get name(): string {
		return this._e_wrapped.name;
	}
}


export function syserr(z_error: Error | ErrorReport): Error {
	let g_error = z_error as ErrorReport;

	if(z_error instanceof Error) {
		// do not re-emit re-thrown syserrors
		if(z_error instanceof SysError) {
			return z_error;
		}

		let si_title = z_error['title'];
		if(!si_title) {
			si_title = camel_to_phrase(z_error.constructor.name);
			if('Error' === si_title) si_title = 'Runtime error';
		}

		g_error = {
			error: z_error,
			title: si_title,
			text: z_error['message'],
		};
	}

	// error identity based on what is shown to user
	const si_error = JSON.stringify({
		title: g_error.title,
		text: g_error.text,
	});

	// prevent redundant errors
	if(!a_errors.includes(si_error)) {
		a_errors.push(si_error);

		// automatically expire
		setTimeout(() => {
			remove(a_errors, si_error);
		}, 2e3);

		for(const fk_listener of a_error_listeners) {
			void fk_listener(g_error);
		}
	}

	return new SysError(g_error.error || new Error(g_error.text));
}

export function syswarn(g_warn: WarnReport): void {
	console.warn(g_warn);
}
