/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng `presentation` của bundle gốc (client.js dòng 571-730): 7 hàm nhãn/toast của màn Plugins
 *      — tên registry, câu thông báo theo mã lỗi, tên gói rút gọn, chữ của gói/row, câu nhắc khởi động lại, câu toast.
 */

import type { FailedAction, IncompatiblePlugin, ManagementError, ManagerNotice, PackageRow, PackageView, PluginManagerFace, Registry, RestartReason } from "./manager-actions.ts";

/** Nhắc lại kiểu lỗi quản trị của Host cho nơi chỉ import từ tệp này (bản gốc lấy từ `dsh-api-remotes/client`). */
export type { IncompatiblePlugin, ManagementError, RestartReason } from "./manager-actions.ts";

/**
 * Ghế dịch của sổ từ điển `pluginManager` (bản gốc: `PropsLocale<'pluginManager'>['t']`).
 * Nhận: `key` — khoá từ điển; `params` — giá trị nội suy cho các ô `{ten}`.
 * Trả: câu đã dịch.
 */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Hàm giải chữ của gói theo ngôn ngữ hiện tại (bản gốc: `PluginManagerFace['resolveText']`). */
type ResolveText = PluginManagerFace["resolveText"];

/** Host registry chính thức của npm (đọc theo TÊN chứ không theo host). */
export const OFFICIAL_NPM_HOST = "registry.npmjs.org";

/** Các registry có TÊN RIÊNG, theo host (bản gốc chỉ có npmmirror). */
export const REGISTRY_COPY: ReadonlyMap<string, string> = new Map<string, string>([
  ["registry.npmmirror.com", "registryNpmmirror"],
]);

/** Câu mỗi mã lỗi của Host đọc ra sao (13 mã, nguyên văn từ bản gốc). */
export const CODE_KEYS: Readonly<Record<string, string>> = {
  "management-required": "reasonManagementRequired",
  unaddressable: "reasonUnaddressable",
  "unknown-plugin": "reasonUnknownPlugin",
  "invalid-spec": "reasonInvalidSpec",
  "already-installed": "reasonAlreadyInstalled",
  "ambiguous-install": "reasonAmbiguousInstall",
  "not-bundle": "reasonNotBundle",
  "not-removable": "reasonNotRemovable",
  "stop-profile": "reasonStopProfile",
  "bundle-in-use": "reasonBundleInUse",
  "stale-approval": "reasonStaleApproval",
  "incompatible-version": "reasonIncompatibleVersionUnnamed",
  "operation-error": "reasonOperationError",
};

/** Câu mở đầu của một thao tác thất bại, theo việc đang làm (5 việc). */
export const FAILED_KEYS: Readonly<Record<FailedAction, string>> = {
  enable: "failedEnable",
  disable: "failedDisable",
  uninstall: "failedUninstall",
  rowEnable: "failedRowEnable",
  rowDisable: "failedRowDisable",
};

/** Câu nêu LÝ DO một thay đổi phải chờ lần khởi động sau (5 lý do, nguyên văn bản gốc). */
export const RESTART_REASON_KEYS: Readonly<Record<RestartReason, string>> = {
  "no-hmr": "restartReasonNoHmr",
  "package-moved": "restartReasonPackageMoved",
  "host-module": "restartReasonHostModule",
  "unmanaged-plugin": "restartReasonUnmanagedPlugin",
  "module-comparison": "restartReasonModuleComparison",
};

/**
 * Host của một URL registry; URL không parse được thì trả NGUYÊN chuỗi (bản gốc làm vậy).
 * Nhận: chuỗi registry người dùng/Host khai.
 * Trả: host, hoặc chính chuỗi đó khi không parse được.
 */
export function registryHost(registry: string): string {
  try {
    return new URL(registry).host;
  } catch {
    return registry;
  }
}

/**
 * Tên hiển thị của registry đang dùng, kèm host để đối chiếu.
 *
 * Bản gốc: `url = registry ?? resolved` — registry do pnpm tự khai đọc THEO URL nó nêu, nên nhãn không bao giờ
 * nhận vơ "npm chính thức" cho một registry khác.
 * Nhận: `registry` — registry (null = registry do pnpm tự khai); `t` — ghế dịch; `resolved` — URL pnpm tự khai
 * (null khi Host chưa đọc được; bỏ trống thì coi như null, đúng nhánh cũ của bản port trước).
 * Trả: { name, host } — null/không khai ⇒ câu mặc định; host npm chính thức ⇒ câu riêng;
 *      host có tên riêng trong REGISTRY_COPY ⇒ câu riêng; còn lại ⇒ chính host.
 */
export function registryText(registry: Registry, t: Translate, resolved: string | null = null): { name: string; host: string } {
  const url = registry ?? resolved;
  if (url === null) return { name: t("registryDefault"), host: OFFICIAL_NPM_HOST };
  const host = registryHost(url);
  const key = host === OFFICIAL_NPM_HOST ? "registryOfficial" : REGISTRY_COPY.get(host);
  return { name: key === undefined ? host : t(key), host };
}

/**
 * Câu thông báo của một lỗi quản trị.
 *
 * Ba nhánh của bản gốc: (1) `incompatible-version` ⇒ một câu cho MỖI gói được nêu tên (tên@phiên bản, DSH đang chạy,
 * các yêu cầu không thoả) rồi câu khắc phục (bản đang cài hay bản đã cài), nối bằng `sentenceSeparator`;
 * (2) `operation-error` ⇒ nguyên văn chẩn đoán của Host; (3) mã còn lại ⇒ câu của mã.
 *
 * Nhận: `error` — mã của Host, chẩn đoán, các gói mà lỗi không tương thích nêu tên, và cờ `installing`;
 * `t` — ghế dịch.
 * Trả: câu hiển thị.
 * GHI CHÚ: `message` là bí danh của `diagnostic` do bản port trước dùng; giữ để test cũ và trang cũ không vỡ.
 */
