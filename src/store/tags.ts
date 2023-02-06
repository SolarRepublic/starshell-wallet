import type {Resource} from '#/meta/resource';
import type {TagPath, TagStruct} from '#/meta/tag';

import {
	create_store_class,
	WritableStore,
} from './_base';

import {SI_STORE_TAGS} from '#/share/constants';


// eslint-disable-next-line @typescript-eslint/naming-convention
export const Tags = create_store_class({
	store: SI_STORE_TAGS,
	class: class TagsI extends WritableStore<typeof SI_STORE_TAGS> {
		static tagPathFor(g_tag: TagStruct): TagPath {
			return `/tag.${g_tag.index}`;
		}

		getTag(i_tag: number): TagStruct | null {
			return this._w_cache.registry[i_tag] ?? null;
		}

		getIdsFor(p_resource: Resource.Path): number[] {
			return this._w_cache.map[p_resource] ?? [];
		}

		getTagsFor(p_resource: Resource.Path): TagStruct[] {
			return this.getIdsFor(p_resource).map(i_tag => this.getTag(i_tag)!).filter(g => !!g);
		}

		setIdsFor(p_ressource: Resource.Path, a_ids: number[]): Promise<void> {
			// update cache
			this._w_cache.map[p_ressource] = a_ids;

			// save store
			return this.save();
		}

		setTagsFor(p_resource: Resource.Path, a_tags: TagStruct[]): Promise<void> {
			return this.setIdsFor(p_resource, a_tags.map(g => g.index));
		}
	},
});

