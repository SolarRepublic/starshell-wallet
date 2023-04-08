<script lang="ts">
	import type {AccountStruct} from '#/meta/account';

	import {AppApiMode} from '#/meta/app';
	
	import {createEventDispatcher} from 'svelte';
	
	import {ThreadId} from '../def';
	
	import {keplr_polyfill_script_add_matches} from '#/script/scripts';
	import {Apps} from '#/store/apps';
	import {Policies} from '#/store/policies';
	import {Secrets} from '#/store/secrets';
	import {yw_account, yw_account_ref, yw_chain_ref, yw_navigator, yw_overlay_account, yw_overlay_app, yw_owner} from '##/mem';
	
	import AppView from '../screen/AppView.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_CONFIRMATION from '#/icon/confirmation.svg?raw';
	import SX_ICON_ARROW_DOWN from '#/icon/expand_more.svg?raw';

	import SX_ICON_CHECKED from '#/icon/checked-circle.svg?raw';
	
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	import { Accounts } from '#/store/accounts';
	import { Settings } from '#/store/settings';
	import PfpDisplay from './PfpDisplay.svelte';
	

	function pause(dm: HTMLElement, gc?: any) {
		return {
			duration: 200,
		};
	}

	const dispatch = createEventDispatcher();

</script>

<style lang="less">
	@import '../_base.less';

	.overlay {
		padding-left: var(--ui-padding);
		padding-right: var(--ui-padding);
		padding-bottom: var(--ui-padding);

		background-color: rgba(0, 0, 0, 0.95);
		border-radius: 8px;
		max-height: 320px;
		display: flex;
		flex-direction: column;
		overscroll-behavior: contain;
		overflow: scroll;
		.hide-scrollbar();

		box-sizing: border-box;

		>.top {
			display: flex;
			justify-content: space-between;
			align-items: center;

			>h3 {
				margin: 16px 0;
			}

			>.add-new {
				>.icon {
					--icon-diameter: 8px;
					--icon-color: var(--theme-color-primary);
				}
			}

			.status-bulb(@bg) {
				content: "\a0";
				border-radius: 6px;
				background-color: @bg;
				width: 6px;
				height: 6px;
				display: inline-flex;
				vertical-align: middle;
				margin-right: 5px;
				margin-top: -2px;
			}

			>.status {
				font-size: 12px;
				color: var(--theme-color-text-med);

				&.connected {
					color: var(--theme-color-grass);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-grass));
					}
				}

				&.no_permissions,&.disabled {
					color: var(--theme-color-caution);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-caution));
					}
				}

				&.blocked {
					color: var(--theme-color-red);

					&::before {
						position: relative;
						.status-bulb(var(--theme-color-red));
					}
				}
			}
		}

		>.rows {
			display: flex;
			flex-direction: column;
			--row-padding: 12px;


			.overlay-select.icon {
				:global(&) {
					--icon-diameter: 20px;
					align-self: center;
				}
			}

			>.row {
				:global(&) {
					padding-top: var(--row-padding) !important;
					padding-left: 0 !important;
					padding-right: var(--row-padding) !important;
					padding-bottom: var(--row-padding) !important;
				}
			}
		}
	}

	.secondary-group {
		text-align: center;
		margin: 1em;
	}
</style>

<div class="overlay select" out:pause>
	<div class="top">
		<h3>
			Switch Account
		</h3>
	</div>

	<div class="rows">
		{#await Accounts.read()}
			...
		{:then ks_accounts}
			{#each ks_accounts.entries() as [p_account, g_account]}
				<Row
					resource={g_account}
					resourcePath={p_account}
					detail={g_account.assets[$yw_chain_ref]?.totalFiatCache ?? '(?)'}
					on:click={() => {
						// currently selected account; exit
						if(p_account === $yw_account_ref) return;

						// update current account
						$yw_account_ref = p_account;

						// save selection
						void Settings.set('p_account_selected', p_account);

						// dispatch change event
						dispatch('change', p_account);
					}}
				>
					<svelte:fragment slot="right">
						{#if $yw_account_ref === p_account}
							<span class="overlay-select icon" style="--icon-color: var(--theme-color-primary);">
								{@html SX_ICON_CHECKED}
							</span>
						{/if}
					</svelte:fragment>

					<svelte:fragment slot="icon">
						<PfpDisplay dim={32} resource={g_account} />
					</svelte:fragment>
				</Row>
			{/each}
		{/await}
	</div>
</div>
