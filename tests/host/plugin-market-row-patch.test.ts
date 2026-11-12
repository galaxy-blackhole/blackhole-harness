/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng chống tái phát cho row `plugin-market`: patch PHẢI tắt stock VÔ ĐIỀU KIỆN (disabled: true)
 *      và chuyển điều kiện gốc `!ctx.get('profileContext')` sang row INSERT (insertDisabled)
 *      — phát nguyên biểu thức cho row stock thì khi có profileContext stock VẪN bật ⇒ trùng service (sự cố 19/10)
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const OURS = join(REPO, "packages", "host", "plugin-market");

/** Row metadata trong manifest (đọc cả dạng park `row_unmounted_ly_do.row` lẫn `row`). */
function rowMetadata(): Record<string, unknown> {
  const metadata = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
    gbh?: { row?: Record<string, unknown>; row_unmounted_ly_do?: { row?: Record<string, unknown> } };
  };
  const row = metadata.gbh?.row ?? metadata.gbh?.row_unmounted_ly_do?.row;
  if (row === undefined) throw new Error("manifest không khai row");
  return row;
}

/** Patch YAML sinh cho gói ta. */
function patchBlock(): string {
  return renderRewriteBlock("@galaxy-blackhole/gbh-plugin-market", rowMetadata() as never);
}

describe("plugin-market — patch row phải TẮT stock vô điều kiện + điều kiện gốc sang INSERT", () => {
  test("row khai disabled = true (KHÔNG phải biểu thức !!js)", () => {
    expect(rowMetadata()["disabled"]).toBe(true);
  });

  test("row khai insertDisabled đúng điều kiện gốc !ctx.get('profileContext')", () => {
    expect(rowMetadata()["insertDisabled"]).toEqual({ js: "!ctx.get('profileContext')" });
  });

  test("patch có `- id: plugin-market` + `disabled: true` (không phải !!js)", () => {
    const block = patchBlock();
    expect(block).toContain("- id: plugin-market");
    expect(block).toContain("  disabled: true");
    expect(block).not.toContain("- id: plugin-market\n  disabled: !!js");
  });

  test("khối insert có disabled: !!js '!ctx.get(''profileContext'')'", () => {
    const block = patchBlock();
    expect(block).toContain("- insert:");
    expect(block).toContain("plugin-market-ours");
    // renderDisabled dùng JSON.stringify ⇒ dạng chuỗi là !!js "!ctx.get('profileContext')"
    expect(block).toContain('disabled: !!js');
  });
});
