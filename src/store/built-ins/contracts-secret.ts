import type {Dict} from '#/meta/belt';
import type {Bech32, CoinInfo, ContractStruct} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';

import type {TokenStructDescriptor} from '#/meta/token';

import {G_BRANDS, type Brand} from './brands';

import {fodemtv, fold, ode, oderac, oderaf, oderom} from '#/util/belt';
import {buffer_to_hex, sha256_sync_insecure, text_to_buffer} from '#/util/data';



type Snip20Descriptor = TokenStructDescriptor<'snip20'>['snip20'];

const G_CONTRACT_COMMON = {
	on: 0,
	origin: 'built-in',
} as const;

const G_CONTRACT_SECRET_4_COMMON = {
	...G_CONTRACT_COMMON,
	chain: '/family.cosmos/chain.secret-4',
} as const;


type CodeConfig = (g_snip20: NonNullable<Snip20Descriptor>) => Pick<ContractStruct, 'interfaces'>;

type CodeDef = (g_snip20: NonNullable<Snip20Descriptor>) => Pick<ContractStruct, 'on' | 'origin' | 'chain' | 'hash' | 'interfaces'>;


const G_SECRET_4_CODE: Dict<CodeDef> = fold([
	{
		name: 'SNIP-20',
		ids: {
			5: 'AF74387E276BE8874F07BEC3A87023EE49B0E7EBE08178C49D0A49C3C98ED60E',
			10: '2DA545EBC441BE05C9FA6338F3353F35AC02EC4B02454BC49B1A66F4B9866AED',
			44: 'C1DC8261059FEE1DE9F1873CD1359CCD7A6BC5623772661FA3D55332EB652084',
		},
		struct: gc_token => ({
			interfaces: {
				excluded: ['snip21', 'snip22', 'snip23', 'snip24', 'snip25'],
				snip20: gc_token,
			},
		}),
	},
	{
		name: 'SNIP-21',
		ids: {
			61: 'D0DB7128B8697419AD915C9FA2C2B2DA462634AB95CBB3CA187564A1275561CF',
			69: 'F8B27343FF08290827560A1BA358EECE600C9EA7F403B02684AD87AE7AF0F288',
			89: '667A3DBEC9096DE530A5521A83E6090DF0956475BD4ACC8D05F382D4F8FFDD05',
		},
		struct: gc_token => ({
			interfaces: {
				excluded: ['snip24', 'snip25'],
				snip20: gc_token,
				snip21: {},
			},
		}),
	},
	{
		name: 'SNIP-22',
		ids: {
			177: 'AD91060456344FC8D8E93C0600A3957B8158605C044B3BEF7048510B3157B807',
		},
		struct: gc_token => ({
			interfaces: {
				excluded: ['snip25'],
				snip20: gc_token,
				snip21: {},
				snip22: {},
			},
		}),
	},
	{
		name: 'SNIP-24',
		ids: {
			239: '182D7230C396FA8F548220FF88C34CB0291A00046DF9FF2686E407C3B55692E9',
			313: 'D4F32C1BCA133F15F69D557BD0722DA10F45E31E5475A12900CA1E62E63E8F76',
			372: 'FA824C4504F21FC59250DA0CDF549DD392FD862BAF2689D246A07B9E941F04A9',
			424: '91809B72CC6A7B4A62170698630B0B0848334F0403DBA1ABA7AEC94396AF7F95',
			432: 'F6BE719B3C6FEB498D3554CA0398EB6B7E7DB262ACB33F84A8F12106DA6BBB09',
			563: '5A085BD8ED89DE92B35134DDD12505A602C7759EA25FB5C089BA03C8535B3042',
		},
		struct: gc_token => ({
			interfaces: {
				excluded: ['snip25'],
				snip20: gc_token,
				snip21: {},
				snip22: {},
				snip23: {},
				snip24: {},
			},
		}),
	},
	{
		name: 'SNIP-25',
		ids: {
			877: '638A3E1D50175FBCB8373CF801565283E3EB23D88A9B7B7F99FCC5EB1E6B561E',
		},
		struct: gc_token => ({
			interfaces: {
				excluded: [],
				snip20: gc_token,
				snip21: {},
				snip22: {},
				snip23: {},
				snip24: {},
				snip25: {},
			},
		}),
	},
	{
		name: 'Shadeswap Pair',
		ids: {
			914: 'E88165353D5D7E7847F2C84134C3F7871B2EEE684FFAC9FCF8D99A4DA39DC2F2',
		},
	},
] as {
	name?: string;
	ids: Record<number, string>;
	struct: CodeConfig;
}[], g_category => oderom(g_category.ids, (i_code, si_hash) => ({
	[i_code]: (gc_token: NonNullable<Snip20Descriptor>) => ({
		...G_CONTRACT_SECRET_4_COMMON,
		codeId: i_code,
		hash: si_hash,
		...g_category.struct(gc_token),
	}),
})));

