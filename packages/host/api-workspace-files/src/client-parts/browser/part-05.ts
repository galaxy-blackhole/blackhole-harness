/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/index.js
		/** Required browser services: the resource model, the Remote carrier and its namespace. */
		const inject = [
			"resources",
			"remote",
			"remote.workspaceFiles"
		];
		/**
		* Client plugin body: register the `file` provider for this plugin's lifetime.
		* @param ctx - client root context carrying `resources` and the Remote face.
		*/
		function apply(ctx) {
			const changes = new ChangeFeed(ctx.remote);
			const provider = createFileResourceProvider(ctx.remote, changes);
			ctx.effect(() => {
				const release = ctx.resources.register(provider);
				return async () => {
					release();
					await changes.settle();
				};
			}, "workspace-files: file resource provider");
		}
		//#endregion

export {};
