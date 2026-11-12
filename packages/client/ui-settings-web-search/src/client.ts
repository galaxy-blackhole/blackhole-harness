/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua browser: the cau hinh web-search tren trang Plugins — locale, RPC credentials qua api-remotes, slot plugins.item
 */
import { vi } from "./locales-vi.ts";

/** `require` của factory do vỏ cấp: nguồn của mọi seed nền tảng (React, primitives). */
declare const require: (specifier: string) => unknown;

/** Bề mặt hai hàm jsx của React mà bundle này dùng (vỏ cấp qua seed). */
interface JsxRuntime {
  /** Dựng một element với đúng một con. */
  jsx(type: unknown, props: unknown): unknown;
  /** Dựng một element với nhiều con. */
  jsxs(type: unknown, props: unknown): unknown;
}

/** Bề mặt bộ primitive của tầng settings mà trang này dùng. */
interface PrimitivesFace {
  /** Khung form cài đặt (nhãn nút, trạng thái ghi được, nút lưu/bỏ). */
  SettingsForm: unknown;
  /** Ô nhập secret (khoá API) — không hiện giá trị, chỉ hiện trạng thái đã cấu hình. */
  SettingsSecretField: unknown;
  /** Ô nhập giá trị thường (endpoint, số lần search) kèm nhãn `đã ghi đè` và nút khôi phục mặc định. */
  SettingsValueField: unknown;
  /** Mô hình form: gắn vào một scope cài đặt, phơi shell/field/actions, và bind ra store. */
  SettingsFormModel: new (scope: SettingsScope, fields: unknown[], staged: unknown[]) => FormModelFace;
  /** Khai một ô văn bản trong form. */
  settingsTextField(name: string): unknown;
  /** Khai một ô số trong form. */
  settingsNumberField(name: string): unknown;
}

/** Bề mặt mô hình form sau khi dựng. */
interface FormModelFace {
  /** Ảnh chụp chung của form (trạng thái ghi, bẩn, lỗi). */
  shell(): Record<string, unknown>;
  /** Ảnh chụp một ô theo tên. */
  field(name: string): unknown;
  /** Các hành động của form (lưu, bỏ, sửa, khôi phục). */
  actions(): Record<string, unknown>;
  /** Bind store quan sát được từ một phép chiếu. */
  bind(project: () => unknown): { set(value: unknown): void };
  /** Nhả mọi đăng ký của form. */
  dispose(): void;
}

/** Scope cài đặt đã bind cho namespace provider web-search. */
interface SettingsScope {
  /** Ảnh chụp cài đặt hiện tại (`value` là các trường của section). */
  getSnapshot(): { value?: { apiKeyEnv?: string } };
  /** Nghe thay đổi của scope; trả hàm huỷ. */
  subscribe(listener: () => void): () => void;
}

/** Trạng thái credential mà trang hiển thị. */
interface CredentialState {
  /** Tham chiếu credential đang được hỏi. */
  ref: string;
  /** Host báo đã có credential chưa. */
  configured: boolean;
  /** Host cho phép ghi credential không. */
  writable: boolean;
}

/** Context phía browser mà row này cần: bốn seam dịch vụ của vỏ. */
interface PageContext {
  /** Đăng ký hiệu ứng vào vòng đời plugin. */
  effect(callback: () => unknown, label?: string): void;
  /** Tầng slots: nơi đăng ký occupant. */
  slots: {
    inject(slot: string, callback: () => unknown): unknown;
    register(occupant: Record<string, unknown>, component: unknown): unknown;
  };
  /** Tầng locale: bind namespace và đăng ký từ điển. */
  locale: {
    bind(namespace: string): (key: string) => string;
    register(namespace: string, dictionaries: Record<string, unknown>): unknown;
  };
  /** Tầng remote: RPC sang row host `api-remotes`. */
  remote: {
    credentials: {
      describe(refs: string[]): Promise<{ ok: boolean; value: Record<string, { configured?: boolean; writable?: boolean } | undefined> }>;
      set(ref: string, value: string): Promise<unknown>;
    };
    $on(event: string, listener: (ref: string) => void): unknown;
  };
  /** Tầng config forms: scope của namespace provider và vòng đời `đang được phục vụ`. */
  configForms: {
    get(namespace: string): SettingsScope;
    whileServed(namespaces: string[], callback: () => unknown): unknown;
  };
}

