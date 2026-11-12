/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/index.js
		/**
		* Job Controller client half: installs `ctx.jobs` (rosters, observations, and
		* the human kill) over the generated `job` Remote namespace. The plugin resolves both Remote faces it drives while its
		* own context is current, because stream (re)opens run on caller stacks — a
		* React event, a carrier retry — whose dynamic context has not declared
		* `remote.job`.
		* @module @deepseek-ai/dsh-api-job-controller/client
		*/
		/** Required Client Remote services. */
		const inject = ["remote", "remote.job"];
		/**
		* Install the client jobs service.
		* @param ctx - Client root Context.
		*/
		function apply(ctx) {
			const { remote } = ctx;
			const { job } = remote;
			new ClientJobs(ctx, {
				$stream: (options) => remote.$stream(options),
				job
			}, new ClientJobsModel());
		}
		//#endregion

export {};
