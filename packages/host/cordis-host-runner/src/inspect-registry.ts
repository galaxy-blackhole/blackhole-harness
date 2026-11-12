/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Danh bạ inspect phía Host cho các truy vấn năng lực Cordis chỉ-đọc mà model thấy được: đăng ký
 *      provider Host, sao chép danh mục provider Client, và định tuyến truy vấn xuyên trang kèm hạn
 *      chờ, huỷ, cùng phép kiểm JSON Schema ở cả hai đầu (bản gốc: lib/types/inspect-registry.js)
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { assertSupportedJsonSchema, validateJsonSchemaValue } from "@deepseek-ai/dsh-tools";
import type { JsonSchemaNode } from "@deepseek-ai/dsh-tools";
import { snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";
import type {
  CordisInspectMethodManifest,
  CordisInspectPlatform,
  CordisInspectProviderManifest,
  CordisInspectProviderView,
  CordisInspectQueryRequest,
  CordisInspectQueryResolution,
  CordisInspectQueryResolved,
  CordisInspectRequestId,
  CordisInspectResolveAck,
} from "./types.ts";

/**
 * Bề mặt context cordis mà registry thật sự gọi tới, khai theo CẤU TRÚC (ADR 000d: KHÔNG augment module).
 * Hai sự kiện `cordis/inspect-query` và `cordis/inspect-query-resolved` nằm ngoài bảng
 * `Events` của kernel nên phải đi qua seam này, và payload vẫn được kiểm đúng hình dạng ở từng nhánh.
 */
interface InspectContextSeam {
  /** Phát yêu cầu truy vấn inspect tới mọi trang đang sống. */
  emit(event: "cordis/inspect-query", payload: CordisInspectQueryRequest): void;
  /** Phát thông báo một truy vấn inspect đã rời trạng thái chờ. */
  emit(event: "cordis/inspect-query-resolved", payload: CordisInspectQueryResolved): void;
}

/** Seam Gateway typert: registry chỉ cần biết còn trang Harness nào đang sống hay không. */
interface TypertGatewaySeam {
  /** `true` khi còn ít nhất một trang Harness kết nối. */
  hasLiveClient(): boolean;
}

/** Một truy vấn Client đang chờ câu trả lời hợp lệ đầu tiên. */
interface PendingClientQuery {
  /** Yêu cầu đã phát cho các trang. */
  request: CordisInspectQueryRequest;
  /** Phương thức đã chọn từ manifest Client, dùng lại khi kiểm đầu ra. */
  method: CordisInspectMethodManifest;
  /** Chốt truy vấn bằng một kết quả hoặc một thất bại. */
  settle(resolution: CordisInspectQueryResolution): void;
  /** Chẩn đoán thất bại ĐẦU TIÊN quan sát được, dùng cho thông điệp hết hạn. */
  failure?: string;
}

/**
 * Context cấp cho một truy vấn inspect phía Host.
 * Nhận: `signal` — tín hiệu huỷ của lượt gọi công cụ; `agent` — Agent mà runtime có phạm vi đang được soi.
 * Trả: không — chỉ là hình dạng dữ liệu mà `HostCordisInspectProviderRegistration.query` đọc.
 */
export interface HostCordisInspectQueryContext {
  /** Tín hiệu huỷ của lượt gọi công cụ. */
  signal: AbortSignal;
  /** Agent mà runtime có phạm vi đang được soi. */
  agent: Agent;
}

/**
 * Đăng ký cục bộ đi kèm manifest hoá-được của nó.
 * Nhận: `manifest` — provider và danh mục phương thức tường minh; `query` — hàm chạy MỘT phương thức đã khai.
 * Trả: không — chỉ là hình dạng mà `register()` nhận.
 */
export interface HostCordisInspectProviderRegistration {
  /** Provider và danh mục phương thức tường minh. */
  manifest: CordisInspectProviderManifest;
  /** Chạy MỘT phương thức đã khai. */
  query(method: string, input: JsonValue | undefined, context: HostCordisInspectQueryContext): Promise<JsonValue>;
}

/**
 * Danh bạ và bộ định tuyến xuyên trang đứng sau hai công cụ inspect mà model thấy được.
 * Nhận: không — thực thể được dựng qua `new CordisInspectRegistryService(ctx, clientQueryTimeoutMs)`.
 * Trả: thực thể dịch vụ đăng ký dưới tên `cordisInspect` trên context sở hữu.
 */
export class CordisInspectRegistryService extends Service {
  private readonly clientQueryTimeoutMs: number;
  private readonly providers = new Map<string, HostCordisInspectProviderRegistration>();
  private readonly pending = new Map<string, PendingClientQuery>();
  private clientManifest: readonly CordisInspectProviderManifest[] | undefined;
  private nextRequest = 1;

  /**
   * Đăng ký danh bạ Host TOÀN CỤC của tiến trình.
   * Nhận: `ctx` — context Host sở hữu; `clientQueryTimeoutMs` — hạn chờ tối đa một câu
   * trả lời Client hợp lệ, tính bằng mili giây.
   * Trả: thực thể đã đăng ký dưới tên `cordisInspect`.
   * @throws Khi context đã huỷ nên không đăng ký được hiệu ứng dọn truy vấn đang chờ.
   */
  constructor(ctx: Context, clientQueryTimeoutMs: number) {
    super(ctx, "cordisInspect");
    this.clientQueryTimeoutMs = clientQueryTimeoutMs;
    ctx.effect(() => () => {
      for (const pending of this.pending.values()) {
        pending.settle({ ok: false, reason: "cancelled", message: "Client inspect registry was disposed" });
      }
    }, "cordis-inspect: pending queries");
  }

  /**
   * Đăng ký MỘT provider phía Host.
   * Nhận: `registration` — manifest và hàm truy vấn cục bộ.
   * Trả: hàm dọn IDEMPOTENT (chỉ gỡ khi mục đang giữ vẫn CHÍNH LÀ đăng ký này).
   * @throws Khi manifest sai hình dạng, hoặc id đã được đăng ký.
   */
  register(registration: HostCordisInspectProviderRegistration): () => void {
    const manifest = validateManifest(registration.manifest);
    if (this.providers.has(manifest.id))
      throw new Error(`Host Cordis inspect provider "${manifest.id}" is already registered`);
    const stored = { ...registration, manifest };
    this.providers.set(manifest.id, stored);
    return () => {
      if (this.providers.get(manifest.id) === stored)
        this.providers.delete(manifest.id);
    };
  }

  /**
   * Thay danh mục provider Client đã sao chép.
   * Nhận: `providers` — ảnh chụp manifest Client ĐẦY ĐỦ.
   * Trả: không.
   * @throws Khi manifest hỏng, hoặc hai provider trùng id.
   */
  syncClientManifest(providers: readonly CordisInspectProviderManifest[]): void {
    const ids = new Set<string>();
    const validated = providers.map((provider) => {
      const manifest = validateManifest(provider);
      if (ids.has(manifest.id))
        throw new Error(`Client Cordis inspect manifest repeats provider "${manifest.id}"`);
      ids.add(manifest.id);
      return manifest;
    });
    this.clientManifest = Object.freeze(validated);
  }

  /**
   * Trả danh mục provider Host và Client đang biết.
   * Nhận: không.
   * Trả: provider Host TRƯỚC, rồi tới provider Client.
   */
  list(): CordisInspectProviderView[] {
    return [
      ...[...this.providers.values()].map(provider => view("host", provider.manifest)),
      ...(this.clientManifest ?? []).map(provider => view("client", provider)),
    ];
  }

  /**
   * Chạy MỘT truy vấn provider trên nền tảng sở hữu nó.
   * Nhận: `platform` — Host hay Client; `providerId` — provider chọn từ {@link list};
   * `methodName` — tên phương thức đã khai; `input` — đầu vào JSON không mất mát (có thể
   * vắng); `agent` — Agent và phạm vi đang hỏi; `signal` — tín hiệu huỷ lượt gọi công cụ.
   * Trả: dữ liệu JSON của provider; truy vấn Client thất bại NGAY khi Gateway không có Client sống và chỉ
   * giữ chẩn đoán thất bại ĐẦU TIÊN cho báo cáo hết hạn.
   * @throws Khi provider/phương thức không có, đầu vào bị từ chối, lượt gọi bị huỷ, hoặc Client lỗi/hết hạn.
   */
  async query(
    platform: CordisInspectPlatform,
    providerId: string,
    methodName: string,
    input: JsonValue | undefined,
    agent: Agent,
    signal: AbortSignal,
  ): Promise<JsonValue> {
    if (platform === "host") {
      const registration = this.providers.get(providerId);
      if (registration === undefined)
        throw new Error(`Host Cordis inspect provider "${providerId}" is not registered`);
      const method = findMethod(registration.manifest, methodName);
      validateInput("Host", providerId, method, input);
      signal.throwIfAborted();
      const data = await registration.query(methodName, input, { agent, signal });
      signal.throwIfAborted();
      return validateOutput("Host", providerId, method, data);
    }
    return await this.queryClient(providerId, methodName, input, agent, signal);
  }

  /**
   * Nhận câu trả lời Client HỢP LỆ ĐẦU TIÊN cho một truy vấn đang chờ.
   * Nhận: `agent` — Agent có phiên sở hữu truy vấn; `requestId` — danh tính truy vấn
   * Client đang chờ; `resolution` — kết quả hoặc thất bại từ provider Client.
   * Trả: xác nhận với `accepted` true CHỈ khi một kết quả thành công chốt được truy vấn; chỉ chẩn
   * đoán thất bại đầu tiên được giữ.
   */
  resolveClientQuery(
    agent: Agent,
    requestId: CordisInspectRequestId,
    resolution: CordisInspectQueryResolution,
  ): CordisInspectResolveAck {
    const pending = this.pending.get(requestId);
    if (pending === undefined || pending.request.agentId !== agent.id)
      return { accepted: false };
    // Một trang hỏng không được ngăn trang khác cung cấp kết quả hợp lệ.
    if (!resolution.ok) {
      pending.failure ??= `${resolution.reason}: ${resolution.message}`;
      return { accepted: false };
    }
    try {
      resolution = {
        ok: true,
        data: validateOutput("Client", pending.request.provider, pending.method, resolution.data),
      };
    }
    catch (error) {
      pending.failure ??= error instanceof Error ? error.message : String(error);
      return { accepted: false };
    }
    pending.settle(resolution);
    return { accepted: true };
  }

  /**
   * Phát truy vấn sang các trang Harness rồi chờ câu trả lời hợp lệ đầu tiên.
   * Nhận: `providerId`/`methodName` — mục tiêu đã chọn trong manifest Client;
   * `input` — đầu vào JSON; `agent` — Agent đang hỏi; `signal` — tín hiệu huỷ.
   * Trả: dữ liệu JSON đã kiểm của provider Client.
   * @throws Khi provider Client chưa đăng ký, không có trang nào sống, lượt gọi bị huỷ, hết hạn, hoặc
   * Client trả thất bại.
   */
  private async queryClient(
    providerId: string,
    methodName: string,
    input: JsonValue | undefined,
    agent: Agent,
    signal: AbortSignal,
  ): Promise<JsonValue> {
    const provider = this.clientManifest?.find(candidate => candidate.id === providerId);
    if (provider === undefined)
      throw new Error(`Client Cordis inspect provider "${providerId}" is not registered`);
    const method = findMethod(provider, methodName);
    validateInput("Client", providerId, method, input);
    signal.throwIfAborted();
    const gateway = this.ctx.get("typertGateway") as TypertGatewaySeam | undefined;
    if (gateway !== undefined && !gateway.hasLiveClient()) {
      throw new Error(`Client inspect query ${providerId}.${methodName} has no connected Harness page. Open or reconnect the Harness page, then retry.`);
    }
    const requestId = `inspect-${this.nextRequest++}` as CordisInspectRequestId;
    const request: CordisInspectQueryRequest = {
      requestId,
      agentId: agent.id,
      provider: providerId,
      method: methodName,
      ...input === undefined ? {} : { input },
    };
    const result = new Promise<CordisInspectQueryResolution>((resolve) => {
      this.pending.set(requestId, {
        request,
        method,
        settle: (resolution) => {
          this.pending.delete(requestId);
          resolve(resolution);
          try {
            (this.ctx as unknown as InspectContextSeam).emit("cordis/inspect-query-resolved", { requestId });
          }
          catch (error) {
            console.error("[cordis-host-runner] notifying Client inspect completion failed:", error);
          }
        },
      });
    });
    const onAbort = () => {
      this.pending.get(requestId)?.settle({
        ok: false,
        reason: "cancelled",
        message: `Client inspect query ${providerId}.${methodName} was cancelled`,
      });
    };
    const timer = setTimeout(() => {
      const pending = this.pending.get(requestId);
      if (pending === undefined)
        return;
      const detail = pending.failure === undefined
        ? "Open or reconnect the Harness page, then retry."
        : `Client failure: ${pending.failure}`;
      pending.settle({
        ok: false,
        reason: "provider-error",
        message: `Client inspect query ${providerId}.${methodName} timed out after ${this.clientQueryTimeoutMs}ms. ${detail}`,
      });
    }, this.clientQueryTimeoutMs);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      if (signal.aborted)
        onAbort();
      else
        (this.ctx as unknown as InspectContextSeam).emit("cordis/inspect-query", request);
      const resolution = await result;
      if (!resolution.ok)
        throw new Error(`${providerId}.${methodName}: ${resolution.message}`);
      return resolution.data;
    }
    finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      this.pending.delete(requestId);
    }
  }
}

