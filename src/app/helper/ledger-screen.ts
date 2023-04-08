import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

import type {Dict, JsonObject, JsonValue} from '#/meta/belt';


import {is_dict} from '#/util/belt';
import {canonicalize_json} from '#/util/data';

import {dd} from '#/util/dom';

export interface LedgerScreenConfig {
	height: number;
	width: number;
	paragraph: number;
	lines: number;
	chars: number;
	color: string;
	headerBraces: '()' | '[]';
	headerWeight?: string;
	screenPadTop?: number;
	lineSpacing?: number;
	style?: string;
}

export type DisplayGroup = {
	type: 'msg';
	title: string;
	text: string;
};

interface CharData {
	d_img: HTMLImageElement;
	xl_char: number;
}

const X_DEFAULT_SUBPIXEL_OFFSET = 0;

const H_SUBPIXEL_OFFSETS: Dict<number> = {
	'A': 0.4,
	'B': -0.2,
	'C': -0.4,
	'D': -0.2,
	'K': -0.2,
	'V': -0.4,
	'S': 0.4,
	'T': 0.2,
	'W': 0.4,
	'X': -0.4,
	'Y': 0.15,
	'Z': -0.15,
	'2': -0.4,
	'3': 0.4,
	'5': -0.2,
	'6': 0.2,
	'7': 0.2,
	'8': 0.2,
	'9': 0.2,
	'a': 0.39,
	'd': 0.2,
	'e': 0.2,
	'k': -0.2,
	'v': -0.2,
	'w': 0.2,
	'x': -0.2,
	'y': 0.4,
	'z': 0.2,
	'(': 0.2,
	')': 0.2,
	'[': -0.2,
	']': 0.6,
	'{': -0.4,
	'}': 0.8,
	'*': 0.7,
	'#': 0.2,
	'%': 0.4,
	'+': 0.39,
	'<': 0.4,
	'>': 0.2,
	'|': -0.2,
};

const H_CHAR_WIDTHS_OPEN_SANS_11PX = {
	' ': 3,
	'!': 3,
	'"': 4,
	'#': 7,
	'$': 6,
	'%': 9,
	'&': 8,
	'\'': 2,
	'(': 3,
	')': 3,
	'*': 6,
	'+': 6,
	',': 3,
	'-': 4,
	'.': 3,
	'/': 4,
	'0': 6,
	'1': 6,
	'2': 6,
	'3': 6,
	'4': 6,
	'5': 6,
	'6': 6,
	'7': 6,
	'8': 6,
	'9': 6,
	':': 3,
	';': 3,
	'<': 6,
	'=': 6,
	'>': 6,
	'?': 5,
	'@': 10,
	'A': 7,
	'B': 7,
	'C': 7,
	'D': 8,
	'E': 6,
	'F': 6,
	'G': 8,
	'H': 8,
	'I': 3,
	'J': 3,
	'K': 7,
	'L': 6,
	'M': 10,
	'N': 8,
	'O': 9,
	'P': 7,
	'Q': 9,
	'R': 7,
	'S': 6,
	'T': 6,
	'U': 8,
	'V': 7,
	'W': 10,
	'X': 6,
	'Y': 6,
	'Z': 6,
	'[': 4,
	'\\': 4,
	']': 4,
	'^': 6,
	'_': 5,
	'`': 6,
	'a': 6,
	'b': 7,
	'c': 5,
	'd': 7,
	'e': 6,
	'f': 5,
	'g': 6,
	'h': 7,
	'i': 3,
	'j': 3,
	'k': 6,
	'l': 3,
	'm': 10,
	'n': 7,
	'o': 7,
	'p': 7,
	'q': 7,
	'r': 4,
	's': 5,
	't': 4,
	'u': 7,
	'v': 6,
	'w': 9,
	'x': 6,
	'y': 6,
	'z': 5,
	'{': 4,
	'|': 6,
	'}': 4,
	'~': 6,
};


