/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-agent-preset: tu dien, bon slot nguyen van cua ban goc va bon be mat tren mot so preset
 */

import { createCreatePluginMenuItem } from "./create-plugin-item.ts";
import { createAgentPresetLabel } from "./label.ts";
import { createPresetGuideDialog } from "./preset-guide.ts";
import { createAgentPresetSeat } from "./seat.ts";
import { createAgentPresetSection } from "./section.ts";
import { AgentPresetSectionController, type ConfigFormSnapshot } from "./section-store.ts";
import { AgentPresetSeatController, type SeatSession, type StagedPreset } from "./seat-store.ts";
import { AgentPresetSettingsController } from "./roster.ts";
import { en, zh } from "./locales.ts";
import { WeakMapWithValues } from "./values.ts";
import {
  AGENT_PRESET_SETTINGS_NS,
  CREATE_PLUGIN_ID,
  CREATOR_PRESET_ID,
  EFFECT,
  HEADER_LABEL_ID,
  HEADER_LABEL_ORDER,
  NS,
  PACKAGE_NAME,
  SCOPE_INJECT,
  SECTION_ID,
  SECTION_ORDER,
  SERVICE_INJECT,
  SLOT_HEADER_ACTIONS,
  SLOT_HERO,
  SLOT_PLUGINS_ADD_ACTIONS,
  SLOT_SETTINGS_SECTION,
  STYLE_TAGS,
} from "./ids.ts";
import type { Primitives, ReactLike, RequireFn, Translator } from "./runtime.ts";
import type { RemoteSeam, SnapshotStore, StoreModule } from "./store.ts";
import type { SeatRefusal, SeatSnapshot } from "./seat-store.ts";
import type { RosterSnapshot } from "./roster.ts";
import type { SectionSnapshot } from "./section-store.ts";
import { vi } from "./locales-vi.ts";

/** CSS cua nam module, do build.ts nhung bang define; chay tu nguon (test) thi tra bien toan cuc. */
declare const __GBH_UI_AGENT_PRESET_LABEL_CSS__: string;
declare const __GBH_UI_AGENT_PRESET_CREATE_PLUGIN_CSS__: string;
declare const __GBH_UI_AGENT_PRESET_SEAT_CSS__: string;
declare const __GBH_UI_AGENT_PRESET_GUIDE_CSS__: string;
declare const __GBH_UI_AGENT_PRESET_SECTION_CSS__: string;

/** Mot dong phien ma row nay doc (tom tat trong so phien). */
export interface SessionSummaryRow extends SeatSession {
  /** Gia tri chieu cua phien. */
  readonly projectionValues?: Readonly<Record<string, unknown>>;
  /** So nguoi dang giu phien, theo tung khung — ban goc doc truong nay tu tom tat. */
  readonly retainedBy?: { readonly mainView?: number };
}

/** Rang buoc giua mot phien va mot ghe (do seam sessions cap). */
export interface SessionBinding {
  /** Id phien cua rang buoc. */
  readonly sessionId: string;
  /** Context cua rang buoc — noi dang ky hieu ung don dep. */
  readonly ctx: { effect: (run: () => unknown, label: string) => () => void };
}

/** Seam sessions ma row nay dung — chi phan that su goi. */
export interface SessionsSeam {
  /** Rang buoc dang giu cho mot phien, neu co. */
  binding: (sessionId: string) => SessionBinding | undefined;
  /** So phien. */
  list: {
    /** Anh chup so phien. */
    getSnapshot: () => { readonly byId: Readonly<Record<string, SessionSummaryRow | undefined>> };
    /** Nghe thay doi so phien. */
    subscribe: (listener: () => void) => () => void;
  };
  /** Thong tin giu phien. */
  retainInfo: (sessionId: string) => { getSnapshot: () => { readonly retainedBy: { readonly mainView?: number } } };
}

