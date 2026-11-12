/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc ModelDirectoryResolver — dich vu ctx.modelDirectories: cap thu muc model theo tung phien
 */

import { ModelCatalogDirectory } from "./catalog.ts";
import { ModelDirectory } from "./directory.ts";
import { SERVICE_INJECT, SERVICE_NAME, NO_BINDING_SUFFIX, NO_SCOPE_PREFIX, NO_SCOPE_SUFFIX } from "./ids.ts";
import type { ServiceConstructor } from "./runtime.ts";
import type { ClientCtx, DirectoryContract, DirectoryServiceFace, SessionBinding } from "./types.ts";
import { WeakMapWithValues } from "./values.ts";

/** Mat theo doi su kien san pham ma Host co the cung cap qua ctx.get("productAnalytics"). */
interface ProductAnalyticsFace {
  /** Ghi mot su kien san pham. */
  track(name: string, attributes: Record<string, unknown>): void;
}

/** Constructor cua lop ModelDirectoryResolver (co static inject). */
export interface ModelDirectoryResolverConstructor {
  /** Tao dich vu tren mot context goc. */
  new (ctx: ClientCtx): DirectoryServiceFace;
  /** Danh sach dich vu ma dich vu yeu cau — NGUYEN VAN cua ban goc. */
  readonly inject: readonly string[];
}

/**
 * Dung lop ModelDirectoryResolver tren lop Service cua cordis.
 *
 * Ban goc khai `class ModelDirectoryResolver extends Service` o pham vi module; o day Service chi co
 * duoc tu bang module cua loader (require trong factory), nen lop duoc dung trong mot ham — hinh dang
 * lop, ten lop, static inject va chu ky constructor giu NGUYEN VAN.
 * Nhận: Service — lop co so cordis (require("@deepseek-ai/cordis").Service).
 * Trả: constructor cua lop ModelDirectoryResolver.
 */
export function createModelDirectoryResolver(Service: ServiceConstructor): ModelDirectoryResolverConstructor {
  /** Lop co so da ep kieu de dung trong menh de extends. */
  const Base = Service as unknown as new (ctx: unknown, name: string) => { readonly ctx: unknown };

  /** The `ctx.modelDirectories` session model-selection service. */
  class ModelDirectoryResolver extends Base {
    /** Danh sach dich vu yeu cau — NGUYEN VAN ban goc. */
    static inject = SERVICE_INJECT;
    /** Thu muc dang song cua tung rang buoc phien. */
    private readonly live = { directories: new WeakMapWithValues<SessionBinding, DirectoryContract>() };
    /** Danh muc the he Host dung chung. */
    private readonly catalog: ModelCatalogDirectory;

    /**
     * @param ctx - owning root context (the service registers itself as `modelDirectories`).
     */
    constructor(ctx: ClientCtx) {
      super(ctx, SERVICE_NAME);
      const host = ctx;
      this.catalog = new ModelCatalogDirectory(host);
      this.catalog.load().catch(() => {});
      host.on("connection/reset", () => {
        this.catalog.resetGeneration();
        for (const directory of this.live.directories.values) directory.resetConnected();
      });
      host.remote.$on("llm/adapters-updated", () => {
        this.catalog.refresh();
      });
      host.remote.$on("settings/document-updated", () => {
        this.catalog.refresh();
      });
      host.remote.$on("credentials/record-updated", () => {
        this.catalog.refresh();
      });
      host.remote.$on("credentials/reference-updated", () => {
        this.catalog.refresh();
      });
    }

    /**
     * Giai thu muc dung chung cua mot phien (tao luoi; scope don dep se huy). Phien la nem loi.
     * Nhận: sessionId — phien so huu.
     * Trả: thu muc thuong tru ma hai loi vao cung dung.
     */
    directoryFor(sessionId: string): DirectoryContract {
      const { live } = this;
      const ctx = this.ctx as ClientCtx;
      const sessions = ctx.sessions;
      const actx = sessions.scope(sessionId);
      if (actx === undefined) throw new Error(NO_SCOPE_PREFIX + `"${String(sessionId)}"` + NO_SCOPE_SUFFIX);
      const binding = sessions.binding(sessionId);
      if (binding === undefined) throw new Error(NO_SCOPE_PREFIX + `"${String(sessionId)}"` + NO_BINDING_SUFFIX);
      const existing = live.directories.get(binding);
      if (existing !== undefined) return existing;
      const directory = new ModelDirectory(
        ctx.remote.session,
        sessionId,
        () => sessions.subagentAddress(sessionId) === undefined,
        this.catalog,
        binding.session.projections.faceOf("modelSelection"),
        () => binding.session.getSnapshot().blank,
        (name, attributes) => (ctx.get("productAnalytics") as ProductAnalyticsFace | undefined)?.track(name, attributes),
      );
      live.directories.set(binding, directory);
      actx.effect(() => () => {
        directory.dispose();
        live.directories.delete(binding);
      }, "ui-model-selection: session directory");
      return directory;
    }
  }

  return ModelDirectoryResolver;
}
