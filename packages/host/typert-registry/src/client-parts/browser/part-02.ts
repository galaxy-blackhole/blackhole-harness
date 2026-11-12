/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/index.js
		/** Browser face of the shared Typert runtime registry. */
		/** Required services: none; this is the Client reflection root. */
		const inject = [];
		/**
		* Install the same registry implementation used by the Host face.
		* @param ctx - Client Cordis root.
		*/
		function apply(ctx) {
			new TypertRegistry(ctx);
		}
		//#endregion

export {};