/** Mot tai lieu cau hinh do seam configForms phuc vu. */
export interface ConfigFormSurface {
  /** Anh chup tai lieu. */
  getSnapshot: () => ConfigFormSnapshot;
  /** Nghe thay doi tai lieu. */
  subscribe: (listener: () => void) => () => void;
}

/** Seam configForms ma row nay dung. */
export interface ConfigFormsSeam {
  /** Tai lieu cau hinh cua mot namespace. */
  get: (namespace: string) => ConfigFormSurface;
  /** Cong cu phat trien — consumer phai co de khong nem khi Host chua tra loi. */
  developerTools: { enabled: { getSnapshot: () => boolean; subscribe: (listener: () => void) => () => void } };
}

/** Khong gian lam viec: mo mot phien moi. */
export interface UiWorkspaceSeam {
  /** Mo phien moi voi tuy chon khoi tao. */
  startSession: (
    sessionId: string | undefined,
    options: { readonly clearPreviousDraft: boolean; readonly agentPreset: string },
  ) => void;
}

/** Nghiep vu ma slot tiem vao chip/nhan hang dau (ban goc goi la seatInjected). */
export interface SeatInjected {
  /** Hook cho component. */
  readonly hooks: {
    /** Store cua ghe. */
    readonly agentPresetSeat: SnapshotStore<SeatSnapshot>;
    /** Cong cu phat trien. */
    readonly developerTools: { getSnapshot: () => boolean; subscribe: (listener: () => void) => () => void };
  };
  /** Nap so preset. */
  readonly load: () => void;
  /** Stage mot preset. */
  readonly select: (id: string) => void;
  /** Ghi nhan mot loi tu choi da hien xong. */
  readonly dismissRefusal: (refusal: SeatRefusal) => void;
  /** Ghi nhan hieu tu gioi thieu da chay xong. */
  readonly introduced: () => void;
}

/** Nghiep vu ma slot tiem vao nhan preset trong hang dau phien. */
export interface LabelInjected {
  /** Hook cho component. */
  readonly hooks: { readonly agentPresets: SnapshotStore<RosterSnapshot> };
  /** Nap so preset. */
  readonly load: () => void;
}

/** Nghiep vu ma slot tiem vao muc "tao plugin". */
export interface CreatePluginInjected {
  /** Hook cho component. */
  readonly hooks: { readonly agentPresets: SnapshotStore<RosterSnapshot> };
  /** Nap so preset. */
  readonly load: () => void;
  /** Mo Creator ma khong gui tin nhan nao. */
  readonly startCreatorDraft: () => void;
}

/** Nghiep vu ma slot tiem vao khung quan ly preset. */
export interface SectionInjected {
  /** Hook cho component. */
  readonly hooks: {
    /** Store cua khung quan ly. */
    readonly agentPresetSection: SnapshotStore<SectionSnapshot>;
    /** Cong cu phat trien. */
    readonly developerTools: { getSnapshot: () => boolean; subscribe: (listener: () => void) => () => void };
  };
  /** Nap so preset. */
  readonly load: () => void;
  /** Mo than khai bao cua mot preset. */
  readonly view: (id: string) => void;
  /** Dong trinh xem. */
  readonly closeView: () => void;
  /** Mo Creator (chi co khi luong da san sang). */
  readonly startCreatorDraft?: () => void;
  /** Dat mot preset lam mac dinh. */
  readonly makeDefault: (id: string) => void;
}

