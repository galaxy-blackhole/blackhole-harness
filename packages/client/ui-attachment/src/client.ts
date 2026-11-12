/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nửa browser của row ui-attachment: đăng ký ĐÚNG MỘT id module (id của ta) và gắn 5 slot của bản gốc
 *      (conversation.input.attachments · conversation.chat.message.images · conversation.chat.user.images ·
 *      conversation.trajectory.images · tool.call.images) bằng các primitive AttachmentRail · DropOverlay ·
 *      FileCard · MessageImage. Id gói gốc KHÔNG đăng ký ở đây — nó chỉ khai ở §gbh.row.aliases§.
 */
import { PACKAGE_NAME } from "./ids.ts";
import { NS, en, zh } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Hàm require do Loader truyền vào factory (bảng module của trang). */
type RequireFn = (spec: string) => unknown;

/** Mặt tối thiểu của React mà file này dùng — không kéo cả thư viện vào kiểu của dự án. */
type ReactLike = { createElement: (type: unknown, props?: unknown, ...children: unknown[]) => unknown };

/** Mặt plugin mà Loader cài vào vỏ: §apply§ để cài, §inject§ để khai service cần có trước. */
export type PluginFace = { apply: (ctx: ClientContext) => void; inject: string[] };

/** Context phía browser mà row này cần: tầng slot + từ điển nhãn. */
export type ClientContext = {
  slots: {
    inject: (name: string, body: () => Generator<unknown, void, unknown>) => unknown;
    /** `register(spec, component)` — khuôn thật của vỏ: tham số thứ hai là component của occupant. */
    register: (spec: Record<string, unknown>, component?: unknown) => unknown;
  };
  locale: {
    bind: (ns: string) => (key: string) => string;
    /** `register(ns, bảng nhãn)` — nguồn sự thật của parity chữ. */
    register: (ns: string, labels: Record<string, unknown>) => unknown;
  };
};

/* NS + bảng nhãn nay nằm ở ./locales.ts (trùng nội dung với locale/en.json + locale/zh.json). */

/** Nhãn mặc định khi từ điển chưa có khoá (giữ chữ như bản gốc để parity chữ không lệch). */
const FALLBACK: Record<string, string> = {
  dropTitle: "Thả tệp để đính kèm",
  dropDesc: "Ảnh, tài liệu, tệp bất kỳ",
  railGroup: "Tệp đính kèm",
  railScrollLeft: "Cuộn trái",
  railScrollRight: "Cuộn phải",
  cardRemove: "Gỡ",
  cardRetry: "Thử lại",
  imageAlt: "Ảnh đính kèm",
};

/**
 * Dựng mặt plugin của row ui-attachment.
 * @param requireFn - hàm require của Loader trong trang.
 * @returns đối tượng plugin ({ apply, inject }).
 */
/* Cờ PHẠM VI MODULE: hai entry (id ta + id alias) ⇒ `createPlugin` được gọi HAI lần ⇒ cờ phải nằm ngoài
   factory, nếu không mỗi face có cờ riêng ⇒ cài hai lần ⇒ đăng ký slot trùng ⇒ renderer gặp `undefined`. */
let bundleInstalled = false;

/**
 * Dựng mặt plugin của row ui-attachment.
 * @param requireFn - hàm require của Loader trong trang.
 * @returns đối tượng plugin ({ apply, inject }).
 */
