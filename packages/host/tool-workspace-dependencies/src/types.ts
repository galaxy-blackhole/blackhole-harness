/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu dữ liệu của tool-workspace-dependencies, chép nguyên văn từ lib/types/index.d.ts của bản gốc
 *      (Config · PrimaryRuntimeManifest · WorkspaceDependencies) — CHỈ kiểu, không sinh mã lúc chạy.
 */

/**
 * Metadata build chuẩn hoá, độc lập với gói người dùng cài thêm; tệp legacy được chuẩn hoá khi đọc — NGUYÊN VĂN bản gốc.
 * Nhận: không (đây là kiểu).
 * Trả: hình dạng manifest đã kiểm của `runtime.json`.
 */
export interface PrimaryRuntimeManifest {
  /** Phiên bản desktop đã sinh payload. */
  readonly desktopVersion: string;
  /** Nền tảng đích của payload (`win32` · `darwin` · `linux`). */
  readonly platform: string;
  /** Kiến trúc đích của payload (`x64` · `arm64`). */
  readonly arch: string;
  /** Danh tính payload đã khoá; chỉ vắng ở bản cài trước khi băm payload. */
  readonly payloadDigest?: string;
  /** Phiên bản trình thông dịch Python đi kèm. */
  readonly python: string;
  /** Vắng khi payload không kèm Node.js. */
  readonly node?: string;
  /** Phiên bản pnpm đi kèm; đòi hỏi có Node.js đi kèm. */
  readonly pnpm?: string;
  /** Toàn bộ phiên bản distribution Python đã ghi; rỗng với tệp legacy không có bản đồ distribution. */
  readonly pythonPackages: Readonly<Record<string, string>>;
}

/**
 * Điểm vào tuyệt đối + phiên bản đi kèm; pnpm chạy qua đúng trình Node trả về — NGUYÊN VĂN bản gốc.
 * Nhận: không (đây là kiểu).
 * Trả: hình dạng kết quả của `load_workspace_dependencies`.
 */
export interface WorkspaceDependencies {
  /** Đường dẫn tuyệt đối tới trình Python đi kèm. */
  readonly python: string;
  /** Vắng khi payload không kèm Node.js. */
  readonly node?: string;
  /** Vắng khi payload không kèm pnpm. */
  readonly pnpm?: string;
  /** Thư mục site-packages của Python đi kèm. */
  readonly pythonPackages: string;
  /** Vắng khi payload không kèm Node.js. */
  readonly nodePackages?: string;
  /** Phiên bản distribution đã khoá; loại gói người dùng thêm vào môi trường đã cài. */
  readonly pythonDistributions: Readonly<Record<string, string>>;
}
