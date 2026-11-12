/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-workflow: đo trên ARTIFACT đã build, so TẬP
 *      EXPORT với chính bundle gốc, so hành vi phát sự kiện + lỗi với bundle gốc trên Context
 *      cordis THẬT, và khẳng định quy ước khai peer gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ours, { WorkflowEngine, WorkflowError, WorkflowRunId, isFatalWorkflowError } from "../../packages/host/workflow/src/index.ts";
import { buildPackage } from "../../packages/host/workflow/build.ts";
import { peerRangeProblems } from "./peer-range-harness.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "workflow");
/** cordis của CHÍNH package ta (bản cài riêng — khác lớp Context với bản của apps/host). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workflow", "lib", "index.js");
/** Từ vựng an toàn-browser của bản gốc — đối chứng cho đầu ra `lib/types.js` của ta. */
const STOCK_TYPES = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workflow", "lib", "types", "types.js");
/** cordis mà chính bundle gốc nạp — phải dùng đúng bản này mới dựng được service gốc. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Thân sự kiện mẫu — đúng hình dạng mà engine thật phát đi. */
const RUN_INFO = { id: WorkflowRunId("11111111-2222-3333-4444-555555555555"), meta: { name: "demo", description: "chay demo" } };

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/** Một lượt ghi nhận: tên sự kiện + thân đã nhận, và các cảnh báo logger đã bắt. */
interface Recorder {
  /** Vết "tên sự kiện|thân" theo đúng thứ tự người nghe chạy. */
  calls: string[];
  /** Mọi lượt gọi `logger.warn` (đã ghép thành chuỗi). */
  warns: string[];
  /** Context cordis đã dựng. */
  ctx: any;
  /** Thực thể engine đã cắm vào context. */
  engine: any;
}

/**
 * Dựng một engine trên Context cordis THẬT với logger bắt được.
 * Nhận: lớp engine (ta hoặc gốc), lớp Context của ĐÚNG bản cordis mà lớp đó nạp, và lớp con cụ thể
 * (vì `WorkflowEngine` là lớp TRỪU TƯỢNG — bản gốc cũng không cài `start`).
 * Trả: bản ghi gồm context, thực thể engine và hai vết.
 */
function bootEngine(EngineClass: abstract new (ctx: any) => any, ContextCtor: any): Recorder {
  const ctx = new ContextCtor();
  class Concrete extends EngineClass {
    /** Bản gốc để `start` trừu tượng; test không chạy nó nên chỉ cần đúng chữ ký. */
    start(): never {
      throw new Error("start() khong thuoc pham vi test nay");
    }
  }
  const engine = new Concrete(ctx);
  const warns: string[] = [];
  ctx.logger.warn = (...parts: unknown[]): void => {
    warns.push(parts.map((part) => String(part)).join(" "));
  };
  return { calls: [], warns, ctx, engine };
}

/**
 * Gắn một người nghe ghi vết cho một sự kiện `workflow/*`.
 * Nhận: bản ghi và tên sự kiện.
 * Trả: mảng đích của người nghe đó (đẩy vào để so thứ tự).
 */
function listen(recorder: Recorder, name: string): string[] {
  const own: string[] = [];
  recorder.ctx.on(name, (...args: unknown[]): void => {
    own.push(JSON.stringify(args));
    recorder.calls.push(name + "|" + JSON.stringify(args));
  });
  return own;
}

