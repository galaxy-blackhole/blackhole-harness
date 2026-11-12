/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-atomic-write: mỗi ca chạy CẢ HAI bản (gói của ta và bundle
 *      gốc @deepseek-ai/dsh-atomic-write) trên THƯ MỤC TẠM THẬT, so hành vi ghi nguyên tử (tạo thư mục cha,
 *      bit quyền sau rename, không để lại .tmp), thay đích là symlink, dọn tệp tạm khi lỗi, và khoá người ghi
 *      liên tiến trình (tuần tự hoá, nhả khoá cả hai kết cục, hết hạn chờ, bàn giao khoá của chủ đã chết, huỷ).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/atomic-write/build.ts";
import * as ours from "../../packages/host/atomic-write/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "atomic-write");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-atomic-write", "lib", "index.js");

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as typeof ours;

/** Tên export của một file ESM đã build. */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  return [...names].sort();
}

/**
 * Chạy MỘT phép trên CẢ HAI bản trong HAI thư mục tạm riêng, trả kết quả để so.
 * Nhận: hàm nhận (thư viện, thư mục tạm).
 * Trả: hai kết quả.
 */
async function ab(run: (lib: typeof ours, dir: string) => Promise<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const lib of [ours, stock]) {
    const dir = mkdtempSync(join(tmpdir(), "gbh-aw-"));
    try {
      out.push(await run(lib, dir));
    } catch (error) {
      out.push("ERR: " + (error as Error).message);
    }
  }
  return out;
}

/** Bit quyền của một tệp (8 bit thấp). */
function modeOf(path: string): number {
  return statSync(path).mode & 0o777;
}

describe("bề mặt + writeFileAtomic", () => {
  test("tập export TRÙNG bản gốc (2 tên)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-aw-build-")));
    const ourText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(ourText)).toEqual(exportNames(stockText));
    expect(exportNames(ourText)).toEqual(["withFileLock", "writeFileAtomic"]);
    expect(typeof ours.writeFileAtomic).toBe("function");
    expect(typeof ours.withFileLock).toBe("function");
  });

  test("ghi nội dung + TẠO thư mục cha lồng nhiều cấp; không để lại .tmp", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "a", "b", "c", "file.txt");
      await lib.writeFileAtomic(target, "noi-dung", { mode: 0o600 });
      return { content: readFileSync(target, "utf8"), leftovers: readdirSync(join(dir, "a", "b", "c")) };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ content: "noi-dung", leftovers: ["file.txt"] });
  });

  test("bit quyền ĐÚNG sau rename: tạo mới 0o600 · thay tệp 0o644 thì THU HẸP còn 0o600", async () => {
    const traces = await ab(async (lib, dir) => {
      const fresh = join(dir, "fresh.txt");
      await lib.writeFileAtomic(fresh, "x", { mode: 0o600 });
      const narrowed = join(dir, "narrow.txt");
      writeFileSync(narrowed, "cu", { mode: 0o644 });
      await chmod(narrowed, 0o644);
      await lib.writeFileAtomic(narrowed, "moi", { mode: 0o600 });
      return { fresh: modeOf(fresh), narrowed: modeOf(narrowed), content: readFileSync(narrowed, "utf8") };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ fresh: 0o600, narrowed: 0o600, content: "moi" });
  });

  test("đích là SYMLINK thì thay chính symlink, KHÔNG ghi xuyên qua tới referent", async () => {
    const traces = await ab(async (lib, dir) => {
      const referent = join(dir, "that.txt");
      writeFileSync(referent, "goc");
      const link = join(dir, "link.txt");
      symlinkSync(referent, link);
      await lib.writeFileAtomic(link, "moi", { mode: 0o600 });
      return {
        referent: readFileSync(referent, "utf8"),
        linkIsFile: statSync(link).isFile(),
        linkContent: readFileSync(link, "utf8"),
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ referent: "goc", linkIsFile: true, linkContent: "moi" });
  });

  test("nội dung NHỊ PHÂN đi qua nguyên vẹn", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "bin.dat");
      await lib.writeFileAtomic(target, new Uint8Array([0, 1, 2, 255]), { mode: 0o600 });
      return [...readFileSync(target)];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([0, 1, 2, 255]);
  });

  test("LỖI khi ghi thì tệp tạm bị DỌN và lỗi được ném lại (thư mục chỉ-đọc)", async () => {
    const traces = await ab(async (lib, dir) => {
      const locked = join(dir, "locked");
      const target = join(locked, "file.txt");
      await lib.writeFileAtomic(target, "x", { mode: 0o600 });
      await chmod(locked, 0o500);
      let message = "KHONG NEM";
      try {
        await lib.writeFileAtomic(target, "moi", { mode: 0o600 });
      } catch (error) {
        message = (error as Error).message;
      } finally {
        await chmod(locked, 0o700);
      }
      return { threw: message !== "KHONG NEM", leftovers: readdirSync(locked) };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ threw: true, leftovers: ["file.txt"] });
  });
});

