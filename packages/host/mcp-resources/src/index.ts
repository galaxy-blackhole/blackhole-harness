/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Resources: tài nguyên MCP có phạm vi — sổ provider
 *      theo scope, mục system prompt nêu tên server, và ba tool dùng chung cho mọi server đã cấu hình.
 *      Nguồn đối chiếu: xem README.md của package (G4).
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import { NamedEntries, ScopedLayers, createScope, scopeOf, type ScopeKey } from "@deepseek-ai/dsh-scope";
import type { ToolExecution } from "@galaxy-blackhole/gbh-host-tools";
import { registerResourceTools } from "./tools.ts";
import type { JsonValue, McpResourceProvider, McpResourceRequest } from "./types.ts";

export type { JsonValue, McpResourceProvider, McpResourceRequest } from "./types.ts";

/** Một mục system prompt mà seam `systemPrompt` nhận (khai theo HÌNH DẠNG, không import gói seam). */
interface PromptSectionInput {
  /** Tên mục, duy nhất trong một sổ. */
  name: string;
  /** Vị trí chèn; mục có order nhỏ hơn đứng trước. */
  order: number;
  /** Văn bản, hoặc hàm dựng văn bản theo ngữ cảnh lắp ráp. */
  text: (context: { scope?: ScopeKey }) => string;
  /** `false` để giữ nguyên văn, không nội suy `{{variable}}`. */
  interpolate?: boolean;
}

/** Seam `systemPrompt` — đúng hai mặt mà row này dùng. */
interface SystemPromptSeam {
  /**
   * Đăng ký một mục system prompt.
   * Nhận: mục cần đăng ký.
   * Trả: disposer gỡ mục đó.
   */
  section(section: PromptSectionInput): () => void;
  /**
   * Đọc vị trí trung tâm đã cấp cho một tên mục.
   * Nhận: tên vị trí (`MCP_SERVERS`).
   * Trả: số thứ tự chèn.
   */
  getSectionOrder(name: "MCP_SERVERS"): number;
}

/** Một lớp provider của MỘT scope: bảng tên → provider, và hiệu ứng tool dùng chung của lớp đó. */
class ResourceLayer {
  /** Provider của lớp này; tên trùng trong CÙNG một scope là lỗi cấu hình. */
  readonly servers = new NamedEntries<McpResourceProvider>(
    (name) => new Error(`MCP resource server "${name}" is already registered in this scope`),
  );
  /** Hiệu ứng gỡ ba tool dùng chung, chỉ tồn tại khi lớp còn ít nhất một provider. */
  disposeTools: (() => Promise<void>) | undefined;

  /**
   * Cho biết lớp này có provider nào không.
   * Nhận: không.
   * Trả: `true` khi bảng tên rỗng.
   */
  isEmpty(): boolean {
    return this.servers.isEmpty();
  }
}

/**
 * Truy cập tài nguyên có phạm vi, cộng ba tool dùng chung cho mọi server MCP đã cấu hình.
 *
 * Service tên `mcpResources`; provider do plugin kết nối của từng server đăng ký, còn tool dùng
 * chung thì thuộc về service này nên sống lâu hơn plugin của bất kỳ một server nào.
 */
export class McpResourceRuntime extends Service {
  /** Sổ tool mà người tiêu thụ cần có trước khi đăng ký ba tool dùng chung. */
  static inject: string[] = ["tools"];

  /** Các lớp provider theo scope cộng lớp toàn cục; đọc không bao giờ tạo lớp mới. */
  private readonly layers = new ScopedLayers(() => new ResourceLayer(), () => void 0);

  /** Context sở hữu riêng các lượt đăng ký tool — chúng phải sống ngoài plugin của từng server. */
  private readonly selfCtx: Context;

