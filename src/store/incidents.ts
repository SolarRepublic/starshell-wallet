import type {Merge} from 'ts-toolbelt/out/Object/Merge';

import type {AccountPath} from '#/meta/account';
import type {AppPath} from '#/meta/app';
import type {JsonObject} from '#/meta/belt';
import type {Bech32, ChainPath} from '#/meta/chain';
import type {Incident, IncidentType, IncidentPath} from '#/meta/incident';

import {
	create_store_class,
	WritableStore,
	WritableStoreMap,
} from './_base';

import {SI_STORE_INCIDENTS, SI_STORE_HISTORIES} from '#/share/constants';
import {ode} from '#/util/belt';
import {buffer_to_base64, sha256_sync, text_to_buffer} from '#/util/data';


export interface IncidentFilterConfig {
	type?: IncidentType;
	account?: AccountPath;
	owner?: Bech32;
	stage?: IncidentDescriptor<'tx_in' | 'tx_out'>['data']['stage'];
	app?: AppPath;
	chain?: ChainPath;
}

type IncidentDict = Record<IncidentPath, Incident.Struct>;

class HistoriesI extends WritableStore<typeof SI_STORE_HISTORIES> {
	static insertIncident(p_incident: IncidentPath, xt_when: number, h_incidents: IncidentDict): Promise<void> {
		return Histories.open(ks => ks.insertIncident(p_incident, xt_when, h_incidents));
	}

	static async incidents(): Promise<IncidentPath[]> {
		return (await Histories.read()).incidents();
	}

	static updateSyncInfo(p_chain: ChainPath, si_listen: string, s_height: string): Promise<void> {
		return Histories.open(ks => ks.updateSyncInfo(p_chain, si_listen, s_height));
	}

	static async syncHeight(p_chain: ChainPath, si_listen: string): Promise<bigint> {
		return (await Histories.read()).syncHeight(p_chain, si_listen);
	}

	static async lastSeen(): Promise<number> {
		return (await Histories.read()).lastSeen();
	}

	static markAllSeen() {
		return Histories.open(ks => ks.markAllSeen());
	}

	static resetSyncInfo(p_chain?: ChainPath) {
		return Histories.open(ks => ks.resetSyncInfo(p_chain));
	}

	async markAllSeen() {
		// update last seen to now
		this._w_cache.seen = Date.now();

		// save to store
		await this.save();
	}

	lastSeen(): number {
		return this._w_cache.seen;
	}

	async resetSyncInfo(p_chain?: ChainPath) {
		if(p_chain) {
			delete this._w_cache.syncs[p_chain];
		}
		else {
			this._w_cache.syncs = {};
		}

		await this.save();
	}

	async updateSyncInfo(p_chain: ChainPath, si_listen: string, s_height: string): Promise<void> {
		// ref cache
		const h_syncs = this._w_cache.syncs;

		// get-set info w/ height
		(h_syncs[p_chain] = h_syncs[p_chain] || {
			[si_listen]: {},
		})[si_listen] = {
			height: s_height,
		};

		// save to store
		await this.save();
	}

	syncHeight(p_chain: ChainPath, si_listen: string): bigint {
		// ref cache
		const h_syncs = this._w_cache.syncs;

		// lookup chain sync height info
		const s_height = h_syncs[p_chain]?.[si_listen]?.height;

		// no sync info
		if(!s_height) return 0n;

		// convert to bigint
		return BigInt(s_height);
	}

	async insertIncident(p_incident: IncidentPath, xt_when: number, h_incidents: IncidentDict): Promise<void> {
		// ref cache
		const a_incidents = this._w_cache.order;

		// exit conditions
		let b_sorted = false;
		let b_replaced = false;

		// each incident
		let nl_incidents = a_incidents.length;
		for(let i_each=0; i_each<nl_incidents; i_each++) {
			const p_each = a_incidents[i_each];

			// 
			const g_incident = h_incidents[p_each];

			// ref each's incident time
			const xt_each = g_incident.time;

			// found replacement
			if(p_each === p_incident) {
				// delete stale entry
				a_incidents.splice(i_each, 1);

				// update iteration length
				nl_incidents = a_incidents.length;

				// set exit condition
				b_replaced = true;

				// repeat on same index
				i_each -= 1;
				continue;
			}

			// insertion occurs more recently
			if(!b_sorted && xt_when >= xt_each) {
				// insert into position
				a_incidents.splice(i_each, 0, p_incident);

				// update iteration length
				nl_incidents = a_incidents.length;

				// set exit condition
				b_sorted = true;

				// skip already checked 'each'
				i_each += 1;
			}

			// exit conditions met
			if(b_sorted && b_replaced) break;
		}

		// did not sort
		if(!b_sorted) {
			a_incidents.push(p_incident);
		}

		// save to store
		await this.save();
	}

	incidents(): IncidentPath[] {
		return this._w_cache.order || [];
	}
}

export const Histories = create_store_class({
	store: SI_STORE_HISTORIES,
	class: HistoriesI,
});

type IncidentDescriptor<
	si_type extends IncidentType=IncidentType,
> = {
	[si_each in IncidentType]: Merge<
		Partial<
			Pick<Incident.Struct<si_each>, 'id' | 'time'>
		>,
		Omit<Incident.Struct<si_each>, 'id' | 'time'>
	>
}[si_type];

