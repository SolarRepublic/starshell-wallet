import type {DeviceIdent, DevicePath, DeviceStruct, HardwareVendor} from '#/meta/device';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import {SI_STORE_DEVICES} from '#/share/constants';

export interface DeviceFilter {
	vendor?: HardwareVendor;
}

type IntStr = `${bigint}` | number;

type PathFor<
	si_vendor extends IntStr | string,
	si_product extends IntStr | string,
> = `/vendor.${si_vendor}/product.${si_product}`;

type PathFromDevice<
	g_device extends DeviceIdent,
> = PathFor<g_device['vendor'], g_device['productId']>;

const H_VENDOR_USB_CODES: Record<number, HardwareVendor> = {
	11415: 'ledger',
};

export const Devices = create_store_class({
	store: SI_STORE_DEVICES,
	extension: ['map'],
	class: class DevicesI extends WritableStoreMap<typeof SI_STORE_DEVICES> {
		static pathFor<
			si_vendor extends IntStr | string,
			si_product extends IntStr | string,
		>(si_vendor: si_vendor, si_product: si_product): PathFor<si_vendor, si_product> {
			return `/vendor.${si_vendor}/product.${si_product}`;
		}

		static pathFrom(g_device: DeviceIdent): PathFromDevice<typeof g_device> {
			return DevicesI.pathFor(g_device.vendor, g_device.productId);
		}

		static parsePath(p_device: DevicePath) {
			const a_parsed = /^\/vendor\.([^/]+)\/product\.(.+)$/.exec(p_device);

			return {
				vendor: a_parsed![1],
				productId: a_parsed![2],
			};
		}

		static async filter(gc_filter: DeviceFilter): Promise<[DevicePath, DeviceStruct][]> {
			return (await Devices.read()).filter(gc_filter);
		}

		static fromUsbDevice(g_dev: USBDevice, h_features: DeviceStruct['features']={}): DeviceStruct {
			return {
				vendor: H_VENDOR_USB_CODES[g_dev.vendorId] || 'unknown' as HardwareVendor,
				productId: g_dev.productId,
				manufacturerName: g_dev.manufacturerName || `${g_dev.vendorId}`,
				productName: g_dev.productName || `${g_dev.vendorId}`,
				name: '',
				pfp: '',
				features: h_features,
			};
		}

		static async get(si_vendor: IntStr, si_product: IntStr): Promise<null | DeviceStruct> {
			return (await Devices.read()).get(si_vendor, si_product);
		}

		static async put(g_device: DeviceStruct): Promise<PathFromDevice<typeof g_device>> {
			return await Devices.open(ks => ks.put(g_device));
		}

		get(si_vendor: IntStr, si_product: IntStr): DeviceStruct | null {
			// prepare path
			const p_res = DevicesI.pathFor(si_vendor, si_product);

			// fetch
			return this._w_cache[p_res] ?? null;
		}

		async put(g_device: DeviceStruct): Promise<PathFromDevice<typeof g_device>> {
			// prepare path
			const p_res = DevicesI.pathFrom(g_device);

			// update cache
			this._w_cache[p_res] = g_device;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}

		filter(gc_filter: DeviceFilter): [DevicePath, DeviceStruct][] {
			const a_devices: [DevicePath, DeviceStruct][] = [];

			const si_vendor = gc_filter.vendor;

			const sr_prefix = si_vendor? `/vendor.${si_vendor}/`: '';

			for(const [p_device, g_device] of this.entries()) {
				if(sr_prefix && p_device.startsWith(sr_prefix)) {
					a_devices.push([p_device, g_device]);
				}
			}

			return a_devices;
		}
	},
});
