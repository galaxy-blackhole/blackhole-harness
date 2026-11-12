/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-client-ui-secret-mask: so từng kết quả match với
 *      chính bundle gốc, cộng các ca hành vi (từ điển, plugin, hai id module, hình dạng bundle)
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { CREDENTIAL_FORMATS } from "../../packages/client/ui-secret-mask/src/credential-formats.ts";
import { NS, en, zh } from "../../packages/client/ui-secret-mask/src/locales.ts";
import { createPlugin } from "../../packages/client/ui-secret-mask/src/plugin.ts";
import { createSecretRule } from "../../packages/client/ui-secret-mask/src/secret-rule.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/**
 * Nạp một file .js đã build mà không cần khai báo kiểu (specifier là biến nên tsc không kiểm).
 * Nhận: đường dẫn tuyệt đối tới file .js.
 * Trả: bảng export của module đó.
 */
async function loadBuilt(path: string): Promise<Record<string, unknown>> {
  return (await import(path)) as Record<string, unknown>;
}

/** Một node credential đã nhận ra. */
interface NodeLike {
  /** Id luật. */
  id: string;
  /** Vị trí bắt đầu. */
  start: number;
  /** Vị trí kết thúc. */
  end: number;
  /** Dữ liệu node. */
  data: { masked: string };
}

/** Luật UserText tối thiểu mà cả hai bên cùng có. */
interface RuleLike {
  /** Id luật. */
  id: string;
  /** Thứ tự ưu tiên. */
  order: number;
  /** Tìm credential tại hoặc sau một vị trí. */
  match(text: string, from: number): NodeLike | undefined;
}

/** require giả: chỉ cấp react và react/jsx-runtime. */
function requireStub(id: string): unknown {
  if (id === "react/jsx-runtime") {
    return { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) };
  }
  if (id === "react") {
    return { useState: <T,>(initial?: T): [T | undefined, (value: T | undefined) => void] => [initial, () => undefined] };
  }
  throw new Error("module lạ: " + id);
}

/** Context giả: ghi lại luật mà plugin đăng ký. */
function fakeContext(sink: RuleLike[]): unknown {
  return {
    effect: (callback: () => unknown): unknown => callback(),
    locale: { register: (): undefined => undefined },
    uiConversation: { userText: { register: (rule: RuleLike): void => { sink.push(rule); } } },
    slots: { inject: (_slot: string, register: () => unknown): unknown => register(), register: (): undefined => undefined },
  };
}

/**
 * Nạp bundle gốc trong window giả rồi lấy ra luật "secret" của nó.
 * Nhận: không.
 * Trả: luật của bản gốc để đối chứng.
 */
async function stockRule(): Promise<RuleLike> {
  const path = join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-secret-mask/lib/client.js");
  const code = await Bun.file(path).text();
  let factory: ((require: (id: string) => unknown) => { apply(ctx: unknown): void }) | undefined;
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: { factory: typeof factory }): void => {
        factory = registration.factory;
      },
    },
  };
  new Function("window", code)(fakeWindow);
  if (factory === undefined) throw new Error("bundle gốc không đăng ký factory nào");
  const sink: RuleLike[] = [];
  factory(requireStub).apply(fakeContext(sink));
  const rule = sink[0];
  if (rule === undefined) throw new Error("bundle gốc không đăng ký luật nào");
  return rule;
}

/**
 * Lần theo toàn bộ node của một luật trên một chuỗi, đúng như renderer làm (truy vấn tiếp từ node.end).
 * Nhận: luật và chuỗi.
 * Trả: mảng mô tả "start:end:masked" theo thứ tự.
 */
function walk(rule: RuleLike, text: string): string[] {
  const out: string[] = [];
  let from = 0;
  let guard = 0;
  for (;;) {
    if (guard++ > 500) throw new Error("luật không tiến: " + text.slice(0, 40));
    const node = rule.match(text, from);
    if (node === undefined) break;
    out.push(node.start + ":" + node.end + ":" + node.data.masked);
    if (node.end <= from) break;
    from = node.end;
    if (from >= text.length) break;
  }
  return out;
}

