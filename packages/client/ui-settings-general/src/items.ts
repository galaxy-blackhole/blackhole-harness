/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Hang "Cong cu lap trinh" cua muc General — tu DeveloperToolsRow.js 683-; HANG PHIEN BAN da XOA
 *   (yeu cau 07/11/2026: khong hien "Phien ban hien tai" trong tab Chung).
 *   11/11/2026 — SUA GOC "cong tac vo hieu": ban truoc bam KHONG doi vi props.setEnabled KHONG duoc cap
 *   (dang ky slot thieu inject). Nay port TRUNG THANH ban goc: busy trong luc ghi + dong loi
 *   developerTools.error khi Host tu choi, va THIEU ham ghi thi bao loi NGAY thay vi im lang.
 */

import type { ComponentFactory, GeneralDeps } from "./types.ts";

/** Document toi thieu (khong dung kieu DOM cua du an). */
interface DocumentLike {
  /** Tao the style. */
  createElement(name: string): { dataset: Record<string, string>; textContent: string };
  /** The head. */
  head: { appendChild(node: unknown): void };
  /** Tim the da co. */
  querySelector(selector: string): unknown;
}

/**
 * Lay document neu moi truong co (thieu thi bo qua, KHONG nem).
 * Tra: document hoac undefined.
 */
function doc(): DocumentLike | undefined {
  const host = globalThis as unknown as { document?: DocumentLike };
  return host.document;
}

/**
 * Nhung CSS mot lan cho moi tag (giong ban goc).
 * Nhan: id tag + noi dung CSS.
 */
function ensureStyle(tagId: string, css: string): void {
  const d = doc();
  if (d === undefined) return;
  if (d.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = d.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-settings-general";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  d.head.appendChild(tag);
}

/** Nhan CSS cua hang cong cu lap trinh (hash ban goc). */
const CLASS = {
  devRow: "Pt1bsG_row",
  devTitle: "Pt1bsG_title",
  devDescription: "Pt1bsG_description",
};

/** CSS hang cong cu phat trien — nguyen van ban goc (co duong ke phan cach + cong tac nam BEN PHAI). */
const DEV_CSS = ".Pt1bsG_row{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}\n.Pt1bsG_title{font-size:14px;line-height:20px}\n.Pt1bsG_description{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}\n";

/**
 * Hang bat/tat cong cu phat trien.
 * Nhan: deps va props cua renderer (useDeveloperTools/setEnabled do `inject` cua ghe cap).
 * Tra: phan tu React hop le.
 *
 * ⚠️ 11/11/2026 — SUA GOC (su co "cong tac vo hieu"): truoc day ham nay doc `props.setEnabled` nhung
 *   dang ky `settings.general.item` KHONG khai `inject` ⇒ props.setEnabled === undefined ⇒ `toggle` la
 *   NO-OP IM LANG (khong loi, khong ghi RPC). Do that: bam ⇒ aria-checked giu nguyen "true", 0 request
 *   /api/settings/** ghi, namespace ui-settings van {enabled:true, revision:0}. Ban goc
 *   (DeveloperToolsRow.js + client.js dong 1084-1087) cap `{ hooks.developerTools, setEnabled }` qua inject.
 *   Nay: (1) inject cap lai dung hai prop do (plugin.ts); (2) ham nay port trung thanh phan con lai cua ban
 *   goc — `busy` chan bam lien tuc va dong `role="alert"` hien `developerTools.error` khi Host tu choi;
 *   (3) THIEU ham ghi ⇒ bao loi NGAY (console.error + dong loi) thay vi im lang: lop loi "cong tac chet"
 *   khong con vo hinh.
 */
function developerToolsRow(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  const t = typeof props.t === "function" ? (props.t as (key: string, params?: Record<string, unknown>) => string) : deps.locale;
  const useDeveloperTools = props.useDeveloperTools;
  const enabled = typeof useDeveloperTools === "function"
    ? (useDeveloperTools as (select: (value: boolean) => boolean) => boolean)((value) => value)
    : false;
  const setEnabled = props.setEnabled;
  // Trạng thái cục bộ CÙNG thứ tự mỗi lần vẽ (busy rồi failed) — đúng bản gốc (useState ×2, dòng 692-693).
  const [busy, setBusy] = deps.react.useState(false);
  const [failed, setFailed] = deps.react.useState(false);
  const toggle = (next: boolean): void => {
    setFailed(false);
    if (typeof setEnabled !== "function") {
      // KHÔNG im lặng: đây là lỗi WIRING (thiếu inject), phải thấy được ở cả console lẫn UI.
      console.error("gbh-client-ui-settings-general: công tắc 'Công cụ lập trình' không có đường ghi — đăng ký settings.general.item phải trả setEnabled trong inject");
      setFailed(true);
      return;
    }
    setBusy(true);
    Promise.resolve((setEnabled as (next: boolean) => void | Promise<void>)(next))
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setBusy(false);
      });
  };
  // ⚠️ 18/10/2026 — PORT TRUNG THÀNH DeveloperToolsRow.js của bản gốc: dùng primitive Switch.
  const Switch = (deps.primitives as Record<string, unknown>).Switch;
  const switchControl = typeof Switch === "function"
    ? deps.runtime.jsx(Switch, { checked: enabled, disabled: busy, label: t("developerTools.title"), onChange: toggle })
    : null;
  return deps.runtime.jsxs("div", {
    className: CLASS.devRow,
    children: [
      deps.runtime.jsxs("div", {
        children: [
          deps.runtime.jsx("div", { className: CLASS.devTitle, children: t("developerTools.title") }),
          deps.runtime.jsx("div", { className: CLASS.devDescription, children: t("developerTools.description") }),
          // Bản gốc: `failed && <div role="alert">{t("developerTools.error")}</div>` (dòng 705-708).
          failed ? deps.runtime.jsx("div", { role: "alert", children: t("developerTools.error") }) : null,
        ],
      }),
      // Bản cũ: <button> + t("developerTools.toggle") — key KHÔNG tồn tại trong DSH (grep 0 file)
      // nên hiện TRẦN, và nút thay vì công tắc làm lệch bố cục (9). Nay dùng Switch như bản gốc.
      switchControl,
    ],
  });
}