/** Context goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientCtx {
  /** Dang ky hieu ung vong doi; tra ham huy (ban goc khong dung gia tri tra ve o day). */
  effect: (run: () => unknown, label: string) => unknown;
  /** Tiem them dich vu roi chay than callback voi pham vi da co du dich vu. */
  inject: (names: readonly string[], run: (scope: ClientCtx) => void) => unknown;
  /** Nghe su kien cua context. */
  on: (event: string, handler: () => void) => () => void;
  /** Tu dien cua giao dien. */
  locale: {
    /** Dang ky mot namespace tu dien. */
    register: (ns: string, dictionaries: { readonly zh: unknown; readonly en: unknown; readonly vi?: unknown }) => void;
    /** Khoa ham dich vao mot namespace. */
    bind: (ns: string) => Translator;
  };
  /** So slot. */
  slots: {
    /** Tiem vao mot slot. */
    inject: (name: string, body: () => unknown) => unknown;
    /** Dang ky mot nguoi ngoi (component la THAM SO THU HAI). */
    register: (spec: Record<string, unknown>, component: unknown) => () => void;
  };
  /** Bang phien. */
  sessions: SessionsSeam;
  /** Duong remote cua Host. */
  remote: RemoteSeam;
  /** Tai lieu cau hinh. */
  configForms: ConfigFormsSeam;
  /** Khong gian lam viec. */
  uiWorkspace: UiWorkspaceSeam;
}

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package. */
  readonly name: string;
  /** Seam can co. */
  readonly inject: readonly string[];
  /** Than plugin. */
  readonly apply: (ctx: ClientCtx) => void;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let uiAgentPresetInstalled = false;

