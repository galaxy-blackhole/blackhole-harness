/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bon adapter cua nut mo: thu muc phien, thu muc cay tep, tai lieu, the ban giao
 */

import type { OpenInAppLaunchState, OpenInAppPathAction, OpenInAppPathFailure } from "./controller.ts";
import type { ApplicationsQuery, FileApplicationsState } from "./file-applications.ts";
import type { OpenTargetApplication, OpenTargetButtonProps, OpenTargetOperation, TranslateLike } from "./open-target.ts";
import type { JsxRuntimeLike, ReactLike, SessionRowLike, ShortcutCatalogEntry } from "./types.ts";

/** Face ma `directoryInjected` tiem vao hai occupant thu muc (hook + thao tac + dia chi icon). */
export interface DirectoryFace {
  /** Hook doc danh muc ung dung da cai. */
  useOpenInAppApps: <T>(selector: (apps: readonly string[] | null) => T) => T;
  /** Hook doc lua chon da luu. */
  useOpenInAppChoice: <T>(selector: (choice: string) => T) => T;
  /** Hook doc trang thai lan mo. */
  useOpenInAppLaunch: <T>(selector: (state: OpenInAppLaunchState) => T) => T;
  /** Hook doc bang phim tat da resolve. */
  useShortcuts: <T>(selector: (rows: readonly ShortcutCatalogEntry[]) => T) => T;
  /** Mo mot ung dung tren mot thu muc. */
  launch: (appId: string, path: string) => Promise<void>;
  /** Ghi nho ung dung vua chon. */
  choose: (appId: string) => void;
  /** Dia chi icon cua mot ung dung (route cua nua host). */
  iconUrl: (appId: string) => string;
  /** Ham dich cua namespace. */
  t: TranslateLike;
}

/** Props cua occupant thu muc: face tiem vao + duong dan tuyet doi cua dich. */
export type OpenInAppActionProps = DirectoryFace & {
  /** Duong dan tuyet doi cua thu muc dang hien. */
  absolutePath: string;
};

/** Props cua occupant o tieu de phien: face tiem vao + props chuan cua phien. */
export type SessionOpenInAppActionProps = DirectoryFace & {
  /** Id phien dang hien. */
  sessionId: string;
  /** Hook doc danh sach phien. */
  useSessions: <T>(selector: (state: { byId: Record<string, SessionRowLike> }) => T) => T;
};

/** Face ma `pathInjected` tiem vao hai occupant tai lieu. */
export interface PathFace {
  /** Hook doc nang luc desktop cua Host. */
  useOpenInAppDesktop: <T>(selector: (available: boolean | null) => T) => T;
  /** Doc nang luc desktop (mot lan moi trang). */
  loadDesktop: () => Promise<void>;
  /** Mo hoac hien mot duong dan. */
  openPath: (path: string, action: OpenInAppPathAction, application?: string) => Promise<OpenInAppPathFailure | null>;
  /** Doc hiep tro cua mot tep. */
  applications: ApplicationsQuery;
  /** Ham dich cua namespace. */
  t: TranslateLike;
  /** Duong dan tuyet doi cua tep dang xem. */
  absolutePath: string;
}

/** Props cua hai occupant tai lieu. */
export type OpenPathActionProps = PathFace;

/** Props cua hai occupant the ban giao (owner cap route da xac thuc + cu chi native). */
export interface FileRouteActionProps {
  /** Route hanh dong tuong doi tai lieu, mang toa do su kien cua phien. */
  actionUrl: string;
  /** Desktop cua Host co san khong. */
  available: boolean;
  /** Owner dang chay mot thao tac khac. */
  pending: boolean;
  /** Thuc thi hanh dong native da chon. */
  onAction: (action: OpenInAppPathAction, application?: string) => Promise<string | null>;
  /** Ham dich cua namespace. */
  t: TranslateLike;
}

/** Phu thuoc ma {@link makeActions} can. */
export interface ActionDeps {
  /** `react/jsx-runtime`. */
  jsxRuntime: JsxRuntimeLike;
  /** `react`. */
  react: ReactLike;
  /** Hook chia se hiep tro tep. */
  useFileApplications: (target: string, query: ApplicationsQuery, enabled: boolean) => FileApplicationsState & { refresh: () => void };
  /** Nut mo dung chung. */
  OpenTargetButton: (props: OpenTargetButtonProps) => unknown;
  /** Bo doc hiep tro qua route da xac thuc. */
  queryRoute: ApplicationsQuery;
  /** Bang anh xa id ung dung -> khoa nhan. */
  appLabelKey: Record<string, string | undefined>;
}

/** Bang nam adapter ma {@link makeActions} tra ve. */
export interface ActionParts {
  /** Occupant o tieu de phien: lay cwd cua phien roi giao cho adapter thu muc. */
  SessionOpenInAppAction: (props: SessionOpenInAppActionProps) => unknown;
  /** Occupant thu muc: danh muc ung dung da cai + lenh mo. */
  OpenInAppAction: (props: OpenInAppActionProps) => unknown;
  /** Occupant thanh cong cu cua tab xem truoc tai lieu. */
  OpenPathAction: (props: OpenPathActionProps) => unknown;
  /** Occupant trang thai rong cua tai lieu khong xem truoc duoc (bien the lon co nhan). */
  OpenPathEmptyAction: (props: OpenPathActionProps) => unknown;
  /** Occupant the ban giao: di qua route da xac thuc cua phien dang so huu. */
  FileRouteAction: (props: FileRouteActionProps) => unknown;
}

