/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-api-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/provider.js
		/**
		* Build the `file` provider over one Remote face and one change feed.
		* @param remote - the Remote face carrying `workspaceFiles.stat`.
		* @param changes - target-scoped change streams shared by file resources.
		* @returns the provider to register into `ctx.resources`.
		*/
		function createFileResourceProvider(remote, changes) {
			return {
				protocol: "file",
				async *open(address, { signal }) {
					const resolved = resolve(address);
					if (!resolved.ok) {
						yield resolved;
						return;
					}
					const { sessionId, path } = resolved.value;
					const notices = changes.follow(sessionId, path, signal);
					const stat = () => remote.workspaceFiles.stat(sessionId, path, signal);
					const aborted = () => signal.aborted;
					let current;
					try {
						if (!await notices.ready) {
							if (aborted()) return;
							const result = await stat();
							if (!aborted()) yield result;
							return;
						}
						if (aborted()) return;
						const first = await stat();
						if (aborted()) return;
						if (first.ok) {
							notices.bind(first.value.absolutePath);
							current = first.value;
							yield {
								ok: true,
								value: current
							};
						} else yield first;
						for await (const notice of notices) {
							if (aborted()) return;
							if (current === void 0) {
								if (notice.kind === "absent") continue;
							} else if (notice.kind === "changed") {
								if (notice.version === current.version) continue;
							}
							const again = await stat();
							if (aborted()) return;
							if (!again.ok) {
								current = void 0;
								yield again;
								continue;
							}
							notices.bind(again.value.absolutePath);
							current = again.value;
							yield {
								ok: true,
								value: current
							};
						}
					} finally {
						notices.dispose();
					}
				}
			};
		}
		/**
		* Resolve one address to the Host call it stands for, or to the failure frame it earns.
		* @param address - the full address, scheme included.
		* @returns the Host file, or the `unsupported-address` / `unknown-workspace` failure.
		*/
		function resolve(address) {
			const parsed = parseFileAddress(address);
			if (parsed === void 0) return {
				ok: false,
				error: unsupportedAddress(address)
			};
			if (parsed.scope === "session") return {
				ok: true,
				value: {
					sessionId: parsed.sessionId,
					path: parsed.path
				}
			};
			return {
				ok: false,
				error: unknownWorkspace(address)
			};
		}
		/**
		* The failure frame's error for an address this provider does not serve.
		* @param address - the offending address.
		* @returns the typed error.
		*/
		function unsupportedAddress(address) {
			return new RemoteError("workspace-file/unsupported-address", `${address} is not a dsh-resource://file/session/<sessionId>/<path> or dsh-resource://file/absolute/<path> address`, { address });
		}
		/**
		* The failure frame's error for an absolute address with no Session.
		* @param address - the offending address.
		* @returns the typed error.
		*/
		function unknownWorkspace(address) {
			return new RemoteError("workspace-file/unknown-workspace", `${address} requires a dsh-resource://file/session/<sessionId>/<path> address`, { address });
		}
		//#endregion

export {};
