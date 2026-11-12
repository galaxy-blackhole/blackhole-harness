/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kenh LOG PHIEN: gom lo theo BYTE + so luong, mot request mot thoi diem, tran 4.000.000 byte.
 */
import type { Attributes } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { ExportResultCode } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import type { BatchLogRecordProcessorOptions, LogRecordExporter } from "@opentelemetry/sdk-logs";
import type { SessionEvent, SessionId } from "@deepseek-ai/dsh-session";
import { JsonLogsSerializer } from "@opentelemetry/otlp-transformer";
import { createLogExporter, type LogExporterOptions } from "./transport.ts";

/** Tran request len collector, tinh bang byte UTF-8 CHUA nen, ke ca vo OTLP. */
export const SESSION_LOG_MAX_REQUEST_BYTES = 4_000_000;

/** Tran cung cua mot truong so nguyen cua bo gom lo (2^31 - 1, giong ban goc). */
const PROCESSOR_INTEGER_CEILING = 2_147_483_647;

/** Mot su kien chuan kem danh tinh phien rieng va du lieu da duoc lam sach. */
export interface SessionLogRecord {
  /** Phien so huu su kien nay. */
  sessionId: SessionId;
  /** Vo su kien day du; `data` la ban da duoc chinh sach thu thap xuat ra. */
  event: Omit<SessionEvent, "data"> & {
    data: unknown;
  };
  /** Metadata thu thap bo sung; `sessionId` va `content` LUON do reporter gan. */
  attributes?: Attributes;
  /** Bo qua thi dung INFO. */
  severityNumber?: SeverityNumber;
}

/**
 * Cac truong gom lo theo byte va so luong ma {@link SessionLogProcessor} hien thuc.
 *
 * `exporter` thuoc kenh so huu, con `selfObsMeterProvider` bi loai vi bo gom lo nay
 * khong tu ghi metrics.
 */
export type SessionLogProcessorOptions = Omit<BatchLogRecordProcessorOptions, "exporter" | "selfObsMeterProvider">;

/** Thiet lap van chuyen va hang doi byte/so luong cua kenh log phien. */
export interface SessionLogOptions {
  /** Diem den va thiet lap HTTP cua SDK; khong ho tro metrics tu-quan-sat cua exporter. */
  exporter: LogExporterOptions;
  /** Thiet lap hang doi RIENG cua log phien, doc lap voi gom lo su kien thuong. */
  processor?: SessionLogProcessorOptions;
  /** Co the ha thap, nhung KHONG BAO GIO vuot tran 4.000.000 byte cua collector. */
  maxRequestBytes?: number;
  /** Pham vi do ben nghiep vu cung cap. */
  scope: {
    name: string;
    version?: string;
  };
  /** Danh tinh ung dung va nguoi dung an danh mang tren resource OTLP. */
  resourceAttributes: Attributes;
  /** Bao tung ban ghi bi tu choi va loi mang, KHONG ghi noi dung cua chung. */
  onFailure: (message: string, error?: Error) => void;
}

/**
 * Kiem thiet lap byte va hang doi TRUOC khi dung duong ong SDK.
 * @param options - cac gioi han rieng cua log phien do ben so huu cung cap.
 * @returns gioi han request len collector da resolve.
 */
export function resolveSessionLogLimits(options: Pick<SessionLogOptions, "maxRequestBytes" | "processor">): number {
  const limit = options.maxRequestBytes ?? SESSION_LOG_MAX_REQUEST_BYTES;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SESSION_LOG_MAX_REQUEST_BYTES) {
    throw new Error("session log maxRequestBytes must be an integer between 1 and " + String(SESSION_LOG_MAX_REQUEST_BYTES));
  }
  for (const key of ["maxQueueSize", "maxExportBatchSize", "scheduledDelayMillis", "exportTimeoutMillis"] as const) {
    const value = options.processor?.[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > PROCESSOR_INTEGER_CEILING)) {
      throw new Error("session log processor." + key + " must be a positive integer no greater than " + String(PROCESSOR_INTEGER_CEILING));
    }
  }
  const queue = options.processor?.maxQueueSize ?? 2048;
  if ((options.processor?.maxExportBatchSize ?? 512) > queue) {
    throw new Error("session log maxExportBatchSize must not exceed maxQueueSize");
  }
  return limit;
}

