<script lang="ts">
	import {yw_popup} from '../mem';
	
	import {factory_reset} from '#/share/auth';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	
	import SX_ICON_NUCLEAR from '#/icon/nuclear.svg?raw';


	let s_confirmation = '';

	$: b_qualifies = 'DELETE ALL' === s_confirmation?.replace(/^\s*['"]?|['"]?\s*$/g, '').toUpperCase();

	async function submit() {
		if(b_qualifies) {
			// commit
			try {
				await factory_reset();
			}
			finally {
				// reload
				location.reload();
			}
		}
	}
</script>

<style lang="less">
	@import '../_base.less';

	.nuclear {
		color: var(--theme-color-caution);
	}

	.info {
		.font(regular);
		text-align: center;
	}
</style>


<h3>
	<span class="global_svg-icon icon-diameter_20px nuclear">
		{@html SX_ICON_NUCLEAR}
	</span>
	<span class="text">
		Factory Reset
	</span>
</h3>

<div class="info">
	<p>
		This action will permanently delete all data and settings. It cannot be undone.
	</p>
	<p>
		Type "DELETE ALL" below to continue.
	</p>

	<input type="text" bind:value={s_confirmation} placeholder="DELETE ALL">
</div>

<ActionsLine cancel={() => $yw_popup = null} confirm={['Factory Reset', () => submit(), !b_qualifies]} />
	