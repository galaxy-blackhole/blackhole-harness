/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai báo MIỀN workspace (bản gốc: lib/types/spec.js): schema bản ghi + spec mà sổ đăng ký mở
 *      qua `ctx.storageDomain`. Schema zod kiểm định dạng đã ship ở RANH GIỚI BỀN và là nguồn trực
 *      tiếp của một phép chiếu wire sau này.
 */
// Nạp qua "zod/v4" (quy ước repo): có một ambient shim `declare module "zod"` ở
// `packages/client/ui-sidebar-right/src/externals.d.ts` che mất kiểu thật khi tsc đọc CẢ chương trình
// (đo được 18/10/2026: `.transform`/`.default` "không tồn tại" nếu nạp "zod" trần).
import { z } from "zod/v4";

import type { SessionId, WorkspaceId } from "./types.ts";

/**
 * Thương hiệu lúc biên dịch cho id phiên — hàm ĐỒNG NHẤT, đúng như `brandString` của kernel.
 * Nhận: chuỗi mà miền sở hữu thương hiệu nhận.
 * Trả: CHÍNH chuỗi đó, mang thương hiệu `SessionId` lúc biên dịch.
 */
function brandSessionId(value: string): SessionId {
  return value as SessionId;
}

/** Schema id workspace ở ranh giới bền; thương hiệu không có biểu diễn lúc chạy nên chỉ là chuỗi. */
const workspaceIdSchema = z.string().transform((value) => value as WorkspaceId);

/** Schema id phiên ở ranh giới bền. */
const sessionIdSchema = z.string().transform(brandSessionId);

/**
 * Hình dạng TỐI THIỂU của một schema bản ghi mà tầng miền gọi: ĐÚNG hai phép nó dùng (`parse`,
 * `safeParse`). Khai theo CẤU TRÚC để kiểu của gói không phụ thuộc việc chương trình `tsc` có MỘT
 * hay NHIỀU bản `zod` đang mở (đo được: hai bản ⇒ `z.infer` thoái hoá thành `any` và lỗi lan
 * sang các callback ở tệp khác).
 */
export interface SchemaLike<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị.
   * Nhận: giá trị chưa biết (đọc từ môi trường lưu).
   * Trả: giá trị đúng kiểu; NÉM `ZodError` khi không hợp lệ.
   */
  parse(value: unknown): T;
  /**
   * Kiểm KHÔNG ném.
   * Nhận: giá trị chưa biết.
   * Trả: `{ success: true }` hoặc `{ success: false }`.
   */
  safeParse(value: unknown): { success: boolean };
}

/**
 * Hình dạng BỀN của một bản ghi workspace. `path` là chuẩn `fs.realpath` đóng dấu lúc tạo;
 * `sessionIds` là sổ sở hữu CÓ THỨ TỰ (thứ tự mảng là thứ tự hiển thị); hai mốc là chuỗi ISO-8601.
 */
export interface WorkspaceRecord {
  /** Đường dẫn thư mục đã chuẩn tắc (chuẩn duy nhất về tính duy nhất của gói). */
  path: string;
  /** Tiêu đề hiển thị; trùng giữa các workspace được phép. */
  title: string;
  /** Sổ sở hữu phiên, theo thứ tự hiển thị. */
  sessionIds: SessionId[];
  /** Mốc tạo ISO-8601, không bao giờ viết lại. */
  createdAt: string;
  /** Mốc thay đổi bền gần nhất, ISO-8601. */
  updatedAt: string;
}

/** Schema zod kiểm {@link WorkspaceRecord} ở ranh giới bền. */
export const workspaceRecord: SchemaLike<WorkspaceRecord> = z.object({
  path: z.string(),
  title: z.string(),
  sessionIds: z.array(sessionIdSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
}) as unknown as SchemaLike<WorkspaceRecord>;

/**
 * Dấu của một lượt thay đổi HAI-LẦN có thể phục hồi. Dấu được ghi BỀN trước khi cặp bản ghi/thứ tự kịp
 * lệch nhau, nên lúc khởi động phân biệt được một lượt bị ngắt giữa đường với hỏng môi trường lưu
 * không giải thích được.
 */
const workspacePendingMutation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), workspaceId: workspaceIdSchema }),
  z.object({ operation: z.literal("delete"), workspaceId: workspaceIdSchema }),
]);

/**
 * Trạng thái BỀN của sổ đăng ký:
 * · `initialized` phân biệt một sổ RỖNG hợp lệ với một sổ còn phải chạy lượt gieo lịch sử CHỈ-TỪ-HEADER;
 * · `workspaceIds` là thứ tự hiển thị CÓ THẨM QUYỀN;
 * · `archivedSessionIds` là sổ lưu trữ TOÀN SỔ phủ lên sổ sở hữu — phiên đã lưu trữ GIỮ ô `sessionIds`
 *   (bỏ lưu trữ phải trả lại đúng vị trí), nên sổ này không bao giờ tham gia bất biến MỘT-CHỦ;
 * · `pinnedSessionIds` là sổ ghim TOÀN SỔ theo thứ tự ghim (ghim gần nhất đứng đầu); ghim và lưu trữ
 *   LOẠI TRỪ NHAU, nên lượt lưu trữ bỏ luôn ghim của phiên.
 * Hai sổ phiên có giá trị mặc định để bản ghi ghi TRƯỚC khi có hai trường này vẫn đọc được nguyên vẹn.
 */
