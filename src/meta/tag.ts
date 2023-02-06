import type {Nameable} from './able';
import type {Resource} from './resource';


export type Tag = Resource.New<{
	segment: `tag.${number}`;
	struct: [{
		index: number;
		color: string;
		info: string;
	}, Nameable];
}>;

export type TagPath = Resource.Path<Tag>;
export type TagStruct = Tag['struct'];
