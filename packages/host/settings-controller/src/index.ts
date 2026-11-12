/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Chủ sở hữu Remote cho các bề mặt cấu hình: namespace settings (đọc đã che + ghi) và
 *      namespace credentials (mount từ đây), trên hai seam settings và credentials
 */

import type { Context } from "@deepseek-ai/cordis";
import { openNativeTextFile } from "@galaxy-blackhole/gbh-native-command";
import { Remote, RemoteError, TypertRemoteService } from "@galaxy-blackhole/gbh-typert-protocol";
// Nạp zod qua entry "zod/v4" thay vì "zod": packages/client/ui-sidebar-right/src/externals.d.ts khai
// shim ambient `declare module "zod";` (không có thân) cho bundle trình duyệt, và khai báo đó che mất
// kiểu thật của "zod" trong TOÀN BỘ chương trình tsc — z.ZodType mất kiểu nên payload hoá `unknown`.
// "zod/v4" là đúng API classic v4 đang cài (zod 4.6.7: entry gốc chỉ re-export ./v4/classic) nhưng
// không bị shim che, nên kiểu thật đi tới tận nơi dùng. Gói kia sửa xong thì đổi lại cũng không sao.
import { z } from "zod/v4";

/** Trần gom một lô describe: một trang cấu hình hỏi mọi tham chiếu mà các hàng của nó nêu tên. */
const MAX_DESCRIBE_REFS = 64;

/** Grammar của tên tham chiếu bí mật. */
const credentialRefSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/u);

/** Lô describe: danh sách tên tham chiếu, có trần. */
const describeRequestSchema = z.object({ refs: z.array(credentialRefSchema).max(MAX_DESCRIBE_REFS) });

/** Một lần ghi bí mật: tên tham chiếu và giá trị không rỗng. */
const setRequestSchema = z.object({ ref: credentialRefSchema, value: z.string().min(1) });

/** Một lần xoá bí mật. */
const unsetRequestSchema = z.object({ ref: credentialRefSchema });

/** Mọi thao tác ghi cấu hình đều nhắm đúng một namespace. */
const settingsNamespaceRequestSchema = z.object({ ns: z.string().min(1) });

/** Tên tham chiếu đã được đóng dấu (brand) — chỉ dùng nội bộ seam. */
type CredentialReference = string & { readonly __credentialReference: unique symbol };

/** Một mục bí mật trong một namespace cấu hình. */
interface SettingsSecretView {
  /** Đường dẫn tới trường bí mật. */
  path: string[];
  /** Trường đã được đặt giá trị hay chưa. */
  set: boolean;
}

/** Một namespace cấu hình đã che bí mật. */
interface SettingsNamespaceView {
  /** Khoá namespace. */
  ns: string;
  /** Namespace này có tự sinh giá trị không. */
  autoGenerate: boolean;
  /** Schema để trang cấu hình dựng form. */
  schema: unknown;
  /** Giá trị hiệu lực sau khi đã che. */
  value: unknown;
  /** Lớp giá trị nền, nếu có. */
  base?: unknown;
  /** Lớp giá trị do người dùng đặt, nếu có. */
  user?: unknown;
  /** Cách áp dụng. */
  applies: "live";
  /** Các trường bí mật trong namespace. */
  secrets: SettingsSecretView[];
  /** Phiên bản của namespace. */
  revision: number;
}

/** Hình dạng descriptor mà seam settings trả về (chỉ nêu phần row này chạm tới). */
interface SettingsDescriptor {
  /** Khoá namespace. */
  ns: unknown;
  /** Có tự sinh giá trị không. */
  autoGenerate: boolean;
  /** Schema của namespace. */
  schema: unknown;
  /** Giá trị hiệu lực sau khi đã che. */
  value: unknown;
  /** Lớp giá trị nền. */
  base?: unknown;
  /** Lớp giá trị người dùng. */
  user?: unknown;
  /** Cách áp dụng. */
  applies: "live";
  /** Các trường bí mật. */
  secrets?: { path: string[]; set: boolean }[];
  /** Phiên bản. */
  revision: number;
}

