/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mat plugin cua row ui-model-selection: dich vu thu muc model, hai bang tu dien, lenh /model va ghe composer
 */

import { ModelDirectory } from "./directory.ts";
import {
  ACCOUNT_PROVIDER_ID,
  COMMAND_NAME,
  EFFECT,
  FAILED_GROUP_MESSAGE,
  INJECT,
  NS,
  SLOT_MODEL,
  UNAVAILABLE_MESSAGE,
  WRITER_HELD,
} from "./ids.ts";
import { en, zh } from "./locales.ts";
import { createModelSelect } from "./model-select.ts";
import { orderModelProviders } from "./provider-order.ts";
import { createModelDirectoryResolver, type ModelDirectoryResolverConstructor } from "./service.ts";
import { configureStoreFactory } from "./store.ts";
import { requireModule } from "./runtime.ts";
import type {
  CordisModule,
  JsxRuntime,
  Primitives,
  ReactDomLike,
  ReactLike,
  RequireFn,
  Translator,
} from "./runtime.ts";
import type {
  ClientCtx,
  CommandUiFace,
  CreateSnapshotStore,
  DirectoryContract,
  ModelDirectoryState,
  ModelSelectInjected,
  ModelSelection,
} from "./types.ts";

/** Module store cua DSH: chi ham tao store anh chup ma row nay dung. */
interface StoreModule {
  /** Tao store anh chup voi gia tri dau. */
  createSnapshotStore: CreateSnapshotStore;
}

/** Mot phien ma lenh /model nhan (chi truong that su doc). */
export interface CommandSession {
  /** Id phien. */
  readonly sessionId: string;
}

/** Mot dong lua chon cua popup /model (id la khoa mo, khong bao gio bi phan tich). */
export interface CommandOption {
  /** Khoa dong — ban goc: "<provider>/<model>" hoac "failure/<provider>". */
  id: string;
  /** Nhan hien thi. */
  label: string;
  /** Nhom hien thi (chi dong model co). */
  group?: { readonly name: string; readonly label: string };
  /** Chi tiet loi (chi dong provider loi co). */
  detail?: string;
  /** Dong dang duoc chon. */
  active?: boolean;
}

/** Exports ma bundle tra ve cho Loader — NGUYEN VAN ten cua ban goc. */
export interface ClientPluginExports {
  /** Lop thu muc model cua mot phien. */
  readonly ModelDirectory: typeof ModelDirectory;
  /** Lop dich vu ctx.modelDirectories. */
  readonly ModelDirectoryResolver: ModelDirectoryResolverConstructor;
  /**
   * Than plugin phia client.
   * Nhận: ctx — context goc phia client.
   * Trả: khong co.
   */
  readonly apply: (ctx: ClientCtx) => void;
  /** Danh sach dich vu yeu cau (nguyen van cua ban goc). */
  readonly inject: readonly string[];
}

/**
 * Mot khoa dong cua popup /model: "<provider>/<model>".
 * Nhận: providerId — id provider; modelId — id model.
 * Trả: chuoi khoa mo.
 */
