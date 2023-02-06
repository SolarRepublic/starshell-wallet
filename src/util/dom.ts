import type {Dict, JsonValue} from '#/meta/belt';
import type {ImageDataUrl} from '#/meta/media';
import type {Vocab} from '#/meta/vocab';

import {ode, timeout} from './belt';

import type {Pwa} from '#/script/messages';
import {
	B_FIREFOX_ANDROID,
	B_WITHIN_PWA,
	N_BROWSER_VERSION_MAJOR,
	N_FIREFOX_ANDROID_BETA_VERSION,
	N_FIREFOX_ANDROID_NIGHTLY_ABOVE,
} from '#/share/constants';

export {parse_params} from '#/share/constants';


type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}` ? [T, ...Split<U, D>] : [S];

type TakeLast<V> = V extends []
	? never
	: V extends [string]
		? V[0]
		: V extends [string, ...infer R]
			? TakeLast<R>
			: never;

type TrimLeft<V extends string> = V extends ` ${infer R}` ? TrimLeft<R> : V;

type TrimRight<V extends string> = V extends `${infer R} ` ? TrimRight<R> : V;

type Trim<V extends string> = TrimLeft<TrimRight<V>>;

type StripModifier<V extends string, M extends string> = V extends `${infer L}${M}${infer A}` ? L : V;

type StripModifiers<V extends string> = StripModifier<
	StripModifier<
		StripModifier<
			StripModifier<V, '.'>, '#'
		>,
	'['>,
':'>;

type TakeLastAfterToken<V extends string, T extends string> = StripModifiers<
	TakeLast<
		Split<
			Trim<V>, T
		>
	>
>;

type GetLastElementName<V extends string> = TakeLastAfterToken<
	TakeLastAfterToken<V, ' '>,
	'>'
>;

type GetEachElementName<V, L extends string[] = []> = V extends []
	? L
	: V extends [string]
		? [...L, GetLastElementName<V[0]>]
		: V extends [string, ...infer R]
			? GetEachElementName<R, [...L, GetLastElementName<V[0]>]>
			: [];

type GetElementNames<V extends string> = GetEachElementName<Split<V, ','>>;

type ElementByName<V extends string> = V extends keyof HTMLElementTagNameMap
	? HTMLElementTagNameMap[V]
	: V extends keyof SVGElementTagNameMap
		? SVGElementTagNameMap[V]
		: Element;

type MatchEachElement<V, L extends Element = Element> = V extends []
	? L
	: V extends [string]
		? ElementByName<V[0]>
		: V extends [string, ...infer R]
			? MatchEachElement<R, L | ElementByName<V[0]>>
			: L;

type QueryResult<
	sq_selector extends string,
> = MatchEachElement<GetElementNames<sq_selector>>;

export const qs = <
	sq_selector extends string,
>(
	dm_node: ParentNode | HTMLElement,
	sq_selector: sq_selector
): null | QueryResult<sq_selector> => dm_node.querySelector(sq_selector);

export const qsa = <
	sq_selector extends string,
>(
	dm_node: ParentNode | HTMLElement,
	sq_selector: sq_selector
): QueryResult<sq_selector>[] => Array.prototype.slice.call(dm_node.querySelectorAll(sq_selector), 0) as QueryResult<sq_selector>[];

export function dd<
	si_tag extends keyof HTMLElementTagNameMap,
>(
	s_tag: si_tag,
	h_attrs: Record<string, string | number | boolean> = {},
	a_children: (Element | string)[] = []
): HTMLElementTagNameMap[si_tag] {
	const dm_node = document.createElement(s_tag);

	for(const si_attr in h_attrs) {
		dm_node.setAttribute(si_attr, h_attrs[si_attr]+'');
	}

	for(const w_child of a_children) {
		dm_node.append(w_child);
	}

	return dm_node;
}

export function read_cookie(): Record<string, string> {
	return document.cookie.split(';').reduce((h_out, s_cookie) => {
		const a_split = s_cookie.trim().split('=');
		return {
			...h_out,
			[a_split[0]]: a_split.slice(1).join('='),
		};
	}, {});
}

export function read_cookie_json<T extends JsonValue=JsonValue>(si_key: string): T | null {
	const h_cookie = read_cookie();

	if(!(si_key in h_cookie)) return null;

	let w_value: JsonValue;
	try {
		w_value = JSON.parse(h_cookie[si_key]);
	}
	catch(e_parse) {
		console.error(`failed to parse cookie JSON value associated with key '${si_key}'`);
		delete_cookie(si_key);
	}

	return w_value as T;
}

export function write_cookie(h_cookie: Record<string, JsonValue>, xt_expires: number) {
	const h_serialize: Record<string, string> = {};

	for(const [si_key, z_value] of ode(h_cookie)) {
		if('string' === typeof z_value) {
			h_serialize[si_key] = z_value;
		}
		else if(null === z_value || 'undefined' === typeof z_value) {
			delete_cookie(si_key);
		}
		else {
			h_serialize[si_key] = JSON.stringify(z_value);
		}
	}

	document.cookie = Object.entries({
		...h_serialize,
		'max-age': ''+xt_expires,
	})
		.map(([si_key, s_value]) => `${si_key}=${s_value}`)
		.join('; ');
}

export function delete_cookie(si_cookie: string) {
	return write_cookie({
		[si_cookie]: '',
	}, 0);
}

export interface ExternalLinkConfig {
	exitPwa?: boolean;
	behind?: boolean;
}

export async function open_external_link(p_url: string, gc_external: ExternalLinkConfig={}): Promise<void> {
	// within pwa
	if(B_WITHIN_PWA) {
		// opening should exit pwa
		if(gc_external?.exitPwa) {
			// operating on firefox
			if(B_FIREFOX_ANDROID) {
				const a_fenixes = [
					'fenix',
					'fenix-beta',
					'fenix-nightly',
				];

				// compare major version
				if(N_BROWSER_VERSION_MAJOR) {
					const f_mv_0 = (s_tag: string) => a_fenixes.unshift(a_fenixes.splice(a_fenixes.indexOf(s_tag), 1)[0]);

					// firefox-beta
					if(N_FIREFOX_ANDROID_BETA_VERSION === N_BROWSER_VERSION_MAJOR) {
						f_mv_0('fenix-beta');
					}
					// firefox-nightly
					else if(N_BROWSER_VERSION_MAJOR > N_FIREFOX_ANDROID_NIGHTLY_ABOVE) {
						f_mv_0('fenix-nightly');
					}
				}

				// monitor visibilityChange event to deduce if browser was installed and opened link
				let b_opened = false;
				{
					const f_visibility_monitor = () => {
						if('hidden' === document.visibilityState) {
							b_opened = true;
							document.removeEventListener('visibilitychange', f_visibility_monitor);
						}
					};

					document.addEventListener('visibilitychange', f_visibility_monitor);
				}

				// try each protocol in order
				for(const s_protocol of a_fenixes) {
					// open the URL
					location.href = `${s_protocol}://open?${new URLSearchParams(Object.entries({url:p_url})).toString()}`;

					// pause
					await timeout(300);

					// link opened the app; all done
					if(b_opened) return;
				}
			}
			// us.spotco.fennec_dos
			// // operating on chromium
			// else {
			// 	// ({
			// 	// 	package: 'com.kiwibrowser.browser',
			// 	// 	action: 'android.intent.action.VIEW',
			// 	// 	category: 'android.intent.category.BROWSABLE',
			// 	// 	scheme: 'googlechrome',
			// 	// });

			// 	// action: org.chromium.chrome.browser.webapps.ActivateWebApkActivity.ACTIVATE:
			// 	//          com.kiwibrowser.browser/org.chromium.chrome.browser.webapps.ActivateWebApkActivity
			// 	// org.chromium.chrome.browser.webapps.WebappManager.ACTION_START_SECURE_WEBAPP
			// 	// window.open('intent://google.com/#Intent;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.chrome;scheme=https;end', '_blank')
			// }
		}

		// instruct top to open popup
		(window.top as Vocab.TypedWindow<Pwa.IframeToTop>).postMessage({
			type: 'openPopup',
			value: p_url,
		}, 'https://launch.starshell.net');
	}
	else if('function' === typeof chrome.tabs?.create) {
		void chrome.tabs.create({
			url: p_url,
			active: !gc_external?.behind || true,
		});

		if(B_FIREFOX_ANDROID) {
			globalThis.close();
		}
	}
	else {
		// open as an external link
		globalThis.open(p_url, '_blank');
	}
}

