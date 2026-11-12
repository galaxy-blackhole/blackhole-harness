/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua client cua row ui-settings-session-log: 2 id module + 2 slot occupant (order 90 + toast shell.overlay).
 */

import { en, zh, LOCALE_KEY } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Bang module cua bo nap — chi id trong load() moi vao bang (id cua slots.register thi KHONG). */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: unknown }): void };
}).__ModuleLoader__;

/** require do bang module cap cho factory. */
type RequireFn = (id: string) => unknown;

/** Store bat dong bo toi thieu ma seam client-store cap. */
interface SnapshotStore<T> {
  getSnapshot(): T;
  update(mutate: (state: T) => void): void;
}

/** Bang service cua seam client-store. */
interface ClientStoreModule {
  createSnapshotStore<T>(initial: T): SnapshotStore<T>;
}

/** Bang service cua seam ui-primitives (chi dung Switch). */
interface PrimitivesModule {
  Switch: unknown;
}

/** jsx runtime (React) do bang module cap. */
interface JsxRuntime {
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Form cau hinh cua Host ma row nay ghi vao. */
interface ConfigForm {
  set(field: string, value: unknown): Promise<boolean>;
}

/** Context phia browser (chi khai phan row nay dung). */
interface ClientContext {
  effect(callback: () => void | (() => void)): void;
  locale: { register(key: string, copy: Record<string, unknown>): () => void };
  slots: {
    register(definition: Record<string, unknown>, component: unknown): () => void;
    inject(slot: string, register: () => unknown): void;
  };
  configForms: {
    get(namespace: string): ConfigForm;
    whileServed(namespaces: readonly string[], register: () => unknown): void;
  };
}

/** Trang thai cua lan ghi gan nhat. */
interface UploadState {
  busy: boolean;
  notice: "saved" | "failed" | null;
  sequence: number;
}

/** Ten lop CSS (xem UploadRow.module.css). */
const CLASS = { row: "row", title: "title", description: "description" } as const;

/** Tien to id plugin de gan data-plugin-css. */
const PLUGIN = "@galaxy-blackhole/gbh-client-ui-settings-session-log";

/** Namespace form cua Host — giu nguyen nhu ban goc. */
const FORM_NAMESPACE = "session-log-gbh";

/** Slot occupant id cua toast (KHONG phai id module). */
const TOAST_OCCUPANT = "session-log-upload-toast";

/** CSS cua row. */
const CSS_TEXT =
  ".row{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}" +
  ".title{font-size:14px;line-height:20px}" +
  ".description{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}";

/**
 * Chen CSS cua row vao document mot lan.
 * @param cssText - noi dung CSS.
 * @param tagId - id gan vao data-plugin-css de khong chen hai lan.
 */
function injectCss(cssText: string, tagId: string): void {
  if (typeof document === "undefined") return;
  for (const existing of document.querySelectorAll<HTMLElement>('style[data-plugin-css]')) {
    if (existing.dataset.pluginCss === tagId) return;
  }
  const tag = document.createElement("style");
  tag.dataset.plugin = PLUGIN;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * So thich upload cua nguoi dung: ghi vao form cua Host roi cong bo ket qua.
 * KHONG publish trang thai lac quan: gia tri dang hien giu nguyen neu ghi hong (dung y ban goc).
 */
class UploadPreference {
  private readonly form: ConfigForm;
  /** Store quan sat duoc cho UI. */
  readonly state: SnapshotStore<UploadState>;

  /**
   * @param form - form cau hinh cua Host.
   * @param createStore - ham tao snapshot store tu seam client-store.
   */
  constructor(form: ConfigForm, createStore: ClientStoreModule["createSnapshotStore"]) {
    this.form = form;
    this.state = createStore<UploadState>({ busy: false, notice: null, sequence: 0 });
  }

  /**
   * Ghi trang thai bat/tat va thong bao ket qua sau khi ghi xong.
   * @param enabled - trang thai nguoi dung yeu cau.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (this.state.getSnapshot().busy) return;
    this.state.update((state) => {
      state.busy = true;
      state.notice = null;
    });
    let accepted = false;
    try {
      accepted = await this.form.set("enabled", enabled);
    } catch {
      accepted = false;
    }
    this.state.update((state) => {
      state.busy = false;
      state.notice = accepted ? "saved" : "failed";
      state.sequence += 1;
    });
  }

  /** Xoa thong bao dang hien. */
  dismiss(): void {
    this.state.update((state) => {
      state.notice = null;
    });
  }
}

/**
 * Tao plugin phia browser.
 * @param requireFn - ham require do bang module cap.
 * @returns doi tuong plugin { apply, inject }.
 */
// 08/11/2026 (dev-5, quy trình sửa lỗi bước 4 — sửa cho GIỐNG DSH): BỎ cờ `installed` phạm vi module.
//   DSH gốc (apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-session-log/lib/client.js
//   dòng 131-179) KHÔNG có cờ này: mỗi lần apply đăng ký lại đủ hai slot, và test của repo pin đúng
//   hành vi đó. Giữ cờ thì lần apply thứ ba trên module đã nạp KHÔNG đăng ký gì (test đỏ: 0 vs 2).
//   Sự cố 17/10/2026 (đăng ký hai lần ném lỗi) được xử lý ở tầng loader bằng một plugin instance cho mỗi
//   id module — không phải bằng cờ ở đây.

function createPlugin(requireFn: RequireFn): { apply(ctx: ClientContext): void; inject: string[] } {
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as ClientStoreModule;
  const { jsx, jsxs } = requireFn("react/jsx-runtime") as JsxRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;

  /**
   * Row trong Settings -> General: tieu de + mo ta + Switch.
   * @param props - hook upload, ham ghi, ham dich.
   * @returns element React.
   */
  function UploadRow(props: {
    useUpload: (select: (state: { enabled?: boolean }) => unknown) => { value?: { enabled?: boolean } };
    setEnabled: (enabled: boolean) => void;
    t: (key: string) => string;
  }): unknown {
    const upload = props.useUpload((state) => state);
    return jsxs("div", {
      className: CLASS.row,
      children: [
        jsxs("div", {
          children: [
            jsx("div", { className: CLASS.title, children: props.t("title") }),
            jsx("div", { className: CLASS.description, children: props.t("description") }),
          ],
        }),
        jsx(primitives.Switch, {
          checked: upload.value?.enabled === true,
          label: props.t("title"),
          onChange: (checked: boolean) => props.setEnabled(checked),
        }),
      ],
    });
  }

  /**
   * Toast trong shell.overlay: chi hien khi CO ket qua ghi (notice khac null).
   *
   * ⚠️ Truoc day toi dung tam mot primitive khac lam cho => tren app that no hien chu
   * "Could not save preference" NGAY CA KHI khong co gi de bao (tm-ui-features bat duoc bang
   * phep do A/B: 388 px lech, aria-label "Could not save preference" o phia ta, ref khong co).
   * Nay: khong co notice thi KHONG render gi ca.
   * @param props - hook mutation va ham dich.
   * @returns element React, hoac null khi khong co thong bao.
   */
  function UploadToast(props: {
    useMutation: (select: (state: UploadState) => unknown) => UploadState;
    t: (key: string) => string;
  }): unknown {
    const state = props.useMutation((current) => current);
    if (state.notice === null) return null;
    const key = state.notice === "saved" ? "saved" : "failed";
    return jsx(
      "div",
      { className: CLASS.description, role: "status", "aria-label": props.t(key), children: props.t(key) },
      state.sequence,
    );
  }

  /** Seam phia browser ma row nay can. */
  const inject = ["slots", "locale", "configForms"];

  /**
   * Dang ky locale + row Settings -> General (order 90) + toast overlay (idempotent).
   * @param ctx - context phia browser.
   */
  function apply(ctx: ClientContext): void {
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-settings-session-log: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Than cua apply: locale + row Settings + toast overlay.
   * @param ctx - context phia browser.
   */
  function applyInner(ctx: ClientContext): void {
    injectCss(CSS_TEXT, PLUGIN + "/UploadRow.module.css");
    ctx.effect(() => ctx.locale.register(LOCALE_KEY, { vi, en, zh }));
    const form = ctx.configForms.get(FORM_NAMESPACE);
    const preference = new UploadPreference(form, storeModule.createSnapshotStore.bind(storeModule));
    const face = (): Record<string, unknown> => ({
      hooks: { upload: form, mutation: preference.state },
      setEnabled: (enabled: boolean) => {
        void preference.setEnabled(enabled);
      },
      dismiss: () => {
        preference.dismiss();
      },
    });
    // 08/11/2026 (dev-5, quy trình sửa lỗi + Lead): DSH gốc BỌC slot settings.general.item trong
    //   ctx.slots.inject("settings.general.item", () => ctx.slots.register(...)) — bản ta thiếu lớp inject
    //   ⇒ slot KHÔNG bao giờ được inject nên phần cài đặt "Nhật ký phiên" không hiện.
    //   DSH: apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-session-log/lib/client.js dòng 159-166.
    ctx.effect(() =>
      ctx.configForms.whileServed([FORM_NAMESPACE], () =>
        ctx.slots.inject("settings.general.item", () =>
          ctx.slots.register(
            { name: "settings.general.item", id: FORM_NAMESPACE, order: 90, locale: LOCALE_KEY, inject: face },
            UploadRow,
          ),
        ),
      ),
    );
    ctx.slots.inject("shell.overlay", () =>
      ctx.slots.register({ name: "shell.overlay", id: TOAST_OCCUPANT, locale: LOCALE_KEY, inject: face }, UploadToast),
    );
  }

  return { apply, inject };
}

/** Factory ma bang module goi khi nap bundle. */
const factory = (requireFn: RequireFn): unknown => createPlugin(requireFn);

// id CHINH = package cua ta (de rev cua HMR tra dung dong trong manifest).
loader.load({ id: "@galaxy-blackhole/gbh-client-ui-settings-session-log", factory });
// id PHU = package goc, de bundle phu thuoc tim thay.

/** Danh dau file nay la MODULE (tranh che do script toan cuc lam dung ten voi package client khac). */
export {};
