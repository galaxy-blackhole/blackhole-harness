/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng chống tái phát: row của ta (park hoặc đã flip) phải mang ĐÚNG config của row stock
 *      — thiếu config ⇒ ValidationError "$.<trường> missing required value" lúc boot (sự cố tool-todo 19/10)
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Đọc manifest gói. */
function manifest(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(REPO, "packages", "host", dir, "package.json"), "utf8")) as Record<string, unknown>;
}

/** Dump oracle mới nhất có chứa file oracleA_nopatch.yml. */
function latestDump(): string {
  const root = join(REPO, ".parity", "dumps");
  const dirs = readdirSync(root)
    .filter((name) => existsSync(join(root, name, "oracleA_nopatch.yml")))
    .sort();
  const last = dirs[dirs.length - 1];
  if (last === undefined) throw new Error("không tìm thấy dump oracle");
  return join(root, last, "oracleA_nopatch.yml");
}

/**
 * Trích config của MỘT row trong dump oracle (YAML đơn giản: 'config:' rồi các dòng thụt sâu hơn).
 * Nhận: text — nội dung dump; rowId — id row cần tìm.
 * Trả: object config (rỗng khi row không khai config).
 */
function stockConfig(text: string, rowId: string): Record<string, unknown> {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start === -1) throw new Error("không thấy row " + rowId + " trong dump");
  const config: Record<string, unknown> = {};
  let inConfig = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*- id: /.test(line) || /^# ==/.test(line)) break;
    const trimmed = line.trim();
    if (trimmed === "config:") {
      inConfig = true;
      continue;
    }
    if (!inConfig) continue;
    if (trimmed === "" || /^\s*- /.test(line) && !line.startsWith("    ")) break;
    // Chỉ nhận khoá THỤT SÂU ≥ 4 space (con của 'config:'); khoá cùng cấp 'disabled:' KHÔNG thuộc config.
    const match = /^ {4,}([A-Za-z_][\w]*):\s*(.+)$/.exec(line);
    if (match === null) continue;
    const key = match[1] ?? "";
    // 19/10/2026 — SỬA BÓC TÁCH: bản cũ gỡ MỌI dấu nháy ở hai đầu ⇒ làm hỏng giá trị có nháy BÊN TRONG
    // (vd `!!js ctx.webStartup.host ?? '127.0.0.1'` của row webserver bị cắt mất nháy cuối). Nay chỉ gỡ khi
    // giá trị được bao TRỌN bởi một cặp nháy cùng loại.
    const rawValue = match[2] ?? "";
    const quoted = rawValue.length >= 2 && ((rawValue.startsWith("'") && rawValue.endsWith("'")) || (rawValue.startsWith(String.fromCharCode(34)) && rawValue.endsWith(String.fromCharCode(34))));
    const raw = quoted ? rawValue.slice(1, -1) : rawValue;
    config[key] = raw === "true" ? true : raw === "false" ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
  }
  return config;
}

/** Row khai trong manifest (đã flip → gbh.row; chưa flip → gbh.row_unmounted_ly_do.row). */
function declaredRow(dir: string): Record<string, unknown> | undefined {
  const gbh = manifest(dir).gbh as { row?: Record<string, unknown>; row_unmounted_ly_do?: { row?: Record<string, unknown> } } | undefined;
  return gbh?.row ?? gbh?.row_unmounted_ly_do?.row;
}


/**
 * Trích `inject` của MỘT row trong dump oracle (danh sách `- <tên service>` thụt dưới `inject:`).
 * Vì sao cần: row thiếu `inject` ⇒ `!!js ctx.<service>` trong config CHẾT lúc boot
 * (sự cố 19/10 với `webserver`: thiếu `webStartup` ⇒ 8 entry pending vì service `webServer` không bao giờ được cấp).
 * Nhận: text — nội dung dump; rowId — id row cần tìm. Trả: mảng tên service (rỗng khi row không khai inject).
 */
function stockInject(text: string, rowId: string): string[] {
  const lines = text.split(String.fromCharCode(10));
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start === -1) throw new Error("không thấy row " + rowId + " trong dump");
  const out: string[] = [];
  let inInject = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*- id: /.test(line) || line.startsWith("# ==")) break;
    const trimmed = line.trim();
    if (trimmed === "inject:") {
      inInject = true;
      continue;
    }
    if (inInject) {
      const match = /^\s*- (.+)$/.exec(line);
      if (match !== null) {
        out.push((match[1] ?? "").trim());
        continue;
      }
      if (trimmed !== "") inInject = false;
    }
  }
  return out;
}

