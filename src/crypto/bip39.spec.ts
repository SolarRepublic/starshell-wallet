import {readFileSync} from 'fs';
import {join} from 'path';

import {describe, it, expect, vi} from 'vitest';
import createFetchMock from 'vitest-fetch-mock';

import {Bip32} from './bip32';
import {Bip39} from './bip39';
import SensitiveBytes from './sensitive-bytes';

import H_VECTORS from '../../submodules/trezor-python-mnemonic/vectors.json';

import {buffer_to_hex, buffer_to_text, concat, hex_to_buffer, text_to_buffer} from '#/util/data';

const A_ENGLISH_VECTORS = H_VECTORS.english as [string, string, string, string][];

const fetch_mock = createFetchMock(vi);
fetch_mock.enableMocks();
fetch_mock.mockResponse((d_req) => {
	const p_url = d_req.url;

	return {
		body: readFileSync(join(process.env.PWD!, 'public', p_url)),
	};
});

vi.stubGlobal('navigator', {
	locks: {
		request(si_name: string, ...a_args: [unknown, VoidFunction] | [VoidFunction]) {
			if(a_args.length > 1) a_args.shift();
			(a_args[0] as VoidFunction)();
		},
	},
});

/**
 * This file uses test vectors from Trezor to effectively test the following adjacent files:
 *  - bip32.ts
 *  - bip39.ts
 *  - runtime-key.ts
 *  - sensitive-bytes.ts
 */
describe('BIP-39', () => {
	it('defined', () => {
		expect(Bip39).to.be.an('object');
	});

	it('converts entropy', async() => {
		const atu16_indicies = await Bip39.entropyToIndicies(SensitiveBytes.random(32));
		expect(atu16_indicies)
			.to.be.an.instanceOf(Uint16Array)
			.and.to.have.lengthOf(24);
	});

	let i_vector = 0;
	for(const a_vector of A_ENGLISH_VECTORS) {
		i_vector += 1;

		const [sxb16_entropy, s_mnemonic_expect, sxb16_seed_expect, sxb58_sk_expect] = a_vector;
		const atu8_entropy = hex_to_buffer(sxb16_entropy);

		// // skip non-256-bit entropy vectors
		// if(atu8_entropy.byteLength !== 32) continue;

		it(`Trezor english test vector #${i_vector}`, async() => {
			const kn_mnemonic = await Bip39.entropyToPaddedMnemonic(new SensitiveBytes(concat([atu8_entropy])));
			const nl_words_expect = s_mnemonic_expect.split(/\s+/g).length;

			const atu8_trimmed = Bip39.trimPaddedMnemonic(kn_mnemonic, nl_words_expect).data;
			const sx_mnemonic_actual = buffer_to_text(atu8_trimmed);

			// mnemonic
			expect(sx_mnemonic_actual).to.equal(s_mnemonic_expect);

			// seed
			const kr_seed = await Bip39.mnemonicToSeed(() => atu8_trimmed, () => text_to_buffer('TREZOR'));
			await kr_seed.access(atu8_seed => expect(buffer_to_hex(atu8_seed)).to.equal(sxb16_seed_expect));

			// mnemonic => entropy
			const kr_entropy_round = await Bip39.mnemonicToEntropy(() => text_to_buffer(sx_mnemonic_actual), nl_words_expect);
			await kr_entropy_round.access(atu8_entropy_round => expect(buffer_to_hex(atu8_entropy_round)).to.equal(buffer_to_hex(atu8_entropy)));

			// seed => private key
			const k_master = await kr_seed.access(atu8_seed => Bip32.masterKey(() => atu8_seed));
			const sxb58_sk_actual = await k_master.exportBase58();
			expect(sxb58_sk_actual).to.equal(sxb58_sk_expect);
		});
	}
});
