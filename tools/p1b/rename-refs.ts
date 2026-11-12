/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Đổi tham chiếu gói stock (`@deepseek-ai/dsh-*`) sang id GBH (`@galaxy-blackhole/gbh-*`) cho từng gói —
 *      công cụ của P1b. CHỈ đổi khi gói đích đã có `lib/types/index.d.ts` (nếu không, `tsc` sẽ đỏ TS7016).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ba gói kernel giữ id stock theo ADR-0030 (một thể hiện kernel). */
const KERNEL: ReadonlySet<string> = new Set([
  "@deepseek-ai/cordis",
  "@deepseek-ai/schemastery",
  "@deepseek-ai/cosmokit",
]);

/** Kết quả một lượt quét. */
export interface KetQuaDoiTen {
  /** Số tệp `.ts` đã sửa. */
  soTep: number;
  /** Số dòng đã đổi. */
  soDong: number;
  /** Số manifest đã sửa khoá phụ thuộc. */
  soManifest: number;
  /** Các cặp `stock → gbh` đã dùng. */
  capDaDung: string[];
}

/**
 * Nạp bảng tên gói của ta: `@galaxy-blackhole/gbh-x` → thư mục gói.
 * @param gocRepo - thư mục gốc repo.
 * @returns bảng tên gói.
 */
function napBangTen(gocRepo: string): Map<string, string> {
  const bang = new Map<string, string>();
  for (const nhom of readdirSync(join(gocRepo, "packages"))) {
    const thuMucNhom = join(gocRepo, "packages", nhom);
    if (!statSync(thuMucNhom).isDirectory()) continue;
    for (const ten of readdirSync(thuMucNhom)) {
      const thuMucGoi = join(thuMucNhom, ten);
      const manifest = join(thuMucGoi, "package.json");
      if (!existsSync(manifest)) continue;
      const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
      if (typeof duLieu.name === "string") bang.set(duLieu.name, thuMucGoi);
    }
  }
  return bang;
}

/**
 * Gói đích có khai báo kiểu dùng được chưa?
 * @param bang - bảng tên gói.
 * @param ten - tên gói GBH.
 * @returns `true` khi có `lib/types/index.d.ts`.
 */
function coKieu(bang: Map<string, string>, ten: string): boolean {
  const thuMuc = bang.get(ten);
  return thuMuc !== undefined && existsSync(join(thuMuc, "lib", "types", "index.d.ts"));
}

/**
 * Ánh xạ một specifier stock sang id GBH khi an toàn.
 * @param ref - specifier gốc.
 * @param banThan - tên gói đang sửa (tự tham chiếu luôn đổi).
 * @param bang - bảng tên gói.
 * @returns specifier sau ánh xạ.
 */
export function anhXa(ref: string, banThan: string, bang: Map<string, string>): string {
  if (KERNEL.has(ref) || !ref.startsWith("@deepseek-ai/dsh-")) return ref;
  const [phamVi, ten, ...duoi] = ref.split("/");
  if (phamVi !== "@deepseek-ai" || ten === undefined) return ref;
  const tenTa = "@galaxy-blackhole/gbh-" + ten.slice("dsh-".length);
  if (!bang.has(tenTa)) return ref;
  // 05/11/2026: SELF-IMPORT (gói tự nạp bundle gốc của chính nó để re-export) PHAI giữ id stock,
  // nếu đổi thành tên chính nó sẽ thành vòng lặp mô-đun (SyntaxError: does not provide an export named …).
  if (tenTa === banThan) return ref;
  if (duoi.length > 0) return ref;
  return coKieu(bang, tenTa) ? tenTa : ref;
}

/**
 * Đổi tham chiếu trong `moi tep .ts duoi src/` và khoá phụ thuộc của manifest cho danh sách gói.
 * @param gocRepo - thư mục gốc repo.
 * @param danhSach - tên gói (thư mục con của `packages/*`).
 * @param apDung - `true` để ghi tệp; `false` chỉ đếm.
 * @returns số liệu lượt chạy.
 */
