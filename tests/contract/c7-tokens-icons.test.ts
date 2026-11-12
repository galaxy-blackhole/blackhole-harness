/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hop dong C7: token --dsw-* + icon — luat style cua DSH, khong Tailwind/component lib, so icon GBH
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { ICON_TOKEN_ALLOWLIST } from "../../tools/check/no-dsh-assets.ts";
import {
  DSH_TO_GBH_ICON,
  GBH_ARTWORKS,
  GBH_FAVICON_ARTWORK,
  GBH_LOGO_ARTWORK,
} from "../../packages/client/ui-primitives/src/index.ts";
import { readFixture, REPO_ROOT } from "./lib.ts";

/** Fixture token/icon (C7). */
interface StyleFixture {
  /** Ngày chụp. */
  capturedAt: string;
  /** Entry theme trong đồ thị boot (nguồn phát token --dsw-*). */
  themeEntry: { id: string; inject: string[] } | null;
  /** Token --dsw-* tìm thấy trong mã nguồn repo. */
  dswTokensInRepo: string[];
  /** Thư viện UI bị cấm có trong package.json của workspace. */
  bannedDeps: { pkg: string; dep: string }[];
  /** lucide-react được khai ở đâu. */
  lucide: { pkg: string }[];
}

/** Fixture đã đóng băng. */
const fixture = readFixture<StyleFixture>("c7-style-icons.json");

/** Thư mục UI của ta (chưa tồn tại ở M2 — test tự bỏ qua khi trống). */
const UI_DIRS = ["ui", "packages/client-ui", "apps/desktop/ui"];

/**
 * Gom các file style/component trong thư mục UI của ta.
 * Nhận: không.
 * Trả: mảng đường dẫn tuyệt đối (.css, .module.css, .tsx).
 */
function uiFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        walk(abs);
        continue;
      }
      if (/\.(css|tsx)$/.test(e.name)) out.push(abs);
    }
  };
  for (const rel of UI_DIRS) walk(join(REPO_ROOT, rel));
  return out;
}

describe("C7 — token --dsw-* + icon", () => {
  test("plugin theme (nguồn phát token) có trong đồ thị boot với cạnh inject đã chốt", () => {
    expect(fixture.themeEntry).not.toBeNull();
    expect(fixture.themeEntry?.id).toBe("@deepseek-ai/dsh-client-ui-theme");
    expect(fixture.themeEntry?.inject.length).toBeGreaterThanOrEqual(6);
    expect(fixture.themeEntry?.inject).toContain("@deepseek-ai/dsh-api-remotes");
  });

  test("không có Tailwind hay thư viện component nào trong workspace", () => {
    expect(fixture.bannedDeps).toEqual([]);
  });

  test("lucide-react chỉ được dùng cho UI mới của Blackhole (hiện chưa khai ở đâu)", () => {
    expect(fixture.lucide).toEqual([]);
  });

  test("component/style của ta không chứa màu literal (chỉ token --dsw-*)", () => {
    const files = uiFiles();
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const hits = text.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hits) offenders.push(file.slice(REPO_ROOT.length + 1) + " :: " + hits.slice(0, 3).join(","));
    }
    if (files.length === 0) console.log("chưa có file UI nào (M5 mới có) — luật sẽ tự áp khi có");
    expect(offenders).toEqual([]);
    expect(existsSync(join(REPO_ROOT, "ui")) || files.length === 0).toBe(true);
  });

  // Từ 18/10/2026: mục "icon parity truy được về SVG gốc" KHÔNG còn là todo — đã có sổ artwork 1:1 của GBH
  // (packages/client/ui-primitives) + test đối chiếu byte với vỏ đang chạy ở tests/client/ui-primitives.test.ts.
  // Ở đây kiểm phần HỢP ĐỒNG: icon dùng trong bundle phải nằm trong sổ GBH, và artwork phải có nguồn (G4).
  test("mọi icon mà bundle client tham chiếu đều nằm trong sổ GBH (C7 §1.4)", () => {
    const known = new Set(Object.keys(DSH_TO_GBH_ICON));
    const offenders: string[] = [];
    for (const pkg of readdirSync(join(REPO_ROOT, "packages", "client"))) {
      const file = join(REPO_ROOT, "packages", "client", pkg, "lib", "client.js");
      if (!existsSync(file)) continue;
      const code = readFileSync(file, "utf8");
      for (const match of code.matchAll(/\bIcon[A-Z][A-Za-z0-9]+\b/g)) {
        const token = match[0];
        if (known.has(token) || ICON_TOKEN_ALLOWLIST[token] !== undefined) continue;
        offenders.push(pkg + " :: " + token);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("artwork GBH có nguồn đối chiếu (G4) và chỉ asset thương hiệu mới chứa màu literal (C7 §1.3)", () => {
    const missingSource = Object.entries(GBH_ARTWORKS)
      .filter(([, artwork]) => typeof artwork !== "function" && artwork.component.trim() === "")
      .map(([name]) => name);
    expect(missingSource).toEqual([]);
    // Icon dùng currentColor (không màu literal). Màu literal chỉ được nằm trong NHÓM MINH HOẠ (artwork plugin/guide)
    // và 2 asset thương hiệu — đó là asset, không phải style component (C7 P4/P1: "artwork minh hoạ có màu riêng").
    const literalColor = /#[0-9a-fA-F]{3,8}\b/;
    const illustration = /^(PluginArtwork|GuideArtwork)/;
    const withColor = Object.entries(GBH_ARTWORKS)
      .filter(([, artwork]) => typeof artwork !== "function" && literalColor.test(JSON.stringify(artwork)))
      .map(([name]) => name);
    expect(withColor.filter((name) => !illustration.test(name))).toEqual([]);
    for (const brandArtwork of [GBH_LOGO_ARTWORK, GBH_FAVICON_ARTWORK]) {
      expect(literalColor.test(JSON.stringify(brandArtwork))).toBe(true);
    }
  });

  test.todo("M5 (chủ row ui-theme): chụp danh sách token --dsw-* từ bundle theme và diff với bản của ta");
});
