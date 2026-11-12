/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN (3401–3642) của bundle gốc — lib/types/index.js phần cuối: tail class + name/Config/apply · KHÔNG sửa tay
 */
// @ts-nocheck

					/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
					if (signal?.aborted) signal.throwIfAborted();
					throw new SessionPersistenceCorruptionError(`corrupt Zstandard session log: header frame failed validation: ${String(error)} (raw log: ${path})`, { cause: error });
				}
			}
		} finally {
			await handle.close();
		}
	}
	/** Select the numerically highest canonical generation in one Session directory. */
	async resolveGenerationInDirectory(dir, signal) {
		signal?.throwIfAborted();
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		signal?.throwIfAborted();
		const generations = [];
		const opposite = [];
		for (const entry of entries) {
			const version = parseGenerationLogFilename(entry.name, this.compression);
			if (version !== void 0) {
				generations.push({
					path: join(dir, entry.name),
					version
				});
				continue;
			}
			if (parseGenerationLogFilename(entry.name, this.oppositeCompression()) !== void 0) opposite.push(join(dir, entry.name));
		}
		if (opposite.length > 0) throw this.encodingMismatch(opposite[0]);
		const latest = generations.sort((left, right) => right.version - left.version)[0];
		if (latest === void 0) return void 0;
		return {
			sourcePath: latest.path,
			sourceVersion: latest.version,
			currentPath: join(dir, generationLogFilename(sessionFormatCatalog.currentVersion, this.compression))
		};
	}
	/** Find the unique authoritative generation for an id across project directories. */
	async findLog(id, signal) {
		const matches = [];
		for (const project of await this.listProjectDirs(signal)) {
			signal?.throwIfAborted();
			await this.rejectLegacyFlatArtifact(project, id, signal);
			signal?.throwIfAborted();
			const dir = join(project, encodeSegment(id));
			const selected = await this.resolveGenerationInDirectory(dir, signal);
			if (selected !== void 0) matches.push(selected);
		}
		if (matches.length > 1) throw new Error(`duplicate JSONL session id "${id}" appears in multiple project directories`);
		signal?.throwIfAborted();
		return matches[0];
	}
	/** Require an existing configured root to be a readable directory. */
	assertUsableRoot() {
		try {
			readdirSync(this.root);
		} catch (error) {
			if (isENOENT(error)) return;
			throw error;
		}
	}
	/** Reject metadata that does not identify the selected physical log. */
	async assertStoredIdentity(path, storedVersion, meta, expectedId, signal) {
		signal?.throwIfAborted();
		if (expectedId !== void 0 && meta.id !== expectedId) throw new Error(`corrupt session log "${path}": requested id "${expectedId}" does not match header id "${meta.id}"`);
		let expectedPath;
		try {
			expectedPath = generationLogPath(this.root, meta.cwd, meta.id, storedVersion, this.compression);
		} catch (error) {
			throw new Error(`corrupt session log "${path}": header id cannot name a storage path`, { cause: error });
		}
		if (path !== expectedPath && !await this.sameFile(path, expectedPath, signal)) throw new Error(`corrupt session log "${path}": header id "${meta.id}" and cwd identify "${expectedPath}"`);
		signal?.throwIfAborted();
	}
	/** Validate a supported historical header against the selected source path. */
	validateSourceIdentity(selected, headerValue, expectedId, signal) {
		const result = sessionFormatCatalog.readHeader(headerValue);
		if (result.status !== "current" && result.status !== "migration-required") return;
		return this.assertStoredIdentity(selected.sourcePath, selected.sourceVersion, this.currentHeader(result.header), expectedId, signal);
	}
	/**
	* Whether two path spellings resolve to the same physical file. This admits
	* case aliases on case-insensitive filesystems without weakening identity
	* checks on case-sensitive stores.
	*/
	async sameFile(path, expectedPath, signal) {
		signal?.throwIfAborted();
		try {
			const [actual, expected] = await Promise.all([realpath(path), realpath(expectedPath)]);
			signal?.throwIfAborted();
			return actual === expected;
		} catch (error) {
			signal?.throwIfAborted();
			/* v8 ignore else -- non-ENOENT realpath failures require an external permission or I/O fault */
			if (isENOENT(error)) return false;
			/* v8 ignore next -- non-ENOENT realpath failures are external I/O faults, propagated unchanged */
			throw error;
		}
	}
	/** The human-readable project directories under the configured root. */
	async listProjectDirs(signal) {
		try {
			signal?.throwIfAborted();
			const entries = await readdir(this.root, { withFileTypes: true });
			signal?.throwIfAborted();
			return entries.filter((e) => e.isDirectory()).map((e) => join(this.root, e.name));
		} catch (error) {
			if (isENOENT(error)) return [];
			throw error;
		}
	}
	/** List session-owned directories and reject the obsolete flat-file layout. */
	async listSessionDirs(project, signal) {
		signal?.throwIfAborted();
		const entries = await readdir(project, { withFileTypes: true });
		signal?.throwIfAborted();
		const legacy = entries.find((entry) => entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".jsonl.zstd")));
		if (legacy !== void 0) throw this.legacyLayout(join(project, legacy.name));
		return entries.filter((entry) => entry.isDirectory()).map((entry) => join(project, entry.name));
	}
	/** Reject a root that already belongs to the other physical encoding. */
	ensureRootEncoding() {
		this.rootEncodingCheck ??= this.checkRootEncoding();
		return this.rootEncodingCheck;
	}
	async checkRootEncoding() {
		await this.mapSessionDirectories(async (dir) => {
			const incompatible = await this.findOppositeGenerationInDirectory(dir);
			if (incompatible !== void 0) throw this.encodingMismatch(incompatible);
		});
	}
	async rejectLegacyFlatArtifact(project, id, signal) {
		signal?.throwIfAborted();
		const encoded = encodeSegment(id);
		for (const compression of ["zstd", "none"]) {
			const path = join(project, encoded + logSuffix(compression));
			const artifactExists = await this.exists(path);
			signal?.throwIfAborted();
			if (artifactExists) throw this.legacyLayout(path);
		}
	}
	async rejectOppositeArtifact(cwd, id) {
		const path = await this.findOppositeGenerationInDirectory(sessionDir(this.root, cwd, id));
		if (path !== void 0) throw this.encodingMismatch(path);
	}
	/** Return the highest canonical generation encoded with the other configured suffix. */
	async findOppositeGenerationInDirectory(dir) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		const generations = [];
		for (const entry of entries) {
			const version = parseGenerationLogFilename(entry.name, this.oppositeCompression());
			if (version !== void 0) generations.push({
				name: entry.name,
				version
			});
		}
		const latest = generations.sort((left, right) => right.version - left.version)[0];
		return latest === void 0 ? void 0 : join(dir, latest.name);
	}
	oppositeCompression() {
		return this.compression === "zstd" ? "none" : "zstd";
	}
	encodingMismatch(path) {
		return /* @__PURE__ */ new Error(`session artifact ${JSON.stringify(path)} uses ${logSuffix(this.oppositeCompression())}, but this backend is configured for compression ${JSON.stringify(this.compression)}; use a separate root or select the matching compression mode`);
	}
	legacyLayout(path) {
		return /* @__PURE__ */ new Error(`session artifact ${JSON.stringify(path)} uses the unsupported flat-file layout; use a separate root or move it into a project/session directory before loading`);
	}
	async exists(path) {
		try {
			await (await open(path, "r")).close();
			return true;
		} catch (error) {
			/* v8 ignore else -- Windows reports file-valued parents as ENOENT; POSIX covers direct ENOTDIR. */
			if (isENOENT(error)) {
				/* v8 ignore next -- native Windows coverage exercises this platform dispatch; POSIX reports ENOTDIR from open */
				if (process.platform === "win32") await this.assertLogParentAllowsAbsence(path);
				return false;
			}
			/* v8 ignore next -- Windows repairs ENOTDIR from ENOENT above; POSIX covers direct ENOTDIR. */
			throw error;
		}
	}
	/* v8 ignore start -- native Windows coverage exercises this repair; POSIX open reports ENOTDIR before this point. */
	async assertLogParentAllowsAbsence(path) {
		try {
			const parent = dirname(path);
			if ((await stat(parent)).isDirectory()) return;
			const error = /* @__PURE__ */ new Error(`ENOTDIR: parent path exists but is not a directory: ${parent}`);
			error.code = "ENOTDIR";
			error.path = parent;
			throw error;
		} catch (error) {
			if (isENOENT(error)) return;
			throw error;
		}
	}
};
/** JSONL persistence plugin label. */
const name = "session-persistence-jsonl";
/** Loader schema for the backend's root, physical encoding, and listing concurrency. */
const Config = z.object({
	root: z.string().required(),
	compression: JsonlCompressionSchema,
	listConcurrency: z.natural().min(1).default(DEFAULT_LIST_CONCURRENCY)
});
/**
* Mount persistence with live routing and handles retained through the
* consumer unloads triggered by removing this provider. Consumers must own
* cleanup in their injecting scope; concurrent root disposal is not ordered.
* @param ctx - the owning plugin context.
* @param config - the storage root, physical encoding, and listing concurrency.
* @returns resolves when the service is ready.
*/
async function apply(ctx, config) {
	let service;
	ctx.effect(function* () {
		const tracker = new JsonlBackendTracker(name);
		yield tracker.install(ctx);
		service = ctx.plugin({
			name: "session-persistence-jsonl-service",
			apply(serviceCtx) {
				new JsonlSessionPersistence(serviceCtx, config, tracker);
			}
		});
		yield service.dispose;
	}, "session-persistence-jsonl resources");
	await service.await();
}
//#endregion
export { Config, JsonlCompressionSchema, apply, name };

export {};
