import type {ImageMediaTarget} from './media';
import type {Resource} from './resource';
import type {Merge} from 'ts-toolbelt/out/Object/Merge';


export type ImageSet = {
	default: ImageMediaTarget;
	16?: ImageMediaTarget;
	32?: ImageMediaTarget;
	48?: ImageMediaTarget;
	64?: ImageMediaTarget;
	96?: ImageMediaTarget;
	128?: ImageMediaTarget;
	192?: ImageMediaTarget;
	256?: ImageMediaTarget;
};

export interface PfpTypeRegistry {
	plain: {
		struct: {
			image: ImageSet;
		};
	};

	pair: {
		struct: {
			images: [ImageSet, ImageSet];
		};
	};

	composite: {
		struct: {
			bg: ImageSet;
			fg: ImageSet;
		};
	};
}

export type PfpTypeKey = keyof PfpTypeRegistry;

export type PfpType<
	si_type extends PfpTypeKey=PfpTypeKey,
> = {
	[si_each in PfpTypeKey]: Merge<{
		type: si_each;
	}, PfpTypeRegistry[si_each]['struct']>;
}[si_type];


export type Pfp<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Resource.New<{
	segments: ['template.pfp', `uuid.${string}`];
	struct: PfpType<si_type>;
}>;

export type PfpPath<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Resource.Path<Pfp<si_type>>;

export type PfpTarget = PfpPath | `pfp:${string}` | `svg:${string}` | '';

export type PfpStruct<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Pfp<si_type>['struct'];
