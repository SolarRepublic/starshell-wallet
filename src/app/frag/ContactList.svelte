<script lang="ts">
	import type {Page} from '../screen/_screens';
	
	import type {O} from 'ts-toolbelt';
	
	import type {Dict, JsonPrimitive} from '#/meta/belt';
	import type {ContractPath, ContractStruct} from '#/meta/chain';
	import type {ContactStruct, ContactPath, ContactAgentType} from '#/meta/contact';
	
	import {getContext} from 'svelte';
	import {quintOut} from 'svelte/easing';
	import {slide} from 'svelte/transition';
	
	import {Agents} from '#/store/agents';
	import {Contracts, ContractRole} from '#/store/contracts';
	import {yw_chain, yw_chain_namespace} from '##/mem';
	
	import ContactEdit from '##/screen/ContactEdit.svelte';
	
	import ContactView from '##/screen/ContactView.svelte';
	import Send from '##/screen/Send.svelte';
	
	import Address from './Address.svelte';
	
	import InlineTags from './InlineTags.svelte';
	import ContractView from '../screen/ContractView.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	
	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import SX_ICON_DELETE from '#/icon/delete.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';
	import SX_ICON_DOTS from '#/icon/more-vert.svg?raw';
	import SX_ICON_ROBOT from '#/icon/robot-toy.svg?raw';
	import SX_ICON_SEND from '#/icon/upload.svg?raw';
	
	const H_AGENT_TYPE_ICONS: Record<ContactAgentType, string> = {
		person: SX_ICON_PERSONAL,
		contract: SX_ICON_CONTRACT,
		robot: SX_ICON_ROBOT,
	};

	// get page from context
	const k_page = getContext<Page>('page');

	type AgentPath = ContactPath | ContractPath;

	type AgentStruct = O.Intersect<
		ContactStruct,
		O.Merge<ContractStruct, {
			agentType: ContactAgentType;
		}>
	>;

	export let filter: (g_agent: AgentStruct) => boolean = () => true;

	const H_AGENT_WEIGHTS = {
		person: 0,
		contract: 1,
		robot: 2,
	};

	export let sort: (g_a: AgentStruct, g_b: AgentStruct) => number = (g_a, g_b) => {
		if(g_a.agentType !== g_b.agentType) {
			return H_AGENT_WEIGHTS[g_a.agentType] - H_AGENT_WEIGHTS[g_b.agentType];
		}

		return g_a.name < g_b.name? -1: 1;
	};

	export let append: ContactStruct[] = [];


	// load all contacts for the current chain's family as a list
	async function load_agents(): Promise<[AgentPath, AgentStruct][]> {
		// read from agents store
		const ks_agents = await Agents.read();

		// read from contracts store
		const ks_contracts = await Contracts.read();

		// spread iterator into array and filter
		const a_filtered = [
			...[...ks_agents.contacts($yw_chain_namespace)],
			...[
				...await ks_contracts.filterRole(ContractRole.OTHER),
			].map(([p_contract, g_contract]) => [p_contract, {
				...g_contract,
				agentType: 'contract',
			} as AgentStruct]),
		].filter(([, g_agent]) => filter(g_agent as AgentStruct)) as [AgentPath, AgentStruct][];

		// apply sort
		return a_filtered.sort(([, g_agent_a], [, g_agent_b]) => sort(g_agent_a, g_agent_b));
	}

	const hm_events = new WeakMap<Event, Dict<JsonPrimitive>>();

	let si_overlay = '';
	function activate_overlay(p_contact: string, g_agent: AgentStruct): (d: MouseEvent) => void {
		return (d_event: MouseEvent) => {
			// prevent event from bubbling
			d_event.stopImmediatePropagation();

			// ref entry id
			const si_set = p_contact;

			// overlay already set to this entry; hide it
			if(hm_events.get(d_event)?.cancelMenu === si_set) {
				si_overlay = '';
				return;
			}

			// set overlay to this entry
			si_overlay = si_set;

			// remove on click event
			window.addEventListener('click', () => {
				hm_events.set(d_event, {
					cancelMenu: si_overlay,
				});
				si_overlay = '';
			}, {
				capture: true,
				once: true,
			});
		};
	}

	const a_overlay_actions: {
		label: string;
		icon: string;
		click(g_contact: ContactStruct): void;
	}[] = [
		{
			label: 'Edit',
			icon: SX_ICON_EDIT,
			click(g_contact: ContactStruct) {
				k_page.push({
					creator: ContactEdit,
					props: {
						contactPath: Agents.pathFromContact(g_contact),
					},
				});
			},
		},
		{
			label: 'Send',
			icon: SX_ICON_SEND,
			click(g_contact: ContactStruct) {
				k_page.push({
					creator: Send,
					props: {
						recipient: Agents.addressFor(g_contact, $yw_chain),
					},
				});
			},
		},
		// {
		// 	label: 'Delete',
		// 	icon: SX_ICON_DELETE,
		// 	click(g_contact: ContactStruct) {
		// 		// TODO:
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 			props: {},
		// 		});
		// 	},
		// },
	];
