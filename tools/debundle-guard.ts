/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Chặn hồi quy cho các gói ĐÃ DE-BUNDLE (nửa client từ `src/parts/`, hoặc nửa host có tệp đánh dấu
 *      `.debundled`): artefact trong `lib/` là bản dựng ĐÚNG (lát/tệp nguyên văn của bản gốc + Δid), nên
 *      `buildPackage` phải CHÉP NGUYÊN cây `lib/` sang thư mục đích mà mount yêu cầu — KHÔNG build lại từ
 *      `src/*.ts` (bản viết tay mỏng hơn bản gốc) và KHÔNG ném lỗi (ném lỗi ⇒ mount hỏng ⇒ row gốc DSH bật lại).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, utimesSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";

/**
 * Gói này đã de-bundle chưa?
 * Nhận: pkgDir — thư mục gói.
 * Trả: `true` khi có `src/parts/` (nửa client de-bundle) hoặc tệp đánh dấu `.debundled` (nửa host de-bundle).
 */
export function isDebundled(pkgDir: string): boolean {
  return existsSync(join(pkgDir, "src", "parts")) || existsSync(join(pkgDir, ".debundled"));
}

/**
 * Nếu gói đã de-bundle thì chép NGUYÊN cây `lib/` sang thư mục đích.
 * Nhận: pkgDir — thư mục gói; outDir — thư mục đích mount yêu cầu.
 * Trả: danh sách đường dẫn artefact đã ghi, hoặc `null` nếu gói CHƯA de-bundle (bên gọi tự build như cũ).
 */
export function copyIfDebundled(pkgDir: string, outDir: string): string[] | null {
  if (!isDebundled(pkgDir)) return null;
  const nguon = join(pkgDir, "lib");
  if (!existsSync(nguon)) throw new Error(basename(pkgDir) + ": da de-bundle nhung khong thay lib/");
  mkdirSync(outDir, { recursive: true });
  // 20/10/2026 (task-186): test của vài gói build vào THƯ MỤC CON của lib (vd lib/.test-build-main) ⇒
  // cpSync(nguon → outDir) sẽ tự copy vào chính nó (EINVAL clonefile). Chép TỪNG mục, BỎ QUA cây outDir.
  const dich = resolve(outDir);
  for (const ten of readdirSync(nguon)) {
    const nguonCon = resolve(join(nguon, ten));
    // CHỈ bỏ qua đúng mục LÀ outDir (khi test build vào thư mục con của lib) — không bỏ qua mọi thứ trong outDir.
    if (nguonCon === dich) continue;
    cpSync(nguonCon, join(outDir, ten), { recursive: true });
  }
  // Thứ tự PHẢI ổn định: [index.js, client.js, …] — bên gọi (test/build) lấy phần tử [0] làm nửa host,
  // [1] làm nửa client. Trước 20/10/2026 hàm này trả theo readdir (client.js đứng trước) ⇒ test nạp
  // NHẦM nửa host (ESM) và báo "Unexpected keyword 'export'".
  // 05/11/2026 (P1b): cpSync giu nguyen mtime cua nguon ⇒ artifact co the CU hon ma nguon va bi test
  // tu choi ("artifact CU hon ma nguon"). Dong bo mtime ve NOW de artifact luon moi hon src/.
  const bayGio = new Date();
  for (const ten of readdirSync(outDir)) {
    const duong = join(outDir, ten);
    if (statSync(duong).isFile()) utimesSync(duong, bayGio, bayGio);
  }
  const uuTien = ["index.js", "client.js"];
  const conLai = readdirSync(outDir)
    .filter((ten) => ten.endsWith(".js") && !uuTien.includes(ten))
    .sort();
  return [...uuTien.filter((ten) => existsSync(join(outDir, ten))), ...conLai].map((ten) => join(outDir, ten));
}
