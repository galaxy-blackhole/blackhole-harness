/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-session-query-sqlite — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/schema.js
/** SQLite schema for the disposable session full-text read model. */
/** Current derived-index schema version. Incompatible versions reset in place. */
const SESSION_QUERY_SQLITE_SCHEMA_VERSION = 8;
/** SQLite application id protecting unrelated databases from derived resets. */
const SESSION_QUERY_SQLITE_APPLICATION_ID = 1146308689;
const DERIVED_USER_TABLES = new Set([
	"search_state",
	"persisted_sessions",
	"persisted_docs",
	"persisted_docs_data",
	"persisted_docs_idx",
	"persisted_docs_content",
	"persisted_docs_docsize",
	"persisted_docs_config"
]);
/**
* Exclusively create a missing database file with owner-only permissions.
* Existing files retain their modes, and errors other than `EEXIST` propagate.
*/
async function createDatabaseFile(path) {
	try {
		await (await open(path, "wx", 384)).close();
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
}
/**
* Open, validate, and initialize persistent and connection-local schemas.
* @param path - dedicated derived-index path or `:memory:`; missing filesystem paths are created owner-only.
* @param journalMode - validated SQLite journal mode.
* @returns initialized database handle owned by the search service.
*/
async function openSearchDatabase(path, journalMode) {
	const actual = path === ":memory:" ? path : resolve(path);
	if (actual !== ":memory:") {
		await mkdir(dirname(actual), {
			recursive: true,
			mode: 448
		});
		await createDatabaseFile(actual);
	}
	const { DatabaseSync } = await import("node:sqlite");
	const db = new DatabaseSync(actual);
	try {
		const { application_id: applicationId } = db.prepare("PRAGMA application_id").get();
		const { user_version: version } = db.prepare("PRAGMA user_version").get();
		const userTables = listUserTables(db);
		if (applicationId !== 0 && applicationId !== 1146308689) throw new Error(`session-search database at "${actual}" belongs to another application`);
		if (applicationId === 0 && userTables.length > 0) throw new Error(`session-search database at "${actual}" is not an empty or recognized derived index`);
		if (applicationId === 1146308689) {
			assertDerivedUserTables(actual, userTables);
			if (version !== 8) resetDerivedSchema(db, userTables);
		}
		db.exec(`PRAGMA journal_mode = ${journalMode.toUpperCase()}`);
		ensurePersistentSchema(db);
		ensureTemporarySchema(db);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}
function listUserTables(db) {
	return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name").all().map((row) => row.name);
}
function assertDerivedUserTables(path, userTables) {
	const unknownTables = userTables.filter((name) => !DERIVED_USER_TABLES.has(name));
	if (unknownTables.length > 0) throw new Error(`session-search database at "${path}" has unrecognized user tables: ${unknownTables.join(", ")}`);
}
function resetDerivedSchema(db, userTables) {
	for (const name of userTables) db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(name)}`);
	db.exec("PRAGMA user_version = 0");
}
function ensurePersistentSchema(db) {
	db.exec(`PRAGMA application_id = ${SESSION_QUERY_SQLITE_APPLICATION_ID}`);
	db.exec(`
    CREATE TABLE IF NOT EXISTS search_state (
      singleton         INTEGER PRIMARY KEY CHECK (singleton = 1),
      global_generation INTEGER NOT NULL
    ) STRICT
  `);
	db.exec("INSERT OR IGNORE INTO search_state (singleton, global_generation) VALUES (1, 0)");
	db.exec(`
    CREATE TABLE IF NOT EXISTS persisted_sessions (
      id             TEXT PRIMARY KEY,
      version        INTEGER NOT NULL,
      created_at     INTEGER NOT NULL,
      cwd            TEXT,
      parent_session TEXT,
      seed_length    INTEGER,
      delegation_depth INTEGER,
      agent_preset  TEXT,
      revision       TEXT NOT NULL,
      generation     INTEGER NOT NULL
    ) STRICT
  `);
	db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS persisted_docs USING fts5(
      text,
      session_id UNINDEXED,
      seq UNINDEXED,
      type UNINDEXED,
      time UNINDEXED,
      surface UNINDEXED,
      codepoint_length UNINDEXED,
      tokenize = 'unicode61'
    )
  `);
	db.exec(`PRAGMA user_version = 8`);
}
function ensureTemporarySchema(db) {
	db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS live_sessions (
      id             TEXT PRIMARY KEY,
      version        INTEGER NOT NULL,
      created_at     INTEGER NOT NULL,
      cwd            TEXT,
      parent_session TEXT,
      seed_length    INTEGER,
      delegation_depth INTEGER,
      agent_preset  TEXT,
      fingerprint    TEXT NOT NULL,
      persisted      INTEGER NOT NULL CHECK (persisted IN (0, 1)),
      generation     INTEGER NOT NULL
    ) STRICT
  `);
	db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS temp.live_docs USING fts5(
      text,
      session_id UNINDEXED,
      seq UNINDEXED,
      type UNINDEXED,
      time UNINDEXED,
      surface UNINDEXED,
      codepoint_length UNINDEXED,
      tokenize = 'unicode61'
    )
  `);
}
function quoteIdentifier(value) {
	return `"${value.replaceAll("\"", "\"\"")}"`;
}
/** Largest page size whose internal lookahead remains an exact SQLite integer binding. */
const SQLITE_MAX_PAGE_LIMIT = Number.MAX_SAFE_INTEGER - 1;
/** Portable host-parameter ceiling shared by predicate and statement builders. */
const SQLITE_PORTABLE_VARIABLE_LIMIT = 32766;
/**
* Reject prospective SQLite binding growth beyond the portable ceiling.
* @param count - binding count at the current construction boundary.
*/
function assertPortableBindingCount(count) {
	if (count > 32766) throw new SessionQueryError(`session-search request exceeds SQLite's portable ${SQLITE_PORTABLE_VARIABLE_LIMIT}-variable limit; reduce filter values`, "SESSION_QUERY_INVALID_FILTER");
}
/**
* Reject compiled outer predicates beyond the supported FTS5 planner budget.
* @param count - predicate count including fixed statement predicates.
*/
function assertFts5OuterPredicateCount(count) {
	if (count > 14) throw new SessionQueryError(`session-search request exceeds the supported SQLite FTS5 outer-predicate budget of 14; reduce filters`, "SESSION_QUERY_INVALID_FILTER");
}
/**
* Validate and canonicalize a cross-session request.
* @param request - caller-provided query, filters, limit, and cursor.
* @param limits - configured default and maximum page sizes.
* @returns normalized request with explicit arrays and limit.
*/
function normalizeSessionRequest(request, limits) {
	const sessionFilters = materializeSessionResultFilters(request.sessionFilters ?? []);
	const eventFilters = materializeMetadataFilters(request.eventFilters ?? []);
	const cursor = materializeCursor(request.cursor);
	return {
		query: normalizeQuery(request.query),
		sessionFilters,
		eventFilters,
		limit: normalizeLimit(request.limit, limits),
		...cursor === void 0 ? {} : { cursor }
	};
}
/**
* Validate and canonicalize a within-session request.
* @param request - caller-provided target, query, filters, limit, and cursor.
* @param limits - configured default and maximum page sizes.
* @returns normalized request with an explicit filter array and limit.
*/
function normalizeEventRequest(request, limits) {
	if (typeof request.sessionId !== "string") throw new SessionQueryError("session-search session id must be text", "SESSION_QUERY_INVALID_FILTER");
	const filters = materializeMetadataFilters(request.filters ?? []);
	const cursor = materializeCursor(request.cursor);
	return {
		sessionId: request.sessionId,
		query: normalizeQuery(request.query),
		filters,
		limit: normalizeLimit(request.limit, limits),
		...cursor === void 0 ? {} : { cursor }
	};
}
/**
* Compile logical-session predicates against selected-document columns.
* @param filters - validated ANDed logical-session clauses.
* @returns parameterized SQL fragment and ordered bindings.
*/
function buildSessionWhere(filters) {
	const clauses = [];
	const params = [];
	for (const filter of filters) switch (filter.kind) {
		case "id":
			addList(clauses, params, "session_id", filter.values);
			break;
		case "cwd":
			addNullableList(clauses, params, "cwd", filter.values);
			break;
		case "created-at":
			addRange(clauses, params, "created_at", filter);
			break;
		case "parent":
			addNullableList(clauses, params, "parent_session", filter.values);
			break;
		case "availability": {
			const availability = [...new Set(filter.values)];
			if (availability.length === 0) clauses.push("0");
			else if (availability.length === 1) {
				const value = availability[0];
				switch (value) {
					case "live":
						clauses.push("live = 1");
						break;
					case "persisted":
						clauses.push("persisted = 1");
						break;
					default: unknownAvailability(value);
				}
			}
			break;
		}
		default: unknownFilter(filter);
	}
	assertFts5OuterPredicateCount(clauses.length);
	return {
		sql: clauses.join(" AND "),
		params,
		predicateCount: clauses.length
	};
}
/**
* Compile event metadata predicates against selected-document columns.
* @param filters - validated ANDed event metadata clauses.
* @returns parameterized SQL fragment and ordered bindings.
*/
function buildEventWhere(filters) {
	const clauses = [];
	const params = [];
	for (const filter of filters) switch (filter.kind) {
		case "seq":
			addRange(clauses, params, "seq", filter);
			break;
		case "time":
			addRange(clauses, params, "time", filter);
			break;
		case "type":
			addList(clauses, params, "type", filter.values);
			break;
		case "surface":
			addList(clauses, params, "surface", filter.values);
			break;
		default: unknownFilter(filter);
	}
	assertFts5OuterPredicateCount(clauses.length);
	return {
		sql: clauses.join(" AND "),
		params,
		predicateCount: clauses.length
	};
}
/**
* Quote caller text as one FTS5 phrase so query syntax remains inert data.
* @param query - normalized caller query.
* @returns FTS5 expression containing one escaped literal phrase.
*/
function quoteFtsData(query) {
	return `"${query.replaceAll("\"", "\"\"")}"`;
}
/**
* Remove reserved marker collisions before text enters FTS5 or MATCH.
* @param text - extracted document text or normalized caller query.
* @returns text with reserved noncharacters mapped to replacement characters.
*/
function sanitizeFtsText(text) {
	return text.replaceAll("\0", "�").replaceAll("﷐", "�").replaceAll("﷑", "�");
}
/**
* Build the stable normalized request identity stored in opaque cursors.
* @param request - normalized request whose filter ordering is canonicalized.
* @returns deterministic JSON identity for cursor binding.
*/
function requestFingerprint(request) {
	if ("sessionId" in request) return JSON.stringify({
		scope: "events",
		sessionId: request.sessionId,
		query: request.query,
		filters: canonicalFilters(request.filters),
		limit: request.limit
	});
	return JSON.stringify({
		scope: "sessions",
		query: request.query,
		sessionFilters: canonicalFilters(request.sessionFilters),
		eventFilters: canonicalFilters(request.eventFilters),
		limit: request.limit
	});
}
/**
* Build a whitespace-normalized excerpt no longer than `maxChars`.
* @param markedText - complete document with FTS5 `highlight()` markers.
* @param maxChars - maximum result length in Unicode code points.
* @returns bounded plain-text snippet.
*/
function makeSnippet(markedText, maxChars) {
	const { text: clean, matchStart } = normalizeMarkedText(markedText);
	const characters = Array.from(clean);
	if (characters.length <= maxChars) return clean;
	if (maxChars === 1) return "…";
	const matchedIndex = Math.min(matchStart, characters.length - 1);
	let start = Math.max(0, matchedIndex - Math.floor(maxChars / 3));
	const prefix = start > 0 ? "…" : "";
	let suffix = "…";
	let contentLength = maxChars - prefix.length - suffix.length;
	if (contentLength < 1) {
		start = matchedIndex;
		suffix = "";
		contentLength = maxChars - prefix.length - suffix.length;
	} else if (matchedIndex >= start + contentLength) start = matchedIndex - contentLength + 1;
	let end = Math.min(characters.length, start + contentLength);
	if (end === characters.length) {
		suffix = "";
		contentLength = maxChars - prefix.length;
		start = Math.max(0, end - contentLength);
	}
	end = Math.min(characters.length, start + contentLength);
	return `${prefix}${characters.slice(start, end).join("")}${suffix}`;
}
function normalizeMarkedText(markedText) {
	const characters = [];
	let matchStart;
	for (const character of markedText) {
		if (character === "﷐") {
			matchStart ??= characters.length;
			continue;
		}
		if (character === "﷑") continue;
		if (/\s/u.test(character)) {
			if (characters.length > 0 && characters.at(-1) !== " ") characters.push(" ");
		} else characters.push(character);
	}
	if (characters.at(-1) === " ") characters.pop();
	return {
		text: characters.join(""),
		matchStart: matchStart ?? 0
	};
}
function normalizeQuery(value) {
	if (typeof value !== "string") throw new SessionQueryError("session-search query must be text", "SESSION_QUERY_INVALID_QUERY");
	const query = value.trim().replace(/\s+/gu, " ");
	if (query.length === 0) throw new SessionQueryError("session-search query must contain non-whitespace text", "SESSION_QUERY_INVALID_QUERY");
	if (query.includes("\0")) throw new SessionQueryError("session-search query must not contain NUL", "SESSION_QUERY_INVALID_QUERY");
	return sanitizeFtsText(query);
}
function materializeCursor(cursor) {
	if (cursor === void 0) return void 0;
	if (typeof cursor !== "string") throw new SessionQueryError("session-search cursor must be text", "SESSION_QUERY_INVALID_CURSOR");
	return cursor;
}
function materializeMetadataFilters(filters) {
	const candidates = filters;
	for (const filter of candidates) switch (filter.kind) {
		case "seq":
		case "time":
		case "type":
		case "surface": break;
		case "text": throw new SessionQueryError("session-search metadata filters do not accept text clauses", "SESSION_QUERY_INVALID_FILTER");
		default: unknownFilter(filter);
	}
	return materializeSessionEventResultFilters(filters);
}
function normalizeLimit(value, limits) {
	const limit = value ?? limits.defaultLimit;
	const maxLimit = Math.min(limits.maxLimit, SQLITE_MAX_PAGE_LIMIT);
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) throw new SessionQueryError(`session-search limit must be an integer between 1 and ${maxLimit}`, "SESSION_QUERY_INVALID_LIMIT");
	return limit;
}
function addList(clauses, params, column, values) {
	if (values.length === 0) {
		clauses.push("0");
		return;
	}
	clauses.push(`${column} IN (${appendListBindings(params, values)})`);
}
function addNullableList(clauses, params, column, values) {
	if (values.length === 0) {
		clauses.push("0");
		return;
	}
	const concrete = values.filter((value) => value !== null);
	const parts = [];
	if (concrete.length > 0) parts.push(`${column} IN (${appendListBindings(params, concrete)})`);
	if (values.includes(null)) parts.push(`${column} IS NULL`);
	clauses.push(`(${parts.join(" OR ")})`);
}
function addRange(clauses, params, column, range) {
	if (range.from !== void 0) {
		assertPortableBindingCount(params.length + 1);
		clauses.push(`CAST(${column} AS INTEGER) >= ?`);
		params.push(range.from);
	}
	if (range.to !== void 0) {
		assertPortableBindingCount(params.length + 1);
		clauses.push(`CAST(${column} AS INTEGER) <= ?`);
		params.push(range.to);
	}
}
function appendListBindings(params, values) {
	assertPortableBindingCount(params.length + values.length);
	for (const value of values) params.push(value);
	return values.map(() => "?").join(", ");
}
function canonicalFilters(filters) {
	return filters.map((filter) => {
		if ("values" in filter) return {
			...filter,
			values: [...filter.values].sort(compareNullable)
		};
		return {
			kind: filter.kind,
			from: filter.from ?? null,
			to: filter.to ?? null
		};
	}).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function compareNullable(a, b) {
	if (a === b) return 0;
	if (a === null) return -1;
	if (b === null) return 1;
	return a.localeCompare(b);
}
function unknownAvailability(value) {
	throw new SessionQueryError(`session availability filter contains unknown value "${String(value)}"`, "SESSION_QUERY_INVALID_FILTER");
}
function unknownFilter(filter) {
	const kind = filter.kind;
	throw new SessionQueryError(`session filter contains unknown kind ${typeof kind === "string" ? `"${kind}"` : "(missing)"}`, "SESSION_QUERY_INVALID_FILTER");
}
//#endregion

export {};
