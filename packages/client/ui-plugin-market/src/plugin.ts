/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ruột nửa client của row ui-plugin-market: từ điển, bộ điều khiển và tab Discover
 */

import { createCards, type CardsApi } from "./discover-cards.ts";
import { createDiscoverSection } from "./discover-section.ts";
import { INJECT, NS, PACKAGE_NAME, SLOT_NAME } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { DiscoverController } from "./market-store.ts";
import { CSS, ensureDiscoverCss } from "./theme.ts";
import type {
  ClientContextLike,
  JsxRuntimeLike,
  MarketPlugin,
  MarketPrimitivesLike,
  ReactLike,
  SnapshotStoreLike,
} from "./types.ts";
import { vi } from "./locales-vi.ts";

/** Hàm require do bảng module cấp cho factory (gọi lúc vật chất hoá module). */
export type RequireFn = (specifier: string) => unknown;

/** Bề mặt module store của DSH mà row này require. */
export interface StoreModuleLike {
  /** Tạo một store quan sát được. */
  createSnapshotStore<T>(initial: T): SnapshotStoreLike<T>;
}

// ⚠️ CỔNG CHỐNG CÀI HAI LẦN — PHẠM VI MODULE, đặt TRƯỚC JSDoc của hàm dựng plugin.
// KHÔNG khoá theo ctx: ca thật là HAI ENTRY ⇒ HAI ctx (loader.create mỗi entry ⇒ parent.extend({fiber}) ⇒ ctx MỚI)
// nên cổng khoá-theo-ctx KHÔNG BAO GIỜ kích hoạt ⇒ apply chạy hai lần ⇒ service đã đăng ký ⇒ React #130.
let marketInstalled = false;

/**
 * Thân của apply: dựng mặt inject rồi đăng ký tab vào slot plugins.tab.
 * Nhận: ctx — context phía browser; deps — runtime, module react, bộ nguyên thuỷ và module store.
 * Trả: không.
 */
function applyInner(
  ctx: ClientContextLike,
  deps: { runtime: JsxRuntimeLike; react: ReactLike; primitives: MarketPrimitivesLike; store: StoreModuleLike },
): void {
  ensureDiscoverCss();
  const cards: CardsApi = createCards({
    runtime: deps.runtime,
    react: deps.react,
    primitives: deps.primitives,
    css: CSS,
  });
  const DiscoverSection = createDiscoverSection({
    runtime: deps.runtime,
    react: deps.react,
    primitives: deps.primitives,
    css: CSS,
    cards,
  });
  ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-plugin-market: dictionaries");
  const controller = new DiscoverController(ctx, (initial) => deps.store.createSnapshotStore(initial));
  ctx.effect(
    () => () => {
      controller.dispose();
    },
    "ui-plugin-market: controller",
  );
  ctx.effect(() => {
    const disposers = [
      ctx.remote.$on("plugin-market/changed", () => {
        controller.sourcesChanged();
      }),
      ctx.remote.$on("plugin-manager/changed", () => {
        controller.bundlesChanged();
      }),
      ctx.on("connection/reset", () => {
        controller.sourcesChanged();
      }),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "ui-plugin-market: host invalidations");
  const face = controller.face((text) => ctx.locale.resolveText(text));
  const t = ctx.locale.bind(NS);
  // ⚠️ TÊN SLOT PHẢI LÀ LITERAL ngay trong lời gọi đăng ký: check:rows đối chiếu danh sách slot với bản gốc bằng
  //   khuôn văn bản, nên tên viết qua hằng số — hoặc nằm trong chú thích — đều KHÔNG được tính (đã trả giá).
  // ⚠️ Slot kiểu LIST BẮT BUỘC có id, và id phải NGUYÊN VĂN từ bundle gốc: discover.
  //   Thiếu id thì seam ném lỗi "requires options.id" ⇒ apply ném ⇒ cả trang Plugins chết.
  ctx.slots.inject(SLOT_NAME, () =>
    ctx.slots.register(
      { name: "plugins.tab", id: "discover", label: () => t("title"), locale: NS, inject: () => face },
      DiscoverSection,
    ),
  );
}

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: requireFn — hàm nạp module của bảng module (react, react/jsx-runtime, ui-primitives, dsh-client-store).
 * Trả: plugin { name, inject, apply } mà Loader gọi apply trên đó.
 */
export function createPlugin(requireFn: RequireFn): MarketPlugin {
  const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
  const react = requireFn("react") as ReactLike;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as MarketPrimitivesLike;
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as StoreModuleLike;
  return {
    name: PACKAGE_NAME,
    inject: [...INJECT],
    /**
     * Cài row: CSS, từ điển, bộ điều khiển và tab Discover của trang Plugins.
     * Nhận: ctx — context phía browser.
     * Trả: không — lần cài thứ hai là no-op, và lỗi được IN RA rồi vẫn ném tiếp.
     */
    apply(ctx: ClientContextLike): void {
      if (marketInstalled) {
        // Hai entry ⇒ hai lần gọi trên HAI ctx; boolean phạm vi module chặn chắc lần thứ hai.
        console.warn(PACKAGE_NAME + ": bundle đã được cài, bỏ qua lần thứ hai");
        return;
      }
      try {
        applyInner(ctx, { runtime, react, primitives, store });
        // ⚠️ 18/10/2026: CỜ CHỈ BẬT SAU KHI applyInner CHẠY XONG. Bật sớm ⇒ nếu đăng ký ném giữa đường thì
        // cờ đã = true ⇒ lần cài thứ hai thoát sớm ⇒ slot không bao giờ được đăng ký lại ⇒ React #130.
        marketInstalled = true;
      } catch (error) {
        console.error(PACKAGE_NAME + ": apply ném lỗi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };
}