/**
 * Bộ sinh số giả ngẫu nhiên có hạt để corpus chạy lại giống nhau mọi lần.
 * Nhận: hạt.
 * Trả: hàm trả số thực trong [0,1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dựng corpus: ca biên viết tay + sinh ngẫu nhiên quanh mọi chữ mở đầu của định dạng.
 * Nhận: không.
 * Trả: danh sách chuỗi cần đối chứng.
 */
function corpus(): string[] {
  const out: string[] = [
    "",
    " ",
    "không có gì bí mật ở đây",
    "\n\r\t",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END PRIVATE KEY-----\n",
    "-----BEGIN PRIVATE KEY-----\nMIIEowIBAAKCAQEA",
    "-----BEGIN PRIVATE KEY-----\r\nMIIEowIBAAKCAQEA\r\n-----END PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY----- một dòng -----END PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----",
    "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAA\n-----END OPENSSH PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY-----\nA\n-----END PRIVATE KEY-----\n-----BEGIN PRIVATE KEY-----\nB\n-----END PRIVATE KEY-----",
    "https://user:s3cr3tPass@example.com/path?q=1",
    "http://u:p@h",
    "mongodb://admin:hunter2@db.internal:27017/x",
    "ftp://user:pass@host/",
    "://user:pass@host",
    "https://user@example.com",
    "https://user:@example.com",
    "https://:pass@example.com",
    "https://user:pass@",
    "a://user:pass@host b://user2:pass2@host2",
    "https://host:8080/path",
    "HTTPS://user:pass@host",
    "x " + "https://" + "u".repeat(300) + ":p@h",
    "sk-abcdefghijklmnopqrstuvwxyz0123456789",
    "sk-" + "A".repeat(40),
    "sk-" + "a".repeat(19),
    "sk-abcdefghij0123456789",
    "sk-0987654321abcdefghij",
    "AIza" + "A".repeat(35),
    "AIza" + "A".repeat(34),
    "ghp_" + "a".repeat(36),
    "gho_" + "a".repeat(36),
    "ghu_" + "a".repeat(36),
    "ghs_" + "a".repeat(36),
    "ghr_" + "a".repeat(36),
    "github_pat_" + "a".repeat(22),
    "glpat-abcdefghij1234567890",
    "npm_" + "a".repeat(36),
    "hf_" + "a".repeat(30),
    "AKIAIOSFODNN7EXAMPLE",
    "ASIAIOSFODNN7EXAMPLE",
    "LTAI5tAbCdEfGhIjKlMn",
    "AKIDabcdefghijklmnopqrstuvwxyz01",
    "xoxb-1234567890-abcdefghij",
    "xoxp-1234567890123-abcdefghij",
    "sk_live_abcdefghijklmnop",
    "sk_test_abcdefghijklmnop",
    "rk_live_abcdefghijklmnop",
    "rk_test_abcdefghijklmnop",
    "whsec_" + "a".repeat(24),
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop",
    "eyJhbGciOiJIUzI1NiJ9.eyJzIjoiMSJ9.abcdefgh",
    "hai khoá: sk-" + "A".repeat(24) + " và ghp_" + "b".repeat(36),
    "khoá trong code: \nconst k = \"sk-" + "A".repeat(24) + "\";\n",
    "emoji 😀 sk-" + "A".repeat(24) + " emoji 😀",
    "dòng dài:\n" + "sk-" + "A".repeat(24) + "\ntiếp",
    "sk-" + "A".repeat(5000),
    "https://user:" + "p".repeat(5000) + "@host",
    "\u0000sk-" + "A".repeat(24),
    "sk-",
    "ghp_",
    "eyJ",
    "-----BEGIN ",
    "://",
    "prefixsk-" + "A".repeat(24),
    "xsk-" + "A".repeat(24),
    "AKIAIOSFODNN7EXAMPLEZ",
  ];
  const random = mulberry32(20261017);
  const alphabet = [
    "s", "k", "-", "_", "A", "Z", "a", "9", "0", ":", "/", "@", ".", " ", "\n", "e", "y", "J",
    "-----BEGIN ", "PRIVATE KEY-----", "-----END ", "://", "ghp_", "AIza", "sk_live_", "eyJ",
  ];
  for (let index = 0; index < 4000; index++) {
    const pieces = 1 + Math.floor(random() * 8);
    let text = "";
    for (let piece = 0; piece < pieces; piece++) text += alphabet[Math.floor(random() * alphabet.length)];
    out.push(text);
  }
  for (const format of CREDENTIAL_FORMATS) {
    const filler = "A".repeat(Math.max(format.min, 4) + 2);
    for (const wrap of ["", " ", "\n", "(", "x"]) {
      out.push(wrap + format.literal + filler + wrap);
      out.push(wrap + format.literal + "1".repeat(Math.max(format.min, 4)) + wrap);
    }
  }
  return out;
}

