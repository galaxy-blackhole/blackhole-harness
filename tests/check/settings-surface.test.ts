/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — tạo mới: test cổng PHẦN C/D (tools/check/settings-surface.ts) — "mục bấm được
 *   trong Cài đặt phải có đường ghi + field có trong schema, đo được bằng RPC". Lý do: 11/11/2026 phát hiện
 *   2 namespace Cài đặt bị lớp overlay app.patch.yml ghim nên settings/mutate bị từ chối.
 * desc Test hàm thuần của cổng PHẦN C/D: đọc lớp patch (bundle/overlay), kiểm toạ độ tệp:dòng, chọn giá trị thử
 *      theo schema, và canh ca gốc "row bị overlay ghim ⇒ FAIL".
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  checkStatic,
  escapeRegExp,
  fieldNodes,
  hasRow,
  probeValueFor,
  rowLayerOf,
  siteProblem,
  templateText,
} from "../../tools/check/settings-surface.ts";
import type { SettingsControl } from "../../tools/check/settings-surface.ts";

/** Gốc repo, suy từ vị trí tệp test. */
const REPO_ROOT = resolve(import.meta.dir, "..", "..");

/** Mục giả để test thuần (không phụ thuộc bảng thật). */
const CONTROL: SettingsControl = {
  label: "giả · công tắc",
  pkg: "@galaxy-blackhole/gbh-gia",
  ui: { file: "tools/check/settings-surface.ts", line: 1, marker: "author" },
  write: { file: "tools/check/settings-surface.ts", line: 20, marker: "export interface Site" },
  ns: "gia-ns",
  fields: ["enabled"],
  writer: "setEnabled",
};

describe("settings-surface — đọc lớp patch", () => {
  test("hasRow: khớp đúng dòng '- id: <id>', không khớp id con/tiền tố", () => {
    const text = ["- id: alpha", "    - id: alpha-con", "- id: alpha2"].join("\n");
    expect(hasRow(text, "alpha")).toBe(true);
    expect(hasRow(text, "alpha-con")).toBe(true);
    expect(hasRow(text, "alp")).toBe(false);
    expect(hasRow("", "alpha")).toBe(false);
  });

  test("rowLayerOf: overlay thắng bundle (lớp overlay nằm SAU tài liệu người dùng)", () => {
    const bundle = "- id: settings-row\n";
    const overlay = "- id: settings-row-ours\n";
    expect(rowLayerOf("settings-row", bundle, overlay)).toBe("overlay");
    expect(rowLayerOf("settings-row", bundle, "")).toBe("bundle");
    expect(rowLayerOf("khong-co", bundle, "")).toBe("unknown");
  });

  test("escapeRegExp: id có dấu chấm vẫn khớp nguyên văn", () => {
    expect(escapeRegExp("a.b")).toBe("a\\.b");
    expect(new RegExp("^" + escapeRegExp("ui.settings") + "$", "u").test("ui.settings")).toBe(true);
    expect(new RegExp("^" + escapeRegExp("ui.settings") + "$", "u").test("uiXsettings")).toBe(false);
  });

  test("templateText: template lớp overlay trong repo KHÔNG còn ghim 2 row vừa sửa (11/11/2026)", () => {
    const template = templateText(REPO_ROOT);
    expect(template.length).toBeGreaterThan(0);
    expect(hasRow(template, "subagent-model-selection-settings")).toBe(false);
    expect(hasRow(template, "ui-settings-general")).toBe(false);
  });
});

describe("settings-surface — kiểm toạ độ mã nguồn", () => {
  test("siteProblem: toạ độ đúng thì null, lệch chuỗi thì báo lý do", () => {
    expect(siteProblem(REPO_ROOT, CONTROL.ui)).toBeNull();
    expect(siteProblem(REPO_ROOT, { file: "tools/check/settings-surface.ts", line: 1, marker: "khong-bao-gio-co" })).not.toBeNull();
    expect(siteProblem(REPO_ROOT, { file: "khong/co/tep.ts", line: 1, marker: "x" })).toContain("thiếu tệp");
  });

  test("checkStatic: row bị template overlay ghim ⇒ FAIL (ca gốc 11/11/2026)", () => {
    const bundle = "- id: gia-ns\n";
    const pinned = checkStatic(CONTROL, REPO_ROOT, bundle, "");
    // Không ghim ở template thật (gia-ns không có) nhưng bundle có ⇒ PASS.
    expect(pinned.verdict).toBe("PASS");
    const controlPinned: SettingsControl = { ...CONTROL, ns: "agent-default-model" };
    const ghim = checkStatic(controlPinned, REPO_ROOT, "", "");
    expect(ghim.verdict).toBe("FAIL");
    expect(ghim.layer).toBe("overlay");
  });
});

describe("settings-surface — chọn giá trị thử theo schema", () => {
  test("probeValueFor: boolean/number/string/union/array", () => {
    expect(probeValueFor({ type: "boolean" }, true, {})).toBe(false);
    expect(probeValueFor({ type: "number" }, 5, {})).toBe(6);
    expect(probeValueFor({ type: "string" }, "vi", {})).toBe("probe-xyz");
    const envelope = { refs: { 1: { type: "const", value: "queue" }, 2: { type: "const", value: "steer" } } };
    expect(probeValueFor({ type: "union", list: [1, 2] }, "queue", envelope)).toBe("steer");
    expect(probeValueFor({ type: "array" }, ["a", "b"], {})).toEqual(["a"]);
    expect(probeValueFor(undefined, 1, {})).toBeUndefined();
  });

  test("fieldNodes: đọc bảng field cấp 1 từ envelope schemastery (refs + uid)", () => {
    const envelope = {
      uid: 9,
      refs: {
        8: { type: "boolean" },
        9: { type: "object", dict: { enabled: 8 } },
      },
    };
    const nodes = fieldNodes(envelope);
    expect([...nodes.keys()]).toEqual(["enabled"]);
    expect(nodes.get("enabled")?.type).toBe("boolean");
  });
});