/** Một chỉnh sửa theo đường dẫn trong phần người dùng của một namespace. */
type SettingsPathOp = { op: "set"; path: string[]; value: unknown } | { op: "unset"; path: string[] };

/** Seam settings mà row này uỷ quyền (tra qua Context, không import gói của seam). */
interface SettingsSeam {
  /** Nhà cung cấp có ghi được không. */
  readonly writable: boolean;
  /** Đọc mọi namespace đã đăng ký. */
  describe(options: { redactSecrets: true }): SettingsDescriptor[];
  /** Gộp một bản vá vào phần người dùng. */
  update(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<void> | void;
  /** Thay trọn phần người dùng. */
  replace(ns: string, section: Record<string, unknown>, expectedRevision?: number): Promise<void> | void;
  /** Áp các chỉnh sửa theo đường dẫn. */
  mutate(ns: string, ops: SettingsPathOp[], expectedRevision?: number): Promise<void> | void;
  /** Vật chất hoá tài liệu cấu hình để mở bằng trình soạn thảo. */
  prepareDocument(): Promise<string>;
}

/** Thông tin một tham chiếu bí mật mà seam trả về. */
interface CredentialInfoLike {
  /** Đã có giá trị hay chưa. */
  configured: boolean;
  /** Lớp đang cấp giá trị, nếu có. */
  source?: string;
  /** Nhà cung cấp có ghi được tham chiếu này không. */
  writable: boolean;
}

/** Seam credentials mà row này uỷ quyền. */
interface CredentialsSeam {
  /** Mô tả một tham chiếu đã đóng dấu. */
  describe(ref: CredentialReference): Promise<CredentialInfoLike>;
  /** Ghi một giá trị. */
  set(ref: CredentialReference, value: string): Promise<void> | void;
  /** Xoá một tham chiếu. */
  unset(ref: CredentialReference): Promise<void> | void;
}

/** Hàm mở một tệp văn bản bằng trình soạn thảo của hệ điều hành. */
export type OpenTextFile = (path: string, signal: AbortSignal) => Promise<void>;

/** Phần có thể thay thế của SettingsController (dùng cho test và cho host khác nhau). */
export interface SettingsControllerInternals {
  /** Hàm mở tệp; mặc định lấy dịch vụ mở-tệp của host qua Context. */
  openTextFile?: OpenTextFile;
}

/**
 * Ép một tên tham chiếu qua grammar rồi đóng dấu.
 * Nhận: tên tham chiếu đã qua schema.
 * Trả: tên đã đóng dấu.
 */
function credentialRef(ref: string): CredentialReference {
  return ref as CredentialReference;
}

/**
 * Kiểm một payload theo schema, hỏng thì ném lỗi Gateway chuẩn.
 * Nhận: tên method (để dựng thông điệp), schema và giá trị thô.
 * Trả: dữ liệu đã qua kiểm.
 */
function parseRequest<T>(method: string, schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new RemoteError("gateway/bad-request", "invalid payload for " + method, { issues: parsed.error.issues });
  }
  return parsed.data;
}

/**
 * Chiếu một mục bí mật sang dạng wire.
 * Nhận: mục bí mật của seam.
 * Trả: bản sao chỉ gồm path và set.
 */
function secretView(secret: { path: string[]; set: boolean }): SettingsSecretView {
  return { path: [...secret.path], set: secret.set };
}

/**
 * Chiếu một descriptor sang view theo TỪNG trường.
 * Nhận: descriptor đọc dưới chế độ che bí mật.
 * Trả: đúng các sự thật cần thiết, không kèm gì khác.
 */
function namespaceView(descriptor: SettingsDescriptor): SettingsNamespaceView {
  return {
    ns: String(descriptor.ns),
    autoGenerate: descriptor.autoGenerate,
    schema: descriptor.schema,
    value: descriptor.value,
    ...(descriptor.base === undefined ? {} : { base: descriptor.base }),
    ...(descriptor.user === undefined ? {} : { user: descriptor.user }),
    applies: descriptor.applies,
    secrets: (descriptor.secrets ?? []).map(secretView),
    revision: descriptor.revision,
  };
}

