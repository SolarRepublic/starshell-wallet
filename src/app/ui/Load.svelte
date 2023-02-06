<script lang="ts" context="module">
	let c_global = 0;
</script>

<script lang="ts">
	import type {Promisable} from '#/meta/belt';

	import {forever as f_forever} from '#/util/belt';

	export let forever = false;

	export let input: Promisable<any> | null = forever? f_forever(''): null;

	export let classes = '';

	export let pad = false;

	export let debug = false;

	export let width = '';

	export let height = '';

	let i_self = c_global;
	c_global += 1;

	let x_delay = (i_self * 100) % 1000;
</script>

<style lang="less">
	@import '../_base.less';

	@keyframes loading {
		0% {
			opacity: 0.4;
		}

		50% {
			opacity: 1.0;
		}

		100% {
			opacity: 0.4;
		}
	}

	.loading {
		display: inline-block;
		color: transparent;
		background-color: var(--theme-color-graydark);
		border-radius: 4px;
		animation: loading 1000ms var(--ease-in-out-circ) 0s infinite both;
	}
</style>

{#await input}
	<span class="loading" style={`
		animation-delay: ${x_delay}ms;
		${width
			? `width: ${width};`
			: ''}
		${height
			? `height: ${height};`
			: pad
				? `height: 1.25em;`
				: ''}
	`}>
		Loading...
	</span>
{:then w_resolve}
	{#if debug}
		<span class="loading" style={`animation-delay:${x_delay}ms`}>
			Loading...
		</span>
	{:else}
		<span class={classes}>
			<slot>
				{w_resolve}
			</slot>
		</span>
	{/if}
{/await}