export interface WorkspaceDomainState {
  /** Đã chạy xong lượt gieo lịch sử chưa (dấu đóng MỘT LẦN và vĩnh viễn). */
  initialized: boolean;
  /** Danh tính workspace dùng-lần-đầu, GIỮ LẠI kể cả sau khi bản ghi của nó bị xoá. */
  defaultWorkspaceId?: WorkspaceId;
  /** Thứ tự hiển thị CÓ THẨM QUYỀN. */
  workspaceIds: WorkspaceId[];
  /** Sổ lưu trữ toàn sổ, theo thứ tự lưu trữ. */
  archivedSessionIds: SessionId[];
  /** Sổ ghim toàn sổ, ghim gần nhất đứng đầu. */
  pinnedSessionIds: SessionId[];
  /** Dấu của lượt thay đổi hai-lần đang dở (nếu có). */
  pendingMutation?: { operation: "create" | "delete"; workspaceId: WorkspaceId };
}

/** Schema zod kiểm {@link WorkspaceDomainState} ở ranh giới bền (hai sổ phiên có giá trị mặc định). */
export const workspaceDomainState: SchemaLike<WorkspaceDomainState> = z.object({
  initialized: z.boolean(),
  defaultWorkspaceId: workspaceIdSchema.optional(),
  workspaceIds: z.array(workspaceIdSchema),
  archivedSessionIds: z.array(sessionIdSchema).default([]),
  pinnedSessionIds: z.array(sessionIdSchema).default([]),
  pendingMutation: workspacePendingMutation.optional(),
}) as unknown as SchemaLike<WorkspaceDomainState>;

/** Tên đơn vị của môi trường lưu: chữ thường đầu, rồi chữ thường/số/gạch dưới — cùng quy ước của kho. */
const UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/;

/** Hình dạng TỐI THIỂU của một khai báo miền mà {@link declareWorkspaceDomain} cần đọc. */
interface DomainShape {
  /** Tên miền. */
  readonly name: string;
  /** Phiên bản định dạng. */
  readonly version: number;
  /** Ô singleton toàn cục (tuỳ chọn). */
  readonly global?: { readonly schema: { safeParse(value: unknown): { success: boolean } }; readonly initial: unknown };
  /** Các bảng đã khai. */
  readonly tables: Record<string, unknown>;
}

/**
 * Trợ giúp DANH TÍNH của khai báo miền: ghim kiểu literal và KIỂM các trường ngay lúc NẠP MODULE, trước
 * khi chạm môi trường lưu. Bốn điều kiện của kho: tên miền và tên bảng khớp {@link UNIT_NAME_RE}; phiên
 * bản là số nguyên không âm; schema global KHÔNG được nhận `null`.
 *
 * Vì sao từ chối `null`: backend giữ ô global như JSON ĐỤC với `null` là dấu "chưa từng ghi", nên một
 * global nhận `null` sẽ không phân biệt được với global VẮNG khi mở lại (một `null` đã lưu lặng lẽ
 * quay về `initial`).
 * Nhận: khai báo miền cần kiểm.
 * Trả: CHÍNH spec đó (đã hẹp kiểu literal); NÉM khi cấu hình sai.
 */
function declareWorkspaceDomain<S extends DomainShape>(spec: S): S {
  if (!UNIT_NAME_RE.test(spec.name)) throw new Error(`workspace domain name '${spec.name}' must match ${String(UNIT_NAME_RE)}`);
  if (!Number.isInteger(spec.version) || spec.version < 0) {
    throw new Error(`workspace domain '${spec.name}' version must be a non-negative integer, got ${String(spec.version)}`);
  }
  for (const table of Object.keys(spec.tables)) {
    if (!UNIT_NAME_RE.test(table)) throw new Error(`workspace domain '${spec.name}' table name '${table}' must match ${String(UNIT_NAME_RE)}`);
  }
  if (spec.global !== undefined && spec.global.schema.safeParse(null).success) {
    throw new Error(
      `workspace domain '${spec.name}' global schema must not accept null: null is the medium's "never written" sentinel`,
    );
  }
  return spec;
}

/**
 * Spec của miền workspace: MỘT bảng `workspaces` khoá bằng {@link WorkspaceId} cộng ô singleton
 * gieo-lịch-sử/thứ tự. Sổ đăng ký mở spec này qua `ctx.storageDomain`; spec là nguồn DUY NHẤT của
 * danh tính, phiên bản, và schema của miền.
 */
export const workspaceDomainSpec = declareWorkspaceDomain({
  name: "workspace",
  version: 2,
  global: {
    /** Kiểm ô global đã lưu ở ranh giới bền. */
    schema: workspaceDomainState,
    initial: {
      initialized: false,
      workspaceIds: [],
      archivedSessionIds: [],
      pinnedSessionIds: [],
    },
  },
  tables: { workspaces: { valueSchema: workspaceRecord } },
});