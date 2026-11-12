/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 4067–4566 của stock lib/index.js (@deepseek-ai/dsh-app-boot): kernel boot library (profile resolution, bundles, config-schema).
 */
// @ts-nocheck

	for (let count = 1; count <= layers.length; count += 1) {
		const layer = layers[count - 1];
		/* v8 ignore next -- count iterates 1..length, so the slot exists */
		if (layer === void 0) continue;
		const warnings = [];
		composed = snapshot(count, warnings);
		for (const line of warnings.slice(previousWarnings.length)) warn(`${binName}: [${layer.label}] ${line}`);
		const before = previous.map((entry) => JSON.stringify(entry));
		for (let index = 0; index < composed.length; index += 1) if (index >= before.length) entryOrigins.push({
			origin: layer.label,
			patchedBy: []
		});
		else if (JSON.stringify(composed[index]) !== before[index]) entryOrigins[index]?.patchedBy.push(layer.label);
		previous = composed;
		previousWarnings = warnings;
	}
	return groupedDump(composed, entryOrigins);
}
/** Render the composed rows grouped under one source-and-patches comment per contiguous run. */
function groupedDump(composed, entryOrigins) {
	const lines = [];
	let currentLabel;
	let group = [];
	const flush = () => {
		if (currentLabel === void 0 || group.length === 0) return;
		lines.push(`# == ${currentLabel}`);
		lines.push(yaml.dump(group, {
			schema: entryListSchema,
			noRefs: true
		}).trimEnd());
		group = [];
	};
	for (let index = 0; index < composed.length; index += 1) {
		const record = entryOrigins[index];
		/* v8 ignore next -- this array is index-aligned with composed by construction */
		if (record === void 0) continue;
		const label = record.patchedBy.length === 0 ? record.origin : `${record.origin}, patched by ${record.patchedBy.join(", ")}`;
		if (label !== currentLabel) {
			flush();
			currentLabel = label;
		}
		group.push(composed[index]);
	}
	flush();
	return lines.join("\n") + "\n";
}
/**
* Mount and remember the exact root Include entry used by app boot and user patch-layer HMR.
* @param ctx - context carrying an initialized Loader service.
* @param absoluteConfigPath - absolute YAML or JSON configuration path.
* @param patches - initial app and user patches, applied in order.
* @param bareModuleBaseUrl - optional installed-host base for bare package
* names; relative names continue to resolve beside the configuration file.
* @param binName - diagnostic prefix for a profile plugin denied by compatibility policy; defaults to `dsh`.
* @returns the created root Include entry, or `undefined` when a surface
* disposed the whole tree (taking the Loader service with it) while the
* entry creation was in flight.
*/
async function mountRootInclude(ctx, absoluteConfigPath, patches = [], bareModuleBaseUrl, binName = "dsh") {
	ctx.loader.builtins.include = bareModuleBaseUrl === void 0 ? Include : class HostResolvedRootInclude extends Include {
		import(name, getOuterStack) {
			const specifier = isAbsolute(name) ? pathToFileURL(name).href : name;
			if (name.startsWith(".") || name.startsWith("cordis:")) return super.import(specifier, getOuterStack);
			const internal = this.ctx.loader.internal;
			/* v8 ignore next -- Node supplies the internal loader; this preserves the
			original diagnostic for hypothetical embedders without it. */
			if (internal === void 0) return super.import(specifier, getOuterStack);
			return internal.import(specifier, bareModuleBaseUrl, {});
		}
	};
	ctx.loader.builtins.group = Group;
	const prepared = prepareProfilePatches(ctx, [...patches], pathToFileURL(dirname(absoluteConfigPath)).href + "/", binName);
	const rootInclude = {
		id: "include",
		name: "cordis:include",
		config: {
			path: pathToFileURL(absoluteConfigPath).href,
			...prepared.length > 0 ? { patches: prepared } : {}
		}
	};
	const includeId = await ctx.loader.create(rootInclude);
	const loader = ctx.get("loader");
	if (loader === void 0) return void 0;
	const entry = loader.resolve(includeId);
	bootstrapIncludes.set(ctx, entry);
	return entry;
}
const assembledActivationRejections = /* @__PURE__ */ new Map();
function retainAssembledRejection(reason) {
	assembledActivationRejections.set(reason, (assembledActivationRejections.get(reason) ?? 0) + 1);
}
function releaseAssembledRejection(reason) {
	const count = assembledActivationRejections.get(reason);
	if (count === void 0 || count === 1) assembledActivationRejections.delete(reason);
	else assembledActivationRejections.set(reason, count - 1);
}
async function observeLoaderRejectionCheckpoint(reasons) {
	for (const reason of reasons) retainAssembledRejection(reason);
	try {
		await new Promise((resolve) => setImmediate(resolve));
	} finally {
		for (const reason of reasons) releaseAssembledRejection(reason);
	}
}
/**
* How long {@link installFailLoud} waits for its `release` hook before exiting
* anyway. A wedged disposer must delay the fatal exit, never cancel it.
*/
const FAIL_LOUD_RELEASE_TIMEOUT_MS = 2e3;
/**
* Install before boot to turn an unhandled rejection or an uncaught exception,
* at any point in the process lifetime, into one labelled stderr diagnostic and
* `exit(1)`. A rejection already included by {@link auditStartupEntries} is
* ignored during its process checkpoint; every other rejection and every
* uncaught exception remains fatal. Control never returns to the failed
* operation after either: only the throw site knows which state is intact, and
* a listener that threw mid-update (a stream `'data'` handler, a half-applied
* registry write) leaves silently wrong results behind if it were resumed. The
* event loop keeps running only until the release hook settles or times out.
* Stdout remains untouched for ACP; the returned function removes both handlers.
*
* The diagnostic is `util.inspect(err)`, not `err.stack`: a `node:fs` error's
* `code`, `syscall`, and `path` and any `cause` chain are enumerable properties
* that the stack line omits, and they are what a crash report needs. Once a
* handler is installed Node prints nothing of its own, so this line is the
* only record of the failure.
*
* The Loader mounts entries concurrently, so a surface that owns the terminal
* can already hold it when a sibling entry rejects. Exiting straight from the
* handler would strand raw mode, bracketed paste, and the keyboard protocol on
* the user's shell, and leave an in-flight terminal query's reply to land as
* literal text at the next prompt. `release` is the terminal owner's chance to
* hand it back; it is awaited under {@link FAIL_LOUD_RELEASE_TIMEOUT_MS}, whose
* timer stays referenced so a never-settling disposer cannot let Node reach an
* empty event loop and exit 0 instead of failing.
*
* The diagnostic is written before the release so a hanging or failing disposer
* cannot swallow the reason. The handler stays installed while the release runs
* — removing it would let a second concurrent rejection become uncaught and kill
* the process mid-teardown, stranding exactly the terminal state this restores —
* so a latch keeps the first rejection the reported one and lets later
* rejections (including the release's own) fall through to the pending exit.
* @param binName - the diagnostic prefix on the fatal-failure line.
* @param proc - the process slice to register on; tests inject a fake.
* @param release - optional teardown awaited before exit, used by a
*   terminal-owning surface to restore the terminal. Its own failure is
*   swallowed because the pending fatal exit already owns the outcome.
* @returns the uninstaller that removes both handlers.
*/
function installFailLoud(binName, proc = process, release) {
	let exiting = false;
	const report = (err, label) => {
		if (exiting) return;
		exiting = true;
		proc.stderr.write(`${binName}: ${label}: ${inspect(err, {
			depth: 4,
			maxArrayLength: 50
		})}\n`);
		if (release === void 0) {
			proc.exit(1);
			return;
		}
		(async () => {
			let timer;
			try {
				await Promise.race([(async () => release())(), new Promise((resolve) => {
					timer = setTimeout(resolve, FAIL_LOUD_RELEASE_TIMEOUT_MS);
				})]);
			} catch {}
			clearTimeout(timer);
			proc.exit(1);
		})();
	};
	const onRejection = (err) => {
		if (assembledActivationRejections.has(err)) return;
		report(err, "fatal load failure");
	};
	const onException = (err) => {
		report(err, "fatal uncaught exception");
	};
	const uninstall = () => {
		proc.off("unhandledRejection", onRejection);
		proc.off("uncaughtException", onException);
	};
	proc.on("unhandledRejection", onRejection);
	proc.on("uncaughtException", onException);
	return uninstall;
}
/**
* Value mirrors used because Cordis's const enum has no runtime object to import.
* Keep aligned with `packages/client/web/src/loader-status.ts`.
*/
const FIBER_PENDING = 0;
const FIBER_ACTIVE = 2;
const FIBER_FAILED = 3;
const FIBER_DISPOSED = 4;
/**
* Entry ids whose presence defines a usable DSH application.
*
* The list is global rather than profile metadata. Missing or disabled ids do
* not affect startup; an enabled listed entry must activate. The list covers
* shared Agent execution, application endpoints, and Web bootstrap/transport.
*/
const requiredStartupEntryIds = new Set([
	"agent-loop",
	"webserver",
	"web-runtime",
	"modules",
	"connection",
	"headless-runner",
	"acp",
	"sdk-jsonrpc-server"
]);
/** Render plugin stacks, nested causes, and aggregate member failures once per error. */
function formatActivationError(error, stacks = true) {
	const details = [];
	const seen = /* @__PURE__ */ new Set();
	function visit(value) {
		if (!(value instanceof Error)) {
			details.push(String(value));
			return;
		}
		if (seen.has(value)) return;
		seen.add(value);
		details.push(stacks ? value.stack ?? value.message : String(value));
		if (value.cause !== void 0) visit(value.cause);
		if (value instanceof AggregateError) value.errors.forEach(visit);
	}
	visit(error);
	return details.join("\n");
}
/** Startup audit failure with non-enumerable metadata and original failures as its cause. */
var StartupError = class extends Error {
	entries;
	/** Root configuration and startup logs, attached by boot after disposal. */
	startup;
	/**
	* @param message - concise terminal diagnostic.
	* @param entries - inactive plugin metadata and original failure values.
	*/
	constructor(message, entries) {
		const failures = entries.flatMap(({ outcome }) => outcome.kind === "failed" ? [outcome.error] : []);
		super(message, failures.length > 0 ? { cause: new AggregateError(failures, "Plugin activation failures") } : void 0);
		this.entries = entries;
		Object.defineProperties(this, {
			entries: { enumerable: false },
			startup: { enumerable: false }
		});
	}
};
/** The error importing an entry's module raises now, which Node returns from its cache for a module that failed before. */
async function importFailure(entry) {
	try {
		await entry.parent.tree.import(entry.options.name);
		return;
	} catch (error) {
		return error;
	}
}
/**
* Collect Loader activation failures and disabled-expression errors. Failed
* fibers are awaited to recover their recorded rejection reason and coalesce
* duplicate Loader notifications through the next process rejection checkpoint.
* An entry whose import failed reports the error importing it raises now; without
* `importNow` nothing is imported and the entry reports a failed import without the import error.
*/
async function inactiveEntries(ctx, importNow = true) {
	const failures = [];
	const rejectionReasons = [];
	for (const entry of ctx.loader.entries()) {
		try {
			if (entry.disabled) continue;
		} catch (error) {
			failures.push({
				entry,
				outcome: {
					kind: "failed",
					error,
					phase: "disabled expression failed"
				}
			});
			continue;
		}
		const fiber = entry.fiber;
		if (fiber === void 0 || fiber.state === FIBER_DISPOSED) {
			const error = importNow ? await importFailure(entry) : void 0;
			failures.push({
				entry,
				outcome: error === void 0 ? {
					kind: "failed",
					error: fiber === void 0 ? "failed to import" : `fiber state ${String(fiber.state)}`
				} : {
					kind: "failed",
					error,
					phase: "failed to import"
				}
			});
			continue;
		}
		const state = fiber.state;
		if (state === FIBER_ACTIVE) continue;
		if (state === FIBER_FAILED) {
			try {
				await fiber.await();
			} catch (error) {
				rejectionReasons.push(error);
				failures.push({
					entry,
					outcome: {
						kind: "failed",
						error
					}
				});
			}
			continue;
		}
		if (state === FIBER_PENDING) {
			const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === void 0);
			failures.push({
				entry,
				outcome: {
					kind: "pending",
					missing
				}
			});
		} else failures.push({
			entry,
			outcome: {
				kind: "failed",
				error: `fiber state ${String(state)}`
			}
		});
	}
	if (rejectionReasons.length > 0) await observeLoaderRejectionCheckpoint(rejectionReasons);
	return failures;
}
/** Render one failed plugin's original error and activation phase. */
function failureDetail(outcome, stacks = true) {
	return `${outcome.phase === void 0 ? "" : `${outcome.phase}: `}${formatActivationError(outcome.error, stacks)}`;
}
/** Render optional-only warnings without changing startup policy. */
function activationDiagnostic(binName, failures, stacks = true) {
	const noun = failures.length === 1 ? "entry" : "entries";
	return `${binName}: warning: ${String(failures.length)} ${noun} did not activate\n${failures.map((failure) => inactiveDiagnostic(failure, stacks)).join("\n")}\n`;
}
/** Per-entry reload text, which people read through the Web UI and agents, so it carries error messages without stack frames. */
function reloadDiagnostic(failure) {
	return inactiveDiagnostic(failure, false);
}
/** Stable per-entry text for reload comparisons and optional warnings. */
function inactiveDiagnostic({ entry, outcome }, stacks = true) {
	const detail = outcome.kind === "failed" ? failureDetail(outcome, stacks) : `pending (waiting for ${outcome.missing.length === 1 ? "service" : "services"}: ${outcome.missing.join(", ") || "unknown"})`;
	return `${entry.options.id} (${entry.options.name}): ${detail}`;
}
/** Group startup failures and pending services, marking every required entry. */
function startupDiagnostic(binName, failures, required) {
	const lines = [`${binName}: startup failed: ${String(required.size)} required ${required.size === 1 ? "plugin" : "plugins"} did not activate`];
	const failed = failures.flatMap(({ entry, outcome }) => outcome.kind === "failed" ? [{
		entry,
		outcome
	}] : []);
	const pending = failures.flatMap(({ entry, outcome }) => outcome.kind === "pending" ? [{
		entry,
		outcome
	}] : []);
	pending.sort((left, right) => Number(required.has(right.entry)) - Number(required.has(left.entry)));
	const label = (entry) => `${entry.options.id}${required.has(entry) ? " (required)" : ""}`;
	if (failed.length > 0) {
		lines.push("", `Failed plugins (${String(failed.length)}):`);
		for (const { entry, outcome } of failed) {
			lines.push(`  ${label(entry)}`, `    Package: ${entry.options.name}`);
			lines.push(...failureDetail(outcome).split("\n").map((line) => `    ${line}`));
		}
	}
	if (pending.length > 0) {
		const width = Math.max(6, ...pending.map(({ entry }) => label(entry).length)) + 2;
		lines.push("", `Plugins waiting for services (${String(pending.length)}):`, `  ${"Plugin".padEnd(width)}Missing services`);
		for (const { entry, outcome } of pending) lines.push(`  ${label(entry).padEnd(width)}${outcome.missing.join(", ") || "unknown"}`);
	}
	return lines.join("\n");
}
/**
* Apply DSH startup policy to a settled Loader tree.
*
* Inactive entries from the global required list reject startup. Other
* inactive entries join that failure diagnostic, or produce one warning when
* no required entry failed and leave successful siblings running.
* Required ids absent from the tree, and disabled required entries, are ignored.
* A throwing disabled expression is an entry failure, not a disabled entry.
* The bootstrap Include must activate so unreadable or invalid root config is fatal.
* @param ctx - the settled context whose Loader entries to audit.
* @param binName - the prefix on startup diagnostics.
* @param warn - sink for optional-entry warnings.
* @returns after optional warnings if required startup checks pass.
* @throws {@link StartupError} when the bootstrap Include or a required entry is inactive or its disabled expression throws;
* its message includes optional failures too.
*/
async function auditStartupEntries(ctx, binName, warn = (line) => void process.stderr.write(line)) {
	const failures = await inactiveEntries(ctx);
	const required = new Set(failures.filter(({ entry }) => entry === bootstrapIncludes.get(ctx) || requiredStartupEntryIds.has(entry.options.id)).map(({ entry }) => entry));
	if (required.size > 0) throw new StartupError(startupDiagnostic(binName, failures, required), failures.map(({ entry, outcome }) => ({
		id: entry.options.id,
		module: entry.options.name,
		required: required.has(entry),
		fiberState: entry.fiber?.state,
		outcome
	})));
	if (failures.length > 0) warn(activationDiagnostic(binName, failures));
}
/**
* Boot the Loader against `absoluteConfigPath` and return only after the whole
* tree settles. Relative entry names resolve against the config directory;
* bare package names resolve there by default or against an explicit
* `bareModuleBaseUrl` for closed packaged runtimes. The bootstrap include
* is statically imported and mounted as the `cordis:include` builtin, loading
* through the ambient module pipeline (vite/tsx/plain ESM). The package build
* embeds Include while leaving Loader external, so the built include tree and
* host share one Loader peer. Loader settlement drains entry work without
* rejecting the whole tree. The final {@link auditStartupEntries} call rejects
* failures in the global required list and warns about other failed, missing,
* and pending entries while successful siblings remain active. Later unhandled
* rejections remain covered by {@link installFailLoud}. Built bins need the Loader's native
* helper for bare plugin specifiers; relative specifiers do not.
* @param binName - the diagnostic prefix for load-failure errors.
* @param absoluteConfigPath - the config to include; must already be absolute
* (see {@link resolveConfigPath}).
* @param patches - optional overlay patches applied over the included tree
* (see {@link loadOptionalPatches}); an empty list mounts none.
* @param prepare - optional host setup run after Loader installation and before any config-tree entry mounts.
* @param bareModuleBaseUrl - optional installed-host base for bare package
* names; use it when the host, rather than the configuration project, owns the
* complete plugin set.
* @returns the root context after the initial startup audit, or as soon as a
* surface disposed the tree while startup was still in flight.
* @throws {@link StartupError} for an inactive required entry, including all inactive plugins in its message;
* otherwise a labelled error after disposing the partial context — `host
* preparation failed` when `prepare` threw before any config-tree entry
* mounted, `plugin tree failed to load` afterwards. Cyclic causes terminate
* diagnostic traversal without replacing the original cause.
*/
async function boot(binName, absoluteConfigPath, patches, prepare, bareModuleBaseUrl) {
	const ctx = new Context();
	const startupLogs = [];
	const diagnostics = new Context();
	diagnostics.logger = ctx.logger;
	diagnostics.logger.exporter({
		levels: { default: 2 },
		export: ({ ts, name, type, args }) => {
			if (type === "warn" || type === "error") startupLogs.push({
				ts,
				name,
				type,
				args
			});
		}
	});
	let stage = "host preparation failed";
	try {
		ctx.baseUrl = pathToFileURL(dirname(absoluteConfigPath)).href + "/";
		ctx.provide("dshHomePath", dshHomePath);
		ctx.on("internal/update", (_config, _noSave, next) => {
			Promise.resolve(next()).catch((error) => {
				ctx.logger.error(error);
			});
		}, {
			global: true,
			prepend: true
		});
		await ctx.plugin(Loader);
		await prepare?.(ctx);
		stage = "plugin tree failed to load";
		await mountRootInclude(ctx, absoluteConfigPath, patches, bareModuleBaseUrl, binName);
		await ctx.get("loader")?.await();
		if (ctx.get("loader") === void 0) return ctx;
		await auditStartupEntries(ctx, binName);
		return ctx;
	} catch (cause) {
		await ctx.fiber.dispose();
		if (cause instanceof StartupError) {
			cause.startup = {
				configurationPath: absoluteConfigPath,
				messages: startupLogs
			};
			throw cause;
		}
		const detail = cause instanceof Error ? cause.message : String(cause);
		let deepest = cause;
		const seen = /* @__PURE__ */ new Set();
		while (deepest instanceof Error && !seen.has(deepest) && deepest.cause !== void 0) {
			seen.add(deepest);
			deepest = deepest.cause;
		}
		const stack = deepest instanceof AggregateError ? `\n${deepest.stack ?? deepest.message}\n${deepest.errors.map((error) => formatActivationError(error)).join("\n")}` : deepest instanceof Error && deepest !== cause ? `\n${deepest.stack ?? deepest.message}` : "";
		throw new Error(`${binName}: ${stage}: ${detail}${stack}`, { cause });
	} finally {
		await diagnostics.fiber.dispose();
	}
}
//#endregion
export { DEFAULT_PROFILE_BUNDLES, FAIL_LOUD_RELEASE_TIMEOUT_MS, LOADER_EXPRESSION_SCHEMA, OFFICIAL_ON_DEMAND_CATALOG, ON_DEMAND_BUNDLES, OPTIONAL_BUNDLES, PROFILES_DIR, PROFILE_COMPATIBILITY_FILENAME, PROFILE_PATCH_FILENAME, PROFILE_TEMPLATES, PluginPackages, ProfileRuntimeResolution, ResolutionRestartRequired, StartupError, auditStartupEntries, boot, bundlePatchFiles, bundlePatchPaths, composeEntries, createConfigProjector, createRuntimeResolution, evaluatePluginCompatibility, generateConfigSchema, getDshRuntimeVersion, initProfile, installFailLoud, isNativeConfigSchema, loadEnv, loadLayeredEnv, loadOptionalPatches, loadOverlayPatches, loadProfile, loadProfileDirectory, mountRootInclude, pluginCompatibilityWarning, prepareProfileEntries, prepareProfilePatches, readBundlePatches, readPluginMeta, readProfileCompatibility, readProfileManifest, readProfilePatches, readProfilePlugins, readProfileVersionExemptions, recomposeProfile, reconcileProfilePatches, reconcileProfilePlugins, removeLinkProjections, renderConfigDump, reportSkippedBundles, resolveBundleDir, resolveConfigPath, resolvePluginResource, resolveProfileDir, resolveTelemetryPatch, sanitizeProfile, setProfileVersionExemption, writeProfileBundles, writeProfileManifest };

export {};
