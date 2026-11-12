/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-agent-preset: mot id module, bon slot nguyen van, nhan hieu ung va nam the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-agent-preset";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-agent-preset";

/**
 * Namespace tu dien cua row — nguyen van ban goc (cung ten voi namespace cau hinh tren duong remote).
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const NS = "settings.agentPreset";

/**
 * Ten namespace CAU HINH ma Host doc de biet preset mac dinh — nguyen van ban goc.
 * Nhan: khong co.
 * Tra: chuoi namespace cau hinh.
 */
export const AGENT_PRESET_SETTINGS_NS = "agent-preset-registry";

/** Truong cau hinh giu preset mac dinh cho phien tao sau — nguyen van ban goc. */
export const SETTINGS_DEFAULT_FIELD = "selectedDefault";

/** Id cua preset "standard" — ban goc dung lam diem roi khi preset mac dinh bi an. */
export const STANDARD_PRESET_ID = "standard";

/** Id cua preset "cordis" (che do Sang tao) — ban goc dung lam cong kiem tra Creator. */
export const CREATOR_PRESET_ID = "cordis";

/** Hai preset chi hien khi cong cu phat trien bat — nguyen van ban goc. */
export const CODING_TOOLS_PRESET_IDS: readonly string[] = ["ptc", "minimal"];

/** Ten slot chip chon preset o man hinh phien moi — nguyen van tu bundle goc. */
export const SLOT_HERO = "conversation.hero.agentPreset";

/** Ten slot hang dau phien, noi dat nhan preset chi doc — nguyen van tu bundle goc. */
export const SLOT_HEADER_ACTIONS = "conversation.session.header.actions";

/** Id nguoi ngoi cua nhan preset trong slot hang dau phien — nguyen van ban goc. */
export const HEADER_LABEL_ID = "agent-preset";

/** Thu tu cua nhan preset trong hang dau phien — ban goc xep -10 (chen truoc moi nguoi ngoi khac). */
export const HEADER_LABEL_ORDER = -10;

/** Ten slot menu "them plugin" — nguyen van tu bundle goc. */
export const SLOT_PLUGINS_ADD_ACTIONS = "plugins.add.actions";

/** Id nguoi ngoi cua muc "de agent tao plugin" — nguyen van ban goc. */
export const CREATE_PLUGIN_ID = "create-plugin";

/** Ten slot mot muc trong khung cai dat — nguyen van tu bundle goc. */
export const SLOT_SETTINGS_SECTION = "settings.section";

/** Id nguoi ngoi cua muc "Agent presets" trong khung cai dat — nguyen van ban goc. */
export const SECTION_ID = "agent-presets";

/** Thu tu cua muc "Agent presets" trong khung cai dat — ban goc xep 20. */
export const SECTION_ORDER = 20;

/**
 * Seam ma ban goc khai o apply — nguyen van, khong bot mot muc nao.
 * Thu tu nay la thu tu that trong bundle goc; doi thu tu la doi thu tu cho service cua cordis.
 */
export const SERVICE_INJECT: readonly string[] = [
  "slots",
  "sessions",
  "locale",
  "remote",
  "remote.agentPresets",
  "remote.settings",
  "configForms",
];

/** Seam ma ban goc tiem trong ctx.inject de dang ky bon slot — nguyen van. */
export const SCOPE_INJECT: readonly string[] = ["slots", "conversation", "sessions", "uiWorkspace"];

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Don cac rang buoc da dang ky khi go plugin. */
  boundSelections: "ui-agent-preset: bound selections",
  /** Cong cong cu phat trien: tat thi xoa lua chon tam. */
  developerToolsGate: "ui-agent-preset: Developer tools gate",
  /** Tu dien namespace settings.agentPreset. */
  dictionaries: "ui-agent-preset: settings row dictionaries",
  /** Lang nghe thay doi cau hinh va lam moi. */
  settingsRefresh: "ui-agent-preset: settings refresh",
  /** Chip phien moi va nhan hang dau phien. */
  chipAndLabel: "ui-agent-preset: new-session chip and header label",
  /** Rang buoc theo tung phien (ban goc dat trong seatFor). */
  providerBinding: "ui-agent-preset: Provider binding",
} as const;

/** Do tre truoc khi chu cua chip bat dau hien (ms) — ban goc dung 150. */
export const INTRO_TEXT_DELAY_MS = 150;

/** Khoang cach toi da giua hai ky tu cua hieu ung hien chu (ms) — ban goc dung 40. */
export const INTRO_CHAR_STAGGER_MS = 40;

/** Quang thoi gian trai deu cho ca chuoi (ms) — ban goc dung 200. */
export const INTRO_TEXT_REVEAL_MS = 200;

/** Thoi gian mot ky tu mo dan (ms) — ban goc dung 400. */
export const INTRO_CHAR_FADE_MS = 400;

/** Thoi gian giu bang bao tu choi lua chon (ms) — ban goc dung 8000. */
export const REFUSAL_HOLD_MS = 8_000;

/** Id the style cho tung module CSS — build.ts nhung nguyen van bang define. */
export const STYLE_TAGS = {
  /** CSS cua AgentPresetLabel.module.css. */
  label: STOCK_PACKAGE_NAME + "/AgentPresetLabel.module.css",
  /** CSS cua CreatePluginMenuItem.module.css. */
  createPluginItem: STOCK_PACKAGE_NAME + "/CreatePluginMenuItem.module.css",
  /** CSS cua AgentPresetSeat.module.css. */
  seat: STOCK_PACKAGE_NAME + "/AgentPresetSeat.module.css",
  /** CSS cua PresetGuideDialog.module.css. */
  guideDialog: STOCK_PACKAGE_NAME + "/PresetGuideDialog.module.css",
  /** CSS cua AgentPresetSection.module.css. */
  section: STOCK_PACKAGE_NAME + "/AgentPresetSection.module.css",
} as const;
