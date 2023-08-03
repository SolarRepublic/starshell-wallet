import type {Bech32} from '#/meta/chain';

import TimeAgo from 'javascript-time-ago';
import english_locale from 'javascript-time-ago/locale/en';

import {fold, F_IDENTITY} from './belt';

import type {CoinGeckoFiat} from '#/store/web-apis';

const A_DEFAULT_LOCALES = [navigator.language, 'en-US'];

const D_INTL_USD = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	style: 'currency',
	currency: 'USD',
	currencyDisplay: 'symbol',
});

const D_INTL_USD_LT1 = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	style: 'currency',
	currency: 'USD',
	currencyDisplay: 'symbol',
	minimumFractionDigits: 2,
	maximumFractionDigits: 3,
});

const A_NUMERIC_GT1 = [
	{
		order: 1e21,
		suffix: 'sept',
		metric: 'yotta',
		m: 'Y',
	},
	{
		order: 1e21,
		suffix: 'sext',
		metric: 'zetta',
		m: 'Z',
	},
	{
		order: 1e18,
		suffix: 'quint',
		metric: 'exa',
		m: 'E',
	},
	{
		order: 1e15,
		suffix: 'quad',
		metric: 'peta',
		m: 'P',
	},
	{
		order: 1e12,
		suffix: 'tril',
		metric: 'terra',
		m: 'T',
	},
	{
		order: 1e9,
		suffix: 'bil',
		metric: 'giga',
		m: 'G',
	},
	{
		order: 1e6,
		suffix: 'mil',
		metric: 'mega',
		m: 'M',
	},
];

const A_NUMERIC_LT1 = [
	{
		order: 1e-24,
		suffix: 'septh',
		metric: 'yocto',
		m: 'y',
	},
	{
		order: 1e-21,
		suffix: 'sexth',
		metric: 'zepto',
		m: 'z',
	},
	{
		order: 1e-18,
		suffix: 'quinth',
		metric: 'atto',
		m: 'a',
	},
	{
		order: 1e-15,
		suffix: 'quadth',
		metric: 'femto',
		m: 'f',
	},
	{
		order: 1e-12,
		suffix: 'trilth',
		metric: 'pico',
		m: 'p',
	},
	{
		order: 1e-9,
		suffix: 'bilth',
		metric: 'nano',
		m: 'n',
	},
	{
		order: 1e-6,
		suffix: 'milth',
		metric: 'micro',
		m: 'μ',
	},
	{
		order: 1e-3,
		suffix: 'thsth',
		metric: 'milli',
		m: 'm',
	},
];

const D_INTL_AMOUNT_LT1 = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	notation: 'standard',
	maximumSignificantDigits: 3,
});

const D_INTL_AMOUNT_GT1 = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	notation: 'standard',
	maximumFractionDigits: 3,
});

const D_INTL_AMOUNT_GT1E3 = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	notation: 'standard',
	maximumSignificantDigits: 6,
});

const D_INTL_AMOUNT_I1E3 = new Intl.NumberFormat(A_DEFAULT_LOCALES, {
	notation: 'standard',
	maximumSignificantDigits: 4,
});


export function format_amount(x_amount: number, b_shorter=false): string {
	// shortening
	const shorten = b_shorter? (s: string) => s.replace(/(?:(\.)|(\.\d+?))0+(\s+.*)?$/, '$2$3')
		.replace(/(\.\d)\d+(\s+.*)?$/, '$1$2'): F_IDENTITY;

	// zero
	if(0 === x_amount) return '0';

	// left side of deimcal
	if(x_amount >= 1e6) {
		for(const gc_abbr of A_NUMERIC_GT1) {
			if(x_amount >= gc_abbr.order) {
				return shorten((x_amount / gc_abbr.order).toPrecision(3))+' '+gc_abbr.suffix;
			}
		}
	}
	// right side of decimal
	else if(x_amount < 1) {
		for(const gc_abbr of A_NUMERIC_LT1) {
			if(x_amount <= gc_abbr.order) {
				return shorten((x_amount / gc_abbr.order).toPrecision(3))+' '+gc_abbr.metric;
			}
		}

		// less than 1
		return shorten(D_INTL_AMOUNT_LT1.format(x_amount));
	}

	// between 1k and 1M
	if(x_amount >= 1e3) {
		// make thousands shorter
		if(b_shorter) {
			return shorten(D_INTL_AMOUNT_I1E3.format(x_amount / 1e3))+' k';
		}

		return shorten(D_INTL_AMOUNT_GT1E3.format(x_amount));
	}

	// greater than 1
	return shorten(D_INTL_AMOUNT_GT1.format(x_amount));
}


