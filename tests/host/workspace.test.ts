/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-workspace (row `workspace`): MỌI ca hành vi chạy CẢ HAI
 *      bản cài trên giàn THẬT (Context cordis + kho + dạng-dữ-liệu-miền của ta + persistence giả) rồi
 *      so từng bước; kèm ca DANH TÍNH (C6), ca flaky dùng `waitFor` CÓ TRẦN, và ba ca đo trên
 *      ARTIFACT/manifest (tập export · locale 000e · `gbh.peers ⊆ peerDependencies`).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  OUR,
  STOCK,
  disposeRig,
  errorOf,
  makeRig,
  makeTempRoot,
  rejectionOf,
  scrub,
  snapshot,
  waitFor,
  type Mod,
} from "./workspace-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "workspace");
/** Bản gốc (chỉ đọc). */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workspace");

/**
 * Chạy CÙNG một kịch bản trên hai bên rồi trả ảnh chụp của từng bên.
 * Nhận: hàm kịch bản nhận mô-đun của bên đó và tự dọn giàn của mình.
 * Trả: promise của cặp `[của ta, bản gốc]`.
 */
async function ab(scenario: (mod: Mod) => Promise<unknown>): Promise<[unknown, unknown]> {
  return [await scenario(OUR), await scenario(STOCK)];
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: văn bản và chuỗi con.
 * Trả: số lần (0 = không có).
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Liệt kê tên export của một artifact ESM — ĐÚNG bốn mẫu mà `tools/check/rows.ts` dùng.
 * Nhận: nội dung tệp đã build.
 * Trả: tập tên export (kể cả `default`).
 */
function exportNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return out;
}

/**
 * Phần tử của `gbh.peers` KHÔNG có trong `peerDependencies` — phép kiểm PHẦN TỬ, không phải phép đếm.
 * Nhận: danh sách peer khai trong metadata và danh sách khoá của `peerDependencies`.
 * Trả: các tên còn thiếu (rỗng = đạt).
 */
function peerGaps(peers: readonly string[], peerDependencies: Record<string, string>): string[] {
  const declared = new Set(Object.keys(peerDependencies));
  return peers.filter((peer) => !declared.has(peer));
}

/** Thông tin manifest của gói ta, đọc đúng một lần. */
const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as {
  name: string;
  exports: Record<string, string>;
  peerDependencies: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[]; tests?: string[]; draft?: string; row?: unknown };
};

