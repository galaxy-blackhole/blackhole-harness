/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B CÓ KIỂU cho @galaxy-blackhole/gbh-subagent: so từng module port với bundle gốc CHỈ ĐỌC —
 *      descriptor, child-agent, catalog, activation, continuation-messages, assistant-output, list-children,
 *      archive-admission, out-of-process — trên JSON, chuỗi lỗi và mã lỗi.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type * as PortCatalog from "../../packages/host/subagent/src/catalog.ts";
import * as portActivation from "../../packages/host/subagent/src/activation.ts";
import * as portArchive from "../../packages/host/subagent/src/archive-admission.ts";
import * as portContinuation from "../../packages/host/subagent/src/continuation-messages.ts";
import * as portList from "../../packages/host/subagent/src/list-children.ts";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Gói port của ta. */
const PKG = join(REPO, "packages/host/subagent");
/** Gói gốc CHỈ ĐỌC trong kernel. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subagent");
/** Thư mục module gốc đã build. */
const STOCK_TYPES = join(STOCK, "lib/types");

/** Mặt công khai của gói port (lib/index.js), dùng làm kiểu cho CẢ hai bản cài. */
type PortIndex = typeof import("../../packages/host/subagent/src/index.ts");

/** Bundle chính của ta — nguồn A/B cho descriptor/assistant-output/out-of-process. */
const portLib = (await import(join(PKG, "lib/index.js"))) as PortIndex;
/** Bundle chính của gốc — cùng mặt công khai. */
const stockLib = (await import(join(STOCK, "lib/index.js"))) as PortIndex;
// LƯỢT ĐO 01/11/2026: catalog của ta nạp qua bản DỰNG LẠI có `node_modules` trỏ KERNEL. Phép so THÔNG
// ĐIỆP lỗi zod (ca K3) cần ĐÚNG phiên bản zod của kernel: bản workspace (4.6.7) gộp lỗi union thành
// MỘT issue, kernel (4.4.3) trả `invalid_union` ⇒ so chữ trên `src` trượt OAN dù schema y hệt.
const KERNEL_BUILD = mkdtempSync(join(tmpdir(), "gbh-subagent-catalog-"));
const builtCatalog = await Bun.build({ entrypoints: [join(PKG, "src/catalog.ts")], outdir: KERNEL_BUILD, target: "node", format: "esm", packages: "external" });
if (!builtCatalog.success) throw new Error("build catalog thất bại");
mkdirSync(join(KERNEL_BUILD, "node_modules"), { recursive: true });
symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(KERNEL_BUILD, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(KERNEL_BUILD, "node_modules", "@galaxy-blackhole"), "dir");
symlinkSync(join(REPO, "apps", "host", "node_modules", "zod"), join(KERNEL_BUILD, "node_modules", "zod"), "dir");
const portCatalog = (await import(join(KERNEL_BUILD, "catalog.js"))) as typeof PortCatalog;
/** Module con của gốc — mỗi tệp đối chứng một module typed tương ứng của ta. */
const stockChild = (await import(join(STOCK_TYPES, "child-agent.js"))) as typeof import("../../packages/host/subagent/src/child-agent.ts");
const stockCatalog = (await import(join(STOCK_TYPES, "catalog.js"))) as typeof PortCatalog;
const stockActivation = (await import(join(STOCK_TYPES, "activation.js"))) as typeof portActivation;
const stockContinuation = (await import(join(STOCK_TYPES, "continuation-messages.js"))) as typeof portContinuation;
const stockList = (await import(join(STOCK_TYPES, "list-children.js"))) as typeof portList;
const stockArchive = (await import(join(STOCK_TYPES, "archive-admission.js"))) as typeof portArchive;

/** JSON text của một giá trị, kể cả undefined. */
function jsonOf(value: unknown): string {
  return JSON.stringify(value) ?? "undefined";
}

/** So JSON hai bản cài; mọi ca A/B đi qua đây. */
function expectSameJson(portValue: unknown, stockValue: unknown): void {
  expect(jsonOf(portValue)).toBe(jsonOf(stockValue));
}

/** Hình lỗi quan sát được: tên, chuỗi thông điệp, mã định tuyến và hai trường độ sâu. */
interface ThrownShape {
  readonly name: string;
  readonly message: string;
  readonly code?: string;
  readonly attemptedDepth?: number;
  readonly maxDepth?: number;
}

/** Kết quả bắt lỗi: hoặc hình lỗi, hoặc cờ cho biết không ném. */
type Captured = ThrownShape | { readonly ok: true };

/** Rút hình lỗi từ một giá trị bị ném. */
function shapeOfError(error: unknown): ThrownShape {
  if (!(error instanceof Error)) return { name: typeof error, message: String(error) };
  const record = error as Error & { code?: unknown; attemptedDepth?: unknown; maxDepth?: unknown };
  return {
    name: record.name,
    message: record.message,
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(typeof record.attemptedDepth === "number" ? { attemptedDepth: record.attemptedDepth } : {}),
    ...(typeof record.maxDepth === "number" ? { maxDepth: record.maxDepth } : {}),
  };
}

/** Bắt lỗi đồng bộ của một lượt gọi. */
function captureThrown(run: () => unknown): Captured {
  try {
    run();
    return { ok: true };
  }
  catch (error) {
    return shapeOfError(error);
  }
}

/** Bắt lỗi bất đồng bộ của một lượt gọi. */
async function captureRejection(run: () => Promise<unknown>): Promise<Captured> {
  try {
    await run();
    return { ok: true };
  }
  catch (error) {
    return shapeOfError(error);
  }
}

/** So chuỗi lỗi + mã lỗi của hai lượt gọi đồng bộ. */
function expectSameThrown(portRun: () => unknown, stockRun: () => unknown): void {
  expectSameJson(captureThrown(portRun), captureThrown(stockRun));
}

/** So chuỗi lỗi + mã lỗi của hai lượt gọi bất đồng bộ. */
async function expectSameRejection(portRun: () => Promise<unknown>, stockRun: () => Promise<unknown>): Promise<void> {
  expectSameJson(await captureRejection(portRun), await captureRejection(stockRun));
}

