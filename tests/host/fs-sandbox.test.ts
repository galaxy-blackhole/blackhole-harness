/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-fs-sandbox: đo trên ARTIFACT, chạy CẢ HAI bản cài
 *      trên cùng dữ kiện (rào write/edit theo chế độ, chính sách dự phòng, đường lỗi, kế thừa), cộng
 *      ca tập export = gốc, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM), ca 000e locale và ca C6
 *      (danh tính vật thể, không phải so sâu)
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/fs-sandbox/build.ts";

/** Thư mục gốc repo (tests/host → ../..). */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "fs-sandbox");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs-sandbox");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Lớp cha THẬT của kernel — phép so danh tính lớp cha dùng chính module này. */
const KERNEL_FS_LOCAL = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs-local", "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");
/** Cây cài THẬT của kernel — nguồn peer mà artifact phải phân giải (pattern tests/host/shell.test.ts). */
const KERNEL_AI = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Cấu hình backend cục bộ: schemastery đã áp mặc định ở đường plugin, dựng thẳng thì phải đủ hai núm. */
interface FsLocalConfig {
  /** Mặc định phân giải đường dẫn tương đối. */
  cwd: string;
  /** Trần kích thước mỗi phía của phần trình bày ghi đè (10 MiB). */
  diffBasisMaxBytes: number;
}

/** Đích đã phân giải — đúng hai trường mà seam và rào đọc. */
interface FsTarget {
  /** Khoá đích (realpath của tổ tiên có thật sâu nhất + hậu tố). */
  targetKey: string;
  /** Đường dẫn hiển thị cho model/UI. */
  displayPath: string;
}

/** Chính sách tệp của MỘT lời gọi. */
interface SandboxPolicy {
  /** Chế độ tác động tệp. */
  mode: string;
  /** Gốc tuyệt đối mà `workspace-write` được ghi dưới. */
  workspaceRoot: string;
}

/** Yêu cầu sửa NGUYÊN VĂN. */
interface EditRequest {
  /** Văn bản cần thay. */
  oldString: string;
  /** Văn bản thay vào. */
  newString: string;
  /** Thay mọi lần khớp thay vì đòi đúng một. */
  replaceAll: boolean;
}

/** Bề mặt thực thể mà test dùng — đo trên ARTIFACT, không đọc src. */
interface FsInstance {
  /** Cấu hình đã chốt của backend kế thừa. */
  config: FsLocalConfig;
  /** Sự thật năng lực: chế độ mặc định của triển khai. */
  sandboxMode: string;
  /** Phân giải đường dẫn thành đích. */
  resolve(path: string): Promise<FsTarget>;
  /** Ghi toàn tệp (đã bị rào). */
  writeText(target: FsTarget, content: string, expected?: unknown, signal?: AbortSignal, policy?: SandboxPolicy): Promise<unknown>;
  /** Sửa nguyên văn (đã bị rào). */
  editText(target: FsTarget, edit: EditRequest, expected?: unknown, signal?: AbortSignal, policy?: SandboxPolicy): Promise<unknown>;
  /** Hàm rào (private ở .d.ts nhưng CÓ trên prototype lúc chạy — bản gốc cũng vậy). */
  checkedTarget(target: FsTarget, policy?: SandboxPolicy): Promise<FsTarget>;
}

/** Hình dạng module của cả hai bên. */
interface FsSandboxModule {
  /** Lớp backend cưỡng chế (kèm `inject` tĩnh của cordis). */
  SandboxedFileSystem: (new (ctx: unknown, config: FsLocalConfig) => FsInstance) & { inject?: unknown };
  /** Export mặc định (phải CHÍNH LÀ lớp trên). */
  default: unknown;
}

/** Một lỗi đã chuẩn hoá để so giữa hai bản cài. */
interface Failure {
  /** Tên lớp lỗi. */
  name: string;
  /** Mã máy đọc được. */
  code: string;
  /** Nguyên văn thông điệp. */
  message: string;
}

/** Kết cục một lời gọi: giá trị, hoặc lỗi đã chuẩn hoá. */
interface Settled<T> {
  /** Giá trị trả về khi thành công. */
  value?: T;
  /** Lỗi đã chuẩn hoá khi thất bại. */
  error?: Failure;
}