/**
 * Dung nam adapter cua nut mo tren runtime va cac bo doc cua bang module.
 * Nhan: deps — runtime JSX, nut dung chung, hook hiep tro, bo doc route, bang nhan.
 * Tra: bang nam adapter {@link ActionParts}.
 */
export function makeActions(deps: ActionDeps): ActionParts {
  const jsx = deps.jsxRuntime.jsx;
  const { react } = deps;

  /** Adapter thu muc: danh muc ung dung da cai, lua chon da luu, va lenh mo. */
  function OpenInAppAction(props: OpenInAppActionProps): unknown {
    const available = props.useOpenInAppApps((apps) => apps);
    const choice = props.useOpenInAppChoice((id) => id);
    const operation = props.useOpenInAppLaunch((value) => value);
    const shortcut = props.useShortcuts((rows) => rows.find((row) => row.id === "workspace.openLocal"));
    const apps: OpenTargetApplication[] = (available ?? []).flatMap((id) => {
      const key = deps.appLabelKey[id];
      return key === undefined ? [] : [{ id, name: props.t(key), icon: props.iconUrl(id) }];
    });
    const preferred = apps.find((app) => app.id === choice) ?? apps[0];
    if (preferred === undefined) return null;
    return jsx(
      deps.OpenTargetButton,
      {
        kind: "directory",
        applications: apps,
        defaultId: preferred.id,
        failed: false,
        t: props.t,
        busy: operation.phase === "busy",
        shortcut,
        execute: async (intent: OpenTargetOperation): Promise<OpenInAppPathFailure | null> => {
          const id = intent.kind === "application" ? intent.id : preferred.id;
          try {
            await props.launch(id, props.absolutePath);
          } catch {
            return "openError";
          }
          if (intent.kind === "application") props.choose(id);
          return null;
        },
      },
      props.absolutePath,
    );
  }

  /** Adapter o tieu de phien: lay cwd cua phien dang hien roi giao lai cho adapter thu muc. */
  function SessionOpenInAppAction(props: SessionOpenInAppActionProps): unknown {
    const { sessionId, useSessions } = props;
    const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
    if (cwd === undefined || cwd === "") return null;
    return react.createElement(OpenInAppAction, { ...props, absolutePath: cwd });
  }

  /** Adapter tep: doc hiep tro cua tep roi giao lai cho nut dung chung. */
  function FileOpenTarget(props: OpenPathActionProps & { empty?: boolean }): unknown {
    const desktop = props.useOpenInAppDesktop((value) => value);
    const association = deps.useFileApplications(props.absolutePath, props.applications, desktop === true);
    react.useEffect(() => {
      if (desktop === null) void props.loadDesktop();
    }, [desktop, props.loadDesktop]);
    if (desktop !== true) return null;
    return jsx(
      deps.OpenTargetButton,
      {
        kind: "file",
        applications: association.apps,
        defaultId: association.apps.find((app) => app.default)?.id,
        loading: association.loading,
        failed: association.failed,
        prominent: props.empty === true,
        t: props.t,
        refresh: association.refresh,
        execute: (intent: OpenTargetOperation) =>
          props.openPath(props.absolutePath, intent.kind === "reveal" ? "reveal" : "open", intent.kind === "application" ? intent.id : undefined),
      },
      props.absolutePath,
    );
  }

  /** Adapter thanh cong cu cua tab xem truoc tai lieu. */
  function OpenPathAction(props: OpenPathActionProps): unknown {
    return jsx(FileOpenTarget, { ...props });
  }

  /** Adapter trang thai rong cua tai lieu khong xem truoc duoc — bien the lon co nhan. */
  function OpenPathEmptyAction(props: OpenPathActionProps): unknown {
    return jsx(FileOpenTarget, { ...props, empty: true });
  }

  /** Adapter the ban giao: khong di vong qua route da xac thuc cua phien so huu. */
  function FileRouteAction(props: FileRouteActionProps): unknown {
    const association = deps.useFileApplications(props.actionUrl, deps.queryRoute, props.available);
    if (!props.available) return null;
    return jsx(
      deps.OpenTargetButton,
      {
        kind: "file",
        applications: association.apps,
        defaultId: association.apps.find((app) => app.default)?.id,
        failed: association.failed,
        loading: association.loading,
        busy: props.pending,
        refresh: association.refresh,
        t: props.t,
        execute: async (intent: OpenTargetOperation): Promise<OpenInAppPathFailure | null> =>
          (await props.onAction(intent.kind === "reveal" ? "reveal" : "open", intent.kind === "application" ? intent.id : undefined)) as
            | OpenInAppPathFailure
            | null,
      },
      props.actionUrl,
    );
  }

  return { SessionOpenInAppAction, OpenInAppAction, OpenPathAction, OpenPathEmptyAction, FileRouteAction };
}
