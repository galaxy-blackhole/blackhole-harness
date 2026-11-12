/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho nửa CLIENT của @galaxy-blackhole/gbh-session-log-export: dựng seam GIẢ (bảng module,
 *      document, fetch, context browser) rồi chạy CẢ HAI bản — artifact lib/client.js của ta và
 *      lib/client.js GỐC của @deepseek-ai/dsh-session-log-export — so từng hành vi: dsh.client 5 inject,
 *      exports ./client, MỘT-ID, tải ZIP (route · tên tệp · trạng thái), lỗi HTTP, khử trùng, dismiss,
 *      dispose, sự kiện lệnh, từ điển, feedback, slot face và cây component. KHÔNG gọi mạng.
 *      Harness dùng chung nằm ở session-log-export-client-harness.ts.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  OURS_PACKAGE,
  STOCK_PACKAGE,
  STOCK_DIR,
  anchors,
  canonical,
  clientArtifact,
  clientText,
  controllerOf,
  deferred,
  exportNames,
  faceOf,
  failureResponse,
  grepCount,
  hostArtifact,
  installFetch,
  menuOf,
  oursExports,
  oursMeta,
  oursRegistration,
  oursRegistrationCount,
  outDir,
  pluginFor,
  renderDialog,
  renderHeader,
  settle,
  side,
  stockMeta,
  successResponse,
  teardown,
} from "./session-log-export-client-harness.ts";
import type { Element, Entry, FetchCall, Harness, SideKind, State, StyleTag } from "./session-log-export-client-harness.ts";

afterAll(teardown);

describe("L. MANIFEST nửa client — dsh.client + exports ./client", () => {
  test("dsh.client của ta KHỚP TUYỆT ĐỐI bản gốc: 5 inject so TỪNG PHẦN TỬ + platform web", () => {
    // 20/10/2026 — so SAU bản đồ id (brand + 566 id) để ca này còn đúng khi inject của manifest được
    // rewrite sang id GBH như 55 gói khác; hiện manifest còn id stock nên phép so là identity.
    expect(sameAfterIdMap(oursMeta.dsh, stockMeta.dsh)).toBe(true);
    const oursInject = oursMeta.dsh?.client?.inject ?? [];
    const stockInject = stockMeta.dsh?.client?.inject ?? [];
    expect(oursInject).toHaveLength(5);
    expect(stockInject).toHaveLength(5);
    // So TỪNG PHẦN TỬ theo đúng thứ tự, sau khi quy id (không đổi sang contains).
    for (let index = 0; index < 5; index += 1) expect(sameAfterIdMap(oursInject[index], stockInject[index])).toBe(true);
    expect(sameAfterIdMap(oursInject, [
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-commands",
      "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-renderer",
      "@deepseek-ai/dsh-client-ui-session",
    ])).toBe(true);
    expect(oursMeta.dsh?.client?.platform).toBe("web");
  });

  test("exports['./client'] trỏ lib/client.js; entry host và tên package KHÔNG đổi", () => {
    expect(oursMeta.exports?.["./client"]).toBe("./lib/client.js");
    // 05/11/2026 (P1b): exports["."] theo hinh dang stock { types, default } khi goi da co .d.ts.
    const dot = oursMeta.exports?.["."] as unknown;
    expect(typeof dot === "string" ? dot : (dot as { default?: string }).default).toBe("./lib/index.js");
    expect(oursMeta.main).toBe("lib/index.js");
    expect(oursMeta.name).toBe(OURS_PACKAGE);
    expect(existsSync(clientArtifact)).toBe(true);
    expect(existsSync(hostArtifact)).toBe(true);
  });

  test("inject RUNTIME vẫn là ['slots','locale'] và BẰNG bản gốc", () => {
    const stock = pluginFor("stock");
    const ours = pluginFor("ours");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["slots", "locale"]);
    expect(oursExports["inject"]).toEqual(["slots", "locale"]);
  });
});

