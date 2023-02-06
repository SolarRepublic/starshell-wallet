import type {AccountPath, AccountStruct} from './account';
import type {AppPath, AppStruct} from './app';
import type {Promisable} from './belt';
import type {Bech32, ChainPath, ChainStruct} from './chain';
import type {PfpTarget} from './pfp';
import type {SecretPath} from './secret';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';

export type ResourceFieldRegistry = {
	app: {
		path: AppPath;
		struct: AppStruct;
	};

	chain: {
		path: ChainPath;
		struct: ChainStruct;
	};

	account: {
		path: AccountPath;
		struct: AccountStruct;
	};
};

export type ResourceFieldKey = keyof ResourceFieldRegistry;

export type FieldConfigRegistry = {
	key_value: {
		key: string;
		long?: boolean;
		value: Promisable<string | HTMLElement>;
		after?: HTMLElement[];
		subvalue?: Promisable<string>;
		render?: 'address' | 'mono' | 'error';
		pfp?: PfpTarget;
	};

	memo: {
		text: string;
	};

	transaction: {
		hash: string;
		chain: ChainStruct;
		label?: string;
	};

	links: {
		value: Promisable<{
			href: string;
			text: string;
			icon?: string;
		}[]>;
	};

	password: {
		value: string;
		label?: string;
	};

	resource: Merge<{
		label?: string;
		short?: boolean;
	}, {
		[si_each in ResourceFieldKey]: Merge<{
			resourceType: si_each;
		}, {
			path: ResourceFieldRegistry[si_each]['path'];
		} | {
			struct: ResourceFieldRegistry[si_each]['struct'];
		}>;
	}[ResourceFieldKey]>;

	contacts: {
		label?: string;
		bech32s: Bech32[];
		g_chain: ChainStruct;
		short?: boolean;
	};

	accounts: {
		label?: string;
		paths: AccountPath[];
		short?: boolean;
	};

	apps: {
		paths: AppPath[];
		label?: string;
		short?: boolean;
	};

	contracts: {
		label?: string;
		bech32s: Promisable<Bech32[] | Record<Bech32, any>>;
		g_chain: ChainStruct;
		g_app?: AppStruct;
	};

	dom: {
		dom: HTMLElement;
		title?: string;
		unlabeled?: boolean;
	};

	slot: {
		index: 0 | 1 | 2;
		data?: any;
	};

	gap: {
		brutal?: boolean;
	};

	group: {
		fields: Promisable<FieldConfig[]>;
		flex?: boolean;
		vertical?: boolean;
		expanded?: boolean;
	};

	query_permit: {
		secret: SecretPath<'query_permit'>;
	};

};

export type FieldConfigKey = keyof FieldConfigRegistry;

export type FieldConfig<
	si_key extends FieldConfigKey=FieldConfigKey,
> = Promisable<{
	[si_each in FieldConfigKey]: Merge<FieldConfigRegistry[si_each], {
		type: si_each;
	}>;
}[si_key]>;