/**
 * Trích `disabled` của MỘT row trong dump oracle.
 * Nhận: text — nội dung dump; rowId — id row cần tìm. Trả: true/false/undefined (row không khai).
 */
function stockDisabled(text: string, rowId: string): boolean | undefined {
  const lines = text.split(String.fromCharCode(10));
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start === -1) throw new Error("không thấy row " + rowId + " trong dump");
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*- id: /.test(line) || line.startsWith("# ==")) break;
    const match = /^\s*disabled:\s*(true|false)$/.exec(line);
    if (match !== null) return match[1] === "true";
  }
  return undefined;
}
describe("row config — phải khớp NGUYÊN VĂN dump oracle", () => {
  for (const dir of ["tool-todo", "tool-web"]) {
    test(dir + ": gbh.row.config deep-equal config của row stock", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockConfig(dump, dir);
      const row = declaredRow(dir);
      expect(row).toBeDefined();
      expect(row?.config ?? {}).toEqual(expected);
    });

    test(dir + ": row có id + stockId + moduleIds đúng quy ước", () => {
      const row = declaredRow(dir);
      expect(row?.id).toBe(dir);
      expect(row?.stockId).toBe("@deepseek-ai/dsh-" + dir);
      expect(row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-host-" + dir]);
    });
  }
});

/**
 * Các row do cụm API hai mặt + cụm webserver/typert-registry khai (19/10/2026): id row trong dump + tên thư mục gói + moduleId.
 * Vì sao tách bảng riêng: các row này KHÔNG suy ra moduleId bằng công thức tool-* (có gói `gbh-api-*`, có gói `gbh-typert-*`),
 * nên khai tường minh để test vẫn kiểm được config + id + stockId.
 */
const ROW_CASES: readonly { rowId: string; dir: string; stockId: string; moduleId: string }[] = [
  { rowId: "terminal-controller", dir: "api-terminal-controller", stockId: "@deepseek-ai/dsh-api-terminal-controller", moduleId: "@galaxy-blackhole/gbh-api-terminal-controller" },
  { rowId: "workspace-files", dir: "api-workspace-files", stockId: "@deepseek-ai/dsh-api-workspace-files", moduleId: "@galaxy-blackhole/gbh-api-workspace-files" },
  { rowId: "remote-access", dir: "api-remote-access", stockId: "@deepseek-ai/dsh-api-remote-access", moduleId: "@galaxy-blackhole/gbh-api-remote-access" },
  { rowId: "job-controller", dir: "api-job-controller", stockId: "@deepseek-ai/dsh-api-job-controller", moduleId: "@galaxy-blackhole/gbh-api-job-controller" },
  { rowId: "typert", dir: "typert-registry", stockId: "@deepseek-ai/dsh-typert-registry", moduleId: "@galaxy-blackhole/gbh-typert-registry" },
  { rowId: "webserver", dir: "host-webserver", stockId: "@deepseek-ai/dsh-host-webserver", moduleId: "@galaxy-blackhole/gbh-host-webserver" },
];

describe("row config — cụm API hai mặt + webserver/typert-registry (mở rộng 19/10/2026)", () => {
  for (const ca of ROW_CASES) {
    test(ca.dir + ": config row (= gbh.row.config hoặc khối park) deep-equal config stock", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockConfig(dump, ca.rowId);
      const row = declaredRow(ca.dir);
      expect(row).toBeDefined();
      // Gói chưa có config trong stock ⇒ row của ta cũng phải KHÔNG có config (không bịa khoá).
      expect(row?.config ?? {}).toEqual(expected);
    });

    test(ca.dir + ": inject của row PHẢI khớp stock (thiếu inject ⇒ config !!js ctx.<service> chết lúc boot)", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockInject(dump, ca.rowId);
      const row = declaredRow(ca.dir);
      expect(row?.inject ?? []).toEqual(expected);
    });

    test(ca.dir + ": disabled của row PHẢI khớp stock", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockDisabled(dump, ca.rowId);
      const row = declaredRow(ca.dir);
      expect(row?.disabled).toBe(expected);
    });

    test(ca.dir + ": row có id + stockId + moduleIds đúng quy ước", () => {
      const row = declaredRow(ca.dir);
      expect(row?.id).toBe(ca.rowId);
      // stockId khai TƯỜNG MINH: các row này dùng package gốc dsh-api-*/dsh-typert-*, KHÔNG suy ra bằng công thức được.
      expect(row?.stockId).toBe(ca.stockId);
      expect(row?.moduleIds).toEqual([ca.moduleId]);
    });
  }
});
/**
 * Đọc khối ROW của một gói CLIENT: ưu tiên `gbh.row`, sau đó `gbh.row_unmounted_ly_do.row`.
 * Nhận: dir — tên thư mục trong `packages/client`.
 * Trả: object row (hoặc undefined khi gói chưa khai).
 */
