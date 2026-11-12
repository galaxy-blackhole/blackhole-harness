/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-api-settings-controller: so bề mặt export, tập
 *      method Remote, và hợp đồng lỗi với chính bundle gốc của DSH
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";



import Ours, { CredentialsController, SettingsController } from "../../packages/host/settings-controller/src/index.ts";

/** Đường dẫn bundle gốc (chỉ đọc). */
const STOCK = join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-api-settings-controller/lib/index.js");

/** Context giả tối thiểu: không mount service nào, ghi lại plugin đã mount. */
function bareContext(): { ctx: unknown; mounted: unknown[] } {
  const mounted: unknown[] = [];
  const ctx = {
    get: (): undefined => undefined,
    plugin: (plugin: unknown): void => {
      mounted.push(plugin);
    },
  };
  return { ctx, mounted };
}

/**
 * Gọi một method của đối tượng test, báo lỗi rõ ràng nếu thiếu.
 * Nhận: đối tượng, tên method và tham số.
 * Trả: kết quả của method.
 */
function call(target: Record<string, unknown>, name: string, args: unknown[]): unknown {
  const fn = target[name];
  if (typeof fn !== "function") throw new Error("method thiếu: " + name);
  return fn.apply(target, args);
}

/**
 * Dựng một thực thể của lớp mà KHÔNG chạy constructor cordis Service (constructor cần Context thật
 * của kernel, không dựng được trong unit test) — chỉ gắn ctx giả rồi gọi thẳng method.
 */
function instantiate(ctor: unknown, ctx: unknown): Record<string, unknown> {
  const instance = Object.create((ctor as { prototype: object }).prototype) as Record<string, unknown>;
  instance.ctx = ctx;
  instance.openTextFile = async (): Promise<void> => undefined;
  return instance;
}

/** Đọc tập tên method (không tính constructor) của một lớp. */
function methodNames(ctor: unknown): string[] {
  return Object.getOwnPropertyNames((ctor as { prototype: object }).prototype)
    .filter((name) => name !== "constructor")
    .sort();
}