const H_KEY_SUBS = {
	'chain_id': 'Chain ID',
	'account_number': 'Account',
	'sequence': 'Sequence',

	'memo': 'Memo',
	'msgs/type': 'Type',
	'tip/amount': 'Tip',
	'tip/tipper': 'Tipper',

	'msgs/inputs/address': 'Source Address',
	'msgs/inputs/coins': 'Source Coins',
	'msgs/outputs/address': 'Dest Address',
	'msgs/outputs/coins': 'Dest Coins',
	'msgs/value/from_address': 'From',
	'msgs/value/to_address': 'To',
	'msgs/value/amount': 'Amount',
	'msgs/value/delegator_address': 'Delegator',
	'msgs/value/validator_address': 'Validator',
	'msgs/value/contract': 'Contract',
	'msgs/value/msg': 'Message',
	'msgs/value/sender': 'Sender',
	'msgs/value/sent_funds': 'Sent Funds',
	'msgs/value/permit_name': 'Permit Name',
	'msgs/value/allowed_tokens': 'Allowed Tokens',
	'msgs/value/permissions': 'Permissions',
	'msgs/value/receiver': 'Receiver',
	'msgs/value/token': 'Token',
	'msgs/value/source_port': 'Source Port',
	'msgs/value/source_channel': 'Source Channel',
	'msgs/value/timeout_height': 'Timeout Height',
	'msgs/value/timeout_timestamp': 'Timeout Timestamp',
	'msgs/value/grant': 'Grant',
	'msgs/value/grantee': 'Grantee',
	'msgs/value/granter': 'Granter',
	'msgs/value/data': 'Data',
	'msgs/value/signer': 'Signer,',
	'msgs/value/validator_src_address': 'Validator Source',
	'msgs/value/validator_dst_address': 'Validator Dest',
	'msgs/value/description': 'Description',
	'msgs/value/initial_deposit/amount': 'Deposit Amount',
	'msgs/value/initial_deposit/denom': 'Deposit Denom',
	'msgs/value/proposal_type': 'Proposal',
	'msgs/value/proposer': 'Proposer',
	'msgs/value/title': 'Title',
	'msgs/value/depositer': 'Sender',
	'msgs/value/proposal_id': 'Proposal ID',
	'msgs/value/voter': 'Description',
	'msgs/value/option': 'Option',

	'fee/amount': 'Fee',
	'fee/gas': 'Gas',
	'fee/granter': 'Granter',
	'fee/payer': 'Payer',
};

const H_TYPES = {
	'cosmos-sdk/MsgSend': 'Send',
	'cosmos-sdk/MsgDelegate': 'Delegate',
	'cosmos-sdk/MsgUndelegate': 'Undelegate',
	'cosmos-sdk/MsgBeginRedelegate': 'Redelegate',
	'cosmos-sdk/MsgSubmitProposal': 'Propose',
	'cosmos-sdk/MsgDeposit': 'Deposit',
	'cosmos-sdk/MsgVote': 'Vote',
	'cosmos-sdk/MsgWithdrawDelegationReward': 'Withdraw Reward',
	'cosmos-sdk/MsgWithdrawValidatorCommission': 'Withdraw Val. Commission',
	'cosmos-sdk/MsgTransfer': 'IBC Transfer',
	'cosmos-sdk/MsgGrant': 'Grant Authorization',
	'wasm/MsgExecuteContract': 'Execute Encrypted Wasm Contract',
	'query_permit': 'Query Permit',
	'sign/MsgSignData': 'Sign Data',
};

const H_FORMATTERS = {
	'msgs/type'(w_value: JsonValue) {
		return H_TYPES[w_value as string] || '??';
	},

	'msgs/value/sent_funds'(a_funds: Array<{denom: string; amount: string}>) {
		// if(!a_funds.length) return `Empty`;
		return '---';
	},

	'fee/amount'(a_fees: Coin[]) {
		return a_fees.map(g => g.amount+' '+g.denom).join(' ');
	},
};


async function load_font(s_font: string, s_weight: string, s_family='Ledger') {
	const d_font = new FontFace(s_family, `url("/fonts/${s_font}.ttf")`, {
		style: 'normal',
		weight: s_weight,
	});

	await d_font.load();

	document.fonts.add(d_font);
}


export class LedgerScreen {
	static async init(gc_screen: LedgerScreenConfig): Promise<LedgerScreen> {
		return await new LedgerScreen(gc_screen)._init();
	}

	// origin font size
	protected _xl_font = 11;

	// prescale factor
	protected _xs_pre = 1;

	// scale for user view
	protected _xs_user = 2.5;

	// character canvas
	protected _dm_canvas_char: HTMLCanvasElement;

	protected _d_2d_char: CanvasRenderingContext2D;

	protected _dm_canvas_user: HTMLCanvasElement;
	protected _d_2d_user: CanvasRenderingContext2D;

