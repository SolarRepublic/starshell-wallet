<script lang="ts">
	import type {ImageSet, PfpStruct, PfpPath, PfpTarget} from '#/meta/pfp';
	
	import {createEventDispatcher, onDestroy} from 'svelte';
	
	import {syserr} from '../common';
	
	import {render_icon_data} from '#/script/utils';
	import {B_MOBILE} from '#/share/constants';
	import {Medias} from '#/store/medias';
	import {Pfps} from '#/store/pfps';
	import {F_NOOP} from '#/util/belt';
	import {buffer_to_base64} from '#/util/data';
	import {dd} from '#/util/dom';
	
	import PfpDisplay from './PfpDisplay.svelte';
	
	import SX_ICON_IMAGE from '#/icon/image.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	
	const dispatch = createEventDispatcher();

	export let pfpPath: '' | PfpTarget;

	export let name = '';

	export let intent: 'token' | 'person' = 'token';
	const si_intent = intent;

	let g_pfp: PfpStruct;

	$: {
		if(pfpPath) {
			void Pfps.at(pfpPath as PfpPath).then(g => g? g_pfp = g: 0);
		}
	}

	let b_drop_target = false;
	let s_drop_error = '';

	function dragenter() {
		b_drop_target = true;
	}

	function dragleave() {
		b_drop_target = false;
	}

	async function drop(d_event: DragEvent) {
		const a_files = Array.from(d_event.dataTransfer?.files || []);

		return process_files(a_files);
	}

	/**
	 * Processes uploaded images, neutering SVGs by rasterizing them
	 */
	async function process_files(a_files: File[]) {
		if(!a_files.length) {
			s_drop_error = 'No files';
		}
		else if(a_files.length > 1) {
			s_drop_error = 'Too many files';
		}
		else {
			const d_file = a_files[0];
			if(!d_file.type.startsWith('image/')) {
				s_drop_error = 'File is not an image';
			}
			else if(!d_file.size) {
				s_drop_error = 'Empty file';
			}
			else if(d_file.size > 1024 * 1024) {
				s_drop_error = 'File too large';
			}
		}

		if(s_drop_error) {
			setTimeout(() => {
				s_drop_error = '';
			}, 2e3);
		}
		else {
			const d_file = a_files[0];
			const si_type = d_file.type;

			// load image data
			const atu8_image = new Uint8Array(await d_file.arrayBuffer());

			// create image element
			const dm_img = dd('img', {
				src: `data:${si_type};base64,${buffer_to_base64(atu8_image)}`,
			});

			// prep image set
			const h_images = {} as ImageSet;

			// render to canvas at desired resolutions
			const a_resolutions = [16, 32, 48, 64];
			for(const n_px_res of a_resolutions) {
				const sxb64_icon = render_icon_data(dm_img, n_px_res);

				// unable to render
				if(!sxb64_icon) {
					throw syserr({
						title: 'Unable to render image',
						text: `Your browser is not capable of rendering the uploaded image.`,
					});
				}

				// store to media
				const p_icon = await Medias.put('image', sxb64_icon);

				// add to image set
				h_images[n_px_res] = p_icon;
				h_images.default = p_icon;
			}

			// overwrite pfp
			g_pfp = {
				type: 'plain',
				image: h_images,
			};

			// save to store
			pfpPath = await Pfps.upsert(g_pfp);

			dispatch('upload', pfpPath);
		}

		b_drop_target = false;
	}

	let dm_input: HTMLInputElement;
	function upload_file() {
		const a_files = Array.from(dm_input.files || []);

		return process_files(a_files);
	}

	function clear() {
		pfpPath = '';
	}

	function drop_handler(d_event) {
		d_event.preventDefault();
	}
	
	addEventListener('drop', drop_handler);

	onDestroy(() => {
		removeEventListener('drop', drop_handler);
	});
</script>
	
<style lang="less">
	@import '../_base.less';

	.area {
		border: 1px dashed var(--theme-color-border);
		border-radius: 4px;
		position: relative;

		.drop-target-overlay {
			.absolute(100%);
			display: flex;
			align-items: center;
			justify-content: center;

			background-color: var(--theme-color-primary);
			color: var(--theme-color-text-dark);
			.font(big);

			&.error {
				background-color: var(--theme-color-caution);
	
				&>* {
					background-color: rgba(0,0,0,0.6);
					color: white;
					padding: 1em 2em;
					border-radius: 8px;
				}
			}
		}

		>.row {
			display: flex;
			justify-content: space-between;
			margin: var(--ui-padding);
			gap: 10px;

			>* {
				flex: auto;
			}

			>.left {
				flex: 0;
				flex-basis: 64px;
				display: flex;

				>.icon.pfp {
					:global(&) {
						--button-diameter: 64px;
						--icon-diameter: 64px;
					}
				}
			}

			>.right {
				flex: 3;
				padding: 0 calc(var(--ui-padding) / 2);
				margin-top: -4px;
				// padding-top: calc(var(--ui-padding) / 1.5);

				>.disclaimer {
					.font(tiny);

					>.warning {
						color: var(--theme-color-caution);
					}

					>.info {

					}
				}
			}

			// padding-bottom: 20px;

			.actions {
				color: var(--theme-color-primary);
				margin-top: 4px;

				display: flex;
				justify-content: space-between;

				// white-space: nowrap;
				// position: absolute;
				// margin-top: 4px;
				// margin-left: -4px;

				>* {
					cursor: pointer;

					&:hover {
						>.text {
							text-decoration: underline;
						}
					}

					>* {
						vertical-align: middle;
					}

					>.icon {
						--icon-color: var(--theme-color-primary);
						--icon-diameter: 20px;
					}
				}

				.upload {
					position: relative;
					width: fit-content;

					input[type="file"] {
						position: absolute;
						width: 100%;
						opacity: 0;
					}
				}
			}
		}
	}
</style>

<div class="area" class:intent-person={'person' === si_intent}
	class:drop-target={b_drop_target}
	on:dragenter|capture|stopPropagation={dragenter}
	on:dragover|preventDefault
	on:drop|preventDefault={drop}
>
	<div class="row">
		<span class="left">
			<PfpDisplay dim={64} path={pfpPath} name={name} circular={'token' === intent} />
		</span>

		<span class="right">
			<div class="disclaimer">
				<span class="warning">
					Notice:
				</span>
				<span class="info">
					Uploaded icons will be cropped to be {'token' === intent? 'circular': 'square'}. Only image files less than 1MB allowed.
					{#if !B_MOBILE}
						Drag and drop supported.
					{/if}
				</span>
			</div>

			<div class="actions">
				<div class="upload" on:click={() => F_NOOP}>
					<input type="file" name="upload-icon"
						bind:this={dm_input}
						accept="image/*"
						on:change={upload_file}
					/>

					<span class="global_svg-icon">
						{@html SX_ICON_IMAGE}
					</span>
					<span class="text">
						Upload Icon
					</span>
				</div>
				
				<div class="clear" on:click={() => clear()}>
					<span class="global_svg-icon">
						{@html SX_ICON_CLOSE}
					</span>
					<span class="text">
						Clear
					</span>
				</div>
			</div>
		</span>
	</div>

	{#if b_drop_target || s_drop_error}
		<span class="drop-target-overlay" class:error={!!s_drop_error}
			on:dragleave|capture|self={dragleave}
		>
			<span>
				{s_drop_error? `❌ ${s_drop_error}`: 'Upload image file'}
			</span>
		</span>
	{/if}
</div>
