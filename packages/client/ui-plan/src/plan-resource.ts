/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Provider tai nguyen `plan`: doc lich su phien qua Remote, dung o dung loi goi tool da nop plan
 */
import { RESOURCE_PROTOCOL } from "./ids.ts";
import { parsePlanAddress, submittedPlan, type PlanEvent, type SessionAddress, type SubmittedPlan } from "./plan.ts";

/** Mot khung su kien ma Remote tra ve khi theo doi lich su phien. */
export interface PlanRemoteFrame {
  /** Loai khung (`snapshot`, …). */
  readonly type: string;
}

/** Mot ban ghi lich su ma provider doc. */
export interface PlanHistoryRecord {
  /** Su kien kem so thu tu trong lich su. */
  readonly event: PlanEvent & { readonly seq: number };
}

/** Khung anh chup dau tien cua lich su phien. */
export interface PlanSnapshotFrame extends PlanRemoteFrame {
  /** Loai khung. */
  readonly type: "snapshot";
  /** Cac ban ghi cua trang dau. */
  readonly records: readonly PlanHistoryRecord[];
  /** Con trang cu hon phia truoc hay khong. */
  readonly hasMore: boolean;
  /** Con tro de doc cac trang truoc do. */
  readonly cursor: number;
}

/** Mot trang lich su phien. */
export interface PlanHistoryPage {
  /** Cac ban ghi cua trang. */
  readonly records: readonly PlanHistoryRecord[];
  /** Con trang cu hon phia truoc hay khong. */
  readonly hasMore: boolean;
}

/** Ket qua mot lan doc trang lich su. */
export interface PlanPageResult {
  /** true khi Host tra loi. */
  readonly ok: boolean;
  /** Trang du lieu khi thanh cong. */
  readonly value?: PlanHistoryPage;
  /** Loi khi that bai. */
  readonly error?: { readonly code: string; readonly message: string };
}

/** Mat Remote ma provider nay doc (lich su phien). */
export interface PlanRemote {
  /**
   * Theo doi lich su cua mot phien.
   * Nhan: `query` — dia chi phien; `signal` — tin hieu huy.
   * Tra: luong khung su kien (provider chi lay khung `snapshot` dau tien).
   */
  follow(query: { readonly address: SessionAddress }, signal: AbortSignal): AsyncIterable<PlanRemoteFrame>;
  /**
   * Doc mot trang lich su cu hon.
   * Nhan: `query` — dia chi phien, moc tren va so thu tu doc truoc; `signal` — tin hieu huy.
   * Tra: ket qua Remote (giu nguyen ma loi cua Host).
   */
  page(
    query: { readonly address: SessionAddress; readonly throughSeq: number; readonly beforeSeq: number },
    signal: AbortSignal,
  ): Promise<PlanPageResult>;
}

/** Mot khung ma provider tai nguyen phat ra cho tang tai nguyen. */
export type PlanResourceFrame =
  | { readonly ok: true; readonly value: SubmittedPlan }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Giao dien provider tai nguyen ma `ctx.resources.register` nhan. */
export interface PlanResourceProvider {
  /** Giao thuc phuc vu (`plan`). */
  readonly protocol: string;
  /**
   * Doc plan theo dia chi.
   * Nhan: `address` — dia chi plan; `options.signal` — tin hieu huy cua tang tai nguyen.
   * Tra: luong khung (mot khung roi ket thuc).
   */
  open(address: string, options: { readonly signal: AbortSignal }): AsyncGenerator<PlanResourceFrame>;
}

/**
 * Loi doc tai nguyen mang ma on dinh.
 *
 * Ban goc dung `RemoteError` cua `@deepseek-ai/dsh-typert-protocol` (duoc bundle thang vao).
 * Ta giu DUNG hop dong ma tang tai nguyen doc: truong `code` on dinh + `message` nguoi doc duoc, va
 * dau hieu cau truc `isDSHRemoteError` — nhan dien LUON bang `code`, khong bao gio bang `instanceof`
 * (vi vay khong can keo them goi typert vao nua client).
 */
