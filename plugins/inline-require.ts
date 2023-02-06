import type {ModuleFormat} from '@sveltejs/vite-plugin-svelte';
import type {CallExpression, Identifier} from 'estree';
import type {RollupBuild, RollupOutput} from 'rollup';
import type {
	Plugin,
	ResolvedConfig,
} from 'vite';

import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import nodeExternals from 'rollup-plugin-node-externals';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {createFilter} from '@rollup/pluginutils';
import * as walk from 'acorn-walk';
import MagicString from 'magic-string';
import {
	rollup,
} from 'rollup';

interface Options {
	include?: string[];
	exclude?: string[];
	options?: {
		[prop: string]: any;
		plugins?: Plugin[];
		output?: {
			format?: ModuleFormat;
			preferConst?: boolean;
			plugins?: Plugin[];
		};
	};
}

const R_INLINE = /\$inline\('([^']+)'\)/g;

const PD_SRC = path.resolve(__dirname, '../src/');

const hm_cache = new Map();


export function inlineRequire(gc_import: Options={}) {
	const {
		include: a_include=[],
		exclude: a_exclude=[],
		// options: {
		// 	plugins: a_plugins=[],
		// 	output: gc_output={
		// 		format: 'iife',
		// 	},
		// 	// ...gc_input,
		// },
	} = gc_import;

	let gc_plugin: ResolvedConfig;

	const f_filter = createFilter(a_include, a_exclude);

	const si_cache = JSON.stringify({
		a_include,
		a_exclude,
	});

	if(hm_cache.has(si_cache)) {
		return hm_cache.get(si_cache);
	}


	return {
		name: 'inline-require',

		configResolved(gc_resolved) {
			gc_plugin = gc_resolved;
		},

		async transform(sx_code: string, si_part: string) {
			if(!f_filter(si_part)) return null;

			const y_magic = new MagicString(sx_code);

			let y_ast: acorn.Node;
			try {
				y_ast = this.parse(sx_code);
			}
			catch(e_parse) {
				throw new Error(`While trying to read ${si_part}: ${e_parse?.message || e_parse}`);
			}

			const a_requires: {
				node: {
					start: number;
					end: number;
				};
				target: string;
			}[] = [];

			walk.simple(y_ast, {
				CallExpression(y_node) {
					const {
						arguments: a_args,
						callee: y_callee,
					} = y_node as unknown as CallExpression;

					const {
						type: si_type,
						name: s_name,
					} = y_callee as Identifier;

					// capture all `inline_require('something')`
					if('Identifier' === si_type
						&& 'inline_require' === s_name
						&& 1 === a_args.length
						&& 'Literal' === a_args[0].type) {
						const p_require = a_args[0].value as string;

						a_requires.push({
							node: {...y_node},
							target: p_require,
						});
					}
				},
			});

			const pd_part = path.dirname(si_part);

			for(const {target:p_target, node:g_node} of a_requires) {
				let g_resolve;

				// relative path
				if('.' === p_target[0]) {
					// attempt verbatim resolve
					g_resolve = await this.resolve(path.resolve(pd_part, p_target));

					// did not find file
					if(!g_resolve) {
						// try by appending .ts
						g_resolve = await this.resolve(path.resolve(pd_part, p_target+'.ts'));
					}
				}
				// root relative path
				else if('#' === p_target[0]) {
					// attempt verbatim resolve
					g_resolve = await this.resolve(path.resolve(PD_SRC, p_target.slice(2)));

					// did not find file
					if(!g_resolve) {
						// try by appending .ts
						g_resolve = await this.resolve(path.resolve(PD_SRC, p_target.slice(2)+'.ts'));
					}
				}
				// package
				else {
					g_resolve = await this.resolve(p_target);
				}

				// failed to resolve
				if(!g_resolve) {
					throw new Error(`Failed to resolve inline require "${p_target}" from ${pd_part}`);
				}

				let si_load = '';
				if(this.load) {
					let g_load;
					try {
						g_load = await this.load(g_resolve);
					}
					catch(e_load) {
						throw new Error(`While trying to load ${JSON.stringify(g_resolve)}: ${e_load?.message || e_load}`);
					}

					si_load = g_load.id;
				}
				else {
					si_load = (g_resolve.id || '').replace(/\?.*$/, '');
				}

				let y_bundle: RollupBuild;
				try {
					y_bundle = await rollup({
						input: si_load.replace(/\?commonjs-entry$/, ''),
						external: ['fs', 'path', 'crypto'],
						output: {
							format: 'iife',
						},
						plugins: [
							nodeExternals({
								builtins: false,
								deps: false,
							}),
							commonjs({
								ignore: ['fs', 'path', 'crypto'],
							}),
							nodeResolve({
								browser: true,
								// preferBuiltins: false,
							}),

							// apply the `inline_require()` substitution
							inlineRequire({
								// only on extensions scripts
								include: [
									'./src/script/*',
								],
							}),

							typescript({
								tsconfig: path.join(__dirname, '../tsconfig.json'),
								compilerOptions: {
									target: 'es2022',
									module: 'es2022',
									lib: ['es2022', 'dom'],
								},
							}),
						],
					});
				}
				catch(e_bundle) {
					throw new Error(`While trying to bundle ${si_load}: ${e_bundle?.stack || e_bundle?.message || e_bundle}`);
				}

				let g_gen: RollupOutput;
				try {
					g_gen = await y_bundle.generate({
						format: 'iife',
					});
				}
				catch(e_generate) {
					throw new Error(`While trying to generate ${si_load}: ${e_generate?.message || e_generate}`);
				}

				y_magic.overwrite(g_node.start, g_node.end, g_gen.output[0].code);
			}

			return {
				code: y_magic.toString(),
				map: y_magic.generateMap({hires:true}),
			};
		},
	};
}
