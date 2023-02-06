import type {F} from 'ts-toolbelt';

import {timeout} from '#/util/belt';

interface GrpcWebError extends Error {
	metadata: {
		headersMap: any;
		statusCode: number;
	};
}

const N_DEFAULT_MAX_RETRIES = 3;

const XT_DEFAULT_WAIT = 1.5e3;

/**
 * Employs a retry strategy for grpc-web client requests
 */
export async function wgrpc_retry<
	w_out,
>(f_request: F.Function<[], Promise<w_out>>, n_max_retries=N_DEFAULT_MAX_RETRIES, xt_wait=XT_DEFAULT_WAIT): Promise<w_out> {
	let e_failure!: Error;

	// repeat while retry attempts remain
	for(let c_retries=0; c_retries<n_max_retries; c_retries++) {
		// attempt
		try {
			return await f_request();
		}
		// catch erroneous response
		catch(e_wgrpc) {
			// safe failure for if retries max out
			e_failure = e_wgrpc;

			// runtime type-checking
			if(e_wgrpc instanceof Error) {
				// retryable HTTP status code
				if([425, 429, 500, 502, 503, 504].includes((e_wgrpc as GrpcWebError).metadata?.statusCode || 0)) {
					// exponential back-off
					await timeout(xt_wait * Math.pow(2, c_retries));

					// log
					console.warn(`Retrying grpc-web request to <${e_wgrpc.metadata?.url || 'unknown-url'}>`);

					// retry
					continue;
				}
			}

			// non-recoverable error
			throw e_wgrpc;
		}
	}

	// give up
	throw e_failure;
}
