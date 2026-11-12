/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua goi ui-brand: cap dau ho den cho slot HERO (slot sidebar do row ui-brand-official giu)
 */

import { HERO_MARK_SIZE, PACKAGE_NAME, SLOT_HERO_MARK } from "./ids";
import { createGbhLogo, GBH_LOGO_ARTWORK } from "../../ui-primitives/src/brand.ts";
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

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (recipe §2).
// KHONG khoa theo ctx: hai entry ⇒ hai ctx ⇒ cong khoa-theo-ctx khong bao gio kich hoat.
let bundleInstalled = false;

/**
 * Lay size tu props cua slot, roi ve mac dinh khi slot khong truyen.
 * Nhận: props — props slot truyen vao; fallback — kich thuoc mac dinh.
 * Trả: kich thuoc px (so nguyen duong).
 */
function sizeOf(props: Record<string, unknown>, fallback: number): number {
  return typeof props.size === "number" && Number.isFinite(props.size) ? props.size : fallback;
}

/**
 * Dung mat plugin cua goi ui-brand.
 * Nhận: requireFn — ham nap module cua bang module trang.
 * Trả: mat plugin ma Loader goi apply tren do (MOT slot hero; khong ghi de slot nao cua row khac).
 */
export function createPlugin(requireFn: (specifier: string) => unknown): ClientPlugin {
  const runtime = requireFn("react/jsx-runtime") as GbhJsxRuntime;
  const GbhLogo = createGbhLogo(runtime);
  return {
    name: PACKAGE_NAME,
    inject: ["slots"],
    /**
     * Chiem slot HERO de thay fallback CA DSH cua bundle ui-conversation bang dau ho den.
     * Nhận: ctx — context goc phia client.
     * Trả: khong co — dang ky roi tra quyen cho tang nap.
     */
    apply(ctx: ClientContext): void {
      if (bundleInstalled) {
        console.warn("gbh-client-ui-brand: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do.
        ctx.slots.inject(SLOT_HERO_MARK, () =>
          ctx.slots.register({ name: "conversation.hero.brand.mark" }, (props: Record<string, unknown>) =>
            runtime.jsx(GbhLogo, { size: sizeOf(props, HERO_MARK_SIZE) }),
          ),
        );
        // ⚠️ CO CHI BAT SAU KHI moi dang ky CHAY XONG (bat som ⇒ lan hai thoat som ⇒ slot khong bao gio dang ky lai).
        bundleInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-brand: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };
}

/** viewBox cua asset thuong hieu dang dung (de test doi chieu khong hard-code chuoi). */
export const BRAND_MARK_VIEWBOX = GBH_LOGO_ARTWORK.viewBox;
