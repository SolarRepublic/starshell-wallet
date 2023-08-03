<script lang="ts" context="module">
	export type PfpFilter = ''|'testnet'|'hardware'|'obsolete'|'locked';
</script>

<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Nilable} from '#/meta/belt';
	import type {DevicePath} from '#/meta/device';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {createEventDispatcher} from 'svelte';
	
	import {yw_store_medias, yw_store_pfps} from '../mem';
	
	import {Devices} from '#/store/devices';
	import {Medias} from '#/store/medias';
	import {Pfps} from '#/store/pfps';
	import {F_NOOP} from '#/util/belt';
	
	import {dd} from '#/util/dom';
	
	import Put from '../ui/Put.svelte';
	
	import SX_ICON_HARDWARE from '#/icon/usb.svg?raw';

	import SX_ICON_LOCKED from '#/icon/lock.svg?raw';


	const dispatch = createEventDispatcher();

	/**
	 * Extract ref and name from a resource
	 */
	export let resource: (Pfpable & Nameable) | null = null;

	/**
	 * Resource path to the pfp
	 */
	export let path: PfpTarget | null | '' = resource?.pfp || '';

	/**
	 * Name to use for alt and fallback
	 */
	export let name = resource?.name || '';

	/**
	 * Square dimensions of the output element
	 */
	export let dim: number;

	/**
	 * Applies a predetermind styling to the border
	 */
	export let circular = false;
	export let appRelated = false;
	export let classes = '';
	const s_classes = (circular? '': appRelated? 'square app': 'square')+' '+classes;

	export let updates = 0;

	export let filter: PfpFilter = '';
	

	function filter_for(g_res: typeof resource) {
		if(g_res) {
			if(g_res['testnet']) return 'testnet';

			if(g_res['extra']?.device) return 'hardware';

			if(g_res['interfaces']?.['snip20']?.['extra']?.['migrate']) return 'obsolete';
		}

		return '';
	}

	// reactively assign filter when resource changes
	$: s_autofilter = filter_for(resource);

	/**
	 * Applies a predetermined styling to the background
	 */
	export let bg: 'satin' | undefined = void 0;
	const si_style_bg = bg;

	export let genStyle = '';

	// const sx_style_border_radius = (circular? `border-radius:${dim}px;`: '');

	const sx_style_gen = `width:${dim}px; height:${dim}px; `
		+(genStyle || '')
		+(path? `font-size:${dim}px;`: `font-size:${Math.round(dim * 0.55)}px;`);

	export let rootStyle = '';
	const sx_style_root = rootStyle;

	// fallback dom style to use for icon-dom element
	const sx_dom_style = sx_style_gen+`font-size:${Math.round(dim * 0.55)}px;`;

	export let settle: VoidFunction | undefined = void 0;

	let dm_pfp: Nilable<HTMLPictureElement> = null;
	async function load_pfp() {
		// load media store if it's not cached
		const ks_medias = $yw_store_medias || await Medias.read();

		// load pfp by ref
		try {
			dm_pfp = await Pfps.load(path!, {
				alt: name,
				dim: dim,
				medias: ks_medias,
			}, $yw_store_pfps);
		}
		catch(e_load) {}

		queueMicrotask(() => {
			dispatch('loaded');
		});

		if(dm_pfp) return dm_pfp;

		// fallback to icon dom
		dm_pfp = dd('span', {
			class: 'global_icon-dom',
			style: sx_dom_style,
		}, [name[0] as string || '']);


		// <!-- TODO: error placeholder -->
		// 			<!-- <span class="error">
		// 				⚠️
		// 			</span> -->
	}

	// reactively reload pfp when path changes (and on init)
	$: path, void load_pfp();  // eslint-disable-line @typescript-eslint/no-unused-expressions, no-sequences

	function settle_inner(): Promise<never> {
		if(settle) queueMicrotask(() => settle!());
		return new Promise(F_NOOP);
	}
</script>

