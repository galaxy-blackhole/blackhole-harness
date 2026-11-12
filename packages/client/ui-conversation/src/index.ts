/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row ui-conversation — dang ky form cai dat busyEnter, nguyen hanh vi ban goc
 */

export {
  BUSY_ENTER_BEHAVIORS,
  BUSY_ENTER_FIELD,
  CONVERSATION_SETTINGS_NAMESPACE,
  Config,
  DEFAULT_BUSY_ENTER_BEHAVIOR,
} from "./submission-settings.ts";

/** Pham vi toi thieu ma nua host can — chi seam settings, dung nhu ban goc. */
export interface HostContext {
  /** Fiber cua plugin, ban goc chuyen thang cho settings.configure. */
  readonly fiber: unknown;
  /** Nap mot plugin con khi service can da co mat. */
  inject(names: readonly string[], run: (child: HostContext) => void): void;
  /** Dang ky mot hieu ung vong doi kem nhan chan doan. */
  effect(run: () => void, label?: string): void;
  /** Dich vu cai dat cua Host. */
  readonly settings: {
    /** Ghi tuy chon cua plugin vao tai lieu cai dat (auto=false: khong tu hien form). */
    configure(options: { auto: boolean }, fiber: unknown): void;
  };
}

/**
 * Diem vao cua Loader phia Host — NGUYEN HANH VI ban goc: khai cau hinh Conversation la
 * "chi doc" (auto=false) de Settings hien form nhung khong tu ghi de.
 * Nhan: ctx — context plugin phia Host (can seam settings).
 * Tra: khong co.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
