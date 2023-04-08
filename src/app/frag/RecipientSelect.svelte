<script lang="ts">	
	import type {AccountStruct} from '#/meta/account';
	import type {AgentPath, Chain} from '#/meta/chain';
	import type {ContactStruct} from '#/meta/contact';
	import {ContactAgentType} from '#/meta/contact';
	
	import Select from 'svelte-select';
	
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';
	import {qs} from '#/util/dom';
	import {yw_account_ref, yw_chain, yw_chain_namespace, yw_chain_ref} from '##/mem';
	
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
	let a_options: ContactOption[] = [];
	
	const contact_to_option = (g: ContactStruct): ContactOption => ({
		value: Agents.addressFor(g, $yw_chain),
		label: g.name,
		contact: g,
	});

	const account_to_option = (g: AccountStruct): ContactOption => ({
		value: Chains.addressFor(g.pubkey, $yw_chain),
		label: g.name,
		account: g,
	});

	async function load_contacts(): Promise<void> {
		const ks_agents = await Agents.read();

		// a_options = [{
		// 	value: '',
		// 	label: '',
		// 	contact: null!,
		// }];

		// contacts
		{
			a_contacts = [...ks_agents.contacts($yw_chain_namespace)];
			for(const [, g_contact] of a_contacts) {
				const g_option = contact_to_option(g_contact);

				const sa_contact = Agents.addressFor(g_contact, $yw_chain);
				if(sa_input && sa_contact === sa_input) {
					g_item_select = g_option;
				}

				a_options.push(g_option);
			}
		}

		// accounts
		{
			// load accounts
			const a_accounts = await Accounts.filter({
				family: 'cosmos',
			});

			// add others to options
			for(const [p_account, g_account] of a_accounts) {
				if(p_account !== $yw_account_ref) {
					a_options.push(account_to_option(g_account));
				}
			}
		}
	}

	function select(d_event: CustomEvent<ContactOption>) {
		address = d_event.detail.value;
		error = '';

		qs(dm_recipient, 'input[type="text"]')?.blur();
	}

	function clear() {
		address = '';
	}

	let s_accepted_input = '';
	let g_created_option: ContactOption | null = null;
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

			g_created_option = {
				label: s_manual_input,
				value: s_manual_input,
				created: true,
				contact: {
					addressData: s_manual_input.replace(/^.*1/, '').slice(0, -6),
					addressSpace: 'acc',
					agentType: ContactAgentType.UNKNOWN,
					chains: [$yw_chain_ref],
					name: 'Unknown',
					namespace: 'cosmos',
					pfp: '',
					notes: '',
					origin: 'user',
				},
			};

			a_options = [g_created_option, ...a_options.filter(g => !g.created)];

			// select address immediately
			setTimeout(() => {
				(qs(dm_recipient, '.item.first') as HTMLElement).click();
				b_list_open = false;

				address = s_manual_input;
				error = '';
			}, 0);
		}
	}

	let dm_recipient: HTMLElement;
	
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

	.recipient {
		position: relative;

		.style-svelte-select();
		.font(regular, 400, 13px);

		--input-padding: 16px;
		--padding: 0 4px;
		--item-padding: 0;
		--selected-item-padding: 0;

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

		.manually-typing {
			padding: 6px 16px;
		}
	}
</style>


<div class="recipient" bind:this={dm_recipient} class:hide-cursor={b_hide_cursor}>
	{#await load_contacts()}
		<Load forever />
	{:then}
		<Select id="recipient-select"
			clearable={!!address}
			placeholder="Address or contact"
			listOffset={1}
			Item={RecipientSelectItem}
			Selection={RecipientSelectSelection}
			items={a_options}
			value={g_item_select}
			bind:filterText={s_manual_input}
			bind:listOpen={b_list_open}
			on:select={select}
			on:clear={clear}
			containerClasses={error? 'invalid': ''}
		>
			<div slot="item" let:item={g_item}>
				<RecipientSelectItem
					item={g_item}
				/>
			</div>

			<div slot="selection" let:selection={g_item}>
				<RecipientSelectItem
					item={g_item}
				/>
			</div>

			<div slot="empty">
				<div class="manually-typing">
					<div>
						Stop typing in the address.
					</div>
					<div class="global_subvalue">
						Use copy/paste instead!
					</div>
				</div>
			</div>
		</Select>
	{/await}

	{#if error}
		<span class="validation-message">
			{error}
		</span>
	{/if}
</div>