export function managementText(error: ManagementError, t: Translate): string {
  if (error.code === "incompatible-version") {
    const named = error.incompatible ?? [];
    const sentences = named.length === 0
      ? [t("reasonIncompatibleVersionUnnamed")]
      : named.map((plugin) => t("reasonIncompatibleVersion", {
        plugin: `${plugin.name}@${plugin.version}`,
        runtime: plugin.runtimeVersion,
        requirements: Object.entries(plugin.requirements).map(([name, range]) => `${name} ${range}`).join(", "),
      }));
    return [...sentences, t(error.installing ? "reasonIncompatibleInstall" : "reasonIncompatibleInstalled")].join(t("sentenceSeparator"));
  }
  if (error.code !== "operation-error") {
    const key = CODE_KEYS[error.code];
    return key === undefined ? error.code : t(key);
  }
  const diagnostic = error.diagnostic ?? error.message;
  return diagnostic === undefined || diagnostic === "" ? t("reasonOperationError") : diagnostic;
}

/**
 * Rút tên gói về cách người ta gọi nó.
 * Nhận: `name` — tên gói (có thể có scope).
 * Trả: tên không scope, bỏ tiền tố của harness (`dsh-`, `dsh-host-`, `dsh-client-`).
 */
export function shortName(name: string): string {
  return (name.startsWith("@") ? name.slice(name.indexOf("/") + 1) : name).replace(/^dsh-(?:host-|client-)?/, "");
}

/**
 * Giải chữ hiển thị của một gói đã cài mà KHÔNG đổi danh tính kỹ thuật của nó.
 * Nhận: `pkg` — tên gói + meta bản địa; `resolveText` — hàm giải chữ theo ngôn ngữ hiện tại.
 * Trả: { title, description, beta } — tiêu đề (rơi về tên kỹ thuật khi thiếu), mô tả (undefined khi thiếu/rỗng),
 *      và cờ beta ĐỘC LẬP với phần chữ (theo tiền tố `@deepseek-ai/dsh-experimental-`).
 */
export function packageText(pkg: Pick<PackageView, "name" | "meta">, resolveText: ResolveText): { title: string; description: string | undefined; beta: boolean } {
  return {
    title: pkg.meta?.title === undefined ? pkg.name : resolveText(pkg.meta.title),
    description: pkg.meta?.description === undefined ? undefined : resolveText(pkg.meta.description) || undefined,
    beta: pkg.name.startsWith("@deepseek-ai/dsh-experimental-"),
  };
}

/**
 * Giải chữ hiển thị của một row trong bundle, dùng CHÍNH module specifier làm chỗ rơi cuối của tiêu đề.
 * Nhận: `row` — danh tính row + meta bản địa; `resolveText` — hàm giải chữ theo ngôn ngữ hiện tại.
 * Trả: { title, description } của row.
 */
export function rowText(row: Pick<PackageRow, "moduleName" | "meta">, resolveText: ResolveText): { title: string; description: string | undefined } {
  return {
    title: row.meta?.title === undefined ? row.moduleName : resolveText(row.meta.title),
    description: row.meta?.description === undefined ? undefined : resolveText(row.meta.description) || undefined,
  };
}

/**
 * Câu nhắc khởi động lại kèm lý do.
 * Nhận: `key` — câu của lời nhắc (nhận lý do qua ô `{reason}`); `reason` — vì sao thay đổi chờ lần khởi động sau;
 * `t` — ghế dịch.
 * Trả: câu đã ghép (cắt khoảng trắng cuối, đúng bản gốc `trimEnd`).
 */
export function restartText(key: "restartNotice" | "installDoneRestart", reason: RestartReason | undefined, t: Translate): string {
  return t(key, { reason: reason === undefined ? "" : t(RESTART_REASON_KEYS[reason]) }).trimEnd();
}

/**
 * Câu mà MỘT toast hiển thị.
 * Nhận: `notice` — kết cục của thao tác vừa rồi (6 kiểu); `t` — ghế dịch.
 * Trả: câu hiển thị (kiểu `failed`: câu mở đầu theo việc đang làm + lý do đã dịch, rỗng thì dùng câu lỗi chung).
 */
export function noticeText(notice: ManagerNotice, t: Translate): string {
  switch (notice.kind) {
    case "restart":
      return restartText("restartNotice", notice.reason, t);
    case "overridden":
      return t("overriddenNotice", { name: notice.packageName });
    case "cancelled":
      return t("installCancelled");
    case "refresh-failed":
      return t("refreshError");
    case "install":
      return t({
        done: "installBackgroundDone",
        failed: "installBackgroundFailed",
        unconfirmed: "installBackgroundUnconfirmed",
        applying: "installBackgroundApplying",
        unknown: "installBackgroundUnknown",
      }[notice.outcome]);
    case "failed": {
      const reason = notice.code === undefined
        ? notice.reason
        : managementText({
          code: notice.code,
          diagnostic: notice.reason,
          ...notice.incompatible === undefined ? {} : { incompatible: notice.incompatible },
        }, t);
      return t(FAILED_KEYS[notice.action], { reason: reason === "" ? t("reasonOperationError") : reason });
    }
  }
}
