/**
 * The following imports and constants produce the correct identifiers that the minified class being assigned to `InjectedKeplr`
 * references. The equivalent import or constant from `@keplr-wallet/provider/build/inject.js` is annotated in the comment above
 * each one.
 */

/* eslint-disable */

// mimic `__awaiter`
const n = function(thisArg, _arguments, P, generator) {
	function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
	return new (P || (P = Promise))(function (resolve, reject) {
		 function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
		 function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
		 function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
		 step((generator = generator.apply(thisArg, _arguments || [])).next());
	});
};

import type { Dict } from '#/meta/belt';

// mimic `router_1`
import s from '@keplr-wallet/router';

// create and export intercepts
export const H_INTERCEPTS: Dict<{}> = {};

// mimic `deepmerge_1`
import deepmerge from 'deepmerge';
const h = {default:deepmerge};

// mimic `long_1`
import long from 'long';
const a = {default:long};

/**
 * These next parts are a bit ugly. The objective is to expose a `window.keplr` object to the dApp that is indistinguishable
 * from the object that Keplr creates. In other words, the requirement is that a dApp should be able to discern whether Keplr
 * or StarShell created the `window.keplr` object, in order to prevent the dApp from being able to detect StarShell's presence.
 * 
 * When Keplr loads the `window.keplr` object, it is a minifed version of the export. This leaves some tell-tale signs such as
 * `window.keplr.constructor.toString()`. In order to make StarShell's `window.keplr` object identical, it must also produce
 * the same string. Overriding the `toString` method for the constructor object would not work since it would leave behind
 * evidence in the object's prototype chain. Instead, export the verbatim JavaScript observed at runtime.
 * 
 * The only other cases that may leak information about whether Keplr or StarShell created the object could be lurking in
 * code paths that throw errors. For example, an attacker could deliberately invoke a method with bad arguments to cause an
 * Error to be thrown, only to catch it and read the `.stack` property to inspect the line, column number, and path from
 * where the Error was thrown. Presumably, these stacks would differ between Keplr and StarShell. While it would be possible
 * to mimic such stack strings in those cases, no effort has been made yet to analyze if and where such Errors might be thrown.
 */

// mimic `enigma_1`
//   generated at runtime using `console.log(window.keplr.getEnigmaUtils('dummy-1').constructor.toString())`
const o = {
	KeplrEnigmaUtils: class{constructor(t,e){this.chainId=t,this.keplr=e}getPubkey(){return n(this,void 0,void 0,(function*(){return yield this.keplr.getEnigmaPubKey(this.chainId)}))}getTxEncryptionKey(t){return n(this,void 0,void 0,(function*(){return yield this.keplr.getEnigmaTxEncryptionKey(this.chainId,t)}))}encrypt(t,e){return n(this,void 0,void 0,(function*(){return yield this.keplr.enigmaEncrypt(this.chainId,t,e)}))}decrypt(t,e){return n(this,void 0,void 0,(function*(){return yield this.keplr.enigmaDecrypt(this.chainId,t,e)}))}}
};

// mimic `cosmos_1.CosmJSOfflineSignerOnlyAmino`
//   generated at runtime using `console.log(window.keplr.getOfflineSignerOnlyAmino('dummy-1').constructor.toString())`
const i = class i{constructor(t,e){this.chainId=t,this.keplr=e}getAccounts(){return n(this,void 0,void 0,(function*(){const t=yield this.keplr.getKey(this.chainId);return[{address:t.bech32Address,algo:"secp256k1",pubkey:t.pubKey}]}))}signAmino(t,e){return n(this,void 0,void 0,(function*(){if(this.chainId!==e.chain_id)throw new Error("Unmatched chain id with the offline signer");if((yield this.keplr.getKey(e.chain_id)).bech32Address!==t)throw new Error("Unknown signer address");return yield this.keplr.signAmino(this.chainId,t,e)}))}sign(t,e){return n(this,void 0,void 0,(function*(){return yield this.signAmino(t,e)}))}}