export function createPlugin(requireFn: RequireFn): PluginFace {
  const React = requireFn("react") as ReactLike;
  const h = React.createElement;

  /**
   * Nhãn theo từ điển; thiếu khoá thì rơi về chữ mặc định (không ném).
   * @param ctx - context phía browser.
   * @param key - khoá nhãn.
   * @returns chuỗi nhãn.
   */
  function label(ctx: ClientContext, key: string): string {
    try {
      const value = ctx.locale.bind(NS)(key);
      return value === "" || value === key ? (FALLBACK[key] ?? key) : value;
    } catch {
      return FALLBACK[key] ?? key;
    }
  }

  /**
   * AttachmentRail — dải tệp đính kèm cuộn ngang, có hai nút cuộn.
   * @param props - items, ctx, renderItem.
   * @returns cây phần tử React.
   */
  function AttachmentRail(props: { items: readonly { id: string }[]; ctx: ClientContext; renderItem?: (item: { id: string }) => unknown }): unknown {
    return h(
      "div",
      { className: "gbh-attachment-rail", role: "group", "aria-label": label(props.ctx, "railGroup") },
      h("button", { type: "button", className: "gbh-attachment-rail__nav", "aria-label": label(props.ctx, "railScrollLeft") }, "\u2039"),
      ...props.items.map((item) => h("div", { key: item.id, className: "gbh-attachment-rail__item" }, props.renderItem ? props.renderItem(item) : item.id)),
      h("button", { type: "button", className: "gbh-attachment-rail__nav", "aria-label": label(props.ctx, "railScrollRight") }, "\u203a"),
    );
  }

  /**
   * DropOverlay — lớp phủ khi kéo tệp vào ô soạn tin.
   * @param props - disabled, ctx.
   * @returns cây phần tử React, hoặc null khi bị tắt.
   */
  function DropOverlay(props: { disabled: boolean; ctx: ClientContext }): unknown {
    if (props.disabled) return null;
    return h(
      "div",
      { className: "gbh-attachment-drop", "data-state": "active" },
      h("div", { className: "gbh-attachment-drop__title" }, label(props.ctx, "dropTitle")),
      h("div", { className: "gbh-attachment-drop__desc" }, label(props.ctx, "dropDesc")),
    );
  }

  /**
   * FileCard — thẻ một tệp: tên, dung lượng, trạng thái, tiến độ, nút gỡ/thử lại.
   * @param props - name, bytes, state, progress, ctx, onRemove, onRetry.
   * @returns cây phần tử React.
   */
  function FileCard(props: {
    name: string;
    bytes: number;
    state: "uploading" | "ready" | "error";
    progress?: number;
    ctx: ClientContext;
    onRemove?: () => void;
    onRetry?: () => void;
  }): unknown {
    return h(
      "div",
      { className: "gbh-attachment-card", "data-state": props.state },
      h("span", { className: "gbh-attachment-card__name" }, props.name),
      h("span", { className: "gbh-attachment-card__size" }, String(props.bytes)),
      props.state === "uploading" ? h("progress", { className: "gbh-attachment-card__progress", value: props.progress ?? 0, max: 100 }) : null,
      h("button", { type: "button", className: "gbh-attachment-card__remove", onClick: props.onRemove }, label(props.ctx, "cardRemove")),
      props.state === "error"
        ? h("button", { type: "button", className: "gbh-attachment-card__retry", onClick: props.onRetry }, label(props.ctx, "cardRetry"))
        : null,
    );
  }

  /**
   * MessageImage — ảnh trong tin nhắn ở ba biến thể.
   * @param props - src, variant, ctx, alt.
   * @returns cây phần tử React.
   */
  function MessageImage(props: { src: string; variant: "single" | "tile" | "thumbnail"; ctx: ClientContext; alt?: string }): unknown {
    return h("img", {
      className: "gbh-attachment-image",
      "data-variant": props.variant,
      src: props.src,
      alt: props.alt ?? label(props.ctx, "imageAlt"),
      loading: props.variant === "thumbnail" ? "lazy" : "eager",
    });
  }

  /**
   * Thân cài đặt thật của lần cài ĐẦU TIÊN: gắn đủ 5 slot của bản gốc.
   * @param ctx - context phía browser.
   * @returns không.
   */
  function applyInner(ctx: ClientContext): void {
    /* Đăng ký từ điển TRƯỚC khi gắn slot: nhãn phải do locale quyết (parity chữ), không phải fallback trong mã.
       Bọc try riêng để từ điển hỏng KHÔNG làm mất đường đăng ký slot (bài học React #130, 18/10/2026). */
    try {
      ctx.locale.register(NS, { vi, en, zh });
    } catch (error) {
      console.warn("gbh-client-ui-attachment: khong dang ky duoc tu dien", error);
    }
    /* Khuôn thật (đối chiếu ui-reference/src/plugin.ts:427-442): register dùng CÙNG tên slot với inject, kèm
       key/priority/locale, và component là tham số thứ hai. Cổng check:rows đếm cả tên trong register, nên bịa
       tên mới ở đây là nó bắt ngay (đã bị bắt hai lần — ghi lại để người sau khỏi vấp). */
    ctx.slots.inject("conversation.input.attachments", function* () {
      yield ctx.slots.register(
        { name: "conversation.input.attachments", key: "rail", priority: 100, locale: NS },
        (props: { items?: readonly { id: string }[] }) => AttachmentRail({ items: props.items ?? [], ctx }),
      );
      /* CHỈ hiện khi ĐANG KÉO tệp. Bản đầu của tôi render thường trực ⇒ hai dòng chữ nằm trong ô soạn tin ⇒
         A/B 1024x768 FAIL 0,406% (đo 17/10/2026, .parity/shots/2026-10-17T16-41-35). Bản gốc chỉ hiện overlay
         theo trạng thái kéo, nên mặc định phải là null. */
      yield ctx.slots.register(
        { name: "conversation.input.attachments", key: "drop", priority: 90, locale: NS },
        (props: { active?: boolean; dragging?: boolean; disabled?: boolean }) =>
          props.active === true || props.dragging === true ? DropOverlay({ disabled: false, ctx }) : null,
      );
    });
    ctx.slots.inject("conversation.chat.message.images", function* () {
      yield ctx.slots.register(
        { name: "conversation.chat.message.images", key: "message-image", priority: 100, locale: NS },
        (props: { src: string }) => MessageImage({ src: props.src, variant: "single", ctx }),
      );
    });
    ctx.slots.inject("conversation.chat.user.images", function* () {
      yield ctx.slots.register(
        { name: "conversation.chat.user.images", key: "user-image", priority: 100, locale: NS },
        (props: { src: string }) => MessageImage({ src: props.src, variant: "tile", ctx }),
      );
    });
    ctx.slots.inject("conversation.trajectory.images", function* () {
      yield ctx.slots.register(
        { name: "conversation.trajectory.images", key: "trajectory-image", priority: 100, locale: NS },
        (props: { src: string }) => MessageImage({ src: props.src, variant: "thumbnail", ctx }),
      );
    });
    ctx.slots.inject("tool.call.images", function* () {
      yield ctx.slots.register(
        { name: "tool.call.images", key: "tool-image", priority: 100, locale: NS },
        (props: { src: string }) => MessageImage({ src: props.src, variant: "thumbnail", ctx }),
      );
    });
  }

  /* (cờ nằm ở PHẠM VI MODULE — xem `let bundleInstalled` ngay trước `createPlugin`) */

  /**
   * Cổng cài đặt: so identity với lần cài trước, ghi lỗi cordis nuốt rồi NÉM LẠI.
   * @param ctx - context phía browser.
   * @returns không.
   */
  function apply(ctx: ClientContext): void {
    if (bundleInstalled) {
      console.warn("gbh-client-ui-attachment: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      applyInner(ctx);
      /* CHỈ bật sau khi đăng ký XONG: nếu applyInner ném giữa đường thì cờ KHÔNG được khoá,
         nếu không lần cài thứ hai sẽ không đăng ký gì ⇒ slot rỗng ⇒ renderer gặp undefined ⇒ React #130. */
      bundleInstalled = true;
    } catch (error) {
      console.error("gbh-client-ui-attachment: apply nem loi", error);
      throw error;
    }
  }

  return { apply, inject: ["slots", "locale"] };
}

/** Bảng module của trang: CHỈ id truyền vào §load()§ mới vào bảng module. */
declare const window: { __ModuleLoader__: { load(registration: { id: string; factory: (require: RequireFn) => unknown }): void } };

/* ĐÚNG MỘT id: id CỦA TA — id gói gốc chỉ khai ở gbh.row.aliases (xem docs/recipes/HOST-ROW-REWRITE.md §8). */
window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory: createPlugin });

export {};