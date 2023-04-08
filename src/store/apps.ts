import type {Replace} from 'ts-toolbelt/out/String/Replace';

import type {App, AppStruct, AppPath, AppSchemeKey} from '#/meta/app';
import {AppApiMode} from '#/meta/app';
import type {Dict, JsonObject} from '#/meta/belt';
import type {ContractStruct} from '#/meta/chain';
import type {ContactStruct} from '#/meta/contact';
import type {Resource} from '#/meta/resource';

import {create_store_class, WritableStoreMap} from './_base';
import {H_LOOKUP_PFP} from './_init';

import {SI_STORE_APPS} from '#/share/constants';

export interface AppFilterConfig extends Partial<AppStruct> {}

export interface AppProfile extends JsonObject {
	name?: string | null | undefined;
	pfps?: Dict;
	contracts?: Dict<ContractStruct>;
	accounts?: Dict<ContactStruct>;
}


export const Apps = create_store_class({
	store: SI_STORE_APPS,
	extension: ['map', 'filterable'],
	class: class AppsI extends WritableStoreMap<typeof SI_STORE_APPS> {
		static pathFor<
			s_host extends string,
			s_scheme extends AppSchemeKey,
			g_app extends App<Replace<s_host, ':', '+'>, s_scheme>,
		>(s_host: s_host, s_scheme: s_scheme): Resource.Path<g_app> {
			return `/scheme.${s_scheme.replace(/:+$/, '')}/host.${s_host.replace(/:/g, '+')}` as Resource.Path<g_app>;
		}

		static pathFrom<
			g_app extends App,
		>(g_app: AppStruct): Resource.Path<g_app> {
			return AppsI.pathFor(g_app.host, g_app.scheme);
		}

		static parsePath(p_app: AppPath): [AppSchemeKey, string] {
			const [, s_scheme, s_host] = /^\/scheme\.([^/]+)\/host\.(.+)$/.exec(p_app)!;
			return [s_scheme as AppSchemeKey, s_host];
		}

		static scriptMatchPatternFrom<
			g_app extends App,
		>(g_app: AppStruct): `${g_app['struct']['scheme']}://${g_app['struct']['host']}/*` {
			return `${g_app.scheme}://${g_app.host}/*` as `${g_app['struct']['scheme']}://${g_app['struct']['host']}/*`;
		}

		static async get(s_host: string, s_scheme: AppSchemeKey | `${AppSchemeKey}:`): Promise<null | AppStruct> {
			return (await Apps.read()).get(s_host, s_scheme.replace(/:$/, '') as AppSchemeKey);
		}

		/**
		 * Adds a new app only if it does not yet exist
		 */
		static async add(g_app: AppStruct): Promise<void> {
			// derive app path
			const p_app = Apps.pathFrom(g_app);

			// save app def to storage
			await Apps.open(ks => ks._w_cache[p_app]? void 0: ks.put(g_app));
		}

		static async put(g_app: AppStruct): Promise<void> {
			// save app def to storage
			return await Apps.open(ks => ks.put(g_app));
		}

		override at(p_app: AppPath, b_null_for_unfound=false): AppStruct {
			const [s_scheme, s_host] = Apps.parsePath(p_app);

			if('wallet' === s_scheme) {
				return H_WALLET_APPS[s_host] || G_APP_NULL;
			}

			return this._w_cache[p_app] || (b_null_for_unfound? null: G_APP_NOT_FOUND);
		}

		get(s_host: string, s_scheme: AppSchemeKey): AppStruct | null {
			// prepare app path
			const p_app = AppsI.pathFor(s_host, s_scheme);

			// fetch
			return this._w_cache[p_app] ?? null;
		}

		async put(g_app: AppStruct): Promise<void> {
			// prepare app path
			const p_app = AppsI.pathFor(g_app.host, g_app.scheme);

			// update cache
			this._w_cache[p_app] = g_app;

			// attempt to save
			await this.save();
		}
	},
});


export const G_APP_STARSHELL: AppStruct = {
	scheme: 'wallet',
	on: 1,
	host: 'StarShell',
	api: AppApiMode.STARSHELL,
	connections: {},
	name: 'StarShell',
	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
};

export const P_APP_STARSHELL = Apps.pathFrom(G_APP_STARSHELL);

export const G_APP_EXTERNAL: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'External',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'Some External Source',
	pfp: '',
};

export const P_APP_EXTERNAL = Apps.pathFrom(G_APP_EXTERNAL);

export const G_APP_NULL: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'null',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'null',
	pfp: '',
};

export const G_APP_NOT_FOUND: AppStruct = {
	scheme: 'wallet',
	on: 0,
	host: 'not-found',
	api: AppApiMode.UNKNOWN,
	connections: {},
	name: 'App not found',
	pfp: '',
};

export const H_WALLET_APPS = {
	[G_APP_STARSHELL.host]: G_APP_STARSHELL,
	[G_APP_EXTERNAL.host]: G_APP_EXTERNAL,
};

