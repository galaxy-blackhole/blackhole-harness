/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN (2801–3400) của bundle gốc — lib/types/index.js phần thân class JsonlSessionPersistence · KHÔNG sửa tay
 */
// @ts-nocheck

			tornTruncateTo: stored.tornTruncateTo,
			recoveredTail: stored.recoveredTail,
			inheritedEventCount: stored.inheritedEventCount,
			revision: fileRevision(identity)
		};
		this.memoizeStoredLog(id, published);
		return published;
	}
	/** Translate generation-layer failures into the persistence seam's error vocabulary. */
	generationFailure(id, selected, error) {
		if (error instanceof JsonlGenerationUnsupportedMigrationError) return new SessionFormatUnsupportedError(`${error.message}; source v${error.fromVersion} artifact remains unchanged (raw log: ${selected.sourcePath})`, {
			kind: "jsonl",
			path: selected.sourcePath
		});
		if (error instanceof JsonlGenerationSourceChangedError) return error;
		if (error instanceof SessionFormatUnsupportedError || error instanceof SessionPersistenceCorruptionError || isErrnoException(error) || error instanceof DOMException && error.name === "AbortError") return error;
		return new SessionPersistenceCorruptionError(`session "${id}": stored log is corrupt: ${String(error)} (raw log: ${selected.sourcePath})`, { cause: error });
	}
	/**
	* Read, parse, and validate one stored log as the current logical prefix.
	* @param path - the artifact file to read.
	* @param expectedId - the session identity the artifact must carry.
	* @param signal - optional cancellation for the stat/read/decode work.
	* @returns the validated stored log with any torn-tail truncation point.
	*/
	async readStoredLog(path, expectedId, signal) {
		signal?.throwIfAborted();
		const probe = fileRevision(await stat(path, { bigint: true }));
		const memoized = this.coldLogMemo.get(expectedId);
		if (memoized?.status === "current" && memoized.revision === probe) {
			this.coldLogMemo.delete(expectedId);
			this.coldLogMemo.set(expectedId, memoized);
			return memoized;
		}
		const { bytes, identity } = await readStableJsonlFile(path, signal);
		return this.decodeStoredLog(path, expectedId, bytes, fileRevision(identity), signal);
	}
	/** Decode and memoize one already-stable current physical snapshot. */
	async decodeStoredLog(path, expectedId, buffer, revision, signal) {
		let parsed;
		try {
			if (this.compression === "zstd") parsed = await this.readZstdPrefix(buffer, signal);
			else {
				signal?.throwIfAborted();
				const { meta, inheritedEventCount, events, committedBytes } = scanLog(buffer);
				signal?.throwIfAborted();
				parsed = {
					meta,
					inheritedEventCount,
					events,
					tornTruncateTo: committedBytes < buffer.byteLength ? committedBytes : void 0,
					recoveredTail: []
				};
			}
		} catch (error) {
			signal?.throwIfAborted();
			if (error instanceof SessionFormatUnsupportedError) throw new SessionFormatUnsupportedError(`${error.message} (raw log: ${path})`, {
				kind: "jsonl",
				path
			});
			throw new SessionPersistenceCorruptionError(`session "${expectedId}": stored log is corrupt: ${String(error)} (raw log: ${path})`, { cause: error });
		}
		signal?.throwIfAborted();
		await this.assertStoredIdentity(path, SESSION_FORMAT_VERSION, parsed.meta, expectedId, signal);
		signal?.throwIfAborted();
		assertStoredId(expectedId, parsed.meta);
		const location = this.locate(parsed.meta);
		validateStoredEvents(parsed.meta, parsed.events, location);
		const { events, ...rest } = parsed;
		const stored = {
			status: "current",
			...rest,
			...freezeStoredEvents(events),
			revision
		};
		this.memoizeStoredLog(expectedId, stored);
		return stored;
	}
	/** Insert one parsed log into the bounded handoff cache. */
	memoizeStoredLog(id, stored) {
		this.coldLogMemo.delete(id);
		this.coldLogMemo.set(id, stored);
		for (const oldest of this.coldLogMemo.keys()) {
			if (this.coldLogMemo.size <= COLD_LOG_MEMO_MAX_ENTRIES) break;
			this.coldLogMemo.delete(oldest);
		}
	}
	/**
	* Resolve a session's current-generation log path.
	* @param id - the stored session to locate.
	* @param signal - optional cancellation for the directory scans.
	* @returns the current artifact path, or `undefined` while only a historical generation exists.
	*/
	async resolveCurrentLog(id, signal) {
		await this.ensureRootEncoding();
		signal?.throwIfAborted();
		const selected = await this.findLog(id, signal);
		if (selected === void 0) return void 0;
		if (selected.sourceVersion === SESSION_FORMAT_VERSION) return selected.sourcePath;
		if (selected.sourceVersion < SESSION_FORMAT_VERSION) return void 0;
		throw new SessionFormatUnsupportedError(`${sessionFormatVersionRefusal(id, selected.sourceVersion)} (raw log: ${selected.sourcePath})`, {
			kind: "jsonl",
			path: selected.sourcePath
		});
	}
	/**
	* Durably append one validated batch; lazily materializes on the first write.
	* @param header - the session's stored header.
	* @param events - the validated contiguous batch, in seq order.
	* @param isMaterialized - whether the session already has a durable artifact.
	* @param inheritedEventCount - the exact fork-inherited prefix length written into a materializing header line.
	*/
	async persistBatch(header, events, isMaterialized, inheritedEventCount) {
		this.coldLogMemo.delete(header.id);
		await this.ensureRootEncoding();
		if (isMaterialized) await this.appendLines(header, events);
		else {
			await this.materialize(header, inheritedEventCount, events);
			this.tracker.materialized(header.id);
		}
	}
	/**
	* Materialize a header-only artifact for an explicitly durable empty session.
	* @param header - the session's stored header.
	* @param inheritedEventCount - the exact fork-inherited prefix length written into the header line.
	*/
	async persistHeader(header, inheritedEventCount) {
		this.coldLogMemo.delete(header.id);
		await this.ensureRootEncoding();
		await this.materialize(header, inheritedEventCount, []);
		this.tracker.materialized(header.id);
	}
	/**
	* Truncate a torn physical tail durably before this session's first new append.
	* @param header - the session's stored header.
	* @param truncateTo - the byte offset the artifact is truncated to.
	*/
	async truncateTornTail(header, truncateTo) {
		this.coldLogMemo.delete(header.id);
		await this.repair(header, truncateTo);
		this.ctx.logger.warn(`${this.name}: session "${header.id}" recovered from a torn tail; incomplete tail bytes were discarded`);
	}
	/**
	* Whether this process still tracks a created-but-unmaterialized session.
	* @param id - the session to test.
	* @returns true while the pending entry exists.
	*/
	hasPendingSession(id) {
		return this.tracker.hasPending(id);
	}
	/**
	* Release one handle's backend bookkeeping on close.
	* @param handle - the closing handle.
	* @param materialized - whether the session reached durable storage.
	*/
	releaseHandle(handle, materialized) {
		this.tracker.release(handle, materialized);
	}
	/**
	* Acquire the session directory's kernel write lock; the kernel holds it
	* until the handle's close releases the descriptor, including on process death.
	* @param id - the session the lock guards.
	* @param cwd - header cwd used to derive the directory for a fresh session.
	* @param dir - the resolved directory of an existing artifact, when known.
	* @returns the held lock.
	*/
	acquireLease(id, cwd, dir = sessionDir(this.root, cwd, id)) {
		return SessionWriteLease.acquire(dir, id);
	}
	/**
	* Acquire the cross-process write lock for a materializing created session,
	* called by its handle immediately before the first log bytes publish.
	* @param header - the session's stored header (its cwd derives the directory).
	* @returns the held lock.
	*/
	async acquireWriteLease(header) {
		await this.rejectOppositeArtifact(header.cwd, header.id);
		return this.acquireLease(header.id, header.cwd);
	}
	/** Decode complete frames and retain complete JSONL records from a torn final frame. */
	async readZstdPrefix(buffer, signal) {
		signal?.throwIfAborted();
		const { frames, tornStart } = scanZstdFrames(buffer);
		signal?.throwIfAborted();
		if (frames.length === 0) throw new Error("empty or header-less Zstandard session log");
		const decoder = createZstdFrameDecoder();
		let yieldDeadline = performance.now() + ZSTD_DECODE_YIELD_INTERVAL_MS;
		try {
			const decodedFrames = decoder.decode(buffer, frames);
			signal?.throwIfAborted();
			const headerFrame = decodedFrames.next();
			signal?.throwIfAborted();
			/* v8 ignore next -- a non-empty structural frame list makes the decoder yield its first frame or throw. */
			if (headerFrame.done) throw new Error("empty or header-less Zstandard session log");
			assertZstdHeaderFrame(headerFrame.value);
			const scanner = new SessionLogScanner(headerFrame.value);
			let remainingFrames = frames.length - 1;
			for (const plaintext of decodedFrames) {
				signal?.throwIfAborted();
				scanner.write(plaintext);
				remainingFrames -= 1;
				if (remainingFrames > 0 && performance.now() >= yieldDeadline) {
					await scheduler.yield();
					signal?.throwIfAborted();
					yieldDeadline = performance.now() + ZSTD_DECODE_YIELD_INTERVAL_MS;
				}
			}
			signal?.throwIfAborted();
			const complete = scanner.checkpoint();
			if (complete.committedBytes !== complete.inputBytes) throw new Error("corrupt Zstandard session log: complete frame contains a torn JSONL record");
			if (tornStart === void 0) {
				const prefix = scanner.finish();
				return {
					meta: prefix.meta,
					inheritedEventCount: prefix.inheritedEventCount,
					events: prefix.events,
					tornTruncateTo: void 0,
					recoveredTail: []
				};
			}
			let recoveredPlaintext = Buffer.alloc(0);
			try {
				signal?.throwIfAborted();
				recoveredPlaintext = await decompressZstdPrefix(buffer.subarray(tornStart));
			} catch {
				/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
				if (signal?.aborted) signal.throwIfAborted();
			}
			signal?.throwIfAborted();
			scanner.write(recoveredPlaintext);
			const prefix = scanner.finish();
			return {
				meta: prefix.meta,
				inheritedEventCount: prefix.inheritedEventCount,
				events: prefix.events,
				tornTruncateTo: tornStart,
				recoveredTail: prefix.events.slice(complete.eventCount)
			};
		} catch (error) {
			/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
			if (signal?.aborted) signal.throwIfAborted();
			throw error;
		} finally {
			decoder.close();
		}
	}
	/** Enumerate selected physical generations without interpreting their headers or bodies. */
	async listGenerations(signal) {
		return (await this.mapSessionDirectories((dir) => {
			signal?.throwIfAborted();
			return this.resolveGenerationInDirectory(dir, signal);
		}, signal)).filter((source) => source !== void 0);
	}
	/**
	* Apply `task` to every Session directory through the shared listing
	* limiter. Results and the first failure follow the sequential
	* project-then-directory order; a project whose listing fails ends the
	* traversal after the directories of the projects before it.
	* @param task - per-directory operation; must not wait on the listing limiter.
	* @param signal - optional cancellation for directory listings.
	* @returns per-directory results in traversal order.
	*/
	async mapSessionDirectories(task, signal) {
		const limit = this.listLimit;
		const projects = await settleLimited(limit, await limit(() => this.listProjectDirs(signal)), (project) => this.listSessionDirs(project, signal));
		const dirs = [];
		let projectFailure;
		for (const outcome of projects) {
			if (outcome.status === "rejected") {
				projectFailure = outcome;
				break;
			}
			for (const dir of outcome.value) dirs.push(dir);
		}
		const results = settledValues(await settleLimited(limit, dirs, task));
		if (projectFailure !== void 0) throw projectFailure.reason;
		return results;
	}
	/** Historical logical events depend on the corpus, including members with unreadable headers. */
	async historicalCorpusRevision(signal) {
		const paths = (await this.listGenerations(signal)).map((source) => source.sourcePath).sort();
		const entries = settledValues(await settleLimited(this.listLimit, paths, async (path) => {
			signal?.throwIfAborted();
			try {
				return {
					path,
					revision: fileRevision(await stat(path, { bigint: true }))
				};
			} catch (error) {
				if (!isENOENT(error)) throw error;
				return {
					path,
					revision: "missing"
				};
			}
		}));
		const hash = createHash("sha256");
		for (const { path, revision } of entries) hash.update(JSON.stringify([path, revision]));
		signal?.throwIfAborted();
		return hash.digest("hex");
	}
	async listArtifacts(signal) {
		signal?.throwIfAborted();
		await this.ensureRootEncoding();
		signal?.throwIfAborted();
		const generations = await this.listGenerations(signal);
		const headers = await settleLimited(this.listLimit, generations, async (selected) => {
			signal?.throwIfAborted();
			try {
				return {
					selected,
					metadata: await this.readGenerationHeader(selected, void 0, signal)
				};
			} catch (error) {
				if (error instanceof SessionFormatUnsupportedError || error instanceof SessionPersistenceCorruptionError) return {
					selected,
					metadata: void 0
				};
				throw error;
			}
		});
		const artifacts = [];
		const ids = /* @__PURE__ */ new Set();
		for (const outcome of headers) {
			if (outcome.status === "rejected") throw outcome.reason;
			const { selected, metadata } = outcome.value;
			if (metadata === void 0) continue;
			if (ids.has(metadata.header.id)) throw new Error(`duplicate JSONL session id "${metadata.header.id}" appears in multiple project directories`);
			ids.add(metadata.header.id);
			artifacts.push({
				...metadata,
				path: selected.sourcePath,
				sourceVersion: selected.sourceVersion
			});
		}
		signal?.throwIfAborted();
		return artifacts;
	}
	/** Read and translate one selected generation header without inspecting its body. */
	async readGenerationHeader(selected, expectedId, signal) {
		let first;
		try {
			first = this.compression === "zstd" ? await this.readFirstZstdLine(selected.sourcePath, signal) : await this.readFirstLine(selected.sourcePath, signal);
		} catch (error) {
			signal?.throwIfAborted();
			if (isENOENT(error)) return void 0;
			throw error;
		}
		signal?.throwIfAborted();
		if (first === void 0) return void 0;
		let value;
		try {
			value = JSON.parse(first);
		} catch {
			return;
		}
		assertNoRetiredHeaderFields(value);
		const result = sessionFormatCatalog.readHeader(value);
		if ("storedVersion" in result && result.storedVersion !== selected.sourceVersion) throw new Error(`session generation filename identifies v${selected.sourceVersion}, but its header identifies v${result.storedVersion}`);
		if (result.status === "unsupported") {
			const physicalId = String(value.id);
			let reason = result.reason;
			/* v8 ignore else -- released historical header migrations cannot refuse after physical decoding. */
			if (result.storedVersion > SESSION_FORMAT_VERSION) reason = sessionFormatVersionRefusal(physicalId, result.storedVersion);
			throw new SessionFormatUnsupportedError(`${reason} (raw log: ${selected.sourcePath})`, {
				kind: "jsonl",
				path: selected.sourcePath
			});
		}
		if (result.status === "malformed") return void 0;
		const header = this.currentHeader(result.header);
		await this.assertStoredIdentity(selected.sourcePath, selected.sourceVersion, header, expectedId, signal);
		return {
			header,
			formatStatus: result.status
		};
	}
	/** Convert format-catalog string identities to current branded Session metadata. */
	currentHeader(header) {
		/* v8 ignore next 3 -- readable catalog results are restored to its configured current version. */
		if (header.version !== SESSION_FORMAT_VERSION) throw new Error(`format catalog returned non-current logical header v${header.version}`);
		return {
			version: SESSION_FORMAT_VERSION,
			id: SessionId(header.id),
			createdAt: header.createdAt,
			...header.cwd === void 0 ? {} : { cwd: header.cwd },
			...header.parentSession === void 0 ? {} : { parentSession: SessionId(header.parentSession) },
			isSeeded: header.isSeeded,
			...header.origin === void 0 ? {} : { origin: header.origin },
			delegationDepth: header.delegationDepth,
			...header.agentPreset === void 0 ? {} : { agentPreset: header.agentPreset }
		};
	}
	/** Atomically write the header line + first batch (temp-write, fsync, publish). */
	async materialize(meta, inheritedEventCount, events) {
		const project = projectDir(this.root, meta.cwd);
		const dir = sessionDir(this.root, meta.cwd, meta.id);
		const finalPath = logPath(this.root, meta.cwd, meta.id, this.compression);
		await this.rejectOppositeArtifact(meta.cwd, meta.id);
		const content = await this.encodeMaterialization(meta, inheritedEventCount, events);
		/* v8 ignore next -- native Windows coverage exercises this platform dispatch; Linux covers the POSIX peer */
		if (process.platform === "win32") await this.materializeWin32(project, dir, finalPath, meta.id, content);
		else await this.materializePosix(project, dir, finalPath, meta.id, content);
	}
	/* v8 ignore start -- Windows uses the Win32 durable-publish path; POSIX coverage exercises this peer. */
	async materializePosix(project, dir, finalPath, id, content) {
		await mkdir(this.root, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(dirname(this.root));
		await mkdir(project, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(this.root);
		await mkdir(dir, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(project);
		await this.rejectExistingLog(finalPath, id);
		const tmp = await this.writeSyncedTempFile(finalPath, content);
		let linked = false;
		try {
			await link(tmp, finalPath);
			linked = true;
		} finally {
			/* v8 ignore next -- link failure is the TOCTOU/IO race guarded above; not reachable in test */
			if (!linked) await rm(tmp, { force: true });
		}
		await this.syncDirPosix(dir);
		try {
			await rm(tmp, { force: true });
		} catch {}
	}
	/* v8 ignore stop */
	/* v8 ignore start -- native Windows coverage exercises this integration path */
	async materializeWin32(project, dir, finalPath, id, content) {
		await ensureDurableDirectoryWin32(this.root);
		await ensureDurableDirectoryWin32(project);
		await ensureDurableDirectoryWin32(dir);
		await this.rejectExistingLog(finalPath, id);
		const tmp = await this.writeSyncedTempFile(finalPath, content);
		try {
			await publishNewFileWin32(tmp, finalPath);
		} catch (error) {
			await rm(tmp, { force: true });
			throw error;
		}
	}
	/* v8 ignore stop */
	async rejectExistingLog(finalPath, id) {
		/* v8 ignore next 3 -- create guards collisions before materialize; this is a TOCTOU backstop */
		if (await this.resolveGenerationInDirectory(dirname(finalPath)) !== void 0) throw new Error(`refusing to materialize "${id}": a log already exists on disk (open it instead)`);
	}
	async writeSyncedTempFile(finalPath, content) {
		const tmp = `${finalPath}.${randomBytes(6).toString("hex")}.tmp`;
		const handle = await open(tmp, "wx", 384);
		try {
			await handle.writeFile(content);
			await handle.sync();
		} finally {
			await handle.close();
		}
		return tmp;
	}
	/** Encode the header and first batch without combining their frame boundaries. */
	async encodeMaterialization(meta, inheritedEventCount, events) {
		const header = JSON.stringify(toHeaderLine(meta, meta.isSeeded ? inheritedEventCount : void 0)) + "\n";
		if (events.length === 0) return this.compression === "none" ? header : compressZstdFrame(header);
		const body = eventLines(events) + "\n";
		if (this.compression === "none") return header + body;
		const headerFrame = await compressZstdFrame(header);
		const eventFrame = await compressZstdFrame(body);
		return Buffer.concat([headerFrame, eventFrame]);
	}
	/** Encode one durable append batch in the configured physical representation. */
	async encodeEventBatch(events) {
		const body = eventLines(events) + "\n";
		return this.compression === "zstd" ? compressZstdFrame(body) : body;
	}
	/** fsync a POSIX directory so a just-created/renamed entry is crash-durable. */
	/* v8 ignore start -- Windows uses write-through namespace operations; POSIX coverage exercises directory fsync. */
	async syncDirPosix(dir) {
		const handle = await open(dir, "r");
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/* v8 ignore stop */
	/**
	* Append and fsync event lines. On a partial write or sync failure, restore the
	* previous size before rethrowing because the unchanged cursor will retry the
	* batch; leaving partial bytes would create duplicate sequence numbers.
	*/
	async appendLines(meta, events) {
		const content = await this.encodeEventBatch(events);
		const path = logPath(this.root, meta.cwd, meta.id, this.compression);
		const handle = await open(path, "a");
		let closed = false;
		const closeAppendHandle = async () => {
			if (closed) return;
			closed = true;
			await handle.close();
		};
		try {
			const { size: before } = await handle.stat();
			try {
				await handle.writeFile(content);
				await handle.sync();
			} catch (error) {
				try {
					await closeAppendHandle();
					await this.rollbackAppend(path, before);
				} catch (rollbackError) {
					throw new AggregateError([error, rollbackError], `failed to roll back append to "${path}"`);
				}
				throw error;
			}
		} finally {
			await closeAppendHandle();
		}
	}
	async rollbackAppend(path, size) {
		const handle = await open(path, "r+");
		try {
			await handle.truncate(size);
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/** Truncate the log file to `offset` bytes and fsync (discard the crash tail). */
	async repair(meta, offset) {
		const path = logPath(this.root, meta.cwd, meta.id, this.compression);
		await truncate(path, offset);
		const handle = await open(path, "r+");
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/**
	* Read the first newline-terminated line of a file without loading the whole
	* file. Returns undefined if the file is empty or has no complete first line.
	* Reads in bounded chunks so a huge log costs only the header read.
	*/
	async readFirstLine(path, signal) {
		signal?.throwIfAborted();
		const handle = await open(path, "r");
		try {
			signal?.throwIfAborted();
			const chunks = [];
			const buf = Buffer.alloc(8192);
			for (;;) {
				signal?.throwIfAborted();
				const { bytesRead } = await handle.read(buf, 0, buf.length, null);
				signal?.throwIfAborted();
				if (bytesRead === 0) return void 0;
				const slice = buf.subarray(0, bytesRead);
				const nl = slice.indexOf(10);
				if (nl !== -1) {
					chunks.push(slice.subarray(0, nl));
					signal?.throwIfAborted();
					return Buffer.concat(chunks).toString("utf8");
				}
				chunks.push(Buffer.from(slice));
			}
		} finally {
			await handle.close();
		}
	}
	/** Read only the header frame; compression failures reject as corruption, while I/O and cancellation propagate. */
	async readFirstZstdLine(path, signal) {
		signal?.throwIfAborted();
		const handle = await open(path, "r");
		try {
			signal?.throwIfAborted();
			let content = Buffer.alloc(0);
			const chunk = Buffer.alloc(8192);
			for (;;) {
				signal?.throwIfAborted();
				const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
				signal?.throwIfAborted();
				if (bytesRead === 0) return void 0;
				signal?.throwIfAborted();
				content = Buffer.concat([content, chunk.subarray(0, bytesRead)]);
				signal?.throwIfAborted();
				try {
					const first = scanZstdFrames(content, 1).frames[0];
					if (first === void 0) continue;
					const plaintext = await decompressZstdFrame(content.subarray(first.start, first.end));
					signal?.throwIfAborted();
					assertZstdHeaderFrame(plaintext);
					return plaintext.subarray(0, -1).toString("utf8");
				} catch (error) {

export {};
