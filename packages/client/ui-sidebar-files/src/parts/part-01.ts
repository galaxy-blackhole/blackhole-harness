/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-sidebar-files",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		require("@deepseek-ai/cordis");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region lib/types/client/definition.js
		/** The tab kind this package owns. */
		const FILES_KIND = "files";
		/** This implementation's identity in the tab system, and the key its body registers under. */
		const FILES_ID = "@deepseek-ai/dsh-client-ui-sidebar-files";
		/**
		* The files type's registry definition.
		* @param t - namespace-bound translate, read fresh on every label call.
		* @returns the definition to register.
		*/
		function filesDefinition(t) {
			return {
				id: FILES_ID,
				kind: FILES_KIND,
				priority: "builtin",
				title: () => t("type.label"),
				guide: [{
					id: "workspace",
					commandId: "workspace.files",
					order: 10,
					title: () => t("guide.title"),
					description: () => t("guide.description"),
					icon: _deepseek_ai_dsh_client_ui_primitives.GuideArtworkFiles
				}]
			};
		}
		//#endregion
		//#region ../../typert/protocol/src/remote-error.ts
		/**
		* One Remote call failure: a real Error carrying its stable code and typed
		* details. Owners throw it at the failure point; the Host Gateway encodes it
		* onto the wire unchanged; the Client face rebuilds an instance for the
		* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
		* Discrimination is always by `code`, never by instanceof.
		*/
		var RemoteError = class extends Error {
			code;
			details;
			/** Structural marker: cross-realm/bundle identification never uses instanceof. */
			isDSHRemoteError = true;
			/**
			* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
			* @param message - human diagnostic carried across the wire.
			* @param details - structured payload typed by the code.
			* @param options - standard Error options (`cause` survives in-process only).
			*/
			constructor(code, message, details, options) {
				super(message, options);
				this.code = code;
				this.details = details;
				this.name = "RemoteError";
			}
		};
		//#endregion
		//#region ../../typert/protocol/src/index.ts
		/**
		* Remote decorators and explicit Gateway bindings backed by versioned
		* descriptors carried on decorated class prototypes. Strict reflection
		* remains a Typert compiler responsibility.
		* @module @deepseek-ai/dsh-typert-protocol
		*/
		//#endregion
		//#region lib/types/client/directory-node.js
		/** One open directory and its active child nodes; cached view preferences live in the store. */
		var DirectoryNode = class DirectoryNode {
			path;
			load;
			watch;
			failed;
			restore;
			/** Open direct-child directories, keyed by absolute path. */
			children = /* @__PURE__ */ new Map();
			controller = new AbortController();
			signal;
			task;
			reading;
			dirty = false;
			initialized = false;
			automatic = true;
			constructor(path, load, watch, failed, lifetime, restore = []) {
				this.path = path;
				this.load = load;
				this.watch = watch;
				this.failed = failed;
				this.restore = restore;
				this.signal = AbortSignal.any([lifetime, this.controller.signal]);
			}
			/**
			* Start observation once; readiness triggers the initial listing.
			* @returns this node.
			*/
			open() {
				this.task ??= this.follow();
				return this;
			}
			/**
			* Find an active node in this subtree.
			* @param path - absolute directory path.
			* @returns the matching node, or undefined when that directory is closed.
			*/
			find(path) {
				if (path === this.path) return this;
				for (const child of this.children.values()) {
					const found = child.find(path);
					if (found !== void 0) return found;
				}
			}
			/**
			* Update the expansion preferences used by pending directory listings.
			* @param expanded - latest expansion preferences from the store.
			*/
			setExpanded(expanded) {
				this.restore = expanded;
				for (const child of this.children.values()) child.setExpanded(expanded);
			}
			/**
			* Open a direct child using this node's lifetime and automatic-refresh setting.
			* @param path - absolute direct-child directory path.
			* @param restore - descendant expansion preferences to restore after listing.
			* @returns the active child, or undefined after cancellation.
			*/
			expand(path, restore = []) {
				if (this.signal.aborted) return void 0;
				let child = this.children.get(path);
				if (child === void 0) {
					child = new DirectoryNode(path, this.load, this.watch, this.failed, this.signal, restore);
					child.automatic = this.automatic;
					this.children.set(path, child);
				}
				return child.open();
			}
			/**
			* Remove a child and its pending restoration preferences.
			* @param path - absolute direct-child directory path.
			* @returns once the child subtree's reads and watches have ended.
			*/
			async collapse(path) {
				this.restore = this.restore.filter((value) => value !== path && !value.startsWith(`${path}/`));
				const child = this.children.get(path);
				this.children.delete(path);
				await child?.close();
			}
			/**
			* Control subtree rereads without ending subscriptions.
			* @param enabled - refresh dirty nodes automatically.
			*/
			setAutomatic(enabled) {
				this.automatic = enabled;
				if (enabled && this.dirty) this.refresh();
				for (const child of this.children.values()) child.setAutomatic(enabled);
			}
			/** Queue a reread, coalescing with active work. @returns completion of the active read and its coalesced rereads. */
			refresh() {
				this.dirty = true;
				this.reading ??= this.read();
				return this.reading;
			}
			/** Refresh this node and its open descendants. @returns once their listings settle. */
			async refreshTree() {
				await this.refresh();
				await Promise.all([...this.children.values()].map((child) => child.refreshTree()));
			}
			/** Cancel the active subtree. @returns once all owned reads and watches have ended. */
			async close() {
				this.controller.abort();
				await Promise.all([
					this.task,
					this.reading,
					...[...this.children.values()].map((child) => child.close())
				]);
				this.children.clear();
			}
			async follow() {
				try {
					for await (const _event of this.watch(this.path, this.signal)) {
						this.dirty = true;
						if (!this.initialized || this.automatic) this.refresh();
					}
				} catch (error) {
					if (!this.signal.aborted) {
						if (!this.initialized) await this.refresh();
						if (!(typeof error === "object" && error !== null && "code" in error && error.code === "workspace-file/watch-unsupported")) this.failed(this.path, error);
					}
				}
			}
			async read() {
				const readAgain = () => this.dirty && this.automatic && !this.signal.aborted;
				try {
					do {
						this.dirty = false;
						const level = await this.load(this.path, this.signal);
						if (this.signal.aborted || level === void 0) return;
						this.initialized = true;
						const directories = new Set(level.entries.filter((entry) => entry.type === "directory").map((entry) => `${this.path.replace(/[/\\]+$/, "")}/${entry.name}`));
						for (const path of this.children.keys()) if (!directories.has(path)) await this.collapse(path);
						for (const path of directories) if (this.restore.includes(path)) this.expand(path, this.restore);
						this.restore = [];
					} while (readAgain());
				} finally {
					this.reading = void 0;
				}
			}
		};
		//#endregion
		//#region lib/types/client/face.js
		/**
		* Bind directory observation to the Remote stream supervisor.
		* @param remote - Client Remote with workspace file streams.
		* @returns a watcher that awaits stream disposal when its node ends.
		*/
		function createWatch(remote) {
			return async function* (sessionId, path, signal) {
				const aborted = () => signal.aborted;
				if (aborted()) return;
				const stream = remote.$stream({
					name: `directory ${path}`,
					open: (lifetime) => remote.workspaceFiles.changes(sessionId, path, lifetime),
					ended: () => /* @__PURE__ */ new Error(`Directory watch ended: ${path}`)
				});
				const abort = () => {
					stream.dispose();
				};
				signal.addEventListener("abort", abort, { once: true });
				try {
					for await (const item of stream) {
						if (aborted()) return;
						if (item.value.kind === "ready") item.accept();
						yield item.value.kind;
					}
				} finally {
					signal.removeEventListener("abort", abort);
					await stream.dispose();
				}
			};
		}
		/**
		* Bind the listing to one Remote face, keeping only what the tree stores.
		* @param remote - the Client Remote face carrying the `workspaceFiles` namespace.
		* @returns the listing the tree's face performs.
		*/
		function createList(remote) {
			return async (sessionId, path, signal) => {
				const result = await remote.workspaceFiles.list(sessionId, path, signal);
				if (!result.ok) return result;
				return {
					ok: true,
					value: {
						entries: result.value.entries,
						truncated: result.value.truncated
					}
				};
			};
		}
		/**
		* The absolute path of one child entry.
		*
		* Joined with `/` whatever the parent's separators: the Host resolves mixed
		* separators, and the tree only needs a stable key.
		* @param parent - absolute path of the listed directory.
		* @param name - the entry's basename.
		* @returns the child's absolute path.
		*/
		function childPath(parent, name) {
			return `${parent.replace(/[/\\]+$/, "")}/${name}`;
		}
		/**
		* Bind the tree's face to one directory listing.
		* @param list - the bound `workspaceFiles.list` call.
		* @param watch - target-scoped directory observation.
		* @returns the Slot `inject` factory: session and bound actions in, face out.
		*/
		function filesFace(list, watch) {
			return (sessionId, actions) => {
				/** Per tab, per absolute path: the listing generation a settlement must match; the latest request wins. */
				const generations = /* @__PURE__ */ new Map();
				const roots = /* @__PURE__ */ new Map();
				const nextGeneration = (tabId, path) => {
					const byPath = generations.get(tabId) ?? /* @__PURE__ */ new Map();
					generations.set(tabId, byPath);
					const generation = (byPath.get(path) ?? 0) + 1;
					byPath.set(path, generation);
					return generation;
				};
				const load = async (tabId, path, signal) => {
					if (signal.aborted) return;
					const generation = nextGeneration(tabId, path);
					actions.loading(tabId, path);
					return list(sessionId, path, signal).then((result) => {
						if (signal.aborted || generations.get(tabId)?.get(path) !== generation) return;
						if (result.ok) actions.loaded(tabId, path, result.value);
						else actions.failed(tabId, path, result.error);
						return result.ok ? result.value : void 0;
					});
				};
				return {
					refresh: (tabId) => {
						roots.get(tabId)?.refreshTree();
					},
					setAutoRefresh: (tabId, enabled) => {
						actions.autoRefresh(tabId, enabled);
						roots.get(tabId)?.setAutomatic(enabled);
					},
					start(tabId, root, signal) {
						actions.start(tabId, root);
						signal.addEventListener("abort", () => {
							roots.get(tabId)?.close();
							roots.delete(tabId);
							generations.delete(tabId);
							actions.forget(tabId);
						}, { once: true });
						roots.set(tabId, new DirectoryNode(root, (path, lifetime) => load(tabId, path, lifetime), (path, lifetime) => watch(sessionId, path, lifetime), (path, error) => {
							if (!signal.aborted) actions.failed(tabId, path, new RemoteError("gateway/internal", error instanceof Error ? error.message : String(error), {}));
						}, signal).open());
					},
					load: (tabId, path, signal) => {
						load(tabId, path, signal);
					},
					toggle(tabId, parentPath, path, expanded, signal) {
						if (signal.aborted) return;
						const root = roots.get(tabId);
						if (root === void 0) return;
						const parent = root.find(parentPath);
						if (parent === void 0 && !expanded.includes(parentPath)) return;
						const collapsing = expanded.includes(path);
						const next = collapsing ? expanded.filter((value) => value !== path) : [...expanded, path];
						root.setExpanded(next);
						if (collapsing) parent?.collapse(path);
						else parent?.expand(path, next);
						actions.toggled(tabId, path);
					}
				};
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region ../../util/workspace-path/src/file-address.ts
		/** The scheme and type every file address opens with. */
		const FILE_ADDRESS_PREFIX = "dsh-resource://file/";
		/** Component-encode one id or path segment, keeping `:` literal for drive letters. */
		function encodeSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}
		/** Encode a `/`-separated path segment by segment. */
		function encodePath(path) {
			return path.split("/").map(encodeSegment).join("/");
		}
		/**
		* Build the address of a file read through one Session.
		* @param sessionId - the Session whose Host workspace resolves the path.
		* @param path - absolute or workspace-relative path; backslashes are normalized to `/`, and leading `./` prefixes are dropped.
		* @returns the `dsh-resource://file/session/<sessionId>/<path>` address.
		*/
		function sessionFileAddress(sessionId, path) {
			const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
			return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
		}
		//#endregion
		//#region ../../util/workspace-path/src/index.ts
		/**
		* Browser-safe Workspace path and display helpers.
		* @module @deepseek-ai/dsh-util-workspace-path
		*/
		/** Whether a path uses a Windows drive or UNC prefix. */
		function isWindowsStylePath(value) {
			return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
		}
		/**
		* Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
		* @param path - the path to classify.
		* @returns `true` for an absolute path; `false` for a Workspace-relative one.
		*/
		function isAbsoluteWorkspacePath(path) {
			return path.startsWith("/") || isWindowsStylePath(path);
		}
		/**
export {};
