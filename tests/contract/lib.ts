/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tien ich dung chung cho test hop dong C1-C7: doc fixture, tach script HTML, chuan hoa dump/phien
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zstdDecompressSync } from "node:zlib";

/** Thư mục gốc repo blackhole-tauri (file này nằm ở tests/contract/). */
export const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Thư mục chứa fixture đã đóng băng. */
export const FIXTURE_DIR: string = join(REPO_ROOT, "tests", "contract", "fixtures");

/** Home của app (mặc định ~/.galaxy/blackhole, đổi bằng GBH_HOME). */
export const APP_HOME: string = process.env.GBH_HOME ?? join(homedir(), ".galaxy", "blackhole");

/** Một biến toàn cục được nhúng vào HTML lúc boot. */
export interface BootGlobal {
  /** Tên biến, ví dụ "__DSH_BOOT__". */
  name: string;
  /** Giá trị đã chuẩn hoá (đường dẫn/rev/timestamp thành chỗ giữ chỗ). */
  value: unknown;
}

/** Một entry trong đồ thị client của __DSH_BOOT__. */
export interface BootEntry {
  /** id plugin, ví dụ "@deepseek-ai/dsh-client-ui-chat". */
  id: string;
  /** URL bundle đã chuẩn hoá rev. */
  url: string;
  /** Hash nội dung bundle, đã chuẩn hoá. */
  rev: string;
  /** Các id phải nạp trước entry này. */
  inject: string[];
  /** Có nạp ngay ở lượt đầu hay không. */
  immediately: boolean;
  /** Bundle ngoài (nếu có). */
  external?: boolean;
}

/** Một lô nạp bundle trong đồ thị boot. */
export interface BootBatch {
  /** Pha nạp ("bootstrap", "application"...). */
  phase: string;
  /** URL gộp của lô, đã chuẩn hoá rev. */
  url: string;
  /** rev của lô, đã chuẩn hoá. */
  rev: string;
  /** id các entry trong lô. */
  entries: string[];
}

/** Bản __DSH_BOOT__ đã chuẩn hoá để đóng băng. */
export interface NormalisedBoot {
  /** Phiên bản harness phát ra boot (ví dụ "0.2.1-alpha.4"). */
  releaseVersion: string;
  /** Commit harness. */
  releaseCommit: string;
  /** Các khoá cấp cao nhất của boot object. */
  topKeys: string[];
  /** Đồ thị entry client. */
  entries: BootEntry[];
  /** Các lô nạp bundle. */
  batches: BootBatch[];
}

/** Một row trong dump-config đã chuẩn hoá. */
export interface DumpRow {
  /** id row trong cây cordis. */
  id: string;
  /** Thứ tự row trong cây. */
  order: number;
  /** Row đã chuẩn hoá dưới dạng chuỗi JSON (đường dẫn thành <path>). */
  json: string;
}

/** Một target trong dump (ours, oracleA, stock...). */
export interface DumpTarget {
  /** Khoá target. */
  key: string;
  /** Nguồn của dump. */
  source: string;
  /** Số row. */
  rowCount: number;
  /** Các row. */
  rows: DumpRow[];
}

/** Kết quả so hai cây row. */
export interface RowDiff {
  /** Row chỉ có ở bên đem so. */
  added: string[];
  /** Row chỉ có ở bên chuẩn. */
  removed: string[];
  /** Row cùng id nhưng khác nội dung. */
  changed: string[];
}

/** Schema phát hiện được của một loại bản ghi phiên. */
export interface SessionRecordShape {
  /** Loại bản ghi (trường "type"). */
  type: string;
  /** Số lần xuất hiện. */
  count: number;
  /** Tập khoá quan sát được (đã sắp xếp). */
  keys: string[];
}

/** Kết quả khảo sát định dạng phiên trên đĩa. */
export interface SessionSchema {
  /** Số file phiên đọc được. */
  fileCount: number;
  /** Các phiên bản định dạng thấy trong tên file. */
  versions: string[];
  /** Mẫu tên file quan sát được. */
  namingPatterns: string[];
  /** Schema từng loại bản ghi. */
  records: SessionRecordShape[];
}

/**
 * Đọc một fixture JSON đã đóng băng.
 * Nhận: tên file trong tests/contract/fixtures.
 * Trả: dữ liệu đã parse; ném lỗi rõ ràng nếu thiếu (kèm lệnh sinh lại).
 */
