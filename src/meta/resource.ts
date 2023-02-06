import type {Auto} from './belt';
import type {Append} from 'ts-toolbelt/out/List/Append';

import type {Concat} from 'ts-toolbelt/out/List/Concat';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {MergeAll} from 'ts-toolbelt/out/Object/MergeAll';
import type {Join} from 'ts-toolbelt/out/String/Join';

import type {JsonObject} from '#/meta/belt';

// root data type for all individuals
export type Resource<
	g_struct extends JsonObject=JsonObject,
	a_segments extends string[]=string[],
> = {
	struct: g_struct;
	segments: a_segments;
};


export namespace Resource {
	export type Base = Resource<{}, ['']>;

	export type Config = {
		extends?: Resource;
		segment?: string;
		segments?: string[];
		struct: JsonObject | JsonObject[];
	};

	export type New<
		gc_resource extends Config,
	> = Auto<gc_resource['extends'], Resource, Base> extends Resource<infer g_iface_parent, infer a_segs_parent>
		? Resource<
			Merge<
				gc_resource['struct'] extends JsonObject[]
					? MergeAll<{}, gc_resource['struct']>
					: gc_resource['struct'] extends any[]
						? never
						: gc_resource['struct'],
				g_iface_parent
			>,
			gc_resource['segment'] extends `${infer s_segment}`
				// append single `segment` to path
				? Append<a_segs_parent, s_segment>
				: gc_resource['segments'] extends string[]
					// append multiple `segments` to path
					? Concat<
						a_segs_parent,
						gc_resource['segments']
					>
					// use parent's path
					: a_segs_parent
		>
		: never;

	export type Path<
		g_resource extends Resource=Resource,
	> = [string[]] extends [g_resource['segments']]
		? `${string}`
		: Join<g_resource['segments'], '/'>;
}
