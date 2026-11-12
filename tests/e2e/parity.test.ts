/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test logic của giàn parity: chuẩn hoá dump, diff theo row id, ngưỡng pixel, mint cookie — không cần server
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cookieNameForAuthority,
  decodeBase64Url,
  encodeBase64Url,
  hashList,
  mintSessionCookie,
  normaliseAsset,
  readBrowserSessionSecret,
  resolveSessionCookieFrom,
} from "../../tools/parity/lib/browser.ts";
import {
  DEFAULT_VOLATILE_KEYS,
  PATH_TOKEN,
  SECRET_TOKEN,
  VOLATILE_TOKEN,
  diffDumps,
  diffRow,
  formatDumpDiff,
  formatPresenceTable,
  isDumpParity,
  isPathLike,
  isSecretLike,
  isSensitiveKey,
  looksLikeSecret,
  maskString,
  normaliseDump,
  normaliseValue,
  parseDumpYaml,
  stableStringify,
} from "../../tools/parity/lib/dump-core.ts";
import { allPathsAreLiveArtifacts, diffTrees, guardVerdict, snapshotTree } from "../../tools/parity/lib/guard.ts";
import { pixelDiff, pngSize, pngWithRect, ratioPercent, solidPng } from "../../tools/parity/lib/image.ts";
import {
  type MaskRegion,
  buildIgnoreMask,
  describeMasks,
  parseMaskFile,
  resolveMasks,
  unmaskedPixelCount,
} from "../../tools/parity/lib/masks.ts";
import { parseViewports, readNumber } from "../../tools/parity/lib/paths.ts";
import { classifyAgainstStock } from "../../tools/parity/report.ts";
import { isEquivalentName, loadEquivalenceTable } from "../../tools/parity/lib/equivalence.ts";

/** Hai cây dump tối thiểu dùng chung cho các test. */
const DUMP_REF = [
  "# == layer base",
  "- id: llm",
  "  name: '@deepseek-ai/dsh-llm'",
  "  config:",
  "    root: /tmp/gbh-ref-home/sessions",
  "    port: 4543",
  "- id: connection",
  "  name: '@deepseek-ai/dsh-client-connection'",
  "  disabled: !!js '!ctx.get(''profileContext'')'",
  "",
].join("\n");

/** Cùng nội dung nhưng ở home/cổng khác — sau chuẩn hoá phải GIỐNG HỆT bản ref. */
const DUMP_OURS_SAME = [
  "# == layer base",
  "- id: llm",
  "  name: '@deepseek-ai/dsh-llm'",
  "  config:",
  "    root: /Users/tester/.galaxy/blackhole/sessions",
  "    port: 5439",
  "- id: connection",
  "  name: '@deepseek-ai/dsh-client-connection'",
  "  disabled: !!js '!ctx.get(''profileContext'')'",
  "",
].join("\n");

/** Bản có khác biệt thật: thêm một lá config và một row mới. */
const DUMP_OURS = DUMP_OURS_SAME.replace(
  "    port: 5439",
  "    port: 5439\n    model: auto",
).replace(
  "- id: connection",
  "- id: only-ours\n  name: '@deepseek-ai/dsh-extra'\n- id: connection",
);

describe("dump-core: parse", () => {
  test("đọc row và lấy id, giữ tag !!js", () => {
    const parsed = parseDumpYaml(DUMP_REF);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((row) => row.id)).toEqual(["llm", "connection"]);
    const connection = parsed.rows[1]?.raw as { disabled: { __tag: string; value: string } };
    expect(connection.disabled.__tag).toBe("!!js");
    expect(connection.disabled.value).toContain("profileContext");
  });

  test("id suy giảm về name rồi row-<index>", () => {
    const parsed = parseDumpYaml("- name: '@x/y'\n- foo: bar\n");
    expect(parsed.rows.map((row) => row.id)).toEqual(["@x/y", "row-1"]);
  });

  test("text không phải danh sách thì trả rỗng, không ném lỗi", () => {
    expect(parseDumpYaml("{}").rows).toEqual([]);
  });
});

