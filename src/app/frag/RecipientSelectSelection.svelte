<script lang="ts">
	import InlineContactSelection, {type ContactOption} from '../frag/InlineContactSelection.svelte';

	export let getSelectionLabel;
	export let item: ContactOption;
</script>

<style lang="less">
	.selection {
		text-overflow: ellipsis;
		overflow-x: hidden;
		white-space: nowrap;
		height: 100%;
		padding-left: 8px;
		padding-right: 30px;

		.manual>.address {
			:global(&) {
				width: calc(100% - 3.5ch);
			}
		}
	}
</style>


<div class="selection">
	<InlineContactSelection contact={item.contact} address={item.value} />
</div>