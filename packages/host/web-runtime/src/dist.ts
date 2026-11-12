/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bản viết lại của `resolveDistIndex` trong bundle gốc: vị trí dist của frontend là KIẾN THỨC
 *      WORKSPACE của bundle này (neo trên manifest gói frontend), KHÔNG phải cấu hình người dùng.
 *      Từ 19/10/2026: ƯU TIÊN dist CỦA TA (đã brand-rename) — chế độ xem/serve vỏ SPA của GBH.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Gói frontend STOCK sở hữu thư mục dist dùng làm FALLBACK. */
const FRONTEND_PACKAGE = "@deepseek-ai/dsh-web-frontend";

/**
 * Tìm `dist/index.html` của vỏ SPA theo thứ tự ưu tiên: dist CỦA TA → dist STOCK.
 *
 * Sự TỒN TẠI của file là chuyện của lúc nhận request — chủ sở hữu fallback đọc file theo từng request —
 * nên một thành phần không bao giờ chạm ghế fallback vẫn boot được mà không cần dist.
 * @returns đường dẫn tuyệt đối tới `dist/index.html`.
 * @throws khi không tìm được cả dist của ta lẫn dist stock.
 */
export function resolveDistIndex(): string {
  // 19/10/2026 (task-157 nhánh B): ƯU TIÊN dist CỦA TA vì dist đó đã qua brand-rename; dist stock là FALLBACK
  // (fail-soft, giữ nguyên hành vi cũ khi chưa đồng bộ dist của ta).
  // Ba bố cục phải thử vì tên gói khác nhau và gói `host-frontend-static` là THƯ VIỆN (không nằm trong profile):
  //  · trong repo:   packages/host/web-runtime/lib  ⇒ ../../host-frontend-static/dist
  //  · trong profile có mount: node_modules/@galaxy-blackhole/gbh-web-runtime/lib ⇒ ../gbh-host-frontend-static/dist
  //  · trong profile KHÔNG mount: <home>/profiles/blackhole/dist (do scripts/sync-frontend-dist.sh đồng bộ)
  const goc = dirname(dirname(fileURLToPath(import.meta.url)));
  const ungVienList = [
    join(goc, "..", "host-frontend-static", "dist", "index.html"),
    join(goc, "..", "gbh-host-frontend-static", "dist", "index.html"),
    join(homedir(), ".galaxy", "blackhole", "profiles", "blackhole", "dist", "index.html"),
  ];
  for (const ungVien of ungVienList) {
    if (existsSync(ungVien)) return ungVien;
  }
  const require = createRequire(import.meta.url);
  try {
    return join(dirname(require.resolve(FRONTEND_PACKAGE + "/package.json")), "dist", "index.html");
  } catch {
    throw new Error("web-app: " + FRONTEND_PACKAGE + " is not resolvable from this composition");
  }
}
