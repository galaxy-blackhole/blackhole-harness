/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-sandbox-seam (SEAM trừu tượng, 289 dòng): mỗi ca so TRỰC TIẾP
 *      với bundle gốc @deepseek-ai/dsh-sandbox — 16 export, hằng số, marker hướng mô hình, escalation, gốc ghi
 *      được, chẩn đoán runner, dịch vụ `ctx.sandbox` trên Context cordis THẬT (đăng ký + DỌN DẸP khi unload)
 *      — cộng ca khai báo (KHÔNG gbh.row: seam consumer-inline) và ca trùng tên.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as oursModule from "../../packages/host/sandbox-seam/src/index.ts";
import { buildPackage } from "../../packages/host/sandbox-seam/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "sandbox-seam");
/** Gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sandbox");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context/Service. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context + Service THẬT của kernel. */
const { Context: ContextCtor, Service: ServiceCtor } = (await import(CORDIS)) as { Context: new () => object; Service: new (...args: never[]) => object };
/** Bản gốc nạp động. */
const stock = (await import(join(STOCK_DIR, "lib", "index.js"))) as typeof oursModule;
/** Bản của ta. */
const mine = oursModule;
/** Lớp HarnessError THẬT của KERNEL — lớp cơ sở mà bundle gốc thừa hưởng. */
const { HarnessError } = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"))) as { HarnessError: new (message: string, code: string) => Error };
/**
 * Lớp HarnessError mà CHÍNH package ta nạp (workspace) — lớp cơ sở của lớp lỗi phía ta.
 * `instanceof` so DANH TÍNH LỚP: hai cây cài để hai tệp riêng (nội dung y hệt) nên phải so theo TỪNG phía.
 */
const { HarnessError: OurHarnessError } = (await import(join(PKG, "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"))) as { HarnessError: new (message: string, code: string) => Error };

/** Đường dẫn ARTIFACT của ta. */
let artifact = "";
/** Thư mục tạm. */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-sandbox-seam-"));
  artifact = await buildPackage(outDir);
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn của tools/check/rows.ts.
 * Nhận: nội dung artifact.
 * Trả: mảng tên đã sắp xếp (gồm "default" nếu có).
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return [...out].sort();
}

/**
 * Chạy một hàm async và trả lỗi ném ra (null nếu không ném).
 * Nhận: run — hàm cần chạy.
 * Trả: lỗi, hoặc null.
 */
async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

/**
 * Trả lỗi ĐỒNG BỘ ném ra (null nếu không ném).
 * Nhận: run — hàm cần chạy.
 * Trả: lỗi, hoặc null.
 */
function thrownOf(run: () => void): unknown {
  try {
    run();
    return null;
  } catch (error) {
    return error;
  }
}

/** Một bộ hỏi duyệt giả ghi lại yêu cầu rồi trả kết luận định trước. */
interface Recorder {
  /** Các yêu cầu đã nhận. */
  requests: unknown[];
  /** Bộ hỏi duyệt để trao cho approveEscalation. */
  approver: { request(req: unknown): Promise<string> };
}

/**
 * Dựng bộ hỏi duyệt giả.
 * Nhận: outcome — kết luận sẽ trả.
 * Trả: bộ ghi + bộ hỏi duyệt.
 */
function recorderOf(outcome: string): Recorder {
  const requests: unknown[] = [];
  return { requests, approver: { request: async (req: unknown): Promise<string> => { requests.push(req); return outcome; } } };
}

describe("A. TẬP EXPORT trên ARTIFACT — ta phải BẰNG bản gốc (16 = 16)", () => {
  test("16 export BẰNG TỪNG TÊN, gồm cả `default`", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual([
      "ESCALATION_TARGETS", "SANDBOX_UNAVAILABLE", "SandboxProvider", "SandboxUnavailableError", "WIDER_MODES",
      "approveEscalation", "canonicalPath", "classifyRunnerFailure", "default", "escalationHintMarker",
      "isRunnerSpawnFailure", "matchesSignature", "sandboxDenialMarker", "sandboxPermissionsDescription",
      "validateEscalationArgs", "writableRoots",
    ]);
    expect(oursNames.length).toBe(16);
  });

  test("`default` LÀ SandboxProvider (y bản gốc) và artifact là ESM thư viện, không id trình duyệt", () => {
    expect(mine.default).toBe(mine.SandboxProvider);
    expect(stock.default).toBe(stock.SandboxProvider);
    const code = readFileSync(artifact, "utf8");
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect(/^import\s/m.test(code)).toBe(true);
    expect(code).toContain("@deepseek-ai/cordis");
    expect(code).toContain("@deepseek-ai/dsh-llm");
    expect(code).toContain("@deepseek-ai/dsh-util-values");
  });
});

