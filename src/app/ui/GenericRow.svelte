<script lang="ts">
	import type {AccountPath} from '#/meta/account';
	import type {Dict} from '#/meta/belt';
	import type {ContactPath} from '#/meta/contact';
	import type {ProviderPath} from '#/meta/provider';
	
	import type {SearchItem} from '#/meta/search';
	
	import {ClassType} from '../def';
	
	import {load_page_context} from '../svelte';
	
	import AccountView from '##/screen/AccountView.svelte';
	import ContactView from '##/screen/ContactView.svelte';
	import HoldingView from '##/screen/HoldingView.svelte';
	import ProviderView from '##/screen/ProviderView.svelte';
	
	
	import Put from './Put.svelte';
	import Row from './Row.svelte';

	const {
		k_page,
	} = load_page_context();

	export let item: SearchItem;

	export let detail: HTMLElement | null | undefined = null;

	export let pfpDim = 36;

	const {
		class: si_class,
		resource: g_resource,
		resourcePath: p_resource,
	} = item;

	const H_CLASS_MAP = {
		[ClassType.ACCOUNT]: {
			// things: H_ACCOUNTS,
			open() {
				k_page.push({
					creator: AccountView,
					props: {
						accountPath: p_resource as AccountPath,
					},
				});
			},
		},
		[ClassType.CHAIN]: {
			// things: H_CHAINS,
			open() {
				// k_page.push({
				// 	creator: ChainView,
				// 	props: {
				// 		chain: k_thing as ChainStruct,
				// 	},
				// });
			},
		},
		[ClassType.CONTACT]: {
			// things: H_CONTACTS,
			open() {
				k_page.push({
					creator: ContactView,
					props: {
						contact: p_resource as ContactPath,
					},
				});
			},
		},
		[ClassType.CONTRACT]: {
			// things: H_CONTRACTS,
			open() {
					// push_screen(Contract, {

					// });
			},
		},
		[ClassType.PROVIDER]: {
			// things: H_PROVIDERS,
			open() {
				k_page.push({
					creator: ProviderView,
					props: {
						provider: p_resource as ProviderPath,
					},
				});
			},
		},
		// [ClassType.SNIP721]: {
		// 	things: H_NFTS,
		// 	open() {
		// 		k_page.push({
		// 			creator: NftView,
		// 			props: {
		// 				nft: k_thing as NftInt,
		// 			},
		// 		});
		// 	},
		// },
		[ClassType.APP]: {
			// things: H_SITES,
			open() {
					// push_screen(Site, {

					// });
			},
		},
		[ClassType.TOKEN]: {
			// things: H_TOKENS,
			open() {
				const k_holding = Object.values(H_HOLDINGS).find(k_holding => p_resource === k_holding.def.tokenRef);

				if(k_holding) {
					k_page.push({
						creator: HoldingView,
						props: {
							holding: k_holding,
						},
					});
				}
					// else {

					// }
			},
		},
	} as unknown as Dict<{
		open: VoidFunction;
	}>;



	const g_class = H_CLASS_MAP[si_class];

	// const p_icon = gd_thing?.iconRef || '';
	// const a_tags = gd_thing?.tagRefs || [];

	// let s_name = item.label;
	// switch(si_class) {
	// 	case ClassType.SNIP721: {
	// 		if(!s_name && gd_thing) {
	// 			s_name = gd_thing.id;
	// 		}

	// 		break;
	// 	}
	// }

	// function open() {
	// 	$yw_search = '';
	// 	$yw_cancel_search();
	// 	g_class.open();
	// }

</script>

<style lang="less">

</style>

<Row name={item.name} resource={g_resource} resourcePath={p_resource}
	pfpDim={pfpDim}
	data={{
		path: p_resource,
		class: item.class,
	}}
>
<!-- detail={item.detail} iconRef={p_icon} tagRefs={a_tags} -->
	<!-- <svelte:fragment slot="icon">
		<Pfp name={item.label} iconRef={p_icon} circular={![ClassType.ACCOUNT, ClassType.CONTACT, ClassType.SITE, ClassType.SNIP721].includes(si_class)} />
	</svelte:fragment> -->
	<!-- {#if expounded?.detail} -->
		<span class="expounded" slot="detail">
			{#if detail}
				<Put element={detail} />
			{/if}
		</span>
	<!-- {/if} -->
</Row>