/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/11/2026
 * desc Cổng log khởi động của `bh host`: mặc định chỉ in MỘT dòng `[bh] ready <url>` cùng lỗi thật;
 *      chi tiết (banner · mount · migrate · cổng chặn mount) chỉ in khi GBH_LOG=debug hoặc cờ --verbose,
 *      và các cảnh báo mount cùng loại được gộp thành MỘT dòng tổng kết có đếm.
 */

import { buildRuntimeAvailable } from "./prebuilt.ts";

/** Hai mức log của một lượt chạy: `quiet` (mặc định) và `debug` (GBH_LOG=debug hoặc --verbose). */
export type MucLog = "quiet" | "debug";

/** Giá trị GBH_LOG được coi là bật chi tiết (so sau khi trim + hạ chữ thường). */
const GIA_TRI_DEBUG: readonly string[] = ["debug", "verbose", "trace", "1", "true", "yes"];

/**
 * Đổi giá trị GBH_LOG thành mức log.
 * Nhận: giá trị thô của biến môi trường (undefined khi không đặt).
 * Trả: "debug" khi là debug/verbose/trace/1/true/yes, ngược lại "quiet".
 */
export function docMucLog(giaTri: string | undefined): MucLog {
  return GIA_TRI_DEBUG.includes((giaTri ?? "").trim().toLowerCase()) ? "debug" : "quiet";
}

/** Mức log đang dùng: khởi tạo từ GBH_LOG, cờ `--verbose` đổi lại sau khi parse argv. */
let mucHienTai: MucLog = docMucLog(process.env.GBH_LOG);

/**
 * Đặt mức log cho tiến trình hiện tại (dùng cho cờ --verbose).
 * Nhận: muc — mức cần dùng từ đây ("quiet" hoặc "debug").
 * Trả: không.
 */
export function datMucLog(muc: MucLog): void {
  mucHienTai = muc;
}

/**
 * Mức log hiện tại, để nơi khác quyết định có dựng chẩn đoán đắt tiền hay không.
 * Nhận: không.
 * Trả: true khi đang ở mức "debug".
 */
export function logChiTietBat(): boolean {
  return mucHienTai === "debug";
}

/**
 * In MỘT dòng chi tiết của đường boot (banner · mount · migrate · cổng chặn mount).
 * Nhận: dong — dòng cần in, KHÔNG kèm newline.
 * Trả: không; bỏ qua hoàn toàn ở mức mặc định nên log khởi động chỉ còn dòng ready.
 */
export function logChiTiet(dong: string): void {
  if (mucHienTai === "debug") console.log(dong);
}

/** Một cảnh báo mount chưa tới mức chặn boot (giữ nguyên hình dạng của RowVerdict). */
export interface CanhBaoMount {
  /** Tên package (đã gắn tiền tố @galaxy-blackhole/). */
  pkg: string;
  /** Mức của phép kiểm do cổng chặn mount trả về ("chan" | "canh bao" | …). */
  level: string;
  /** Lý do ngắn gọn do cổng chặn mount đưa ra. */
  reason: string;
}

/**
 * Nhóm lý do cảnh báo thành nhãn đếm được trong dòng tổng kết.
 * Nhận: lyDo — câu lý do của cổng chặn mount.
 * Trả: nhãn nhóm (tiếng Việt) để gộp các cảnh báo CÙNG LOẠI lại với nhau.
 */
function nhomLyDo(lyDo: string): string {
  if (lyDo.includes("KHONG doi chieu duoc export") || lyDo.includes("khong thay ban goc")) return "chưa đối chiếu được export";
  if (lyDo.includes("chua thay artifact trong profile")) return "chưa có artefact trong profile (mount sẽ build)";
  return "cảnh báo khác";
}

/**
 * In cảnh báo mount: mức debug in TỪNG dòng như trước 23/11/2026, mức mặc định gộp thành MỘT dòng có đếm.
 * Nhận: danhSach — các dòng phán quyết của cổng chặn mount; mục "chan" do nơi gọi in riêng vì là lỗi thật.
 * Trả: không.
 */
export function tomTatCanhBaoMount(danhSach: readonly CanhBaoMount[]): void {
  const canhBao = danhSach.filter((dong) => dong.level !== "chan");
  if (canhBao.length === 0) return;
  if (mucHienTai === "debug") {
    for (const dong of canhBao) console.log("[bh] " + dong.pkg + ": " + dong.level + ", van mount — " + dong.reason);
    return;
  }
  const dem = new Map<string, number>();
  for (const dong of canhBao) {
    const nhom = nhomLyDo(dong.reason);
    dem.set(nhom, (dem.get(nhom) ?? 0) + 1);
  }
  const phan = [...dem.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([nhom, so]) => String(so) + " gói " + nhom)
    .join(" · ");
  console.log("[bh] mount: " + String(canhBao.length) + " cảnh báo, vẫn mount — " + phan + " (chi tiết: GBH_LOG=debug)");
  // 23/11/2026 — nhãn "mount sẽ build" chỉ đúng khi máy CÓ bun. Máy không có bun thì gói nào thiếu
  // artefact dựng sẵn sẽ nằm lại rỗng trong profile ⇒ kernel báo "Cannot find module …/lib/index.js"
  // (đúng sự cố 183 plugin trên Windows), nên phải nói thẳng thay vì để người đọc tưởng đã build xong.
  if (!buildRuntimeAvailable()) {
    console.log("[bh] mount: máy KHÔNG có bun — gói thiếu artefact dựng sẵn sẽ không mount được (cài bun để mount tự build)");
  }
}
