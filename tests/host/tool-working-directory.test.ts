/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-tool-working-directory: đo trên ARTIFACT đã build,
 *      và so từng hành vi với CHÍNH bundle gốc của DSH (định nghĩa tool · uỷ quyền seam · đường lỗi)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/tool-working-directory/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "tool-working-directory");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-working-directory", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để packages external phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Artifact của TA, build ngay khi nạp test (mọi phép đo đều chạy trên artifact). */
const ARTIFACT_FILE: string = await buildPackage(OUT);
/** Module artifact của ta. */
const Ours: any = await import(ARTIFACT_FILE);
/** Module bundle GỐC. */
const Stock: any = await import(STOCK);

/** Một lời gọi seam workingDirectory đã ghi vết. */
interface SeamCall {
  /** Phương thức được gọi. */
  readonly kind: "ensure" | "set";
  /** Agent được chuyển nguyên văn. */
  readonly agent: unknown;
  /** Đường dẫn (chỉ có ở lời gọi set). */
  readonly path?: string;
  /** Tín hiệu huỷ được chuyển nguyên văn. */
  readonly signal: unknown;
}

/** Seam workingDirectory giả có ghi vết — ĐÚNG hai phương thức mà bundle gốc gọi. */
interface FakeSeam {
  /** Vết lời gọi theo thứ tự. */
  readonly calls: SeamCall[];
  /** Đọc thư mục (trả hằng số hoặc ném theo cấu hình). */
  ensure(agent: unknown, signal?: AbortSignal): Promise<string>;
  /** Đổi thư mục (trả hằng số hoặc ném theo cấu hình). */
  set(agent: unknown, path: string, signal?: AbortSignal): Promise<string>;
}

/**
 * Dựng một seam giả.
 * Nhận: tuỳ chọn ném lỗi cho từng phương thức (mô phỏng seam thật từ chối).
 * Trả: seam có vết lời gọi rỗng.
 */
function fakeSeam(options: { rejectEnsure?: string; rejectSet?: string } = {}): FakeSeam {
  const calls: SeamCall[] = [];
  return {
    calls,
    async ensure(agent, signal) {
      calls.push({ kind: "ensure", agent, signal });
      if (options.rejectEnsure !== undefined) throw new Error(options.rejectEnsure);
      return "/tmp/du-an";
    },
    async set(agent, path, signal) {
      calls.push({ kind: "set", agent, path, signal });
      if (options.rejectSet !== undefined) throw new Error(options.rejectSet);
      return path.startsWith("/") ? path : "/tmp/du-an/" + path;
    },
  };
}

/**
 * Dựng context giả ĐÚNG hình dạng mà hai bundle cần: sổ tool, seam thư mục, logger.
 * Bundle gốc đọc ctx.workingDirectory; bản của ta đọc ctx.get(workingDirectory) — cả hai cùng một seam.
 * Nhận: seam thư mục.
 * Trả: context (đã ép kiểu) và danh sách định nghĩa tool đã đăng ký.
 */
function fakeContext(seam: FakeSeam): { ctx: any; registered: any[] } {
  const registered: any[] = [];
  /** Sổ tool giả — MỘT vật thể, lộ ra cả hai đường đọc để đo được cả hai bundle. */
  const soTool = {
    register(definition: any) {
      registered.push(definition);
      return () => {};
    },
    get() {
      return undefined;
    },
  };
  const ctx = {
    tools: soTool,
    workingDirectory: seam,
    // 08/11/2026 (PHASE B): bundle của TA đọc sổ tool qua seam CẤU TRÚC ctx.get("tools") (ADR 000d),
    // còn bundle GỐC đọc ctx.tools trực tiếp ⇒ giả lập CẢ HAI đường để phép so vẫn đo đúng hành vi.
    get(name: string) { return name === "workingDirectory" ? seam : name === "tools" ? soTool : undefined; },
    logger: { info() {}, warn() {}, error() {}, debug() {} },
  };
  return { ctx, registered };
}

/**
 * Chạy apply của một bundle trên một context giả.
 * Nhận: module plugin (ta hoặc gốc) và seam thư mục.
 * Trả: các định nghĩa tool đã đăng ký, theo thứ tự.
 */
