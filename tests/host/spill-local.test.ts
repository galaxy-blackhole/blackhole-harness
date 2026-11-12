/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-spill-local: bốn phép BƯỚC 0 đo lại trong test, tập export đo trên
 *      ARTIFACT của CẢ HAI bên (so PHẦN TỬ), đối chứng hành vi với chính bundle gốc (tên đoạn an toàn,
 *      byte, quyền 0600/0700, lượt dọn, lượt dò gốc, schema Config, service trên Context cordis THẬT),
 *      C6 danh tính cấu hình (not.toBe), và quy ước gbh.peers ⊆ peerDependencies kèm 3 ĐỐI CHỨNG ÂM.
 *      Mọi ca bất đồng bộ dùng waitFor CÓ TRẦN, không sleep mù.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { SweepRoot, WarnFn } from "../../packages/host/spill-local/src/cleanup.ts";
import type { LocalSpillStore as StoreClass } from "../../packages/host/spill-local/src/index.ts";

/** Gốc repo (tests/host → ../..). */
const ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(ROOT, "packages", "host", "spill-local");
/** ARTIFACT của ta — thứ được đo, không phải src/. */
const OURS_ENTRY = join(PKG, "lib", "index.js");
/** Gói GỐC trong kernel (CHỈ ĐỌC); tên package lấy từ dump, KHÔNG suy từ tên thư mục. */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-spill-local");
/** Context cordis THẬT của kernel (một thể hiện duy nhất với mọi gói). */
const CORDIS_ENTRY = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Một ngày, tính bằng mili giây (khớp hằng số của bản gốc). */
const DAY_MS = 24 * 60 * 60 * 1000;
/** Trần cho mọi ca chờ bất đồng bộ (ms) — không ca nào chờ vô hạn. */
const WAIT_CEILING_MS = 5000;

// lib/ nằm trong .gitignore nên bản sao mới không có sẵn: build ngay để phép đo luôn chạy trên artifact.
if (!existsSync(OURS_ENTRY)) {
  const build = (await import(join(PKG, "build.ts"))) as { buildPackage: (outDir?: string) => Promise<string> };
  await build.buildPackage();
}

/** Hình dạng của MỘT artifact đã nạp (dùng chung cho bản của ta và bản gốc). */
interface Built {
  DEFAULT_ROOT_PREFIX: string;
  LocalSpillStore: typeof StoreClass;
  default: typeof StoreClass;
  discoverDefaultRoots: (warn: WarnFn, base?: string) => Promise<string[]>;
  encodeSegment: (raw: string) => string;
  isErrno: (error: unknown, code: string) => boolean;
  privateRoot: () => string;
  saveTextFile: (options: { root: string; sessionId: string; suggestedName: string; content: string }) => Promise<{ path: string; bytes: number }>;
  sessionDir: (root: string, sessionId: string) => string;
  sweepSpillRoots: (options: { roots: SweepRoot[]; cutoffMs: number; warn: WarnFn }) => Promise<void>;
}

/** Manifest đọc từ package.json (chỉ trường mà test dùng). */
interface Manifest {
  name: string;
  dsh?: { client?: unknown };
  exports?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  gbh?: { peers?: string[] };
}

const ours = (await import(OURS_ENTRY)) as Built;
const stock = (await import(join(STOCK_PKG, "lib", "index.js"))) as Built;
const cordis = (await import(CORDIS_ENTRY)) as { Context: new () => RealContext };

/** Kiểu context cordis THẬT, lấy từ chính chữ ký của package (tests/ không resolve được @deepseek-ai/*). */
type RealContext = ConstructorParameters<typeof StoreClass>[0];
/** Tham số một lượt lưu tràn (lấy từ chữ ký thật, không chép tay). */
type SaveInput = Parameters<InstanceType<typeof StoreClass>["saveText"]>[0];
/** Tham chiếu tràn mà seam trả về. */
type SaveRef = Awaited<ReturnType<InstanceType<typeof StoreClass>["saveText"]>>;
/** Id phiên đã brand, ép ở ranh giới như mọi seam khác. */
type SessionRef = SaveInput["owner"]["sessionId"];
/** Call id tool đã brand. */
type CallRef = Extract<SaveInput["source"], { kind: "tool" }>["callId"];

