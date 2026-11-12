/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tab chat subagent trong thanh ben phai: tai nguyen, than tab, panel hoi thoai nhung — theo bundle goc
 */

import { sidebarChatStyles as styles } from "./class-names.ts";
import { CHAT_PROTOCOL, SLOT_CONVERSATION_CONTENT, SLOT_CONVERSATION_SESSION, SLOT_SIDEBAR_CHAT, SUBAGENT_CHAT_ADDRESS, SUBAGENT_CHAT_ID } from "./ids.ts";
import type { SubagentAddress } from "./header-lineage.ts";
import type { Translator } from "./duration.ts";

/** Runtime JSX do bang module cap (react/jsx-runtime). */
export interface ChatJsx {
  /** Dung element mot con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dung element nhieu con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nut bao boc nhieu con khong co element cha. */
  Fragment: unknown;
}

/** Tham chieu phien song ma dich vu phien tra ve. */
export interface SessionReference {
  /** Nha tham chieu (tra ve quyen khi tab dong). */
  release: () => void;
}

/** Gia tri ma mot lan dung tai nguyen chat giu. */
export interface SubagentChatResource {
  /** Dia chi phien con. */
  readonly address: SubagentAddress;
  /** Tham chieu phien song. */
  readonly reference: SessionReference;
}

/** Mot muc ma nha cung cap tai nguyen phat ra. */
export interface ResourceEvent {
  /** true khi mo duoc tai nguyen. */
  readonly ok: true;
  /** Gia tri giu trong mot lan dung. */
  readonly value: SubagentChatResource;
}

/** Nha cung cap tai nguyen chat ma row nay dang ky voi dich vu resources. */
export interface ChatResourceProvider {
  /** Ten giao thuc tai nguyen. */
  readonly protocol: string;
  /** Mo mot dia chi tai nguyen va giu no song den khi bi huy. */
  open: (resourceAddress: string, options: { readonly signal: AbortSignal }) => AsyncGenerator<ResourceEvent, void, unknown>;
}

/** Anh chup bang phien ma tieu de tab doc de lay nhan cua phien con. */
export interface SessionsSnapshotFace {
  /** Tom tat phien theo id. */
  readonly byId: Readonly<Record<string, { readonly projectionValues?: { readonly subagent?: { readonly label?: string } } } | undefined>>;
}

/** Mat dich vu phien ma nha cung cap tai nguyen va tieu de tab dung. */
export interface SessionsFace {
  /** Giu mot phien song theo dia chi subagent. */
  retain: (address: SubagentAddress, options: { readonly source: string; readonly signal: AbortSignal }) => SessionReference;
  /** Bang phien: doc anh chup de lay nhan phien con. */
  readonly list: { getSnapshot: () => SessionsSnapshotFace };
}

/** Props cua than tab chat trong thanh ben phai. */
export interface SidebarChatTabProps {
  /** Doc gia tri tai nguyen cua tab. */
  readonly useResource: (contentId: string) => { readonly value?: SubagentChatResource };
  /** Doc thong tin tab. */
  readonly useTabInfo: () => { readonly tab: { readonly contentId: string } };
  /** Nha cung cap phien cho cay con. */
  readonly SessionProvider: unknown;
  /** Render mot slot con. */
  readonly renderSlot: (name: string, props: Record<string, unknown>) => unknown;
}

/** Mat phien ma panel hoi thoai nhung doc. */
export interface ConversationSessionFace {
  /** Phien con trong (chua co luot nao). */
  readonly blank?: boolean;
  /** Phien dang cho luot dau. */
  readonly awaitingFirstTurn?: boolean;
  /** Phien dang chay. */
  readonly running?: boolean;
  /** Nguoi dung da thu gui tin hay chua. */
  readonly promptAttempted?: boolean;
  /** Trang thai mo lich su: idle · loading · open · error. */
  readonly openState?: string;
  /** Thong tin subagent cua phien. */
  readonly subagent?: {
    /** Dia chi phien con. */
    readonly address: SubagentAddress;
    /** Phien cha con truy cap duoc hay khong. */
    readonly parentAvailable?: boolean;
  };
}

/** Props cua panel hoi thoai nhung trong tab chat. */
export interface ConversationSlotPanelProps {
  /** Id phien con can render. */
  readonly sessionId: string;
  /** Doc mot lat cat cua phien. */
  readonly useSession: <T>(selector: (session: ConversationSessionFace) => T) => T;
  /** Doc trang thai vo hoi thoai. */
  readonly useConversation: <T>(selector: (value: { readonly activeTargets: ReadonlySet<string> }) => T) => T;
  /** Doc bang phien. */
  readonly useSessions: <T>(selector: (state: { readonly byId: Readonly<Record<string, { readonly blank?: boolean } | undefined>> }) => T) => T;
  /** Render mot slot theo factory. */
  readonly renderFactorySlot: (name: string, props: Record<string, unknown>, slots: Record<string, unknown>) => unknown;
}

