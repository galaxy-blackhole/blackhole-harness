/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test task-13: thay row la du lieu cua tung package (metadata trong package.json -> khoi patch); 11/11/2026: khoi insert khai tay cua template parity (workspace-changes) duoc phep co ten GBH, khoi disabled thi khong
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseGbhMetadata, renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";
import { ensureRewriteMounts, rewritePackages } from "../../apps/cli/src/mount.ts";
import { repoRoot } from "../../apps/cli/src/paths.ts";

/**
 * Lấy `row` BẮT BUỘC của một entry metadata; ném nếu thiếu.
 * Nhận: entry do `rewritePackages()` trả về (có thể `undefined` khi không tìm thấy).
 * Trả: `row` đã narrow — cần vì `row` là trường TUỲ CHỌN và `noUncheckedIndexedAccess` không narrow qua `expect()`.
 */
function rowOf(entry: { row?: { id: string; config?: unknown } } | undefined): { id: string; config?: unknown } {
  const row = entry?.row;
  if (row === undefined) throw new Error("entry thiếu row: " + String(entry));
  return row;
}

/**
 * Ten goi GBH ma mot file patch nhac toi qua `name: '…'` (chi khoi `insert` co dang nay).
 * Nhan: toan van mot patch YAML.
 * Tra: cac ten theo thu tu xuat hien — de khoa bat bien "che do disabled khong sinh ten GBH nao".
 */
