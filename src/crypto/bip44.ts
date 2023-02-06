

export type Bip44Path<
	i_coin extends number=number,
	i_account extends number=number,
	xc_change extends Bip44Path.ChangeType=Bip44Path.ChangeType,
	i_sequence extends number=number,
> = `m/44'/${i_coin}'/${i_account}'/${xc_change}/${i_sequence}`;

export namespace Bip44Path {
	export interface Change {
		external: 0;
		internal: 1;
	}

	export type ChangeType = Change['external'] | Change['internal'];
}