/**
 * Boc an toan cho mot ghe slot: mot tinh nang phu KHONG duoc giet ca cay (luat #5).
 * Nhan: ham render.
 * Tra: ket qua render, hoac null neu render nem.
 */
function safeRender<T>(render: () => T): T | null {
  try {
    return render();
  } catch (error) {
    console.warn('gbh-client-ui-settings-general: slot render nem loi, bo qua ghe nay', error);
    return null;
  }
}

/**
 * Dung hang "Cong cu lap trinh" cua muc General — MOT hang RIENG (tach khoi hang phien ban 07/11/2026).
 *   Nhan: deps do plugin.ts cap.
 *   Tra: component hop le cho slots.register.
 *
 * ⚠️ 07/11/2026 — TRUOC DAY hai hang (phien ban + cong cu) la hai phan tu cua CUNG mot ghe, va CSS cua
 *   chung (VERSION_CSS/DEV_CSS) KHAI BAO NHUNG KHONG BAO GIO duoc nhung ⇒ hang khong co display:flex,
 *   mat duong ke phan cach va cong tac roi xuong duoi (anh chup 07/11/2026). Nay: (1) hang phien ban bi
 *   XOA han theo yeu cau; (2) CSS cua hang cong cu duoc nhung qua ensureStyle ⇒ cong tac nam BEN PHAI
 *   (justify-content:space-between) va co duong ke phan cach (border-bottom).
 */
export const createItems: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => {
    ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/DeveloperToolsRow.module.css", DEV_CSS);
    return developerToolsRow(deps, props ?? {});
  });
