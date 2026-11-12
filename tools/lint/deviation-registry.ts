/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Cổng KHOÁ CỨNG sai khác CỐ Ý: áp các LỚP CHUẨN HOÁ đã khai báo trong danh mục (biến đổi CƠ HỌC rồi so byte lại),
 *      so thêm BỀ MẶT EXPORTS với bản gốc, và ĐỎ nếu còn lệch cấu trúc mà gói chưa có mục khai báo.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createResult, isDirectRun, printResult, REPO_ROOT, toRel, type CheckResult } from "./shared.ts";

/** Tầng chứa gói GBH. */
const CAC_TANG = ["host", "client", "tools"];

/** Tệp danh mục sai khác có chủ đích — nguồn sự thật duy nhất. */
const TEP_DANH_MUC = join(REPO_ROOT, "docs", "GBH-SAI-KHAC-CO-CHU-DICH.md");

/** Bảng đổi id của repo (stock → GBH). */
const TEP_BAN_DO_ID = join(REPO_ROOT, "tests", "helpers", "brand-ids-map.json");

/** Thư mục node_modules của host app — nơi bundle gốc DSH nằm. */
const THU_MUC_NODE_MODULES = join(REPO_ROOT, "apps", "host", "node_modules");

/** Các artefact cần so của một gói. */
const ARTEFACT = ["index.js", "client.js"];

/** Số ký tự ngữ cảnh hai bên in ra quanh byte lệch đầu tiên. */
const NGU_CANH = 60;

/** Dấu hiệu chắc chắn là chú thích tiếng Việt do bản port chèn vào mã. */
const CHU_VIET = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/** Bỏ header 5 dòng bắt buộc của repo (luật §1) + chú thích đường dẫn nguồn + dòng region của bundler. */
function lopHeader(text: string): string {
  const dong = text.split("\n");
  const ketQua: string[] = [];
  let i = 0;
  // Header có thể là "/*" (bản build) hoặc "/**" (bản nguồn); nhận cả hai, và chỉ coi là header khi có dòng author.
  if (dong[0] !== undefined && /^\s*\/\*+\s*$/.test(dong[0]) && text.slice(0, 500).includes("author Bùi Trọng Hiếu")) {
    i = 1;
    while (i < dong.length && !/^\s*\*\/\s*$/.test(dong[i] as string)) i += 1;
    i += 1;
    // Bỏ luôn các dòng TRỐNG ngay sau header (hệ quả của việc bỏ header, không mang ngữ nghĩa).
    while (i < dong.length && (dong[i] as string).trim() === "") i += 1;
  }
  for (; i < dong.length; i += 1) {
    const d = dong[i] as string;
    const bo = /^\s*\/\/#(region|endregion)\b/.test(d)
      || /^\/\/\s*(src|packages)\/\S+$/.test(d)
      || /^\/\/\s*index\.ts$/.test(d);
    if (!bo) ketQua.push(d);
  }
  return ketQua.join("\n");
}

