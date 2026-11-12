/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dữ liệu + bốn hàm khoá trạng thái của TeamAction — port 1:1 vùng TeamAction.js của bundle gốc
 *      (@deepseek-ai/dsh-experimental-client-ui-agent-team, dòng 54-87)
 */

import type { TeamKey } from "./locales.ts";

/** Runtime React tối thiểu mà component dùng (KHÔNG import react: loader cấp qua require). */
export interface TeamReact {
  /** Ô trạng thái cục bộ của một lượt render. */
  useState<S>(initial: S): [S, (next: S | ((current: S) => S)) => void];
  /** Tham chiếu bền qua các lượt render. */
  useRef<T>(initial: T): { current: T };
  /** Hiệu ứng sau khi commit. */
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Hiệu ứng trước khi vẽ (đo bố cục). */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}

/** Hàm dựng element (react/jsx-runtime: jsx cho một con, jsxs cho nhiều con). */
export type TeamJsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Thành phần primitive của DSH mà action dùng (do @galaxy-blackhole/gbh-client-ui-primitives cấp). */
export interface TeamPrimitives {
  /** Bọc tooltip cho một phần tử. */
  Tooltip: unknown;
  /** Icon người (viền). */
  IconUserOutlineRegular: unknown;
  /** Icon nhiều người (viền) — icon của nút mở bảng. */
  IconUsersOutlineRegular: unknown;
  /** Icon mũi tên xuống (viền) — nút mở rộng mô tả. */
  IconChevronDownOutlineRegular: unknown;
  /** Dot trạng thái. */
  StateDot: unknown;
  /** Nhãn nhỏ (tag). */
  Tag: unknown;
  /** Định vị bảng nổi theo nút neo; null khi chưa đo được. */
  useAnchoredPosition(options: {
    /** Bảng đang mở. */
    open: boolean;
    /** Tham chiếu nút neo. */
    anchorRef: unknown;
    /** Tham chiếu bảng. */
    panelRef: unknown;
    /** Khoảng cách tới nút. */
    gap: number;
    /** Lề so với mép màn hình. */
    margin: number;
  }): { left: number; top: number } | null;
  /** Đóng khi bấm ra ngoài (theo con trỏ). */
  useDismissOnOutsidePointer(rootRef: unknown, open: boolean, changeOpen: (next: boolean) => void, panelRef: unknown): void;
}

/** Bộ runtime mà plugin bơm vào component (react · jsx/portal · primitive). */
export interface TeamComponentRuntime {
  /** Hook React. */
  react: TeamReact;
  /** Dựng element MỘT con. */
  jsx: TeamJsx;
  /** Dựng element NHIỀU con. */
  jsxs: TeamJsx;
  /** Fragment của React. */
  Fragment: unknown;
  /** createPortal của react-dom. */
  createPortal: (children: unknown, container: unknown) => unknown;
  /** Primitive của DSH. */
  primitives: TeamPrimitives;
}

/** Pha của một thành viên trong đội. */
export type TeamMemberPhase = "active" | "provisioning" | "failed";

/** Trạng thái HIỂN THỊ của thành viên (sau khi hợp nhất với trạng thái phiên sống). */
export type TeamMemberStatus = "running" | "inactive" | "provisioning" | "failed";

/** Một thành viên trong roster (hình dạng agentTeam.members[] của projection). */
export interface TeamMember {
  /** Id phiên của thành viên. */
  readonly id: string;
  /** Tên hiển thị. */
  readonly name: string;
  /** Pha do Host báo. */
  readonly phase: TeamMemberPhase;
  /** Lỗi riêng của thành viên, nếu có. */
  readonly error?: string;
}

/** Trạng thái của một việc chia sẻ. */
export type TeamTaskStatus = "pending" | "in_progress" | "completed" | "deleted";

/** Một việc chia sẻ (hình dạng agentTeam.tasks[] của projection). */
export interface TeamTask {
  /** Id việc (hiện trong meta). */
  readonly id: string;
  /** Tiêu đề ngắn. */
  readonly subject: string;
  /** Mô tả (kẹp hai dòng tới khi mở rộng). */
  readonly description: string;
  /** Trạng thái. */
  readonly status: TeamTaskStatus;
  /** Sẵn sàng nhận việc hay chưa (chỉ có nghĩa khi pending). */
  readonly ready: boolean;
  /** Tên người nhận, nếu có. */
  readonly ownerName?: string;
  /** Các việc chặn nó. */
  readonly blockedBy: readonly string[];
  /** Vùng ghi mà việc khai. */
  readonly writeScopes: readonly string[];
  /** Cảnh báo vùng ghi. */
  readonly writeScopeWarnings: readonly string[];
}

