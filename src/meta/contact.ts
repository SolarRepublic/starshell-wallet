import type {Nameable, Pfpable} from './able';
import type {Agent, ChainNamespace, ChainNamespaceKey} from './chain';
import type {Resource} from './resource';

export enum ContactAgentType {
	UNKNOWN = 'unknown',
	PERSON = 'person',
	ROBOT = 'robot',
	CONTRACT = 'contract',
}

/**
 * A contact is an agent that the user has assigned information to
 */
export type ContactSpace = Extract<keyof ChainNamespace.Bech32s, 'acc' | 'valoper' | 'valcons'>;

export type Contact<
	si_family extends ChainNamespaceKey=ChainNamespaceKey,
	sa_contact extends string=string,
	si_space extends ContactSpace=ContactSpace,
> = Resource.New<{
	extends: Agent<si_family, sa_contact, si_space>;
	segment: 'as.contact';
	struct: [{
		/**
		 * distinguishes contact types for intent
		 */
		agentType: ContactAgentType;

		/**
		 * any custom notes associated with this contact
		 */
		notes: string;

	}, Nameable, Pfpable];
}>;

export type ContactPath = Resource.Path<Contact>;
export type ContactStruct = Contact['struct'];
