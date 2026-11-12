/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nạp lười theo TƯƠNG ĐỐI bên gọi: cache kết quả THÀNH CÔNG (lỗi KHÔNG cache) — port 1:1 lib/index.js của @deepseek-ai/dsh-lazy-require (bản gốc 25 dòng, MIT — xem README để biết provenance)
 */
import { createRequire } from "node:module";

/**
 * Dựng bộ nạp lười có CACHE KẾT QUẢ THÀNH CÔNG quanh `require` tương đối bên gọi của Node.
 * Lần nạp HỎNG KHÔNG được cache, nên sau khi sửa cài đặt có thể thử lại.
 * Nhận: specifier — specifier phụ thuộc NGUYÊN VĂN do gói bên gọi khai; parentURL — `import.meta.url`
 *        của bên gọi (chủ sở hữu việc giải gói).
 * Trả: hàm nạp KHÔNG tham số, giải phụ thuộc ở lần dùng ĐẦU TIÊN.
 */
export function createLazyRequire(specifier: string, parentURL: string): () => unknown {
  const require = createRequire(parentURL);
  /** Đã nạp thành công chưa. */
  let loaded = false;
  /** Giá trị đã cache. */
  let value: unknown;
  return () => {
    if (!loaded) {
      value = require(specifier);
      loaded = true;
    }
    return value;
  };
}
