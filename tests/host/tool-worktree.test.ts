/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-tool-worktree: đo trên ARTIFACT đã build,
 *      và so từng hành vi với CHÍNH bundle gốc của DSH (định nghĩa tool · uỷ quyền seam · đường lỗi · C6)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/tool-worktree/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "tool-worktree");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-tool-worktree");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để packages external phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Artifact của TA, build ngay khi nạp test (mọi phép đo đều chạy trên artifact). */
const ARTIFACT_FILE: string = await buildPackage(OUT);
/** Module artifact của ta. */
const Ours: any = await import(ARTIFACT_FILE);
/** Module bundle GỐC. */
const Stock: any = await import(STOCK);

/** Một lời gọi seam worktrees đã ghi vết. */
interface SeamCall {
  /** Agent được chuyển nguyên văn. */
  readonly agent: unknown;
  /** Yêu cầu được chuyển nguyên văn (cùng THAM CHIẾU với args của lượt gọi). */
  readonly request: unknown;
  /** Tín hiệu huỷ được chuyển nguyên văn. */
  readonly signal: unknown;
}

/** Seam worktrees giả có ghi vết — ĐÚNG một phương thức mà bundle gốc gọi. */
interface FakeSeam {
  /** Vết lời gọi theo thứ tự. */
  readonly calls: SeamCall[];
  /** Giá trị trả về của mọi lượt gọi. */
  readonly result: Record<string, string>;
  /** Tạo worktree (trả hằng số hoặc ném theo cấu hình). */
  create(agent: unknown, request?: unknown, signal?: AbortSignal): Promise<Record<string, string>>;
}

/**
 * Dựng một seam giả.
 * Nhận: tuỳ chọn ném lỗi (mô phỏng seam thật từ chối) và giá trị trả về riêng.
 * Trả: seam có vết lời gọi rỗng.
 */
function fakeSeam(options: { reject?: string; branch?: string } = {}): FakeSeam {
  const calls: SeamCall[] = [];
  const result = {
    path: "/tmp/du-an/.worktrees/" + (options.branch ?? "nhanh-moi"),
    branch: options.branch ?? "nhanh-moi",
    baseCommit: "0123456789abcdef0123456789abcdef01234567",
    repositoryRoot: "/tmp/du-an",
  };
  return {
    calls,
    result,
    async create(agent, request, signal) {
      calls.push({ agent, request, signal });
      if (options.reject !== undefined) throw new Error(options.reject);
      return result;
    },
  };
}

/**
 * Dựng context giả ĐÚNG hình dạng mà hai bundle cần: sổ tool, seam worktrees, logger.
 * Bundle gốc đọc ctx.worktrees; bản của ta đọc ctx.get("worktrees") — cả hai cùng một seam.
 * Nhận: seam worktree.
 * Trả: context (đã ép kiểu, cho phép GÁN LẠI ctx.worktrees) và danh sách định nghĩa tool đã đăng ký.
 */
function fakeContext(seam: FakeSeam): { ctx: any; registered: any[] } {
  const registered: any[] = [];
  const ctx: any = {
    tools: {
      register(definition: any) {
        registered.push(definition);
        return () => {};
      },
      get() {
        return undefined;
      },
    },
    worktrees: seam,
    get(name: string) {
      // 08/11/2026 (PHASE B): gói đọc sổ tool qua SEAM CẤU TRÚC `ctx.get("tools")` (ADR 000d) ⇒
      // context giả phải trả seam này, đúng công thức docs/tien-do/PHASE-B-12-GOI.md bước 5.
      if (name === "tools") return ctx.tools;
      return name === "worktrees" ? ctx.worktrees : undefined;
    },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  };
  return { ctx, registered };
}

/**
 * Chạy apply của một bundle trên một context giả.
 * Nhận: module plugin (ta hoặc gốc) và seam worktree.
 * Trả: context đã dựng (để đổi seam về sau) và các định nghĩa tool đã đăng ký, theo thứ tự.
 */
function boot(plugin: any, seam: FakeSeam): { ctx: any; registered: any[] } {
  const built = fakeContext(seam);
  plugin.apply(built.ctx);
  return built;
}

