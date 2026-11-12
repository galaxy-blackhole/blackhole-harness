/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kenh SU KIEN THUONG: gom lo theo SO LUONG cua SDK tren mot van chuyen HTTP huy duoc.
 */
import type { Attributes } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { ExportResultCode } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import type { BatchLogRecordProcessorOptions, LogRecordExporter } from "@opentelemetry/sdk-logs";
import { addAbortListener } from "node:events";
import { createEventLogExporter } from "./event-transport.ts";
import type { LogExporterOptions } from "./transport.ts";

/** Gia tri vo huong ma bang attributes (kieu Arrow) cua collector chap nhan. */
export type OTelEventScalar = string | number | boolean;

/** Cac truong phan tich duoc CHON TUONG MINH; gia tri doi tuong chi chua vo huong. */
export interface OTelEventRecord {
  /** Ten su kien do ben san pham/DA so huu. */
  eventName: string;
  /** Tom tat nguoi doc duoc; KHONG BAO GIO la prompt, phan hoi, credential hay noi dung tep. */
  body: string;
  /** Thoi diem su kien xay ra, tinh bang mili-giay Unix. Thoi diem quan sat duoc gan luc xep hang doi. */
  timestamp: number;
  /** Do nghiem trong OTel; bo qua thi dung INFO. */
  severityNumber?: SeverityNumber;
  /** Truong nghiep vu do ben goi chon; KHONG tu dong them danh tinh thiet bi hay tai khoan. */
  attributes?: Record<string, OTelEventScalar | Record<string, OTelEventScalar>>;
}

/** Thiet lap van chuyen, resource, scope va gom lo theo so luong cua kenh su kien thuong. */
export interface EventLogOptions {
  /** Diem den va thiet lap HTTP cua SDK do ben goi chon. */
  exporter: LogExporterOptions;
  /** Thuoc tinh resource (danh tinh ung dung/nguoi dung an danh). */
  resourceAttributes: Attributes;
  /** Pham vi do ben nghiep vu cung cap. */
  scope: {
    name: string;
    version?: string;
  };
  /** Tham so gom lo cua SDK; `exporter` do kenh so huu nen bi loai khoi kieu nay. */
  processor: Omit<BatchLogRecordProcessorOptions, "exporter">;
  /** Bao loi mang va loi SDK ma KHONG ghi noi dung su kien. */
  onFailure: (message: string, error?: Error) => void;
}

/** Mot hang doi su kien thuong thuoc so huu cua ben goi, doc lap voi moi hang doi log phien. */
export class EventLogReporter {
  /** Exporter cua rieng kenh nay (huy duoc). */
  private readonly exporter: LogRecordExporter;
  /** Nha cung cap logger cua SDK. */
  private readonly provider: LoggerProvider;
  /** Logger theo scope do ben goi khai. */
  private readonly logger: ReturnType<LoggerProvider["getLogger"]>;
  /** Huy hieu huy rieng cua kenh (dung cho ca request hien tai lan cac lo sau). */
  private readonly cancellation = new AbortController();

  /** @param options - van chuyen, resource, scope, hang doi va chan doan do ben goi chon. */
  constructor(options: EventLogOptions) {
    const exporter = createEventLogExporter(options.exporter, this.cancellation.signal);
    this.exporter = exporter;
    this.provider = new LoggerProvider({
      resource: resourceFromAttributes(options.resourceAttributes),
      processors: [
        new BatchLogRecordProcessor({
          ...options.processor,
          exporter: {
            export: (records, callback) => {
              exporter.export(records, (result) => {
                if (result.code !== ExportResultCode.SUCCESS) options.onFailure("Product telemetry export failed", result.error);
                callback(result);
              });
            },
            forceFlush: () => exporter.forceFlush(),
            shutdown: () => exporter.shutdown(),
          },
        }),
      ],
    });
    this.logger = this.provider.getLogger(options.scope.name, options.scope.version);
  }

  /**
   * Xep hang doi cac truong phan tich do ben goi chon, KHONG xac nhan da gui duoc.
   * @param record - su kien thuong can bao.
   */
  emit(record: OTelEventRecord): void {
    const severityNumber = record.severityNumber ?? SeverityNumber.INFO;
    this.logger.emit({
      ...record,
      observedTimestamp: Date.now(),
      severityNumber,
      severityText: SeverityNumber[severityNumber],
    });
  }

  /**
   * Rut sach hang doi va giai phong van chuyen; huy cac lan gui con lai khi ben goi abort.
   * @param signal - han chot shutdown tuy chon; abort se bo cac lan gui dang cho va huy hen retry.
   * @returns hoan tat khi SDK shutdown xong va van chuyen da don.
   */
  async shutdown(signal?: AbortSignal): Promise<void> {
    const abort = (): void => {
      this.cancellation.abort(signal?.reason);
    };
    const listener: Disposable | undefined = signal === undefined ? undefined : addAbortListener(signal, abort);
    if (signal?.aborted === true) abort();
    try {
      await this.provider.shutdown();
    } finally {
      try {
        await this.exporter.shutdown();
      } finally {
        listener?.[Symbol.dispose]();
      }
    }
  }
}