/**
 * Chuẩn hoá giá trị bị ném/từ chối thành bản ghi so sánh được.
 * Nhận: giá trị bắt được (`unknown`).
 * Trả: `{ name, code, message }`, hoặc một bản ghi giữ nguyên chuỗi khi không phải Error.
 */
function failureOf(error: unknown): Failure {
  if (!(error instanceof Error)) return { name: "khong-phai-Error", code: "", message: String(error) };
  const code = (error as unknown as { code?: unknown }).code;
  return { name: error.name, code: typeof code === "string" ? code : "", message: error.message };
}

/**
 * Chạy một lời gọi và ghi lại giá trị hoặc lỗi đã chuẩn hoá.
 * Nhận: hàm chạy trả promise.
 * Trả: {@link Settled} — dùng `toEqual` giữa ta và gốc.
 */
async function settle<T>(run: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { value: await run() };
  } catch (error) {
    return { error: failureOf(error) };
  }
}

/**
 * Dựng context giả ĐÚNG hình dạng seam: `Service` cần `reflect.provide`, rào cần `sandboxPolicy`.
 * Nhận: chế độ mặc định của triển khai và chính sách mà `resolve()` trả về.
 * Trả: context (ép kiểu tại chỗ dùng) kèm sổ lời gọi `resolve()`.
 */
function harness(mode: string, policy: SandboxPolicy): { ctx: unknown; resolved: number[] } {
  const resolved: number[] = [];
  const ctx = {
    reflect: { provide: (): void => {} },
    sandboxPolicy: {
      defaultMode: mode,
      resolve: (): SandboxPolicy => {
        resolved.push(resolved.length + 1);
        return policy;
      },
    },
  };
  return { ctx, resolved };
}

/** Mười MiB — mặc định của backend cục bộ. */
const DIFF_BASIS_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Dựng một thực thể backend của một trong hai bên.
 * Nhận: module (ta/gốc), context giả và thư mục làm việc.
 * Trả: thực thể đã cấu hình.
 */
function instanceOf(module: FsSandboxModule, ctx: unknown, cwd: string): FsInstance {
  return new module.SandboxedFileSystem(ctx, { cwd, diffBasisMaxBytes: DIFF_BASIS_MAX_BYTES });
}

// lib/ nằm trong .gitignore nên bản sao mới không có sẵn: build ngay để phép đo luôn chạy trên artifact.
const artifactFile = await buildPackage(ARTIFACT_DIR);
// Artifact import bare specifier ⇒ phân giải peer TỪ THƯ MỤC CỦA NÓ. Trỏ `@deepseek-ai` sang cây kernel để
// artifact nạp ĐÚNG `dsh-fs-local` của kernel như lúc chạy thật: hai cây cài để hai tệp riêng (nội dung y
// hệt) nên thiếu bước này lớp cha `LocalFileSystem` là hai lớp KHÁC NHAU về danh tính.
mkdirSync(join(ARTIFACT_DIR, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(ARTIFACT_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(ARTIFACT_DIR, "node_modules", "@galaxy-blackhole"), "dir");
/** Văn bản ARTIFACT của ta — nguồn của phép đếm id module. */
const artifactCode = readFileSync(artifactFile, "utf8");
/** Artifact của ta. */
const ours = (await import(artifactFile)) as FsSandboxModule;
/** Bản gốc đã build trong kernel. */
const stock = (await import(STOCK)) as FsSandboxModule;
/** Lớp cha THẬT của kernel (`LocalFileSystem`), để so DANH TÍNH. */
const kernelFsLocal = (await import(KERNEL_FS_LOCAL)) as { LocalFileSystem: unknown };

/** Thư mục làm việc CÓ THẬT, đã chuẩn tắc hoá (macOS: /var → /private/var). */
const WS = await realpath(await mkdtemp(join(tmpdir(), "gbh-fs-sandbox-ws-")));
/** Đích NGOÀI mọi gốc ghi được: trong repo, không nằm dưới workspace lẫn vùng tạm. */
const OUTSIDE = join(ROOT, "packages", "host", "fs-sandbox", "lib", "khong-duoc-ghi.txt");

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  await rm(WS, { recursive: true, force: true });
});