/** Props mà tầng slots truyền cho thẻ: khung nhìn, bản dịch, hook, và hành động của form. */
interface CardProps {
  /** `summary` chỉ trả một dòng mô tả, còn lại là form. */
  view: string;
  /** Hàm đọc chuỗi theo namespace của plugin. */
  t: (key: string) => string;
  /** Hook đọc store của thẻ (do `inject()` cấp). */
  useWebSearchCard(select: (snapshot: unknown) => unknown): {
    writable: boolean;
    apiKeyWritable: boolean;
    apiKey: { text: string };
    apiKeyConfigured: boolean;
    baseURL: Record<string, unknown>;
    maxUses: Record<string, unknown>;
  };
  /** Ghi một ô đang chờ. */
  edit(field: string, text: string): void;
  /** Khôi phục một ô về mặc định. */
  resetField(field: string): void;
  /** Lưu form. */
  save(): void;
  /** Bỏ thay đổi. */
  discard(): void;
}

/** Hai hàm jsx lấy từ seed nền tảng. */
const jsxRuntime = require("react/jsx-runtime") as JsxRuntime;
/** Bộ primitive của tầng settings lấy từ seed nền tảng. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesFace;

/** Bản dịch tiếng Anh của trang cài đặt provider web-search. */
const en = {
  title: "Web search",
  description: "Set up the DeepSeek search provider.",
  apiKey: "API key",
  apiKeyHint: "Stored outside the settings file. Leave blank to keep the current key.",
  apiKeySet: "A key is configured.",
  apiKeyUnset: "No key is configured; only conversations using a DeepSeek Account model can search, through the default endpoint.",
  baseUrl: "Endpoint",
  baseUrlHint: "Leave blank to use the provider default.",
  maxUses: "Max searches per request",
  maxUsesHint: "How many times one request may search before it must answer.",
  overridden: "Overridden",
  reset: "Reset to default",
  readOnly: "This deployment stores settings read-only.",
  unavailable: "This plugin is not loaded, so it cannot be configured right now.",
  save: "Save",
  saving: "Saving…",
  saveFailed: "The deployment did not accept these values; they were left for you to correct.",
  invalidNumber: "Enter a number, or leave blank to use the default.",
};

/** Bản dịch tiếng Trung giản thể của cùng trang. */
const zh = {
  title: "网页搜索",
  description: "设置 DeepSeek 的搜索提供方。",
  apiKey: "API Key",
  apiKeyHint: "不写入设置文件。留空表示保持当前密钥。",
  apiKeySet: "已配置密钥。",
  apiKeyUnset: "未配置密钥；仅使用 DeepSeek 账号模型的对话可以通过默认接口地址搜索。",
  baseUrl: "接口地址",
  baseUrlHint: "留空则使用提供方默认地址。",
  maxUses: "单次请求最多搜索次数",
  maxUsesHint: "一次请求在必须作答前最多可以搜索多少次。",
  overridden: "已覆盖",
  reset: "恢复默认",
  readOnly: "本部署的设置为只读。",
  unavailable: "该插件当前未加载，暂时无法配置。",
  save: "保存",
  saving: "保存中…",
  saveFailed: "本部署没有接受这些值，已保留供你修改。",
  invalidNumber: "请填数字；留空表示使用默认值。",
};

/** Dictionary namespace do plugin này sở hữu. */
export const NS = "settings.webSearch";
/** Namespace cài đặt của provider mà section này cấu hình. */
// 09/11/2026 - chu du an doi namespace sang web-search-gbh (da duyet).
const WEB_SEARCH_NS = "web-search-gbh";
/** Tham chiếu credential provider dùng khi section không nêu tên nào. */
const DEFAULT_API_KEY_REF = "DEEPSEEK_API_KEY";
/** Tên ô mà ô credential đang chờ ghi vào. */
const API_KEY_FIELD = "apiKey";

