import { R_BIP_44 } from "#/share/constants";


export type Bip44Path<
	i_coin extends number=number,
	i_account extends number=number,
	xc_change extends Bip44Path.ChangeType=Bip44Path.ChangeType,
	i_sequence extends number=number,
> = `m/44'/${i_coin}'/${i_account}'/${xc_change}/${i_sequence}`;

export type Bip44Data<
	i_coin extends number=number,
	i_account extends number=number,
	xc_change extends Bip44Path.ChangeType=Bip44Path.ChangeType,
	i_sequence extends number=number,
> = [44, i_coin, i_account, xc_change, i_sequence];

export namespace Bip44Path {
	export interface Change {
		external: 0;
		internal: 1;
	}

	export type ChangeType = Change['external'] | Change['internal'];
}

export enum Bip44Part {
	Prefix = 0,
	Constant = 1,
	CoinType = 2,
	AccountType = 3,
	Change = 4,
	Index = 5,
}

export enum MutableBip44Part {
	CoinType = Bip44Part.CoinType,
	AccountType = Bip44Part.AccountType,
	Change = Bip44Part.Change,
	Index = Bip44Part.Index,
}

const I_MAX_CHILD = Number((2n ** 32n) - 1n);

function mutate(s_data: string, n_delta: number) {
	return Math.min(Math.max(0, parseInt(s_data) + n_delta), I_MAX_CHILD)+'';
}

export function mutate_bip44(sx_bip44: string, xc_part: MutableBip44Part, n_mutation=+1): Bip44Path {
	// parse path
	const m_bip44 = R_BIP_44.exec(sx_bip44);

	// path is invalid
	if(!m_bip44) throw new Error(`Invalid BIP44 path`);

	// destructure constiuent levels
	let [, s_coin_type, s_account, s_change, s_address] = m_bip44;

	// map level to constituent var
	switch(xc_part) {
		case MutableBip44Part.CoinType: {
			s_coin_type = mutate(s_coin_type, n_mutation);
			break;
		}

		case MutableBip44Part.AccountType: {
			s_account = mutate(s_account, n_mutation);
			break;
		}

		case MutableBip44Part.Change: {
			s_change = mutate(s_change, n_mutation);
			break;
		}

		case MutableBip44Part.Index: {
			s_address = mutate(s_address, n_mutation);
			break;
		}

		default: break;
	}

	return `m/44'/${s_coin_type}'/${s_account}'/${s_change}/${s_address}` as Bip44Path;
}


export function parse_bip44(sx_bip44: Bip44Path): Bip44Data {
	// parse bip44
	const m_bip44 = R_BIP_44.exec(sx_bip44);
	if(!m_bip44) throw new TypeError(`Invalid BIP44`);

	// destructure parts
	const [, s_coin, s_account, s_change, s_index] = m_bip44;

	// return
	return [44, +s_coin, +s_account, +s_change as Bip44Path.ChangeType, +s_index];
}

export function serialize_bip44(a_path: Bip44Data): Bip44Path {
	if(44 !== a_path[0]) throw new TypeError(`Invalid BIP44 path data: [${a_path.join(', ')}]`);

	return `m/44'/${a_path[1]}'/${a_path[2]}'/${a_path[3]}/${a_path[4]}`;
}
