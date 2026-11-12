/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lưu và đọc bản dịch bền theo Session: dùng lại kết quả đã lưu hoặc ghi bản dịch mới qua writer của Session đang sống.
 */
import type { Context } from '@deepseek-ai/cordis';
import { appendPluginRecord, pluginRecordOf, SessionSeq, type Session, type SessionId } from '@deepseek-ai/dsh-session';
import type { SessionEvent } from '@deepseek-ai/dsh-session/types';
import { SessionPersistenceNotFoundError, type SessionHandle, type SessionPersistence } from '@deepseek-ai/dsh-session-persistence';
import { deepEqualJson, deepFreeze } from '@deepseek-ai/dsh-util-values';
import type { TranslationIdentity, TranslationRequestRecord, TranslationResultRecord } from './types.ts';
import { TranslationError } from './error.ts';

/**
 * Payload của hai bản ghi plugin do translator sở hữu.
 * Bản gốc cộng gộp hai khoá này vào `PluginRecordMap` của '@deepseek-ai/dsh-session/types' bằng
 * `declare module`; repo CẤM ambient shim (luật 000d) nên khai theo CẤU TRÚC tại chỗ.
 */
interface TranslatorRecordPayload {
  'plugin:translator/request': TranslationRequestRecord;
  'plugin:translator/result': TranslationResultRecord;
}

/** Hai loại bản ghi plugin mà translator ghi vào log Session. */
type TranslatorRecordType = keyof TranslatorRecordPayload;

/** Lỗi "cần một Session bền đã tồn tại" — dùng chung cho mọi nhánh thiếu Session. */
function required(): TranslationError {
  return new TranslationError('TRANSLATION_SESSION_REQUIRED', 'Translation requires an existing durable Session');
}

/** Lỗi "bản ghi dịch đã lưu không hợp lệ hoặc không đọc được". */
function invalid(): TranslationError {
  return new TranslationError('TRANSLATION_STORAGE_ERROR', 'Stored translation records are invalid or unavailable');
}

/**
 * Chuẩn hoá lỗi sau mỗi lần await vào storage, giữ nguyên thứ tự ưu tiên của bản gốc:
 * lý do huỷ của caller, rồi Session bền biến mất, rồi TranslationError có sẵn, cuối cùng là lỗi storage.
 * Nhận: `error` — lỗi bất kỳ bắt được; `signal` — tín hiệu huỷ của lần gọi.
 * Trả: không trả về — hàm luôn ném.
 * @throws {TranslationError} khi Session bền không còn (`TRANSLATION_SESSION_REQUIRED`) hoặc bản ghi hỏng (`TRANSLATION_STORAGE_ERROR`).
 */
function failure(error: unknown, signal: AbortSignal): never {
  signal.throwIfAborted();
  if (error instanceof SessionPersistenceNotFoundError)
    throw required();
  if (error instanceof TranslationError)
    throw error;
  throw invalid();
}

/** Object JSON thuần: không null, không mảng. */
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Kiểm và chuẩn hoá payload request đọc từ log.
 * Nhận: `value` — data thô của bản ghi `plugin:translator/request`.
 * Trả: bản ghi request hợp lệ (provider/text/sourceLanguage/targetLanguage/recipe + metadata tùy chọn).
 * @throws {TranslationError} `TRANSLATION_STORAGE_ERROR` khi payload sai hình dạng.
 */
function requestData(value: unknown): TranslationRequestRecord {
  if (!object(value) || !['provider', 'text', 'sourceLanguage', 'targetLanguage', 'recipe'].every(key => typeof value[key] === 'string')
    || (value.metadata !== undefined && !object(value.metadata)))
    throw invalid();
  return { provider: String(value.provider), text: String(value.text), sourceLanguage: String(value.sourceLanguage),
    targetLanguage: String(value.targetLanguage), recipe: String(value.recipe),
    ...value.metadata === undefined ? {} : { metadata: value.metadata } };
}

/**
 * Khoá danh tính ổn định của một bản dịch tái dùng được.
 * Nhận: `identity` — provider, văn bản nguồn, ngôn ngữ nguồn/đích và recipe.
 * Trả: chuỗi JSON dùng làm khoá cache và khoá so trùng bản ghi.
 */
function identityKey(identity: TranslationIdentity): string {
  return JSON.stringify([identity.provider, identity.text, identity.sourceLanguage, identity.targetLanguage, identity.recipe]);
}

/**
 * Đường GHI bản ghi plugin vào log Session, khai theo CẤU TRÚC (luật 000d).
 * Kernel chỉ nhận khoá đã cộng gộp vào `PluginRecordMap`; ở đây ép kiểu tại ĐÚNG một điểm,
 * hành vi runtime giữ nguyên vì kernel vẫn tự kiểm grammar `plugin:` và tính JSON-serializable.
 */
