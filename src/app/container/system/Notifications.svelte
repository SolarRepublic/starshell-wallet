<script lang="ts">
	import {onDestroy} from 'svelte';
	
	import {type ErrorReport, on_error} from '../../common';
	import Notice from '../../ui/Notice.svelte';
	

	let a_errors: ErrorReport[] = [];

	const fk_remove = on_error((g_report) => {
		// add to list
		a_errors.push(g_report);

		// reactive update
		a_errors = a_errors;
	});

	function dismiss(g_report: ErrorReport) {
		// remove from list
		const i_index = a_errors.indexOf(g_report);
		if(-1 !== i_index) {
			a_errors.splice(i_index, 1);

			// reactive update
			a_errors = a_errors;
		}
	}

	onDestroy(() => {
		fk_remove();
	});
</script>

<style lang="less">
	@import '../../_base.less';

	.notifications {
		z-index: 9000;
		.absolute();
		width: 100%;
		transition: opacity 1s var(--ease-out-expo);

		&.hidden {
			opacity: 0;
			pointer-events: none;
		}

		>.backdrop {
			.absolute(100%);
			background-color: rgba(0, 0, 0, 0.7);
			transition: background-color 1s var(--ease-out-expo);
		}

		.error-stack {
			background-color: fade(@theme-color-graydark, 50%);
			color: var(--theme-color-text-light);
			overflow: scroll;
			padding: 1em;
			border-radius: 4px;
		}
	}
</style>

<div class="notifications" class:hidden={!a_errors.length}>
	<div class="backdrop" />

	{#each a_errors as g_report, i_report}
		<Notice
			icon='error'
			title={g_report.title}
			dismissable={true}
			on:dismiss={() => dismiss(g_report)}
			rootStyle={`
				position: absolute;
				width: calc(100% - 40px);
				box-sizing: border-box;
				margin-left: 20px;
				margin-right: 20px;
				bottom: ${(i_report * 60) + 20}px;
				box-shadow: 0 0 40px #000;
			`}
		>
		<!-- link={g_report.error? ['Submit Bug Report', F_NOOP]: null} -->
			{#if g_report.text}
				{g_report.text}
			{:else}
				<pre class="error-stack"><code>{g_report.error?.stack}</code></pre>
			{/if}
		</Notice>
	{/each}
</div>