/** Ba component/ham ma plugin dung khi dang ky tab chat. */
export interface SidebarChatParts {
  /** Than tab chat trong slot sidebar.right.pane.tab. */
  SidebarChatTab: (props: SidebarChatTabProps) => unknown;
  /** Noi dung hoi thoai nhung trong slot sidebar.chat.conversation. */
  ConversationSlotPanel: (props: ConversationSlotPanelProps) => unknown;
  /** Dang ky chu tai nguyen + loai tab + hai slot cua tab chat. */
  registerSidebarChat: (ctx: SidebarChatContext, t: Translator) => void;
}

/** Mat context ma phan dang ky tab chat can. */
export interface SidebarChatContext {
  /** Dang ky hieu ung vong doi. */
  effect: (run: () => void, label: string) => void;
  /** Dich vu tai nguyen. */
  resources: { register: (provider: ChatResourceProvider) => void };
  /** Bang phien. */
  sessions: SessionsFace;
  /** So tab cua thanh ben phai. */
  sidebarRightTabs: {
    /** Dang ky mot loai tab. */
    register: (spec: {
      readonly id: string;
      readonly kind: string;
      readonly patterns: readonly string[];
      readonly priority: string;
      readonly canOpen: (address: string) => boolean;
      readonly title: (address: string) => string;
    }) => void;
  };
  /** So slot. */
  slots: {
    /** Tiem vao mot slot. */
    inject: (name: string, register: () => unknown) => unknown;
    /** Dang ky mot nguoi ngoi. */
    register: (spec: Record<string, unknown>, component: unknown) => unknown;
  };
}

/**
 * Danh dia chi mot phien subagent kem du kien dinh tuyen de khoi phuc.
 * Nhan: address — dia chi subagent cha-truc-tiep ben vung.
 * Tra: dia chi tai nguyen chuan cua thanh ben phai.
 */
export function subagentChatAddress(address: SubagentAddress): string {
  const query = new URLSearchParams({ parent: address.parentSessionId, mode: address.mode });
  return SUBAGENT_CHAT_ADDRESS + encodeURIComponent(address.childSessionId) + "?" + query.toString();
}

/**
 * Phan tich mot dia chi tai nguyen chat chuan.
 * Nhan: value — chuoi co the la dia chi tai nguyen chat.
 * Tra: dia chi cha-truc-tiep da ma hoa, hoac undefined voi tai nguyen khac/hong.
 */
export function parseSubagentChatAddress(value: string): SubagentAddress | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  // 18/10/2026 (task-29): nhận CẢ HAI scheme (client phát gbh-resource:, địa chỉ cũ dsh-resource:).
  if ((url.protocol !== "gbh-resource:" && url.protocol !== "dsh-resource:") || url.hostname.toLowerCase() !== CHAT_PROTOCOL) return undefined;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "session") return undefined;
  const childPart = parts[1] as string;
  const parentSessionId = url.searchParams.get("parent");
  const mode = url.searchParams.get("mode");
  if (parentSessionId === null || parentSessionId === "" || (mode !== "one-shot" && mode !== "continuable" && mode !== "unknown")) return undefined;
  try {
    return { parentSessionId, childSessionId: decodeURIComponent(childPart), mode };
  } catch {
    return undefined;
  }
}

/**
 * Cho tin hieu huy (hoac tra ngay khi da bi huy).
 * Nhan: signal — tin hieu huy cua lan dung tai nguyen.
 * Tra: promise hoan tat khi tin hieu bi huy.
 */
