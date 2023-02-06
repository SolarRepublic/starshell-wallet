<script lang="ts">
	import type {Merge} from 'ts-toolbelt/out/Object/Merge';
	
	import type {JsonObject, Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct, ChainNamespaceKey} from '#/meta/chain';
	import type {ContactStruct} from '#/meta/contact';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {load_app_context} from '../svelte';
	
	import {R_CHAIN_ID_VERSION, R_BECH32} from '#/share/constants';
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';
	
	import Header from '../ui/Header.svelte';
	import IncidentFields from '../frag/IncidentFields.svelte';
	import type {SimpleField} from '../frag/IncidentFields.svelte';

	const {
		completed,
	} = load_app_context<undefined>();
	

	/**
	 * Deep link URL
	 */
	export let url = '';

	/**
	 * Plain address
	*/
	export let address: Bech32 = '';

	interface BasicDetails extends JsonObject {
		name?: string;
	}

	interface ChainDetails extends BasicDetails {}
	interface ContactDetails extends BasicDetails {}

	interface AugmentedChainNamespace {
		namespace: ChainNamespaceKey;
	}

	interface AugmentedChain extends AugmentedChainNamespace {
		chain: {
			id: string;
			name: string | null;
			resolved: ChainStruct | null;
		};
	}

	interface AugmentedContact extends AugmentedChain {
		contact: {
			bech32: Bech32;
			name: string | null;
			resolved: ContactStruct | null;
		};
	}

	interface Linked {
		title: string;
		existing?: ChainStruct | ContactStruct | null;
		fields: SimpleField[];
	}

	type NestedLinkMap = Record<string, LinkMap>;

	// type NestedLinkMap = Dict<LinkMap>;

	type Context = {} | AugmentedChainNamespace | AugmentedChain | AugmentedContact;


	const _$_AUGMENT = Symbol('augment');
	const _$_HANDLE = Symbol('handle');

	type LinkMap = Merge<NestedLinkMap, {
		[_$_AUGMENT](sx_arg: string, g_thing: JsonObject, g_context: Context): Promisable<Context>;
		[_$_HANDLE](g_context: Context): Promisable<Linked>;
	}>;

	const H_DEEP_LINKS: LinkMap = {
		// "family" is a human-friendly, abbreviated synonym for "namespace"
		family: {
			[_$_AUGMENT]: (sx_arg: string) => {
				if('cosmos' !== sx_arg) {
					throw syserr({
						title: 'Rejected Unsafe Namespace',
						text: `Namespace ID "${sx_arg}" is unsafe.`,
					});
				}

				return {
					namespace: sx_arg,
				};
			},

			chain: {
				async [_$_AUGMENT](sx_arg: string, g_value: ChainDetails, g_context: AugmentedChainNamespace): Promise<Pick<AugmentedChain, 'chain'>> {
					if(!R_CHAIN_ID_VERSION.test(sx_arg)) {
						throw syserr({
							title: 'Rejected Unsafe Chain',
							text: `Chain ID "${sx_arg}" is unsafe.`,
						});
					}

					const p_chain = Chains.pathFor(g_context.namespace, sx_arg);

					const g_chain = await Chains.at(p_chain);

					return {
						chain: {
							id: sx_arg,
							name: g_value.name ?? null,
							resolved: g_chain,
						},
					};
				},

				[_$_HANDLE]: ({chain:g_thing}: AugmentedChain) => ({
					title: 'Chain',
					existing: g_thing.resolved,
					fields: [
						{
							type: 'key_value',
							key: 'Chain',
							value: g_thing.resolved?.name ?? g_thing.name ?? 'Unknown Chain',
							subvalue: g_thing.id,
						},
					],
				}),

				address: {
					async [_$_AUGMENT](sx_arg: string, g_value: ContactDetails, g_context: AugmentedChain): Promise<Pick<AugmentedContact, 'contact'>> {
						if(!R_BECH32.test(sx_arg)) {
							throw syserr({
								title: 'Rejected Unsafe Contact',
								text: `Address "${sx_arg}" is unsafe.`,
							});
						}

						const p_contact = Agents.pathForContactFromAddress(sx_arg, g_context.namespace);

						const g_contact = await Agents.getContact(p_contact);

						return {
							contact: {
								bech32: sx_arg as Bech32,
								name: g_value.name ?? null,
								resolved: g_contact,
							},
						};
					},

					[_$_HANDLE]: ({contact:g_thing}: AugmentedContact) => ({
						title: g_thing.name? 'Agent': 'Address',
						existing: g_thing.resolved,
						fields: [
							{
								type: 'key_value',
								key: 'Address',
								value: g_thing.bech32,
								render: 'address',
							},
							...g_thing.name? [{
								type: 'key_value',
								key: 'Name',
								value: g_thing.name,
							} as const]: [],
						],
					}),
				},
			},
		},
	};

	const H_ORIGINS = {
		qr: 'QR Code Scanner',
	};

	let s_error = '';

	async function parse_url() {
		// check origin
		if(!url.startsWith('https://link.starshell.net/')) {
			s_error = `Invalid Link URL: <${url}>`;
			return null;
		}

		const d_url = new URL(url);

		const s_origin = H_ORIGINS[d_url.pathname.slice(1)] ?? 'unknown origin';

		let h_parent = H_DEEP_LINKS;
		const g_context = {};

		// debugger;
		const sx_hash = (d_url.hash || '').slice(1);
		const a_parts = sx_hash.split('/');
		for(const sx_part of a_parts) {
			const i_dot = sx_part.indexOf('.');

			if(-1 === i_dot) {
				s_error = `Failed to parse link URL: <${url}>`;
				return null;
			}

			const si_key = sx_part.slice(0, i_dot);
			const s_value = sx_part.slice(i_dot+1);
			const [s_arg, sx_extra] = s_value.split('+');

			let g_extra = {};
			if(sx_extra) {
				try {
					const sx_json = globalThis.atob(sx_extra);
					g_extra = JSON.parse(sx_json);
				}
				catch(e_parse) {
					s_error = 'Link contained invalid encoding';
					return null;
				}
			}

			// traverse into struct
			const w_node = h_parent[si_key];

			if(!w_node) {
				s_error = `Unparsable link <${url}>`;
				return null;
			}

			// augment context
			if(w_node[_$_AUGMENT]) {
				const g_augment = await w_node[_$_AUGMENT](s_arg, g_extra, g_context);
				Object.assign(g_context, g_augment);
			}

			// iterate
			h_parent = w_node;
		}

		// handle
		if(!h_parent[_$_HANDLE]) {
			s_error = `Cannot link to intermediate node at <${url}>`;
			return null;
		}

		const g_mapped = await h_parent[_$_HANDLE](g_context);

		if(!g_mapped) {
			s_error = 'Failed to parse';
			return null;
		}

		return {
			origin: s_origin,
			...g_mapped,
		};
	}

</script>

<style lang="less">
	
</style>

<Screen debug="DeepLink">
	{#if s_error}
		<h3>{s_error}</h3>
	{:else if url}
		{#await parse_url()}
			Loading deep link...
		{:then g_link}
			{#if g_link}
				<Header
					title={`Review Linked ${g_link.title}`}
					subtitle={`from ${g_link.origin}`}
				/>

				<IncidentFields
					fields={g_link.fields}
				/>
			{:else}
				Failed to load deep link.
				{s_error}
			{/if}
		{/await}
	{/if}

	deep link....
</Screen>