function rowId(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

/**
 * Trai thu muc thanh cac dong cua popup; dong provider loi van hien nhung khong chon duoc.
 * Nhận: directory — anh chup thu muc cua phien; t — ham dich cua namespace model.
 * Trả: danh sach dong theo thu tu provider da sap xep.
 */
function optionsOf(directory: ModelDirectoryState, t: Translator): CommandOption[] {
  const rows: CommandOption[] = [];
  for (const group of orderModelProviders(directory.groups)) {
    const name = group.id === ACCOUNT_PROVIDER_ID ? t("provider.account") : group.name;
    for (const model of group.models) {
      rows.push({
        id: rowId(group.id, model.id),
        label: model.name,
        group: {
          name: group.id,
          label: name,
        },
        ...(directory.current !== null &&
        directory.current.provider === group.id &&
        directory.current.model === model.id
          ? { active: true }
          : {}),
      });
    }
  }
  for (const failure of directory.failures) {
    rows.push({
      id: `failure/${failure.id}`,
      label: failure.id === ACCOUNT_PROVIDER_ID ? t("provider.account") : failure.name,
      detail: t("option.loadError", { message: failure.message }),
    });
  }
  return rows;
}

/**
 * Giai mot dong da chon nguoc ve lua chon model bang cach doi chieu voi cac nhom da nap
 * (cung du lieu da dung de dung dong — id van la khoa mo).
 * Nhận: state — anh chup thu muc cua phien; id — khoa dong da chon.
 * Trả: lua chon model cua dong, hoac undefined voi dong loi / id cu.
 */
function selectionOf(state: ModelDirectoryState, id: string): ModelSelection | undefined {
  for (const group of state.groups) {
    for (const model of group.models) {
      if (rowId(group.id, model.id) !== id) continue;
      const reasoningEffort =
        state.current?.provider === group.id && state.current.model === model.id
          ? (state.current?.reasoningEffort ?? model.reasoning?.defaultEffort)
          : model.reasoning?.defaultEffort;
      return {
        provider: group.id,
        model: model.id,
        ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
      };
    }
  }
  return undefined;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE (khuon cua 41 goi da port, bai hoc 18/10/2026:
// slot "single" chi mot chu; bundle chay hai lan ⇒ "already has a registration" ⇒ app trang).
let installed = false;

/**
 * Dung mat plugin cua row ui-model-selection.
 *
 * Thu muc model dung chung cho hai loi vao (popup /model va ghe composer), hai bang tu dien cua namespace
 * "model", mot lenh /model va mot ghe "conversation.input.model".
 * Nhận: requireFn — ham nap module cua bang module trang.
 * Trả: exports ma Loader dung (apply + inject + hai lop nhu ban goc).
 */
export function createPlugin(requireFn: RequireFn): ClientPluginExports {
  const jsxRuntime = requireModule<JsxRuntime>(requireFn, "react/jsx-runtime");
  const react = requireModule<ReactLike>(requireFn, "react");
  const reactDom = requireModule<ReactDomLike>(requireFn, "react-dom");
  const primitives = requireModule<Primitives>(requireFn, "@galaxy-blackhole/gbh-client-ui-primitives");
  const store = requireModule<StoreModule>(requireFn, "@galaxy-blackhole/gbh-client-store");
  const cordis = requireModule<CordisModule>(requireFn, "@deepseek-ai/cordis");
  configureStoreFactory(store.createSnapshotStore);
  const ModelDirectoryResolver = createModelDirectoryResolver(cordis.Service);
  const ModelSelect = createModelSelect({ runtime: jsxRuntime, react, reactDom, primitives });

  return {
    ModelDirectory,
    ModelDirectoryResolver,
    inject: INJECT,
    /**
     * Client plugin body: mount ModelDirectoryResolver, register the `model` dictionaries,
     * then register the /model popup contribution and the composer model seat over the service.
     * Nhận: ctx — client root context.
     * Trả: khong co.
     */
    apply(ctx: ClientCtx): void {
      if (installed) {
        console.warn("gbh-client-ui-model-selection: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // Bat co SAU KHI dang ky xong (bai hoc ui-settings-general 18/10/2026: bat som ⇒ lan hai thoat ⇒ slot khong bao gio duoc dang ky).
        installed = true;
      } catch (error) {
        console.error(
          "gbh-client-ui-model-selection: apply nem loi — " + (error instanceof Error ? error.message : String(error)),
        );
        throw error;
      }
    },
  };

  /**
   * Than cua apply: tu dien, dich vu thu muc, lenh /model va ghe composer.
   * Nhận: ctx — context goc phia client.
   * Trả: khong co.
   */
  function applyInner(ctx: ClientCtx): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), EFFECT.dictionaries);
    const t = ctx.locale.bind(NS);
    ctx.plugin(ModelDirectoryResolver);
    ctx.inject(["commandUi", "modelDirectories"], (scope) => {
      const command = scope.get("commandUi") as CommandUiFace;
      const models = scope.modelDirectories;
      const sessions = scope.sessions;
      scope.effect(
        () =>
          command.register({
            name: COMMAND_NAME,
            label: () => t("command.label"),
            description: () => t("command.description"),
            icon: primitives.IconDataOutlineRegular,
            available: (session: CommandSession) => sessions.subagentAddress(session.sessionId) === undefined,
            ui: {
              kind: "popupSelect",
              searchMode: "fuzzy-label",
              searchLabels: () => ({
                placeholder: t("search.placeholder"),
                empty: t("empty.models"),
                noResults: t("search.empty"),
              }),
              options: async (session: CommandSession): Promise<CommandOption[]> => {
                if (sessions.subagentAddress(session.sessionId) !== undefined) throw new Error(UNAVAILABLE_MESSAGE);
                return optionsOf(await models.directoryFor(session.sessionId).load(), t);
              },
              onSelect: async (option: CommandOption, session: CommandSession): Promise<void> => {
                if (sessions.subagentAddress(session.sessionId) !== undefined) throw new Error(UNAVAILABLE_MESSAGE);
                const directory = models.directoryFor(session.sessionId);
                const selection = selectionOf(directory.store.getSnapshot(), option.id);
                if (selection === undefined) throw new Error(FAILED_GROUP_MESSAGE);
                const result = await directory.select(selection);
                if (!result.ok) {
                  if (result.error.code === WRITER_HELD) throw new Error(t("error.sessionInUse"));
                  throw result.error;
                }
              },
            },
          }),
        EFFECT.modelContribution,
      );
    });
    ctx.inject(["slots", "modelDirectories"], (scope) => {
      const models = scope.modelDirectories;
      const sessions = scope.sessions;
      // LUẬT GATE (19/10/2026): "check:rows" quét VĂN BẢN src để đối chiếu slot với bản gốc ⇒ phải dùng
      // CHUỖI LITERAL ở đây (hằng số làm cổng báo "thieu dang ky slot conversation.input.model").
      scope.slots.inject("conversation.input.model", () =>
        scope.slots.register(
          {
            name: "conversation.input.model",
            locale: NS,
            inject: (sessionId: string): ModelSelectInjected => {
              const directory: DirectoryContract = models.directoryFor(sessionId);
              const available = sessions.subagentAddress(sessionId) === undefined;
              return {
                available,
                directory: directory.store,
                load: () => {
                  if (available) directory.load().catch(() => {});
                },
                select: (selection: ModelSelection) =>
                  available ? directory.select(selection) : Promise.resolve(undefined),
              };
            },
          },
          ModelSelect,
        ),
      );
    });
  }
}