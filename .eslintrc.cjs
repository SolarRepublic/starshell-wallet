
const SX_POW2 = '(?:8|16|32|64)';

const A_PRIMITIVE_STRING = [
	`s([aihpqrx]|x?b\\d+)?`, 'p[r]?',
];

const H_PRIMITIVES = {
	boolean: [
		'b',
	],
	number: [
		'c[b]?', 'i([bt]|px)?', 'n([bil]?|px)', `x(?:a[rd]|[b-z][l]?|[uifg]${SX_POW2})?`,
	],
	string: A_PRIMITIVE_STRING,
	array: [
		'a',
	],
	function: [
		'f[gke]?',
	],
	_other: [
		'd[a-z]{0,2}', 'e', 'g[ca-z]?',
		'h[m]?', 'k[a-z]{0,2}', 'm', 'r[t]?',
		...A_PRIMITIVE_STRING,
		't', 'v', 'w', 'x[cg]', 'y[a-z]{0,2}', 'z',
		'a[btsx]', 'at[uif](8|16|32|64)',
	],
};

const A_SNAKE_TYPES = [
	...Object.values(H_PRIMITIVES).flat(),
];

const S_SNAKE_TYPES_UPPER = A_SNAKE_TYPES.map(s => s.toUpperCase()).join('|');

function* snake_types(a_configs) {
	for(const gc_types of a_configs) {
		const a_snake_types = gc_types.patterns;

		let s_inner = '';

		if('only' !== gc_types.caps) {
			s_inner = a_snake_types.join('|');
		}

		if(gc_types.caps) {
			s_inner += `|${a_snake_types.map(s => s.toUpperCase()).join('|')}`;
		}

		const s_post = gc_types.short? '(_|$)': '_';

		const g_opt = {
			selector: gc_types.selector || 'variable',
			modifiers: gc_types.modifiers || [],
			format: [
				...('only' === gc_types.caps? ['UPPER_CASE']: ['snake_case']),
				...(gc_types.format? gc_types.format: []),
			],
			custom: {
				regex: (gc_types.regex? '(?:': '')+`^(${s_inner})${s_post}`+(gc_types.regex? `|${gc_types.regex})`: ''),
				match: true,
			},
		};

		const as_types = new Set(gc_types.types);
		as_types.delete('_other');
		gc_types.types = [...as_types];

		if(gc_types.types.length) g_opt.types = gc_types.types;

		yield g_opt;
	}
}

function under(h_map) {
	const h_out = {};

	for(const [si_prefix, h_parts] of Object.entries(h_map)) {
		for(const [si_suffix, w_value] of Object.entries(h_parts)) {
			h_out[si_prefix+si_suffix] = w_value;
		}
	}

	return h_out;
}


/**
 * Fold array into an object
 */
function fold(a_in, f_fold) {
	const h_out = {};
	for(const z_each of a_in) {
		Object.assign(h_out, f_fold(z_each));
	}

	return h_out;
}

/**
 * Reduce object entries to an array via concatenation
 */
function oderac(h_thing, f_concat, b_add_undefs=false) {
	return Object.entries(h_thing).reduce((a_out, [si_key, w_value]) => [
		...a_out,
		f_concat(si_key, w_value),
	], []);
}

const off = a_rules => fold(a_rules, s => ({[s]:'off'}));
const warn = a_rules => fold(a_rules, s => ({[s]:'warn'}));
const error = a_rules => fold(a_rules, s => ({[s]:'error'}));

