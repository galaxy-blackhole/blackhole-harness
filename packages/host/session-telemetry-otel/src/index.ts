/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Telemetry-otel` của DSH: nhà cung cấp OpenTelemetry
 *      cho năng lực telemetry phiên — cấp phép thu log theo phản hồi, dựng đường ống SDK chặn byte qua seam
 *      `ctx.otel`, và giữ hạn chót tắt ngoài cùng. Nguồn đối chiếu: README.md (G4).
 */
import { createRequire } from "node:module";

import type { Context } from "@deepseek-ai/cordis";
import { getOrCreateAnonymousUserId } from "@deepseek-ai/dsh-anonymous-user-id";
import { APP_IDENTITY } from "@deepseek-ai/dsh-llm";
import type { LogExporterOptions, SessionLogProcessorOptions } from "@deepseek-ai/dsh-otel";
import { Session, type SessionEvent, type SessionId } from "@deepseek-ai/dsh-session";
import {
  SessionTelemetryBackend,
  SessionTelemetryCoordinator,
  type SessionTelemetryRecord,
  type SessionTelemetrySeverity,
  type SessionTelemetrySharingStatus,
} from "@deepseek-ai/dsh-session-telemetry";
import { SeverityNumber } from "@opentelemetry/api-logs";
import z from "@deepseek-ai/schemastery";

// CHỈ MƯỢN KIỂU: hai gói dưới khai `SessionEventMap` cho `feedback/record` · `feedback/message-put` ·
// `feedback/message-delete` và sự kiện `feedback/committed` trên `Context` của cordis. Import kiểu RỖNG để
// bộ khai báo đó vào chương trình `tsc`; KHÔNG nạp gì lúc chạy (bản gốc cũng chỉ khai chúng ở peer).
import type {} from "@deepseek-ai/dsh-command-feedback";
import type {} from "@deepseek-ai/dsh-message-feedback";

/** Chính sách chia sẻ phiên do {@link Config.mode} chọn. */
export enum SessionTelemetryMode {
  /** Chỉ tải lên khi con người nộp phản hồi cho CHÍNH phiên đó. */
  FEEDBACK_ONLY = "FEEDBACK_ONLY",
  /** Không dựng SDK, không tải lên; chỉ cảnh báo khi phản hồi ở lại máy. */
  DISABLED = "DISABLED",
}

/** Chính sách chia sẻ mặc định cho schema và cho lượt dựng trực tiếp. */
export const DEFAULT_TELEMETRY_MODE = SessionTelemetryMode.FEEDBACK_ONLY;

/** Câu cảnh báo khi chế độ DISABLED bỏ rơi một phản hồi đã ghi vào log. */
const DISABLED_FEEDBACK_WARNING =
  "OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry";

/** Câu cảnh báo khi một sự kiện KHÔNG thuộc log canonical của phiên (không được phép phát lại). */
const NON_CANONICAL_EVENT_WARNING = "session telemetry ignored an event absent from the canonical session log";

/** Câu cảnh báo khi tầng làm sạch thu hồi mất `sourceEvent` của một bản ghi. */
const WITHHELD_RECORD_WARNING = "Session log record withheld: redaction removed sourceEvent";

/**
 * Chỉ phản hồi TƯỜNG MINH của chính phiên này mới cấp phép phát lại; seed của fork thì không.
 * Nhận: phiên sở hữu log canonical, và sự kiện vừa được thêm vào log.
 * Trả: true khi sự kiện là phản hồi do con người nộp cho ĐÚNG phiên này.
 */
function isFeedback(session: Session, event: SessionEvent): boolean {
  if (event.seq < session.inheritedEventCount) return false;
  switch (event.type) {
    case "feedback/record":
      return true;
    case "feedback/message-put":
    case "feedback/message-delete":
      return event.data.sessionId === session.id;
    default:
      return false;
  }
}

/**
 * Đóng cửa khi lượt dựng trực tiếp bỏ qua schema cấu hình của cordis.
 * Nhận: giá trị đã bị loại khỏi mọi nhánh hợp lệ của enum.
 * Trả: không bao giờ trả — luôn ném lỗi.
 */
function assertNever(value: never): never {
  throw new Error(`session-telemetry-otel: unsupported mode ${JSON.stringify(value)}`);
}

/**
 * Phân giải chế độ và TỪ CHỐI giá trị lạ trước khi dựng vận chuyển.
 * Nhận: giá trị `mode` thô của cấu hình (có thể vắng mặt).
 * Trả: chế độ hợp lệ; ném lỗi khi giá trị không thuộc enum.
 */
function resolveMode(mode: SessionTelemetryMode | undefined): SessionTelemetryMode {
  const resolved = mode ?? DEFAULT_TELEMETRY_MODE;
  switch (resolved) {
    case SessionTelemetryMode.FEEDBACK_ONLY:
    case SessionTelemetryMode.DISABLED:
      return resolved;
    default:
      return assertNever(resolved);
  }
}

/**
 * Ánh xạ chế độ đã tuần tự hoá sang từ vựng chia sẻ độc-lập-backend của seam.
 * Nhận: chế độ hợp lệ.
 * Trả: trạng thái chia sẻ mà dịch vụ `sessionTelemetry` công bố.
 */
function sharingStatusFor(mode: SessionTelemetryMode): SessionTelemetrySharingStatus {
  switch (mode) {
    case SessionTelemetryMode.FEEDBACK_ONLY:
      return "feedback-only";
    case SessionTelemetryMode.DISABLED:
      return "disabled";
    default:
      return assertNever(mode);
  }
}

/**
 * Cấu hình của plugin: chính sách chia sẻ, tuỳ chọn vận chuyển của SDK, hàng đợi byte/số lượng và hạn
 * chót tắt. Chế độ tải lên kiểm endpoint + hạn chót ngay lúc nạp plugin; `DISABLED` không đọc cả hai.
 */
export interface Config {
  /** Mặc định `FEEDBACK_ONLY`: chỉ thu lịch sử phiên khi phản hồi được nộp tường minh. */
  mode?: SessionTelemetryMode;
  /** Tuỳ chọn vận chuyển HTTP của SDK, kể cả header định tuyến. URL BẮT BUỘC khi tải lên. */
  exporter?: Omit<LogExporterOptions, "url"> & {
    /** Endpoint logs đầy đủ (vd `https://collector.example.com/v1/logs`); kiểm lúc nạp plugin. */
    url?: string;
  };
  /** Tuỳ chọn đếm/hàng đợi/nhịp và watchdog từng request của bộ xử lý chặn byte. */
  processor?: SessionLogProcessorOptions;
  /** Thời gian tối đa chờ đường tắt hoàn chỉnh của nhà cung cấp SDK. */
  shutdownTimeoutMillis?: number;
  /** Trần byte của một request OTLP CHƯA nén, tối đa 4.000.000. */
  maxRequestBytes?: number;
}