/**
 * Dựng ngữ cảnh thực thi tối thiểu (đúng các trường mà execute đọc).
 * Nhận: agent tuỳ chọn và tín hiệu huỷ.
 * Trả: đối tượng exec.
 */
function makeExec(agent?: unknown, signal: AbortSignal = new AbortController().signal): any {
  return {
    callId: "call-1",
    name: "create_worktree",
    arguments: {},
    agent,
    signal,
    deferContext() {},
    concludeTurn() {},
  };
}

/**
 * Bắt thông điệp lỗi của một lượt gọi (không để test treo khi lời gọi không ném).
 * Nhận: hàm có thể ném.
 * Trả: thông điệp, hoặc chuỗi đánh dấu khi không ném.
 */
async function messageOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Bắt tên lớp lỗi của một lượt gọi.
 * Nhận: hàm có thể ném.
 * Trả: tên lớp lỗi, hoặc chuỗi đánh dấu khi không ném.
 */
async function nameOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    return (error as Error).name;
  }
}

/**
 * Phần tử có trong danh sách peer khai báo mà KHÔNG có trong peerDependencies.
 * So PHẦN TỬ, không so số lượng (bài học 18/10/2026: so len() cho ra verdict rỗng).
 * Nhận: danh sách peer và danh sách tên peerDependencies.
 * Trả: các tên thiếu, theo thứ tự khai báo.
 */
function missingPeers(peers: readonly string[], peerDependencies: readonly string[]): string[] {
  const declared = new Set(peerDependencies);
  return peers.filter((peer) => !declared.has(peer));
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row tool-worktree — artifact và bề mặt", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module (row MỘT MẶT)", async () => {
    const code = await readFile(ARTIFACT_FILE, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    // Row một mặt: package gốc KHÔNG có lib/client.js, nên không có nửa browser để đối chiếu.
    expect(await Bun.file(join(STOCK_PKG, "lib", "client.js")).exists()).toBe(false);
    expect(Object.keys(Ours).sort()).toEqual(Object.keys(Stock).sort());
    expect(Object.keys(Ours).sort()).toEqual(["apply", "inject", "name"]);
    expect(Ours.name).toBe(Stock.name);
    expect(Ours.name).toBe("tool-worktree");
    expect([...Ours.inject]).toEqual([...Stock.inject]);
    expect([...Ours.inject]).toEqual(["tools", "worktrees"]);
    expect(typeof Ours.apply).toBe("function");
    const ourNames = boot(Ours, fakeSeam()).registered.map((definition) => definition.name);
    const stockNames = boot(Stock, fakeSeam()).registered.map((definition) => definition.name);
    expect(ourNames).toEqual(stockNames);
    expect(ourNames).toEqual(["create_worktree"]);
  });

  test("luật 000e: locale/{en,zh}.json chép BYTE-FOR-BYTE từ gói gốc và có trong exports", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.exports["./locale/*.json"]).toBe("./locale/*.json");
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", name));
      const stock = await readFile(join(STOCK_PKG, "locale", name));
      expect(stock.length).toBeGreaterThan(0);
      expect(ours.equals(stock)).toBe(true);
    }
  });
});