export function readFixture<T>(name: string): T {
  const path = join(FIXTURE_DIR, name);
  if (!existsSync(path)) {
    throw new Error("thiếu fixture " + name + " — sinh lại bằng: bun run tests/contract/capture.ts");
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Ghi một fixture JSON.
 * Nhận: tên file trong tests/contract/fixtures và dữ liệu.
 * Trả: đường dẫn tuyệt đối đã ghi.
 */
export function writeFixture(name: string, value: unknown): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, name);
  writeFileSync(path, JSON.stringify(value, null, 1) + "\n");
  return path;
}

/**
 * Ghi một fixture văn bản thô (ví dụ đoạn JS của module loader).
 * Nhận: tên file và nội dung.
 * Trả: đường dẫn tuyệt đối đã ghi.
 */
export function writeFixtureText(name: string, text: string): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, name);
  writeFileSync(path, text);
  return path;
}

/**
 * Đọc một fixture văn bản thô.
 * Nhận: tên file trong tests/contract/fixtures.
 * Trả: nội dung; ném lỗi nếu thiếu.
 */
export function readFixtureText(name: string): string {
  const path = join(FIXTURE_DIR, name);
  if (!existsSync(path)) {
    throw new Error("thiếu fixture " + name + " — sinh lại bằng: bun run tests/contract/capture.ts");
  }
  return readFileSync(path, "utf8");
}

/**
 * Chuẩn hoá mọi giá trị dễ đổi để snapshot không vỡ vì lý do vô nghĩa.
 * Nhận: chuỗi bất kỳ (JSON, HTML, log).
 * Trả: chuỗi đã thay đường dẫn tuyệt đối, rev, token, timestamp, id phiên bằng chỗ giữ chỗ.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/"\/(?:Users|home|tmp|private|var|opt)\/[^"]*"/g, '"/<path>"')
    .replace(/\/(?:Users|home|tmp|private|var|opt)\/[^\s"')]+/g, "<path>")
    .replace(/[A-Za-z]:\\\\[^\s"']+/g, "<path>")
    .replace(/rev=[0-9a-f]{6,}/g, "rev=<rev>")
    .replace(/token=[^\s&"']+/g, "token=<token>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "<ts>")
    .replace(/dsh-inspector-v0-[A-Za-z0-9_-]{8,}/g, "dsh-inspector-v0-<nonce>")
    .replace(/session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "session-<id>");
}

/**
 * Lấy tất cả script inline trong một trang HTML.
 * Nhận: nội dung HTML.
 * Trả: mảng nội dung script (không gồm script có src).
 */
