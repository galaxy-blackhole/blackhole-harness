/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test 1:1 cho @galaxy-blackhole/gbh-host-directory-picker-browse: bề mặt export · fullyQualified posix/win32 ·
 *      boundedInsert (cửa sổ/evict) · raceAbort (huỷ trước & giữa chừng) · class list/createDirectory trên
 *      thư mục tạm · locale byte-equal với bản gốc. KHÔNG mount.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chuanHoaHost, soByte } from "../lib/artefact-normalize.ts";
import { mkdtemp, mkdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import BrowseDirectoryPickerDefault, {
  BrowseDirectoryPicker,
  DirectoryPickerError,
  boundedInsert,
  fullyQualified,
  raceAbort,
  type DirectoryRow,
} from "../../packages/host/host-directory-picker-browse/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói gốc (CHỈ ĐỌC) — oracle cho locale + số dòng. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-directory-picker-browse");

describe("bề mặt export 1:1 + locale byte-equal", () => {
  test("default là class; 3 hàm + 2 export kiểu như bản gốc", () => {
    expect(typeof BrowseDirectoryPickerDefault).toBe("function");
    expect(BrowseDirectoryPickerDefault).toBe(BrowseDirectoryPicker);
    expect(typeof boundedInsert).toBe("function");
    expect(typeof fullyQualified).toBe("function");
    expect(typeof raceAbort).toBe("function");
    expect(typeof DirectoryPickerError).toBe("function");
  });

  test("locale en/zh BYTE-EQUAL bản gốc (59 + 158 B)", async () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(REPO, "packages", "host", "host-directory-picker-browse", "locale", name));
      const stock = await readFile(join(STOCK, "locale", name));
      expect(ours.equals(stock)).toBe(true);
      expect(ours.byteLength).toBe(stock.byteLength);
    }
    expect((await readFile(join(STOCK, "locale", "en.json"))).byteLength).toBe(59);
    expect((await readFile(join(STOCK, "locale", "zh.json"))).byteLength).toBe(158);
  });
});

describe("fullyQualified", () => {
  test("POSIX: chỉ đường dẫn tuyệt đối", () => {
    expect(fullyQualified("/home/a", "linux")).toBe(true);
    expect(fullyQualified("home/a", "linux")).toBe(false);
    expect(fullyQualified("", "linux")).toBe(false);
  });

  test("win32: chỉ dạng có ổ đĩa hoặc UNC ĐẦY ĐỦ", () => {
    expect(fullyQualified("C:\\\\Users\\\\a", "win32")).toBe(true);
    expect(fullyQualified("C:/Users/a", "win32")).toBe(true);
    expect(fullyQualified("\\\\server\\share\\x", "win32")).toBe(true);
    expect(fullyQualified("\\foo", "win32")).toBe(false);
    expect(fullyQualified("/foo", "win32")).toBe(false);
    expect(fullyQualified("\\\\", "win32")).toBe(false);
    expect(fullyQualified("\\\\server", "win32")).toBe(false);
  });
});

describe("boundedInsert — cửa sổ sắp tên, chặn bộ nhớ", () => {
  const candidate = (name: string): { name: string; isDirectory: boolean; isSymbolicLink: boolean } => ({ name, isDirectory: true, isSymbolicLink: false });

  test("giữ cửa sổ đúng keep, evict tên LỚN NHẤT, trả true khi có eviction", () => {
    const window: { name: string; isDirectory: boolean; isSymbolicLink: boolean }[] = [];
    expect(boundedInsert(window, candidate("b"), 3)).toBe(false);
    expect(boundedInsert(window, candidate("a"), 3)).toBe(false);
    expect(boundedInsert(window, candidate("c"), 3)).toBe(false);
    expect(window.map((item) => item.name)).toEqual(["a", "b", "c"]);
    // "d" lớn hơn mọi tên trong cửa sổ ⇒ bị loại ngay (vẫn báo đã có eviction)
    expect(boundedInsert(window, candidate("d"), 3)).toBe(true);
    expect(window.map((item) => item.name)).toEqual(["a", "b", "c"]);
    // "aa" chen vào giữa và đẩy "c" ra
    expect(boundedInsert(window, candidate("aa"), 3)).toBe(true);
    expect(window.map((item) => item.name)).toEqual(["a", "aa", "b"]);
  });
});