/**
 * Chiếu MỘT manifest thành dòng danh mục, sao chép mảng phương thức.
 * Nhận: `platform` — nền tảng thực thi; `manifest` — manifest đã kiểm.
 * Trả: dòng danh mục gồm nền tảng và bản sao phương thức.
 */
function view(platform: CordisInspectPlatform, manifest: CordisInspectProviderManifest): CordisInspectProviderView {
  return { platform, ...manifest, methods: [...manifest.methods] };
}

/**
 * Kiểm rồi ĐÓNG BĂNG một manifest provider: id, mô tả, tên/mô tả phương thức, và hai JSON Schema.
 * Nhận: `manifest` — manifest thô cần kiểm.
 * Trả: manifest đã đóng băng, mảng phương thức cũng đóng băng.
 * @throws Khi id/mô tả/tên phương thức rỗng, tên phương thức trùng, mô tả phương thức thiếu, hoặc một
 * schema nằm ngoài tập JSON Schema được hỗ trợ.
 */
function validateManifest(manifest: CordisInspectProviderManifest): CordisInspectProviderManifest {
  if (manifest.id.trim() === "")
    throw new Error("Cordis inspect provider id must not be empty");
  if (manifest.description.trim() === "")
    throw new Error(`Cordis inspect provider "${manifest.id}" needs a description`);
  const names = new Set<string>();
  const methods = manifest.methods.map((method) => {
    if (method.name.trim() === "")
      throw new Error(`Cordis inspect provider "${manifest.id}" has an empty method name`);
    if (names.has(method.name))
      throw new Error(`Cordis inspect provider "${manifest.id}" repeats method "${method.name}"`);
    if (method.description.trim() === "")
      throw new Error(`Cordis inspect method ${manifest.id}.${method.name} needs a description`);
    assertSupportedJsonSchema(method.inputSchema);
    assertSupportedJsonSchema(method.outputSchema);
    names.add(method.name);
    return Object.freeze({ ...method });
  });
  return Object.freeze({ ...manifest, methods: Object.freeze(methods) });
}