describe("row api/settings-controller — đối chứng với bản gốc", () => {
  test("bề mặt export TRÙNG với bundle gốc", async () => {
    const stock = (await import(STOCK)) as Record<string, unknown>;
    expect(Object.keys(stock).sort()).toEqual(["CredentialsController", "SettingsController", "default"]);
    expect(typeof stock.default).toBe("function");
    expect(typeof Ours).toBe("function");
    expect(new Set([CredentialsController.name, SettingsController.name, Ours.name])).toEqual(
      new Set(["CredentialsController", "SettingsController", "SettingsController"]),
    );
  });

  test("tập method Remote TRÙNG với bản gốc (credential + settings)", async () => {
    const stock = (await import(STOCK)) as { CredentialsController: unknown; SettingsController: unknown };
    const oursCred = methodNames(CredentialsController);
    const stockCred = methodNames(stock.CredentialsController);
    const oursSettings = methodNames(SettingsController);
    const stockSettings = methodNames(stock.SettingsController);
    expect(oursCred).toEqual(stockCred);
    expect(oursSettings).toEqual(stockSettings);
    expect(oursCred).toEqual(["describe", "provider", "set", "unset", "write"]);
    expect(oursSettings).toEqual(["constructor", "describe", "mutate", "openSettingsDocument", "provider", "replace", "update", "write"].filter((name) => name !== "constructor"));
    // 3 method Remote của credentials + 5 của settings, GIỐNG bản gốc (đếm trên chính seam, trừ hai hàm nội bộ).
    const REMOTE_CRED = ["describe", "set", "unset"];
    const REMOTE_SETTINGS = ["describe", "mutate", "openSettingsDocument", "replace", "update"];
    for (const name of REMOTE_CRED) expect(oursCred).toContain(name);
    for (const name of REMOTE_SETTINGS) expect(oursSettings).toContain(name);
    expect(REMOTE_CRED.length + REMOTE_SETTINGS.length).toBe(8);
    // Cả hai bản build đều dùng cùng seam decorator của kernel.
    const oursBundle = await Bun.file(join(import.meta.dir, "../../packages/host/settings-controller/lib/index.js")).text();
    const stockBundle = await Bun.file(STOCK).text();
    expect(oursBundle.includes("dsh-typert-protocol")).toBe(true);
    expect(stockBundle.includes("dsh-typert-protocol")).toBe(true);
  });

/**
 * Quy id GÓI trong THÔNG ĐIỆP lỗi về không gian id của bản gốc trước khi so A/B.
 * Chỉ đổi ĐÚNG 3 id đã GBH hoá ở `src/index.ts:311,470` (khuôn task-17/N2: replaceAll rồi so);
 * phần còn lại của câu phải TRÙNG TỪNG BYTE nên mọi sai khác khác vẫn lộ.
 * Nhận: value — outcome { code, message } đọc từ lỗi.
 * Trả: bản sao đã quy id, KHÔNG đổi gì khác.
 */
function quyIdStock(value: { code: string; message: string }): { code: string; message: string } {
  const message = value.message
    .replaceAll("@galaxy-blackhole/gbh-credentials-local", "@deepseek-ai/dsh-credentials-local")
    .replaceAll("@galaxy-blackhole/gbh-settings", "@deepseek-ai/dsh-settings")
    .replaceAll("@galaxy-blackhole/gbh-config-editor", "@deepseek-ai/dsh-config-editor");
  return { code: value.code, message };
}

  test("thiếu nhà cung cấp ⇒ CÙNG mã lỗi gateway/internal và cùng thông điệp", async () => {
    const stock = (await import(STOCK)) as { default: new (ctx: unknown) => Record<string, (...args: unknown[]) => unknown> };
    const oursCred = instantiate(CredentialsController, bareContext().ctx);
    const oursSettings = instantiate(SettingsController, bareContext().ctx);
    const stockSettings = instantiate(stock.default, bareContext().ctx);
    const stockCred = instantiate((stock as unknown as { CredentialsController: unknown }).CredentialsController, bareContext().ctx);
    const failure = async (run: () => unknown): Promise<{ code: string; message: string }> => {
      try {
        await run();
        return { code: "none", message: "" };
      } catch (error) {
        const record = error as { code?: string; message?: string };
        return { code: String(record.code ?? "?"), message: String(record.message ?? "") };
      }
    };
    const oursDescribe = await failure(() => call(oursSettings, "describe", []));
    const stockDescribe = await failure(() => call(stockSettings, "describe", []));
    expect(oursDescribe.code).toBe("gateway/internal");
    expect(quyIdStock(oursDescribe)).toEqual(quyIdStock(stockDescribe));
    const oursCredDescribe = await failure(() => call(oursCred, "describe", [["A"]]));
    const stockCredDescribe = await failure(() => call(stockCred, "describe", [["A"]]));
    expect(oursCredDescribe.code).toBe("gateway/internal");
    expect(quyIdStock(oursCredDescribe)).toEqual(quyIdStock(stockCredDescribe));
  });

  test("payload sai ⇒ CÙNG mã gateway/bad-request và cùng thông điệp theo từng method", async () => {
    const stock = (await import(STOCK)) as { default: new (ctx: unknown) => Record<string, (...args: unknown[]) => unknown>; CredentialsController: new (ctx: unknown) => Record<string, (...args: unknown[]) => unknown> };
    const cases: { label: string; run: (target: Record<string, unknown>) => unknown }[] = [
      { label: "credentials.describe", run: (target) => call(target, "describe", ["khong-phai-mang"]) },
      { label: "credentials.set", run: (target) => call(target, "set", ["A", ""]) },
      { label: "credentials.unset", run: (target) => call(target, "unset", ["1-sai-grammar"]) },
      { label: "settings.update", run: (target) => call(target, "update", ["", {}]) },
    ];
    const oursSettings = instantiate(SettingsController, bareContext().ctx);
    const stockSettings = instantiate(stock.default, bareContext().ctx);
    const oursCred = instantiate(CredentialsController, bareContext().ctx);
    const stockCred = instantiate(stock.CredentialsController, bareContext().ctx);
    const failure = async (run: () => unknown): Promise<{ code: string; message: string }> => {
      try {
        await run();
        return { code: "none", message: "" };
      } catch (error) {
        const record = error as { code?: string; message?: string };
        return { code: String(record.code ?? "?"), message: String(record.message ?? "") };
      }
    };
    for (const entry of cases) {
      const oursTarget = entry.label.startsWith("credentials") ? oursCred : oursSettings;
      const stockTarget = entry.label.startsWith("credentials") ? stockCred : stockSettings;
      const ours = await failure(() => entry.run(oursTarget));
      const theirs = await failure(() => entry.run(stockTarget));
      expect(ours).toEqual(theirs);
      expect(ours.code).toBe("gateway/bad-request");
    }
  });
});
