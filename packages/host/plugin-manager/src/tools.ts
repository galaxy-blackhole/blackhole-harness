/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Port 1:1 'lib/types/tools.js' của @deepseek-ai/dsh-plugin-manager (149 dòng): tool hướng model
 *      'plugin_manager' — liệt kê plugin/bundle của profile hiện tại, bật/tắt, cài, gỡ, và quản lý miễn trừ
 *      phiên bản — dùng CÙNG service với điều khiển trên Web. Mọi action đòi quyền danger-full-access hoặc
 *      một lần duyệt cho đúng lượt gọi này; duyệt KHÔNG đổi chế độ quyền của phiên.
 */

import { assertNever } from "@deepseek-ai/dsh-util-values";
import { approveEscalation, type SandboxMode } from "@deepseek-ai/dsh-sandbox";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";
import { getDshRuntimeVersion } from "@deepseek-ai/dsh-app-boot";
import type { Context } from "@deepseek-ai/cordis";
import type {
  BundleInfo,
  ChangeResult,
  InstallBundleOptions,
  ManagementError,
  PluginInfo,
  PluginInstallFailureKind,
  RestartReason,
} from "./types.ts";

/** Việc model làm tiếp cho mỗi lời từ chối mà manager báo. */
const ERROR_STEPS: Readonly<Record<ManagementError["code"], string>> = {
  "management-required": "This entry belongs to plugin management itself and cannot be changed.",
  "unaddressable": "This entry has no unique profile patch target; tell the user to edit the profile patch file directly.",
  "unknown-plugin": "Call list_plugins and retry with an exact entryId.",
  "invalid-spec": "Retry with an npm package name, a git URL, a tarball URL, or an absolute local directory.",
  "already-installed": "The package is already installed; to install another version, call remove_bundle first, then install_bundle again.",
  "ambiguous-install": "The dependency change named no single package; call list_bundles to see what was installed.",
  "not-bundle": "The package declares no dsh.bundle and cannot be managed as a plugin; install a Galaxy Blackhole plugin bundle instead.",
  "not-removable": "Call list_bundles; only bundles marked removable can be removed.",
  "stop-profile": "This profile runs without HMR; tell the user to stop Galaxy Blackhole and run `dsh plugin --profile <profile> remove <bundle>`.",
  "bundle-in-use": "Call list_plugins, disable the entries from other layers that still use this bundle, then retry.",
  "stale-approval": "Call install_bundle again without approvedBuilds to read the current pendingBuilds.",
  "incompatible-version": "Install a version compatible with the running Galaxy Blackhole. A version exemption needs the user's explicit acceptance of crash and data-loss risk.",
  "operation-error": "Report the diagnostic to the user; retry only after its cause is addressed.",
};

/** Việc model làm tiếp cho mỗi thất bại của trình quản lý gói. */
const FAILURE_STEPS: Readonly<Partial<Record<PluginInstallFailureKind, string>>> = {
  "pnpm-missing": "pnpm is not available to Galaxy Blackhole; tell the user to install pnpm.",
  "timeout": "Retry, or retry with another registry.",
  "not-found": "Check the package name and version with the user, then retry.",
  "no-matching-version": "Retry with a published version.",
  "network": "Retry later or pass another registry.",
  "disk-full": "Tell the user to free disk space, then retry.",
  "permission": "Tell the user Galaxy Blackhole cannot write the profile directory; retry after they fix its permissions.",
  "build-blocked": "Ask the user whether to allow the install scripts of the packages in pendingBuilds; if they approve, retry with approvedBuilds.",
};

/** Vì sao một thay đổi chờ khởi động lại, đúng như model nói với người dùng. */
const RESTART_STEPS: Readonly<Record<RestartReason, string>> = {
  "no-hmr": "this profile applies changes only at startup",
  "package-moved": "an installed package now resolves to another directory, or the change replaces a package the Galaxy Blackhole installation provides; remove a package before installing it from another location",
  "host-module": "the change reaches modules Galaxy Blackhole itself loaded",
  "unmanaged-plugin": "the change reaches a plugin running outside the plugin list",
  "module-comparison": "Galaxy Blackhole could not compare loaded plugins with their files",
};