/**
 * Chờ CÓ TRẦN cho một điều kiện trở thành đúng.
 * Nhận: vị từ không tham số, và trần thời gian (mặc định {@link WAIT_CEILING_MS}).
 * Trả: `true` khi điều kiện đúng trong trần, `false` khi hết trần (không bao giờ treo).
 */
async function waitFor(predicate: () => boolean, ceilingMs: number = WAIT_CEILING_MS): Promise<boolean> {
  const started = Date.now();
  for (;;) {
    if (predicate()) return true;
    if (Date.now() - started >= ceilingMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Dựng một thư mục tạm cách ly, KHÔNG mang hình dạng `dsh-spill-*` (để lượt dò gốc của bản khác không
 * quét nhầm fixture của ta).
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối của thư mục tạm.
 */
function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), "spill-test-"));
}

/**
 * Dựng một thư mục phiên THẬT dưới gốc, kèm hai tệp thường (một cũ, một mới).
 * Nhận: gốc tràn và số ngày tuổi của tệp cũ.
 * Trả: đường dẫn thư mục phiên.
 */
function sessionFixture(root: string, oldDays: number): string {
  const dir = join(root, "session-" + "d".repeat(12));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "old"), "x");
  writeFileSync(join(dir, "new"), "y");
  const past = (Date.now() - oldDays * DAY_MS) / 1000;
  utimesSync(join(dir, "old"), past, past);
  return dir;
}

/**
 * Liệt kê cây tương đối của một gốc (thư mục kết thúc bằng `/`).
 * Nhận: gốc cần liệt kê.
 * Trả: mảng tên tương đối đã sắp xếp (so được từng phần tử giữa hai bên).
 */
function tree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const stats = statSync(path, { throwIfNoEntry: false });
      if (stats?.isDirectory()) {
        out.push(prefix + name + "/");
        walk(path, prefix + name + "/");
      } else out.push(prefix + name);
    }
  };
  walk(root, "");
  return out;
}

/**
 * Thay tiền tố gốc cụ thể bằng một nhãn, để hai bên so được thông điệp cảnh báo.
 * Nhận: thông điệp và gốc cần thay.
 * Trả: thông điệp đã chuẩn hoá.
 */
function scrub(message: string, root: string): string {
  return message.split(root).join("<root>");
}

/**
 * So tập peer với tập peerDependencies theo PHẦN TỬ (không so số lượng).
 * Nhận: tên trong `gbh.peers` và các khoá của `peerDependencies`.
 * Trả: các tên có trong `peers` mà THIẾU trong `peerDependencies` (rỗng = đạt).
 */
function peerSubsetIssues(peers: readonly string[], peerDependencies: readonly string[]): string[] {
  const have = new Set(peerDependencies);
  return peers.filter((name) => !have.has(name));
}

/**
 * Đọc manifest JSON của một package.
 * Nhận: đường dẫn tệp package.json.
 * Trả: object đã parse theo {@link Manifest}.
 */
function manifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

/**
 * Tìm thư mục dump parity MỚI NHẤT (tên là mốc ISO nên sắp xếp từ điển là đúng thứ tự thời gian).
 * Nhận: không.
 * Trả: đường dẫn thư mục dump mới nhất.
 */
function latestDump(): string {
  const base = join(ROOT, ".parity", "dumps");
  const names = readdirSync(base)
    .filter((name) => /^\d{4}-\d{2}-\d{2}T/.test(name))
    .sort();
  const last = names[names.length - 1];
  if (last === undefined) throw new Error("không có dump nào trong " + base);
  return join(base, last);
}

/**
 * Trích MỘT row (khối `- id: <row>` cho tới khối kế tiếp) từ một file config YAML.
 * Nhận: nội dung YAML và id row.
 * Trả: các dòng trong khối row (không gồm dòng `- id:` đầu khối), hoặc `undefined` khi không thấy.
 */
function rowBlock(yaml: string, rowId: string): string[] | undefined {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start < 0) return undefined;
  const block: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^-\s+id:/.test(line) || /^# ==/.test(line)) break;
    block.push(line);
  }
  return block;
}