export function inlineScripts(html: string): string[] {
  const out: string[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null = re.exec(html);
  while (m !== null) {
    out.push(m[1] ?? "");
    m = re.exec(html);
  }
  return out;
}

/**
 * Liệt kê các biến toàn cục được nhúng vào HTML.
 * Nhận: nội dung HTML.
 * Trả: mảng { name, value } với giá trị đã parse và chuẩn hoá.
 */
export function globalsIn(html: string): BootGlobal[] {
  const out: BootGlobal[] = [];
  for (const body of inlineScripts(html)) {
    const m = body.match(/^\s*globalThis\["(__[A-Z_]+__)"\]\s*=\s*([\s\S]*?);?\s*$/);
    if (!m || !m[1] || m[2] === undefined) continue;
    let value: unknown = null;
    try {
      value = JSON.parse(m[2].trim().replace(/;\s*$/, "")) as unknown;
    } catch {
      value = m[2].trim();
    }
    out.push({ name: m[1], value: JSON.parse(normalizeText(JSON.stringify(value))) as unknown });
  }
  return out;
}

/**
 * Tách đoạn JS cài đặt window.__ModuleLoader__ từ trang.
 * Nhận: nội dung HTML.
 * Trả: mã nguồn đoạn script, hoặc null nếu không có.
 */
export function moduleLoaderSource(html: string): string | null {
  for (const body of inlineScripts(html)) {
    if (body.includes("__ModuleLoader__")) return body.trim();
  }
  return null;
}

/**
 * Tách và chuẩn hoá object global boot từ trang.
 *
 * 18/10/2026 (task-31): tên CHÍNH là __GBH_BOOT__; __DSH_BOOT__ là ALIAS tương thích (host phát cả hai).
 * Hàm nhận cả hai — tên mới trước, tên cũ sau — để fixture/live của cả hai thời kỳ đều đọc được.
 * Nhận: nội dung HTML.
 * Trả: NormalisedBoot, hoặc null nếu trang không có boot object.
 */
export function extractBoot(html: string): NormalisedBoot | null {
  for (const body of inlineScripts(html)) {
    const m = body.match(/globalThis\["(?:__GBH_BOOT__|__DSH_BOOT__)"\]\s*=\s*([\s\S]*?);?\s*$/);
    if (!m || m[1] === undefined) continue;
    const raw = JSON.parse(normalizeText(m[1].trim().replace(/;\s*$/, ""))) as {
      release?: { version?: string; commit?: string };
      entries?: BootEntry[];
      batches?: BootBatch[];
    };
    const entries: BootEntry[] = (raw.entries ?? []).map((e) => {
      const entry: BootEntry = {
        id: e.id,
        url: e.url,
        rev: "<rev>",
        inject: e.inject ?? [],
        immediately: e.immediately === true,
      };
      if (e.external !== undefined) entry.external = e.external;
      return entry;
    });
    const batches: BootBatch[] = (raw.batches ?? []).map((b) => ({
      phase: b.phase,
      url: b.url,
      rev: "<rev>",
      entries: b.entries ?? [],
    }));
    return {
      releaseVersion: raw.release?.version ?? "",
      releaseCommit: raw.release?.commit ?? "",
      topKeys: Object.keys(raw).sort(),
      entries,
      batches,
    };
  }
  return null;
}

/**
 * Đọc URL có token mà host đã ghi ra đĩa.
 * Nhận: không.
 * Trả: URL đầy đủ, hoặc null nếu chưa có (host chưa boot lần nào).
 */
export function loadReadyUrl(): string | null {
  const path = join(APP_HOME, "ready-url.txt");
  if (!existsSync(path)) return null;
  const url = readFileSync(path, "utf8").trim();
  return url === "" ? null : url;
}

/**
 * Tải trang đã xác thực của host (đi theo redirect).
 * Nhận: URL kèm token.
 * Trả: nội dung HTML, hoặc null nếu không tải được.
 */
export async function fetchPage(url: string): Promise<string | null> {
  // Host trả 303 cho URL kèm token và đặt cookie xác thực: phải tự giữ cookie khi đi tiếp.
  let current = url;
  const cookies = new Map<string, string>();
  for (let hop = 0; hop < 5; hop++) {
    const headers: Record<string, string> = {};
    if (cookies.size > 0) {
      headers["cookie"] = [...cookies.entries()].map(([k, v]) => k + "=" + v).join("; ");
    }
    let res: Response;
    try {
      res = await fetch(current, { redirect: "manual", headers });
    } catch {
      return null;
    }
    const setCookie = res.headers.get("set-cookie");
    if (setCookie !== null) {
      for (const part of setCookie.split(/,(?=[^;,\s]+=)/)) {
        const first = part.split(";")[0] ?? "";
        const eq = first.indexOf("=");
        if (eq > 0) cookies.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
      }
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location === null) return null;
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) return null;
    return await res.text();
  }
  return null;
}

/**
 * Đọc file dump chuẩn hoá của giàn parity.
 * Nhận: đường dẫn tuyệt đối tới *.normalised.json.
 * Trả: target đã parse, hoặc null nếu thiếu/hỏng.
 */
export function readNormalisedDump(path: string): DumpTarget | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      source?: string;
      rowCount?: number;
      rows?: { id: string; order: number; json: string }[];
    };
    return {
      key: (raw.source ?? "").split("/").pop()?.replace(".yml", "") ?? "unknown",
      source: raw.source ?? "",
      rowCount: raw.rowCount ?? (raw.rows ?? []).length,
      rows: (raw.rows ?? []).map((r) => ({ id: r.id, order: r.order, json: r.json })),
    };
  } catch {
    return null;
  }
}

/** Đường dẫn các file dump cần dùng cho hợp đồng C3/C6. */
export interface DumpFiles {
  /** File index của giàn parity. */
  indexFile: string;
  /** Dump THÔ theo từng target (nguồn sự thật, không qua bộ chuẩn hoá nào). */
  raw: Record<string, string>;
  /** Dump đã chuẩn hoá theo từng target (bản của giàn parity). */
  normalised: Record<string, string>;
}

/**
 * Tìm dump mới nhất mà giàn parity đã ghi (CHỈ ĐỌC, không sửa .parity).
 * Nhận: không.
 * Trả: DumpFiles, hoặc null nếu giàn chưa chạy lần nào.
 */