describe("dump-core: chuẩn hoá", () => {
  test("thay tiền tố đường dẫn đã biết", () => {
    const masked = maskString("/tmp/gbh-ref-home/sessions", ["/tmp/gbh-ref-home"]);
    expect(masked).toBe(PATH_TOKEN + "/sessions");
  });

  test("đường dẫn lạ vẫn bị che, route thì không", () => {
    expect(isPathLike("/Users/khac/Desktop/x")).toBe(true);
    expect(isPathLike("/api")).toBe(false);
    expect(isPathLike("/api/remote.mux")).toBe(false);
    expect(maskString("/home/someone/data", [])).toBe(PATH_TOKEN);
  });

  test("chỉ che secret THẬT, không che id row dài", () => {
    // secret thật: base64url 43 ký tự có đủ chữ HOA + thường + số
    const secret = "K7pQ2mR9vT4xL1nB8cD5eF6gH0jZ3sW9yU2iO4aP6kQ";
    expect(isSecretLike(secret, "secret")).toBe(true);
    expect(isSecretLike(secret)).toBe(true);
    expect(maskString(secret, [])).toBe(SECRET_TOKEN);
    expect(isSecretLike("a".repeat(43))).toBe(false);
    expect(isSecretLike("short")).toBe(false);
    expect(isSecretLike("có khoảng trắng ".repeat(4))).toBe(false);
  });

  test("id row/plugin dài KHÔNG bị che (hồi quy lỗi che nhầm)", () => {
    for (const id of [
      "plugin-package-inventory-deepseek",
      "subagent-model-selection-settings",
      "optional-session-title-all-prompts",
      "deepseek-llm-api-extensions",
    ]) {
      expect(isSecretLike(id)).toBe(false);
      expect(maskString(id, [])).toBe(id);
    }
  });

  test("giá trị dưới khoá nhạy cảm bị che dù không khớp mẫu", () => {
    expect(isSecretLike("abc12345", "apiKey")).toBe(true);
    expect(isSecretLike("abc12345", "note")).toBe(false);
    // `password` nhạy cảm nhưng KHÔNG nằm trong danh sách khoá bất định → bị che thành <secret>
    const value = normaliseValue({ password: "abc12345", name: "plugin-package-inventory-deepseek" });
    expect(value).toEqual({ name: "plugin-package-inventory-deepseek", password: SECRET_TOKEN });
  });

  test("normaliseDump báo số id bị che nhầm (phải là 0)", () => {
    const tree = normaliseDump(
      [
        "- id: plugin-package-inventory-deepseek",
        "  config:",
        "    note: abc12345",
        "- id: auth",
        "  config:",
        "    password: K7pQ2mR9vT4xL1nB8cD5eF6gH0jZ3sW9yU2iO4aP6kQ",
        "",
      ].join("\n"),
      "demo",
    );
    expect(tree.maskedIds).toEqual([]);
    expect(tree.redactedValues).toBe(1);
    expect(tree.rows.get("plugin-package-inventory-deepseek")?.json).toContain("plugin-package-inventory-deepseek");
  });

  test("khoá bất định bị thay bằng token và khoá được sắp xếp", () => {
    const value = normaliseValue({ port: 5439, alpha: 1, beta: { timestamp: "x" } });
    expect(value).toEqual({ alpha: 1, beta: { timestamp: VOLATILE_TOKEN }, port: VOLATILE_TOKEN });
    expect(DEFAULT_VOLATILE_KEYS).toContain("port");
    expect(isSensitiveKey("apiKey")).toBe(true);
    expect(isSensitiveKey("note")).toBe(false);
    expect(looksLikeSecret("K7pQ2mR9vT4xL1nB8cD5eF6gH0jZ3sW9yU2iO4aP6kQ")).toBe(true);
  });

  test("stableStringify không phụ thuộc thứ tự khoá", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify([1, "x"])).toBe('[1,"x"]');
  });

  test("hai home khác nhau cho ra cây giống hệt nhau", () => {
    const ref = normaliseDump(DUMP_REF, "ref", { paths: ["/tmp/gbh-ref-home"] });
    const ours = normaliseDump(DUMP_OURS_SAME, "ours", { paths: ["/Users/tester/.galaxy/blackhole"] });
    const llmRef = ref.rows.get("llm");
    const llmOurs = ours.rows.get("llm");
    expect(llmRef?.json).toContain(PATH_TOKEN + "/sessions");
    expect(llmOurs?.json).toContain(PATH_TOKEN + "/sessions");
    expect(llmRef?.json).toContain(VOLATILE_TOKEN);
    expect(llmRef?.json).toBe(llmOurs?.json);
    expect(isDumpParity(diffDumps(ref, ours))).toBe(true);
  });

  test("id trùng được ghi lại", () => {
    const tree = normaliseDump("- id: a\n  x: 1\n- id: a\n  x: 2\n", "dup");
    expect(tree.duplicates).toEqual(["a"]);
    expect(tree.rowCount).toBe(2);
  });
});

