/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat plugin cua row ui-goal: dang ky chieu lenh, tu dien, ba slot va bon dong tu bien doi goal
 */
import { createGoalActivationSource, type GoalProjection, type GoalView, type HostObservable } from "./activation-source.ts";
import { createGoalComponents, type GoalBarActions, type GoalDockProps, type GoalPrimitives, type GoalReact } from "./goal-bar.ts";
import { createGoalCommandInputView, goalCommandInputDefinition, type GoalCommandInputViewProps } from "./goal-command-input.ts";
import { createGoalCommandReference, goalCommandReferenceRule } from "./goal-command-reference.ts";
import { DOCK_ID, DOCK_ORDER, EFFECT, INJECT, NO_CURRENT_GOAL, NS, PACKAGE_NAME, SLOT_KEYS, STYLE_TAGS, USER_TEXT_RULE_PRIORITY } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** CSS của hai module, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_GOAL_BAR_CSS__: string;
declare const __GBH_GOAL_VIEW_CSS__: string;

/** Nguồn chỉ đọc một giá trị của phiên. */
interface Readable<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
  /** Đăng ký người nghe; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
}

/** Ảnh chụp phiên mà phần kích hoạt đọc. */
interface SessionSnapshot {
  /** Phiên đang chạy hay không. */
  readonly running: boolean;
  /** Trạng thái mở lịch sử. */
  readonly openState: string;
  /** Lỗi khi mở lịch sử thất bại. */
  readonly openError?: Error;
}

/** Mặt phiên mà bảng phiên trả về. */
interface SessionFace extends Readable<SessionSnapshot> {
  /** Kho projection của phiên. */
  readonly projections: { faceOf: (name: string) => Readable<GoalProjection> };
}

/** Một mối nối phiên. */
interface Binding {
  /** Mặt phiên. */
  readonly session: SessionFace;
}

/** Tham chiếu phiên đang được giữ sống trong một lần dùng. */
interface SessionReference {
  /** Mối nối của tham chiếu. */
  readonly binding: Binding;
}

/** Kết quả một lần gọi Remote. */
interface RemoteResult<T> {
  /** true khi Host nhận. */
  readonly ok: boolean;
  /** Giá trị khi thành công. */
  readonly value?: T;
  /** Lỗi khi thất bại. */
  readonly error: { readonly code: string; readonly message: string };
}

/** Tham chiếu CAS của một mục tiêu. */
interface GoalRef {
  /** Id mục tiêu. */
  readonly id: string;
  /** Revision. */
  readonly revision: number;
}

/** Bốn động từ biến đổi của Remote goals. */
interface GoalsRemote {
  /** Đọc goal sống của phiên. */
  get: (sessionId: string) => Promise<RemoteResult<GoalView | undefined>>;
  /** Thay objective theo CAS. */
  edit: (sessionId: string, ref: GoalRef, patch: { readonly objective: string }) => Promise<RemoteResult<unknown>>;
  /** Tạm dừng theo CAS. */
  pause: (sessionId: string, ref: GoalRef) => Promise<RemoteResult<unknown>>;
  /** Tiếp tục theo CAS. */
  resume: (sessionId: string, ref: GoalRef) => Promise<RemoteResult<unknown>>;
  /** Xoá theo CAS. */
  clear: (sessionId: string, ref: GoalRef) => Promise<RemoteResult<unknown>>;
}

