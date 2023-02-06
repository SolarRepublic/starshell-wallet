import type {AminoSignResponse, StdSignDoc} from '@cosmjs/amino';
import type {SignDoc} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type {Writable} from 'ts-toolbelt/out/Object/Writable';

import type {AccountStruct, AccountPath} from '#/meta/account';

import type {SerializeToJson} from '#/meta/belt';

export type SloppySignDoc = SerializeToJson<Partial<SignDoc> & Pick<SignDoc, 'chainId'>>;
