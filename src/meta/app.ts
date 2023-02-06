import type {Nameable, Pfpable} from './able';
import type {AccountPath} from './account';
import type {ChainPath} from './chain';
import type {Resource} from './resource';
import type {List} from 'ts-toolbelt';
import type {Compute} from 'ts-toolbelt/out/Any/Compute';
import type {Range} from 'ts-toolbelt/out/Number/Range';

export interface AppPermissionRegistry {
	doxx: {
		value: {
			name?: boolean;
			address?: boolean;
		};
	};
	query: {
		value: {
			node?: boolean;
		};
	};
	broadcast: {
		value: {};
	};
	storage: {
		value: {
			capacity?: {
				log2x: List.UnionOf<Range<10, 30>>;  // min: 1 Kib, max: 1 GiB
			};
		};
	};
}

export type AppPermissionKey = keyof AppPermissionRegistry;

export type AppPermissionSet = {
	[si_key in AppPermissionKey]: AppPermissionRegistry[si_key]['value'];
};

export interface AppSchemeRegistry {
	http: {};
	https: {};
	file: {};
	wallet: {};
}

export type AppSchemeKey = keyof AppSchemeRegistry;

export type AppChainConnection = {
	accounts: AccountPath[];
	permissions: Partial<AppPermissionSet>;
};

export enum AppApiMode {
	UNKNOWN=0,
	STARSHELL=1,
	KEPLR=2,
}

export type App<
	si_host extends string=string,
	s_scheme extends AppSchemeKey=AppSchemeKey,
> = Resource.New<{
	segments: [`scheme.${s_scheme}`, `host.${si_host}`];
	struct: [{
		scheme: Compute<s_scheme>;
		host: si_host;
		on: 0 | 1;
		api: AppApiMode;
		connections: Record<ChainPath, AppChainConnection>;
	}, Nameable, Pfpable];
}>;

export type AppPath = Resource.Path<App>;
export type AppStruct = App['struct'];
export type AppIdent = Pick<AppStruct, 'scheme' | 'host'>;
