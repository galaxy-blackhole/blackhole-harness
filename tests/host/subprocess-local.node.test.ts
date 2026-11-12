/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test BO SUNG cho subprocess-local: chung minh su that RUNTIME ma tep chinh khong do duoc —
 *      (1) bun KHONG nap duoc ca hai ben (doi xung, khong shim); (2) Node >= 22 nap duoc va be mat export trung;
 *      (3) A/B hanh vi THAT bang node (echo · exit 7 · abort) tren tep cua ta va bundle goc.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STOCK_BUNDLE } from "../../packages/host/subprocess-local/src/manifest.ts";

/** Đường dẫn TUYỆT ĐỐI tới artefact của ta (lib/index.js vừa build). */
const BUILD_INDEX_PATH = join(import.meta.dir, "..", "..", "packages", "host", "subprocess-local", "lib", "index.js");

/** Đường dẫn TUYỆT ĐỐI tới bundle gốc trong apps/host (CHỈ ĐỌC — nguồn đối chiếu). */
const STOCK_INDEX_PATH = join(import.meta.dir, "..", "..", STOCK_BUNDLE);

/** Gốc repo — dùng để nạp cordis THẬT từ apps/host/node_modules. */
const REPO_ROOT = join(import.meta.dir, "..", "..");

/** Ung vien Node >= 22 (co node:util.getSystemErrorMessage) — thu theo thu tu. */
const NODE_CANDIDATES = [
  "/Users/buitronghieu/.nvm/versions/node/v26.9.0/bin/node",
  "/Users/buitronghieu/.nvm/versions/node/v24.4.1/bin/node",
  "/usr/local/bin/node",
];

/** Tim node dau tien ton tai; null khi may khong co. Tra: duong dan hoac null. */
function findNode(): string | null {
  for (const candidate of NODE_CANDIDATES) if (existsSync(candidate)) return candidate;
  return null;
}

/**
 * Chay mot doan script ESM bang node that. Nhan: nodePath, script. Tra: stdout da trim.
 */
function runNode(nodePath: string, script: string): string {
  // `Bun.spawnSync` nhận `timeoutMs`, nhưng khi tsc thấy overload của `node:child_process.spawnSync` thì trường
  // tương ứng tên `timeout` (`timeoutMs` bị TS2561). Dùng `timeout` để CẢ HAI cách đọc đều hợp lệ.
  const run = Bun.spawnSync([nodePath, "--input-type=module", "-e", script], { timeout: 60_000 });
  if (run.exitCode !== 0) throw new Error("node loi: " + run.stderr.toString().slice(0, 300));
  return run.stdout.toString().trim();
}

const NODE = findNode();

describe("bun KHONG nap duoc CA HAI ben (doi xung, khong shim)", () => {
  test("import lib/index.js cua ta va bundle goc trong bun ⇒ cung nem cung thong diep getSystemErrorMessage", async () => {
    const messages: string[] = [];
    for (const path of [BUILD_INDEX_PATH, STOCK_INDEX_PATH]) {
      try {
        await import(path);
        messages.push("KHONG-NEM");
      } catch (error) {
        messages.push(String((error as Error).message));
      }
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0] ?? "").toContain("getSystemErrorMessage");
  });
});

describe("Node that (v26) nap duoc artefact va be mat export trung", () => {
  test("ca hai ben nap OK, export { LocalSubprocessRuntime, default } trung nhau, default la class", () => {
    if (NODE === null) {
      test.skip("khong co node >= 22 tren may");
      return;
    }
    const script = (path: string): string =>
      "const m = await import('file://" + path + "');" +
      "console.log(JSON.stringify({names: Object.keys(m).sort(), isClass: typeof m.default === 'function', same: m.default === m.LocalSubprocessRuntime}));";
    const our = runNode(NODE, script(BUILD_INDEX_PATH));
    const their = runNode(NODE, script(STOCK_INDEX_PATH));
    expect(our).toBe(their);
    const parsed = JSON.parse(our) as { names: string[]; isClass: boolean; same: boolean };
    expect(parsed.names).toEqual(["LocalSubprocessRuntime", "default"]);
    expect(parsed.isClass).toBe(true);
    expect(parsed.same).toBe(true);
  });
});

