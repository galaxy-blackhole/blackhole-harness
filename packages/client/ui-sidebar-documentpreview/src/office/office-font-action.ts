/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chi lo phan chi tiet font cho diep khuc Office dang nap xong
 */

import { createFontNotice } from "./font-notice.ts";
import type { OfficeTabView } from "./store.ts";

/**
 * Dung nut canh bao font cho thanh cong cu cua tab Office.
 * Nhan: FontNotice — canh bao font da dung.
 * Tra: component nhan props cua slot hanh dong.
 */
export function createOfficeFontAction(FontNotice: (props: { fonts: readonly string[]; t: (key: string, params?: Record<string, string | number>) => string }) => unknown): (props: {
  /** Noi dung dang giao cho than tai lieu. */
  content: { kind: string; revision: number };
  /** Bo doc thong tin tab. */
  useTabInfo: () => { tab: { id: string } };
  /** Bo doc store Office. */
  useStore: <T>(selector: (state: { byTab: Record<string, OfficeTabView> }) => T) => T;
  /** Ham dich cua namespace Office. */
  t: (key: string, params?: Record<string, string | number>) => string;
}) => unknown {
  return function OfficeFontAction({ content, useTabInfo, useStore, t }) {
    const { tab } = useTabInfo();
    const held = useStore((state) => state.byTab[tab.id]);
    if (content.kind !== "renderer" || held?.revision !== content.revision || held.file === undefined) return null;
    return FontNotice({ fonts: held.file.missingFonts, t });
  };
}