const GC_APP = {
	env: {
		es2020: true,
		browser: true,
	},

	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2021,
		sourceType: 'module',
		tsconfigRootDir: __dirname,
		project: ['./tsconfig.json'],
		extraFileExtensions: [
			'.svelte',
		],
	},

	// inherit from recommended configs
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:@typescript-eslint/recommended-requiring-type-checking',
		'plugin:@typescript-eslint/strict',
	],

	globals: {
		chrome: 'readonly',
	},

	settings: {
		// typescript lib
		'svelte3/typescript': () => require('typescript'),
		'svelte3/ignore-styles': () => true,
		'svelte3/ignore-warnings': ({code}) => [
			'a11y-click-events-have-key-events',
		].includes(code),

		'i/parsers': {
			'@typescript-eslint/parser': ['.ts', '.svelte'],
		},

		'i/resolver': {
			typescript: {
				alwaysTryTypes: true,

				extensions: ['.ts', '.d.ts', '.svelte'],
			},
		},
	},

	rules: {
		// superceded by typescript-eslint
		...off([
			'object-curly-spacing',
			'padding-line-between-statements',
			'quotes',
			'no-redeclare',
			'no-throw-literal',
			'no-ex-assign',
		]),

		...under({
			// 'modules-newline/': {
			// 	'import-declaration-newline': ['warn'],
			// 	'export-declaration-newline': ['warn'],
			// },

			'i/': {
				...warn([
					'no-duplicates',
					'no-self-import',
					// 'first',
				]),

				...under({
					'no-': {
						cycle: ['warn', {
							ignoreExternal: true,
						}],
					},
				}),

				order: ['warn', {
					"groups": [
						'type',
						'builtin',
						'external',
						['sibling', 'parent'],
						'index',
						'object',
					],

					"alphabetize": {
						order: 'asc',
						caseInsensitive: true,
					},

					"pathGroups": [
						{
							pattern: 'ts-toolbelt/**',
							group: 'type',
						},
						{
							pattern: '#/{meta,schema}/**',
							group: 'type',
							position: 'after',
						},
						{
							pattern: '#/icon/**',
							group: 'object',
						},
						{
							pattern: '{#,##}/**',
							group: 'index',
							position: 'before',
						},
						{
							pattern: '{.,..}/**/*.svelte',
							group: 'index',
						},
					],

					'newlines-between': 'always-and-inside-groups',
				}],
			},

			'typescript-sort-keys/': {
				'interface': 'off',
				'string-enum': 'off',
			},

			'@typescript-eslint/': {
				'consistent-indexed-object-style': ['warn', 'record'],

				'explicit-module-boundary-types': ['warn'],

				...off([
					'array-type',
					'restrict-plus-operands',
					'ban-types',
					'consistent-type-definitions',
				]),

				...warn([
					'switch-exhaustiveness-check',
					'type-annotation-spacing',
					'unified-signatures',
					'comma-spacing',
					'func-call-spacing',
					'consistent-type-imports',
				]),

				...error([
					'default-param-last',
				]),

				// extends/overrides base eslint rules
				...{
					'dot-notation': 'off',

					// disabled until implementing custom rule to allow space in import statements
					'object-curly-spacing': 'off',
					'padding-line-between-statements': ['warn',
						fold([
							'block',
							'block-like',
							// 'import/import',
						], sx_rule => ({
							blankLine: 'always',
							prev: sx_rule.split(/\//)[0],
							next: sx_rule.split(/\//)[1] || '*',
						})),
					],
					"quotes": ['warn', 'single', {
						avoidEscape: true,
						allowTemplateLiterals: true,
					}],
				},

				...under({
					'no-': {
						...off([
							'non-null-assertion',
							'namespace',
							'unnecessary-type-constraint',
							'explicit-any',
							'unsafe-member-access',
							'unsafe-call',
							'unsafe-assignment',
							'unsafe-return',
							'empty-interface',
							'unnecessary-condition',
							'redeclare',
							'dynamic-delete',
							'invalid-void-type',
						]),

						...warn([
							'unnecessary-qualifier',
							'loop-func',
							'unused-expressions',
							'useless-constructor',
						]),

						...error([
							'invalid-this',
							'shadow',
						]),


						'floating-promises': ['warn', {
							ignoreVoid: true,
							ignoreIIFE: true,
						}],

						'this-alias': ['warn', {
							allowedNames: [
								'k_self',
								'k_node',
							],
						}],

						'extra-parens': ['warn', 'all', {
							nestedBinaryExpressions: false,
							returnAssign: false,
							enforceForNewInMemberExpressions: false,
							enforceForFunctionPrototypeMethods: false,
							enforceForSequenceExpressions: false,
						}],

						'use-before-define': ['error', {
							classes: false,
							variables: false,
							functions: false,
							ignoreTypeReferences: true,
						}],

						'misused-promises': ['warn', {
							checksVoidReturn: {
								arguments: false,
							},
						}],
					},

					'prefer-': {
						...off([
							'nullish-coalescing',
						]),

						...warn([
							'for-of',
							'optional-chain',
							'ts-expect-error',
							'readonly',
						]),
					},

					'member-': {
						'delimiter-style': ['warn'],

						'ordering': ['warn', {
							classes: [
								'static-field',
								'static-method',
								'instance-field',
								'constructor',
								'abstract-field',
								'abstract-method',
								'instance-method',
							].flatMap(s => [`private-${s}`, `protected-${s}`, `public-${s}`])
								.filter(s => !['private-abstract-field', 'private-abstract-method'].includes(s)),
						}],
					},
				}),

				'restrict-template-expressions': ['warn', {
					allowNumber: true,
					allowBoolean: true,
					allowAny: true,
				}],

				'class-literal-property-style': ['warn', 'fields'],

				'naming-convention': ['warn',
					{
						selector: 'typeParameter',
						format: ['snake_case'],
						leadingUnderscore: 'forbid',
						// filter: /^[a-z]/,
					},

					// type declaration names
					{
						selector: 'typeLike',
						format: ['StrictPascalCase'],
						leadingUnderscore: 'forbid',
						// filter: /^[A-Z]/,
					},

					// assertion assignments
					{
						selector: 'variable',
						filter: '_Assertion$',
						suffix: ['_Assertion'],
						format: ['StrictPascalCase'],
						leadingUnderscore: 'forbid',
					},

					// {
					// 	selector: 'variable',
					// 	modifiers: ['const', 'global'],
					// 	format: ['UPPER_CASE'],
					// 	custom: {
					// 		regex: `^(${S_SNAKE_TYPES_UPPER})_`,
					// 		match: true,
					// 	},
					// },
					// {
					// 	selector: 'variable',
					// 	format: ['snake_case'],
					// 	custom: {
					// 		regex: `^(${S_SNAKE_TYPES_LOWER}|${S_SNAKE_TYPES_UPPER})_`,
					// 		match: true,
					// 	},
					// },

					...snake_types(oderac(H_PRIMITIVES, (si_type, a_patterns) => ({
						selector: 'variable',
						modifiers: ['const', 'global'],
						types: [si_type],
						patterns: a_patterns,
						caps: 'optional',
						format: 'function' === si_type? ['snake_case']: [],
						regex: 'function' === si_type? '[a-z][a-z0-9_]+': '',
					}))),
					...snake_types(oderac(H_PRIMITIVES, (si_type, a_patterns) => ({
						selector: 'variable',
						types: [si_type],
						patterns: a_patterns,
						caps: 'optional',
					}))),
					...snake_types(oderac(H_PRIMITIVES, (si_type, a_patterns) => ({
						selector: 'parameter',
						types: [si_type],
						patterns: a_patterns,
						short: true,
					}))),

					// {
					// 	selector: 'enum',
					// 	format: ['UPPER_CASE'],
					// 	custom: {
					// 		regex: `^(${S_SNAKE_TYPES_UPPER})_`,
					// 		match: true,
					// 	},
					// },
					{
						selector: 'enum',
						format: ['StrictPascalCase'],
						// custom: {
						// 	regex: `^(${S_SNAKE_TYPES_UPPER})_`,
						// 	match: true,
						// },
					},

					// local function names
					{
						selector: 'variable',
						types: ['function'],
						format: ['snake_case'],
						leadingUnderscore: 'allow',
					},

					// // catch-all for non-primitive parameter types
					// {
					// 	format: ['snake_case'],
					// 	custom: {
					// 		regex: `^_?(${H_PRIMITIVES._other.join('|')})_`,
					// 		match: true,
					// 	},
					// 	selector: 'parameter',
					// },

					// {
					// 	format: ['UPPER_CASE'],
					// 	custom: {
					// 		regex: `^_?(${S_SNAKE_TYPES_UPPER})_`,
					// 		match: true,
					// 	},
					// 	selector: 'parameter',
					// },
				],

				// extension rules
				'brace-style': ['warn', 'stroustrup', {
					allowSingleLine: true,
				}],
				'comma-dangle': ['warn', {
					arrays: 'always-multiline',
					objects: 'always-multiline',
					imports: 'always-multiline',
					exports: 'always-multiline',
					functions: 'never',
					enums: 'always-multiline',
					generics: 'always-multiline',
					tuples: 'always-multiline',
				}],
				'indent': ['warn', 'tab', {
					SwitchCase: 1,
					VariableDeclarator: 0,
					ignoreComments: true,
					ignoredNodes: [
						'TSTypeParameterInstantiation',
					],
				}],
				'keyword-spacing': ['warn', {
					overrides: {
						if: {after:false},
						for: {after:false},
						await: {after:false},
						while: {after:false},
						switch: {after:false},
						catch: {after:false},
					},
				}],
				'lines-between-class-members': ['warn', {
					exceptAfterSingleLine: true,
				}],
				'object-curly-spacing': ['warn'],
				'quotes': ['warn', 'single', {
					avoidEscape: true,
					allowTemplateLiterals: true,
				}],
				'semi': ['warn', 'always'],
				'space-before-function-paren': ['warn','never'],
			},
		}),


		// eslint
		...{
			'for-direction': ['error'],
			'getter-return': ['error', {
				allowImplicit: true,
			}],
			// # 
			'valid-typeof': ['error', {
				requireStringLiterals: true,
			}],

			// # "Best Practices"
			'array-callback-return': ['error'],
			'class-methods-use-this': ['warn'],
			'curly': ['error', 'multi-line', 'consistent'],
			'default-case': ['error'],
			'dot-location': ['error', 'property'],
			'eqeqeq': ['error'],

			...under({
				'no-': {
					...off([
						'inner-declarations',
						'async-promise-executor',
					]),

					...warn([
						'extra-label',
						'self-assign',
						'unused-labels',
						'useless-concat',
						'useless-escape',
						'warning-comments',
						'shadow-restricted-names',
						'lonely-if',
						'mixed-operators',
						'whitespace-before-property',
						'useless-computed-key',
						'sequences',
					]),

					...error([
						'caller',
						'extend-native',
						'extra-bind',
						'implied-eval',
						'iterator',
						'multi-str',
						'new-func',
						'new-wrappers',
						'octal-escape',
						'proto',
						'script-url',
						'self-compare',
						'throw-literal',
						'unmodified-loop-condition',
						'useless-call',
						// 'void',
						'with',
						'new-object',

						// variables
						'label-var',
						'restricted-globals',
						'undef-init',
						'undefined',
						'var',
					]),

					// 'sequences': ['warn', {
					// 	allowInParentheses: true,
					// }],

					'trailing-spaces': ['warn', {
						ignoreComments: true,
					}],

					'multiple-empty-lines': ['warn', {
						max: 3,
					}],
					'unneeded-ternary': ['warn', {
						defaultAssignment: false,
					}],

					'multi-spaces': ['warn', {
						ignoreEOLComments: true,
					}],

					'await-in-loop': ['off'],
					'cond-assign': ['error', 'except-parens'],
					'console': ['warn', {
						allow: ['time', 'warn', 'error', 'assert'],
					}],
					'control-regex': ['off'],
					'debugger': ['warn'],
					'empty': ['error', {
						allowEmptyCatch: true,
					}],

					'template-curly-in-string': ['warn'],

					// 'wrap-iife': ['error', 'inside'],
				},

				'prefer-': {
					...warn([
						'const',
						'spread',
						'promise-reject-errors',
					]),

					'arrow-callback': ['warn', {
						allowNamedFunctions: true,
					}],
				},
			}),

			'wrap-iife': ['error', 'inside'],

			// eslint stylistic
			'array-bracket-spacing': ['warn', 'never'],
			'comma-style': ['warn'],
			'computed-property-spacing': ['warn'],
			'eol-last': ['warn'],
			'implicit-arrow-linebreak': ['warn'],
			'key-spacing': ['warn', {
				singleLine: {
					beforeColon: false,
					afterColon: false,
				},
				multiLine: {
					mode: 'strict',
					beforeColon: false,
					afterColon: true,
				},
			}],
			'linebreak-style': ['error', 'unix'],
			// 'multiline-ternary': ['warn', 'always-multiline'],
			'multiline-ternary': 'off',

			'new-cap': ['warn', {
				newIsCap: false,
				capIsNewExceptionPattern: '^[A-Z$_][A-Z$_0-9]*',
				capIsNew: true,
				properties: false,
			}],
			'new-parens': ['warn'],
			'nonblock-statement-body-position': ['error', 'beside'],
			// 'object-curly-newline': ['warn', {
			// 	ObjectExpression: {
			// 		multiline: true,
			// 		minProperties: 2,
			// 	},
			// 	ObjectPattern: {
			// 		multiline: true,
			// 		minProperties: 2,
			// 	},
				// ImportDeclaration: {
				// 	multiline: true,
				// 	minProperties: 3,
				// },
			// 	ExportDeclaration: {
			// 		multiline: true,
			// 		minProperties: 2,
			// 	},
			// }],
			'object-property-newline': ['warn', {
				allowAllPropertiesOnSameLine: true,
			}],
			'one-var': ['warn', {
				initialized: 'never',
			}],
			'operator-assignment': ['warn'],
			'operator-linebreak': ['warn', 'before'],
			'padded-blocks': ['warn', 'never'],
			'quote-props': ['warn', 'consistent-as-needed'],
			'semi-spacing': ['warn', {
				before: false,
				after: true,
			}],
			'semi-style': ['error'],
			'space-before-blocks': ['warn','always'],
			'space-in-parens': ['warn','never'],
			'space-unary-ops': ['warn', {
				words: true,
				nonwords: false,
			}],
			'spaced-comment': ['warn','always', {
				exceptions: ['-*'],
				markers: ['/'],
			}],
			'switch-colon-spacing': ['warn'],
			'template-tag-spacing': ['warn'],
			'yoda': ['warn', 'always', {
				onlyEquality: true,
			}],

			// es6
			'arrow-body-style': ['warn', 'as-needed'],
			'arrow-parens': ['warn', 'as-needed', {
				requireForBlockBody: true,
			}],
			'arrow-spacing': ['warn'],
			'generator-star-spacing': ['warn', {
				named: 'after',
				anonymous: 'before',
				method: 'after',
			}],
			// # prefer-template: warn
			'rest-spread-spacing': ['warn', 'never'],
			'symbol-description': ['warn'],
			'template-curly-spacing': ['warn'],
			'yield-star-spacing': ['warn'],
			'no-fallthrough': ['warn'],
		},
	},
};

module.exports = {
	// top-level property
	root: true,

	// default env that applies to all contexts
	env: {
		es2020: true,
	},

	// all plugins used
	plugins: [
		'svelte3',
		'@typescript-eslint',
		'typescript-sort-keys',
		'modules-newline',
		'i',
	],

	// file-specific overrides
	overrides: [
		{
			files: ['*.svelte'],
			processor: 'svelte3/svelte3',
			...GC_APP,
		},
		{
			files: ['*.ts', '*.d.ts'],
			...GC_APP,
		},
	],

	// inherit non-typescript rules from app config
	rules: Object.fromEntries(Object.entries(GC_APP.rules)
		.filter(([si_rule, w_rule]) => !si_rule.startsWith('@typescript'))),
};
