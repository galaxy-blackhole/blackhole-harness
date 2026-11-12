/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B codec/bridge THUẦN của experimental-inspector: nạp stock lib/index.js và
 *      lib/parts-host của ta qua vỏ tạm chỉ THÊM export nội bộ, so từng hành vi — không mạng.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeHostDeviation } from "../../packages/host/experimental-inspector/build.ts";
import { assembleHostParts } from "../../packages/host/experimental-inspector/src/assemble-host.ts";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "experimental-inspector");
/** Artifact lib/index.js của ta (có thể chưa build). */
const OUR_LIB = join(OURS, "lib", "index.js");
/** Bản gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-inspector", "lib", "index.js");
/** Thư mục tạm chứa hai vỏ module; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-experimental-inspector-codec-"));
// Stock lib/index.js chỉ export 6 tên; vỏ tạm THÊM export nội bộ để A/B codec, không sửa nguồn.
const INTERNAL_EXPORT = "\nexport { " + [
  "inspectorId", "isJsonValue", "jsonByteLength", "isPlainObject", "exactObject", "exactKeys", "wireId",
  "optionalString", "optionalBoolean", "optionalNonNegativeNumber", "parseClientConsoleControlFrame",
  "parseClientRuntimeCommand", "parseClientRuntimeRequestFrame", "parseClientRuntimeCancelFrame",
  "parseClientRuntimeResponseAcknowledgedFrame", "parseClientRuntimeSessionClosedFrame",
  "parseClientSourceCommand", "parseClientSourceRequestFrame", "parseClientSourceSessionClosedFrame",
  "parseWorkerSourceFrame", "HOST_CDP_BRIDGE_REASON", "HostCdpBridgeUnavailableError",
  "rejectObjectBridgeOperation", "rejectPropertyBridgeOperation", "rejectRuntimeBridgeCommand",
  "rejectConsoleBridgeCommand", "rejectSourcesBridgeCommand", "bridgeCapabilities", "createHostRealmSource",
  "parseCordisRuntimeTree", "isInspectorQueryResponseEnvelope", "parseInspectorQueryResponseFrame",
  "SOURCE_FRAME_OVERHEAD_BYTES", "QUERY_ERROR_CODES", "InspectorSourceBuffer", "HostBridgePublisher",
  "HostInspectorSource", "InspectorQueryConnection", "InspectorQueryRemoteError", "dispatchBridgeFrame",
  "parseInspectorWorkerControl",
].join(", ") + " };\n";
type Captured =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly name: string; readonly message: string; readonly code?: string };
interface Loaded {
  readonly ours: InspectorModule;
  readonly stock: InspectorModule;
  readonly oursText: string;
  readonly stockText: string;
  readonly source: "lib" | "parts";
}
interface SourceRecord {
  readonly monotonicMs: number;
  readonly topic: string;
  readonly payload: unknown;
}
interface AppendFrame {
  readonly v: number;
  readonly t: string;
  readonly sourceId: string;
  readonly generation: string;
  readonly firstSequence: number;
  readonly droppedBefore: number;
  readonly records: readonly SourceRecord[];
}
interface ReplaceFrame {
  readonly v: number;
  readonly t: string;
  readonly sourceId: string;
  readonly generation: string;
  readonly nextSequence: number;
  readonly records: readonly SourceRecord[];
}
interface BufferOptions {
  readonly topics: readonly string[];
  readonly maxFrameBytes: number;
  readonly maxQueuedBytes: number;
  readonly maxQueuedRecords: number;
  readonly maxRecordsPerFrame: number;
}
interface TransportOptions extends BufferOptions {
  readonly label: string;
  readonly queryTimeoutMs: number;
}
interface HostSourceDescriptor {
  readonly sourceId: string;
  readonly generation: string;
  readonly kind: string;
  readonly label: string;
  readonly timeOriginMs: number;
  readonly capabilities: readonly unknown[];
}
interface PortLike {
  postMessage(value: unknown): void;
  on(event: string, listener: (value: unknown) => void): void;
  start(): void;
  close(): void;
}
interface SourceBufferLike {
  readonly hasPending: boolean;
  publish(topic: string, payload: unknown, monotonicMs: number): void;
  setState(topic: string, payload: unknown, monotonicMs: number): void;
  replacement(sourceId: string, generation: string): ReplaceFrame;
  takeBatch(sourceId: string, generation: string): AppendFrame | undefined;
  discardPending(): void;
}
interface PublisherLike {
  publish(topic: string, payload: unknown, monotonicMs?: number): void;
  setState(topic: string, payload: unknown, monotonicMs?: number): void;
  replace(): void;
  flush(): void;
  acknowledge(nextSequence: number): void;
  close(): void;
}
interface QueryConnectionLike {
  connect(sourceId: string, generation: string, sender: { send(frame: unknown): void }): void;
  request(query: { op: string }): Promise<unknown>;
  receive(value: unknown): boolean;
  disconnect(reason: string): void;
  close(reason?: string): void;
}
interface HostSourceLike {
  readonly source: HostSourceDescriptor;
  publish(topic: string, payload: unknown, monotonicMs?: number): void;
  setState(topic: string, payload: unknown, monotonicMs?: number): void;
  request(query: { op: string }): Promise<unknown>;
  close(): void;
}
interface BridgeHandlers {
  accepted(frame: unknown): void;
  acknowledged(frame: unknown): void;
  resnapshot(frame: unknown): void;
  rejected(frame: unknown): void;
}
interface InspectorModule {
  readonly name: string;
  readonly inject: readonly string[];
  Config(value: unknown): Record<string, unknown>;
  resolveInspectorOptions(options?: Record<string, unknown>): Record<string, unknown>;
  apply(ctx: unknown, config: unknown): Promise<void>;
  startInspector(options?: Record<string, unknown>): Promise<unknown>;
  inspectorId(value: string, label: string): string;
  isJsonValue(value: unknown): boolean;
  jsonByteLength(value: unknown): number;
  isPlainObject(value: unknown): boolean;
  exactObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown>;
  exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void;
  wireId(value: unknown, label: string): string;
  optionalString(value: Record<string, unknown>, key: string): Record<string, string>;
  optionalBoolean(value: Record<string, unknown>, key: string): Record<string, boolean>;
  optionalNonNegativeNumber(value: Record<string, unknown>, key: string): Record<string, number>;
  parseClientConsoleControlFrame(value: unknown): unknown;
  parseClientRuntimeCommand(value: unknown): unknown;
  parseClientRuntimeRequestFrame(value: unknown): unknown;
  parseClientRuntimeCancelFrame(value: unknown): unknown;
  parseClientRuntimeResponseAcknowledgedFrame(value: unknown): unknown;
  parseClientRuntimeSessionClosedFrame(value: unknown): unknown;
  parseClientSourceCommand(value: unknown): unknown;
  parseClientSourceRequestFrame(value: unknown): unknown;
  parseClientSourceSessionClosedFrame(value: unknown): unknown;
  parseWorkerSourceFrame(value: unknown): unknown;
  readonly HOST_CDP_BRIDGE_REASON: string;
  readonly HostCdpBridgeUnavailableError: new (operation: string) => Error;
  rejectObjectBridgeOperation(operation: string): never;
  rejectPropertyBridgeOperation(): never;
  rejectRuntimeBridgeCommand(command: { op: string }): never;
  rejectConsoleBridgeCommand(operation: string): never;
  rejectSourcesBridgeCommand(): never;
  bridgeCapabilities(origin: string, hasSources: boolean): readonly unknown[];
  createHostRealmSource(label: string): HostSourceDescriptor;
  parseCordisRuntimeTree(value: unknown): unknown;
  isInspectorQueryResponseEnvelope(value: unknown): boolean;
  parseInspectorQueryResponseFrame(value: unknown): unknown;
  readonly SOURCE_FRAME_OVERHEAD_BYTES: number;
  readonly QUERY_ERROR_CODES: ReadonlySet<string>;
  readonly InspectorSourceBuffer: new (options: BufferOptions) => SourceBufferLike;
  readonly HostBridgePublisher: new (port: PortLike, source: HostSourceDescriptor, options: BufferOptions) => PublisherLike;
  readonly HostInspectorSource: new (port: PortLike, options: TransportOptions) => HostSourceLike;
  readonly InspectorQueryConnection: new (options: { timeoutMs: number; maxFrameBytes: number }) => QueryConnectionLike;
  readonly InspectorQueryRemoteError: new (code: string, message: string) => Error & { code: string };
  dispatchBridgeFrame(frame: unknown, handlers: BridgeHandlers): void;
  parseInspectorWorkerControl(value: unknown): unknown;
}
let loaded: Loaded | undefined;
function sides(): Loaded {
  if (loaded === undefined) throw new Error("chưa nạp xong nguồn A/B");
  return loaded;
}
function captured(error: unknown): Captured {
  const failure = error as Error & { code?: string };
  return {
    ok: false,
    name: failure.name,
    message: failure.message,
    ...(failure.code === undefined ? {} : { code: failure.code }),
  };
}
function capture(run: () => unknown): Captured {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return captured(error);
  }
}
async function captureAsync(run: () => Promise<unknown>): Promise<Captured> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return captured(error);
  }
}
function ab<T>(run: (mod: InspectorModule) => T): { ours: T; stock: T } {
  const { ours, stock } = sides();
  return { ours: run(ours), stock: run(stock) };
}
async function abAsync<T>(run: (mod: InspectorModule) => Promise<T>): Promise<{ ours: T; stock: T }> {
  const { ours, stock } = sides();
  return { ours: await run(ours), stock: await run(stock) };
}
class FakePort implements PortLike {
  readonly posted: unknown[] = [];
  closed = false;
  private readonly listeners = new Map<string, Array<(value: unknown) => void>>();
  postMessage(value: unknown): void {
    this.posted.push(value);
  }
  on(event: string, listener: (value: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }
  start(): void {}
  close(): void {
    this.closed = true;
  }
  emit(event: string, value?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }
}
const WIRE = { v: 0, sourceId: "src-1", generation: "gen-1" } as const;
function runtimeRequest(command: unknown): Record<string, unknown> {
  return { ...WIRE, t: "client-runtime/request", sessionId: "sess-1", requestId: "req-1", command };
}
function sourceRequest(command: unknown): Record<string, unknown> {
  return { ...WIRE, t: "client-sources/request", sessionId: "sess-1", requestId: "req-1", command };
}
function consoleFrame(t: string): Record<string, unknown> {
  return { ...WIRE, t, sessionId: "sess-1" };
}
function cordisRealm(kind: "host" | "client", sourceId: string): Record<string, unknown> {
  return { source: { sourceId, kind, label: kind + "-realm" }, connection: { state: "connected" }, revision: 1, truncated: false, root: { kind: "context", children: [] } };
}
function cordisTree(): Record<string, unknown> {
  return { schemaVersion: 0, host: cordisRealm("host", "host-1"), clients: [cordisRealm("client", "client-1")] };
}
function successOutcome(): Record<string, unknown> {
  return { ok: true, result: { op: "cordis-tree/get", tree: cordisTree() } };
}
function queryResponse(
  requestId: string,
  outcome: unknown,
  source: { sourceId: string; generation: string } = { sourceId: "src-1", generation: "gen-1" },
): Record<string, unknown> {
  return { v: 0, t: "query/response", sourceId: source.sourceId, generation: source.generation, requestId, outcome };
}
function bufferOptions(overrides: Partial<BufferOptions> = {}): BufferOptions {
  return { topics: ["*"], maxFrameBytes: 128 * 1024, maxQueuedBytes: 16 * 1024 * 1024, maxQueuedRecords: 2048, maxRecordsPerFrame: 128, ...overrides };
}
function normalizeIds(value: unknown, ids: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeIds(item, ids));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = key === "timeOriginMs" ? "<time>" : normalizeIds(child, ids);
    }
    return result;
  }
  if (typeof value === "string" && ids.includes(value)) return "<id>";
  return value;
}
beforeAll(async () => {
  const stockText = readFileSync(STOCK, "utf8");
  const assembled = assembleHostParts();
  const libText = existsSync(OUR_LIB) ? readFileSync(OUR_LIB, "utf8") : "";
  const source: "lib" | "parts" = libText.trimEnd() === assembled.trimEnd() ? "lib" : "parts";
  const oursText = source === "lib" ? libText : assembled;
  symlinkSync(join(REPO, "apps", "host", "node_modules"), join(OUT, "node_modules"), "dir");
  const oursFile = join(OUT, "ours-codec.mjs");
  const stockFile = join(OUT, "stock-codec.mjs");
  writeFileSync(oursFile, oursText + INTERNAL_EXPORT);
  writeFileSync(stockFile, stockText + INTERNAL_EXPORT);
  const ours = (await import(pathToFileURL(oursFile).href)) as InspectorModule;
  const stock = (await import(pathToFileURL(stockFile).href)) as InspectorModule;
  loaded = { ours, stock, oursText, stockText, source };
});
afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});
describe("experimental-inspector — nguồn A/B", () => {
  test("lát ghép/lib khớp stock sau khi đảo sai lệch task-152 (chỉ khác newline cuối) và export nội bộ đủ", () => {
    const { oursText, stockText, ours, source } = sides();
    // 20/10/2026 (task-162): lib mang SAI LỆCH CÓ CHỦ ĐÍCH task-152; cổng byte = đảo NGƯỢC đúng khối fail-soft (normalize NÉM nếu 0/2 khối) rồi so TỪNG BYTE.
    expect(normalizeHostDeviation(oursText).trimEnd()).toBe(stockText.trimEnd());
    const namespace = ours as unknown as Record<string, unknown>;
    for (const name of INTERNAL_EXPORT.matchAll(/(?:export \{\s*|, )([A-Za-z_$][\w$]*)/gu)) {
      expect(typeof namespace[name[1] ?? ""]).not.toBe("undefined");
    }
    expect(["lib", "parts"]).toContain(source);
  });
});

describe("experimental-inspector — identity / JSON / validation", () => {
  test("inspectorId: biên 1..256; rỗng và 257 cùng lỗi", () => {
    const result = ab((mod) => ({
      one: mod.inspectorId("x", "sourceId"),
      max: mod.inspectorId("x".repeat(256), "sourceId").length,
      empty: capture(() => mod.inspectorId("", "sourceId")),
      over: capture(() => mod.inspectorId("x".repeat(257), "generation")),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.one).toBe("x");
    expect(result.ours.max).toBe(256);
    expect(result.ours.empty).toEqual({
      ok: false,
      name: "Error",
      message: "inspector protocol: sourceId must contain 1 to 256 characters",
    });
  });
  test("isJsonValue: nhận JSON thuần; loại -0/Infinity/undefined/BigInt/class/symbol/sparse/accessor/cycle", () => {
    const nullProto = Object.create(null) as Record<string, unknown>;
    nullProto.a = 1;
    const sparse: unknown[] = [];
    sparse[1] = 1;
    const extraKey = [1] as unknown[] & { extra?: number };
    extraKey.extra = 1;
    const accessor = Object.defineProperty({}, "a", { enumerable: true, get: () => 1 });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const result = ab((mod) => ({
      accepts: [
        mod.isJsonValue(null),
        mod.isJsonValue(true),
        mod.isJsonValue("x"),
        mod.isJsonValue(0),
        mod.isJsonValue(1.5),
        mod.isJsonValue([1, { a: 2 }]),
        mod.isJsonValue(nullProto),
      ],
      rejects: [
        mod.isJsonValue(undefined),
        mod.isJsonValue(Number.NaN),
        mod.isJsonValue(Number.POSITIVE_INFINITY),
        mod.isJsonValue(-0),
        mod.isJsonValue(10n),
        mod.isJsonValue(Symbol("s")),
        mod.isJsonValue(() => 1),
        mod.isJsonValue(new Date(0)),
        mod.isJsonValue(new (class Example {})()),
        mod.isJsonValue({ [Symbol("s")]: 1 }),
        mod.isJsonValue(sparse),
        mod.isJsonValue(extraKey),
        mod.isJsonValue(accessor),
        mod.isJsonValue(cyclic),
      ],
      plain: [mod.isPlainObject({}), mod.isPlainObject(nullProto), mod.isPlainObject([]), mod.isPlainObject(new Date(0))],
      bytes: [mod.jsonByteLength(""), mod.jsonByteLength("é"), mod.jsonByteLength("😀")],
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.accepts.every(Boolean)).toBe(true);
    expect(result.ours.rejects.every((value) => value === false)).toBe(true);
    expect(result.ours.plain).toEqual([true, true, false, false]);
    expect(result.ours.bytes).toEqual([2, 4, 6]);
  });
  test("exactObject/exactKeys/wireId/optional*: hợp lệ và mọi lỗi trường lạ", () => {
    const value = { a: 1 };
    const symbolKey = { a: 1, [Symbol("s")]: 2 };
    const result = ab((mod) => ({
      exact: mod.exactObject(value, ["a"], "obj"),
      unknown: capture(() => mod.exactObject({ a: 1, b: 2 }, ["a"], "obj")),
      notObject: capture(() => mod.exactObject([], ["a"], "obj")),
      symbol: capture(() => mod.exactKeys(symbolKey, ["a"], "obj")),
      wireNonString: capture(() => mod.wireId(1, "sourceId")),
      wireEmpty: capture(() => mod.wireId("", "sourceId")),
      stringPresent: mod.optionalString({ x: "v" }, "x"),
      stringAbsent: mod.optionalString({}, "x"),
      stringBad: capture(() => mod.optionalString({ x: 1 }, "x")),
      booleanPresent: mod.optionalBoolean({ x: false }, "x"),
      booleanBad: capture(() => mod.optionalBoolean({ x: 1 }, "x")),
      numberPresent: mod.optionalNonNegativeNumber({ x: 0 }, "x"),
      numberNegative: capture(() => mod.optionalNonNegativeNumber({ x: -1 }, "x")),
      numberNaN: capture(() => mod.optionalNonNegativeNumber({ x: Number.NaN }, "x")),
      numberInfinite: capture(() => mod.optionalNonNegativeNumber({ x: Number.POSITIVE_INFINITY }, "x")),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.exact).toEqual({ a: 1 });
    expect(result.ours.stringAbsent).toEqual({});
    expect(result.ours.numberPresent).toEqual({ x: 0 });
  });
});

describe("experimental-inspector — message codecs runtime", () => {
  test("console control frame: enable/disable hợp lệ; version/t/trường thừa cùng lỗi", () => {
    const result = ab((mod) => ({
      enable: capture(() => mod.parseClientConsoleControlFrame(consoleFrame("client-console/enable"))),
      disable: capture(() => mod.parseClientConsoleControlFrame(consoleFrame("client-console/disable"))),
      version: capture(() => mod.parseClientConsoleControlFrame({ ...consoleFrame("client-console/enable"), v: 1 })),
      type: capture(() => mod.parseClientConsoleControlFrame({ ...consoleFrame("client-console/enable"), t: "client-console/other" })),
      extra: capture(() => mod.parseClientConsoleControlFrame({ ...consoleFrame("client-console/enable"), extra: 1 })),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.enable).toEqual({
      ok: true,
      value: { v: 0, t: "client-console/enable", sourceId: "src-1", generation: "gen-1", sessionId: "sess-1" },
    });
  });
  test("runtime command: mọi nhánh hợp lệ (evaluate/get-properties/await/release/global/call-function)", () => {
    const commands: Record<string, unknown>[] = [
      { op: "evaluate", expression: "1+1" },
      {
        op: "evaluate",
        expression: "x",
        objectGroup: "g",
        includeCommandLineAPI: true,
        silent: false,
        returnByValue: true,
        generatePreview: false,
        userGesture: true,
        awaitPromise: false,
        disableBreaks: true,
        replMode: false,
        allowUnsafeEvalBlockedByCSP: true,
        timeoutMs: 0,
      },
      { op: "get-properties", handle: "h1", ownProperties: true, accessorPropertiesOnly: false, generatePreview: true, nonIndexedPropertiesOnly: false },
      { op: "await-promise", promise: "p1", returnByValue: true, generatePreview: false },
      { op: "release-object", handle: "h1" },
      { op: "release-object-group", objectGroup: "" },
      { op: "global-lexical-scope-names" },
      { op: "call-function", functionDeclaration: "function(){}" },
      {
        op: "call-function",
        functionDeclaration: "function(){}",
        receiver: "h1",
        arguments: [
          { kind: "value", value: { a: [1, true, null] } },
          { kind: "unserializable", value: "NaN" },
          { kind: "object", handle: "h2" },
          { kind: "undefined" },
        ],
        objectGroup: "g",
        silent: true,
        returnByValue: true,
        generatePreview: true,
        userGesture: true,
        awaitPromise: true,
      },
    ];
    const result = ab((mod) => commands.map((command) => capture(() => mod.parseClientRuntimeCommand(command))));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.every((item) => item.ok)).toBe(true);
  });
  test("runtime command: op lạ, trường thừa, tham số sai kiểu — mọi lỗi như nhau", () => {
    const commands: unknown[] = [
      null,
      [],
      { op: 1 },
      { op: "future" },
      { op: "evaluate", expression: 1 },
      { op: "evaluate", expression: "x", extra: 1 },
      { op: "evaluate", expression: "x", timeoutMs: -1 },
      { op: "get-properties", handle: "" },
      { op: "get-properties", handle: "h", extra: 1 },
      { op: "await-promise", promise: 1 },
      { op: "release-object", handle: 1 },
      { op: "release-object-group", objectGroup: 1 },
      { op: "global-lexical-scope-names", extra: 1 },
      { op: "call-function", functionDeclaration: 1 },
      { op: "call-function", functionDeclaration: "f", arguments: {} },
      { op: "call-function", functionDeclaration: "f", arguments: [{ kind: "value", value: undefined }] },
      { op: "call-function", functionDeclaration: "f", arguments: [{ kind: "unserializable", value: 1 }] },
      { op: "call-function", functionDeclaration: "f", arguments: [{ kind: "object", handle: "" }] },
      { op: "call-function", functionDeclaration: "f", arguments: [{ kind: "future" }] },
      { op: "call-function", functionDeclaration: "f", receiver: "" },
      { op: "call-function", functionDeclaration: "f", extra: 1 },
    ];
    const result = ab((mod) => commands.map((command) => capture(() => mod.parseClientRuntimeCommand(command))));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.every((item) => item.ok === false)).toBe(true);
  });
});
describe("experimental-inspector — message codecs sources/observation", () => {
  test("source codec: list-scripts + get-content-chunk; biên offset/maxBytes/content", () => {
    const valid: unknown[] = [
      { op: "list-scripts" },
      { op: "get-content-chunk", scriptKey: "s1", content: "source", offset: 0, maxBytes: 1 },
      { op: "get-content-chunk", scriptKey: "s1", content: "source-map", offset: 5, maxBytes: 500 },
    ];
    const invalid: unknown[] = [
      null,
      { op: 1 },
      { op: "future" },
      { op: "list-scripts", extra: 1 },
      { op: "get-content-chunk", scriptKey: "", content: "source", offset: 0, maxBytes: 1 },
      { op: "get-content-chunk", scriptKey: "s", content: "other", offset: 0, maxBytes: 1 },
      { op: "get-content-chunk", scriptKey: "s", content: "source", offset: -1, maxBytes: 1 },
      { op: "get-content-chunk", scriptKey: "s", content: "source", offset: 1.5, maxBytes: 1 },
      { op: "get-content-chunk", scriptKey: "s", content: "source", offset: 0, maxBytes: 0 },
      { op: "get-content-chunk", scriptKey: "s", content: "source", offset: 0, maxBytes: 1, extra: 1 },
    ];
    const result = ab((mod) => ({
      valid: valid.map((command) => capture(() => mod.parseClientSourceCommand(command))),
      invalid: invalid.map((command) => capture(() => mod.parseClientSourceCommand(command))),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.valid.every((item) => item.ok)).toBe(true);
    expect(result.ours.invalid.every((item) => item.ok === false)).toBe(true);
  });
  test("observation: lifecycle/delegate hợp lệ; unknown/non-JSON/field sai cùng lỗi", () => {
    const valid = [
      { ...WIRE, t: "source/accepted" },
      { ...WIRE, t: "source/append-acknowledged", nextSequence: 0 },
      { ...WIRE, t: "source/resnapshot", expectedSequence: 0, reason: "" },
      { v: 0, t: "source/rejected", code: "unauthorized", message: "no" },
      runtimeRequest({ op: "global-lexical-scope-names" }),
      consoleFrame("client-console/disable"),
      sourceRequest({ op: "list-scripts" }),
      { ...WIRE, t: "client-runtime/cancel", sessionId: "sess-1", requestId: "req-1" },
      { ...WIRE, t: "client-runtime/response-acknowledged", sessionId: "sess-1", requestId: "req-1" },
      { ...WIRE, t: "client-runtime/session-closed", sessionId: "sess-1" },
      { ...WIRE, t: "client-sources/session-closed", sessionId: "sess-1" },
    ];
    const invalid = [
      { ...WIRE, t: "source/accepted", v: 1 },
      { ...WIRE, t: "future/frame" },
      { v: 0, t: "source/rejected", code: "stale-source", message: "x" },
      { ...WIRE, t: "source/append-acknowledged", nextSequence: -1 },
      { ...WIRE, t: "source/resnapshot", expectedSequence: 0 },
      { t: "source/accepted", sourceId: "src-1", generation: "gen-1" },
      { v: 0, t: "source/accepted", sourceId: "src-1" },
      { v: 0, t: "source/accepted", sourceId: 1, generation: "gen-1" },
      { ...WIRE, t: "source/accepted", extra: 1 },
      { ...WIRE, t: "source/accepted", extra: undefined },
      { ...runtimeRequest({ op: "release-object", handle: "h" }), v: 1 },
    ];
    const result = ab((mod) => ({
      valid: valid.map((frame) => capture(() => mod.parseWorkerSourceFrame(frame))),
      invalid: invalid.map((frame) => capture(() => mod.parseWorkerSourceFrame(frame))),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.valid.every((item) => item.ok)).toBe(true);
    expect(result.ours.invalid.every((item) => item.ok === false)).toBe(true);
  });
});

describe("experimental-inspector — CDP / realm / control", () => {
  test("CDP bridge: reason, error class, reject object/property/runtime/sources/console", () => {
    const ops = ["evaluate", "call-function", "await-promise", "global-lexical-scope-names", "release-object", "release-object-group", "get-properties", "future"];
    const result = ab((mod) => {
      const error = new mod.HostCdpBridgeUnavailableError("evaluate");
      return {
        reason: mod.HOST_CDP_BRIDGE_REASON,
        error: {
          name: error.name,
          message: error.message,
          isError: error instanceof Error,
          isClass: error instanceof mod.HostCdpBridgeUnavailableError,
        },
        rejects: ops.map((op) => capture(() => mod.rejectRuntimeBridgeCommand({ op }))),
        property: capture(() => mod.rejectPropertyBridgeOperation()),
        object: capture(() => mod.rejectObjectBridgeOperation("x")),
        console: capture(() => mod.rejectConsoleBridgeCommand("client-console/enable")),
        sources: capture(() => mod.rejectSourcesBridgeCommand()),
        caps: mod.bridgeCapabilities("https://example.test", true),
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.reason).toBe("Host Runtime is attached directly from the Inspector Worker");
    expect(result.ours.error.isClass).toBe(true);
    expect(result.ours.caps).toEqual([]);
    expect(result.ours.rejects[0]).toEqual({
      ok: false,
      name: "Error",
      message: "inspector protocol: client-runtime/evaluate cannot use the Host source bridge; Host Runtime is attached directly from the Inspector Worker",
    });
  });
  test("realm: createHostRealmSource tạo host-<uuid>, generation UUID, capabilities rỗng", () => {
    const result = ab((mod) => {
      const source = mod.createHostRealmSource("host-test");
      return {
        sourceIdPrefix: source.sourceId.startsWith("host-"),
        sourceIdLength: source.sourceId.length,
        generationUuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(source.generation),
        kind: source.kind,
        label: source.label,
        timeOriginFinite: Number.isFinite(source.timeOriginMs),
        capabilities: source.capabilities,
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.sourceIdPrefix).toBe(true);
    expect(result.ours.sourceIdLength).toBe(41);
    expect(result.ours.generationUuid).toBe(true);
    expect(result.ours.kind).toBe("host");
    expect(result.ours.label).toBe("host-test");
    expect(result.ours.timeOriginFinite).toBe(true);
    expect(result.ours.capabilities).toEqual([]);
  });
  test("control codec: ready/failure/stopped; port âm/phân số, type lạ, trường thừa", () => {
    const valid: unknown[] = [
      { type: "ready", host: "127.0.0.1", port: 0, targetId: "target-1" },
      { type: "ready", host: "127.0.0.1", port: 9230, targetId: "target-1" },
      { type: "failure", message: "boom" },
      { type: "stopped" },
    ];
    const invalid: unknown[] = [
      { type: "ready", host: "127.0.0.1", port: -1, targetId: "t" },
      { type: "ready", host: "127.0.0.1", port: 1.5, targetId: "t" },
      { type: "ready", host: 1, port: 1, targetId: "t" },
      { type: "ready", host: "h", port: 1, targetId: 1 },
      { type: "ready", host: "h", port: 1, targetId: "t", extra: 1 },
      { type: "failure", message: 1 },
      { type: "failure", message: "x", extra: 1 },
      { type: "stopped", extra: 1 },
      { type: "future" },
      { type: 1 },
      {},
    ];
    const result = ab((mod) => ({
      valid: valid.map((value) => capture(() => mod.parseInspectorWorkerControl(value))),
      invalid: invalid.map((value) => capture(() => mod.parseInspectorWorkerControl(value))),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.valid.every((item) => item.ok)).toBe(true);
    expect(result.ours.invalid.every((item) => item.ok === false)).toBe(true);
  });
});

describe("experimental-inspector — buffer / publisher", () => {
  test("InspectorSourceBuffer: publish/takeBatch giữ sequence + droppedBefore + maxRecordsPerFrame", () => {
    const result = ab((mod) => {
      const buffer = new mod.InspectorSourceBuffer(bufferOptions({ maxRecordsPerFrame: 2 }));
      buffer.publish("a", { n: 1 }, 1);
      buffer.publish("b", { n: 2 }, 2);
      buffer.publish("c", { n: 3 }, 3);
      buffer.setState("state", { ok: true }, 4);
      return {
        first: buffer.takeBatch("src-1", "gen-1"),
        second: buffer.takeBatch("src-1", "gen-1"),
        third: buffer.takeBatch("src-1", "gen-1"),
        replacement: buffer.replacement("src-1", "gen-1"),
        pending: buffer.hasPending,
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.first?.records.length).toBe(2);
    expect(result.ours.first?.firstSequence).toBe(1);
    expect(result.ours.second?.records.length).toBe(2);
    expect(result.ours.second?.firstSequence).toBe(3);
    expect(result.ours.third).toBeUndefined();
    expect(result.ours.replacement.records.length).toBe(1);
  });
  test("InspectorSourceBuffer: overflow cắt prefix + record quá khung tiêu sequence", () => {
    const result = ab((mod) => {
      const overflow = new mod.InspectorSourceBuffer(bufferOptions({ maxQueuedRecords: 2 }));
      for (let index = 1; index <= 5; index += 1) overflow.publish("a", { index }, index);
      const oversized = new mod.InspectorSourceBuffer(bufferOptions({ maxFrameBytes: 4096 + 100 }));
      oversized.publish("a", { big: "x".repeat(200) }, 1);
      oversized.publish("a", { small: 1 }, 2);
      return {
        overflow: overflow.takeBatch("src-1", "gen-1"),
        oversized: oversized.takeBatch("src-1", "gen-1"),
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.overflow?.firstSequence).toBe(4);
    expect(result.ours.overflow?.droppedBefore).toBe(3);
    expect(result.ours.oversized?.firstSequence).toBe(2);
    expect(result.ours.oversized?.droppedBefore).toBe(1);
  });
  test("InspectorSourceBuffer: setState vượt khung rollback; đúng biên thì publish được", () => {
    const result = ab((mod) => {
      const payload = "x".repeat(40);
      const record = { monotonicMs: 1, topic: "s", payload };
      const buffer = new mod.InspectorSourceBuffer(bufferOptions({ maxFrameBytes: 4096 + mod.jsonByteLength(record) }));
      const failure = capture(() => buffer.setState("s", payload, 1));
      const replacement = buffer.replacement("src-1", "gen-1");
      buffer.publish("s", payload, 2);
      return { failure, replacement, batch: buffer.takeBatch("src-1", "gen-1") };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.failure).toEqual({
      ok: false,
      name: "Error",
      message: "inspector: source state exceeds the source-frame byte limit",
    });
    expect(result.ours.replacement.records).toEqual([]);
    expect(result.ours.batch?.records.length).toBe(1);
  });
  test("InspectorSourceBuffer: topic/payload/monotonic validation như nhau", () => {
    const result = ab((mod) => {
      const buffer = new mod.InspectorSourceBuffer(bufferOptions({ topics: ["a"] }));
      return {
        emptyTopic: capture(() => buffer.publish("", {}, 1)),
        longTopic: capture(() => buffer.publish("x".repeat(129), {}, 1)),
        undeclared: capture(() => buffer.publish("other", {}, 1)),
        payload: capture(() => buffer.publish("a", undefined, 1)),
        monotonic: capture(() => buffer.publish("a", {}, Number.NaN)),
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.emptyTopic).toEqual({
      ok: false,
      name: "Error",
      message: "inspector: topic must contain 1 to 128 characters",
    });
    expect(Object.values(result.ours).every((item) => item.ok === false)).toBe(true);
  });
  test("HostBridgePublisher: publish→flush→acknowledge→close trên cổng giả", () => {
    const result = ab((mod) => {
      const port = new FakePort();
      const source: HostSourceDescriptor = {
        sourceId: "src-1",
        generation: "gen-1",
        kind: "host",
        label: "host-test",
        timeOriginMs: 0,
        capabilities: [],
      };
      const publisher = new mod.HostBridgePublisher(port, source, bufferOptions({ maxRecordsPerFrame: 2 }));
      publisher.publish("a", { n: 1 }, 1);
      publisher.publish("b", { n: 2 }, 2);
      publisher.flush();
      const first = port.posted[0] as AppendFrame;
      publisher.acknowledge(first.firstSequence + first.records.length);
      publisher.publish("c", { n: 3 }, 3);
      publisher.flush();
      const mismatch = capture(() => publisher.acknowledge(999));
      publisher.close();
      const afterClose = capture(() => publisher.setState("s", { x: 1 }, 4));
      publisher.publish("d", { n: 4 }, 5);
      return { posted: port.posted, mismatch, afterClose };
    });
    // 20/10/2026 (task-162): afterClose là SAI LỆCH CÓ CHỦ ĐÍCH task-152 — stock NÉM, ta warn ĐÚNG MỘT LẦN rồi
    // bỏ qua lần ghi (fail-soft: ném ở đây làm chết host khi Worker chết). So A/B phần còn lại, khẳng định riêng.
    expect(result.ours.posted).toEqual(result.stock.posted);
    expect(result.ours.mismatch).toEqual(result.stock.mismatch);
    expect(result.stock.afterClose).toEqual({ ok: false, name: "Error", message: "inspector: Host source is closed" });
    expect(result.ours.afterClose).toEqual({ ok: true, value: undefined });
    expect(result.ours.posted.length).toBe(2);
    expect(result.ours.mismatch).toEqual({
      ok: false,
      name: "Error",
      message: "inspector: Host source acknowledgement does not match the in-flight batch",
    });
  });
});

describe("experimental-inspector — query codec / rpc", () => {
  test("query codec: envelope + outcome ok/error + cây Cordis hợp lệ", () => {
    const result = ab((mod) => ({
      envelope: mod.isInspectorQueryResponseEnvelope({ t: "query/response" }),
      notEnvelope: mod.isInspectorQueryResponseEnvelope({ t: "other" }),
      ok: capture(() => mod.parseInspectorQueryResponseFrame(queryResponse("query-1", successOutcome()))),
      failed: capture(() =>
        mod.parseInspectorQueryResponseFrame(queryResponse("query-1", { ok: false, error: { code: "stale-source", message: "stale" } })),
      ),
      badCode: capture(() =>
        mod.parseInspectorQueryResponseFrame(queryResponse("query-1", { ok: false, error: { code: "future", message: "x" } })),
      ),
      badEnvelope: capture(() => mod.parseInspectorQueryResponseFrame({ ...queryResponse("query-1", successOutcome()), v: 1 })),
      noOp: capture(() => mod.parseInspectorQueryResponseFrame(queryResponse("query-1", { ok: true, result: {} }))),
      codes: [...mod.QUERY_ERROR_CODES].sort(),
      overhead: mod.SOURCE_FRAME_OVERHEAD_BYTES,
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.envelope).toBe(true);
    expect(result.ours.notEnvelope).toBe(false);
    expect(result.ours.ok.ok).toBe(true);
    expect(result.ours.codes).toEqual(["internal-error", "invalid-request", "result-too-large", "stale-source"]);
    expect(result.ours.overhead).toBe(4096);
  });
  test("query codec: sourceId/Fiber lặp, root sai, connection/trường sai đều bị chặn", () => {
    const duplicateSource = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: cordisRealm("host", "same"),
      clients: [cordisRealm("client", "same")],
    });
    const duplicateFiber = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: {
        ...cordisRealm("host", "host-1"),
        root: {
          kind: "context",
          children: [
            { kind: "fiber", uid: 1, children: [{ kind: "context", children: [] }] },
            { kind: "fiber", uid: 1, children: [{ kind: "context", children: [] }] },
          ],
        },
      },
      clients: [],
    });
    const rootFiber = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: { ...cordisRealm("host", "host-1"), root: { kind: "fiber", uid: 1, children: [{ kind: "context", children: [] }] } },
      clients: [],
    });
    const badConnection = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: { ...cordisRealm("host", "host-1"), connection: { state: "disconnected" } },
      clients: [],
    });
    const extraField = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: { ...cordisRealm("host", "host-1"), extra: 1 },
      clients: [],
    });
    const clientAsHost = (): Record<string, unknown> => ({
      schemaVersion: 0,
      host: cordisRealm("client", "host-1"),
      clients: [],
    });
    const result = ab((mod) => ({
      duplicateSource: capture(() => mod.parseCordisRuntimeTree(duplicateSource())),
      duplicateFiber: capture(() => mod.parseCordisRuntimeTree(duplicateFiber())),
      rootFiber: capture(() => mod.parseCordisRuntimeTree(rootFiber())),
      badConnection: capture(() => mod.parseCordisRuntimeTree(badConnection())),
      extraField: capture(() => mod.parseCordisRuntimeTree(extraField())),
      clientAsHost: capture(() => mod.parseCordisRuntimeTree(clientAsHost())),
      revision: capture(() => mod.parseCordisRuntimeTree({ ...cordisTree(), host: { ...cordisRealm("host", "h"), revision: 0 } })),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(Object.values(result.ours).every((item) => item.ok === false)).toBe(true);
  });
  test("InspectorQueryConnection: chưa connect ⇒ reject; connect/request/receive resolve", async () => {
    const result = await abAsync(async (mod) => {
      const before = await captureAsync(() =>
        new mod.InspectorQueryConnection({ timeoutMs: 1000, maxFrameBytes: 128 * 1024 }).request({ op: "cordis-tree/get" }),
      );
      const sent: unknown[] = [];
      const connection = new mod.InspectorQueryConnection({ timeoutMs: 1000, maxFrameBytes: 128 * 1024 });
      connection.connect("src-1", "gen-1", { send: (frame) => sent.push(frame) });
      const pending = connection.request({ op: "cordis-tree/get" });
      const request = sent[0] as { requestId: string };
      const accepted = connection.receive(queryResponse(request.requestId, successOutcome()));
      const value = await pending;
      connection.close();
      return { before, sent, accepted, value };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.before).toEqual({
      ok: false,
      name: "Error",
      message: "Inspector query transport is not connected",
    });
    expect(result.ours.accepted).toBe(true);
    expect(result.ours.sent.length).toBe(1);
  });
  test("InspectorQueryConnection: generation mismatch + remote error (InspectorQueryRemoteError)", async () => {
    const result = await abAsync(async (mod) => {
      const sent: unknown[] = [];
      const connection = new mod.InspectorQueryConnection({ timeoutMs: 1000, maxFrameBytes: 128 * 1024 });
      connection.connect("src-1", "gen-1", { send: (frame) => sent.push(frame) });
      const pendingMismatch = connection.request({ op: "cordis-tree/get" });
      const requestMismatch = sent[0] as { requestId: string };
      const mismatchReceived = connection.receive({ ...queryResponse(requestMismatch.requestId, successOutcome()), generation: "gen-2" });
      const mismatch = await captureAsync(() => pendingMismatch);
      const pendingRemote = connection.request({ op: "cordis-tree/get" });
      const requestRemote = sent[1] as { requestId: string };
      connection.receive(queryResponse(requestRemote.requestId, { ok: false, error: { code: "stale-source", message: "stale" } }));
      let remoteClass = false;
      const remote = await captureAsync(async () => {
        try {
          await pendingRemote;
        } catch (error) {
          remoteClass = error instanceof mod.InspectorQueryRemoteError;
          throw error;
        }
      });
      connection.close();
      return { mismatch, mismatchReceived, remote, remoteClass };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.mismatch).toEqual({
      ok: false,
      name: "Error",
      message: "Inspector query response source generation does not match",
    });
    expect(result.ours.remote.ok).toBe(false);
    expect(result.ours.remoteClass).toBe(true);
  });
});

describe("experimental-inspector — dispatcher / transport", () => {
  test("dispatchBridgeFrame: lifecycle handlers + từ chối lệnh Client-only", () => {
    const result = ab((mod) => {
      const calls: string[] = [];
      const handlers: BridgeHandlers = {
        accepted: () => calls.push("accepted"),
        acknowledged: () => calls.push("acknowledged"),
        resnapshot: () => calls.push("resnapshot"),
        rejected: () => calls.push("rejected"),
      };
      mod.dispatchBridgeFrame({ ...WIRE, t: "source/accepted" }, handlers);
      mod.dispatchBridgeFrame({ ...WIRE, t: "source/append-acknowledged", nextSequence: 1 }, handlers);
      mod.dispatchBridgeFrame({ ...WIRE, t: "source/resnapshot", expectedSequence: 1, reason: "r" }, handlers);
      mod.dispatchBridgeFrame({ v: 0, t: "source/rejected", code: "unauthorized", message: "no" }, handlers);
      const rejected = [
        capture(() => mod.dispatchBridgeFrame({ t: "client-runtime/request", command: { op: "evaluate" } }, handlers)),
        capture(() => mod.dispatchBridgeFrame({ t: "client-console/enable" }, handlers)),
        capture(() => mod.dispatchBridgeFrame({ t: "client-sources/request" }, handlers)),
      ];
      const silent = [
        capture(() => mod.dispatchBridgeFrame({ t: "client-runtime/cancel" }, handlers)),
        capture(() => mod.dispatchBridgeFrame({ t: "client-runtime/response-acknowledged" }, handlers)),
        capture(() => mod.dispatchBridgeFrame({ t: "client-runtime/session-closed" }, handlers)),
        capture(() => mod.dispatchBridgeFrame({ t: "client-sources/session-closed" }, handlers)),
      ];
      return { calls, rejected, silent };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.calls).toEqual(["accepted", "acknowledged", "resnapshot", "rejected"]);
    expect(result.ours.rejected.every((item) => item.ok === false)).toBe(true);
    expect(result.ours.silent.every((item) => item.ok)).toBe(true);
  });
  test("HostInspectorSource: source/open + replace + accepted + query roundtrip (ID chuẩn hoá)", async () => {
    const result = await abAsync(async (mod) => {
      const port = new FakePort();
      const source = new mod.HostInspectorSource(
        port,
        { ...bufferOptions({ topics: ["*"], maxRecordsPerFrame: 10 }), label: "host-test", queryTimeoutMs: 1000 },
      );
      const open = port.posted[0] as unknown as { source: HostSourceDescriptor };
      port.emit("message", { v: 0, t: "source/accepted", sourceId: open.source.sourceId, generation: open.source.generation });
      source.publish("test/topic", { n: 1 }, 1);
      await Promise.resolve();
      const pending = source.request({ op: "cordis-tree/get" });
      const request = port.posted.find((frame) => (frame as { t?: string }).t === "query/request") as { requestId: string } | undefined;
      if (request === undefined) throw new Error("không thấy query/request");
      port.emit("message", queryResponse(request.requestId, successOutcome(), open.source));
      const value = await pending;
      source.close();
      return {
        frames: port.posted.map((frame) => normalizeIds(frame, [open.source.sourceId, open.source.generation])),
        closed: port.closed,
        value,
      };
    });
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.closed).toBe(true);
    expect((result.ours.frames[0] as { t: string }).t).toBe("source/open");
    expect((result.ours.frames[1] as { t: string }).t).toBe("source/replace");
    expect((result.ours.frames[2] as { t: string }).t).toBe("source/append");
    expect((result.ours.frames.at(-1) as { t: string }).t).toBe("source/close");
  });
});

describe("experimental-inspector — bề mặt export public", () => {
  test("name/inject/Config/resolveInspectorOptions mặc định khớp stock", () => {
    const result = ab((mod) => ({
      name: mod.name,
      inject: mod.inject,
      config: mod.Config({}),
      resolved: mod.resolveInspectorOptions(),
      apply: typeof mod.apply,
      start: typeof mod.startInspector,
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.name).toBe("experimental-inspector");
    expect(result.ours.inject).toEqual(["webServer", "connection"]);
    expect(result.ours.resolved["host"]).toBe("127.0.0.1");
    expect(result.ours.resolved["port"]).toBe(0);
    expect(result.ours.resolved["captureFetch"]).toBe(true);
    expect(result.ours.config["port"]).toBe(9230);
    expect(result.ours.apply).toBe("function");
    expect(result.ours.start).toBe("function");
  });
  test("resolveInspectorOptions: tuỳ biến + biên port/chunk/reconnect/origin", () => {
    const result = ab((mod) => ({
      custom: mod.resolveInspectorOptions({
        host: "0.0.0.0",
        port: 65535,
        clientOrigins: ["https://example.test"],
        captureFetch: false,
        maxQueuedRecords: 1,
        maxDisconnectedCordisTrees: 0,
      }),
      portHigh: capture(() => mod.resolveInspectorOptions({ port: 65536 })),
      chunk: capture(() => mod.resolveInspectorOptions({ maxBodyChunkBytes: 100000, maxSourceFrameBytes: 1000 })),
      reconnect: capture(() => mod.resolveInspectorOptions({ clientReconnectBaseMs: 5000, clientReconnectMaxMs: 250 })),
      origin: capture(() => mod.resolveInspectorOptions({ clientOrigins: ["https://example.test/"] })),
      negativePort: capture(() => mod.resolveInspectorOptions({ port: -1 })),
    }));
    expect(result.ours).toEqual(result.stock);
    expect(result.ours.custom["captureFetch"]).toBe(false);
    expect(result.ours.portHigh).toEqual({ ok: false, name: "Error", message: "inspector: port must not exceed 65535" });
    expect(Object.values(result.ours).slice(1).every((item) => item.ok === false)).toBe(true);
  });
});
