/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-open-in-app — sau slot nguyen van + tu dien + phim tat + cong chong cai hai lan
 */

import { makeActions } from "./actions.ts";
import { APP_LABEL_KEY } from "./applications.ts";
import { OpenInAppController, OpenInAppPathController } from "./controller.ts";
import { createRouteQuery, makeUseFileApplications } from "./file-applications.ts";
import { PACKAGE_NAME, ROUTE_ICON_PREFIX, SHORTCUT_ID, STYLE_TAG_SUFFIX } from "./ids.ts";
import { NS, en, zh } from "./locales.ts";
import { makeOpenTarget } from "./open-target.ts";
import { STYLES } from "./styles.ts";
import type { OpenInAppPathAction } from "./controller.ts";
import type {
  ClientContextLike,
  ClientPlugin,
  JsxRuntimeLike,
  PrimitivesLike,
  ReactLike,
  RequireFn,
  StoreModuleLike,
} from "./types.ts";
import { vi } from "./locales-vi.ts";

/**
 * Sau seam ma than plugin can — NGUYEN VAN danh sach inject cua ban goc.
 * Nhan: khong co.
 * Tra: mang ten dich vu.
 */
export const INJECT = ["sessions", "slots", "locale", "remote", "remote.session", "shortcuts", "layout"];

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 4 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
// Gia phai tra: boolean dinh giua cac ca test cung file ⇒ nap module TUOI moi ca.
let openInAppInstalled = false;

/** Dau vet cac context da cai (lop thu hai, sau co boolean) — KHONG thay cho co pham vi module. */
const openInAppContexts = new WeakSet<object>();

