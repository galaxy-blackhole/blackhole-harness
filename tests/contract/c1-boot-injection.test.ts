/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hop dong C1: boot injection __DSH_BOOT__ + cac bien toan cuc ma trang web nhan duoc
 */

import { describe, expect, test } from "bun:test";
import { analyseInjectGraph, readFixture, type InjectGraph, type NormalisedBoot } from "./lib.ts";

/** Fixture đồ thị boot đã đóng băng (sinh bằng tests/contract/capture.ts). */
interface BootFixture extends NormalisedBoot {
  /** Ngày chụp. */
  capturedAt: string;
  /** Chẩn đoán đồ thị inject đã đóng băng. */
  graph: InjectGraph;
}

/** Fixture các biến toàn cục boot chèn vào trang. */
interface GlobalsFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** URL nguồn đã che token. */
  source: string;
  /** Phiên bản harness. */
  release: { version: string; commit: string };
  /** Các biến toàn cục. */
  globals: { name: string; value: unknown }[];
}

const boot = readFixture<BootFixture>("c1-boot-graph.json");
const globals = readFixture<GlobalsFixture>("c1-page-globals.json");

/** Chạy lại phần C1 khi GBH_CONTRACT_LIVE=1 (cần host đang chạy). */
const live = process.env.GBH_CONTRACT_LIVE === "1";

describe("C1 — boot injection", () => {
  test("có đủ khoá cấp cao nhất và bản phát hành", () => {
    expect(boot.topKeys).toEqual(["batches", "entries", "release", "rev"]);
    expect(boot.releaseVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(boot.releaseCommit.length).toBeGreaterThanOrEqual(7);
  });

  test("đồ thị entry: id duy nhất, có url, có rev", () => {
    expect(boot.entries.length).toBeGreaterThan(50);
    const ids = boot.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of boot.entries) {
      expect(entry.id.startsWith("@")).toBe(true);
      expect(entry.url).toContain(entry.id + "/client.js");
      expect(entry.rev).toBe("<rev>");
    }
  });

  test("inject là GỢI Ý thứ tự, không phải DAG cứng — chẩn đoán khớp fixture", () => {
    // Sự thật đo được: có id được inject mà không có entry riêng, và có chu trình.
    // Loader phải chịu được cả hai; đây là bất biến của hợp đồng C1 (xem docs/contracts/C1-boot-injection.md).
    expect(analyseInjectGraph(boot.entries)).toEqual(boot.graph);
    expect(boot.graph.unresolved.length).toBeGreaterThan(0);
    expect(boot.graph.unresolved).toContain("@deepseek-ai/dsh-client-ui-primitives");
  });

  test("lô nạp đầu tiên là bootstrap và chứa client-modules", () => {
    const first = boot.batches[0];
    expect(first?.phase).toBe("bootstrap");
    expect(first?.entries).toEqual(["@deepseek-ai/dsh-client-modules"]);
    const ids = new Set(boot.entries.map((e) => e.id));
    for (const batch of boot.batches) {
      for (const id of batch.entries) expect(ids.has(id)).toBe(true);
    }
  });

  test("biến toàn cục: có boot, có biến riêng của Blackhole, khoá không đổi", () => {
    const names = globals.globals.map((g) => g.name);
    expect(names).toContain("__DSH_MODELS_ONBOARDING__");
    expect(names).toContain("__GBH_HAS_KEY__");
    // task-31: đồ thị boot có fixture riêng; trang phát CẢ __GBH_BOOT__ (chính) lẫn __DSH_BOOT__ (alias).
    expect(names).not.toContain("__GBH_BOOT__");
    expect(names).not.toContain("__DSH_BOOT__");
    const shortcuts = globals.globals.find((g) => g.name === "__DSH_SHORTCUTS_CONFIG__");
    expect((shortcuts?.value as { stopSequenceMs?: number })?.stopSequenceMs).toBe(500);
    const recovery = globals.globals.find((g) => g.name === "__DSH_CONNECTION_RECOVERY__");
    expect((recovery?.value as { backoffBaseMs?: number })?.backoffBaseMs).toBe(500);
  });

  test("fixture không rò token hay đường dẫn tuyệt đối", () => {
    const text = JSON.stringify(boot) + JSON.stringify(globals);
    expect(text).not.toContain("token=ey");
    expect(text).not.toMatch(/\/(?:Users|home)\/[a-z]/i);
  });

  test.skipIf(!live)("so lại với trang đang chạy (GBH_CONTRACT_LIVE=1)", async () => {
    const { extractBoot, fetchPage, loadReadyUrl } = await import("./lib.ts");
    const url = loadReadyUrl();
    expect(url).not.toBeNull();
    const html = url === null ? null : await fetchPage(url);
    expect(html).not.toBeNull();
    const fresh = html === null ? null : extractBoot(html);
    expect(fresh?.releaseVersion).toBe(boot.releaseVersion);
    expect(fresh?.entries.map((e) => e.id)).toEqual(boot.entries.map((e) => e.id));
    expect(fresh === null ? [] : analyseInjectGraph(fresh.entries)).toEqual(boot.graph);
  });
});