describe("row fs-sandbox · bề mặt artifact: tập export = gốc, một bundle KHÔNG đăng ký id nào", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, và id module = 0 cả hai chiều", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["SandboxedFileSystem", "default"]);
    expect(ours.default).toBe(ours.SandboxedFileSystem);
    expect(stock.default).toBe(stock.SandboxedFileSystem);
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — cả hai phép đếm đều 0.
    expect([...artifactCode.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...artifactCode.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
  });

  test("inject tĩnh, bề mặt prototype/static và LỚP CHA khớp bản gốc (cùng một thể hiện kernel)", () => {
    expect(ours.SandboxedFileSystem.inject).toEqual(stock.SandboxedFileSystem.inject);
    expect(ours.SandboxedFileSystem.inject).toEqual(["sandboxPolicy"]);
    expect(Object.getOwnPropertyNames(ours.SandboxedFileSystem.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxedFileSystem.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(ours.SandboxedFileSystem).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxedFileSystem).sort(),
    );
    // CÙNG một lớp cha ⇒ peer `dsh-fs-local` trỏ về ĐÚNG thể hiện của kernel, không phải bản sao.
    expect(Object.getPrototypeOf(ours.SandboxedFileSystem)).toBe(Object.getPrototypeOf(stock.SandboxedFileSystem));
    expect(Object.getPrototypeOf(ours.SandboxedFileSystem)).toBe(kernelFsLocal.LocalFileSystem);
  });
});

