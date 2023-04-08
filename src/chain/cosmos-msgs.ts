import type {O} from 'ts-toolbelt';
import type {Type} from 'ts-toolbelt/out/Any/Type';

import type {Dict, JsonObject} from '#/meta/belt';
import type {Bech32} from '#/meta/chain';


import {
	BaseAccount,
	ModuleAccount,
	// ModuleCredential,
	Params as AuthParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/auth';

import {
	MsgUpdateParams as AuthMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/auth/v1beta1/tx';

import {
	GenericAuthorization,
	Grant as AuthzGrant,
	GrantAuthorization,
	// GrantQueueItem,
} from '@solar-republic/cosmos-grpc/dist/cosmos/authz/v1beta1/authz';

import {
	MsgGrant as AuthzMsgGrant,
	MsgExec as AuthzMsgExec,
	MsgRevoke as AuthzMsgRevoke,
} from '@solar-republic/cosmos-grpc/dist/cosmos/authz/v1beta1/tx';

import {
	SendAuthorization as BankSendAuthorization,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/authz';

import {
	Params as BankParams,
	SendEnabled as BankSendEnabled,
	Input as BankInput,
	Output as BankOutput,
	Supply as BankSupply,
	DenomUnit as BankDenomUnit,
	Metadata as BankMetadata,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/bank';

import {
	MsgSend,
	MsgMultiSend,
	// MsgUpdateParams as BankMsgUpdateParams,
	// MsgSetSendEnabled,
} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';

import {
	Capability,
	Owner,
	CapabilityOwners,
} from '@solar-republic/cosmos-grpc/dist/cosmos/capability/v1beta1/capability';

import {
	MsgUpdateParams as ConsensusMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/consensus/v1/tx';

// import {
// 	MsgAuthorizeCircuitBreaker,
// 	MsgTripCircuitBreaker,
// 	MsgResetCircuitBreaker,
// } from '@solar-republic/cosmos-grpc/dist/cosmos/crisis/v1/tx';

import {
	MsgVerifyInvariant,
	// MsgUpdateParams as CrisisMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/crisis/v1beta1/tx';

import {
	Params as DistributionParams,
	ValidatorHistoricalRewards,
	ValidatorCurrentRewards,
	ValidatorAccumulatedCommission,
	ValidatorOutstandingRewards,
	ValidatorSlashEvent,
	ValidatorSlashEvents,
	FeePool,
	CommunityPoolSpendProposal,
	DelegatorStartingInfo,
	DelegationDelegatorReward,
	CommunityPoolSpendProposalWithDeposit,
} from '@solar-republic/cosmos-grpc/dist/cosmos/distribution/v1beta1/distribution';

import {
	MsgSetWithdrawAddress,
	MsgWithdrawDelegatorReward,
	MsgWithdrawValidatorCommission,
	MsgFundCommunityPool,
	MsgSetAutoRestake,
	// MsgUpdateParams as DistributionMsgUpdateParams,
	// MsgCommunityPoolSpend,
	// MsgDepositValidatorRewardsPool,
} from '@solar-republic/cosmos-grpc/dist/cosmos/distribution/v1beta1/tx';

import {
	Equivocation,
} from '@solar-republic/cosmos-grpc/dist/cosmos/evidence/v1beta1/evidence';

import {
	MsgSubmitEvidence,
} from '@solar-republic/cosmos-grpc/dist/cosmos/evidence/v1beta1/tx';

import {
	AllowedMsgAllowance,
	BasicAllowance,
	PeriodicAllowance,
	Grant as FeegrantGrant,
} from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/feegrant';

import {
	MsgGrantAllowance as FeegrantMsgGrantAllowance,
	MsgRevokeAllowance as FeegrantMsgRevokeAllowance,
} from '@solar-republic/cosmos-grpc/dist/cosmos/feegrant/v1beta1/tx';

import {
	WeightedVoteOption as Gov1WeightedVoteOption,
	Deposit as Gov1Deposit,
	Proposal as Gov1Proposal,
	TallyResult as Gov1TallyResult,
	Vote as Gov1Vote,
	DepositParams as Gov1DepositParams,
	VotingParams as Gov1VotingParams,
	TallyParams as Gov1TallyParams,
	Params as Gov1Params,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1/gov';

import {
	MsgSubmitProposal as Gov1MsgSubmitProposal,
	MsgExecLegacyContent,
	MsgVote as Gov1MsgVote,
	MsgVoteWeighted as Gov1MsgVoteWeighted,
	MsgDeposit as Gov1MsgDeposity,
	MsgUpdateParams as Gov1MsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1/tx';

import {
	WeightedVoteOption,
	TextProposal,
	Deposit,
	Proposal,
	TallyResult,
	Vote,
	DepositParams,
	VotingParams,
	TallyParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';

import {
	MsgSubmitProposal,
	MsgVote,
	MsgVoteWeighted,
	MsgDeposit,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/tx';

import {
	MsgCreateGroup,
	MsgUpdateGroupMembers,
	MsgUpdateGroupAdmin,
	MsgUpdateGroupMetadata,
	MsgCreateGroupPolicy,
	MsgUpdateGroupPolicyAdmin,
	MsgCreateGroupWithPolicy,
	MsgUpdateGroupPolicyDecisionPolicy,
	MsgUpdateGroupPolicyMetadata,
	MsgSubmitProposal as GroupMsgSubmitProposal,
	MsgWithdrawProposal as GroupMsgWithdrawProposal,
	MsgVote as GroupMsgVote,
	MsgExec as GroupMsgExec,
	MsgLeaveGroup,
} from '@solar-republic/cosmos-grpc/dist/cosmos/group/v1/tx';

import {
	Minter,
	Params as MintParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/mint/v1beta1/mint';

import {
	MsgUpdateParams as MintMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/mint/v1beta1/tx';

import {
	Class as NftClass,
	NFT,
} from '@solar-republic/cosmos-grpc/dist/cosmos/nft/v1beta1/nft';

import {
	MsgSend as NftMsgSend,
} from '@solar-republic/cosmos-grpc/dist/cosmos/nft/v1beta1/tx';

import {
	ParameterChangeProposal,
	ParamChange,
} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/params';

import {
	ValidatorSigningInfo,
	Params as SlashingParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/slashing/v1beta1/slashing';

import {
	MsgUnjail,
	// MsgUpdateParams as SlashingMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/slashing/v1beta1/tx';

import {
	HistoricalInfo,
	CommissionRates,
	Commission,
	Description as StakingDescription,
	Validator,
	ValAddresses,
	DVPair,
	DVPairs,
	DVVTriplet,
	DVVTriplets,
	Delegation,
	UnbondingDelegation,
	UnbondingDelegationEntry,
	RedelegationEntry,
	Redelegation,
	Params as StakingParams,
	Pool,
	// ValidatorUpdates,
} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/staking';

import {
	MsgCreateValidator,
	MsgEditValidator,
	MsgDelegate,
	MsgBeginRedelegate,
	MsgUndelegate,
	// MsgCancelUnbondingDelegation,
	// MsgUpdateParams as StakingMsgUpdateParams,
} from '@solar-republic/cosmos-grpc/dist/cosmos/staking/v1beta1/tx';

import {
	SignatureDescriptors,
	SignatureDescriptor,
	SignatureDescriptor_Data,
	SignatureDescriptor_Data_Single,
	SignatureDescriptor_Data_Multi,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/signing/v1beta1/signing';

import {
	Tx,
	TxRaw,
	SignDoc,
	// SignDocDirectAux,
	TxBody,
	AuthInfo,
	SignerInfo,
	ModeInfo,
	ModeInfo_Single,
	ModeInfo_Multi,
	Fee,
	// Tip,
	// AuxSignerData,
} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import {
	MsgSoftwareUpgrade,
	MsgCancelUpgrade,
} from '@solar-republic/cosmos-grpc/dist/cosmos/upgrade/v1beta1/tx';

import {
	Plan,
	SoftwareUpgradeProposal,
	CancelSoftwareUpgradeProposal,
	ModuleVersion,
} from '@solar-republic/cosmos-grpc/dist/cosmos/upgrade/v1beta1/upgrade';

import {
	MsgCreateVestingAccount,
	// MsgCreatePermanentLockedAccount,
	// MsgCreatePeriodicVestingAccount,
} from '@solar-republic/cosmos-grpc/dist/cosmos/vesting/v1beta1/tx';

import {
	BaseVestingAccount,
	ContinuousVestingAccount,
	DelayedVestingAccount,
	Period,
	PeriodicVestingAccount,
	PermanentLockedAccount,
} from '@solar-republic/cosmos-grpc/dist/cosmos/vesting/v1beta1/vesting';


// import {
// 	ContractExecutionAuthorization,
// 	ContractMigrationAuthorization,
// 	ContractGrant,
// 	MaxCallsLimit,
// 	MaxFundsLimit,
// 	CombinedLimit,
// 	AllowAllMessagesFilter,
// 	AcceptedMessageKeysFilter,
// 	AcceptedMessagesFilter,
// } from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/authz';


// import {
// 	MsgIBCSend,
// 	MsgIBCCloseChannel,
// } from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/ibc';

// import {
// 	StoreCodeProposal,
// 	InstantiateContractProposal,
// 	InstantiateContract2Proposal,
// 	MigrateContractProposal,
// 	SudoContractProposal,
// 	ExecuteContractProposal,
// 	UpdateAdminProposal,
// 	ClearAdminProposal,
// 	PinCodesProposal,
// 	UnpinCodesProposal,
// 	AccessConfigUpdate,
// 	UpdateInstantiateConfigProposal,
// 	StoreAndInstantiateContractProposal,
// } from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/proposal';

// import {
// 	MsgStoreCode,
// 	MsgInstantiateContract,
// 	MsgInstantiateContract2,
// 	MsgExecuteContract,
// 	MsgMigrateContract,
// 	MsgUpdateAdmin,
// 	MsgClearAdmin,
// 	MsgUpdateInstantiateConfig,
// } from '@solar-republic/cosmos-grpc/dist/cosmwasm/wasm/v1/tx';


import {
	MsgStoreCode as SecretMsgStoreCode,
	MsgInstantiateContract as SecretMsgInstantiateContract,
	MsgExecuteContract as SecretMsgExecuteContract,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/msg';

import {
	AccessTypeParam as SecretAccessTypeParam,
	CodeInfo as SecretCodeInfo,
	ContractCustomInfo as SecretContractCustomInfo,
	ContractInfo as SecretContractInfo,
	AbsoluteTxPosition as SecretAbsoluteTxPosition,
	Model as SecretModel,
} from '@solar-republic/cosmos-grpc/dist/secret/compute/v1beta1/types';

import {
	MsgRegisterAccount,
	MsgSubmitTx,
} from '@solar-republic/cosmos-grpc/dist/secret/intertx/v1beta1/tx';


import {
	PublicKey as TmPublicKey,
} from '@solar-republic/cosmos-grpc/dist/tendermint/crypto/keys';

import {
	Block as TmBlock,
} from '@solar-republic/cosmos-grpc/dist/tendermint/types/block';



import {bech32_to_buffer, buffer_to_bech32} from '#/crypto/bech32';
import {is_dict, oderom} from '#/util/belt';
import {base64_to_buffer, buffer_to_base64} from '#/util/data';
import {camel_to_snake, snake_to_camel} from '#/util/format';


export interface CanonicalBase {
	// id: `/${'cosmos' | 'secret'}.${string}`;
	id: string;
	data: object;
	encode(): {
		typeUrl: string;
		value: Uint8Array;
	};
}

export interface TypedValue {
	type: string;
	value: JsonObject;
}

export interface ProtoMsg {
	typeUrl: string;
	value: Uint8Array;
}

type ProtoPrimitive = string | Uint8Array | ProtoObject;

interface ProtoObject { // eslint-disable-line
	[k: string]: ProtoPrimitive | ProtoPrimitive[];
}

export type ProtoData = Type<ProtoObject, 'proto-data'>;


interface Methods {
	fromPartial(g_partial: object): ProtoData;
	fromJSON(g_json: JsonObject): ProtoData;
	toJSON(g_data: ProtoData): JsonObject;
	encode(g_data: ProtoData): {
		finish(): Uint8Array;
	};
	decode(atu8_input: Uint8Array): ProtoData;
}


const A_SECRET_CALLBACKS = [
	'callbackSig',
	'callbackCodeHash',
];


const H_ROOT_DEFS = {
	tendermint: {
		groups: {
			'tendermint.types': {
				PublicKey: {
					methods: TmPublicKey,
				},

				Block: {
					methods: TmBlock,
				},
			},
		},
	},

	cosmos: {
		groups: {
			'cosmos-sdk': {
				'auth.v1beta1': {
					BaseAccount: {
						methods: BaseAccount,
					},
					ModuleAccount: {
						methods: ModuleAccount,
					},
					// ModuleCredential: {
					// 	methods: ModuleCredential,
					// },
					Params: {
						methods: AuthParams,
					},

					MsgUpdateParams: {
						methods: AuthMsgUpdateParams,
					},
				},

				'authz.v1beta1': {
					GenericAuthorization: {
						methods: GenericAuthorization,
					},
					Grant: {
						methods: AuthzGrant,
					},
					GrantAuthorization: {
						methods: GrantAuthorization,
					},
					// GrantQueueItem: {
					// 	methods: GrantQueueItem,
					// },

					MsgGrant: {
						methods: AuthzMsgGrant,
					},
					MsgExec: {
						methods: AuthzMsgExec,
					},
					MsgRevoke: {
						methods: AuthzMsgRevoke,
					},
				},

				'bank.v1beta1': {
					SendAuthorization: {
						methods: BankSendAuthorization,
					},

					Params: {
						methods: BankParams,
					},
					SendEnabled: {
						methods: BankSendEnabled,
					},
					Input: {
						methods: BankInput,
					},
					Output: {
						methods: BankOutput,
					},
					Supply: {
						methods: BankSupply,
					},
					DenomUnit: {
						methods: BankDenomUnit,
					},
					Metadata: {
						methods: BankMetadata,
					},

					MsgSend: {
						methods: MsgSend,
					},
					MsgMultiSend: {
						methods: MsgMultiSend,
					},
					// MsgUpdateParams: {
					// 	methods: BankMsgUpdateParams,
					// },
					// MsgSetSendEnabled: {
					// 	methods: MsgSetSendEnabled,
					// },
				},

				'capability.v1beta1': {
					Capability: {
						methods: Capability,
					},
					Owner: {
						methods: Owner,
					},
					CapabilityOwners: {
						methods: CapabilityOwners,
					},
				},

				'consensus.v1': {
					MsgUpdateParams: {
						methods: ConsensusMsgUpdateParams,
					},
				},

				'crisis.v1': {
					// MsgAuthorizeCircuitBreaker: {
					// 	methods: MsgAuthorizeCircuitBreaker,
					// },
					// MsgTripCircuitBreaker: {
					// 	methods: MsgTripCircuitBreaker,
					// },
					// MsgResetCircuitBreaker: {
					// 	methods: MsgResetCircuitBreaker,
					// },
				},

				'crisis.v1beta1': {
					MsgVerifyInvariant: {
						methods: MsgVerifyInvariant,
					},
					// MsgUpdateParams: {
					// 	methods: CrisisMsgUpdateParams,
					// },
				},

				'distribution.v1beta1': {
					Params: {
						methods: DistributionParams,
					},
					ValidatorHistoricalRewards: {
						methods: ValidatorHistoricalRewards,
					},
					ValidatorCurrentRewards: {
						methods: ValidatorCurrentRewards,
					},
					ValidatorAccumulatedCommission: {
						methods: ValidatorAccumulatedCommission,
					},
					ValidatorOutstandingRewards: {
						methods: ValidatorOutstandingRewards,
					},
					ValidatorSlashEvent: {
						methods: ValidatorSlashEvent,
					},
					ValidatorSlashEvents: {
						methods: ValidatorSlashEvents,
					},
					FeePool: {
						methods: FeePool,
					},
					CommunityPoolSpendProposal: {
						methods: CommunityPoolSpendProposal,
					},
					DelegatorStartingInfo: {
						methods: DelegatorStartingInfo,
					},
					DelegationDelegatorReward: {
						methods: DelegationDelegatorReward,
					},
					CommunityPoolSpendProposalWithDeposit: {
						methods: CommunityPoolSpendProposalWithDeposit,
					},

					MsgSetWithdrawAddress: {
						methods: MsgSetWithdrawAddress,
					},
					MsgWithdrawDelegatorReward: {
						methods: MsgWithdrawDelegatorReward,
					},
					MsgWithdrawValidatorCommission: {
						methods: MsgWithdrawValidatorCommission,
					},
					MsgFundCommunityPool: {
						methods: MsgFundCommunityPool,
					},
					MsgSetAutoRestake: {
						methods: MsgSetAutoRestake,
					},
					// MsgUpdateParams: {
					// 	methods: DistributionMsgUpdateParams,
					// },
					// MsgCommunityPoolSpend: {
					// 	methods: MsgCommunityPoolSpend,
					// },
					// MsgDepositValidatorRewardsPool: {
					// 	methods: MsgDepositValidatorRewardsPool,
					// },
				},

				'evidence.v1beta': {
					Equivocation: {
						methods: Equivocation,
					},

					MsgSubmitEvidence: {
						methods: MsgSubmitEvidence,
					},
				},

				'feegrant.v1beta1': {
					BasicAllowance: {
						methods: BasicAllowance,
					},
					PeriodicAllowance: {
						methods: PeriodicAllowance,
					},
					AllowedMsgAllowance: {
						methods: AllowedMsgAllowance,
					},
					Grant: {
						methods: FeegrantGrant,
					},

					MsgGrantAllowance: {
						methods: FeegrantMsgGrantAllowance,
					},
					MsgRevokeAllowance: {
						methods: FeegrantMsgRevokeAllowance,
					},
				},

				'gov.v1': {
					WeightedVoteOption: {
						methods: Gov1WeightedVoteOption,
					},
					Deposit: {
						methods: Gov1Deposit,
					},
					Proposal: {
						methods: Gov1Proposal,
					},
					TallyResult: {
						methods: Gov1TallyResult,
					},
					Vote: {
						methods: Gov1Vote,
					},
					DepositParams: {
						methods: Gov1DepositParams,
					},
					VotingParams: {
						methods: Gov1VotingParams,
					},
					TallyParams: {
						methods: Gov1TallyParams,
					},
					Params: {
						methods: Gov1Params,
					},

					MsgSubmitProposal: {
						methods: Gov1MsgSubmitProposal,
					},
					MsgExecLegacyContent: {
						methods: MsgExecLegacyContent,
					},
					MsgVote: {
						methods: Gov1MsgVote,
					},
					MsgVoteWeighted: {
						methods: Gov1MsgVoteWeighted,
					},
					MsgDeposit: {
						methods: Gov1MsgDeposity,
					},
					MsgUpdateParams: {
						methods: Gov1MsgUpdateParams,
					},
				},

				'gov.v1beta1': {
					WeightedVoteOption: {
						methods: WeightedVoteOption,
					},
					TextProposal: {
						methods: TextProposal,
					},
					Deposit: {
						methods: Deposit,
					},
					Proposal: {
						methods: Proposal,
					},
					TallyResult: {
						methods: TallyResult,
					},
					Vote: {
						methods: Vote,
					},
					DepositParams: {
						methods: DepositParams,
					},
					VotingParams: {
						methods: VotingParams,
					},
					TallyParams: {
						methods: TallyParams,
					},

					MsgSubmitProposal: {
						methods: MsgSubmitProposal,
					},
					MsgVote: {
						methods: MsgVote,
					},
					MsgVoteWeighted: {
						methods: MsgVoteWeighted,
					},
					MsgDeposit: {
						methods: MsgDeposit,
					},
				},

				'group.v1': {
					MsgCreateGroup: {
						methods: MsgCreateGroup,
					},
					MsgUpdateGroupMembers: {
						methods: MsgUpdateGroupMembers,
					},
					MsgUpdateGroupAdmin: {
						methods: MsgUpdateGroupAdmin,
					},
					MsgUpdateGroupMetadata: {
						methods: MsgUpdateGroupMetadata,
					},
					MsgCreateGroupPolicy: {
						methods: MsgCreateGroupPolicy,
					},
					MsgUpdateGroupPolicyAdmin: {
						methods: MsgUpdateGroupPolicyAdmin,
					},
					MsgCreateGroupWithPolicy: {
						methods: MsgCreateGroupWithPolicy,
					},
					MsgUpdateGroupPolicyDecisionPolicy: {
						methods: MsgUpdateGroupPolicyDecisionPolicy,
					},
					MsgUpdateGroupPolicyMetadata: {
						methods: MsgUpdateGroupPolicyMetadata,
					},

					MsgSubmitProposal: {
						methods: GroupMsgSubmitProposal,
					},
					MsgWithdrawProposal: {
						methods: GroupMsgWithdrawProposal,
					},
					MsgVote: {
						methods: GroupMsgVote,
					},
					MsgExec: {
						methods: GroupMsgExec,
					},
					MsgLeaveGroup: {
						methods: MsgLeaveGroup,
					},
				},

				'mint.v1beta1': {
					Minter: {
						methods: Minter,
					},
					Params: {
						methods: MintParams,
					},

					MsgUpdateParams: {
						methods: MintMsgUpdateParams,
					},
				},

				'nft.v1beta1': {
					Class: {
						methods: NftClass,
					},
					NFT: {
						methods: NFT,
					},

					MsgSend: {
						methods: NftMsgSend,
					},
				},

				'params.v1beta1': {
					ParameterChangeProposal: {
						methods: ParameterChangeProposal,
					},
					ParamChange: {
						methods: ParamChange,
					},
				},

				'slashing.v1beta1': {
					ValidatorSigningInfo: {
						methods: ValidatorSigningInfo,
					},
					Params: {
						methods: SlashingParams,
					},

					MsgUnjail: {
						methods: MsgUnjail,
					},
					// MsgUpdateParams: {
					// 	methods: SlashingMsgUpdateParams,
					// },
				},

				'staking.v1beta1': {
					HistoricalInfo: {
						methods: HistoricalInfo,
					},
					CommissionRates: {
						methods: CommissionRates,
					},
					Commission: {
						methods: Commission,
					},
					Description: {
						methods: StakingDescription,
					},
					Validator: {
						methods: Validator,
					},
					ValAddresses: {
						methods: ValAddresses,
					},
					DVPair: {
						methods: DVPair,
					},
					DVPairs: {
						methods: DVPairs,
					},
					DVVTriplet: {
						methods: DVVTriplet,
					},
					DVVTriplets: {
						methods: DVVTriplets,
					},
					Delegation: {
						methods: Delegation,
					},
					UnbondingDelegation: {
						methods: UnbondingDelegation,
					},
					UnbondingDelegationEntry: {
						methods: UnbondingDelegationEntry,
					},
					RedelegationEntry: {
						methods: RedelegationEntry,
					},
					Redelegation: {
						methods: Redelegation,
					},
					Params: {
						methods: StakingParams,
					},
					Pool: {
						methods: Pool,
					},
					// ValidatorUpdates: {
					// 	methods: ValidatorUpdates,
					// },

					MsgCreateValidator: {
						methods: MsgCreateValidator,
					},
					MsgEditValidator: {
						methods: MsgEditValidator,
					},
					MsgDelegate: {
						methods: MsgDelegate,
					},
					MsgBeginRedelegate: {
						methods: MsgBeginRedelegate,
					},
					MsgUndelegate: {
						methods: MsgUndelegate,
					},
					// MsgCancelUnbondingDelegation: {
					// 	methods: MsgCancelUnbondingDelegation,
					// },
					// MsgUpdateParams: {
					// 	methods: StakingMsgUpdateParams,
					// },
				},

				'tx.v1beta1': {
					SignatureDescriptors: {
						methods: SignatureDescriptors,
					},
					SignatureDescriptor: {
						methods: SignatureDescriptor,
					},
					SignatureDescriptor_Data: {
						methods: SignatureDescriptor_Data,
					},
					SignatureDescriptor_Data_Single: {
						methods: SignatureDescriptor_Data_Single,
					},
					SignatureDescriptor_Data_Multi: {
						methods: SignatureDescriptor_Data_Multi,
					},

					Tx: {
						methods: Tx,
					},
					TxRaw: {
						methods: TxRaw,
					},
					SignDoc: {
						methods: SignDoc,
					},
					// SignDocDirectAux: {
					// 	methods: SignDocDirectAux,
					// },
					TxBody: {
						methods: TxBody,
					},
					AuthInfo: {
						methods: AuthInfo,
					},
					SignerInfo: {
						methods: SignerInfo,
					},
					ModeInfo: {
						methods: ModeInfo,
					},
					ModeInfo_Single: {
						methods: ModeInfo_Single,
					},
					ModeInfo_Multi: {
						methods: ModeInfo_Multi,
					},
					Fee: {
						methods: Fee,
					},
					// Tip: {
					// 	methods: Tip,
					// },
					// AuxSignerData: {
					// 	methods: AuxSignerData,
					// },
				},

				'upgrade.v1beta': {
					MsgSoftwareUpgrade: {
						methods: MsgSoftwareUpgrade,
					},
					MsgCancelUpgrade: {
						methods: MsgCancelUpgrade,
					},

					Plan: {
						methods: Plan,
					},
					SoftwareUpgradeProposal: {
						methods: SoftwareUpgradeProposal,
					},
					CancelSoftwareUpgradeProposal: {
						methods: CancelSoftwareUpgradeProposal,
					},
					ModuleVersion: {
						methods: ModuleVersion,
					},
				},

				'vesting.v1beta1': {
					MsgCreateVestingAccount: {
						methods: MsgCreateVestingAccount,
					},
					// MsgCreatePermanentLockedAccount: {
					// 	methods: MsgCreatePermanentLockedAccount,
					// },
					// MsgCreatePeriodicVestingAccount: {
					// 	methods: MsgCreatePeriodicVestingAccount,
					// },

					BaseVestingAccount: {
						methods: BaseVestingAccount,
					},
					ContinuousVestingAccount: {
						methods: ContinuousVestingAccount,
					},
					DelayedVestingAccount: {
						methods: DelayedVestingAccount,
					},
					Period: {
						methods: Period,
					},
					PeriodicVestingAccount: {
						methods: PeriodicVestingAccount,
					},
					PermanentLockedAccount: {
						methods: PermanentLockedAccount,
					},
				},
			},
		},
	},

	// cosmwasm: {
	// 	groups: {
	// 		wasm: {
	// 			'wasm.v1': {

	// 			},
	// 		},
	// 	},
	// },

	secret: {
		groups: {
			wasm: {
				'compute.v1beta1': {
					MsgStoreCore: {
						methods: SecretMsgStoreCode,
						amino: {
							fields: {
								sender: bech32_to_buffer,
							},
						},
						proto: {
							fields: {
								sender: buffer_to_bech32,
							},
						},
					},
					MsgInstantiateContract: {
						methods: SecretMsgInstantiateContract,
						amino: {
							omit: A_SECRET_CALLBACKS,
						},
					},
					MsgExecuteContract: {
						methods: SecretMsgExecuteContract,
						amino: {
							omit: A_SECRET_CALLBACKS,
							fields: {
								contract: bech32_to_buffer,
							},
						},
						proto: {
							fields: {
								contract: buffer_to_bech32,
							},
						},
					},

					AccessTypeParam: {
						methods: SecretAccessTypeParam,
					},
					CodeInfo: {
						methods: SecretCodeInfo,
					},
					ContractCustomInfo: {
						methods: SecretContractCustomInfo,
					},
					ContractInfo: {
						methods: SecretContractInfo,
					},
					AbsoluteTxPosition: {
						methods: SecretAbsoluteTxPosition,
					},
					Model: {
						methods: SecretModel,
					},
				},

				'intertx.v1beta1': {
					MsgRegisterAccount: {
						methods: MsgRegisterAccount,
					},
					MsgSubmitTx: {
						methods: MsgSubmitTx,
					},
				},
			},
		},
	},
} as unknown as Dict<{
	groups: Dict<Dict<Dict<{
		methods: Methods;
		amino?: {
			omit?: string[];
		};
	}>>>;
}>;


const H_MAP_PROTO_TO_AMINO = oderom(H_ROOT_DEFS, (si_root, {groups:h_groups}) => oderom(
	h_groups, (si_alias: string, h_modules) => oderom(
		h_modules, (si_module: string, h_messages) => oderom(
			h_messages, (si_message: string, {amino:gc_amino}) => ({
				[`/${si_root}.${si_module}.${si_message}`]: {
					id: `${si_alias}/${si_message}`,
					config: (gc_amino || {}) as {
						omit: string[];
					},
				},
			})
		)
	)
));


const H_MAP_AMINO_TO_PROTO = oderom(H_MAP_PROTO_TO_AMINO, (si_proto, {id:si_amino}) => ({
	[si_amino]: si_proto,
})) as Dict;


const H_CONFIGS_PROTO = oderom(H_ROOT_DEFS, (si_root, {groups:h_groups}) => oderom(
	h_groups, (si_alias, h_modules) => oderom(
		h_modules, (si_module: string, h_messages) => oderom(
			h_messages, (si_message: string, gc_proto) => ({
				[`/${si_root}.${si_module}.${si_message}`]: gc_proto,
			})
		)
	)
));


export function recase_keys_snake_to_camel(g_object: Dict<any>, f_transform?: null | ((si_key: string, w_value: any) => any)): Dict<any> {
	return oderom(g_object, (si_key, z_value) => {
		const w_value = f_transform? f_transform(si_key, z_value): z_value;

		const w_recased = w_value instanceof Uint8Array
			? buffer_to_base64(w_value)
			: is_dict(w_value)
				? recase_keys_snake_to_camel(w_value, f_transform)
				: w_value;

		return {
			[snake_to_camel(si_key)]: w_recased,
		};
	});
}

export class AminoToProtoError extends Error {
	constructor(protected _e_from: Error) {
		super(`While attempting to convert Amino object to Proto: ${_e_from.message}`);
	}

	get original(): Error {
		return this._e_from;
	}
}

export class UnmappedAminoError extends Error {
	constructor(protected _si_amino: string) {
		super(`Amino object type "${_si_amino}" is either invalid or unknown`);
	}
}

const A_SECRET_ADDRESSABLE_KEYS = ['sender', 'recipient', 'contract', 'creator'];

export function amino_to_base(g_msg: TypedValue): CanonicalBase {
	const {
		type: si_msg,
		value: g_value,
	} = g_msg;

	const si_proto = H_MAP_AMINO_TO_PROTO[si_msg];
	if(si_proto && si_proto in H_CONFIGS_PROTO) {
		const gc_proto = H_CONFIGS_PROTO[si_proto];

		const g_recased = recase_keys_snake_to_camel(g_value, (si_key, w_value) => {
			// replace bech32 with address buffer (which in turns gets converted into base64 string)
			if('string' === typeof w_value && A_SECRET_ADDRESSABLE_KEYS.includes(si_key) && si_proto.startsWith('/secret.')) {
				return bech32_to_buffer(w_value as Bech32);
			}

			// keep as-is
			return w_value;
		});

		let g_data: ProtoData;
		try {
			g_data = gc_proto.methods.fromJSON(g_recased);
		}
		catch(e_from) {
			throw new AminoToProtoError(e_from as Error);
		}

		return {
			id: si_proto,
			data: g_data,
			encode: () => ({
				typeUrl: si_proto,
				value: gc_proto.methods.encode(g_data).finish(),
			}),
		};
	}

	throw new UnmappedAminoError(si_msg);
}

export function encode_proto<
	y_methods extends {
		fromPartial(g: object): any;
	},
>(y_methods: y_methods, g_partial: O.Partial<ReturnType<y_methods['fromPartial']>, 'deep'>): Uint8Array {
	return (y_methods as unknown as Methods).encode((y_methods as unknown as Methods).fromPartial(g_partial)).finish();
}


function recase_item_camel_to_snake(w_value: any, f_transform?: null | ((si_key: string | number, w_value: any) => any)) {
	return is_dict(w_value) && !(w_value instanceof Uint8Array)
		? recase_keys_camel_to_snake(w_value, f_transform)
		: Array.isArray(w_value)
			? w_value.map((w_item, i_item) => f_transform
				? f_transform(i_item, w_item)
				: recase_item_camel_to_snake(w_item, f_transform))
			: w_value;
}

export function recase_keys_camel_to_snake(g_object: Dict<any>, f_transform?: null | ((si_key: string | number, w_value: any) => any)): Dict<any> {
	return oderom(g_object, (si_key, z_value) => {
		const w_value = f_transform? f_transform(si_key, z_value): z_value;

		return {
			[camel_to_snake(si_key)]: recase_item_camel_to_snake(w_value, f_transform),
		};
	});
}


export class ProtoToAminoError extends Error {
	constructor(protected _s_msg: string) {
		super(`While attempting to convert Proto object to Amino: ${_s_msg}`);
	}
}

export class UnmappedProtoError extends Error {
	constructor(protected _si_proto: string) {
		super(`Proto object type "${_si_proto}" is either invalid or unknown`);
	}
}

export function proto_to_amino<
	g_amino extends TypedValue=TypedValue,
>(g_msg: ProtoMsg, s_hrp: string | null): g_amino {
	const {
		typeUrl: si_proto,
		value: atu8_value,
	} = g_msg;

	if(si_proto in H_CONFIGS_PROTO) {
		const gc_proto = H_CONFIGS_PROTO[si_proto];

		if(si_proto in H_MAP_PROTO_TO_AMINO) {
			const {
				id: si_amino,
				config: gc_amino,
			} = H_MAP_PROTO_TO_AMINO[si_proto];

			const y_methods = gc_proto.methods;

			const g_decoded = y_methods.decode(atu8_value);

			const g_json = y_methods.toJSON(g_decoded);

			for(const si_delete of gc_amino.omit || []) {
				delete g_json[si_delete];
			}

			// recase dict keys
			const g_recased = recase_keys_camel_to_snake(g_json, s_hrp? (z_key, w_value) => {
				// sub message
				if(is_dict(w_value) && 'string' === typeof w_value.typeUrl && 'undefined' !== typeof w_value.value) {
					if('string' === typeof w_value.value) {
						return proto_to_amino({
							typeUrl: w_value.typeUrl,
							value: base64_to_buffer(w_value.value),
						}, s_hrp);
					}
					else {
						throw new ProtoToAminoError(`Uncertain how to parse typed value with non-string value type: ${w_value}`);
					}
				}

				// object
				if('string' === typeof z_key) {
					// replace address buffer with bech32
					if('string' === typeof w_value && A_SECRET_ADDRESSABLE_KEYS.includes(z_key) && si_proto.startsWith('/secret.')) {
						return buffer_to_bech32(base64_to_buffer(w_value), s_hrp);
					}
				}

				// keep as-is
				return w_value;
			}: null);

			return {
				type: si_amino,
				value: JSON.parse(JSON.stringify(g_recased)) as JsonObject,
			} as g_amino;
		}
	}

	throw new UnmappedProtoError(si_proto);
}