function boot(plugin: any, seam: FakeSeam): any[] {
  const { ctx, registered } = fakeContext(seam);
  plugin.apply(ctx);
  return registered;
}

/**
 * Dựng ngữ cảnh thực thi tối thiểu (đúng các trường mà execute đọc).
 * Nhận: agent tuỳ chọn và tín hiệu huỷ.
 * Trả: đối tượng exec.
 */
function makeExec(agent?: unknown, signal: AbortSignal = new AbortController().signal): any {
  return {
    callId: "call-1",
    name: "working_directory",
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

describe("row tool-working-directory — artifact và bề mặt", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module (row MỘT MẶT)", async () => {
    const code = await readFile(ARTIFACT_FILE, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect(Object.keys(Ours).sort()).toEqual(Object.keys(Stock).sort());
    expect(Object.keys(Ours).sort()).toEqual(["apply", "inject", "name"]);
    expect(Ours.name).toBe(Stock.name);
    expect(Ours.name).toBe("tool-working-directory");
    expect([...Ours.inject]).toEqual([...Stock.inject]);
    expect([...Ours.inject]).toEqual(["tools", "workingDirectory"]);
    expect(typeof Ours.apply).toBe("function");
    // apply của CẢ HAI đăng ký ĐÚNG MỘT tool, và tên tool khớp nhau.
    const ourNames = boot(Ours, fakeSeam()).map((definition) => definition.name);
    const stockNames = boot(Stock, fakeSeam()).map((definition) => definition.name);
    expect(ourNames).toEqual(stockNames);
    expect(ourNames).toEqual(["working_directory"]);
  });
});

