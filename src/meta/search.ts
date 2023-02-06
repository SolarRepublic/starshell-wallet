import type {Nameable, Pfpable} from './able';
import type {Dict, JsonValue, Promisable} from './belt';
import type {Resource} from './resource';

import type {ClassType} from '#/app/def';
import type {StaticStore, WritableStoreMap} from '#/store/_base';

export interface SearchItem {
	class: ClassType;
	resourcePath: Resource.Path;
	name: string;
	resource: Resource['struct'] & Nameable & Pfpable;
	details: Dict<JsonValue>;
}

export interface ExpoundedRow {
	detail?: string;
}

export interface SearchGroup {
	source: Promisable<typeof WritableStoreMap & StaticStore | Array<any>>;
	transform(g_thing: Resource['struct']): Omit<SearchItem, 'ref'>;
	keys: string[];
}
