/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 27/10/2026
 * desc Test deep-link ?session= của lớp vỏ shell-identity: chèn đúng chỗ, idempotent, ghi cả hai khoá.
 */
import { describe, expect, it } from "bun:test";
import {
  LEGACY_SELECTION_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  deepLinkScript,
  injectDeepLink,
} from "../../packages/host/shell-identity/src/deep-link.ts";

describe("shell-identity — deep-link ?session=", () => {
  it("chèn script ngay sau head và chỉ một lần (idempotent)", () => {
    const html = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
    const once = injectDeepLink(html);
    expect(once).toContain("data-gbh-deep-link");
    expect(once.indexOf("data-gbh-deep-link")).toBeGreaterThan(once.indexOf("<head>"));
    expect(once.indexOf("data-gbh-deep-link")).toBeLessThan(once.indexOf("<meta"));
    expect(injectDeepLink(once)).toBe(once);
  });

  it("script ghi cả khoá GBH lẫn khoá DSH cũ, chỉ khi có ?session=", () => {
    const script = deepLinkScript();
    expect(script).toContain(SELECTION_STORAGE_KEY);
    expect(script).toContain(LEGACY_SELECTION_STORAGE_KEY);
    expect(script).toContain("URLSearchParams(location.search)");
    expect(script).toContain("get('session')");
    expect(script).toContain("localStorage.setItem");
  });

  it("html không có head thì trả nguyên văn", () => {
    expect(injectDeepLink("<html><body></body></html>")).toBe("<html><body></body></html>");
  });
});
