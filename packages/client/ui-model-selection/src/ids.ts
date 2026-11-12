/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hang so dinh danh cua row ui-model-selection: mot id module, ten slot, namespace tu dien va cac chuoi loi nguyen van
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-model-selection";

/**
 * Danh sach id module ma bundle TU KHAI — dung mot phan tu, chinh la ten package cua ta.
 * Nhan: khong co.
 * Tra: mang mot phan tu.
 */
export const MODULE_IDS: readonly string[] = [PACKAGE_NAME];

/** Ten dich vu ma plugin dang ky tren context (ban goc: super(ctx, "modelDirectories")). */
export const SERVICE_NAME = "modelDirectories";

/** Namespace tu dien cua row (ban goc: const NS = "model"). */
export const NS = "model";

/** Ten lenh /model trong bang lenh client. */
export const COMMAND_NAME = "model";

/** Slot duy nhat ma nua client nay chiem (ban goc: conversation.input.model). */
export const SLOT_MODEL = "conversation.input.model";

/** Danh sach dich vu ma plugin yeu cau — NGUYEN VAN thu tu cua ban goc (const inject). */
export const INJECT: readonly string[] = ["commandUi", "locale", "sessions", "slots", "remote", "remote.session"];

/** Danh sach dich vu ma ModelDirectoryResolver yeu cau — NGUYEN VAN cua ban goc (static inject). */
export const SERVICE_INJECT: readonly string[] = ["sessions", "remote", "remote.session"];

/** Ten nhan hieu ung vong doi — NGUYEN VAN nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Dang ky hai bang tu dien cua namespace model. */
  dictionaries: "ui-model-selection: dictionaries",
  /** Dang ky lenh /model. */
  modelContribution: "ui-model-selection: /model contribution",
  /** Don dep thu muc model cua mot phien. */
  sessionDirectory: "ui-model-selection: session directory",
} as const;

/** Id provider tai khoan DeepSeek — provider duoc xep dau va duoc dich ten rieng. */
export const ACCOUNT_PROVIDER_ID = "deepseek-account";

/** Id provider chinh thuc DeepSeek — provider duoc xep thu hai. */
export const OFFICIAL_PROVIDER_ID = "deepseek-official";

/** Ma loi khi phien dang bi mot tien trinh DSH khac giu quyen ghi. */
export const WRITER_HELD = "session/writer-held";

/** Chuoi loi khi phien la subagent co dia chi (khong chon duoc model) — NGUYEN VAN ban goc. */
export const UNAVAILABLE_MESSAGE = "model selection is unavailable for addressed subagent sessions";

/** Chuoi loi khi danh muc cua provider hong — NGUYEN VAN ban goc. */
export const FAILED_GROUP_MESSAGE = "this provider's catalog failed to load — pick a model from a loaded group";

/** Tien to chuoi loi khi phien khong giai duoc scope — NGUYEN VAN ban goc. */
export const NO_SCOPE_PREFIX = "ui-model-selection: session ";

/** Duoi chuoi loi khi phien khong giai duoc scope — NGUYEN VAN ban goc. */
export const NO_SCOPE_SUFFIX = " resolved no scope";

/** Duoi chuoi loi khi phien khong giai duoc rang buoc — NGUYEN VAN ban goc. */
export const NO_BINDING_SUFFIX = " resolved no binding";

/** Ten module CSS cua ghe model — dung lam tagId "<package>/<ten file>". */
export const STYLE_MODEL_SELECT = "ModelSelect.module.css";

/** Ten bien toan cuc ma build.ts thay bang van ban CSS cua module (define cua Bun). */
export const CSS_GLOBAL = "__GBH_UI_MODEL_SELECTION_MODEL_SELECT_CSS__";
