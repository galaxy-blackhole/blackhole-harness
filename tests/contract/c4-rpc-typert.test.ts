/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C4: RPC/Typert — khung do + cac be mat Remote quan sat duoc ngay (frame do o M4)
 */

import { describe, expect, test } from "bun:test";
import { readFixture } from "./lib.ts";

/** Fixture khung đo RPC (C4). */
interface RpcFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Entry gateway/connection trong đồ thị boot. */
  bootEntries: { id: string; inject: string[] }[];
  /** Bề mặt Remote có thật trong cây plugin. */
  remoteSurfaces: { id: string; pkg: string }[];
  /** Method sẽ trace ở M4 (kế hoạch). */
  plannedMethods: string[];
  /** Ghi chú việc còn phải đo. */
  note: string;
}

/** Fixture cây plugin (dùng để đối chiếu chéo). */
interface TreeFixture {
  /** Cây của app ta. */
  ours: { rows: { id: string; name: string }[] };
}

/** Fixture đồ thị boot (dùng để đối chiếu chéo). */
interface BootFixture {
  /** Đồ thị entry. */
  entries: { id: string; inject: string[] }[];
}

const rpc = readFixture<RpcFixture>("c4-rpc-plan.json");
const tree = readFixture<TreeFixture>("c3-profile-tree.json");
const boot = readFixture<BootFixture>("c1-boot-graph.json");

describe("C4 — RPC/Typert (khung đo; số liệu frame đo ở M4)", () => {
  test("đồ thị boot có gateway, remotes và connection với cạnh inject đã chốt", () => {
    const gateway = boot.entries.find((e) => e.id === "@deepseek-ai/dsh-api-gateway");
    const remotes = boot.entries.find((e) => e.id === "@deepseek-ai/dsh-api-remotes");
    const connection = boot.entries.find((e) => e.id === "@deepseek-ai/dsh-client-connection");
    expect(gateway).toBeDefined();
    expect(remotes?.inject).toEqual(["@deepseek-ai/dsh-api-gateway"]);
    expect(connection).toBeDefined();
    expect(rpc.bootEntries.map((e) => e.id)).toContain("@deepseek-ai/dsh-api-gateway");
  });

  test("bề mặt Remote lấy từ cây thật: >=8 mục, id duy nhất, đúng họ api-*", () => {
    expect(rpc.remoteSurfaces.length).toBeGreaterThanOrEqual(8);
    const ids = rpc.remoteSurfaces.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const surface of rpc.remoteSurfaces) {
      expect(/@deepseek-ai\/dsh-api-(gateway|remotes|[a-z-]+-controller)/.test(surface.pkg)).toBe(true);
    }
  });

  test("mọi bề mặt Remote phải có row tương ứng trong cây plugin", () => {
    const rowIds = new Set(tree.ours.rows.map((r) => r.id));
    const missing = rpc.remoteSurfaces.filter((s) => !rowIds.has(s.id)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  test("kế hoạch đo ở M4 nêu đủ 5 namespace sẽ trace", () => {
    expect(rpc.plannedMethods.length).toBeGreaterThanOrEqual(5);
    for (const namespace of ["session", "workspaceFiles", "jobs", "account", "settings"]) {
      expect(rpc.plannedMethods.some((m) => m.startsWith(namespace + ":"))).toBe(true);
    }
    expect(rpc.note).toContain("M4");
  });

  test.todo("M4: ghi trace WS/HTTP hai bên, chuẩn hoá token/timestamp rồi diff từng frame");
});
