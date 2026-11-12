/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-brand-official — dau + ten thuong hieu Galaxy Blackhole, hai slot cua sidebar
 */

import { PACKAGE_NAME, SLOT_MARK, SLOT_NAME } from "./ids";
import { createGbhLogo, createGbhWordmark, GBH_LOGO_ARTWORK } from "../../ui-primitives/src/brand.ts";
import type { GbhJsxRuntime } from "../../ui-primitives/src/artwork-types.ts";

/** Kieu toi thieu cua context ma apply nhan (chi phan duoc dung o file nay). */
type ClientContext = {
  slots: {
    inject: (name: string, generator: () => unknown) => unknown;
    register: (spec: { name: string }, component: unknown) => unknown;
  };
};

/** Be mat plugin ma tang nap goi apply tren do. */
type ClientPlugin = { name: string; inject: readonly string[]; apply: (ctx: ClientContext) => void };

/** Kich thuoc mac dinh cua dau thuong hieu khi slot khong truyen size (nguyen van tu bundle goc: 24). */
const BRAND_MARK_SIZE = 24;

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx nen cong khoa-theo-ctx KHONG BAO GIO kich hoat.
let bundleInstalled = false;

/**
 * Dung mat plugin cua row ui-brand-official.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: (specifier: string) => unknown): ClientPlugin {
  const runtime = requireFn("react/jsx-runtime") as GbhJsxRuntime;
  // ⚠️ Asset thuong hieu lay tu goi UI-PRIMITIVES cua ta (khong con require module primitives cua DSH):
  //   FishLogo/BrandWordmark cua DSH da bi THAY bang logo ho den + chu Galaxy Blackhole (C7 P3).
  const GbhLogo = createGbhLogo(runtime);
  const GbhWordmark = createGbhWordmark(runtime);
  return {
    name: PACKAGE_NAME,
    inject: ["slots"],
    /**
     * Dang ky hai slot brand cua sidebar thanh MOT tap khai bao (dau + ten di cung nhau).
     * Nhan: ctx — context goc phia client.
     * Tra: khong co — dang ky roi tra quyen cho tang nap.
     */
    apply(ctx: ClientContext): void {
      if (bundleInstalled) {
        console.warn("gbh-client-ui-brand-official: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do.
        ctx.slots.inject(SLOT_MARK, () =>
          ctx.slots.inject(SLOT_NAME, function* () {
            yield ctx.slots.register({ name: "sidebar.brand.mark" }, (props: Record<string, unknown>) =>
              runtime.jsx(GbhLogo, {
                size: typeof props.size === "number" ? props.size : BRAND_MARK_SIZE,
              }),
            );
            yield ctx.slots.register({ name: "sidebar.brand.name" }, () => runtime.jsx(GbhWordmark, {}));
          }),
        );
        // ⚠️ CO CHI BAT SAU KHI dang ky CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi co da = true
        //   ⇒ lan cai thu hai thoat som ⇒ hai slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap undefined
        //   ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        bundleInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-brand-official: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };
}

/** viewBox cua asset thuong hieu dang duoc dung (de test doi chieu khong hard-code chuoi). */
export const BRAND_MARK_VIEWBOX = GBH_LOGO_ARTWORK.viewBox;