function clientDeclaredRow(dir: string): Record<string, unknown> | undefined {
  const text = readFileSync(join(REPO, "packages", "client", dir, "package.json"), "utf8");
  const gbh = (JSON.parse(text) as { gbh?: { row?: unknown; row_unmounted_ly_do?: { row?: unknown } } }).gbh ?? {};
  const parked = gbh.row_unmounted_ly_do?.row;
  const row = gbh.row ?? parked;
  return row as Record<string, unknown> | undefined;
}

/**
 * 4 gói CLIENT đóng gói 19/10/2026 (nửa client 1:1 + đóng gói hai nửa) — row đang PARK, chờ Lead boot-smoke.
 * Bộ ba bắt buộc: `config` deep-equal · `inject` deep-equal · `disabled` BẰNG row stock; stock không khai
 * thì ta cũng KHÔNG khai (không bịa, không để `[]`).
 */
const CLIENT_ROW_CASES: readonly { rowId: string; dir: string; stockId: string }[] = [
  { rowId: "ui-user-questions", dir: "ui-user-questions", stockId: "@deepseek-ai/dsh-client-ui-user-questions" },
  { rowId: "ui-model-selection", dir: "ui-model-selection", stockId: "@deepseek-ai/dsh-client-ui-model-selection" },
  { rowId: "ui-input-trigger", dir: "ui-input-trigger", stockId: "@deepseek-ai/dsh-client-ui-input-trigger" },
  { rowId: "ui-cordis", dir: "ui-cordis", stockId: "@deepseek-ai/dsh-client-ui-cordis" },
];

describe("row config — 4 gói CLIENT đóng gói 19/10/2026 (PARKED, chờ boot-smoke)", () => {
  for (const ca of CLIENT_ROW_CASES) {
    test(ca.dir + ": khối park có id + moduleIds + aliases + tests đúng quy ước", () => {
      const row = clientDeclaredRow(ca.dir);
      expect(row).toBeDefined();
      expect(row?.id).toBe(ca.rowId);
      expect(row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-client-" + ca.dir]);
      expect(row?.aliases).toEqual([ca.stockId]);
      expect(row?.tests).toEqual(["tests/client/" + ca.dir + ".test.ts"]);
    });

    test(ca.dir + ": config deep-equal stock (stock KHÔNG khai ⇒ ta KHÔNG khai config)", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockConfig(dump, ca.rowId);
      const row = clientDeclaredRow(ca.dir);
      expect(expected).toEqual({});
      expect(row?.config).toBeUndefined();
    });

    test(ca.dir + ": inject deep-equal stock (stock KHÔNG khai ⇒ ta KHÔNG khai inject)", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockInject(dump, ca.rowId);
      const row = clientDeclaredRow(ca.dir);
      expect(expected).toEqual([]);
      expect(row?.inject).toBeUndefined();
    });

    test(ca.dir + ": disabled BẰNG stock (stock KHÔNG khai ⇒ ta KHÔNG khai disabled)", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const expected = stockDisabled(dump, ca.rowId);
      const row = clientDeclaredRow(ca.dir);
      expect(expected).toBeUndefined();
      expect(row?.disabled).toBeUndefined();
    });

    test(ca.dir + ": row khai ĐÚNG MỘT khoá (flip: gbh.row; park: row_unmounted_ly_do) — cấm cả hai", () => {
      const text = readFileSync(join(REPO, "packages", "client", ca.dir, "package.json"), "utf8");
      const gbh = (JSON.parse(text) as { gbh?: { row?: unknown; row_unmounted_ly_do?: { ly_do?: string } } }).gbh ?? {};
      // 19/10/2026 — BẤT BIẾN MỚI (reviewer bắt 5 guard stale cùng loại): row PHẢI khai ở đúng MỘT khoá;
      // đã flip thì không còn khối park, đang park thì phải có lý do. Ca giữ nguyên, chỉ đổi khẳng định.
      const daFlip = gbh.row !== undefined;
      const dangPark = gbh.row_unmounted_ly_do !== undefined;
      expect(daFlip || dangPark).toBe(true);
      expect(daFlip && dangPark).toBe(false);
      if (dangPark) expect(typeof gbh.row_unmounted_ly_do?.ly_do).toBe("string");
    });
  }
});

/** Các gói ROW LỒNG: 4 gói task-127 + tool-cordis (task-142, preset-cordis, KHÔNG có top-level). */
const NESTED = ["skill-filesystem", "tool-skill", "tool-jobs", "tool-present", "tool-cordis"];

