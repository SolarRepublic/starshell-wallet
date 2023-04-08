import type {AccountPath} from '#/meta/account';
import type {IncidentPath} from '#/meta/incident';
import { XT_TIMEOUT_DEFALUT_NOTIFICATION } from '#/share/constants';

import {Accounts} from '#/store/accounts';
import {Incidents} from '#/store/incidents';
import {Pfps} from '#/store/pfps';

export type NotificationRouterRegistry = {
	incident: {
		data: IncidentPath;
	};
};

export type NotificationRouterKey = keyof NotificationRouterRegistry;

export type RoutableNotificationId<
	si_key extends NotificationRouterKey=NotificationRouterKey,
> = {
	[si_each in NotificationRouterKey]: `@${si_each}:${NotificationRouterRegistry[si_each]['data']}`;
}[si_key];

export interface NotifyItemCore {
	title: string;
	message: string;
}

export interface NotifyItemConfig extends NotifyItemCore {
	group?: (nl_msgs: number) => string;
}

export interface NotificationConfig {
	item: NotifyItemCore;
	id?: RoutableNotificationId;
	incident?: IncidentPath;

	/**
	 * If natural number, clears notification after timeout in ms.
	 * If 0 or negative, clears notification after default timeout.
	 * If omitted or Infinite, does not clear notification.
	 */
	timeout?: number;
}


export async function system_notify(gc_notification: NotificationConfig): Promise<void> {
	let p_icon = '/media/vendor/logo-192px.png';
	const p_incident = gc_notification.incident;
	if(p_incident) {
		try {
			const g_incident = await Incidents.at(p_incident);
			const p_account = g_incident?.data['account'] as AccountPath;
			const g_account = await Accounts.at(p_account);
			const p_default = await Pfps.createUrlFromDefault(g_account!.pfp);
			if(p_default) p_icon = p_default;

			if(!g_incident?.type.startsWith('account') && g_account) {
				// time account was created
				const g_created = [...await Incidents.filter({
					type: 'account_created',
					account: p_account,
				})][0];

				// do not notify for incidents that occurred prior to account creation
				const sx_when = g_incident?.data['timestamp'] || '';
				if(sx_when && new Date(sx_when).getTime() < g_created.time) {
					console.warn(`Silencing notification for incident that occurred prior to account creation`);
					return;
				}
			}
		}
		catch(e_account) {}
	}

	chrome.notifications?.create(gc_notification.id || '', {
		type: 'basic',
		priority: 1,
		iconUrl: p_icon,
		eventTime: Date.now(),
		title: gc_notification.item.title || '1 New Notification',
		message: gc_notification.item.message || ' ',
	}, (si_notifcation) => {
		// clear after some timeout
		const xt_timeout = gc_notification.timeout!;
		if(Number.isFinite(xt_timeout) && xt_timeout >= 0) {
			setTimeout(() => {
				chrome.notifications?.clear(si_notifcation);
			}, xt_timeout || XT_TIMEOUT_DEFALUT_NOTIFICATION);
		}
	});
}
