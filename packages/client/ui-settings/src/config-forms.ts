/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Service configForms: form dung chung cho moi namespace + watch whileServed
 */

import { ConfigFormController } from "./config-form.ts";
import type { ConfigFormContext } from "./config-form.ts";
import type { SettingsDescribeMirror } from "./mirror.ts";
import { DEVELOPER_TOOLS_NAMESPACE } from "./ids.ts";
import type { CreateStore } from "./types.ts";

/**
 * Service configForms — be mat ma 23 row khac inject qua dsh.client.inject, gom:
 * get(namespace) de lay form cua mot namespace, whileServed de giu dang ky song theo namespace
 * Host dang phuc vu, va describe() de doc mirror dung chung.
 */
export class ConfigForms {
  /** Form theo namespace (moi namespace mot form, dung chung cho moi nguoi goi). */
  private readonly forms = new Map<string, ConfigFormController>();
  /** Mirror dung chung ma moi form dan xuat. */
  private readonly mirror: SettingsDescribeMirror;
  private readonly ctx: ConfigFormContext;
  private readonly createStore: CreateStore;

  /**
   * Tuy chon developer tools dung chung: consumer (row stock ui-conversation, ui-agent-preset) doc qua
   * duong nay — thieu no thi chung nem Cannot read properties of undefined (reading enabled).
   */
  readonly developerTools: DeveloperToolsPreference;

  /**
   * @param ctx - context cua plugin cung cap (seam remote.settings + service schema).
   * @param config - mirror dung chung + ham tao store.
   */
  constructor(ctx: ConfigFormContext, config: { mirror: SettingsDescribeMirror; createStore: CreateStore }) {
    this.ctx = ctx;
    this.mirror = config.mirror;
    this.createStore = config.createStore;
    this.developerTools = new DeveloperToolsPreference(this.get(DEVELOPER_TOOLS_NAMESPACE));
  }

  /**
   * Be mat doc/gop cua mirror dung chung (de cac be mat khac namespace doc cung mot tai lieu).
   * @returns mirror dung chung.
   */
  describe(): SettingsDescribeMirror {
    return this.mirror;
  }

  /**
   * Lay form cua mot namespace (tao lan dau neu chua co).
   * @param entryId - id entry cua plugin so huu namespace.
   * @returns form cua namespace do.
   */
  get(entryId: string): ConfigFormController {
    const existing = this.forms.get(entryId);
    if (existing !== undefined) return existing;
    const form = new ConfigFormController(this.ctx, { namespace: entryId }, this.mirror, this.createStore);
    this.forms.set(entryId, form);
    void this.mirror.ensure();
    return form;
  }

  /**
   * Giu mot dang ky song khi Host dang phuc vu BAT KY namespace nao trong danh sach.
   *
   * register chay ngay khi mot namespace xuat hien trong mirror, va disposer cua no chay khi
   * khong con namespace nao (hoac khi ham huy duoc goi). Nho vay plugin soan trang cho namespace
   * cua plugin khac se khong hien dau vet neu ban cai khong ghep plugin so huu.
   * @param namespaces - cac namespace ma dang ky nay theo doi.
   * @param register - ham dang ky, nhan tap namespace Host dang phuc vu, tra ve disposer.
   * @returns ham huy (ngung theo doi + huy dang ky dang song).
   */
  whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void {
    let off: (() => void) | undefined;
    const sync = (): void => {
      const served = new Set(this.mirror.getSnapshot().view?.namespaces.map((view) => view.ns) ?? []);
      const watched = namespaces.some((namespace) => served.has(namespace));
      if (watched && off === undefined) off = register(served);
      else if (!watched && off !== undefined) {
        off();
        off = undefined;
      }
    };
    const unsubscribe = this.mirror.subscribe(sync);
    void this.mirror.ensure();
    sync();
    return () => {
      unsubscribe();
      off?.();
      off = undefined;
    };
  }
}

/**
 * Tuy chon developer tools cua chinh row nay, phoi qua service configForms.
 *
 * Ban goc cung cap dung doi tuong nay; consumer doc developerTools.enabled.getSnapshot()/subscribe de
 * biet co bat tinh nang lap trinh hay khong. Mac dinh false khi Host chua tra loi.
 */
export class DeveloperToolsPreference {
  /** Trang thai bat/tat quan sat duoc. */
  readonly enabled: { getSnapshot: () => boolean; subscribe: (listener: () => void) => () => void };

  /**
   * @param scope - form cua namespace ui-settings (Host giu gia tri that).
   */
  constructor(readonly scope: ConfigFormController) {
    this.enabled = {
      getSnapshot: () => (scope.getSnapshot().value as { enabled?: boolean } | undefined)?.enabled ?? false,
      subscribe: (listener: () => void): (() => void) => {
        let previous = this.enabled.getSnapshot();
        return scope.subscribe(() => {
          const next = this.enabled.getSnapshot();
          if (next === previous) return;
          previous = next;
          listener();
        });
      },
    };
  }

  /**
   * Ghi lua chon len Host.
   * @param enabled - che do developer tools nguoi dung chon.
   * @returns ket thuc sau khi Host chap nhan; nem khi bi tu choi.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (!(await this.scope.set("enabled", enabled))) {
      throw new Error("Developer tools preference was not saved");
    }
  }
}