export function findLatestDump(): DumpFiles | null {
  const indexFile = join(REPO_ROOT, ".parity", "latest-dump.json");
  if (!existsSync(indexFile)) return null;
  try {
    const idx = JSON.parse(readFileSync(indexFile, "utf8")) as {
      files?: { normalised?: Record<string, string>; raw?: Record<string, string> };
    };
    return {
      indexFile,
      raw: idx.files?.raw ?? {},
      normalised: idx.files?.normalised ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * So hai cây row theo id để biết thêm/thiếu/đổi.
 * Nhận: mảng row chuẩn (baseline) và mảng row đem so (candidate).
 * Trả: { added, removed, changed } — added = chỉ có ở candidate.
 */
export function diffRows(baseline: DumpRow[], candidate: DumpRow[]): RowDiff {
  const a = new Map(baseline.map((r) => [r.id, r.json]));
  const b = new Map(candidate.map((r) => [r.id, r.json]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [id, json] of b) {
    const prev = a.get(id);
    if (prev === undefined) added.push(id);
    else if (prev !== json) changed.push(id);
  }
  for (const id of a.keys()) if (!b.has(id)) removed.push(id);
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

/** Một mẫu bản ghi phiên đã đọc (chỉ type + khoá, KHÔNG nội dung). */
export interface SessionSample {
  /** Đường dẫn đã thay home bằng ~. */
  path: string;
  /** Số bản ghi đọc được. */
  lines: number;
  /** Loại bản ghi và khoá của từng bản ghi. */
  records: { type: string; keys: string[] }[];
}

/**
 * Khảo sát định dạng phiên trên đĩa: tên file, phiên bản, schema bản ghi.
 * CHỈ lấy trường "type" và tên khoá — không sao chép nội dung hội thoại.
 * Nhận: thư mục sessions (mặc định APP_HOME/sessions).
 * Trả: { schema, samples }.
 */
export function readSessionSchema(root = join(APP_HOME, "sessions")): { schema: SessionSchema; samples: SessionSample[] } {
  const files: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(".jsonl.zstd") || e.name.endsWith(".jsonl")) files.push(abs);
    }
  };
  walk(root);
  const versions = new Set<string>();
  const patterns = new Set<string>();
  const perType = new Map<string, { count: number; keys: Set<string> }>();
  const samples: SessionSample[] = [];
  for (const file of files) {
    const base = file.split("/").pop() ?? file;
    const ver = base.match(/session\.(v\d+)\.jsonl/);
    if (ver?.[1]) versions.add(ver[1]);
    patterns.add(base.replace(/session-[0-9a-f-]{36}/, "session-<id>"));
    let text = "";
    try {
      const buf = readFileSync(file);
      text = base.endsWith(".zstd") ? zstdDecompressSync(buf).toString("utf8") : buf.toString("utf8");
    } catch {
      continue;
    }
    const records: { type: string; keys: string[] }[] = [];
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      const type = typeof obj["type"] === "string" ? (obj["type"] as string) : "(không có type)";
      const keys = Object.keys(obj).sort();
      records.push({ type, keys });
      const entry = perType.get(type) ?? { count: 0, keys: new Set<string>() };
      entry.count += 1;
      for (const k of keys) entry.keys.add(k);
      perType.set(type, entry);
    }
    samples.push({ path: file.replace(homedir(), "~"), lines: records.length, records });
  }
  const schema: SessionSchema = {
    fileCount: files.length,
    versions: [...versions].sort(),
    namingPatterns: [...patterns].sort(),
    records: [...perType.entries()]
      .map(([type, v]) => ({ type, count: v.count, keys: [...v.keys].sort() }))
      .sort((x, y) => x.type.localeCompare(y.type)),
  };
  return { schema, samples };
}

/** Chẩn đoán đồ thị inject của boot. */
export interface InjectGraph {
  /** Các id được inject nhưng không có entry riêng (bundle gộp). */
  unresolved: string[];
  /** Các chu trình phát hiện được (inject là gợi ý thứ tự, không phải DAG cứng). */
  cycles: string[];
}

/**
 * Phân tích đồ thị inject của boot: tham chiếu mồ côi và chu trình.
 * Nhận: danh sách entry của boot.
 * Trả: InjectGraph (đã sắp xếp, ổn định để đóng băng).
 */
export function analyseInjectGraph(entries: BootEntry[]): InjectGraph {
  const ids = new Set(entries.map((e) => e.id));
  const unresolved = new Set<string>();
  for (const entry of entries) {
    for (const dep of entry.inject) if (!ids.has(dep)) unresolved.add(dep);
  }
  const deps = new Map(entries.map((e) => [e.id, e.inject]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const cycles = new Set<string>();
  const visit = (id: string, path: string[]): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      cycles.add([...path.slice(start < 0 ? 0 : start), id].join(" -> "));
      return;
    }
    visiting.add(id);
    for (const dep of deps.get(id) ?? []) visit(dep, [...path, id]);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of deps.keys()) visit(id, []);
  return { unresolved: [...unresolved].sort(), cycles: [...cycles].sort() };
}

/**
 * Kiểm tra một đường dẫn có tồn tại và là file thường.
 * Nhận: đường dẫn tuyệt đối.
 * Trả: true nếu đọc được và là file.
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