describe("A/B hanh vi THAT bang node (tien trinh cuc bo, KHONG mang)", () => {
  /**
   * Chay mot kich ban tren mot artefact bang node. Nhan: nodePath, artefact, bieu thuc chay.
   * Tra: JSON ket qua do duoc.
   */
  function scenario(nodePath: string, artefact: string, body: string): string {
    const dir = mkdtempSync(join(tmpdir(), "gbh-subproc-node-"));
    try {
      const script = [
        "const dir = " + JSON.stringify(dir) + ";",
        "const m = await import('file://" + artefact + "');",
        "const { Context } = await import('file://" + join(REPO_ROOT, "apps/host/node_modules/@deepseek-ai/cordis/lib/index.js") + "');",
        "const ctx = new Context();",
        "const runtime = new m.LocalSubprocessRuntime(ctx, {});",
        body,
      ].join(String.fromCharCode(10));
      return runNode(nodePath, script);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("spawn /bin/echo hello ⇒ cùng stdout + cùng exitCode", () => {
    if (NODE === null) {
      test.skip("khong co node >= 22 tren may");
      return;
    }
    const body = "const r = await runtime.spawn({ argv: ['/bin/echo', 'hello'], cwd: dir, stdio: { stdin: \"ignore\", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } }, graceMs: 500 });const done = await r.waitForExit();console.log(JSON.stringify({ out: String(done.stdout ?? ''), code: done.exitCode ?? null }));";
    const our = scenario(NODE, BUILD_INDEX_PATH, body);
    const their = scenario(NODE, STOCK_INDEX_PATH, body);
    expect(our).toBe(their);
  });

  test("spawn /bin/sh -c 'exit 7' ⇒ cùng exitCode", () => {
    if (NODE === null) {
      test.skip("khong co node >= 22 tren may");
      return;
    }
    const body = "const r = await runtime.spawn({ argv: ['/bin/sh', '-c', 'exit 7'], cwd: dir, stdio: { stdin: \"ignore\", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } }, graceMs: 500 });const done = await r.waitForExit();console.log(JSON.stringify({ code: done.exitCode ?? null }));";
    const our = scenario(NODE, BUILD_INDEX_PATH, body);
    const their = scenario(NODE, STOCK_INDEX_PATH, body);
    expect(our).toBe(their);
  });

  test("spawn lệnh KHÔNG tồn tại ⇒ cùng lỗi (name|code|message)", () => {
    if (NODE === null) {
      test.skip("khong co node >= 22 tren may");
      return;
    }
    const body = "try { const r = await runtime.spawn({ argv: ['/bin/gbh-khong-ton-tai-xyz'], cwd: dir, stdio: { stdin: \"ignore\", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } }, graceMs: 500 }); await r.waitForExit(); console.log('KHONG-NEM'); } catch (e) { console.log(JSON.stringify({ name: e.name, code: e.code ?? null, msg: String(e.message) })); }";
    const our = scenario(NODE, BUILD_INDEX_PATH, body);
    const their = scenario(NODE, STOCK_INDEX_PATH, body);
    expect(our).toBe(their);
    // Lệnh thiếu: hai bên cho KẾT QUẢ y hệt (hoặc cùng ném, hoặc cùng trả handle rồi lỗi khi chờ) — đo bằng
    // chuỗi JSON/khẳng định đầu ra khác rỗng, KHÔNG ép về một hình dạng cụ thể để khỏi bịa hành vi.
    expect(our.length).toBeGreaterThan(0);
  });

  test("resolveExecutable('/bin/echo') ⇒ cùng đường dẫn; thiếu ⇒ cùng lỗi", () => {
    if (NODE === null) {
      test.skip("khong co node >= 22 tren may");
      return;
    }
    const body = "const ok = await runtime.resolveExecutable('/bin/echo');let miss = null;try { await runtime.resolveExecutable('/bin/gbh-khong-co-xyz'); } catch (e) { miss = { name: e.name, code: e.code ?? null }; }console.log(JSON.stringify({ ok, miss }));";
    const our = scenario(NODE, BUILD_INDEX_PATH, body);
    const their = scenario(NODE, STOCK_INDEX_PATH, body);
    expect(our).toBe(their);
  });
});