/** Khối văn bản model-nhìn-thấy. */
function textBlock(text: string): { readonly type: "text"; readonly text: string } {
  return { type: "text", text };
}

/** Bản ghi append của một phiên giả. */
interface AppendCall {
  readonly type: string;
  readonly data: unknown;
}

/** Phiên giả chỉ có đường ghi append, kèm nhật ký. */
function recordingSession(): { readonly session: never; readonly calls: AppendCall[] } {
  const calls: AppendCall[] = [];
  const session = {
    append(type: string, data: unknown): unknown {
      calls.push({ type, data });
      return { type, data };
    },
  };
  return { session: session as never, calls };
}

/** Đầu vào của một Agent cha giả. */
interface FakeParentSpec {
  readonly id?: string;
  readonly cwd?: string;
  readonly delegationDepth?: number;
  readonly runtimeDepth?: number;
  readonly options?: Record<string, unknown>;
  readonly request?: { readonly provider: string; readonly model: string; readonly reasoningEffort?: string };
  readonly services?: Record<string, unknown>;
}

/** Agent cha giả mang đúng ba bề mặt mà child-agent đọc. */
type ParentAgent = Parameters<typeof portLib.resolveChildDepth>[0];

/** Dựng Agent cha giả; header là nguồn độ sâu bền, options là sàn lúc chạy. */
function mkParent(spec: FakeParentSpec = {}): ParentAgent {
  const id = spec.id ?? "parent-1";
  const header: Record<string, unknown> = { id };
  if (spec.cwd !== undefined) header["cwd"] = spec.cwd;
  if (spec.delegationDepth !== undefined) header["delegationDepth"] = spec.delegationDepth;
  const options: Record<string, unknown> = {
    provider: "parent-provider",
    model: "parent-model",
    reasoningEffort: "high",
    maxTokens: 1024,
    ...spec.options,
  };
  if (spec.runtimeDepth !== undefined) options["subagentDepth"] = spec.runtimeDepth;
  const services = spec.services ?? {};
  const parent = {
    id,
    options,
    session: { header, requestHeader: () => spec.request },
    ctx: { get: (key: string): unknown => services[key] },
  };
  return parent as unknown as ParentAgent;
}

/** Khoá dọn runtime (Symbol.dispose) đọc động để không phụ thuộc lib ES2024. */
const DISPOSE = (Symbol as unknown as { readonly dispose: symbol }).dispose;

/** Lượt quan sát Session giả có thể dọn, đúng hai bề mặt mà list/archive đọc. */
function mkObservation(spec: {
  readonly projections?: unknown;
  readonly events?: readonly { readonly type: string; readonly data: unknown }[];
  readonly inheritedEventCount?: number;
  readonly onDispose?: () => void;
}): never {
  const observation = {
    projections: spec.projections,
    events: spec.events ?? [],
    inheritedEventCount: spec.inheritedEventCount ?? 0,
    [DISPOSE]: (): void => spec.onDispose?.(),
  };
  return observation as never;
}

/** Context giả tối thiểu cho list-children. */
function mkListContext(spec: { readonly sessionQuery?: unknown; readonly sessions?: unknown }): never {
  return {
    get: (key: string): unknown => {
      if (key === "sessionQuery") return spec.sessionQuery;
      if (key === "sessions") return spec.sessions;
      return undefined;
    },
  } as never;
}

/** Một Agent giả trong sổ đăng ký của archive-admission. */
interface FakeAgent {
  readonly id: string;
  readonly session: { readonly header: { readonly parentSession?: string; readonly origin?: string } };
  readonly status: string;
  cancelled: boolean;
  cancelReason?: unknown;
  throwOnCancel?: boolean;
  cancel(reason: unknown): void;
}

/** Hai listener mà archive-admission đăng ký. */
interface ArchiveListeners {
  "workspace/session-activity"?: (
    payload: { readonly sessionId: string },
    next: () => Promise<readonly Record<string, unknown>[]>,
  ) => Promise<readonly Record<string, unknown>[]>;
  "workspace/session-stop"?: (payload: { readonly sessionId: string }) => void;
}

/** Giàn context giả cho archive-admission. */
interface ArchiveHarness {
  readonly listeners: ArchiveListeners;
  readonly warnings: string[];
}

/** Dựng Agent giả mang đúng dòng dõi + trạng thái mà phép dò đọc. */
function mkAgent(id: string, parentSession: string | undefined, origin: string | undefined, status: string): FakeAgent {
  return {
    id,
    session: {
      header: {
        ...(parentSession === undefined ? {} : { parentSession }),
        ...(origin === undefined ? {} : { origin }),
      },
    },
    status,
    cancelled: false,
    cancel(reason: unknown): void {
      if (this.throwOnCancel === true) throw new Error("cancel refused");
      this.cancelled = true;
      this.cancelReason = reason;
    },
  };
}

/** Dựng context giả với registry Agent, logger và dịch vụ truy vấn tuỳ chọn. */
function mkArchiveHarness(
  module: typeof portArchive,
  agents: FakeAgent[],
  services: Record<string, unknown> = {},
): ArchiveHarness {
  const listeners: ArchiveListeners = {};
  const warnings: string[] = [];
  const ctx = {
    on: (name: keyof ArchiveListeners, listener: (...args: never[]) => unknown): (() => void) => {
      (listeners as Record<string, unknown>)[name] = listener;
      return () => undefined;
    },
    agents: { list: (): FakeAgent[] => agents },
    get: (key: string): unknown => services[key],
    logger: { warn: (message: string): void => { warnings.push(message); } },
  };
  module.installSubagentArchiveAdmission(ctx as never);
  return { listeners, warnings };
}

