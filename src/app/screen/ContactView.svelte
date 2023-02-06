<script lang="ts">
	import type {ContactStruct, ContactPath} from '#/meta/contact';
	
	import type {Incident} from '#/meta/incident';
	
	import {getContext} from 'svelte';
	
	import {Header, type Page, Screen} from '../screen/_screens';
	
	import Address from '#/app/frag/Address.svelte';
	import Portrait from '#/app/frag/Portrait.svelte';
	import {Agents} from '#/store/agents';
	
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {yw_chain} from '##/mem';
	
	import Send from '##/screen/Send.svelte';
	
	import ContactEdit from './ContactEdit.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	

	export let contactPath: ContactPath;
	const p_contact = contactPath;

	let g_contact: ContactStruct;

	const dp_contact = Agents.getContact(p_contact).then(g => g_contact = g!);

	$: sa_contact = g_contact? Agents.addressFor(g_contact, $yw_chain): '';

	const k_page = getContext<Page>('page');

	const gc_actions = {
		send: {
			label: 'Send',
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						recipient: Agents.addressFor(g_contact, $yw_chain),
					},
				});
			},
		},
		edit: {
			label: 'Edit',
			trigger() {
				k_page.push({
					creator: ContactEdit,
					props: {
						contactPath: p_contact,
					},
				});
			},
		},
		// delete: {
		// 	label: 'Delete',
		// 	trigger() {
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 		});
		// 	},
		// },
	};

	// load incidents
	async function load_incidents() {
		const ks_incidents = await Incidents.read();

		await dp_contact;

		const a_incidents: Incident.Struct[] = [];

		// each incident in store
		FILTERING_INCIDENTS:
		for(const [, g_incident] of ks_incidents.entries()) {
			// only interested in transactions
			if(!['tx_in', 'tx_out'].includes(g_incident.type)) continue;

			// destructure incident
			const {
				data: g_data,
			} = g_incident as Incident.Struct<'tx_in' | 'tx_out'>;

			const g_chain = (await Chains.at(g_data.chain))!;

			const sa_agent = Agents.addressFor(g_contact, g_chain);

			for(const g_event of g_data.events.transfer || []) {
				if(sa_agent === g_event.sender || sa_agent === g_event.recipient) {
					a_incidents.push(g_incident);
					continue FILTERING_INCIDENTS;
				}
			}
		}

		return a_incidents.reverse().sort((g_a, g_b) => g_b.time - g_a.time);
	}

</script>

<style lang="less">
	@import '../_base.less';


	.pfp-gen {
		.font(huge, @size: 30px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 20%;
		outline: 1px solid var(--theme-color-primary);
		background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
	}
</style>


<Screen nav slides>
	<Header title='Agent' pops search network account />

	{#await dp_contact}
		<Portrait loading
			resourcePath={p_contact}
			actions={gc_actions}
		/>
	{:then}
		<Portrait
			resource={g_contact}
			resourcePath={p_contact}
			title={g_contact.name}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				<Address copyable address={Agents.addressFor(g_contact, $yw_chain)} />
			</svelte:fragment>address
		</Portrait>
	{/await}
	

	<IncidentsList incidents={load_incidents()} />

</Screen>