function gbhInsertNames(patch: string): readonly string[] {
  return [...patch.matchAll(/name: '(@galaxy-blackhole\/gbh-host-[^']*)'/gu)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

/** Thu muc fixture gia trong packages/ (tao va don sach trong test). */
const FIXTURE = join(repoRoot(), "packages", "host", "zz-fixture-task13");

/** Home gia de writeAppPatch khong cham vao app home that. */
const SANDBOX = mkdtempSync(join(tmpdir(), "gbh-task13-"));
process.env.GBH_HOME = SANDBOX;

afterAll(() => {
  rmSync(FIXTURE, { recursive: true, force: true });
  rmSync(SANDBOX, { recursive: true, force: true });
  delete process.env.GBH_HOME;
});

describe("metadata thay row cua package", () => {
  test("parse: thieu gbh hoac thieu row.id thi bo qua, khong vo", () => {
    expect(parseGbhMetadata("{")).toBeUndefined();
    expect(parseGbhMetadata("{}")).toBeUndefined();
    expect(parseGbhMetadata("{\"gbh\":{}}")).toEqual({ peers: undefined });
    expect(parseGbhMetadata("{\"gbh\":{\"row\":{}}}")).toBeUndefined();
    expect(parseGbhMetadata("{\"gbh\":{\"row\":{\"id\":\"  \"}}}")).toBeUndefined();
  });

  test("render: khoi disable+insert dung dang ADR 0004 §2", () => {
    const block = renderRewriteBlock("@galaxy-blackhole/gbh-demo", {
      id: "demo-row",
      inject: ["webStartup"],
      config: { host: { js: "ctx.webStartup.host ?? '127.0.0.1'" }, compression: "gzip", level: 1, flag: true },
    });
    expect(block).toBe(
      [
        "- id: demo-row",
        "  disabled: true",
        "",
        "- insert:",
        "    - id: demo-row-ours",
        "      name: '@galaxy-blackhole/gbh-demo'",
        "      inject:",
        "        - webStartup",
        "      config:",
        "        host: !!js ctx.webStartup.host ?? '127.0.0.1'",
        "        compression: gzip",
        "        level: 1",
        "        flag: true",
        "",
      ].join("\n"),
    );
  });

  // CHAM KHI MAY TAI NANG, KHONG PHAI SAI: ca nay QUET CA CAY packages/** nen khi 6+ agent boot
// song song thi no (va `tests/host/boot.test.ts`) co the do trong `bun run gate` - nhung chay
// RIENG luc vang thi XANH (do 17/10/2026: boot.test.ts rieng => '0 unexplained' · 2 pass 0 fail).
// LUAT: nghi tranh chap thi chay rieng; chay rieng VAN do thi do moi la loi that. Xem
// docs/recipes/GATE-HOME-ISOLATION.md - co y KHONG noi knownWriters vi noi ra la che tin hieu.
test("quet packages/**: tim dung 2 package that, co peer seam va nguon G4", () => {
    const found = rewritePackages();
    const names = found.map((entry) => entry.specifier);
    // Khong khoa cung so package (moi dot lai them goi): chi doi cac goi da biet phai CO mat.
    expect(names).toContain("@galaxy-blackhole/gbh-host-open-in-app");
    expect(names).toContain("@galaxy-blackhole/gbh-host-webserver");
    expect(names).toContain("@galaxy-blackhole/gbh-host-plugin-inventory");
    // Thu tu phai on dinh giua cac lan chay (sap theo ten package).
    expect([...names].sort()).toEqual(names);
    const webserver = found.find((entry) => entry.specifier.endsWith("gbh-host-webserver"))!;
    const webserverRow = rowOf(webserver);
    expect(webserver.peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/schemastery"]);
    expect(webserver.reference).toBe(join("packages", "host", "host-webserver", "README.md"));
    expect(webserverRow.id).toBe("webserver");
    const inventory = found.find((entry) => entry.specifier.endsWith("gbh-host-plugin-inventory"))!;
    expect(rowOf(inventory).id).toBe("plugin-inventory");
    // kernel (cordis/schemastery) + thu vien typert-protocol giu id stock theo ADR-0030.
    // 08/11/2026 (Lead): id stock la CHUAN cua ca cay — do that 34 manifest dung `@deepseek-ai/dsh-typert-protocol`,
    //   chi 1 dung id GBH. Dong cu pin id GBH la pin cu ⇒ sua theo thuc te + §2e (peer giu id stock).
    expect(inventory.peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-typert-protocol",
    ]);

  });

  test("them package GIA: co metadata thi duoc nhan, khong co thi bo qua — khong sua file dung chung nao", () => {
    mkdirSync(FIXTURE, { recursive: true });
    writeFileSync(
      join(FIXTURE, "package.json"),
      JSON.stringify({ name: "@galaxy-blackhole/gbh-host-fixture", gbh: { row: { id: "fixture-row", config: { mode: "test" } } } }, null, 2),
    );
    const withMeta = rewritePackages().find((entry) => entry.specifier === "@galaxy-blackhole/gbh-host-fixture");
    expect(rowOf(withMeta).id).toBe("fixture-row");
    expect(rowOf(withMeta).config).toEqual({ mode: "test" });

    writeFileSync(join(FIXTURE, "package.json"), JSON.stringify({ name: "@galaxy-blackhole/gbh-host-fixture" }, null, 2));
    expect(rewritePackages().some((entry) => entry.specifier === "@galaxy-blackhole/gbh-host-fixture")).toBe(false);
    rmSync(FIXTURE, { recursive: true, force: true });
  });

  // 19/10/2026: ca nay goi `ensureRewriteMounts()` 2 lan (quet toan bo packages/ + build lai goi stale)
  // nen duoi tai (12 tep test chay chung) tung TIMEOUT 60s. Noi timeout cho DUNG BAN CHAT ca do: do la
  // phep do IO nang, khong phai logic sai. Chay rieng: 36-41s.
    // 07/11/2026: test nay MOUNT TOÀN BỘ gói (155+) nên rất nặng; đo thật khi máy đang chạy app: 127 s >
  // ngưỡng 120 s cũ ⇒ nâng lên 300 s (không phải nới lỏng logic, chỉ là ngưỡng thời gian chạy).
  test("sinh patch: 2 khoi tu metadata, va GBH_DISABLE_REWRITES=1 thi khong khoi nao", { timeout: 300_000 }, async () => {
    const { writeAppPatch, readAppPatch } = await import("../../apps/cli/src/profile.ts");
    const mounts = ensureRewriteMounts();
    const ok = mounts.filter((mount) => mount.ok);
    writeAppPatch({ brand: false, rewrites: mounts });
    const text = readAppPatch();
    // 21/10/2026: row credentials nay do BUNDLE dinh nghia (id stock, name goi ta) nen KHONG con trong app.patch.yml.
    const { bundleDefinedNames: tenTrongBundle } = await import("../../apps/cli/src/profile.ts");
    expect(text).toContain("- id: credentials");
    // Khong phu thuoc SO package: moi mount ok CO ROW deu phai co khoi rieng cua no.
    // `row` là trường TUỲ CHỌN ⇒ narrow bằng `rowOf` (không cast `as { id: string }`: cast che mất trường hợp
    // `undefined` và làm test ném "TypeError: undefined is not an object" — đúng lỗi đã gặp).
    // KHÔNG phải mọi mount ok đều có `row`: gói có row LỒNG trong preset (vd `gbh-tool-schedule`) mount bằng
    // cơ chế khác nên không mang `row` top-level. Đo thật 19/10/2026: ok=155 · có row=154 · thiếu row=1
    // (`@galaxy-blackhole/gbh-tool-schedule`, row lồng trong agent-preset).
    // 21/10/2026 (task-195): tu khi chuyen sang BUNDLE-NATIVE, goi nao da duoc bundle cua ta dinh nghia row thi
    // KHONG con khoi patch rieng nua (row do da co san voi id stock — dung y DSH). Vi vay: goi TRONG bundle
    // phai KHONG xuat hien trong app.patch.yml; goi NGOAI bundle van phai co khoi rieng.
    const { bundleDefinedNames } = await import("../../apps/cli/src/profile.ts");
    const trongBundle = bundleDefinedNames();
    const withRow = ok.filter((mount) => mount.row !== undefined);
    expect(withRow.length).toBeGreaterThan(0);
    for (const mount of withRow) {
      const row = rowOf(mount as { row?: { id: string } });
      // 25/10/2026 (ADR 0027): row do bundle cắm (gbh.row.ownedByBundle) KHONG sinh khoi app patch.
      if ((row as { ownedByBundle?: boolean }).ownedByBundle === true) {
        expect(text).not.toContain("- id: " + row.id + "-ours");
        continue;
      }
      if (trongBundle.has(mount.specifier)) {
        // Bundle da dinh nghia row nay voi ID STOCK ⇒ dieu BAT BIEN la khong con row "<id>-ours" trong app.patch.
        expect(text).not.toContain("- id: " + row.id + "-ours");
        continue;
      }
      expect(text).toContain("- id: " + row.id);
      expect(text).toContain("name: '" + mount.specifier + "'");
    }
    // 11/11/2026: lop home gio co MOT khoi insert khai tay trong template parity
    // (profiles/blackhole/parity.patch.yml → row workspace-changes), vi goi packages/host/workspace-changes
    // khong bundle patch nao khai row do (thieu no thi /api/changes.summary tra 404). Do KHONG phai khoi do
    // metadata gbh.row sinh ra, nen bat bien dung cua patch BAT la: khoi insert do CO ten GBH, va ten do
    // phai la workspace-changes.
    expect(gbhInsertNames(text)).toContain("@galaxy-blackhole/gbh-host-workspace-changes");
    // 21/10/2026 (task-195): row mang config nay gio do BUNDLE cua ta dinh nghia (id stock) nen app.patch khong
    // con no; dieu can kiem la patch CO khoi nao do (khong rong) va khong con row "<id>-ours".
    expect(text).toContain("- id: ");
    const previous = process.env.GBH_DISABLE_REWRITES;
    process.env.GBH_DISABLE_REWRITES = "1";
    const disabled = ensureRewriteMounts();
    expect(disabled.every((mount) => !mount.ok)).toBe(true);
    writeAppPatch({ brand: false, rewrites: disabled });
    const disabledText = readAppPatch();
    expect(disabledText).not.toContain("- id: webserver");
    expect(disabledText).not.toContain("- id: open-in-app");
    // 11/11/2026: che do TAT (GBH_DISABLE_REWRITES=1) khong sinh khoi rewrite nao ⇒ ten GBH duy nhat con lai
    // la khoi insert khai tay cua template parity, va no phai DUNG la workspace-changes. Test cu (07/11) cam
    // moi chuoi "name: '@galaxy-blackhole/gbh-host-", nen no do oan khi khoi insert hop le do xuat hien.
    expect(gbhInsertNames(disabledText)).toEqual(["@galaxy-blackhole/gbh-host-workspace-changes"]);
    expect(disabledText).toContain("- id: workspace-changes");
    expect(disabledText).toContain("- id: credentials");
    if (previous === undefined) delete process.env.GBH_DISABLE_REWRITES;
    else process.env.GBH_DISABLE_REWRITES = previous;
    // ⚠️ 18/10/2026: ca nay SINH PATCH THAT cho MOI package ⇒ chay rieng ~4,3s nhung > 5s (mac dinh) khi
    //   chay CA SUITE (624 test song song) ⇒ do la TRANH CHAP TAI, khong phai loi logic. Da kiem: chay rieng
    //   `bun test tests/host/rewrite-metadata.test.ts` ⇒ 5 pass · 0 fail. Nen noi timeout thay vi sua logic.
    // 19/10/2026: timeout nay dat trong THAM SỐ THỨ HAI của `test(…)` ở trên (`{ timeout: 120_000 }`);
    //   để thêm tham số thứ tư ở đây sẽ thành TS2554 ("Expected 2-3 arguments, but got 4").
  });
});

// 19/10/2026 — HỒI QUY THẬT (app CHẾT sau khi mount host-webserver): có gói lưu biểu thức dạng CHUỖI
// `"!!js ctx.webStartup.host ?? '127.0.0.1'"` trong `gbh.row.config`; renderer cũ quote nó thành chuỗi YAML ⇒
// harness nhận `host "!!js …"` ⇒ `is not a concrete IPv4 or IPv6 address literal` ⇒ webserver không cấp
// `webServer` ⇒ 8 entry pending ⇒ host thoát. Ca này khẳng định tag `!!js` được phát ở CẢ HAI dạng (object + chuỗi).
test("renderRewriteBlock: chuỗi config bắt đầu bằng !!js được phát thành TAG, không bị quote", () => {
  const block = renderRewriteBlock("@galaxy-blackhole/gbh-host-demo", {
    id: "webserver",
    config: {
      host: "!!js ctx.webStartup.host ?? '127.0.0.1'",
      port: 3080,
    },
  });
  expect(block).toContain("host: !!js ctx.webStartup.host");
  expect(block).not.toContain('"\\"!!js');
  expect(block).not.toContain("'!!js");
});