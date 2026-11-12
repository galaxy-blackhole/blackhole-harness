/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kho lưu trữ (`ctx.storage`): sổ backend có tên cộng các DẠNG DỮ LIỆU đã mount. Bản thân
 *      kho KHÔNG làm IO — backend sở hữu môi trường lưu, dạng dữ liệu (lớp domain trước tiên) sở hữu
 *      ngữ nghĩa (bản gốc: lib/types/index.d.ts)
 */
import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-storage";
import { Service } from "@deepseek-ai/cordis";
import { BackendRegistry } from "./registry.ts";
import { StorageError } from "./error.ts";

export { BackendRegistry } from "./registry.ts";
export { StorageError } from "./error.ts";
export type { StorageErrorCode } from "./error.ts";
export { UNIT_NAME_RE } from "./backend.ts";
export type { StorageBackend, KvFacet, KvUnit, KvUnitDescriptor } from "./backend.ts";

/**
 * Suy ra khóa service vòng đời cordis mà MỘT plugin backend có tên cấp.
 * Dạng cung cấp dữ liệu chèn các khóa này để lượt kích hoạt không thể đua với lượt đăng ký backend,
 * dù người gọi vẫn giải backend qua sổ của kho.
 * Nhận: tên backend trong sổ (ví dụ `json`).
 * Trả: khóa service chỉ-vòng-đời tương ứng, dạng `storage.backend.<tên>`.
 */
export function storageBackendServiceKey(name: string): string {
  return `storage.backend.${name}`;
}

/**
 * Các dạng dữ liệu mount được lên kho, khoá theo tên dạng. Chủ sở hữu dạng mở rộng bảng này bằng
 * khai báo hợp nhất (lớp domain hợp nhất `domain: DomainFacility`) rồi mount dữ liệu trong `apply`
 * của mình. Bản gốc để TRỐNG interface này; ta giữ nguyên hình dạng đó.
 */
export interface StorageForms {}

/**
 * Service kho lưu trữ. Backend đăng ký dưới `backend`; dạng dữ liệu mount dưới khoá
 * `StorageForms` của nó và được chạm tới qua `ctx.storage.<dạng>`.
 */
export class Storage extends Service {
  /** Bảng backend có tên; nhiều backend cùng được mount song song. */
  readonly backend: BackendRegistry = new BackendRegistry();

  /** Các dạng dữ liệu đã mount, khoá theo tên dạng. Mỗi thực thể kho có bảng RIÊNG (ca C6). */
  private readonly forms = new Map<string, unknown>();

  /**
   * Đăng ký service `storage` trên context hiện tại.
   * Nhận: context host (kernel cordis cấp) — bản gốc chỉ nhận đúng một tham số này.
   * Trả: thực thể đã đăng ký, với sổ backend RỖNG và chưa mount dạng dữ liệu nào.
   */
  constructor(ctx: Context) {
    super(ctx, "storage");
  }

  /**
   * Mount một dạng dữ liệu lên kho. Mount là HIỆU ỨNG: hàm dọn trả về sẽ tháo dạng đó ra.
   * Nhận: khoá dạng đã khai trong `StorageForms` và thể hiện facility cần phơi.
   * Trả: hàm dọn tháo dạng; mount trùng khoá thì ném `duplicate-mount` TRƯỚC khi ghi.
   */
  mount(form: string, facility: unknown): () => void {
    if (this.forms.has(form)) {
      throw new StorageError("duplicate-mount", `storage form '${String(form)}' is already mounted`);
    }
    this.forms.set(form, facility);
    return () => {
      if (this.forms.get(form) === facility) this.forms.delete(form);
    };
  }

  /**
   * Giải một dạng dữ liệu đã mount.
   * Nhận: khoá dạng đã khai trong `StorageForms`.
   * Trả: facility đã mount; chưa mount thì ném `form-not-mounted`.
   */
  form(form: string): unknown {
    if (!this.forms.has(form)) {
      throw new StorageError("form-not-mounted", `storage form '${String(form)}' is not mounted`);
    }
    return this.forms.get(form);
  }

  /**
   * Dạng dữ liệu DOMAIN của kho.
   * Nhận: không.
   * Trả: facility đã mount dưới khoá `domain` (chỉ có sau khi plugin lớp domain đã nạp);
   *      chưa mount thì ném `form-not-mounted` — đúng như lượt gọi `form("domain")` của bản gốc.
   */
  get domain(): unknown {
    return this.form("domain");
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    // KHÔNG khai lại `storage`: bản gốc `@deepseek-ai/dsh-storage` ĐÃ khai property này với lớp của nó; khai
    // lại bằng lớp của ta sinh TS2717 (hai lớp khác nhau về cấu trúc). Luật: ADR 0009 — một chủ sở hữu cho seam kiểu.
  }
}

export default Storage;
