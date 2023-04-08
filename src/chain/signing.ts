import type {AccountStruct} from '#/meta/account';
import type {JsonValue} from '#/meta/belt';
import type {AdaptedStdSignature, AdaptedStdSignDoc} from '#/schema/amino';

import {encodeSecp256k1Signature, serializeSignDoc} from '@cosmjs/amino';
import {SignDoc} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';

import type {SigningKey} from '#/crypto/secp256k1';
import {Accounts} from '#/store/accounts';
import {is_dict, ode} from '#/util/belt';
import {text_to_buffer} from '#/util/data';


export interface SignedDoc {
	doc: SignDoc;
	signature: Uint8Array;
}

export async function sign_direct_doc(
	g_account: AccountStruct,
	xg_account_number: bigint,
	atu8_auth: Uint8Array,
	atu8_body: Uint8Array,
	si_chain: string
): Promise<SignedDoc> {
	const g_doc = SignDoc.fromPartial({
		accountNumber: xg_account_number+'',
		authInfoBytes: atu8_auth,
		bodyBytes: atu8_body,
		chainId: si_chain,
	});

	// encode signdoc
	const atu8_doc = SignDoc.encode(g_doc).finish();

	// get account's signing key
	const k_key = await Accounts.getSigningKey(g_account);

	// sign document
	return {
		doc: g_doc,
		signature: await k_key.sign(atu8_doc, true),
	};
}

export async function sign_amino(
	g_account: AccountStruct,
	g_amino: AdaptedStdSignDoc,
	f_sign?: SigningKey['sign'] | null
): Promise<AdaptedStdSignature> {
	// get account's signing key
	const k_key = await Accounts.getSigningKey(g_account);

	// serialize amino doc to buffer
	const atu8_amino = serializeSignDoc(g_amino);

	// sign doc as buffer
	const atu8_signature = f_sign? await f_sign(atu8_amino): await k_key.sign(atu8_amino);

	// produce signed doc bytes
	return encodeSecp256k1Signature(k_key.exportPublicKey(), atu8_signature) as AdaptedStdSignature;
}