describe("descriptor", () => {
  test("D1 snapshot đủ trường + tách rời + phiên bản", () => {
    const input = {
      mode: "continuable",
      provider: "provider-a",
      label: "label-a",
      agentProvider: "agent-provider",
      agentModel: "agent-model",
      agentReasoningEffort: "high",
      persona: "persona-a",
      toolFilter: { allow: ["read"], deny: ["bash"] },
    };
    const port = portLib.snapshotSubagentDescriptor(input as never);
    const stock = stockLib.snapshotSubagentDescriptor(input as never);
    expectSameJson(port, stock);
    expect(port).toEqual({
      version: 3,
      mode: "continuable",
      provider: "provider-a",
      label: "label-a",
      agentProvider: "agent-provider",
      agentModel: "agent-model",
      agentReasoningEffort: "high",
      persona: "persona-a",
      toolFilter: { allow: ["read"], deny: ["bash"] },
    } as never);
    expect(portLib.SUBAGENT_DESCRIPTOR_VERSION).toBe(stockLib.SUBAGENT_DESCRIPTOR_VERSION);
    expect(port.toolFilter).not.toBe(input.toolFilter);
  });

  test("D2 snapshot từ chối giá trị JSON KHÔNG mất mát", () => {
    const functionPersona = { mode: "continuable", provider: "p", label: "l", persona: () => "x" };
    expectSameThrown(
      () => portLib.snapshotSubagentDescriptor(functionPersona as never),
      () => stockLib.snapshotSubagentDescriptor(functionPersona as never),
    );
    const nanFilter = { mode: "continuable", provider: "p", label: "l", toolFilter: { allow: [Number.NaN] } };
    expectSameThrown(
      () => portLib.snapshotSubagentDescriptor(nanFilter as never),
      () => stockLib.snapshotSubagentDescriptor(nanFilter as never),
    );
    expectSameJson(
      captureThrown(() => portLib.snapshotSubagentDescriptor(functionPersona as never)),
      { name: "Error", message: "subagent descriptor is not losslessly JSON-serializable" },
    );
  });

  test("D3 fold: sự kiện đầu thắng, vắng/phiên bản lạ trả undefined", () => {
    const oneShot = { version: 3, mode: "one-shot", provider: "p", label: "one" };
    const continuable = {
      version: 3,
      mode: "continuable",
      provider: "p",
      label: "two",
      agentProvider: "ap",
      agentModel: "am",
      agentReasoningEffort: "low",
      persona: "pe",
      toolFilter: { deny: ["bash"] },
    };
    const events = [
      { type: "turn/end", data: null },
      { type: "subagent/descriptor", data: oneShot },
      { type: "subagent/descriptor", data: continuable },
    ];
    expectSameJson(portLib.foldSubagentDescriptor(events as never), stockLib.foldSubagentDescriptor(events as never));
    expect(portLib.foldSubagentDescriptor(events as never)).toEqual(oneShot as never);
    const none = [{ type: "turn/end", data: null }];
    expectSameJson(portLib.foldSubagentDescriptor(none as never), stockLib.foldSubagentDescriptor(none as never));
    expect(portLib.foldSubagentDescriptor(none as never)).toBeUndefined();
    const newer = [{ type: "subagent/descriptor", data: { ...oneShot, version: 99 } }];
    expectSameJson(portLib.foldSubagentDescriptor(newer as never), stockLib.foldSubagentDescriptor(newer as never));
    expect(portLib.foldSubagentDescriptor(newer as never)).toBeUndefined();
    const supported = [{ type: "subagent/descriptor", data: continuable }];
    expectSameJson(portLib.foldSubagentDescriptor(supported as never), stockLib.foldSubagentDescriptor(supported as never));
    expect(portLib.foldSubagentDescriptor(supported as never)).toEqual(continuable as never);
  });

  test("D4 fold: mọi payload hỏng cùng chuỗi lỗi", () => {
    const payloads: unknown[] = [
      null,
      7,
      { version: "3" },
      { version: 3, mode: "other", provider: "p" },
      { version: 3, mode: "one-shot", provider: "p", extra: 1 },
      { version: 3, mode: "continuable", provider: "p" },
      { version: 3, mode: "continuable", provider: "p", label: "l", agentProvider: 4 },
      { version: 3, mode: "continuable", provider: "p", label: "l", toolFilter: 4 },
      { version: 3, mode: "continuable", provider: "p", label: "l", toolFilter: { allow: "read" } },
      { version: 3, mode: "continuable", provider: "p", label: "l", toolFilter: { allow: [1] } },
      { version: 3, mode: "continuable", provider: "p", label: "l", toolFilter: {} },
      { version: 3, mode: "continuable", provider: "p", label: "l", toolFilter: { allow: [], extra: [] } },
    ];
    for (const data of payloads) {
      const events = [{ type: "subagent/descriptor", data }];
      expectSameThrown(
        () => portLib.foldSubagentDescriptor(events as never),
        () => stockLib.foldSubagentDescriptor(events as never),
      );
    }
    expectSameJson(
      captureThrown(() => portLib.foldSubagentDescriptor([{ type: "subagent/descriptor", data: payloads[4] }] as never)),
      { name: "Error", message: 'persisted subagent descriptor payload has unknown field "extra"' },
    );
  });
});