	protected _h_fonts: Dict<Dict<CharData>> = {};

	protected _xl_screen_width: number;
	protected _xl_screen_height: number;

	protected _xl_paragraph: number;

	protected _nl_lines: number;

	protected _sx_color: string;

	protected _a_groups: DisplayGroup[] = [];
	protected _i_group = 0;
	protected _i_page = 0;

	protected _nc_chars: number;

	protected _hm_pages = new Map<DisplayGroup, string[][]>();

	protected _xl_line_spacing = 0;
	protected _xl_margin_top = 0;

	constructor(protected _gc_screen: LedgerScreenConfig) {
		this._xl_screen_width = _gc_screen.width;
		this._xl_screen_height = _gc_screen.height;
		this._xl_paragraph = _gc_screen.paragraph;
		this._nl_lines = _gc_screen.lines;
		this._sx_color = _gc_screen.color;
		this._nc_chars = _gc_screen.chars;
		this._xl_line_spacing = _gc_screen.lineSpacing || 0;
		this._xl_margin_top = _gc_screen.screenPadTop || 0;
	}

	protected _font(s_weight='400') {
		return `${s_weight} ${this._xl_font}px Ledger`;
	}

	protected _add_char(s_char: string, s_weight='400'): Promise<CharData> {
		const {
			_dm_canvas_char,
			_d_2d_char,
			_xl_font,
			_h_fonts,
		} = this;

		return new Promise((fk_resolve) => {
			const sx_font = this._font(s_weight);
			if(_d_2d_char.font !== sx_font) _d_2d_char.font = sx_font;

			const h_chars = _h_fonts[sx_font] = _h_fonts[sx_font] || {};

			_d_2d_char.clearRect(0, 0, _xl_font, _xl_font);
			_d_2d_char.fillText(s_char, H_SUBPIXEL_OFFSETS[s_char] || X_DEFAULT_SUBPIXEL_OFFSET, Math.floor(_xl_font * 0.75));

			// measure char width
			const d_metrics = _d_2d_char.measureText(s_char);
			let xl_char = d_metrics.width;

			if('400 11px Ledger' === sx_font && s_char in H_CHAR_WIDTHS_OPEN_SANS_11PX) {
				xl_char = H_CHAR_WIDTHS_OPEN_SANS_11PX[s_char];
			}

			// const atu8_pixels = _d_2d_char.getImageData(0, 0, xl_char, Math.floor(_xl_font * 0.9));

			// prep image
			const d_img = new Image();

			d_img.onload = () => {
				fk_resolve(h_chars[s_char] = {
					xl_char,
					d_img,
				});
			};

			d_img.src = _dm_canvas_char.toDataURL();
		});
	}

	protected async _init(): Promise<this> {
		const {
			_sx_color,
			_xl_font,
			_xs_user,
			_xs_pre,
			_xl_screen_width,
			_xl_screen_height,
		} = this;

		// load fonts
		await Promise.all([
			load_font('OpenSans-Regular', '400'),
			load_font('OpenSans-Medium', '500'),
			load_font('OpenSans-SemiBold', '600'),
			load_font('OpenSans-Bold', '700'),
			load_font('OpenSans-ExtraBold', '800'),
		]);

		// create char canvas
		const dm_canvas = this._dm_canvas_char = dd('canvas', {
			width: Math.ceil(_xl_font*_xs_pre),
			height: Math.ceil(_xl_font*_xs_pre),
		});

		// create context
		const d_2d = this._d_2d_char = dm_canvas.getContext('2d', {
			desynchronized: true,
			willReadFrequently: true,
		})!;

		// disable antialiasing
		d_2d.imageSmoothingEnabled = false;

		// pixel filter
		const sx_svg = `
			<svg xmlns="http://www.w3.org/2000/svg">
				<filter id="filter" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
					<feComponentTransfer>
						<feFuncR type="identity"/>
						<feFuncG type="identity"/>
						<feFuncB type="identity"/>
						<feFuncA type="discrete" tableValues="0 0 0.1 0.8 1"/>
					</feComponentTransfer>
				</filter>
			</svg>
		`;

		// apply filter
		d_2d.filter = `url(data:image/svg+xml;base64,${btoa(sx_svg)}#filter)`;

		// apply font
		d_2d.font = `400 ${_xl_font}px Ledger`;

		// apply text color
		d_2d.fillStyle = _sx_color;

		// init common chars
		const a_awaits: Promise<CharData>[] = [];
		for(let i_char=0x20; i_char<=0x7e; i_char++) {
			const s_char = String.fromCodePoint(i_char);

			a_awaits.push(this._add_char(s_char));
		}

		// create screen canvas
		const dm_canvas_user = this._dm_canvas_user = dd('canvas', {
			width: _xl_screen_width * _xs_user,
			height: _xl_screen_height * _xs_user,
			style: this._gc_screen.style || '',
		});

		const d_2d_user = this._d_2d_user = dm_canvas_user.getContext('2d')!;

		// disable antialiasing
		d_2d_user.imageSmoothingEnabled = false;

		// scale for drawing
		d_2d_user.scale(_xs_user, _xs_user);

		await Promise.all(a_awaits);

		// for static wrapper
		return this;
	}

