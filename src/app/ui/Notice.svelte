<script lang="ts">
	import {createEventDispatcher} from 'svelte';
	import {slide} from 'svelte/transition';

	import {Settings, type SettingsKey} from '#/store/settings';
	
	import Close from './Close.svelte';
	
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_ERROR from '#/icon/error.svg?raw';
    import { yw_settings } from '../mem';
	

	const dispatch = createEventDispatcher();

	const H_ICONS = {
		error: {
			svg: SX_ICON_ERROR,
			color: 'var(--theme-color-orange);',
		},
	} as const;

	/**
	 * Preset icon to use
	 */
	export let icon: keyof typeof H_ICONS | '' = '';

	/**
	 * Title of the notice
	 */
	export let title: string;

	/**
	 * If set to a non-empty string, indicates the ID for this notice
	 */
	export let dismissable: boolean | string = false;
	const si_notice = 'string' === typeof dismissable? dismissable: '';
	const si_setting = (si_notice? `notice_${si_notice}`: '') as SettingsKey;

	/**
	 * Optional action text and callback
	 */
	export let action: [string, VoidFunction] | null = null;

	/**
	 * Style to apply to root element
	 */
	export let rootStyle = '';

	let b_display = !si_setting;

	if(si_setting) {
		if(true !== $yw_settings[si_setting]) {
			b_display = true;
		}
	}

	// TODO: delete if above settings gette rworks
	// (async function load() {
	// 	if(si_setting) {
	// 		const b_dismissed = await Settings.get(si_setting);
	// 		if(true !== b_dismissed) {
	// 			b_display = true;
	// 		}
	// 	}
	// })();

	async function dismiss() {
		dispatch('dismiss');

		b_display = false;

		if(si_setting) {
			await Settings.set(si_setting, true);
		}
	}

</script>

<style lang="less">
	@import '../_base.less';

	.notice {
		background-color: var(--theme-color-black);
		border-radius: 8px;
		display: flex;
		gap: 10px;
		flex-direction: column;
		padding: 20px;
		outline: 1px solid var(--theme-color-graydark);
		
		.header {
			position: relative;

			.title {
				.font(regular);
			}

			.exit {
				position: absolute;
				right: -28px;
				top: -28px;
			}
		}

		.body {
			.font(tiny);
			color: var(--theme-color-graymed);
		}

		.actions {
			margin-top: 5px;
		}
	}
</style>

{#if b_display}
	<div class="notice" style={rootStyle} transition:slide>
		<div class="header no-blur">
			{#if icon}
				<span class="global_svg-icon" style={`color:${H_ICONS[icon].color};`}>
					{@html H_ICONS[icon].svg}
				</span>
			{/if}

			<span class="title">
				{title}
			</span>

			{#if dismissable}
				<span class="exit">
					<Close bgColor="var(--theme-color-black)" on:click={dismiss} />
				</span>
			{/if}
		</div>

		<div class="body">
			<slot />
		</div>

		<div class="actions">
			{#if action}
				<button class="pill" on:click={() => action?.[1]()}>
					{action[0]}
				</button>
			{/if}
		</div>
	</div>
{/if}