describe("dump-core: diff", () => {
  test("phát hiện THÊM / THIẾU / ĐỔI", () => {
    const ref = normaliseDump(DUMP_REF, "ref", { paths: ["/tmp/gbh-ref-home"] });
    const ours = normaliseDump(DUMP_OURS, "ours", { paths: ["/Users/tester/.galaxy/blackhole"] });
    const diff = diffDumps(ref, ours);
    expect(diff.added).toEqual(["only-ours"]);
    expect(diff.missing).toEqual([]);
    expect(diff.changed.map((row) => row.id)).toEqual(["llm"]);
    expect(diff.unchanged).toBe(1);
    expect(isDumpParity(diff)).toBe(false);
  });

  test("cây giống nhau thì PASS", () => {
    const ref = normaliseDump(DUMP_REF, "ref", { paths: ["/tmp/gbh-ref-home"] });
    const same = normaliseDump(DUMP_REF, "ours", { paths: ["/tmp/gbh-ref-home"] });
    const diff = diffDumps(ref, same);
    expect(isDumpParity(diff)).toBe(true);
    expect(diff.unchanged).toBe(2);
  });

  test("diffRow nêu đúng đường dẫn lá", () => {
    const row = diffRow("llm", { config: { a: 1, b: 2 } }, { config: { a: 1, b: 3, c: 4 } });
    expect(row.fields.map((field) => field.path)).toEqual(["config.b", "config.c"]);
    expect(row.fieldCount).toBe(2);
  });

  test("lệch thứ tự được báo riêng", () => {
    const ref = normaliseDump("- id: a\n- id: b\n", "ref");
    const ours = normaliseDump("- id: b\n- id: a\n", "ours");
    const diff = diffDumps(ref, ours);
    expect(diff.orderDrift.length).toBe(2);
    expect(isDumpParity(diff)).toBe(true);
  });

  test("formatDumpDiff có đủ nhãn THÊM/THIẾU/ĐỔI", () => {
    const ref = normaliseDump(DUMP_REF, "ref");
    const ours = normaliseDump(DUMP_OURS, "ours");
    const text = formatDumpDiff(diffDumps(ref, ours));
    expect(text).toContain("THÊM");
    expect(text).toContain("ĐỔI");
    expect(text).toContain("FAIL");
  });

  test("bảng hiện diện chỉ in row khác nhau khi được yêu cầu", () => {
    const a = normaliseDump(DUMP_REF, "alpha");
    const b = normaliseDump(DUMP_OURS, "rc2");
    const full = formatPresenceTable([a, b]);
    const compact = formatPresenceTable([a, b], true);
    expect(full).toContain("only-ours");
    expect(compact).toContain("only-ours");
    expect(full).toContain("connection");
    expect(compact).not.toContain("connection");
    expect(compact).toContain("bỏ qua 1 row giống nhau");
  });
});

