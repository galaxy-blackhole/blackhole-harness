/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Sinh khung package thay mot row DSH: bun run tools/scaffold/new-row.ts <row-id>.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, findRow, header, makeBuildTs, makePackageJson, readMatrix, readStock } from "./lib";

/**
 * Sinh khung src/index.ts (nua host) — co chu thich chi ro viec phai lam.
 * @param ourName - ten package cua ta.
 * @param rowId - id row stock.
 * @param stock - ten package goc.
 * @returns noi dung file.
 */
function makeHostIndex(ourName: string, rowId: string, stock: string): string {
  return [
    header("Ban viet lai cua Galaxy Blackhole cho row " + rowId + " (goc: " + stock + ")."),
    "// TODO: doc .d.ts + lib/*.js cua " + stock + " trong apps/host/node_modules (CHI DOC),",
    "// nam HANH VI roi viet lai — khong chep code.",
    "// Giu nguyen be mat service / ten event / schema Config cua ban goc.",
    "",
    "/**",
    " * Diem vao cua Loader. NHIEU ROW CLIENT CUA DSH export ham nay (thuong rong) —",
    " * KE CA khi phan that nam o nua browser. Thieu no thi Loader bao 'failed to import'.",
    " * Doi chieu ban goc: neu lib/index.js goc co export apply thi o day PHAI co.",
    " */",
    "export function apply(): void {}",
  ].join("\n");
}

/**
 * Sinh khung src/client.ts (nua client) theo khuon HAI ID cua cong thuc muc 6.
 * @param stock - ten package goc (id phai dang ky lai).
 * @param ourName - ten package cua ta (id chinh, de HMR rev khop manifest).
 * @returns noi dung file.
 */
function makeClientTs(stock: string, ourName: string): string {
  return [
    header("Nua client (browser) — dang ky MOT id theo khuon muc 8 cua docs/recipes/HOST-ROW-REWRITE.md."),
    "// TODO: viet factory that su. Khung duoi day chi de dung CHO, chua chay duoc.",
    "// Dung globalThis de KHONG dung do kieu DOM cua du an (declare `window` se loi TS2451).",
    "const loader = (globalThis as unknown as {",
    "  __ModuleLoader__: { load(registration: { id: string; factory: unknown }): void };",
    "}).__ModuleLoader__;",
    "",
    "/** Factory cua nua client. */",
    "const factory = (): void => {",
    "  // TODO: dang ky service phia browser (dung TEN SERVICE CU de goi khac inject duoc).",
    "};",
    "",
    "// id CHINH = package cua ta (de `rev` cua HMR tra dung dong trong manifest).",
    "loader.load({ id: \"" + ourName + "\", factory });",
    "// KHONG dang ky id cua goi GOC o day — no thuoc `gbh.row.aliases` trong package.json.",
    "// ⚠️ DAU HIEU NHAN BIET CA SAI: `moduleIds` VA `aliases` CUNG chua id stock. Chi duoc o MOT cho",
    "//    (la `aliases`). Lop nay da can hai lan: `resources` va `modules` (17/10/2026).",
    "// DEM LAI so id module ban goc dang ky: THUONG LA 1; mot so bundle co chunk THAT thi them (khi do",
    "// phai dang ky du, thieu la cho lazy-load TRUOT bang module).",
    "// ⚠️ DUNG NHAM `id` cua SLOT OCCUPANT (`ctx.slots.register({ name, id })`) voi id module —",
    "//    chi id trong `__ModuleLoader__.load` moi vao bang module. Da tung doc sai cho nay mot lan.",
    "// (muc 8: mot bundle MOT id. Dang ky hai lan = bundle chay hai lan = app trang.)",
    "",
    "// BAT BUOC: khong co import/export thi TypeScript coi file nay la SCRIPT TOAN CUC =>",
    "// moi `const` o day thanh bien toan cuc va DUNG NHAU giua cac package (TS2451).",
    "export {};",
  ].join("\n");
}

/**
 * Sinh README voi bang nguon doi chieu G4 da dien san so lieu do duoc.
 * @param rowId - id row.
 * @param stock - ten package goc.
 * @param ourName - ten package cua ta.
 * @param tier - tier trong ma tran.
 * @param twoSided - co nua client hay khong.
 * @param builtLines - so dong JS da build cua goi goc.
 * @param injects - cac service ma nua client phu thuoc.
 * @returns noi dung README.
 */
function makeReadme(rowId: string, stock: string, ourName: string, tier: string, twoSided: boolean, builtLines: number, injects: string[]): string {
  return [
    "<!--",
    " author Bùi Trọng Hiếu",
    " email kevinbui210191@gmail.com",
    " create date 15/10/2026",
    " modify date 17/10/2026",
    " desc Ban viet lai cua Galaxy Blackhole cho row " + rowId + " cua DSH.",
    "-->",
    "",
    "# " + ourName,
    "",
    "## 1. Nguồn đối chiếu (G4)",
    "",
    "| Hạng mục | Bản gốc DSH | Bản của ta |",
    "|---|---|---|",
    "| Row | `" + rowId + "` (tier " + tier + ") | `" + ourName + "` |",
    "| Package | `" + stock + "` | `" + ourName + "` |",
    "| Kích thước bản build | **" + builtLines + " dòng JS** | (điền sau khi viết) |",
    "| Hai mặt? | " + (twoSided ? "**CÓ** (`dsh.client`)" : "không (chỉ host)") + " | " + (twoSided ? "phải làm đủ hai nửa" : "—") + " |",
    injects.length ? "| `dsh.client.inject` | " + injects.map((x) => "`" + x + "`").join(" · ") + " | phải đăng ký **đúng tên service cũ** |" : "",
    "",
    "## 2. Vì sao cần",
    "",
    "(điền: row này làm gì trong app, ai gọi nó)",
    "",
    "## 3. Peer",
    "",
    "(ghi rõ peer nào và vì sao — chỉ được dùng các gói trong bảng §3b của `packages/README.md`)",
    "",
    "## 4. Bảng TRƯỚC / SAU",
    "",
    "| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |",
    "|---|---|---|",
    "| (điền phép đo TRƯỚC khi mount) | | |",
    "",
    "Lệnh tái lập: (điền)",
    "",
    "## 5. Phần CHƯA làm",
    "",
    "(nói thẳng nếu có — đừng giả vờ đủ)",
    "",
  ].filter((x) => x !== "").join("\n") + "\n";
}