describe("B. HẰNG SỐ — từ vựng cầm giữ và escalation BẰNG bản gốc", () => {
  test("SANDBOX_UNAVAILABLE · WIDER_MODES · ESCALATION_TARGETS", () => {
    expect(mine.SANDBOX_UNAVAILABLE).toBe(stock.SANDBOX_UNAVAILABLE);
    expect(mine.SANDBOX_UNAVAILABLE).toBe("SANDBOX_UNAVAILABLE");
    expect(mine.WIDER_MODES).toEqual(stock.WIDER_MODES);
    expect(mine.WIDER_MODES).toEqual({ "read-only": ["workspace-write", "danger-full-access"], "workspace-write": ["danger-full-access"] });
    expect(mine.ESCALATION_TARGETS).toEqual(stock.ESCALATION_TARGETS);
    expect(mine.ESCALATION_TARGETS).toEqual(["workspace-write", "danger-full-access"]);
  });
});

describe("C. MARKER hướng mô hình — BẰNG TỪNG KÝ TỰ", () => {
  test("marker từ chối cho cả 3 chế độ; gợi ý + mô tả tham số cho cả 2 danh từ", () => {
    for (const mode of ["read-only", "workspace-write", "danger-full-access"] as const) {
      expect(mine.sandboxDenialMarker(mode)).toBe(stock.sandboxDenialMarker(mode));
    }
    expect(mine.sandboxDenialMarker("read-only")).toBe("[sandbox: file access denied under read-only mode]");
    for (const subject of ["command", "operation"]) {
      expect(mine.escalationHintMarker(subject)).toBe(stock.escalationHintMarker(subject));
      expect(mine.sandboxPermissionsDescription(subject)).toBe(stock.sandboxPermissionsDescription(subject));
    }
    expect(mine.sandboxPermissionsDescription("command")).toContain("retry asks the user for approval");
  });
});

describe("D. validateEscalationArgs — cặp tham số escalation, BẰNG bản gốc", () => {
  test("5 tổ hợp: hợp lệ im lặng, sai thì NÉM CÙNG THÔNG ĐIỆP", () => {
    const cases: [string | undefined, string | undefined][] = [
      [undefined, undefined],
      ["workspace-write", "cần ghi trong workspace"],
      [undefined, "chỉ có lý do"],
      ["workspace-write", undefined],
      ["workspace-write", "   "],
    ];
    for (const [permissions, justification] of cases) {
      const oursError = thrownOf(() => mine.validateEscalationArgs(permissions, justification));
      const stockError = thrownOf(() => stock.validateEscalationArgs(permissions, justification));
      expect(String(oursError)).toBe(String(stockError));
    }
    expect(String(thrownOf(() => mine.validateEscalationArgs(undefined, "x")))).toContain("justification is only valid together");
    expect(String(thrownOf(() => mine.validateEscalationArgs("workspace-write", undefined)))).toContain("requires a justification");
    expect(String(thrownOf(() => mine.validateEscalationArgs("workspace-write", "  ")))).toContain("expected a non-empty sentence");
  });
});

