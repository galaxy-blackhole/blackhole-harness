/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/11/2026
 * desc Cổng KHOÁ CỨNG sai khác CỐ Ý: áp các LỚP CHUẨN HOÁ đã khai báo trong danh mục (biến đổi CƠ HỌC rồi so byte lại),
 *      so thêm BỀ MẶT EXPORTS với bản gốc, và ĐỎ nếu còn lệch cấu trúc mà gói chưa có mục khai báo.
 *      Từ 19/11/2026 có thêm chế độ RATCHET theo `tools/lint/deviation-baseline.json`: đóng băng số mục CHƯA KHAI
 *      hiện có (nợ cũ chỉ WARN), chỉ ĐỎ khi phát sinh mục MỚI ngoài baseline — dùng cho cổng `deviation` của gate/CI.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createResult, isDirectRun, printResult, REPO_ROOT, toRel, type CheckResult } from "./shared.ts";

/** Tầng chứa gói GBH. */
const CAC_TANG = ["host", "client", "tools"];

/** Tệp danh mục sai khác có chủ đích — nguồn sự thật duy nhất. */
const TEP_DANH_MUC = join(REPO_ROOT, "docs", "GBH-SAI-KHAC-CO-CHU-DICH.md");

/** Bảng đổi id của repo (stock → GBH). */
const TEP_BAN_DO_ID = join(REPO_ROOT, "tests", "helpers", "brand-ids-map.json");

/** Thư mục node_modules của host app — nơi bundle gốc DSH nằm. */
const THU_MUC_NODE_MODULES = join(REPO_ROOT, "apps", "host", "node_modules");

/**
 * Tệp BASELINE RATCHET: đóng băng danh sách mục CHƯA KHAI đã tồn tại tại thời điểm bật cổng.
 * Cổng `deviation` chỉ ĐỎ khi xuất hiện mục MỚI ngoài tệp này; mục nằm trong baseline là NỢ CŨ đã biết (chỉ WARN).
 */
export const TEP_BASELINE = join(REPO_ROOT, "tools", "lint", "deviation-baseline.json");

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
 * Một mục CHƯA KHAI BÁO do cổng A/B phát hiện — đơn vị của baseline ratchet.
 * `khoa` là danh tính ỔN ĐỊNH (không phụ thuộc số dòng lệch/byte lệch), nhờ vậy baseline không rung khi mã đổi.
 */
export interface MucChuaKhai {
  /** Khoá ổn định dạng `<cổng>|<gói>|<loại>`, dùng để so với baseline. */
  khoa: string;
  /** Cổng phát hiện: "A" (hợp đồng byte) hoặc "B" (bề mặt exports + hành vi). */
  cong: "A" | "B";
  /** Tên gói GBH đầy đủ. */
  goi: string;
  /** Loại sai khác: byte · thieu-export · thua-export · chu-thich-viet. */
  loai: string;
  /** Artefact liên quan (ví dụ lib/index.js). */
  artefact: string;
  /** Số dòng lệch sau chuẩn hoá (0 với sai khác chỉ ở bề mặt exports). */
  soDongLech: number;
}

/**
 * Tính khoá ổn định của một mục chưa khai.
 * Nhận: cong; goi; loai. Trả: chuỗi `<cổng>|<gói>|<loại>` — dùng làm danh tính trong baseline.
 */
export function khoaMuc(cong: "A" | "B", goi: string, loai: string): string {
  return cong + "|" + goi + "|" + loai;
}