export const Incidents = create_store_class({
	store: SI_STORE_INCIDENTS,
	extension: 'map',
	class: class IncidentsI extends WritableStoreMap<typeof SI_STORE_INCIDENTS> {
		static pathFor<si_type extends IncidentType>(si_category: si_type, si_id: string): IncidentPath<si_type> {
			return `/incident.${si_category}/id.${si_id}` as IncidentPath<si_type>;
		}

		static pathFrom(g_incident: Incident['struct']) {
			return IncidentsI.pathFor(g_incident.type, g_incident.id || g_incident.data?.['hash'] as string || 'unknown');
		}

		static async filter(gc_filter: IncidentFilterConfig={}): Promise<IterableIterator<Incident.Struct>> {
			const [
				a_incidents,
				ks_incidents,
			] = await Promise.all([
				Histories.incidents(),
				Incidents.read(),
			]);

			return ks_incidents.filter(a_incidents, gc_filter);
		}

		static record(g_incident: IncidentDescriptor, ks_histories?: HistoriesI): Promise<IncidentPath> {
			if(!g_incident.id) {
				delete g_incident.id;

				if(!(g_incident.id = g_incident.data?.['hash'] as string || '')) {
					const atu8_hash = sha256_sync(text_to_buffer(JSON.stringify(g_incident)));
					g_incident.id = `${g_incident.type}:${buffer_to_base64(atu8_hash.subarray(0, 9)).replace(/\//g, '-')}`;
				}
			}

			if(!g_incident.time) g_incident.time = Date.now();

			return Incidents.open(ks => ks.record(g_incident as Incident.Struct, ks_histories));
		}

		static async mutateData(p_incident: IncidentPath, g_mutate: JsonObject): Promise<void> {
			return await Incidents.open(ks => ks.mutateData(p_incident, g_mutate));
		}

		// static async delete(g_event: LogEvent): Promise<number> {
		// 	return await Incidents.open(ks => ks.delete(g_event));
		// }

		// static async insert(g_event: LogEvent): Promise<number> {
		// 	return await Incidents.open(ks => ks.insert(g_event));
		// }

		async record(g_incident: Incident.Struct, ks_histories?: HistoriesI): Promise<IncidentPath> {
			// ref cache
			const h_incidents = this._w_cache as Record<IncidentPath, typeof g_incident>;

			// construct incident path
			const p_incident = IncidentsI.pathFrom(g_incident);

			// overwrite cache entry
			h_incidents[p_incident] = g_incident;

			// save to store
			await this.save();

			// save in history's order
			if(ks_histories) {
				await ks_histories.insertIncident(p_incident, g_incident.time, this._w_cache as IncidentDict);
			}
			else {
				await Histories.insertIncident(p_incident, g_incident.time, this._w_cache as IncidentDict);
			}

			// return incident path
			return p_incident;
		}

		* filter(a_incidents: IncidentPath[], gc_filter: IncidentFilterConfig={}): IterableIterator<Incident.Struct> {
			const h_incidents = this._w_cache as IncidentDict;

			for(const p_incident of a_incidents) {
				const g_incident = h_incidents[p_incident];

				if(gc_filter.type && gc_filter.type !== g_incident.type) continue;
				if(gc_filter.account && gc_filter.account !== g_incident.data['account']) continue;
				if(gc_filter.chain && gc_filter.chain !== g_incident.data['chain']) continue;
				if(gc_filter.owner && gc_filter.owner !== g_incident.data['owner']) continue;
				if(gc_filter.stage && gc_filter.stage !== g_incident.data['stage']) continue;
				if(gc_filter.app && gc_filter.app !== g_incident.data['app']) continue;

				yield g_incident;
			}
		}

		async mutateData(p_incident: IncidentPath, g_mutate: JsonObject): Promise<void> {
			const g_data = this._w_cache[p_incident]!.data;

			for(const [si_key, w_value] of ode(g_mutate)) {
				const w_existing = g_data[si_key];
				const b_existing_object = w_existing && 'object' === typeof w_existing;
				const b_existing_array = b_existing_object && Array.isArray(w_existing);
				const b_existing_dict = b_existing_object && !b_existing_array;

				const b_replace_object = w_value && 'object' === typeof w_value;
				const b_replace_array = b_replace_object && Array.isArray(w_value);
				const b_replace_dict = b_replace_object && !b_replace_array;

				if(b_existing_dict && b_replace_dict) {
					g_data[si_key] = {
						...w_existing,
						...w_value,
					};
					continue;
				}

				g_data[si_key] = w_value;
			}

			// save
			await this.save();
		}

		// async delete(g_delete: LogEvent): Promise<number> {
		// 	const a_events = this._w_cache as LogEvent[];

		// 	const xt_delete = g_delete.time;

		// 	const si_delete = JSON.stringify(g_delete);

		// 	DELETION: {
		// 		for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
		// 			const g_test = a_events[i_event];

		// 			if(xt_delete === g_test.time) {
		// 				// found entry
		// 				if(si_delete === JSON.stringify(g_test)) {
		// 					a_events.splice(i_event, 1);
		// 					break DELETION;
		// 				}
		// 			}
		// 		}

		// 		// item was not found
		// 		return a_events.length;
		// 	}

		// 	await this.save();

		// 	return a_events.length;
		// }

		// async insert(g_event: LogEvent): Promise<number> {
		// 	const xt_event = g_event.time;

		// 	const a_events = this._w_cache as LogEvent[];

		// 	const si_event = JSON.stringify(g_event);

		// 	INSERTION: {
		// 		for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
		// 			const g_test = a_events[i_event];

		// 			if(xt_event > g_test.time) {
		// 				a_events.splice(i_event, 0, g_event);
		// 				break INSERTION;
		// 			}
		// 			// same exact millisecond
		// 			else if(xt_event === g_test.time) {
		// 				// duplicate event, abort
		// 				if(si_event === JSON.stringify(g_test)) {
		// 					return a_events.length;
		// 				}
		// 			}
		// 		}

		// 		// add event to list
		// 		a_events.push(g_event);
		// 	}

		// 	// save changes
		// 	await this.save();

		// 	// return new list length
		// 	return a_events.length;
		// }
	},
});