<style lang="less">
	@import '../_base.less';

	.tile {
		display: inline-flex;
		vertical-align: middle;
		line-height: 0;
		cursor: pointer;

		&.satin {
			background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
		}

		.error {
			text-align: center;
		}

		&.app {
			outline: 1px solid var(--theme-color-border);
			border-radius: 4px;
		}

		&.circular {
			border-radius: 50%;

			img {
				:global(&) {
					border-radius: 50%;
				}
			}
		}
	}

	// .icon {
	// 	&.default {
	// 		// background-color: var(--theme-color-graysoft);
	// 		background-color: var(--theme-color-bg);
	// 		background: radial-gradient(ellipse farthest-side at bottom right, darken(@theme-color-black, 50%), var(--theme-color-bg));
	// 		outline: 1px solid var(--theme-color-primary);
	// 	}
	// }

	.filter {
		position: relative;
	}

	.filter-testnet {
		>* {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;

			&.original {
				// filter: invert(1);
			}

			&.border {
				background: rgb(131,58,180);
				background: linear-gradient(90deg, rgba(131,58,180,1) 0%, rgba(253,29,29,1) 50%, rgba(252,176,69,1) 100%);

				// // "T" border
				// clip-path: polygon(
				// 	01.32% 42.35%,
				// 	18.58% 19.93%,
				// 	104.06% 19.93%,
				// 	86.80% 42.35%,
				// 	62.52% 42.35%,
				// 	62.52% 94.74%,
				// 	36.61% 94.74%,
				// 	36.61% 42.35%
				// );

				clip-path: polygon(
					09.95% 42.35%,
					09.95% 19.93%,
					90.05% 19.93%,
					90.05% 42.35%,
					62.52% 42.35%,
					62.52% 94.74%,
					36.61% 94.74%,
					36.61% 42.35%
				);
			}

			&.overlay {
				filter: invert(1) contrast(0.5) blur(1.25px) contrast(2.5);
				opacity: 0.5;

				// // "T" shape
				// clip-path: polygon(
				// 	5.38% 40.35%,
				// 	19.56% 21.93%,
				// 	100% 21.93%,
				// 	85.81% 40.35%,
				// 	60.52% 40.35%,
				// 	60.52% 92.74%,
				// 	38.61% 92.74%,
				// 	38.61% 40.35%
				// );

				clip-path: polygon(
					12.47% 40.35%,
					12.47% 21.93%,
					87.53% 21.93%,
					87.53% 40.35%,
					60.52% 40.35%,
					60.52% 92.74%,
					38.61% 92.74%,
					38.61% 40.35%
				);
			}
		}
	}

	// brightness(0.55) contrast(0.7)
	.filter-locked {
		>.original,>.overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}

		>.overlay {
			filter: blur(1.25px) contrast(2.5);
			opacity: 0.5;

			clip-path: polygon(
				0% 60%,
				60% 60%,
				60% 100%,
				0% 100%
			);
		}

		>.badge {
			// position: absolute;
			// bottom: 0;
			// left: 0;
			// width: 50%;
			// height: 50%;

			// >svg {
			// 	width: 100%;
			// 	height: 100%;
			// 	margin-top: 12%;
			// }

			position: absolute;
			bottom: 0;
			left: 0;
			width: 70%;
			height: 0;

			>.global_svg-icon {
				width: 100%;
				height: auto;
				margin-top: -40%;
				background-color: rgba(0,0,0,0.6);
				padding: 0 15%;
				box-sizing: border-box;
				margin-left: -20%;
				border-radius: 20%;
				--icon-diameter: 100%;
			}
		}
	}

	.filter-hardware {
		>.original,>.overlay {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
		}

		>.overlay {
			filter: blur(1.25px) contrast(2.5);
			opacity: 0.5;

			clip-path: polygon(
				0% 60%,
				60% 60%,
				60% 100%,
				0% 100%
			);
		}

		>.badge {
			// position: absolute;
			// bottom: 0;
			// left: 0;
			// width: 50%;
			// height: 50%;

			// >svg {
			// 	width: 100%;
			// 	height: 100%;
			// 	margin-top: 12%;
			// }

			position: absolute;
			bottom: 0;
			left: 0;
			width: 70%;
			height: 0;

			>.global_svg-icon {
				width: 100%;
				height: auto;
				margin-top: -40%;
				background-color: rgba(0,0,0,0.6);
				padding: 0 15%;
				box-sizing: border-box;
				margin-left: -20%;
				border-radius: 20%;
				--icon-diameter: 100%;
			}
		}
	}

	.filter-obsolete {
		filter: grayscale(0.75) brightness(1.25);
	}
</style>

<!-- class:default={!k_icon}  -->
{#key updates || name || dim}
	<span class="global_pfp tile {s_classes}"
		class:satin={'satin' === si_style_bg}
		class:circular={circular}
		class:filter-obsolete={[filter, s_autofilter].includes('obsolete')}
		style={sx_style_root}
		data-path={path}
	>
		{#if !dm_pfp}
			<span class="global_icon-dom global_loading dynamic-pfp" style={sx_dom_style} data-pfp-args={JSON.stringify({
				alt: name,
				dim: dim,
			})}>
				⊚
			</span>
		{:else}
			{#if [filter, s_autofilter].includes('testnet')}
				<span class="filter filter-testnet" style="width:{dim}px; height:{dim}px;">
					<span class="original">
						<Put element={dm_pfp} />
					</span>
					<span class="border">
						
					</span>
					<span class="overlay">
						<Put element={dm_pfp} />
					</span>
				</span>
			{:else if [filter, s_autofilter].includes('hardware')}
				<span class="filter filter-hardware" style="width:{dim}px; height:{dim}px;">
					<span class="original">
						<Put element={dm_pfp} />
					</span>
					<!-- <span class="overlay">
						<Put element={dm_pfp} />
					</span> -->
					<span class="badge">
						<span class="global_svg-icon">
							{@html SX_ICON_HARDWARE}
						</span>
					</span>
				</span>
			{:else if [filter, s_autofilter].includes('locked')}
				<span class="filter filter-locked" style="width:{dim}px; height:{dim}px;">
					<span class="original">
						<Put element={dm_pfp} />
					</span>
					<span class="badge">
						<span class="global_svg-icon">
							{@html SX_ICON_LOCKED}
						</span>
					</span>
				</span>
			{:else}
				<Put element={dm_pfp} />
			{/if}

			{#await settle_inner() then _}_{/await}
		{/if}
	</span>
{/key}