describe("bốn phép BƯỚC 0 (đo lại trong test, không tin báo cáo)", () => {
  test("cặp id+name có thật trong ours.yml MỚI NHẤT · KHÔNG disabled · KHÔNG config · KHÔNG inject", () => {
    const dump = latestDump();
    const block = rowBlock(readFileSync(join(dump, "ours.yml"), "utf8"), "spill-local");
    expect(block).toBeDefined();
    const lines = block ?? [];
    // (i) Cặp id + name LẤY TỪ DUMP (tên gói gốc, không suy từ tên thư mục).
    expect(lines[0]?.trim()).toBe("name: '@deepseek-ai/dsh-spill-local'");
    const body = lines.join("\n");
    // (iii) Row KHÔNG bị tắt theo thiết kế.
    expect(/^\s*disabled:/m.test(body)).toBe(false);
    // (iv) Row KHÔNG có config/inject ⇒ không có `!!js` nào cần inject tương ứng.
    expect(/^\s*config:/m.test(body)).toBe(false);
    expect(/^\s*inject:/m.test(body)).toBe(false);
  });

  test("(ii) package gốc KHÔNG có dsh.client VÀ lib/client.js KHÔNG tồn tại ⇒ MỘT MẶT", () => {
    const json = manifest(join(STOCK_PKG, "package.json"));
    expect(json.name).toBe("@deepseek-ai/dsh-spill-local");
    expect(json.dsh?.client).toBeUndefined();
    expect(existsSync(join(STOCK_PKG, "lib", "client.js"))).toBe(false);
  });
});

describe("tập export đo trên ARTIFACT (nạp thật cả hai bên, so PHẦN TỬ)", () => {
  test("THIẾU = 0 · THỪA = 0 · default là CHÍNH lớp · tên gói đúng theo dump", () => {
    const ourNames = Object.keys(ours).sort();
    const stockNames = Object.keys(stock).sort();
    // So PHẦN TỬ hai chiều (không so số lượng): một tên lệch là hỏng.
    expect(ourNames.filter((name) => !stockNames.includes(name))).toEqual([]);
    expect(stockNames.filter((name) => !ourNames.includes(name))).toEqual([]);
    expect(ourNames).toEqual(stockNames);
    expect(ourNames.length).toBe(10);
    // `default` phải là CHÍNH lớp (Loader nạp class plugin qua `default`).
    expect(ours.default).toBe(ours.LocalSpillStore);
    expect(stock.default).toBe(stock.LocalSpillStore);
    // Tên package dùng để đo là tên TRONG DUMP, không phải tên thư mục.
    expect(manifest(join(STOCK_PKG, "package.json")).name).toBe("@deepseek-ai/dsh-spill-local");
    expect(manifest(join(PKG, "package.json")).name).toBe("@galaxy-blackhole/gbh-spill-local");
  });
});