describe("row workspace — bước 0 ghi lại hình dạng", () => {
  // 18/10/2026 — CẬP NHẬT theo trạng thái hiện tại (dọn test cũ của task-7): row workspace ĐÃ khai
  //   gbh.row sau khi mount xong; ca "bước 0" cũ (kỳ vọng chưa khai) đỏ từ HEAD, không phải hồi quy.
  //   Trường `draft` vẫn được giữ để làm lịch sử bước 0.
  test("ca 0a: gbh.row ĐÃ khai (18/10/2026) đúng id + tests; draft giữ làm lịch sử bước 0", () => {
    expect(manifest.gbh?.row).toEqual({ id: "workspace", tests: ["tests/host/workspace.test.ts"] });
    expect(manifest.gbh?.draft).toBeDefined();
    expect(manifest.gbh?.tests).toEqual(["tests/host/workspace.test.ts"]);
  });

  test("ca 0b: 000e — locale en/zh chép BYTE-FOR-BYTE từ bản gốc + manifest export locale", async () => {
    const sha = async (path: string): Promise<string> =>
      createHash("sha256").update(await readFile(path)).digest("hex");
    expect(await sha(join(PKG, "locale", "en.json"))).toBe(await sha(join(STOCK_DIR, "locale", "en.json")));
    expect(await sha(join(PKG, "locale", "zh.json"))).toBe(await sha(join(STOCK_DIR, "locale", "zh.json")));
    expect(manifest.exports["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("ca 0c: gbh.peers ⊆ peerDependencies so PHẦN TỬ + BA ĐỐI CHỨNG ÂM", () => {
    const peers = manifest.gbh?.peers ?? [];
    expect(peers).toEqual(["zod"]);
    expect(peerGaps(peers, manifest.peerDependencies)).toEqual([]);
    // Đối chứng âm 1 — XOÁ một tên khỏi peerDependencies ⇒ phép kiểm phải báo ĐÚNG tên đó.
    expect(peerGaps(peers, { "@deepseek-ai/cordis": "x" })).toEqual(["zod"]);
    // Đối chứng âm 2 — CÙNG ĐỘ DÀI mà LỆCH PHẦN TỬ ⇒ vẫn ĐỎ (phép đếm sẽ cho verdict rỗng).
    expect(peerGaps(["zod"], { lodash: "x" })).toEqual(["zod"]);
    // Đối chứng âm 3 — peer THỪA (không khai trong gbh.peers) vẫn ĐẠT: luật là ⊆, không phải =.
    expect(peerGaps(["zod"], { zod: "x", extra: "y" })).toEqual([]);
    // Và: peer lấy từ KERNEL, không bao giờ nằm ở `dependencies` (sẽ tạo thể hiện thứ hai).
    expect(manifest.dependencies).toBeUndefined();
  });
});

describe("row workspace — hành vi, đối chứng A/B với chính bundle gốc", () => {
  test("ca 1: create dùng lại CÙNG thực thể cho cùng đường dẫn chuẩn tắc; list theo thứ tự chèn-đầu", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const rig = await makeRig(mod);
      try {
        const one = join(root.path, "one");
        const two = join(root.path, "two");
        await mkdir(one, { recursive: true });
        await mkdir(two, { recursive: true });
        const a = await rig.registry.create(one);
        const again = await rig.registry.create(one + "/");
        const b = await rig.registry.create(two, "Tiêu đề riêng");
        const byPath = await rig.registry.resolveByPath(one);
        const unknown = rig.registry.resolveByPath(root.path);
        const result = {
          sameEntity: a.id === again.id,
          samePath: a.path === again.path,
          resolveHits: byPath?.id === a.id,
          resolveMisses: unknown === undefined,
          getUnknown: rig.registry.get("khong-co") === undefined,
          order: rig.registry.list().map((workspace: any) => workspace.title),
          snapshot: await snapshot(rig.registry),
          writes: rig.unit.puts.length,
          markers: rig.unit.globals.length,
        };
        return scrub(result, root.path);
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).sameEntity).toBe(true);
    expect((ours as any).order).toEqual(["Tiêu đề riêng", "one"]);
  });

  test("ca 2: BA đường từ chối của create + tiêu đề của gốc đĩa", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const rig = await makeRig(mod);
      try {
        const file = join(root.path, "tep.txt");
        await writeFile(file, "x");
        const errors = {
          relative: await rejectionOf(() => rig.registry.create("relative/dir")),
          empty: await rejectionOf(() => rig.registry.create("")),
          missing: await rejectionOf(() => rig.registry.create(join(root.path, "khong-ton-tai"))),
          file: await rejectionOf(() => rig.registry.create(file)),
        };
        const rootWorkspace = await rig.registry.create("/");
        const statusOk = (await rig.registry.list()[0]?.status()) ?? "(khong co)";
        return scrub({ errors, rootTitle: rootWorkspace.title, rootPath: rootWorkspace.path, statusOk }, root.path);
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    const errors = (ours as any).errors;
    expect(errors.relative).toContain("Workspace path is not fully qualified: 'relative/dir'");
    expect(errors.missing).toContain("ENOENT");
    expect(errors.file).toContain("path is not a directory");
    expect((ours as any).rootTitle).toBe("/");
  });

  test("ca 3: gắn phiên — bốn đường từ chối + thứ tự chèn-đầu, KHÔNG ghi khi hỏng", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const rig = await makeRig(mod, {
        stored: [
          { id: "s-in", cwd: one, createdAt: 1 },
          { id: "s-nocwd", createdAt: 2 },
          { id: "s-gone", cwd: join(root.path, "gone"), createdAt: 3 },
          { id: "s-other", cwd: root.path, createdAt: 4 },
        ],
        sessions: [{ id: "s-live", cwd: one, createdAt: 5 }],
      });
      try {
        const workspace = await rig.registry.create(one);
        await workspace.attachSession("s-in");
        await workspace.attachSession("s-live");
        const writesBefore = rig.unit.puts.length;
        const errors = {
          noCwd: await rejectionOf(() => workspace.attachSession("s-nocwd")),
          gone: await rejectionOf(() => workspace.attachSession("s-gone")),
          other: await rejectionOf(() => workspace.attachSession("s-other")),
          unknown: await rejectionOf(() => workspace.attachSession("s-missing")),
        };
        const writesAfter = rig.unit.puts.length;
        // Gắn LẠI id đã có: không ghi thêm (idempotent).
        await workspace.attachSession("s-live");
        const writesAfterRepeat = rig.unit.puts.length;
        return scrub(
          { sessionIds: [...workspace.sessionIds], errors, writesBefore, writesAfter, writesAfterRepeat },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).sessionIds).toEqual(["s-live", "s-in"]);
    expect((ours as any).writesAfter).toBe((ours as any).writesBefore);
    expect((ours as any).writesAfterRepeat).toBe((ours as any).writesAfter);
    expect((ours as any).errors.noCwd).toContain("its stored header carries no cwd to validate against");
    expect((ours as any).errors.other).toContain("resolves to");
    expect((ours as any).errors.unknown).toContain("session persistence holds no such session");
  });

  test("ca 4: ứng viên bị LỌC khỏi sessionIds (cwd lệch) + một dòng cảnh báo chẩn đoán", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const iso = "2026-10-18T00:00:00.000Z";
      // Bản ghi lưu ĐÚNG dạng chuẩn tắc (`fs.realpath`) — trên macOS `/var` là symlink của `/private/var`.
      const canonical = await realpath(one);
      const rig = await makeRig(mod, {
        seed: {
          tables: {
            workspaces: {
              "w-seed": { path: canonical, title: "seed", sessionIds: ["s-other", "s-in"], createdAt: iso, updatedAt: iso },
            },
          },
          global: { initialized: true, workspaceIds: ["w-seed"], archivedSessionIds: [], pinnedSessionIds: [] },
        },
        stored: [
          { id: "s-in", cwd: one, createdAt: 1 },
          { id: "s-other", cwd: root.path, createdAt: 2 },
        ],
      });
      try {
        const only = rig.registry.list()[0];
        return scrub(
          { sessionIds: [...only.sessionIds], titles: rig.registry.list().map((w: any) => w.title), logs: rig.logs },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).sessionIds).toEqual(["s-in"]);
    expect((ours as any).logs.some((line: string) => line.includes("filtered session 's-other' from membership"))).toBe(true);
  });

  test("ca 5: thứ tự PHIÊN — insertSessionBefore + detach idempotent + hai lỗi chuyển", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const rig = await makeRig(mod, {
        stored: [
          { id: "s-a", cwd: one, createdAt: 1 },
          { id: "s-b", cwd: one, createdAt: 2 },
          { id: "s-c", cwd: one, createdAt: 3 },
        ],
      });
      try {
        const workspace = await rig.registry.create(one);
        await workspace.attachSession("s-a");
        await workspace.attachSession("s-b");
        await workspace.attachSession("s-c");
        const attached = [...workspace.sessionIds];
        await workspace.insertSessionBefore("s-a", "s-b");
        const moved = [...workspace.sessionIds];
        await workspace.insertSessionBefore("s-c");
        const appended = [...workspace.sessionIds];
        const writesBefore = rig.unit.puts.length;
        await workspace.insertSessionBefore("s-c");
        const writesAfterNoop = rig.unit.puts.length;
        const errors = {
          session: await rejectionOf(() => workspace.insertSessionBefore("s-missing")),
          anchor: await rejectionOf(() => workspace.insertSessionBefore("s-a", "s-missing")),
        };
        await workspace.detachSession("s-a");
        const detached = [...workspace.sessionIds];
        const writesBeforeDetach = rig.unit.puts.length;
        await workspace.detachSession("s-a");
        const writesAfterDetachNoop = rig.unit.puts.length;
        return scrub(
          { attached, moved, appended, detached, errors, writesBefore, writesAfterNoop, writesBeforeDetach, writesAfterDetachNoop },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).attached).toEqual(["s-c", "s-b", "s-a"]);
    expect((ours as any).moved).toEqual(["s-c", "s-a", "s-b"]);
    expect((ours as any).appended).toEqual(["s-a", "s-b", "s-c"]);
    expect((ours as any).detached).toEqual(["s-b", "s-c"]);
    expect((ours as any).writesAfterDetachNoop).toBe((ours as any).writesBeforeDetach);
    expect((ours as any).errors.session).toContain("the session is not accounted");
    expect((ours as any).errors.anchor).toContain("the anchor session is not accounted");
  });

  test("ca 6: thứ tự WORKSPACE — insertBefore + delete idempotent + lỗi id lạ", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const rig = await makeRig(mod);
      try {
        const dirs = ["a", "b", "c"].map((name) => join(root.path, name));
        for (const dir of dirs) await mkdir(dir, { recursive: true });
        const created: any[] = [];
        for (const dir of dirs) created.push(await rig.registry.create(dir));
        const order = rig.registry.list().map((w: any) => w.title);
        const committed = await rig.registry.insertBefore(created[0].id, created[2].id);
        const afterMove = rig.registry.list().map((w: any) => w.title);
        const appended = await rig.registry.insertBefore(created[0].id);
        const afterAppend = rig.registry.list().map((w: any) => w.title);
        const errors = {
          source: await rejectionOf(() => rig.registry.insertBefore("khong-co")),
          anchor: await rejectionOf(() => rig.registry.insertBefore(created[1].id, "khong-co")),
        };
        const deleted = await rig.registry.delete(created[1].id);
        const deletedAgain = await rig.registry.delete(created[1].id);
        return scrub(
          {
            order,
            afterMove,
            afterAppend,
            committed: committed.length,
            appended: appended.length,
            errors,
            deleted,
            deletedAgain,
            finalTitles: rig.registry.list().map((w: any) => w.title),
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).order).toEqual(["c", "b", "a"]);
    expect((ours as any).afterAppend).toEqual(["c", "b", "a"]);
    expect((ours as any).deleted).toBe(true);
    expect((ours as any).deletedAgain).toBe(false);
    expect((ours as any).errors.source).toContain("cannot reorder unknown workspace");
  });
});
describe("row workspace — sổ lưu trữ/ghim + waterfall THẬT", () => {
  test("ca 7: lưu trữ/ghim — bốn đường lỗi, lượt lưu trữ BỎ GHIM, provider dừng hỏng chỉ ghi log", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const rig = await makeRig(mod, {
        stored: [
          { id: "s-1", cwd: one, createdAt: 1 },
          { id: "s-2", cwd: one, createdAt: 2 },
          { id: "s-3", cwd: one, createdAt: 3 },
        ],
      });
      try {
        const stops: string[] = [];
        // Waterfall THẬT: listener của provider CHÈN hoạt động của mình vào kết quả `next()`.
        rig.ctx.on("workspace/session-activity", async (request: any, next: () => Promise<readonly any[]>) => {
          const rest = await next();
          return request.sessionId === "s-1" ? [{ kind: "turn" }, ...rest] : rest;
        });
        // Parallel THẬT: một provider ghi vết, một provider HỎNG (chỉ được ghi log).
        rig.ctx.on("workspace/session-stop", (request: any) => {
          stops.push(request.sessionId);
          throw new Error("provider hong");
        });
        const activityError = await rejectionOf(() => rig.registry.archiveSession("s-1"));
        const unknownArchive = await rejectionOf(() => rig.registry.archiveSession("s-x"));
        await rig.registry.archiveSession("s-1", { stopActivity: true });
        const archived = [...rig.registry.archivedSessionIds];
        await rig.registry.pinSession("s-2");
        const pinnedBefore = [...rig.registry.pinnedSessionIds];
        await rig.registry.archiveSession("s-2", { stopActivity: true });
        const pinnedAfterArchive = [...rig.registry.pinnedSessionIds];
        const archivedPinError = await rejectionOf(() => rig.registry.pinSession("s-1"));
        const unknownPin = await rejectionOf(() => rig.registry.pinSession("s-x"));
        const markersBefore = rig.unit.globals.length;
        await rig.registry.unarchiveSession("s-x");
        await rig.registry.unpinSession("s-1");
        await rig.registry.unpinSession("s-x");
        const markersAfterNoops = rig.unit.globals.length;
        await rig.registry.pinSession("s-3");
        const markersAfterFirstPin = rig.unit.globals.length;
        await rig.registry.pinSession("s-3");
        const markersAfterRepeat = rig.unit.globals.length;
        await rig.registry.unarchiveSession("s-1");
        return scrub(
          {
            activityError,
            unknownArchive,
            unknownPin,
            archivedPinError,
            archived,
            pinnedBefore,
            pinnedAfterArchive,
            stops,
            markersBefore,
            markersAfterNoops,
            markersAfterFirstPin,
            markersAfterRepeat,
            pinnedFinal: [...rig.registry.pinnedSessionIds],
            afterUnarchive: [...rig.registry.archivedSessionIds],
            warnLines: rig.logs.filter((line: string) => line.includes("for archive failed")),
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).activityError).toContain("the session is active (turn)");
    expect((ours as any).unknownArchive).toContain("cannot archive session 's-x'");
    expect((ours as any).unknownPin).toContain("cannot pin session 's-x'");
    expect((ours as any).archivedPinError).toContain("the session is archived");
    // `archived` chụp NGAY sau lượt lưu trữ s-1 (s-2 lưu trữ sau đó — xem `afterUnarchive`).
    expect((ours as any).archived).toEqual(["s-1"]);
    expect((ours as any).pinnedBefore).toEqual(["s-2"]);
    expect((ours as any).pinnedAfterArchive).toEqual([]);
    expect((ours as any).stops).toEqual(["s-1", "s-2"]);
    expect((ours as any).markersAfterNoops).toBe((ours as any).markersBefore);
    expect((ours as any).markersAfterFirstPin).toBe((ours as any).markersBefore + 1);
    expect((ours as any).markersAfterRepeat).toBe((ours as any).markersAfterFirstPin);
    expect((ours as any).pinnedFinal).toEqual(["s-3"]);
    expect((ours as any).afterUnarchive).toEqual(["s-2"]);
    expect((ours as any).warnLines.length).toBe(2);
  });

  test("ca 8: initializeDefault — symlink KHÔNG đổi tiêu đề, gọi lặp dùng lại danh tính, xoá ⇒ tắt VĨNH VIỄN", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const target = join(root.path, "real-dir");
      const link = join(root.path, "link-dir");
      await mkdir(target, { recursive: true });
      await import("node:fs/promises").then((fs) => fs.symlink(target, link));
      const rig = await makeRig(mod, { sessions: [] });
      try {
        const requested = join(root.path, "fresh", "nested");
        const created = await rig.registry.initializeDefault(async () => requested);
        const again = await rig.registry.initializeDefault(async () => join(root.path, "khac"));
        const snapshotDefault = rig.registry.list().map((workspace: any) => ({ title: workspace.title, path: workspace.path }));
        // Giàn THỨ HAI (cùng gốc tạm): chỉ gọi MỘT lần với đường dẫn SYMLINK ⇒ tiêu đề lấy từ tên ĐƯỢC
        // YÊU CẦU, còn `path` là đích đã chuẩn tắc — đúng luật "symlink không đổi tiêu đề theo đích".
        const symlinkRig = await makeRig(mod, { sessions: [] });
        const symlinked = await symlinkRig.registry.initializeDefault(async () => link);
        const symlinkTitle = symlinked?.title ?? "(khong co)";
        const symlinkIsTarget = symlinked?.path === (await realpath(target));
        await disposeRig(symlinkRig);
        // Xoá bản ghi MẶC ĐỊNH ⇒ danh tính vẫn được giữ nhưng thực thể đã mất ⇒ TẮT VĨNH VIỄN việc tạo.
        await rig.registry.delete(created.id);
        const afterDelete = await rig.registry.initializeDefault(async () => join(root.path, "y"));
        // Giàn THỨ BA: đã có workspace trong THỨ TỰ mà không có danh tính mặc định ⇒ KHÔNG đủ điều kiện.
        const iso = "2026-10-18T00:00:00.000Z";
        const ineligibleRig = await makeRig(mod, {
          seed: {
            tables: { workspaces: { "w-1": { path: await realpath(target), title: "x", sessionIds: [], createdAt: iso, updatedAt: iso } } },
            global: { initialized: true, workspaceIds: ["w-1"], archivedSessionIds: [], pinnedSessionIds: [] },
          },
          sessions: [],
        });
        const ineligible = await ineligibleRig.registry.initializeDefault(async () => join(root.path, "z"));
        await disposeRig(ineligibleRig);
        return scrub(
          {
            createdTitle: created.title,
            createdPathIsCanonical: created.path === (await realpath(requested)),
            againSame: again?.id === created.id,
            symlinkTitle,
            symlinkIsTarget,
            snapshotDefault,
            ineligible: ineligible === undefined,
            afterDelete: afterDelete === undefined,
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).createdTitle).toBe("nested");
    expect((ours as any).createdPathIsCanonical).toBe(true);
    expect((ours as any).symlinkTitle).toBe("link-dir");
    expect((ours as any).againSame).toBe(true);
    expect((ours as any).ineligible).toBe(true);
    expect((ours as any).afterDelete).toBe(true);
  });

  test("ca 9: initializeDefault KHÔNG có sổ phiên ⇒ ném đúng câu của bản gốc", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const rig = await makeRig(mod);
      try {
        return { error: await rejectionOf(() => rig.registry.initializeDefault(async () => "/tmp/khong-dung")) };
      } finally {
        await disposeRig(rig);
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).error).toContain("default Workspace initialization requires the Session store");
  });
});