/**
 * Nhãn mà khung form cài đặt dùng chung render.
 * Nhận: hàm đọc chuỗi theo namespace của plugin.
 * Trả: bộ nhãn đã dịch.
 */
function formLabels(t: (key: string) => string): Record<string, string> {
  return {
    unavailable: t("unavailable"),
    readOnly: t("readOnly"),
    saveFailed: t("saveFailed"),
    save: t("save"),
    saving: t("saving"),
  };
}

/**
 * Thẻ cài đặt web-search: một dòng mô tả khi tầng slots hỏi `summary`, còn lại là form ba ô.
 * Nhận: props do tầng slots truyền (khung nhìn, bản dịch, hook store, hành động form).
 * Trả: element React của thẻ.
 */
function WebSearchCard(props: CardProps): unknown {
  const t = props.t;
  const state = props.useWebSearchCard((snapshot) => snapshot);
  if (props.view === "summary") return t("description");
  const disabled = !state.writable;
  return jsxRuntime.jsxs(primitives.SettingsForm, {
    labels: formLabels(t),
    state,
    onSave: props.save,
    onDiscard: props.discard,
    children: [
      jsxRuntime.jsx(primitives.SettingsSecretField, {
        id: "plugin-config-web-search-key",
        label: t("apiKey"),
        hint: t("apiKeyHint"),
        disabled: !state.apiKeyWritable,
        text: state.apiKey.text,
        configured: state.apiKeyConfigured,
        stateLabel: state.apiKeyConfigured ? t("apiKeySet") : t("apiKeyUnset"),
        onEdit: (text: string) => {
          props.edit("apiKey", text);
        },
      }),
      jsxRuntime.jsx(primitives.SettingsValueField, {
        id: "plugin-config-web-search-endpoint",
        label: t("baseUrl"),
        hint: t("baseUrlHint"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidNumber"),
        disabled,
        ...state.baseURL,
        onEdit: (text: string) => {
          props.edit("baseURL", text);
        },
        onReset: () => {
          props.resetField("baseURL");
        },
      }),
      jsxRuntime.jsx(primitives.SettingsValueField, {
        id: "plugin-config-web-search-max-uses",
        label: t("maxUses"),
        hint: t("maxUsesHint"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidNumber"),
        numeric: true,
        disabled,
        ...state.maxUses,
        onEdit: (text: string) => {
          props.edit("maxUses", text);
        },
        onReset: () => {
          props.resetField("maxUses");
        },
      }),
    ],
  });
}

/**
 * Nối scope `web-search-deepseek` với miền credentials của Host lên trang.
 * Trạng thái credential được ghi kèm ĐÚNG tham chiếu nó mô tả: `apiKeyEnv` có thể đổi giữa lúc hỏi và lúc
 * trả lời, và hai lần đọc có thể về lệch thứ tự, nên câu trả lời chỉ được công bố khi nó còn đúng tham
 * chiếu đang có hiệu lực.
 */
class WebSearchCardController {
  private readonly scope: SettingsScope;
  private readonly ctx: PageContext;
  private readonly form: FormModelFace;
  private readonly store: { set(value: unknown): void };
  private readonly unsubscribe: () => void;
  private credential: CredentialState = { ref: "", configured: false, writable: true };

  /**
   * Dựng bộ điều khiển thẻ cho một scope cài đặt.
   * Nhận: scope đã bind của namespace provider và context của trang.
   * Trả: thực thể điều khiển.
   */
  constructor(scope: SettingsScope, ctx: PageContext) {
    this.scope = scope;
    this.ctx = ctx;
    this.form = new primitives.SettingsFormModel(
      scope,
      [primitives.settingsTextField("baseURL"), primitives.settingsNumberField("maxUses")],
      [{ field: API_KEY_FIELD, write: (text: string) => this.writeKey(text) }],
    );
    this.store = this.form.bind(() => this.projection());
    this.unsubscribe = scope.subscribe(() => {
      void this.readCredential();
    });
    void this.readCredential();
  }

  /** Ảnh chụp mà thẻ đọc: vỏ của form + ba ô + trạng thái credential. */
  private projection(): Record<string, unknown> {
    return {
      ...this.form.shell(),
      baseURL: this.form.field("baseURL"),
      maxUses: this.form.field("maxUses"),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    };
  }

  /** Hỏi miền credentials về tham chiếu mà section đang nêu, rồi công bố nếu còn đúng tham chiếu đó. */
  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot());
    if (ref !== this.credential.ref) {
      this.credential = { ref, configured: false, writable: true };
      this.store.set(this.projection());
    }
    const response = await this.ctx.remote.credentials.describe([ref]);
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return;
    const view = response.value[ref];
    const next: CredentialState = { ref, configured: view?.configured ?? false, writable: view?.writable ?? true };
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
    this.credential = next;
    this.store.set(this.projection());
  }

  /**
   * Đọc lại sau khi Host báo tham chiếu này vừa đổi (khoá có thể được ghi từ trang Models).
   * Nhận: tham chiếu mà Host báo đã đổi.
   * Trả: không.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return;
    void this.readCredential();
  }

  /** Bề mặt mà đăng ký slot inject vào: store của thẻ và các hành động của form. */
  inject(): Record<string, unknown> {
    return { hooks: { webSearchCard: this.store }, ...this.form.actions() };
  }

  /**
   * Ghi khoá đang chờ, rồi đọc lại xem Host đã có khoá chưa.
   * Nhận: giá trị credential đang chờ.
   * Trả: Host có báo đã cấu hình credential sau đó hay không.
   */
  async writeKey(value: string): Promise<boolean> {
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value);
    await this.readCredential();
    return this.credential.configured;
  }

  /** Nhả mọi đăng ký cấu hình của thẻ. */
  dispose(): void {
    this.unsubscribe();
    this.form.dispose();
  }
}

