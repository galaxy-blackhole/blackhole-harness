/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Đổi id stock → id GBH trong bản cài ở profile (bước cuối của sync-lib-to-profile.sh);
 *      11/11/2026: thêm stamp `lib/.gbh-rewrite-stamp` để lượt boot sau BỎ QUA bước đổi id
 *      (trước đây mỗi lượt boot đọc + regex lại 66 MB / 3315 tệp lib của 217 gói, đo được ~9 giây).
 *      12/11/2026: stamp mang thêm DẤU VÂN TAY stat (size+mtime+ctime) ⇒ stamp khớp thì KHÔNG đọc nội dung
 *      cây lib/ nữa (đo trước khi vá: 5,7 giây/lượt boot chỉ để BĂM LẠI 66 MB dù kết quả 0 tệp).
 */
/**
 * QUY TẮC (rút ra từ thực nghiệm + ba sự cố 07/11/2026):
 *  · Chỉ đổi id CÓ gói tương ứng trong profile (đọc `gbh.provenance.stock` của manifest trong REPO);
 *    id không có gói tương ứng thì PHẢI giữ nguyên, nếu đổi sẽ không nạp được.
 *  · Ba id kernel (cordis · schemastery · cosmokit) LUÔN giữ nguyên — ADR-0030 một thể hiện kernel.
 *  · KHÔNG BAO GIỜ đổi thành CHÍNH GÓI ĐANG VIẾT: nhiều gói của ta (gbh-sandbox, gbh-llm-deepseek, …) vẫn
 *    import helper từ gói stock mà chúng thay thế. Đổi id trong tệp CỦA CHÍNH gói đó tạo self-import ⇒ ESM
 *    ném "Detected cycle while resolving name …" ⇒ app KHÔNG khởi động (đo được: 17 entry chết vì
 *    gbh-sandbox tự import chính nó). Mỗi gói vì vậy dùng bảng đổi ĐÃ BỎ cặp có đích là chính nó.
 *  · PHẢI khớp theo RANH GIỚI tên gói: gói `dsh-llm` là TIỀN TỐ của `dsh-llm-deepseek`, nên thay chuỗi
 *    trần biến `@deepseek-ai/dsh-llm-deepseek` thành `@galaxy-blackhole/gbh-llm-deepseek` (self-import,
 *    sự cố thật). Chỉ thay khi ký tự ngay sau KHÔNG phải [A-Za-z0-9_-].
 *  · KHÔNG ghép subpath vào id: bản trước đổi `…dsh-typert-protocol/remote-info` thành
 *    `…gbh-typert-protocol/remote-info/remote-info` ⇒ 29 entry chết ("subpath is not defined by exports").
 *  · Bỏ qua symlink (farm tạo vòng lặp), `node_modules` lồng nhau và `.d.ts`.
 *  · Chạy nhiều lần vẫn an toàn: sau lượt đầu không còn id stock nên lượt sau đổi 0 tệp.
 *
 * CÁCH DÙNG: GBH_REPO=<gốc repo> bun run tools/p1b/denta-profile.ts <thư-mục @galaxy-blackhole trong profile>
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ba id kernel PHẢI giữ nguyên (một thể hiện kernel duy nhất — ADR-0030). */
const KERNEL: readonly string[] = ["@deepseek-ai/cordis", "@deepseek-ai/schemastery", "@deepseek-ai/cosmokit"];

/** Bảng đổi id: id stock → id của ta. Rỗng nghĩa là "không đổi gì". */
const BANG = new Map<string, string>();

/**
 * 11/11/2026 — TÊN TỆP STAMP của bước đổi id, đặt trong `lib/` của từng gói trong profile.
 * Nội dung: `<sha256 bảng đổi id>:<sha256 cây lib/>` — khớp thì lượt sau BỎ QUA đổi id cho gói đó.
 */
export const TEN_TEP_STAMP = ".gbh-rewrite-stamp";