describe("row ui-secret-mask — đối chứng với bản gốc", () => {
  test("mọi chuỗi trong corpus cho CÙNG kết quả match (start · end · mặt nạ) như bundle gốc", async () => {
    const stock = await stockRule();
    const mine = createSecretRule() as RuleLike;
    expect(stock.id).toBe("secret");
    expect(mine.id).toBe("secret");
    expect(mine.order).toBe(stock.order);
    const texts = corpus();
    let compared = 0;
    for (const text of texts) {
      const expected = walk(stock, text);
      const actual = walk(mine, text);
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(
          "lệch ở chuỗi " + JSON.stringify(text.slice(0, 80)) + "\n  gốc : " + JSON.stringify(expected) + "\n  ta  : " + JSON.stringify(actual),
        );
      }
      compared++;
    }
    expect(compared).toBe(texts.length);
    expect(compared).toBeGreaterThan(4000);
  });

  test("truy vấn từ vị trí giữa chuỗi cũng khớp (đường đi addressBefore của renderer)", async () => {
    const stock = await stockRule();
    const mine = createSecretRule() as RuleLike;
    const texts = [
      "https://user:s3cr3tPass@example.com và sk-" + "A".repeat(24),
      "a https://u:p@h b https://u2:p2@h2 c",
      "-----BEGIN PRIVATE KEY-----\nA\n-----END PRIVATE KEY----- sk-" + "A".repeat(24),
    ];
    for (const text of texts) {
      for (let from = 0; from <= text.length; from++) {
        const expected = stock.match(text, from);
        const actual = mine.match(text, from);
        const plain = (node: NodeLike | undefined): string => (node === undefined ? "none" : node.start + ":" + node.end + ":" + node.data.masked);
        if (plain(expected) !== plain(actual)) {
          throw new Error("lệch tại from=" + String(from) + " của " + JSON.stringify(text.slice(0, 60)) + "\n  gốc: " + plain(expected) + "\n  ta : " + plain(actual));
        }
      }
    }
  });
});

