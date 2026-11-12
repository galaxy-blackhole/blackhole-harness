/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 3002–3572 của stock lib/index.js (@deepseek-ai/dsh-app-boot): kernel boot library (profile resolution, bundles, config-schema).
 */
// @ts-nocheck

//#region lib/types/config-schema/document.js
/** Compose Loader entry/patch structure and discovered plugin input schemas into one JSON Schema document. */
const ref = (name) => ({ $ref: `#/$defs/${name}` });
function metadata() {
	return {
		id: {
			type: "string",
			description: "Entry id. Loader generates an id when an entry omits it; patches use the configured id."
		},
		name: {
			type: "string",
			description: "Plugin module specifier. Inserted relative plugin paths are anchored beside their patch file."
		},
		config: {},
		group: {
			type: ["boolean", "null"],
			description: "Allows patch indexing and insertion into an entry-list config; does not select the plugin implementation."
		},
		disabled: {
			anyOf: [{ type: ["boolean", "null"] }, ref("loaderExpression")],
			description: "Boolean or !!js expression. The Loader coerces other truthy values as disabled; this schema rejects them."
		},
		inject: { anyOf: [
			{
				type: "array",
				items: { type: "string" }
			},
			{ type: "object" },
			{ type: "null" }
		] },
		intercept: { type: ["object", "null"] },
		isolate: {
			type: ["object", "null"],
			additionalProperties: { anyOf: [{ const: true }, { type: "string" }] }
		}
	};
}
function patchStructure() {
	return {
		type: "object",
		allOf: [ref("entryMetadata")],
		properties: { insert: ref("entryList") },
		description: "An insert appends entries, optionally inside the group identified by id. Other patches replace supplied fields; config is replaced wholesale, not deep-merged. A truthy name asserts the existing plugin name rather than renaming it. Unknown targets and non-insert patches without a nonempty id are warned and skipped."
	};
}
/**
* Build a schema for the composed entry list and a separately addressable root-tree patch list.
* Unknown plugin names remain open; only collected schemas supply plugin-specific constraints.
* @param profile - selected profile name.
* @param collected - declarations discovered without mounting plugins, including include descendants.
* @param targets - last-id-wins patch targets from the root tree's patch index, excluding include descendants.
* @param initialDiagnostics - composition and import diagnostics already collected.
* @returns one JSON Schema document with explicit collection and projection annotations.
*/
async function buildConfigSchemaDocument(profile, collected, targets, initialDiagnostics) {
	const project = await createConfigProjector();
	const diagnostics = [...initialDiagnostics];
	const definitions = {
		loaderExpression: LOADER_EXPRESSION_SCHEMA,
		entryMetadata: {
			type: "object",
			properties: metadata()
		},
		entryList: {
			type: "array",
			items: ref("entry")
		},
		patchList: {
			type: "array",
			items: ref("patch")
		},
		unknownConfig: { $comment: "No projected Config schema is available; this is unknown configuration, not a prohibition on fields." },
		includeConfig: {
			type: "object",
			required: ["path"],
			properties: {
				path: {
					type: "string",
					description: "YAML/JSON filename resolved relative to the owning Loader tree. This field is literal, not a !!js expression."
				},
				initial: ref("entryList"),
				patches: {
					type: "array",
					items: ref("includePatch")
				},
				enableLogs: { type: "boolean" }
			},
			description: "Native Include configuration stays literal. initial is used only when the file is absent. Included files have their own module-resolution base and patch target index."
		},
		includePatch: patchStructure()
	};
	const entries = [];
	const outputByEntry = /* @__PURE__ */ new Map();
	const projections = /* @__PURE__ */ new Map();
	const trees = new Set(["#/$defs/entryList", "#/$defs/includeConfig"]);
	const requiredConfigs = new Set(trees);
	const names = new Map([["cordis:group", new Set(["#/$defs/entryList"])], ["cordis:include", new Set(["#/$defs/includeConfig"])]]);
	for (const entry of collected) {
		const { native, ...output } = entry;
		if (entry.tree) output.configRef = entry.tree === "group" ? "#/$defs/entryList" : "#/$defs/includeConfig";
		else if (native) {
			let projection = projections.get(native);
			if (projection === void 0) {
				const name = `config${projections.size}`;
				try {
					const result = project(native, name);
					definitions[name] = result.schema;
					Object.assign(definitions, result.definitions);
					projection = {
						reference: `#/$defs/${name}`,
						required: result.acceptsMissing === false,
						limitations: result.limitations
					};
					projections.set(native, projection);
				} catch (error) {
					output.status = "error";
					diagnostics.push({
						level: "error",
						path: entry.path,
						message: error instanceof Error ? error.message : String(error)
					});
				}
			}
			if (projection) {
				output.configRef = projection.reference;
				output.status = projection.limitations.length ? "partial" : "schema";
				if (projection.required) requiredConfigs.add(projection.reference);
				for (const message of projection.limitations) diagnostics.push({
					level: "warning",
					path: entry.path,
					message
				});
			}
		}
		output.configRef ??= "#/$defs/unknownConfig";
		entries.push(output);
		outputByEntry.set(entry, output);
		if (entry.name !== void 0) {
			const choices = names.get(entry.name) ?? /* @__PURE__ */ new Set();
			choices.add(output.configRef);
			names.set(entry.name, choices);
		}
	}
	const dormant = {
		properties: {
			disabled: { anyOf: [{ const: true }, ref("loaderExpression")] },
			group: { not: { const: true } }
		},
		required: ["disabled"]
	};
	const entryRules = [];
	for (const [name, choices] of names) {
		const validated = { properties: { config: { anyOf: [...choices].map((reference) => ({ $ref: reference })) } } };
		let then = validated;
		if ([...choices].every((reference) => requiredConfigs.has(reference))) {
			then = {
				if: dormant,
				else: {
					...validated,
					required: ["config"]
				}
			};
			if (![...choices].every((reference) => trees.has(reference))) then.then = validated;
		}
		entryRules.push({
			if: {
				properties: { name: { const: name } },
				required: ["name"]
			},
			then
		});
		if (choices.size > 1) diagnostics.push({
			level: "warning",
			message: `Plugin ${JSON.stringify(name)} has multiple collected schemas; entry validation accepts their union because module resolution depends on the owning tree.`
		});
	}
	definitions.entry = {
		type: "object",
		required: ["name"],
		allOf: [ref("entryMetadata"), ...entryRules],
		description: "Loader entry. Unknown metadata and plugin names are accepted; plugin-specific validation is available only for the names collected in this profile. Distinct resolutions of one name use a union of their schemas."
	};
	const patchRules = [];
	for (const [id, target] of targets) {
		if (target.name === void 0) continue;
		const configRef = outputByEntry.get(target)?.configRef ?? "#/$defs/unknownConfig";
		patchRules.push({
			if: {
				required: ["id"],
				properties: { id: { const: id } },
				allOf: [{ not: { required: ["insert"] } }, { anyOf: [{ not: { required: ["name"] } }, { properties: { name: { enum: ["", target.name] } } }] }]
			},
			then: { properties: { config: { $ref: configRef } } }
		});
	}
	definitions.patch = {
		...patchStructure(),
		allOf: [ref("entryMetadata"), ...patchRules]
	};
	const positions = new Map(entries.map((entry, index) => [entry.path, index]));
	diagnostics.sort((left, right) => (positions.get(left.path ?? "") ?? -1) - (positions.get(right.path ?? "") ?? -1));
	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		title: `Cordis configuration for profile ${profile}`,
		description: "Describes the parsed entry-list YAML printed by --dump-config. Use $defs.patchList for a profile/home/CLI overlay. Parse !!js with the Cordis entry-list YAML dialect. Expression results, service dependencies, plugin startup checks, and sequence-dependent patch targets still require runtime validation.",
		$comment: "Bundle, profile, home, and CLI layers apply in that order. A patch config replaces the whole config. JSON Schema defaults are annotations; Schemastery validates a fallback on null/omission unless required rejects it first. Schemastery unions select the first successful branch. Root patch id constraints describe the current index, not ids introduced or changed by earlier patches. Include-local patches have a separate index. Relative plugin insertions require their source patch directory; this document does not infer future overlay locations.",
		type: "array",
		items: ref("entry"),
		$defs: definitions,
		"x-cordis": {
			profile,
			complete: !diagnostics.some((item) => item.level === "error") && !entries.some((entry) => [
				"partial",
				"unsupported",
				"error"
			].includes(entry.status)) && ![...names.values()].some((choices) => choices.size > 1),
			entries,
			diagnostics,
			patchSchema: "#/$defs/patchList"
		}
	};
}
//#endregion
//#region lib/types/config-schema/collect.js
/** Boot-free inspection of declared plugin Config schemas using profile module resolution. */
function objectLike(value) {
	return value !== null && (typeof value === "object" || typeof value === "function");
}
function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function configOf(plugin) {
	return objectLike(plugin) ? Reflect.get(plugin, "Config") : void 0;
}
function validateMetadata(row) {
	for (const key of ["id", "name"]) {
		const value = Reflect.get(row, key);
		if (value !== void 0 && typeof value !== "string") throw new Error(`${key} must be a literal string`);
	}
	const group = Reflect.get(row, "group");
	if (group !== void 0 && group !== null && typeof group !== "boolean") throw new Error("group must be a literal boolean or null");
}
function validateEntry(value) {
	if (!record(value) || typeof value.name !== "string") throw new Error("each entry must be a mapping with a literal plugin name");
	validateMetadata(value);
}
function entryList(value) {
	if (value === void 0) throw new Error("entry list config is missing");
	if (!Array.isArray(value)) throw new Error("expected a literal entry list; config expressions are not evaluated");
	return value;
}
function includePatches(value) {
	if (value === void 0) return void 0;
	if (!Array.isArray(value)) throw new Error("include patches must be a literal patch list; config expressions are not evaluated");
	for (const patch of value) {
		if (!record(patch) || isJsExpr(patch)) throw new Error("include patches must be literal mappings; config expressions are not evaluated");
		validateMetadata(patch);
		if (patch.insert !== void 0) entryList(patch.insert);
	}
	return value;
}
/**
* Generate JSON Schema from parsed entry rows and root-tree patches without applying plugins or evaluating expressions.
* Imports, Config getters, and lazy schema builders execute trusted plugin code; transform callbacks do not. Calls must not overlap
* another profile-resolution interception; module imports remain cached after the interception is released.
* @param profile - prepared profile whose directory anchors root module and include resolution.
* @param entries - unvalidated rows from profile composition; malformed rows become positioned diagnostics without losing siblings.
* @param resolution - the same immutable package resolution used for profile boot.
* @param diagnostics - existing composition diagnostics; copied into the returned catalog.
* @returns a JSON Schema document with partial-result diagnostics and Config references under `x-cordis`.
* @throws when Node's profile module resolution cannot be installed.
*/
async function collectConfigSchemas(profile, entries, resolution, diagnostics = []) {
	const result = {
		entries: [],
		diagnostics: [...diagnostics]
	};
	const byOptions = /* @__PURE__ */ new Map();
	const interception = installRuntimeInterception(resolution);
	try {
		const loader = ModuleLoader.fromInternal();
		if (loader === void 0) throw new Error("config schema dump requires the Node module loader used by profile resolution");
		const builtins = {
			group: Group,
			include: Include
		};
		const nativeCarriers = /* @__PURE__ */ new Map();
		const carrier = async (plugin, baseUrl) => {
			if (plugin === Group) return "group";
			if (plugin === Include) return "include";
			if (!objectLike(plugin) || !Reflect.get(plugin, EntryGroup.key)) return void 0;
			let resolved = nativeCarriers.get(baseUrl);
			if (resolved === void 0) {
				resolved = Promise.allSettled([loader.import("@deepseek-ai/cordis-plugin-group", baseUrl, {}), loader.import("@deepseek-ai/cordis-plugin-include", baseUrl, {})]).then(([group, include]) => {
					return {
						group: group.status === "fulfilled" ? Loader.prototype.unwrapExports(group.value) : void 0,
						include: include.status === "fulfilled" ? Loader.prototype.unwrapExports(include.value) : void 0
					};
				});
				nativeCarriers.set(baseUrl, resolved);
			}
			const native = await resolved;
			if (plugin === native.group) return "group";
			if (plugin === native.include) return "include";
			throw new Error("unrecognized Loader tree carrier; use cordis:group or cordis:include for native child collection");
		};
		const ancestors = /* @__PURE__ */ new Set();
		const report = (path, error) => {
			result.diagnostics.push({
				level: "error",
				path,
				message: error instanceof Error ? error.message : String(error)
			});
		};
		const warn = (path) => (message, ...args) => {
			let index = 0;
			result.diagnostics.push({
				level: "warning",
				path,
				message: message.replace(/%C/g, () => JSON.stringify(args[index++]))
			});
		};
		const walkInclude = async (config, baseUrl, path) => {
			if (config === void 0) throw new Error("include config is missing");
			if (!record(config) || isJsExpr(config)) throw new Error("include config must be literal; config expressions are not evaluated");
			if (typeof config.path !== "string") throw new Error("include path must be literal; config expressions are not evaluated");
			const filename = fileURLToPath(new URL(config.path, baseUrl));
			const extension = extname(filename);
			if (![
				".json",
				".yaml",
				".yml"
			].includes(extension)) throw new Error(`include extension ${JSON.stringify(extension)} is not supported`);
			let source;
			let canonical;
			try {
				canonical = await realpath(filename);
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				canonical = filename;
			}
			if (ancestors.has(canonical)) throw new Error(`include cycle at ${filename}`);
			let content;
			try {
				content = await readFile(filename, "utf8");
			} catch (error) {
				if (error.code !== "ENOENT") throw error;
				source = config.initial;
				if (source === void 0) throw new Error(`include file not found: ${filename}`);
			}
			if (content !== void 0) try {
				source = extension === ".json" ? JSON.parse(content) : yaml.load(content, { schema: entryListSchema });
			} catch (error) {
				const at = error instanceof yaml.YAMLException ? ` at line ${error.mark.line + 1}, column ${error.mark.column + 1}` : "";
				throw new Error(`invalid ${extension === ".json" ? "JSON" : "YAML"} include ${filename}${at}`);
			}
			const patches = includePatches(config.patches);
			const rows = entryList(source);
			let children;
			try {
				children = applyEntryPatches(rows, patches, warn(path));
			} catch (error) {
				throw new Error(`include patches could not be composed for ${filename}; child declarations are unavailable`, { cause: error });
			}
			ancestors.add(canonical);
			try {
				await walk(children, new URL(".", pathToFileURL(filename)).href, `${path}/include`);
			} finally {
				ancestors.delete(canonical);
			}
		};
		const walk = async (rows, baseUrl, prefix) => {
			for (const [index, value] of rows.entries()) {
				const path = `${prefix}/${index}`;
				const identity = record(value) ? value : void 0;
				const entry = {
					path,
					...typeof identity?.id === "string" ? { id: identity.id } : {},
					...typeof identity?.name === "string" ? { name: identity.name } : {},
					status: "error"
				};
				result.entries.push(entry);
				const row = value;
				try {
					validateEntry(row);
				} catch (error) {
					report(path, error);
					continue;
				}
				entry.status = "absent";
				byOptions.set(row, entry);
				let plugin;
				try {
					let exports;
					if (row.name.startsWith("cordis:")) {
						const name = row.name.slice(7);
						if (!Object.hasOwn(builtins, name)) throw new Error(`unknown Cordis builtin ${JSON.stringify(row.name)}`);
						exports = builtins[name];
					} else exports = await loader.import(row.name, baseUrl, {});
					plugin = Loader.prototype.unwrapExports(exports);
					const schema = configOf(plugin);
					if (schema !== void 0 && schema !== null) if (!isNativeConfigSchema(schema)) {
						entry.status = "unsupported";
						report(path, "Config is not a native Schemastery schema");
					} else {
						entry.status = "schema";
						entry.native = schema;
					}
				} catch (error) {
					entry.status = "error";
					report(path, error);
				}
				try {
					const kind = await carrier(plugin, baseUrl);
					if (kind === void 0) continue;
					entry.tree = kind;
					if (row.config === void 0 && row.group !== true && (row.disabled === true || isJsExpr(row.disabled))) continue;
					if (kind === "group") await walk(entryList(row.config), baseUrl, `${path}/config`);
					else await walkInclude(row.config, baseUrl, path);
				} catch (error) {
					report(path, error);
				}
			}
		};
		await walk(entries, pathToFileURL(join(profile.dir, "cordis.yml")).href, "");
		const targets = /* @__PURE__ */ new Map();
		const indexTargets = (rows) => {
			for (const row of rows) {
				if (!record(row)) continue;
				if (typeof row.id === "string" && row.id) {
					const entry = byOptions.get(row);
					if (entry) targets.set(row.id, entry);
					else targets.delete(row.id);
				}
				if (row.group && Array.isArray(row.config)) indexTargets(row.config);
			}
		};
		indexTargets(entries);
		return await buildConfigSchemaDocument(profile.name, result.entries, targets, result.diagnostics);
	} finally {
		interception.dispose();
	}
}
//#endregion
//#region lib/types/config-schema/index.js
/** Profile schema generation: composition diagnostics, runtime resolution, and boot-free discovery. */
/**
* Generate JSON Schema for a prepared profile's ordered patch layers without mounting plugins or evaluating expressions.
* Imports, Config getters, and lazy builders execute trusted code. Native validators and
* transform callbacks are not executed. Calls must not overlap another profile-resolution interception; collection
* releases its interception on success or rejection, while Node retains imported modules. Supplied layers are not mutated.
* Profile preparation, layer selection, process streams, and exit policy belong to the caller.
* @param profile - prepared on-disk profile whose directory anchors root module and include resolution.
* @param layers - already parsed patch lists in application order, including caller-selected home and argv overlays.
* @param installAnchor - package manifest anchoring the installation's runtime dependencies.
* @returns a JSON Schema document with declaration references, partial results, and diagnostics under `x-cordis`.
* @throws when composition or runtime resolution cannot be prepared.
*/
async function generateConfigSchema(profile, layers, installAnchor) {
	const diagnostics = [];
	for (const { packageName } of profile.skippedBundles) diagnostics.push({
		level: "error",
		message: `Selected profile bundle ${JSON.stringify(packageName)} could not be loaded; repair or remove its bundle selection.`
	});
	return collectConfigSchemas(profile, composeEntries(layers, (message) => diagnostics.push({
		level: "warning",
		message
	})), await createRuntimeResolution({
		installAnchor,
		profile
	}), diagnostics);
}
//#endregion
//#region lib/types/profile-resolution/service.js
/** Package metadata resolved through one runtime interception. */
function readPackage(dir, fallbackName) {
	const manifestPath = join(dir, "package.json");
	if (!existsSync(manifestPath)) return void 0;
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	const name = manifest.name;
	const version = manifest.version;
	return {
		name: typeof name === "string" ? name : fallbackName,
		version: typeof version === "string" ? version : void 0,
		dir,
		manifestPath,
		manifest
	};
}
/** Package lookup shared by metadata consumers in one profile process. */
var PluginPackages = class extends Service {
	packages = /* @__PURE__ */ new Map();
	interception;
	disposeWorkerResolution;
	current;
	constructor(ctx, config = {}) {
		super(ctx, "pluginPackages");
		if (config.resolution === void 0) return;
		this.current = config.resolution;
		const interception = installRuntimeInterception(config.resolution);
		this.disposeWorkerResolution = registerWorkerResolution(config.resolution);
		this.interception = interception;
		ctx.effect(() => () => {
			this.disposeWorkerResolution?.();
			interception.dispose();
		}, "profile package resolution");
	}
	/** The published runtime resolution, or `undefined` when Node resolves packages alone. */
	get resolution() {
		return this.current;
	}
	/**
	* Publish a complete successor generation for this process and subsequently created Workers.
	* Profile mappings and local package names may be removed after their plugins stop; linked roots may also be removed.
	* Retained profile mappings may change their declarer and version, but not their normalized directory or scope;
	* installation mappings must remain unchanged. Publication does not unload modules or clear Node caches.
	* @param successor - fully constructed generation accepted by {@link RuntimeInterception.replace}.
	*/
	replace(successor) {
		if (this.interception === void 0) throw new Error("plugin-packages: runtime resolution is not installed");
		this.interception.replace(successor);
		this.current = successor;
		this.packages = /* @__PURE__ */ new Map();
		this.disposeWorkerResolution?.();
		this.disposeWorkerResolution = registerWorkerResolution(successor);
	}
	/**
	* Publish the latest generation computed by the installed resolution through {@link replace}. Package contents
	* and loaded modules are not reloaded.
	* @throws when no resolution is installed, it is plain data rather than a {@link ProfileRuntimeResolution},
	* reading the latest files fails, or the successor is rejected. A computed resolution without a profile can refresh.
	*/
	async refresh() {
		if (!(this.current instanceof ProfileRuntimeResolution)) throw new Error("plugin-packages: the installed runtime resolution cannot be recomputed");
		this.replace(await this.current.computeLatestResolution());
	}
	/**
	* Locate the package named by a specifier without requiring a package export.
	* @param specifier - module specifier whose package owns the requested module.
	* @param parentURL - URL whose Node lookup order applies.
	* @returns the parsed package, or undefined when no package owns the request.
	*/
	packageOf(specifier, parentURL) {
		const name = barePackageName(specifier);
		if (name === void 0) return void 0;
		const dir = this.interception === void 0 ? packageDirFromParent(name, parentURL) : this.interception.packageDir(name, parentURL);
		if (dir === void 0) return void 0;
		const key = JSON.stringify({
			dir,
			name
		});
		if (!this.packages.has(key)) this.packages.set(key, readPackage(dir, name));
		return this.packages.get(key);
	}
	/**
	* Read display metadata without loading or activating the target plugin.
	* @param specifier - configured package module, including package subpaths.
	* @param parentURL - owning Loader tree's resolution base.
	* @returns local display metadata or its diagnostic; undefined for non-package requests or absent metadata.
	*/
	metaOf(specifier, parentURL) {
		return readPluginMeta(specifier, parentURL);
	}
};
function packageDirFromParent(name, parentURL) {
	for (const searchPath of createRequire(parentURL).resolve.paths(name)) {
		const candidate = join(searchPath, name);
		if (existsSync(join(candidate, "package.json"))) return candidate;
	}
}
//#endregion

export {};