export class PlanResourceError extends Error {
  /** Ma loi on dinh (`plan/invalid-address`, `plan/unavailable`, `plan/not-found`, `plan/read-failed`). */
  readonly code: string;
  /** Chi tiet co cau truc di kem ma loi. */
  readonly details: Record<string, unknown>;
  /** Dau hieu cau truc de nhan dien qua bien gioi module/ realm. */
  readonly isDSHRemoteError = true;

  /**
   * Dung mot loi doc tai nguyen.
   * Nhan: `code` — ma on dinh; `message` — chan doan nguoi doc duoc; `details` — chi tiet co cau truc.
   * Tra: doi tuong loi.
   */
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "PlanResourceError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Kiem mot gia tri bat duoc co phai loi mang ma on dinh hay khong.
 * Nhan: `value` — gia tri trong khoi `catch`.
 * Tra: cap ma/chan doan khi dau hieu cau truc khop, hoac undefined.
 */
export function planResourceErrorOf(value: unknown): { readonly code: string; readonly message: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as { readonly isDSHRemoteError?: unknown; readonly code?: unknown; readonly message?: unknown };
  if (candidate.isDSHRemoteError !== true || typeof candidate.code !== "string") return undefined;
  return { code: candidate.code, message: typeof candidate.message === "string" ? candidate.message : candidate.code };
}

/**
 * Kiem mot khung cua Remote co phai khung anh chup dau tien hay khong.
 * Nhan: `frame` — khung vua nhan.
 * Tra: true khi la khung `snapshot`.
 */
function isSnapshotFrame(frame: PlanRemoteFrame): frame is PlanSnapshotFrame {
  return frame.type === "snapshot";
}

/**
 * Gan viec doc plan vao mat Remote cua phien.
 *
 * Mo mot lan theo doi se doc cac hinh chieu va co the danh thuc mot phien da chuan bi o Host. Luong
 * Remote co the nem loi cua tang van chuyen; provider bao lan doc that bai thanh khung loi va GIU NGUYEN
 * ma loi cua Remote.
 * Nhan: `remote` — mat lich su phien cua kenh Remote.
 * Tra: provider ma `ctx.resources.register` nhan; viec doc DUNG LAI ngay khi tim thay loi goi can doc.
 */
export function planResourceProvider(remote: PlanRemote): PlanResourceProvider {
  return {
    protocol: RESOURCE_PROTOCOL,
    async *open(address: string, options: { readonly signal: AbortSignal }): AsyncGenerator<PlanResourceFrame> {
      const signal = options.signal;
      const aborted = (): boolean => signal.aborted;
      if (aborted()) return;
      const target = parsePlanAddress(address);
      if (target === undefined) {
        yield { ok: false, error: new PlanResourceError("plan/invalid-address", "Invalid plan resource address.") };
        return;
      }
      const sessionAddress = target.session;
      try {
        let snapshot: PlanSnapshotFrame | undefined;
        for await (const frame of remote.follow({ address: sessionAddress }, signal)) {
          if (isSnapshotFrame(frame)) {
            snapshot = frame;
            break;
          }
        }
        if (aborted()) return;
        if (snapshot === undefined) {
          throw new PlanResourceError("plan/unavailable", "Session history ended before the plan could be read.");
        }
        let page: PlanHistoryPage = { records: snapshot.records, hasMore: snapshot.hasMore };
        while (true) {
          for (const entry of page.records) {
            const plan = submittedPlan(entry.event);
            if (plan?.callId === target.callId) {
              yield { ok: true, value: plan };
              return;
            }
          }
          const beforeSeq = page.records[0]?.event.seq;
          if (!page.hasMore || beforeSeq === undefined) break;
          const next = await remote.page({ address: sessionAddress, throughSeq: snapshot.cursor, beforeSeq }, signal);
          if (aborted()) return;
          if (!next.ok || next.value === undefined) {
            yield {
              ok: false,
              error: next.error ?? new PlanResourceError("plan/read-failed", "Session history page is unavailable."),
            };
            return;
          }
          page = next.value;
        }
        yield { ok: false, error: new PlanResourceError("plan/not-found", "The submitted plan was not found in this Session.") };
      } catch (error) {
        if (!aborted()) {
          yield {
            ok: false,
            error:
              planResourceErrorOf(error) ??
              new PlanResourceError("plan/read-failed", error instanceof Error ? error.message : String(error)),
          };
        }
      }
    },
  };
}