export function format_fiat(x_amount: number, si_fiat: CoinGeckoFiat='usd', b_omit_sign=false, n_decimals=2): string {
	// very small amounts
	if(x_amount > 0 && x_amount < 0.01) {
		return `< ${b_omit_sign? '': '$'}0.01`;
	}

	const s_formatted = x_amount < 1? D_INTL_USD_LT1.format(x_amount): D_INTL_USD.format(x_amount);

	return b_omit_sign? s_formatted.replace(/^[$]/, ''): s_formatted;
}

// /**
//  * returns the fiat equivalent of the given token amount
//  */
// export function amount_to_fiat(x_amount: number, k_token: Token, b_omit_sign=false): string {
// 	return format_fiat(H_VERSUS_USD[k_token.def.iri].value * x_amount, b_omit_sign);
// }

export enum AbbreviationLevel {
	NONE = 0,
	SOME = 1,
	MOST = 2,
}

export function abbreviate_addr(sa_addr: Bech32, xc_level=AbbreviationLevel.MOST): string {
	switch(xc_level) {
		case AbbreviationLevel.SOME: {
			return sa_addr.replace(/^(\w+1...).+(.{7})/, '$1[…]$2');
		}

		case AbbreviationLevel.MOST: {
			return sa_addr.replace(/^(\w+1...).+(.{5})/, '$1[…]$2');
		}

		case AbbreviationLevel.NONE:
		default: {
			return sa_addr;
		}
	}
}

const D_INTL_DATE = new Intl.DateTimeFormat(A_DEFAULT_LOCALES, {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
});

const timestamp_to_parts = (xt_timestamp=Date.now()) => fold(D_INTL_DATE.formatToParts(xt_timestamp), g_part => ({
	[g_part.type]: g_part.value,
}));

export function format_time(xt_timestamp: number): string {
	const g_then = timestamp_to_parts(xt_timestamp);

	let s_out = `${g_then.month} ${g_then.day}`;

	// occurred in a different year
	const g_now = timestamp_to_parts();
	if(g_now.year !== g_then.year) {
		s_out += `, ${g_then.year}`;
	}

	return `${s_out} at ${g_then.hour}:${g_then.minute} ${g_then.dayPeriod}`;
}

export function format_date_long(xt_timestamp: number): string {
	return new Intl.DateTimeFormat(A_DEFAULT_LOCALES, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hour12: false,
		timeZoneName: 'short',
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	}).format(new Date(xt_timestamp));
}

export function snake_to_camel(s_snake: string): string {
	const a_words = s_snake.split('_');
	return [a_words[0], ...a_words.slice(1).map(s => s[0].toUpperCase()+s.slice(1))].join('');
}

export function camel_to_snake(s_camel: string): string {
	return s_camel.replace(/([a-z0-9])([A-Z]+)/g, (_ignore, s_before, s_cap) => `${s_before}_${s_cap}`).toLowerCase();
	// return camel_to_phrase(s_camel).toLowerCase();
}

export function camel_to_phrase(s_camel: string): string {
	return s_camel.replace(/([a-z0-9])([A-Z]+)/g, (_ignore, s_before, s_cap) => `${s_before} ${s_cap}`)
		.replace(/([A-Z])([A-Z])([a-z0-9])/g, (_ignore, s_before, s_cap, s_after) => `${s_before} ${s_cap}${s_after}`);
}

export function phrase_to_hyphenated(s_phrase: string): string {
	return s_phrase.toLowerCase().split(/\s+/g).join('-');
}


TimeAgo.setDefaultLocale(english_locale.locale);
TimeAgo.addLocale(english_locale);
const y_ago = new TimeAgo(A_DEFAULT_LOCALES);

export function format_time_ago(xt_when: number): string {
	return y_ago.format(xt_when, 'twitter');
}
