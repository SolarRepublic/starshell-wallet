import type {AccountPath} from '#/meta/account';
import type {SessionRequest} from '#/meta/api';
import type {AppChainConnection, AppPermissionSet} from '#/meta/app';
import type {Dict} from '#/meta/belt';

import type {Caip2, ChainStruct, ChainPath} from '#/meta/chain';

import {Chains} from '#/store/chains';
import {ode} from '#/util/belt';

export interface PermissionsRegistry {
	doxx_name: true;
	dox_address: string[];
	query_node: string[];
	query: true;
	broadcast: true;
}

export interface PermissionsRequestBlock {
	a_account_paths: AccountPath[];
	h_chains: Record<Caip2.String, ChainStruct>;
	h_sessions: Dict<SessionRequest>;
	h_flattened?: Partial<PermissionsRegistry>;
	h_connections?: Record<ChainPath, AppChainConnection>;
	g_set?: AppChainConnection['permissions'];
}

/**
 * The entire request object is already validated and sanitized in content script before it gets here.
 * The purpose of this function is to restructure the requests into a workable format.
 * 
 * By default, `g_set` is an empty object since the app does not have permissions until user approves them
 * individually.
 */
export function process_permissions_request(g_request: PermissionsRequestBlock): Required<PermissionsRequestBlock> {
	const {
		a_account_paths,
		h_chains,
		h_sessions,
		h_flattened={},
		h_connections={},
		g_set={},
	} = g_request;

	let b_doxx_address = false;
	const as_justify_doxx = new Set<string>();
	let b_query_node = false;
	const as_justify_node = new Set<string>();

	// check each session request
	for(const [, g_session] of ode(h_sessions)) {
		// doxx
		const g_doxx = g_session.doxx;
		if(g_doxx) {
			// requesting name
			if(g_doxx.name) {
				h_flattened.doxx_name = true;
			}

			// requesting address
			if('string' === typeof g_doxx.address?.justification) {
				b_doxx_address = true;
				const s_justification = g_doxx.address.justification.trim();
				if(s_justification) {
					as_justify_doxx.add(s_justification);
				}
			}
		}

		// query
		const g_query = g_session.query;
		if(g_query) {
			// requesting query
			h_flattened.query = true;

			// requesting node
			if('string' === typeof g_query.node?.justification) {
				b_query_node = true;
				const s_justification = g_query.node.justification.trim();
				if(s_justification) {
					as_justify_node.add(s_justification);
				}
			}
		}

		// broadcast
		const g_broadcast = g_session.broadcast;
		if(g_broadcast) {
			h_flattened.broadcast = true;
		}

		// add chain connection
		const g_chain = h_chains[g_session.caip2];
		const p_chain = Chains.pathFrom(g_chain);
		h_connections[p_chain] = {
			accounts: a_account_paths,
			permissions: g_set,
		};
	}

	// doxx address permission is present; coalesce the justifications
	if(b_doxx_address) h_flattened.dox_address = [...as_justify_doxx];

	// query node permission is present; coalesce the justifications
	if(b_query_node) h_flattened.query_node = [...as_justify_node];

	return {
		a_account_paths: a_account_paths,
		h_chains,
		h_sessions,
		h_flattened,
		h_connections,
		g_set,
	};
}

/**
 * Applies a flattened permission key to a `set` object to build an `AppPermissionSet`
 */
export function add_permission_to_set(si_permission: keyof PermissionsRegistry, g_set: Partial<AppPermissionSet>) {
	// update global permissions
	switch(si_permission) {
		case 'doxx_name': {
			(g_set.doxx = g_set.doxx || {}).name = true;
			break;
		}

		case 'dox_address': {
			(g_set.doxx = g_set.doxx || {}).address = true;
			break;
		}

		case 'query_node': {
			(g_set.query = g_set.query || {}).node = true;
			break;
		}

		default: {
			g_set[si_permission] = {};
		}
	}

	return g_set;
}

