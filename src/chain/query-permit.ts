import type {AccountPath} from '#/meta/account';
import type {AppPath} from '#/meta/app';
import type {Bech32, ChainPath} from '#/meta/chain';
import type {IncidentPath} from '#/meta/incident';
import type {SecretPath} from '#/meta/secret';
import type {AdaptedAminoResponse} from '#/schema/amino';
import type {Snip24Permission} from '#/schema/snip-24-def';

import {SecretNetwork} from './secret-network';

import {system_notify} from '#/extension/notifications';

import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Incidents} from '#/store/incidents';
import {Secrets} from '#/store/secrets';
import {fold} from '#/util/belt';
import {json_to_buffer} from '#/util/data';

export async function save_query_permit(
	g_amino: AdaptedAminoResponse,
	p_app: AppPath,
	p_chain: ChainPath,
	p_account: AccountPath,
	si_permit: string,
	a_permissions: Snip24Permission[],
	a_bech32s: Bech32[]
): Promise<[SecretPath, IncidentPath]> {
	// convert permit to buffer
	const atu8_permit = json_to_buffer(g_amino);

	const g_chain = (await Chains.at(p_chain))!;
	const g_account = (await Accounts.at(p_account))!;

	// save to secrets
	const p_secret = await Secrets.put(atu8_permit, {
		type: 'query_permit',
		uuid: SecretNetwork.uuidForQueryPermit(g_chain, si_permit),
		security: {
			type: 'none',
		},
		chain: p_chain,
		owner: Chains.addressFor(g_account.pubkey, g_chain),
		name: si_permit,
		permissions: a_permissions,
		contracts: fold(a_bech32s, sa_token => ({[sa_token]:''})),
		outlets: [p_app],
	});

	// save to incidents
	const p_incident = await Incidents.record({
		type: 'signed_query_permit',
		data: {
			app: p_app,
			chain: p_chain,
			account: p_account,
			secret: p_secret,
		},
	});

	// dispatch notification
	void system_notify({
		incident: p_incident,
		item: {
			title: '🎟️ Query Permit Signed',
			message: `Owners of this permit will have the ${a_permissions.join(', ')} permission${1 === a_permissions.length? '': 's'} for ${a_bech32s.length} contract${1 === a_bech32s.length? '': 's'}.`,
		},
		timeout: 0,
	});

	return [p_secret, p_incident];
}
