/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row ui-subagent: mot id module, nam ten slot/occupant nguyen van, ba the CSS
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phat ra) — KHONG khai id cua goi goc: no thuoc gbh.row.aliases va tang nap
 * TU sinh entry alias tro ve cung URL bundle. Mot bundle MOT id.
 * Nhan: khong co.
 * Tra: chuoi ten package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-subagent";

/**
 * Ten package GOC cua DSH — CHI duoc khai o gbh.row.aliases, KHONG bao gio load() trong bundle.
 * Nhan: khong co.
 * Tra: chuoi ten package goc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-subagent";

/**
 * Id cua NGUOI NGOI trong slot va cua loai tab thanh ben phai — NGUYEN VAN tu bundle goc.
 *
 * KHONG phai id module: no dinh danh tab "chat subagent" trong sidebarRightTabs (khop key cua slot
 * sidebar.right.pane.tab va trang thai tab da luu cua nguoi dung). Doi chuoi nay la mat kha nang khoi
 * phuc tab cu — nen giu nguyen van nhu ban goc (cung khuon voi SLOT_OCCUPANT_ID cua ui-jobs).
 * Nhan: khong co.
 * Tra: chuoi id nguoi ngoi.
 */
export const SUBAGENT_CHAT_ID = "@deepseek-ai/dsh-client-ui-subagent";

/**
 * Tien to dia chi tai nguyen cho mot phien chat nhung trong thanh ben phai — nguyen van ban goc.
 * Nhan: khong co.
 * Tra: chuoi tien to dia chi.
 */
// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource://; nơi nhận chấp nhận cả scheme cũ.
export const SUBAGENT_CHAT_ADDRESS = "gbh-resource://subagentchat/session/";

/**
 * Giao thuc tai nguyen (protocol) ma row nay so huu — nguyen van ban goc, phai khop ca
 * ctx.resources.register({ protocol }) lan kind cua tab.
 * Nhan: khong co.
 * Tra: chuoi ten giao thuc.
 */
export const CHAT_PROTOCOL = "subagentchat";

/** Ten slot chua duong dan pha he trong hang dau phien — nguyen van tu bundle goc. */
export const SLOT_HEADER_LINEAGE = "conversation.session.header.lineage";

/** Ten slot chua nut danh muc trong hang dau phien — nguyen van tu bundle goc. */
export const SLOT_HEADER_ACTIONS = "conversation.session.header.actions";

/** Ten slot soan tin — nguyen van tu bundle goc; row nay chiem cho bang che do CHI DOC. */
export const SLOT_COMPOSER = "conversation.composer";

/** Ten slot than cua tab thanh ben phai — nguyen van tu bundle goc. */
export const SLOT_SIDEBAR_PANE_TAB = "sidebar.right.pane.tab";

/** Ten slot noi dung hoi thoai nhung trong tab chat — nguyen van tu bundle goc. */
export const SLOT_SIDEBAR_CHAT = "sidebar.chat.conversation";

/** Ten slot noi dung hoi thoai day du ma panel nhung uy quyen cho — nguyen van ban goc. */
export const SLOT_CONVERSATION_SESSION = "conversation.session";

/** Ten slot khoi noi dung ma panel nhung goi qua renderFactorySlot — nguyen van ban goc. */
export const SLOT_CONVERSATION_CONTENT = "conversation.content";

/** Id nguoi ngoi cua nut danh muc trong slot conversation.session.header.actions — nguyen van ban goc. */
export const CATALOG_OCCUPANT_ID = "subagent-catalog";

/** Thu tu cua nut danh muc trong hang dau phien — ban goc xep 10. */
export const CATALOG_ORDER = 10;

/** Uu tien cua cho soan tin chi doc — ban goc xep -10 (chen truoc moi nguoi ngoi khac). */
export const COMPOSER_PRIORITY = -10;

/** Do rong toi da cua menu danh muc (px) — ban goc dung 336. */
export const MENU_WIDTH = 336;

/** Le an toan so voi mep khung nhin cua menu danh muc (px) — ban goc dung 16. */
export const MENU_VIEWPORT_MARGIN = 16;

/** Do tre mo menu khi dua chuot vao nut (ms) — ban goc dung 150. */
export const HOVER_OPEN_DELAY_MS = 150;

/** Do tre dong menu khi roi chuot (ms) — ban goc dung 120. */
export const HOVER_CLOSE_DELAY_MS = 120;

/** Ngat quang lam moi dong ho dem thoi luong dang chay (ms) — ban goc dung 1000. */
export const ACTIVITY_TICK_MS = 1000;

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Tu dien namespace subagent. */
  dictionaries: "ui-subagent: dictionaries",
  /** Chu so huu tai nguyen chat cua thanh ben phai. */
  chatResources: "ui-subagent: Sidebar chat resources",
  /** Loai tab chat trong sidebarRightTabs. */
  chatType: "ui-subagent: Sidebar chat type",
  /** Than tab chat trong slot sidebar.right.pane.tab. */
  chatBody: "ui-subagent: Sidebar chat body",
  /** Noi dung hoi thoai nhung trong tab chat. */
  conversation: "ui-subagent: Sidebar Conversation",
} as const;

/** Id the style cho tung module CSS — build.ts nhung nguyen van bang define. */
export const STYLE_TAGS = {
  /** CSS cua SubagentHeaderLineage.module.css. */
  lineage: STOCK_PACKAGE_NAME + "/SubagentHeaderLineage.module.css",
  /** CSS cua SubagentReadOnlyComposer.module.css. */
  composer: STOCK_PACKAGE_NAME + "/SubagentReadOnlyComposer.module.css",
  /** CSS cua SidebarChat.module.css. */
  chat: STOCK_PACKAGE_NAME + "/SidebarChat.module.css",
} as const;
