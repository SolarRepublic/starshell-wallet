<script lang="ts">
	import type { Promisable } from '#/meta/belt';

	import {Tabs, TabList, Tab, TabPanel} from 'svelte-tabs';
	import Field from '../ui/Field.svelte';
	import Load from '../ui/Load.svelte';

	export let memoPlaintext: string | Promise<string> | null;

	export let memoCiphertext: string | Promise<string> = '';
</script>

<style lang="less">
	.empty-memo {
		font-style: italic;
		color: var(--theme-color-text-med);
	}
</style>

<Field key='memo' name='Memo' short={'' === memoPlaintext && '' === memoCiphertext}>
	{#if memoCiphertext}
		<Tabs>
			<TabList>
				<Tab>
					Plaintext
				</Tab>
				<Tab>
					Encrypted
				</Tab>
			</TabList>

			<TabPanel>
				{#if 'string' === typeof memoPlaintext}
					{#if memoPlaintext}
						<textarea disabled>{memoPlaintext}</textarea>
					{:else}
						<i>Empty memo</i>
					{/if}
				{:else if memoPlaintext}
					<Load input={memoPlaintext} />
				{:else}
					<i>Corrupted memo, unable to decrypt</i>
				{/if}
			</TabPanel>

			<TabPanel>
				<textarea class="ciphertext" disabled>{memoCiphertext}</textarea>
			</TabPanel>
		</Tabs>
	{:else if memoPlaintext}
		<textarea disabled>{memoPlaintext}</textarea>
	{:else}
		<span class="empty-memo">(empty)</span>
	{/if}
</Field>