/** Kết quả một lượt quét: kết quả cổng + danh sách mục chưa khai + số liệu phủ. */
interface LanQuet {
  /** Kết quả cổng (ĐỎ khi còn mục chưa khai — chế độ KHOÁ CỨNG cũ). */
  ketQua: CheckResult;
  /** Mục chưa khai theo thứ tự gói. */
  muc: MucChuaKhai[];
  /** Số liệu phủ để in ghi chú/cảnh báo. */
  thongKe: {
    /** Số gói mount được liệt kê. */
    soGoi: number;
    /** Số gói thuộc cổng A. */
    soGoiA: number;
    /** Số gói thuộc cổng B. */
    soGoiB: number;
    /** Số gói so được artefact (khớp hoặc lệch cấu trúc). */
    soGoiSoDuoc: number;
    /** Số gói không tìm thấy bản gốc stock. */
    soKhongCoBanGoc: number;
    /** Số gói thiếu artefact lib/ của ta hoặc của bản gốc. */
    soThieuArtefact: number;
  };
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
 * Quét toàn bộ gói mount và dựng HAI CỔNG: CỔNG A so byte (hợp đồng byte), CỔNG B so bề mặt exports + hành vi.
 * Nhận: không (đọc repo). Trả: { ketQua, muc, thongKe } — vi phạm chia theo cổng + danh sách mục CHƯA KHAI.
 */
function quetSaiKhac(): LanQuet {
  const batDau = Date.now();
  const ketQua = createResult("deviation-registry");
  const muc: MucChuaKhai[] = [];
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
      muc.push({ khoa: khoaMuc("A", d.goi, "byte"), cong: "A", goi: d.goi, loai: "byte", artefact: d.artefact, soDongLech: d.soDongLech });
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG A - byte] " + d.goi + " · " + d.artefact + dongByte
          + "\n    -> can muc khai bao <!-- deviation: " + d.goi + " --> trong docs/GBH-SAI-KHAC-CO-CHU-DICH.md" });
      continue;
    }
    const beMat = d.beMat;
    if (beMat.thieu.length > 0) {
      thieuB += 1;
      muc.push({ khoa: khoaMuc("B", d.goi, "thieu-export"), cong: "B", goi: d.goi, loai: "thieu-export", artefact: d.artefact, soDongLech: d.soDongLech });
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG B - thieu export] " + d.goi + " · THIEU so voi goc: [" + beMat.thieu.slice(0, 12).join(", ")
          + (beMat.thieu.length > 12 ? ", …" : "") + "] — khong co ngoai le nao cho thieu export" });
      continue;
    }
    if ((beMat.thua.length > 0 || beMat.thamSo.length > 0) && !daKhai(d)) {
      thieuB += 1;
      muc.push({ khoa: khoaMuc("B", d.goi, "thua-export"), cong: "B", goi: d.goi, loai: "thua-export", artefact: d.artefact, soDongLech: d.soDongLech });
      ketQua.violations.push({ file: toRel(join(d.thuMuc, "package.json")), line: 0,
        message: "[CONG B - thua export] " + d.goi + " · THUA so voi goc: [" + beMat.thua.slice(0, 12).join(", ")
          + (beMat.thua.length > 12 ? ", …" : "") + "]" + (beMat.thamSo.length > 0 ? " · so tham so lech: [" + beMat.thamSo.join(", ") + "]" : "")
          + "\n    -> can muc khai bao <!-- deviation: " + d.goi + " -->" });
      continue;
    }
    if (byteLech && !daKhai(d) && d.coChuViet) {
      thieuB += 1;
      muc.push({ khoa: khoaMuc("B", d.goi, "chu-thich-viet"), cong: "B", goi: d.goi, loai: "chu-thich-viet", artefact: d.artefact, soDongLech: d.soDongLech });
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
  const thongKe = {
    soGoi: goi.length,
    soGoiA: soA,
    soGoiB: soB,
    soGoiSoDuoc: ketQua.checked,
    soKhongCoBanGoc: ketQua.skipped["khong-co-ban-goc"] ?? 0,
    soThieuArtefact: ketQua.skipped["thieu-artefact"] ?? 0,
  };
  return { ketQua, muc, thongKe };
}

/**
 * Chạy cổng ở chế độ KHOÁ CỨNG (hành vi cũ, giữ tương thích): ĐỎ khi còn BẤT KỲ mục chưa khai nào.
 * Nhận: không. Trả: CheckResult mang tên "deviation-registry".
 */
export function runDeviationCheck(): CheckResult {
  return quetSaiKhac().ketQua;
}

/**
 * Liệt kê các mục CHƯA KHAI hiện tại (đơn vị của baseline ratchet).
 * Nhận: không (đọc repo). Trả: mảng MucChuaKhai đã sắp theo `khoa` để so sánh ổn định.
 */
export function thuThapMucChuaKhai(): MucChuaKhai[] {
  return quetSaiKhac().muc.slice().sort((a, b) => (a.khoa < b.khoa ? -1 : a.khoa > b.khoa ? 1 : 0));
}

/** Nội dung một mục trong tệp baseline. */
interface MucBaseline {
  /** Khoá ổn định `<cổng>|<gói>|<loại>`. */
  khoa: string;
  /** Cổng phát hiện. */
  cong?: string;
  /** Tên gói GBH. */
  goi?: string;
  /** Loại sai khác. */
  loai?: string;
  /** Artefact liên quan. */
  artefact?: string;
  /** Số dòng lệch tại thời điểm sinh baseline (chỉ để người đọc; KHÔNG dùng để so). */
  soDongLech?: number;
}

/** Tệp baseline đã đọc: tập khoá + số mục. */
interface BaselineDaDoc {
  /** Tập khoá của mọi mục trong baseline. */
  khoa: Set<string>;
  /** Số mục đọc được. */
  soMuc: number;
}

/**
 * Đọc tệp baseline ratchet.
 * Nhận: duong — đường dẫn tệp (mặc định TEP_BASELINE). Trả: { khoa, soMuc }, hoặc undefined khi tệp thiếu/hỏng.
 */