/**
 * Chen stylesheet cua nut vao the head dung mot lan (idempotent theo data-plugin-css).
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + STYLE_TAG_SUFFIX;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/**
 * Dung mat plugin cua row ui-open-in-app.
 *
 * Bon specifier duoc require LUC VAT CHAT HOA factory (khong phai luc nap script), dung nhu ban goc:
 * react, react/jsx-runtime, @galaxy-blackhole/gbh-client-ui-primitives, @galaxy-blackhole/gbh-client-store.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
  const react = requireFn("react") as ReactLike;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;
  const createSnapshotStore = (requireFn("@galaxy-blackhole/gbh-client-store") as StoreModuleLike).createSnapshotStore;
  const { OpenTargetButton } = makeOpenTarget(jsxRuntime, react, primitives);
  const useFileApplications = makeUseFileApplications(react, createSnapshotStore);
  const actions = makeActions({
    jsxRuntime,
    react,
    useFileApplications,
    OpenTargetButton,
    queryRoute: createRouteQuery(),
    appLabelKey: APP_LABEL_KEY,
  });

  /**
   * Than that cua apply: dang ky tu dien, nut thu muc cua workspace, va cac control duong dan tai lieu.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co; de lai cac dang ky vong doi (tu dien, lenh ban phim, sau slot).
   */
  function applyInner(ctx: ClientContextLike): void {
    const controller = new OpenInAppController(createSnapshotStore);
    void controller.load();
    const paths = new OpenInAppPathController(ctx.remote, createSnapshotStore);
    injectStyles();
    ctx.effect(() => ctx.locale.register(NS, { vi, zh: { ...zh }, en: { ...en } }), "open-in-app: dictionaries");
    const t = ctx.locale.bind(NS);
    /**
     * Duong dan + ung dung ma lenh ban phim tac dong (chi khi khong co panel nao mo).
     * Nhan: khong co.
     * Tra: cap { appId, path }, hoac undefined khi chua san sang.
     */
    const target = (): { appId: string; path: string } | undefined => {
      if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return undefined;
      const session = Object.values(ctx.sessions.list.getSnapshot().byId).find(
        (row) => (row.retainedBy.mainView ?? 0) > 0,
      );
      const appId = controller.currentApp();
      const cwd = session?.cwd;
      return cwd !== undefined && cwd !== "" && appId !== undefined ? { appId, path: cwd } : undefined;
    };
    ctx.effect(
      () =>
        ctx.shortcuts.register({
          id: SHORTCUT_ID,
          label: () => t("open.tooltip"),
          aliases: ["open workspace locally", "open in app"],
          defaults: {
            "desktop:macos": { code: "KeyO", modifiers: ["primary", "alt"] },
            "desktop:windows": { code: "KeyO", modifiers: ["primary", "alt"] },
            "desktop:linux": { code: "KeyO", modifiers: ["primary", "alt"] },
            "web:macos": { code: "KeyO", modifiers: ["primary", "shift"] },
            "web:windows": { code: "KeyO", modifiers: ["primary", "shift"] },
          },
          regions: ["page", "editable"],
          modals: [],
          resolve: () => {
            if (controller.operation.getSnapshot().phase === "busy") {
              return { status: "blocked", reason: t("shortcut.busy") };
            }
            const selected = target();
            if (selected === undefined) return { status: "blocked", reason: t("shortcut.unavailable") };
            return {
              status: "handled",
              run: () => {
                controller.launch(selected.appId, selected.path).catch((error: unknown) => {
                  console.warn("workspace open rejected:", error);
                });
              },
            };
          },
        }),
      "open-in-app: workspace command",
    );
    /**
     * Face tiem vao hai occupant thu muc (tieu de phien + cay tep).
     * Nhan: khong co.
     * Tra: doi tuong props tiem vao occupant.
     */
    const directoryInjected = (): Record<string, unknown> => ({
      hooks: {
        openInAppApps: controller.apps,
        openInAppChoice: controller.choice,
        openInAppLaunch: controller.operation,
        shortcuts: ctx.shortcuts.catalog,
      },
      launch: (appId: string, path: string) => controller.launch(appId, path),
      choose: (appId: string) => {
        controller.choose(appId);
      },
      iconUrl: (appId: string) => ROUTE_ICON_PREFIX + "/" + appId,
    });
    /**
     * Face tiem vao hai occupant tai lieu (thanh cong cu + trang thai rong).
     * Nhan: khong co.
     * Tra: doi tuong props tiem vao occupant.
     */
    const pathInjected = (): Record<string, unknown> => ({
      hooks: { openInAppDesktop: paths.desktop },
      loadDesktop: () => paths.load(),
      openPath: (path: string, action: OpenInAppPathAction, application?: string) =>
        paths.openPath(path, action, application),
      applications: (path: string, signal: AbortSignal) => paths.applications(path, signal),
    });
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do
    //   (da tra gia: truu tuong hoa ten slot lam co bao THIEU slot). Hang so chi dung cho inject + test.
    // ⚠️ COMPONENT LA THAM SO THU HAI cua register(spec, Component); id NGUYEN VAN tu bundle goc (open-in-app).
    ctx.slots.inject("conversation.session.header.utilities", () =>
      ctx.slots.register(
        {
          name: "conversation.session.header.utilities",
          id: "open-in-app",
          order: -10,
          locale: NS,
          inject: directoryInjected,
        },
        actions.SessionOpenInAppAction,
      ),
    );
    ctx.slots.inject("sidebar.right.tab.files.actions", () =>
      ctx.slots.register(
        { name: "sidebar.right.tab.files.actions", id: "open-in-app", locale: NS, inject: directoryInjected },
        actions.OpenInAppAction,
      ),
    );
    ctx.slots.inject("sidebar.right.tab.document.actions", () =>
      ctx.slots.register(
        { name: "sidebar.right.tab.document.actions", id: "open-in-app", locale: NS, inject: pathInjected },
        actions.OpenPathAction,
      ),
    );
    ctx.slots.inject("sidebar.right.tab.document.unpreviewable", () =>
      ctx.slots.register(
        { name: "sidebar.right.tab.document.unpreviewable", id: "open-in-app", locale: NS, inject: pathInjected },
        actions.OpenPathEmptyAction,
      ),
    );
    ctx.slots.inject("deliverables.file.actions", () =>
      ctx.slots.register(
        { name: "deliverables.file.actions", id: "open-in-app", locale: NS },
        actions.FileRouteAction,
      ),
    );
    ctx.slots.inject("deliverables.review.file.actions", () =>
      ctx.slots.register(
        { name: "deliverables.review.file.actions", id: "open-in-app", locale: NS },
        actions.FileRouteAction,
      ),
    );
  }

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Cong vao cua tang nap: chay than plugin DUNG MOT LAN roi bat co.
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientContextLike): void {
      const key = ctx as unknown as object;
      if (openInAppInstalled || openInAppContexts.has(key)) {
        console.warn("gbh-client-ui-open-in-app: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        openInAppContexts.add(key);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi
        //   co da = true ⇒ lan cai thu hai thoat som ⇒ sau slot KHONG BAO GIO duoc dang ky lai ⇒ renderer
        //   gap undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        openInAppInstalled = true;
      } catch (error) {
        console.error(
          "gbh-client-ui-open-in-app: apply nem loi — " + (error instanceof Error ? error.message : String(error)),
        );
        throw error;
      }
    },
  };
}
