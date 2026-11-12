/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Engine store KHÔNG phụ thuộc ngoài — port TƯƠNG ĐƯƠNG HÀNH VI của @deepseek-ai/dsh-client-store
 *      (bản gốc 179 dòng dựng trên zustand/vanilla + immer; 2 thư viện đó KHÔNG có trong workspace nên
 *      ta cài lại đúng 4 tên export + ngữ nghĩa: createSnapshotStore · defineStore · notifySubscribers · shallowEqual).
 */

/** Huỷ đăng ký nghe thay đổi. */
export type Unsubscribe = () => void;

/** Ảnh chụp trạng thái có thể nghe thay đổi (thay cho ObservableSnapshot của bản gốc). */
export interface SnapshotStore<T> {
  /** Trạng thái hiện tại. */
  getSnapshot(): T;
  /** Nghe thay đổi; trả hàm huỷ đăng ký. */
  subscribe(fn: (state: T) => void): Unsubscribe;
  /** Cập nhật bằng hàm sửa bản nháp (tương đương immer produce của bản gốc). */
  update(mutator: (draft: T) => void): void;
  /** Gán nguyên khối giá trị mới. */
  set(next: T): void;
}

/** Tuỳ chọn khi tạo store. */
export interface SnapshotStoreOptions {
  /** Cách dồn thông báo: 'sync' (mặc định) hoặc 'raf' (gộp theo khung hình). */
  flush?: "sync" | "raf";
  /** Bật lưu localStorage theo khoá. */
  persist?: { name: string };
}

/** Kết quả của một lần gọi thử subscribe, dùng cho test. */
export interface SnapshotStoreApi<T> {
  /** Gán nguyên khối giá trị mới. */
  set(next: T): void;
  /** Trạng thái hiện tại. */
  getSnapshot(): T;
  /** Cập nhật bằng hàm sửa bản nháp. */
  update(mutator: (draft: T) => void): void;
  /** Nghe thay đổi; trả hàm huỷ đăng ký. */
  subscribe(fn: (state: T) => void): Unsubscribe;
}

/** Handle trả về từ defineStore. */
export interface StoreHandle<Init, Actions> {
  /** Khai báo gốc (giữ nguyên để nơi đăng ký đọc lại). */
  spec: { init: () => Init; persist?: string; actions: Actions };
  /** Tạo một instance theo khoá phạm vi (persist tách theo khoá). */
  create(scopeKey?: string): {
    actions: {
      [K in keyof Actions]: Actions[K] extends (draft: Init, ...rest: infer P) => unknown
        ? (...params: P) => void
        : never;
    };
    getSnapshot(): Init;
    subscribe(fn: (state: Init) => void): Unsubscribe;
    store: SnapshotStore<Init>;
    clearPersisted(): void;
  };
}

/**
 * Rã một giá trị thành bản sao độc lập (thay cho immer produce).
 * Nhận: value — giá trị gốc. Trả: bản sao cùng hình dạng.
 */
function saoChep<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Đóng băng sâu ngoài môi trường production (thay cho immer freeze của bản gốc).
 * Nhận: value — giá trị cần đóng băng. Trả: chính giá trị đó, đã đóng băng nếu không phải production.
 */
function dongBang<T>(value: T): T {
  // 09/11/2026 (P0 boot r90): module nay chay CA TRONG BROWSER nen khong duoc cham process.env truc tiep.
  const laProduction = typeof process !== "undefined" && process.env !== undefined && process.env.NODE_ENV === "production";
  if (laProduction) return value;
  const duyet = (o: unknown): void => {
    if (o === null || typeof o !== "object" || Object.isFrozen(o)) return;
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) duyet(v);
  };
  duyet(value);
  return value;
}

/**
 * Gọi từng người nghe, KHÔNG để một callback hỏng chặn những người còn lại.
 * Nhận: listeners — tập callback hiện có; label — tiền tố chẩn đoán; args — tham số.
 * Trả: không.
 */
export function notifySubscribers<T>(
  listeners: Iterable<(value: T) => void>,
  label: string,
  ...args: [T]
): void {
  for (const listener of [...listeners]) {
    try {
      listener(...args);
    } catch (error) {
      console.error(label + " subscriber failed:", error);
    }
  }
}

