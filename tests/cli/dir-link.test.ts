/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/11/2026
 * desc Test hồi quy cho ensureDirLink (apps/cli/src/link-dir.ts): link GÃY trong profile phải được TỰ CHỮA.
 *      Đúng lỗi thật của bản prod "Galaxy Blackhole": profile giữ symlink tuyệt đối vào
 *      "Galaxy Blackhole (Preview).app"; app đổi tên ⇒ đích biến mất ⇒ flock.js của gbh-node-addon-system
 *      không resolve được @deepseek-ai/node-addon-system-darwin-x64 ⇒ "resume failed for session …".
 */

import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ensureDirLink } from "../../apps/cli/src/link-dir.ts";

/**
 * Gốc tạm của phép đo.
 * 22/11/2026 — REALPATH NGAY sau khi tạo: trên macOS `tmpdir()` trả `/var/…` còn `realpathSync` trả
 * `/private/var/…`; hai chuỗi khác nhau cho CÙNG một thư mục làm phép so sánh đích trong ensureDirLink
 * báo "trỏ sai" một cách giả tạo.
 */
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "gbh-dir-link-")));

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Dựng (và trả) một thư mục con trong gốc tạm.
 * @param parts - các thành phần đường dẫn tương đối dưới {@link ROOT}.
 * @returns đường dẫn tuyệt đối của thư mục vừa tạo.
 */
function makeDir(...parts: readonly string[]): string {
  const dir = join(ROOT, ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Dựng một gói tối thiểu (chỉ `package.json`) để phép đo `require.resolve` chạy được.
 * @param dir - thư mục gói.
 * @param name - tên gói ghi vào manifest.
 * @returns đường dẫn thư mục gói.
 */
function makePackage(dir: string, name: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "0.0.0", main: "index.js" }));
  writeFileSync(join(dir, "index.js"), "export const OK = true;\n");
  return dir;
}

describe("ensureDirLink — liên kết thư mục tự chữa", () => {
  test("chưa có gì ⇒ created và link phân giải đúng nguồn", () => {
    const source = makePackage(join(ROOT, "nguon-a", "pkg"), "pkg-a");
    const link = join(ROOT, "profile-a", "@deepseek-ai", "pkg-a");
    expect(ensureDirLink(source, link)).toBe("created");
    expect(realpathSync(link)).toBe(realpathSync(source));
  });

  test("gọi lần hai ⇒ unchanged (không dựng lại link mỗi lượt boot)", () => {
    const source = makePackage(join(ROOT, "nguon-b", "pkg"), "pkg-b");
    const link = join(ROOT, "profile-b", "@deepseek-ai", "pkg-b");
    expect(ensureDirLink(source, link)).toBe("created");
    expect(ensureDirLink(source, link)).toBe("unchanged");
    expect(realpathSync(link)).toBe(realpathSync(source));
  });

  test("link GÃY (đích cũ đã biến mất) ⇒ repaired, không phải EEXIST im lặng", () => {
    // Đây chính là trạng thái profile prod: link trỏ bản .app đã đổi tên.
    const cu = makePackage(join(ROOT, "app-cu", "addon"), "addon-cu");
    const link = join(ROOT, "profile-c", "@deepseek-ai", "addon");
    mkdirSync(join(ROOT, "profile-c", "@deepseek-ai"), { recursive: true });
    symlinkSync(cu, link, "dir");
    rmSync(cu, { recursive: true, force: true });
    expect(existsSync(link)).toBe(false);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);

    const moi = makePackage(join(ROOT, "app-moi", "addon"), "addon-moi");
    expect(ensureDirLink(moi, link)).toBe("repaired");
    expect(realpathSync(link)).toBe(realpathSync(moi));
  });

  test("link trỏ SAI nhưng đích cũ còn sống ⇒ repaired về nguồn đang chạy", () => {
    const sai = makePackage(join(ROOT, "app-khac", "pkg"), "pkg-sai");
    const link = join(ROOT, "profile-d", "@deepseek-ai", "pkg");
    mkdirSync(join(ROOT, "profile-d", "@deepseek-ai"), { recursive: true });
    symlinkSync(sai, link, "dir");
    const dung = makePackage(join(ROOT, "app-dung", "pkg"), "pkg-dung");
    expect(ensureDirLink(dung, link)).toBe("repaired");
    expect(realpathSync(link)).toBe(realpathSync(dung));
  });

  test("thư mục THẬT (bản mount đã chép) ⇒ blocked, không xoá dữ liệu", () => {
    const source = makePackage(join(ROOT, "nguon-e", "pkg"), "pkg-e");
    const that = makeDir("profile-e", "@deepseek-ai", "pkg");
    writeFileSync(join(that, "package.json"), JSON.stringify({ name: "pkg-mount" }));
    expect(ensureDirLink(source, that)).toBe("blocked");
    expect(JSON.parse(readFileSync(join(that, "package.json"), "utf8")).name).toBe("pkg-mount");
  });

  test("đúng lỗi prod: require.resolve của flock.js chỉ chạy sau khi chữa link gãy", () => {
    const spec = "@deepseek-ai/node-addon-system-darwin-x64";
    const modules = join(ROOT, "profile-f", "node_modules");
    // Bản .app CŨ (đã đổi tên ⇒ không còn trên đĩa) — đường dẫn link gãy trỏ tới.
    const appCu = join(ROOT, "Galaxy Blackhole (Preview).app", "Contents", "Resources", "host");
    mkdirSync(appCu, { recursive: true });
    mkdirSync(join(modules, "@deepseek-ai"), { recursive: true });
    const link = join(modules, spec);
    symlinkSync(join(appCu, "addon"), link, "dir");
    rmSync(appCu, { recursive: true, force: true });

    // flock.js thật gọi createRequire(import.meta.url).resolve("<spec>/package.json") từ TRONG profile.
    const require = createRequire(join(modules, "flock.js"));
    expect(() => require.resolve(spec + "/package.json")).toThrow();

    // Bản .app MỚI có gói addon native.
    const appMoi = join(ROOT, "Galaxy Blackhole.app", "Contents", "Resources", "host");
    const nguon = makePackage(join(appMoi, "node_modules", "@deepseek-ai", "node-addon-system-darwin-x64"), spec);
    mkdirSync(join(nguon, "bin"), { recursive: true });
    writeFileSync(join(nguon, "bin", "system.node"), "");

    expect(ensureDirLink(nguon, link)).toBe("repaired");
    expect(require.resolve(spec + "/package.json")).toBe(join(realpathSync(nguon), "package.json"));
    expect(require.resolve(spec + "/bin/system.node")).toBe(join(realpathSync(nguon), "bin", "system.node"));
  });
});
