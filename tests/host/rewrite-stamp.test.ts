/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Hop dong cua CACHE buoc doi id: stamp `lib/.gbh-rewrite-stamp` khop thi BO QUA cay lib/,
 *      stamp trot (build lai / bang doi id doi / thieu artefact / GBH_FORCE_REWRITE) thi doi id lai
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEN_TEP_STAMP, suaIdProfile } from "../../tools/p1b/denta-profile.ts";
import { repoRoot } from "../../apps/cli/src/paths.ts";

/** Một cặp id THẬT trong repo: tên thư mục gói của ta + id stock của nó. */
interface Cap {
  /** Tên thư mục gói trong profile (không có tiền tố scope). */
  ten: string;
  /** Id stock mà gói này thay thế. */
  stock: string;
}

/**
 * Lấy N cặp id thật từ manifest trong repo (gói khai `gbh.provenance.stock`).
 * Nhận: soLuong — số cặp cần. Trả: mảng cặp id theo thứ tự tên gói.
 * @param soLuong - số cặp id cần lấy (mặc định 3).
 * @returns các cặp id dùng để dựng bản cài giả trong thư mục tạm.
 */
function layCap(soLuong = 3): Cap[] {
  const goc = join(repoRoot(), "packages", "host");
  const cap: Cap[] = [];
  for (const ten of readdirSync(goc).sort()) {
    let duLieu: { name?: unknown; gbh?: { provenance?: { stock?: unknown } } };
    try {
      duLieu = JSON.parse(readFileSync(join(goc, ten, "package.json"), "utf8")) as typeof duLieu;
    } catch {
      continue;
    }
    const stock = duLieu.gbh?.provenance?.stock;
    const name = duLieu.name;
    if (typeof stock !== "string" || typeof name !== "string" || !name.startsWith("@galaxy-blackhole/")) continue;
    cap.push({ ten: name.slice("@galaxy-blackhole/".length), stock });
    if (cap.length === soLuong) break;
  }
  if (cap.length < soLuong) throw new Error("repo khong co du " + String(soLuong) + " goi khai gbh.provenance.stock");
  return cap;
}

/**
 * Dựng một gói trong bản cài giả: `lib/index.js` + `package.json` đều mang id stock của gói KHÁC
 * (id của chính gói bị bỏ khỏi bảng để chống self-import, nên phải dùng id của gói khác).
 * Nhận: tam — thư mục profile giả; cap — cặp id của gói này; stockKhac — id stock của gói kia.
 * Trả: không (ghi tệp).
 * @param tam - thư mục profile giả (đã tồn tại).
 * @param cap - cặp id của gói cần dựng.
 * @param stockKhac - id stock của gói KHÁC, dùng làm nội dung cần đổi.
 */
function dungGoi(tam: string, cap: Cap, stockKhac: string): void {
  mkdirSync(join(tam, cap.ten, "lib"), { recursive: true });
  writeFileSync(join(tam, cap.ten, "lib", "index.js"), 'import { s } from "' + stockKhac + '/lib/index.js";\nexport const x = s;\n');
  writeFileSync(
    join(tam, cap.ten, "package.json"),
    JSON.stringify({ name: "@galaxy-blackhole/" + cap.ten, dependencies: { [stockKhac]: "1.0.0" } }, null, 2),
  );
}

/**
 * Dựng bản cài giả có N gói, mỗi gói mang id stock của gói kế tiếp.
 * Nhận: tam — thư mục profile giả; cap — danh sách cặp id. Trả: không.
 * @param tam - thư mục profile giả.
 * @param cap - các cặp id cần dựng (>= 2).
 */
function dungBanCai(tam: string, cap: readonly Cap[]): void {
  cap.forEach((item, chiSo) => dungGoi(tam, item, cap[(chiSo + 1) % cap.length]!.stock));
}

/**
 * Mô phỏng đúng việc mount làm ở MỖI lượt boot: chép lại `package.json` từ nguồn (nên nó mang id stock
 * trở lại) trong khi `lib/` giữ nguyên bản đã đổi id.
 * Nhận: tam — thư mục profile giả; cap — các cặp id. Trả: không (ghi tệp).
 * @param tam - thư mục profile giả.
 * @param cap - các cặp id đang có trong bản cài.
 */
function chepLaiManifest(tam: string, cap: readonly Cap[]): void {
  cap.forEach((item, chiSo) => {
    const stockKhac = cap[(chiSo + 1) % cap.length]!.stock;
    writeFileSync(
      join(tam, item.ten, "package.json"),
      JSON.stringify({ name: "@galaxy-blackhole/" + item.ten, dependencies: { [stockKhac]: "1.0.0" } }, null, 2),
    );
  });
}