describe("withFileLock — khoá người ghi liên tiến trình", () => {
  test("tuần tự hoá HAI thao tác trên cùng tệp và nhả khoá sau khi xong", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "seq.txt");
      const order: string[] = [];
      const first = lib.withFileLock(target, async () => {
        order.push("vao-1");
        await new Promise((resolve) => setTimeout(resolve, 15));
        order.push("ra-1");
        return 1;
      });
      const second = lib.withFileLock(target, async () => {
        order.push("vao-2");
        order.push("ra-2");
        return 2;
      });
      const results = await Promise.all([first, second]);
      return { order, results, lockLeft: existsSync(target + ".lock") };
    });
    // BÊN NÀO LẤY KHOÁ TRƯỚC là KHÔNG xác định (cả hai lần gọi đều async) ⇒ KHÔNG so thứ tự thô giữa hai bản
    // (sẽ flaky); thay vào đó kiểm BẤT BIẾN trên TỪNG bản: thứ tự phải là MỘT trong hai chuỗi tuần tự hợp lệ,
    // tức KHÔNG BAO GIỜ chồng nhau.
    const allowed = [
      ["vao-1", "ra-1", "vao-2", "ra-2"],
      ["vao-2", "ra-2", "vao-1", "ra-1"],
    ];
    for (const trace of traces) expect(allowed).toContainEqual((trace as { order: string[] }).order);
    expect(traces.map((trace) => (trace as { results: number[] }).results)).toEqual([[1, 2], [1, 2]]);
    expect(traces.map((trace) => (trace as { lockLeft: boolean }).lockLeft)).toEqual([false, false]);
  });

  test("thao tác NÉM thì lỗi được ném lại VÀ khoá vẫn được nhả", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "throw.txt");
      let message = "KHONG NEM";
      try {
        await lib.withFileLock(target, async () => {
          throw new Error("loi-trong-thao-tac");
        });
      } catch (error) {
        message = (error as Error).message;
      }
      return { message, lockLeft: existsSync(target + ".lock") };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ message: "loi-trong-thao-tac", lockLeft: false });
  });

  test("khoá do TIẾN TRÌNH CÒN SỐNG giữ thì hết hạn chờ với CÙNG thông điệp", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "busy.txt");
      writeFileSync(target + ".lock", String(process.pid) + "\n");
      let message = "KHONG NEM";
      try {
        await lib.withFileLock(target, async () => 1, { waitMs: 60 });
      } catch (error) {
        message = (error as Error).message;
      }
      return { message, lockKept: existsSync(target + ".lock") };
    });
    // Thông điệp chứa ĐƯỜNG DẪN TUYỆT ĐỐI của thư mục tạm (khác nhau giữa hai giàn) ⇒ so phần ĐUÔI.
    const normalize = (value: string): string => value.replace(/at .*$/u, "at <path>");
    expect(normalize((traces[0] as { message: string }).message)).toBe(
      normalize((traces[1] as { message: string }).message),
    );
    expect((traces[0] as { message: string }).message).toContain("atomic-write: timed out waiting for the writer lock at ");
    expect((traces[0] as { lockKept: boolean }).lockKept).toBe(true);
  });

  test("khoá của chủ ĐÃ CHẾT (PID không tồn tại) thì BÀN GIAO rồi chạy thao tác", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "dead.txt");
      writeFileSync(target + ".lock", "2147483646\n");
      const value = await lib.withFileLock(target, async () => "da-chay", { waitMs: 300 });
      return { value, lockLeft: existsSync(target + ".lock") };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ value: "da-chay", lockLeft: false });
  });

  test("tín hiệu ĐÃ HUỶ thì ném NGAY, không tạo khoá", async () => {
    const traces = await ab(async (lib, dir) => {
      const target = join(dir, "abort.txt");
      const controller = new AbortController();
      controller.abort(new Error("huy-truoc"));
      let message = "KHONG NEM";
      try {
        await lib.withFileLock(target, async () => 1, { signal: controller.signal });
      } catch (error) {
        message = (error as Error).message;
      }
      return { message, lockLeft: existsSync(target + ".lock") };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ message: "huy-truoc", lockLeft: false });
  });

  test("HAI bản chia sẻ CÙNG giao thức khoá trên một tệp: không giẫm lên nhau", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-aw-share-"));
    const target = join(dir, "shared.txt");
    const order: string[] = [];
    const first = ours.withFileLock(target, async () => {
      order.push("ours-vao");
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("ours-ra");
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = stock.withFileLock(target, async () => {
      order.push("stock-vao");
      order.push("stock-ra");
    });
    await Promise.all([first, second]);
    expect(order).toEqual(["ours-vao", "ours-ra", "stock-vao", "stock-ra"]);
    expect(existsSync(target + ".lock")).toBe(false);
  });
});

describe("quy ước repo — thư viện, KHÔNG mount", () => {
  test("không gbh.row + lý do + dependencies RỖNG + 0 entry trong dump", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string; row_unmounted_ly_do?: string };
      dependencies?: Record<string, string>;
    };
    expect(json.gbh?.row).toBe(undefined);
    // task-165: park đã chuyển thành draft (không còn marker park).
    expect(json.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect((json.gbh?.draft ?? "").includes("KHÔNG PHẢI ROW")).toBe(true);
    expect(json.gbh?.tests).toEqual(["tests/host/atomic-write.test.ts"]);
    expect(json.gbh?.peers).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
    const dump = readFileSync(join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml"), "utf8");
    expect(dump.includes("dsh-atomic-write")).toBe(false);
    const stockText = readFileSync(STOCK, "utf8");
    expect(stockText.includes("export { withFileLock, writeFileAtomic }")).toBe(true);
    expect(stockText.includes("function apply")).toBe(false);
  });
});