/** Phần service `pluginManager` mà tool này gọi (seam cấu trúc — repo CẤM augment Context). */
interface PluginManagerSeam {
  /** Đọc miễn trừ đúng cặp plugin/phiên bản đã lưu trong profile này. */
  listVersionExemptions(): { exemptions: Record<string, string[]>; warnings: string[] };
  /** Cấp hoặc thu hồi MỘT miễn trừ đúng cặp plugin/phiên bản và đánh giá lại plugin đang chạy. */
  setVersionExemption(packageVersion: string, runtimeVersion: string, enabled: boolean, acceptRisk?: boolean): Promise<ChangeResult>;
  /** Đọc plugin hiện tại, kèm lý do một row không sửa được qua patch của profile. */
  listPlugins(): Promise<PluginInfo[]>;
  /** Đọc bundle đã cài, do bản cài cấp, và mục danh mục Official ngoại tuyến, cộng các tên không phải bundle đang chọn. */
  listBundles(): Promise<BundleInfo[]>;
  /** Ghi enable mong muốn của một entry và áp dụng trên profile đang chạy. */
  setPluginEnabled(id: string, enabled: boolean): Promise<ChangeResult>;
  /** Chọn hoặc bỏ lớp của một bundle trong khi vẫn giữ các phụ thuộc đã cài. */
  setBundleEnabled(name: string, enabled: boolean): Promise<ChangeResult>;
  /** Cài một package bằng đúng pnpm mà `dsh plugin` dùng. */
  installBundle(spec: string, options?: InstallBundleOptions): Promise<ChangeResult>;
  /** Gỡ một phụ thuộc bundle thuộc profile qua đường pnpm của `dsh plugin`; tên đang chọn mà không phụ thuộc nào giữ chỉ bị bỏ chọn. */
  removeBundle(name: string): Promise<ChangeResult>;
}

/** Hình dạng tối thiểu của `ctx.sandboxPolicy` mà tool này đọc (seam cấu trúc). */
interface SandboxPolicySeam {
  /** Giải chính sách tác động tệp cho MỘT lời gọi: yêu cầu mang phiên của agent đang gọi, hoặc rỗng khi lượt gọi không có agent. */
  resolve(request: { readonly session?: unknown }): { readonly mode: SandboxMode };
}

/** Agent như tool này đọc: danh tính kèm phiên mà nó chạy trong đó (bản gốc là `Agent` đã được tầng agent-loop augment thêm `session`). */
interface AgentSeam {
  /** Phiên của agent đang gọi. */
  readonly session: unknown;
}

/**
 * Cổng duyệt ở BIÊN kernel: `approveEscalation` generic theo kiểu agent, nên khai seam CẤU TRÚC
 * mang `AgentSeam` của gói ta — agent của `gbh-agent` KHÁC lớp `Agent` của kernel nên không gán trực tiếp.
 */
interface ApprovalRequesterSeam {
  /**
   * Xin người dùng duyệt MỘT hành động.
   * Nhận: req — yêu cầu kiểm toán (agent đang gọi, tên tool, callId, lý do, nhãn hiển thị, tín hiệu huỷ).
   * Trả: kết cục ĐÓNG của cổng duyệt (allowed-once · rejected · cancelled · unavailable).
   */
  request(req: {
    agent: AgentSeam;
    toolName: string;
    callId: string;
    reason: string;
    displayReason?: { readonly en: string; readonly [locale: string]: string };
    signal?: AbortSignal;
  }): Promise<"allowed-once" | "rejected" | "cancelled" | "unavailable">;
}

/**
 * Kết quả hướng model của một thay đổi: kết quả của manager cộng bước kế tiếp mà kết cục của nó đòi hỏi.
 * Nhận: result — kết quả của manager.
 * Trả: chính kết quả đó, kèm `nextStep` khi nó KHÔNG phải là "đã áp dụng" rõ ràng.
 */
