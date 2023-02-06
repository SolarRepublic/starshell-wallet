import type {Nameable, Pfpable} from './able';
import type {ChainPath} from './chain';
import type {Resource} from './resource';


export type Provider = Resource.New<{
	segments: [`provider.${string}`];
	struct: [{
		chain: ChainPath;
		grpcWebUrl: string;
		rpcHost?: string;
		healthCheckPath?: string;
		on: 0 | 1;
	}, Nameable, Pfpable];
}>;

export type ProviderPath = Resource.Path<Provider>;
export type ProviderStruct = Provider['struct'];
