/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-headless: 3 tệp NGUYÊN VĂN byte-identical (index · startup ·
 *      json-stream chunk thuần hàm), exports mirror stock, argv/help của startup, provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleHostParts } from "../../packages/host/headless/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-headless");
/** Gói ta. */
const OURS = join(REPO, "packages/host/headless");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact byte-identical (cổng byte delta 0)", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib/index.js")))).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("lib/startup.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/startup.js")).equals(readFileSync(join(STOCK, "lib/startup.js")))).toBe(true);
  });

  test("json-stream chunk (thuần hàm) trùng TỪNG BYTE", () => {
    const file = "json-stream-BA-F3lfb.js";
    expect(readFileSync(join(OURS, "lib", file)).equals(readFileSync(join(STOCK, "lib", file)))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib", file)))).toBe(sha(readFileSync(join(STOCK, "lib", file))));
  });

  test("assembleHostParts(part-index / part-startup) + newline === stock", () => {
    expect(assembleHostParts("part-index") + "\n").toBe(readFileSync(join(STOCK, "lib/index.js"), "utf8"));
    expect(assembleHostParts("part-startup") + "\n").toBe(readFileSync(join(STOCK, "lib/startup.js"), "utf8"));
  });
});

describe("B · exports mirror stock + import tĩnh", () => {
  test("exports khớp các subpath RUNTIME của stock (bỏ ./src/*)", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { exports: Record<string, string> };
    for (const key of Object.keys(stock.exports)) {
      if (key === "./src/*") continue;
      expect(Object.keys(ours.exports)).toContain(key);
    }
  });

  test("startup argv/help: các cờ BẮT BUỘC có mặt ở CẢ HAI bản (văn bản)", () => {
    const ours = readFileSync(join(OURS, "lib/startup.js"), "utf8");
    const stock = readFileSync(join(STOCK, "lib/startup.js"), "utf8");
    for (const token of ["--session-id <id>", "--json", "-h, --help", "[task...]"]) {
      expect(ours.includes(token)).toBe(stock.includes(token));
      expect(ours.includes(token)).toBe(true);
    }
  });

  test("json-stream: hằng/ký hiệu thuần hàm A≡B (boundJsonLine · projectJsonRun)", () => {
    const ours = readFileSync(join(OURS, "lib/json-stream-BA-F3lfb.js"), "utf8");
    const stock = readFileSync(join(STOCK, "lib/json-stream-BA-F3lfb.js"), "utf8");
    expect(ours).toBe(stock);
    for (const token of ["boundJsonLine", "projectJsonRun"]) expect(ours.includes(token)).toBe(true);
  });
});

describe("C · metadata gói", () => {
  test("provenance khai stock đúng + 3 tệp hostFiles", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; hostFiles?: Record<string, number> } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-headless");
    expect(m.gbh.provenance?.hostFiles?.["lib/index.js"]).toBe(387);
    expect(m.gbh.provenance?.hostFiles?.["lib/json-stream.js"]).toBe(280);
    expect(m.gbh.provenance?.hostFiles?.["lib/startup.js"]).toBe(93);
  });

  test("khai dsh.bundle.patch (gói patch, KHÔNG phải row) + cordis.patch.yml 44 dòng giữ nguyên", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { dsh?: { bundle?: { patch?: string } }; gbh?: Record<string, unknown> };
    expect(m.dsh?.bundle?.patch).toBe("./cordis.patch.yml");
    expect(m.gbh?.["row"]).toBeUndefined();
    const patchLines = readFileSync(join(OURS, "cordis.patch.yml"), "utf8").split("\n").length - 1;
    expect(patchLines).toBeGreaterThanOrEqual(44);
  });
});