/** Mot ban ghi da duoc do kich thuoc va xep vao hang doi. */
interface QueuedRecord {
  /** Ban ghi SDK. */
  record: Parameters<LogRecordExporter["export"]>[0][number];
  /** Kich thuoc byte cua request CHUA NEN neu ban ghi nay di mot minh. */
  bytes: number;
}

/** Gom lo theo byte va so luong, chi mot request van chuyen tren duong bay tai moi thoi diem. */
export class SessionLogProcessor {
  /** Exporter cua kenh. */
  private readonly exporter: LogRecordExporter;
  /** Tran byte cua mot request. */
  private readonly limit: number;
  /** Thiet lap hang doi da resolve. */
  private readonly config: Required<SessionLogProcessorOptions>;
  /** Ham chan doan cua ben goi. */
  private readonly warn: (message: string, error?: Error) => void;
  /** Hang doi ban ghi dang cho. */
  private readonly queue: QueuedRecord[] = [];
  /** Tong byte dang nam trong hang doi. */
  private bytes = 0;
  /** Hen gio gui theo `scheduledDelayMillis`. */
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Lan drain dang chay, neu co. */
  private active: Promise<void> | undefined;
  /** Ket qua shutdown (memoize). */
  private shutdownPromise: Promise<void> | undefined;
  /** Da dung nhan ban ghi moi (sau khi het han shutdown). */
  private stopped = false;

  /**
   * @param exporter - exporter cua kenh nay.
   * @param limit - tran byte cua mot request.
   * @param config - thiet lap hang doi da resolve.
   * @param warn - ham chan doan khi tu choi ban ghi hoac gui that bai.
   */
  constructor(exporter: LogRecordExporter, limit: number, config: Required<SessionLogProcessorOptions>, warn: (message: string, error?: Error) => void) {
    this.exporter = exporter;
    this.limit = limit;
    this.config = config;
    this.warn = warn;
  }

