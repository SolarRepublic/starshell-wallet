import type {MessageDict} from './messages/_types';

import {BankMessages} from './messages/bank';
import {ComputeMessages} from './messages/compute';
import {DistributionMessages} from './messages/distribution';
import {FeegrantMessages} from './messages/feegrant';
import {GovMessages} from './messages/gov';

export const H_INTERPRETTERS: MessageDict = {
	...BankMessages,
	...ComputeMessages,
	...DistributionMessages,
	...FeegrantMessages,
	...GovMessages,
};