describe("image: ngưỡng pixel", () => {
  const white: [number, number, number, number] = [255, 255, 255, 255];
  const black: [number, number, number, number] = [0, 0, 0, 255];

  test("đọc được kích thước PNG hợp lệ", () => {
    const info = pngSize(solidPng(32, 16, white));
    expect(info).toEqual({ width: 32, height: 16 });
    expect(pngSize(Buffer.from("not a png"))).toBeNull();
  });

  test("ảnh giống hệt → 0 pixel khác", () => {
    const png = solidPng(64, 48, white);
    const diff = pixelDiff(png, png, 0.001);
    expect(diff.ok).toBe(true);
    expect(diff.diffPixels).toBe(0);
    expect(diff.pass).toBe(true);
  });

  test("khối nhỏ dưới ngưỡng → PASS, ảnh diff vẫn hợp lệ", () => {
    const ref = solidPng(100, 100, white);
    const ours = pngWithRect(100, 100, white, { x: 0, y: 0, w: 5, h: 5 }, black); // 0.25% > 0.1%
    const diff = pixelDiff(ref, ours, 0.005);
    expect(diff.ok).toBe(true);
    expect(diff.diffPixels).toBeGreaterThan(20);
    expect(diff.ratio).toBeLessThan(0.005);
    expect(diff.pass).toBe(true);
    expect(pngSize(diff.diffPng ?? Buffer.alloc(0))).toEqual({ width: 100, height: 100 });
  });

  test("khối lớn vượt ngưỡng → FAIL", () => {
    const ref = solidPng(100, 100, white);
    const ours = pngWithRect(100, 100, white, { x: 0, y: 0, w: 50, h: 50 }, black);
    const diff = pixelDiff(ref, ours, 0.001);
    expect(diff.diffPixels).toBe(2500);
    expect(diff.ratio).toBeCloseTo(0.25, 5);
    expect(diff.pass).toBe(false);
  });

  test("lệch kích thước → ok=false, không ném lỗi", () => {
    const diff = pixelDiff(solidPng(10, 10, white), solidPng(20, 20, white), 0.001);
    expect(diff.ok).toBe(false);
    expect(diff.reason).toContain("kích thước");
    expect(diff.diffPixels).toBe(-1);
  });

  test("ratioPercent in đúng", () => {
    expect(ratioPercent(0.001)).toBe("0.100%");
    expect(ratioPercent(0.5, 0)).toBe("50%");
  });
});

describe("browser: xác thực", () => {
  test("base64url round-trip", () => {
    const data = Buffer.from("deepseek-harness", "utf8");
    const encoded = encodeBase64Url(data);
    expect(encoded.includes("=")).toBe(false);
    expect(decodeBase64Url(encoded)?.toString("utf8")).toBe("deepseek-harness");
    expect(decodeBase64Url("a")).toBeNull();
  });

  test("tên cookie khoá theo authority", () => {
    const name = cookieNameForAuthority("127.0.0.1:4001");
    expect(name.startsWith("dsh-auth-")).toBe(true);
    expect(name).toBe(cookieNameForAuthority("127.0.0.1:4001"));
    expect(name).not.toBe(cookieNameForAuthority("127.0.0.1:5439"));
  });

  test("cookie mint đúng định dạng v1.<payload>.<hmac> và gắn authority", () => {
    const secret = Buffer.alloc(32, 7);
    const cookie = mintSessionCookie("127.0.0.1:5439", secret, 1_700_000_000_000);
    const parts = cookie.value.split(".");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("v1");
    const body = JSON.parse((decodeBase64Url(parts[1] ?? "") ?? Buffer.alloc(0)).toString("utf8")) as Record<string, unknown>;
    expect(body.authority).toBe("127.0.0.1:5439");
    expect(body.version).toBe(1);
    expect(Number(body.expiresAt) - Number(body.issuedAt)).toBe(86_400_000);
    expect((parts[2] ?? "").length).toBeGreaterThan(20);
  });

  test("cookie đổi khi đổi secret (chữ ký thật)", () => {
    const a = mintSessionCookie("127.0.0.1:5439", Buffer.alloc(32, 1), 1);
    const b = mintSessionCookie("127.0.0.1:5439", Buffer.alloc(32, 2), 1);
    expect(a.value).not.toBe(b.value);
  });

  test("đọc secret từ tài liệu credentials và mint được cookie", () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-parity-"));
    const file = join(dir, "credentials.yaml");
    const secret = Buffer.alloc(32, 5);
    writeFileSync(
      file,
      [
        "version: 1",
        "records:",
        '  client-connection/browser-session:',
        "    kind: grant",
        "    payload:",
        "      version: 1",
        "      secret: " + encodeBase64Url(secret),
        "",
      ].join("\n"),
    );
    const parsed = readBrowserSessionSecret(file);
    expect(parsed?.byteLength).toBe(32);
    const resolved = resolveSessionCookieFrom(5439, [join(dir, "khong-ton-tai.yaml"), file]);
    expect(resolved.cookie?.name).toBe(cookieNameForAuthority("127.0.0.1:5439"));
    expect(resolved.source).toBe(file);
    expect(resolved.secretFingerprint).not.toBeNull();
    expect(readBrowserSessionSecret(join(dir, "khong-ton-tai.yaml"))).toBeNull();
  });

  test("hash bundle không phụ thuộc thứ tự asset", () => {
    expect(hashList(["b.js", "a.css"])).toBe(hashList(["a.css", "b.js"]));
    expect(hashList(["a.css"])).not.toBe(hashList(["b.css"]));
  });

  test("asset cùng origin chỉ giữ pathname, asset ngoài giữ origin", () => {
    expect(normaliseAsset("/assets/index-abc.js?v=1", "http://127.0.0.1:5439")).toBe("/assets/index-abc.js");
    expect(normaliseAsset("http://127.0.0.1:5439/client.js?x=1", "http://127.0.0.1:5439")).toBe("/client.js");
    expect(normaliseAsset("https://cdn.example.com/x.js", "http://127.0.0.1:5439")).toBe("https://cdn.example.com/x.js");
  });
});