describe("row tool-worktree — đối chứng với chính bundle gốc", () => {
  test("định nghĩa tool: tên · mô tả · schema tham số · schema kết quả · render KHỚP gốc", () => {
    const ourTool = boot(Ours, fakeSeam()).registered[0];
    const stockTool = boot(Stock, fakeSeam()).registered[0];
    expect(ourTool).toBeDefined();
    expect(stockTool).toBeDefined();
    expect(ourTool.name).toBe(stockTool.name);
    expect(ourTool.name).toBe("create_worktree");
    expect(ourTool.description).toBe(stockTool.description);
    expect(JSON.stringify(ourTool.parameters)).toBe(JSON.stringify(stockTool.parameters));
    expect(JSON.stringify(ourTool.output.schema)).toBe(JSON.stringify(stockTool.output.schema));
    expect(Object.keys(ourTool).sort()).toEqual(Object.keys(stockTool).sort());
    expect(Object.keys(ourTool)).toContain("presentCall");
    expect(Object.keys(ourTool.output).sort()).toEqual(Object.keys(stockTool.output).sort());
    // Hai tham số name/from đều KHÔNG bắt buộc; mô tả nguyên văn.
    expect(JSON.stringify(ourTool.parameters.required ?? [])).toBe(JSON.stringify(stockTool.parameters.required ?? []));
    expect(ourTool.parameters.properties.name.type).toBe("string");
    expect(ourTool.parameters.properties.from.type).toBe("string");
    expect(ourTool.parameters.properties.name.description).toBe(stockTool.parameters.properties.name.description);
    expect(ourTool.parameters.properties.from.description).toBe(stockTool.parameters.properties.from.description);
    // Bốn trường kết quả đều bắt buộc, additionalProperties: false.
    const outSchema = ourTool.output.schema;
    expect(outSchema.type).toBe("object");
    expect(outSchema.additionalProperties).toBe(false);
    expect(Object.keys(outSchema.properties).sort()).toEqual(["baseCommit", "branch", "path", "repositoryRoot"]);
    expect(JSON.stringify(outSchema.required ?? [])).toBe(JSON.stringify(stockTool.output.schema.required ?? []));
    const value = fakeSeam().result;
    const rendered = ourTool.output.render({}, value);
    expect(rendered).toEqual(stockTool.output.render({}, value));
    expect(rendered).toEqual([{ type: "text", text: JSON.stringify(value) }]);
  });

  test("presentCall: cùng hình dạng card generic · title create_worktree · rawInput = args", () => {
    const ourTool = boot(Ours, fakeSeam()).registered[0];
    const stockTool = boot(Stock, fakeSeam()).registered[0];
    const args = { name: "feat-x", from: "v1.2.3" };
    const ours = ourTool.presentCall(args);
    const stock = stockTool.presentCall(args);
    expect(ours).toEqual(stock);
    expect(Object.keys(ours).sort()).toEqual(["card", "rawInput", "title"]);
    expect(ours.card).toBe("generic");
    expect(ours.title).toBe("create_worktree");
    expect(ours.rawInput).toBe(args);
    // Tham số SAI KIỂU ⇒ cả hai trả undefined (validate của defineTool chặn trước khi gọi).
    expect(ourTool.presentCall({ name: 42 })).toBe(stockTool.presentCall({ name: 42 }));
    expect(ourTool.presentCall({ name: 42 })).toBeUndefined();
  });

  test("execute: uỷ quyền seam với CÙNG agent · CÙNG args (tham chiếu) · CÙNG tín hiệu", async () => {
    const agent = { session: { id: "w1" } };
    const signal = new AbortController().signal;
    const ourSeam = fakeSeam();
    const stockSeam = fakeSeam();
    const ourTool = boot(Ours, ourSeam).registered[0];
    const stockTool = boot(Stock, stockSeam).registered[0];
    const cases = [{}, { name: "feat-x" }, { from: "v1.2.3" }, { name: "feat-x", from: "HEAD~2" }];
    for (const args of cases) {
      const ourValue = await ourTool.execute(args, makeExec(agent, signal));
      const stockValue = await stockTool.execute(args, makeExec(agent, signal));
      expect(JSON.stringify(ourValue)).toBe(JSON.stringify(stockValue));
      expect(ourValue).toEqual(ourSeam.result);
      const ourCall = ourSeam.calls[ourSeam.calls.length - 1];
      const stockCall = stockSeam.calls[stockSeam.calls.length - 1];
      // Chuyển NGUYÊN VĂN: cùng đối tượng agent, cùng THAM CHIẾU args, cùng tín hiệu của lượt gọi.
      expect(ourCall?.agent).toBe(agent);
      expect(ourCall?.request).toBe(args);
      expect(ourCall?.signal).toBe(signal);
      expect(stockCall?.agent).toBe(agent);
      expect(stockCall?.request).toBe(args);
      expect(stockCall?.signal).toBe(signal);
    }
    expect(ourSeam.calls.length).toBe(cases.length);
    expect(stockSeam.calls.length).toBe(cases.length);
    expect(JSON.stringify(ourSeam.calls.map((call) => call.request))).toBe(JSON.stringify(stockSeam.calls.map((call) => call.request)));
  });

  test("seam đọc ở THỜI ĐIỂM GỌI: thay seam sau apply thì cả hai dùng seam MỚI", async () => {
    const agent = { session: { id: "w1" } };
    const first = fakeSeam({ branch: "cu" });
    const second = fakeSeam({ branch: "moi" });
    const ours = boot(Ours, first);
    const stock = boot(Stock, first);
    const ourTool = ours.registered[0];
    const stockTool = stock.registered[0];
    await ourTool.execute({}, makeExec(agent));
    await stockTool.execute({}, makeExec(agent));
    expect(first.calls.length).toBe(2);
    // Đổi seam trên MỖI context (bản gốc đọc ctx.worktrees, ta đọc ctx.get("worktrees")).
    ours.ctx.worktrees = second;
    stock.ctx.worktrees = second;
    const ourValue = await ourTool.execute({}, makeExec(agent));
    const stockValue = await stockTool.execute({}, makeExec(agent));
    expect(second.calls.length).toBe(2);
    expect(first.calls.length).toBe(2);
    expect(ourValue).toEqual(stockValue);
    expect(ourValue.branch).toBe("moi");
  });

  test("đường lỗi: thiếu agent · tham số sai · seam ném — KHỚP gốc, không treo", async () => {
    const agent = { session: { id: "w1" } };
    const cleanOur = fakeSeam();
    const cleanStock = fakeSeam();
    const ourTool = boot(Ours, cleanOur).registered[0];
    const stockTool = boot(Stock, cleanStock).registered[0];
    // (a) thiếu agent: ném CÙNG thông điệp, và KHÔNG chạm seam.
    const ourNoAgent = await messageOf(() => ourTool.execute({}, makeExec(undefined)));
    const stockNoAgent = await messageOf(() => stockTool.execute({}, makeExec(undefined)));
    expect(ourNoAgent).toBe(stockNoAgent);
    expect(ourNoAgent).toBe("create_worktree requires a calling agent");
    expect(cleanOur.calls.length).toBe(0);
    // (b) tham số sai kiểu: cùng lớp lỗi, cùng thông điệp (validate của defineTool), không chạm seam.
    const ourBadType = await messageOf(() => ourTool.execute({ name: 42 }, makeExec(agent)));
    const stockBadType = await messageOf(() => stockTool.execute({ name: 42 }, makeExec(agent)));
    expect(ourBadType).toBe(stockBadType);
    expect(ourBadType).not.toBe("(khong nem)");
    expect(await nameOf(() => ourTool.execute({ name: 42 }, makeExec(agent)))).toBe(
      await nameOf(() => stockTool.execute({ name: 42 }, makeExec(agent))),
    );
    expect(cleanOur.calls.length).toBe(0);
    // (c) tham số LẠ: cùng số phận với gốc (additionalProperties của schema do defineTool quyết).
    const ourExtra = await messageOf(() => ourTool.execute({ la: "x" }, makeExec(agent)));
    const stockExtra = await messageOf(() => stockTool.execute({ la: "x" }, makeExec(agent)));
    expect(ourExtra).toBe(stockExtra);
    // (d) seam NÉM: lỗi đi ra nguyên văn, đúng MỘT lời gọi, không treo.
    const failOur = fakeSeam({ reject: "nhanh da ton tai" });
    const failStock = fakeSeam({ reject: "nhanh da ton tai" });
    const ourFail = await messageOf(() => boot(Ours, failOur).registered[0].execute({ name: "cu" }, makeExec(agent)));
    const stockFail = await messageOf(() => boot(Stock, failStock).registered[0].execute({ name: "cu" }, makeExec(agent)));
    expect(ourFail).toBe(stockFail);
    expect(ourFail).toBe("nhanh da ton tai");
    expect(failOur.calls.length).toBe(1);
    expect(failStock.calls.length).toBe(1);
  });
});

