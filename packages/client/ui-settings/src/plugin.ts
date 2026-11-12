/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua browser cua row ui-settings: cap HAI service settingsSchema + configForms cho 23 row khac
 */

import Schema from "@deepseek-ai/schemastery";
import { ConfigForms } from "./config-forms.ts";
import { SettingsDescribeMirror } from "./mirror.ts";
import { SettingsSchemaService } from "./schema.ts";
import type { LiveSchema, SchemaNode } from "./schema.ts";
import type { DocumentView } from "./mirror.ts";
import type { ConfigFormController, ConfigFormContext } from "./config-form.ts";
import type { CreateStore, SettingsWriteRemote } from "./types.ts";

/** require do bang module cap cho factory. */
type RequireFn = (id: string) => unknown;

/**
 * Da cap service chua.
 *
 * Bundle nay dang ky HAI id module (ta + stock) trong MOT lan thuc thi, nhung loader tao MOT PLUGIN
 * INSTANCE CHO MOI id => factory duoc goi HAI lan. Lan thu hai se nem
 * service "settingsSchema" has been registered (da gap that trong lab ngay 17/10/2026, lam row
 * loading va keo 34 entry khong activate). Vi vay viec cap service chi duoc lam MOT lan cho ca bundle:
 * co nay o pham vi module nen hai lan goi dung chung no.
 */
let installed = false;

/** Lop Service cua cordis: khoi tao bang (ctx, ten service) de tu dang ky vao container. */
interface ServiceBase {
  new (ctx: unknown, name: string): object;
}

/** Seam settings cua api-remotes (doc + ghi + su kien). */
interface SettingsRemoteNamespace extends SettingsWriteRemote {
  /**
   * Doc tai lieu settings cua Host.
   * @returns ket qua describe (view + loi neu co).
   */
  describe(): Promise<{ ok: boolean; value?: DocumentView; error?: { message?: string } }>;
}

/** Context phia browser (chi khai phan row nay dung). */
export interface ClientContext {
  /**
   * Dang ky mot hieu ung song theo plugin.
   * @param effect - ham tra ve disposer.
   * @param label - nhan de go loi.
   */
  effect(effect: () => void | (() => void), label?: string): void;
  /**
   * Nghe su kien cua context (vi du connection/reset).
   * @param event - ten su kien.
   * @param listener - ham xu ly.
   * @returns ham huy dang ky.
   */
  on(event: string, listener: () => void): () => void;
  /** Seam remote: namespace settings + kenh su kien cua no. */
  readonly remote: {
    /** Namespace settings (doc + ghi). */
    readonly settings: SettingsRemoteNamespace;
    /**
     * Nghe su kien phat tu Host.
     * @param event - ten su kien.
     * @param listener - ham xu ly.
     * @returns ham huy dang ky.
     */
    $on(event: string, listener: () => void): () => void;
  };
}

/** Cau hinh de tao service configForms. */
export interface ConfigFormsOptions {
  /** Mirror dung chung. */
  readonly mirror: SettingsDescribeMirror;
  /** Ham tao store tu seam client-store. */
  readonly createStore: CreateStore;
  /** Context ma cac form dung de ghi len Host. */
  readonly formContext: ConfigFormContext;
}

/**
 * Tao plugin phia browser cua row ui-settings.
 *
 * Hai service duoc dinh nghia TRONG factory vi chung phai ke thua Service THAT (lop Service chi co o
 * runtime qua bang module). Neu chi uy quyen bang lop thuong thi service khong duoc dang ky vao
 * container, va 23 row dang inject se khong tim thay no.
 * @param requireFn - ham require do bang module cap.
 * @returns doi tuong plugin { apply, inject }.
 */