const appendPluginRecordSeam = appendPluginRecord as unknown as <K extends TranslatorRecordType>(
  session: Session,
  type: K,
  data: TranslatorRecordPayload[K],
) => SessionSeq;

/**
 * Một Session đang sống: các thao tác ghi bản dịch dùng writer hiện có của Session đó.
 * Nhận: lời gọi `request`/`result` do `TranslationStorage` truyền vào `operation`.
 * Trả: hợp đồng ghi request + result cho đúng một lần dịch.
 */
export interface TranslationLog {
  /**
   * Giữ bền một request bất biến trước khi gửi ra ngoài.
   * Nhận: `data` — đầu vào chung và chi tiết request riêng của provider (nếu có).
   * Trả: seq của request để kết quả về sau trỏ tới, sau khi đã xác minh bền vững.
   * @throws {TranslationError} khi Session/log không còn dùng được hoặc bản ghi ghi ra không khớp.
   */
  request(data: TranslationRequestRecord): Promise<SessionSeq>;

  /**
   * Giữ bền một kết quả thành công trước khi trả cho bên gọi.
   * Nhận: `requestSeq` — seq request bền của chính lần dịch này; `text` — văn bản dịch đã kiểm đầy đủ.
   * Trả: promise hoàn tất khi bản ghi kết quả đã bền.
   * @throws {TranslationError} khi Session/log không còn dùng được hoặc bản ghi ghi ra không khớp.
   */
  result(requestSeq: SessionSeq, text: string): Promise<void>;
}

/**
 * Lưu/đọc bản dịch bền vững, độc lập provider, qua writer của Session hiện có.
 * Kết quả đã lưu không cần Session sống; bản dịch chưa có trong cache thì cần writer của Session đang sống.
 * Nhận: `ctx` — context translator có Sessions sống tùy chọn và persistence bền.
 * Trả: thực thể dùng lại được; đăng ký một effect chờ mọi lần ghi đã nhận khi plugin dispose.
 */
export class TranslationStorage {
  private readonly ctx: Context;
  private readonly translations = new Map<string, Promise<void>>();

  /**
   * Tạo storage cho một context translator.
   * Nhận: `ctx` — context có Sessions sống tùy chọn và persistence bền.
   * Trả: thực thể `TranslationStorage` đã đăng ký effect chờ các lần ghi khi dispose.
   */
  constructor(ctx: Context) {
    this.ctx = ctx;
    ctx.effect(() => async () => { await Promise.all(this.translations.values()); });
  }

  /**
   * Dùng lại kết quả đã lưu, hoặc giữ lại bản dịch mới qua writer của Session đang sống.
   * Nhận: `id` — Session đã tồn tại (cache trượt mà không có Session sống thì từ chối với
   * `TRANSLATION_SESSION_INACTIVE` TRƯỚC khi gọi `operation`); `identity` — provider, văn bản nguồn
   * chính xác, ngôn ngữ và recipe (các lần gọi trùng đồng thời dùng chung một lần nhận cache);
   * `signal` — huỷ thao tác, cũng được kiểm sau MỖI lần await vào storage; `operation` — hàm dịch
   * khi cache trượt, dùng Session sống đã ghim.
   * Trả: văn bản đã lưu hoặc vừa dịch, được giữ bền. Nếu `operation` từ chối thì trả về ngay, không chờ
   * các lần ghi đã nhận; các lần gọi trùng và lúc dispose thì chờ những lần ghi đó xong.
   * @throws {TranslationError} `TRANSLATION_SESSION_REQUIRED` khi thiếu Session bền, `TRANSLATION_SESSION_INACTIVE`
   * khi cache trượt mà không có Session sống, `TRANSLATION_STORAGE_ERROR` khi bản ghi lưu hỏng/không đọc được;
   * lý do huỷ của `signal` được ném nguyên trạng.
   */
  run(id: SessionId, identity: TranslationIdentity, signal: AbortSignal, operation: (log: TranslationLog) => Promise<string>): Promise<string> {
    const persistence = this.ctx.get('sessionPersistence');
    const key = JSON.stringify([id, identityKey(identity)]);
    const writes: Promise<void>[] = [];
    const task = (this.translations.get(key) ?? Promise.resolve()).then(async (): Promise<string> => {
      signal.throwIfAborted();
      if (persistence === undefined)
        throw required();
      const current = (): void => {
        signal.throwIfAborted();
        if (this.ctx.get('sessionPersistence')?.identity !== persistence.identity)
          throw required();
      };
      try {
        current();
        if (await persistence.stat(id, { signal }) === undefined)
          throw required();
        current();
        const cached = await this.lookup(id, identity, persistence, signal, current);
        current();
        if (cached !== undefined)
          return cached;
        const sessions = this.ctx.get('sessions');
        const session = sessions?.get(id);
        if (sessions === undefined || session === undefined) {
          throw new TranslationError('TRANSLATION_SESSION_INACTIVE', 'Uncached translation requires an active Session');
        }
        const live = (): void => {
          current();
          if (this.ctx.get('sessions')?.get(id) !== session)
            throw required();
        };
        const append = <K extends TranslatorRecordType>(type: K, data: TranslatorRecordPayload[K]): Promise<SessionSeq> => {
          const writing = (async (): Promise<SessionSeq> => {
            try {
              live();
              // Bản ghi vào log phải là ảnh chụp JSON đông cứng, không chia sẻ object sống với caller.
              const snapshot = deepFreeze(structuredClone(data));
              const seq = appendPluginRecordSeam(session, type, snapshot);
              await sessions.flush(session);
              live();
              const stored = (await this.read(id, persistence, signal, live, seq, 1))[0];
              live();
              if (stored === undefined || pluginRecordOf(stored)?.type !== type || !deepEqualJson(stored.data, snapshot))
                throw invalid();
              return seq;
            }
            catch (error) {
              failure(error, signal);
            }
          })();
          // Lần gọi trùng và dispose phải chờ lần ghi này, kể cả khi nó thất bại.
          writes.push(writing.then(() => { }, () => { }));
          return writing;
        };
        return await operation({
          request: (data: TranslationRequestRecord): Promise<SessionSeq> => append('plugin:translator/request', data),
          async result(requestSeq: SessionSeq, text: string): Promise<void> {
            await append('plugin:translator/result', { requestSeq, text });
          },
        });
      }
      catch (error) {
        failure(error, signal);
      }
    });
    const settled = task.then(() => { }, () => { });
    const tail: Promise<void> = settled.then(async (): Promise<void> => {
      await Promise.all(writes);
      // Chỉ entry của chính mình mới được xoá, tránh đua với lần gọi mới hơn.
      if (this.translations.get(key) === tail)
        this.translations.delete(key);
    });
    this.translations.set(key, tail);
    return task;
  }