/**
 * Trích entry LỒNG trong dump (dòng có thụt lề '      - id: <rowId>').
 * Nhận: text — nội dung dump oracle; rowId — id cần tìm.
 * Trả: { name, config, disabled, indented } — thông tin entry lồng; indented = true khi thụt lề (nằm trong preset).
 */
function nestedEntry(text: string, rowId: string): { name?: string; config: Record<string, unknown>; disabled?: unknown; indented: boolean } {
  const lines = text.split("\n");
  // Ưu tiên bản THỤT LỀ (nằm trong preset); chỉ khi không có mới lấy bản top-level.
  const candidates = lines
    .map((line, position) => ({ line, position }))
    .filter((item) => item.line.trim() === "- id: " + rowId);
  const indentedCandidate = candidates.find((item) => item.line.length - item.line.trimStart().length > 0);
  let index = (indentedCandidate ?? candidates[0])?.position ?? -1;
  // Một số entry KHÔNG khai explicit 'id' (cordis suy ra id từ name) ⇒ tìm theo dòng 'name:' thụt lề.
  let nameOnly = false;
  if (index === -1) {
    const byName = lines
      .map((line, position) => ({ line, position }))
      .filter((item) => item.line.trim() === "name: '@deepseek-ai/dsh-" + rowId + "'");
    const indentedName = byName.find((item) => item.line.length - item.line.trimStart().length > 0);
    if (indentedName !== undefined) {
      index = indentedName.position;
      nameOnly = true;
    }
  }
  if (index === -1) return { config: {}, indented: false };
  if (nameOnly) return { name: "@deepseek-ai/dsh-" + rowId, config: {}, disabled: undefined, indented: true };
  const line = lines[index] ?? "";
  const config: Record<string, unknown> = {};
  let name: string | undefined;
  let disabled: unknown;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const current = lines[cursor] ?? "";
    if (/^\s+- id: /.test(current) || /^# ==/.test(current)) break;
    const trimmed = current.trim();
    const nameMatch = /^name: (.+)$/.exec(trimmed);
    if (nameMatch !== null && name === undefined) {
      name = (nameMatch[1] ?? "").replace(/^['"]|['"]$/g, "");
      continue;
    }
    const disabledMatch = /^disabled: (.+)$/.exec(trimmed);
    if (disabledMatch !== null && current.length - current.trimStart().length < 6) {
      disabled = (disabledMatch[1] ?? "").trim();
      continue;
    }
    const nested = /^ {10,}([A-Za-z_][\w]*):\s*(.+)$/.exec(current);
    if (nested !== null) {
      const raw = (nested[2] ?? "").replace(/^['"]|['"]$/g, "");
      config[nested[1] ?? ""] = raw === "true" ? true : raw === "false" ? false : Number.isNaN(Number(raw)) ? raw : Number(raw);
    }
  }
  return { name, config, disabled, indented: line.length - line.trimStart().length > 0 };
}

describe("row lồng — entry trong preset phải khớp dump oracle", () => {
  for (const dir of NESTED) {
    // 20/10/2026 (Lead mount 6 gói host-tool): gói khai nested CÓ THỂ đã mount thêm row TOP-LEVEL.
    // Bất biến: nested đúng 4 khoá; nếu có gbh.row thì row phải CÙNG id với pluginId và đủ field.
    test(dir + ": manifest khai gbh.nested { kind:'preset', pluginId, stockId }; nếu có gbh.row thì đủ field", () => {
      const gbh = manifest(dir).gbh as { row?: Record<string, unknown>; nested?: Record<string, unknown> } | undefined;
      expect(gbh?.nested?.kind).toBe("preset");
      expect(gbh?.nested?.pluginId).toBe(dir);
      expect(gbh?.nested?.stockId).toBe("@deepseek-ai/dsh-" + dir);
      const row = gbh?.row;
      if (row !== undefined) {
        expect(row["id"]).toBe(dir);
        expect(String(row["moduleIds"]).length).toBeGreaterThan(0);
        expect(row["tests"]).toBeDefined();
      }
    });

    test(dir + ": dump có entry LỒNG (thụt lề) đúng id + name; config khai trong manifest phải khớp", () => {
      const dump = readFileSync(latestDump(), "utf8");
      const entry = nestedEntry(dump, dir);
      expect(entry.indented).toBe(true);
      expect(entry.name).toBe("@deepseek-ai/dsh-" + dir);
      const gbh = manifest(dir).gbh as { nested?: { config?: Record<string, unknown> } } | undefined;
      expect(gbh?.nested?.config ?? {}).toEqual(entry.config);
    });
  }
});
