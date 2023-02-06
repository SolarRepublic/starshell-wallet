<script lang="ts">	
	import type {AgentPath, Chain} from '#/meta/chain';
	import type {ContactStruct} from '#/meta/contact';
	
	import Select from 'svelte-select';
	
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';
	import {qs} from '#/util/dom';
	import {yw_chain, yw_chain_namespace} from '##/mem';
	
	import RecipientSelectItem from './RecipientSelectItem.svelte';
	import RecipientSelectSelection from './RecipientSelectSelection.svelte';
	import type {ContactOption} from '../frag/InlineContactSelection.svelte';
	import Load from '../ui/Load.svelte';
	
	import SX_ICON_SCAN from '#/icon/qr_code_scanner.svg?raw';

	export let address: Chain.Bech32String = '';
	const sa_input = address;

	export let error = '';

	let s_manual_input: string;
	let g_item_select: ContactOption;

	let a_contacts: [AgentPath, ContactStruct][];

	const contact_to_option = (g: ContactStruct): ContactOption => ({
		value: Agents.addressFor(g, $yw_chain),
		label: g.name,
		contact: g,
	});

	async function load_contacts(): Promise<ContactOption[]> {
		const ks_agents = await Agents.read();

		const a_options: ContactOption[] = [{
			value: '',
			label: '',
			contact: null!,
		}];

		a_contacts = [...ks_agents.contacts($yw_chain_namespace)];
		for(const [, g_contact] of a_contacts) {
			const g_option = contact_to_option(g_contact);

			const sa_contact = Agents.addressFor(g_contact, $yw_chain);
			if(sa_input && sa_contact === sa_input) {
				g_item_select = g_option;
			}

			a_options.push(g_option);
		}

		return a_options;
	}

	function select(d_event: CustomEvent<ContactOption>) {
		address = d_event.detail.value;
		error = '';
	}

	function clear() {
		address = '';
	}

	let s_accepted_input = '';
	let b_hide_cursor = false;

	let b_list_open = false;

	$: {
		b_hide_cursor = false;

		if(s_manual_input) {
			check_manual_input();
		}
		else {
			b_hide_cursor = !!s_accepted_input;
			s_accepted_input = '';
		}
	}

	function check_manual_input() {
		s_accepted_input = '';

		if(!$yw_chain) {
			// should not be able to get here without being on a chain
			error = 'No chain set';
		}
		else if(!Chains.isValidAddressFor($yw_chain, s_manual_input, 'acc')) {
			console.error(`Invalid address`);
			error = 'Invalid address for this chain';
		}
		else {
			error = '';

			// search for address in contacts
			for(const [, g_contact] of a_contacts) {
				// contact exists
				if(s_manual_input === Agents.addressFor(g_contact, $yw_chain)) {
					// clear filter text
					s_manual_input = '';
	
					// select contact instead of using raw address
					g_item_select = contact_to_option(g_contact);

					// close list
					b_list_open = false;

					// hide cursor
					b_hide_cursor = true;
					return;
				}
			}

			s_accepted_input = s_manual_input;

			// select address immediately
			setTimeout(() => {
				(qs(dm_sender, '.manual>.address') as HTMLElement).click();
				b_list_open = false;
			}, 0);
		}
	}

	let dm_sender: HTMLElement;
	
	export let showValidation = 0;
	$: {
		if(showValidation) {
			if(!address) {
				if(s_manual_input) {
					check_manual_input();
				}
				else {
					error = 'Enter a recipient';
				}
			}
			else if(!Chains.isValidAddressFor($yw_chain, address, 'acc')) {
				error = 'Invalid address for this chain';
			}
			else {
				error = '';
			}
		}
		else if(!address) {
			error = '';
		}
	}
</script>


<style lang="less">
	@import '../_base.less';

	.sender {
		position: relative;

		.style-svelte-select();
		.font(regular, 400, 13px);

		--inputPadding: 16px;
		--padding: 0 4px;
		--itemPadding: 0;
		--selectedItemPadding: 0;

		>input {
			&::after {
				content: '';
				position: absolute;
				right: 0;
			}
		}

		>.icon {
			--icon-diameter: 24px;
			--icon-color: var(--theme-color-primary);
			position: absolute;
			top: 0;
			right: 0;
			padding: 12px;
			cursor: pointer;
		}

		.listContainer .empty {
			:global(&) {
				white-space: pre-wrap;
			}
		}

		&.hide-cursor {
			.selectContainer input[type="text"] {
				:global(&) {
					caret-color: transparent;;
				}
			}
		}
	}
</style>


<div class="sender" bind:this={dm_sender} class:hide-cursor={b_hide_cursor}>
	{#await load_contacts()}
		<Load forever />
	{:then a_contacts}
		<Select id="recipient-select"
			placeholder="Address or contact"
			listOffset={1}
			isClearable={!!address}
			isCreatable={!!s_accepted_input}
			Item={RecipientSelectItem}
			Selection={RecipientSelectSelection}
			items={a_contacts}
			value={g_item_select}
			noOptionsMessage={'Stop typing in the address. \n Use copy/paste instead!'}
			bind:filterText={s_manual_input}
			bind:listOpen={b_list_open}
			on:select={select}
			on:clear={clear}
			containerClasses={error? 'invalid': ''}
		/>
	{/await}

	{#if error}
		<span class="validation-message">
			{error}
		</span>
	{/if}
</div>