describe("cache buoc doi id — stamp lib/.gbh-rewrite-stamp", () => {
  test("luot 1 doi id va ghi stamp; luot 2 BO QUA ca cay lib/ nhung van doi package.json", () => {
    const tam = mkdtempSync(join(tmpdir(), "gbh-rewrite-stamp-"));
    try {
      const cap = layCap(2);
      dungBanCai(tam, cap);
      const tepLib = join(tam, cap[0]!.ten, "lib", "index.js");
      const stamp = join(tam, cap[0]!.ten, "lib", TEN_TEP_STAMP);
      // NGU CANH: ban cai vua build tu nguon nen con id stock.
      expect(readFileSync(tepLib, "utf8")).toContain(cap[1]!.stock + "/lib/index.js");

      const luot1 = suaIdProfile(tam, repoRoot());
      expect(luot1.soGoi).toBe(2);
      expect(luot1.boQua).toBe(0);
      expect(luot1.tep).toBe(2);
      expect(readFileSync(tepLib, "utf8")).not.toContain(cap[1]!.stock);
      expect(existsSync(stamp)).toBe(true);

      // Mount chep lai package.json tu nguon o MOI luot boot; lib/ thi giu nguyen.
      chepLaiManifest(tam, cap);
      const luot2 = suaIdProfile(tam, repoRoot());
      expect(luot2.boQua).toBe(2);
      expect(luot2.tep).toBe(0);
      // package.json van duoc doi moi luot — cache chi phu cay lib/ (dung hanh vi cu).
      expect(luot2.manifest).toBe(2);
    } finally {
      rmSync(tam, { recursive: true, force: true });
    }
  });

  test("an toan (b): lib/ bi build lai (noi dung doi) ⇒ stamp trot ⇒ doi id lai, khong phuc vu id stock", () => {
    const tam = mkdtempSync(join(tmpdir(), "gbh-rewrite-stamp-"));
    try {
      const cap = layCap(2);
      dungBanCai(tam, cap);
      const tepLib = join(tam, cap[0]!.ten, "lib", "index.js");
      suaIdProfile(tam, repoRoot());
      // Build lai tu nguon: tep lib mang lai id stock (noi dung KHAC ban da doi id) ⇒ phai doi lai.
      writeFileSync(tepLib, 'import { s } from "' + cap[1]!.stock + '/lib/index.js";\nexport const x = s;\n');
      const luot = suaIdProfile(tam, repoRoot());
      // Chi goi vua bi build lai phai chay lai; goi kia van duoc bo qua nho stamp.
      expect(luot.boQua).toBe(1);
      expect(luot.tep).toBe(1);
      expect(readFileSync(tepLib, "utf8")).not.toContain(cap[1]!.stock);
    } finally {
      rmSync(tam, { recursive: true, force: true });
    }
  });

  test("an toan (a): bang doi id doi (them cap) ⇒ moi stamp trot", () => {
    const tam = mkdtempSync(join(tmpdir(), "gbh-rewrite-stamp-"));
    try {
      const cap = layCap(3);
      dungBanCai(tam, cap.slice(0, 2));
      suaIdProfile(tam, repoRoot());
      expect(suaIdProfile(tam, repoRoot()).boQua).toBe(2);
      // Them MOT goi nua ⇒ bang doi id co them cap ⇒ phien ban bang doi ⇒ stamp cu trot.
      dungGoi(tam, cap[2]!, cap[0]!.stock);
      const sauKhiThem = suaIdProfile(tam, repoRoot());
      expect(sauKhiThem.cap).toBe(3);
      expect(sauKhiThem.boQua).toBe(0);
      // Luot ke tiep (bang khong doi) thi ca ba goi deu duoc bo qua.
      expect(suaIdProfile(tam, repoRoot()).boQua).toBe(3);
    } finally {
      rmSync(tam, { recursive: true, force: true });
    }
  });

  test("thieu artefact (mat lib/index.js) ⇒ goi do KHONG duoc bo qua", () => {
    const tam = mkdtempSync(join(tmpdir(), "gbh-rewrite-stamp-"));
    try {
      const cap = layCap(2);
      dungBanCai(tam, cap);
      suaIdProfile(tam, repoRoot());
      unlinkSync(join(tam, cap[0]!.ten, "lib", "index.js"));
      const luot = suaIdProfile(tam, repoRoot());
      expect(luot.soGoi).toBe(2);
      expect(luot.boQua).toBe(1);
    } finally {
      rmSync(tam, { recursive: true, force: true });
    }
  });

  test("force: true (GBH_FORCE_REWRITE=1) ep doi id lai du stamp khop", () => {
    const tam = mkdtempSync(join(tmpdir(), "gbh-rewrite-stamp-"));
    try {
      const cap = layCap(2);
      dungBanCai(tam, cap);
      suaIdProfile(tam, repoRoot());
      expect(suaIdProfile(tam, repoRoot()).boQua).toBe(2);
      const ep = suaIdProfile(tam, repoRoot(), { force: true });
      expect(ep.boQua).toBe(0);
      // Ep xong van ghi lai stamp ⇒ luot sau bo qua lai duoc.
      expect(suaIdProfile(tam, repoRoot()).boQua).toBe(2);
    } finally {
      rmSync(tam, { recursive: true, force: true });
    }
  });
});
