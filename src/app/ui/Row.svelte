<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Dict, Promisable} from '#/meta/belt';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {createEventDispatcher, onDestroy} from 'svelte';
	
	import {yw_nav_collapsed, yw_nav_visible, yw_store_tags} from '../mem';
	
	import {oderom} from '#/util/belt';
	
	import {AbbreviationLevel} from '#/util/format';
	
	import Load from './Load.svelte';
	import Address from '../frag/Address.svelte';
	import InlineTags from '../frag/InlineTags.svelte';
	import PfpDisplay, { type PfpFilter } from '../frag/PfpDisplay.svelte';


	/**
	 * Path to base resource to represent
	 */
	export let resourcePath = '';

	/**
	 * Base resource to represent
	 */
	export let resource: (Nameable & Pfpable) = null!;
	
	/**
	 * Overrides name automatically extracted from resource
	 */
	export let name: Promisable<string> = resource?.name;

	export let pfpFilter: PfpFilter = '';

	/**
	 * Adds ` ({VALUE})` after the name in a dimmer color
	 */
	export let postname = '';

	export let postnameTags = false;

	export let postnameDelimiter: '()' | ':' | '-' = '()';

	/**
	 * Disables pfp
	*/
	export let noPfp = false;

	/** 
	 * Disables tags
	*/
	export let noTags = false;

	/**
	 * Overrides pfp automatically extracted from resource
	 */
	export let pfp: PfpTarget = resource?.pfp;

	/**
	 * Sets the dimensions of the pfp icon
	 */
	export let pfpDim = 36;

	/**
	 * Indicates the row's pfp comes from an app
	 */
	export let appRelated = false;

	/**
	 * Shows the row as being crossed out
	 */
	export let cancelled = false;

	/**
	 * Optional dict to use to create data attributes on root element
	 */
	export let data: Dict = {};

	/**
	 * Enables drag-and-drop reordering
	 */
	export let b_draggable = false;
	

	const h_data_attrs = oderom(data, (si_key, s_value) => ({
		[`data-${si_key}`]: s_value,
	}));

	export let amount: Promisable<string> = '';
	export let fiat: Promisable<string> = '';
	export let symbol = '';
	export let lockIcon = false;
	export let address = '';
	export let abbreviate: AbbreviationLevel = AbbreviationLevel.NONE;
	export let copyable = false;
	export let detail = '';
	export let prefix = '';

	export let embedded = false;

	export let b_amount_updating = false;


	// export let tagRefs: Tag.Ref[] | null = null;
	export let rootStyle = '';

	export let noHorizontalPad = false;
	if(noHorizontalPad) {
		rootStyle = `
			padding-left: 0;
			padding-right: 0;
			${rootStyle}
		`;
	}

	export let rootClasses = '';

	export let childClasses = '';

	export let iconClass = '';

	let dm_row: HTMLDivElement;

	// load tags from resource path
	const a_tags = resourcePath? $yw_store_tags?.getTagsFor(resourcePath) || []: [];
	
	const as_intervals = new Set<number>();

	const dispatch = createEventDispatcher();

	onDestroy(() => {
		for(const i_interval of as_intervals) {
			clearInterval(i_interval);
		}
	});


	let b_restore_nav = false;
	function drag_start(d_event: DragEvent) {
		if(!b_draggable) return;

		b_restore_nav = $yw_nav_visible && !$yw_nav_collapsed;
		if(b_restore_nav) $yw_nav_collapsed = true;

		const d_transfer = d_event.dataTransfer!;

		d_transfer.dropEffect = 'move';
		d_transfer.effectAllowed = 'move';

		d_transfer.clearData();
		d_transfer.setData('application/json', JSON.stringify({
			p_resource: resourcePath,
		}));
	}

	function drag_end() {
		if(b_restore_nav) $yw_nav_collapsed = true;
	}

	let sx_style_drag = '';
	let xl_mid_y = 0;

	function drag_enter(d_event: DragEvent) {
		if(!b_draggable) return;

		const {
			top: xl_top,
			height: xl_height,
		} = dm_row.getBoundingClientRect();

		xl_mid_y = xl_top + (xl_height / 2);

		d_event.preventDefault();
	}

	let xc_above_below: -1 | 0 | 1 = 0;
	function drag_over(d_event: DragEvent) {
		if(!b_draggable) return;

		const xl_y = d_event.clientY;

		if(xl_y <= xl_mid_y) {
			if(-1 !== xc_above_below) {
				xc_above_below = -1;
				sx_style_drag = `
					border-top: 2px solid var(--theme-color-primary);
					margin-top: -1px;
				`;
			}
		}
		else if(1 !== xc_above_below) {
			xc_above_below = 1;
			sx_style_drag = `
				border-bottom: 2px solid var(--theme-color-primary);
				margin-bottom: -1px;
			`;
		}

		d_event.preventDefault();
	}

	function drag_leave() {
		if(!b_draggable) return;

		xc_above_below = 0;
		sx_style_drag = '';
	}

	function drop(d_event: DragEvent) {
		if(!b_draggable) return;

		// reset drag styling
		sx_style_drag = '';

		const g_src = JSON.parse(d_event.dataTransfer!.getData('application/json') || '{}');

		dispatch('dropRow', {
			src: g_src,
			dst: {
				p_resource: resourcePath,
			},
			relation: xc_above_below,
		});
	}
