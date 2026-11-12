/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu THUẦN của artefact đã sinh và của sổ đăng ký lúc chạy — bản viết lại 1:1
 *      lib/types/types.d.ts của `@deepseek-ai/dsh-typert-registry`. Sổ đăng ký giữ schema Zod TÁCH KHỎI
 *      siêu dữ liệu reflection đã sinh.
 */

// Namespace import CHỈ-KIỂU từ module lõi `zod/v4/core`: tệp này chỉ khai kiểu (không dùng zod lúc chạy) ⇒
// artifact KHÔNG kéo zod vào; và zod v4 KHÔNG có namespace `z.core` (z là thể hiện ZodClassic) ⇒ phải trỏ vào
// đúng module con đã xuất `ZodType`/`ToJSONSchemaParams`/`JSONSchema`.
import type { $ZodType } from "zod/v4/core";
import type { InvocationDescriptor } from "@deepseek-ai/dsh-typert-protocol";

/** Phía được biên dịch ĐỘC LẬP đã sinh ra một đóng góp. */
export type TypertFace = "host" | "client";

/** Thẻ JSDoc có cấu trúc, được siêu dữ liệu lúc chạy giữ lại. */
export interface TypertDocTag {
  /** Tên thẻ. */
  readonly name: string;
  /** Đối số của thẻ (nếu có). */
  readonly argument?: string;
  /** Chú thích của thẻ (nếu có). */
  readonly comment?: string;
  /** Toàn văn thẻ. */
  readonly text: string;
}

/** Tài liệu nguồn được giữ trên các phần tử của package đã phản chiếu. */
export interface TypertDocumentation {
  /** Mô tả. */
  readonly description?: string;
  /** Tóm tắt. */
  readonly summary?: string;
  /** Các thẻ JSDoc. */
  readonly tags: readonly TypertDocTag[];
  /** JSDoc gốc. */
  readonly jsDoc?: string;
}

/** MỘT chữ ký thành viên công khai đã sinh. */
export interface TypertMemberModel {
  /** Loại thành viên. */
  readonly kind: "property" | "method" | "getter" | "setter" | "call" | "construct" | "index";
  /** Tên thành viên. */
  readonly name: string;
  /** Chữ ký. */
  readonly signature: string;
  /** Tóm tắt. */
  readonly summary?: string;
  /** JSDoc gốc. */
  readonly jsDoc?: string;
}

/** MỘT khai báo kiểu có tên được bề mặt nghiệp vụ đã phản chiếu tham chiếu. */
export interface TypertTypeModel {
  /** Tên kiểu. */
  readonly name: string;
  /** Khai báo. */
  readonly declaration: string;
}

/** Siêu dữ liệu reflection lúc chạy cho MỘT service Cordis. */
export interface TypertServiceModel extends TypertDocumentation {
  /** Khoá service. */
  readonly key: string;
  /** Tên export. */
  readonly exportName: string;
  /** Các thành viên. */
  readonly members: readonly TypertMemberModel[];
  /** Các kiểu. */
  readonly types: readonly TypertTypeModel[];
}

/** Siêu dữ liệu reflection lúc chạy cho MỘT sự kiện Cordis. */
export interface TypertEventModel extends TypertDocumentation {
  /** Tên sự kiện. */
  readonly name: string;
  /** Chế độ (nếu có). */
  readonly mode?: string;
  /** Chữ ký. */
  readonly signature: string;
}

/** Siêu dữ liệu reflection lúc chạy cho MỘT đối tượng tham chiếu được xuất tường minh. */
export interface TypertObjectModel extends TypertDocumentation {
  /** Tên. */
  readonly name: string;
  /** Tên export. */
  readonly exportName: string;
  /** Các thành viên. */
  readonly members: readonly TypertMemberModel[];
  /** Các kiểu. */
  readonly types: readonly TypertTypeModel[];
}

/** Reflection nghiệp vụ đã sinh cho MỘT package trên MỘT phía. */
export interface TypertPackageModel {
  /** Các service. */
  readonly services: readonly TypertServiceModel[];
  /** Các sự kiện. */
  readonly events: readonly TypertEventModel[];
  /** Các đối tượng. */
  readonly objects: readonly TypertObjectModel[];
}

/** MỘT nhà máy schema Zod đã sinh. */
export interface TypertSchemaFactory {
  /** Tên schema. */
  readonly name: string;
  /**
   * Hiện thực hoá và trả schema của realm tiến trình ngay lần dùng đầu.
   * Nhận: không.
   * Trả: schema Zod.
   */
  readonly create: () => $ZodType;
}

/** MỘT đóng góp của package đã sinh, được đăng ký và thu hồi NGUYÊN TỬ. */
export interface TypertContribution {
  /** Tên package đóng góp. */
  readonly package: string;
  /** Phía đóng góp. */
  readonly face: TypertFace;
  /** Các nhà máy schema. */
  readonly schemas: readonly TypertSchemaFactory[];
  /** Mô hình reflection của package. */
  readonly model: TypertPackageModel;
  /** Định nghĩa lời gọi Host; rỗng khi package không xuất phương thức Remote nào. */
  readonly invocations: readonly InvocationDescriptor[];
}

/** MỘT schema đang sống kèm danh tính đóng góp của nó. */
export interface TypertSchemaRecord {
  /** Tên schema. */
  readonly name: string;
  /** Schema Zod đã hiện thực hoá. */
  readonly schema: $ZodType;
  /** Package đóng góp. */
  readonly package: string;
  /** Phía đóng góp. */
  readonly face: TypertFace;
  /** Khoá toàn cục `<package>#<name>`. */
  readonly key: string;
}

/** MỘT mô hình package đã sinh đang sống kèm danh tính ổn định. */
export interface TypertPackageRecord {
  /** Package. */
  readonly package: string;
  /** Phía. */
  readonly face: TypertFace;
  /** Khoá `<package>#<face>`. */
  readonly key: string;
  /** Mô hình reflection. */
  readonly model: TypertPackageModel;
}

/** Bộ lọc khi liệt kê schema. */
export interface TypertSchemaFilter {
  /** Chỉ package này. */
  readonly package?: string;
  /** Chỉ phía này. */
  readonly face?: TypertFace;
}

/** Bộ lọc khi liệt kê mô hình package. */
export interface TypertPackageFilter {
  /** Chỉ package này. */
  readonly package?: string;
  /** Chỉ phía này. */
  readonly face?: TypertFace;
}
