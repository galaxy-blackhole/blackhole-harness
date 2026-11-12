/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ backend CÓ TÊN của kho lưu trữ: bảng tên → backend, đăng ký là một hiệu ứng
 *      (trả hàm dọn), và nhiều backend cùng sống song song (bản gốc: lib/types/registry.d.ts)
 */
import type { StorageBackend } from "./backend.ts";
import { StorageError } from "./error.ts";

/**
 * Bảng tên → backend, sửa được. Nhiều backend cùng được mount song song; BACKEND NÀO phục vụ
 * người dùng nào là cấu hình của người dùng đó (ví dụ bảng tuyến của lớp domain), KHÔNG BAO GIỜ
 * là lựa chọn toàn cục của kho.
 */
export class BackendRegistry {
  /** Bảng tên → backend. Mỗi thực thể sổ có bảng RIÊNG (xem ca C6 trong test). */
  private readonly backends = new Map<string, StorageBackend>();

  /**
   * Đăng ký một backend có tên. Đăng ký là HIỆU ỨNG: hàm dọn trả về sẽ gỡ đúng cái tên đó.
   * Gỡ tên KHÔNG đóng backend — plugin chủ sở hữu tự đóng sau khi gỡ đăng ký.
   * Nhận: tên backend (ví dụ `json`, `sqlite`) và thể hiện backend.
   * Trả: hàm dọn gỡ tên; trùng tên thì ném `duplicate-backend` TRƯỚC khi ghi.
   */
  register(name: string, backend: StorageBackend): () => void {
    if (this.backends.has(name)) {
      throw new StorageError("duplicate-backend", `storage backend '${name}' is already registered`);
    }
    this.backends.set(name, backend);
    return () => {
      if (this.backends.get(name) === backend) this.backends.delete(name);
    };
  }

  /**
   * Giải một backend theo tên.
   * Nhận: tên backend đã đăng ký.
   * Trả: thể hiện backend; chưa đăng ký thì ném `backend-not-found` kèm danh sách tên hiện có.
   */
  get(name: string): StorageBackend {
    const backend = this.backends.get(name);
    if (!backend) {
      const registered = [...this.backends.keys()].join(", ") || "none";
      throw new StorageError("backend-not-found", `storage backend '${name}' is not registered (registered: ${registered})`);
    }
    return backend;
  }

  /**
   * Liệt kê tên các backend đã đăng ký, cho chẩn đoán.
   * Nhận: không.
   * Trả: mảng ẢNH CHỤP các tên (sửa mảng này không chạm vào sổ).
   */
  names(): string[] {
    return [...this.backends.keys()];
  }
}