</script>

<style lang="less">
	@import '../_base.less';

	.rows {
		margin-left: calc(0px - var(--ui-padding));
		margin-right: calc(0px - var(--ui-padding));

		.row {
			.status {
				:global(&) {
					position: relative;
				}

				.icon.more-menu {
					:global(&) {
						padding-top: 50%;
						padding-bottom: 50%;
						--icon-diameter: 24px;
						--icon-color: var(--theme-color-primary);
						outline: 1px solid transparent;
						transition: 350ms outline-color var(--ease-out-cubic);
					}

					:global(&:hover) {
						outline-color: var(--theme-color-border);
					}

					:global(&:active), :global(&.active) {
						outline-color: var(--theme-color-primary);
					}
				}

				.overlay {
					:global(&) {
						position: absolute;
						padding: 10px 14px;
						background-color: rgba(0, 0, 0, 0.95);
						border-radius: 8px;
						right: 26px;
						top: -18px;
						min-width: 120px;
						z-index: 100;
					}

					>.action {
						:global(&) {
							display: flex;
							padding: 10px 8px;
						}

						>.text {
							:global(&) {
								padding-left: 10px;
							}
						}
					}

					.icon {
						:global(&) {
							--icon-diameter: 24px;
							--icon-color: var(--theme-color-primary);
						}
					}
				}
			}
		}
	}

	.icon.contact-type {
		--icon-diameter: 16px;
		--icon-color: var(--theme-color-text-med);
	}

	.pfp-gen {
		.font(huge);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 20%;
		outline: 1px solid var(--theme-color-primary);
		background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
	}

	.empty-state {
		text-align: center;
		padding: 1.5em 0;
		color: var(--theme-color-text-med);
		font-size: 13px;
	}
</style>

<div class="rows">
	{#await load_agents()}
		<LoadingRows count={3} />
	{:then a_list}
		{#if !a_list.length}
			<!-- TODO: empty state -->
			<div class="empty-state">
				No contacts of this type yet
			</div>
		{:else}
			{#each a_list as [p_agent, g_agent]}
				<Row
					--app-icon-diameter='36px'
					resource={g_agent}
					resourcePath={p_agent}
					on:click={(d_event) => {
						if(!hm_events.get(d_event)?.cancelMenu) {
							if('contract' === g_agent.agentType) {
								k_page.push({
									creator: ContractView,
									props: {
										contractPath: p_agent,
									},
								});
							}
							else {
								k_page.push({
									creator: ContactView,
									props: {
										contactPath: p_agent,
									},
								});
							}
						}
					}}
				>
					<span class="global_svg-icon icon-diameter_18px" slot="prename" style={`
						margin-right: 5px;
						color: var(--theme-color-graymed);
						vertical-align: text-bottom;
					`}>
						{@html H_AGENT_TYPE_ICONS[g_agent.agentType] }
					</span>

					<svelte:fragment slot="detail">
						<Address address={Agents.addressFor(g_agent, $yw_chain)} />
					</svelte:fragment>

					<svelte:fragment slot="tags">
						<InlineTags subtle rootStyle='margin: 0px;'
							resourcePath={p_agent}
						>
						</InlineTags>
					</svelte:fragment>

					<svelte:fragment slot="status">
						<span
							class="icon more-menu"
							class:active={si_overlay === p_agent}
							on:click={activate_overlay(p_agent, g_agent)}
						>
							{@html SX_ICON_DOTS}
						</span>

						{#if si_overlay === p_agent}
							<span class="overlay" transition:slide={{duration:300, easing:quintOut}}>
								{#each a_overlay_actions as g_action}
									<div class="action" on:click={(d_event) => {
										d_event.stopPropagation();
										g_action.click(g_agent);
									}}>
										<span class="icon">
											{@html g_action.icon}
										</span>

										<span class="text">
											{g_action.label}
										</span>
									</div>
								{/each}
							</span>
						{/if}
					</svelte:fragment>
				</Row>
			{/each}
		{/if}
	{/await}
</div>