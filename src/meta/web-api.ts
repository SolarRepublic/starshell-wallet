import type {StringFormat} from './belt';
import type {Resource} from './resource';
import type {MergeAll} from 'ts-toolbelt/out/Object/MergeAll';

import type {Dict, JsonObject as JsonObjectRaw, JsonValue as JsonValue} from '#/meta/belt';

export namespace ResponseCache {
	export type Text = {
		type: 'text';
		cache: string;
	};

	export type JsonAny = {
		type: 'json-any';
		cache: JsonAny;
	};

	export type JsonObject = {
		type: 'json-object';
		cache: JsonObjectRaw;
	};

	export type JsonArray = {
		type: 'json-array';
		cache: JsonValue[];
	};

	export type Binary = {
		type: 'binary';
		cache: StringFormat<Uint8Array>;
	};
}

export type ResponseCache =
	| ResponseCache.Text
	| ResponseCache.JsonAny
	| ResponseCache.JsonObject
	| ResponseCache.JsonArray
	| ResponseCache.Binary;

export type WebApi<
	g_response extends ResponseCache=ResponseCache,
	p_path extends string=string,
	s_hash extends string=string,
> = Resource.New<{
	segments: ['cache.web-api', `sha256.${s_hash}`];
	struct: MergeAll<{
		path: p_path;
		hash: s_hash;
		response: g_response;
		time: number;
	}, [
		{
			method: 'GET';
			params?: Dict;
		},
	]>;
}>;

export type WebApiPath = Resource.Path<WebApi>;