/**
 * Schema schemastery cho {@link Config}; cordis chạy nó TRƯỚC khi plugin khởi động.
 * Lượt dựng kiểm endpoint + hạn chót tắt; bộ báo cáo kiểm giới hạn byte và hàng đợi của phiên.
 * `exporter`/`processor` là `z.any()` đúng như bản gốc: kiểu được kiểm ở tầng nhận.
 */
export const Config = z.object({
  mode: z.union(Object.values(SessionTelemetryMode)).default(DEFAULT_TELEMETRY_MODE),
  exporter: z.any(),
  processor: z.any(),
  shutdownTimeoutMillis: z.number(),
  maxRequestBytes: z.number().step(1).min(1).max(4e6),
});

/** Thời gian chờ mặc định cho toàn bộ đường tắt của SDK (mili giây). */
export const DEFAULT_SHUTDOWN_TIMEOUT_MILLIS = 3000;

/** Trần của một hạn chót hẹn giờ (2^31 − 1 ms) — vượt là `setTimeout` bắn ngay. */
const MAX_TIMER_DELAY_MILLIS = 2147483647;

/** Ánh xạ ba mức severity của Service Definition sang số severity của OTel. */
const SEVERITY: Record<SessionTelemetrySeverity, SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/**
 * Một sự kiện canonical + danh tính phiên + thân đã làm sạch — ĐÚNG hình dạng mà seam `ctx.otel` nhận.
 * Khai tại chỗ (không mượn tên lớp của gói `dsh-otel`) vì trong MỘT chương trình `tsc` có **hai** bộ khai
 * báo `Context.otel`: gói kernel `@deepseek-ai/dsh-otel` và bản viết lại `packages/host/otel`. Hình dạng
 * dưới đây là giao của cả hai, nên backend chạy được với BẤT KỲ bên nào được cấp.
 */
