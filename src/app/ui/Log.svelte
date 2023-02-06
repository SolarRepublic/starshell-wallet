<script context="module" lang="ts">
	export namespace LogItem {
		export interface String {
			type: 'string';
			value: string;
		}

		export interface Event {
			type: 'event';
			value: {
				message: string;
				offset: number;
			};
		}

		export type Any = String | Event;
	}

	export type LogItem = LogItem.Any;

	export class Logger {
		constructor() {
			this._a_items = [];
		}

		get items() {
			return this._a_items;
		}

		set items(a_items: LogItem[]) {
			this._a_items = a_items;
		}

		event(s_msg: string, xt_offset: number): this {
			this._a_items.push({
				type: 'event',
				value: {
					message: s_msg,
					offset: xt_offset,
				},
			});

			return this;
		}
	}
</script>

<script lang="ts">
	export let items: LogItem[];
	
	export let hide = false;
	
	export let latest = false;

	$: a_display_items = (latest && items.length? [items.at(-1)]: items) as LogItem[];

	function format_ms(n_ms: number): string {
		return (n_ms / 1e3).toFixed(2).padStart(5, '0');
	}
</script>

<style lang="less">
	.log-container {
		font-family: 'PT Mono', monospace;

		>ol {
			&.selective {
				padding-inline-start: 0;
				text-align: center;
			}

			>li {
				&.styleless {
					list-style-type: none;
				}

				>span {
					&.string {

					}

					&.event {
						.index {
							padding-right: 2px;
						}
					}
				}
			}
		}
	}
</style>

<div class="log-container" class:display_none={hide}>
	<ol class:selective={1 === a_display_items.length}>
		{#each a_display_items as g_item}
			<li class:styleless={latest}>
				{#if 'string' === g_item.type}
					<span class="string">{g_item.value}</span>
				{:else if 'event' === g_item.type}
					<span class="event">
						<span class="index">{items.length + 1}.</span>
						<span class="offset">+{format_ms(g_item.value.offset)}s: </span>
						<span class="message">{g_item.value.message}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</div>
