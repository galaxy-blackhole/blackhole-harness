/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 1–482 của stock lib/index.js (@deepseek-ai/dsh-app-boot): kernel boot library (profile resolution, bundles, config-schema).
 */
// @ts-nocheck

import { createRequire, isBuiltin } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs, { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { inspect, parseEnv } from "node:util";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import * as yaml from "js-yaml";
import { load } from "js-yaml";
import { Context, Service } from "@deepseek-ai/cordis";
import Loader, { EntryGroup, EntryTree, ModuleLoader, isJsExpr } from "@deepseek-ai/cordis-plugin-loader";
import { access, constants, mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import Group from "@deepseek-ai/cordis-plugin-group";
import { dshHomePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { createLaunchEnvironmentSnapshot } from "@deepseek-ai/dsh-launch-environment";
import semver, { parse } from "semver";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { getEnvironmentData, setEnvironmentData } from "node:worker_threads";
import { imports } from "resolve.exports";
//#region ../../../vendor/include/src/index.ts
const JsExpr = new yaml.Type("tag:yaml.org,2002:js", {
	kind: "scalar",
	resolve: (data) => typeof data === "string",
	construct: (data) => ({ __jsExpr: data }),
	predicate: isJsExpr,
	represent: (data) => data["__jsExpr"]
});
/**
* The entry-list YAML dialect: `!!js` scalars round-trip as expression nodes
* the Loader evaluates at entry activation. Exported so config tooling
* (`dsh --dump-config`) parses and prints exactly the dialect this include
* mounts.
*/
const entryListSchema = yaml.JSON_SCHEMA.extend(JsExpr);
const schema = entryListSchema;
const writable = {
	".json": "application/json",
	".yaml": "application/yaml",
	".yml": "application/yaml"
};
const supported = new Set(Object.keys(writable));
const WRITE_RETRY_LIMIT = 10;
const WRITE_RETRY_DELAY_MS = 50;
function retryableWriteError(error) {
	const code = error?.code;
	return code === "EACCES" || code === "EBUSY" || code === "EPERM";
}
/**
* Apply patch lists to an entry list — THE patch semantics of this include,
* shared by mounting (`applyPatches`) and offline config tooling
* (`dsh --dump-config`) so a dump can never drift from what boots. The input
* is never mutated: patching shared entry objects would bake earlier patch
* values into the cached parse, so repeated application (config hot-reloads)
* could never revert a removed or changed patch. Inserted entries are indexed
* as they are added, so a later patch in the same list can target a row an
* earlier patch inserted. A patch that matches nothing warns and is skipped.
* @param data - the parsed entry list (JSON-safe plain data).
* @param patches - the patch list to apply, in order.
* @param warn - sink for skipped-patch diagnostics (printf-style, `%C` = code).
* @returns a detached entry list with every applicable patch applied.
*/
function applyEntryPatches(data, patches, warn) {
	if (!patches?.length) return [...data];
	data = structuredClone(data);
	const entryMap = /* @__PURE__ */ new Map();
	const buildMap = (entries) => {
		for (const entry of entries) {
			if (entry.id) entryMap.set(entry.id, entry);
			if (entry.group && Array.isArray(entry.config)) buildMap(entry.config);
		}
	};
	buildMap(data);
	for (const patch of patches) {
		const { id, insert, name, ...overrides } = patch;
		if (insert) {
			if (id) {
				const target = entryMap.get(id);
				if (!target) {
					warn("patch insert: entry %C not found", id);
					continue;
				}
				if (!target.group) {
					warn("patch insert: entry %C is not a group", id);
					continue;
				}
				if (!Array.isArray(target.config)) target.config = [];
				target.config.push(...insert);
			} else data.push(...insert);
			buildMap(insert);
			continue;
		}
		if (!id) {
			warn("patch: id is required for non-insert patches");
			continue;
		}
		const target = entryMap.get(id);
		if (!target) {
			warn("patch: entry %C not found", id);
			continue;
		}
		if (name && name !== target.name) {
			warn("patch: name mismatch for %C (expected %C, got %C), skipping", id, target.name, name);
			continue;
		}
		for (const [key, value] of Object.entries(overrides)) {
			if (key === "id") continue;
			target[key] = value;
		}
	}
	return data;
}
/** Loader entry tree backed by a YAML or JSON file. */
var Include = class extends EntryTree {
	config;
	static inject = ["loader"];
	static [EntryGroup.key] = true;
	filename;
	type;
	readonly;
	content;
	data;
	writeTask;
	pendingWrite;
	writeQueue = Promise.resolve();
	constructor(ctx, config) {
		super(ctx);
		this.config = config;
		this.enableLogs = config.enableLogs ?? ctx.fiber.entry?.parent.tree.enableLogs ?? false;
		this.filename = fileURLToPath(new URL(this.config.path, this.ctx.baseUrl));
		const ext = extname(this.filename);
		if (!supported.has(ext)) throw new Error(`extension "${ext}" not supported`);
		this.type = writable[ext];
		this.readonly = !this.type;
		this.ctx.baseUrl = new URL(".", pathToFileURL(this.filename)).href;
		ctx.on("internal/update", (config, _, next) => {
			if (config.path !== this.config.path) return next();
			this.config = config;
			this.root.update(this.applyPatches(this.data, config.patches)).catch((error) => {
				this.ctx.logger.warn("config update at %C failed", this.filename);
				this.ctx.logger.warn(error);
			});
		});
	}
	async checkAccess() {
		if (!this.type) return;
		try {
			await access(this.filename, constants.W_OK);
		} catch {
			this.readonly = true;
		}
	}
	async read(forced = false) {
		const content = await readFile(this.filename, "utf8");
		if (!forced && this.content === content) return false;
		let data;
		if (this.type === "application/yaml") data = yaml.load(content, { schema: entryListSchema });
		else if (this.type === "application/json") data = JSON.parse(content);
		else {
			const module = await import(
				/* @vite-ignore */
				this.filename
);
			data = module.default || module;
		}
		if (!Array.isArray(data)) throw new TypeError(`config file must be a top-level array of entries: ${this.filename}`);
		this.content = content;
		this.data = data;
		await this.checkAccess();
		return true;
	}
	applyPatches(data, patches = this.config.patches) {
		return applyEntryPatches(data, patches, (message, ...args) => {
			this.ctx.root.logger?.("loader").warn(message, ...args);
		});
	}
	async *[Service.init]() {
		try {
			await this.read();
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
			if (this.config.initial) {
				await this._writeFile(this.config.initial);
				await this.read(true);
			} else throw new Error(`config file not found: ${this.filename}`);
		}
		yield () => this.stop();
		await this.root.update(this.applyPatches(this.data));
	}
	async stop() {
		try {
			await this.flushWrite();
		} finally {
			this.root.stop();
			await this.flushWrite();
		}
	}
	/**
	* Re-read the file and refresh child entries when content changed. An
	* unreadable or unparsable file logs a warning and keeps the last good
	* tree: a hot-reload of a live app must never take the process down.
	*/
	async refresh() {
		try {
			if (!await this.read()) return;
			await this.root.update(this.applyPatches(this.data));
		} catch (error) {
			this.ctx.logger.warn("config reload at %C failed; keeping the running tree", this.filename);
			this.ctx.logger.warn(error);
		}
	}
	async _writeFile(config) {
		if (this.readonly) throw new Error(`cannot overwrite readonly config`);
		if (this.type === "application/yaml") this.content = yaml.dump(config, { schema });
		else if (this.type === "application/json") this.content = JSON.stringify(config, null, 2);
		await writeFile(this.filename + ".tmp", this.content);
		for (let retry = 0;; retry++) try {
			await rename(this.filename + ".tmp", this.filename);
			return;
		} catch (error) {
			if (!retryableWriteError(error) || retry >= WRITE_RETRY_LIMIT) throw error;
			await setTimeout$1((retry + 1) * WRITE_RETRY_DELAY_MS);
		}
	}
	writeFile(config) {
		clearTimeout(this.writeTask);
		this.pendingWrite = config;
		this.writeTask = setTimeout(() => {
			this.flushWrite();
		}, 0);
	}
	flushWrite() {
		clearTimeout(this.writeTask);
		this.writeTask = void 0;
		const config = this.pendingWrite;
		this.pendingWrite = void 0;
		if (config === void 0) return this.writeQueue;
		const run = this.writeQueue.then(() => this._writeFile(config), () => this._writeFile(config));
		this.writeQueue = run;
		run.catch((error) => {
			this.ctx.root.logger?.("loader").warn("failed to write config file %C", this.filename);
			this.ctx.root.logger?.("loader").warn(error);
		});
		return run;
	}
	/** Schedule a write of the current root entry data. */
	write() {
		this.context.emit("loader/config-update");
		return this.writeFile(this.root.data);
	}
};
//#endregion
//#region lib/types/plugin-compatibility.js
/** Evaluate plugin dsh requirements (`engines.dsh`, else dsh peers) without importing plugin code. */
function objectOf$1(value, field) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${field} must be an object`);
	return value;
}
function runtimeVersionOf(value) {
	if (typeof value !== "string" || semver.valid(value) === null) throw new Error(`Invalid dsh runtime version: ${JSON.stringify(value)}; expected a semantic version`);
	return value;
}
function identityField(manifest, field) {
	const value = Object.hasOwn(manifest, field) ? manifest[field] : void 0;
	if (typeof value !== "string" || value.trim() === "") throw new Error(`Plugin manifest ${field} must be a non-empty string when dsh requirements are unmet`);
	return value;
}
/**
* Read this app-boot package's version in both source and bundled installations.
* @returns the validated runtime semantic version, preserving its exact spelling.
* @throws if package.json cannot be read or its version is missing or invalid.
*/
function getDshRuntimeVersion() {
	const filename = fileURLToPath(new URL("../package.json", import.meta.url));
	const manifest = objectOf$1(JSON.parse(fs.readFileSync(filename, "utf8")), "app-boot package.json");
	return runtimeVersionOf(Object.hasOwn(manifest, "version") ? manifest.version : void 0);
}
function satisfies(runtimeVersion, range) {
	return range.trim() !== "" && semver.satisfies(runtimeVersion, range, { includePrerelease: true });
}
function unmetRequirements(fields, runtimeVersion) {
	const engines = Object.hasOwn(fields, "engines") ? objectOf$1(fields.engines, "Plugin manifest engines") : {};
	if (Object.hasOwn(engines, "dsh")) {
		const range = engines.dsh;
		if (typeof range !== "string") throw new Error("Plugin manifest engines.dsh must be a string");
		return satisfies(runtimeVersion, range) ? {} : { "engines.dsh": range };
	}
	if (!Object.hasOwn(fields, "peerDependencies")) return {};
	const dependencies = objectOf$1(fields.peerDependencies, "Plugin manifest peerDependencies");
	const unmet = {};
	for (const [name, range] of Object.entries(dependencies)) {
		if (typeof range !== "string") throw new Error(`Plugin manifest peerDependencies[${JSON.stringify(name)}] must be a string`);
		if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;
		if (!satisfies(runtimeVersion, [
			"workspace:^",
			"workspace:~",
			"workspace:*"
		].includes(range) ? runtimeVersion : range)) unmet[name] = range;
	}
	return unmet;
}
/**
* Check the plugin's dsh requirements against the runtime. An own `engines.dsh` range decides alone and
* peerDependencies are ignored; otherwise every @deepseek-ai/dsh or @deepseek-ai/dsh-* peer must match.
* Prereleases participate in ranges. For peers only, workspace:^, workspace:~, and workspace:* refer to
* the current runtime; other empty or invalid ranges, including any workspace: `engines.dsh`, are unmet.
* @param manifest - parsed plugin package.json; inherited fields are ignored.
* @param exemptions - exact plugin name@version keys mapped to exact runtime versions.
* @param runtimeVersion - running dsh version, defaulting to this app-boot package.
* @returns unmet requirements and exemption status, or undefined when every requirement is met.
* @throws for malformed manifest engines or peer fields, invalid runtime versions, or missing identity on a mismatch.
*/
function evaluatePluginCompatibility(manifest, exemptions = {}, runtimeVersion = getDshRuntimeVersion()) {
	runtimeVersionOf(runtimeVersion);
	const fields = objectOf$1(manifest, "Plugin manifest");
	const requirements = unmetRequirements(fields, runtimeVersion);
	if (Object.keys(requirements).length === 0) return void 0;
	const name = identityField(fields, "name");
	const version = identityField(fields, "version");
	const key = `${name}@${version}`;
	return {
		name,
		version,
		runtimeVersion,
		requirements,
		exempted: (Object.hasOwn(exemptions, key) ? exemptions[key] : void 0)?.includes(runtimeVersion) === true
	};
}
/**
* Describe unmet requirements, their risk, and the exact-version remedy.
* Surfaces with their own grant mechanism or locale render the structured result themselves.
* @param issue - incompatible plugin/runtime result, including exempted mismatches.
* @returns an English diagnostic for logs and stderr.
*/
function pluginCompatibilityWarning(issue) {
	const key = `${issue.name}@${issue.version}`;
	return `Plugin ${key} is incompatible with dsh ${issue.runtimeVersion}: requirements ${JSON.stringify(issue.requirements)}. Running it may cause crashes or data loss. Update the plugin or install a plugin version compatible with this dsh runtime. To accept this risk explicitly, grant the exact-version exemption for ${key} on dsh ${issue.runtimeVersion} with \`dsh plugin allow-version\` or the plugin manager, then retry the installation or restart dsh. Exact-version exemption: ${issue.exempted ? "active" : "not active"}.`;
}
//#endregion
//#region lib/types/profile-compatibility.js
/** Profile-local compatibility permissions readable before any Cordis plugins load. */
/** Independent profile metadata; neither package manifests nor Cordis patches carry grants. */
const PROFILE_COMPATIBILITY_FILENAME = "compatibility.json";
/** Published and scoped npm package names, as npm accepts them in a manifest dependency key. */
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
/** Whether a decoded record accepts only exact DSH versions. */
function isVersionList(value) {
	return Array.isArray(value) && value.every((version) => typeof version === "string" && isExactPluginVersion(version));
}
/** Test whether an exemption names a canonical exact SemVer, including build metadata.
* @param value Version supplied by a manifest or user.
* @returns False for ranges, prefixes, whitespace, and malformed versions.
*/
function isExactPluginVersion(value) {
	const parsed = parse(value);
	return parsed !== null && value === `${parsed.version}${parsed.build.length === 0 ? "" : `+${parsed.build.join(".")}`}`;
}
/** Validate one explicit exemption without granting it.
* @param packageVersion Exact npm package-name@version, never an installation spec or range.
* @param runtimeVersion Exact DSH version, including prerelease and build metadata.
* @throws When either identity is not canonical.
*/
function validatePluginVersionExemption(packageVersion, runtimeVersion) {
	const separator = packageVersion.lastIndexOf("@");
	if (separator <= 0 || !PACKAGE_NAME.test(packageVersion.slice(0, separator)) || !isExactPluginVersion(packageVersion.slice(separator + 1)) || !isExactPluginVersion(runtimeVersion)) throw new Error("Version exemptions require an exact npm package-name@version and an exact DSH runtime version");
}
/** Read the profile's independent compatibility file without loading plugins.
* A missing file authorizes nothing. An unreadable or unparsable file authorizes nothing and is
* reported instead of failing, so a bad file can never make the profile unusable; rejected records
* are skipped while the remaining valid ones still apply.
* @param profileDir Absolute profile directory.
* @returns Accepted exemptions plus every problem found; no manifest fallback is used.
*/
function readProfileCompatibility(profileDir) {
	const filename = join(profileDir, PROFILE_COMPATIBILITY_FILENAME);
	const unreadable = (reason) => ({
		exemptions: {},
		warnings: [`${filename} ${reason}; treating the profile as having no exemptions`],
		rewritable: false
	});
	let text;
	try {
		text = readFileSync(filename, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return {
			exemptions: {},
			warnings: [],
			rewritable: true
		};
		return unreadable(`cannot be read (${String(error)})`);
	}
	let value;
	try {
		value = JSON.parse(text);
	} catch (error) {
		return unreadable(`is not valid JSON (${String(error)})`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) return unreadable("must map exact package@version keys to DSH version lists");
	const exemptions = {};
	const warnings = [];
	for (const [key, versions] of Object.entries(value)) {
		const separator = key.lastIndexOf("@");
		if (separator <= 0 || !PACKAGE_NAME.test(key.slice(0, separator)) || !isExactPluginVersion(key.slice(separator + 1))) {
			warnings.push(`${filename}: ${JSON.stringify(key)} is not an exact package-name@version key; the record is ignored`);
			continue;
		}
		if (!isVersionList(versions)) {
			warnings.push(`${filename}: ${key} must contain a list of exact DSH versions; the record is ignored`);
			continue;
		}
		exemptions[key] = versions;
	}
	return {
		exemptions,
		warnings,
		rewritable: warnings.length === 0
	};
}
/** Read only the accepted exemptions of a profile.
* @param profileDir Absolute profile directory.
* @returns Exact package-name@version keys mapped to their allowed DSH versions.
*/
function readProfileVersionExemptions(profileDir) {
	return readProfileCompatibility(profileDir).exemptions;
}
/** Persist one informed grant or revocation under the compatibility file's own lock.
* @param profileDir Profile directory; no package manifest is created or modified.
* @param packageVersion Exact manifest package-name@version.
* @param runtimeVersion Exact DSH version; grants must name the current runtime, revocations may name historical ones.
* @param enabled Whether to grant rather than revoke.
* @param acceptRisk Required true for grants after explicit acknowledgement of possible crashes or data loss.
* @returns After the atomic write. Existing plugin instances are not reloaded by this operation.
* @throws For invalid identities, missing consent, a stale runtime, or a file the reader rejected,
* which the user must repair by hand because rewriting it would discard their content.
*/
async function setProfileVersionExemption(profileDir, packageVersion, runtimeVersion, enabled, acceptRisk) {
	validatePluginVersionExemption(packageVersion, runtimeVersion);
	if (enabled && !acceptRisk) throw new Error("Incompatible plugins may cause crashes or data loss. To grant this exact-version exemption, explicitly acknowledge the risk with --accept-risk (acceptRisk: true).");
	const current = getDshRuntimeVersion();
	if (enabled && runtimeVersion !== current) throw new Error(`Cannot approve DSH ${runtimeVersion}: this application runs DSH ${current}. Use --dsh-version ${current}.`);
	await mkdir(profileDir, { recursive: true });
	const filename = join(profileDir, PROFILE_COMPATIBILITY_FILENAME);
	await withFileLock(filename, async () => {
		const current = readProfileCompatibility(profileDir);
		if (!current.rewritable) throw new Error(`${PROFILE_COMPATIBILITY_FILENAME} must be repaired before exemptions change:\n${current.warnings.join("\n")}`);
		const exemptions = current.exemptions;
		const versions = exemptions[packageVersion] ?? [];
		if (enabled) exemptions[packageVersion] = [...new Set([...versions, runtimeVersion])];
		else {
			const retained = versions.filter((version) => version !== runtimeVersion);
			if (retained.length) exemptions[packageVersion] = retained;
			else Reflect.deleteProperty(exemptions, packageVersion);
		}
		await writeFileAtomic(filename, JSON.stringify(exemptions, void 0, 2) + "\n", { mode: 384 });
	});
}
//#endregion
//#region lib/types/profile-resolution/legacy-links.js
/** Package directory and resource canonicalization through the active runtime carrier's filesystem. */
/**
* Return whether the process reads application modules from pkg's virtual filesystem.
* @returns whether pkg owns the module filesystem.
*/
function isPackagedExecutable() {
	return process.pkg !== void 0;
}
/**
* Resolve a directory through the active carrier's filesystem implementation.
* @param path - directory path to canonicalize.
* @returns the canonical directory path.
*/
function realModuleDirectory(path) {
	return isPackagedExecutable() ? realpathSync(path) : realpathSync.native(path);
}
/** Canonicalize a module resource, preserving physical file aliases.
* SEA archive files are symlink-free and support stat and reads, while their containing directories support realpath.
* @param path Existing module resource path.
* @returns Canonical resource path under the active carrier's filesystem.
* @throws When the resource or its directory cannot be inspected or resolved.
*/
function realModuleFile(path) {
	return !isPackagedExecutable() || lstatSync(path).isSymbolicLink() ? realpathSync(path) : join(realModuleDirectory(dirname(path)), basename(path));
}
//#endregion

export {};
