/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test cờ phân loại ẩn bundle stock KHÔNG có bản port GBH 1:1 (KHONG_HO_TRO): hai gói agent con
 *      @deepseek-ai/dsh-subagent-{claude-code,codex} phải nằm trong tập ẩn và listBundles phải tra tập ấy,
 *      đồng thời tập ẩn phải khớp sự thật là repo KHÔNG có gói port tương ứng. Vì sao (đo 11/11/2026): RPC
 *      pluginManager/listBundles trả 2 bundle stock với official:true nên trang Plugins hiện id @deepseek-ai/*
 *      — lượt 25/10 đã làm RỖNG tập ẩn kèm ghi chú sai rằng repo đã có bundle-subagent-*.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DOI_TEN, KHONG_HO_TRO } from "../../packages/host/plugin-manager/src/bundle-rename.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Hai id stock mà người dùng báo còn hiện trên trang Plugins. */
const STOCK_AGENT_CON = ["@deepseek-ai/dsh-subagent-claude-code", "@deepseek-ai/dsh-subagent-codex"] as const;

/** Hai tên gói GBH sẽ phải tồn tại nếu ai đó port 1:1 hai gói trên. */
const GOI_PORT_GBH = ["@galaxy-blackhole/gbh-subagent-claude-code", "@galaxy-blackhole/gbh-subagent-codex"] as const;

/**
 * Đọc tên mọi gói đang có trong repo (packages/<tầng>/<gói>/package.json), đọc TĨNH để test không phải import.
 * @returns danh sách tên gói khai trong manifest; gói chưa có manifest thì bỏ qua.
 */
function tenGoiTrongRepo(): string[] {
  const out: string[] = [];
  for (const tang of ["host", "client", "tools"]) {
    let thuMuc: string[] = [];
    try {
      thuMuc = readdirSync(join(REPO, "packages", tang));
    } catch {
      continue;
    }
    for (const ten of thuMuc) {
      try {
        const manifest = JSON.parse(readFileSync(join(REPO, "packages", tang, ten, "package.json"), "utf8")) as { name?: string };
        if (typeof manifest.name === "string") out.push(manifest.name);
      } catch {
        // Gói chưa có manifest (hoặc manifest hỏng) — không tính vào phép kiểm này.
      }
    }
  }
  return out;
}

describe("plugin-manager — ẩn bundle agent con stock (KHONG_HO_TRO)", () => {
  test("hai gói agent con stock nằm trong tập ẩn", () => {
    for (const ten of STOCK_AGENT_CON) expect(KHONG_HO_TRO.has(ten)).toBe(true);
  });

  test("tập ẩn chỉ chứa id STOCK (đây là cờ phân loại stock-không-port)", () => {
    for (const ten of KHONG_HO_TRO) expect(ten.startsWith("@deepseek-ai/")).toBe(true);
  });

  test("repo KHÔNG có bản port 1:1 nên hai tên phải ở lại tập ẩn", () => {
    const tenGoi = tenGoiTrongRepo();
    for (const goiPort of GOI_PORT_GBH) {
      // Nếu test này đỏ: đã có gói port 1:1 ⇒ XOÁ tên stock tương ứng khỏi KHONG_HO_TRO rồi cập nhật test.
      expect(tenGoi).not.toContain(goiPort);
    }
    for (const ten of STOCK_AGENT_CON) expect(Object.hasOwn(DOI_TEN, ten)).toBe(false);
  });

  test("listBundles tra tập ẩn trước khi dựng BundleInfo", () => {
    const nguon = readFileSync(join(REPO, "packages", "host", "plugin-manager", "src", "list-bundles.ts"), "utf8");
    expect(nguon).toContain("if (KHONG_HO_TRO.has(name)) continue;");
  });
});
