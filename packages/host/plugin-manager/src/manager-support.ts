/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Khai báo cấp cao dùng chung cho PluginManager: kiểu cấu hình, seam Context, kết quả reload/soi spec và các helper thuần (manifest, registry, spec), tách khỏi manager.ts để giữ trần 1000 dòng.
 */

import { readProfileManifest } from "@deepseek-ai/dsh-app-boot";
import type { ProfileContext, ProfileManifest } from "@deepseek-ai/dsh-app-boot";
import { laCungBundle, quyTenBundle } from "./bundle-rename.ts";
import { ManagementFailure } from "./failure.ts";
import { InvalidInstallSpecError, dependencySpec, parseInstallSpec } from "./install-spec.ts";
import type { ParsedInstallSpec } from "./install-spec.ts";
import type {
  ChangeResult, ManagementError, PluginEntryId, PluginInspectProblem, PluginInstallProgress, PluginSpecInspection,
  Registry, RestartReason,
} from "./types.ts";

/** Một URL http(s), đúng dạng pnpm nhận cho `--registry`. */
export const REGISTRY_URL = /^https?:\/\/\S+$/;
/**
 * Các module quản trị: bundle chứa chúng không bao giờ bị gỡ hay tắt.
 * Bản gốc bảo vệ chính nó bằng id stock; bản viết lại giữ nguyên id stock VÀ thêm id CỦA TA
 * (gói này có thể được mount thay gói stock: thiếu id ta thì Market có thể gỡ/tắt chính hạ tầng cài đặt).
 */