export function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener(
      "abort",
      () => {
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Da co yeu cau huy chua.
 * Nhan: signal — tin hieu huy cua lan dung tai nguyen.
 * Tra: true khi tin hieu da bi huy.
 */
export function isAbortRequested(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Nha cung cap tai nguyen chat: giu mot tham chieu phien song trong suot mot lan dung tab.
 * Nhan: sessions — bang phien cua context.
 * Tra: nha cung cap de dang ky voi dich vu resources.
 */
export function subagentChatResourceProvider(sessions: SessionsFace): ChatResourceProvider {
  return {
    protocol: CHAT_PROTOCOL,
    async *open(resourceAddress: string, options: { readonly signal: AbortSignal }): AsyncGenerator<ResourceEvent, void, unknown> {
      const address = parseSubagentChatAddress(resourceAddress);
      if (address === undefined) throw new Error('ui-subagent: invalid chat resource address "' + resourceAddress + '"');
      if (isAbortRequested(options.signal)) return;
      const reference = sessions.retain(address, { source: "sidebarChat", signal: options.signal });
      try {
        yield { ok: true, value: { address, reference } };
        await waitForAbort(options.signal);
      } finally {
        reference.release();
      }
    },
  };
}

/**
 * Dung ba phan cua tab chat quanh runtime JSX.
 * Nhan: runtime — jsx/jsxs/Fragment cua bang module.
 * Tra: than tab, panel hoi thoai nhung va ham dang ky.
 */
export function createSidebarChatParts(runtime: ChatJsx): SidebarChatParts {
  /**
   * Lua chon Chat co dinh cho mot lan dung Conversation nhung.
   * Nhan: props — props chuan cua slot conversation.session.
   * Tra: slot hoi thoai voi khung nhin "chat".
   */
  function FixedChatConversationView(props: { readonly renderSlot: (name: string, props: Record<string, unknown>) => unknown }): unknown {
    return runtime.jsx(runtime.Fragment, { children: props.renderSlot(SLOT_CONVERSATION_SESSION, { view: "chat" }) });
  }

  /**
   * Render noi dung Conversation dung chung cho mot phien con duoc chi dinh ro.
   * Nhan: props — id phien con, hook phien/hoi thoai va bo render factory.
   * Tra: khoi noi dung hoi thoai nhung.
   */
  function ConversationSlotPanel(props: ConversationSlotPanelProps): unknown {
    const session = props.useSession((value) => value);
    const shellPhase =
      props.useConversation((value) => value).activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running === true
        ? "active"
        : session.promptAttempted === true
          ? "engaging"
          : "blank";
    const summaryBlank = props.useSessions((state) => state.byId[props.sessionId]?.blank);
    const parentAvailabilityPending = session.subagent?.address.mode === "continuable" && session.subagent.parentAvailable === undefined;
    const settling = (shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true) || parentAvailabilityPending;
    const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
    return props.renderFactorySlot(
      SLOT_CONVERSATION_CONTENT,
      { variant: "embedded", phase: settling ? "settling" : hero ? "hero" : "active", hero },
      { slots: { views: FixedChatConversationView } },
    );
  }

  /**
   * Boc tham chieu phien con cua tai nguyen chat quanh slot Conversation cua no.
   * Nhan: props — tai nguyen cua tab, thong tin tab, nha cung cap phien va bo render slot.
   * Tra: than tab chat.
   */
  function SidebarChatTab(props: SidebarChatTabProps): unknown {
    const { tab } = props.useTabInfo();
    const resource = props.useResource(tab.contentId);
    const value = resource.value;
    return runtime.jsx("div", {
      className: styles.root,
      "data-sidebar-chat": "",
      children:
        value === undefined
          ? null
          : runtime.jsx(props.SessionProvider, {
              session: value.reference,
              children: props.renderSlot(SLOT_SIDEBAR_CHAT, {}),
            }),
    });
  }

  /**
   * Dang ky chu tai nguyen chat va phan trinh bay cua no tren thanh ben phai.
   * Nhan: ctx — context goc phia client (sessions, resources, slots, sidebarRightTabs); t — ham dich.
   * Tra: khong co.
   */
  function registerSidebarChat(ctx: SidebarChatContext, t: Translator): void {
    ctx.effect(() => ctx.resources.register(subagentChatResourceProvider(ctx.sessions)), "ui-subagent: Sidebar chat resources");
    ctx.effect(
      () =>
        ctx.sidebarRightTabs.register({
          id: SUBAGENT_CHAT_ID,
          kind: CHAT_PROTOCOL,
          patterns: [SUBAGENT_CHAT_ADDRESS + "**"],
          priority: "builtin",
          canOpen: (address: string) => parseSubagentChatAddress(address) !== undefined,
          title: (address: string) => {
            const child = parseSubagentChatAddress(address)?.childSessionId;
            if (child === undefined) return t("sidebar.chat");
            return ctx.sessions.list.getSnapshot().byId[child]?.projectionValues?.subagent?.label ?? child;
          },
        }),
      "ui-subagent: Sidebar chat type",
    );
    ctx.effect(
      () =>
        ctx.slots.inject("sidebar.right.pane.tab", () =>
          ctx.slots.register(
            {
              name: "sidebar.right.pane.tab",
              key: SUBAGENT_CHAT_ID,
              children: { "sidebar.chat.conversation": { kind: "single", scope: "session" } },
            },
            SidebarChatTab,
          ),
        ),
      "ui-subagent: Sidebar chat body",
    );
    ctx.effect(
      () => ctx.slots.inject("sidebar.chat.conversation", () => ctx.slots.register({ name: "sidebar.chat.conversation" }, ConversationSlotPanel)),
      "ui-subagent: Sidebar Conversation",
    );
  }

  return { SidebarChatTab, ConversationSlotPanel, registerSidebarChat };
}