  /**
   * Đọc một lát log của Session đã lưu.
   * Nhận: `id` — Session cần đọc; `persistence` — service đã ghim cho lần gọi; `signal` — huỷ thao tác;
   * `current` — kiểm Session/persistence còn đúng trước và sau mỗi await; `start` — seq bắt đầu (mặc định 0);
   * `count` — số event tối đa (bỏ trống: đọc tới hết).
   * Trả: danh sách event của lát đọc, sở hữu bởi caller.
   */
  private async read(id: SessionId, persistence: SessionPersistence, signal: AbortSignal, current: () => void, start = 0, count?: number): Promise<readonly SessionEvent[]> {
    current();
    // `await using` đóng handle kể cả khi open/read ném, tương đương finally của bản gốc.
    await using handle: SessionHandle = await persistence.open(id, 'read', { signal });
    current();
    const stored = await handle.read(start, count, { signal });
    current();
    return stored.events;
  }

  /**
   * Tra cứu bản dịch đã lưu khớp danh tính trong toàn bộ log của Session.
   * Nhận: `id` — Session cần đọc; `identity` — danh tính cần tìm; `persistence` — service đã ghim;
   * `signal` — huỷ thao tác; `current` — kiểm Session/persistence còn đúng sau mỗi await.
   * Trả: văn bản đã lưu khớp `identity`, hoặc undefined khi chưa có bản ghi kết quả tương ứng.
   * @throws {TranslationError} `TRANSLATION_STORAGE_ERROR` khi bản ghi request/result sai hình dạng hoặc result trỏ tới request không tồn tại.
   */
  private async lookup(id: SessionId, identity: TranslationIdentity, persistence: SessionPersistence, signal: AbortSignal, current: () => void): Promise<string | undefined> {
    const requests = new Map<SessionSeq, TranslationRequestRecord>();
    const results = new Map<string, string>();
    for (const event of await this.read(id, persistence, signal, current)) {
      const record = pluginRecordOf(event);
      if (record?.type === 'plugin:translator/request')
        requests.set(record.seq, requestData(record.data));
      if (record?.type !== 'plugin:translator/result')
        continue;
      const data = record.data;
      if (!object(data) || typeof data.requestSeq !== 'number' || !Number.isSafeInteger(data.requestSeq)
        || data.requestSeq < 0 || Object.is(data.requestSeq, -0) || typeof data.text !== 'string')
        throw invalid();
      const request = requests.get(SessionSeq(data.requestSeq));
      if (request === undefined)
        throw invalid();
      results.set(identityKey(request), data.text);
    }
    return results.get(identityKey(identity));
  }
}
