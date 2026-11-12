/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Sinh bảng tiếp xúc HTML (index.html) cho một lần chạy ma trận ảnh: mở một file là thấy hết cặp A/B
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { closeChromeSession } from "../parity/lib/browser.ts";
import { parityPath } from "../parity/lib/paths.ts";

import { launchChromeBounded } from "./lib/capture.ts";

import type { FeatureArtifact, ScenarioRecord } from "./run.ts";
import { percent } from "./matrix.ts";

/**
 * Đổi một đường dẫn tương đối repo thành đường dẫn tương đối thư mục chứa index.html.
 * Nhận: đường dẫn tương đối repo (ví dụ .parity/features/<stamp>/pair-x.png).
 * Trả: tên file thuần (ảnh nằm cùng thư mục với index.html).
 */
export function fileNameOf(repoRelative: string): string {
  const parts = repoRelative.split("/");
  return parts[parts.length - 1] ?? repoRelative;
}

/**
 * Dựng một thẻ HTML cho một màn hình trong bảng tiếp xúc.
 * Nhận: bản ghi của màn hình.
 * Trả: chuỗi HTML (một khối article kèm ảnh thu nhỏ và số đo).
 */
export function cardFor(record: ScenarioRecord): string {
  const badge = record.status === "PASS" ? "#1a7f37" : record.status === "FAIL" ? "#b42318" : "#8a6d3b";
  const numbers =
    record.status === "SKIP"
      ? "không chụp được: " + (record.skipReason ?? "không rõ lý do")
      : String(record.diffPixels) + " / " + String(record.totalPixels) + " px lệch ngoài mask (" +
        percent(record.ratio) + ") · thô " + String(record.rawDiffPixels) + " px (" + percent(record.rawRatio) + ")";
  const links =
    record.thumbFile === undefined
      ? ""
      : ' · <a href="' + fileNameOf(record.refFile ?? "") + '">ref</a>' +
        ' · <a href="' + fileNameOf(record.oursFile ?? "") + '">ours</a>' +
        ' · <a href="' + fileNameOf(record.diffFile ?? "") + '">diff</a>' +
        ' · <a href="' + fileNameOf(record.pairFile ?? "") + '">cặp A/B cỡ gốc</a>' +
        ' · <a href="' + fileNameOf("inventory-" + record.id + ".json") + '">DOM</a>';
  const image =
    record.thumbFile === undefined
      ? '<div class="empty">không có ảnh</div>'
      : '<a href="' + fileNameOf(record.pairFile ?? "") + '"><img src="' + fileNameOf(record.thumbFile) + '" alt="' + record.title + '"></a>';
  const clusters =
    record.clusters.length === 0
      ? ""
      : '<ul class="clusters">' +
        record.clusters
          .slice(0, 5)
          .map(
            (cluster) =>
              "<li>x=" + String(cluster.x) + ".." + String(cluster.x + cluster.w) + " y=" + String(cluster.y) + ".." +
              String(cluster.y + cluster.h) + " · " + String(cluster.pixels) + " px · " +
              (cluster.label === "" ? "(không khớp phần tử DOM nào)" : cluster.label) + "</li>",
          )
          .join("") +
        "</ul>";
  return (
    '<article class="card"><header><h3>' + record.title + '</h3><span class="badge" style="background:' + badge + '">' +
    record.status + "</span></header><p class=\"feature\">" + record.feature + "</p>" + image +
    '<p class="numbers">' + numbers + "</p>" + clusters + '<p class="links">' + links.replace(/^ · /u, "") + "</p></article>"
  );
}

/**
 * Sinh nội dung HTML của bảng tiếp xúc.
 * Nhận: artifact của một lần chạy.
 * Trả: chuỗi HTML đầy đủ (tự chứa CSS, không phụ thuộc mạng).
 */