/**
 * Lấy thông điệp của một giá trị bị ném.
 * Nhận: giá trị bất kỳ.
 * Trả: thông điệp dạng chuỗi.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Nhận ra lỗi xung đột phiên bản của seam settings.
 * Nhận: giá trị bị ném.
 * Trả: thông tin xung đột, hoặc undefined nếu không phải.
 */
function settingsConflictOf(error: unknown): { message: string; expected: number; actual: number } | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as Record<string, unknown>;
  if (record.code !== "SETTINGS_CONFLICT" || typeof record.message !== "string") return undefined;
  return { message: record.message, expected: record.expected as number, actual: record.actual as number };
}

/**
 * Phân loại một lần từ chối của seam thành lỗi Remote.
 * Nhận: namespace bị ghi và giá trị seam ném ra.
 * Trả: lỗi cần ném.
 */
function rejected(ns: string, error: unknown): RemoteError {
  const conflict = settingsConflictOf(error);
  if (conflict !== undefined) {
    return new RemoteError(
      "settings/conflict",
      conflict.message,
      { ns, expected: conflict.expected, actual: conflict.actual },
      { cause: error },
    );
  }
  return new RemoteError("settings/rejected", messageOf(error), { ns }, { cause: error });
}

/**
 * Đọc lại trạng thái huỷ sau mỗi lần chờ.
 * Nhận: tín hiệu của người gọi.
 * Trả: đã huỷ hay chưa.
 */
function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Dịch vụ host đứng sau namespace Remote `credentials`: mọi nghĩa vụ wire mà seam không tự lo —
 * trần gom lô, chiếu từng trường, và ánh xạ từ chối. Giá trị bí mật chỉ đi MỘT chiều: không method
 * nào ở đây trả nó ra.
 */
export class CredentialsController extends TypertRemoteService {
  /**
   * Đăng ký service credentialsController và bind cùng key vào Typert Gateway với namespace credentials.
   * Nhận: context host, nơi một nhà cung cấp credentials có thể được mount.
   * Trả: thực thể đã đăng ký.
   */
  constructor(ctx: Context) {
    super(ctx, "credentialsController", { namespace: "credentials" });
  }

  /**
   * Mô tả nhiều tham chiếu cho một bề mặt cấu hình trong MỘT vòng gọi.
   * Nhận: lô tên tham chiếu.
   * Trả: một view cho mỗi tên, khoá theo tên.
   */
  @Remote
  async describe(refs: string[]): Promise<Record<string, unknown>> {
    const request = parseRequest("credentials.describe", describeRequestSchema, { refs });
    const branded = request.refs.map((ref): [string, CredentialReference] => [ref, credentialRef(ref)]);
    const credentials = this.provider();
    const entries = await Promise.all(
      branded.map(async ([ref, key]): Promise<[string, Record<string, unknown>]> => {
        const info = await credentials.describe(key);
        const view: Record<string, unknown> = { configured: info.configured, writable: info.writable };
        if (info.source !== undefined) view.source = info.source;
        return [ref, view];
      }),
    );
    return Object.fromEntries(entries);
  }

  /**
   * Lưu một giá trị bí mật từ bề mặt cấu hình. Giá trị chỉ đi theo chiều này.
   * Nhận: tên tham chiếu và giá trị không rỗng.
   * Trả: không.
   */
  @Remote
  async set(ref: string, value: string): Promise<void> {
    const request = parseRequest("credentials.set", setRequestSchema, { ref, value });
    const branded = credentialRef(request.ref);
    const credentials = this.provider();
    await this.write(request.ref, () => credentials.set(branded, request.value));
  }

  /**
   * Xoá một tham chiếu khỏi bề mặt cấu hình.
   * Nhận: tên tham chiếu.
   * Trả: không.
   */
  @Remote
  async unset(ref: string): Promise<void> {
    const request = parseRequest("credentials.unset", unsetRequestSchema, { ref });
    const branded = credentialRef(request.ref);
    const credentials = this.provider();
    await this.write(request.ref, () => credentials.unset(branded));
  }

