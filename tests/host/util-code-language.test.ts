/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-util-code-language: so TOÀN BỘ bảng + hai hàm trên cùng danh sách
 *      đường dẫn với bundle gốc @deepseek-ai/dsh-util-code-language.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  CODE_HIGHLIGHT_EXTENSIONS as oursExtensions,
  languageForPath as oursLanguage,
  readLangHintForPath as oursHint,
} from "../../packages/host/util-code-language/src/index.ts";

/** Bundle gốc trong cây cài của kernel. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-util-code-language", "lib", "index.js");

/** Bề mặt module hai bản. */
interface Surface {
  CODE_HIGHLIGHT_EXTENSIONS: readonly string[];
  languageForPath(path: string): string | undefined;
  readLangHintForPath(path: string): string | undefined;
}

/**
 * Nạp bundle gốc như ESM thật để A/B cùng môi trường.
 * Nhận: không.
 * Trả: module bản gốc.
 */
async function stock(): Promise<Surface> {
  return (await import(STOCK)) as Surface;
}

describe("util-code-language — bề mặt export", () => {
  test("export 3 = 3 đúng tên như bản gốc", async () => {
    const theirs = await stock();
    expect(Object.keys(theirs).sort()).toEqual(["CODE_HIGHLIGHT_EXTENSIONS", "languageForPath", "readLangHintForPath"]);
    expect(Array.isArray(oursExtensions)).toBe(true);
    expect(typeof oursLanguage).toBe("function");
    expect(typeof oursHint).toBe("function");
  });
});

describe("util-code-language — bảng dữ liệu chép NGUYÊN VĂN", () => {
  test("CODE_HIGHLIGHT_EXTENSIONS là DANH SÁCH đuôi, BẰNG NHAU từng phần tử và đúng thứ tự", async () => {
    const theirs = await stock();
    expect([...oursExtensions]).toEqual([...theirs.CODE_HIGHLIGHT_EXTENSIONS]);
    expect(oursExtensions.length).toBeGreaterThan(60);
    expect(new Set(oursExtensions).size).toBe(oursExtensions.length);
  });

  test("MỌI đuôi trong danh sách đều phân giải được và hai bản cho cùng mã ngôn ngữ", async () => {
    const theirs = await stock();
    for (const extension of oursExtensions) {
      const path = "file." + extension;
      expect({ extension, language: oursLanguage(path) }).toEqual({ extension, language: theirs.languageForPath(path) });
      expect(oursLanguage(path)).toBeDefined();
      expect({ extension, hint: oursHint(path) }).toEqual({ extension, hint: theirs.readLangHintForPath(path) });
    }
  });
});

describe("util-code-language — languageForPath / readLangHintForPath A/B", () => {
  const paths = [
    "main.ts", "main.tsx", "a.MTS", "b.cts", "x.js", "x.jsx", "x.mjs", "x.cjs",
    "run.sh", "run.bash", "run.zsh", "x.fish", "x.json", "x.jsonc", "x.jsonl",
    "notes.md", "notes.markdown", "page.html", "style.css", "style.scss", "q.sql", "p.xml", "l.lua",
    "s.ps1", "s.bat", "r.r", "j.jl", "d.dart", "s.scala", "c.clj", "e.erl", "e.ex", "h.hs", "f.fs", "v.vb",
    "p.pl", "v.v", "sv.sv", "g.graphql", "pr.proto", "h.hcl", "n.nix", "v.vue", "s.svelte", "M.make",
    "CMakeLists.cmake", "g.groovy", "doc.txt", "bin.exe", "noext", ".env", ".gitignore", "dir/main.ts",
    "dir\\main.PS1", "C:\\dir\\main.ts", "a.b.c.ts", "foo.constructor", "foo.__proto__", "", ".", "..", "a.",
    "/abs/path/to/file.TSX", "sub/dir/üñï.ts",
  ];

  test("mọi đường dẫn cho CÙNG kết quả giữa hai bản (cả hai hàm)", async () => {
    const theirs = await stock();
    for (const path of paths) {
      expect({ path, language: oursLanguage(path) }).toEqual({ path, language: theirs.languageForPath(path) });
      expect({ path, hint: oursHint(path) }).toEqual({ path, hint: theirs.readLangHintForPath(path) });
    }
  });

  test("an toàn prototype: đuôi trùng khoá Object.prototype KHÔNG phân giải ra thành viên kế thừa", async () => {
    const theirs = await stock();
    for (const path of ["foo.constructor", "foo.__proto__", "foo.toString", "foo.hasOwnProperty"]) {
      expect(oursLanguage(path)).toBeUndefined();
      expect(theirs.languageForPath(path)).toBeUndefined();
      expect(oursHint(path)).toBeUndefined();
    }
  });

  test("ca đặc tả của bản gốc: .env ⇒ dotenv, .gitignore ⇒ undefined, không đuôi ⇒ undefined, hai dấu phân cách", async () => {
    expect(oursLanguage(".env")).toBe("dotenv");
    expect(oursLanguage(".gitignore")).toBeUndefined();
    expect(oursLanguage("noext")).toBeUndefined();
    expect(oursLanguage("C:\\dir\\main.PS1")).toBe(oursLanguage("dir/main.ps1"));
    expect(oursHint("main.tsx")).toBe(oursHint("main.tsx"));
  });
});