	protected async _width(z_text: string|string[], s_weight='400') {
		const {
			_h_fonts,
		} = this;

		const h_chars = _h_fonts[this._font(s_weight)];

		// unicode-safe
		const a_chars = Array.isArray(z_text)? z_text: Array.from(z_text);

		// calculate accurate line width
		let xl_line = 0;
		for(const s_char of a_chars) {
			const g_char = h_chars[s_char] || await this._add_char(s_char);

			xl_line += g_char.xl_char;
		}

		return xl_line;
	}

	protected async _line(s_text: string, i_line: number, s_weight='400'): Promise<void> {
		const {
			_d_2d_user,
			_xl_screen_width,
			_xl_font,
		} = this;

		// unicode-safe
		const a_chars = Array.from(s_text);

		// ref char set
		const sx_font = this._font(s_weight);
		const h_chars = this._h_fonts[sx_font] = this._h_fonts[sx_font] || {};

		// calculate accurate line width
		const xl_line = await this._width(a_chars);

		// set starting horizontal position
		const xl_left = (_xl_screen_width - xl_line) / 2;

		// compute vertical position
		const xl_top = this._xl_margin_top + ((_xl_font + this._xl_line_spacing) * i_line);

		// mutating x-coordinate
		let xl_x = xl_left;

		// each character
		for(const s_char of a_chars) {
			const g_char = h_chars[s_char] || await this._add_char(s_char, s_weight);

			let xl_offset = H_SUBPIXEL_OFFSETS[s_char] || 0;

			if(xl_offset < 0.4) xl_offset = 0;

			_d_2d_user.drawImage(g_char.d_img, xl_x - xl_offset, xl_top);

			xl_x += g_char.xl_char;
		}
	}

	protected async _sub(a_chars: string[], ic_hi: number): Promise<[string, number, number]> {
		const a_test = a_chars.slice(0, ic_hi);
		const nc_test = a_test.length;
		const s_test = a_test.join('');
		// const xl_test = this._d_2d_char.measureText(s_test).width;
		const xl_test = await this._width(a_test);

		return [s_test, nc_test, xl_test];
	}

	protected async _fit(a_chars: string[]) {
		const {_xl_paragraph} = this;

		const nc_max = Math.min(this._nc_chars, a_chars.length);
		let ic_test = nc_max;
		let ic_hi = nc_max + 1;

		// reduce logarithmically
		for(;;) {
			const [, nc_test, xl_test] = await this._sub(a_chars, ic_test);

			if(xl_test > _xl_paragraph) {
				ic_hi = ic_test;
				ic_test = Math.floor(nc_test * (_xl_paragraph / xl_test));
				continue;
			}

			break;
		}

		// there is room to grow
		if(ic_test < ic_hi - 1) {
			// grow linearly
			for(; ic_test<=nc_max;) {
				const [,, xl_test] = await this._sub(a_chars, ic_test);

				if(xl_test <= _xl_paragraph) {
					ic_test += 1;
					continue;
				}

				ic_test -= 1;
				break;
			}
		}

		return ic_test;
	}

	protected get _g_group(): DisplayGroup {
		return this._a_groups[this._i_group];
	}

	protected async _process_group(s_title: string, s_text: string): Promise<string[][]> {
		const {
			_nl_lines,
		} = this;

		const a_chars = Array.from(s_text);

		const a_pages: string[][] = [];

		let a_stage = a_chars;

		for(; a_stage.length;) {
			const a_lines: string[] = [];

			for(let i_line=1; i_line<_nl_lines; i_line++) {
				const ic_fit = await this._fit(a_stage);

				const s_chunk = a_stage.slice(0, ic_fit).join('');

				a_lines.push(s_chunk);

				// advance stage
				a_stage = a_stage.slice(ic_fit);
			}

			a_pages.push(a_lines);
		}

		return a_pages;
	}

