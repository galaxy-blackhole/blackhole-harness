/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ruột nửa client của row ui-sidebar-files: kiểu tab §files§, phím tắt, và HAI chỗ ngồi ở sidebar phải.
 */

import { ensureFilesCss } from "./body-css.ts";
import { filesDefinition } from "./definition.ts";
import { createList, createWatch, filesFace } from "./face.ts";
import { createFilesBody } from "./files-body.ts";
import { createFilesTitle } from "./files-title.ts";
import { FILES_ID, FILES_KIND, NS, PACKAGE_NAME, SHORTCUT_ID } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { createFilesStore, type DefineStore } from "./store.ts";
import type { ClientContextLike, FilesPrimitivesLike, JsxRuntimeLike, ReactLike, RequireFn } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** Sáu service mà hai chỗ ngồi của gói này cần (nguyên văn từ bundle gốc). */
export const INJECT = ["slots", "locale", "sidebarRightTabs", "sidebarRight", "remote", "remote.workspaceFiles"];

/** Plugin phía browser do factory dựng ra. */
export interface SidebarFilesPlugin {
  /** Tên plugin — cũng là ownerId mà HMR tra §rev§. */
  name: string;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
  /** Cài plugin vào vỏ. */
  apply(ctx: ClientContextLike): void;
}

/* ⚠️ CỔNG CHỐNG CÀI HAI LẦN — PHẠM VI MODULE, đặt TRƯỚC JSDoc của createPlugin (cổng jsdoc bắt lỗi chèn giữa).
   KHÔNG khoá theo ctx: ca thật là HAI ENTRY ⇒ HAI ctx (parent.extend({fiber})), nên cổng khoá-theo-ctx KHÔNG
   BAO GIỜ kích hoạt ⇒ apply chạy hai lần ⇒ service đã đăng ký ⇒ app trắng. */
let filesInstalled = false;

/* Lưới an toàn thứ hai: một ctx đã cài xong thì không cài lại (WeakSet, không giữ ctx sống). */
const filesContexts = new WeakSet<object>();

/**
 * Dựng nửa client của row ui-sidebar-files từ require do bảng module cấp.
 * Nhận: requireFn — hàm require của bảng module (react · react/jsx-runtime · ui-primitives · dsh-client-store).
 * Trả: plugin { name, inject, apply } mà Loader cài vào vỏ.
 */
export function createPlugin(requireFn: RequireFn): SidebarFilesPlugin {
  /**
   * Thân cài đặt thật của lần cài ĐẦU TIÊN: khai kiểu tab, từ điển, phím tắt và hai chỗ ngồi.
   * Nhận: ctx — context gốc phía client.
   * Trả: không — đăng ký xong thì trả quyền cho tầng nạp.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const react = requireFn("react") as ReactLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as FilesPrimitivesLike;
    const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as { defineStore: DefineStore };
    const t = ctx.locale.bind(NS);
    ensureFilesCss();
    const FilesBody = createFilesBody(runtime, react, primitives);
    const FilesTitle = createFilesTitle(runtime, primitives);
    // Phím tắt chỉ đăng ký được khi service §shortcuts§ đã sẵn sàng ⇒ dùng inject hẹp (nguyên khuôn bản gốc),
    // KHÔNG thêm §shortcuts§ vào danh sách inject chung: thiếu nó thì cả tab chết theo.
    ctx.inject(["shortcuts"], (scoped) => {
      scoped.effect(
        () =>
          scoped.shortcuts.register({
            id: SHORTCUT_ID,
            label: () => t("guide.title"),
            aliases: ["workspace files", "files"],
            defaults: {
              "desktop:macos": { code: "KeyP", modifiers: ["primary"] },
              "desktop:windows": { code: "KeyP", modifiers: ["primary"] },
              "desktop:linux": { code: "KeyP", modifiers: ["primary"] },
              "web:macos": { code: "KeyP", modifiers: ["primary", "alt"] },
              "web:windows": { code: "KeyP", modifiers: ["primary", "alt"] },
            },
            regions: ["page", "editable", "terminal"],
            modals: [],
            resolve: ({ target }: { target: unknown }) => {
              const found = ctx.sidebarRight.commandTarget(target);
              if (found === undefined) return { status: "blocked", reason: t("shortcut.noSession") };
              return {
                status: "handled",
                run: () => {
                  ctx.sidebarRight.openTabFromTarget(FILES_KIND, found);
                },
              };
            },
          }),
        "ui-sidebar-files: shortcut",
      );
    });
    ctx.effect(() => ctx.sidebarRightTabs.register(filesDefinition(t, primitives)), "ui-sidebar-files: files type");
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-sidebar-files: dictionaries");
    const store = createFilesStore(storeModule.defineStore);
    const inject = filesFace(createList(ctx.remote), createWatch(ctx.remote));
    // ⚠️ TÊN SLOT PHẢI LÀ LITERAL trong §register({ name: "…" })§ (và cả trong §inject§): check:rows chỉ nhận
    //    dạng đó. §key§ PHẢI bằng id của kiểu tab — sidebar phải tra chỗ ngồi theo §definition?.id ?? tab.kind§.
    ctx.effect(
      () =>
        ctx.slots.inject("sidebar.right.pane.tab", () =>
          ctx.slots.register(
            {
              name: "sidebar.right.pane.tab",
              key: FILES_ID,
              locale: NS,
              store,
              inject,
              children: { "sidebar.right.tab.files.actions": { kind: "list", scope: "session" } },
            },
            FilesBody,
          ),
        ),
      "ui-sidebar-files: files tab body",
    );
    ctx.effect(
      () =>
        ctx.slots.inject("sidebar.right.pane.tab.title", () =>
          ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: FILES_ID }, FilesTitle),
        ),
      "ui-sidebar-files: files tab title",
    );
  };

  return {
    name: PACKAGE_NAME,
    inject: [...INJECT],
    /**
     * Cổng cài đặt: chỉ chạy thân MỘT lần cho cả trang, và NÉM LẠI lỗi sau khi đã ghi log.
     * Nhận: ctx — context gốc phía client.
     * Trả: không.
     */
    apply(ctx: ClientContextLike): void {
      if (filesInstalled || filesContexts.has(ctx as object)) {
        console.warn("gbh-client-ui-sidebar-files: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        /* ⚠️ CHỈ bật cờ SAU khi applyInner chạy XONG. Bật sớm ⇒ đăng ký ném giữa đường thì cờ đã khoá ⇒
           hai chỗ ngồi KHÔNG BAO GIỜ được đăng ký lại ⇒ renderer gặp undefined ⇒ React #130. */
        filesContexts.add(ctx as object);
        filesInstalled = true;
      } catch (error) {
        console.error(
          "gbh-client-ui-sidebar-files: apply nem loi — " + (error instanceof Error ? error.message : String(error)),
        );
        throw error;
      }
    },
  };
}
