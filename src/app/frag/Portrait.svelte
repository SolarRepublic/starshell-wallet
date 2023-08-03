<script context="module" lang="ts">
	export interface ActionRegistry {
		send: {};
		recv: {};
		add: {};
		edit: {};
		wrap: {};
		unwrap: {};
		delete: {};
		revoke: {};
		permissions: {};
		accounts: {};
		disconnect: {};
		enable: {};
		share: {};
		export: {};
		more: {};
		unblock: {};
		migrate: {};
	}

	export type ActionKey = keyof ActionRegistry;

	export interface DefaultActionConfig {
		label: string;
		icon: string;
	}

	export interface CustomActionConfig {
		label?: string;
		trigger: VoidFunction;
	}

	export type Actions = Partial<Record<ActionKey, CustomActionConfig>>;
</script>

<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Promisable} from '#/meta/belt';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {yw_store_tags} from '../mem';
	
	import {forever, F_NOOP, ode} from '#/util/belt';
	
	import InlineTags from './InlineTags.svelte';
	import PfpDisplay from './PfpDisplay.svelte';
	import Load from '../ui/Load.svelte';
	
	import SX_ICON_ADD from '#/icon/add.svg?raw';
	import SX_ICON_BAN from '#/icon/ban.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_ICON_DELETE from '#/icon/delete.svg?raw';
	import SX_ICON_DOWNLOAD from '#/icon/download.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';
	import SX_ICON_GROUP from '#/icon/group.svg?raw';
	import SX_ICON_HEXAGON_CHECK from '#/icon/hexagon-check.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import SX_ICON_MORE_VERT from '#/icon/more-vert.svg?raw';
	import SX_ICON_PERSON from '#/icon/person.svg?raw';
	import SX_ICON_PLUG from '#/icon/plug.svg?raw';
	import SX_ICON_RECV from '#/icon/recv.svg?raw';
	import SX_ICON_SEND from '#/icon/send.svg?raw';
	import SX_ICON_SHARE from '#/icon/share.svg?raw';
	import SX_ICON_SHIELD_HOLLOW from '#/icon/shield-hollow.svg?raw';
	import SX_ICON_SHIELD_INSPECT from '#/icon/shield-inspect.svg?raw';
	import SX_ICON_UNWRAP from '#/icon/unwrap.svg?raw';
	import SX_ICON_WRAP from '#/icon/wrap.svg?raw';
	import SX_ICON_MONEY_MOVE from '#/icon/money-move.svg?raw';
	import { createEventDispatcher } from 'svelte';

	const H_ACTIONS: Record<ActionKey, DefaultActionConfig> = {
		send: {
			label: 'Send',
			icon: SX_ICON_SEND,
		},
		recv: {
			label: 'Receive',
			icon: SX_ICON_RECV,
		},
		add: {
			label: 'Add',
			icon: SX_ICON_ADD,
		},
		edit: {
			label: 'Edit',
			icon: SX_ICON_EDIT,
		},
		wrap: {
			label: 'Wrap',
			icon: SX_ICON_WRAP,
		},
		unwrap: {
			label: 'Unwrap',
			icon: SX_ICON_UNWRAP,
		},
		delete: {
			label: 'Delete',
			icon: SX_ICON_DELETE,
		},
		permissions: {
			label: 'Permissions',
			icon: SX_ICON_SHIELD_INSPECT,
		},
		accounts: {
			label: 'Accounts',
			icon: SX_ICON_GROUP,
		},
		disconnect: {
			label: 'Disconnect',
			icon: SX_ICON_CLOSE,
		},
		revoke: {
			label: 'Revoke',
			icon: SX_ICON_BAN,
		},
		share: {
			label: 'Share',
			icon: SX_ICON_SHARE,
		},
		enable: {
			label: 'Enable',
			icon: SX_ICON_PLUG,
		},
		export: {
			label: 'Export',
			icon: SX_ICON_DOWNLOAD,
		},
		more: {
			label: 'More',
			icon: SX_ICON_MORE_VERT,
		},
		unblock: {
			label: 'Unblock',
			icon: SX_ICON_HEXAGON_CHECK,
		},
		migrate: {
			label: 'Migrate',
			icon: SX_ICON_MONEY_MOVE,
		},
	};

	/**
	 * Set to true to display a loading portrait
	 */
	export let loading = false;

	/**
	 * Extract pfp and name from a resource
	 */
	export let resource: (Pfpable & Nameable) | null = null;

	/**
	 * Infer pfp from resource
	 */
	export let pfp: PfpTarget | '' = resource?.pfp || '';
	// const p_pfp = pfp;

	/**
	 * Set to true to use a circular pfp
	 */
	export let circular = false;
	const b_circular = circular;

	/**
	 * Set to true to disable pfp
	 */
	export let noPfp = false;
	const b_no_pfp = noPfp;

	/**
	 * Path to the resource for looking up tags
	 */
	export let resourcePath = '';
	const p_resource = resourcePath;

	export let pfpFilter: ''|'testnet' = '';

	// reactively load tags for this resource
	$: a_tags = $yw_store_tags!.getTagsFor(p_resource);

	export let rootClasses = '';
	const s_classes = rootClasses;

	export let title: Promisable<string> = resource?.name || (loading? forever(''):'');
	export let postTitle: Promisable<string> = '';

	export let subtitle: Promisable<string> = loading? forever(''): '';

	/**
	 * Configure which actions are available to this resource
	 */
	export let actions: null | Partial<Actions> = null;


	export let info = false;

	const dispatch = createEventDispatcher();
	function pfp_click(d_event: MouseEvent) {
		dispatch('pfp_click', d_event);
	}
