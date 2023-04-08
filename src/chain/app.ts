import type {AppIdent, AppStruct} from '#/meta/app';

import {SessionStorage} from '#/extension/session-storage';
import type {AppProfile} from '#/store/apps';

export async function load_app_profile(g_app: AppIdent): Promise<AppProfile | void> {
	const p_profile = `profile:${g_app.scheme}://${g_app.host}` as const;

	const g_profile = await SessionStorage.get(p_profile);
	if(!g_profile) return;

	return g_profile;
}

export async function inject_app_profile(g_app: AppStruct, g_fill: Partial<AppProfile>): Promise<AppProfile> {
	const p_profile = `profile:${g_app.scheme}://${g_app.host}` as const;

	const g_profile = await SessionStorage.get(p_profile) || {
		contracts: {},
		pfps: {},
	};

	Object.assign(g_profile, {
		contracts: {
			...g_profile.contracts || {},
			...g_fill.contracts,
		},
		accounts: {
			...g_profile.accounts || {},
			...g_fill.accounts,
		},
	});

	await SessionStorage.set({
		[p_profile]: g_profile,
	});

	return g_profile;
}

