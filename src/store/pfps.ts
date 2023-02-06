import type {Dict} from '#/meta/belt';
import type {ImageMedia, ImageMediaTarget} from '#/meta/media';
import type {ImageSet, Pfp, PfpStruct, PfpPath, PfpTarget} from '#/meta/pfp';
import type {Resource} from '#/meta/resource';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {Medias} from './medias';

import {SessionStorage} from '#/extension/session-storage';
import {R_DATA_IMAGE_URL_ANY, SI_STORE_PFPS} from '#/share/constants';
import {text_to_base64, uuid_v4} from '#/util/data';
import {dd} from '#/util/dom';


export type RenderConfig = {
	alt?: string;
	dim: number;
	medias: InstanceType<typeof Medias>;
};

function read_image_data(ks_medias: RenderConfig['medias'], p_media: ImageMediaTarget | undefined): string | null {
	// no media data
	if(!p_media) return null;

	// correct type of data URL
	if(R_DATA_IMAGE_URL_ANY.test(p_media)) {
		return p_media;
	}

	// attempt to locate item in storage
	return ks_medias.at(p_media as Resource.Path<ImageMedia>)?.data || null;
}

function picture(h_image: ImageSet, gc_render: RenderConfig, h_attrs: Dict={}): HTMLPictureElement {
	// destructure resolutions
	const {
		default: p_default,
		16: p_16,
		32: p_32,
		48: p_48,
		64: p_64,
		96: p_96,
		128: p_128,
		256: p_256,
	} = h_image;

	// ref medias store
	const ks_medias = gc_render.medias;

	// read each resolution
	const sx_16 = read_image_data(ks_medias, p_16);
	const sx_32 = read_image_data(ks_medias, p_32);
	const sx_48 = read_image_data(ks_medias, p_48);
	const sx_64 = read_image_data(ks_medias, p_64);
	const sx_96 = read_image_data(ks_medias, p_96);
	const sx_128 = read_image_data(ks_medias, p_128);
	const sx_256 = read_image_data(ks_medias, p_256);
	const sx_default = read_image_data(ks_medias, p_default)!;

	const sx_any_x = sx_16 || sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;

	const x_dim_1x = gc_render.dim;
	const x_dim_2x = x_dim_1x * 2;

	let sx_1x: string | null = null;
	let sx_2x: string | null = null;

	// some option exists
	if(sx_any_x) {
		// 1x resolution
		if(x_dim_1x <= 64) {
			if(x_dim_1x <= 32) {
				if(x_dim_1x <= 16) {
					sx_1x = sx_any_x;
				}
				else {
					sx_1x = sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
				}
			}
			else if(x_dim_1x <= 48) {
				sx_1x = sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
			}
			else {
				sx_1x = sx_64 || sx_96 || sx_128 || sx_256;
			}
		}
		else if(x_dim_1x <= 128) {
			if(x_dim_1x <= 96) {
				sx_1x = sx_96 || sx_128 || sx_256;
			}
			else {
				sx_1x = sx_128 || sx_256;
			}
		}
		else if(x_dim_1x <= 256) {
			sx_1x = sx_256;
		}

		// 2x resolution
		if(x_dim_2x <= 64) {
			if(x_dim_2x <= 32) {
				if(x_dim_2x <= 16) {
					sx_2x = sx_any_x;
				}
				else {
					sx_2x = sx_32 || sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
				}
			}
			else if(x_dim_2x <= 48) {
				sx_2x = sx_48 || sx_64 || sx_96 || sx_128 || sx_256;
			}
			else {
				sx_2x = sx_64 || sx_96 || sx_128 || sx_256;
			}
		}
		else if(x_dim_2x <= 128) {
			if(x_dim_2x <= 96) {
				sx_2x = sx_96 || sx_128 || sx_256;
			}
			else {
				sx_2x = sx_128 || sx_256;
			}
		}
		else if(x_dim_2x <= 256) {
			sx_2x = sx_256;
		}
	}

	// picture element
	return dd('picture', {
		...h_attrs,
	}, [
		// 2x version
		...sx_2x? [dd('source', {
			srcset: sx_2x,
			media: '(min-resolution: 2dppx)',
		})]: [],

		// default img
		dd('img', {
			src: sx_1x || sx_default,
			alt: gc_render.alt || '',
		}),
	]);
}

type SavedPfpEntry = [PfpPath<'plain'>, PfpStruct<'plain'>];