export function docBaseline(duong: string = TEP_BASELINE): BaselineDaDoc | undefined {
  if (!existsSync(duong)) return undefined;
  try {
    const json = JSON.parse(readFileSync(duong, "utf8")) as { muc?: MucBaseline[] };
    const muc = Array.isArray(json.muc) ? json.muc : [];
    const khoa = new Set<string>();
    for (const m of muc) if (typeof m.khoa === "string" && m.khoa !== "") khoa.add(m.khoa);
    return { khoa, soMuc: khoa.size };
  } catch {
    return undefined;
  }
}

/**
 * Ghi tệp baseline ratchet từ danh sách mục chưa khai hiện tại (chỉ chạy khi CỐ Ý cập nhật nợ cũ).
 * Nhận: muc — danh sách mục chưa khai; duong — đường dẫn tệp (mặc định TEP_BASELINE).
 * Trả: số mục đã ghi.
 */
export function ghiBaseline(muc: readonly MucChuaKhai[], duong: string = TEP_BASELINE): number {
  const sapXep = muc.slice().sort((a, b) => (a.khoa < b.khoa ? -1 : a.khoa > b.khoa ? 1 : 0));
  const noiDung = {
    "_doc": [
      "Baseline RATCHET cho cổng `deviation` trong tools/lint/gate.ts — đóng băng NỢ CŨ, không phải giấy phép.",
      "So khớp CHỈ bằng `khoa`; các trường khác là thông tin tại thời điểm sinh baseline.",
      "Mục MỚI (không có trong tệp này) ⇒ cổng ĐỎ. Mục nằm trong tệp này ⇒ WARN (nợ đã biết, chưa khai báo).",
      "Baseline chỉ được NHỎ ĐI: khai báo xong một mục thì chạy lại lệnh dưới rồi commit.",
    ],
    "lenhCapNhat": "bun run tools/lint/deviation-registry.ts --update-baseline",
    "sinhLuc": new Date().toISOString(),
    "soMuc": sapXep.length,
    "muc": sapXep.map((m) => ({
      khoa: m.khoa,
      cong: m.cong,
      goi: m.goi,
      loai: m.loai,
      artefact: m.artefact,
      soDongLech: m.soDongLech,
    })),
  };
  mkdirSync(dirname(duong), { recursive: true });
  writeFileSync(duong, JSON.stringify(noiDung, null, 2) + "\n", "utf8");
  return sapXep.length;
}

/**
 * Cổng RATCHET dùng cho `gate.ts`/CI: ĐỎ khi có mục CHƯA KHAI MỚI ngoài baseline, WARN với nợ cũ trong baseline.
 * Nhận: duong — đường dẫn baseline (mặc định TEP_BASELINE). Trả: CheckResult tên "deviation".
 * Nguyên tắc: baseline KHÔNG miễn trừ sai khác — nó chỉ đóng băng số nợ đã biết tại thời điểm bật cổng.
 *   Mục ra khỏi baseline (đã khai báo) ⇒ cảnh báo "baseline cũ, nên cập nhật" để baseline chỉ nhỏ đi.
 */