/**
 * Chen mot the style neu chua co.
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong co.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chen CSS cua ca nam module, dung thu tu nhu ban goc (nhan, muc tao plugin, chip, huong dan, khung).
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.label, typeof __GBH_UI_AGENT_PRESET_LABEL_CSS__ === "string" ? __GBH_UI_AGENT_PRESET_LABEL_CSS__ : "");
  injectStyle(STYLE_TAGS.createPluginItem, typeof __GBH_UI_AGENT_PRESET_CREATE_PLUGIN_CSS__ === "string" ? __GBH_UI_AGENT_PRESET_CREATE_PLUGIN_CSS__ : "");
  injectStyle(STYLE_TAGS.seat, typeof __GBH_UI_AGENT_PRESET_SEAT_CSS__ === "string" ? __GBH_UI_AGENT_PRESET_SEAT_CSS__ : "");
  injectStyle(STYLE_TAGS.guideDialog, typeof __GBH_UI_AGENT_PRESET_GUIDE_CSS__ === "string" ? __GBH_UI_AGENT_PRESET_GUIDE_CSS__ : "");
  injectStyle(STYLE_TAGS.section, typeof __GBH_UI_AGENT_PRESET_SECTION_CSS__ === "string" ? __GBH_UI_AGENT_PRESET_SECTION_CSS__ : "");
}

/**
 * Dung mat plugin cua row ui-agent-preset.
 *
 * Bon be mat tren MOT so preset: chip o man hinh phien moi cho phien sap bat dau, nhan chi doc trong
 * hang dau phien, muc trong menu them plugin, va mot khuc trong cai dat liet ke ca so.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as { jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown; jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown; Fragment: unknown };
  const react = requireFn("react") as ReactLike;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Primitives;
  const createStore = (requireFn("@galaxy-blackhole/gbh-client-store") as StoreModule).createSnapshotStore;
  injectStyles();
  const runtime = { jsx: jsxRuntime.jsx, jsxs: jsxRuntime.jsxs, Fragment: jsxRuntime.Fragment };
  const AgentPresetLabel = createAgentPresetLabel({ runtime, react, primitives });
  const CreatePluginMenuItem = createCreatePluginMenuItem({ runtime, react, primitives });
  const AgentPresetSeat = createAgentPresetSeat({ runtime, react, primitives });
  const { PresetGuideDialog } = createPresetGuideDialog({ runtime, react, primitives });
  const AgentPresetSection = createAgentPresetSection({ runtime, react, primitives, PresetGuideDialog });

  return {
    name: PACKAGE_NAME,
    inject: SERVICE_INJECT,
    /**
     * Than plugin: dung bon be mat tren mot so preset roi dang ky bon slot cua ban goc (idempotent).
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientCtx): void {
      if (uiAgentPresetInstalled) {
        console.warn("gbh-client-ui-agent-preset: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi
        //   co da = true ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
        //   undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        uiAgentPresetInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-agent-preset: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: bon be mat, cong cu phat trien, tu dien va bon slot nguyen van cua ban goc.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: ClientCtx): void {
    const toolsSettings = ctx.configForms.get("ui-settings");
    const presetSettings = ctx.configForms.get(AGENT_PRESET_SETTINGS_NS);
    let active = true;
    const codingToolsDisabled = (): boolean => active && toolsSettings.getSnapshot().value?.enabled === false;
    const controller = new AgentPresetSettingsController(ctx, createStore);
    const staged: StagedPreset = { id: undefined, introduce: false };
    const seats = new WeakMapWithValues<SessionBinding, AgentPresetSeatController>();
    const boundSeatDisposers = new Set<() => void>();
    ctx.effect(
      () => async () => {
        await Promise.all([...boundSeatDisposers].map((dispose) => dispose()));
      },
      EFFECT.boundSelections,
    );
    const unboundSeat = new AgentPresetSeatController(ctx, () => undefined, staged, createStore);
    const seatFor = (binding: SessionBinding): AgentPresetSeatController => {
      const existing = seats.get(binding);
      if (existing !== undefined) return existing;
      const seat = new AgentPresetSeatController(
        ctx,
        () => {
          if (ctx.sessions.binding(binding.sessionId) !== binding) return undefined;
          const summary = ctx.sessions.list.getSnapshot().byId[binding.sessionId];
          return summary !== undefined && (ctx.sessions.retainInfo(binding.sessionId).getSnapshot().retainedBy.mainView ?? 0) > 0 ? summary : undefined;
        },
        staged,
        createStore,
      );
      seats.set(binding, seat);
      const dispose = binding.ctx.effect(() => {
        const stop = ctx.sessions.list.subscribe(() => {
          void seat.apply();
        });
        return () => {
          stop();
          seats.delete(binding);
          boundSeatDisposers.delete(dispose);
        };
      }, EFFECT.providerBinding);
      boundSeatDisposers.add(dispose);
      return seat;
    };
    const section = new AgentPresetSectionController(ctx, createStore);
    const developerTools = ctx.configForms.developerTools.enabled;
    ctx.effect(
      () =>
        developerTools.subscribe(() => {
          if (developerTools.getSnapshot()) return;
          staged.id = undefined;
          staged.introduce = false;
          void unboundSeat.apply();
          for (const seat of seats.values) void seat.apply();
        }),
      EFFECT.developerToolsGate,
    );
    const mainBlankSeat = (): AgentPresetSeatController | undefined => {
      const summary = Object.values(ctx.sessions.list.getSnapshot().byId).find((session) => {
        return session !== undefined && session.blank === true && (session.retainedBy?.mainView ?? 0) > 0;
      });
      const binding = summary === undefined ? undefined : ctx.sessions.binding(summary.id);
      return binding === undefined ? undefined : seatFor(binding);
    };
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    ctx.effect(() => {
      let requested = 0;
      let pending: Promise<void> | undefined;
      const reconcile = (): void => {
        requested++;
        pending ??= Promise.resolve().then(async () => {
          try {
            for (;;) {
              const revision = requested;
              await section.reconcileCodingTools(codingToolsDisabled);
              if (!active || requested === revision) return;
            }
          } finally {
            pending = undefined;
          }
        });
      };
      const refresh = (): void => {
        void controller.load();
        if (section.store.getSnapshot().status !== "idle") void section.load();
        void unboundSeat.load();
        for (const seat of seats.values) void seat.load();
        reconcile();
      };
      const disposers = [
        toolsSettings.subscribe(reconcile),
        presetSettings.subscribe(reconcile),
        ctx.remote.$on("settings/document-updated", (ns) => {
          if (ns !== AGENT_PRESET_SETTINGS_NS) return;
          refresh();
        }),
        ctx.on("connection/reset", refresh),
      ];
      reconcile();
      return async () => {
        active = false;
        for (const dispose of disposers) dispose();
        await pending;
      };
    }, EFFECT.settingsRefresh);
    let creatorDraft: (() => void) | undefined;
    ctx.inject(SCOPE_INJECT, (scope) => {
      const seatInjected = (sessionId: string | undefined): SeatInjected => {
        const binding = sessionId === undefined ? undefined : ctx.sessions.binding(sessionId);
        const seat = binding === undefined ? unboundSeat : seatFor(binding);
        return {
          hooks: { agentPresetSeat: seat.store, developerTools: ctx.configForms.developerTools.enabled },
          load: () => void seat.load(),
          select: (id: string) => void seat.select(id),
          dismissRefusal: (error: SeatRefusal) => {
            seat.dismissRefusal(error);
          },
          introduced: () => {
            seat.introduced();
          },
        };
      };
      const labelInjected = (): LabelInjected => ({
        hooks: { agentPresets: controller.store },
        load: () => void controller.load(),
      });
      const startCreatorDraft = (): void => {
        (mainBlankSeat() ?? unboundSeat).stage(CREATOR_PRESET_ID, true);
        scope.uiWorkspace.startSession(undefined, { clearPreviousDraft: false, agentPreset: CREATOR_PRESET_ID });
      };
      scope.effect(() => {
        creatorDraft = startCreatorDraft;
        const chip = scope.slots.register(
          { name: "conversation.hero.agentPreset", locale: NS, inject: seatInjected },
          AgentPresetSeat,
        );
        const label = scope.slots.register(
          { name: "conversation.session.header.actions", id: HEADER_LABEL_ID, order: HEADER_LABEL_ORDER, locale: NS, inject: labelInjected },
          AgentPresetLabel,
        );
        return () => {
          creatorDraft = undefined;
          chip();
          label();
        };
      }, EFFECT.chipAndLabel);
      scope.slots.inject("plugins.add.actions", () =>
        scope.slots.register(
          {
            name: "plugins.add.actions",
            id: CREATE_PLUGIN_ID,
            locale: NS,
            inject: (): CreatePluginInjected => ({
              hooks: { agentPresets: controller.store },
              load: () => void controller.load(),
              startCreatorDraft,
            }),
          },
          CreatePluginMenuItem,
        ),
      );
    });
    /**
     * Ghi lai dung phien trong ma mot hanh dong cua Settings co the cap nhat.
     * Nhan: khong co.
     * Tra: ham dong bo chi ap dung khi ghe va phien van con dung.
     */
    const captureBlankSessionSync = (): ((id: string) => Promise<string | undefined>) => {
      const summary = Object.values(ctx.sessions.list.getSnapshot().byId).find(
        (session) => session !== undefined && session.blank === true && (session.retainedBy?.mainView ?? 0) > 0,
      );
      const binding = summary === undefined ? undefined : ctx.sessions.binding(summary.id);
      const seat = binding === undefined ? undefined : seatFor(binding);
      const sessionId = seat?.blankSessionId();
      return async (id: string) => {
        if (seat === undefined || sessionId === undefined || binding === undefined || seats.get(binding) !== seat) return undefined;
        return await seat.syncBlankSession(sessionId, id);
      };
    };
    const sectionInjected = (): SectionInjected => ({
      hooks: { agentPresetSection: section.store, developerTools: ctx.configForms.developerTools.enabled },
      load: () => void section.load(),
      view: (id: string) => void section.view(id),
      closeView: () => {
        section.closeView();
      },
      ...(creatorDraft === undefined ? {} : { startCreatorDraft: creatorDraft }),
      makeDefault: (id: string) => void section.makeDefault(id, captureBlankSessionSync()),
    });
    ctx.slots.inject(SLOT_SETTINGS_SECTION, () =>
      ctx.slots.register(
        {
          name: "settings.section",
          id: SECTION_ID,
          order: SECTION_ORDER,
          label: () => ctx.locale.bind(NS)("nav"),
          locale: NS,
          inject: sectionInjected,
        },
        AgentPresetSection,
      ),
    );
  }
}