describe("guard: chốt an toàn", () => {
  test("phát hiện file mới trong cây", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-guard-"));
    writeFileSync(join(dir, "a.txt"), "a");
    const before = snapshotTree(dir);
    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(join(dir, "b.txt"), "bb");
    const after = snapshotTree(dir);
    const delta = diffTrees(before, after);
    expect(delta.changed).toBe(true);
    expect(delta.added).toEqual(["/b.txt"]);
    expect(delta.counts.after).toBe(2);
  });

  test("nhiễu từ harness khác (sessions/storages) không bị báo thành CẢNH BÁO", () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-guard-"));
    writeFileSync(join(dir, "a.txt"), "a");
    const before = snapshotTree(dir);
    writeFileSync(join(dir, "b.txt"), "bb");
    const after = snapshotTree(dir);
    const delta = diffTrees(before, after);
    expect(allPathsAreLiveArtifacts(["/sessions/x/session.v4.jsonl.zstd"])).toBe(true);
    expect(allPathsAreLiveArtifacts(["/storages/session_projcache/sessions/a.json"])).toBe(true);
    expect(allPathsAreLiveArtifacts(["/profiles/web/package.json"])).toBe(false);
    expect(allPathsAreLiveArtifacts([])).toBe(false);
    const live = { ...delta, modified: [], added: ["/sessions/a"], removed: [] };
    expect(guardVerdict({ ...delta, changed: false }, live)).toContain("KHÔNG KẾT LUẬN ĐƯỢC");
    const dirty = { ...delta, modified: [], added: ["/profiles/web/cordis.yml"], removed: [] };
    expect(guardVerdict({ ...delta, changed: false }, dirty)).toContain("CẢNH BÁO");
    expect(guardVerdict(delta, { ...delta, changed: false })).toContain("PASS");
  });

  test("cây không đổi thì delta sạch", () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-guard-"));
    writeFileSync(join(dir, "a.txt"), "a");
    const before = snapshotTree(dir);
    const after = snapshotTree(dir);
    expect(diffTrees(before, after).changed).toBe(false);
    expect(snapshotTree(join(dir, "khong-ton-tai"))).toBeNull();
  });
});