interface SessionLogRecordShape {
  /** Phiên sở hữu sự kiện. */
  sessionId: SessionId;
  /** Phong bì sự kiện canonical với thân đã làm sạch. */
  event: Omit<SessionEvent, "data"> & { data: unknown };
  /** Thuộc tính danh tính do coordinator dựng (đi thẳng vào record OTLP). */
  attributes?: Record<string, string | number>;
  /** Số severity OTel; vắng mặt thì seam dùng INFO. */
  severityNumber?: SeverityNumber;
}

/** Ba thành viên của kênh log phiên mà backend này thật sự dùng (phần còn lại thuộc seam). */
interface SessionLogChannel {
  /** Xếp MỘT sự kiện canonical vào hàng đợi OTLP — không chờ mạng, không ném. */
  reportSessionLog(record: SessionLogRecordShape): void;
  /** Bảo dừng các request đang xếp hàng sau hạn chót của backend. */
  stopPending(): void;
  /** Rút cạn hàng đợi và nhả vận chuyển của SDK. */
  shutdown(): Promise<void>;
}

/**
 * Backend plugin — điểm vào DUY NHẤT mà một deployment nạp. Nó luôn đăng ký dịch vụ
 * `sessionTelemetry` (nạp hai lần là ném). `FEEDBACK_ONLY` nối đường ống SDK và một
 * {@link SessionTelemetryCoordinator} thu-theo-yêu-cầu; `DISABLED` không dựng trạng thái SDK nào và chỉ
 * nghe để cảnh báo khi phản hồi đã ghi vẫn ở lại máy.
 */
export class OpenTelemetrySessionBackend extends SessionTelemetryBackend {
  /** Hai seam mà tầng nạp phải cấp trước khi backend được dựng. */
  static inject = ["sessions", "otel"];

  /** Schema cấu hình mà cordis chạy trước khi dựng thể hiện. */
  static Config = Config;

  /** Kênh log phiên do seam `ctx.otel` cấp; `undefined` ở chế độ `DISABLED`. */
  private readonly provider: SessionLogChannel | undefined;

  /** Hạn chót ngoài cùng cho toàn bộ đường tắt của SDK (mili giây). */
  private readonly shutdownTimeoutMillis: number;

  /** Chế độ chia sẻ mà dịch vụ công bố, ĐỘC LẬP với việc SDK có giao được hay không. */
  readonly sharing: SessionTelemetrySharingStatus;