const sha256_hex = (s_in: string) => buffer_to_hex(sha256_sync_insecure(text_to_buffer(s_in))).toUpperCase();

const migration_target_for = (g_brand: Brand): string => {
	let sa_migrate = '';

	for(const [i_code, h_modes] of ode(H_TOKENS_SECRET_4).sort(([si_a], [si_b]) => +si_b - +si_a)) {
		for(const [sa_token, g_brand_other] of ode(h_modes.ibc || {})) {
			if(g_brand_other === g_brand) {
				sa_migrate = sa_token;
				break;
			}
		}
	}

	return sa_migrate;
};

const send_migrate = (h_tokens: Dict<Brand>, sa_recipient: Bech32): Dict<Brand> => {
	const h_out = {};

	for(const [sa_token, g_brand] of ode(h_tokens)) {
		const sa_migrate = migration_target_for(g_brand);
		if(!sa_migrate) {
			console.error(`No token migration path found for ${g_brand.name}`);
			h_out[sa_token] = g_brand;
			continue;
		}

		const g_merge = {
			...g_brand,
			migrate: {
				via: 'send',
				recipient: sa_recipient,
				expect: sa_migrate,
			},
		};

		console.log(`Migrate send ${g_brand.name} ${g_merge.migrate.recipient} => ${g_merge.migrate.expect}`);

		h_out[sa_token] = g_merge;
	}

	return h_out;
};

const ibc_path = (g_ibc: NonNullable<Brand['ibc']>) => `ibc/${sha256_hex(`transfer/channel-${g_ibc.channels['secret-4'].split(':')[1]}/${g_ibc.denom}`)}`;

const ibc_migrate = (g_brand: Brand, g_mixin: Partial<Brand>) => {
	const g_ibc = g_brand.ibc;
	if(!g_ibc) {
		// console.error(`No IBC data defined for ${g_brand.name}`);
		return g_mixin;
	}

	const sa_migrate = migration_target_for(g_brand);
	if(!sa_migrate) {
		console.error(`No token migration path found for ${g_brand.name}`);
		return g_mixin;
	}

	const g_merge = {
		...g_mixin,
		migrate: {
			via: 'ibc',
			asset: ibc_path(g_ibc),
			expect: sa_migrate,
		},
	};

	// console.log(`Migrate IBC ${g_brand.name} ${g_merge.migrate.asset} => ${sa_migrate}`);

	return g_merge;
};

const H_ORIGINS: Dict<(g_brand: Brand) => Partial<Brand>> = {
	native: g => g,
	ibc: g => ({
		name: `${g.name}`,
		symbol: `s${g.symbol}`,
	}),
	ibc_old: g => ibc_migrate(g, {
		name: `${g.name} (old)`,
		symbol: `s${g.symbol}`,
		filter: 'ibc-old',
	}),
	staked: g => ({
		name: g.name,
		symbol: g.symbol,
		filter: 'staked',
	}),
	// vesting: g => ({
	// 	name: `Vesting ${g.name}`,
	// 	symbol: `v${g.symbol}`,
	// 	filter: 'vesting',
	// }),

	axelar: g => g === G_BRANDS.Axelar? g: {
		name: `${g.name} (AXL)`,
		symbol: `sa${g.symbol}`,
		filter: 'axelar',
	},
	bsc: g => ({
		name: `${g.name} (BSC)`,
		symbol: `s${g.symbol}(BSC)`,
		filter: 'binance-smart-chain',
	}),
	eth: g => g === G_BRANDS.Ethereum? g: {
		name: `${g.name} (ETH)`,
		symbol: `s${g.symbol}(ETH)`,
		filter: 'ethereum',
	},
	pstake: g => g === G_BRANDS.pStake_Finance? g: {
		name: `Staked ${g.name} (pSTAKE)`,
		symbol: `sstk${g.symbol}`,
		filter: 'pstake',
	},
	quicksilver: g => g === G_BRANDS.Quicksilver? g: {
		name: `Staked ${g.name} (QCK)`,
		symbol: `sq${g.symbol}`,
		filter: 'quicksilver',
	},
	stride: g => g === G_BRANDS.Stride? g: {
		name: `Staked ${g.name} (STRD)`,
		symbol: `sst${g.symbol}`,
		filter: 'stride',
	},
};

