<script lang="ts">
	import {yw_connection_health} from '../mem';
	
	import {ConnectionHealth} from '#/share/constants';
	import {H_HEALTH_COLOR} from '#/store/providers';
	
	import Dot from './Dot.svelte';


	/**
	 * target dimensinos
	 */
	export let dim: 32 | 48 | 64 | 96 | 128;
	const x_dim = dim;

	/**
	 * alternative text
	 */
	export let alt = 'StarShell logo';
	const s_alt = alt;

	/**
	 * Show the status dot
	 */
	export let showStatusDot = false;

	const f_src = (x: number) => `/media/vendor/logo-${x}px.png`;

	const sr_default = f_src(x_dim);
	const sr_double = f_src(x_dim * 2);
</script>

<style lang="less">
	.vendor-group {
		position: relative;

		>.status {
			position: absolute;
			bottom: 0px;
			right: 0px;
		}
	}

	.logo {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		user-select: none;

		margin-left: auto;
		margin-right: auto;

		img {
			width: 100%;
			height: 100%;
		}
	}
</style>

<div class="vendor-group" on:click>
	<img class="no-margin logo" width={x_dim}
		alt={s_alt}
		src={sr_default}
		srcset="{sr_double} 2x"
	>

	{#if showStatusDot}
		<span class="status">
			<Dot n_border={2} b_pulsing={[ConnectionHealth.LOADING, ConnectionHealth.CONNECTING, ConnectionHealth.DELINQUENT].includes($yw_connection_health)}
				sx_color={H_HEALTH_COLOR[$yw_connection_health]}
			/>
		</span>
	{/if}
</div>
