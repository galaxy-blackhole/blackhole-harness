/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 2073–3001 của stock lib/index.js (@deepseek-ai/dsh-app-boot): kernel boot library (profile resolution, bundles, config-schema).
 */
// @ts-nocheck

//#region lib/types/package-meta.js
/** Read plugin display text and icons through exported resources without evaluating plugin code. */
const LANGUAGE_ID = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;
/** Maximum raw icon bytes admitted to plugin metadata. */
const MAX_ICON_BYTES = 256 * 1024;
const ICON_MEDIA_TYPES = new Map([
	[".svg", "image/svg+xml"],
	[".png", "image/png"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".webp", "image/webp"]
]);
function iconOf(specifier, packageName, parentURL, manifestPath, value) {
	const icon = manifestPath === void 0 ? void 0 : textOf(value, `${manifestPath}: icon`);
	let target;
	let label;
	if (manifestPath !== void 0 && icon !== void 0) {
		if (isAbsolute(icon) || win32.isAbsolute(icon) || /^[A-Za-z][A-Za-z\d+.-]*:/u.test(icon)) throw new Error(`${manifestPath}: icon must be a relative file path`);
		label = manifestPath;
		const root = realpathSync(dirname(manifestPath));
		target = resolve(root, icon);
		const local = relative(root, realModuleFile(target));
		if (local === ".." || local.startsWith(`..${sep}`) || isAbsolute(local)) throw new Error(`${label}: icon must remain inside its manifest directory`);
	} else {
		const exported = optionalResourcePath(`${specifier}/icon`, parentURL);
		if (exported === void 0) return void 0;
		target = label = exported;
		assertPackageOwned(realModuleFile(target), packageName);
	}
	const mediaType = ICON_MEDIA_TYPES.get(extname(target).toLowerCase());
	if (mediaType === void 0) throw new Error(`${label}: icon must be SVG, PNG, JPEG, or WebP`);
	const file = realModuleFile(target);
	const stat = statSync(file);
	if (!stat.isFile()) throw new Error(`${label}: icon must be a regular file`);
	if (stat.size > MAX_ICON_BYTES) throw new Error(`${label}: icon exceeds 256 KiB`);
	const bytes = readFileSync(file);
	if (bytes.length > MAX_ICON_BYTES) throw new Error(`${label}: icon exceeds 256 KiB`);
	return `data:${mediaType};base64,${bytes.toString("base64")}`;
}
/** Require an ancestor of the real file whose package.json names the owning package. */
function assertPackageOwned(file, name) {
	for (let directory = dirname(file);; directory = dirname(directory)) {
		const manifest = join(directory, "package.json");
		if (existsSync(manifest) && readObject(manifest).name === name) return;
		if (dirname(directory) === directory) throw new Error(`${file}: icon must remain inside its package directory`);
	}
}
/**
* Resolve a plugin resource through the active Node ESM resolver without evaluating it.
* @param specifier - plugin module or exported resource specifier.
* @param parentURL - owning module-resolution base.
* @returns the local filesystem path selected by Node and the active profile.
* @throws when the resolver is unavailable or the resource cannot resolve to a local file.
*/
function resolvePluginResource(specifier, parentURL) {
	const loader = ModuleLoader.fromInternal();
	if (loader === void 0) throw new Error("Plugin metadata requires the Node module resolver");
	return fileURLToPath((loader.version === "v2" ? loader.resolveSync(parentURL, {
		specifier,
		attributes: {}
	}) : loader.resolveSync(specifier, parentURL, {})).url);
}
function missingResource(error) {
	const code = error?.code;
	return code === "ERR_PACKAGE_PATH_NOT_EXPORTED" || code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND" || code === "ENOENT" || code === "ENOTDIR";
}
function optionalResourcePath(specifier, parentURL) {
	try {
		return resolvePluginResource(specifier, parentURL);
	} catch (error) {
		if (missingResource(error)) return void 0;
		throw error;
	}
}
function objectOf(value, path) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
	return value;
}
function textOf(value, path) {
	if (value === void 0) return void 0;
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
	return value;
}
function readObject(file) {
	let contents;
	try {
		contents = JSON.parse(readFileSync(file, "utf8"));
	} catch (error) {
		throw new Error(`${file}: ${String(error)}`);
	}
	return objectOf(contents, file);
}
function fallbackText(value) {
	return typeof value === "string" && value.trim() !== "" ? value : void 0;
}
function dictionariesOf(englishPath, specifier, parentURL) {
	const dictionaries = /* @__PURE__ */ new Map();
	for (const entry of readdirSync(dirname(englishPath), { withFileTypes: true })) {
		if (!entry.name.endsWith(".json")) continue;
		const resource = `${specifier}/locale/${entry.name}`;
		const language = entry.name.slice(0, -5);
		if (!LANGUAGE_ID.test(language)) throw new Error(`${resource} must use a language id as its filename`);
		const id = language.toLowerCase();
		if (dictionaries.has(id)) throw new Error(`${resource} duplicates locale ${id}`);
		const file = resolvePluginResource(resource, parentURL);
		if (dirname(file) !== dirname(englishPath)) throw new Error(`${resource}: ${file} must share the English locale directory ${dirname(englishPath)}`);
		const parsed = readObject(file);
		const meta = parsed.meta === void 0 ? void 0 : objectOf(parsed.meta, `${file}: meta`);
		dictionaries.set(id, {
			title: textOf(meta?.title, `${file}: meta.title`),
			description: textOf(meta?.description, `${file}: meta.description`)
		});
	}
	return dictionaries;
}
function localizedText(field, dictionaries, fallback, finalFallback) {
	const entries = [...dictionaries].flatMap(([language, fields]) => {
		const value = fields[field];
		return value === void 0 ? [] : [[language, value]];
	});
	if (entries.length === 0) return fallback;
	return {
		en: fallback ?? finalFallback,
		...Object.fromEntries(entries)
	};
}
/**
* Read plugin locale JSON display text and icon without evaluating JavaScript entries.
* Only a package-root specifier reads its exported package.json: `name`/`description` fill missing
* locale fields, and a declared `icon` takes priority over the `<specifier>/icon` resource.
* A subpath specifier never reads package.json; its icon comes only from `<specifier>/icon`.
* Manifest icons remain inside their declaring directory; exported icons remain inside their
* owning package after realpath resolution. Both accept SVG, PNG, JPEG, or WebP up to 256 KiB.
* Icon failures retain display text without falling back.
* Non-package specifiers are skipped without invoking the resource resolver.
* Language files share the directory containing the resolved English resource;
* each file is resolved through the complete plugin specifier before reading.
* Translation maps retain an English fallback, ultimately the full module specifier
* for titles and empty for descriptions.
* @param specifier - configured plugin module name, including any package subpath.
* @param parentURL - owning Loader tree's module-resolution base.
* @returns display fields and any resource diagnostic, or undefined for non-package specifiers or absent metadata.
*/
function readPluginMeta(specifier, parentURL) {
	const packageName = barePackageName(specifier);
	if (packageName === void 0) return void 0;
	try {
		const englishPath = optionalResourcePath(`${specifier}/locale/en.json`, parentURL);
		const dictionaries = englishPath === void 0 ? /* @__PURE__ */ new Map() : dictionariesOf(englishPath, specifier, parentURL);
		const manifestPath = packageName === specifier ? optionalResourcePath(`${specifier}/package.json`, parentURL) : void 0;
		const manifest = manifestPath === void 0 ? void 0 : readObject(manifestPath);
		const title = localizedText("title", dictionaries, fallbackText(manifest?.name), specifier);
		const description = localizedText("description", dictionaries, fallbackText(manifest?.description), "");
		const text = {
			...title === void 0 ? {} : { title },
			...description === void 0 ? {} : { description }
		};
		let icon;
		try {
			icon = iconOf(specifier, packageName, parentURL, manifestPath, manifest?.icon);
		} catch (error) {
			return {
				...text,
				error: `Plugin metadata for ${specifier}: ${String(error)}`
			};
		}
		if (title === void 0 && description === void 0 && icon === void 0) return void 0;
		return {
			...text,
			...icon === void 0 ? {} : { icon }
		};
	} catch (error) {
		return { error: `Plugin metadata for ${specifier}: ${String(error)}` };
	}
}
//#endregion
//#region lib/types/compatibility-preflight.js
/** Compatibility checks at the composition entry points DSH owns; no Loader instrumentation. */
function readManifest(filename) {
	return JSON.parse(readFileSync(filename, "utf8"));
}
/** Render the patch wording an Include would report, through the profile's logger. */
function patchWarning(ctx) {
	return (message, ...args) => {
		let index = 0;
		ctx.logger.warn(message.replace(/%C/g, () => JSON.stringify(args[index++])));
	};
}
function manifestOf(ctx, name, parentURL) {
	if (name.startsWith("cordis:")) return void 0;
	const specifier = name.startsWith("#") ? resolvePluginResource(name, parentURL) : name;
	const packages = ctx.get("pluginPackages");
	const pkg = packages?.packageOf(specifier, parentURL);
	if (pkg !== void 0) return readManifest(pkg.manifestPath);
	const bare = barePackageName(specifier);
	if (bare !== void 0 && packages === void 0) for (const path of createRequire(parentURL).resolve.paths(bare)) {
		const filename = join(path, bare, "package.json");
		if (existsSync(filename)) return readManifest(filename);
	}
	if (!isAbsolute(specifier) && !specifier.startsWith(".") && !specifier.startsWith("file:")) return void 0;
	const url = isAbsolute(specifier) ? pathToFileURL(specifier) : new URL(specifier, parentURL);
	let dir;
	try {
		dir = dirname(realpathSync(fileURLToPath(url)));
	} catch (error) {
		if ([
			"ENOENT",
			"ENOTDIR",
			"EISDIR"
		].includes(String(error.code))) return void 0;
		throw error;
	}
	while (true) try {
		return readManifest(join(dir, "package.json"));
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		const parent = dirname(dir);
		if (parent === dir) return void 0;
		dir = parent;
	}
}
/** Prepare profile or preset rows before the owning DSH caller passes them to Loader.
* Only a compatibility conflict denies a row: an entry whose manifest cannot be resolved keeps
* the Loader's own import failure. A denied ordinary row gains `disabled`; a native Include that
* reaches a denied plugin is denied as a whole, because its file is never rewritten.
* @param ctx Context carrying launcher-owned profile facts; non-profile contexts retain their rows.
* @param entries Complete effective entry list, after patch composition.
* @param parentURL Resolution base of the tree that will import these rows.
* @param binName Diagnostic prefix for a denied row; defaults to `dsh`.
* @returns Detached rows with incompatible entries denied; reads the profile compatibility file once.
* @throws For malformed compatibility permissions or a profile composition without a resolution base.
*/
function prepareProfileEntries(ctx, entries, parentURL, binName = "dsh") {
	return preflight(ctx, entries, parentURL, (row, reason) => {
		const label = typeof row.id === "string" ? `row ${JSON.stringify(row.id)}` : row.name;
		process.stderr.write(`${binName}: disabling profile plugin ${label}: ${reason}\n`);
	}).rows;
}
function preflight(ctx, entries, parentURL, report) {
	const rows = structuredClone(entries);
	const profile = ctx.get("profileContext");
	if (profile === void 0) return {
		rows,
		blocked: false
	};
	if (parentURL === void 0) throw new Error("Profile compatibility preflight requires a resolution base");
	const { exemptions, warnings } = readProfileCompatibility(profile.dir);
	for (const warning of warnings) process.stderr.write(`${warning}\n`);
	const includes = /* @__PURE__ */ new Set();
	/** Only a compatibility conflict denies a row; every other failure keeps the Loader's own diagnosis. */
	const denial = (row, base) => {
		try {
			const manifest = manifestOf(ctx, row.name, base);
			if (manifest === void 0) return void 0;
			const issue = evaluatePluginCompatibility(manifest, exemptions);
			return issue === void 0 || issue.exempted ? void 0 : pluginCompatibilityWarning(issue);
		} catch (error) {
			return `its declared dsh requirements cannot be validated: ${error instanceof Error ? error.message : String(error)}`;
		}
	};
	const deny = (row, reason) => {
		row.disabled = true;
		if (row.group) row.group = false;
		report(row, reason);
	};
	const check = (rows, base) => {
		let blocked = false;
		for (const row of rows) {
			if (row.disabled === true && !row.group) continue;
			const conflict = denial(row, base);
			if (conflict !== void 0) {
				deny(row, conflict);
				blocked = true;
				continue;
			}
			if ((row.group === true || row.name === "cordis:group" || row.name === "@deepseek-ai/cordis-plugin-group") && Array.isArray(row.config) && check(row.config, base)) blocked = true;
			if (row.name !== "cordis:include" && row.name !== "@deepseek-ai/cordis-plugin-include") continue;
			const reached = includedConflicts(row, base);
			if (reached !== void 0) {
				deny(row, reached);
				blocked = true;
			}
		}
		return blocked;
	};
	/** Whether a native Include reaches a denied plugin; an unreadable one has no compatibility opinion. */
	const includedConflicts = (row, base) => {
		const config = row.config;
		if (typeof config?.path !== "string" || ![
			".yml",
			".yaml",
			".json"
		].includes(extname(config.path))) return;
		const requested = isAbsolute(config.path) ? config.path : fileURLToPath(new URL(config.path, base));
		const filename = existsSync(requested) ? realpathSync(requested) : requested;
		if (includes.has(filename)) return void 0;
		includes.add(filename);
		try {
			let data;
			try {
				data = load(readFileSync(filename, "utf8"), { schema: entryListSchema });
			} catch (error) {
				if (error.code !== "ENOENT" || config.initial === void 0) return void 0;
				data = config.initial;
			}
			if (!Array.isArray(data)) return void 0;
			return check(applyEntryPatches(data, config.patches, patchWarning(ctx)), pathToFileURL(filename).href) ? `its included file ${filename} reaches an incompatible plugin, and that file is never rewritten` : void 0;
		} finally {
			includes.delete(filename);
		}
	};
	return {
		rows,
		blocked: check(rows, parentURL)
	};
}
/** Apply compatibility policy to the complete patch composition over a profile's empty root.
* The caller passes every patch layer of the profile, because this returns one insertion patch for
* that empty root: a non-empty root config would lose the caller's override patches by id.
* @param ctx Profile context prepared by the launcher.
* @param patches Original ordered profile patches; these remain unchanged.
* @param parentURL Root Include's resolution base.
* @param binName Diagnostic prefix for a denied row; defaults to `dsh`.
* @returns One prepared insertion patch for profiles, or the original patches for non-profile callers.
*/
function prepareProfilePatches(ctx, patches, parentURL, binName = "dsh") {
	if (ctx.get("profileContext") === void 0) return patches;
	const rows = prepareProfileEntries(ctx, applyEntryPatches([], patches, patchWarning(ctx)), parentURL, binName);
	return rows.length === 0 ? [] : [{ insert: rows }];
}
//#endregion
//#region lib/types/official-bundle-packages.js
/** Package admission shared by offline catalog generation and release ordering. */
/** Public DSH release members available through the ordinary on-demand bundle installer. */
const ON_DEMAND_BUNDLES = ["@deepseek-ai/dsh-subagent-claude-code", "@deepseek-ai/dsh-subagent-codex"];
//#endregion
//#region lib/types/official-bundles.generated.js
/** Generated offline Official bundle metadata. Run pnpm gen-official-bundle-catalog; do not edit. */
/** Official on-demand entries, independent of installed packages and registry availability. */
const OFFICIAL_ON_DEMAND_CATALOG = [{
	packageName: "@deepseek-ai/dsh-subagent-claude-code",
	meta: {
		title: {
			"en": "Claude Code subagent",
			"zh": "Claude Code 子智能体"
		},
		description: {
			"en": "Delegate one task to Claude Code using its native authentication and settings.",
			"zh": "使用 Claude Code 原生认证和设置委派单个任务。"
		},
		icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNC45ODkzIiB5PSIxNS4xODc3IiB3aWR0aD0iMTIuMjM2NSIgaGVpZ2h0PSIxMi4yMzY1IiByeD0iMiIgZmlsbD0idXJsKCNkc2hfcGx1Z2luX2FydF9SMGEpIiBmaWxsLW9wYWNpdHk9IjAuOCI+PC9yZWN0PjxyZWN0IHg9IjguODcxMDkiIHk9IjkuMDY5NyIgd2lkdGg9IjEyLjIzNjUiIGhlaWdodD0iMTIuMjM2NSIgcng9IjIiIGZpbGw9InVybCgjZHNoX3BsdWdpbl9hcnRfUjBiKSIgZmlsbC1vcGFjaXR5PSIwLjgiPjwvcmVjdD48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImRzaF9wbHVnaW5fYXJ0X1IwYSIgeDE9IjIxLjEwNzUiIHkxPSIxNS4xODc3IiB4Mj0iMjEuMTA3NSIgeTI9IjI3LjQyNDMiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBzdG9wLWNvbG9yPSIjNDVFN0E0Ij48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDU5MDlEIj48L3N0b3A+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgaWQ9ImRzaF9wbHVnaW5fYXJ0X1IwYiIgeDE9IjE0Ljk4OTQiIHkxPSI5LjA2OTciIHgyPSIxNC45ODk0IiB5Mj0iMjEuMzA2MyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIHN0b3AtY29sb3I9IiM2OUI5RkYiPjwvc3RvcD48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMjRERTIiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4K"
	}
}, {
	packageName: "@deepseek-ai/dsh-subagent-codex",
	meta: {
		title: {
			"en": "Codex subagent",
			"zh": "Codex 子智能体"
		},
		description: {
			"en": "Delegate one task to Codex using its native authentication and settings.",
			"zh": "使用 Codex 原生认证和设置委派单个任务。"
		},
		icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSIxNC45ODkzIiB5PSIxNS4xODc3IiB3aWR0aD0iMTIuMjM2NSIgaGVpZ2h0PSIxMi4yMzY1IiByeD0iMiIgZmlsbD0idXJsKCNkc2hfcGx1Z2luX2FydF9SMGEpIiBmaWxsLW9wYWNpdHk9IjAuOCI+PC9yZWN0PjxyZWN0IHg9IjguODcxMDkiIHk9IjkuMDY5NyIgd2lkdGg9IjEyLjIzNjUiIGhlaWdodD0iMTIuMjM2NSIgcng9IjIiIGZpbGw9InVybCgjZHNoX3BsdWdpbl9hcnRfUjBiKSIgZmlsbC1vcGFjaXR5PSIwLjgiPjwvcmVjdD48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImRzaF9wbHVnaW5fYXJ0X1IwYSIgeDE9IjIxLjEwNzUiIHkxPSIxNS4xODc3IiB4Mj0iMjEuMTA3NSIgeTI9IjI3LjQyNDMiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBzdG9wLWNvbG9yPSIjNDVFN0E0Ij48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDU5MDlEIj48L3N0b3A+PC9saW5lYXJHcmFkaWVudD48bGluZWFyR3JhZGllbnQgaWQ9ImRzaF9wbHVnaW5fYXJ0X1IwYiIgeDE9IjE0Ljk4OTQiIHkxPSI5LjA2OTciIHgyPSIxNC45ODk0IiB5Mj0iMjEuMzA2MyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIHN0b3AtY29sb3I9IiM2OUI5RkYiPjwvc3RvcD48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMjRERTIiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48L3N2Zz4K"
	}
}];
//#endregion
//#region lib/types/config-schema/native.js
/** Identity checks at the plugin-export and lazy-builder boundaries. */
/**
* Recognize the native Schemastery graph protocol without invoking a validator or serialization hook.
* @param value - plugin Config export or lazy-builder result.
* @returns whether native schema fields can be inspected.
*/
function isNativeConfigSchema(value) {
	if (value === null || typeof value !== "object" && typeof value !== "function") return false;
	const meta = Reflect.get(value, "meta");
	return Reflect.get(value, Symbol.for("schemastery")) === true && typeof Reflect.get(value, "type") === "string" && meta !== null && typeof meta === "object";
}
//#endregion
//#region lib/types/config-schema/pattern.js
/** Conservative compatibility checks between native RegExp validation and Unicode JSON Schema patterns. */
function bmpOnly(node) {
	switch (node.type) {
		case "Character": return node.value <= 65535 && (node.value < 55296 || node.value > 57343);
		case "CharacterClassRange": return bmpOnly(node.min) && bmpOnly(node.max) && (node.max.value < 55296 || node.min.value > 57343);
		case "CharacterClass": return !node.negate && node.elements.every(bmpOnly);
		case "CharacterSet": return (node.kind === "digit" || node.kind === "space" || node.kind === "word") && !node.negate;
		case "Quantifier": return bmpOnly(node.element);
		case "Assertion": return [
			"start",
			"end",
			"word"
		].includes(node.kind);
		default: return false;
	}
}
function broadSet(node) {
	return node.type === "CharacterSet" && (node.kind === "any" || (node.kind === "digit" || node.kind === "space" || node.kind === "word") && node.negate);
}
function portableAlternative(alternative) {
	if (alternative.elements.length === 1 && alternative.elements.some(broadSet)) return true;
	let broadRepetitions = 0;
	const wordAssertion = alternative.elements.some((element) => element.type === "Assertion" && element.kind === "word");
	return alternative.elements.every((element) => {
		if (element.type === "Quantifier" && element.max === Infinity && element.min <= 1 && broadSet(element.element)) return !wordAssertion && ++broadRepetitions === 1;
		return bmpOnly(element);
	});
}
function signature(pattern) {
	const incidental = new Set([
		"parent",
		"start",
		"end",
		"raw",
		"references",
		"resolved"
	]);
	return JSON.stringify(pattern, (key, value) => incidental.has(key) ? void 0 : value);
}
/**
* Create a checker for patterns that can retain native acceptance under Unicode regex semantics.
* Unrecognized flagless syntax stays explicitly partial rather than becoming a misleading constraint.
* @returns the compatibility predicate; parsing never executes the regular expression against config values.
*/
async function createPatternCheck() {
	const { RegExpParser } = await import("@eslint-community/regexpp");
	const parser = new RegExpParser();
	return (source, flags = "") => {
		if (flags !== "" && flags !== "u") return false;
		try {
			const unicode = parser.parsePattern(source, 0, source.length, { unicode: true });
			if (flags === "u") return true;
			const native = parser.parsePattern(source, 0, source.length, { unicode: false });
			return signature(native) === signature(unicode) && native.alternatives.every(portableAlternative);
		} catch (error) {
			if (error instanceof SyntaxError) return false;
			throw error;
		}
	};
}
//#endregion
//#region lib/types/config-schema/projector.js
/** Project native Config input constraints without executing their validators or transform callbacks. */
/** Definition that projected value positions reference as `#/$defs/loaderExpression`; an enclosing document must define it. */
const LOADER_EXPRESSION_SCHEMA = {
	type: "object",
	properties: { __jsExpr: { type: "string" } },
	required: ["__jsExpr"],
	description: "Inert representation of a YAML !!js scalar from the Cordis entry-list parser. Its result is evaluated and validated only at runtime. Extra marker-object fields are ignored by interpolation."
};
/** Copy JSON-compatible schema annotations without silently converting non-JSON defaults. */
function jsonValue(value, nullifyUndefined = false) {
	const visit = (item, active) => {
		if (nullifyUndefined && item === void 0) return;
		if (item === null || typeof item === "string" || typeof item === "boolean") return;
		if (typeof item === "number" && Number.isFinite(item)) return;
		if (typeof item !== "object") throw new Error("schema annotation is not JSON-compatible");
		if (active.has(item)) throw new Error("schema annotation contains a cycle");
		if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error("schema annotation contains a non-JSON object");
		active.add(item);
		for (const child of Object.values(item)) visit(child, active);
		active.delete(item);
	};
	visit(value, /* @__PURE__ */ new Set());
	return JSON.parse(JSON.stringify(value, (_key, item) => nullifyUndefined && item === void 0 ? null : item));
}
/** Native constant equality treats omitted and null-valued object members alike. */
function constant(value, objectComparison) {
	if (Array.isArray(value)) return {
		type: "array",
		minItems: value.length,
		maxItems: value.length,
		items: false,
		...value.length ? { prefixItems: Array.from(value, (item) => constant(item, objectComparison)) } : {}
	};
	if (value !== null && typeof value === "object") {
		objectComparison();
		const properties = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, constant(child, objectComparison)]));
		const inherited = Object.getOwnPropertyNames(Object.prototype);
		const required = Object.keys(properties).filter((key) => !inherited.includes(key) && Reflect.get(value, key) != null);
		return {
			type: "object",
			properties,
			additionalProperties: { type: "null" },
			patternProperties: { [`^(?:${inherited.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`]: {} },
			...required.length ? { required } : {}
		};
	}
	return { const: value };
}
/** Add or remove null acceptance; a type list stays deduplicated because a wrapped projection may already accept null. */
function nullable(core, accepts) {
	if (typeof core === "boolean") return accepts ? core || { type: "null" } : core && { not: { type: "null" } };
	const types = typeof core.type === "string" ? [core.type] : core.type;
	if (types === void 0) return accepts ? { anyOf: [core, { type: "null" }] } : {
		...core,
		not: { type: "null" }
	};
	const [single, ...rest] = accepts ? [...new Set([...types, "null"])] : types.filter((type) => type !== "null");
	if (single === void 0) return false;
	return {
		...core,
		type: rest.length ? [single, ...rest] : single
	};
}
/** Add expression alternatives only at config VALUE positions, not property names or applicator branches. */
function expressions(schema, valuePosition = true, enabled = true) {
	const result = { ...schema };
	if (schema.properties) result.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, expressions(child, true, enabled)]));
	for (const key of ["items", "additionalProperties"]) if (schema[key] !== void 0) result[key] = schema[key] === false ? false : expressions(schema[key], true, enabled);
	if (schema.propertyNames) result.propertyNames = expressions(schema.propertyNames, false, false);
	if (schema.prefixItems) result.prefixItems = schema.prefixItems.map((child) => expressions(child, true, enabled));
	if (schema.anyOf) result.anyOf = schema.anyOf.map((child) => expressions(child, false, enabled));
	if (schema.not !== void 0) result.not = expressions(schema.not, false, false);
	if (!valuePosition || !enabled) return result;
	const annotations = {};
	for (const key of [
		"title",
		"description",
		"default",
		"$comment",
		"x-cordis"
	]) if (Object.hasOwn(result, key)) {
		annotations[key] = result[key];
		Reflect.deleteProperty(result, key);
	}
	return {
		...annotations,
		anyOf: [result, { $ref: "#/$defs/loaderExpression" }]
	};
}
/** Check native volatile containment without evaluating values or invoking unresolved lazy builders. */
function validateVolatilePlacement(node, path, blocked = false, seen = /* @__PURE__ */ new Map()) {
	const states = seen.get(node) ?? /* @__PURE__ */ new Set();
	if (states.has(blocked)) return;
	states.add(blocked);
	seen.set(node, states);
	if (node.meta.volatile && blocked) throw new Error(`${path}: volatile fields require a fixed object path without an enclosing volatile field`);
	const nested = blocked || !!node.meta.volatile;
	for (const [key, child] of Object.entries(node.dict ?? {})) validateVolatilePlacement(child, `${path}/${key}`, nested, seen);
	if (node.sKey) validateVolatilePlacement(node.sKey, `${path}/keys`, true, seen);
	if (node.inner && (node.type !== "lazy" || isNativeConfigSchema(node.inner))) validateVolatilePlacement(node.inner, `${path}/inner`, true, seen);
	for (const [index, child] of (node.list ?? []).entries()) validateVolatilePlacement(child, `${path}/${index}`, true, seen);
}
/**
* Create an invocation-local projector. Ajv checks only literal defaults against generated schemas;
* it does not fill defaults, coerce input, or call native plugin validators. Opaque input or metadata effects
* widen validation with explicit limitations instead of simulating native mutation.
* @returns a function projecting one trusted native Config graph into the enclosing document's definitions.
*/
async function createConfigProjector() {
	const { Ajv2020 } = await import("ajv/dist/2020.js");
	const validator = new Ajv2020({
		strict: false,
		logger: false,
		validateFormats: false,
		addUsedSchema: false
	});
	const portablePattern = await createPatternCheck();
	const builderResults = /* @__PURE__ */ new Map();
	return (root, prefix) => {
		validateVolatilePlacement(root, "config");
		const completed = /* @__PURE__ */ new Map();
		const strictNodes = /* @__PURE__ */ new Map();
		const active = /* @__PURE__ */ new Set();
		const recursiveNames = /* @__PURE__ */ new Map();
		const definitions = {};
		const limitations = [];
		const metadataEffects = [];
		const limitation = (path, message) => {
			const text = `${path}: ${message}`;
			limitations.push(text);
			return text;
		};
		const visit = (node, path, strict = false) => {
			let key = node;
			if (strict) {
				key = strictNodes.get(node) ?? { ...node };
				strictNodes.set(node, key);
			}
			const cached = completed.get(key);
			if (cached) return cached;
			if (active.has(key)) {
				let name = recursiveNames.get(key);
				if (name === void 0) {
					name = `${prefix}Recursive${recursiveNames.size}`;
					recursiveNames.set(key, name);
				}
				return {
					schema: { $ref: `#/$defs/${name}` },
					acceptsMissing: node.type !== "lazy" && node.meta.required ? false : "unknown",
					exact: true,
					recursive: true,
					effectful: true,
					mutating: true
				};
			}
			active.add(key);
			let projection;
			if (node.type === "lazy") {
				let inner = node;
				let meta = node.meta.volatile ? {
					...node.meta,
					volatile: false
				} : node.meta;
				const chain = /* @__PURE__ */ new Set();
				let looseProjection;
				while (inner.type === "lazy") {
					const cachedInner = isNativeConfigSchema(inner.inner);
					if (meta.loose) {
						const message = limitation(path, "lazy loose fallback can accept inputs rejected by its inner schema");
						if (!cachedInner) metadataEffects.push(limitation(path, "unresolved loose lazy metadata propagation may affect shared schemas"));
						looseProjection = {
							schema: { "x-cordis": {
								loose: true,
								limitations: [message]
							} },
							acceptsMissing: true,
							exact: false,
							recursive: false,
							effectful: true,
							mutating: false
						};
						break;
					}
					if (chain.has(inner)) throw new Error(`${path}: lazy cycle has no concrete schema`);
					chain.add(inner);
					let next = cachedInner ? inner.inner : builderResults.get(inner);
					if (next === void 0 && typeof inner.builder === "function") {
						next = Reflect.apply(inner.builder, inner, []);
						builderResults.set(inner, next);
					}
					if (!isNativeConfigSchema(next)) throw new Error(`${path}: lazy schema has no native builder result or resolved inner schema`);
					if (!cachedInner && [
						"required",
						"default",
						"min",
						"max",
						"step",
						"pattern",
						"loose",
						"volatile"
					].some((key) => Object.hasOwn(meta, key) && !Object.hasOwn(next.meta, key) && ([
						"required",
						"loose",
						"volatile"
					].includes(key) ? !!Reflect.get(meta, key) : Reflect.get(meta, key) != null))) metadataEffects.push(limitation(path, "lazy metadata propagation may affect shared schemas; validation requires native execution"));
					meta = cachedInner ? next.meta : {
						...meta,
						...next.meta
					};
					validateVolatilePlacement({
						...next,
						meta
					}, `${path}/lazy`, true);
					inner = next;
				}
				projection = looseProjection ?? visit({
					...inner,
					meta
				}, `${path}/lazy`, strict);
				if (node.meta.volatile) projection = {
					...projection,
					schema: {
						...projection.schema,
						"x-cordis": {
							...projection.schema["x-cordis"],
							volatile: true
						}
					}
				};
			} else {
				const ownLimitations = [];
				const inputLimitations = [];
				let unsupported = false;
				const inputLimitation = (message) => {
					inputLimitations.push(message);
					ownLimitations.push(limitation(path, message));
				};
				const annotation = (value, name) => {
					try {
						return {
							ok: true,
							value: jsonValue(value)
						};
					} catch (error) {
						ownLimitations.push(limitation(`${path}/${name}`, `annotation omitted: ${error instanceof Error ? error.message : String(error)}`));
						return { ok: false };
					}
				};
				const children = [];
				const child = (value, suffix, childStrict = false) => {
					if (value === void 0) throw new Error(`${path}: ${node.type} schema is missing ${suffix}`);
					const result = visit(value, `${path}/${suffix}`, childStrict);
					children.push(result);
					return result;
				};
				const meta = { ...node.meta };
				for (const key of [
					"min",
					"max",
					"step"
				]) {
					if (meta[key] === void 0 || Number.isFinite(meta[key])) continue;
					if (!(key === "max" ? meta.max === Infinity : key === "min" && meta.min === -Infinity && !meta.step)) inputLimitation(`non-finite ${key} constraint is omitted; native validation is required`);
					Reflect.deleteProperty(meta, key);
				}
				let core;
				let dictionaryValidation;
				switch (node.type) {
					case "any":
						core = true;
						break;
					case "never":
						core = false;
						break;
					case "const":
						try {
							core = node.value == null ? false : constant(jsonValue(node.value, true), () => {
								inputLimitation("object constant inherited-member comparison requires native validation");
							});
						} catch (error) {
							core = true;
							inputLimitation(`constant constraint requires native validation: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					case "boolean":
						core = { type: "boolean" };
						break;
					case "string":
						core = { type: "string" };
						if (meta.min !== void 0) if (meta.min <= 1) core.minLength = Math.max(0, Math.ceil(meta.min));
						else inputLimitation("UTF-16 minimum length requires native validation");
						if (meta.max !== void 0) if (meta.max < 0) core = false;
						else {
							const maximum = Math.floor(meta.max);
							core.maxLength = maximum;
							if (maximum > 0) inputLimitation("UTF-16 maximum length requires native validation");
						}
						if (meta.pattern && core !== false) if (portablePattern(meta.pattern.source, meta.pattern.flags)) core.pattern = meta.pattern.source;
						else inputLimitation("regular-expression syntax or Unicode semantics require native validation");
						break;
					case "number":
						core = { type: "number" };
						if (meta.min !== void 0) core.minimum = meta.min;
						if (meta.max !== void 0) core.maximum = meta.max;
						if (meta.step) {
							const step = Math.abs(meta.step);
							const origin = meta.min ?? 0;
							if (!Number.isInteger(step) || origin % step !== 0) inputLimitation("fractional or offset numeric step requires native validation");
							else if (step === 1) core.type = "integer";
							else core.multipleOf = step;
						}
						break;
					case "object": {
						const required = [];
						core = {
							type: "object",
							properties: Object.fromEntries(Object.entries(node.dict ?? {}).map(([key, field]) => {
								const value = child(field, key);
								if (value.acceptsMissing === false) required.push(key);
								return [key, value.schema];
							}))
						};
						if (required.length) core.required = required;
						break;
					}
					case "array":
						core = {
							type: "array",
							items: child(node.inner, "items").schema
						};
						if (meta.min !== void 0 && node.inner?.meta.default == null) core.minItems = Math.max(0, Math.ceil(meta.min));
						if (meta.max !== void 0) if (meta.max < 0) core = false;
						else core.maxItems = Math.floor(meta.max);
						break;
					case "dict": {
						const valueSchema = child(node.inner, "values").schema;
						core = {
							type: "object",
							additionalProperties: valueSchema
						};
						if (node.sKey) {
							const key = child(node.sKey, "keys");
							if (!(node.sKey.type === "string" && node.sKey.meta.min === void 0 && node.sKey.meta.max === void 0 && node.sKey.meta.pattern === void 0) && (strict || key.effectful)) {
								dictionaryValidation = {
									keySchema: key.schema,
									valueSchema
								};
								core = { type: "object" };
								inputLimitation(key.effectful ? "dictionary key normalization can overwrite unvalidated values; native validation is required" : "strict dictionary filtering and value validation require native validation");
							} else core.propertyNames = key.schema;
						}
						break;
					}
					case "tuple": {
						if (node.list === void 0) throw new Error(`${path}: tuple schema is missing its list`);
						const values = node.list.map((item, index) => child(item, String(index)));
						core = {
							type: "array",
							...values.length ? { prefixItems: values.map((item) => item.schema) } : {}
						};
						const minimum = values.reduce((length, value, index) => value.acceptsMissing === false ? index + 1 : length, 0);
						if (minimum) core.minItems = minimum;
						break;
					}
					case "union": {
						if (node.list === void 0) throw new Error(`${path}: union schema is missing its list`);
						const variants = node.list.map((item, index) => child(item, String(index), strict));
						if (variants.slice(0, -1).some((variant) => variant.mutating)) {
							core = true;
							inputLimitation("earlier union branches may alter later validation inputs; native validation is required");
						} else core = variants.length ? { anyOf: variants.map((variant) => variant.schema) } : false;
						break;
					}
					case "transform":
						core = child(node.inner, "input", true).schema;
						inputLimitation("transform callback validation and normalization are not executed or projected");
						break;
					default:
						core = true;
						unsupported = true;
						inputLimitation(`native schema type ${node.type} is not statically projected`);
				}
				if (meta.loose) {
					core = true;
					inputLimitation("loose validation can replace invalid values with defaults");
				}
				const recursive = children.some((value) => value.recursive);
				const container = [
					"object",
					"array",
					"dict",
					"tuple"
				].includes(node.type);
				const mutating = unsupported || children.some((value) => value.mutating || container && value.effectful);
				const exact = inputLimitations.length === 0 && children.every((value) => value.exact);
				const fallback = meta.default === void 0 ? void 0 : annotation(meta.default, "default");
				let acceptsMissing;
				if (meta.required) acceptsMissing = false;
				else if (unsupported) acceptsMissing = "unknown";
				else if (meta.default == null) acceptsMissing = true;
				else if (!fallback?.ok) acceptsMissing = "unknown";
				else if (recursive) {
					acceptsMissing = "unknown";
					inputLimitation("recursive default validation cannot be decided statically");
				} else if (!exact) acceptsMissing = "unknown";
				else acceptsMissing = validator.validate(core, fallback.value);
				const annotations = {};
				if (fallback?.ok) annotations.default = fallback.value;
				const native = {};
				if (typeof meta.description === "string") annotations.description = meta.description;
				else if (meta.description) {
					const descriptions = annotation(meta.description, "description");
					if (descriptions.ok) {
						native.descriptions = descriptions.value;
						const description = meta.description.en ?? meta.description[""] ?? Object.values(meta.description)[0];
						if (typeof description === "string") annotations.description = description;
					}
				}
				if (dictionaryValidation) native.dictionaryValidation = dictionaryValidation;
				const copy = (name, value) => {
					if (value === void 0) return;
					const result = annotation(value, name);
					if (result.ok) native[name] = result.value;
				};
				for (const key of [
					"role",
					"extra",
					"hidden",
					"disabled",
					"collapse",
					"link",
					"comment",
					"badges",
					"loose",
					"volatile"
				]) copy(key, meta[key]);
				if (meta.pattern?.flags) copy("patternFlags", meta.pattern.flags);
				if (node.type === "union") native.branchSelection = "first-success";
				if (acceptsMissing === "unknown") native.omissionValidation = "runtime";
				if (ownLimitations.length) {
					native.type = node.type;
					for (const key of [
						"min",
						"max",
						"step",
						"pattern"
					]) copy(key, meta[key]);
					native.limitations = ownLimitations;
				}
				if (Object.keys(native).length) annotations["x-cordis"] = native;
				const input = nullable(core, acceptsMissing !== false);
				projection = {
					schema: {
						...typeof input === "boolean" ? input ? {} : { not: {} } : input,
						...annotations
					},
					acceptsMissing,
					exact: exact && acceptsMissing !== "unknown",
					recursive,
					effectful: unsupported || node.type === "transform" || !!meta.loose || children.some((child) => child.effectful),
					mutating
				};
			}
			active.delete(key);
			const name = recursiveNames.get(key);
			if (name !== void 0) {
				definitions[name] = projection.schema;
				projection = {
					...projection,
					schema: { $ref: `#/$defs/${name}` }
				};
			}
			completed.set(key, projection);
			return projection;
		};
		const result = visit(root, "config");
		const schema = expressions(result.schema);
		return {
			schema: metadataEffects.length ? { anyOf: [schema, {}] } : schema,
			definitions: Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, expressions(value, false)])),
			acceptsMissing: metadataEffects.length ? "unknown" : result.acceptsMissing,
			limitations: [...new Set(limitations)]
		};
	};
}
//#endregion

export {};
