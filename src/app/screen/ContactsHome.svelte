<script lang="ts">
	import {ContactAgentType} from '#/meta/contact';
	
	import {
		Tabs,
		Tab,
		TabList,
		TabPanel,
	} from 'svelte-tabs';
	
	import {Screen, Header} from './_screens';
	
	import {load_page_context} from '../svelte';
	
	import ContactEdit from './ContactEdit.svelte';
	import ContactList from '../frag/ContactList.svelte';
	import SubHeader from '../ui/SubHeader.svelte';
	

	const {k_page} = load_page_context();

</script>

<style lang="less">
	@import '../_base.less';

	.screen.contacts div.svelte-tabs>div.svelte-tabs__tab-panel {
		:global(&) {
			margin-top: -1px;
		}
	}
</style>

<Screen nav root classNames='contacts'>
	<Header search network account />

	<SubHeader title="Contacts - all chains"
		on:add_new={() => k_page.push({
			creator: ContactEdit,
		})}
	/>
	<!-- buttons={['Export']} -->
	
	<Tabs initialSelectedIndex={1}>
		<TabList>
			<Tab>
				All
			</Tab>

			<Tab>
				Humans
			</Tab>

			<Tab>
				Robots
			</Tab>

			<Tab>
				Contracts
			</Tab>
		</TabList>

		<!-- All -->
		<TabPanel>
			<ContactList />
		</TabPanel>

		<!-- Humans -->
		<TabPanel>
			<ContactList
				filter={g_contact => ContactAgentType.PERSON === g_contact.agentType}
			/>
		</TabPanel>

		<!-- Robots -->
		<TabPanel>
			<ContactList
				filter={g_contact => ContactAgentType.ROBOT === g_contact.agentType}
			/>
		</TabPanel>
		
		<!-- Contracts -->
		<TabPanel>
			<ContactList
				filter={g_agent => ContactAgentType.CONTRACT === g_agent.agentType}
			/>
		</TabPanel>
	</Tabs>

</Screen>