export function createPlugin(requireFn: RequireFn): { apply(ctx: ClientContext): void; inject: string[] } {
  const Service = (requireFn("@deepseek-ai/cordis") as { Service: ServiceBase }).Service;
  const createStore = (requireFn("@galaxy-blackhole/gbh-client-store") as { createSnapshotStore: CreateStore })
    .createSnapshotStore;

  /** Ham rehydrate envelope schema cua Host bang schemastery (bundle cua ta nhung san). */
  const rehydrate = (serialized: unknown): LiveSchema => new Schema(serialized as never) as unknown as LiveSchema;

  /** Service settingsSchema: lop cordis that, uy quyen logic thuan cho schema.ts. */
  class SettingsSchema extends Service {
    private readonly logic = new SettingsSchemaService(undefined);

    /**
     * @param ctx - context cua plugin cung cap.
     */
    constructor(ctx: unknown) {
      super(ctx, "settingsSchema");
    }

    /**
     * Rehydrate envelope schema cua Host.
     * @param serialized - node da serialize.
     * @returns node schema song.
     */
    rehydrate(serialized: unknown): LiveSchema {
      return this.logic.rehydrate(serialized, rehydrate);
    }

    /**
     * Validate mot ban nhap theo schema.
     * @param schema - node schema song.
     * @param draft - gia tri can kiem.
     * @returns chuoi loi, hoac undefined khi hop le.
     */
    validate(schema: LiveSchema, draft: unknown): string | undefined {
      return this.logic.validate(schema, draft);
    }

    /**
     * Giai node schema theo duong dan.
     * @param root - node goc.
     * @param path - duong dan.
     * @returns node tim duoc.
     */
    nodeAtPath(root: SchemaNode | undefined, path: readonly string[]): SchemaNode | undefined {
      return this.logic.nodeAtPath(root, path);
    }

    /**
     * Doc gia tri long nhau theo duong dan.
     * @param value - gia tri goc.
     * @param path - duong dan.
     * @returns gia tri tim duoc.
     */
    getPath(value: unknown, path: readonly string[]): unknown {
      return this.logic.getPath(value, path);
    }

    /**
     * Kiem tra duong dan co ton tai.
     * @param value - gia tri goc.
     * @param path - duong dan.
     * @returns true khi ton tai.
     */
    hasPath(value: unknown, path: readonly string[]): boolean {
      return this.logic.hasPath(value, path);
    }

    /**
     * Ghi bat bien mot gia tri long nhau.
     * @param root - gia tri goc.
     * @param path - duong dan khong rong.
     * @param value - gia tri moi.
     * @returns ban sao da ghi.
     */
    setPath(root: unknown, path: readonly string[], value: unknown): unknown {
      return this.logic.setPath(root, path, value);
    }

    /**
     * Xoa bat bien mot khoa long nhau.
     * @param root - gia tri goc.
     * @param path - duong dan khong rong.
     * @returns ban sao da xoa.
     */
    deletePath(root: unknown, path: readonly string[]): unknown {
      return this.logic.deletePath(root, path);
    }
  }

  /** Service configForms: lop cordis that, uy quyen cho ConfigForms. */
  class ConfigFormsService extends Service {
    private readonly forms: ConfigForms;

    /**
     * Tuy chon developer tools dung chung.
     *
     * Consumer STOCK doc thang ctx.configForms.developerTools.enabled (ui-conversation, ui-agent-preset).
     * Chi uy quyen describe/get/whileServed la KHONG du: thieu thuoc tinh nay thi chung nem
     * Cannot read properties of undefined (reading enabled).
     */
    readonly developerTools: ConfigForms["developerTools"];

    /**
     * @param ctx - context cua plugin cung cap.
     * @param options - mirror + ham tao store + context form.
     */
    constructor(ctx: unknown, options: ConfigFormsOptions) {
      super(ctx, "configForms");
      this.forms = new ConfigForms(options.formContext, {
        mirror: options.mirror,
        createStore: options.createStore,
      });
      this.developerTools = this.forms.developerTools;
    }

    /** @returns mirror dung chung (be mat doc cua tai lieu settings). */
    describe(): SettingsDescribeMirror {
      return this.forms.describe();
    }

    /**
     * Lay form cua mot namespace.
     * @param entryId - id entry cua plugin so huu namespace.
     * @returns form cua namespace do.
     */
    get(entryId: string): ConfigFormController {
      return this.forms.get(entryId);
    }

    /**
     * Giu dang ky song theo namespace Host dang phuc vu.
     * @param namespaces - cac namespace theo doi.
     * @param register - ham dang ky tra ve disposer.
     * @returns ham huy (ngung theo doi + huy dang ky dang song).
     */
    whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void {
      return this.forms.whileServed(namespaces, register);
    }
  }

  /** Seam phia browser ma row nay can (giong ban goc). */
  const inject = ["remote", "remote.settings"];

  /**
   * Cap hai service va lam moi mirror theo su kien cua Host.
   *
   * Boc try/catch quanh than apply: cordis nuot loi trong apply nen neu khong tu in ra thi row chi hien
   * trang thai loading ma khong ai biet vi sao (da mat nhieu vong vi viec nay ngay 17/10/2026).
   * @param ctx - context phia browser.
   */
  function apply(ctx: ClientContext): void {
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-settings: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Than cua apply: cap settingsSchema + configForms va lam moi mirror theo su kien cua Host.
   * @param ctx - context phia browser.
   */
  function applyInner(ctx: ClientContext): void {
    // Chan lan cai thu hai bang SO IDENTITY cua ctx: chan chac, va ctx moi trong test van duoc cai.
    if (installed) return;
    installed = true;
    const schema = new SettingsSchema(ctx);
    const mirror = new SettingsDescribeMirror(ctx.remote.settings, createStore);
    ctx.effect(() => {
      // Boc try/catch: cordis NUOT loi trong effect — khong boc thi khong ai biet vi sao row khong activate.
      try {
        const disposers = [
          ctx.remote.$on("settings/document-updated", () => {
            void mirror.load();
          }),
          ctx.on("connection/reset", () => {
            void mirror.load();
          }),
        ];
        void mirror.ensure().catch((error: unknown) => {
          console.error("gbh-client-ui-settings: describe loi", error);
        });
        return () => {
          for (const dispose of disposers) dispose();
        };
      } catch (error) {
        console.error("gbh-client-ui-settings: effect nem loi", error);
        throw error;
      }
    }, "ui-settings: describe mirror invalidations");
    new ConfigFormsService(ctx, {
      mirror,
      createStore,
      formContext: {
        remote: ctx.remote,
        schema: schema as unknown as ConfigFormContext["schema"],
        rehydrate,
      },
    });
  }

  return { apply, inject };
}