/**
 * Tham chiếu credential mà section nêu, hoặc mặc định của provider.
 * Nhận: ảnh chụp scope hiện tại.
 * Trả: tham chiếu cần hỏi.
 */
function refOf(snapshot: { value?: { apiKeyEnv?: string } }): string {
  const declared = snapshot.value?.apiKeyEnv;
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF;
}

/** Dịch vụ phía browser mà plugin này cần (inject của fiber cordis). */
export const inject = ["slots", "locale", "remote", "remote.credentials", "configForms"];

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * Bật SAU khi phần đăng ký chạy xong; bật sớm mà đăng ký ném giữa đường ⇒ slot không được đăng ký lại.
 */
let installed = false;

/**
 * Thân plugin: từ điển, controller thẻ web-search, hai đăng ký Remote và slot occupant.
 * Nhận: context gốc phía client.
 * Trả: không.
 */
function applyInner(ctx: PageContext): void {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-settings-web-search: dictionaries");
  const card = new WebSearchCardController(ctx.configForms.get(WEB_SEARCH_NS), ctx);
  ctx.effect(
    () => () => {
      card.dispose();
    },
    "ui-settings-web-search: form subscription",
  );
  ctx.effect(
    () =>
      ctx.remote.$on("credentials/reference-updated", (ref) => {
        card.refreshCredential(ref);
      }),
    "ui-settings-web-search: credential invalidations",
  );
  ctx.effect(
    () =>
      ctx.configForms.whileServed([WEB_SEARCH_NS], () =>
        ctx.slots.inject("plugins.item", () =>
          ctx.slots.register(
            {
              name: "plugins.item",
              id: "web-search",
              order: 20,
              label: () => t("title"),
              locale: NS,
              inject: () => card.inject(),
            },
            WebSearchCard,
          ),
        ),
      ),
    "ui-settings-web-search: page",
  );
}

/**
 * Mount trang cài đặt web-search trong khi Host phục vụ namespace của provider, chặn cài lần hai.
 * Nhận: context gốc phía client.
 * Trả: không.
 */
export function apply(ctx: PageContext): void {
  if (installed) return;
  try {
    applyInner(ctx);
    installed = true;
  } catch (error) {
    console.error("gbh-client-ui-settings-web-search: apply ném lỗi", error);
    throw error;
  }
}