describe("M. ARTIFACT client — build, nạp, MỘT-ID, export, CSS", () => {
  test("artifact client build ra là CLASSIC SCRIPT (không import/export top-level): đăng ký ĐÚNG MỘT id của ta", () => {
    // Artifact có header 7 dòng sinh tự động; thân classic script bắt đầu ngay sau comment đó.
    const scriptBody = clientText.replace(/^\s*\/\*[\s\S]*?\*\/\s*/u, "");
    expect(scriptBody.startsWith("(function () {")).toBe(true);
    for (const line of clientText.split(String.fromCharCode(10))) expect(/^(export|import)\s/.test(line)).toBe(false);
    expect(oursRegistrationCount).toBe(1);
    expect(oursRegistration?.id).toBe(OURS_PACKAGE);
    const plugin = pluginFor("ours");
    expect(typeof plugin.apply).toBe("function");
    expect(plugin.inject).toEqual(["slots", "locale"]);
  });

  test("NẠP ĐƯỢC ngoài harness: eval script classic với window giả cho RA surface plugin ĐÚNG BẰNG stock", () => {
    type Captured = { id: string; factory: (req: (name: string) => unknown) => Record<string, unknown> };
    const captured: Captured[] = [];
    const stockCaptured: Captured[] = [];
    const globalScope = globalThis as unknown as { window?: unknown };
    const hadWindow = Object.prototype.hasOwnProperty.call(globalScope, "window");
    const previousWindow = globalScope.window;
    const loadInWindow = (text: string, into: Captured[]): void => {
      globalScope.window = { __ModuleLoader__: { load: (registration: never) => into.push(registration) } };
      // eslint-disable-next-line no-new-func
      new Function(text)();
    };
    try {
      loadInWindow(clientText, captured);
      loadInWindow(readFileSync(join(STOCK_DIR, "lib", "client.js"), "utf8"), stockCaptured);
    } finally {
      if (hadWindow) globalScope.window = previousWindow;
      else delete globalScope.window;
    }
    expect(captured).toHaveLength(1);
    expect(captured[0]?.id).toBe(OURS_PACKAGE);
    expect(stockCaptured).toHaveLength(1);
    // 19/10/2026: nửa client là CJS bọc classic script và module.exports = plugin object — loader lấy THẲNG
    // module.exports, nên artifact KHÔNG còn export createPlugin/factory. Surface phải bằng stock.
    const oursPlugin = captured[0]?.factory(() => ({})) ?? {};
    const stockPlugin = stockCaptured[0]?.factory(() => ({})) ?? {};
    expect(Object.keys(oursPlugin).sort()).toEqual(Object.keys(stockPlugin).sort());
    expect(Object.keys(oursPlugin).sort()).toEqual(["apply", "inject"]);
    expect(typeof oursPlugin["apply"]).toBe("function");
    expect(oursPlugin["inject"]).toEqual(stockPlugin["inject"]);
  });

  test("MỘT-ID: lib/client.js có 0 lần id GỐC (grep -c) và ĐÚNG 1 lần id của ta", () => {
    expect(grepCount(clientArtifact, STOCK_PACKAGE)).toBe(0);
    expect(grepCount(clientArtifact, OURS_PACKAGE)).toBeGreaterThan(0);
    // Luật MỘT-ID áp cho NGỮ CẢNH ĐĂNG KÝ/NẠP module: không file lib nào được đăng ký hay require id gốc.
    for (const file of [hostArtifact, clientArtifact]) {
      const text = readFileSync(file, "utf8");
      expect(text.includes('load({ id: "' + STOCK_PACKAGE + '"')).toBe(false);
      expect(text.includes('require("' + STOCK_PACKAGE + '"')).toBe(false);
      expect(text.includes('from "' + STOCK_PACKAGE + '"')).toBe(false);
    }
  });

  test("lib/index.js (nửa host) còn ĐÚNG 1 lần id gốc — definitionId brand NGUYÊN VĂN, không phải id module", () => {
    // Vì sao không phải 0: nửa host port 1:1 giữ definitionId = brand của bản gốc (test host K2 khoá
    // giá trị này). Muốn 0 phải sửa src/index.ts của nửa host — NGOÀI vùng ghi của lượt này.
    expect(grepCount(hostArtifact, STOCK_PACKAGE)).toBe(1);
    expect(readFileSync(hostArtifact, "utf8")).toContain('definitionId: brandString("' + STOCK_PACKAGE + '")');
  });

  test("14 export của artifact — đúng tập, không default", () => {
    expect(exportNames(clientText)).toEqual([
      "HEADER_ACTION_CLASS",
      "HEADER_ACTION_CSS",
      "INITIAL",
      "NS",
      "PACKAGE_NAME",
      "SESSION_LOG_EXPORT_ROUTE",
      "createPlugin",
      "downloadUrl",
      "en",
      "factory",
      "inject",
      "messageOf",
      "sessionLogZipFilename",
      "zh",
    ]);
  });

  test("CSS Header action: NGUYÊN VĂN từng byte, chỉ id chủ sở hữu đổi sang ta", async () => {
    const classNameOf = (harness: Harness): string =>
      String((menuOf(renderHeader(harness)).props["anchor"] as Element).props["className"]);
    const stock = await side("stock", classNameOf);
    const ours = await side("ours", classNameOf);
    expect(stock.styles).toHaveLength(1);
    expect(ours.styles).toHaveLength(1);
    const stockStyle = stock.styles[0] as StyleTag;
    const oursStyle = ours.styles[0] as StyleTag;
    // 19/10/2026: artifact không còn export HEADER_ACTION_CSS/HEADER_ACTION_CLASS — CSS lấy qua HÀNH VI
    // THẬT: apply(ctx) trên seam giả khiến harness ghi thẻ style; so nguyên văn với bản gốc.
    expect(oursStyle.textContent).toBe(stockStyle.textContent);
    expect(stockStyle.textContent).toContain(".nL4_yW_moreButton{width:28px;color:var(--dsw-alias-label-secondary);flex:none;padding:0}");
    expect(ours.value).toBe(stock.value);
    expect(ours.value).toBe("nL4_yW_moreButton");
    expect(oursStyle.textContent).toContain("." + ours.value + "{width:28px;color:var(--dsw-alias-label-secondary);flex:none;padding:0}");
    // Khác biệt DUY NHẤT được phép: id chủ sở hữu (dataset), không phải nội dung CSS.
    expect(stockStyle.dataset["pluginCss"]).toBe(STOCK_PACKAGE + "/HeaderAction.module.css");
    expect(oursStyle.dataset["pluginCss"]).toBe(OURS_PACKAGE + "/HeaderAction.module.css");
    expect(oursStyle.dataset["plugin"]).toBe(OURS_PACKAGE);
    expect(stockStyle.dataset["plugin"]).toBe(STOCK_PACKAGE);
  });
});

