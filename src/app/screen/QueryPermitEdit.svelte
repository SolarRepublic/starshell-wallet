<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {ChainStruct} from '#/meta/chain';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	
	import {Screen, Header} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {Apps} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	
	import InlineTags from '../frag/InlineTags.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	import Info from '../ui/Info.svelte';
	import Load from '../ui/Load.svelte';
	
	
	const {
		k_page,
	} = load_page_context();

	export let secretPath: SecretPath<'query_permit'>;

	let g_secret: SecretStruct<'query_permit'>;
	let g_chain: ChainStruct;

	let s_header_subtitle = '';

	let s_alias = '';

	let g_app_primary: AppStruct;

	async function load_query_permit() {
		g_secret = await Secrets.metadata(secretPath);

		s_alias = g_secret.alias || '';

		const p_chain = g_secret.chain;
		g_chain = (await Chains.at(p_chain))!;
		s_header_subtitle = g_chain.name;

		g_app_primary = (await Apps.at(g_secret.outlets[0]))!;
	}

	let b_disabled = false;

	async function save() {
		b_disabled = true;

		g_secret.alias = s_alias;

		await Secrets.update(g_secret);

		k_page.pop();
	}

</script>

<style lang="less">
</style>

<Screen form slides>
	<Header title='Query Permit' postTitle='Edit' subtitle={s_header_subtitle} pops search />

	{#await load_query_permit()}
		<Load forever />
	{:then}
		<Field key='id' name='Permit ID'>
			<Info key='permit-name'>
				{g_secret.name}
			</Info>
		</Field>

		<Field key='alias' name='Alias'>
			<input type="text"
				placeholder={`Permit from ${g_app_primary.name}`}
				bind:value={s_alias}
			>
		</Field>

		<h3>
			Edit Tags
		</h3>

		<InlineTags editable resourcePath={secretPath} />
	{/await}

	<ActionsLine cancel='pop' confirm={['Save', () => save(), b_disabled]} />
</Screen>
