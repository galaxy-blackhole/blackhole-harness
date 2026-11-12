/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test cổng PHẦN B của tools/check/toggle-matrix.ts — "công tắc trong UI phải có ĐƯỜNG GHI".
 *   11/11/2026 — ca gốc của sự cố: công tắc "Công cụ lập trình" (Cài đặt → Chung) bấm KHÔNG đổi gì vì đăng ký
 *   settings.general.item thiếu \`inject\` ⇒ props.setEnabled undefined. Test này nạp ĐÚNG văn bản đăng ký
 *   TRƯỚC khi sửa và khẳng định cổng báo FAIL, rồi nạp văn bản SAU khi sửa và khẳng định PASS.
 */

import { describe, expect, test } from "bun:test";
import { checkSwitchRegistration, parseSlotRegistrations, scanSwitchWiring, writerProps } from "../../tools/check/toggle-matrix.ts";
import { indexRepoPackages } from "../../tools/check/toggle-matrix.ts";

/** Đăng ký TRƯỚC khi sửa (11/11/2026): đúng nguyên văn đã gây ra công tắc vô hiệu. */
const TRUOC_KHI_SUA = 'ctx.effect(() => ctx.slots.inject("settings.general.item", () => ctx.slots.register({ name: "settings.general.item", id: "developer-tools", order: 15, locale: NS }, createItems(deps))), "ui-settings-general.settings.general.item");';

/** Đăng ký SAU khi sửa: cấp lại đúng hai prop của bản gốc (hooks.developerTools + setEnabled). */
const SAU_KHI_SUA = `ctx.slots.inject("settings.general.item", () => ctx.slots.register({
  name: "settings.general.item",
  id: "developer-tools",
  order: 15,
  locale: NS,
  inject: () => ({
    hooks: { developerTools: ctx.configForms.developerTools.enabled },
    setEnabled: (enabled) => ctx.configForms.developerTools.setEnabled(enabled),
  }),
}, createItems(deps)));`;

/** Đăng ký của BẢN GỐC (đọc từ lib/client.js 1079-1088), dùng làm chuẩn đối chứng. */
const BAN_GOC = `ctx.slots.register({ name: "settings.general.item", id: "developer-tools", order: 15, locale: NS,
  inject: () => ({ hooks: { developerTools: ctx.configForms.developerTools.enabled }, setEnabled: (enabled) => ctx.configForms.developerTools.setEnabled(enabled) }) }, DeveloperToolsRow);`;

describe("toggle-matrix PHẦN B — đọc đăng ký slot từ văn bản", () => {
  test("parseSlotRegistrations: lấy đúng slot + id, cân ngoặc qua chuỗi và chú thích", () => {
    const text = [
      "// slots.register({ name: \"khong-phai-dang-ky\" }) — dòng chú thích phải bị bỏ qua",
      'const a = "slots.register({ name: \"trong-chuoi\" })";',
      'ctx.slots.register({ name: "settings.general.item", id: "developer-tools", inject: () => ({ hooks: { x: 1 } }) }, Row);',
    ].join("\n");
    const found = parseSlotRegistrations(text);
    expect(found.map((item) => item.slot)).toEqual(["settings.general.item"]);
    expect(found[0]?.id).toBe("developer-tools");
    expect(found[0]?.text).toContain("inject:");
  });

  test("writerProps: chỉ nhận hàm ghi quy ước set*, không nhận setState bên trong chuỗi khác dạng", () => {
    expect(writerProps('inject: () => ({ setEnabled: (v) => v, hooks: { a: 1 } })')).toEqual(["setEnabled"]);
    expect(writerProps("inject: () => ({ hooks: { a: 1 } })")).toEqual([]);
    expect(writerProps("setFontFamily: fn, setLineHeight: fn")).toEqual(["setFontFamily", "setLineHeight"]);
  });
});

describe("toggle-matrix PHẦN B — công tắc phải có đường ghi (ca gốc 11/11/2026)", () => {
  const stock = parseSlotRegistrations(BAN_GOC)[0];
  const labels = { oursPackage: "@galaxy-blackhole/gbh-client-ui-settings-general", stockBundle: "@deepseek-ai/dsh-client-ui-settings-general" };

  test("TRƯỚC khi sửa: đăng ký thiếu inject ⇒ cổng PHẢI báo FAIL (đây là thứ đã lọt lưới)", () => {
    expect(stock).toBeDefined();
    const ours = parseSlotRegistrations(TRUOC_KHI_SUA).map((item) => ({ ...item, file: "packages/client/ui-settings-general/src/plugin.ts" }));
    const check = checkSwitchRegistration(stock!, ours, labels);
    expect(check).toBeDefined();
    expect(check?.writers).toEqual(["setEnabled"]);
    expect(check?.verdict).toBe("FAIL");
    expect(check?.evidence.join(" ")).toContain("KHÔNG cấp setEnabled");
  });

  test("SAU khi sửa: đăng ký cấp setEnabled ⇒ PASS", () => {
    const ours = parseSlotRegistrations(SAU_KHI_SUA).map((item) => ({ ...item, file: "packages/client/ui-settings-general/src/plugin.ts" }));
    const check = checkSwitchRegistration(stock!, ours, labels);
    expect(check?.verdict).toBe("PASS");
    expect(check?.evidence.join(" ")).toContain("setEnabled");
  });

  test("quét REPO THẬT: không ca nào FAIL (kể cả developer-tools) khi có bundle gốc", () => {
    const repoPackages = indexRepoPackages();
    const cases = scanSwitchWiring(repoPackages, []);
    // Máy chưa cài bundle gốc (apps/host/node_modules) ⇒ không có ca nào: bỏ qua, KHÔNG báo oan.
    if (cases.length === 0) return;
    const fails = cases.filter((item) => item.verdict === "FAIL");
    expect(fails.map((item) => item.ours + " / " + item.slot + " / " + (item.id ?? "-"))).toEqual([]);
    const dev = cases.find((item) => item.id === "developer-tools");
    expect(dev?.verdict, "hàng 'Công cụ lập trình' phải PASS").toBe("PASS");
  });
});