describe("row workflow — ARTIFACT và bề mặt export", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, và 0 id module", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — nên cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact: any = await import(file);
    const stock: any = await import(STOCK);
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["WorkflowEngine", "WorkflowError", "WorkflowRunId", "default", "isFatalWorkflowError"]);
    // Artifact là MỘT bản cài khác nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.WorkflowEngine);
    expect(stock.default).toBe(stock.WorkflowEngine);
    expect(artifact.default.name).toBe("WorkflowEngine");
    expect(stock.default.name).toBe("WorkflowEngine");
    expect(Object.getOwnPropertyNames(artifact.WorkflowEngine.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.WorkflowEngine.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(artifact.WorkflowEngine.prototype).sort()).toEqual(["constructor", "emitWorkflowEvent"]);
    // Lớp TRỪU TƯỢNG: bản gốc KHÔNG cài `start` trên prototype — ta cũng vậy (đừng "tiện tay" cài).
    expect(artifact.WorkflowEngine.prototype.start).toBeUndefined();
    expect(stock.WorkflowEngine.prototype.start).toBeUndefined();
    expect(Object.getOwnPropertyNames(artifact.WorkflowError.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.WorkflowError.prototype).sort(),
    );
    // Đầu ra `./types` (từ vựng an toàn-browser) phải có mặt và khớp tập export với bản gốc.
    const typesArtifact: any = await import(join(OUT, "types.js"));
    const stockTypes: any = await import(STOCK_TYPES);
    expect(Object.keys(typesArtifact).sort()).toEqual(Object.keys(stockTypes).sort());
    expect(Object.keys(typesArtifact)).toEqual(["WorkflowRunId"]);
  });

  test("WorkflowRunId: hàm đồng nhất — trả CHÍNH chuỗi vào, y bản gốc", () => {
    const raw = "8f14e45f-ceea-467f-a8b5-0d3f0a2b6c11";
    // Ép kiểu hiển thị về `string` khi so: dấu `Branded` chỉ tồn tại lúc biên dịch, còn giá trị
    // lúc chạy phải là CHÍNH chuỗi đó (bản gốc cũng là hàm đồng nhất).
    expect<string>(WorkflowRunId(raw)).toBe(raw);
    expect(typeof WorkflowRunId(raw)).toBe("string");
    expect<string>(WorkflowRunId("")).toBe("");
  });

  test("WorkflowError: tên/mã/cờ fatal/chuỗi y bản gốc, và LÀ HarnessError của kernel", async () => {
    const stock: any = await import(STOCK);
    const harness: any = await import(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"));
    // Đo trên ARTIFACT (thứ được ship), dựng trong thư mục tạm có symlink @deepseek-ai của KERNEL
    // (pattern tests/host/shell.test.ts). Nạp src/ trong workspace thì `@deepseek-ai/dsh-llm` phân giải
    // về bản .bun của workspace — KHÁC realpath với kernel — nên `instanceof HarnessError` trượt oan.
    const surface = mkdtempSync(join(tmpdir(), "gbh-workflow-kernel-"));
    // Thứ tự quan trọng: build.ts xoá sạch outDir, nên symlink kernel phải dựng SAU khi build xong.
    const artifactPath = await buildPackage(surface);
    mkdirSync(join(surface, "node_modules"), { recursive: true });
    symlinkSync(
      join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"),
      join(surface, "node_modules", "@deepseek-ai"),
      "dir",
    );
    const artifact: any = await import(artifactPath);
    const ours = new artifact.WorkflowError("vuot tran agent", "AGENT_CAP");
    const theirs = new stock.WorkflowError("vuot tran agent", "AGENT_CAP");
    expect(ours.name).toBe(theirs.name);
    expect(ours.code).toBe(theirs.code);
    expect(ours.message).toBe(theirs.message);
    expect(ours.fatal).toBe(theirs.fatal);
    expect(ours.fatal).toBe(true);
    // Hợp đồng liên gói: phải là thể hiện của ĐÚNG `HarnessError` kernel cấp (dsh-tools định tuyến theo đó).
    expect(ours instanceof harness.HarnessError).toBe(true);
    expect(theirs instanceof harness.HarnessError).toBe(true);
    expect(ours).toBeInstanceOf(Error);
    // Chuỗi hiển thị giống nhau (tên lớp nằm trong chuỗi).
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toContain("WorkflowError");
    rmSync(surface, { recursive: true, force: true });
  });

  test("WorkflowError: MỌI mã của taxonomy đi qua nguyên vẹn, cờ fatal tắt được, cause nối được", async () => {
    const stock: any = await import(STOCK);
    const codes = [
      "SCRIPT_PARSE",
      "META_INVALID",
      "INVALID_ARGUMENT",
      "UNSUPPORTED_OPTION",
      "UNSUPPORTED_SCHEMA",
      "AGENT_CAP",
      "ITEM_CAP",
      "AGENT_START",
      "AGENT_RESULT",
      "RESULT_UNSERIALIZABLE",
      "CANCELLED",
    ];
    for (const code of codes) {
      expect(new WorkflowError("x", code as any).code).toBe(code);
      expect(new stock.WorkflowError("x", code).code).toBe(code);
    }
    const soft = new WorkflowError("x", "CANCELLED", { fatal: false });
    expect(soft.fatal).toBe(false);
    expect(new stock.WorkflowError("x", "CANCELLED", { fatal: false }).fatal).toBe(false);
    const cause = new Error("nguyen nhan goc");
    const chained = new WorkflowError("vo boc", "AGENT_RESULT", { cause });
    expect(chained.cause).toBe(cause);
    expect(new stock.WorkflowError("vo boc", "AGENT_RESULT", { cause }).cause).toBe(cause);
    // Cờ `fatal` đọc từ tuỳ chọn; không truyền tuỳ chọn thì mặc định true (đo cả hai bên).
    expect(new WorkflowError("x", "AGENT_CAP", undefined).fatal).toBe(true);
    expect(new stock.WorkflowError("x", "AGENT_CAP", undefined).fatal).toBe(true);
  });

  test("isFatalWorkflowError: chỉ WorkflowError có cờ fatal mới là fatal (bản sao giả KHÔNG qua)", async () => {
    const stock: any = await import(STOCK);
    expect(isFatalWorkflowError(new WorkflowError("x", "AGENT_CAP"))).toBe(true);
    expect(isFatalWorkflowError(new WorkflowError("x", "CANCELLED", { fatal: false }))).toBe(false);
    expect(isFatalWorkflowError(new Error("x"))).toBe(false);
    expect(isFatalWorkflowError(undefined)).toBe(false);
    // Vật giả có đúng khoá `fatal` vẫn KHÔNG qua: fatality là `instanceof`, không phải duck-typing.
    expect(isFatalWorkflowError({ fatal: true, code: "AGENT_CAP" })).toBe(false);
    // Bản gốc cho KẾT QUẢ Y HỆT trên cùng bộ đầu vào (trừ thể hiện do chính nó dựng).
    expect(stock.isFatalWorkflowError(new stock.WorkflowError("x", "AGENT_CAP"))).toBe(true);
    expect(stock.isFatalWorkflowError(new stock.WorkflowError("x", "CANCELLED", { fatal: false }))).toBe(false);
    expect(stock.isFatalWorkflowError({ fatal: true, code: "AGENT_CAP" })).toBe(false);
  });
});