  /**
   * Nhan mot ban ghi: do byte, tu choi neu vuot tran, roi hen/gui theo nguong.
   * @param record - ban ghi SDK da qua `logger.emit`.
   */
  onEmit(record: QueuedRecord["record"]): void {
    if (this.stopped) return;
    if (this.queue.length >= this.config.maxQueueSize) {
      this.warn("Session log queue is full; record rejected");
      return;
    }
    let bytes: number;
    try {
      const serialized = JsonLogsSerializer.serializeRequest([record]);
      if (serialized === undefined) throw new Error("Session log serialization produced no request");
      bytes = serialized.byteLength;
    } catch (error) {
      this.warn("Session log serialization failed; record rejected", error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (bytes > this.limit) {
      this.warn("Session log record rejected; content was not truncated", new Error("Session log record exceeds maxRequestBytes: " + String(bytes) + " > " + String(this.limit)));
      return;
    }
    this.queue.push({ record, bytes });
    this.bytes += bytes;
    if (this.active !== undefined) return;
    if (this.queue.length >= this.config.maxExportBatchSize || this.bytes >= this.limit) this.forceFlush();
    else if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.forceFlush();
      }, this.config.scheduledDelayMillis);
      this.timer.unref();
    }
  }

  /**
   * Gui ngay phan dang cho (bo hen gio); tra ve lan drain dang chay neu co.
   * @returns hoan tat khi lo hien tai da gui xong.
   */
  forceFlush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.active !== undefined) return this.active;
    if (this.queue.length === 0) return Promise.resolve();
    this.active = this.drain();
    return this.active;
  }

  /** Gui lien tuc tung lo mot cho toi khi hang doi rong; luon nha `active` khi xong. */
  private async drain(): Promise<void> {
    try {
      while (!this.stopped && this.queue.length > 0) {
        let bytes = 0;
        let count = 0;
        for (const entry of this.queue) {
          if (count === this.config.maxExportBatchSize || bytes + entry.bytes > this.limit) break;
          bytes += entry.bytes;
          count += 1;
        }
        const records = this.queue.splice(0, count).map((entry) => entry.record);
        this.bytes -= bytes;
        await this.send(records);
        await this.exporter.forceFlush();
      }
    } finally {
      this.active = undefined;
    }
  }

  /**
   * Gui mot lo va CHO van chuyen settle (co watchdog chan doan, khong huy request).
   * @param records - cac ban ghi cua lo.
   * @returns hoan tat khi exporter goi callback hoac nem loi.
   */
  private send(records: QueuedRecord["record"][]): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.warn("Session log request exceeded exportTimeoutMillis; waiting for transport settlement");
      }, this.config.exportTimeoutMillis);
      timer.unref();
      const finish = (error?: Error): void => {
        clearTimeout(timer);
        if (error !== undefined) this.warn("Session log export failed", error);
        resolve();
      };
      try {
        this.exporter.export(records, (result) => {
          finish(result.code === ExportResultCode.SUCCESS ? undefined : (result.error ?? new Error("Session log HTTP export failed")));
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Dung nhan ban ghi moi va xoa hang doi (sau khi het han shutdown cua backend). */
  stopPending(): void {
    this.stopped = true;
    this.queue.length = 0;
    this.bytes = 0;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /**
   * Gui not hang doi roi shutdown exporter (memoize: goi nhieu lan tra cung mot promise).
   * @returns hoan tat khi hang doi da gui va exporter da shutdown.
   */
  shutdown(): Promise<void> {
    this.shutdownPromise ??= this.forceFlush().then(() => this.exporter.shutdown());
    return this.shutdownPromise;
  }
}

/** So huu log phien da duoc cap phep bang feedback; KHONG mount provider/hang doi su kien thuong. */
export class SessionLogReporter {
  /** Nha cung cap logger cua SDK. */
  private readonly provider: LoggerProvider;
  /** Bo gom lo theo byte/so luong cua rieng kenh nay. */
  private readonly processor: SessionLogProcessor;
  /** Logger theo scope do ben goi khai. */
  private readonly logger: ReturnType<LoggerProvider["getLogger"]>;

  /** @param options - van chuyen, danh tinh resource, gioi han hang doi va chan doan. */
  constructor(options: SessionLogOptions) {
    const limit = resolveSessionLogLimits(options);
    this.processor = new SessionLogProcessor(
      createLogExporter(options.exporter),
      limit,
      {
        maxQueueSize: options.processor?.maxQueueSize ?? 2048,
        maxExportBatchSize: options.processor?.maxExportBatchSize ?? 512,
        scheduledDelayMillis: options.processor?.scheduledDelayMillis ?? 1_000,
        exportTimeoutMillis: options.processor?.exportTimeoutMillis ?? 30_000,
      },
      options.onFailure,
    );
    this.provider = new LoggerProvider({
      logRecordLimits: {
        attributeValueLengthLimit: Infinity,
        attributeCountLimit: Infinity,
      },
      resource: resourceFromAttributes(options.resourceAttributes),
      processors: [this.processor],
    });
    this.logger = this.provider.getLogger(options.scope.name, options.scope.version);
  }

  /**
   * Xep hang doi MOT su kien hoan chinh, KHONG xac nhan da gui duoc qua mang.
   * @param record - su kien voi du lieu da lam sach va id phien goc.
   */
  reportSessionLog(record: SessionLogRecord): void {
    const severityNumber = record.severityNumber ?? SeverityNumber.INFO;
    this.logger.emit({
      eventName: "session-log",
      body: "session-log",
      timestamp: record.event.time,
      observedTimestamp: record.event.time,
      severityNumber,
      severityText: SeverityNumber[severityNumber],
      attributes: {
        ...record.attributes,
        sessionId: record.sessionId,
        content: JSON.stringify(record.event),
      },
    });
  }

  /** Dung cac request dang cho sau han chot shutdown cua backend; van chuyen dang chay van co the settle. */
  stopPending(): void {
    this.processor.stopPending();
  }

  /**
   * Rut sach hang doi va giai phong van chuyen cua SDK.
   * @returns hoan tat sau khi hang doi settle va van chuyen SDK shutdown.
   */
  shutdown(): Promise<void> {
    return this.provider.shutdown();
  }
}