describe("E. SandboxUnavailableError — lỗi ĐÓNG CỬA KHI HỎNG, BẰNG bản gốc", () => {
  test("thông điệp (không/kèm chi tiết), name, code, và instanceof HarnessError CHUNG của kernel", () => {
    const oursPlain = new mine.SandboxUnavailableError("read-only");
    const stockPlain = new stock.SandboxUnavailableError("read-only");
    expect(oursPlain.message).toBe(stockPlain.message);
    expect(oursPlain.message).toContain("refusing to run the command unconfined");
    const oursDetail = new mine.SandboxUnavailableError("workspace-write", "bwrap: Operation not permitted");
    const stockDetail = new stock.SandboxUnavailableError("workspace-write", "bwrap: Operation not permitted");
    expect(oursDetail.message).toBe(stockDetail.message);
    expect(oursDetail.message).toContain("Runner failure: bwrap: Operation not permitted");
    expect(oursDetail.name).toBe("SandboxUnavailableError");
    expect((oursDetail as unknown as { code: string }).code).toBe(stock.SANDBOX_UNAVAILABLE);
    // Lớp gốc THẬT (không phải bản sao lớp), so theo TỪNG phía vì repo có hai cây cài.
    expect(OurHarnessError.name).toBe(HarnessError.name);
    expect(Object.getPrototypeOf(OurHarnessError)).toBe(Object.getPrototypeOf(HarnessError));
    expect(oursDetail instanceof OurHarnessError).toBe(true);
    expect(stockDetail instanceof HarnessError).toBe(true);
  });
});