  /**
   * Lấy nhà cung cấp credentials hoặc báo cách bổ sung.
   * Nhận: không.
   * Trả: seam credentials.
   */
  private provider(): CredentialsSeam {
    const credentials = this.ctx.get("credentials") as CredentialsSeam | undefined;
    if (credentials === undefined) {
      throw new RemoteError(
        "gateway/internal",
        "credentials service is absent: this deployment does not mount a credential provider (e.g. @galaxy-blackhole/gbh-credentials-local) in its composition",
        {},
      );
    }
    return credentials;
  }

  /**
   * Chạy một lần ghi và báo mọi từ chối là `credential/rejected`.
   * Nhận: tên tham chiếu và việc ghi.
   * Trả: không.
   */
  private async write(ref: string, write: () => Promise<void> | void): Promise<void> {
    try {
      await write();
    } catch (error) {
      throw new RemoteError("credential/rejected", messageOf(error), { ref }, { cause: error });
    }
  }
}

/**
 * Dịch vụ host đứng sau namespace Remote `settings`: mọi lượt đọc đều dùng `redactSecrets: true`
 * nên trường `role('secret')` không thể đi theo phản hồi; các lượt ghi phơi gộp, thay trọn và chỉnh
 * theo đường dẫn của seam settings, và phân loại mọi từ chối thành `settings/conflict` hoặc
 * `settings/rejected` kèm đúng thông điệp của seam.
 */
export class SettingsController extends TypertRemoteService {
  /** Cách mở tài liệu cấu hình bằng trình soạn thảo của hệ điều hành. */
  private readonly openTextFile: OpenTextFile;

  /**
   * Đăng ký namespace settings và mount namespace credentials bên cạnh. Cả hai namespace vẫn được
   * đăng ký khi thiếu nhà cung cấp, để lời gọi trả về chẩn đoán thiếu-nhà-cung-cấp có thể hành động.
   * Nhận: context host và phần có thể thay thế.
   * Trả: thực thể đã đăng ký.
   */
  constructor(ctx: Context, internals: SettingsControllerInternals = {}) {
    super(ctx, "settingsController", { namespace: "settings" });
    // 20/10/2026 (task-166C): bản gốc dùng `openNativeTextFile` của @galaxy-blackhole/gbh-native-command
    // (gói ta đã port 1:1, byte-identical). Bản cũ bịa ra `defaultOpenTextFile(ctx)` đòi service `openInApp`
    // — service này KHÔNG tồn tại ở cả stock lẫn repo ⇒ mọi lần bấm "Mở tệp cấu hình" đều ném ⇒ banner đỏ.
    this.openTextFile = internals.openTextFile ?? openNativeTextFile;
    ctx.plugin(CredentialsController);
  }

  /**
   * Mô tả mọi namespace đã đăng ký cho một trang cấu hình: giá trị phân lớp đã che cộng schema đã
   * tuần tự hoá mà trang dựng form từ đó.
   * Nhận: không.
   * Trả: khả năng ghi của nhà cung cấp, sự hiện diện của tài liệu, và một view cho mỗi namespace.
   */
  @Remote
  describe(): { writable: boolean; hasDocument: boolean; namespaces: SettingsNamespaceView[] } {
    const settings = this.provider();
    return {
      writable: settings.writable,
      hasDocument: true,
      namespaces: settings.describe({ redactSecrets: true }).map(namespaceView),
    };
  }

  /**
   * Gộp một bản vá vào phần người dùng đã lưu của một namespace.
   * Nhận: khoá namespace, các trường cần gộp, và phiên bản người gọi đã đọc.
   * Trả: view đã che của namespace sau khi ghi.
   */
  @Remote
  update(ns: string, patch: Record<string, unknown>, expectedRevision?: number): Promise<SettingsNamespaceView> {
    return this.write(ns, "update", patch, expectedRevision);
  }

  /**
   * Thay trọn phần người dùng đã lưu của một namespace.
   * Nhận: khoá namespace, phần người dùng mới, và phiên bản người gọi đã đọc.
   * Trả: view đã che của namespace sau khi ghi.
   */
  @Remote
  replace(ns: string, section: Record<string, unknown>, expectedRevision?: number): Promise<SettingsNamespaceView> {
    return this.write(ns, "replace", section, expectedRevision);
  }