describe("hành vi: đối chứng từng phần tử với chính bundle gốc", () => {
  test("encodeSegment/sessionDir/isErrno/prefix: bảng đối chứng khớp tuyệt đối", () => {
    expect(ours.DEFAULT_ROOT_PREFIX).toBe(stock.DEFAULT_ROOT_PREFIX);
    const table = ["", ".", "..", "a.txt", "../../etc/passwd", "/abs/path", "a/b", "~", "~0041", "café", "ế", "\u0000x", "x".repeat(300), "sess-1", "result.json"];
    for (const raw of table) expect([raw, ours.encodeSegment(raw)]).toEqual([raw, stock.encodeSegment(raw)]);
    for (const id of ["sess-a", "", "ế", "x".repeat(500)]) expect(ours.sessionDir("/root", id)).toBe(stock.sessionDir("/root", id));
    const errors: unknown[] = [Object.assign(new Error("x"), { code: "ENOENT" }), new Error("y"), "ENOENT", null, undefined, { code: "ENOENT" }];
    for (const error of errors) expect(ours.isErrno(error, "ENOENT")).toBe(stock.isErrno(error, "ENOENT"));
    // Đơn ánh: hai đầu vào khác nhau không bao giờ ra cùng một đoạn.
    expect(ours.encodeSegment("../x")).not.toBe(ours.encodeSegment("..x"));
    expect(ours.encodeSegment("~0041")).not.toBe(ours.encodeSegment("A"));
  });

  test("saveTextFile: tên suy từ suggestedName, byte UTF-8, quyền 0600/0700 — A/B", async () => {
    const seen: Record<string, unknown>[] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      const saved = await impl.saveTextFile({ root, sessionId: "sess-a", suggestedName: "../../etc/passwd", content: "héllo" });
      const parts = saved.path.slice(root.length + 1).split("/");
      const dir = join(root, parts[0] ?? "");
      expect(parts[0]?.startsWith("session-")).toBe(true);
      expect(parts[1]).toMatch(/^[0-9a-f]{12}-/);
      // Lượt ghi thứ hai cùng phiên: tên KHÁC, cùng thư mục phiên (không đè).
      const again = await impl.saveTextFile({ root, sessionId: "sess-a", suggestedName: "x", content: "y" });
      expect(again.path).not.toBe(saved.path);
      expect(readdirSync(dir).length).toBe(2);
      seen.push({
        // Phần ngẫu nhiên 6 byte được thay nhãn; phần còn lại phải khớp bản gốc.
        shape: (parts[0] ?? "") + "/" + (parts[1] ?? "").replace(/^[0-9a-f]{12}/, "<hex>"),
        bytes: saved.bytes,
        fileMode: (statSync(saved.path).mode & 0o777).toString(8),
        dirMode: (statSync(dir).mode & 0o777).toString(8),
        content: readFileSync(saved.path, "utf8"),
      });
    }
    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0]?.bytes).toBe(6);
    expect(seen[0]?.fileMode).toBe("600");
    expect(seen[0]?.dirMode).toBe("700");
  });

  test("saveTextFile: đường lỗi (gốc là TỆP) ⇒ ném cùng mã, không treo — A/B", async () => {
    const codes: (string | undefined)[] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      const fileRoot = join(root, "not-a-dir");
      writeFileSync(fileRoot, "x");
      let code: string | undefined;
      try {
        await impl.saveTextFile({ root: fileRoot, sessionId: "s", suggestedName: "y", content: "z" });
        code = "khong-nem";
      } catch (error) {
        code = (error as { code?: string }).code;
      }
      codes.push(code);
    }
    expect(codes[0]).toBe("ENOTDIR");
    expect(codes[0]).toBe(codes[1]);
  });

  test("sweepSpillRoots: cây còn lại + cảnh báo + tỉa gốc rỗng — A/B trên HAI fixture y hệt", async () => {
    const trees: string[][] = [];
    const warnings: string[][] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      const old = join(root, "session-" + "a".repeat(12));
      const fresh = join(root, "session-" + "b".repeat(12));
      const foreign = join(root, "session-backup");
      mkdirSync(old, { recursive: true });
      mkdirSync(fresh, { recursive: true });
      mkdirSync(foreign);
      writeFileSync(join(old, "old1"), "x");
      writeFileSync(join(fresh, "new1"), "x");
      writeFileSync(join(foreign, "keep"), "x");
      const past = (Date.now() - 40 * DAY_MS) / 1000;
      utimesSync(join(old, "old1"), past, past);
      symlinkSync(join(tmpdir(), "target-nowhere"), join(old, "link"));
      const messages: string[] = [];
      await impl.sweepSpillRoots({
        roots: [{ path: root, pruneWhenEmpty: false }],
        cutoffMs: Date.now() - 30 * DAY_MS,
        warn: (message: string) => messages.push(scrub(message, root)),
      });
      trees.push(tree(root));
      warnings.push(messages);
    }
    expect(trees[0]).toEqual(trees[1]);
    // Tệp cũ đã mất; thư mục phiên giữ lại vì còn symlink; mục lạ KHÔNG bị quét.
    expect(trees[0]).toEqual([
      "session-aaaaaaaaaaaa/",
      "session-aaaaaaaaaaaa/link",
      "session-backup/",
      "session-backup/keep",
      "session-bbbbbbbbbbbb/",
      "session-bbbbbbbbbbbb/new1",
    ]);
    expect(warnings[0]).toEqual(warnings[1]);

    // pruneWhenEmpty: gốc rỗng bị gỡ (chỉ gốc DÒ ĐƯỢC mới bị gỡ chính nó).
    const removed: boolean[] = [];
    for (const impl of [ours, stock]) {
      const base = tempRoot();
      const root = join(base, "dsh-spill-abc123");
      mkdirSync(join(root, "session-" + "c".repeat(12)), { recursive: true });
      await impl.sweepSpillRoots({ roots: [{ path: root, pruneWhenEmpty: true }], cutoffMs: Date.now(), warn: () => {} });
      removed.push(!existsSync(root) && readdirSync(base).length === 0);
    }
    expect(removed).toEqual([true, true]);
  });

  test("discoverDefaultRoots: CHỈ đúng hình dạng mkdtemp (6 ký tự) — A/B", async () => {
    const found: string[][] = [];
    for (const impl of [ours, stock]) {
      const base = tempRoot();
      mkdirSync(join(base, "dsh-spill-aaaaaa"));
      mkdirSync(join(base, "dsh-spill-test-x"));
      mkdirSync(join(base, "dsh-spill-ABC123"));
      mkdirSync(join(base, "dsh-spill-zzzzzz"));
      symlinkSync(join(base, "dsh-spill-aaaaaa"), join(base, "dsh-spill-link11"));
      writeFileSync(join(base, "dsh-spill-file11"), "x");
      found.push((await impl.discoverDefaultRoots(() => {}, base)).map((path) => basename(path)).sort());
    }
    expect(found[0]).toEqual(found[1]);
    expect(found[0]).toEqual(["dsh-spill-ABC123", "dsh-spill-aaaaaa", "dsh-spill-zzzzzz"]);
  });

  test("Config: mặc định 30 ngày + ba ca SAI cho CÙNG thông điệp — A/B", () => {
    expect(ours.LocalSpillStore.Config({})).toEqual(stock.LocalSpillStore.Config({}));
    // So A/B cùng hình dạng (schema của hai bên cùng kiểu); giá trị 0 phải được GIỮ, không bị mặc định đè.
    expect(ours.LocalSpillStore.Config({ cleanupPeriodDays: 0 })).toEqual(stock.LocalSpillStore.Config({ cleanupPeriodDays: 0 }));
    expect(ours.LocalSpillStore.Config({ cleanupPeriodDays: 0 }).cleanupPeriodDays).toBe(0);
    const messages: string[][] = [];
    const bad: Record<string, unknown>[] = [{ cleanupPeriodDays: 1.5 }, { cleanupPeriodDays: -1 }, { root: 5 }];
    for (const impl of [ours, stock]) {
      const collected: string[] = [];
      for (const spec of bad) {
        try {
          impl.LocalSpillStore.Config(spec);
          collected.push("khong-nem");
        } catch (error) {
          collected.push(error instanceof Error ? error.message : String(error));
        }
      }
      messages.push(collected);
    }
    expect(messages[0]).toEqual(messages[1]);
    expect(messages[0]?.[0]).toContain("multiple of 1");
    expect(messages[0]?.[1]).toContain(">= 0");
    expect(messages[0]?.[2]).toContain("expected string");
  });
});

