import {B_FIREFOX_ANDROID, NL_DATA_ICON_MAX, R_DATA_IMAGE_URL_WEB, SI_EXTENSION_ID_KEPLR} from '#/share/constants';
import {timeout_exec} from '#/util/belt';

/**
 * Locate a script asset in the extension bundle by its path prefix.
 * @param s_pattern the path prefix
 * @returns fully qualified URL to the asset, or `null` if not found
 */
export function locate_script(s_pattern: string): null | string {
	const g_manifest = chrome.runtime.getManifest();

	// each content script entry
	for(const g_script of g_manifest.content_scripts || []) {
		for(const sr_script of g_script.js ?? []) {
			// the right half of the OR and the regex below are for firefox
			if(sr_script.startsWith(s_pattern) || sr_script.startsWith(chrome.runtime.getURL(s_pattern))) {
				return sr_script.replace(/^[^:]+:\/\/[^/]+\//, '');
			}
		}
	}

	// each web accessible resource
	for(const z_resource of g_manifest.web_accessible_resources || []) {
		// in manifest v2
		if('string' === typeof z_resource) {
			if(z_resource.startsWith(s_pattern)) {
				return z_resource;
			}
		}
		// in manifest v3
		else {
			for(const sr_script of z_resource.resources) {
				if(sr_script.startsWith(s_pattern)) {
					return sr_script;
				}
			}
		}
	}

	return null;
}



// timeout duration for loading icon
const XT_TIMEOUT_LOAD_ICON = 4e3;

// reusable canvas 2d context
let dm_canvas_shared: HTMLCanvasElement | null = null;
let d_2d_shared: CanvasRenderingContext2D | null = null;

function prepare_canvas(): boolean {
	// already attempted to load 2d context and failed
	if(dm_canvas_shared && !d_2d_shared) return false;

	// haven't tried creating 2d context yet; prep canvas and 2d context
	if(!dm_canvas_shared) {
		dm_canvas_shared = document.createElement('canvas');
		d_2d_shared = dm_canvas_shared.getContext('2d');
	}

	// 2d context is not available; skip render icon
	if(!d_2d_shared) return false;

	// success
	return true;
}

interface Rect {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/**
 * Renders the given image element into a data URL
 */
export function render_icon_data(
	d_img: HTMLImageElement,
	npx_dim_dst=256,
	fk_init?: (d_2d: CanvasRenderingContext2D, dm_canvas: HTMLCanvasElement) => void,
	sx_media_type: string | null=null,
	g_trim: null|Rect=null
): string | undefined {
	// canvas or rendering unavailable
	if(!prepare_canvas()) return;

	// ref objects
	const dm_canvas = dm_canvas_shared!;
	const d_2d = d_2d_shared!;

	// resize canvas
	dm_canvas.width = dm_canvas.height = npx_dim_dst;

	// clear background
	d_2d.clearRect(0, 0, dm_canvas.width, dm_canvas.height);

	// init callback
	if(g_trim) {
		fk_init?.(d_2d, dm_canvas);
	}

	// trim to apply
	const g_trim_apply = g_trim || {
		x1: 0,
		y1: 0,
		x2: npx_dim_dst,
		y2: npx_dim_dst,
	};

	// compute src width and height
	const npx_trim_width = g_trim_apply.x2 - g_trim_apply.x1;
	const npx_trim_height = g_trim_apply.y2 - g_trim_apply.y1;

	// should always be the same
	const npx_dim_trim = Math.max(npx_trim_width, npx_trim_height);

	// image is svg; work around annoying intrinsic size canvas interaction
	if(sx_media_type?.startsWith('image/svg')) {
		if(g_trim) {
			// move top-left corner of image to origin
			d_2d.translate(g_trim.x1, g_trim.y1);

			// scale to fit bounds
			const xs_scale = npx_dim_dst / npx_dim_trim;
			d_2d.scale(xs_scale, xs_scale);

			// draw image same as before, using image's intrinsic dimensions
			d_2d.drawImage(d_img, 0, 0, npx_dim_dst, npx_dim_dst);
		}
		else {
			d_2d.drawImage(d_img, 0, 0, npx_dim_dst, npx_dim_dst);
		}
	}
	// draw image to canvas, centered along both axes
	else {
		const npx_src_w = d_img.naturalWidth;
		const npx_src_h = d_img.naturalHeight;

		const npx_src_dim = Math.min(npx_src_w, npx_src_h);
		const npx_src_semidim = npx_src_dim / 2;

		const npx_src_x = (npx_src_w / 2) - npx_src_semidim;
		const npx_src_y = (npx_src_h / 2) - npx_src_semidim;

		const ipx_out_x = npx_src_x + g_trim_apply.x1;
		const ipx_out_y = npx_src_y + g_trim_apply.y1;

		d_2d.drawImage(d_img,
			ipx_out_x, ipx_out_y,
			Math.min(npx_src_dim, npx_trim_width), Math.min(npx_src_dim, npx_trim_height),
			0, 0, npx_dim_dst, npx_dim_dst);
	}

	// check for transparent pixels along edges
	if(!g_trim) {
		const {
			width: npx_width,
			height: npx_height,
			data: atu8_data,
		} = d_2d.getImageData(0, 0, npx_dim_dst, npx_dim_dst);

		let ipx_y_lo = 0;
		TOP_ROWS:
		for(; ipx_y_lo<npx_height-1; ipx_y_lo++) {
			for(let ipx_x=0; ipx_x<npx_width; ipx_x++) {
				if(0 !== atu8_data[(ipx_y_lo * npx_width * 4) + (ipx_x * 4) + 3]) {
					break TOP_ROWS;
				}
			}
		}

		let ipx_y_hi = npx_height - 1;
		BTM_ROWS:
		for(; ipx_y_hi>ipx_y_lo; ipx_y_hi--) {
			for(let ipx_x=0; ipx_x<npx_width; ipx_x++) {
				if(0 !== atu8_data[(ipx_y_hi * npx_width * 4) + (ipx_x * 4) + 3]) {
					break BTM_ROWS;
				}
			}
		}

		let ipx_x_lo = 0;
		LFT_ROWS:
		for(; ipx_x_lo<npx_width-1; ipx_x_lo++) {
			for(let ipx_y=ipx_y_lo; ipx_y<ipx_y_hi; ipx_y++) {
				if(0 !== atu8_data[(ipx_y * npx_width * 4) + (ipx_x_lo * 4) + 3]) {
					break LFT_ROWS;
				}
			}
		}

		let ipx_x_hi = npx_width - 1;
		RGT_ROWS:
		for(; ipx_x_hi>ipx_x_lo; ipx_x_hi--) {
			for(let ipx_y=ipx_y_lo; ipx_y<ipx_y_hi; ipx_y++) {
				if(0 !== atu8_data[(ipx_y * npx_width * 4) + (ipx_x_hi * 4) + 3]) {
					break RGT_ROWS;
				}
			}
		}

		// adjust his to outset
		ipx_x_hi += 1;
		ipx_y_hi += 1;

		// trimmable edges
		const npx_span_x = ipx_x_hi - ipx_x_lo;
		const npx_span_y = ipx_y_hi - ipx_y_lo;
		// if(npx_span_x < npx_width && npx_span_y < npx_height) {
			// trim squarely
		const npx_dim_new = Math.max(npx_span_x, npx_span_y);

		const npxx_half_span = npx_dim_new / 2;
		const ipxx_mid_x = (ipx_x_lo + ipx_x_hi) / 2;
		const ipxx_mid_y = (ipx_y_lo + ipx_y_hi) / 2;

		const g_rect: Rect = {
			x1: Math.floor(ipxx_mid_x - npxx_half_span),
			x2: Math.ceil(ipxx_mid_x + npxx_half_span),
			y1: Math.floor(ipxx_mid_y - npxx_half_span),
			y2: Math.ceil(ipxx_mid_y + npxx_half_span),
		};

		return render_icon_data(d_img, npx_dim_dst, fk_init, sx_media_type, g_rect);
		// }
	}

	// render data url
	const sx_data = B_FIREFOX_ANDROID? dm_canvas.toDataURL('image/png', 1): dm_canvas.toDataURL('image/webp', 1);

	// data URL is invalid or too large; don't use it
	if(!R_DATA_IMAGE_URL_WEB.test(sx_data) || sx_data.length > NL_DATA_ICON_MAX) {
		console.warn(`StarShell is rejecting data URL since it does not meet requirements`);
		return;
	}

	return sx_data;
}


/**
 * Loads the given image URL and generates a data URL
 */
export async function load_icon_data(p_image: string, n_px_dim=256): Promise<string | undefined> {
	// canvas or rendering unavailable
	if(!prepare_canvas()) return;

	// prep image element
	const d_img = new Image();
	d_img.crossOrigin = '';

	// wait for it to load
	d_img.loading = 'eager';

	// attempt to load the icon
	try {
		const [, b_timed_out] = await timeout_exec(XT_TIMEOUT_LOAD_ICON, () => new Promise((fk_resolve, fe_reject) => {
			// image failed to load
			d_img.addEventListener('error', (e_load) => {
				// print error
				console.error(e_load);

				// print informative error and reject promise
				const s_error = `StarShell encountered an error while trying to load icon <${p_image}>. Is the URL correct?`;
				fe_reject(new Error(s_error));
			});

			// image loaded successfully
			d_img.addEventListener('load', () => {
				// verbose
				console.debug(`📥 StarShell loaded icon from application <${p_image}>`);

				// resolve promise
				fk_resolve(void 0);
			}, false);

			// begin loading
			d_img.src = p_image;
		}));

		if(b_timed_out) {
			throw new Error(`StarShell waited more than ${Math.round(XT_TIMEOUT_LOAD_ICON / 1e3)}s for icon to load <${p_image}>`);
		}
	}
	// load error or did not load in time; jump to end
	catch(e_load) {
		console.error(e_load);
		return;
	}

	// attempt to get media type
	let sx_media_type: string | null = null;
	try {
		sx_media_type = (await fetch(d_img.src, {
			method: 'HEAD',
			// cache: 'only-if-cached',
		})).headers.get('Content-Type');
	}
	catch(e_fetch) {
		console.warn(e_fetch);
	}

	return render_icon_data(d_img, n_px_dim, (d_2d) => {
		// fill canvas with destination background color
		d_2d.fillStyle = '#000000';
		d_2d.fillRect(0, 0, n_px_dim, n_px_dim);
	}, sx_media_type);
}

export enum KeplrExtensionState {
	UNKNOWN,
	NOT_INSTALLED,
	DISABLED,
	ENABLED,
}

export async function keplr_extension_state(): Promise<KeplrExtensionState> {
	if('function' === typeof chrome.management?.get) {
		let g_keplr: chrome.management.ExtensionInfo;
		try {
			g_keplr = await chrome.management.get(SI_EXTENSION_ID_KEPLR);
		}
		// not installed
		catch(e_get) {
			return KeplrExtensionState.NOT_INSTALLED;
		}

		// keplr is installed and enabled
		return g_keplr.enabled? KeplrExtensionState.ENABLED: KeplrExtensionState.DISABLED;
	}

	return KeplrExtensionState.UNKNOWN;
}