export function doiTen(gocRepo: string, danhSach: string[], apDung: boolean): KetQuaDoiTen {
  const bang = napBangTen(gocRepo);
  const cap = new Set<string>();
  let soTep = 0;
  let soDong = 0;
  let soManifest = 0;
  for (const tenGoi of danhSach) {
    const thuMucGoi = join(gocRepo, "packages", ...tenGoi.split("/"));
    const manifest = join(thuMucGoi, "package.json");
    if (!existsSync(manifest)) continue;
    const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
    const banThan = duLieu.name ?? "";
    for (const tep of [...quetTep(join(thuMucGoi, "src")), ...quetTepDts(join(thuMucGoi, "lib", "types"))]) {
      const truoc = readFileSync(tep, "utf8");
      const dong = truoc.split("\n");
      let doi = 0;
      for (let i = 0; i < dong.length; i += 1) {
        const goc = dong[i] ?? "";
        if (goc.includes("STOCK")) continue;
        const moi = goc.replace(/@deepseek-ai\/dsh-[a-z0-9-]+(?:\/[A-Za-z0-9_.-]+)*/g, (m) => {
          const sau = anhXa(m, banThan, bang);
          if (sau !== m) cap.add(m + " -> " + sau);
          return sau;
        });
        if (moi !== goc) {
          dong[i] = moi;
          doi += 1;
        }
      }
      if (doi > 0) {
        soDong += doi;
        soTep += 1;
        if (apDung) writeFileSync(tep, dong.join("\n"), "utf8");
      }
    }
    if (suaManifest(manifest, banThan, bang, apDung)) soManifest += 1;
  }
  return { soTep, soDong, soManifest, capDaDung: [...cap].sort() };
}

/**
 * Liệt kê tệp khai báo `.d.ts` dưới thư mục `lib/types` (đệ quy).
 * Nhận: thuMuc — thư mục gốc.
 * Trả: danh sách đường dẫn tệp `.d.ts`.
 */
function quetTepDts(thuMuc: string): string[] {
  if (!existsSync(thuMuc)) return [];
  const ket: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) ket.push(...quetTepDts(duong));
    else if (ten.endsWith(".d.ts")) ket.push(duong);
  }
  return ket;
}

/**
 * Liệt kê tệp `.ts` dưới một thư mục (đệ quy).
 * @param thuMuc - thư mục gốc.
 * @returns danh sách đường dẫn tệp.
 */
function quetTep(thuMuc: string): string[] {
  if (!existsSync(thuMuc)) return [];
  const ket: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const duong = join(thuMuc, ten);
    if (statSync(duong).isDirectory()) ket.push(...quetTep(duong));
    else if (ten.endsWith(".ts")) ket.push(duong);
  }
  return ket;
}

/**
 * Đổi khoá phụ thuộc trong manifest (chỉ đổi tên khoá đã có, KHÔNG thêm khoá mới).
 * @param manifest - đường dẫn `package.json`.
 * @param banThan - tên gói đang sửa.
 * @param bang - bảng tên gói.
 * @param apDung - `true` để ghi tệp.
 * @returns `true` khi manifest có thay đổi.
 */