type ConciseContractDefs = Record<Bech32, Brand>;

type ProvenantCodeContractSource = Record<keyof typeof G_SECRET_4_CODE, {
	native?: Dict<Brand>;
	ibc?: Dict<Brand>;
	ibc_old?: Dict<Brand>;
	staked?: Dict<Brand>;
	vesting?: Dict<Brand>;

	axelar?: Dict<Brand>;
	bsc?: Dict<Brand>;
	eth?: Dict<Brand>;
	pstake?: Dict<Brand>;
	quicksilver?: Dict<Brand>;
	stride?: Dict<Brand>;
}>;


const H_TOKENS_SECRET_4: ProvenantCodeContractSource = {
	5: {
		native: {
			secret1k0jntykt7e4g3y88ltc60czgjuqdy4c9e8fzek: G_BRANDS.SecretSecret,
		},
	},

	10: {
		eth: {
			secret1yxwnyk8htvvq25x2z87yj0r5tqpev452fk6h5h: G_BRANDS.Aave,
			secret1p4zvqgxggrrk435nj94p6la2g4xd0rwssgzpsr: G_BRANDS.Band,
			secret1xcrf2vvxcz8dhtgzgsd0zmzlf9g320ea2rhdjw: G_BRANDS.Chainlink,
			secret1vnjck36ld45apf8u4fedxd5zy7f5l92y3w5qwq: G_BRANDS.Dai,
			secret178t2cp33hrtlthphmt9lpd25qet349mg4kcega: G_BRANDS.Decentraland,
			secret1wuzzjsdhthpvuyeeyhfq2ftsn3mvwf9rxy6ykw: G_BRANDS.Ethereum,
			secret12sjaw9wutn39cc5wqxfmkypm4n7tcerwfpvmps: G_BRANDS.Ocean_Protocol,
			secret1vcm525c3gd9g5ggfqg7d20xcjnmcc8shh902un: G_BRANDS.ReserveRights,
			secret18wpjn83dayu4meu6wnn29khfkwdxs7kyrz9c8f: G_BRANDS.Tether,
			secret1el5uj9ns9sty682dem033pt50xsv5mklmsvy24: G_BRANDS.THORChain,
			secret1ds8850j99cf5h3hygy25f0zzs6r6s7vsgfs8te: G_BRANDS.Uniswap,
			secret1h6z05y90gwm4sqxzhz4pkyp36cna9xtp7q0urv: {
				...G_BRANDS.USD_Coin,
				decimals: 6,
			},
			secret1g7jfnxmxkjgqdts9wlmn238mrzxz5r92zwqv4a: G_BRANDS.Wrapped_BTC,
			secret15grq8y54tvc24j8hf8chunsdcr84fd3d30fvqv: G_BRANDS.Yearn_Finance,
		},
	},

	44: {
		native: {
			secret1rgm2m5t530tdzyd99775n6vzumxa5luxcllml4: G_BRANDS.Sienna,
		},
	},

	61: {
		bsc: {
			secret1tact8rxxrvynk4pwukydnle4l0pdmj0sq9j9d5: G_BRANDS.Binance_Coin,
			secret1793ctg56epnzjlv7t7mug2tv3s2zylhqssyjwe: G_BRANDS.Binance_USD,
			secret1t6228qgqgkwhnsegk84ahljgw2cj7f9xprk9zd: G_BRANDS.Cardano,
			secret16nqax7x66z4efpu3y0kssdfnhg93va0h20yjre: G_BRANDS.Dogecoin,
			secret1m6a72200733a7jnm76xrznh9cpmt4kf5ql0a6t: G_BRANDS.Ethereum,
			secret1px5mtmjh072znpez4fjpmxqsv3hpevdpyu9l4v: G_BRANDS.Polkadot,
			secret1c7apt5mmv9ma5dpa9tmwjunhhke9de2206ufyp: G_BRANDS.Secret,
			secret16euwqyntvsp0fp2rstmggw77w5xgz2z26cpwxj: G_BRANDS.Tether,
			secret1mhwawf2yu7erjgmya6mqy0apl08a5f2xz568qg: G_BRANDS.TerraClassicUSD,
			secret1kf45vm4mg5004pgajuplcmkrzvsyp2qtvlklyg: G_BRANDS.USD_Coin,
		},
	},

	69: {
		native: {
			secret1yxcexylwyxlq58umhgsjgstgcg2a0ytfy4d9lt: G_BRANDS.Button,
		},
	},

	89: {
		native: {
			secret19ungtd2c7srftqdwgq0dspwvrw63dhu79qxv88: G_BRANDS.Monero,
		},
	},

	177: {
		ibc_old: {
			secret14mzwd0ps5q277l20ly2q3aetqe3ev4m4260gf4: G_BRANDS.Cosmos_Hub,
			secret1ra7avvjh9fhr7dtr3djutugwj59ptctsrakyyw: G_BRANDS.TerraClassic,
			secret1zwwealwm0pcl9cul4nt6f38dsy6vzplw8lp3qg: G_BRANDS.Osmosis,
			secret129h4vu66y3gry6wzwa24rw0vtqjyn8tujuwtn9: G_BRANDS.TerraClassicUSD,
			secret1k8cge73c3nh32d4u0dsd5dgtmk63shtlrfscj5: G_BRANDS.Sentinel,
			secret1smmc5k24lcn4j2j8f3w0yaeafga6wmzl0qct03: G_BRANDS.Juno,
		},
	},

	239: {
		ibc: {
			secret1ntvxnf5hzhzv8g87wn76ch6yswdujqlgmjh32w: G_BRANDS.Chihuahua,
		},
		ibc_old: {
			// secret15rj2zz27lfdwuyu97mvykhzuhvlv0sruneu88y: G_BRANDS.Graviton,
			// secret19zg77j3466yy53xd2gqd0nt8xmk8n30g5nj6hr: G_BRANDS.Stargaze,
		},
	},

	313: {
		native: {
			secret12rcvz0umvk875kd6a803txhtlu7y0pnd73kcej: G_BRANDS.Alter,
		},
	},

	372: {
		native: {
			secret1qfql357amn448duf5gvp9gr48sxx9tsnhupu3d: G_BRANDS.Shade,
		},
	},

	424: {
		staked: {
			secret16zfat8th6hvzhesj8f6rz3vzd7ll69ys580p2t: G_BRANDS.Staked_Secret_StakeEasy,
		},
	},

	432: {
		staked: {
			secret1k6u0cy4feepm6pehnz804zmwakuwdapm69tuc4: G_BRANDS.Staked_Secret_Shade,
		},
	},

	563: {
		native: {
			secret1s09x2xvfd2lp2skgzm29w2xtena7s8fq98v852: G_BRANDS.Amber,
		},
		ibc: {
			secret168j5f78magfce5r2j4etaytyuy7ftjkh4cndqw: G_BRANDS.Akash,
			secret1tatdlkyznf00m3a7hftw5daaq2nk38ugfphuyr: G_BRANDS.Crescent,
			secret1grg9unv2ue8cf98t50ea45prce7gcrj2n232kq: G_BRANDS.Evmos,
			secret1dtghxvrx35nznt8es3fwxrv4qh56tvxv22z79d: G_BRANDS.Gravity_Bridge,
			secret1x0dqckf2khtxyrjwhlkrx9lwwmz44k24vcv2vv: G_BRANDS.Stargaze,
		},
		ibc_old: {
			secret1rw2l7z22s3ed6dl5v70ktvnckhurldy23a3a58: G_BRANDS.Agoric,
			secret16cwf53um7hgdvepfp3jwdzvwkt5qe2f9vfkuwv: G_BRANDS.Injective,
			secret1kjqktuq2wq6mk7l0ecvk2cwcskjmv3ghpklctn: G_BRANDS.InterStable_Token,
			secret1gaew7k9tv4hlx2f4wq4ta4utggj4ywpkjysqe8: G_BRANDS.Kujira,
			secret1w8d0ntrhrys4yzcfxnwprts7gfg5gfw86ccdpf: G_BRANDS.Terra,
			secret17gg8xcx04ldqkvkrd7r9w60rdae4ck8aslt9cf: G_BRANDS.Stride,
		},
	},

	877: {
		ibc: {
			secret1uxvpq889uxjcpj656yjjexsqa3zqm6ntkyjsjq: G_BRANDS.Agoric,
			secret1vcau4rkn7mvfwl8hf0dqa9p0jr59983e3qqe3z: G_BRANDS.Axelar,
			secret1mndng80tqppllk0qclgcnvccf9urak08e9w2fl: G_BRANDS.Comdex,
			secret14l7s0evqw7grxjlesn8yyuk5lexuvkwgpfdxr5: G_BRANDS.Composite,
			secret19e75l25r6sa6nhdf4lggjmgpw0vmpfvsw5cnpe: G_BRANDS.Cosmos_Hub,
			// secret1lrlkqhmwkh5y4326akn3hwn6j69f8l5656m43e: G_BRANDS.Harbor,
			secret1nw83wzlceflrecd03ydjru3tcr2y345x7aetjp: G_BRANDS.Harbor,
			secret14706vxakdzkz9a36872cs62vpl5qd84kpwvpew: G_BRANDS.Injective,
			secret1xmqsk8tnge0atzy4e079h0l2wrgz6splcq0a24: G_BRANDS.InterStable_Token,
			secret1sgaz455pmtgld6dequqayrdseq8vy2fc48n8y3: G_BRANDS.Jackal,
			secret1z6e4skg5g9w65u5sqznrmagu05xq8u6zjcdg4a: G_BRANDS.Juno,
			secret13hvh0rn0rcf5zr486yxlrucvwpzwqu2dsz6zu8: G_BRANDS.Kujira,
			secret1qegmsk933ejfsqd0ztf0dw775g5tl8yvnd27dd: G_BRANDS.TerraClassic,
			secret149e7c5j7w24pljg6em6zj2p557fuyhg8cnk7z8: G_BRANDS.Terra,
			secret150jec8mc2hzyyqak4umv6cfevelr0x9p0mjxgg: G_BRANDS.Osmosis,
			secret17d8c96kezszpda3r2c5dtkzlkfxw6mtu7q98ka: G_BRANDS.Quicksilver,
			secret1gnrrqjj5e2pwn4g262xjyypptu0ge3z3tps3nn: G_BRANDS.Persistence,
			secret1umeg3u5y949vz6jkgq0n4rhefsr84ws3duxmnz: G_BRANDS.pStake_Finance,
			secret15qtw24mpmwkjessr46dnqruq4s4tstzf74jtkf: G_BRANDS.Sentinel,
			secret1rfhgs3ryqt7makakr2qw9zsqq4h5wdqawfa2aa: G_BRANDS.Stride,
			secret1cj2fvj4ap79fl9euz8kqn0k5xlvck0pw9z9xhr: G_BRANDS.USK,
		},
		native: {
			secret153wu605vvp934xhd4k9dtd640zsep5jkesstdm: G_BRANDS.Shade,
			secret1fl449muk5yq8dlad7a22nje4p5d2pnsgymhjfd: G_BRANDS.Silk,
			secret1dtdgpn0v8vzt2zz2an0anawxj26llne3ugl9ek: G_BRANDS.Vesting_Secret,
		},
		// vesting: {
		// },
		axelar: {
			secret1t642ayn9rhl5q9vuh4n2jkx0gpa9r6c3sl96te: G_BRANDS.Binance_USD,
			secret1c2prkwd8e6ratk42l4vrnwz34knfju6hmp7mg7: G_BRANDS.Dai,
			secret16e230j6qm5u5q30pcc6qv726ae30ak6lzq0zvf: G_BRANDS.Frax,
			secret1wk5j2cntwg2fgklf0uta3tlkvt87alfj7kepuw: G_BRANDS.Tether,
			secret1egqlkasa6xe6efmfp9562sfj07lq44z7jngu5k: G_BRANDS.Uniswap,
			secret1vkq022x4q8t8kx9de3r84u669l65xnwf2lg3e6: {
				...G_BRANDS.USD_Coin,
				decimals: 6,
			},
			secret19xsac2kstky8nhgvvz257uszt44g0cu6ycd5e4: G_BRANDS.Wrapped_BNB,
			secret1guyayjwg5f84daaxl7w84skd8naxvq8vz9upqx: G_BRANDS.Wrapped_BTC,
			secret139qfh3nmuzfgwsx2npnmnjl4hrvj3xq5rmq8a0: G_BRANDS.Wrapped_ETH,
		},
		pstake: {
			secret16vjfe24un4z7d3sp9vd0cmmfmz397nh2njpw3e: G_BRANDS.Cosmos_Hub,
		},
		quicksilver: {
			secret120cyurq25uvhkc7qjx7t28deuqslprxkc4rrzc: G_BRANDS.Cosmos_Hub,
		},
		stride: {
			secret155w9uxruypsltvqfygh5urghd5v0zc6f9g69sq: G_BRANDS.Cosmos_Hub,
			secret1eurddal3m0tphtapad9awgzcuxwz8ptrdx7h4n: G_BRANDS.Injective,
			secret1097nagcaavlkchl87xkqptww2qkwuvhdnsqs2v: G_BRANDS.Juno,
			secret1xcvjv4se4y353z70t3lln8tqea4u6sxde0da90: G_BRANDS.TerraClassic,
			secret1rkgvpck36v2splc203sswdr0fxhyjcng7099a9: G_BRANDS.Terra,
			secret1jrp6z8v679yaq65rndsr970mhaxzgfkymvc58g: G_BRANDS.Osmosis,
		},
	},
};