export const Pfps = create_store_class({
	store: SI_STORE_PFPS,
	extension: 'map',
	class: class PfpI extends WritableStoreMap<typeof SI_STORE_PFPS> {
		// static pathFrom(g_pfp: PfpStruct): PfpPath {
		// 	return `/template.pfp/id.${hash_json(g_pfp)}`;
		// }

		static async load(p_pfp: PfpTarget, gc_render: RenderConfig, ks_pfps?: PfpI | null): Promise<HTMLPictureElement | null> {
			// session storage ref
			if(p_pfp.startsWith('pfp:')) {
				// load data URL from session storage
				const p_data = await SessionStorage.get(p_pfp as `pfp:${string}`);

				// nothing to render
				if(!p_data) return null;

				// render data URL
				return Pfps.render({
					type: 'plain',
					image: {
						default: p_data,
					},
				}, gc_render);
			}
			// direct svg
			else if(p_pfp.startsWith('svg:')) {
				// render data URL
				return Pfps.render({
					type: 'plain',
					image: {
						default: p_pfp.slice('svg:'.length),
					},
				}, gc_render);
			}
			// store ref
			else {
				const g_pfp = ks_pfps? ks_pfps.at(p_pfp as Resource.Path<Pfp>): await Pfps.at(p_pfp as Resource.Path<Pfp>);

				if(!g_pfp) return null;

				return Pfps.render(g_pfp, gc_render);
			}
		}

		static async createUrlFromDefault(p_pfp: PfpTarget): Promise<string | null> {
			const ks_medias = await Medias.read();

			// session storage ref
			if(p_pfp.startsWith('pfp:')) {
				// load data URL from session storage
				const p_data = await SessionStorage.get(p_pfp as `pfp:${string}`);

				// nothing to render
				if(!p_data) return null;

				// render data URL
				return read_image_data(ks_medias, p_data as ImageMediaTarget);
			}
			// direct svg
			else if(p_pfp.startsWith('svg:')) {
				// render data URL
				return p_pfp.slice('svg:'.length);
			}
			// store ref
			else {
				const g_pfp = await Pfps.at(p_pfp as Resource.Path<Pfp>);

				if(!g_pfp) return null;

				if('plain' !== g_pfp.type) return null;

				return read_image_data(ks_medias, g_pfp.image.default);
			}
		}

		static render(g_pfp: PfpStruct, gc_render: RenderConfig): HTMLPictureElement | null {
			// dimension styling
			const sx_style_picture = `width:${gc_render.dim}px; height:${gc_render.dim}px;`;

			// depending on pfp type
			switch(g_pfp.type) {
				// plain pfp type
				case 'plain': {
					return picture(g_pfp.image, gc_render, {
						class: 'global_pfp',
						style: sx_style_picture,
					});
				}

				// a pair of icons of equal visual significance
				case 'pair': {
					break;
				}

				// a composite consisting of a foreground icon and background icon
				case 'composite': {
					break;
				}

				default: {
					// TODO: log error
				}
			}

			return null;
		}

		static async addSvg(dm_svg: SVGSVGElement): Promise<SavedPfpEntry> {
			// serialize svg
			const sx_pfpg = dm_svg.outerHTML;

			// remove some extraneous whitespace
			sx_pfpg.replace(/(>)\s+(<)|([{;])\s+/g, '$1$2$3');

			// add as data
			return Pfps.addData(`data:image/svg+xml;base64,${text_to_base64(sx_pfpg)}`);
		}

		static async addData(sx_data: string): Promise<SavedPfpEntry> {
			// save media
			const p_media = await Medias.put('image', sx_data);

			// prep struct
			const g_pfp: PfpStruct<'plain'> = {
				type: 'plain',
				image: {
					default: p_media,
				},
			};

			// save pfp
			const p_pfp = await Pfps.open(ks => ks.upsert(g_pfp));

			// return path and struct of new item
			return [p_pfp, g_pfp];
		}

		static upsert(g_pfp: PfpStruct): Promise<PfpPath> {
			return Pfps.open(ks => ks.upsert(g_pfp));
		}

		async upsert(g_pfp: PfpStruct): Promise<PfpPath> {
			// generate pfp path
			const p_pfp: PfpPath = `/template.pfp/uuid.${uuid_v4()}`;

			// update cache
			this._w_cache[p_pfp] = g_pfp;

			// attempt to save
			await this.save();

			// return path to new item
			return p_pfp;
		}

		// async update(p_pfp: PfpPath, g_pfp: PfpStruct): Promise<void> {
		// 	// item does not exist
		// 	if(!this._w_cache[p_pfp]) {
		// 		throw new Error(`Attempted to update a PFP item that does not exist: <${p_pfp}>`);
		// 	}

		// 	// update cache
		// 	this._w_cache[p_pfp] = g_pfp;

		// 	// attempt to save
		// 	await this.save();
		// }
	},
});