describe("child-agent", () => {
  test("C1 resolveChildDepth: header là sàn đơn điệu, maxDepth và miền an toàn", () => {
    expectSameJson(
      portLib.resolveChildDepth(mkParent({ delegationDepth: 2 }), undefined),
      stockChild.resolveChildDepth(mkParent({ delegationDepth: 2 }), undefined),
    );
    expect(portLib.resolveChildDepth(mkParent({ delegationDepth: 2 }), undefined)).toBe(3);
    expectSameJson(
      portLib.resolveChildDepth(mkParent({ delegationDepth: 2, runtimeDepth: 7 }), undefined),
      stockChild.resolveChildDepth(mkParent({ delegationDepth: 2, runtimeDepth: 7 }), undefined),
    );
    expect(portLib.resolveChildDepth(mkParent({ delegationDepth: 2, runtimeDepth: 7 }), undefined)).toBe(8);
    expectSameThrown(
      () => portLib.resolveChildDepth(mkParent({ delegationDepth: 2 }), 2),
      () => stockChild.resolveChildDepth(mkParent({ delegationDepth: 2 }), 2),
    );
    expectSameJson(
      captureThrown(() => portLib.resolveChildDepth(mkParent({ delegationDepth: 2 }), 2)),
      { name: "SubagentDepthError", message: "subagent depth 3 exceeds maxDepth 2", attemptedDepth: 3, maxDepth: 2 },
    );
    expectSameThrown(
      () => portLib.resolveChildDepth(mkParent({ delegationDepth: Number.MAX_SAFE_INTEGER }), undefined),
      () => stockChild.resolveChildDepth(mkParent({ delegationDepth: Number.MAX_SAFE_INTEGER }), undefined),
    );
    expectSameJson(
      captureThrown(() => portLib.resolveChildDepth(mkParent({ delegationDepth: Number.MAX_SAFE_INTEGER }), undefined)),
      { name: "RangeError", message: "subagent child depth exceeds the safe-integer range" },
    );
    expectSameThrown(
      () => portLib.resolveChildDepth(mkParent({ runtimeDepth: 1.5 }), undefined),
      () => stockChild.resolveChildDepth(mkParent({ runtimeDepth: 1.5 }), undefined),
    );
    expectSameJson(
      captureThrown(() => portLib.resolveChildDepth(mkParent({ runtimeDepth: 1.5 }), undefined)),
      { name: "TypeError", message: "agent subagentDepth must be a non-negative safe integer" },
    );
  });

  test("C4 childSessionMeta: preset sống của cha, chọn độc lập, cwd tuỳ chọn", () => {
    const live = () => mkParent({
      cwd: "/tmp/work",
      delegationDepth: 1,
      services: { agentPresets: { composedPreset: () => "live-preset" } },
    });
    const cases = [
      { parent: live(), selected: undefined },
      { parent: live(), selected: "explicit" },
      { parent: mkParent(), selected: undefined },
    ];
    for (const value of cases) {
      expectSameJson(
        portLib.childSessionMeta(value.parent, 3, true, value.selected),
        stockChild.childSessionMeta(value.parent, 3, true, value.selected),
      );
    }
    expect(portLib.childSessionMeta(live(), 3, true)).toEqual({
      cwd: "/tmp/work",
      agentPreset: "live-preset",
      parentSession: "parent-1",
      isSeeded: true,
      origin: "subagent",
      delegationDepth: 3,
    } as never);
    expect(portLib.childSessionMeta(mkParent(), 0, false)).toEqual({
      parentSession: "parent-1",
      isSeeded: false,
      origin: "subagent",
      delegationDepth: 0,
    } as never);
  });

  test("C5 captureDelegatedPolicyOverrides + appendDelegatedPolicyOverrides", () => {
    const policyCases = [
      { permissionPresets: { current: () => "auto" }, sandboxPolicy: { overrideOf: () => "workspace-write" }, approval: {} },
      { permissionPresets: { current: () => "danger-full-access" } },
      { permissionPresets: { current: () => "ask" }, sandboxPolicy: { overrideOf: () => undefined }, approval: {} },
      {},
    ];
    for (const services of policyCases) {
      expectSameJson(
        portLib.captureDelegatedPolicyOverrides(mkParent({ services })),
        stockChild.captureDelegatedPolicyOverrides(mkParent({ services })),
      );
    }
    expect(portLib.captureDelegatedPolicyOverrides(mkParent({ services: policyCases[0] }))).toEqual({
      permissionPreset: "auto",
      sandboxMode: "workspace-write",
      approvalPolicy: "never",
    });
    const append = (module: Pick<PortIndex, "appendDelegatedPolicyOverrides">) => {
      const target = recordingSession();
      module.appendDelegatedPolicyOverrides(target.session, {
        permissionPreset: "auto",
        sandboxMode: "workspace-write",
        approvalPolicy: "never",
      } as never);
      module.appendDelegatedPolicyOverrides(target.session, { permissionPreset: "danger-full-access" } as never);
      return target.calls;
    };
    expectSameJson(append(portLib), append(stockChild));
    expect(append(portLib)).toEqual([
      { type: "sandbox/mode", data: { mode: "workspace-write", source: "delegation" } },
      { type: "approval/policy", data: { policy: "never", source: "delegation" } },
      { type: "permission/preset", data: { preset: "auto" } },
      { type: "permission/preset", data: { preset: "danger-full-access" } },
    ]);
  });
});