	protected async _render_group(g_group: DisplayGroup, a_pages: string[][], i_page=0) {
		const nl_pages = a_pages.length;

		const a_lines = a_pages[i_page];

		let s_header = g_group.title;
		if(nl_pages > 1) s_header += ` ${this._gc_screen.headerBraces[0]}${i_page+1}/${nl_pages}${this._gc_screen.headerBraces[1]}`;

		await this._line(s_header, 0, this._gc_screen.headerWeight || '400');

		for(let i_line=0; i_line<a_lines.length; i_line++) {
			await this._line(a_lines[i_line], i_line+1);
		}
	}

	protected async _render() {
		const {_hm_pages, _g_group, _d_2d_user, _xs_user} = this;

		_d_2d_user.clearRect(0, 0, this._xl_screen_width*_xs_user, this._xl_screen_height*_xs_user);

		let a_pages = _hm_pages.get(_g_group);
		if(!a_pages) {
			a_pages = await this._process_group(_g_group.title, _g_group.text);
			_hm_pages.set(_g_group, a_pages);
		}

		await this._render_group(_g_group, a_pages, this._i_page);
	}


	get canvas(): HTMLCanvasElement {
		return this._dm_canvas_user;
	}

	get hasLeft(): boolean {
		return !(0 === this._i_group && 0 === this._i_page);
	}

	get hasRight(): boolean {
		return this._i_group < this._a_groups.length - 1 || this._i_page < this._hm_pages.get(this._g_group)!.length - 1;
	}

	async load(a_groups: DisplayGroup[]) {
		this._a_groups = a_groups;
		this._i_group = 0;
		this._i_page = 0;

		await this._render();
	}

	async next() {
		const {
			_a_groups,
			_i_group,
			_i_page,
			_hm_pages,
		} = this;

		const nl_pages = _hm_pages.get(this._g_group)!.length;
		if(_i_page < nl_pages - 1) {
			this._i_page += 1;
		}
		else if(_i_group < _a_groups.length - 1) {
			this._i_group += 1;
			this._i_page = 0;
		}
		else {
			return;
		}

		await this._render();
	}

	async prev() {
		const {
			_a_groups,
			_i_group,
			_i_page,
			_hm_pages,
		} = this;

		const nl_pages = _hm_pages.get(this._g_group)!.length;
		if(_i_page > 0) {
			this._i_page -= 1;
		}
		else if(_i_group > 0) {
			this._i_group -= 1;
			this._i_page = _hm_pages.get(this._g_group)!.length - 1;
		}
		else {
			return;
		}

		await this._render();
	}

	async sign(gc_sign: {json: JsonObject}): Promise<void> {
		const a_group_keys: number[] = [];
		const h_groups: Dict<DisplayGroup> = {};
		const a_keys = Object.keys(H_KEY_SUBS);

		function recurse(h_obj: JsonObject, a_path: string[]=[]) {
			for(const [si_key, w_value] of Object.entries(h_obj)) {
				const a_local = [...a_path, si_key];
				const si_path = a_local.join('/');

				const s_title = H_KEY_SUBS[si_path];
				if(s_title) {
					const i_key = a_keys.indexOf(si_path);

					let s_text = '';

					if(Array.isArray(w_value) && !w_value.length) {
						s_text = 'Empty';
					}
					else if('' === w_value) {
						continue;
					}
					else {
						s_text = H_FORMATTERS[si_path]?.(w_value) || ''+w_value;
					}

					a_group_keys.push(i_key);
					h_groups[i_key] = {
						type: 'msg',
						title: s_title,
						text: s_text,
					};
				}
				else if(Array.isArray(w_value)) {
					for(const w_each of w_value) {
						if(is_dict(w_each)) {
							recurse(w_each, a_local);
						}
					}
				}
				else if(is_dict(w_value)) {
					recurse(w_value, a_local);
				}
			}
		}

		const h_json = canonicalize_json(gc_sign.json) as JsonObject;

		recurse(h_json);

		const a_groups = a_group_keys.sort((x_a, x_b) => x_a - x_b).map(i_key => h_groups[i_key]);

		return await this.load(a_groups);
	}
}
