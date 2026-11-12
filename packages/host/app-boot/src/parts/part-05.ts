/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 3573–4066 của stock lib/index.js (@deepseek-ai/dsh-app-boot): kernel boot library (profile resolution, bundles, config-schema).
 */
// @ts-nocheck

//#region lib/types/index.js
/**
* Shared boot glue for `dsh` profiles, including the CLI packaged by the Python runtime wheel: load the gitignored
* `.env`, install the fail-loud Loader guards, resolve the config path (snapshot-aware), load the
* optional user patch layers from the Harness home (`~/.dsh`), expose its path resolver to
* config expressions, and drive the Cordis Loader against a leaf `cordis.yml` until the tree settles.
* @module @deepseek-ai/dsh-app-boot
*/
/**
* Resolve the config to boot. Replay swaps a `cordis.yml` basename for
* `cordis.snapshot.yml` in the same directory; every other mode keeps the path.
* @param configPath - the requested config path (absolute, or relative to `cwd`).
* @param snapshotMode - the bin's `$DSH_SNAPSHOT` value; only `'replay'` swaps the
*   basename.
* @param cwd - the base a relative `configPath` resolves against.
* @returns the absolute path of the config to boot.
*/
function resolveConfigPath(configPath, snapshotMode, cwd = process.cwd()) {
	const absolute = resolve(cwd, configPath);
	if (snapshotMode !== "replay") return absolute;
	return resolve(dirname(absolute), basename(absolute).replace(/cordis\.ya?ml$/, "cordis.snapshot.yml"));
}
/**
* Load the optional gitignored `.env` from `dir`. Missing files fall back to the
* ambient environment; other read failures are reported through `warn`.
* @param binName - the diagnostic prefix on the warn line.
* @param dir - the directory whose `.env` to load.
* @param warn - sink for the one-line misconfiguration diagnostic.
*/
function loadEnv(binName, dir = process.cwd(), warn = (line) => void process.stderr.write(line)) {
	try {
		process.loadEnvFile(resolve(dir, ".env"));
	} catch (error) {
		if (error?.code !== "ENOENT") warn(`${binName}: failed to load .env: ${String(error)}\n`);
	}
}
/** Exact names no discovered file may set. */
const BOOTSTRAP_NAMES = new Set([
	"PATH",
	"HOME",
	"USERPROFILE",
	"SHELL",
	"NODE_OPTIONS",
	"NODE_PATH",
	"NODE_EXTRA_CA_CERTS",
	"LD_PRELOAD",
	"LD_LIBRARY_PATH",
	"LD_AUDIT",
	"BASH_ENV",
	"ENV",
	"SHELLOPTS",
	"BASHOPTS",
	"PERL5OPT",
	"PERL5LIB",
	"PYTHONSTARTUP",
	"PYTHONPATH",
	"RUBYOPT",
	"RUBYLIB",
	"JAVA_TOOL_OPTIONS",
	"_JAVA_OPTIONS",
	"JDK_JAVA_OPTIONS",
	"PYTHONHOME",
	"GIT_SSH",
	"GIT_SSH_COMMAND",
	"GIT_EXTERNAL_DIFF",
	"GIT_PAGER",
	"GIT_EDITOR",
	"GIT_ASKPASS",
	"SSH_ASKPASS",
	"GIT_CONFIG_GLOBAL",
	"GIT_CONFIG_SYSTEM",
	"GIT_CONFIG_COUNT",
	"EDITOR",
	"VISUAL",
	"PAGER",
	"BROWSER",
	"DEEPSEEK_BASE_URL",
	"DEEPSEEK_SEARCH_BASE_URL",
	"SSL_CERT_FILE",
	"SSL_CERT_DIR",
	"HTTP_PROXY",
	"HTTPS_PROXY",
	"ALL_PROXY",
	"NO_PROXY",
	"REQUESTS_CA_BUNDLE",
	"CURL_CA_BUNDLE",
	"NODE_TLS_REJECT_UNAUTHORIZED"
]);
/** Name prefixes no discovered file may set. */
const BOOTSTRAP_PREFIXES = [
	"DSH_",
	"XDG_",
	"DYLD_",
	"BASH_FUNC_"
];
/**
* The bootstrap names the Harness-home `.env` alone may set. A proxy chooses the route every
* request takes, so the invoking directory's file — which arrives with a clone — keeps refusing
* them; the home file is the user's own, and `DSH_HOME` is itself bootstrap-only, so no `.env` can
* relocate this exemption. The CA and TLS names in the same group stay refused everywhere: they
* change what is trusted, not where traffic goes.
*/
const HOME_LAYER_PROXY_NAMES = new Set([
	"HTTP_PROXY",
	"HTTPS_PROXY",
	"ALL_PROXY",
	"NO_PROXY"
]);
/**
* Whether a variable may come only from the inherited process environment
* because it changes process, runtime, VCS, or network bootstrap. The Harness-home
* file is additionally allowed {@link HOME_LAYER_PROXY_NAMES}.
* @param name - the variable name.
* @returns true when only the inherited environment may supply it.
*/
function isBootstrapOnly(name) {
	const upper = name.toUpperCase();
	return BOOTSTRAP_NAMES.has(upper) || BOOTSTRAP_PREFIXES.some((prefix) => upper.startsWith(prefix));
}
/**
* Parse one directory's `.env` without applying it, rejecting bootstrap-only
* names before any value is materialized.
* @param binName - the diagnostic prefix on the thrown error.
* @param dir - the directory whose `.env` to read.
* @param warn - sink for the one-line unreadable-file diagnostic.
* @param home - the resolved Harness home; when `dir` is it, {@link HOME_LAYER_PROXY_NAMES} are accepted.
* @returns the parsed entries, or `undefined` when the file is absent or unreadable.
* @throws when the file declares a name {@link isBootstrapOnly} rejects and this layer may not set.
*/
function readEnvLayer(binName, dir, warn, home) {
	const path = resolve(dir, ".env");
	const isHome = resolve(dir) === home;
	let content;
	try {
		content = readFileSync(path, "utf8");
	} catch (error) {
		if (error?.code !== "ENOENT") warn(`${binName}: failed to load .env: ${String(error)}\n`);
		return;
	}
	const values = parseEnv(content);
	for (const name of Object.keys(values)) {
		if (!isBootstrapOnly(name)) continue;
		const proxyName = HOME_LAYER_PROXY_NAMES.has(name.toUpperCase());
		if (isHome && proxyName) continue;
		const remedy = proxyName ? `export ${name}, or put it in ${resolve(home, ".env")}, which does not travel with a repository` : `export ${name} instead of putting it in a .env file`;
		throw new Error(`${binName}: ${path} sets "${name}", which only the launching environment may set (it decides how this process starts, where its code and instructions load from, or how it reaches the network); ${remedy}`);
	}
	return {
		path,
		values
	};
}
/**
* Load the product CLI's inherited > invoking-directory `.env` > Harness-home
* `.env` snapshot. The Harness home resolves before either file; both files
* are checked before either is applied, and accepted values are materialized
* without replacing inherited ones. The snapshot preserves which layer supplied each value.
* @param binName - the diagnostic prefix on the diagnostics.
* @param cwd - the invoking directory whose `.env` is the project layer.
* @param warn - sink for the one-line misconfiguration diagnostics.
* @returns this run's frozen environment snapshot.
* @throws when either file declares a bootstrap-only variable, except {@link HOME_LAYER_PROXY_NAMES} in the Harness-home file.
*/
function loadLayeredEnv(binName, cwd = process.cwd(), warn = (line) => void process.stderr.write(line)) {
	const home = resolveDshHome();
	const inherited = { ...process.env };
	const project = readEnvLayer(binName, cwd, warn, home);
	const user = home === resolve(cwd) ? void 0 : readEnvLayer(binName, home, warn, home);
	for (const layer of [project, user]) {
		if (layer === void 0) continue;
		for (const [name, value] of Object.entries(layer.values)) if (process.env[name] === void 0) process.env[name] = value;
	}
	return createLaunchEnvironmentSnapshot([
		{
			source: "process",
			values: inherited
		},
		...project === void 0 ? [] : [{
			source: "project-env",
			path: project.path,
			values: project.values
		}],
		...user === void 0 ? [] : [{
			source: "user-env",
			path: user.path,
			values: user.values
		}]
	]);
}
const bootstrapIncludes = /* @__PURE__ */ new WeakMap();
const userPatchesSchema = entryListSchema;
/**
* Recompose the profile from its complete patch list, together with its runtime resolution. The rows the generation no
* longer lists are removed first and their disposal finishes while their packages are still mapped; the latest
* generation of an installed, recomputable resolution is published; the compatibility preflight reads the published
* packages; the generation is applied to the root Include; entries that ran, and enabled entries whose import failed,
* start afterwards when the update left them without a running fiber; and activation is judged. A failure before the generation applies,
* including a publication the resolution rejects, which reports `package-moved`, puts the removed rows back at their
* places, starting them again, and starts the entries that ran again. An entry waiting for a service is reported as a
* warning unless it is required. Patches are copied with `structuredClone`, so they hold no functions.
* @param ctx Booted root context.
* @param patches Complete ordered patch list.
* @param binName Diagnostic prefix.
* @param options What the caller already did and requires.
* @returns Diagnostics for unchanged pre-existing inactive entries, and the restart reason of a rejected publication.
* @throws When the root Include is missing; the latest resolution cannot be read or published; preparation or the
* Loader update rejects; or for a new or changed failure, an inactive required entry, a failed entry that ran, or a
* healthy fiber whose disposal rejected.
*/
function recomposeProfile(ctx, patches, binName, options = {}) {
	return recompose(ctx, patches, binName, options, true);
}
/**
* Apply a complete patch list to the root Include and judge activation, leaving the runtime resolution and entries
* whose import failed as they are.
* @param ctx Booted root context.
* @param patches Complete ordered patch list.
* @param binName Diagnostic prefix.
* @param requiredIds Explicit enablement targets whose existing failures also reject reconciliation.
* @returns Diagnostics for unchanged pre-existing inactive entries; new or changed failures reject.
*/
async function reconcileProfilePatches(ctx, patches, binName, requiredIds = []) {
	return (await recompose(ctx, patches, binName, { requiredIds }, false)).warnings;
}
async function recompose(ctx, patches, binName, options, withResolution) {
	const { requiredIds = [], running = [] } = options;
	let applying = false;
	let stopped = [];
	try {
		const entry = bootstrapIncludes.get(ctx);
		if (entry === void 0) throw new Error(`${binName}: profile reload requires the root Include entry`);
		const previousFailures = (await inactiveEntries(ctx, false)).map((failure) => ({
			entry: failure.entry,
			fiber: failure.entry.fiber,
			options: JSON.stringify(failure.entry.options),
			diagnostic: failure.entry.fiber?.uid ? reloadDiagnostic(failure) : void 0
		}));
		const previousFibers = [...ctx.loader.entries()].flatMap((row) => row.fiber === void 0 ? [] : [{
			fiber: row.fiber,
			failed: row.fiber.state === FIBER_FAILED || row.fiber.state === FIBER_DISPOSED
		}]);
		const { patches: previous = [], ...includeConfig } = entry.options.config;
		const current = withResolution ? ctx.get("pluginPackages")?.resolution : void 0;
		const successor = current instanceof ProfileRuntimeResolution ? await current.computeLatestResolution() : void 0;
		if (successor !== void 0) {
			const listed = rowIds(structuredClone(patches));
			const composed = rowIds(structuredClone(previous));
			const tree = entry.subgroup?.tree;
			const dropped = [...ctx.loader.entries()].filter((row) => row.parent.tree === tree && composed.has(row.options.id) && !listed.has(row.options.id));
			const ids = new Set(dropped.map((row) => row.options.id));
			const topmost = dropped.filter((row) => !ids.has(row.parent.ctx.fiber.entry?.options.id));
			stopped = topmost.map((row) => ({
				group: row.parent,
				options: structuredClone(row.options),
				index: row.parent.data.indexOf(row.options)
			}));
			if (topmost.length > 0) {
				const fibers = dropped.flatMap((row) => row.fiber === void 0 ? [] : [row.fiber]);
				for (const row of topmost) {
					row.options.disabled = true;
					row.parent.remove(row.options.id);
				}
				await Promise.allSettled(fibers.map((fiber) => fiber.await()));
				await ctx.loader.await();
			}
			try {
				publish(ctx, successor);
			} catch (error) {
				if (!(error instanceof ResolutionRestartRequired)) throw error;
				return {
					warnings: [],
					restartReason: "package-moved"
				};
			}
		}
		const parentURL = new URL(".", new URL(includeConfig.path, entry.parent.tree.ctx.baseUrl)).href;
		const prepared = prepareProfilePatches(ctx, patches, parentURL, binName);
		applying = true;
		const retried = [...new Set([...running, ...withResolution ? [...ctx.loader.entries()].filter(importFailed) : []])];
		try {
			await entry.update({ config: {
				...includeConfig,
				patches: prepared
			} });
		} finally {
			await resume(ctx, retried);
		}
		const results = await Promise.allSettled(previousFibers.map(({ fiber }) => fiber.await()));
		await ctx.loader.await();
		const failures = await inactiveEntries(ctx);
		const introduced = failures.filter((failure) => {
			if (requiredIds.includes(failure.entry.options.id)) return true;
			if (failure.outcome.kind === "pending") return false;
			if (running.includes(failure.entry)) return true;
			return !previousFailures.some((previous) => sameFailure(previous, failure));
		});
		if (introduced.length > 0) throw new Error(activationDiagnostic(binName, introduced, false).trimEnd());
		for (const [index, result] of results.entries()) if (result.status === "rejected" && !previousFibers[index]?.failed) throw result.reason;
		ctx.emit("app-boot/config-reload");
		return { warnings: failures.map(reloadDiagnostic) };
	} finally {
		if (!applying && (stopped.length > 0 || running.length > 0)) try {
			for (const { group, options, index } of stopped.toSorted((left, right) => left.index - right.index)) {
				group.data.splice(index, 0, options);
				await group.create(options);
			}
			await resume(ctx, running);
			const ran = new Set(running.map((row) => row.options.id));
			for (const failure of await inactiveEntries(ctx)) if (ran.has(failure.entry.options.id)) ctx.logger.warn(`${binName}: ${reloadDiagnostic(failure)}`);
		} catch (error) {
			ctx.logger.warn(error);
		}
	}
}
/** Whether an inactive entry is the failure recorded before: the same entry, fiber and options, and a matching diagnostic. */
function sameFailure(previous, failure) {
	return previous.entry === failure.entry && previous.fiber === failure.entry.fiber && previous.options === JSON.stringify(failure.entry.options) && (previous.diagnostic === void 0 || previous.diagnostic === reloadDiagnostic(failure));
}
/** The ids of the rows a patch list inserts, including the rows of groups. */
function rowIds(patches) {
	const ids = /* @__PURE__ */ new Set();
	const visit = (rows) => {
		for (const row of rows) {
			ids.add(row.id);
			if ((row.group === true || row.name === "cordis:group") && Array.isArray(row.config)) visit(row.config);
		}
	};
	visit(applyEntryPatches([], patches, () => {}));
	return ids;
}
/** Publish a generation unless it maps exactly what is published, which would only drop the package caches. */
function publish(ctx, next) {
	const table = ({ localPackageNames, entries, linkedRoots }) => JSON.stringify([
		localPackageNames,
		entries,
		linkedRoots
	]);
	const packages = ctx.pluginPackages;
	if (table(packages.resolution) !== table(next)) packages.replace(next);
}
/** Whether an enabled entry below a running parent has no fiber or keeps the disposed fiber of a failed import. */
function importFailed(entry) {
	return enabledEntry(entry) && entry.parent.ctx.fiber.uid !== null && (entry.fiber === void 0 || entry.fiber.state === FIBER_DISPOSED);
}
/** Whether an entry is enabled now; a throwing `disabled` expression counts as disabled. */
function enabledEntry(entry) {
	try {
		return !entry.disabled;
	} catch (_error) {
		return false;
	}
}
/** Start invalidated entries the Loader still holds without a running fiber, then wait until it settles. */
async function resume(ctx, invalidated) {
	const entries = new Set(ctx.loader.entries());
	for (const row of invalidated) if (entries.has(row) && !row.fiber?.uid) await row.update({}, false, true);
	await ctx.loader.await();
}
/**
* Load an optional patch-list file: a top-level YAML array of loader patch
* entries (`@deepseek-ai/cordis-plugin-include`'s `PatchOptions`): id-targeted config
* overrides and `insert` lists, with `!!js` expressions allowed. A missing
* file means "no layer"; an unreadable, unparsable, or non-array file throws —
* a present patch file that cannot apply is a misconfiguration and must fail
* loud at boot, never be silently skipped.
* @param binName - the diagnostic prefix on the thrown error.
* @param file - absolute path of the patch file.
* @returns the parsed patches, or `undefined` when the file does not exist.
*/
function loadOptionalPatches(binName, file) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return void 0;
		throw new Error(`${binName}: failed to read patches ${file}: ${String(error)}`);
	}
	return parsePatchList(binName, file, content, "patches");
}
/**
* Load a required overlay patch list: a bundle's `cordis.patch.yml` or a
* `--patch <path>` overlay. Same file format as {@link loadOptionalPatches},
* but a missing file throws, because the caller named this file — its absence
* is a misconfiguration, not "no overlay".
* @param binName - the diagnostic prefix on the thrown error.
* @param file - absolute path of the overlay file.
* @returns the parsed patch list.
*/
function loadOverlayPatches(binName, file) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch (error) {
		throw new Error(`${binName}: failed to read overlay ${file}: ${String(error)}`);
	}
	return parsePatchList(binName, file, content, "overlay");
}
/** Convert inserted filesystem paths to file URLs, anchoring relative paths beside the patch; keep assertion names literal. */
function anchorInsertedPluginNames(patches, file) {
	const base = dirname(resolve(file));
	const visit = (entry) => {
		if (typeof entry.name === "string" && (isAbsolute(entry.name) || entry.name.startsWith("./") || entry.name.startsWith("../"))) entry.name = pathToFileURL(resolve(base, entry.name)).href;
		if (entry.group && Array.isArray(entry.config)) entry.config.forEach(visit);
	};
	for (const patch of patches) patch.insert?.forEach(visit);
	return patches;
}
/**
* Parse one loader patch list: a top-level YAML array of
* `@deepseek-ai/cordis-plugin-include` `PatchOptions` (id-targeted config overrides and
* `insert` lists, `!!js` expressions allowed). Every invalid field or value throws,
* because a patch file that cannot be applied at all is a misconfiguration; a
* single patch whose target row is absent stays a per-entry Loader warning, so
* one overlay shared across surfaces does not have to match every tree.
* @param binName - the diagnostic prefix on the thrown error.
* @param file - the source path, quoted in errors.
* @param content - the file's text.
* @param label - what to call this list in errors (`patches`, `overlay`).
* @returns the parsed patch list.
*/
function parsePatchList(binName, file, content, label) {
	let parsed;
	try {
		parsed = yaml.load(content, { schema: userPatchesSchema });
	} catch (error) {
		throw new Error(`${binName}: failed to parse ${label} ${file}: ${String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error(`${binName}: ${label} ${file} must be a top-level YAML array of loader patch entries`);
	parsed.forEach((entry, index) => {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error(`${binName}: ${label} entry ${index + 1} in ${file} must be a mapping (a loader patch entry)`);
	});
	return anchorInsertedPluginNames(parsed, file);
}
/**
* Compose the configured entry list: parse the base config file with the
* include's entry-list dialect, apply every layer's patches as ONE flattened
* list through the include's own patch algorithm (`applyEntryPatches`) — the
* same call `boot()` makes, so even patch-visibility corner cases (a later
* layer targeting a group child a plain config replacement introduced, which
* the single-pass id index never sees) compose identically — then render the
* result as YAML in the same dialect (`!!js` expressions print verbatim,
* unevaluated). Row admission is a later stage: a plugin row the compatibility
* policy denies still appears here, while a denied bundle contributes no layer.
*
* Every run of rows from the same file and patch layers is preceded by a `# ==` comment
* naming the file that contributed the rows and any layers that patched them,
* so the output stays a loadable YAML document while showing which section
* comes from which file. The file and patch labels are derived from single-call prefix
* snapshots (base + layers 1..k), diffed positionally: the patch algorithm
* only rewrites rows in place or appends, so a top-level index identifies one
* row across snapshots, and a layer whose addition changes the row (config
* replacement, disable, group insert) is listed as having patched it.
*
* A patch that matches no row is reported through `warn` with its layer
* label, mirroring the Loader's boot-time warning. Earlier layers' patches
* see an identical preceding state in every snapshot that includes them, so
* each snapshot's warning list extends the previous one and the new tail
* belongs to the added layer.
* @param binName - the diagnostic prefix on read/parse errors.
* @param absoluteConfigPath - the base config file `boot()` would include.
* @param layers - overlay layers in application order (later wins).
* @param warn - sink for skipped-patch diagnostics; defaults to stderr.
* @returns the composed entry list rendered as a YAML document with
* source comment separators.
*/
function renderConfigDump(binName, absoluteConfigPath, layers, warn = (line) => void process.stderr.write(`${line}\n`)) {
	let content;
	try {
		content = readFileSync(absoluteConfigPath, "utf8");
	} catch (error) {
		throw new Error(`${binName}: failed to read config ${absoluteConfigPath}: ${String(error)}`);
	}
	let parsed;
	try {
		parsed = yaml.load(content, { schema: entryListSchema });
	} catch (error) {
		throw new Error(`${binName}: failed to parse config ${absoluteConfigPath}: ${String(error)}`);
	}
	if (!Array.isArray(parsed)) throw new Error(`${binName}: config ${absoluteConfigPath} must be a top-level YAML array of entries`);
	const baseLabel = basename(absoluteConfigPath);
	const base = parsed;
	const snapshot = (count, warnings) => {
		return applyEntryPatches(base, structuredClone(layers.slice(0, count).flatMap((layer) => layer.patches)), (message, ...args) => {
			let index = 0;
			warnings.push(message.replace(/%C/g, () => JSON.stringify(args[index++])));
		});
	};
	let previous = base;
	let previousWarnings = [];
	const entryOrigins = base.map(() => ({
		origin: baseLabel,
		patchedBy: []
	}));
	let composed = base;

export {};