</script>

<style lang="less">
	@import '../_base.less';

	.monoline() {
		white-space: nowrap;
		overflow-x: hidden;
		text-overflow: ellipsis;
	}

	:root {
		--row-padding: 20px;
		--icon-margin: 14px;
	}

	.row {
		padding: var(--row-padding);
		border-top: 0px solid var(--theme-color-border);
		border-bottom: 1px solid var(--theme-color-border);
		max-width: var(--app-window-width);
		// overflow-x: scroll;
		cursor: pointer;

		// display: flex;
		// align-items: center;

		display: flex;
		flex-direction: column;

		&:first-child:not(.display_contents>.row) {
			border-top-width: 1px;
		}

		&.embedded {
			border: none;
			padding: calc(var(--row-padding) / 2) 0;
		}

		&.cancelled {
			text-decoration: line-through;
			opacity: 0.6;
		}

		>.banner {
			display: flex;
			align-items: center;
		}

		&:nth-child(n+2) {
			border-top-color: transparent;
		}

		
		.icon {
			--icon-diameter: var(--icon-diameter, var(--app-icon-diameter));
			// align-self: flex-start;
			// margin-top: 2px;

			flex: 0 0 var(--icon-diameter);
			margin-right: var(--icon-margin);

			&.bordered {
				--icon-diameter: calc(var(--app-icon-diameter) - 2px);
				background-color: var(--button-color, var(--theme-color-border));
			}

			&>.icon-20 {
				:global(&) {
					--icon-diameter: 18px;
				}
			}

			img {
				:global(&) {
					border-radius: 20%;
				}
			}

			&.site {
				:global(&) {
					background-color: var(--theme-color-text-light);
				}
			}
		}

		// display: flex;
		// flex-direction: row;
		// justify-content: center;

		.content {
			flex: auto;
			
			display: flex;
			width: 0;
			max-width: calc(var(--app-window-width) - var(--app-icon-diameter) - var(--icon-margin) - var(--row-padding) - var(--row-padding));
			gap: 8px;

			>.part {
				flex: auto;

				display: flex;
				flex-direction: column;

				&.main {
					overflow: hidden;

					>.title {
						display: flex;
						gap: calc(var(--ui-padding) / 2);
						align-items: center;
						flex: 0;

						>.name {
							.font(regular);

							display: inline-flex;
							max-width: 100%;

							>.text {
								max-width: 100%;
								.monoline();
							}

							.postname {
								color: var(--theme-color-text-med);
							}
						}

						>.symbol {
							color: var(--theme-color-text-med);
							margin-left: 0.63ch;
						}

						>svg {
							:global(&) {
								margin-left: -1px;
								vertical-align: -3px;
							}
						}
					}

					>.subtitle {
						flex: 0;

						>:nth-child(n+2) {
							:global(&) {
								margin-left: 4px;
							}
						}

						>.detail {
							color: var(--theme-color-text-med);
							
							.font(tiny);
						}

						>.contact {
							display: flex;
							color: var(--theme-color-text-med);
							.font(tiny);
							
							>.icon {
								--icon-diameter: 0.8em;
								--icon-margin: 0.5em;
								margin-top: -1px;
								color: var(--theme-color-text-med);
							}
							>.text {
							}
						}
					}
				}
				
				&.status {
					text-align: right;
					max-width: 55%;

					.amount {
						.font(regular);
						flex: 0;
					}

					.fiat-container {
						:global(.fiat) {
							.font(tiny);
							flex: 0;
							color: var(--theme-color-text-med);
							white-space: nowrap;
						}
					}
				}
			}
		}
	}

	.number {
		display: inline-flex;
		max-width: 18ch;
		overflow-x: scroll;
		.hide-scrollbar();

		white-space: nowrap;
	}

	.rest {
		margin-left: calc(var(--icon-margin) + var(--app-icon-diameter));
	}