/**
 * So sánh NÔNG một tầng theo ngữ nghĩa zustand/shallow.
 * Nhận: a — vế trái; b — vế phải. Trả: true khi bằng nhau ở một tầng.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => Object.is(v, b[i]));
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Gộp thông báo thành MỘT lượt mỗi khung hình (hoặc microtask khi không có rAF).
 * Nhận: notify — hàm thông báo. Trả: hàm hẹn giờ không tham số.
 */
function rafBatch(notify: () => void): () => void {
  const hen: (fn: () => void) => void = typeof requestAnimationFrame === "function"
    ? (fn) => { requestAnimationFrame(() => { fn(); }); }
    : (fn) => { queueMicrotask(fn); };
  let daHen = false;
  return () => {
    if (daHen) return;
    daHen = true;
    hen(() => {
      daHen = false;
      notify();
    });
  };
}

/**
 * Gắn lưu/khôi phục nguyên khối giá trị JSON vào localStorage.
 * Nhận: api — store; name — khoá lưu. Trả: không.
 */
function ganLuuTru<T>(api: SnapshotStore<T>, name: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(name);
    if (raw !== null) api.set(dongBang(JSON.parse(raw) as T));
  } catch (error) {
    console.error("snapshot store '" + name + "' rehydration failed:", error);
  }
  api.subscribe((state) => {
    try {
      localStorage.setItem(name, JSON.stringify(state));
    } catch (error) {
      console.error("snapshot store '" + name + "' persistence failed:", error);
    }
  });
}

/**
 * Tạo store ảnh chụp.
 * Nhận: init — trạng thái đầu; opts — chế độ dồn thông báo và tuỳ chọn lưu trữ.
 * Trả: store với getSnapshot/subscribe/update/set.
 */
export function createSnapshotStore<T>(init: T, opts?: SnapshotStoreOptions): SnapshotStore<T> {
  let state = opts?.persist === undefined ? dongBang(init) : init;
  const listeners = new Set<(value: T) => void>();
  const phat = (): void => {
    notifySubscribers(listeners, "[client-store]", state);
  };
  const henPhat = opts?.flush === "raf" ? rafBatch(phat) : phat;
  const api: SnapshotStore<T> = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    update: (mutator) => {
      const banNhap = saoChep(state);
      mutator(banNhap);
      state = dongBang(banNhap);
      henPhat();
    },
    set: (next) => {
      state = dongBang(next);
      henPhat();
    },
  };
  if (opts?.persist !== undefined) ganLuuTru(api, opts.persist.name);
  return api;
}

/**
 * Khai báo store theo khuôn khai báo: init + actions (và tuỳ chọn persist).
 * Nhận: decl — { init, persist?, actions }. Trả: handle có spec + create().
 */
export function defineStore<Init, Actions extends Record<string, (draft: Init, ...rest: never[]) => unknown>>(
  decl: { init: () => Init; persist?: string; actions: Actions },
): StoreHandle<Init, Actions> {
  return {
    spec: decl,
    create(scopeKey?: string) {
      const persistKey = decl.persist === undefined
        ? undefined
        : scopeKey === undefined ? decl.persist : decl.persist + "." + scopeKey;
      const store = createSnapshotStore(decl.init(), persistKey === undefined ? undefined : { persist: { name: persistKey } });
      const actions = {} as Record<string, (...params: never[]) => void>;
      for (const key of Object.keys(decl.actions)) {
        const mutate = decl.actions[key] as (draft: Init, ...rest: never[]) => unknown;
        actions[key] = (...params: never[]) => {
          store.update((draft) => {
            mutate(draft, ...params);
          });
        };
      }
      return {
        actions: actions as never,
        getSnapshot: () => store.getSnapshot(),
        subscribe: (fn: (state: Init) => void) => store.subscribe(fn),
        store,
        clearPersisted: () => {
          if (persistKey === undefined || typeof localStorage === "undefined") return;
          try {
            localStorage.removeItem(persistKey);
          } catch {
            // Bỏ qua: localStorage bị chặn (chế độ riêng tư) — xoá hỏng không được phá store.
          }
        },
      };
    },
  };
}