/** Ngữ cảnh gốc phía client; chỉ khai những gì row này thật sự dùng. */
interface ClientCtx {
  /** Đăng ký hiệu ứng vòng đời. */
  effect: (callback: () => void | (() => void), label: string) => void;
  /** Đăng ký người nghe sự kiện của ctx. */
  on: (event: string, listener: () => void) => () => void;
  /** Từ điển của giao diện. */
  locale: { register: (ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }) => () => void };
  /** Bảng phiên. */
  sessions: {
    binding: (sessionId: string) => Binding | undefined;
    using: (sessionId: string, options: { readonly source: string }, run: (reference: SessionReference) => Promise<unknown>) => Promise<unknown>;
  };
  /** Kênh Remote. */
  remote: {
    $on: (event: string, handler: (payload: { readonly sessionId: string; readonly goal: GoalView | undefined }) => void) => () => void;
    goals: GoalsRemote;
  };
  /** Sổ slot. */
  slots: {
    inject: (name: string, register: () => void) => void;
    register: (options: { readonly name: string } & Record<string, unknown>, component: unknown) => void;
  };
  /** Mặt hội thoại: chỗ đăng ký chiếu node và rule văn bản. */
  uiConversation: {
    events: { register: (definition: unknown) => void };
    userText: { register: (rule: unknown) => void };
  };
}

/** Mặt plugin mà Loader nhận. */
export interface ClientPlugin {
  /** Tên package. */
  readonly name: string;
  /** Seam cần có. */
  readonly inject: readonly string[];
  /** Thân plugin. */
  apply: (ctx: ClientCtx) => void;
}

/**
 * Chèn một thẻ style nếu chưa có.
 * Nhận: id gắn vào `data-plugin-css` và văn bản CSS.
 * Trả: không có.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/** Chèn CSS của cả hai module, đúng thứ tự như bản gốc. */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.bar, typeof __GBH_GOAL_BAR_CSS__ === "string" ? __GBH_GOAL_BAR_CSS__ : "");
  injectStyle(STYLE_TAGS.view, typeof __GBH_GOAL_VIEW_CSS__ === "string" ? __GBH_GOAL_VIEW_CSS__ : "");
}

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dựng element nhiều con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
}

/** Module `react`: hook + `memo`. KHÔNG có `jsx`/`jsxs` — chúng ở `react/jsx-runtime`. */
interface ReactHooks {
  /** Trạng thái cục bộ. */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** Ô nhớ. */
  useRef: <T>(initial: T) => { current: T };
  /** Hiệu ứng vòng đời. */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
  /** Gói hàm nhớ. */
  useCallback: <T>(callback: T, deps: unknown[]) => T;
  /** Ghi nhớ component. */
  memo: <T>(component: T) => T;
}

/** Cờ phạm vi MODULE: đã cài xong một lần thì các ctx sau không đăng ký lại (bản gốc cũng vậy).
 * Chỉ bật SAU khi mọi đăng ký thành công — nếu ném giữa đường thì lần sau vẫn phải đăng ký lại đủ. */