function withNextStep(result: ChangeResult): ChangeResult & { readonly nextStep?: string } {
  switch (result.application) {
    case "applied":
      return result;
    case "cancelled":
      return { ...result, nextStep: "The installation was cancelled and its files restored; nothing changed." };
    case "overridden":
      return { ...result, nextStep: "Saved, but a higher-priority layer such as the agent preset overrides it; tell the user it is not in effect." };
    case "restart-required": {
      const reason = result.restartReason === undefined ? "" : `: ${RESTART_STEPS[result.restartReason]}`;
      return { ...result, nextStep: `Tell the user to restart Galaxy Blackhole to apply this change${reason}.` };
    }
    case "failed": {
      const code = result.error?.code ?? "operation-error";
      // Một mã từ chối CỤ THỂ hơn loại thất bại của trình quản lý gói.
      const kind = code === "operation-error" ? result.packageResult?.kind : undefined;
      return { ...result, nextStep: (kind === undefined ? undefined : FAILURE_STEPS[kind]) ?? ERROR_STEPS[code] };
    }
    /* v8 ignore next -- application của ChangeResult là union ĐÓNG */
    default: return assertNever(result.application);
  }
}

/** Required services for the management tool. */
export const inject: string[] = ["tools", "pluginManager", "sandboxPolicy"];

/**
 * Mặt cắt của SỔ TOOL (service `tools`) mà row này dùng — seam CẤU TRÚC, KHÔNG dựa vào augmentation
 * của `Context` (ADR 000d). Kiểu `ToolDefinition` lấy từ gói ta nên chỉ có MỘT nguồn kiểu.
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của phạm vi đang cài.
   * Nhận: định nghĩa tool (đã kiểm bởi `defineTool`).
   * Trả: hàm huỷ đăng ký (sổ tool của kernel trả về hàm này).
   */
  register(definition: ToolDefinition): () => void;
}

/**
 * Đăng ký MỘT tool quản lý cho khám phá và bốn hành động bền vững.
 * Nhận: ctx — context đăng ký tool theo phạm vi agent.
 * Trả: không.
 */