describe("masks: vùng bỏ qua khi so ảnh", () => {
  const brandRegion: MaskRegion = { name: "brand", kind: "brand", reason: "logo", x: 0, y: 0, w: 0.25, h: 0.25 };
  const stateRegion: MaskRegion = { name: "state", kind: "state", reason: "danh sách session", x: 0.5, y: 0.5, w: 0.1, h: 0.1 };
  const regions: MaskRegion[] = [brandRegion, stateRegion];

  test("quy đổi tỉ lệ sang pixel và cắt theo biên khung", () => {
    const masks = resolveMasks(regions, 100, 200);
    expect(masks[0]).toMatchObject({ x: 0, y: 0, w: 25, h: 50 });
    expect(resolveMasks([{ ...brandRegion, x: 0.99, y: 0.99, w: 0.5, h: 0.5 }], 100, 100)[0]?.w).toBe(1);
  });

  test("ignoreMask đánh dấu đúng pixel và mẫu số trừ vùng mask", () => {
    const masks = resolveMasks([brandRegion], 100, 100);
    const ignore = buildIgnoreMask(100, 100, masks);
    expect(ignore[0]).toBe(1);
    expect(ignore[50 * 100 + 50]).toBe(0);
    expect(unmaskedPixelCount(100, 100, masks)).toBe(10000 - 625);
  });

  test("khác biệt nằm trong vùng mask thì không tính là lệch", () => {
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const ref = solidPng(100, 100, white);
    const ours = pngWithRect(100, 100, white, { x: 0, y: 0, w: 20, h: 20 }, black);
    const masks = resolveMasks([{ ...brandRegion, w: 0.3, h: 0.3 }], 100, 100);
    const masked = pixelDiff(ref, ours, 0.001, {
      ignoreMask: buildIgnoreMask(100, 100, masks),
      maskedPixels: 100 * 100 - unmaskedPixelCount(100, 100, masks),
    });
    expect(masked.diffPixels).toBe(0);
    expect(masked.rawDiffPixels).toBe(400);
    expect(masked.rawRatio).toBeCloseTo(0.04, 5);
    expect(masked.pass).toBe(true);
    expect(masked.maskedPixels).toBe(900);
    expect(masked.totalPixels).toBe(9100);
  });

  test("describeMasks nêu tên, toạ độ và lý do", () => {
    const text = describeMasks(resolveMasks(regions, 200, 100), 200, 100);
    expect(text).toContain("brand");
    expect(text).toContain("logo");
    expect(text).toContain("0,0 50×25");
  });

  test("parseMaskFile bỏ qua dữ liệu sai", () => {
    expect(parseMaskFile("không phải mảng")).toEqual([]);
    expect(parseMaskFile([{ name: "a", x: 0, y: 0, w: 0.1, h: 0.1 }])[0]?.kind).toBe("brand");
    expect(parseMaskFile([{ name: "b", x: "x", y: 0, w: 1, h: 1 }])).toEqual([]);
  });
});