/** Projection agentTeam của phiên lead. */
export interface TeamProjection {
  /** Thành viên trong đội. */
  readonly members: readonly TeamMember[];
  /** Việc chia sẻ. */
  readonly tasks: readonly TeamTask[];
  /** Lý do bản ghi bền không đọc được. */
  readonly failure?: string;
}

/** Hàm dịch một khoá của namespace, có thể kèm biến thay thế. */
export type TeamTranslate = (key: TeamKey, vars?: Readonly<Record<string, string>>) => string;

/** Ảnh chụp store TẤT CẢ phiên mà selector của action đọc (chỉ khai phần action này chạm). */
export interface TeamSessionStore {
  /** Ảnh chụp theo id phiên. */
  readonly byId: Record<string, { readonly running?: boolean } | undefined>;
  /** Projection theo id phiên. */
  readonly projectionsBySession: Record<string, {
    /** Giá trị projection của phiên. */
    readonly values: {
      /** Chọn model của lượt kế tiếp. */
      readonly modelSelection?: { readonly next?: { readonly model?: string } };
      /** Projection của Agent Teams. */
      readonly agentTeam?: TeamProjection;
    };
  } | undefined>;
  /** Pha tải danh sách phiên. */
  readonly phase?: string;
  /** Trạng thái sống của một phiên. */
  readonly get: (id: string) => { readonly running?: boolean } | undefined;
}

/** Ảnh chụp của MỘT phiên mà selector của action đọc. */
export interface TeamSessionSnapshot {
  /** Quan hệ cha của subagent, nếu có. */
  readonly subagent?: {
    /** Địa chỉ quan hệ cha. */
    readonly address?: {
      /** Phiên cha (lead). */
      readonly parentSessionId?: string;
    };
  };
  /** Trạng thái mở lịch sử của phiên. */
  readonly openState?: string;
}

/** Props đầy đủ của action trên header phiên hội thoại. */
export interface TeamActionProps {
  /** Phiên đang mở. */
  readonly sessionId: string;
  /** Chọn lát từ store của MỘT phiên. */
  readonly useSession: (selector: (state: TeamSessionSnapshot) => unknown) => unknown;
  /** Chọn lát từ store của TẤT CẢ phiên. */
  readonly useSessions: (selector: (state: TeamSessionStore) => unknown) => unknown;
  /** Chọn trạng thái sống của một phiên. */
  readonly useSessionStatus: (selector: (state: TeamSessionStore) => unknown) => unknown;
  /** Mở phiên của một thành viên (do plugin bơm). */
  readonly openTeammate: (sessionId: string, childSessionId: string) => void;
  /** Hàm dịch của namespace agent-team. */
  readonly t: TeamTranslate;
}

/**
 * Khoá từ điển cho trạng thái việc.
 * Nhận: status — trạng thái việc.
 * Trả: khoá từ điển tương ứng (task tombstone hiển thị như đã xong).
 */
export function statusKey(status: TeamTaskStatus): TeamKey {
  switch (status) {
    case "pending": return "status.pending";
    case "in_progress": return "status.in_progress";
    case "completed": return "status.completed";
    case "deleted": return "status.completed";
  }
}

/**
 * Khoá từ điển cho trạng thái hiển thị của thành viên.
 * Nhận: status — trạng thái hiển thị.
 * Trả: khoá từ điển tương ứng.
 */
export function memberStatusKey(status: TeamMemberStatus): TeamKey {
  switch (status) {
    case "running": return "memberStatus.running";
    case "inactive": return "memberStatus.inactive";
    case "provisioning": return "memberStatus.provisioning";
    case "failed": return "memberStatus.failed";
  }
}

/**
 * Trạng thái dot của thành viên (undefined = không vẽ dot vì đã có icon người).
 * Nhận: status — trạng thái hiển thị.
 * Trả: trạng thái dot, hoặc undefined cho inactive.
 */
export function memberDotState(status: TeamMemberStatus): string | undefined {
  switch (status) {
    case "running":
    case "provisioning": return "ongoing";
    case "failed": return "error";
    case "inactive": return undefined;
  }
}

/**
 * Trạng thái dot của việc (theo trạng thái + sẵn sàng).
 * Nhận: task — việc cần vẽ.
 * Trả: trạng thái dot cho StateDot.
 */
export function taskDotState(task: TeamTask): string {
  switch (task.status) {
    case "pending": return task.ready ? "idle" : "warning";
    case "in_progress": return "ongoing";
    case "completed": return "done";
    case "deleted": return "idle";
  }
}