describe("row tool-working-directory — đối chứng với chính bundle gốc", () => {
  test("định nghĩa tool: tên · mô tả · schema tham số · schema kết quả · render KHỚP gốc", () => {
    const ourTool = boot(Ours, fakeSeam())[0];
    const stockTool = boot(Stock, fakeSeam())[0];
    expect(ourTool).toBeDefined();
    expect(stockTool).toBeDefined();
    expect(ourTool.name).toBe(stockTool.name);
    expect(ourTool.description).toBe(stockTool.description);
    expect(JSON.stringify(ourTool.parameters)).toBe(JSON.stringify(stockTool.parameters));
    expect(JSON.stringify(ourTool.output.schema)).toBe(JSON.stringify(stockTool.output.schema));
    expect(Object.keys(ourTool).sort()).toEqual(Object.keys(stockTool).sort());
    expect(Object.keys(ourTool.output).sort()).toEqual(Object.keys(stockTool.output).sort());
    // Tham số cd KHÔNG bắt buộc; kết quả bắt buộc cwd — như bản gốc.
    const cdSchema = ourTool.parameters.properties.cd;
    expect(cdSchema.type).toBe("string");
    expect(cdSchema.description).toBe("Existing directory to enter. Omit to read the current directory.");
    expect(ourTool.parameters.required ?? []).toEqual(stockTool.parameters.required ?? []);
    const outSchema = ourTool.output.schema;
    expect(outSchema.type).toBe("object");
    expect(outSchema.additionalProperties).toBe(false);
    expect(JSON.stringify(outSchema.required)).toBe(JSON.stringify(stockTool.output.schema.required));
    const rendered = ourTool.output.render({}, { cwd: "/tmp/du-an" });
    expect(rendered).toEqual(stockTool.output.render({}, { cwd: "/tmp/du-an" }));
    expect(rendered).toEqual([{ type: "text", text: "/tmp/du-an" }]);
  });

  test("execute: đọc (không cd) uỷ quyền ensure · đổi (cd) uỷ quyền set — cùng agent và tín hiệu như gốc", async () => {
    const agent = { session: { id: "w1" } };
    const signal = new AbortController().signal;
    const ourSeam = fakeSeam();
    const stockSeam = fakeSeam();
    const ourTool = boot(Ours, ourSeam)[0];
    const stockTool = boot(Stock, stockSeam)[0];
    for (const args of [{}, { cd: "src" }, { cd: "/tmp/tuyet-doi" }]) {
      const ourValue = await ourTool.execute(args, makeExec(agent, signal));
      const stockValue = await stockTool.execute(args, makeExec(agent, signal));
      expect(JSON.stringify(ourValue)).toBe(JSON.stringify(stockValue));
      expect(ourValue.cwd).toMatch(/^\//);
    }
    // Vết lời gọi hai bên TRÙNG NHAU, và đúng thứ tự ensure → set → set.
    expect(JSON.stringify(ourSeam.calls)).toBe(JSON.stringify(stockSeam.calls));
    expect(ourSeam.calls.map((call) => call.kind)).toEqual(["ensure", "set", "set"]);
    expect(ourSeam.calls[1]?.path).toBe("src");
    expect(ourSeam.calls[2]?.path).toBe("/tmp/tuyet-doi");
    // Chuyển NGUYÊN VĂN chính agent và tín hiệu của lượt gọi — không tạo bản sao.
    for (const call of ourSeam.calls) {
      expect(call.agent).toBe(agent);
      expect(call.signal).toBe(signal);
    }
    expect(ourSeam.calls[0]?.path).toBeUndefined();
    expect((await ourTool.execute({}, makeExec(agent, signal))).cwd).toBe("/tmp/du-an");
    expect((await ourTool.execute({ cd: "src" }, makeExec(agent, signal))).cwd).toBe("/tmp/du-an/src");
  });

  test("đường lỗi: thiếu agent · tham số sai · seam ném — thông điệp KHỚP gốc, không treo", async () => {
    const agent = { session: { id: "w1" } };
    const cleanOur = fakeSeam();
    const cleanStock = fakeSeam();
    const ourTool = boot(Ours, cleanOur)[0];
    const stockTool = boot(Stock, cleanStock)[0];
    // (a) thiếu agent: ném CÙNG thông điệp, và KHÔNG chạm seam.
    const ourNoAgent = await messageOf(() => ourTool.execute({}, makeExec(undefined)));
    const stockNoAgent = await messageOf(() => stockTool.execute({}, makeExec(undefined)));
    expect(ourNoAgent).toBe(stockNoAgent);
    expect(ourNoAgent).toBe("working_directory requires an agent Session");
    expect(cleanOur.calls.length).toBe(0);
    // (b) tham số sai kiểu: cùng lớp lỗi và cùng thông điệp (validate của defineTool).
    const ourBadType = await messageOf(() => ourTool.execute({ cd: 42 }, makeExec(agent)));
    const stockBadType = await messageOf(() => stockTool.execute({ cd: 42 }, makeExec(agent)));
    expect(ourBadType).toBe(stockBadType);
    expect(ourBadType).not.toBe("(khong nem)");
    const ourBadName = await nameOf(() => ourTool.execute({ cd: 42 }, makeExec(agent)));
    const stockBadName = await nameOf(() => stockTool.execute({ cd: 42 }, makeExec(agent)));
    expect(ourBadName).toBe(stockBadName);
    // (c) seam ĐỌC ném: lỗi đi ra nguyên văn, không treo, không gọi set.
    const ensureFails = fakeSeam({ rejectEnsure: "thu muc goc da mat" });
    const stockEnsureFails = fakeSeam({ rejectEnsure: "thu muc goc da mat" });
    const ourEnsure = await messageOf(() => boot(Ours, ensureFails)[0].execute({}, makeExec(agent)));
    const stockEnsure = await messageOf(() => boot(Stock, stockEnsureFails)[0].execute({}, makeExec(agent)));
    expect(ourEnsure).toBe(stockEnsure);
    expect(ourEnsure).toBe("thu muc goc da mat");
    expect(ensureFails.calls.map((call) => call.kind)).toEqual(["ensure"]);
    // (d) seam ĐỔI ném: lỗi của đường ghi cũng đi ra nguyên văn.
    const setFails = fakeSeam({ rejectSet: "khong phai thu muc" });
    const stockSetFails = fakeSeam({ rejectSet: "khong phai thu muc" });
    const ourSet = await messageOf(() => boot(Ours, setFails)[0].execute({ cd: "khong-co" }, makeExec(agent)));
    const stockSet = await messageOf(() => boot(Stock, stockSetFails)[0].execute({ cd: "khong-co" }, makeExec(agent)));
    expect(ourSet).toBe(stockSet);
    expect(ourSet).toBe("khong phai thu muc");
    expect(setFails.calls.map((call) => call.kind)).toEqual(["set"]);
  });
});

describe("row tool-working-directory — hợp đồng metadata", () => {
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