describe("catalog", () => {
  test("K1 establishCatalogChild + establishExternalCatalogChild", () => {
    const child = { id: "child-1", createdAt: 123 } as never;
    const run = (module: typeof PortCatalog) => {
      const parent = recordingSession();
      module.establishCatalogChild(parent.session, child, { mode: "continuable", label: "label-1" });
      return parent.calls;
    };
    expectSameJson(run(portCatalog), run(stockCatalog));
    expect(run(portCatalog)).toEqual([{
      type: "subagent/catalog",
      data: { version: 0, childId: "child-1", childCreatedAt: 123, mode: "continuable", label: "label-1" },
    }]);
    const realNow = Date.now;
    Date.now = () => 1_700_000_000_000;
    try {
      const external = (module: typeof PortCatalog) => {
        const parent = recordingSession();
        module.establishExternalCatalogChild(parent.session, "external-1" as never, "ext-label");
        return parent.calls;
      };
      expectSameJson(external(portCatalog), external(stockCatalog));
      expect(external(portCatalog)).toEqual([{
        type: "subagent/catalog",
        data: { version: 2, childId: "external-1", childCreatedAt: 1_700_000_000_000, mode: "external", label: "ext-label" },
      }]);
    }
    finally {
      Date.now = realNow;
    }
  });

  test("K2 projection: init, apply (mốc thừa kế + fact lạ), view", () => {
    const header = { id: "parent-1" } as never;
    const definition = portCatalog.subagentCatalogProjectionDefinition;
    const stockDefinition = stockCatalog.subagentCatalogProjectionDefinition;
    const init = definition.init(header, 7 as never);
    expectSameJson(init, stockDefinition.init(header, 7 as never));
    expect(init).toEqual({ inheritedEventCount: 7 } as never);
    const before = { type: "subagent/catalog", seq: 6, data: { version: 0, childId: "early", childCreatedAt: 1, mode: "one-shot" } };
    expect(definition.apply(init, before as never)).toBe(init);
    const unrelated = { type: "turn/end", seq: 9, data: {} };
    expect(definition.apply(init, unrelated as never)).toBe(init);
    const events = [
      { type: "subagent/catalog", seq: 7, data: { version: 0, childId: "c1", childCreatedAt: 1, mode: "continuable", label: "L" } },
      { type: "subagent/catalog", seq: 8, data: { version: 1, childId: "c2", childCreatedAt: 2, mode: "unknown" } },
      { type: "subagent/catalog", seq: 9, data: { version: 2, childId: "c3", childCreatedAt: 3, mode: "external", label: "E" } },
      { type: "subagent/catalog", seq: 10, data: { version: 0, childId: "c4", childCreatedAt: 4, mode: "one-shot" } },
    ];
    let portState = init;
    let stockState = stockDefinition.init(header, 7 as never);
    for (const event of events) {
      portState = definition.apply(portState, event as never);
      stockState = stockDefinition.apply(stockState, event as never);
    }
    expectSameJson(portState, stockState);
    expectSameJson(definition.wire.view(portState), stockDefinition.wire.view(stockState));
    expect(definition.wire.view(portState)).toEqual([
      { id: "c1", createdAt: 1, mode: "continuable", label: "L" },
      { id: "c2", createdAt: 2, mode: "unknown" },
      { id: "c3", createdAt: 3, mode: "external", label: "E" },
      { id: "c4", createdAt: 4, mode: "one-shot" },
    ] as never);
  });

  test("K3 projection: fact hỏng của chính gói làm hỏng khôi phục", () => {
    const state = portCatalog.subagentCatalogProjectionDefinition.init({} as never, 0 as never);
    const badPayloads: unknown[] = [
      { version: 0, childId: "c1", childCreatedAt: 1, mode: "one-shot", extra: 1 },
      { version: 0, childId: 5, childCreatedAt: 1, mode: "one-shot" },
      { version: 9, childId: "c1", childCreatedAt: 1, mode: "one-shot" },
      { version: 0, childId: "c1", childCreatedAt: -1, mode: "one-shot" },
    ];
    for (const data of badPayloads) {
      const event = { type: "subagent/catalog", seq: 0, data };
      expectSameThrown(
        () => portCatalog.subagentCatalogProjectionDefinition.apply(state, event as never),
        () => stockCatalog.subagentCatalogProjectionDefinition.apply(state, event as never),
      );
    }
  });
});

describe("activation", () => {
  test("A1 ActivationPool: giới hạn, mã lỗi, nhả luỹ đẳng", () => {
    const run = (module: typeof portActivation) => {
      const pool = new module.ActivationPool();
      const releaseOne = pool.reserve(2);
      const releaseTwo = pool.reserve(2);
      const third = captureThrown(() => pool.reserve(2));
      releaseOne();
      releaseOne();
      const replacement = pool.reserve(2);
      replacement();
      releaseTwo();
      const zero = captureThrown(() => new module.ActivationPool().reserve(0));
      return { third, zero, canReserveAfterRelease: captureThrown(() => pool.reserve(2)) };
    };
    expectSameJson(run(portActivation), run(stockActivation));
    expect(run(portActivation).third as ThrownShape).toEqual({
      name: "SubagentError",
      message: "subagent limit reached (active child limit: 2); wait for an existing child to finish or complete this work with the current agents",
      code: "ACTIVATION_LIMIT_REACHED",
    });
    expect(run(portActivation).zero as ThrownShape).toEqual({
      name: "SubagentError",
      message: "subagent limit reached (active child limit: 0); wait for an existing child to finish or complete this work with the current agents",
      code: "ACTIVATION_LIMIT_REACHED",
    });
  });

  test("A2 ChildLock: tuần tự theo con, lỗi không chặn đuôi", async () => {
    const run = async (module: typeof portActivation) => {
      const lock = new module.ChildLock();
      const order: string[] = [];
      const first = lock.run("c" as never, async () => {
        order.push("a-start");
        await Promise.resolve();
        order.push("a-end");
        return "A";
      });
      const second = lock.run("c" as never, async () => {
        order.push("b-start");
        order.push("b-end");
        return "B";
      });
      const other = lock.run("d" as never, async () => {
        order.push("c-start");
        return "C";
      });
      const results = await Promise.all([first, second, other]);
      const failure = await lock.run("c" as never, async () => {
        throw new Error("boom");
      }).catch((error: Error) => error.message);
      const after = await lock.run("c" as never, async () => {
        order.push("after");
        return "D";
      });
      return { results, failure, after, order };
    };
    expectSameJson(await run(portActivation), await run(stockActivation));
    expect(await run(portActivation)).toEqual({
      results: ["A", "B", "C"],
      failure: "boom",
      after: "D",
      order: ["a-start", "c-start", "a-end", "b-start", "b-end", "after"],
    });
  });

  test("A3 requireLocalActivation: local trả chính nó, external mã NOT_CONTINUABLE", () => {
    const local = { kind: "local", childId: "child-1" } as never;
    expect(portActivation.requireLocalActivation(local)).toBe(local);
    expect(stockActivation.requireLocalActivation(local)).toBe(local);
    expectSameThrown(
      () => portActivation.requireLocalActivation({ kind: "external", childId: "child-9" } as never),
      () => stockActivation.requireLocalActivation({ kind: "external", childId: "child-9" } as never),
    );
    expectSameJson(
      captureThrown(() => portActivation.requireLocalActivation({ kind: "external", childId: "child-9" } as never)),
      { name: "SubagentError", message: 'subagent "child-9" does not accept follow-up input', code: "NOT_CONTINUABLE" },
    );
  });

  test("A4 captureLocalResult: 5 stopReason, failureAt, structured", () => {
    interface CaptureCase {
      readonly name: string;
      readonly events: unknown[];
      readonly failureAt?: number;
      readonly structured?: unknown;
    }
    const turnEvents = (reason: string): unknown[] => [
      { type: "turn/start", data: { turn: 1 } },
      { type: "step/start", data: { turn: 1 } },
      { type: "assistant/message", data: { message: { content: [textBlock("done")] }, stream: [] } },
      { type: "turn/end", data: { turn: 1, reason: { kind: reason } } },
    ];
    const cases: CaptureCase[] = [
      { name: "completed", events: turnEvents("completed") },
      { name: "aborted", events: turnEvents("aborted") },
      { name: "max-tokens", events: turnEvents("max-tokens") },
      { name: "refusal", events: turnEvents("blocked") },
      { name: "error", events: turnEvents("error") },
      { name: "no-events", events: [] },
      { name: "failure", events: turnEvents("completed"), failureAt: 2 },
      { name: "structured", events: turnEvents("completed"), structured: { captured: () => ({ value: { ok: true } }) } },
      { name: "structured-missing", events: turnEvents("completed"), structured: { captured: () => undefined } },
    ];
    const run = (module: typeof portActivation, value: CaptureCase) => module.captureLocalResult({
      kind: "local",
      childId: "child-1",
      handle: { agent: { session: { snapshotEvents: () => value.events } } },
      outputStart: 0,
      structured: value.structured,
      failureAt: value.failureAt,
    } as never);
    for (const value of cases) {
      expectSameJson(run(portActivation, value), run(stockActivation, value));
    }
    expect(run(portActivation, cases[0]!)).toEqual({ output: [textBlock("done")], stopReason: "completed" });
    expect(run(portActivation, cases[5]!)).toEqual({ output: [], stopReason: "completed" });
    expect(run(portActivation, cases[6]!)).toEqual({ output: [textBlock("done")], stopReason: "error" });
    expect(run(portActivation, cases[7]!)).toEqual({ output: [textBlock("done")], stopReason: "completed", structured: { ok: true } });
    expect(run(portActivation, cases[8]!)).toEqual({ output: [textBlock("done")], stopReason: "error" });
  });
});