  /**
   * Đăng ký dịch vụ `sessionTelemetry` và (ở chế độ tải lên) dựng kênh log phiên + bộ thu.
   * Nhận: context của kernel (đã có `sessions`/`otel`), và cấu hình ĐÃ qua schema.
   * Trả: không trả gì; hiệu ứng là dịch vụ đã đăng ký, các listener `session/event` + `feedback/committed`
   * đã gắn, và một `ctx.effect` tắt-dọn của chính bộ thu (đăng ký bên trong coordinator).
   */
  constructor(ctx: Context, config: Config) {
    const mode = resolveMode(config.mode);
    super(ctx);
    this.sharing = sharingStatusFor(mode);
    if (mode === SessionTelemetryMode.DISABLED) {
      this.provider = undefined;
      this.shutdownTimeoutMillis = DEFAULT_SHUTDOWN_TIMEOUT_MILLIS;
      ctx.on("session/event", (session, event) => {
        if (isFeedback(session, event)) ctx.logger.warn(DISABLED_FEEDBACK_WARNING);
      });
      return;
    }
    const url = config.exporter?.url;
    if (url === undefined || url.length === 0) {
      throw new Error("session-telemetry-otel: exporter.url is required (the full OTLP logs endpoint)");
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`session-telemetry-otel: exporter.url is not a valid URL: ${JSON.stringify(url)}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`session-telemetry-otel: exporter.url must be http(s), got ${parsed.protocol}`);
    }
    const batchSize = config.processor?.maxExportBatchSize;
    if (batchSize !== undefined && (!Number.isInteger(batchSize) || batchSize < 1)) {
      throw new Error(
        `session-telemetry-otel: processor.maxExportBatchSize must be a positive integer, got ${String(batchSize)}`,
      );
    }
    const shutdownTimeoutMillis = config.shutdownTimeoutMillis ?? DEFAULT_SHUTDOWN_TIMEOUT_MILLIS;
    if (
      !Number.isFinite(shutdownTimeoutMillis) ||
      shutdownTimeoutMillis <= 0 ||
      shutdownTimeoutMillis > MAX_TIMER_DELAY_MILLIS
    ) {
      throw new Error(
        "session-telemetry-otel: shutdownTimeoutMillis must be a positive finite number no greater than " +
          `${MAX_TIMER_DELAY_MILLIS}, got ${String(shutdownTimeoutMillis)}`,
      );
    }
    this.shutdownTimeoutMillis = shutdownTimeoutMillis;
    // Phiên bản đọc từ CHÍNH manifest của gói (cơ chế y bản gốc) — xem README gói §4 về giá trị 0.2.1-alpha.4.
    const { version } = createRequire(import.meta.url)("../package.json") as { version: string };
    const reporter = ctx.otel.createSessionLogReporter({
      scope: {
        name: "@deepseek-ai/dsh-session-telemetry-otel",
        version,
      },
      exporter: {
        ...config.exporter,
        url,
      },
      ...(config.processor === undefined ? {} : { processor: config.processor }),
      ...(config.maxRequestBytes === undefined ? {} : { maxRequestBytes: config.maxRequestBytes }),
      resourceAttributes: {
        "service.name": APP_IDENTITY.product,
        "service.version": APP_IDENTITY.version,
        "user.id": getOrCreateAnonymousUserId(),
      },
      onFailure: (message, error) => {
        ctx.logger.warn(message, error);
      },
    });
    this.provider = reporter;
    const enqueue = (record: SessionTelemetryRecord): void => {
      if (record.sourceEvent === undefined) {
        ctx.logger.warn(WITHHELD_RECORD_WARNING);
        return;
      }
      reporter.reportSessionLog({
        sessionId: record.sourceEvent.sessionId,
        event: {
          ...record.sourceEvent.envelope,
          data: record.body,
        },
        severityNumber: SEVERITY[record.severity],
        attributes: record.attributes,
      });
    };
    const coordinator = new SessionTelemetryCoordinator(
      ctx,
      {
        emit: enqueue,
        shutdown: () => this.shutdown(),
      },
      {
        capture: "on-demand",
        includeHistory: true,
      },
    );
    ctx.on("session/event", (session, event) => {
      if (!isFeedback(session, event)) return;
      if (session.eventAt(event.seq) !== event) {
        ctx.logger.warn(NON_CANONICAL_EVENT_WARNING);
        return;
      }
      coordinator.captureSession(session, event.seq);
    });
    ctx.on("feedback/committed", (inspection) => {
      const snapshot = structuredClone(inspection);
      const committed = snapshot.events.at(-1);
      if (committed === undefined) return;
      const session = Session.fromRestore(
        snapshot.meta.id,
        snapshot.events,
        snapshot.meta,
        snapshot.inheritedEventCount,
        "detached",
        ctx.sessions.messageProjections,
      );
      if (isFeedback(session, committed)) coordinator.captureSession(session, committed.seq);
    });
  }

  /**
   * Bỏ mọi bản ghi đi thẳng. CHỈ một lượt nộp phản hồi canonical MỚI cấp phép thu, qua sink riêng của
   * coordinator — cho mọi nhà cung cấp.
   * Nhận: bản ghi đi thẳng (không bao giờ được tải lên).
   * Trả: không trả gì.
   */
  emit(_record: SessionTelemetryRecord): void {}

  /**
   * Rút cạn các request HTTP đang xếp hàng tới hạn chót của deployment. Watchdog KHÔNG bao giờ nhả một
   * chỗ vận chuyển chưa quyết; tới hạn chót ngoài cùng thì các bản ghi đang xếp bị bỏ và không request
   * nào được bắt đầu nữa.
   * Nhận: không.
   * Trả: promise hoàn tất sau khi vận chuyển tắt xong, hoặc bị từ chối ĐÚNG hạn chót đã cấu hình.
   */
  async shutdown(): Promise<void> {
    const provider = this.provider;
    if (provider === undefined) return;
    const providerShutdown = provider.shutdown();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        provider.stopPending();
        reject(new Error(`session-telemetry-otel: provider shutdown exceeded ${this.shutdownTimeoutMillis}ms`));
      }, this.shutdownTimeoutMillis);
    });
    try {
      await Promise.race([providerShutdown, deadline]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

export default OpenTelemetrySessionBackend;