/** Thống kê một lượt chạy. */
interface ThongKe {
  /** Số tệp (không phải manifest) đã ghi. */
  tep: number;
  /** Tên các gói có ít nhất một tệp đổi. */
  goi: Set<string>;
  /** Số manifest package.json đã ghi. */
  manifest: number;
  /** 1 khi gói này được BỎ QUA nhờ stamp khớp (không đọc lại cây lib/), 0 khi phải đổi id. */
  boQua: number;
}

/**
 * Dựng bảng đổi id từ manifest của các gói trong REPO (chỉ giữ id mà PROFILE có thư mục tương ứng).
 * Nhận: thuMucProfile — thư mục `@galaxy-blackhole` trong profile.
 * Trả: số cặp id dựng được.
 */
export function napBang(thuMucProfile: string, gocRepoDuPhong?: string): number {
  BANG.clear();
  const coTrongProfile = new Set(readdirSync(thuMucProfile));
  const gocRepo = gocRepoDuPhong ?? process.env.GBH_REPO ?? join(thuMucProfile, "..", "..", "..", "..");
  for (const nhom of ["host", "client", "tools"]) {
    const thuMucNhom = join(gocRepo, "packages", nhom);
    let tenGoi: string[] = [];
    try {
      tenGoi = readdirSync(thuMucNhom);
    } catch {
      continue;
    }
    for (const ten of tenGoi) {
      const manifest = join(thuMucNhom, ten, "package.json");
      let duLieu: { name?: unknown; gbh?: { provenance?: { stock?: unknown } } };
      try {
        duLieu = JSON.parse(readFileSync(manifest, "utf8")) as typeof duLieu;
      } catch {
        continue;
      }
      const goc = duLieu.gbh?.provenance?.stock;
      const tenTa = duLieu.name;
      if (typeof goc !== "string" || typeof tenTa !== "string") continue;
      if (KERNEL.includes(goc)) continue;
      if (!coTrongProfile.has(tenTa.replace("@galaxy-blackhole/", ""))) continue;
      BANG.set(goc, tenTa);
    }
  }
  return BANG.size;
}

/**
 * Bảng đổi id DÀNH RIÊNG cho một gói: bỏ mọi cặp có đích là chính gói đó (chống self-import).
 * Nhận: bang — bảng đổi đầy đủ; tenGoi — tên thư mục gói trong profile (không có tiền tố scope).
 * Trả: bảng đổi đã lọc.
 */
function bangCuaGoi(bang: readonly (readonly [string, string])[], tenGoi: string): readonly (readonly [string, string])[] {
  const tenTa = "@galaxy-blackhole/" + tenGoi;
  return bang.filter(([, den]) => den !== tenTa);
}

/**
 * Băm "phiên bản bảng đổi id": sha256 của các cặp (id stock → id của ta) đã sắp xếp.
 * Nhận: bang — bảng đổi id đầy đủ. Trả: chuỗi sha256 hex.
 * Vì sao cần: stamp rewrite phải ĐỔI khi bảng đổi (thêm id mới) ⇒ lượt boot sau tự đổi id lại,
 * không bao giờ để bản cài mang id cũ vì cache (yêu cầu an toàn (a)).
 * @param bang - bảng đổi id đầy đủ (cặp [id stock, id của ta]).
 * @returns chuỗi sha256 hex đại diện cho phiên bản bảng.
 */
