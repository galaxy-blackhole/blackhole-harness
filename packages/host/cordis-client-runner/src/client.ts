/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào nửa client của row cordis-client-runner — ghép 11 lát NGUYÊN VĂN của bundle gốc thành MỘT bundle
 */

// Nửa client của row này KHÔNG phải một module ESM bình thường: bundle gốc là MỘT phạm vi hàm phẳng
// (11 lát tham chiếu tên của nhau không qua import), nên build.ts phải GHEP VĂN BẢN rồi mới giao cho
// Bun.build kiểm cú pháp. Vì vậy điểm vào này xuất đúng các hàm ghép/bọc mà build.ts dùng, và giữ
// nguyên văn lời gọi đăng ký module (window.__ModuleLoader__.load) trong mã nguồn để cổng check:rows đọc được.
export {
  ENTRY_FILE_NAME,
  PACKAGE_NAME,
  STOCK_PACKAGE_NAME,
  assembleBundleBody,
  assembleBundleFromDisk,
  stripPartScaffold,
  wrapClientBundle,
  type ReadFileFn,
} from "./assemble.ts";
export { CSS_REPLACEMENTS, PART_FILES } from "./manifest.ts";