describe("row fs-sandbox · rào theo TỪNG lời gọi: đối chứng từng ca với chính bundle gốc", () => {
  test("sandboxMode đọc từ chính sách triển khai; bốn chế độ cho CÙNG kết cục ở hai bên", async () => {
    const oursH = harness("read-only", { mode: "read-only", workspaceRoot: WS });
    const stockH = harness("read-only", { mode: "read-only", workspaceRoot: WS });
    const mine = instanceOf(ours, oursH.ctx, WS);
    const theirs = instanceOf(stock, stockH.ctx, WS);
    expect(mine.sandboxMode).toBe(theirs.sandboxMode);
    expect(mine.sandboxMode).toBe("read-only");

    const inside = await mine.resolve(join(WS, "trong.txt"));
    const outside = await mine.resolve(OUTSIDE);
    const cases: SandboxPolicy[] = [
      { mode: "read-only", workspaceRoot: WS },
      { mode: "workspace-write", workspaceRoot: WS },
      { mode: "danger-full-access", workspaceRoot: WS },
    ];
    for (const policy of cases) {
      for (const target of [inside, outside]) {
        const a = await settle(async () => mine.checkedTarget(target, policy));
        const b = await settle(async () => theirs.checkedTarget(target, policy));
        expect(a).toEqual(b);
      }
    }
    // Bản đồ kết cục, để ca này không thể "xanh rỗng" nếu hai bên cùng sai.
    expect(await settle(async () => mine.checkedTarget(outside, { mode: "workspace-write", workspaceRoot: WS }))).toEqual({
      error: {
        name: "FsError",
        code: "FS_SANDBOX_DENIED",
        message: 'cannot write "' + OUTSIDE + '": file access denied under workspace-write mode',
      },
    });
    expect(await settle(async () => mine.checkedTarget(inside, { mode: "workspace-write", workspaceRoot: WS }))).toEqual({
      value: { targetKey: inside.targetKey, displayPath: inside.displayPath },
    });
    // Toàn quyền: trả ĐÚNG đích của bên gọi (cùng danh tính), không chuẩn tắc hoá lại.
    const full = await mine.checkedTarget(outside, { mode: "danger-full-access", workspaceRoot: WS });
    expect(full).toBe(outside);
  });

  test("không truyền chính sách ⇒ rơi về ctx.sandboxPolicy.resolve() (và có GỌI thật)", async () => {
    const policy: SandboxPolicy = { mode: "workspace-write", workspaceRoot: WS };
    const oursH = harness("read-only", policy);
    const stockH = harness("read-only", policy);
    const mine = instanceOf(ours, oursH.ctx, WS);
    const theirs = instanceOf(stock, stockH.ctx, WS);
    const target = await mine.resolve(join(WS, "du-phong.txt"));
    const a = await settle(async () => mine.checkedTarget(target));
    const b = await settle(async () => theirs.checkedTarget(target));
    expect(a).toEqual(b);
    expect(a).toEqual({ value: { targetKey: target.targetKey, displayPath: target.displayPath } });
    expect(oursH.resolved.length).toBeGreaterThan(0);
    expect(stockH.resolved.length).toBeGreaterThan(0);
    expect(oursH.resolved.length).toBe(stockH.resolved.length);
  });

  test("writeText qua cơ chế KẾ THỪA: trong gốc ghi được; read-only và ngoài gốc bị CHẶN trước khi chạm đĩa", async () => {
    const wsH = harness("workspace-write", { mode: "workspace-write", workspaceRoot: WS });
    const stockH = harness("workspace-write", { mode: "workspace-write", workspaceRoot: WS });
    const roH = harness("read-only", { mode: "read-only", workspaceRoot: WS });
    const mineWs = instanceOf(ours, wsH.ctx, WS);
    const theirsWs = instanceOf(stock, stockH.ctx, WS);
    const oursPath = join(WS, "ours.txt");
    const stockPath = join(WS, "stock.txt");
    const oursWrite = (await mineWs.writeText(await mineWs.resolve(oursPath), "hello")) as { operation: string; before: unknown; after: string };
    const stockWrite = (await theirsWs.writeText(await theirsWs.resolve(stockPath), "hello")) as { operation: string; before: unknown; after: string };
    expect(oursWrite.operation).toBe(stockWrite.operation);
    expect(oursWrite.before).toBe(stockWrite.before);
    expect(oursWrite.after).toBe(stockWrite.after);
    expect(await readFile(oursPath, "utf8")).toBe("hello");
    expect(await readFile(stockPath, "utf8")).toBe("hello");

    const roMine = instanceOf(ours, roH.ctx, WS);
    const deniedPath = join(WS, "bi-tu-choi.txt");
    const denied = await settle(async () => roMine.writeText(await roMine.resolve(deniedPath), "khong-duoc"));
    expect(denied.error?.code).toBe("FS_SANDBOX_DENIED");
    expect(existsSync(deniedPath)).toBe(false);

    const outsideDenied = await settle(async () => mineWs.writeText(await mineWs.resolve(OUTSIDE), "khong-duoc"));
    const outsideDeniedStock = await settle(async () => theirsWs.writeText(await theirsWs.resolve(OUTSIDE), "khong-duoc"));
    expect(outsideDenied).toEqual(outsideDeniedStock);
    expect(outsideDenied.error?.code).toBe("FS_SANDBOX_DENIED");
    expect(existsSync(OUTSIDE)).toBe(false);
  });

  test("editText: sửa được trong gốc; read-only bị chặn; tệp vắng mặt ⇒ cùng lỗi FS_NOT_FOUND", async () => {
    const wsH = harness("workspace-write", { mode: "workspace-write", workspaceRoot: WS });
    const roH = harness("read-only", { mode: "read-only", workspaceRoot: WS });
    const mineWs = instanceOf(ours, wsH.ctx, WS);
    const theirsWs = instanceOf(stock, wsH.ctx, WS);
    const oursPath = join(WS, "ours-edit.txt");
    const stockPath = join(WS, "stock-edit.txt");
    await mineWs.writeText(await mineWs.resolve(oursPath), "hello");
    await theirsWs.writeText(await theirsWs.resolve(stockPath), "hello");
    const edit: EditRequest = { oldString: "hello", newString: "hello world", replaceAll: false };
    const oursEdit = (await mineWs.editText(await mineWs.resolve(oursPath), edit)) as { version: string; before: string; after: string };
    const stockEdit = (await theirsWs.editText(await theirsWs.resolve(stockPath), edit)) as { version: string; before: string; after: string };
    // Phiên bản là token của TỪNG tệp nên khác nhau theo thiết kế; phần NỘI DUNG phải trùng.
    expect({ before: oursEdit.before, after: oursEdit.after }).toEqual({ before: stockEdit.before, after: stockEdit.after });
    expect(typeof oursEdit.version).toBe("string");
    expect(typeof stockEdit.version).toBe("string");
    expect(oursEdit.after).toBe("hello world");
    expect(await readFile(oursPath, "utf8")).toBe("hello world");

    const roMine = instanceOf(ours, roH.ctx, WS);
    const roStock = instanceOf(stock, roH.ctx, WS);
    const deniedOurs = await settle(async () => roMine.editText(await roMine.resolve(oursPath), edit));
    const deniedStock = await settle(async () => roStock.editText(await roStock.resolve(oursPath), edit));
    expect(deniedOurs).toEqual(deniedStock);
    expect(deniedOurs.error?.code).toBe("FS_SANDBOX_DENIED");

    const missing = join(WS, "vang-mat.txt");
    const missingOurs = await settle(async () => mineWs.editText(await mineWs.resolve(missing), edit));
    const missingStock = await settle(async () => theirsWs.editText(await theirsWs.resolve(missing), edit));
    expect(missingOurs).toEqual(missingStock);
    expect(missingOurs.error?.name).toBe("FsError");
    expect(missingOurs.error?.message.length).toBeGreaterThan(0);
  });
});