describe("row tool-worktree — C6: vật thể cấu hình ĐỘC LẬP giữa hai thực thể", () => {
  test("hai lượt apply ⇒ hai định nghĩa tool ĐỘC LẬP, đo bằng DANH TÍNH (không phải so sâu)", () => {
    const a = boot(Ours, fakeSeam()).registered[0];
    const b = boot(Ours, fakeSeam()).registered[0];
    // Gốc cũng độc lập — ta phải GIỐNG gốc ở tính độc lập này.
    const sa = boot(Stock, fakeSeam()).registered[0];
    const sb = boot(Stock, fakeSeam()).registered[0];
    for (const [left, right] of [[a, b], [sa, sb]] as const) {
      expect(left).not.toBe(right);
      expect(left.parameters).not.toBe(right.parameters);
      expect(left.output.schema).not.toBe(right.output.schema);
      // HAI THỰC THỂ vẫn SÂU BẰNG NHAU — đúng lý do phép so sâu KHÔNG trả lời được câu hỏi C6.
      expect(left.parameters).toEqual(right.parameters);
    }
    // Sửa vật của thực thể A KHÔNG lan sang B.
    a.parameters.properties.name.description = "da bi sua";
    expect(b.parameters.properties.name.description).toBe(
      "New branch name, also used as the checkout directory. Omit to generate a unique name.",
    );
    a.output.schema.properties.path.type = "number";
    expect(b.output.schema.properties.path.type).toBe("string");
    // Vật thể "yêu cầu" do mỗi lượt gọi tự dựng cũng độc lập.
    const argsA = { name: "a" };
    const argsB = { name: "b" };
    const cardA = a.presentCall(argsA);
    const cardB = b.presentCall(argsB);
    expect(cardA).not.toBe(cardB);
    expect(cardA.rawInput).toBe(argsA);
    expect(cardB.rawInput).toBe(argsB);
  });

  test("ĐỐI CHỨNG ÂM: chia sẻ tham chiếu thì so SÂU vẫn ĐẠT — chỉ DANH TÍNH mới bắt", () => {
    const shared = { card: "generic", title: "create_worktree", rawInput: { name: "x" } };
    const make = () => shared;
    const a = make();
    const b = make();
    expect(a).toEqual(b);
    expect(a).toBe(b);
    a.card = "khac";
    expect(b.card).toBe("khac");
    // Cùng nội dung nhưng KHÁC vật: so sâu ĐẠT, danh tính KHÁC ⇒ đúng chiều ngược lại của phép kiểm.
    const c = { ...shared };
    expect(c).toEqual(shared);
    expect(c).not.toBe(shared);
  });
});

