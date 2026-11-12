/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Bề mặt các seed nền tảng mà nửa client nhận qua require của factory (zod · react · jsx-runtime · primitives · store)
 */

/** Hàm nạp module do bảng module của vỏ cấp cho factory (không import tĩnh gói nền tảng). */
export type RequireFn = (specifier: string) => unknown;

/** Một schema zod mà spec Remote dùng (chỉ phần bề mặt có trong bản gốc). */
export interface ZodSchemaLike {
  /** Gắn mô tả cho người đọc (nguyên văn chuỗi của bản gốc). */
  describe(text: string): ZodSchemaLike;
  /** Đánh dấu trường chỉ đọc trên đường truyền. */
  readonly(): ZodSchemaLike;
  /** Cho phép vắng mặt. */
  optional(): ZodSchemaLike;
  /** Bắt buộc có mặt. */
  nonoptional(): ZodSchemaLike;
}

/** Namespace `zod.z` — đủ hàm dựng mà spec Remote và form dùng. */
export interface ZodNamespaceLike {
  /** Object thường. */
  object(shape: Record<string, ZodSchemaLike>): ZodSchemaLike;
  /** Object nghiêm ngặt (từ chối khoá lạ). */
  strictObject(shape: Record<string, ZodSchemaLike>): ZodSchemaLike;
  /** Chuỗi. */
  string(): ZodSchemaLike;
  /** Số. */
  number(): ZodSchemaLike;
  /** Hằng chuỗi. */
  literal(value: string): ZodSchemaLike;
  /** Hợp các schema. */
  union(items: ZodSchemaLike[]): ZodSchemaLike;
  /** Mảng. */
  array(item: ZodSchemaLike): ZodSchemaLike;
}

/** Module `zod` do vỏ cấp (namespace nằm ở `z`, đúng như bản gốc require). */
export interface ZodModuleLike {
  /** Namespace dựng schema. */
  z: ZodNamespaceLike;
}