describe("continuation-messages", () => {
  /** Bỏ id ngẫu nhiên của thư để so phần tất định. */
  function withoutId(message: ReturnType<typeof portContinuation.createSettlementMessage>): Record<string, unknown> {
    const { id: _id, ...rest } = message;
    return rest;
  }
  const reasons = ["completed", "aborted", "max-tokens", "refusal", "error", "unknown"];
  /** Kết quả kết thúc giả với một lý do dừng. */
  const terminal = (stopReason: string): never => ({ output: [textBlock("done")], stopReason } as never);

  test("M1 createAgentMessage + withContinuableReturnGuidance", () => {
    const sender = { id: "sender-1" } as never;
    const port = portContinuation.createAgentMessage(sender, [textBlock("hello")] as never);
    const stock = stockContinuation.createAgentMessage(sender, [textBlock("hello")] as never);
    expectSameJson(withoutId(port), withoutId(stock));
    expect(withoutId(port)).toEqual({
      role: "user",
      content: [textBlock("Agent sender-1 sent a message: "), textBlock("hello")],
      source: { kind: "agent-message", form: "relay", senderSessionId: "sender-1" },
    });
    const guidance = portContinuation.withContinuableReturnGuidance("parent-1" as never, [textBlock("task")]);
    expectSameJson(guidance, stockContinuation.withContinuableReturnGuidance("parent-1" as never, [textBlock("task")]));
    expect((guidance[1] as { readonly text: string }).text).toContain('Your parent agent id is "parent-1"');
  });

  test("M2 createSettlementMessage: 6 stopReason × continuable true/false", () => {
    for (const continuable of [true, false]) {
      for (const reason of reasons) {
        const port = portContinuation.createSettlementMessage("child-1" as never, terminal(reason), continuable);
        const stock = stockContinuation.createSettlementMessage("child-1" as never, terminal(reason), continuable);
        expectSameJson(withoutId(port), withoutId(stock));
      }
    }
    const done = portContinuation.createSettlementMessage("child-1" as never, terminal("completed"), true);
    expect(done.content[0]).toEqual(textBlock("Background subagent child-1 finished and will do no further work unless you send it more."));
    const stopped = portContinuation.createSettlementMessage("child-1" as never, terminal("completed"), false);
    expect(stopped.content[0]).toEqual(textBlock("Background subagent child-1 finished. It cannot receive follow-up messages."));
  });
});

describe("assistant-output", () => {
  test("F1 finalAssistantOutput: message khác rỗng cuối, dự phòng stream", () => {
    const message = (content: unknown[], stream: unknown[] = []) => ({ type: "assistant/message", data: { message: { content }, stream } });
    const attempt = (stream: unknown[]) => ({ type: "assistant/attempt", data: { stream } });
    const cases: unknown[][] = [
      [],
      [message([textBlock("first")]), message([textBlock("last")])],
      [message([textBlock("kept")]), message([])],
      [message([], [{ type: "text-chunks", index: 0, texts: ["fallback"] }])],
      [attempt([{ type: "chunk", chunk: { type: "text-delta", text: "att" } }])],
      [message([], [{ type: "text-chunks", index: 0, texts: ["a", "b"] }]), attempt([{ type: "chunk", chunk: { type: "text-delta", text: "c" } }])],
    ];
    for (const events of cases) {
      expectSameJson(portLib.finalAssistantOutput(events as never), stockLib.finalAssistantOutput(events as never));
    }
    expect(portLib.finalAssistantOutput(cases[0] as never)).toBeUndefined();
    expect(portLib.finalAssistantOutput(cases[1] as never)).toEqual([textBlock("last")]);
    expect(portLib.finalAssistantOutput(cases[2] as never)).toEqual([textBlock("kept")]);
    expect(portLib.finalAssistantOutput(cases[3] as never)).toEqual([textBlock("fallback")]);
    expect(portLib.finalAssistantOutput(cases[4] as never)).toEqual([textBlock("att")]);
    expect(portLib.finalAssistantOutput(cases[5] as never)).toEqual([textBlock("abc")]);
  });

  test("F2 AssistantOutputFold: push/pushText/collect tăng dần", () => {
    const run = (module: PortIndex) => {
      const fold = new module.AssistantOutputFold();
      fold.pushText("");
      fold.push({ type: "assistant/attempt", data: { stream: [{ type: "chunk", chunk: { type: "text-delta", text: "a" } }] } } as never);
      fold.pushText("b");
      const beforeMessage = fold.collect();
      fold.push({ type: "assistant/message", data: { message: { content: [textBlock("final")] }, stream: [] } } as never);
      fold.push({ type: "assistant/message", data: { message: { content: [] }, stream: [] } } as never);
      return { beforeMessage, afterMessage: fold.collect() };
    };
    expectSameJson(run(portLib), run(stockLib));
    expect(run(portLib)).toEqual({ beforeMessage: [textBlock("ab")], afterMessage: [textBlock("final")] });
    expect(new portLib.AssistantOutputFold().collect()).toBeUndefined();
  });
});

