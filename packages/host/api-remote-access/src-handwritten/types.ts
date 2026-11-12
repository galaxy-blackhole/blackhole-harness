/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng điều khiển truy cập mức PHƯƠNG THỨC: hành động, vai, ràng buộc, chính sách, yêu cầu quyết
 *      định, và dòng ảnh chụp quyền — bản viết lại 1:1 lib/types/types.d.ts của
 *      `@deepseek-ai/dsh-api-remote-access`.
 */

import type { Principal, RemoteAccessResource, RemoteAccessResourceKind, RemoteAccessResourceOf } from "@deepseek-ai/dsh-typert-protocol";

export type {
  RemoteAccessResource,
  RemoteAccessResourceKind,
  RemoteAccessResourceOf,
} from "@deepseek-ai/dsh-typert-protocol";

/** Điểm cuối Remote chuẩn `<namespace>/<method>`; hai đoạn KHÔNG bao giờ chứa dấu hai chấm. */
export type RemoteAccessEndpoint = `${string}/${string}`;

/** Một điểm cuối Remote, hoặc `event:<name>` cho MỘT sự kiện được chuyển tiếp. */
export type RemoteAccessAction = RemoteAccessEndpoint | `event:${string}`;

/** Một tập hành động có tên trên MỘT loại tài nguyên; giá trị thuần do gói nghiệp vụ sở hữu. */
export interface RemoteAccessRole<K extends RemoteAccessResourceKind> {
  /** Tên để chẩn đoán; quyết định chỉ đọc `resource` và `actions`. */
  readonly name: string;
  /** Loại tài nguyên mà mọi ràng buộc của vai này nêu. */
  readonly resource: K;
  /** Hành động vai này cho phép trên tài nguyên của ràng buộc. */
  readonly actions: readonly RemoteAccessAction[];
}

/** Câu trả lời của `decide()` và của một điều kiện. */
export type RemoteAccessDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string };

/**
 * Tinh chỉnh MỘT ràng buộc cho MỘT hành động trên tài nguyên của nó. Được gọi ĐỒNG BỘ, chỉ với ràng buộc
 * có tài nguyên khớp và vai liệt kê hành động. Nhận: hành động, tài nguyên của ràng buộc, và (khi có)
 * tham số có tên của một lời gọi cụ thể — vắng với sự kiện, ảnh chụp và lọc danh sách.
 * Trả: allow, hoặc deny kèm lý do mà lời gọi bị từ chối báo.
 */
export type RemoteAccessCondition<K extends RemoteAccessResourceKind> = (request: {
  /** Hành động đang được hỏi. */
  readonly action: RemoteAccessAction;
  /** Tài nguyên của ràng buộc. */
  readonly resource: RemoteAccessResourceOf<K>;
  /** Tham số có tên của lời gọi cụ thể, khi có. */
  readonly args?: Readonly<Record<string, unknown>>;
}) => RemoteAccessDecision;

/** Một vai trên một tài nguyên đúng loại của vai; kiểu tài nguyên suy ra từ vai. */
export type RemoteAccessBinding = {
  [K in RemoteAccessResourceKind]: {
    /** Vai áp lên tài nguyên này. */
    readonly role: RemoteAccessRole<K>;
    /** Tài nguyên mà vai áp lên. */
    readonly resource: RemoteAccessResourceOf<K>;
    /** Không có điều kiện thì ràng buộc cho phép mọi hành động mà vai liệt kê. */
    readonly condition?: RemoteAccessCondition<K>;
  };
}[RemoteAccessResourceKind];

/** MỘT câu hỏi truy cập: `principal` có được làm `action` trên `resources` không. */
export interface RemoteAccessRequest<P extends Principal> {
  /** Danh tính bên gọi. */
  readonly principal: P;
  /** Hành động đang được hỏi. */
  readonly action: RemoteAccessAction;
  /** MỌI tài nguyên mà hành động chạm tới (chỉ `global` khi không nêu tài nguyên nào). */
  readonly resources: readonly RemoteAccessResource[];
  /** Tham số có tên của lời gọi cụ thể; vắng với sự kiện, ảnh chụp và lọc danh sách. */
  readonly args?: Readonly<Record<string, unknown>>;
}

/** Luật nghiệp vụ cho MỘT loại principal không-phải-chủ. Mọi thành viên trả lời ĐỒNG BỘ từ bộ nhớ. */
export interface RemoteAccessPolicy<P extends Principal> {
  /**
   * Liệt kê các ràng buộc của principal. Gọi MỘT lần mỗi `decide()`, mỗi `allows()`, và mỗi lần tính ảnh
   * chụp; KHÔNG BAO GIỜ được nhớ đệm.
   * Nhận: bên gọi không-phải-chủ đúng loại của chính sách này.
   * Trả: mọi ràng buộc principal đang giữ.
   */
  bindings(principal: P): readonly RemoteAccessBinding[];
  /**
   * Nêu lý do cho một yêu cầu mà KHÔNG ràng buộc nào cho phép; chỉ gọi SAU khi quyết định đã là deny.
   * Nhận: yêu cầu bị từ chối.
   * Trả: lý do mà lời gọi bị từ chối báo, hoặc `undefined` nghĩa là `no-allow`.
   */
  explain?(request: RemoteAccessRequest<P>): string | undefined;
}

/** Chi tiết của MỘT lời gọi không-phải-chủ bị từ chối. */
export interface RemoteAccessDeniedDetails {
  /** Điểm cuối `<namespace>/<method>` của lời gọi bị từ chối. */
  readonly action: string;
  /** Lý do của điều kiện/`explain()`, `no-allow`, hoặc `policy-failed`. */
  readonly reason: string;
}

/** Các hành động điểm cuối mà MỘT principal được gọi trên MỘT tài nguyên. */
export interface RemoteAccessGrant {
  /** Tài nguyên được cấp. */
  readonly resource: RemoteAccessResource;
  /** Hành động điểm cuối được phép trên tài nguyên này khi KHÔNG có tham số, đã sắp xếp. */
  readonly actions: readonly string[];
}

/**
 * Một khung của `remoteAccess/follow`. Một thế hệ mở bằng ĐÚNG MỘT baseline; baseline của chủ là khung
 * DUY NHẤT của thế hệ đó.
 */
export type RemoteAccessFrame =
  | { readonly type: "baseline"; readonly owner: true }
  | { readonly type: "baseline"; readonly owner: false; readonly grants: readonly RemoteAccessGrant[] }
  | { readonly type: "upsert"; readonly grant: RemoteAccessGrant }
  | { readonly type: "remove"; readonly resource: RemoteAccessResource };

/** Khung MỞ của một thế hệ ảnh chụp. */
export type RemoteAccessBaseline = Extract<RemoteAccessFrame, { type: "baseline" }>;