function suaManifest(manifest: string, banThan: string, bang: Map<string, string>, apDung: boolean): boolean {
  const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>;
  let doi = false;
  for (const truong of ["dependencies", "peerDependencies", "devDependencies"]) {
    const khoi = duLieu[truong];
    if (typeof khoi !== "object" || khoi === null) continue;
    const ban = khoi as Record<string, string>;
    for (const khoa of Object.keys(ban)) {
      const moi = anhXa(khoa, banThan, bang);
      if (moi === khoa) continue;
      const gia = ban[khoa] ?? "";
      delete ban[khoa];
      ban[moi] = gia;
      doi = true;
    }
  }
  const gbh = duLieu.gbh;
  if (typeof gbh === "object" && gbh !== null) {
    const peers = (gbh as { peers?: unknown }).peers;
    if (Array.isArray(peers)) {
      const moi = peers.map((x) => (typeof x === "string" ? anhXa(x, banThan, bang) : x));
      if (JSON.stringify(moi) !== JSON.stringify(peers)) {
        (gbh as { peers?: unknown }).peers = moi;
        doi = true;
      }
    }
  }
  if (doi && apDung) writeFileSync(manifest, JSON.stringify(duLieu, null, 2) + "\n", "utf8");
  return doi;
}

/**
 * Chạy từ dòng lệnh: `bun run tools/p1b/rename-refs.ts <--apply> <package/thư-mục,...>`.
 * @returns không.
 */
function main(): void {
  const thamSo = process.argv.slice(2);
  const apDung = thamSo.includes("--apply");
  const chiKieu = thamSo.includes("--types-only");
  const danhSach = (thamSo.find((x) => !x.startsWith("--")) ?? "").split(",").filter(Boolean);
  if (chiKieu) {
    const ket = doiTenChiKieu(process.cwd(), danhSach, apDung);
    console.log((apDung ? "ĐÃ ĐỔI (chỉ .d.ts)" : "KHÔ") + ": " + String(ket.soTep) + " tệp · " + String(ket.soDong) + " dòng");
    return;
  }
  if (danhSach.length === 0) {
    console.log("dùng: bun run tools/p1b/rename-refs.ts [--apply] <nhom/ten,...>");
    return;
  }
  const ket = doiTen(process.cwd(), danhSach, apDung);
  console.log((apDung ? "ĐÃ ĐỔI" : "KHÔ") + ": " + String(ket.soTep) + " tệp · " + String(ket.soDong) + " dòng · " + String(ket.soManifest) + " manifest");
  console.log("cặp: " + ket.capDaDung.slice(0, 12).join(" | "));
}

/**
 * Chỉ đổi tham chiếu trong moi tep .d.ts duoi lib/types (không đụng `src`).
 * Nhận: gocRepo — gốc repo; danhSach — tên gói; apDung — ghi hay chỉ đếm.
 * Trả: số liệu lượt chạy.
 */
function doiTenChiKieu(gocRepo: string, danhSach: string[], apDung: boolean): KetQuaDoiTen {
  const bang = napBangTen(gocRepo);
  const cap = new Set<string>();
  let soTep = 0;
  let soDong = 0;
  for (const tenGoi of danhSach) {
    const thuMucGoi = join(gocRepo, "packages", ...tenGoi.split("/"));
    const manifest = join(thuMucGoi, "package.json");
    if (!existsSync(manifest)) continue;
    const duLieu = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
    const banThan = duLieu.name ?? "";
    for (const tep of quetTepDts(join(thuMucGoi, "lib", "types"))) {
      const truoc = readFileSync(tep, "utf8");
      const dong = truoc.split(String.fromCharCode(10));
      let doi = 0;
      for (let i = 0; i < dong.length; i += 1) {
        const goc = dong[i] ?? "";
        const moi = goc.replace(/@deepseek-ai\/dsh-[a-z0-9-]+(?:\/[A-Za-z0-9_.-]+)*/g, (m) => {
          const sau = anhXa(m, banThan, bang);
          if (sau !== m) cap.add(m + " -> " + sau);
          return sau;
        });
        if (moi !== goc) {
          dong[i] = moi;
          doi += 1;
        }
      }
      if (doi > 0) {
        soDong += doi;
        soTep += 1;
        if (apDung) writeFileSync(tep, dong.join(String.fromCharCode(10)), "utf8");
      }
    }
  }
  return { soTep, soDong, soManifest: 0, capDaDung: [...cap].sort() };
}

if (import.meta.main) main();

