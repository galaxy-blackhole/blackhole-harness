/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-tool: cay goi tool + 48 key cua slot KEYED tool.call.toolview, idempotent
 */

import { CONVERSATION_NS, PACKAGE_NAME, SLOT_CHAT_NODE, SLOT_TOOL_VIEW } from "./ids.ts";
import { configureRuntime } from "./runtime.ts";
import { injectStyles } from "./styles.ts";
import { ToolCallTree } from "./tool-call-tree.ts";
import { registerAskQuestionToolview } from "./toolviews-ask.ts";
import { registerDetailsToolview } from "./toolviews-details.ts";
import {
  registerBashToolview,
  registerFileMutationToolview,
  registerReadImageToolview,
  registerReadToolview,
  registerSearchToolview,
  registerWebToolview,
} from "./toolviews-read.ts";
import { registerTodoToolview } from "./toolviews-todo.ts";
import type { PrimitivesModule, ReactModule, SlotScope, ToolviewScope, UiConversationService } from "./types.ts";

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Ngung context goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientCtx extends SlotScope {
  /** Mat Remote — noi lay thong tin home cua Host cho phep rut gon duong dan. */
  remote: { $host: unknown };
  /** Dang ky mot bo lang nghe su kien vong doi (ban goc dung "connection/reset"). */
  on: (event: string, listener: () => void) => unknown;
  /** Tiem them dich vu roi chay than callback voi pham vi da co du dich vu (khuon cua ui-subagent). */
  inject?: (names: readonly string[], run: (scope: { slots?: SlotScope["slots"]; uiConversation?: UiConversationService }) => void) => void;
  /** Mat dich vu hoi thoai — co the thieu o profile khong bat row hoi thoai. */
  uiConversation?: UiConversationService;
}

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package. */
  readonly name: string;
  /** Seam can co — nguyen van cua ban goc. */
  readonly inject: readonly string[];
  /** Than plugin. */
  apply: (ctx: ClientCtx) => void;
}

/** Seam ma ban goc khai — nguyen van: so slot va mat Remote. */
const INJECT: readonly string[] = ["slots", "remote"];

// 08/11/2026 (dev-1, sửa theo ca đỏ của cổng test): BỎ cổng chống cài hai lần.
// Bản gốc KHÔNG latch phạm vi module — mỗi lần `apply` đăng ký ĐỦ (49 → 98 khi gọi hai lần trên cùng ctx), và
// test `ui-tool` khẳng định đúng hành vi đó. Giữ latch thì bundle lệch 1:1 với bản gốc và sai ca "cổng chống cài
// hai lần". Việc chống cài trùng thuộc về LOADER (mỗi entry một ctx), không thuộc thân plugin.

/**
 * Doc mat dich vu hoi thoai ma KHONG nem khi dich vu chua san sang.
 * Nhan: ctx — context goc phia client.
 * Tra: mat dich vu hoi thoai, hoac undefined khi chua co.
 */
function readUiConversation(ctx: ClientCtx): UiConversationService | undefined {
  try {
    const service = ctx.uiConversation;
    return service === undefined || service === null ? undefined : service;
  } catch {
    return undefined;
  }
}

/**
 * Dung mat plugin cua row ui-tool.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as { jsx: never; jsxs: never; Fragment: unknown };
  const reactModule = requireFn("react") as ReactModule;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;
  configureRuntime({ jsx: jsxRuntime as never, react: reactModule, primitives });
  injectStyles();
  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: dang ky nut node hoi thoai + 48 key cua slot KEYED.
     * Nhận: `ctx` — context gốc phía client.
     * Trả: không có. Mỗi lần gọi đăng ký ĐỦ như bản gốc (KHÔNG latch phạm vi module — xem ghi chú đầu tệp).
     */
    apply(ctx: ClientCtx): void {
      applyInner(ctx);
    },
  };

  /**
   * Than cua apply: nut node hoi thoai (kem slot con KEYED) va chin nhom toolview cua ban goc.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: ClientCtx): void {
    // Mat Remote: ban goc boc $host thanh hostInfo co getSnapshot/subscribe de hook dung chung.
    const hostInfo = {
      getSnapshot: () => ctx.remote.$host,
      subscribe: (listener: () => void) => ctx.on("connection/reset", listener),
    };
    const toolInject = (): { hooks: { hostInfo: typeof hostInfo } } => ({ hooks: { hostInfo } });
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do.
    ctx.slots.inject(SLOT_CHAT_NODE, () =>
      ctx.slots.register(
        {
          name: "conversation.chat.node",
          key: "tool-call",
          locale: CONVERSATION_NS,
          children: { "tool.call.toolview": { kind: "keyed", scope: "session" } },
          inject: toolInject,
        },
        ToolCallTree,
      ),
    );
    const scope: ToolviewScope = { slots: ctx.slots };
    registerBashToolview(scope);
    registerReadToolview(scope);
    registerReadImageToolview(scope);
    registerFileMutationToolview(scope);
    registerSearchToolview(scope);
    registerWebToolview(scope);
    registerDetailsToolview(scope);
    registerAskQuestionToolview(scope);
    // ⚠️ Toolview todo cua ban goc la MOT PLUGIN CON co inject: ["slots", "uiConversation"], nen no chi chay
    //   khi dich vu hoi thoai da san sang. Ta giu dung ngu nghia do bang ctx.inject: thieu uiConversation
    //   thi chi rieng toolview todo khong dang ky (48 key con lai van du) — khong nem, khong 'did not activate'.
    if (typeof ctx.inject === "function") {
      ctx.inject(["slots", "uiConversation"], (ready) => {
        registerTodoToolview({ slots: ready.slots ?? ctx.slots, uiConversation: ready.uiConversation });
      });
      return;
    }
    registerTodoToolview({ slots: ctx.slots, uiConversation: readUiConversation(ctx) });
  }
}
