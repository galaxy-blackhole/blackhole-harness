/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN (2276–2800) của bundle gốc — lib/types/index.js phần đầu: hằng số + helper + đầu class · KHÔNG sửa tay
 */
// @ts-nocheck

//#region lib/types/index.js
/**
* JSONL durable session-persistence backend. It stores a header and contiguous
* events in immutable generation files under one directory per session and serves the handle-based
* `SessionPersistence` API: `create`/`open` return per-session handles, and
* every read validates the same fail-closed storage contract.
* @module @deepseek-ai/dsh-session-persistence-jsonl
*/
/**
* Internal handoff-reuse policy, not deployment configuration: a cold
* observation and the resume that immediately follows it reuse one parsed
* log, so the memo only needs the sessions in flight between those steps.
*/
const COLD_LOG_MEMO_MAX_ENTRIES = 2;
const DEFAULT_COMPRESSION = "zstd";
/**
* Internal scheduling constant, not deployment configuration: balance
* frame-boundary event-loop yields against `setImmediate` overhead. One frame
* remains an indivisible synchronous decode.
*/
const ZSTD_DECODE_YIELD_INTERVAL_MS = 500;
/** Assert that the independently decodable first frame contains only the header record. */
function assertZstdHeaderFrame(plaintext) {
	if (plaintext.length === 0 || plaintext.indexOf(10) !== plaintext.length - 1) throw new Error("corrupt Zstandard session log: first frame is not exactly one header line");
}
/** Loader schema for the JSONL artifact's physical encoding. */
const JsonlCompressionSchema = z.union([z.const("zstd"), z.const("none")]).default(DEFAULT_COMPRESSION);
/** Default maximum listing filesystem operations in flight per backend. */
const DEFAULT_LIST_CONCURRENCY = 3;
/** Deep-freeze acyclic stored JSON; its arrays contain only indexed JSON values. */
function freezeStoredEvent(event) {
	const pending = [event];
	while (pending.length > 0) {
		const current = pending.pop();
		Object.freeze(current);
		if (Array.isArray(current)) for (let index = 0; index < current.length; index += 1) {
			const child = current[index];
			if (child !== null && typeof child === "object") pending.push(child);
		}
		else for (const key in current) {
			const child = current[key];
			if (child !== null && typeof child === "object") pending.push(child);
		}
	}
}
/** Establish immutable sharing for one decoded event graph and report that state. */
function freezeStoredEvents(events) {
	for (const event of events) freezeStoredEvent(event);
	Object.freeze(events);
	return {
		eventState: "shared-frozen",
		events
	};
}
/** Build the stat-derived best-effort change token shared by full and lightweight reads. */
function fileRevision(identity) {
	return SessionPersistenceRevision([
		identity.dev,
		identity.ino,
		identity.size,
		identity.mtimeNs,
		identity.ctimeNs
	].join(":"));
}
/** Whether a filesystem error means absence; every non-ENOENT failure must surface. */
function isENOENT(error) {
	return error?.code === "ENOENT";
}
/**
* Run `task` over `items` through the backend's shared listing limiter and
* settle every call. Callers consume the outcomes in input order, so the first
* failure they report matches a sequential loop whatever the completion order.
* A limited task must never wait on the same limiter.
* @param limit - the backend's shared listing limiter.
* @param items - inputs in their sequential order.
* @param task - per-item operation.
* @returns one outcome per item, in input order.
*/
function settleLimited(limit, items, task) {
	return Promise.allSettled(items.map((item) => limit(() => task(item))));
}
/**
* Unwrap outcomes from {@link settleLimited}, rethrowing the first rejection in input order.
* @param outcomes - outcomes in input order.
* @returns the fulfilled values in input order.
*/
function settledValues(outcomes) {
	return outcomes.map((outcome) => {
		if (outcome.status === "rejected") throw outcome.reason;
		return outcome.value;
	});
}
/** Whether a filesystem-owned failure should retain its original errno and path. */
function isErrnoException(error) {
	return typeof error?.code === "string";
}
/** Preserve an Error abort reason and normalize hostile non-Error reasons. */
function abortError(signal) {
	return signal.reason instanceof Error ? signal.reason : new Error("session migration preparation aborted", { cause: signal.reason });
}
/** Let one caller stop waiting without transferring cancellation ownership to shared work. */
function waitWithAbort(operation, signal) {
	if (signal === void 0) return operation;
	/* v8 ignore next -- requireStoredLog synchronously rechecks the signal immediately before waiting. */
	if (signal.aborted) return Promise.reject(abortError(signal));
	return new Promise((resolve, reject) => {
		const stopWaiting = () => {
			reject(abortError(signal));
		};
		signal.addEventListener("abort", stopWaiting, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", stopWaiting);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", stopWaiting);
			/* v8 ignore else -- the preparation owner normalizes every rejection before this waiter sees it. */
			if (error instanceof Error) reject(error);
			else reject(new Error("session migration preparation failed", { cause: error }));
		});
	});
}
/**
* The JSONL backend registered as `ctx.sessionPersistence` by the plugin.
* Sessions materialize lazily: a created session is
* visible to this process immediately, reaches disk on its first append or
* flush, and never existed if the process crashes before that.
*/
var JsonlSessionPersistence = class extends SessionPersistence {
	config;
	tracker;
	/** Backend label for diagnostics and effects; shadows `Service.name` without changing the service key. */
	name = "session-persistence-jsonl";
	root;
	compression;
	/**
	* Bounds directory, header, and stat I/O across every concurrent listing of
	* this backend (`list()`, the root encoding check, historical fingerprints).
	* Queued tasks of a cancelled listing run and reject at their signal check.
	*/
	listLimit;
	rootEncodingCheck;
	generationFormat;
	/**
	* Bounded LRU of parsed, validated stored logs keyed by session id and
	* guarded by the stat-derived revision, so an immediate cold-read handoff
	* (observation then resume) parses the artifact once. Every local mutation
	* for an id invalidates its entry; a foreign write misses through the
	* revision guard.
	*/
	coldLogMemo = /* @__PURE__ */ new Map();
	/** One joinable decode/migration operation per selected historical Session file revision. */
	migrationPreparations = /* @__PURE__ */ new Map();
	constructor(ctx, config, tracker) {
		super(ctx);
		this.config = config;
		this.tracker = tracker;
		/* v8 ignore next 5 -- generated catalog and Session source share one build-time version owner. */
		if (sessionFormatCatalog.currentVersion !== SESSION_FORMAT_VERSION) throw new Error(`session-persistence-jsonl: format catalog v${sessionFormatCatalog.currentVersion} does not match Session v${SESSION_FORMAT_VERSION}`);
		this.root = resolve(config.root);
		this.compression = config.compression ?? DEFAULT_COMPRESSION;
		this.listLimit = pLimit(config.listConcurrency ?? DEFAULT_LIST_CONCURRENCY);
		this.generationFormat = {
			currentVersion: sessionFormatCatalog.currentVersion,
			encodeHeader: (header, inheritedEventCount) => sessionFormatCatalog.encodeCurrentHeader(header, inheritedEventCount),
			encodeEvent: (event) => sessionFormatCatalog.encodeCurrentEvent(event),
			isUnsupportedMigrationError: (error) => error instanceof SessionFormatUnsupportedMigrationError
		};
		this.assertUsableRoot();
	}
	/**
	* Refusal-diagnostics hook: the absolute target path, without touching the filesystem.
	* @param meta - the stored header naming the session and its cwd.
	* @returns the artifact kind and absolute path.
	*/
	locate(meta) {
		return {
			kind: "jsonl",
			path: logPath(this.root, meta.cwd, meta.id, this.compression)
		};
	}
	/**
	* Create a new stored session and take its write ownership. The session is
	* visible to this process immediately; the physical artifact appears on the
	* first append or flush.
	* @param header - the immutable header to store; must be losslessly
	*   JSON-serializable with a non-negative safe-integer `createdAt`.
	* @param options - optional cancellation.
	* @returns the owned write handle.
	*/
	async create(header, options) {
		options?.signal?.throwIfAborted();
		const snapshot = materializeCreateHeader(header);
		toHeaderLine(snapshot, options?.inheritedEventCount);
		const inheritedEventCount = SessionLogOffset(options?.inheritedEventCount ?? 0);
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		if (this.tracker.hasPending(snapshot.id) || await this.findLog(snapshot.id, options?.signal) !== void 0) throw new SessionAlreadyExistsError(snapshot.id);
		options?.signal?.throwIfAborted();
		this.tracker.registerCreated(snapshot, inheritedEventCount);
		return this.tracker.adopt(new JsonlSessionHandle(this, snapshot.id, snapshot, "write", {
			cursor: 0,
			materialized: false,
			inheritedEventCount
		}));
	}
	/**
	* Open an existing stored session for `read` or single-writer `write`.
	* @param id - the stored session to open.
	* @param access - `read` (no ownership) or `write` (atomic in-process claim).
	* @param options - optional cancellation.
	* @returns the open handle.
	*/
	async open(id, access, options) {
		options?.signal?.throwIfAborted();
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		const pending = this.tracker.pendingOf(id);
		if (access === "read") {
			if (pending !== void 0) return this.tracker.adopt(new JsonlSessionHandle(this, id, pending.header, "read", {
				cursor: 0,
				materialized: false,
				inheritedEventCount: pending.inheritedEventCount
			}));
			let stored;
			try {
				stored = await this.requireStoredLog(id, options?.signal);
			} catch (error) {
				if (!(error instanceof JsonlGenerationSourceChangedError)) throw error;
				stored = await this.requireStoredLog(id, options?.signal);
			}
			let state;
			if (stored.status === "prepared") state = {
				cursor: 0,
				materialized: true,
				inheritedEventCount: stored.inheritedEventCount,
				primed: stored
			};
			else state = {
				cursor: 0,
				materialized: true,
				inheritedEventCount: stored.inheritedEventCount
			};
			return this.tracker.adopt(new JsonlSessionHandle(this, id, stored.meta, "read", state));
		}
		this.tracker.claimWrite(id);
		let lease;
		try {
			const resolved = await this.findLog(id, options?.signal);
			if (resolved === void 0) throw new SessionPersistenceNotFoundError(id);
			lease = await this.acquireLease(id, void 0, dirname(resolved.currentPath));
			const prepared = await this.requireStoredLog(id, options?.signal);
			options?.signal?.throwIfAborted();
			let stored;
			if (prepared.status === "prepared") stored = await this.publishStoredMigration(id, prepared);
			else stored = prepared;
			options?.signal?.throwIfAborted();
			return this.tracker.adopt(new JsonlSessionHandle(this, id, stored.meta, "write", {
				cursor: stored.events.length,
				materialized: true,
				tornTruncateTo: stored.tornTruncateTo,
				recoveredTail: stored.recoveredTail,
				inheritedEventCount: stored.inheritedEventCount,
				primed: stored
			}, lease));
		} catch (error) {
			/* v8 ignore next -- typed backends and fs reject with Error */
			const failure = error instanceof Error ? error : new Error(String(error));
			let releaseFailure;
			try {
				await lease?.release();
			} catch (raw) {
				/* v8 ignore next -- lock releases reject with Error */
				releaseFailure = raw instanceof Error ? raw : new Error(String(raw));
			}
			this.tracker.releaseClaim(id);
			if (releaseFailure !== void 0) throw new AggregateError([failure, releaseFailure], `session "${id}": write open failed and its lock release failed`);
			throw failure;
		}
	}
	/**
	* Flush every active write handle in one durability barrier; see the seam
	* contract.
	* @returns resolution once every write handle active at the call has flushed.
	*/
	flush() {
		return this.tracker.flushAll();
	}
	/**
	* Observe one stored session without reading its event log.
	* @param id - the stored session to observe.
	* @param options - optional cancellation.
	* @returns the snapshot (`sizeBytes` carries the physical artifact size), or
	*   `undefined` when the session does not exist.
	*/
	async stat(id, options) {
		options?.signal?.throwIfAborted();
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		const pending = this.tracker.pendingOf(id);
		if (pending !== void 0) return {
			header: pending.header,
			revision: pending.revision
		};
		const selected = await this.findLog(id, options?.signal);
		if (selected === void 0) return void 0;
		const metadata = await this.readGenerationHeader(selected, id, options?.signal);
		if (metadata === void 0) return void 0;
		try {
			const identity = await stat(selected.sourcePath, { bigint: true });
			options?.signal?.throwIfAborted();
			return {
				...metadata,
				revision: selected.sourceVersion < SESSION_FORMAT_VERSION ? SessionPersistenceRevision(`${fileRevision(identity)}:${await this.historicalCorpusRevision(options?.signal)}`) : fileRevision(identity),
				sizeBytes: Number(identity.size)
			};
		} catch (error) {
			options?.signal?.throwIfAborted();
			if (isENOENT(error)) return void 0;
			throw error;
		}
	}
	/**
	* List every stored session visible to this process: materialized artifacts
	* plus this process's created-but-unmaterialized sessions.
	* @param options - optional cancellation.
	* @returns one snapshot per session, in no promised order.
	*/
	async list(options) {
		const signal = options?.signal;
		const snapshots = [];
		const listed = /* @__PURE__ */ new Set();
		const pending = [...this.tracker.pendingEntries()];
		const artifacts = await this.listArtifacts(signal);
		const corpusRevision = artifacts.some((artifact) => artifact.sourceVersion < SESSION_FORMAT_VERSION) ? await this.historicalCorpusRevision(signal) : void 0;
		const statted = settledValues(await settleLimited(this.listLimit, artifacts, async (artifact) => {
			signal?.throwIfAborted();
			try {
				const identity = await stat(artifact.path, { bigint: true });
				signal?.throwIfAborted();
				return {
					artifact,
					identity
				};
			} catch (error) {
				signal?.throwIfAborted();
				if (!isENOENT(error)) throw error;
				return;
			}
		}));
		for (const entry of statted) {
			if (entry === void 0) continue;
			const { artifact, identity } = entry;
			listed.add(artifact.header.id);
			snapshots.push({
				header: artifact.header,
				formatStatus: artifact.formatStatus,
				revision: artifact.sourceVersion < SESSION_FORMAT_VERSION ? SessionPersistenceRevision(`${fileRevision(identity)}:${corpusRevision}`) : fileRevision(identity),
				sizeBytes: Number(identity.size)
			});
		}
		for (const [id, entry] of pending) if (!listed.has(id)) snapshots.push({
			header: entry.header,
			revision: entry.revision
		});
		signal?.throwIfAborted();
		return snapshots;
	}
	/** Resolve and read one stored log, refusing loudly when the artifact is absent. */
	async requireStoredLog(id, signal) {
		const selected = await this.findLog(id, signal);
		if (selected === void 0) throw new SessionPersistenceNotFoundError(id);
		if (selected.sourceVersion < SESSION_FORMAT_VERSION) {
			const sourceRevision = fileRevision(await stat(selected.sourcePath, { bigint: true }));
			signal?.throwIfAborted();
			let preparation = this.migrationPreparations.get(id);
			if (preparation === void 0 || preparation.sourcePath !== selected.sourcePath || preparation.sourceRevision !== sourceRevision) {
				const controller = new AbortController();
				const promise = this.loadStoredMigration(id, selected, sourceRevision, controller.signal);
				preparation = {
					sourcePath: selected.sourcePath,
					sourceRevision,
					controller,
					promise,
					settled: false,
					waiters: 0
				};
				this.migrationPreparations.set(id, preparation);
				const created = preparation;
				const release = () => {
					created.settled = true;
					if (this.migrationPreparations.get(id) === created) this.migrationPreparations.delete(id);
				};
				promise.then(release, release);
			}
			signal?.throwIfAborted();
			return this.waitForPreparation(id, preparation, signal);
		}
		if (selected.sourceVersion > SESSION_FORMAT_VERSION) {
			/* v8 ignore else -- a readable future header is rejected inside readGenerationHeader. */
			if (await this.readGenerationHeader(selected, id, signal) === void 0) throw new SessionPersistenceCorruptionError(`session "${id}": stored log has a malformed header (raw log: ${selected.sourcePath})`, { cause: /* @__PURE__ */ new Error("malformed Session header") });
			/* v8 ignore next -- readGenerationHeader rejects every future version. */
			throw new SessionFormatUnsupportedError(`${sessionFormatVersionRefusal(id, selected.sourceVersion)} (raw log: ${selected.sourcePath})`, {
				kind: "jsonl",
				path: selected.sourcePath
			});
		}
		const probe = fileRevision(await stat(selected.sourcePath, { bigint: true }));
		const memoized = this.coldLogMemo.get(id);
		if (memoized?.status === "current" && memoized.revision === probe) {
			this.coldLogMemo.delete(id);
			this.coldLogMemo.set(id, memoized);
			return memoized;
		}
		const current = await readStableJsonlFile(selected.sourcePath, signal);
		return this.decodeStoredLog(selected.sourcePath, id, current.bytes, fileRevision(current.identity), signal);
	}
	/** Probe the memo and otherwise decode one historical generation under backend cancellation. */
	async loadStoredMigration(id, selected, sourceRevision, signal) {
		signal.throwIfAborted();
		const memoized = this.coldLogMemo.get(id);
		if (memoized?.status === "prepared" && memoized.revision === sourceRevision) {
			try {
				await memoized.validateRelatedSources();
			} catch (error) {
				this.coldLogMemo.delete(id);
				throw this.generationFailure(id, selected, error);
			}
			this.coldLogMemo.delete(id);
			this.coldLogMemo.set(id, memoized);
			return memoized;
		}
		return this.prepareStoredMigration(id, selected, signal);
	}
	/** Await shared preparation for one caller and abort it only after its last waiter leaves. */
	async waitForPreparation(id, preparation, signal) {
		preparation.waiters += 1;
		try {
			return await waitWithAbort(preparation.promise, signal);
		} finally {
			preparation.waiters -= 1;
			if (preparation.waiters === 0 && !preparation.settled) {
				/* v8 ignore else -- a newer selected source may already own this id's preparation slot. */
				if (this.migrationPreparations.get(id) === preparation) this.migrationPreparations.delete(id);
				preparation.controller.abort();
			}
		}
	}
	/** Decode one historical generation without publishing a successor. */
	async prepareStoredMigration(id, selected, signal) {
		let prepared;
		let validateRelatedSources;
		try {
			const children = async () => (await this.listArtifacts(signal)).filter((source) => source.header.origin === "subagent" && source.header.parentSession === id);
			const sources = await children();
			const related = await prepareCatalogFacts(id, sources, this.compression, signal);
			for (const failure of related.failures) this.ctx.logger.warn(`${this.name}: session "${id}" catalog retained a child with unknown descriptor (raw log: ${failure.path}): ${String(failure.error)}`);
			const membership = sources.map((source) => source.path).sort();
			validateRelatedSources = async () => {
				const current = (await children()).map((source) => source.path).sort();
				const before = new Set(membership);
				const after = new Set(current);
				const changed = current.find((path) => !before.has(path)) ?? membership.find((path) => !after.has(path));
				if (changed !== void 0) throw new JsonlGenerationSourceChangedError(changed);
				await related.validate();
			};
			prepared = await prepareJsonlMigration({
				sourcePath: selected.sourcePath,
				sourceVersion: selected.sourceVersion,
				currentPath: selected.currentPath,
				compression: this.compression,
				format: {
					...this.generationFormat,
					createRestore: (header) => createSessionFormatCatalogWithChildren(related.facts).createRestore(header, {
						recovery: "recoverable",
						validation: "transformed"
					})
				},
				validateRelatedSources,
				verifyCurrentFile: verifyCurrentGenerationInWorker,
				validateHistoricalHeader: (headerValue) => this.validateSourceIdentity(selected, headerValue, id, signal),
				signal
			});
		} catch (error) {
			throw this.generationFailure(id, selected, error);
		}
		const meta = this.currentHeader(prepared.artifact.header);
		assertStoredId(id, meta);
		const events = prepared.artifact.events;
		validateStoredEvents(meta, events, {
			kind: "jsonl",
			path: selected.sourcePath
		});
		const stored = {
			status: "prepared",
			validateRelatedSources,
			meta,
			...freezeStoredEvents(events),
			tornTruncateTo: void 0,
			recoveredTail: [],
			inheritedEventCount: SessionLogOffset(prepared.artifact.inheritedEventCount),
			revision: fileRevision(prepared.sourceIdentity),
			publication: {
				source: selected,
				value: prepared
			}
		};
		this.memoizeStoredLog(id, stored);
		return stored;
	}
	/** Publish a prepared historical log before granting write access. */
	async publishStoredMigration(id, stored) {
		const migration = stored.publication;
		let identity;
		try {
			identity = await migration.value.publish();
		} catch (error) {
			/* v8 ignore else -- a newer preparation may have replaced this stale cache entry. */
			if (this.coldLogMemo.get(id) === stored) this.coldLogMemo.delete(id);
			throw this.generationFailure(id, migration.source, error);
		}
		const published = {
			status: "current",
			meta: stored.meta,
			eventState: stored.eventState,
			events: stored.events,

export {};
