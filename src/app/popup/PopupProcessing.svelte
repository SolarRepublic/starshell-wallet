<script lang="ts">
	import {yw_context_popup} from '../mem';
	
	import ProgressBar from '../ui/ProgressBar.svelte';
</script>

<h3>
	Encrypting data...
</h3>

<p>
	Do not close this window.
</p>

<p>
	{$yw_context_popup?.status || ''}
</p>

<ProgressBar x_progress={$yw_context_popup?.progress || 0} />