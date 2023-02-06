<script context="module" lang="ts">
	export type Option = boolean | number | string | {
		text: string;
	};
</script>

<script lang="ts">
	export let a_options: Option[] = [];

	export let z_selected: Option;

	export let xpx_width = 48;
	
	let i_selected = -1;
	
	$: if(i_selected >= 0) {
		z_selected = a_options[i_selected];
	}
	else {
		i_selected = a_options.indexOf(z_selected);
	}
</script>

<style lang="less">
	.pane {
		display: flex;
		// gap: 8px;
		position: relative;

		.selector {
			position: absolute;
			left: -1px;
			box-sizing: border-box;
			background-color: fade(black, 80%);
			border: 1px solid var(--theme-color-primary);
			border-radius: 8px;
			transition: transform 1s var(--ease-out-quick);
			z-index: -1;
			top: -1px;
		}

		.option {
			text-align: center;
		}
	}
</style>

<span class="pane">
	<span class="selector"
		style={`
			width: ${xpx_width}px;
			left: 0px;
			transform: translateX(${i_selected * xpx_width}px);
		`}
	>
		&nbsp;
	</span>

	{#each a_options as z_option, i_option}
		<span class="option"
			class:active={i_selected === i_option}
			on:click={() => i_selected = i_option}
			style="min-width:{xpx_width}px;"
		>
			{'object' === typeof z_option? z_option.text: ''+z_option}
		</span>
	{/each}
</span>