describe("row fs-sandbox · C6: vật thể trả về ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("mỗi lượt rào sinh đích MỚI: bằng giá trị nhưng KHÁC danh tính, sửa bản này không lan sang bản kia", async () => {
    for (const module of [ours, stock]) {
      const h = harness("workspace-write", { mode: "workspace-write", workspaceRoot: WS });
      const fs = instanceOf(module, h.ctx, WS);
      const target = await fs.resolve(join(WS, "c6.txt"));
      const one = await fs.checkedTarget(target, { mode: "workspace-write", workspaceRoot: WS });
      const two = await fs.checkedTarget(target, { mode: "workspace-write", workspaceRoot: WS });
      expect(one).toEqual(two);
      expect(one).not.toBe(two);
      (one as { displayPath: string }).displayPath = "DA-DOI";
      expect(two.displayPath).not.toBe("DA-DOI");
    }
  });

  test("hai thực thể KHÔNG chia sẻ vật thể cấu hình; cùng thực thể thì ĐÚNG một thể hiện", async () => {
    for (const module of [ours, stock]) {
      const h = harness("workspace-write", { mode: "workspace-write", workspaceRoot: WS });
      const first = instanceOf(module, h.ctx, WS);
      const second = instanceOf(module, h.ctx, WS);
      // ĐỐI CHỨNG DƯƠNG: cùng thực thể thì tra hai lần ra ĐÚNG một vật thể.
      expect(first.config).toBe(first.config);
      // DANH TÍNH (không phải so sâu): hai thực thể độc lập, sửa vật này không lan sang vật kia.
      expect(first.config).not.toBe(second.config);
      expect(first.config).toEqual(second.config);
      first.config.cwd = "da-doi";
      expect(second.config.cwd).toBe(WS);
    }
  });
});

describe("row fs-sandbox · 000e locale chép byte-for-byte từ gói gốc", () => {
  test("locale en/zh khớp TỪNG BYTE, và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const oursBytes = readFileSync(join(PKG, "locale", locale));
      const theirsBytes = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(oursBytes.equals(theirsBytes)).toBe(true);
    }
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    expect(en.meta?.title).toBe("fs-sandbox");
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ cần lúc chạy: kernel cấp ĐÚNG MỘT thể hiện cho mỗi tên. */
const RUNTIME_PEERS = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-fs",
  "@deepseek-ai/dsh-fs-local",
  "@deepseek-ai/dsh-sandbox",
  "@deepseek-ai/dsh-sandbox-policy",
];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  exports?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
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
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("row fs-sandbox · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...(manifest.gbh?.peers ?? [])].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, khớp phiên bản, và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      const declared = manifest.peerDependencies?.[peer] ?? "";
      expect(declared.length).toBeGreaterThan(0);
      const floor = declared.replace(/^[~^]/, "").split(".").slice(0, 2).join(".");
      expect(kernel.version.startsWith(floor)).toBe(true);
      expect(deps.has(peer)).toBe(false);
      expect(manifest.devDependencies?.[peer]).toBe(declared);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau vẫn PHẢI bị bắt", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    mutated.gbh = { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] };
    mutated.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5", "@deepseek-ai/dsh-fs": "0.2.1-alpha.4" };
    expect(mutated.gbh.peers?.length).toBe(Object.keys(mutated.peerDependencies).length);
    expect(missingPeers(mutated)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});