describe("row tool-worktree — hợp đồng metadata", () => {
  test("gbh.peers là TẬP CON của peerDependencies — có ĐỐI CHỨNG ÂM", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers: string[] = manifest.gbh.peers;
    const peerDependencies: string[] = Object.keys(manifest.peerDependencies);
    expect(Array.isArray(peers)).toBe(true);
    expect(peers.length).toBeGreaterThan(0);
    expect(missingPeers(peers, peerDependencies)).toEqual([]);
    // P1b (05/11/2026): peer co the la ten goi CUA TA (@galaxy-blackhole/) khi goi do da doi ten.
    for (const peer of peers) {
      expect(peer.startsWith("@deepseek-ai/") || peer.startsWith("@galaxy-blackhole/")).toBe(true);
    }
    expect(new Set(peers).size).toBe(peers.length);
    // ĐỐI CHỨNG ÂM 1: cùng SỐ LƯỢNG nhưng lệch phần tử — phép so số lượng sẽ cho verdict RỖNG.
    expect(missingPeers(["@a/x", "@a/y"], ["@a/x", "@a/z"])).toEqual(["@a/y"]);
    expect(["@a/x", "@a/y"].length).toBe(["@a/x", "@a/z"].length);
    // ĐỐI CHỨNG ÂM 2: xoá ĐÚNG một tên thật khỏi peerDependencies ⇒ báo đúng tên đó.
    for (const peer of peers) {
      const without = peerDependencies.filter((name) => name !== peer);
      expect(missingPeers(peers, without)).toEqual([peer]);
    }
    // ĐỐI CHỨNG ÂM 3: thừa tên trong peerDependencies KHÔNG bị coi là lỗi (luật chỉ một chiều).
    expect(missingPeers(peers, [...peerDependencies, "@a/thua"])).toEqual([]);
  });

  });
