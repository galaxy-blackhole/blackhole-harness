/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test gói host gbh-session-delete — ba hàm thuần quyết định an toàn của lượt xoá phiên (ADR 0016):
 *      id có an toàn làm tên thư mục, dò đúng thư mục nhật ký, và từ chối mọi đường dẫn ra ngoài gốc.
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findSessionDirs, requireSafeId, verifySessionDir } from "../../packages/host/session-delete/src/service.ts";
import { deleteStoredSession } from "../../packages/host/session-delete/src/service.ts";

/**
 * Dựng một gốc lưu trữ tạm với một phiên nằm trong thư mục dự án.
 * Nhận: id — id phiên cần tạo.
 * Trả: { root, sessionDir } — gốc lưu trữ và thư mục nhật ký vừa tạo.
 */
async function makeStore(id: string): Promise<{ root: string; sessionDir: string }> {
  const root = await mkdtemp(join(tmpdir(), "gbh-session-delete-"));
  const project = join(root, "--Users-demo-project--");
  const sessionDir = join(project, id);
  await mkdir(sessionDir, { recursive: true });
  // Tên tệp THẬT của backend jsonl hiện hành (đo trên ~/.galaxy/blackhole/sessions ngày 24/10/2026).
  await writeFile(join(sessionDir, "session.v4.jsonl.zstd"), "zstd-bytes", "utf8");
  return { root, sessionDir };
}

describe("session-delete — an toàn đường dẫn", () => {
  test("requireSafeId nhận id thường và TỪ CHỐI id có dấu phân cách đường dẫn", () => {
    expect(requireSafeId("98eb0234-1892-4beb-bf46-a6cb7469c985")).toBe("98eb0234-1892-4beb-bf46-a6cb7469c985");
    expect(() => requireSafeId("../etc")).toThrow();
    expect(() => requireSafeId("a/b")).toThrow();
    expect(() => requireSafeId("")).toThrow();
    expect(() => requireSafeId(42)).toThrow();
  });

  test("findSessionDirs chỉ nhận thư mục có tên ĐÚNG BẰNG id, ở bất kỳ dự án nào", async () => {
    const id = "session-abc";
    const { root, sessionDir } = await makeStore(id);
    try {
      const found = await findSessionDirs(root, id);
      expect(found).toEqual([sessionDir]);
      expect(await findSessionDirs(root, "session-khac")).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("findSessionDirs KHÔNG đi theo symlink, và verifySessionDir từ chối thư mục ngoài gốc", async () => {
    const id = "session-outside";
    const { root } = await makeStore("session-trong");
    const ngoai = await mkdtemp(join(tmpdir(), "gbh-outside-"));
    const outsideDir = join(ngoai, id);
    await mkdir(outsideDir, { recursive: true });
    await writeFile(join(outsideDir, "events.jsonl"), "{}\n", "utf8");
    try {
      await symlink(outsideDir, join(root, "--Users-demo-project--", id));
      // (a) Dò thư mục BỎ QUA symlink (lstat: không phải thư mục thật) ⇒ không có ứng viên nào.
      expect(await findSessionDirs(root, id)).toEqual([]);
      // (b) Dù có ai gọi thẳng hàm kiểm với đường dẫn ngoài gốc, nó vẫn phải từ chối.
      await expect(verifySessionDir(outsideDir, root, id)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(ngoai, { recursive: true, force: true });
    }
  });

  test("verifySessionDir từ chối thư mục không có tệp nhật ký events*", async () => {
    const id = "session-rong";
    const { root } = await makeStore(id);
    try {
      await rm(join(root, "--Users-demo-project--", id, "session.v4.jsonl.zstd"), { force: true });
      const candidates = await findSessionDirs(root, id);
      await expect(verifySessionDir(candidates[0] as string, root, id)).rejects.toThrow(/session log/i as never);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("verifySessionDir chấp nhận thư mục hợp lệ và trả đường dẫn thật", async () => {
    const id = "session-hop-le";
    const { root, sessionDir } = await makeStore(id);
    try {
      const real = await verifySessionDir(sessionDir, root, id);
      expect(real.endsWith(id)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
describe("session-delete — lượt xoá qua lớp dịch vụ", () => {
  test("xoá thật thư mục nhật ký, gọi đối soát chỉ mục, và trả đường dẫn", async () => {
    const id = "session-xoa-that";
    const { root, sessionDir } = await makeStore(id);
    let reconciled = 0;
    const persistence = { root, stat: async (): Promise<unknown> => ({ header: { id } }) };
    const sessionQuery = { listSessions: async (): Promise<readonly unknown[]> => { reconciled += 1; return []; } };
    try {
      const result = await deleteStoredSession({ persistence, sessionQuery }, { sessionId: id });
      expect(result.deleted).toBe(true);
      // macOS: realpath đổi /var → /private/var nên so phần cuối thay vì nguyên chuỗi.
      expect(result.path.endsWith(join("--Users-demo-project--", id))).toBe(true);
      expect(result.path.endsWith(sessionDir.split("/").slice(-2).join("/"))).toBe(true);
      expect(existsSync(sessionDir)).toBe(false);
      expect(reconciled).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("CHẶN khi phiên ĐANG CHẠY (mã session/delete-live)", async () => {
    const id = "session-dang-song";
    const { root, sessionDir } = await makeStore(id);
    const persistence = { root, stat: async (): Promise<unknown> => ({ header: { id } }) };
    // Chỉ `status === "running"` mới là đang chạy — xem ca ngay dưới.
    // Kiểu trả phải khớp seam đọc `status` của service (không phải `unknown`).
    const agents = { get: (): { readonly id: string; readonly status: string } => ({ id, status: "running" }) };
    try {
      await expect(deleteStoredSession({ persistence, agents }, { sessionId: id })).rejects.toMatchObject({ code: "session/delete-live" });
      expect(existsSync(sessionDir)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  /**
   * Hồi quy 01/11/2026: phiên chỉ cần được NẠP (agentAvailable) là bị chặn oan, vì guard cũ dùng
   * `agents.get(id) !== undefined`. Điều kiện đúng là `status === "running"`.
   */
  test("KHÔNG chặn phiên đã nạp nhưng đang rảnh (chỉ chặn khi status = running)", async () => {
    const id = "session-dang-ranh";
    const { root, sessionDir } = await makeStore(id);
    const persistence = { root, stat: async (): Promise<unknown> => ({ header: { id } }) };
    /** Cùng hình dạng seam như ca trên — trạng thái KHÁC "running". */
    const agents = { get: (): { readonly id: string; readonly status: string } => ({ id, status: "idle" }) };
    try {
      const result = await deleteStoredSession({ persistence, agents }, { sessionId: id });
      expect(result.deleted).toBe(true);
      expect(existsSync(sessionDir)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
