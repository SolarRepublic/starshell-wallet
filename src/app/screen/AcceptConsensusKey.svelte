<script lang="ts">
	import type { ChainPath, ChainStruct } from '#/meta/chain';
	import { Chains } from '#/store/chains';
	import { base93_to_buffer, buffer_to_base64 } from '#/util/data';
	import {load_flow_context} from '../svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Fields from '../ui/Fields.svelte';
	import {Screen} from './_screens';

	const {
		k_page,
		completed,
	} = load_flow_context();

	export let chain: ChainPath;
	let g_chain!: ChainStruct;

	export let key: string;

	async function load_chain(): Promise<ChainStruct> {
		return g_chain=(await Chains.at(chain))!;
	}

	let b_busy = false;

	async function accept() {
		b_busy = true;

		await Chains.update(Chains.pathFrom(g_chain), (_g_chain) => {
			_g_chain.features.secretwasm!.consensusIoPubkey = key;
			return _g_chain;
		});

		completed?.(true);
	}

	function cancel() {
		completed?.(false);
	}
</script>

<style lang="less">
	
</style>

<Screen>
	<h3>
		Network transaction key changed
	</h3>

	{#await load_chain() then g_chain}
		<div>
			<Fields configs={[
				{
					type: 'resource',
					short: true,
					label: 'Chain',
					resourceType: 'chain',
					path: chain,
					struct: g_chain,
				},
			]} />
		</div>

		<p>
			StarShell has detected that this network's public consensus key has changed. This may occur during chain upgrades.
		</p>

		<p>
			However, it is possible for a malicious node to provide a false consensus key in order to decrypt attempted queries and transactions. It is therefore your responsibility to make sure the new consensus key is appropriate for this network.
		</p>

		<Fields configs={[
			{
				type: 'key_value',
				long: true,
				key: 'Old key',
				value: buffer_to_base64(base93_to_buffer(g_chain.features.secretwasm?.consensusIoPubkey || '')),
				render: 'mono',
			},
			{
				type: 'key_value',
				long: true,
				key: 'New key',
				value: buffer_to_base64(base93_to_buffer(key)),
				render: 'mono',
			},
		]} />
	{/await}

	<ActionsLine {cancel} reject confirm={['Accept', accept, b_busy]} />
</Screen>