describe("row workspace — khởi động: gieo lịch sử, dấu treo, bất nhất", () => {
  test("ca 10: gieo lịch sử từ HEADER — nhóm theo cwd chuẩn tắc, mới nhất trước, đóng dấu initialized", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const a = join(root.path, "alpha");
      const b = join(root.path, "beta");
      await mkdir(a, { recursive: true });
      await mkdir(b, { recursive: true });
      const rig = await makeRig(mod, {
        stored: [
          { id: "s-a2", cwd: a, createdAt: 2000 },
          { id: "s-a1", cwd: a, createdAt: 3000 },
          { id: "s-b1", cwd: b, createdAt: 4000 },
          { id: "s-nowhere", createdAt: 5000 },
        ],
      });
      try {
        const listed = rig.registry.list().map((workspace: any) => ({
          title: workspace.title,
          sessionIds: [...workspace.sessionIds],
        }));
        const lastGlobal = JSON.parse(rig.unit.globals.at(-1) ?? "null");
        return scrub(
          {
            listed,
            puts: rig.unit.puts.length,
            initialized: lastGlobal.initialized,
            order: Array.isArray(lastGlobal.workspaceIds) ? lastGlobal.workspaceIds.length : -1,
            markers: rig.unit.globals.length,
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).listed.map((x: any) => x.title)).toEqual(["beta", "alpha"]);
    expect((ours as any).listed[1].sessionIds).toEqual(["s-a1", "s-a2"]);
    expect((ours as any).puts).toBe(2);
    expect((ours as any).initialized).toBe(true);
    expect((ours as any).order).toBe(2);
  });

  test("ca 11: dấu treo ĐƯỢC phục hồi; sáu trạng thái BẤT NHẤT đều NỔ THÀNH TIẾNG", async () => {
    const iso = "2026-10-18T00:00:00.000Z";
    const record = (path: string, sessionIds: string[] = []) => ({ path, title: "x", sessionIds, createdAt: iso, updatedAt: iso });
    const state = (extra: Record<string, unknown>) => ({
      initialized: true,
      workspaceIds: [],
      archivedSessionIds: [],
      pinnedSessionIds: [],
      ...extra,
    });
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      const two = join(root.path, "two");
      await mkdir(one, { recursive: true });
      await mkdir(two, { recursive: true });
      const canonicalOne = await realpath(one);
      const canonicalTwo = await realpath(two);

      const recovered = await makeRig(mod, {
        seed: {
          tables: { workspaces: { "w-dead": record(canonicalOne) } },
          global: state({ pendingMutation: { operation: "delete", workspaceId: "w-dead" } }),
        },
      });
      const afterRecovery = {
        deletes: [...recovered.unit.deletes],
        list: recovered.registry.list().length,
        lastGlobal: JSON.parse(recovered.unit.globals.at(-1) ?? "null"),
      };
      await disposeRig(recovered);

      const failures = {
        ghostOrder: await rejectionOf(() =>
          makeRig(mod, { seed: { tables: { workspaces: {} }, global: state({ workspaceIds: ["ghost"] }) } }),
        ),
        pendingInOrder: await rejectionOf(() =>
          makeRig(mod, {
            seed: {
              tables: { workspaces: { "w-1": record(canonicalOne) } },
              global: state({ workspaceIds: ["w-1"], pendingMutation: { operation: "delete", workspaceId: "w-1" } }),
            },
          }),
        ),
        repeatedOrder: await rejectionOf(() =>
          makeRig(mod, {
            seed: {
              tables: { workspaces: { "w-1": record(canonicalOne) } },
              global: state({ workspaceIds: ["w-1", "w-1"] }),
            },
          }),
        ),
        duplicatePath: await rejectionOf(() =>
          makeRig(mod, {
            seed: {
              tables: { workspaces: { "w-1": record(canonicalOne), "w-2": record(canonicalOne) } },
              global: state({ workspaceIds: ["w-1", "w-2"] }),
            },
          }),
        ),
        duplicateSession: await rejectionOf(() =>
          makeRig(mod, {
            seed: {
              tables: { workspaces: { "w-1": record(canonicalOne, ["s-1"]), "w-2": record(canonicalTwo, ["s-1"]) } },
              global: state({ workspaceIds: ["w-1", "w-2"] }),
            },
          }),
        ),
        orphan: await rejectionOf(() =>
          makeRig(mod, {
            seed: { tables: { workspaces: { "w-1": record(canonicalOne), "w-2": record(canonicalTwo) } }, global: state({ workspaceIds: ["w-1"] }) },
          }),
        ),
      };
      return scrub({ afterRecovery, failures }, root.path);
    });
    expect(ours).toEqual(stock);
    expect((ours as any).afterRecovery.deletes).toEqual(["workspaces/w-dead"]);
    expect((ours as any).afterRecovery.list).toBe(0);
    expect((ours as any).afterRecovery.lastGlobal.pendingMutation).toBeUndefined();
    expect((ours as any).failures.ghostOrder).toContain("registry order references missing workspace 'ghost'");
    expect((ours as any).failures.pendingInOrder).toContain("is still present in registry order");
    expect((ours as any).failures.repeatedOrder).toContain("registry order repeats workspace 'w-1'");
    expect((ours as any).failures.duplicatePath).toContain("is claimed by both workspace");
    expect((ours as any).failures.duplicateSession).toContain("is accounted by both workspace");
    expect((ours as any).failures.orphan).toContain("is absent from registry order");
  });

  // 10/11/2026 (Lead) — HAI CA CHO LỆCH CHỈ MỤC. Nguyên nhân thật của sự cố "app hiện 1 phiên dù đĩa có 613":
  // sổ workspace đã đóng dấu `initialized` từ lâu nên lượt gieo lịch sử MỘT-LẦN không bao giờ chạy lại, còn
  // 574 thư mục phiên được `bh migrate` chép sang SAU dấu đó ⇒ không vào sổ ⇒ rơi vào "Chưa nhóm" (thu gọn).
  test("ca 11b: sổ KHỚP đĩa ⇒ không ghi byte nào, A/B BẰNG NHAU (khoá parity của lượt kiểm lệch)", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const canonical = await realpath(one);
      const iso = "2026-10-18T00:00:00.000Z";
      const rig = await makeRig(mod, {
        seed: {
          tables: {
            workspaces: {
              "w-seed": { path: canonical, title: "seed", sessionIds: ["s-b", "s-a"], createdAt: iso, updatedAt: iso },
            },
          },
          global: { initialized: true, workspaceIds: ["w-seed"], archivedSessionIds: [], pinnedSessionIds: [] },
        },
        stored: [
          { id: "s-a", cwd: one, createdAt: 1000 },
          { id: "s-b", cwd: one, createdAt: 2000 },
          // Phiên KHÔNG giải được đường dẫn (không có cwd) không bao giờ bị coi là mồ côi.
          { id: "s-nocwd", createdAt: 3000 },
        ],
      });
      try {
        return scrub(
          {
            listed: rig.registry.list().map((workspace: any) => [...workspace.sessionIds]),
            writes: rig.unit.puts.length,
            markers: rig.unit.globals.length,
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).listed).toEqual([["s-b", "s-a"]]);
    expect((ours as any).writes).toBe(0);
    expect((ours as any).markers).toBe(0);
  });

  test("ca 11c: đĩa có phiên MỒ CÔI ⇒ TA nhận nuôi (ghi sổ), bản gốc KHÔNG — sai khác khai ở docs/GBH-SAI-KHAC-CO-CHU-DICH.md §2h", async () => {
    const scenario = async (mod: Mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const canonical = await realpath(one);
      const iso = "2026-10-18T00:00:00.000Z";
      const rig = await makeRig(mod, {
        seed: {
          tables: {
            workspaces: {
              "w-seed": { path: canonical, title: "seed", sessionIds: ["s-old"], createdAt: iso, updatedAt: iso },
            },
          },
          global: { initialized: true, workspaceIds: ["w-seed"], archivedSessionIds: [], pinnedSessionIds: [] },
        },
        stored: [
          { id: "s-old", cwd: one, createdAt: 1000 },
          // Hai phiên "chép sang sau dấu initialized" — đúng hình dạng sự cố 10/11/2026.
          { id: "s-new1", cwd: one, createdAt: 3000 },
          { id: "s-new2", cwd: one, createdAt: 2000 },
          // Không có cwd ⇒ không giải được đường dẫn ⇒ KHÔNG được nhận nuôi.
          { id: "s-nocwd", createdAt: 4000 },
          // Đường dẫn CÓ THẬT nhưng CHƯA có workspace nào ⇒ TUYỆT ĐỐI không tự tạo workspace mới
          // (bản gốc coi "xoá workspace" là vĩnh viễn; tự tạo lại là hồi sinh thứ người dùng đã xoá).
          { id: "s-elsewhere", cwd: root.path, createdAt: 5000 },
        ],
      });
      try {
        return scrub(
          {
            listed: rig.registry.list().map((workspace: any) => [...workspace.sessionIds]),
            writes: rig.unit.puts.length,
            adopted: rig.logs.filter((line) => line.includes("chưa thuộc workspace nào")).length,
          },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    };
    const [ours, stock] = await ab(scenario);
    // Bản GỐC giữ nguyên sổ cũ (đây chính là lỗi người dùng thấy).
    expect((stock as any).listed).toEqual([["s-old"]]);
    expect((stock as any).writes).toBe(0);
    // TA nhận nuôi ĐÚNG hai phiên mới, giữ phiên cũ, KHÔNG nuôi phiên không có cwd; mới nhất đứng trước.
    expect((ours as any).listed).toEqual([["s-new1", "s-new2", "s-old"]]);
    expect((ours as any).writes).toBe(1);
    expect((ours as any).adopted).toBe(1);
    // Đối chứng âm: bản gốc KHÔNG in dòng nhận nuôi nào.
    expect((stock as any).adopted).toBe(0);
  });
});
describe("row workspace — C6 danh tính, ca flaky CÓ TRẦN, artifact", () => {
  test("ca 12: C6 DANH TÍNH — getter trả mảng MỚI, hai thực thể KHÔNG chia sẻ, hai lần cài ĐỘC LẬP", async () => {
    const root = await makeTempRoot();
    const one = join(root.path, "one");
    const two = join(root.path, "two");
    await mkdir(one, { recursive: true });
    await mkdir(two, { recursive: true });
    const rig = await makeRig(OUR);
    const other = await makeRig(OUR);
    try {
      const first = await rig.registry.create(one);
      const second = await rig.registry.create(two);
      // (1) Mỗi lượt đọc trả MẢNG MỚI — so SÂU vẫn đạt nên `toEqual` KHÔNG bắt được lớp lỗi này.
      expect(first.sessionIds).toEqual(first.sessionIds);
      expect(first.sessionIds).not.toBe(first.sessionIds);
      // (2) Hai thực thể KHÁC nhau không chia sẻ vật thể mảng (cùng rỗng ở đây).
      expect(first.sessionIds).not.toBe(second.sessionIds);
      // (3) `list()` trả MẢNG MỚI, nhưng PHẦN TỬ giữ nguyên danh tính (cache thực thể).
      expect(rig.registry.list()).not.toBe(rig.registry.list());
      expect(rig.registry.list()[0]).toBe(rig.registry.get(rig.registry.list()[0].id));
      // (4) Sửa bên này KHÔNG lan bên kia.
      const beforeOther = other.registry.list().length;
      await first.setTitle("doi-ten");
      expect(rig.registry.list().map((workspace: any) => workspace.title)).toContain("doi-ten");
      expect(other.registry.list().length).toBe(beforeOther);
      expect(other.registry.get(first.id)).toBeUndefined();
      // (5) HAI LẦN CÀI cùng gói: sổ thực thể RIÊNG; còn `workspaceDomainSpec` là SINGLETON của
      //     module — đó là hành vi CỦA BẢN GỐC, đo được ở cả hai bên.
      expect(rig.mod.workspaceDomainSpec).toBe(other.mod.workspaceDomainSpec);
      expect(rig.registry).not.toBe(other.registry);
    } finally {
      await disposeRig(rig);
      await disposeRig(other);
      await root.clean();
    }

    const [ours, stock] = await ab(async (mod) => {
      const localRoot = await makeTempRoot();
      const dir = join(localRoot.path, "c6");
      const other = join(localRoot.path, "c6-khac");
      await mkdir(dir, { recursive: true });
      await mkdir(other, { recursive: true });
      const localRig = await makeRig(mod);
      const secondRig = await makeRig(mod);
      try {
        const workspace = await localRig.registry.create(dir);
        return scrub(
          {
            freshArrayPerRead: workspace.sessionIds !== workspace.sessionIds,
            deepEqualStillTrue: JSON.stringify(workspace.sessionIds) === JSON.stringify(workspace.sessionIds),
            distinctWorkspaceArrays: workspace.sessionIds !== (await localRig.registry.create(other)).sessionIds,
            listFresh: localRig.registry.list() !== localRig.registry.list(),
            listElementsStable: localRig.registry.list()[0] === localRig.registry.list()[0],
            entityCached: localRig.registry.get(workspace.id) === localRig.registry.get(workspace.id),
            crossInstallIsolated: secondRig.registry.get(workspace.id) === undefined,
            specIsModuleSingleton: localRig.mod.workspaceDomainSpec === secondRig.mod.workspaceDomainSpec,
          },
          localRoot.path,
        );
      } finally {
        await disposeRig(localRig);
        await disposeRig(secondRig);
        await localRoot.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).freshArrayPerRead).toBe(true);
    expect((ours as any).deepEqualStillTrue).toBe(true);
    expect((ours as any).distinctWorkspaceArrays).toBe(true);
    expect((ours as any).listFresh).toBe(true);
    expect((ours as any).listElementsStable).toBe(true);
    expect((ours as any).entityCached).toBe(true);
    expect((ours as any).crossInstallIsolated).toBe(true);
    expect((ours as any).specIsModuleSingleton).toBe(true);
  });

  test("ca 13: hai create ĐỒNG THỜI trên cùng đường dẫn ⇒ MỘT bản ghi; waitFor CÓ TRẦN", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const one = join(root.path, "one");
      await mkdir(one, { recursive: true });
      const rig = await makeRig(mod);
      try {
        const [first, second] = await Promise.all([rig.registry.create(one), rig.registry.create(one)]);
        await waitFor(() => rig.registry.list().length === 1, "mot workspace sau hai luot tao dong thoi", 2000);
        return scrub(
          { sameEntity: first.id === second.id, list: rig.registry.list().length, puts: rig.unit.puts.length },
          root.path,
        );
      } finally {
        await disposeRig(rig);
        await root.clean();
      }
    });
    expect(ours).toEqual(stock);
    expect((ours as any).sameEntity).toBe(true);
    expect((ours as any).list).toBe(1);
    expect((ours as any).puts).toBe(1);

    // Chứng minh `waitFor` KẾT THÚC ĐÚNG TRẦN khi điều kiện không bao giờ đạt (không treo vô hạn).
    const started = Date.now();
    let threw = false;
    try {
      await waitFor(() => false, "dieu kien khong bao gio dung", 120);
    } catch {
      threw = true;
    }
    const elapsed = Date.now() - started;
    expect(threw).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(1500);
  });

  test("ca 14: ARTIFACT — tập export = gốc (0 thiếu · 0 thừa), 0 id module, default LÀ lớp", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-ws-build-"));
    try {
      const built = await Bun.build({
        entrypoints: [join(PKG, "src", "index.ts")],
        outdir: out,
        target: "node",
        format: "esm",
        naming: "index.js",
        packages: "external",
      });
      expect(built.success).toBe(true);
      // Peer của artifact phải phân giải về KERNEL: `PKG/node_modules` là bản SAO workspace (MÔ-ĐUN khác,
      // `Symbol` scope cũng khác) nên lớp nền `Service` sẽ lệch danh tính với bản gốc dù mã y hệt.
      await mkdir(join(out, "node_modules"), { recursive: true });
      await symlink(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(out, "node_modules", "@deepseek-ai"), "dir");
      await symlink(join(REPO, "apps", "host", "node_modules", "zod"), join(out, "node_modules", "zod"), "dir");
      const artifact = (await import(join(out, "index.js"))) as Mod;
      const code = await readFile(join(out, "index.js"), "utf8");
      const stockCode = await readFile(join(STOCK_DIR, "lib", "index.js"), "utf8");
      const oursExports = exportNames(code);
      const stockExports = exportNames(stockCode);
      expect([...stockExports].filter((name) => !oursExports.has(name))).toEqual([]);
      expect([...oursExports].filter((name) => !stockExports.has(name))).toEqual([]);
      expect(oursExports.size).toBe(12);
      expect(stockExports.size).toBe(12);
      // Row HOST thuần: KHÔNG đăng ký id module nào và KHÔNG chứa id gói gốc ở vị trí `id:`.
      expect(countOf(code, "__ModuleLoader__")).toBe(0);
      expect(countOf(code, "id: @deepseek-ai")).toBe(0);
      // Nhị phân đã nạp (artifact, KHÔNG phải bản `src` — bản đó nạp peer của workspace): `default` LÀ
      // chính lớp, và hai bên kế thừa CÙNG một `Service` của kernel.
      expect(artifact.default).toBe(artifact.WorkspaceRegistry);
      expect(STOCK.default).toBe(STOCK.WorkspaceRegistry);
      expect(Object.getPrototypeOf(artifact.WorkspaceRegistry)).toBe(Object.getPrototypeOf(STOCK.WorkspaceRegistry));
      // Bản gốc cũng là row MỘT MẶT: không có `lib/client.js`.
      expect(await readFile(join(STOCK_DIR, "lib", "index.js"), "utf8")).not.toContain("__ModuleLoader__");
    } finally {
      await rm(out, { recursive: true, force: true });
    }
  });

  test("ca 15: hàm thuần + schema miền — A/B TỪNG CHỮ (kể cả câu lỗi zod)", async () => {
    const [ours, stock] = await ab(async (mod) => {
      const root = await makeTempRoot();
      const dir = join(root.path, "dir");
      await mkdir(dir, { recursive: true });
      const record = { path: "/x", title: "t", sessionIds: ["s-1"], createdAt: "a", updatedAt: "b" };
      const result = {
        idPassthrough: mod.WorkspaceId("abc-123"),
        relativeError: await rejectionOf(async () => mod.realpathNormalize("relative/x")),
        canonical: (await mod.realpathNormalize(dir + "/.")) === (await realpath(dir)),
        recordParsed: mod.workspaceRecord.parse(record),
        recordBad: errorOf(() => mod.workspaceRecord.parse({ path: 1 })),
        stateDefaults: mod.workspaceDomainState.parse({ initialized: false, workspaceIds: [] }),
        stateBad: errorOf(() => mod.workspaceDomainState.parse({ initialized: "no" })),
        spec: {
          name: mod.workspaceDomainSpec.name,
          version: mod.workspaceDomainSpec.version,
          tables: Object.keys(mod.workspaceDomainSpec.tables),
          shape: Object.keys(mod.workspaceDomainSpec.tables.workspaces),
          initial: mod.workspaceDomainSpec.global.initial,
        },
        moveError: (() => {
          const error = new mod.WorkspaceMoveInvalidError("x");
          return { name: error.name, message: error.message };
        })(),
      };
      return scrub(result, root.path);
    });
    expect(ours).toEqual(stock);
    expect((ours as any).idPassthrough).toBe("abc-123");
    expect((ours as any).relativeError).toContain("is not fully qualified");
    expect((ours as any).stateDefaults.archivedSessionIds).toEqual([]);
    expect((ours as any).stateDefaults.pinnedSessionIds).toEqual([]);
    expect((ours as any).spec).toEqual({
      name: "workspace",
      version: 2,
      tables: ["workspaces"],
      shape: ["valueSchema"],
      initial: { initialized: false, workspaceIds: [], archivedSessionIds: [], pinnedSessionIds: [] },
    });
    expect((ours as any).moveError.name).toBe("WorkspaceMoveInvalidError");
  });
});