  /**
   * Đăng ký service `mcpResources` và mục system prompt nêu tên server khả kiến.
   * Nhận: context host (chờ seam `systemPrompt` để mục prompt vào sổ).
   * Trả: không — hiệu ứng là service đã cắm, cộng lượt chèn mục prompt khi seam có mặt.
   */
  constructor(ctx: Context) {
    super(ctx, "mcpResources");
    this.selfCtx = ctx;
    ctx.inject(["systemPrompt"], (inner) => {
      const prompt = (inner as unknown as { systemPrompt: SystemPromptSeam }).systemPrompt;
      prompt.section({
        name: "mcp-resource-servers",
        order: prompt.getSectionOrder("MCP_SERVERS"),
        interpolate: false,
        text: ({ scope }) => {
          const names = [...this.layers.merge(scope, (layer) => layer.servers).keys()].sort();
          if (names.length === 0) return "";
          return (
            "## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, " +
            "or read_mcp_resource with one of these names as the server argument: " +
            `${JSON.stringify(names)}.`
          );
        },
      });
    });
  }

  /**
   * Đăng ký một server và mở ba tool dùng chung chừng nào scope đó còn provider.
   * @param server - tên server đã cấu hình, duy nhất trong scope này.
   * @param provider - phép toán tài nguyên do chủ kết nối sở hữu.
   * @returns hiệu ứng gỡ đúng lượt đăng ký này.
   */
  register(server: string, provider: McpResourceProvider): () => void {
    const ctx = this.ctx;
    const scope = scopeOf(ctx);
    return ctx.effect(
      function* (this: McpResourceRuntime): Generator<() => void, void, void> {
        let disposal: Promise<void> | undefined;
        // Y NGUYÊN bản gốc: disposer này TRẢ giá trị `disposal` chứ không gọi nó — lượt gọi thật
        // nằm trong undo của lớp (bên dưới), và nó chạy TRƯỚC disposer này (thứ tự ngược).
        yield () => disposal;
        yield this.layers.effect(
          ctx,
          (layer) => {
            const first = layer.servers.isEmpty();
            const remove = layer.servers.insert(server, provider);
            try {
              if (first) layer.disposeTools = this.registerTools(scope);
            } catch (error) {
              remove();
              throw error;
            }
            return (): void => {
              remove();
              if (layer.servers.isEmpty()) disposal = layer.disposeTools?.();
            };
          },
          { label: `mcpResources.provider(${server})` },
        );
      }.bind(this),
      `mcpResources.register(${server})`,
    );
  }

  /**
   * Sở hữu tool của MỘT scope, độc lập với các plugin server đã cấu hình.
   * @param scope - khoá scope của người đăng ký, hoặc `undefined` cho lớp toàn cục.
   * @returns hiệu ứng gỡ cả ba tool của scope đó.
   */
  private registerTools(scope: ScopeKey | undefined): () => Promise<void> {
    const ctx = this.selfCtx;
    return ctx.effect(
      function* (this: McpResourceRuntime): Generator<() => void, void, void> {
        let toolCtx = ctx;
        if (scope !== undefined) {
          const owned = createScope(ctx, scope);
          yield owned.rawDispose;
          toolCtx = owned.ctx;
        }
        yield registerResourceTools(toolCtx, (server, request, exec) => this.request(server, request, exec));
      }.bind(this),
      "mcpResources.tools",
    );
  }

  /**
   * Phân giải server mà NGƯỜI GỌI thấy TRƯỚC khi bắt đầu bất kỳ phép toán mạng nào.
   * @param server - tên server do model yêu cầu.
   * @param request - method + cursor/uri.
   * @param exec - danh tính người gọi (quyết định scope) và tín hiệu huỷ.
   * @returns kết quả JSON lossless của provider.
   * @throws khi tên server không khả kiến trong scope của agent đang gọi.
   */
  private request(server: string, request: McpResourceRequest, exec: ToolExecution): Promise<JsonValue> {
    const provider = this.layers.merge(exec.agent, (layer) => layer.servers).get(server);
    if (!provider) throw new Error(`MCP resource server "${server}" is unavailable in this agent's scope`);
    return provider.request(request, exec);
  }
}

export default McpResourceRuntime;