/**
 * Tìm MỘT phương thức theo tên trong manifest đã kiểm.
 * Nhận: `manifest` — manifest provider; `name` — tên phương thức đã khai.
 * Trả: phương thức tìm được.
 * @throws Khi provider không khai phương thức mang tên đó.
 */
function findMethod(manifest: CordisInspectProviderManifest, name: string): CordisInspectMethodManifest {
  const method = manifest.methods.find(candidate => candidate.name === name);
  if (method === undefined)
    throw new Error(`Cordis inspect provider "${manifest.id}" has no method "${name}"`);
  return method;
}

/**
 * Kiểm đầu vào theo schema đầu vào của phương thức.
 * Nhận: `platform` — NHÃN nền tảng ("Host"/"Client") dùng trong thông điệp; `provider` — id provider;
 * `method` — phương thức đã chọn; `input` — đầu vào, vắng thì coi là `{}`.
 * Trả: không.
 * @throws Khi đầu vào vi phạm schema đầu vào.
 */
function validateInput(
  platform: string,
  provider: string,
  method: CordisInspectMethodManifest,
  input: JsonValue | undefined,
): void {
  const violations = validateJsonSchemaValue(method.inputSchema as unknown as JsonSchemaNode, input ?? {}, "input");
  if (violations.length > 0)
    throw new Error(`${platform} Cordis inspect ${provider}.${method.name} rejected input: ${violations.join("; ")}`);
}

/**
 * Chụp JSON rồi kiểm đầu ra theo schema đầu ra của phương thức.
 * Nhận: `platform` — NHÃN nền tảng ("Host"/"Client") dùng trong thông điệp; `provider` — id provider;
 * `method` — phương thức đã chọn; `data` — dữ liệu provider trả về.
 * Trả: ảnh chụp JSON không mất mát của dữ liệu.
 * @throws Khi dữ liệu không phải JSON mất mát, hoặc vi phạm schema đầu ra.
 */
function validateOutput(
  platform: string,
  provider: string,
  method: CordisInspectMethodManifest,
  data: JsonValue,
): JsonValue {
  const snapshot = snapshotJsonValue(data);
  if (snapshot === undefined)
    throw new Error(`${platform} Cordis inspect ${provider}.${method.name} returned a non-JSON value`);
  const violations = validateJsonSchemaValue(method.outputSchema as unknown as JsonSchemaNode, snapshot, "output");
  if (violations.length > 0)
    throw new Error(`${platform} Cordis inspect ${provider}.${method.name} returned invalid output: ${violations.join("; ")}`);
  return snapshot;
}