export function runDeviationBaselineCheck(duong: string = TEP_BASELINE): CheckResult {
  const batDau = Date.now();
  const res = createResult("deviation");
  const lan = quetSaiKhac();
  res.checked = lan.muc.length;
  const baseline = docBaseline(duong);
  const duongRel = toRel(duong);
  if (baseline === undefined) {
    res.violations.push({
      file: duongRel,
      line: 0,
      message: "THIẾU/hỏng baseline ratchet — không có mốc so sánh nên cổng không thể xác nhận. "
        + "Sinh lại bằng: bun run tools/lint/deviation-registry.ts --update-baseline",
    });
    res.notes.push("CỔNG A (byte): " + String(lan.thongKe.soGoiA) + " gói · CỔNG B (bề mặt): " + String(lan.thongKe.soGoiB) + " gói");
    res.ms = Date.now() - batDau;
    return res;
  }
  const hienTai = new Set(lan.muc.map((m) => m.khoa));
  const moi = lan.muc.filter((m) => !baseline.khoa.has(m.khoa));
  const noCu = lan.muc.filter((m) => baseline.khoa.has(m.khoa));
  const daHet = [...baseline.khoa].filter((k) => !hienTai.has(k)).sort();
  for (const m of moi) {
    res.violations.push({
      file: "tools/lint/deviation-baseline.json",
      line: 0,
      message: "[MỚI NGOÀI BASELINE·cổng " + m.cong + "] " + m.goi + " · " + m.loai + " · " + m.artefact
        + " (" + String(m.soDongLech) + " dòng lệch) — sai khác CHƯA KHAI BÁO và KHÔNG có trong baseline."
        + "\n    -> khai báo <!-- deviation: " + m.goi + " --> trong docs/GBH-SAI-KHAC-CO-CHU-DICH.md"
        + "\n    -> KHÔNG được thêm mục này vào baseline để tắt cổng; baseline chỉ đóng băng nợ cũ.",
    });
  }
  for (const m of noCu) {
    res.warnings.push({
      file: "tools/lint/deviation-baseline.json",
      line: 0,
      message: "[NỢ CŨ·cổng " + m.cong + "] " + m.goi + " · " + m.loai + " · " + m.artefact
        + " — vẫn chưa khai báo; nằm trong baseline nên chỉ cảnh báo (cần khai báo rồi cập nhật baseline).",
    });
  }
  if (daHet.length > 0) {
    res.warnings.push({
      file: duongRel,
      line: 0,
      message: "baseline có " + String(daHet.length) + " mục KHÔNG còn phát hiện (đã khai báo hoặc đã khớp): "
        + daHet.slice(0, 8).join(" · ") + (daHet.length > 8 ? " · …" : "")
        + " — chạy --update-baseline để baseline chỉ nhỏ đi.",
    });
  }
  if (lan.thongKe.soThieuArtefact > 0 && lan.thongKe.soGoi > 0 && lan.thongKe.soThieuArtefact * 5 > lan.thongKe.soGoi) {
    res.warnings.push({
      file: duongRel,
      line: 0,
      message: "chỉ so được " + String(lan.thongKe.soGoiSoDuoc) + "/" + String(lan.thongKe.soGoi)
        + " gói vì thiếu artefact lib/ (thieu-artefact: " + String(lan.thongKe.soThieuArtefact)
        + ", khong-co-ban-goc: " + String(lan.thongKe.soKhongCoBanGoc) + ") — XANH ở đây chỉ có nghĩa "
        + "\"không phát sinh sai khác MỚI trên phần so được\", KHÔNG chứng minh toàn bộ gói khớp. "
        + "Trên checkout sạch, chạy build.ts của từng gói trước khi chạy cổng.",
    });
  }
  res.notes.push("cổng A: " + String(lan.thongKe.soGoiA) + " gói · cổng B: " + String(lan.thongKe.soGoiB)
    + " gói · so được " + String(lan.thongKe.soGoiSoDuoc) + "/" + String(lan.thongKe.soGoi));
  res.notes.push("baseline " + duongRel + ": " + String(baseline.soMuc) + " mục · mục mới: " + String(moi.length)
    + " · nợ cũ còn lại: " + String(noCu.length) + " · mục đã hết lệch: " + String(daHet.length));
  res.notes.push("cổng này là RATCHET: chỉ ĐỎ khi phát sinh mục MỚI; nợ cũ trong baseline in WARN, dùng --strict để coi WARN là ĐỎ.");
  res.ms = Date.now() - batDau;
  return res;
}

// 19/11/2026: thêm chế độ cho cổng ratchet + CI, KHÔNG phá CLI cũ (không cờ = hành vi KHOÁ CỨNG như trước):
//   --list             in mỗi mục chưa khai một dòng `<cổng>|<gói>|<loại>` (dùng để diff/soát baseline)
//   --json             in JSON đầy đủ (kết quả + mục chưa khai + số liệu phủ)
//   --ratchet|--baseline  chạy đúng cổng `deviation` mà gate.ts/CI dùng (chỉ ĐỎ khi có mục MỚI)
//   --update-baseline  ghi lại tools/lint/deviation-baseline.json từ trạng thái hiện tại
if (isDirectRun(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes("--update-baseline")) {
    const soMuc = ghiBaseline(thuThapMucChuaKhai());
    console.log("INFO đã ghi " + toRel(TEP_BASELINE) + " · " + String(soMuc) + " mục");
    process.exit(0);
  }
  if (argv.includes("--ratchet") || argv.includes("--baseline")) {
    const ketQua = runDeviationBaselineCheck();
    printResult(ketQua, { limit: 40, strict: argv.includes("--strict") });
    process.exit(ketQua.violations.length > 0 || (argv.includes("--strict") && ketQua.warnings.length > 0) ? 1 : 0);
  }
  const lan = quetSaiKhac();
  if (argv.includes("--list")) {
    for (const m of lan.muc) console.log(m.khoa);
    process.exit(0);
  }
  printResult(lan.ketQua, { limit: 20 });
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ ...lan.ketQua, mucChuaKhai: lan.muc, thongKe: lan.thongKe }, null, 1));
  }
  process.exit(lan.ketQua.violations.length === 0 ? 0 : 1);
}
