<style lang="less">
	.bottom {
		display: flex;
		flex-direction: row;
		justify-content: space-evenly;
		gap: var(--ui-padding);
		padding-bottom: calc(1.75 * var(--ui-padding));
		align-items: flex-end;
		flex: auto;
		text-align: center;

		.actions-wall {
			width: 100%;

			display: flex;
			flex-direction: column;
			justify-content: space-evenly;
			gap: var(--ui-padding);

			&>button {
				flex: 1;
			}
		}
	}
</style>


<div class="bottom flex_0">
	<div class="actions-wall">
		<slot />
	</div>
</div>