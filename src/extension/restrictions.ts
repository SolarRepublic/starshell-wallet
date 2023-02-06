import * as semver from 'semver';

import {P_STARSHELL_DECREES, SI_VERSION} from '#/share/constants';
import type {Decree} from '#/store/web-resource-cache';
import {WebResourceCache} from '#/store/web-resource-cache';


const R_SEMVER = /^([<>]=?)?(.+)$/;

function satisfies(si_version: string, s_semver: string): boolean {
	const [, s_cmp, s_base] = R_SEMVER.exec(s_semver)!;
	if('<=' === s_cmp) {
		return semver.lte(si_version, s_base);
	}
	else if('<' === s_cmp) {
		return semver.lt(si_version, s_base);
	}
	else if('>' === s_cmp) {
		return semver.gt(si_version, s_base);
	}
	else if('>=' === s_cmp) {
		return semver.gte(si_version, s_base);
	}
	else if('=' === s_cmp) {
		return semver.equivalent(si_version, s_base);
	}

	return false;
}

export async function check_restrictions(): Promise<Decree[]> {
	const a_restrictions: Decree[] = [];

	const a_decrees = await WebResourceCache.get(P_STARSHELL_DECREES) as Decree[];

	// each decree
	for(const g_decree of a_decrees || []) {
		// affects this version
		if(satisfies(SI_VERSION, g_decree.affects)) {
			// depending on action
			switch(g_decree.action) {
				// restrict usage
				case 'restrict': {
					a_restrictions.push(g_decree);
					break;
				}

				default: {
					// ignore
				}
			}
		}
	}

	return a_restrictions;
}