export function apply(ctx: Context): void {
  // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("plugin-manager requires the tools seam (ctx.get(\"tools\"))");
  tools.register(defineTool({
    name: "plugin_manager",
    description: "List plugins or bundles in the current profile, enable or disable them, install a bundle, or remove an installed bundle. Every action requires danger-full-access permission or approval for this call. Approval does not change the session permission mode. Changes affect every session in this profile. List first to obtain exact identifiers. Package installation can execute allowed build scripts. Live profiles apply changes immediately, including upgrades of installed packages; a change result that is not applied carries nextStep, which says what to do or tell the user. Unmet Galaxy Blackhole version requirements (engines.dsh, else Galaxy Blackhole peer dependencies) block installation and activation. Version exemptions risk crashes and data loss: warn the user and obtain explicit permission for the exact plugin and runtime versions before granting one.",
    parameters: {
      action: { type: "string", required: true, enum: ["list_plugins", "list_bundles", "set_plugin", "set_bundle", "install_bundle", "remove_bundle", "list_version_exemptions", "set_version_exemption"], description: "Management operation." },
      target: { type: "string", description: "Plugin entry id, bundle package name, or installation spec, according to action. For an Official catalog entry, pass list_bundles installTarget.spec to install_bundle." },
      enabled: { type: "boolean", description: "Required for set operations; defaults to true for installation. For set_version_exemption, true grants and false revokes." },
      runtimeVersion: { type: "string", description: "For set_version_exemption: exact Galaxy Blackhole version from list_version_exemptions. Target must be the manifest package-name@version, not an alias or version range." },
      acceptRisk: { type: "boolean", description: "For granting an exemption: true only after warning the user about possible crashes and data loss and receiving explicit permission for this exact plugin/runtime pair. General installation permission is not enough." },
      approvedBuilds: { type: "array", items: { type: "string" }, description: "For install_bundle: pass names from pendingBuilds only after the user explicitly approves running their install scripts in the conversation. This grants persistent permission for this profile." },
      registry: { type: "string", description: "For install_bundle: the npm registry URL asked first, when the user names one; otherwise the configured registry is asked, and its configured fallbacks while a registry is unreachable." },
      offset: { type: "number", description: "Zero-based list offset; defaults to 0." },
      limit: { type: "number", description: "List page size, from 1 to 100; defaults to 25." },
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: value }],
    },
    async execute(args, exec) {
      const policy = (ctx as Context & { readonly sandboxPolicy: SandboxPolicySeam }).sandboxPolicy
        .resolve(exec.agent === undefined ? {} : { session: (exec.agent as unknown as AgentSeam).session });
      await approveEscalation({
        requestedMode: "danger-full-access", effectiveMode: policy.mode, subject: "plugin management operation",
        justification: `plugin_manager ${JSON.stringify(args)}. Profile changes persist across sessions; installed Host code runs outside the workspace sandbox.`,
      }, { approver: ctx.get("approval") as ApprovalRequesterSeam | undefined,
        // Biên kernel seam: `exec.agent` là Agent của gói ta (gbh-agent), còn cổng duyệt của kernel
        // generic theo Agent của kernel ⇒ ép MỘT chỗ tại biên, chỉ đọc danh tính + phiên.
        agent: exec.agent as unknown as AgentSeam | undefined, callId: exec.callId,
        toolName: "plugin_manager", signal: exec.signal });
      exec.signal.throwIfAborted();
      const manager = (ctx as Context & { readonly pluginManager: PluginManagerSeam }).pluginManager;
      switch (args.action) {
        case "list_version_exemptions":
          return JSON.stringify({ runtimeVersion: getDshRuntimeVersion(), ...manager.listVersionExemptions() });
        case "set_version_exemption":
          if (args.target === undefined || args.runtimeVersion === undefined || args.enabled === undefined) {
            throw new Error("target package-name@version, runtimeVersion, and enabled are required");
          }
          return JSON.stringify(withNextStep(await manager.setVersionExemption(args.target, args.runtimeVersion, args.enabled, args.acceptRisk)));
        case "list_plugins":
        case "list_bundles": {
          const offset = args.offset ?? 0;
          const limit = args.limit ?? 25;
          if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
            throw new Error("offset must be a non-negative integer and limit must be an integer from 1 to 100");
          }
          const rows: (PluginInfo | BundleInfo)[] = args.action === "list_plugins" ? await manager.listPlugins() : await manager.listBundles();
          const entries = rows.slice(offset, offset + limit).map(({ meta: _meta, ...row }) => "rows" in row
            ? { ...row, rows: row.rows.map(({ meta: _rowMeta, ...declared }) => declared) }
            : row);
          return JSON.stringify({ entries, total: rows.length,
            nextOffset: offset + entries.length < rows.length ? offset + entries.length : null });
        }
        case "set_plugin":
        case "set_bundle": {
          if (args.target === undefined || args.enabled === undefined)
            throw new Error("target and enabled are required");
          return JSON.stringify(withNextStep(await (args.action === "set_plugin"
            ? manager.setPluginEnabled(args.target, args.enabled)
            : manager.setBundleEnabled(args.target, args.enabled))));
        }
        case "install_bundle":
          if (args.target === undefined)
            throw new Error("target package spec is required");
          return JSON.stringify(withNextStep(await manager.installBundle(args.target, {
            ...args.enabled === undefined ? {} : { enabled: args.enabled },
            ...args.approvedBuilds === undefined ? {} : { approvedBuilds: args.approvedBuilds },
            ...args.registry === undefined ? {} : { registry: args.registry },
          })));
        case "remove_bundle":
          if (args.target === undefined)
            throw new Error("target bundle name is required");
          return JSON.stringify(withNextStep(await manager.removeBundle(args.target)));
        /* v8 ignore next -- phép kiểm JSON của tool từ chối action ngoài enum đã khai */
        default: return assertNever(args.action);
      }
    },
    presentCall: (args) => ({ card: "generic", title: "Manage profile plugins", kind: args.action.startsWith("list_") ? "read" : "other", rawInput: args }),
  }));
}
