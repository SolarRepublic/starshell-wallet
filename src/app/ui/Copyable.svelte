<script lang="ts">
	import {syserr} from '../common';

	export let confirmation = 'Copied!';

	export let output = '';

	let b_copy_confirm = false;
	async function copy(s_text: string) {
		console.log(`copied to clipboard: "${s_text}"`);

		// attempt to perform copy
		try {
			await navigator.clipboard.writeText(s_text);
		}
		// unable to use clipboard
		catch(e_write) {
			syserr({
				title: 'Browser API Failure',
				text: 'Failed to write to the navigator clipboard.',
				error: e_write,
			});

			return;
		}

		b_copy_confirm = true;
		setTimeout(() => {
			b_copy_confirm = false;
		}, 800);
	}

	async function click() {
		if(output) {
			await copy(output);
		}
	}
</script>

<style lang="less">
	@import '../_base.less';

	.copyable {
		display: inline-block;
		position: relative;
		.fill-available();
		cursor: copy;
	}

	.container {
		display: inline-flex;
		position: absolute;
		width: 100%;
		top: calc(50% - 20px);
		left: 0;
		pointer-events: none;
	}
	
	.copied {
		opacity: 0;
		color: var(--theme-color-black);
		border-radius: 6px;
		padding: 8px 20px;
		background-color: var(--theme-color-text-light);
		box-shadow: -2px 3px 6px;

		margin-left: auto;
		margin-right: auto;

		&:not(.confirm) {
			transition: opacity 800ms linear;
		}

		&.confirm {
			opacity: 1;
		}
	}
</style>

<span class="copyable" on:click={() => click()}>
	<slot copy={copy}>
		<span class="copy-target" style="display:contents;">
			{output}
		</span>
	</slot>

	<div class="container">
		<span class="copied" class:confirm={b_copy_confirm}>
			{confirmation}
		</span>
	</div>
</span>
