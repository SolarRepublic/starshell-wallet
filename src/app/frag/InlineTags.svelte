<script lang="ts">
	import type {
		SlideParams,
		TransitionConfig,
	} from 'svelte/transition';
	
	import type {Dict} from '#/meta/belt';
	
	import {onDestroy} from 'svelte';
	import {cubicOut} from 'svelte/easing';
	
	import {
		yw_popup,
		yw_context_popup,
		yw_store_tags,
	} from '##/mem';
	
	import PopupTagsSelect from '../popup/PopupTagsSelect.svelte';
	import Dot from '../ui/Dot.svelte';

	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit-small.svg?raw';
	

	/**
	 * Path to the resource to fetch tags for
	 */
	export let resourcePath: string;

	/**
	 * Enables editting the tags here
	 */
	export let editable = false;

	/**
	 * If `true`, displays the tags in collapsed form
	 */
	export let collapsed = false;

	/**
	 * If `true`, displays tag color as a dot with adjacent text
	 */
	export let subtle = true;

	/**
	 * If `true`, does not display empty cluster
	 */
	export let hideIfEmpty = false;

	export let prefixClass = '';
	export let suffixClass = '';

	export let rootStyle = '';

	export let autoCollapse = false;

	// subscribe to tag store changes and reload
	let c_reload_tags = 0;
	const f_unsubscribe = yw_store_tags.subscribe(() => c_reload_tags++);
	onDestroy(() => {
		f_unsubscribe();
	});

	// cache the list of tags for this resource
	$: a_tags = $yw_store_tags?.getTagsFor(resourcePath) || [];

	// auto-collapse
	$: if(autoCollapse && a_tags?.length > 1) collapsed = true;


	if(editable) {
		yw_context_popup.subscribe((g_ctx: Dict<any> | null) => {
			if(g_ctx?.tags) {
				a_tags = g_ctx.tags;
			}
		});

		onDestroy(() => {
			$yw_context_popup= null;
		});
	}

	function show_tag_selector() {
		$yw_context_popup= {
			resource: resourcePath,
		};

		$yw_popup = PopupTagsSelect;
	}


	function sslide(dm_node: Element, {
		delay: xt_delay = 0,
		duration: xt_duration = 400,
		easing: f_easing = cubicOut,
	}: SlideParams = {}): TransitionConfig {
		const d_style = getComputedStyle(dm_node);
		const x_opacity = +d_style.opacity;
		const x_width = parseFloat(d_style.width);
		const x_padding_left = parseFloat(d_style.paddingLeft);
		const x_padding_right = parseFloat(d_style.paddingRight);
		const x_margin_left = parseFloat(d_style.marginLeft);
		const x_margin_right = parseFloat(d_style.marginRight);
		const x_border_left_width = parseFloat(d_style.borderLeftWidth);
		const x_border_right_width = parseFloat(d_style.borderRightWidth);

		return {
			delay: xt_delay,
			duration: xt_duration,
			easing: f_easing,
			css: xt => '--delete-display: none;'
				+ 'overflow: hidden;'
				+ `opacity: ${Math.min(xt * 20, 1) * x_opacity};`
				+ `width: ${xt * x_width}px;`
				+ `padding-left: ${xt * x_padding_left}px;`
				+ `padding-right: ${xt * x_padding_right}px;`
				+ `margin-left: ${xt * x_margin_left}px;`
				+ `margin-right: ${xt * x_margin_right}px;`
				+ `border-left-width: ${xt * x_border_left_width}px;`
				+ `border-right-width: ${xt * x_border_right_width}px;`,
		};
	}
</script>

<style lang="less">
	@import '../_base.less';

	.cluster {
		display: inline-flex;
		vertical-align: middle;
		justify-content: center;
		align-items: center;
		gap: 4px;
		flex-flow: row wrap;
		
		&.collapsed {
			margin: var(--tag-cluster-margin, 0);
			margin-top: 5px;
			justify-content: flex-start;
			display: flex;
		}

		&.editable {
			justify-content: flex-start;

			 margin-top:-10px;
			 margin-bottom:5px;
		}

		&.subtle {
			>.tag {
				>.label {
					color: var(--theme-color-text-med);
				}
			}
		}

		>.tag {
			--tag-width: auto;
			--tag-height: 22px;

			display: inline-flex;
			width: var(--tag-width);
			height: var(--tag-height);
			border-radius: 1em;
			padding: 0 1ch;
			font-size: 13px;

			>.label {
				font-size: 12px;
				margin-top: 2px;
				text-shadow: -1px 1px 1.3px rgb(0 0 0 / 40%);
			}

			&.collapsed {
				--tag-width: var(--app-tag-diameter);
				--tag-height: var(--app-tag-diameter);
				padding: 0;
			}

			.delete.icon {
				--icon-diameter: 22px;
				transform: rotate(45deg);
				transition: transform 200ms ease-out, filter 200ms ease-out;
				cursor: pointer;
				filter: drop-shadow(0px 0px 0px black);
				display: var(--delete-display, initial);

				&:hover {
					transform: rotate(45deg) scale(1.075);
					filter: drop-shadow(-1px 3px 2px rgba(0, 0, 0, 0.4));
				}
			}
		}

		>.edit {
			cursor: pointer;

			>.icon {
				--icon-color: var(--theme-color-primary);
				--icon-diameter: 22px;
				display: flex;
				background-color: transparent;
			}
		}

		.prefix,.suffix {
			.font(tiny);
			color: var(--theme-color-text-light);
			display: inline-flex;
			text-align: center;
		}
	}
</style>

{#if a_tags.length || !hideIfEmpty}
	<span class="cluster"
		class:editable={editable}
		class:collapsed={collapsed}
		class:subtle={subtle}
		style={rootStyle}
	>
		{#if $$slots.prefix}
			<span class="prefix {prefixClass}">
				<slot name="prefix"></slot>
			</span>
		{/if}

		{#key c_reload_tags}
			{#each a_tags as g_tag, i_tag}
				<span class="tag"
					class:collapsed={collapsed}
					out:sslide={{duration:editable? 300: 0}}
					style={`
						${subtle
							? collapsed
								? ''
								: `
									border: 1px solid var(--theme-color-border);
								`
							: `
								background-color: ${g_tag.color};
							`}
					`}
				>
					{#if subtle}
						<Dot sx_color={g_tag.color} sx_style_root="margin-right: 6px;" />
					{/if}

					{#if !collapsed}
						<span class="label">
							{g_tag.name}
						</span>
					{/if}
				</span>
			{/each}
	
			{#if editable}
				{#if a_tags.length}
					<span class="edit" on:click={() => show_tag_selector()}>
						<span class="icon">
							{@html SX_ICON_EDIT}
						</span>
					</span>
				{:else}
					<button class="pill" on:click={() => show_tag_selector()}>
						<span class="global_svg-icon icon-diameter_16px">
							{@html SX_ICON_ADD}
						</span>
		
						<span class="text"></span>
					</button>
				{/if}
			{/if}
		{/key}

		{#if $$slots.suffix}
			<span class="suffix {suffixClass}">
				<slot name="suffix"></slot>
			</span>
		{/if}
	</span>
{/if}