describe("list-children", () => {
  test("L1 listChildren + listDescendants: entries, lỗi, huỷ, phân loại", async () => {
    const noQuery = await captureRejection(() => portList.listChildren(mkListContext({}), "p" as never));
    expect(noQuery).toEqual({
      name: "SubagentError",
      message: "listing subagents requires the sessionQuery service (load @deepseek-ai/dsh-session-query)",
      code: "SUBAGENT_CONTROL_QUERY_UNAVAILABLE",
    });
    await expectSameRejection(
      () => portList.listChildren(mkListContext({}), "p" as never),
      () => stockList.listChildren(mkListContext({}), "p" as never),
    );
    const runChildren = async (module: typeof portList) => {
      let disposed = 0;
      const query = {
        observeSession: async () => mkObservation({
          projections: { values: { subagentCatalog: [{ id: "c1", createdAt: 1, mode: "one-shot" }] } },
          onDispose: () => { disposed += 1; },
        }),
      };
      const entries = await module.listChildren(mkListContext({ sessionQuery: query }), "parent-1" as never);
      return { entries, disposed };
    };
    expectSameJson(await runChildren(portList), await runChildren(stockList));
    expect(await runChildren(portList)).toEqual({ entries: [{ id: "c1", createdAt: 1, mode: "one-shot" }], disposed: 1 } as never);
    const tree: Record<string, unknown[]> = {
      root: [
        { id: "c1", createdAt: 1, mode: "continuable", label: "one" },
        { id: "c2", createdAt: 2, mode: "unknown" },
        { id: "c3", createdAt: 3, mode: "external", label: "ext" },
      ],
      c1: [{ id: "g1", createdAt: 4, mode: "one-shot" }],
      c2: [],
    };
    const runTree = async (module: typeof portList) => {
      const query = { observeSession: async (id: string) => mkObservation({ projections: { values: { subagentCatalog: tree[id] ?? [] } } }) };
      const sessions = { get: (id: string): unknown => id === "c1" ? { id } : undefined };
      return module.listDescendants(mkListContext({ sessions, sessionQuery: query }), "root" as never);
    };
    expectSameJson(await runTree(portList), await runTree(stockList));
    expect(await runTree(portList)).toEqual([
      { id: "c1", mode: "continuable", label: "one", kind: "child", parentId: "root", depth: 1, activity: "running", hasChildren: true },
      { id: "g1", mode: "one-shot", kind: "child", parentId: "c1", depth: 2, activity: "inactive", hasChildren: false },
      { kind: "diagnostic", id: "c2", parentId: "root", depth: 1, reason: "unsupported" },
      { id: "c3", mode: "external", label: "ext", kind: "child", parentId: "root", depth: 1, activity: "inactive", hasChildren: false },
    ] as never);
    const noStore = await captureRejection(() => portList.listDescendants(mkListContext({}), "root" as never));
    expect(noStore).toEqual({
      name: "SubagentError",
      message: "listing subagents requires the session store (load @deepseek-ai/dsh-session)",
      code: "SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE",
    });
    const corrupt = Object.assign(new Error("corrupt"), { code: "SESSION_QUERY_CORRUPT_SESSION" });
    const errorContext = (error: unknown) => mkListContext({
      sessions: {},
      sessionQuery: {
        observeSession: async (id: string) => {
          if (id === "bad") throw error;
          return mkObservation({ projections: { values: { subagentCatalog: id === "root" ? [{ id: "bad", createdAt: 1, mode: "continuable", label: "b" }] : [] } } });
        },
      },
    });
    const runError = async (module: typeof portList, error: unknown) => module.listDescendants(errorContext(error), "root" as never);
    expectSameJson(await runError(portList, corrupt), await runError(stockList, corrupt));
    expect(await runError(portList, corrupt)).toEqual([{ kind: "diagnostic", id: "bad", parentId: "root", depth: 1, reason: "corrupt" }] as never);
    const controller = new AbortController();
    const cancelled = mkListContext({
      sessions: {},
      sessionQuery: { observeSession: async () => { controller.abort(); return mkObservation({ projections: { values: { subagentCatalog: [] } } }); } },
    });
    expectSameJson(
      await captureRejection(() => portList.listDescendants(cancelled, "root" as never, controller.signal)),
      { name: "SubagentError", message: "subagent listing was cancelled", code: "CANCELLED" },
    );
  });
});