</script>

<style lang="less">
	@import '../_base.less';

	.portrait {
		display: flex;
		flex-direction: column;
		padding-top: 1em;

		>.pfp {
			width: 100%;
			text-align: center;
			margin-bottom: 10px;
			
			>.icon {
				--icon-diameter: 64px;

				.group {
					:global(&) {
						transform: scale(1.5);
					}
				}

				img {
					:global(&) {
						border-radius: 20%;
					}
				}
			}
		}

		>.title {
			.font(huge);
			display: flex;
			justify-content: left;
			gap: 4px;
			white-space: nowrap;
			overflow: scroll;
			.hide-scrollbar();

			>.title-group {
				min-width: 100%;
				text-align: center;

				.post-title {
					color: var(--theme-color-text-med);
				}

				>.info {
					fill: var(--theme-color-primary);
					vertical-align: baseline;

					>svg {
						:global(&) {
							margin-top: -4px;
							vertical-align: middle;
							width: 20px;
							height: 20px;
						}
					}
				}
			}
		}

		>.subtitle {
			.font(regular);
			text-align: center;
			color: var(--theme-color-text-med);
			margin-top: 4px;
			overflow: scroll;
			.hide-scrollbar();
		}

		>.actions {
			display: flex;
			justify-content: center;
			margin-top: 1rem;
			margin-bottom: 1rem;

			>.action {
				.font(tiny);

				cursor: pointer;
				flex: 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 5px;

				color: var(--theme-color-text-med);
				min-width: calc(48px + 3.5ex);
				text-align: center;

				>.icon {
					--button-diameter: 48px;
					--icon-diameter: 20px;
					background-color: var(--theme-color-border);

					display: inline-flex;
					justify-content: center;
					align-items: center;
				}

				&:hover {
					>.icon {
						--icon-color: black;
						background-color: var(--theme-color-primary);
					}
				}
			}
		}
	}
</style>


<div class="portrait {s_classes}" data-path={p_resource}>
	{#if !b_no_pfp}
		<div class="pfp" on:click={pfp_click}>
			{#if $$slots.pfp}
				<span class="icon">
					<slot name="pfp">
						Empty pfp slot
					</slot>
				</span>
			{:else}
				<PfpDisplay path={pfp} resource={resource} dim={64} circular={b_circular} filter={pfpFilter} />
			{/if}
		</div>
	{/if}
	<div class="title">
		<span class="title-group">
			<Load input={title} classes="text" />
			{#if postTitle}
				<Load input={postTitle} classes="post-title" />
			{/if}
			{#if info}
				<span class="info">
					{@html SX_ICON_INFO}
				</span>
			{/if}
		</span>
	</div>
	{#if subtitle || $$slots.subtitle}
		<div class="subtitle">
			<span class="text">
				<slot name="subtitle">
					<Load input={subtitle} />
				</slot>
			</span>
		</div>
	{/if}

	{#if resourcePath}
		<InlineTags hideIfEmpty resourcePath={p_resource} rootStyle='margin: var(--ui-padding) 0 0 0;' />
	{/if}

	{#if Object.keys(actions || {}).length}
		<div class="actions">
			{#each ode(actions || {}) as [si_action, gc_action]}
				<span class="action action-{si_action}" on:click={loading? F_NOOP: () => gc_action?.trigger?.()}>
					<span class="global_svg-icon icon-diameter_20px icon">
						{@html H_ACTIONS[si_action]?.icon || '?'}
					</span>
					<span class="label">
						{gc_action?.label || H_ACTIONS[si_action]?.label || ''}
					</span>
				</span>
			{/each}
		</div>
	{/if}

	
</div>