describe("raceAbort", () => {
  test("không có signal ⇒ await thường", async () => {
    await expect(raceAbort(Promise.resolve(7))).resolves.toBe(7);
  });

  test("signal đã abort ⇒ reject NGAY theo reason", async () => {
    const controller = new AbortController();
    controller.abort(new Error("huy-truoc"));
    const pending = new Promise<number>(() => undefined);
    await expect(raceAbort(pending, controller.signal)).rejects.toThrow("huy-truoc");
  });

  test("abort giữa chừng ⇒ reject theo reason, không unhandled rejection", async () => {
    const controller = new AbortController();
    const pending = new Promise<number>((resolveValue) => setTimeout(() => resolveValue(1), 50));
    const racing = raceAbort(pending, controller.signal);
    setTimeout(() => controller.abort(new Error("huy-giua-chung")), 5);
    await expect(racing).rejects.toThrow("huy-giua-chung");
  });
});

describe("BrowseDirectoryPicker — list/createDirectory trên thư mục tạm", () => {
  let root = "";
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "gbh-dp-browse-"));
    await mkdir(join(root, "Alpha"));
    await mkdir(join(root, ".hidden"));
    await mkdir(join(root, "beta"));
  });
  afterAll(async () => { if (root !== "") await rm(root, { recursive: true, force: true }); });

  test("capability() trả kind=browse + đủ 2 hàm", () => {
    const picker = new BrowseDirectoryPicker({});
    const capability = picker.capability() as { kind: string; list: unknown; createDirectory: unknown };
    expect(capability.kind).toBe("browse");
    expect(typeof capability.list).toBe("function");
    expect(typeof capability.createDirectory).toBe("function");
  });

  test("list(): sắp TÊN, cờ hidden, crumbs từ gốc, truncated=false", async () => {
    const picker = new BrowseDirectoryPicker({});
    const listing = await picker.list(root);
    expect(listing.path).toBe(root);
    expect(listing.entries.map((row: DirectoryRow) => row.name)).toEqual([".hidden", "Alpha", "beta"]);
    expect(listing.entries[0]?.hidden).toBe(true);
    expect(listing.entries[1]?.hidden).toBe(false);
    expect(listing.crumbs.at(-1)?.path).toBe(root);
    expect(listing.truncated).toBe(false);
  });

  test("list(): maxEntries chặn số dòng + bật truncated", async () => {
    const picker = new BrowseDirectoryPicker({}, { maxEntries: 2 });
    const listing = await picker.list(root);
    expect(listing.entries.length).toBe(2);
    expect(listing.truncated).toBe(true);
  });

  test("list(): đường dẫn tương đối ⇒ directory-unreadable", async () => {
    const picker = new BrowseDirectoryPicker({});
    await expect(picker.list("relative/path")).rejects.toBeInstanceOf(DirectoryPickerError);
    try { await picker.list("relative/path"); } catch (error) {
      expect((error as DirectoryPickerError).code).toBe("directory-unreadable");
    }
  });

  test("createDirectory(): tạo thật; trùng tên ⇒ directory-exists; tên nhiều segment ⇒ directory-create-failed", async () => {
    const picker = new BrowseDirectoryPicker({});
    const created = await picker.createDirectory(root, "gamma");
    expect(created).toBe(join(root, "gamma"));
    await expect(picker.createDirectory(root, "gamma")).rejects.toMatchObject({ code: "directory-exists" });
    await expect(picker.createDirectory(root, "a/b")).rejects.toMatchObject({ code: "directory-create-failed" });
    await expect(picker.createDirectory(root, "..")).rejects.toMatchObject({ code: "directory-create-failed" });
  });
});