/** Bỏ prelude/footer do Bun sinh khi ghép lại từ TypeScript (biến đổi cơ học, không phải miễn trừ). */
function lopBuildShape(text: string): string {
  const dong = text.split("\n");
  const ketQua: string[] = [];
  for (const d of dong) {
    const bo = /^\s*(var|let|const) __[A-Za-z0-9_]+ = /.test(d)
      || /^\s*0 && \(module\.exports = /.test(d)
      || /^\s*\/\/ Annotate the CommonJS export names for ESM import in node:?/.test(d);
    if (!bo) ketQua.push(d);
  }
  return ketQua.join("\n");
}

/** Lớp chuẩn hoá đã cài; mỗi lớp CHỈ được áp khi danh mục khai báo nó. */
const LOP_CO_CAI: Readonly<Record<string, (text: string, banDo: ReadonlyArray<readonly [string, string]>) => string>> = {
  ids: (text, banDo) => banDo.reduce((acc, [stock, gbh]) => (stock === gbh ? acc : acc.split(stock).join(gbh)), text),
  brand: (text) => {
    const giu = "\u0000SCOPE\u0000";
    const tam = text.split("@deepseek-ai/").join(giu);
    return tam
      .split("DEEPSEEK").join("GALAXY BLACKHOLE")
      .split("DeepSeek").join("Galaxy Blackhole")
      .split("deepseek").join("galaxy-blackhole")
      .split(giu).join("@deepseek-ai/");
  },
  "css-hash": (text) => text.replace(/\b[A-Za-z0-9]{3,8}_[A-Za-z0-9_-]{5,}\b/g, "<css-hash>"),
  header: (text) => lopHeader(text),
  "build-shape": (text) => lopBuildShape(text),
};

/** Kết luận so khớp của MỘT gói. */
type KetLuan = "khop" | "lech-cau-truc" | "khong-co-ban-goc" | "thieu-artefact";

/** Một dòng báo cáo cho một gói. */
interface DongBaoCao {
  /** Tên gói GBH đầy đủ. */
  goi: string;
  /** Kết luận so khớp. */
  ketLuan: KetLuan;
  /** Số dòng lệch sau chuẩn hoá. */
  soDongLech: number;
  /** Byte lệch đầu tiên (1-based), -1 khi giống. */
  byteLechDau: number;
  /** Ngữ cảnh phía ta. */
  nguCanhTa: string;
  /** Ngữ cảnh phía gốc. */
  nguCanhGoc: string;
  /** Artefact đã so. */
  artefact: string;
  /** Thư mục gói. */
  thuMuc: string;
  /** true nếu lệch còn lại nằm trong vùng có chữ Việt (chú thích bản port chèn trong mã). */
  coChuViet: boolean;
  /** Lệch bề mặt exports (thiếu/thừa/số tham số). */
  beMat: BeMatLech;
  /** Cổng áp cho gói: "A" (hợp đồng byte) hoặc "B" (bề mặt exports + hành vi). */
  cong: "A" | "B";
}

/**
 * Đọc các LỚP CHUẨN HOÁ được khai báo trong danh mục.
 * Nhận: không (đọc docs/GBH-SAI-KHAC-CO-CHU-DICH.md).
 * Trả: mảng tên lớp theo thứ tự khai báo.
 */
export function docCacLopChuanHoa(): string[] {
  if (!existsSync(TEP_DANH_MUC)) return [];
  const noiDung = readFileSync(TEP_DANH_MUC, "utf8");
  const lop: string[] = [];
  for (const mo of noiDung.matchAll(/<!--\s*normalize:\s*([a-z0-9-]+)\s*@\s*([^\s>]+)\s*-->/g)) {
    const ten = mo[1];
    if (ten !== undefined && !lop.includes(ten)) lop.push(ten);
  }
  return lop;
}

/**
 * Đọc danh sách gói đã khai báo sai khác CỐ Ý theo gói.
 * Nhận: không (đọc danh mục). Trả: tập tên gói đã khai báo.
 */
export function docDanhSachKhaiBao(): Set<string> {
  const khaiBao = new Set<string>();
  if (!existsSync(TEP_DANH_MUC)) return khaiBao;
  const noiDung = readFileSync(TEP_DANH_MUC, "utf8");
  for (const mo of noiDung.matchAll(/<!--\s*deviation:\s*([^\s>]+)\s*-->/g)) {
    const ten = mo[1];
    if (ten !== undefined) khaiBao.add(ten.trim());
  }
  return khaiBao;
}

/**
 * Đọc bảng đổi id stock → GBH.
 * Nhận: không (đọc tests/helpers/brand-ids-map.json). Trả: mảng cặp [stock, GBH] dài giảm dần.
 */
export function docBanDoId(): ReadonlyArray<readonly [string, string]> {
  if (!existsSync(TEP_BAN_DO_ID)) return [];
  const duLieu = JSON.parse(readFileSync(TEP_BAN_DO_ID, "utf8")) as Record<string, string>;
  return Object.entries(duLieu).sort((a, b) => b[0].length - a[0].length);
}

/**
 * Áp các lớp chuẩn hoá đã khai báo lên MỘT nội dung (áp đối xứng cho cả hai bên).
 * Nhận: text — nội dung; lop — lớp đã khai; banDo — bảng đổi id. Trả: nội dung sau chuẩn hoá.
 */
export function chuanHoa(text: string, lop: readonly string[], banDo: ReadonlyArray<readonly [string, string]>): string {
  let ketQua = text.split("\r\n").join("\n");
  for (const ten of lop) {
    const ap = LOP_CO_CAI[ten];
    if (ap !== undefined) ketQua = ap(ketQua, banDo);
  }
  return ketQua;
}

/**
 * Tách BỀ MẶT exports của một artefact ESM: tên export và số tham số (với hàm).
 * Nhận: text — nội dung artefact. Trả: map tên export → số tham số (undefined khi không phải hàm).
 */
export function beMatExports(text: string): Map<string, number | undefined> {
  const beMat = new Map<string, number | undefined>();
  const demThamSo = (danh: string): number => {
    const sach = danh.trim();
    if (sach === "") return 0;
    let sau = 0;
    let cap = 0;
    for (const c of sach) {
      if (c === "(" || c === "[" || c === "{") cap += 1;
      else if (c === ")" || c === "]" || c === "}") cap -= 1;
      else if (c === "," && cap === 0) sau += 1;
    }
    return sau + 1;
  };
  for (const mo of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    const than = mo[1] ?? "";
    for (const phan of than.split(",")) {
      const ten = phan.trim().split(/\s+as\s+/).pop()?.trim();
      if (ten !== undefined && ten !== "" && /^[A-Za-z_$][\w$]*$/.test(ten)) beMat.set(ten, undefined);
    }
  }
  for (const mo of text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
    beMat.set(mo[1] as string, demThamSo(mo[2] ?? ""));
  }
  for (const mo of text.matchAll(/export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g)) beMat.set(mo[1] as string, undefined);
  for (const mo of text.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) beMat.set(mo[1] as string, undefined);
  if (/export\s+default\b/.test(text)) beMat.set("default", beMat.get("default"));
  return beMat;
}

/** Lệch bề mặt exports: thiếu, thừa, và số tham số khác nhau. */
export interface BeMatLech {
  /** Tên export gốc có mà ta THIẾU. */
  thieu: string[];
  /** Tên export ta có mà gốc KHÔNG có. */
  thua: string[];
  /** Tên hàm có ở cả hai nhưng số tham số khác. */
  thamSo: string[];
  /** Bề mặt có khớp hoàn toàn không. */
  khop: boolean;
}

/**
 * So BỀ MẶT exports của ta với gốc, tách rõ ba nhóm lệch.
 * Nhận: ta — nội dung artefact ta; goc — nội dung gốc. Trả: BeMatLech.
 */
export function soBeMatExports(ta: string, goc: string): BeMatLech {
  const a = beMatExports(ta);
  const b = beMatExports(goc);
  const thieu = [...b.keys()].filter((k) => !a.has(k));
  const thua = [...a.keys()].filter((k) => !b.has(k));
  const thamSo = [...a.entries()]
    .filter(([k, v]) => v !== undefined && b.get(k) !== undefined && b.get(k) !== v)
    .map(([k, v]) => k + "(" + String(v) + " vs " + String(b.get(k)) + ")");
  return { thieu, thua, thamSo, khop: thieu.length === 0 && thua.length === 0 && thamSo.length === 0 };
}

/**
 * Tìm tên bundle gốc DSH của một gói ta.
 * Nhận: tenGoi; stockKhaiBao — gbh.provenance.stock; banDoNguoc — GBH → stock. Trả: tên stock hoặc undefined.
 */
export function timBanGoc(
  tenGoi: string,
  stockKhaiBao: string | undefined,
  banDoNguoc: ReadonlyMap<string, string>,
): string | undefined {
  const coThat = (ten: string | undefined): string | undefined =>
    ten !== undefined && existsSync(join(THU_MUC_NODE_MODULES, ten)) ? ten : undefined;
  const theoKhaiBao = coThat(stockKhaiBao);
  if (theoKhaiBao !== undefined) return theoKhaiBao;
  const theoBanDo = coThat(banDoNguoc.get(tenGoi));
  if (theoBanDo !== undefined) return theoBanDo;
  const khop = /^@galaxy-blackhole\/gbh-(.+)$/.exec(tenGoi);
  if (khop === null) return undefined;
  const duoi = khop[1] as string;
  for (const ten of ["@deepseek-ai/dsh-" + duoi, "@deepseek-ai/dsh-" + duoi.replace(/^host-/, ""), "@deepseek-ai/" + duoi]) {
    const thay = coThat(ten);
    if (thay !== undefined) return thay;
  }
  return undefined;
}

/**
 * Đếm số dòng khác nhau giữa hai chuỗi.
 * Nhận: a; b. Trả: số dòng lệch.
 */
export function demDongLech(a: string, b: string): number {
  const dongA = a.split("\n");
  const dongB = b.split("\n");
  const dai = Math.max(dongA.length, dongB.length);
  let lech = 0;
  for (let i = 0; i < dai; i += 1) if (dongA[i] !== dongB[i]) lech += 1;
  return lech;
}

/**
 * Tìm vị trí byte lệch đầu tiên.
 * Nhận: a; b. Trả: vị trí 1-based, hoặc -1 khi giống.
 */
export function byteLechDau(a: string, b: string): number {
  const dai = Math.min(a.length, b.length);
  for (let i = 0; i < dai; i += 1) if (a[i] !== b[i]) return i + 1;
  return a.length === b.length ? -1 : dai + 1;
}

/**
 * Lấy đoạn ngữ cảnh quanh một vị trí, ép về một dòng.
 * Nhận: text; viTri — 1-based. Trả: tối đa 60 ký tự đã thoát xuống dòng.
 */
export function nguCanh(text: string, viTri: number): string {
  const batDau = Math.max(0, viTri - 1 - Math.floor(NGU_CANH / 2));
  return text.slice(batDau, batDau + NGU_CANH).split("\n").join("\\n").split("\t").join("\\t");
}

/**
 * Liệt kê mọi gói khai gbh.row (được mount thật).
 * Nhận: không (đọc package.json dưới packages/<tầng>/). Trả: mảng bản ghi gói.
 */
export function lietKeGoiMount(): Array<{ thuMuc: string; tenGoi: string; stock: string | undefined; cong: "A" | "B" }> {
  const ketQua: Array<{ thuMuc: string; tenGoi: string; stock: string | undefined; cong: "A" | "B" }> = [];
  for (const tang of CAC_TANG) {
    const gocTang = join(REPO_ROOT, "packages", tang);
    if (!existsSync(gocTang)) continue;
    for (const ten of readdirSync(gocTang).sort()) {
      const thuMuc = join(gocTang, ten);
      if (!statSync(thuMuc).isDirectory()) continue;
      const tep = join(thuMuc, "package.json");
      if (!existsSync(tep)) continue;
      const json = JSON.parse(readFileSync(tep, "utf8")) as {
        name?: string;
        gbh?: { row?: unknown; provenance?: { stock?: string } };
      };
      if (json.gbh?.row === undefined || json.name === undefined) continue;
      ketQua.push({
        thuMuc,
        tenGoi: json.name,
        stock: json.gbh?.provenance?.stock,
        cong: congCuaGoi(thuMuc, json as { gbh?: { parity?: unknown } }),
      });
    }
  }
  return ketQua;
}

/**
 * Xác định một gói thuộc CỔNG A (hợp đồng byte) hay CỔNG B (bề mặt + hành vi).
 * Nhận: thuMuc — thư mục gói; json — nội dung package.json đã đọc. Trả: "A" hoặc "B".
 * Cổng A = gói khai \`gbh.parity: "byte"\` HOẶC build.ts của chính gói đó có cổng byte (matchParts/sha256/CỔNG BYTE/kỳ vọng byte).
 */
export function congCuaGoi(
  thuMuc: string,
  json: { gbh?: { parity?: unknown } },
): "A" | "B" {
  if (json.gbh?.parity === "byte") return "A";
  const tepBuild = join(thuMuc, "build.ts");
  if (!existsSync(tepBuild)) return "B";
  const build = readFileSync(tepBuild, "utf8");
  return /(matchParts|sha256|CỔNG BYTE|kỳ vọng byte|ky vong byte)/i.test(build) ? "A" : "B";
}

/**
 * So MỘT gói: byte sau chuẩn hoá + bề mặt exports.
 * Nhận: goi; lop; banDo; banDoNguoc. Trả: dòng báo cáo.
 */
export function soMotGoi(
  goi: { thuMuc: string; tenGoi: string; stock: string | undefined; cong: "A" | "B" },
  lop: readonly string[],
  banDo: ReadonlyArray<readonly [string, string]>,
  banDoNguoc: ReadonlyMap<string, string>,
): DongBaoCao {
  const trong = {
    soDongLech: 0, byteLechDau: -1, nguCanhTa: "", nguCanhGoc: "", artefact: "",
    thuMuc: goi.thuMuc, coChuViet: false, beMat: { thieu: [], thua: [], thamSo: [], khop: true }, cong: goi.cong,
  };
  const banGoc = timBanGoc(goi.tenGoi, goi.stock, banDoNguoc);
  if (banGoc === undefined) return { goi: goi.tenGoi, ketLuan: "khong-co-ban-goc", ...trong };
  for (const ten of ARTEFACT) {
    const cuaTa = join(goi.thuMuc, "lib", ten);
    const goc = join(THU_MUC_NODE_MODULES, banGoc, "lib", ten);
    if (!existsSync(cuaTa) || !existsSync(goc)) continue;
    const taTho = readFileSync(cuaTa, "utf8");
    const gocTho = readFileSync(goc, "utf8");
    const ta = chuanHoa(taTho, lop, banDo);
    const gocText = chuanHoa(gocTho, lop, banDo);
    const artefact = "lib/" + ten;
    const beMat = soBeMatExports(taTho, gocTho);
    if (ta === gocText && beMat.khop) return { goi: goi.tenGoi, ketLuan: "khop", ...trong, artefact };
    const viTri = ta === gocText ? -1 : byteLechDau(ta, gocText);
    const nguCanhChung = viTri > 0
      ? ta.slice(Math.max(0, viTri - 30), viTri + 30) + gocText.slice(Math.max(0, viTri - 30), viTri + 30)
      : ta.slice(0, 60) + gocText.slice(0, 60);
    return {
      goi: goi.tenGoi,
      ketLuan: "lech-cau-truc",
      soDongLech: demDongLech(ta, gocText),
      byteLechDau: viTri,
      nguCanhTa: nguCanh(ta, Math.max(1, viTri)),
      nguCanhGoc: nguCanh(gocText, Math.max(1, viTri)),
      artefact,
      thuMuc: goi.thuMuc,
      coChuViet: CHU_VIET.test(nguCanhChung),
      beMat,
      cong: goi.cong,
    };
  }
  return { goi: goi.tenGoi, ketLuan: "thieu-artefact", ...trong };
}

/**
 * Chạy cổng với HAI chế độ: CỔNG A so byte (hợp đồng byte), CỔNG B so bề mặt exports + hành vi (test của gate).
 * Nhận: không (đọc repo). Trả: CheckResult với violations chia theo cổng.
 */
export function runDeviationCheck(): CheckResult {
  const batDau = Date.now();
  const ketQua = createResult("deviation-registry");
  const lop = docCacLopChuanHoa();
  const khaiBao = docDanhSachKhaiBao();
  const banDo = docBanDoId();
  const banDoNguoc = new Map(banDo.map(([stock, gbh]) => [gbh, stock] as const));
  const goi = lietKeGoiMount();
  const baoCao = goi.map((mot) => soMotGoi(mot, lop, banDo, banDoNguoc));
  const tenNgan = (ten: string): string => ten.replace("@galaxy-blackhole/gbh-", "");
  const daKhai = (d: DongBaoCao): boolean => khaiBao.has(d.goi) || khaiBao.has(tenNgan(d.goi));
  let soA = 0;
  let soB = 0;
  let thieuA = 0;
  let thieuB = 0;
  for (const d of baoCao) {
    if (d.cong === "A") soA += 1;
    else soB += 1;
    if (d.ketLuan === "khong-co-ban-goc" || d.ketLuan === "thieu-artefact") continue;
    const byteLech = d.ketLuan === "lech-cau-truc";
    const dongByte = "\n    byte: " + String(d.soDongLech) + " dong lech (byte dau " + String(d.byteLechDau) + ")"
      + "\n    ta:    " + d.nguCanhTa + "\n    stock: " + d.nguCanhGoc + (d.coChuViet ? "\n    [vung lech co chu Viet]" : "");
    if (d.cong === "A") {
      if (!byteLech || daKhai(d)) continue;
      thieuA += 1;
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG A - byte] " + d.goi + " · " + d.artefact + dongByte
          + "\n    -> can muc khai bao <!-- deviation: " + d.goi + " --> trong docs/GBH-SAI-KHAC-CO-CHU-DICH.md" });
      continue;
    }
    const beMat = d.beMat;
    if (beMat.thieu.length > 0) {
      thieuB += 1;
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG B - thieu export] " + d.goi + " · THIEU so voi goc: [" + beMat.thieu.slice(0, 12).join(", ")
          + (beMat.thieu.length > 12 ? ", …" : "") + "] — khong co ngoai le nao cho thieu export" });
      continue;
    }
    if ((beMat.thua.length > 0 || beMat.thamSo.length > 0) && !daKhai(d)) {
      thieuB += 1;
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG B - thua export] " + d.goi + " · THUA so voi goc: [" + beMat.thua.slice(0, 12).join(", ")
          + (beMat.thua.length > 12 ? ", …" : "") + "]" + (beMat.thamSo.length > 0 ? " · so tham so lech: [" + beMat.thamSo.join(", ") + "]" : "")
          + "\n    -> can muc khai bao <!-- deviation: " + d.goi + " -->" });
      continue;
    }
    if (byteLech && !daKhai(d) && d.coChuViet) {
      thieuB += 1;
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG B - chu thich tieng Viet trong ma] " + d.goi + " · " + d.artefact + dongByte
          + "\n    -> chu thich ban port chen trong ma KHONG duoc tu dong bo qua; can muc khai bao" });
    }
  }
  ketQua.checked = baoCao.filter((d) => d.ketLuan === "khop" || d.ketLuan === "lech-cau-truc").length;
  ketQua.skipped["khong-co-ban-goc"] = baoCao.filter((d) => d.ketLuan === "khong-co-ban-goc").length;
  ketQua.skipped["thieu-artefact"] = baoCao.filter((d) => d.ketLuan === "thieu-artefact").length;
  const lopLa = lop.filter((ten) => LOP_CO_CAI[ten] === undefined);
  ketQua.notes.push("lop chuan hoa DA AP: " + (lop.length === 0 ? "(khong co)" : lop.join(", ")));
  if (lopLa.length > 0) ketQua.notes.push("CANH BAO: danh muc khai lop chua cai trong cong: " + lopLa.join(", "));
  ketQua.notes.push("CONG A (byte): " + String(soA) + " goi · thieu khai bao: " + String(thieuA));
  ketQua.notes.push("CONG B (be mat + hanh vi): " + String(soB) + " goi · thieu khai bao: " + String(thieuB));
  ketQua.notes.push("so goi mount: " + String(goi.length) + " · khop ca hai chieu: "
    + String(baoCao.filter((d) => d.ketLuan === "khop").length));
  ketQua.ms = Date.now() - batDau;
  return ketQua;
}

if (isDirectRun(import.meta.url)) {
  const ketQua = runDeviationCheck();
  printResult(ketQua, { limit: 20 });
  process.exit(ketQua.violations.length === 0 ? 0 : 1);
}