describe("N. A/B HÀNH VI nửa client trên seam giả", () => {
  test("apply: service cấp, nhãn hiệu ứng, locale, inject feedbackUi, sự kiện, slot — BẰNG bản gốc", async () => {
    const shape = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, (harness) => ({
        provided: [...harness.record.provided.keys()],
        effects: harness.record.effects.map((effect) => effect.label),
        locales: harness.record.locales.map((locale) => ({ namespace: locale.namespace, copy: locale.copy })),
        injectNames: harness.record.injectNames,
        listeners: [...harness.record.listeners.keys()],
        slotInjections: harness.record.slotInjections.map((slot) => slot.name),
        registrations: harness.record.registrations.map((registration) => ({
          name: registration.definition.name,
          id: registration.definition.id,
          locale: registration.definition.locale,
        })),
      }));
      return result.value;
    };
    const stockShape = await shape("stock");
    const oursShape = await shape("ours");
    expect(oursShape).toEqual(stockShape);
    expect(stockShape).toEqual({
      provided: ["sessionLogDownload"],
      effects: ["session-log-download: browser download lifecycle", "session-log-download: browser dictionaries"],
      locales: [
        {
          namespace: "session-log-download",
          copy: {
            zh: {
              "header.more": "更多操作",
              "menu.download": "下载 Session 日志",
              "menu.feedback": "反馈",
              "dialog.preparingTitle": "正在导出 Session",
              "dialog.preparingDescription": "正在准备包含当前 Session、子 Session 和附件的 ZIP 文件。",
              "dialog.successTitle": "Session 导出已开始下载",
              "dialog.successDescription": "浏览器正在下载 Session ZIP 文件。",
              "dialog.errorTitle": "Session 导出失败",
              "dialog.close": "关闭",
              "dialog.commandFailed": "无法启动 Session 导出。",
            },
            en: {
              "header.more": "More actions",
              "menu.download": "Download session log",
              "menu.feedback": "Feedback",
              "dialog.preparingTitle": "Exporting Session",
              "dialog.preparingDescription": "Preparing a ZIP containing this Session, its sub-Sessions, and attachments.",
              "dialog.successTitle": "Session download started",
              "dialog.successDescription": "The browser is downloading the Session ZIP.",
              "dialog.errorTitle": "Session export failed",
              "dialog.close": "Close",
              "dialog.commandFailed": "Could not start the Session export.",
            },
          },
        },
      ],
      injectNames: [["feedbackUi"]],
      listeners: ["command/executed"],
      slotInjections: ["conversation.session.header.utilities"],
      registrations: [
        {
          name: "conversation.session.header.utilities",
          id: "session-log-download",
          locale: "session-log-download",
        },
      ],
    });
  });

  test("tải THÀNH CÔNG: HEAD route + tên tệp an toàn + trạng thái downloading → success — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const gate = deferred<unknown>();
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(() => gate.promise);
        try {
          const pending = controller.download("a/b c");
          const midway = structuredClone(controller.store.getSnapshot());
          gate.resolve(successResponse());
          await pending;
          return {
            midway,
            final: controller.store.getSnapshot(),
            calls: network.calls.map((call) => ({
              input: call.input,
              method: call.method,
              hasSignal: call.signal instanceof AbortSignal,
            })),
            anchors: [...anchors].map((anchor) => ({
              href: anchor.href,
              download: anchor.download,
              clicks: anchor.clicks,
            })),
          };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    const value = stock as {
      midway: State;
      final: State;
      calls: { input: string; method: string | undefined; hasSignal: boolean }[];
      anchors: { href: string; download: string; clicks: number }[];
    };
    expect(value.midway.bySession["a/b c"]).toEqual({ open: true, status: "downloading", error: null });
    expect(value.final.bySession["a/b c"]).toEqual({ open: true, status: "success", error: null });
    expect(value.calls).toHaveLength(1);
    expect(value.calls[0]?.input).toBe("api/session.export?sessionId=a%2Fb+c&includeDescendants=true");
    expect(value.calls[0]?.method).toBe("HEAD");
    expect(value.calls[0]?.hasSignal).toBe(true);
    expect(value.anchors).toHaveLength(1);
    expect(value.anchors[0]?.href).toBe("api/session.export?sessionId=a%2Fb+c&includeDescendants=true");
    expect(value.anchors[0]?.download).toBe("dsh-session-a_b_c.zip");
    expect(value.anchors[0]?.clicks).toBe(1);
  });

  test("tải THẤT BẠI HTTP: thông điệp 'Export failed: HTTP …' BẰNG từng ký tự (có/không detail)", async () => {
    const scenario = async (kind: SideKind, status: number, detail: string): Promise<State> => {
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(async () => failureResponse(status, detail));
        try {
          await controller.download("s1");
          return controller.store.getSnapshot();
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stockDetail = await scenario("stock", 503, "busy");
    const oursDetail = await scenario("ours", 503, "busy");
    expect(oursDetail).toEqual(stockDetail);
    expect(stockDetail.bySession["s1"]).toEqual({ open: true, status: "error", error: "Export failed: HTTP 503 busy" });
    const stockEmpty = await scenario("stock", 500, "");
    const oursEmpty = await scenario("ours", 500, "");
    expect(oursEmpty).toEqual(stockEmpty);
    expect(stockEmpty.bySession["s1"]).toEqual({ open: true, status: "error", error: "Export failed: HTTP 500" });
  });

  test("KHỬ TRÙNG: hai lần gọi cùng Session chia sẻ MỘT lượt tải và MỘT lời hứa — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const gate = deferred<unknown>();
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(() => gate.promise);
        try {
          const first = controller.download("s1");
          const second = controller.download("s1");
          const same = first === second;
          const callsBefore = network.calls.length;
          gate.resolve(successResponse());
          await Promise.all([first, second]);
          return { same, callsBefore, callsAfter: network.calls.length, final: controller.store.getSnapshot() };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      same: true,
      callsBefore: 1,
      callsAfter: 1,
      final: { bySession: { s1: { open: true, status: "success", error: null } } },
    });
  });

  test("dismiss: đóng hộp thoại, KHÔNG huỷ lượt tải; success giữ open=false — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const gate = deferred<unknown>();
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(() => gate.promise);
        try {
          const pending = controller.download("s1");
          const before = structuredClone(controller.store.getSnapshot());
          controller.dismiss("s1");
          const dismissed = structuredClone(controller.store.getSnapshot());
          const signal = network.calls[0]?.signal;
          gate.resolve(successResponse());
          await pending;
          return {
            before,
            dismissed,
            aborted: signal?.aborted === true,
            final: controller.store.getSnapshot(),
          };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      before: { bySession: { s1: { open: true, status: "downloading", error: null } } },
      dismissed: { bySession: { s1: { open: false, status: "downloading", error: null } } },
      aborted: false,
      final: { bySession: { s1: { open: false, status: "success", error: null } } },
    });
  });

  test("dispose: huỷ MỌI lượt đang chạy, đạt tĩnh, không công bố lỗi; gọi muộn là no-op — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(
          (call) =>
            new Promise<never>((_resolve, reject) => {
              call.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
            }),
        );
        try {
          const first = controller.download("a");
          const second = controller.download("b");
          await controller.dispose();
          await Promise.allSettled([first, second]);
          const afterDispose = structuredClone(controller.store.getSnapshot());
          const callsBefore = network.calls.length;
          await controller.download("c");
          return {
            callsBefore,
            callsAfter: network.calls.length,
            aborted: network.calls.map((call) => call.signal?.aborted === true),
            afterDispose,
          };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      callsBefore: 2,
      callsAfter: 2,
      aborted: [true, true],
      afterDispose: {
        bySession: {
          a: { open: true, status: "downloading", error: null },
          b: { open: true, status: "downloading", error: null },
        },
      },
    });
  });

  test("signal HUỶ: lượt tải kết thúc im lặng, KHÔNG công bố error — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(
          (call) =>
            new Promise<never>((_resolve, reject) => {
              call.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
            }),
        );
        try {
          const pending = controller.download("s1");
          const signal = network.calls[0]?.signal;
          await controller.dispose();
          await pending;
          return { aborted: signal?.aborted === true, state: controller.store.getSnapshot() };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      aborted: true,
      state: { bySession: { s1: { open: true, status: "downloading", error: null } } },
    });
  });

  test("sự kiện command/executed: CHỈ 'export' + kind 'success' mới tải — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, async (harness) => {
        const listener = harness.record.listeners.get("command/executed") as
          | ((sessionId: string, commandName: string, outcome: { kind: string }) => void)
          | undefined;
        if (listener === undefined) throw new Error("apply không nghe command/executed");
        const network = installFetch(async () => successResponse());
        try {
          listener("s1", "other", { kind: "success" });
          listener("s2", "export", { kind: "error" });
          await settle();
          const afterIgnored = network.calls.length;
          listener("s3", "export", { kind: "success" });
          await settle();
          return { afterIgnored, afterExport: network.calls.length, state: controllerOf(harness).store.getSnapshot() };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      afterIgnored: 0,
      afterExport: 1,
      state: { bySession: { s3: { open: true, status: "success", error: null } } },
    });
  });

  test("feedbackUi: khả dụng false → true → false; menu có/không mục Feedback — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, (harness) => {
        const before = faceOf(harness).hooks.feedbackAvailable.getSnapshot();
        const menuBefore = menuOf(renderHeader(harness)).props["items"] as unknown[];
        harness.activateFeedback();
        const active = faceOf(harness).hooks.feedbackAvailable.getSnapshot();
        const menuActive = menuOf(renderHeader(harness)).props["items"] as unknown[];
        const cleanup = harness.record.effects.at(-1)?.cleanup;
        if (typeof cleanup !== "function") throw new Error("không có hàm dọn feedback");
        (cleanup as () => void)();
        const after = faceOf(harness).hooks.feedbackAvailable.getSnapshot();
        const menuAfter = menuOf(renderHeader(harness)).props["items"] as unknown[];
        return {
          before,
          active,
          after,
          effects: harness.record.effects.map((effect) => effect.label),
          menuBefore: canonical(menuBefore),
          menuActive: canonical(menuActive),
          menuAfter: canonical(menuAfter),
        };
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    const value = stock as { before: boolean; active: boolean; after: boolean; effects: (string | undefined)[] };
    expect([value.before, value.active, value.after]).toEqual([false, true, false]);
    expect(value.effects).toEqual([
      "session-log-download: browser download lifecycle",
      "session-log-download: browser dictionaries",
      "session-log-download: feedback availability",
    ]);
  });

  test("slot face: request tải, dismiss đóng, openFeedback gọi feedbackUi — BẰNG bản gốc", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, async (harness) => {
        const face = faceOf(harness);
        const opened: string[] = [];
        harness.record.services.set("feedbackUi", {
          openSession(sessionId: string): void {
            opened.push(sessionId);
          },
        });
        const network = installFetch(async () => successResponse());
        try {
          await face.request("s1");
          const afterRequest = controllerOf(harness).store.getSnapshot();
          face.dismiss("s1");
          const afterDismiss = controllerOf(harness).store.getSnapshot();
          face.openFeedback("s2");
          return {
            calls: network.calls.length,
            afterRequest,
            afterDismiss,
            opened,
            hookKeys: Object.keys(face.hooks).sort(),
          };
        } finally {
          network.restore();
        }
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    expect(stock).toEqual({
      calls: 1,
      afterRequest: { bySession: { s1: { open: true, status: "success", error: null } } },
      afterDismiss: { bySession: { s1: { open: false, status: "success", error: null } } },
      opened: ["s2"],
      hookKeys: ["feedbackAvailable", "sessionLogDownload"],
    });
  });

  test("Header action: cây component, menu, aria, lớp CSS, đóng/mở — BẰNG bản gốc ở 4 pha", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const phases = ["idle", "downloading", "success", "error"] as const;
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const trees: Record<string, unknown> = {};
        for (const phase of phases) {
          if (phase === "success") {
            const network = installFetch(async () => successResponse());
            try {
              await controller.download("s1");
            } finally {
              network.restore();
            }
          } else if (phase === "error") {
            const network = installFetch(async () => failureResponse(500, "boom"));
            try {
              await controller.download("s1");
            } finally {
              network.restore();
            }
          } else if (phase === "downloading") {
            const gate = deferred<unknown>();
            const network = installFetch(() => gate.promise);
            const pending = controller.download("s1");
            trees[phase] = canonical(renderHeader(harness));
            gate.resolve(successResponse());
            await pending;
            network.restore();
            continue;
          }
          trees[phase] = canonical(renderHeader(harness));
        }
        const first = renderHeader(harness);
        const menu = menuOf(first);
        const anchor = menu.props["anchor"] as Element;
        const onClick = anchor.props["onClick"] as () => void;
        onClick();
        const reopened = menuOf(renderHeader(harness));
        return {
          trees,
          firstOpen: menu.props["open"],
          secondOpen: reopened.props["open"],
          className: anchor.props["className"],
          ariaLabel: anchor.props["aria-label"],
          ariaHasPopup: anchor.props["aria-haspopup"],
          ariaBusy: anchor.props["aria-busy"],
          itemIds: (reopened.props["items"] as { id: string }[]).map((item) => item.id),
        };
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    const value = stock as {
      firstOpen: boolean;
      secondOpen: boolean;
      className: string;
      ariaLabel: string;
      ariaHasPopup: string;
      ariaBusy: boolean;
      itemIds: string[];
    };
    expect(value.firstOpen).toBe(false);
    expect(value.secondOpen).toBe(true);
    expect(value.className).toBe("nL4_yW_moreButton");
    expect(value.ariaLabel).toBe("t:header.more");
    expect(value.ariaHasPopup).toBe("menu");
    expect(value.ariaBusy).toBe(false);
    expect(value.itemIds).toEqual(["download"]);
  });

  test("Dialog: tiêu đề/mô tả/nhãn đóng/footer BẰNG bản gốc ở downloading · success · error · lỗi rỗng", async () => {
    const scenario = async (kind: SideKind): Promise<unknown> => {
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const dialogs: Record<string, unknown> = {};
        const capture = (): Element => renderDialog(renderHeader(harness), harness);
        dialogs["idle"] = canonical(capture());
        const gate = deferred<unknown>();
        const downloadingNetwork = installFetch(() => gate.promise);
        const pending = controller.download("s1");
        dialogs["downloading"] = canonical(capture());
        gate.resolve(successResponse());
        await pending;
        downloadingNetwork.restore();
        const successNetwork = installFetch(async () => successResponse());
        await controller.download("s1");
        successNetwork.restore();
        dialogs["success"] = canonical(capture());
        const errorNetwork = installFetch(async () => failureResponse(500, "boom"));
        await controller.download("s1");
        errorNetwork.restore();
        dialogs["error"] = canonical(capture());
        const emptyNetwork = installFetch(async () => {
          throw new Error("");
        });
        await controller.download("s1");
        emptyNetwork.restore();
        dialogs["empty"] = canonical(capture());
        return dialogs;
      });
      return result.value;
    };
    const stock = await scenario("stock");
    const ours = await scenario("ours");
    expect(ours).toEqual(stock);
    const value = stock as Record<string, Element>;
    expect(value["downloading"]?.props["title"]).toBe("t:dialog.preparingTitle");
    expect(value["downloading"]?.props["description"]).toBe("t:dialog.preparingDescription");
    expect(value["downloading"]?.props["closeLabel"]).toBe("t:dialog.close");
    expect(value["downloading"]?.props["open"]).toBe(true);
    expect(value["success"]?.props["title"]).toBe("t:dialog.successTitle");
    expect(value["success"]?.props["description"]).toBe("t:dialog.successDescription");
    expect(value["error"]?.props["title"]).toBe("t:dialog.errorTitle");
    expect(value["error"]?.props["description"]).toBe("Export failed: HTTP 500 boom");
    expect(value["empty"]?.props["description"]).toBe("t:dialog.commandFailed");
  });

  test("sessionLogZipFilename: id nguy hiểm → tên tệp an toàn, BẰNG bản gốc", async () => {
    const risky = ["plain", "../a b", "a/b?c#d", "tiếng Việt", ""];
    // 19/10/2026: artifact không còn export sessionLogZipFilename — đo qua HÀNH VI TẢI: mỗi id nguy hiểm
    // chạy một lượt tải trên seam giả, rồi đọc tên tệp anchor mà harness ghi lại.
    const downloads = async (kind: SideKind): Promise<string[]> => {
      const result = await side(kind, async (harness) => {
        const controller = controllerOf(harness);
        const network = installFetch(async () => successResponse());
        try {
          for (const sessionId of risky) await controller.download(sessionId);
        } finally {
          network.restore();
        }
      });
      return result.anchors.map((anchor) => anchor.download);
    };
    const ours = await downloads("ours");
    const stock = await downloads("stock");
    expect(ours).toEqual(stock);
    expect(ours).toHaveLength(risky.length);
    expect(ours).toEqual(risky.map((value) => "dsh-session-" + value.replace(/[^A-Za-z0-9_-]/g, "_") + ".zip"));
    expect(ours[1]).toBe("dsh-session-___a_b.zip");
    expect(ours[3]).toBe("dsh-session-ti_ng_Vi_t.zip");
    for (const filename of ours) expect(filename.startsWith("dsh-session-")).toBe(true);
  });
});