let installed = false;
/**
 * Dựng mặt plugin của row ui-goal.
 * Nhận: hàm `require` của bảng module trang.
 * Trả: mặt plugin mà Loader gọi `apply` trên đó.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const { jsx, jsxs } = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactHooks;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as GoalPrimitives;
  injectStyles();
  const shell: GoalReact = { jsx, jsxs, useState: react.useState, useRef: react.useRef, useEffect: react.useEffect, useCallback: react.useCallback };
  const { GoalBar, GoalDock } = createGoalComponents(shell, primitives);
  const GoalCommandInputView = createGoalCommandInputView({ jsx, jsxs, memo: react.memo });
  const GoalCommandReference = createGoalCommandReference({ jsx }, primitives);

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Thân plugin: dải GoalBar trong dock soạn tin kèm bốn động từ biến đổi.
     * Nhận: ngữ cảnh gốc phía client.
     * Trả: không có.
     */
    apply(ctx: ClientCtx): void {
      if (installed) return;
      ctx.uiConversation.events.register(goalCommandInputDefinition);
      ctx.uiConversation.userText.register(goalCommandReferenceRule);
      ctx.effect(
        () =>
          ctx.locale.register(NS, { vi,
            zh,
            en,
          }),
        EFFECT.dictionaries,
      );
      ctx.slots.inject("conversation.user.text.node", () =>
        ctx.slots.register(
          {
            name: "conversation.user.text.node",
            key: SLOT_KEYS.userTextNode,
            priority: USER_TEXT_RULE_PRIORITY,
          },
          GoalCommandReference,
        ),
      );
      ctx.slots.inject("conversation.chat.node", () =>
        ctx.slots.register(
          {
            name: "conversation.chat.node",
            key: SLOT_KEYS.chatNode,
            locale: NS,
          },
          GoalCommandInputView as (props: GoalCommandInputViewProps) => unknown,
        ),
      );
      const sessions = ctx.sessions;
      /**
       * Tham chiếu CAS hiện tại của phiên, đọc ngay lúc gọi động từ (không có hàng rào cũ: CAS của
       * RPC mới là chỗ chặn).
       * Nhận: id phiên.
       * Trả: tham chiếu, hoặc undefined khi phiên chưa chiếu ra goal.
       */
      const refOf = (sessionId: string): GoalRef | undefined => {
        const projection = sessions.binding(sessionId)?.session.projections.faceOf("goal")?.getSnapshot();
        if (projection === null || projection === undefined) return undefined;
        return { id: projection.goal.id, revision: projection.goal.revision };
      };
      const noCurrentGoal = { ok: false, error: { code: NO_CURRENT_GOAL.code, message: NO_CURRENT_GOAL.message } };
      ctx.slots.inject("conversation.input.dock", () =>
        ctx.slots.register(
          {
            name: "conversation.input.dock",
            id: DOCK_ID,
            order: DOCK_ORDER,
            locale: NS,
            /**
             * Dựng mặt nghiệp vụ cho occupant của một phiên.
             * Nhận: id phiên.
             * Trả: hook kích hoạt và bốn động từ biến đổi.
             */
            inject: (sessionId: string) => {
              const binding = sessions.binding(sessionId);
              if (binding === undefined) throw new Error('ui-goal: session "' + sessionId + '" is unavailable');
              return {
                hooks: {
                  goalActivation: createGoalActivationSource({
                    projection: binding.session.projections.faceOf("goal"),
                    session: binding.session,
                    getGoal: async (): Promise<RemoteResult<GoalView | undefined>> => {
                      if (sessions.binding(sessionId) !== binding) {
                        throw new Error('ui-goal: session "' + sessionId + '" is unavailable');
                      }
                      return (await sessions.using(
                        sessionId,
                        { source: "goalActivation" },
                        async (reference: SessionReference) => {
                          const state = reference.binding.session.getSnapshot();
                          if (state.openState !== "open") {
                            throw state.openError ?? new Error('session "' + sessionId + '" is not open');
                          }
                          return ctx.remote.goals.get(sessionId);
                        },
                      )) as RemoteResult<GoalView | undefined>;
                    },
                    subscribeActivation: (listener: (goal: GoalView | undefined) => void) =>
                      ctx.remote.$on("goal/activation-changed", (event) => {
                        if (event.sessionId === sessionId) listener(event.goal);
                      }),
                    subscribeReset: (listener: () => void) => ctx.on("connection/reset", listener),
                  }) as HostObservable<{ readonly id?: string; readonly revision?: number; readonly activation?: string }>,
                },
                onEdit: async (objective: string): Promise<{ readonly ok: boolean; readonly error: { readonly code: string; readonly message: string } }> => {
                  const ref = refOf(sessionId);
                  if (ref === undefined) return noCurrentGoal;
                  return await ctx.remote.goals.edit(sessionId, ref, { objective });
                },
                onPause: async () => {
                  const ref = refOf(sessionId);
                  if (ref === undefined) return noCurrentGoal;
                  return await ctx.remote.goals.pause(sessionId, ref);
                },
                onResume: async () => {
                  const ref = refOf(sessionId);
                  if (ref === undefined) return noCurrentGoal;
                  return await ctx.remote.goals.resume(sessionId, ref);
                },
                onClear: async () => {
                  const ref = refOf(sessionId);
                  if (ref === undefined) return noCurrentGoal;
                  return await ctx.remote.goals.clear(sessionId, ref);
                },
              };
            },
          },
          GoalDock as (props: GoalDockProps) => unknown,
        ),
      );
      installed = true;
    },
  };
}
