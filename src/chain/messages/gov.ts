import type {MessageDict} from './_types';
import type {TypedValue} from '../cosmos-msgs';
import type {Coin} from '@cosmjs/amino';

import type {
	CommunityPoolSpendProposal,
} from '@solar-republic/cosmos-grpc/dist/cosmos/distribution/v1beta1/distribution';

import type {
	TextProposal,
	WeightedVoteOption
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';

import type {
	ParameterChangeProposal,
} from '@solar-republic/cosmos-grpc/dist/cosmos/params/v1beta1/params';

// import type {
// 	ClientUpdateProposal,
// 	UpgradeProposal,
// } from '@solar-republic/cosmos-grpc/ibc/core/client/v1/client';

import type {
	SoftwareUpgradeProposal,
	CancelSoftwareUpgradeProposal,
} from '@solar-republic/cosmos-grpc/dist/cosmos/upgrade/v1beta1/upgrade';

import type {Dict, JsonValue} from '#/meta/belt';
import type {Bech32, ChainStruct} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';

import {
	ProposalStatus,
	VoteOption,
} from '@solar-republic/cosmos-grpc/dist/cosmos/gov/v1beta1/gov';

import {add_coins, kv} from './_util';
import {proto_to_amino} from '../cosmos-msgs';

import {JsonPreviewer} from '#/app/helper/json-previewer';

import {yw_network} from '#/app/mem';
import {dd} from '#/util/dom';
import {format_amount} from '#/util/format';

type ProposalRegistry = {
	TextProposal: TextProposal;
	CommunityPoolSpendProposal: CommunityPoolSpendProposal;
	ParameterChangeProposal: ParameterChangeProposal;
	SoftwareUpgradeProposal: SoftwareUpgradeProposal;
	CancelSoftwareUpgradeProposal: CancelSoftwareUpgradeProposal;
};

type ProposalKey = keyof ProposalRegistry;

type ProposalTuple<
	as_keys extends ProposalKey=ProposalKey,
> = TypedValue & {
	[si_key in as_keys]: {
		type: `cosmos-sdk/${si_key}`;
		value: ProposalRegistry[si_key];
	};
}[as_keys];


export const H_VOTE_OPTIONS: Record<VoteOption, string> = {
	[VoteOption.VOTE_OPTION_UNSPECIFIED]: '(does nothing)',
	[VoteOption.VOTE_OPTION_YES]: 'YES',
	[VoteOption.VOTE_OPTION_ABSTAIN]: 'ABSTAIN',
	[VoteOption.VOTE_OPTION_NO]: 'NO',
	[VoteOption.VOTE_OPTION_NO_WITH_VETO]: 'NO WITH VETO',
	[VoteOption.UNRECOGNIZED]: '(unrecognized option)',
};

export const H_PROPOSAL_STATUSES: Record<ProposalStatus, string> = {
	[ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED]: '(unspecified)',
	[ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD]: 'Deposit Period',
	[ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD]: 'Voting Period',
	[ProposalStatus.PROPOSAL_STATUS_PASSED]: 'PASSED',
	[ProposalStatus.PROPOSAL_STATUS_REJECTED]: 'REJECTED',
	[ProposalStatus.PROPOSAL_STATUS_FAILED]: 'FAILED',
	[ProposalStatus.UNRECOGNIZED]: '(unrecognized option)',
};

function embed_proposal(g_proposal: ProposalTuple, g_chain: ChainStruct, a_fields: FieldConfig[]=[]) {
	// proposal type
	a_fields.push(kv('Type', g_proposal.type.replace(/^[^/]+\/|Proposal$/g, '')));

	// ref value
	const g_value = g_proposal.value;

	// push basic fields
	a_fields.push(kv('Title', g_value.title));

	// create a sandboxed iframe to render the proposal markdown as html with the help of the showdown library
	const dm_iframe = dd('iframe', {
		style: `
			background-color: rgba(0,0,0,0.6);
			border: 1px solid var(--theme-color-border);
			border-radius: 4px;
			padding: 4px;
			margin-top: 4px;
			width: 100%;
		`,
		sandbox: 'allow-scripts',
		srcdoc: `
			<!doctype html>
			<html>
			<head>
				<script src="/embed/showdown.min.js"></script>
				<script id="content" type="application/json">${JSON.stringify(g_value.description)}</script>
				<script src="/embed/render-markdown.js"></script>
				<link rel="stylesheet" href="/embed/markdown.css">
			</head>
			<body>
				<pre>${new Option(g_value.description).innerHTML}</pre>
			</body>
			</html>
		`,
	});

	a_fields.push({
		type: 'key_value',
		key: 'Description',
		long: true,
		value: dm_iframe,
	});

	switch(g_proposal.type) {
		case 'cosmos-sdk/TextProposal': {
			break;
		}

		case 'cosmos-sdk/CommunityPoolSpendProposal': {
			const {
				recipient: sa_recipient,
				amount: a_spends,
			} = g_value as CommunityPoolSpendProposal;

			// recipient
			a_fields.push({
				type: 'contacts',
				bech32s: [sa_recipient as Bech32],
				label: 'Recipient',
				g_chain,
			});

			// amount
			add_coins({
				g_chain,
				coins: a_spends,
			}, a_fields);
			break;
		}

		case 'cosmos-sdk/ParameterChangeProposal': {
			const {
				changes: a_changes,
			} = g_value as ParameterChangeProposal;

			for(let i_change=0, nl_changes=a_changes.length; i_change<nl_changes; i_change++) {
				const {
					key: si_key,
					subspace: si_subspace,
					value: s_value,
				} = a_changes[i_change];

				let w_value: JsonValue = s_value;
				try {
					w_value = JSON.parse(s_value);
				}
				catch(e_parse) {}

				a_fields.push(kv('Parameter', `${si_subspace}.${si_key}`));

				// current value
				a_fields.push(JsonPreviewer.render((async() => {
					const k_network = yw_network.get();

					const g_param = await k_network.networkParam({
						subspace: si_subspace,
						key: si_key,
					});

					if(!g_param) return null;

					let z_value = g_param.value;
					try {
						z_value = JSON.parse(z_value);
					}
					catch(e_parse) {}

					return z_value;
				})(), {
					chain: g_chain,
				}, {
					title: 'Current Value',
				}));

				a_fields.push(JsonPreviewer.render(w_value, {
					chain: g_chain,
				}, {
					title: 'Proposed Value',
				}));
			}

			break;
		}

		default: {
			const g_others = {...g_value} as Dict<JsonValue>;
			delete g_others.title;
			delete g_others.description;
			a_fields.push(JsonPreviewer.render(g_others, {
				chain: g_chain,
			}, {
				title: 'Arguments',
			}));

			break;
		}
	}
}

function add_weighted_votes(a_options: WeightedVoteOption[], g_chain: ChainStruct, a_fields: FieldConfig[]=[]) {
	for(let i_option=0, nl_options=a_options.length; i_option<nl_options; i_option++) {
		const {
			option: xc_vote,
			weight: s_weight,
		} = a_options[i_option];

		let x_weight = Number.parseFloat(s_weight);

		// invalid weight
		if(Number.isNaN(x_weight)) {
			x_weight = 0;
		}

		const x_weight_pct = x_weight * 100;

		a_fields.push({
			type: 'group',
			fields: [
				kv(`Vote #${i_option}`, H_VOTE_OPTIONS[xc_vote]),
				kv(`└─ Weight`, dd('span', {
					style: `
						min-width: 4ch;
					`,
				}, [
					`${format_amount(x_weight_pct)} %`,
				]), dd('div', {
					style: `
						flex: auto;
						align-self: center;
						margin-left: 1em;
						background-color: var(--theme-color-border);
						height: 2ex;
					`,
				}, [
					dd('div', {
						style: `
							height: 100%;
							width: ${x_weight_pct}%;
							background-color: var(--theme-color-primary);
						`,
					}, ['\xa0']),
				])),
			],
		});
	}
}

export const GovMessages: MessageDict = {
	'cosmos-sdk/MsgSubmitProposal'(g_msg, {g_chain}) {
		const {
			proposer: sa_owner,
			initial_deposit: a_coins,
			content: g_proposal,
		} = g_msg as unknown as {
			proposer: Bech32;
			initial_deposit: Coin[];
			content: ProposalTuple;
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [];

				embed_proposal(g_proposal, g_chain, a_fields);

				add_coins({
					g_chain,
					coins: a_coins,
					label: 'Initial Deposit',
				}, a_fields);

				return {
					title: 'Submit Governance Proposal',
					tooltip: `Puts a new proposal on chain so that the community can vote on it. The initial deposit will only be returned if the proposal passes.`,
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgVote'(g_msg, {g_chain}) {
		const {
			voter: sa_owner,
			proposal_id: si_proposal,
			option: xc_vote,
			options: a_options,
		} = g_msg as unknown as {
			voter: Bech32;
			proposal_id: `${bigint}`;
			option?: VoteOption;
			options?: WeightedVoteOption[];
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					kv('Proposal ID', `#${si_proposal}`),
				];

				if('number' === typeof xc_vote && VoteOption.VOTE_OPTION_UNSPECIFIED !== xc_vote) {
					a_fields.push(kv('Vote', H_VOTE_OPTIONS[xc_vote]));
				}
				else {
					add_weighted_votes(a_options || [], g_chain, a_fields);
				}

				a_fields.push((async() => {
					const k_network = yw_network.get();

					const g_proposal = await k_network.proposal(si_proposal);

					let a_subfields: FieldConfig[] = [];
					if(g_proposal) {
						const g_content_proto = g_proposal.content!;

						const g_content = proto_to_amino<ProposalTuple>(g_content_proto, g_chain.bech32s.acc);

						a_subfields = [
							kv('Status', H_PROPOSAL_STATUSES[g_proposal.status]),
						];

						embed_proposal(g_content, g_chain, a_subfields);
					}

					return {
						type: 'group',
						fields: a_subfields,
						expanded: true,
					};
				})());

				return {
					title: 'Vote on Proposal',
					tooltip: 'Casts your vote on the specified proposal.',
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgVoteWeighted'(g_msg, {g_chain}) {
		const {
			voter: sa_owner,
			proposal_id: si_proposal,
			options: a_options,
		} = g_msg as unknown as {
			voter: Bech32;
			proposal_id: `${bigint}`;
			options: WeightedVoteOption[];
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					kv('Proposal ID', `#${si_proposal}`),
				];

				add_weighted_votes(a_options, g_chain, a_fields);

				return {
					title: 'Weighted Vote',
					tooltip: 'Votes on the given proposal by spreading your total voting power among multiple options.',
					fields: a_fields,
				};
			},
		};
	},

	'cosmos-sdk/MsgDeposit'(g_msg, {g_chain}) {
		const {
			depositor: sa_owner,
			proposal_id: si_proposal,
			amount: a_coins,
		} = g_msg as unknown as {
			depositor: Bech32;
			proposal_id: `${bigint}`;
			amount: Coin[];
		};

		return {
			describe() {
				const a_fields: FieldConfig[] = [
					kv('Proposal ID', `#${si_proposal}`),
				];

				add_coins({
					g_chain,
					coins: a_coins,
				}, a_fields);

				return {
					title: 'Deposit to Proposal',
					tooltip: 'Deposits funds to an existing proposal.',
					fields: a_fields,
				};
			},
		};
	},
};
