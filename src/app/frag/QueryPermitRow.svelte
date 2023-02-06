<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	import type {SecretPath, SecretStruct} from '#/meta/secret';
	
	import {load_page_context} from '../svelte';
	
	import {Apps} from '#/store/apps';
	import {Secrets} from '#/store/secrets';
	
	import QueryPermitView from '../screen/QueryPermitView.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';

	
	type QueryPermitStruct = SecretStruct<'query_permit'>;
	type QueryPermitPath = SecretPath<'query_permit'>;

	export let secret: QueryPermitStruct | null = null;
	export let secretPath = (secret? Secrets.pathFrom(secret): '') as QueryPermitPath;

	export let app: AppStruct | null = null;

	const {
		k_page,
	} = load_page_context();

	(async() => {
		if(!secret) secret = await Secrets.metadata(secretPath);
		if(!app) app = await Apps.at(secret.outlets[0]);
	})();
</script>

{#if !secret}
	<LoadingRows />
{:else}
	<Row embedded appRelated
		name={secret.alias? `${secret.alias} (${secret.name})`: secret.name}
		detail={secret.permissions.join(', ')}
		pfp={app?.pfp || ''}
		resourcePath={secretPath}
		on:click={() => {
			k_page.push({
				creator: QueryPermitView,
				props: {
					secretPath,
				},
			});
		}}
	>
		<span class="global_svg-icon icon-diameter_24px rotate_-90deg color_primary" slot="right">
			{@html SX_ICON_EXPAND}
		</span>
	</Row>
{/if}