describe("archive-admission", () => {
  test("R1 activity + stop: con cháu đang chạy, nhãn descriptor, huỷ và warn", async () => {
    const agents = [
      mkAgent("c1", "root", "subagent", "running"),
      mkAgent("idle", "root", "subagent", "idle"),
      mkAgent("fork", "root", undefined, "running"),
      mkAgent("g1", "c1", "subagent", "running"),
    ];
    const run = async (module: typeof portArchive, services: Record<string, unknown> = {}) => {
      const harness = mkArchiveHarness(module, agents, services);
      const rest = [{ kind: "terminal", items: [] }];
      const activity = await harness.listeners["workspace/session-activity"]!({ sessionId: "root" }, async () => rest);
      return { activity, warnings: harness.warnings };
    };
    expectSameJson(await run(portArchive), await run(stockArchive));
    expect((await run(portArchive)).activity).toEqual([
      { kind: "subagent", items: [{ id: "c1" }, { id: "g1" }] },
      { kind: "terminal", items: [] },
    ]);
    const query = {
      observeSession: async () => mkObservation({
        events: [{ type: "subagent/descriptor", data: { version: 3, mode: "continuable", provider: "p", label: "nice" } }],
      }),
    };
    expectSameJson(await run(portArchive, { sessionQuery: query }), await run(stockArchive, { sessionQuery: query }));
    expect((await run(portArchive, { sessionQuery: query })).activity).toEqual([
      { kind: "subagent", items: [{ id: "c1", label: "nice" }, { id: "g1", label: "nice" }] },
      { kind: "terminal", items: [] },
    ]);
    const build = () => {
      const list = [
        mkAgent("c1", "root", "subagent", "running"),
        mkAgent("idle", "root", "subagent", "idle"),
        mkAgent("g1", "c1", "subagent", "running"),
        mkAgent("g2", "c1", "subagent", "running"),
      ];
      list[3]!.throwOnCancel = true;
      return list;
    };
    const stop = (module: typeof portArchive) => {
      const list = build();
      const harness = mkArchiveHarness(module, list);
      harness.listeners["workspace/session-stop"]!({ sessionId: "root" });
      return {
        agents: list.map(agent => ({ id: agent.id, cancelled: agent.cancelled, reason: agent.cancelReason })),
        warnings: harness.warnings,
      };
    };
    expectSameJson(stop(portArchive), stop(stockArchive));
    expect(stop(portArchive).warnings).toEqual(['subagent: cancelling "g2" for an archived Session failed: Error: cancel refused']);
  });
});

describe("out-of-process", () => {
  test("O1 NO_START_CAPABILITIES + assertPositiveFinite + assertUsableCwd", () => {
    expectSameJson(portLib.NO_START_CAPABILITIES, stockLib.NO_START_CAPABILITIES);
    expect(portLib.NO_START_CAPABILITIES).toEqual({ agentOptions: false, agentPreset: false, outputSchema: false, depthLimit: false });
    expect(Object.isFrozen(portLib.NO_START_CAPABILITIES)).toBe(true);
    for (const value of [1, 0.5, Number.MIN_VALUE]) {
      expect(captureThrown(() => portLib.assertPositiveFinite("pfx", "name", value))).toEqual({ ok: true });
    }
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectSameThrown(
        () => portLib.assertPositiveFinite("pfx", "name", value),
        () => stockLib.assertPositiveFinite("pfx", "name", value),
      );
    }
    expect(portLib.assertUsableCwd("pfx", "label", import.meta.dir)).toBe(import.meta.dir);
    for (const cwd of ["relative/path", "/definitely/not/here", "/etc/hosts"]) {
      expectSameThrown(
        () => portLib.assertUsableCwd("pfx", "label", cwd),
        () => stockLib.assertUsableCwd("pfx", "label", cwd),
      );
    }
    expectSameJson(
      captureThrown(() => portLib.assertUsableCwd("pfx", "label", "relative/path")),
      { name: "Error", message: "pfx: label must be an absolute path: relative/path" },
    );
  });

  test("O2 settleRunResult: kết lắng không bao giờ từ chối + trần chẩn đoán", async () => {
    const run = async (module: PortIndex, kind: string) => {
      const removed: string[] = [];
      const errors: unknown[] = [];
      let cancelled = false;
      let attempt: () => Promise<unknown> = async () => ({ output: [], stopReason: "completed" });
      let collectDiagnostic: (() => string | undefined) | undefined;
      let onError: ((error: Error, stopReason: string) => void) | undefined;
      if (kind === "ok-cancel") {
        attempt = async () => ({ output: [textBlock("done")], stopReason: "completed" });
        cancelled = true;
      }
      if (kind === "reject") {
        attempt = async () => { throw new Error("net down"); };
        collectDiagnostic = () => "trace";
        onError = (error, stopReason) => errors.push({ name: error.name, message: error.message, stopReason });
      }
      if (kind === "reject-nonerror") {
        attempt = async () => { throw "plain"; };
        onError = (error) => errors.push({ name: error.name, message: error.message });
      }
      if (kind === "reject-sink") {
        attempt = async () => { throw new Error("boom"); };
        onError = () => { throw new Error("sink"); };
      }
      const result = await module.settleRunResult({
        attempt,
        collectOutput: () => [textBlock("snapshot")],
        ...(collectDiagnostic === undefined ? {} : { collectDiagnostic }),
        cancelled: () => cancelled,
        ...(onError === undefined ? {} : { onError }),
        signal: { removeEventListener: (name: string) => removed.push(name) },
        onAbort: () => undefined,
      } as never);
      return { result, errors, removed };
    };
    for (const kind of ["ok", "ok-cancel", "reject", "reject-nonerror", "reject-sink"]) {
      expectSameJson(await run(portLib, kind), await run(stockLib, kind));
    }
    expect((await run(portLib, "ok-cancel")).result).toEqual({ output: [textBlock("snapshot")], stopReason: "aborted" });
    expect((await run(portLib, "reject")).errors).toEqual([{ name: "Error", message: "net down", stopReason: "error" }]);
    const settleWith = (module: PortIndex, diagnostic: string) => module.settleRunResult({
      attempt: async () => ({ output: [], stopReason: "completed", diagnostic }),
      collectOutput: () => [],
      cancelled: () => false,
      signal: { removeEventListener: () => undefined },
      onAbort: () => undefined,
    } as never);
    const long = "é".repeat(3000);
    expectSameJson(await settleWith(portLib, long), await settleWith(stockLib, long));
    const truncated = await settleWith(portLib, long);
    expect((truncated.diagnostic ?? "").endsWith("\n[diagnostic truncated]")).toBe(true);
    expect(new TextEncoder().encode(truncated.diagnostic ?? "").byteLength).toBeLessThanOrEqual(4096);
    expect((await settleWith(portLib, "a".repeat(4096))).diagnostic).toBe("a".repeat(4096));
  });
});

afterAll(() => rmSync(KERNEL_BUILD, { recursive: true, force: true }));