describe("row ui-secret-mask — hành vi plugin và thẻ render", () => {
  test("apply đăng ký đúng từ điển, đúng luật và đúng occupant slot", () => {
    const locales: { namespace: string; copy: Record<string, Record<string, string>> }[] = [];
    const rules: RuleLike[] = [];
    const slots: { definition: Record<string, unknown>; component: unknown }[] = [];
    let injectedSlot = "";
    const ctx = {
      effect: (callback: () => unknown): unknown => callback(),
      locale: {
        register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
          locales.push({ namespace, copy });
        },
      },
      uiConversation: { userText: { register: (rule: RuleLike): void => { rules.push(rule); } } },
      slots: {
        inject: (slot: string, register: () => unknown): void => {
          injectedSlot = slot;
          register();
        },
        register: (definition: Record<string, unknown>, component: unknown): void => {
          slots.push({ definition, component });
        },
      },
    };
    const plugin = createPlugin(requireStub);
    expect(plugin.inject).toEqual(["locale", "slots", "uiConversation"]);
    plugin.apply(ctx as never);
    expect(locales.map((entry) => ({ namespace: entry.namespace, copy: Object.fromEntries(Object.entries(entry.copy).filter(([lang]) => lang !== "vi")) }))).toEqual([{ namespace: NS, copy: { zh, en } }]);
    // 18/10/2026 — thêm tiếng Việt: 2 khoá, đúng namespace.
    expect(Object.keys(viDictionary(locales) ?? {}).length).toBe(2);
    expect(rules.length).toBe(1);
    expect(rules[0]?.id).toBe("secret");
    expect(rules[0]?.order).toBe(0);
    expect(injectedSlot).toBe("conversation.user.text.node");
    expect(slots.length).toBe(1);
    expect(slots[0]?.definition).toEqual({
      name: "conversation.user.text.node",
      key: "secret",
      priority: 100,
      locale: NS,
    });
    expect(typeof slots[0]?.component).toBe("function");
  });

  test("thẻ render: chữ đã che được chia thành run dấu, nút hiện/che đổi nhãn theo từ điển", () => {
    const { createSecretText } = require("../../packages/client/ui-secret-mask/src/SecretText.ts") as {
      createSecretText: (runtime: unknown, react: unknown) => (props: Record<string, unknown>) => unknown;
    };
    const seen: { type: unknown; props: Record<string, unknown> }[] = [];
    const runtime = {
      jsx: (type: unknown, props: Record<string, unknown>) => {
        seen.push({ type, props });
        return { type, props };
      },
      jsxs: (type: unknown, props: Record<string, unknown>) => {
        seen.push({ type, props });
        return { type, props };
      },
    };
    let setter: ((value: string | undefined) => void) | undefined = () => undefined;
    const react = {
      useState: (): [string | undefined, (value: string | undefined) => void] => [undefined, setter as (value: string | undefined) => void],
    };
    const SecretText = createSecretText(runtime, react);
    const node = { id: "secret", start: 0, end: 12, data: { masked: "sk-ABCDE****" } };
    const tree = SecretText({
      node,
      raw: "sk-ABCDEfghij",
      interactive: true,
      t: (key: string) => (key === "secret.hide" ? "Hide secret" : "Show secret"),
    }) as { props: Record<string, unknown> };
    expect(tree.props["data-secret"]).toBe("");
    const toggle = seen.find((entry) => entry.type === "button");
    expect(toggle?.props["aria-label"]).toBe("Show secret");
    expect(toggle?.props["aria-pressed"]).toBe(false);
    expect(typeof toggle?.props.onClick).toBe("function");
    // Run dấu phải được tách riêng khỏi chữ giữ nguyên, giữ nguyên ký tự để sao chép được.
    const parts = seen.filter((entry) => entry.type === "span" && typeof entry.props.children === "string").map((entry) => entry.props.children);
    expect(parts).toContain("sk-ABCDE");
    expect(parts).toContain("****");
    expect(setter).toBeDefined();
    // Không cho tương tác thì KHÔNG có nút.
    seen.length = 0;
    SecretText({ node, raw: "sk-ABCDEfghij", interactive: false, t: () => "x" });
    expect(seen.some((entry) => entry.type === "button")).toBe(false);
  });

  test("nửa host của ta export ĐÚNG tập export của bản gốc (apply)", async () => {
    const stock = await loadBuilt(join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-secret-mask/lib/index.js"));
    const stockExports = Object.keys(stock).filter((key) => key !== "default").sort();
    expect(stockExports).toEqual(["apply"]);
    const ours = await loadBuilt(join(import.meta.dir, "../../packages/client/ui-secret-mask/lib/index.js"));
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(stockExports);
    expect(typeof ours.apply).toBe("function");
  });

  test("nửa client đã build là SCRIPT CLASSIC đăng ký đúng hai id, không có cú pháp ESM", async () => {
    const code = await Bun.file(
      join(import.meta.dir, "../../packages/client/ui-secret-mask/lib/client.js"),
    ).text();
    const ids: string[] = [];
    const fakeWindow = { __ModuleLoader__: { load: (registration: { id: string }): void => { ids.push(registration.id); } } };
    new Function("window", code)(fakeWindow);
    expect(ids.length).toBe(1);   // LUAT 17/10/2026: bundle chi tu khai MOT id; id goc o gbh.row.aliases
    expect(new Set(ids)).toEqual(
      new Set(["@galaxy-blackhole/gbh-client-ui-secret-mask"]),
    );
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("từ điển en/zh cùng tập khoá và đúng nguyên văn", () => {
    expect(Object.keys(zh).sort()).toEqual(["secret.hide", "secret.reveal"]);
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(en["secret.reveal"]).toBe("Show secret");
    expect(en["secret.hide"]).toBe("Hide secret");
    expect(NS).toBe("secretMask");
  });
});