// make accessible by same identifier referenced in `exports.InjectedKeplr`
const u = {
	CosmJSOfflineSignerOnlyAmino: i,

	// mimic `cosmos_1.CosmJSOfflineSigner`
	//   generated at runtime using `console.log(window.keplr.getOfflineSigner('dummy-1').constructor.toString())`
	CosmJSOfflineSigner: class extends i{constructor(t,e){super(t,e),this.chainId=t,this.keplr=e}signDirect(t,e){return n(this,void 0,void 0,(function*(){if(this.chainId!==e.chainId)throw new Error("Unmatched chain id with the offline signer");if((yield this.keplr.getKey(e.chainId)).bech32Address!==t)throw new Error("Unknown signer address");return yield this.keplr.signDirect(this.chainId,t,e)}))}}
};


// mimic `exports.InjectedKeplr`
//   generated at runtime using `console.log(window.keplr.constructor.toString())`
export const InjectedKeplr = class f{constructor(t,e,r={addMessageListener:t=>window.addEventListener("message",t),removeMessageListener:t=>window.removeEventListener("message",t),postMessage:t=>window.postMessage(t,window.location.origin)},n){this.version=t,this.mode=e,this.eventListener=r,this.parseMessage=n,this.enigmaUtils=new Map,this.defaultOptions={};const i=Object.keys(this);for(const t of i)if("defaultOptions"!==t&&Object.defineProperty(this,t,{value:this[t],writable:!1}),"eventListener"===t){const t=Object.keys(this.eventListener);for(const e of t)Object.defineProperty(this.eventListener,e,{value:this.eventListener[e],writable:!1})}const s=Object.getOwnPropertyNames(f.prototype);for(const t of s)"constructor"!==t&&"function"==typeof this[t]&&Object.defineProperty(this,t,{value:this[t].bind(this),writable:!1})}static startProxy(t,e={addMessageListener:t=>window.addEventListener("message",t),postMessage:t=>window.postMessage(t,window.location.origin)},r){e.addMessageListener(i=>n(this,void 0,void 0,(function*(){const o=r?r(i.data):i.data;if(o&&"proxy-request"===o.type)try{if(!o.id)throw new Error("Empty id");if("version"===o.method)throw new Error("Version is not function");if("mode"===o.method)throw new Error("Mode is not function");if("defaultOptions"===o.method)throw new Error("DefaultOptions is not function");if(!t[o.method]||"function"!=typeof t[o.method])throw new Error("Invalid method: "+o.method);if("getOfflineSigner"===o.method)throw new Error("GetOfflineSigner method can't be proxy request");if("getOfflineSignerOnlyAmino"===o.method)throw new Error("GetOfflineSignerOnlyAmino method can't be proxy request");if("getOfflineSignerAuto"===o.method)throw new Error("GetOfflineSignerAuto method can't be proxy request");if("getEnigmaUtils"===o.method)throw new Error("GetEnigmaUtils method can't be proxy request");const r="signDirect"===o.method?yield(()=>n(this,void 0,void 0,(function*(){const e=o.args[2],r=yield t.signDirect(o.args[0],o.args[1],{bodyBytes:e.bodyBytes,authInfoBytes:e.authInfoBytes,chainId:e.chainId,accountNumber:e.accountNumber?h.default.fromString(e.accountNumber):null},o.args[3]);return{signed:{bodyBytes:r.signed.bodyBytes,authInfoBytes:r.signed.authInfoBytes,chainId:r.signed.chainId,accountNumber:r.signed.accountNumber.toString()},signature:r.signature}})))():yield t[o.method](...s.JSONUint8Array.unwrap(o.args)),i={type:"proxy-request-response",id:o.id,result:{return:s.JSONUint8Array.wrap(r)}};e.postMessage(i)}catch(t){const r={type:"proxy-request-response",id:o.id,result:{error:t.message||t.toString()}};e.postMessage(r)}})))}requestMethod(t,e){const r=new Uint8Array(8),n=Array.from(crypto.getRandomValues(r)).map(t=>t.toString(16)).join(""),i={type:"proxy-request",id:n,method:t,args:s.JSONUint8Array.wrap(e)};return new Promise((t,e)=>{const r=i=>{const o=this.parseMessage?this.parseMessage(i.data):i.data;if(!o||"proxy-request-response"!==o.type)return;if(o.id!==n)return;this.eventListener.removeMessageListener(r);const u=s.JSONUint8Array.unwrap(o.result);u?u.error?e(new Error(u.error)):t(u.return):e(new Error("Result is null"))};this.eventListener.addMessageListener(r),this.eventListener.postMessage(i)})}enable(t){return n(this,void 0,void 0,(function*(){yield this.requestMethod("enable",[t])}))}disable(t){return n(this,void 0,void 0,(function*(){yield this.requestMethod("disable",[t])}))}experimentalSuggestChain(t){var e,r;return n(this,void 0,void 0,(function*(){((null===(e=t.features)||void 0===e?void 0:e.includes("stargate"))||(null===(r=t.features)||void 0===r?void 0:r.includes("no-legacy-stdTx")))&&console.warn("“stargate”, “no-legacy-stdTx” feature has been deprecated. The launchpad is no longer supported, thus works without the two features. We would keep the aforementioned two feature for a while, but the upcoming update would potentially cause errors. Remove the two feature."),yield this.requestMethod("experimentalSuggestChain",[t])}))}getKey(t){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getKey",[t])}))}sendTx(t,e,r){return n(this,void 0,void 0,(function*(){return"length"in e||console.warn("Do not send legacy std tx via `sendTx` API. We now only support protobuf tx. The usage of legeacy std tx would throw an error in the near future."),yield this.requestMethod("sendTx",[t,e,r])}))}signAmino(t,e,r,i={}){var s;return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signAmino",[t,e,r,a.default(null!==(s=this.defaultOptions.sign)&&void 0!==s?s:{},i)])}))}signDirect(t,e,r,i={}){var s;return n(this,void 0,void 0,(function*(){const n=yield this.requestMethod("signDirect",[t,e,{bodyBytes:r.bodyBytes,authInfoBytes:r.authInfoBytes,chainId:r.chainId,accountNumber:r.accountNumber?r.accountNumber.toString():null},a.default(null!==(s=this.defaultOptions.sign)&&void 0!==s?s:{},i)]),o=n.signed;return{signed:{bodyBytes:o.bodyBytes,authInfoBytes:o.authInfoBytes,chainId:o.chainId,accountNumber:h.default.fromString(o.accountNumber)},signature:n.signature}}))}signArbitrary(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signArbitrary",[t,e,r])}))}signICNSAdr36(t,e,r,n,i){return this.requestMethod("signICNSAdr36",[t,e,r,n,i])}verifyArbitrary(t,e,r,i){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("verifyArbitrary",[t,e,r,i])}))}signEthereum(t,e,r,i){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signEthereum",[t,e,r,i])}))}getOfflineSigner(t){return new u.CosmJSOfflineSigner(t,this)}getOfflineSignerOnlyAmino(t){return new u.CosmJSOfflineSignerOnlyAmino(t,this)}getOfflineSignerAuto(t){return n(this,void 0,void 0,(function*(){return(yield this.getKey(t)).isNanoLedger?new u.CosmJSOfflineSignerOnlyAmino(t,this):new u.CosmJSOfflineSigner(t,this)}))}suggestToken(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("suggestToken",[t,e,r])}))}getSecret20ViewingKey(t,e){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getSecret20ViewingKey",[t,e])}))}getEnigmaPubKey(t){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getEnigmaPubKey",[t])}))}getEnigmaTxEncryptionKey(t,e){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getEnigmaTxEncryptionKey",[t,e])}))}enigmaEncrypt(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("enigmaEncrypt",[t,e,r])}))}enigmaDecrypt(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("enigmaDecrypt",[t,e,r])}))}getEnigmaUtils(t){if(this.enigmaUtils.has(t))return this.enigmaUtils.get(t);const e=new o.KeplrEnigmaUtils(t,this);return this.enigmaUtils.set(t,e),e}experimentalSignEIP712CosmosTx_v0(t,e,r,i,s={}){var o;return n(this,void 0,void 0,(function*(){return yield this.requestMethod("experimentalSignEIP712CosmosTx_v0",[t,e,r,i,a.default(null!==(o=this.defaultOptions.sign)&&void 0!==o?o:{},s)])}))}getChainInfosWithoutEndpoints(){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getChainInfosWithoutEndpoints",[])}))}__core__getAnalyticsId(){return this.requestMethod("__core__getAnalyticsId",[])}changeKeyRingName({defaultName:t,editable:e=!0}){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("changeKeyRingName",[{defaultName:t,editable:e}])}))}}