describe("F. DỊCH VỤ `sandbox` trên Context cordis THẬT — đăng ký, dùng, DỌN DẸP", () => {
  /** Provider tối thiểu dùng lớp của MỘT bên. */
  class ProbeProvider extends (mine.SandboxProvider as unknown as typeof ServiceCtor) {
    /** Số lần confine đã gọi. */
    confined = 0;
    /**
     * Bọc argv (giả lập cưỡng chế đầy đủ).
     * Nhận: argv — argv bên gọi; policy — chính sách lượt này.
     * Trả: argv đã bọc + mức đầy đủ.
     */
    async confine(argv: readonly string[], policy: { mode: string }): Promise<unknown> {
      this.confined += 1;
      return { argv: ["probe", policy.mode, ...argv], enforcement: "full", denialSignatures: [], runnerFailureRules: [] };
    }
  }

  test("đăng ký tên `sandbox`, confine chạy được, và UNLOAD plugin thì service BIẾN MẤT (dọn dẹp)", async () => {
    const ctx = new ContextCtor() as { plugin(plugin: unknown): { dispose(): Promise<void> }; get(name: string): unknown };
    const fiber = ctx.plugin({ apply: (child: object): void => { new (ProbeProvider as unknown as new (c: object) => unknown)(child); } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const provider = ctx.get("sandbox") as { confine(argv: readonly string[], policy: { mode: string }): Promise<{ argv: string[] }> };
    expect(provider).toBeDefined();
    const confined = await provider.confine(["bash", "-c", "ls"], { mode: "read-only" });
    expect(confined.argv).toEqual(["probe", "read-only", "bash", "-c", "ls"]);
    await fiber.dispose();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ctx.get("sandbox")).toBeUndefined();
  });

  test("đăng ký HAI lần trên cùng fiber ⇒ cùng một lỗi của cordis ở cả hai bên", () => {
    const ctx = new ContextCtor();
    new (mine.SandboxProvider as unknown as new (c: object) => unknown)(ctx);
    const oursError = thrownOf(() => { new (mine.SandboxProvider as unknown as new (c: object) => unknown)(ctx); });
    expect(String(oursError)).toContain("service \"sandbox\" has been registered");
  });
});

describe("G. approveEscalation — chuỗi duyệt ĐÓNG-CỬA-KHI-HỎNG, BẰNG bản gốc", () => {
  /** Yêu cầu mẫu: từ read-only xin workspace-write. */
  const request = { requestedMode: "workspace-write", justification: "cần ghi file trong workspace", effectiveMode: "read-only" as const, subject: "command" };

  test("lặp lại chế độ hiệu lực ⇒ trả ngay, KHÔNG hỏi duyệt", async () => {
    const a = recorderOf("rejected");
    const b = recorderOf("rejected");
    const ours = await mine.approveEscalation({ ...request, requestedMode: "read-only" }, { approver: a.approver as never, agent: { id: "ag" }, callId: "call-1", toolName: "bash" });
    const stockMode = await stock.approveEscalation({ ...request, requestedMode: "read-only" }, { approver: b.approver as never, agent: { id: "ag" }, callId: "call-1", toolName: "bash" });
    expect(ours).toBe(stockMode);
    expect(ours).toBe("read-only");
    expect(a.requests.length).toBe(0);
    expect(b.requests.length).toBe(0);
  });

  test("allowed-once ⇒ cấp chế độ rộng hơn; YÊU CẦU DUYỆT BẰNG TỪNG TRƯỜNG (kể cả vi + signal)", async () => {
    const controller = new AbortController();
    const a = recorderOf("allowed-once");
    const b = recorderOf("allowed-once");
    const approvalOf = (recorder: Recorder): never => ({ approver: recorder.approver, agent: { id: "ag" }, callId: "call-9", toolName: "bash", signal: controller.signal }) as never;
    const ours = await mine.approveEscalation(request, approvalOf(a));
    const stockMode = await stock.approveEscalation(request, approvalOf(b));
    expect(ours).toBe(stockMode);
    expect(ours).toBe("workspace-write");
    expect(a.requests).toEqual(b.requests);
    const asked = a.requests[0] as { reason: string; displayReason: { en: string; zh: string }; signal?: AbortSignal; toolName: string; callId: string };
    expect(asked.reason).toBe("escalate sandbox to workspace-write: cần ghi file trong workspace");
    expect(asked.displayReason.en).toBe("Allow this operation with workspace-write permissions: cần ghi file trong workspace");
    expect(asked.displayReason.zh).toBe("允许本次操作使用 workspace-write 权限：cần ghi file trong workspace");
    expect(asked.toolName).toBe("bash");
    expect(asked.callId).toBe("call-9");
    expect(asked.signal).toBe(controller.signal);
  });

  test("mọi kết luận KHÔNG cấp phép + thiếu nguyên liệu ⇒ lỗi BẰNG NHAU", async () => {
    const agent = { id: "ag" };
    const cases: { approval: Record<string, unknown>; outcome?: string }[] = [
      { approval: { agent, callId: "c", toolName: "bash" }, outcome: "allowed-once" },
      { approval: { approver: recorderOf("allowed-once").approver, callId: "c", toolName: "bash" }, outcome: "allowed-once" },
      { approval: { approver: recorderOf("weird").approver, agent, callId: "c", toolName: "bash" } },
    ];
    for (const { approval, outcome } of cases) {
      const first = outcome === undefined ? approval : { ...approval, approver: recorderOf(outcome).approver };
      const oursError = await failureOf(() => mine.approveEscalation(request, first as never));
      const stockError = await failureOf(() => stock.approveEscalation(request, first as never));
      expect(String(oursError)).toBe(String(stockError));
    }
    for (const outcome of ["rejected", "cancelled", "unavailable", "weird"]) {
      const oursError = await failureOf(() => mine.approveEscalation(request, { approver: recorderOf(outcome).approver as never, agent: { id: "ag" }, callId: "c", toolName: "bash" }));
      const stockError = await failureOf(() => stock.approveEscalation(request, { approver: recorderOf(outcome).approver as never, agent: { id: "ag" }, callId: "c", toolName: "bash" }));
      expect(String(oursError)).toBe(String(stockError));
    }
    const narrower = await failureOf(() => mine.approveEscalation({ ...request, effectiveMode: "workspace-write", requestedMode: "read-only" }, { approver: recorderOf("allowed-once").approver as never, agent: { id: "ag" }, callId: "c", toolName: "bash" }));
    expect(String(narrower)).toContain("is not strictly wider");
    expect(String(narrower)).toBe(String(await failureOf(() => stock.approveEscalation({ ...request, effectiveMode: "workspace-write", requestedMode: "read-only" }, { approver: recorderOf("allowed-once").approver as never, agent: { id: "ag" }, callId: "c", toolName: "bash" }))));
  });
});

describe("H. GỐC GHI ĐƯỢC — canonical + khử trùng, BẰNG bản gốc", () => {
  test("canonicalPath: đường CÓ THẬT (giải symlink) và đường KHÔNG có (giữ nguyên)", () => {
    expect(mine.canonicalPath(tmpdir())).toBe(stock.canonicalPath(tmpdir()));
    expect(mine.canonicalPath("/tmp")).toBe(stock.canonicalPath("/tmp"));
    const missing = "/khong-ton-tai-" + Date.now();
    expect(mine.canonicalPath(missing)).toBe(missing);
    expect(mine.canonicalPath(missing)).toBe(stock.canonicalPath(missing));
  });

  test("writableRoots: read-only RỖNG · workspace-write = workspace + /tmp + tmpdir, ĐÃ KHỬ TRÙNG", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "gbh-ws-"));
    try {
      expect(mine.writableRoots({ mode: "read-only", workspaceRoot: workspace })).toEqual([]);
      expect(mine.writableRoots({ mode: "read-only", workspaceRoot: workspace })).toEqual(stock.writableRoots({ mode: "read-only", workspaceRoot: workspace }));
      const ours = mine.writableRoots({ mode: "workspace-write", workspaceRoot: workspace });
      expect(ours).toEqual(stock.writableRoots({ mode: "workspace-write", workspaceRoot: workspace }));
      expect(ours).toContain(mine.canonicalPath(workspace));
      expect(ours).toContain(mine.canonicalPath("/tmp"));
      expect(new Set(ours).size).toBe(ours.length);
      // workspaceRoot CHÍNH LÀ /tmp ⇒ khử trùng còn 2 gốc, không phải 3.
      const deduped = mine.writableRoots({ mode: "workspace-write", workspaceRoot: "/tmp" });
      expect(deduped).toEqual(stock.writableRoots({ mode: "workspace-write", workspaceRoot: "/tmp" }));
      expect(deduped.length).toBeLessThanOrEqual(2);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe("I. CHẨN ĐOÁN runner — phân loại lỗi spawn + chữ ký stderr, BẰNG bản gốc", () => {
  test("classifyRunnerFailure: mã thoát, cổng exit-code, dòng thông tin bị loại, chữ ký không phân biệt hoa thường", () => {
    const rules = [
      { fatalSignatures: ["Operation not permitted"], informationalLines: ["bwrap: note"] },
      { allowedExitCodes: [3], fatalSignatures: ["sandbox-exec: invalid profile"] },
    ];
    const cases: [number | null, string][] = [
      [null, "Operation not permitted"],
      [0, "Operation not permitted"],
      [1, "bwrap: note"],
      [1, "bwrap: OPERATION NOT PERMITTED"],
      [4, "sandbox-exec: invalid profile"],
      [5, "nothing to see"],
    ];
    for (const [code, stderr] of cases) {
      expect(mine.classifyRunnerFailure(code, stderr, rules as never)).toEqual(stock.classifyRunnerFailure(code, stderr, rules as never));
    }
    expect(mine.classifyRunnerFailure(1, "bwrap: OPERATION NOT PERMITTED", rules as never)).toEqual({ detail: "bwrap: OPERATION NOT PERMITTED" });
  });

  test("matchesSignature: chỉ mã thoát KHÁC 0, không phân biệt hoa thường", () => {
    const cases: [number | null, string][] = [[null, "erofs"], [0, "erofs"], [1, "EROFS"], [1, "khác"]];
    for (const [code, stderr] of cases) {
      expect(mine.matchesSignature(code, stderr, ["erofs", "EPERM"])).toBe(stock.matchesSignature(code, stderr, ["erofs", "EPERM"]));
    }
  });

  test("isRunnerSpawnFailure: đúng argv[0] + syscall, cwd DÙNG ĐƯỢC, mã EACCES/ENOENT", () => {
    const workdir = tmpdir();
    const cases: { error: unknown; program?: string; dir: string }[] = [
      { error: { code: "ENOENT", syscall: "spawn /usr/bin/bwrap" }, program: "/usr/bin/bwrap", dir: workdir },
      { error: { code: "EACCES", syscall: "spawn", path: "/usr/bin/bwrap" }, program: "/usr/bin/bwrap", dir: workdir },
      { error: { code: "EACCES", syscall: "spawn", path: "/usr/bin/khac" }, program: "/usr/bin/bwrap", dir: workdir },
      { error: { code: "ENOENT", syscall: "spawn /usr/bin/khac" }, program: "/usr/bin/bwrap", dir: workdir },
      { error: { code: "EIO", syscall: "spawn /usr/bin/bwrap" }, program: "/usr/bin/bwrap", dir: workdir },
      { error: { code: "ENOENT", syscall: "spawn /usr/bin/bwrap" }, program: "/usr/bin/bwrap", dir: join(workdir, "khong-co-" + Date.now()) },
      { error: { code: "ENOENT", syscall: "spawn /usr/bin/bwrap" }, dir: workdir },
      { error: "khong phai object", program: "/usr/bin/bwrap", dir: workdir },
    ];
    for (const item of cases) {
      expect(mine.isRunnerSpawnFailure(item.error, item.program, item.dir)).toBe(stock.isRunnerSpawnFailure(item.error, item.program, item.dir));
    }
    expect(mine.isRunnerSpawnFailure({ code: "ENOENT", syscall: "spawn /usr/bin/bwrap" }, "/usr/bin/bwrap", workdir)).toBe(true);
    expect(mine.isRunnerSpawnFailure({ code: "EIO", syscall: "spawn /usr/bin/bwrap" }, "/usr/bin/bwrap", workdir)).toBe(false);
  });
});

describe("J. KHAI BÁO — SEAM consumer-inline: KHÔNG gbh.row, không mount", () => {
  test("package.json: tên/main/peers; KHÔNG gbh.row + lý do; gbh.peers ⊆ peerDependencies", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name: string; main: string; exports?: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: string; draft?: string };
    };
    expect(meta.name).toBe("@galaxy-blackhole/gbh-sandbox-seam");
    expect(meta.main).toBe("lib/index.js");
    expect(meta.exports?.["./client"]).toBeUndefined();
    expect(meta.gbh?.row).toBeUndefined();
    // task-165 (20/10/2026): park → draft (Lead duyệt B) — seam không có row để mount.
    expect(meta.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(meta.gbh?.draft).toContain("Thư viện/seam thuần");
    const contract = new Set(Object.keys(meta.peerDependencies ?? {}));
    expect((meta.gbh?.peers ?? []).filter((peer) => !contract.has(peer))).toEqual([]);
    expect([...contract].sort()).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-util-values"]);
  });

  test("ĐO: không row nào trỏ tới seam (matrix: row `sandbox` là dsh-sandbox-local) và consumer import INLINE", () => {
    const matrix = readFileSync(join(REPO, "docs", "PARITY-MATRIX.md"), "utf8");
    expect(/\| `sandbox` \| `@deepseek-ai\/dsh-sandbox-local` \|/.test(matrix)).toBe(true);
    const dumps = join(REPO, ".parity", "dumps");
    if (existsSync(dumps)) {
      const latest = readdirSync(dumps).sort().pop() as string;
      const yml = readFileSync(join(dumps, latest, "ours.yml"), "utf8");
      expect(yml.includes("name: '@deepseek-ai/dsh-sandbox'")).toBe(false);
    }
    const consumers: string[] = [];
    /**
     * Duyệt cây packages tìm nơi import seam GỐC (consumer inline).
     * Nhận: dir — thư mục cần duyệt.
     * Trả: không (ghi vào consumers).
     */
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "lib") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".ts")) continue;
        if (full.includes("sandbox-seam")) continue;
        if (/from\s+"@deepseek-ai\/dsh-sandbox"/.test(readFileSync(full, "utf8"))) consumers.push(full.slice(REPO.length + 1));
      }
    };
    walk(join(REPO, "packages"));
    expect(consumers.length).toBeGreaterThanOrEqual(5);
    expect(consumers.some((file) => file.startsWith("packages/host/sandbox/src/"))).toBe(true);
    expect(consumers.some((file) => file.startsWith("packages/host/sandbox-seam/"))).toBe(false);
  });
});

describe("K. TRÙNG TÊN — chỉ MỘT nhà cho seam trong repo", () => {
  test("chỉ gói này export SANDBOX_UNAVAILABLE / SandboxProvider", () => {
    const found: string[] = [];
    /**
     * Duyệt cây packages tìm khai báo seam thứ hai.
     * Nhận: dir — thư mục cần duyệt.
     * Trả: không (ghi vào found).
     */
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "lib") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".ts")) continue;
        const text = readFileSync(full, "utf8");
        if (/export\s+const\s+SANDBOX_UNAVAILABLE\b/.test(text) || /export\s+abstract\s+class\s+SandboxProvider\b/.test(text)) found.push(full.slice(REPO.length + 1));
      }
    };
    walk(join(REPO, "packages"));
    expect(found).toEqual(["packages/host/sandbox-seam/src/index.ts"]);
  });
});