describe("service trên Context cordis THẬT (ctx.spillStore)", () => {
  test("saveText trả locator/bytes/hint y bản gốc; đăng ký lần hai ném CÙNG thông điệp — A/B", async () => {
    const traces: string[][] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      const ctx = new cordis.Context();
      new impl.LocalSpillStore(ctx, impl.LocalSpillStore.Config({ root }));
      const ref: SaveRef = await ctx.spillStore.saveText({
        owner: { sessionId: "s1" as SessionRef },
        source: { kind: "tool", toolName: "t", callId: "c" as CallRef, label: "l" },
        suggestedName: "r.txt",
        content: "aé",
      });
      const trace = [
        "bytes=" + String(ref.bytes),
        "hint=" + String(ref.retrievalHint),
        "locator-type=" + typeof ref.locator,
        "locator-in-root=" + String(String(ref.locator).startsWith(root)),
      ];
      try {
        new impl.LocalSpillStore(ctx, impl.LocalSpillStore.Config({ root }));
        trace.push("dang-ky-lan-hai=khong-nem");
      } catch (error) {
        trace.push("dang-ky-lan-hai=" + (error instanceof Error ? error.message.split(" at ")[0] : String(error)));
      }
      await ctx.fiber.dispose();
      traces.push(trace);
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.[0]).toBe("bytes=3");
    expect(traces[0]?.[2]).toBe("locator-type=string");
    expect(traces[0]?.[3]).toBe("locator-in-root=true");
    expect(traces[0]?.[4]).toContain("has been registered");
  });

  test("kích hoạt dọn tệp quá hạn (waitFor CÓ TRẦN); cleanupPeriodDays 0 giữ nguyên — A/B", async () => {
    const outcomes: string[] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      const dir = sessionFixture(root, 40);
      const ctx = new cordis.Context();
      class Isolated extends impl.LocalSpillStore {
        /** Trỏ lượt dò gốc vào thư mục cách ly để KHÔNG quét thư mục tạm thật của máy. */
        protected override defaultRootsBase(): string {
          return tempRoot();
        }
      }
      new Isolated(ctx, Isolated.Config({ root }));
      const removed = await waitFor(() => !existsSync(join(dir, "old")));
      const kept = existsSync(join(dir, "new"));
      await ctx.fiber.dispose();
      outcomes.push("xoa-cu=" + String(removed) + " giu-moi=" + String(kept));

      const keptDir = sessionFixture(tempRoot(), 4000);
      const keptCtx = new cordis.Context();
      class NoCleanup extends impl.LocalSpillStore {
        /** Trỏ lượt dò gốc vào thư mục cách ly (lượt dọn bị tắt nên không chạy). */
        protected override defaultRootsBase(): string {
          return tempRoot();
        }
      }
      new NoCleanup(keptCtx, NoCleanup.Config({ root: keptDir.slice(0, keptDir.lastIndexOf("/")), cleanupPeriodDays: 0 }));
      // Có trần: KHÔNG có gì bị xoá nên vị từ đúng ngay; trần chỉ để không treo nếu bản cài sai.
      const untouched = await waitFor(() => readdirSync(keptDir).includes("old"), 300);
      await keptCtx.fiber.dispose();
      outcomes.push("0-ngay-giu-nguyen=" + String(untouched));
    }
    expect(outcomes).toEqual([
      "xoa-cu=true giu-moi=true",
      "0-ngay-giu-nguyen=true",
      "xoa-cu=true giu-moi=true",
      "0-ngay-giu-nguyen=true",
    ]);
  });

  test("gỡ fiber CHỜ lượt dọn đang chạy lắng (waitFor CÓ TRẦN, hai bên cùng kết cục)", async () => {
    const outcomes: string[] = [];
    for (const impl of [ours, stock]) {
      const root = tempRoot();
      sessionFixture(root, 4000);
      const ctx = new cordis.Context();
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      class Slow extends impl.LocalSpillStore {
        /** Giữ lượt dọn mở để đo "lượt gỡ phải chờ" (đường may cho test, không phải nút vặn triển khai). */
        protected override async gatherRoots(): Promise<SweepRoot[]> {
          await gate;
          return [];
        }
      }
      new Slow(ctx, Slow.Config({ root }));
      let disposed = false;
      const disposal = ctx.fiber.dispose().then(() => {
        disposed = true;
      });
      // Có trần: trong 150ms đầu, lượt gỡ PHẢI còn bị giữ.
      const settledTooEarly = await waitFor(() => disposed, 150);
      release();
      const settledAfterRelease = await waitFor(() => disposed);
      await disposal;
      outcomes.push("som=" + String(settledTooEarly) + " sau=" + String(settledAfterRelease));
    }
    expect(outcomes).toEqual(["som=false sau=true", "som=false sau=true"]);
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP (đo bằng DANH TÍNH, không so sâu)", () => {
  test("hai thực thể: config KHÁC tham chiếu, sửa một KHÔNG lan sang cái kia", () => {
    const ctxA = new cordis.Context();
    const ctxB = new cordis.Context();
    const a = new ours.LocalSpillStore(ctxA, ours.LocalSpillStore.Config({ root: tempRoot(), cleanupPeriodDays: 7 }));
    const b = new ours.LocalSpillStore(ctxB, ours.LocalSpillStore.Config({ root: tempRoot(), cleanupPeriodDays: 9 }));
    // DANH TÍNH — `toEqual` ĐẠT dù hai bên chia sẻ tham chiếu, nên nó không trả lời được câu này.
    expect(a.config).not.toBe(b.config);
    expect(a.root).not.toBe(b.root);
    expect(a.config.cleanupPeriodDays).toBe(7);
    expect(b.config.cleanupPeriodDays).toBe(9);
    (a.config as { cleanupPeriodDays: number }).cleanupPeriodDays = 1;
    expect(b.config.cleanupPeriodDays).toBe(9);
    // Vật thể mặc định do schema sinh cũng phải độc lập giữa hai lần gọi.
    const first = ours.LocalSpillStore.Config({});
    const second = ours.LocalSpillStore.Config({});
    expect(first).not.toBe(second);
    (first as { cleanupPeriodDays: number }).cleanupPeriodDays = 5;
    expect(second.cleanupPeriodDays).toBe(30);
    // Mỗi thực thể có gốc riêng: ghi của a không xuất hiện trong gốc của b.
    expect(existsSync(a.root)).toBe(true);
    expect(existsSync(b.root)).toBe(true);
    expect(a.root).not.toBe(b.root);
  });
});

