
// setup console pretty printing
const SX_CSL_PAD = 'padding:8px 0px;';
const SX_CSL_ALL = SX_CSL_PAD + 'background:#212121; color:#f7f7f7;';
const SX_CSL_PRM = 'color:#ffb61a;';
const SX_CSL_BEGIN = 'padding-left:4px;';
const SX_CSL_END = 'padding-right:4px;';
export const A_CSL = [
	SX_CSL_BEGIN,
	SX_CSL_PRM,
	SX_CSL_ALL,
	SX_CSL_END,
].map(s => SX_CSL_ALL + s);

export const A_CSL_ERROR = [
	SX_CSL_BEGIN,
	SX_CSL_PRM,
	'',
	SX_CSL_END,
].map(s => SX_CSL_PAD + s);

// export default {
// 	A_CSL,
// 	A_CSL_ERROR,
// };