describe("bảng tương đương gói (đổi tên gói không tính là lệch hành vi)", () => {
  const table = {
    source: "test",
    rows: 1,
    byDsh: new Map([
      ["@deepseek-ai/dsh-host-webserver", { rowId: "webserver", dsh: "@deepseek-ai/dsh-host-webserver", ours: "@galaxy-blackhole/gbh-host-webserver", evidence: "C3", verified: true, evidenceFile: "docs/contracts/C3-profile-patch.md" }],
    ]),
    oursByDsh: new Map([["@deepseek-ai/dsh-host-webserver", new Set(["@galaxy-blackhole/gbh-host-webserver"])]]),
    byRowId: new Map([
      ["webserver", { rowId: "webserver", dsh: "@deepseek-ai/dsh-host-webserver", ours: "@galaxy-blackhole/gbh-host-webserver", evidence: "C3", verified: true, evidenceFile: "docs/contracts/C3-profile-patch.md" }],
    ]),
    issues: [],
  };
  const refDump = ["- id: webserver", "  name: '@deepseek-ai/dsh-host-webserver'", "  config:", "    port: 4543", ""].join("\n");
  const oursDump = ["- id: webserver", "  name: '@galaxy-blackhole/gbh-host-webserver'", "  config:", "    port: 5439", ""].join("\n");

  test("tên đã khai trong ma trận → tính unchanged và ghi vào chỉ số đã thay", () => {
    const ref = normaliseDump(refDump, "oracleA");
    const ours = normaliseDump(oursDump, "ours");
    const diff = diffDumps(ref, ours, { equivalence: table });
    expect(isDumpParity(diff)).toBe(true);
    expect(diff.swapped.map((row) => row.id)).toEqual(["webserver"]);
    expect(diff.swapped[0]?.verified).toBe(true);
    expect(diff.unchanged).toBe(1);
  });

  test("RÀO CHẮN: tên không có trong ma trận → vẫn là ĐỔI", () => {
    const ref = normaliseDump(refDump, "oracleA");
    const ours = normaliseDump(oursDump.replace("gbh-host-webserver", "gbh-khong-khai-trong-ma-tran"), "ours");
    const diff = diffDumps(ref, ours, { equivalence: table });
    expect(isDumpParity(diff)).toBe(false);
    expect(diff.changed.map((row) => row.id)).toEqual(["webserver"]);
    expect(diff.swapped).toEqual([]);
  });

  test("RÀO CHẮN: đổi tên gói NHƯNG khác thêm lá khác → vẫn là ĐỔI", () => {
    const ref = normaliseDump(refDump, "oracleA");
    const ours = normaliseDump(oursDump.replace("    port: 5439", "    port: 5439\n    extra: true"), "ours");
    const diff = diffDumps(ref, ours, { equivalence: table });
    expect(isDumpParity(diff)).toBe(false);
    expect(diff.changed[0]?.fields.map((field) => field.path)).toContain("config.extra");
    expect(diff.swapped).toEqual([]);
  });

  test("RÀO CHẮN: row id đổi → vẫn là THÊM/THIẾU, không phải đã thay", () => {
    const ref = normaliseDump(refDump, "oracleA");
    const ours = normaliseDump(oursDump.replace("- id: webserver", "- id: webserver-2"), "ours");
    const diff = diffDumps(ref, ours, { equivalence: table });
    expect(diff.added).toEqual(["webserver-2"]);
    expect(diff.missing).toEqual(["webserver"]);
    expect(diff.swapped).toEqual([]);
    expect(isDumpParity(diff)).toBe(false);
  });
});

describe("phân loại khác biệt so với stock", () => {
  test("row mà oracle A cũng khác stock thì là delta Galaxy có chủ đích", () => {
    const stock = normaliseDump(DUMP_REF, "stock");
    const ours = normaliseDump(DUMP_OURS, "ours");
    const oracle = normaliseDump(DUMP_OURS, "oracleA");
    const result = classifyAgainstStock(diffDumps(stock, ours), diffDumps(stock, oracle));
    expect(result.intendedAdded).toEqual(["only-ours"]);
    expect(result.unexplainedAdded).toEqual([]);
    expect(result.intendedChanged).toEqual(["llm"]);
    expect(result.unexplainedChanged).toEqual([]);
  });

  test("chưa đo được oracle thì mọi khác biệt là chưa giải thích", () => {
    const stock = normaliseDump(DUMP_REF, "stock");
    const ours = normaliseDump(DUMP_OURS, "ours");
    const result = classifyAgainstStock(diffDumps(stock, ours), null);
    expect(result.unexplainedAdded).toEqual(["only-ours"]);
    expect(result.unexplainedChanged.map((row) => row.id)).toEqual(["llm"]);
    expect(result.intendedAdded).toEqual([]);
  });
});

describe("paths: tham số CLI", () => {
  test("parse viewport hợp lệ và bỏ giá trị rác", () => {
    expect(parseViewports("1440x900,1024x768")).toEqual([
      { name: "1440x900", width: 1440, height: 900 },
      { name: "1024x768", width: 1024, height: 768 },
    ]);
    expect(parseViewports("10x10,abc,1440x900")).toEqual([{ name: "1440x900", width: 1440, height: 900 }]);
    expect(parseViewports(null)).toEqual([]);
  });

  test("readNumber dùng mặc định khi biến trống", () => {
    expect(readNumber("GBH_PARITY_KHONG_CO_BIEN_NAY", 42)).toBe(42);
  });
});