</style>

<div class="row {rootClasses}"
	class:cancelled={cancelled}
	class:embedded={embedded}
	style={rootStyle+sx_style_drag}
	{...h_data_attrs}
	on:click
	draggable={b_draggable? 'true': 'false'}
	on:dragstart={drag_start}
	on:dragend={drag_end}
	on:dragover={drag_over}
	on:dragenter={drag_enter}
	on:dragleave={drag_leave}
	on:drop={drop}
	bind:this={dm_row}
	data-resource-path={resourcePath}
>
	<div class="banner {childClasses}">
		{#if !noPfp}
			<span class="icon {iconClass}">
				<slot name="icon">
					{#await name}
						<PfpDisplay
							path={pfp}
							name={'?'}
							dim={pfpDim}
							filter={pfpFilter}
							{appRelated}
						/>
					{:then s_name}
						<!-- <PfpDisplay path={pfp} name={s_name} dim={pfpDim} filter={resource?.['testnet']? 'testnet': ''} {appRelated} /> -->

						<PfpDisplay resource={resource}
							path={pfp}
							name={s_name}
							dim={pfpDim}
							filter={pfpFilter}
							{appRelated}
						/>
					{/await}
				</slot>
			</span>
		{/if}
		<span class="content">
			<span class="main part">
				<div class="title">
					<span class="name">
						<slot name="prename" />
						<span class="text">
							<Load input={name} />
							{#if postname}
								<span class="postname">
									{#if '()' === postnameDelimiter}
										({postname})
									{:else if '-' === postnameDelimiter}
										- {postname}
									{:else if ':' === postnameDelimiter}
										: {postname}
									{/if}
								</span>
							{/if}
						</span>
					</span>

					{#if postnameTags && resourcePath}
						<InlineTags subtle autoCollapse
							rootStyle='margin: 0px;'
							{resourcePath}
						/>
					{/if}
					<!-- {#if symbol}
						<span class="symbol">
							{symbol}
						</span>
					{/if} -->
					{#if lockIcon}
						<!-- <LockOutline color='var(--theme-color-text-med)' size='18px' /> -->
					{/if}
				</div>
				{#if address || symbol || detail || a_tags.length || $$slots.detail}
					<div class="subtitle">
	<!-- 					
						{#if k_contact}
							<span class="contact">
								<span class="icon">
									<Fa icon={faUser} />
								</span>
								<span class="text">
									{k_contact.def.label}
								</span>
							</span> -->
						{#if detail || symbol || $$slots.detail}
							<span class="detail">
								<slot name="detail">
									{prefix}{detail || symbol}
								</slot>
							</span>
						{:else if address}
							<Address discreet {abbreviate}
								address={address}
								copyable={!!copyable}
							/>
						{/if}
					</div>
				{/if}
			</span>

			<span class="status part">
				{#if $$slots.status}
					<slot name="status"></slot>
				{:else if amount}
					<div class="amount" class:global_pulse={b_amount_updating}>
						<span class="number">
							<Load input={amount} pad />
							<!-- {#await start_spinner(amount)}
								<span class="font-family_mono">
									{s_spin}
								</span>
							{:then s_amount}
								<span>
									{amount}
								</span>
							{/await} -->
						</span>
					</div>

					{#if fiat}
						<div class="fiat-container">
							<Load input={fiat} classes="fiat" pad />
						</div>
					{/if}
				{/if}
			</span>
		</span>
		{#if $$slots.right}
			<slot name="right" />
		{/if}
	</div>

	{#if (resourcePath && (a_tags.length || $$slots.tags) && !postnameTags && !noTags) || $$slots.below}
		<div class="rest {childClasses}">
			{#if resourcePath && (a_tags.length || $$slots.tags) && !postnameTags && !noTags}
				<slot name="tags">
					<InlineTags subtle rootStyle='margin: 0px;'
						{resourcePath}
					/>
				</slot>
			{/if}

			<slot name="below"></slot>
		</div>
	{/if}
</div>