export const protectedModules = new Set([
  "@deepseek-ai/dsh-plugin-manager", "@galaxy-blackhole/gbh-host-plugin-manager",
  "@deepseek-ai/cordis-plugin-loader",
  "@deepseek-ai/cordis-plugin-include", "@deepseek-ai/dsh-api-gateway",
  "@deepseek-ai/dsh-host-webserver", "@deepseek-ai/dsh-client-modules",
  "@deepseek-ai/dsh-client-ui-settings-plugin-inventory", "@deepseek-ai/dsh-client-ui-plugin-manager",
  "@deepseek-ai/dsh-host-plugin-inventory", "@deepseek-ai/dsh-typert-registry",
  "@deepseek-ai/dsh-api-remotes", "@deepseek-ai/dsh-api-remote-access",
  "@deepseek-ai/cordis-plugin-timer", "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-host-frontend-static", "@deepseek-ai/dsh-tools",
  "@deepseek-ai/dsh-hmr",
]);
/** Các tệp hồ sơ mà một lần cài ghi và một lần hỏng/huỷ khôi phục. */
export const RESTORED_FILES = ["package.json", "pnpm-lock.yaml"];
/** Mã màu của pnpm, thứ có thể bọc một câu trả lời JSON. */
export const ANSI_SEQUENCE = /\x1b\[[0-9;]*m/g;

/**
 * Cấu hình của row: executable pnpm, các registry, và mọi trần chẩn đoán/tra cứu/kiểm kết nối.
 * Nhận: object cấu hình người dùng (mọi trường có mặc định đều tuỳ chọn). Trả: kiểu đầu vào của `static Config`.
 */
export interface Config {
  pnpmCommand?: string;
  outputBytes?: number;
  lockWaitMs?: number;
  inspectTimeoutMs?: number;
  /** Thời gian tối đa của phép kiểm kết nối repository GitHub trước khi cài, mili giây. */
  githubConnectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  /** Registry mà tra cứu và cài đặt hỏi trước, dạng URL http(s); vắng thì dùng registry pnpm tự khai. */
  registry?: string;
  /** Các registry hỏi lần lượt khi registry trước không tới được hoặc không có bản package. */
  fallbackRegistries?: string[];
}

/** Cấu hình ĐÃ phân giải: `static Config` bù mặc định cho mọi trường trừ `registry`. */
export type ResolvedConfig = Required<Omit<Config, "registry">> & Pick<Config, "registry">;

/** Nửa Context mà service thật sự gọi, khai theo CẤU TRÚC (repo CẤM augment module). */
export interface ManagerContext {
  fiber: { entry?: { id?: string } };
  profileContext: ProfileContext;
  get(name: string): any;
  effect(callback: () => () => Promise<void>, label?: string): unknown;
  emit(event: string, ...args: unknown[]): void;
  logger: { warn(...args: unknown[]): void };
}

/** Một lần cài đang chạy, từ lúc gọi tới lúc kết thúc; `applying` là mốc không huỷ được nữa. */
export interface InstallControl {
  abort: AbortController;
  phase: PluginInstallProgress["phase"];
  result: Promise<ChangeResult | null>;
}

/** Phần yêu cầu của một lần đổi, trước khi có kết quả. */
export interface ChangeRequest {
  stage: ChangeResult["stage"];
  target: string;
  enabled?: boolean;
}

/** Lý do một lần đổi, phát kèm sự kiện `plugin-manager/changed`. */
export type ChangeReason = "plugin" | "bundle" | "install" | "remove";

/** Kết quả một lần áp hồ sơ: cảnh báo và lý do phải chờ khởi động lại, nếu có. */
export interface ReloadOutcome {
  warnings: string[];
  restartReason?: RestartReason;
}

/** Kết quả soi ở nhánh CHẤP NHẬN / nhánh TỪ CHỐI. */
export type AcceptedInspection = Extract<PluginSpecInspection, { status: "accepted" }>;
export type RefusedInspection = Extract<PluginSpecInspection, { status: "refused" }>;

/** Một row đang sống trong Loader: danh tính entry và base URL của module. */
export interface LiveRow {
  entryId: PluginEntryId;
  baseUrl: string | undefined;
}

/**
 * Chẩn đoán CHÍNH XÁC của một lần hỏng, kể cả khi bị từ chối bằng giá trị không phải `Error`.
 * Nhận: giá trị bị ném ra (có thể không phải `Error`).
 * Trả: chuỗi chẩn đoán — `message` khi là `Error`, ngược lại `String(error)`.
 */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Một lời từ chối đã mong đợi giữ mã của nó; mọi thứ khác thành lỗi phép toán kèm chẩn đoán chính xác.
 * Nhận: giá trị bị ném ra từ một phép toán quản lý.
 * Trả: `ManagementError` — mã + `incompatible` khi là `ManagementFailure`, ngược lại mã `operation-error`.
 */
export function managementError(error: unknown): ManagementError {
  if (!(error instanceof ManagementFailure)) return { code: "operation-error", diagnostic: messageOf(error) };
  return { code: error.code, ...(error.incompatible === undefined ? {} : { incompatible: error.incompatible }) };
}

/** Người gọi đã dừng một lần cài; tệp của nó được khôi phục trước khi lỗi này được ném. */
export class InstallCancelledError extends Error {
  constructor() {
    super("Installation cancelled");
    this.name = "InstallCancelledError";
  }
}

/**
 * Một trường manifest là chuỗi, khi manifest mang trường đó.
 * Nhận: manifest hồ sơ và tên trường (`name`/`version`/`description`).
 * Trả: giá trị chuỗi của trường, hoặc `undefined` khi vắng hay không phải chuỗi.
 */
export function stringField(manifest: ProfileManifest, field: "name" | "version" | "description"): string | undefined {
  const value = manifest[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Manifest nói gì về package: danh tính, một dòng mô tả, và có phải bundle không.
 * Nhận: dạng spec (`path`/`registry`), manifest đã đọc, registry đã hỏi. Trả: kết quả soi ở nhánh chấp nhận.
 */
export function inspectionOf(kind: "path" | "registry", manifest: ProfileManifest, registry: Registry): AcceptedInspection {
  const dsh = manifest.dsh;
  const declared = typeof dsh === "object" && dsh !== null ? dsh : undefined;
  const bundle = declared !== undefined && typeof declared.bundle === "object" && declared.bundle !== null;
  const name = stringField(manifest, "name");
  const version = stringField(manifest, "version");
  const description = stringField(manifest, "description");
  return {
    status: "accepted", kind, bundle, registry,
    ...(name === undefined ? {} : { name }),
    ...(version === undefined ? {} : { version }),
    ...(description === undefined || description === "" ? {} : { description }),
  };
}

/**
 * Dựng một lời từ chối soi với lý do người dùng đọc được.
 * Nhận: `problem` — mã vấn đề; `reason` — câu giải thích hiển thị cho người dùng.
 * Trả: đối tượng `{ status: "refused", problem, reason }`.
 */
export function refused(problem: PluginInspectProblem, reason: string): RefusedInspection {
  return { status: "refused", problem, reason };
}

/**
 * Lời từ chối `pnpm view --json` (in ra stdout, `{ error: { code, message } }`) thành một dòng log; rỗng với mọi thứ khác.
 * Nhận: toàn văn stdout của `pnpm view --json`.
 * Trả: một dòng ghép `code` + `message`, hoặc chuỗi rỗng khi không phải JSON lỗi.
 */
export function printedError(printed: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(printed || "null");
  } catch {
    return ""; /* not JSON: nothing pnpm printed as a refusal */
  }
  const error = typeof parsed === "object" && parsed !== null ? (parsed as { error?: unknown }).error : undefined;
  if (typeof error !== "object" || error === null) return "";
  const { code, message } = error as { code?: unknown; message?: unknown };
  return [code, message].filter((part): part is string => typeof part === "string").join("  ");
}

/**
 * Các bundle mà một manifest hồ sơ chọn.
 * Nhận: `manifest` — manifest của profile (`dsh.profile.bundles`).
 * Trả: mảng tên bundle đã chọn; rỗng khi manifest không khai.
 */
export function bundleSelection(manifest: ProfileManifest): readonly string[] {
  return manifest.dsh?.profile?.bundles ?? [];
}

/**
 * Danh sách bundle sau MỘT lượt bật/tắt, so theo danh tính lớp bundle chứ không so chuỗi thô.
 *
 * Vì sao (đo thật 10/11/2026): client có lượt gửi **id stock** (`@deepseek-ai/dsh-experimental-…`)
 * trong khi hồ sơ khai **tên của ta** (`@galaxy-blackhole/gbh-…-bundle`). Bản cũ lọc đúng chuỗi
 * nhận được ⇒ không khớp ⇒ danh sách không đổi ⇒ `selectBundle` trả về sớm và `setBundleEnabled`
 * vẫn báo `application: applied` (đo được `changed: false`). Người dùng thấy công tắc TẮT còn row
 * vẫn mount, menu quyền vẫn có mục "Tự động duyệt". Nay cả hai phía đều so theo {@link tenCungBundle}:
 *   · TẮT  ⇒ bỏ MỌI cách viết của cùng lớp (id stock lẫn tên của ta).
 *   · BẬT  ⇒ giữ đúng MỘT cách viết, chuẩn hoá về tên gốc, không nhân đôi lớp.
 * Nhận: `previous` — `dsh.profile.bundles` hiện tại; `name` — tên công tắc gửi lên; `enabled` — bật hay tắt.
 * Trả: danh sách mới; nội dung và thứ tự y nguyên khi không có gì phải đổi.
 */
export function chonBundle(previous: readonly string[], name: string, enabled: boolean): readonly string[] {
  const cung = (viet: string): boolean => laCungBundle(viet, name);
  if (!enabled) return previous.filter((viet) => !cung(viet));
  const daCo = previous.find(cung);
  // Đã chọn: chỉ chuẩn hoá về tên gốc khi bảng đổi tên còn hiệu lực (bản cài trong profile bị đổi id
  // stock → id GBH ngay trong artefact nên ở đó bảng thành ánh xạ đồng nhất; ghi lại tên gốc là vô nghĩa).
  if (daCo !== undefined) {
    const goc = quyTenBundle(daCo);
    return goc === daCo ? previous : previous.map((viet) => (viet === daCo ? goc : viet));
  }
  return [...previous, quyTenBundle(name)];
}

/**
 * Package mà một installation spec nêu TRƯỚC khi pnpm chạy: tên registry, tên manifest của một thư mục cục bộ, hay
 * dependency đã lưu với spec git/tarball này, so như danh sách plugin hiện spec đã lưu.
 * Nhận: spec cài đặt, dependencies đã lưu, thư mục hồ sơ cho đường dẫn tương đối. Trả: tên package hoặc `undefined`.
 */
export function specPackageName(spec: string, dependencies: Record<string, string>, profileDir: string): string | undefined {
  const parsed = parsedForRegistry(spec);
  if (parsed.kind === "registry") return parsed.name;
  if (parsed.kind === "path") return packageName(parsed.path);
  const specs = parsed.kind === "tarball" && parsed.path !== undefined ? [spec, `file:${parsed.path}`] : [spec];
  return Object.entries(dependencies).find(([dependency, saved]) => specs.includes(dependencySpec(dependency, saved, profileDir)))?.[0];
}

/**
 * Tên package mà một thư mục cục bộ khai, hoặc `undefined` khi không đọc được manifest.
 * Nhận: đường dẫn thư mục package.
 * Trả: tên package trong manifest, hoặc `undefined` khi manifest không đọc được.
 */
export function packageName(dir: string): string | undefined {
  try {
    return readProfileManifest("dsh", dir).name;
  } catch {
    // pnpm reports the unreadable directory itself.
    return undefined;
  }
}

/**
 * Dạng của spec để biết một lần hỏng có phải của registry không; dạng parser từ chối thì không có host riêng.
 * Nhận: chuỗi installation spec.
 * Trả: `ParsedInstallSpec` — dạng `registry` khi parser từ chối spec đó.
 */
export function parsedForRegistry(spec: string): ParsedInstallSpec {
  try {
    return parseInstallSpec(spec);
  } catch (error) {
    /* v8 ignore next -- parseInstallSpec throws nothing but its own refusal */
    if (!(error instanceof InvalidInstallSpecError)) throw error;
    return { kind: "registry", spec, name: spec };
  }
}