export function renderContactSheetHtml(artifact: FeatureArtifact): string {
  const cards = artifact.scenarios.map((record) => cardFor(record)).join("\n");
  return [
    "<!doctype html>",
    '<html lang="vi"><head><meta charset="utf-8">',
    "<title>Ma trận ảnh A/B — " + artifact.stamp + "</title>",
    "<style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f6f7f9;color:#1f2328}",
    "h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}",
    ".summary{background:#fff;border:1px solid #d8dee4;border-radius:10px;padding:16px;margin-bottom:16px}",
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}",
    ".card{background:#fff;border:1px solid #d8dee4;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}",
    ".card header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}",
    ".card h3{font-size:14px;margin:0;line-height:1.35}",
    ".badge{color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;white-space:nowrap}",
    ".feature{font-size:11px;color:#57606a;margin:0}",
    ".card img{width:100%;height:auto;border:1px solid #eaeef2;border-radius:6px;display:block}",
    ".empty{height:120px;display:flex;align-items:center;justify-content:center;color:#8b949e;font-size:12px;border:1px dashed #d8dee4;border-radius:6px}",
    ".numbers{font-size:12px;margin:0;font-variant-numeric:tabular-nums}",
    ".clusters{font-size:11px;color:#b42318;margin:0;padding-left:16px}",
    ".links{font-size:11px;margin:0}.links a{color:#0969da;text-decoration:none}",
    "</style></head><body>",
    "<h1>Ma trận ảnh A/B theo từng màn hình — " + artifact.stamp + "</h1>",
    "<p class=\"feature\">Trái = ref (" + artifact.sides.ref + ") · Phải = ours (" + artifact.sides.ours + ") · khung " + artifact.viewport.name + "</p>",
    '<div class="summary"><strong>' + String(artifact.totals.pass) + " PASS · " + String(artifact.totals.fail) +
      " FAIL · " + String(artifact.totals.skip) + " SKIP · tổng " + String(artifact.totals.diffPixels) +
      " pixel lệch ngoài mask trên " + String(artifact.totals.frames) + ' khung.</strong><p class="feature">' +
      artifact.notes.join(" ") + "</p></div>",
    '<div class="grid">',
    cards,
    "</div></body></html>",
  ].join("\n");
}

/**
 * Ghi bảng tiếp xúc HTML cạnh ảnh của một lần chạy.
 * Nhận: artifact của lần chạy (hoặc đường dẫn file summary.json) và thư mục đích tuỳ chọn.
 * Trả: đường dẫn file HTML đã ghi.
 */
export function writeContactSheet(artifactOrFile: FeatureArtifact | string, outDir?: string): string {
  const artifact =
    typeof artifactOrFile === "string"
      ? (JSON.parse(readFileSync(artifactOrFile, "utf8")) as FeatureArtifact)
      : artifactOrFile;
  const dir = outDir ?? resolve(parityPath(".."), artifact.shotsDir);
  const file = join(dirname(join(dir, "index.html")), "index.html");
  writeFileSync(file, renderContactSheetHtml(artifact));
  return file;
}

/**
 * Mở bảng tiếp xúc HTML bằng Chrome headless rồi chụp toàn trang thành MỘT ảnh PNG.
 * Nhận: đường dẫn file index.html, đường dẫn file PNG đích và bề rộng khung nhìn.
 * Trả: đường dẫn file PNG đã ghi; ném lỗi nếu Chrome không mở được.
 */
export async function renderContactSheetPng(htmlFile: string, pngFile: string, width = 1680): Promise<string> {
  const session = await launchChromeBounded(parityPath("tmp"), "contact-sheet-" + String(Date.now()));
  try {
    const page = await session.context.newPage();
    await page.setViewportSize({ width, height: 1200 });
    await page.goto("file://" + htmlFile, { waitUntil: "load", timeout: 30_000 });
    // Chờ mọi ảnh thu nhỏ nạp xong rồi mới chụp, nếu không ảnh sẽ trắng.
    await page
      .waitForFunction(() => Array.from(document.images).every((image) => image.complete), { timeout: 30_000 })
      .catch(() => undefined);
    await page.waitForTimeout(800);
    const png = await page.screenshot({ type: "png", fullPage: true });
    writeFileSync(pngFile, png);
    return pngFile;
  } finally {
    await closeChromeSession(session);
  }
}

/**
 * Điểm vào dòng lệnh: nhận đường dẫn summary.json (mặc định là .parity/features/latest.json).
 * Nhận: tham số dòng lệnh sau tên script.
 * Trả: mã thoát 0 khi ghi xong.
 */
export async function main(argv: string[]): Promise<number> {
  const file = argv[0] ?? parityPath("features", "latest.json");
  const written = writeContactSheet(file);
  console.log("[features] bảng tiếp xúc HTML: " + written);
  const png = await renderContactSheetPng(written, join(dirname(written), "contact-sheet.png"));
  console.log("[features] bảng tiếp xúc PNG: " + png);
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