describe("row workflow — phát sự kiện vòng đời (đối chứng với chính bundle gốc)", () => {
  test("ĐỦ SÁU sự kiện: người nghe nhận đúng thân, đúng thứ tự, ở CẢ HAI bản", async () => {
    const ourCordis: any = await import(OUR_CORDIS);
    const stockCordis: any = await import(STOCK_CORDIS);
    const stock: any = await import(STOCK);
    const ours = bootEngine(WorkflowEngine, ourCordis.Context);
    const theirs = bootEngine(stock.WorkflowEngine, stockCordis.Context);
    const events: [string, unknown[]][] = [
      ["workflow/start", [RUN_INFO]],
      ["workflow/phase", [RUN_INFO, "khao sat"]],
      ["workflow/log", [RUN_INFO, "dang chay"]],
      ["workflow/agent-start", [RUN_INFO, { seq: 1, label: "con-1", phase: "khao sat", childId: "child-1" }]],
      ["workflow/agent-end", [RUN_INFO, { seq: 1, label: "con-1", phase: "khao sat", childId: "child-1", outcome: "completed" }]],
      ["workflow/end", [RUN_INFO, { stopReason: "completed", agentsStarted: 1 }]],
    ];
    for (const [name] of events) {
      listen(ours, name);
      listen(theirs, name);
    }
    for (const [name, args] of events) {
      ours.engine.emitWorkflowEvent(name, ...args);
      theirs.engine.emitWorkflowEvent(name, ...args);
    }
    expect(ours.calls.length).toBe(events.length);
    expect(theirs.calls.length).toBe(events.length);
    // Vết của ta TRÙNG TỪNG DÒNG với bản gốc — cùng tên, cùng thân, cùng thứ tự.
    expect(ours.calls).toEqual(theirs.calls);
    // Mỗi người nghe nhận đúng thân đã phát (không thêm/bớt tham số, không bọc).
    expect(ours.calls[0]).toBe("workflow/start|" + JSON.stringify([RUN_INFO]));
    // Không có cảnh báo nào khi mọi người nghe đều lành.
    expect(ours.warns).toEqual([]);
    expect(theirs.warns).toEqual([]);
  });

  test("CÔ ĐỊNH người nghe: một người nghe NÉM không chặn người sau, không lan ra người phát", async () => {
    const ourCordis: any = await import(OUR_CORDIS);
    const stockCordis: any = await import(STOCK_CORDIS);
    const stock: any = await import(STOCK);
    const ours = bootEngine(WorkflowEngine, ourCordis.Context);
    const theirs = bootEngine(stock.WorkflowEngine, stockCordis.Context);
    for (const recorder of [ours, theirs]) {
      const seen: string[] = [];
      recorder.ctx.on("workflow/log", (): never => {
        throw new Error("boom");
      });
      recorder.ctx.on("workflow/log", (info: any, message: string): void => {
        seen.push(info.id + ":" + message);
      });
      (recorder as any).seen = seen;
    }
    // KHÔNG được ném ra ngoài — đây là toàn bộ lý do hàm này tồn tại.
    expect(() => ours.engine.emitWorkflowEvent("workflow/log", RUN_INFO, "mot")).not.toThrow();
    expect(() => theirs.engine.emitWorkflowEvent("workflow/log", RUN_INFO, "mot")).not.toThrow();
    expect((ours as any).seen).toEqual([RUN_INFO.id + ":mot"]);
    expect((theirs as any).seen).toEqual([RUN_INFO.id + ":mot"]);
    // Cùng MỘT câu cảnh báo, đúng khuôn `workflow: <ten> listener threw: <String(error)>`.
    expect(ours.warns).toEqual(theirs.warns);
    expect(ours.warns).toEqual(["workflow: workflow/log listener threw: Error: boom"]);
    // `String()` của một giá trị bị ném cũng ném ⇒ nhãn cố định, y bản gốc.
    const nasty = {
      toString(): never {
        throw new Error("khong ep duoc chuoi");
      },
    };
    for (const recorder of [ours, theirs]) recorder.ctx.on("workflow/phase", (): never => {
      throw nasty;
    });
    ours.engine.emitWorkflowEvent("workflow/phase", RUN_INFO, "pha-xau");
    theirs.engine.emitWorkflowEvent("workflow/phase", RUN_INFO, "pha-xau");
    expect(ours.warns.at(-1)).toBe(theirs.warns.at(-1) as string);
    expect(ours.warns.at(-1)).toBe("workflow: workflow/phase listener threw: [unrenderable thrown value]");
  });

  test("CÔ ĐỊNH người nghe BẤT ĐỒNG BỘ: reject được bắt và ghi log, không thành unhandled rejection", async () => {
    const ourCordis: any = await import(OUR_CORDIS);
    const stockCordis: any = await import(STOCK_CORDIS);
    const stock: any = await import(STOCK);
    const ours = bootEngine(WorkflowEngine, ourCordis.Context);
    const theirs = bootEngine(stock.WorkflowEngine, stockCordis.Context);
    for (const recorder of [ours, theirs]) {
      const seen: string[] = [];
      recorder.ctx.on("workflow/end", async (): Promise<never> => {
        throw new Error("reject-boom");
      });
      recorder.ctx.on("workflow/end", (_info: any, result: any): void => {
        seen.push(JSON.stringify(result));
      });
      (recorder as any).seen = seen;
    }
    ours.engine.emitWorkflowEvent("workflow/end", RUN_INFO, { stopReason: "error", error: "hong", agentsStarted: 2 });
    theirs.engine.emitWorkflowEvent("workflow/end", RUN_INFO, { stopReason: "error", error: "hong", agentsStarted: 2 });
    // Người nghe ĐỒNG BỘ vẫn chạy dù người trước trả promise reject.
    expect((ours as any).seen).toEqual([JSON.stringify({ stopReason: "error", error: "hong", agentsStarted: 2 })]);
    expect((theirs as any).seen).toEqual((ours as any).seen);
    // Cảnh báo chỉ xuất hiện SAU microtask — trước đó chưa có gì.
    expect(ours.warns).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(ours.warns).toEqual(["workflow: workflow/end listener rejected: Error: reject-boom"]);
    expect(ours.warns).toEqual(theirs.warns);
  });

  test("SERVICE: cắm qua ctx.plugin thì `workflowEngine` CÓ MẶT ở cả hai bản (fiber ACTIVE)", async () => {
    const ourCordis: any = await import(OUR_CORDIS);
    const stockCordis: any = await import(STOCK_CORDIS);
    const stock: any = await import(STOCK);
    const boot = async (EngineClass: any, ContextCtor: any): Promise<{ ctx: any; plugin: any }> => {
      const ctx = new ContextCtor();
      class Concrete extends EngineClass {
        /** Chỉ để lớp cụ thể hoá lớp trừu tượng — test này không chạy `start`. */
        start(): never {
          throw new Error("start() khong thuoc pham vi test nay");
        }
      }
      const plugin = ctx.plugin(Concrete);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ctx, plugin };
    };
    const ourBoot = await boot(WorkflowEngine, ourCordis.Context);
    const stockBoot = await boot(stock.WorkflowEngine, stockCordis.Context);
    const ourService = ourBoot.ctx.get("workflowEngine");
    const stockService = stockBoot.ctx.get("workflowEngine");
    expect(ourService).toBeDefined();
    expect(stockService).toBeDefined();
    expect(ourService.name).toBe("workflowEngine");
    expect(stockService.name).toBe("workflowEngine");
    expect(typeof ourService.emitWorkflowEvent).toBe("function");
    expect(typeof stockService.emitWorkflowEvent).toBe("function");
    await ourBoot.plugin.dispose?.();
    await stockBoot.plugin.dispose?.();
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ dùng lúc chạy: cordis (Service) và dsh-llm (HarnessError) — hai seam kernel cấp. */
const RUNTIME_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — test không resolve `@deepseek-ai/*`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((name) => !declared.has(name)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("gbh-workflow · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...RUNTIME_PEERS].sort());
    for (const name of peers) expect(declared).toContain(name);
    expect(missingPeers(manifest)).toEqual([]);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, và KHÔNG nằm trong dependencies (tránh thể hiện thứ hai)", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const name of manifest.gbh?.peers ?? []) {
      expect(existsSync(join(ROOT, "apps", "host", "node_modules", name, "package.json"))).toBe(true);
      expect(deps.has(name)).toBe(false);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const name of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[name];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([name]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ cả hai tên (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });
});

describe("gbh-workflow · cổng an toàn mount", () => {
  test("CHƯA khai gbh.row (Lead boot mới khai) — ai bật sớm thì test này ĐỎ", () => {
    const manifest = readManifest();
    expect(manifest.gbh?.row).toBeUndefined();
    // Nhưng gbh.peers phải có sẵn để tầng mount symlink đúng peer khi Lead khai row.
    expect(manifest.gbh?.peers).toBeDefined();
  });

  test("package KHÔNG được kéo bất kỳ gói @galaxy-stack nào (luật bất biến)", () => {
    const text = readFileSync(MANIFEST, "utf8");
    expect(text.includes("@galaxy-stack/")).toBe(false);
  });
});
