<script lang="ts">
	import type {ChainStruct} from '#/meta/chain';

	import {Chains} from '#/store/chains';

	import {open_external_link} from '#/util/dom';
	import {phrase_to_hyphenated} from '#/util/format';
	
	import Copyable from '../ui/Copyable.svelte';
	import Field from '../ui/Field.svelte';
	
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	import SX_ICON_LAUNCH from '#/icon/launch.svg?raw';

	export let hash: string;

	export let chainStruct: ChainStruct;

	export let label: string | undefined = '';
	const s_label = label || 'Txn Id';

	// prepare block explorer link
	const p_href = Chains.blockExplorer('transaction', {
		hash: hash,
	}, chainStruct);
</script>

<Field short simple
	key={phrase_to_hyphenated(s_label)} name={s_label}>
	<Copyable let:copy={copy}>
		<style lang="less">
			.transaction-id {
				gap: 6px;

				.hash {
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.global_svg-icon {
					color: var(--theme-color-primary);
				}
			}
		</style>

		<div class="transaction-id global_flex-auto">
			<span class="hash">
				{hash}
			</span>

			<span class="global_svg-icon icon-diameter_24px" on:click={() => copy(hash)}>
				{@html SX_ICON_COPY}
			</span>

			<span class="global_svg-icon icon-diameter_24px" on:click={() => open_external_link(p_href)}>
				{@html SX_ICON_LAUNCH}
			</span>
		</div>
	</Copyable>
</Field>