type Renders<
	a_sizes extends number[]=number[],
> = {
	[si_dim in a_sizes[number]]: ImageDataUrl;
};

export async function render_svg_squarely<
	a_sizes extends number[]=number[],
>(dm_svg: SVGSVGElement, a_sizes: a_sizes): Promise<Renders<a_sizes>> {
	// prep output
	const h_renders = {} as Renders<a_sizes>;

	// get dimensions
	const {
		width: xl_width_view,
		height: xl_height_view,
		x: xl_x_view,
		y: xl_y_view,
	} = dm_svg.viewBox.baseVal;

	// get dimensions within viewbox
	const xl_width_svg = xl_width_view - xl_x_view;
	const xl_height_svg = xl_height_view - xl_y_view;

	// shorter and longer dimensions
	const xl_dim_min_svg = Math.min(xl_width_svg, xl_height_svg);
	// const xl_dim_max_svg = Math.max(xl_width_svg, xl_height_svg);

	// // amount needed to scale svg
	// const xs_svg_to_canvas = xl_dim_min_svg / N_PX_DIM_ICON;

	// // orientation
	// const b_landscape = xl_width_svg >= xl_height_svg;

	// // destination for other dimension
	// const xl_dim_other_canvas = Math.ceil(xs_svg_to_canvas * xl_dim_max_svg);

	// // assign to named references
	// const xl_width_canvas = b_landscape? xl_dim_other_canvas: N_PX_DIM_ICON;
	// const xl_height_canvas = b_landscape? N_PX_DIM_ICON: xl_dim_other_canvas;

	// // create canvas at minimum necessary dimensions
	// const dm_canvas = dd('canvas', {
	// 	width: xl_width_canvas,
	// 	height: xl_height_canvas,
	// });

	// force full svg dimensions
	dm_svg.setAttribute('width', xl_width_svg+'');
	dm_svg.setAttribute('height', xl_height_svg+'');

	// load into blob
	const d_blob = new Blob([dm_svg.outerHTML], {
		type: 'image/svg+xml',
	});

	// create data URL for the blob
	const p_data_url = URL.createObjectURL(d_blob);

	// load full-scale image
	const d_img = new Image(xl_width_svg, xl_height_svg);
	await new Promise((fk_resolve) => {
		// wait for img to load
		d_img.onload = () => {
			// render at the various resolutions
			for(const n_px_render of a_sizes) {
				// create canvas at minimum necessary dimensions
				const dm_canvas_square = dd('canvas', {
					width: n_px_render,
					height: n_px_render,
				});

				// render svg
				const d_2d = dm_canvas_square.getContext('2d')!;

				// draw cropped, square image
				const xl_x_src = ((xl_width_svg - xl_dim_min_svg) / 2) + xl_x_view;
				const xl_y_src = ((xl_height_svg - xl_dim_min_svg) / 2) + xl_y_view;
				d_2d.drawImage(d_img, xl_x_src, xl_y_src, xl_dim_min_svg, xl_dim_min_svg, 0, 0, n_px_render, n_px_render);

				// export image data
				const sx_data_webp = B_FIREFOX_ANDROID? null: dm_canvas_square.toDataURL('image/webp', 1) as `data:image/webp;base64,${string}`;
				const sx_data_png = dm_canvas_square.toDataURL('image/png', 1) as `data:image/png;base64,${string}`;

				// add the smaller one to dict
				h_renders[n_px_render] = (sx_data_webp?.length || Infinity) < sx_data_png.length? sx_data_webp: sx_data_png;
			}

			// free object URL
			URL.revokeObjectURL(p_data_url);

			// resolve
			fk_resolve(void 0);
		};

		// set image src to begin loading
		d_img.src = p_data_url;
	});

	// return set of renders
	return h_renders;
}

export function stringify_params(h_params: Dict<string | string[]>): string {
	return new URLSearchParams(Object.entries(h_params as Dict)).toString();
}


interface PolyfilledAbortController {
	signal: AbortSignal;
	cancel: VoidFunction;
}

export function abort_signal_timeout(xt_timeout: number): PolyfilledAbortController {
	const d_controller = new AbortController();
	const i_abort = setTimeout(() => {
		d_controller.abort();
	}, xt_timeout);

	return {
		signal: d_controller.signal,
		cancel: () => clearTimeout(i_abort),
	};
}