export function bamBangDoiId(bang: readonly (readonly [string, string])[]): string {
  const hash = createHash("sha256");
  for (const [tu, den] of [...bang].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    hash.update(tu);
    hash.update("\u0000");
    hash.update(den);
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

/** Kết quả quét cây `lib/` của một gói: danh sách tệp + dấu vân tay stat. */
interface QuetLib {
  /** Đường dẫn tuyệt đối của mọi tệp thật trong cây (bỏ symlink + tệp stamp), thứ tự xác định. */
  tep: string[];
  /** sha256 của (đường dẫn tương đối + size + mtime + ctime) từng tệp — RẺ, không đọc nội dung. */
  vanTay: string;
  /** Số tệp đã quét (0 = gói thiếu artefact ⇒ không được bỏ qua). */
  soTep: number;
}

/**
 * Quét cây `lib/` của một gói trong profile, KHÔNG đọc nội dung: chỉ lstat để lấy size/mtime/ctime.
 * Nhận: libDir — thư mục `lib` của gói trong profile (có thể chưa tồn tại).
 * Trả: {@link QuetLib} — danh sách tệp + dấu vân tay stat.
 *
 * Vì sao đủ an toàn: mtime/ctime do KERNEL đặt, không công cụ nào ghi nội dung mà giữ nguyên ctime
 * (utimes chỉ đổi mtime). Nội dung đổi ⇒ size hoặc ctime đổi ⇒ vân tay trượt ⇒ đọc lại nội dung để
 * quyết định (xem doiTrongGoi). Bỏ qua symlink (farm tạo vòng lặp) và CHÍNH tệp stamp.
 * @param libDir - thư mục `lib` của gói trong profile.
 * @returns danh sách tệp kèm dấu vân tay stat của cây.
 */
function quetCayLib(libDir: string): QuetLib {
  const tep: string[] = [];
  const hash = createHash("sha256");
  const duyet = (thuMuc: string): void => {
    let muc: string[] = [];
    try {
      muc = readdirSync(thuMuc).sort();
    } catch {
      return;
    }
    for (const ten of muc) {
      if (ten === TEN_TEP_STAMP) continue;
      const duong = join(thuMuc, ten);
      let thongTin;
      try {
        thongTin = lstatSync(duong);
      } catch {
        continue;
      }
      if (thongTin.isSymbolicLink()) continue;
      if (thongTin.isDirectory()) {
        duyet(duong);
        continue;
      }
      tep.push(duong);
      hash.update(duong.slice(libDir.length));
      hash.update("\u0000");
      hash.update(String(thongTin.size));
      hash.update("\u0000");
      hash.update(String(thongTin.mtimeMs));
      hash.update("\u0000");
      hash.update(String(thongTin.ctimeMs));
      hash.update("\u0000");
    }
  };
  duyet(libDir);
  return { tep, vanTay: hash.digest("hex"), soTep: tep.length };
}

/**
 * Băm NỘI DUNG cây `lib/` của một gói: sha256 của (đường dẫn tương đối + sha256 từng tệp).
 * Nhận: libDir — thư mục `lib` của gói trong profile; tep — danh sách tệp do {@link quetCayLib} trả về.
 * Trả: chuỗi sha256 hex đại diện nội dung cây.
 * @param libDir - thư mục `lib` của gói trong profile.
 * @param tep - danh sách tệp (đường dẫn tuyệt đối) đã quét.
 * @returns chuỗi sha256 hex của nội dung cây lib.
 */
function bamNoiDung(libDir: string, tep: readonly string[]): string {
  const hash = createHash("sha256");
  for (const duong of tep) {
    hash.update(duong.slice(libDir.length));
    hash.update("\u0000");
    hash.update(createHash("sha256").update(readFileSync(duong)).digest("hex"));
    hash.update("\u0000");
  }
  return hash.digest("hex");
}

/**
 * Ghi stamp của một gói; lỗi ghi KHÔNG làm chết boot (chỉ khiến lượt sau chậm hơn).
 * Nhận: stampPath — đường dẫn `lib/.gbh-rewrite-stamp`; noiDung — nội dung stamp (không kèm newline).
 * Trả: không.
 * @param stampPath - đường dẫn tệp stamp trong `lib/` của gói.
 * @param noiDung - nội dung stamp dạng `<bảng>:<vân tay>:<nội dung>`.
 */
function ghiStamp(stampPath: string, noiDung: string): void {
  try {
    writeFileSync(stampPath, noiDung + "\n", "utf8");
  } catch {
    // Không ghi được stamp chỉ làm lượt sau chậm hơn, không làm sai bản cài.
  }
}

/**
 * Đọc stamp rewrite đã ghi cho một gói.
 * Nhận: stampPath — đường dẫn tệp stamp. Trả: nội dung đã trim, hoặc "" khi chưa có/không đọc được.
 * @param stampPath - đường dẫn `lib/.gbh-rewrite-stamp` của gói trong profile.
 * @returns nội dung stamp (rỗng nghĩa là chưa có stamp ⇒ phải đổi id).
 */
function docStamp(stampPath: string): string {
  try {
    return readFileSync(stampPath, "utf8").trim();
  } catch {
    return "";
  }
}

/**
 * Thay id stock bằng id của ta trong một chuỗi, khớp theo RANH GIỚI tên gói và giữ nguyên subpath.
 * Nhận: text — nội dung tệp; bang — bảng đổi (đã sắp khoá dài trước).
 * Trả: văn bản đã đổi.
 */
function doiId(text: string, bang: readonly (readonly [string, string])[]): string {
  let out = text;
  for (const [tu, den] of bang) {
    // 11/11/2026 — LỐI TẮT RẺ, tương đương: tệp không chứa id đó thì không thể đổi được gì, khỏi dựng
    // RegExp + quét cả chuỗi. Đo được: mỗi tệp lib/ phải dựng ~300 RegExp (217 gói × ~300 cặp) ⇒ 9 giây
    // mỗi lượt boot dù kết quả 0 tệp. `includes` nhanh hơn ~3 bậc và KHÔNG đổi kết quả.
    if (!text.includes(tu)) continue;
    // Chỉ thay khi ký tự NGAY SAU tên gói không thuộc [A-Za-z0-9_-] (hết tên gói hoặc bắt đầu subpath).
    const mau = new RegExp(tu.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "(?![\\w-])", "gu");
    out = out.replace(mau, () => den);
  }
  return out;
}

/**
 * Duyệt một cây thư mục gói và đổi id trong mọi tệp .js/.mjs/.cjs/.json (bỏ symlink, node_modules, .d.ts).
 * Nhận: goc — thư mục gói trong profile; bangDayDu — bảng đổi đầy đủ; tenGoi — tên thư mục gói để đếm;
 *   phienBanBang — băm bảng đổi id; force — true thì đổi id lại dù stamp khớp.
 * Trả: thống kê của gói đó (boQua = 1 khi cả cây `lib/` được bỏ qua nhờ stamp khớp).
 *
 * 11/11/2026 — CACHE BƯỚC ĐỔI ID (đo trước khi vá: 8,95 giây/lượt boot cho 66 MB / 3315 tệp lib của 217 gói,
 * dù kết quả thường là 0 tệp vì lượt boot trước đã đổi rồi). Nay mỗi gói mang stamp
 * `lib/.gbh-rewrite-stamp` = sha256(bảng đổi id) + sha256(cây lib/ HIỆN TẠI). Stamp khớp ⇒ bỏ qua hẳn cây
 * lib/ (không đọc, không regex). Stamp chỉ được ghi SAU khi đã đổi id, nên nó mô tả đúng nội dung đang có:
 *  · build lại lib từ nguồn (id stock) ⇒ sha256 cây lib đổi ⇒ stamp trượt ⇒ đổi id lại (không phục vụ id cũ);
 *  · bảng đổi id thêm cặp mới ⇒ phần băm bảng đổi ⇒ stamp trượt ⇒ đổi id lại;
 *  · thiếu artefact (`lib` rỗng/mất) ⇒ soTep = 0 ⇒ KHÔNG bỏ qua;
 *  · `GBH_FORCE_REWRITE=1` ⇒ bỏ qua cache để debug.
 * Phần NGOÀI lib/ (package.json, locale/, assets/, runtime/) vẫn đổi mỗi lượt như trước: mount chép lại
 * package.json từ nguồn ở mọi lượt boot, nên nếu cache cả package.json thì bản cài sẽ giữ id stock.
 *
 * 12/11/2026 — HAI TẦNG KIỂM để khỏi băm 66 MB mỗi lượt boot:
 *  1. Vân tay stat (size+mtime+ctime) khớp ⇒ bỏ qua, KHÔNG đọc nội dung;
 *  2. Vân tay trượt (mount vừa chép lại tệp, hoặc chỉ chạm mtime) ⇒ băm nội dung: khớp bản đã đổi id thì
 *     chỉ cập nhật stamp, khác thì đổi id lại. Nhờ vậy mọi ca "nội dung đổi" vẫn quay về tầng băm.
 */
function doiTrongGoi(
  goc: string,
  bangDayDu: readonly (readonly [string, string])[],
  tenGoi: string,
  phienBanBang: string,
  force: boolean,
): ThongKe {
  const bang = bangCuaGoi(bangDayDu, tenGoi);
  const tk: ThongKe = { tep: 0, goi: new Set<string>(), manifest: 0, boQua: 0 };
  const libDir = join(goc, "lib");
  const stampPath = join(libDir, TEN_TEP_STAMP);
  // Quét stat TRƯỚC khi quyết định: đây là phép đo "noi dung lib/ hien tai co dung la ban da doi id khong".
  const quet = quetCayLib(libDir);
  const [bangLuu = "", vanTayLuu = "", noiDungLuu = ""] = docStamp(stampPath).split(":");
  const stampConHieuLuc = !force && quet.soTep > 0 && noiDungLuu !== "" && bangLuu === phienBanBang;
  let boQuaLib = stampConHieuLuc && vanTayLuu === quet.vanTay;
  if (stampConHieuLuc && !boQuaLib && bamNoiDung(libDir, quet.tep) === noiDungLuu) {
    // Nội dung vẫn là bản đã đổi id (chỉ mtime/ctime đổi, ví dụ mount vừa chép đè bản giống hệt):
    // cập nhật vân tay rồi bỏ qua — không đổi id lại, không đọc nội dung ở lượt sau.
    boQuaLib = true;
    ghiStamp(stampPath, phienBanBang + ":" + quet.vanTay + ":" + noiDungLuu);
  }
  if (boQuaLib) tk.boQua = 1;
  const duyet = (thuMuc: string): void => {
    let muc: string[] = [];
    try {
      muc = readdirSync(thuMuc);
    } catch {
      return;
    }
    for (const ten of muc) {
      const duong = join(thuMuc, ten);
      let thongTin;
      try {
        thongTin = lstatSync(duong);
      } catch {
        continue;
      }
      if (thongTin.isSymbolicLink()) continue;
      if (thongTin.isDirectory()) {
        if (ten === "node_modules") continue;
        // CHỈ bỏ qua `lib` CẤP GÓI (cây được stamp bảo kê); `lib` lồng trong thư mục khác vẫn đổi như trước.
        if (boQuaLib && thuMuc === goc && ten === "lib") continue;
        duyet(duong);
        continue;
      }
      if (!/\.(?:js|mjs|cjs|json)$/u.test(ten)) continue;
      let truoc = "";
      try {
        truoc = readFileSync(duong, "utf8");
      } catch {
        continue;
      }
      const sau = doiId(truoc, bang);
      if (sau === truoc) continue;
      writeFileSync(duong, sau);
      if (ten === "package.json") tk.manifest += 1;
      else {
        tk.tep += 1;
        tk.goi.add(tenGoi);
      }
    }
  };
  duyet(goc);
  // Ghi stamp SAU khi đổi id: quét lại cây lib/ (đã là bản GBH) ⇒ lượt sau khớp ở tầng vân tay stat.
  if (!boQuaLib && quet.soTep > 0) {
    const sauKhi = quetCayLib(libDir);
    ghiStamp(stampPath, phienBanBang + ":" + sauKhi.vanTay + ":" + bamNoiDung(libDir, sauKhi.tep));
  }
  return tk;
}

/**
 * Đổi id stock → id của ta cho MỌI gói trong profile. Dùng lại được từ đường boot (xem mount.ts).
 * Nhận: thuMuc — thư mục `@galaxy-blackhole` trong profile; gocRepo — gốc repo để đọc manifest
 *   (bắt buộc khi gọi từ đường boot, vì lúc đó biến môi trường GBH_REPO không có);
 *   options.force — true thì đổi id lại cho mọi gói dù stamp khớp (cờ `GBH_FORCE_REWRITE=1` ở đường boot).
 * Trả: { cap, tep, goi, manifest, soGoi, boQua } — số cặp id, số tệp đã ghi, số gói đổi, số manifest,
 *   số gói đã duyệt và số gói BỎ QUA nhờ stamp (để log boot chứng minh cache có tác dụng).
 */
export function suaIdProfile(
  thuMuc: string,
  gocRepo?: string,
  options: { force?: boolean } = {},
): { cap: number; tep: number; goi: number; manifest: number; soGoi: number; boQua: number } {
  const soCap = napBang(thuMuc, gocRepo);
  const bang = [...BANG.entries()].sort((a, b) => b[0].length - a[0].length);
  // 11/11/2026: băm bảng đổi id MỘT lần cho cả lượt — đổi bảng là mọi stamp trượt (an toàn (a)).
  const phienBanBang = bamBangDoiId(bang);
  const tong: ThongKe = { tep: 0, goi: new Set<string>(), manifest: 0, boQua: 0 };
  let soGoi = 0;
  for (const ten of readdirSync(thuMuc)) {
    if (ten.startsWith(".")) continue;
    const goc = join(thuMuc, ten);
    let la = false;
    try {
      la = lstatSync(goc).isDirectory();
    } catch {
      continue;
    }
    if (!la) continue;
    soGoi += 1;
    const tk = doiTrongGoi(goc, bang, ten, phienBanBang, options.force === true);
    tong.tep += tk.tep;
    tong.manifest += tk.manifest;
    tong.boQua += tk.boQua;
    for (const goi of tk.goi) tong.goi.add(goi);
  }
  return { cap: soCap, tep: tong.tep, goi: tong.goi.size, manifest: tong.manifest, soGoi, boQua: tong.boQua };
}

/** Điểm vào CLI: đổi id cho mọi gói trong profile rồi in thống kê. Nhận: không (đọc argv). Trả: không. */
function main(): void {
  const thuMuc = process.argv[2];
  if (thuMuc === undefined || !existsSync(thuMuc)) {
    console.error("dung: GBH_REPO=<goc repo> bun run tools/p1b/denta-profile.ts <thu-muc @galaxy-blackhole trong profile>");
    process.exit(2);
  }
  // 11/11/2026: `GBH_FORCE_REWRITE=1` ép đổi id lại dù stamp khớp (dùng khi debug bản cài).
  const force = (process.env.GBH_FORCE_REWRITE ?? "").trim() === "1";
  const kq = suaIdProfile(thuMuc, undefined, { force });
  console.log(
    "[denta-profile] bang " + String(kq.cap) + " cap id · doi " + String(kq.tep) + " tep trong " +
      String(kq.goi) + " goi · manifest " + String(kq.manifest) + " · bo qua " + String(kq.boQua) + "/" +
      String(kq.soGoi) + " goi" + (force ? " · GBH_FORCE_REWRITE=1" : kq.boQua > 0 ? " (stamp khop)" : ""),
  );
}

if (import.meta.main) main();