/**
 * Sinh khung test toi thieu 4 ca theo cong thuc muc 3.
 * @param rowId - id row.
 * @param ourName - ten package cua ta.
 * @param twoSided - co nua client hay khong.
 * @returns noi dung file test.
 */
function makeTest(rowId: string, ourName: string, twoSided: boolean): string {
  const lines = [
    header("Test hanh vi cho " + ourName + " (row " + rowId + ")."),
    "import { describe, expect, test } from \"bun:test\";",
    "",
    "describe(\"row " + rowId + "\", () => {",
    "  test(\"ca 1: hanh vi chinh giong ban goc\", () => {",
    "    // TODO: cung input -> cung output nhu " + rowId + " goc.",
    "    expect(true).toBe(true);",
    "  });",
    "",
    "  test(\"ca 2: duong loi ro rang, khong treo\", () => {",
    "    // TODO: input sai -> dung ma loi cua ban goc.",
    "    expect(true).toBe(true);",
    "  });",
  ];
  if (twoSided) {
    lines.push(
    "",
    "  test(\"ca 3: nua client dang ky DUNG ca hai id\", () => {",
    "    // TODO: chay bundle trong window gia, khang dinh ca id cua ta lan id goc deu co mat.",
    "    expect(true).toBe(true);",
    "  });",
    );
  } else {
    lines.push(
    "",
    "  test(\"ca 3: than phan hoi di qua Uint8Array/DataView phai doc dung byte\", () => {",
    "    // TODO: bai hoc ADR 0004 §8 — Buffer.isBuffer HEP hon ArrayBuffer.isView.",
    "    expect(true).toBe(true);",
    "  });",
    );
  }
  lines.push("});", "");
  return lines.join("\n");
}

/**
 * Sinh toan bo khung package cho mot row.
 * @param rowId - id row hoac ten package goc.
 * @returns danh sach duong dan da ghi.
 */
export function scaffold(rowId: string): string[] {
  const row = findRow(readMatrix(), rowId);
  if (!row) throw new Error("khong tim thay row " + rowId + " trong docs/PARITY-MATRIX.md");
  const info = readStock(row.stock);
  const area = row.rowId.startsWith("ui-") || row.stock.includes("dsh-client-") ? "client" : "host";
  const ourName = "@galaxy-blackhole/gbh-" + area + "-" + row.rowId;
  const dir = join(ROOT, "packages", area, row.rowId);
  if (existsSync(dir)) throw new Error("da co " + dir + " — khong ghi de");
  mkdirSync(join(dir, "src"), { recursive: true });
  const testPath = "tests/" + area + "/" + row.rowId + ".test.ts";
  const injects = info.client?.inject ? (Array.isArray(info.client.inject) ? info.client.inject : [info.client.inject]) : [];
  const written: string[] = [];
  const put = (rel: string, body: string): void => {
    const full = join(dir, rel);
    writeFileSync(full, body, "utf8");
    written.push(full);
  };
  put("package.json", makePackageJson(ourName, row.rowId, testPath, row.stock));
  put("build.ts", makeBuildTs(ourName));
  put(join("src", "index.ts"), makeHostIndex(ourName, row.rowId, row.stock));
  if (info.twoSided) put(join("src", "client.ts"), makeClientTs(row.stock, ourName));
  put("README.md", makeReadme(row.rowId, row.stock, ourName, row.tier, info.twoSided, info.builtLines, injects));
  mkdirSync(join(ROOT, "tests", area), { recursive: true });
  writeFileSync(join(ROOT, testPath), makeTest(row.rowId, ourName, info.twoSided), "utf8");
  written.push(join(ROOT, testPath));
  return written;
}

/**
 * Diem vao CLI: in huong dan va ghi khung.
 * @returns ma thoat tien trinh.
 */
function main(): number {
  const arg = process.argv[2];
  if (!arg) {
    console.log("dung: bun run tools/scaffold/new-row.ts <row-id>");
    console.log("vi du: bun run tools/scaffold/new-row.ts ui-settings-session-log");
    return 1;
  }
  const written = scaffold(arg);
  console.log("da sinh khung:");
  for (const f of written) console.log("  " + f);
  console.log("\nBUOC TIEP THEO (xem docs/recipes/HOST-ROW-REWRITE.md):");
  console.log("  1. doc .d.ts + lib/*.js cua goi goc (CHI DOC) — nam hanh vi, khong chep code");
  console.log("  2. dien README muc 1-3, viet src/, viet test (them ca 4 neu co route)");
  console.log("  3. do TRUOC bang phuong phap cua row nay, ghi vao README muc 4");
  console.log("  4. thu tren HOME CACH LY + CONG RIENG truoc (overlay --patch, dung sua <home>/app.patch.yml)");
  console.log("  5. nghiem thu muc 4b: trang ~48.9 KB · 0 'did not activate' · co __GBH_BOOT__ (alias __DSH_BOOT__) · 'da thay N row' +1");
  console.log("  6. bun run gate xanh 6/6 roi moi bao xong");
  return 0;
}

if (import.meta.main) process.exit(main());