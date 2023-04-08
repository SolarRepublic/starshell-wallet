<script lang="ts" context="module">
	const GC_NANO_X: LedgerScreenConfig = {
		width: 128,
		height: 56,  // truncated for display purposes
		paragraph: 128-14.5,
		chars: 20,
		lines: 4,
		color: '#f9fafb',
		headerWeight: '700',
		headerBraces: '()',
		lineSpacing: 2,
		screenPadTop: 6,
		style: `
			transform: scale(1, 0.85);
			margin-top: -16px;
			margin-bottom: -16px;
		`,
	};

	export const H_LEDGER_DEVICE_SCREENS: Dict<LedgerScreenConfig> = {
		nanoS: {
			width: 128,
			height: 32,
			paragraph: 116,
			chars: 17,
			lines: 3,
			color: '#00fffb',
			headerBraces: '[]',
		},

		nanoSP: GC_NANO_X,
		nanoX: GC_NANO_X,
	};
</script>
<script lang="ts">
	import type {Dict, JsonObject} from '#/meta/belt';
	
	import {onDestroy} from 'svelte';
	
	import {LedgerScreen, type LedgerScreenConfig} from '../helper/ledger-screen';

	export let g_amino: JsonObject;

	export let si_device: keyof typeof H_LEDGER_DEVICE_SCREENS;

	let dm_space!: HTMLDivElement;

	let k_screen!: LedgerScreen;
	
	(async function init() {
		k_screen = await LedgerScreen.init(H_LEDGER_DEVICE_SCREENS[si_device]);

		dm_space.prepend(k_screen.canvas);

		await k_screen.sign({
			json: g_amino,
		});

		refresh_nav();
	})();

	let b_more_left = false;
	let b_more_right = true;

	function refresh_nav() {
		b_more_left = k_screen.hasLeft;
		b_more_right = k_screen.hasRight;
	}

	async function prev_page() {
		await k_screen.prev();
		refresh_nav();
	}

	async function next_page() {
		await k_screen.next();
		refresh_nav();
	}

	function keydown(d_event: KeyboardEvent) {
		switch(d_event.key) {
			case 'ArrowLeft': {
				void prev_page();
				break;
			}

			case 'ArrowRight': {
				void next_page();
				break;
			}

			default: { /**/ }
		}
	}

	document.addEventListener('keydown', keydown);

	onDestroy(() => {
		document.removeEventListener('keydown', keydown);
	});
</script>

<style lang="less">
	@import '../_base.less';

	.space {
		background-color: black;
		padding: 8px 0;

		position: relative;

		>.overlay {
			.absolute(100%);

			display: flex;
			justify-content: space-between;

			>.paddle {
				display: flex;
				flex-direction: column;
				align-items: center;
				width: 15%;
				font-size: 18px;
				cursor: pointer;
				color: var(--theme-color-primary);
				padding-top: 6px;

				background-color: transparent;

				&.left {
					// border-right: 1px solid transparent;
				}

				&.right {
					// border-left: 1px solid transparent;
				}

				&:hover {
					border-color: var(--theme-color-border);
					background-color: fade(white, 8.5%);
				}

				&.disabled {
					visibility: hidden;
				}
			}
		}
	}
</style>

<div class="space" bind:this={dm_space}>
	<div class="overlay">
		<span class="left paddle" class:disabled={!b_more_left} on:click={prev_page}>
			&lt;
		</span>
		<span class="right paddle" class:disabled={!b_more_right} on:click={next_page}>
			&gt;
		</span>
	</div>
</div>