export const F_CONTRACTS_SECRET_GEN2 = (H_LOOKUP_PFP: Dict<PfpTarget>): ContractStruct[] => oderaf(H_TOKENS_SECRET_4, (si_code, g_modes) => {
	const a_out: ContractStruct[] = [];

	for(const [si_origin, h_tokens] of ode(g_modes)) {
		const f_origin = H_ORIGINS[si_origin];

		for(const [sa_bech32, g_brand] of ode(h_tokens!)) {
			const g_input = {
				...g_brand,
				...f_origin(g_brand),
			};

			const g_contract = {
				name: g_input.name,
				bech32: sa_bech32 as Bech32,
				pfp: H_LOOKUP_PFP[`/media/token/${g_input.pfp}`],
				...G_SECRET_4_CODE[si_code]({
					decimals: g_input.decimals as Snip20Descriptor['decimals'],
					symbol: g_input.symbol,
					extra: {
						coingeckoId: g_input.coingeckoId,
						...g_input['migrate']? {
							migrate: g_input['migrate'],
						}: {},
					},
				}),
			};

			// send migration
			if('secret1qfql357amn448duf5gvp9gr48sxx9tsnhupu3d' === sa_bech32) {
				g_contract.name += ' (old)';
				g_contract.interfaces.snip20!.extra!.migrate = {
					via: 'send',
					recipient: 'secret1eaak0nqf5lshzdwy2f7hcsl5l3ct56agu2u7hg',
					expect: 'secret153wu605vvp934xhd4k9dtd640zsep5jkesstdm',
				};
			}

			a_out.push(g_contract);
		}
	}

	return a_out;
});

export const F_IBC_SECRET_GEN = (H_LOOKUP_PFP: Dict<PfpTarget>): Dict<CoinInfo> => {
	const h_out: Dict<CoinInfo> = {};

	FINDING_IBC_COINS:
	for(const [, g_brand] of ode(G_BRANDS)) {
		if(!g_brand.ibc) continue;
		const si_ibc = ibc_path(g_brand.ibc);

		for(const [i_code, h_modes] of ode(H_TOKENS_SECRET_4).sort(([si_a], [si_b]) => +si_b - +si_a)) {
			for(const [sa_token, g_brand_other] of ode(h_modes.ibc || {})) {
				if(g_brand_other === g_brand) {
					h_out[g_brand.symbol] = {
						decimals: g_brand.decimals,
						denom: si_ibc,
						name: g_brand.name,
						pfp: H_LOOKUP_PFP[`/media/token/${g_brand.pfp}`],
						extra: {
							coingeckoId: g_brand.coingeckoId,
							nativeBech32: sa_token as Bech32,
						},
					};

					continue FINDING_IBC_COINS;
				}
			}
		}
	}

	return h_out;
};