describe("quy ước peer: gbh.peers ⊆ peerDependencies (so PHẦN TỬ, 3 ĐỐI CHỨNG ÂM)", () => {
  test("peers ⊆ peerDependencies · peer KHÔNG nằm trong dependencies · ba đối chứng âm", () => {
    const json = manifest(join(PKG, "package.json"));
    const peers = json.gbh?.peers ?? [];
    const peerDeps = Object.keys(json.peerDependencies ?? {});
    expect(peers.length).toBe(3);
    // (1) Chiều bao hàm THẬT — so PHẦN TỬ, không so số lượng.
    expect(peerSubsetIssues(peers, peerDeps)).toEqual([]);
    // (2) Peer phải là peerDependencies, KHÔNG là dependencies (một thể hiện do kernel cấp).
    expect(Object.keys(json.dependencies ?? {}).filter((name) => peers.includes(name))).toEqual([]);

    // ĐỐI CHỨNG ÂM 1: bỏ MỘT peer khỏi peerDependencies ⇒ phép kiểm phải báo ĐÚNG tên đó.
    const missing = peers[0] as string;
    expect(peerSubsetIssues(peers, peerDeps.filter((name) => name !== missing))).toEqual([missing]);
    // ĐỐI CHỨNG ÂM 2: thêm một tên MA vào peers ⇒ phải báo đúng tên ma.
    expect(peerSubsetIssues([...peers, "@deepseek-ai/dsh-ma"], peerDeps)).toEqual(["@deepseek-ai/dsh-ma"]);
    // ĐỐI CHỨNG ÂM 3: thêm tên vào CHỈ peerDependencies ⇒ KHÔNG báo gì (chiều bao hàm không đối xứng).
    expect(peerSubsetIssues(peers, [...peerDeps, "@deepseek-ai/dsh-thua"])).toEqual([]);
    // Và phép so SỐ LƯỢNG cho verdict RỖNG: cùng số lượng mà tập vẫn lệch hoàn toàn.
    const sameCount = ["@deepseek-ai/a", "@deepseek-ai/b", "@deepseek-ai/c"];
    expect(sameCount.length).toBe(peers.length);
    expect(peerSubsetIssues(sameCount, peerDeps).length).toBe(3);
  });
});

describe("luật 000e — locale/ byte-for-byte với bản gốc (nếu gốc có)", () => {
  test("en.json + zh.json khớp BYTE, và exports có ./locale/*.json", () => {
    for (const name of ["en.json", "zh.json"]) {
      const myFile = join(PKG, "locale", name);
      expect(existsSync(myFile)).toBe(true);
      expect(Buffer.compare(readFileSync(myFile), readFileSync(join(STOCK_PKG, "locale", name)))).toBe(0);
    }
    expect(manifest(join(PKG, "package.json")).exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});
