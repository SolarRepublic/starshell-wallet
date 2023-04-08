import type {Nameable, Pfpable} from './able';
import type {Resource} from './resource';

export type HardwareVendor = 'ledger' | 'keystone';

type IntStr = `${bigint}` | number | string;

export type Device<
	si_vendor extends IntStr=IntStr,
	si_product extends IntStr=IntStr,
> = Resource.New<{
	segments: [`vendor.${si_vendor}`, `product.${si_product}`];
	struct: [{
		vendor: HardwareVendor;

		productId: number | string;

		manufacturerName: string;

		productName: string;

		features: {
			wallet?: {
				/**
				 * hex-encoded master fingerprint
				 */
				fingerprint?: string;

				/**
				 * MultiAccount offer
				 */
				offer?: {
					type: string;
					cbor: string;
				};
			};
		};
	}, Nameable, Pfpable];
}>;

export type DevicePath = Resource.Path<Device>;
export type DeviceStruct = Device['struct'];
export type DeviceIdent = Pick<DeviceStruct, 'vendor' | 'productId'>;