  /**
   * Áp các chỉnh sửa theo đường dẫn lên phần người dùng đã lưu của một namespace, rồi trả view mới.
   * Nhận: khoá namespace, các chỉnh sửa theo thứ tự, và phiên bản người gọi đã đọc.
   * Trả: view đã che của namespace sau khi ghi.
   */
  @Remote
  mutate(ns: string, ops: SettingsPathOp[], expectedRevision?: number): Promise<SettingsNamespaceView> {
    return this.write(ns, "mutate", ops, expectedRevision);
  }

  /**
   * Vật chất hoá tài liệu cấu hình của nhà cung cấp và mở nó trong trình soạn thảo văn bản.
   * Nhận: vòng đời của người gọi.
   * Trả: xác nhận sau khi trình mở chấp nhận tài liệu.
   */
  @Remote
  async openSettingsDocument(signal: AbortSignal): Promise<{ opened: true }> {
    const settings = this.provider();
    if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
    let path: string;
    try {
      path = await settings.prepareDocument();
    } catch (error) {
      if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document preparation was aborted", {});
      throw new RemoteError("gateway/internal", "settings document preparation failed: " + messageOf(error), {}, {
        cause: error,
      });
    }
    if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
    try {
      await this.openTextFile(path, signal);
      return { opened: true };
    } catch (error) {
      if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
      throw new RemoteError("gateway/internal", "path open failed: " + messageOf(error), {}, { cause: error });
    }
  }

  /**
   * Chạy một lượt ghi rồi trả view đã che của namespace vừa ghi.
   * Nhận: khoá namespace, chế độ ghi, đầu vào và phiên bản người gọi đã đọc.
   * Trả: view đã che của namespace sau khi ghi.
   */
  private async write(
    ns: string,
    mode: "update" | "replace" | "mutate",
    input: Record<string, unknown> | SettingsPathOp[],
    expectedRevision?: number,
  ): Promise<SettingsNamespaceView> {
    const parsed = settingsNamespaceRequestSchema.safeParse({ ns });
    if (!parsed.success) {
      throw new RemoteError("gateway/bad-request", "invalid payload for settings." + mode, { issues: parsed.error.issues });
    }
    const settings = this.provider();
    const namespace = parsed.data.ns;
    try {
      if (mode === "update") await settings.update(namespace, input as Record<string, unknown>, expectedRevision);
      else if (mode === "replace") await settings.replace(namespace, input as Record<string, unknown>, expectedRevision);
      else await settings.mutate(namespace, input as SettingsPathOp[], expectedRevision);
    } catch (error) {
      throw rejected(ns, error);
    }
    const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === namespace);
    if (descriptor === undefined) {
      throw new RemoteError("gateway/internal", 'settings namespace "' + ns + '" was disposed after the ' + mode, {});
    }
    return namespaceView(descriptor);
  }

  /**
   * Lấy nhà cung cấp settings hoặc báo cách bổ sung.
   * Nhận: không.
   * Trả: seam settings.
   */
  private provider(): SettingsSeam {
    const settings = this.ctx.get("settings") as SettingsSeam | undefined;
    if (settings === undefined) {
      throw new RemoteError("gateway/internal", "settings service is absent: mount @galaxy-blackhole/gbh-settings with @galaxy-blackhole/gbh-config-editor in the profile composition", {});
    }
    return settings;
  }
}



declare module "@galaxy-blackhole/gbh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    /** Mọi lần từ chối của seam không phải do bản ghi cũ: namespace chưa đăng ký hoặc sai, nhà cung cấp chỉ đọc, schema, kho lưu. */
    "settings/rejected": { readonly ns: string };
    /** Bản ghi đã đổi sau khi người gọi đọc: kết cục riêng, người gọi phải đọc lại rồi ghi lại. */
    "settings/conflict": { readonly ns: string; readonly expected: number; readonly actual: number };
    /** Nhà cung cấp từ chối một lần ghi hợp lệ; chi tiết CHỈ nêu tên tham chiếu, không bao giờ nêu giá trị. */
    "credential/rejected": { readonly ref: string };
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Chủ sở hữu namespace Remote `credentials`. */
    credentialsController: CredentialsController;
    /** Chủ sở hữu namespace Remote `settings`. */
    settingsController: SettingsController;
  }
}

export default SettingsController;