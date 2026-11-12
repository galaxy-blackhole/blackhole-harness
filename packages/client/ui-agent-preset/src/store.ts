/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop dong store + Remote ma row ui-agent-preset dua vao — nguyen van hinh dang ban goc dung
 */

import type { PresetRow } from "./display.ts";

/**
 * Store anh chup cua DSH (@galaxy-blackhole/gbh-client-store).
 *
 * ⚠️ HOP DONG DAY DU: row nay trao THANG the hien nay cho slot cua goi khac qua inject().hooks, nen
 * mot the hien thieu getSnapshot/subscribe se lam ca thanh ben khong render
 * (TypeError: w.getSnapshot is not a function — loi that cua row ui-workspace). Vi vay kieu nay khai
 * du ba thanh phan ma ban goc dung, va test co mot ca HOP DONG khang dinh the hien trao di la day du.
 */
export interface SnapshotStore<T> {
  /** Anh chup hien tai (on dinh ve danh tinh cho toi lan set ke tiep). */
  getSnapshot(): T;
  /** Thay anh chup bang mot gia tri moi roi bao cho moi nguoi nghe. */
  set(next: T): void;
  /** Nghe thay doi; tra ham huy dang ky. */
  subscribe(listener: () => void): () => void;
}

/** Module @galaxy-blackhole/gbh-client-store — chi phan ma row nay dung. */
export interface StoreModule {
  /** Tao mot store anh chup tu gia tri dau. */
  createSnapshotStore: <T>(initial: T) => SnapshotStore<T>;
}

/** Mot loi goi Remote bi tu choi. */
export interface RemoteRefusal {
  /** Ma loi (vi du "gateway/invocation-unavailable"). */
  readonly code?: string;
  /** Thong diep hien thi. */
  readonly message: string;
  /** Chi tiet tuy theo loi. */
  readonly details?: unknown;
}

/** Ket qua mot loi goi Remote: thanh cong hoac bi tu choi — nguyen van hinh dang ban goc. */
export type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RemoteRefusal };

/** So preset ma Host tra ve. */
export interface Roster {
  /** Cac dong preset, ke ca dong hong. */
  readonly presets: readonly PresetRow[];
}

/** Nhanh Remote quan ly so preset (ctx.remote.agentPresets). */
export interface AgentPresetRemote {
  /** Doc so preset. */
  list(): Promise<RemoteResult<Roster>>;
  /** Chon preset cho mot phien chua chay luot nao. */
  select(sessionId: string, id: string): Promise<RemoteResult<string>>;
  /** Doc than khai bao cua mot preset. */
  read(id: string): Promise<RemoteResult<{ readonly name?: string; readonly content: string }>>;
}

/** Nhanh Remote cau hinh (ctx.remote.settings). */
export interface SettingsRemote {
  /** Ghi mot vai truong cua mot namespace cau hinh, kem rao phien ban tuy chon. */
  update(namespace: string, fields: Readonly<Record<string, string>>, expectedRevision?: number): Promise<RemoteResult<unknown>>;
}

/** Seam Remote ma row nay dung (ctx.remote). */
export interface RemoteSeam {
  /** So preset cua Host. */
  agentPresets: AgentPresetRemote;
  /** Cau hinh cua Host. */
  settings: SettingsRemote;
  /** Nghe su kien tren duong remote; tra ham huy. */
  $on(event: string, handler: (payload: string) => void): () => void;
}
