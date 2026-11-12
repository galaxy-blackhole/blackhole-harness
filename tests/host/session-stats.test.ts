/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-stats (row session-stats): bước 0 đọc cặp row trong
 *      oracle dump, tập export đo trên ARTIFACT, đối chứng TỪNG BƯỚC phép gộp với chính bundle gốc,
 *      quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH), và luật 000e (locale
 *      byte-for-byte).
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Thư mục package của ta — gốc của mọi phép đọc manifest/nguồn. */
const PKG = "../../packages/host/session-stats";
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của MỌI ca A/B. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-session-stats";
/** Gốc repo (để đọc .parity/dumps). */
const REPO = "../..";

/** Một bản ghi dòng gói đã nén (khai theo CẤU TRÚC — test không import kiểu của kernel). */
interface StreamRecord {
  /** Loại bản ghi: một mẩu thô hoặc một cụm delta đã đóng gói. */
  type: string;
  /** Mốc thời gian của mẩu thô (`chunk`). */
  time?: number;
  /** Mẩu thô khi `type === "chunk"`. */
  chunk?: { type: string; index?: number; text?: string; [key: string]: unknown };
  /** Mốc của thành viên ĐẦU của cụm. */
  time0?: number;
  /** Số gia thời gian giữa các thành viên của cụm. */
  dt?: number[];
  /** Các mẩu văn bản của cụm (`texts`/`args`). */
  texts?: string[];
  /** Các mẩu tham số của cụm công cụ. */
  args?: string[];
  /** Tên công cụ của cụm (chỉ cụm công cụ). */
  name?: string;
}

/** Trạng thái phép gộp (bản sao cấu trúc của vật thể cả hai bản cài trả về). */
interface State {
  /** Số lượt. */
  turns: number;
  /** Số bước đã đóng. */
  steps: number;
  /** Tổng thời gian mô hình. */
  llmMs: number;
  /** Tổng thời gian công cụ. */
  toolMs: number;
  /** Tổng độ trễ token đầu. */
  ttftMs: number;
  /** Số bước có token đầu. */
  ttftSteps: number;
  /** Tổng thời gian giải mã. */
  decodeMs: number;
  /** Tổng token ra. */
  decodeTokens: number;
  /** Số lượt của `step/end` được đếm gần nhất. */
  lastTurn: number | null;
  /** Bước đang mở. */
  openStep: { turn: number; step: number; startTime: number; firstTokenTime: number | null } | null;
  /** Mốc phát lệnh gọi công cụ theo callId. */
  pendingCalls: Record<string, number>;
}

/** Một sự kiện phiên dựng trong test. */
interface StatsEvent {
  /** Loại sự kiện. */
  type: string;
  /** Mốc thời gian Unix (ms). */
  time: number;
  /** Dữ liệu sự kiện. */
  data: unknown;
}

/** Hình dạng đơn vị chiếu mà cả hai bản cài đăng ký (khai theo CẤU TRÚC trong test). */
interface Definition {
  /** Khoá chiếu. */
  readonly key: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Schema trạng thái — seam CHỈ gọi `parse`. */
  readonly stateSchema: { parse(value: unknown): State };
  /** Trạng thái rỗng. */
  init(): State;
  /** Phép gộp thuần. */
  apply(state: State, event: StatsEvent): State;
  /** Khung nhìn dây. */
  readonly wire: {
    /** Schema khung nhìn. */
    readonly viewSchema: { parse(value: unknown): Record<string, number> };
    /** Hàm chiếu. */
    view(state: State): Record<string, number>;
  };
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata nửa client của DSH (bản gốc không có). */
  dsh?: { client?: unknown };
  /** Metadata row của ta — lượt này CHƯA khai `row`. */
  gbh?: { peers?: string[]; tests?: string[]; row?: unknown; row_unmounted_ly_do?: unknown };
}

/** Đổi đường dẫn tương đối (theo CHÍNH file test) thành tuyệt đối để `readFileSync` ổn định theo file. */
function here(relative: string): string {
  return new URL(relative, import.meta.url).pathname;
}

/** Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`). */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(here(PKG), "package.json"), "utf8")) as Manifest;
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE. */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Bản gốc đã nạp; kiểu để hở vì đây là bundle đã build của gói khác. */
const stock = (await import(here(STOCK + "/lib/index.js"))) as {
  name: string;
  inject: string[];
  apply: (ctx: unknown) => void;
};
/** Bản CỦA TA nạp từ NGUỒN (artifact được đo riêng bằng văn bản ở ca 1). */
const ours = (await import(here(PKG + "/src/index.ts"))) as {
  name: string;
  inject: string[];
  apply: (ctx: unknown) => void;
};
/** Đơn vị chiếu CỦA TA, nạp từ nguồn để đối chứng từng bước. */
const ourDefinition = (await import(here(PKG + "/src/projection.ts"))).sessionStatsProjectionDefinition as Definition;

/**
 * Cài một bản `apply` lên một giàn giả rồi bắt lấy đơn vị chiếu đã đăng ký.
 * Nhận: hàm `apply` của bản cần cài.
 * Trả: đơn vị chiếu đã đăng ký + số lần `register` được gọi.
 */
function install(apply: (ctx: unknown) => void): { definition: Definition; registrations: number } {
  let captured: Definition | undefined;
  let registrations = 0;
  const ctx = {
    sessionProjections: {
      register(definition: Definition): unknown {
        registrations += 1;
        captured = definition;
        return () => undefined;
      },
    },
  };
  apply(ctx);
  if (captured === undefined) throw new Error("apply khong dang ky don vi chieu nao");
  return { definition: captured, registrations };
}

/** Một sự kiện `step/start`. */
function stepStart(turn: number, step: number, time: number): StatsEvent {
  return { type: "step/start", time, data: { turn, step } };
}

/** Một sự kiện `step/end`. */
function stepEnd(turn: number, step: number, time: number): StatsEvent {
  return { type: "step/end", time, data: { turn, step } };
}

/** Một sự kiện `assistant/attempt`. */
function attempt(turn: number, step: number, stream: readonly StreamRecord[], time: number): StatsEvent {
  return { type: "assistant/attempt", time, data: { turn, step, stream } };
}

/** Một sự kiện `assistant/message` (`usage` tuỳ chọn, truyền `undefined` là KHÔNG có trường). */
function message(turn: number, step: number, stream: readonly StreamRecord[], time: number, usage?: unknown): StatsEvent {
  return usage === undefined
    ? { type: "assistant/message", time, data: { turn, step, stream } }
    : { type: "assistant/message", time, data: { turn, step, stream, usage } };
}

/** Một sự kiện `tool/call`. */
function toolCall(callId: string, time: number): StatsEvent {
  return { type: "tool/call", time, data: { turn: 1, step: 1, callId } };
}

/** Một sự kiện `tool/result` mang callId cho trước. */
function toolResult(callId: string, time: number): StatsEvent {
  return { type: "tool/result", time, data: { turn: 1, step: 1, message: { source: { callId } } } };
}

/** Một sự kiện `turn/end`. */
function turnEnd(time: number): StatsEvent {
  return { type: "turn/end", time, data: { turn: 1, reason: { kind: "ended" } } };
}

/** Một bản ghi `chunk` thô mang delta văn bản. */
function chunk(text: string, time: number): StreamRecord {
  return { type: "chunk", time, chunk: { type: "text-delta", index: 0, text } };
}

/** Một cụm `text-chunks` đã đóng gói (mốc thành viên = `time0` + tổng `dt` trước nó). */
function packedText(time0: number, dt: readonly number[], texts: readonly string[]): StreamRecord {
  return { type: "text-chunks", time0, dt: [...dt], texts: [...texts] };
}

/** Một cụm `tool-call-chunks` đã đóng gói. */
function packedToolCall(time0: number, dt: readonly number[], args: readonly string[], name?: string): StreamRecord {
  return name === undefined
    ? { type: "tool-call-chunks", time0, dt: [...dt], args: [...args] }
    : { type: "tool-call-chunks", time0, dt: [...dt], args: [...args], name };
}

/**
 * Chạy MỘT chuỗi sự kiện qua một đơn vị chiếu và ghi lại cả giá trị lẫn DANH TÍNH.
 * Nhận: đơn vị chiếu và danh sách sự kiện.
 * Trả: dãy trạng thái sau mỗi bước + cờ "giữ nguyên tham chiếu" của từng bước.
 */
function foldTrace(definition: Definition, events: readonly StatsEvent[]): { states: State[]; sameReference: boolean[] } {
  let state = definition.init();
  const states: State[] = [];
  const sameReference: boolean[] = [];
  for (const event of events) {
    const next = definition.apply(state, event);
    sameReference.push(next === state);
    states.push(next);
    state = next;
  }
  return { states, sameReference };
}

/** Kịch bản đầy đủ dùng cho cả hai bản cài — mỗi dòng là một sự kiện thật của vòng agent. */
const SCRIPT: readonly StatsEvent[] = [
  { type: "session/start", time: 0, data: { header: {} } },
  stepStart(1, 1, 1000),
  attempt(1, 1, [], 1010),
  message(1, 1, [chunk("", 1030), chunk("Xin", 1040), chunk(" chào", 1050)], 1100, { outputTokens: 12 }),
  toolCall("call_a", 1110),
  toolResult("call_a", 1160),
  toolCall("call_b", 1170),
  stepEnd(1, 1, 1200),
  turnEnd(1210),
  stepStart(1, 2, 1300),
  attempt(1, 2, [packedText(1310, [10, 20], ["", "Hel", "lo"])], 1320),
  message(1, 2, [packedText(1310, [10, 20], ["", "Hel", "lo"])], 1400),
  stepEnd(1, 2, 1410),
  stepStart(2, 1, 1500),
  attempt(2, 1, [packedToolCall(1510, [5], ["", "{}"])], 1515),
  message(2, 1, [packedToolCall(1510, [5], ["{}"], "fs")], 1600, { outputTokens: 3 }),
  toolCall("toString", 1610),
  toolResult("constructor", 1620),
  stepEnd(2, 1, 1700),
  turnEnd(1710),
  stepStart(3, 1, 1800),
  stepEnd(3, 1, 1810),
  stepEnd(3, 1, 1820),
];

describe("bước 0 — cặp row trong oracle dump + hình dạng gói", () => {
  test("ca 0a: cặp '- id: session-stats' + name gốc CÓ THẬT trong ours.yml mới nhất, KHÔNG disabled, KHÔNG config", () => {
    const dumps = join(here(REPO), ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    const yml = readFileSync(join(dumps, newest as string, "ours.yml"), "utf8").split("\n");
    const at = yml.findIndex((line) => line.trim() === "- id: session-stats");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(yml[at + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-session-stats'");
    // Đoạn của row này chỉ có ĐÚNG dòng `name` ⇒ bản gốc KHÔNG bị tắt và KHÔNG mang `config`
    // (kể cả `!!js …`). Mốc hết row là dòng bắt đầu bằng "- " của row kế tiếp.
    const end = yml.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowLines = yml
      .slice(at + 1, end < 0 ? yml.length : end)
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(rowLines.length).toBe(1);
    expect(rowLines[0]?.trim()).toBe("name: '@deepseek-ai/dsh-session-stats'");
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, lib/types/client.js chỉ là export rỗng, manifest không có dsh.client", () => {
    expect(existsSync(join(here(STOCK), "lib", "client.js"))).toBe(false);
    expect(readFileSync(join(here(STOCK), "lib", "types", "client.js"), "utf8")).not.toContain("__ModuleLoader__");
    expect(readManifest().dsh?.client).toBeUndefined();
    expect(readManifest().exports?.["./client"]).toBeUndefined();
  });

  test("ca 0c: gbh.row được khai NGOÀI phiên viết gói — hình dạng đúng: id + tests, KHÔNG config/moduleIds/aliases", () => {
    // ⚠️ Phiên viết gói này KHÔNG khai `gbh.row` (chỉ đạo của Lead). Khoá row xuất hiện lúc 08:41:42
    // ngày 18/10/2026 trong commit d745518 của LEAD, SAU khi bản viết lại + test đã xong. Ca này ghi
    // lại HÌNH DẠNG phải có và canh ba thứ KHÔNG được thêm: `config` (bản gốc KHÔNG mang config — đo ở
    // ca 0a), `moduleIds`/`aliases` (row MỘT MẶT, không có id bundle nào), và `row_unmounted_ly_do`.
    const manifest = readManifest();
    expect(manifest.gbh?.row).toEqual({ id: "session-stats", tests: ["tests/host/session-stats.test.ts"] });
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.peers).toEqual(["@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-session-projection"]);
    expect(manifest.gbh?.tests).toEqual(["tests/host/session-stats.test.ts"]);
    expect(existsSync(here("session-stats.test.ts"))).toBe(true);
  });
  });

describe("ARTIFACT — khuôn bundle và tập export", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên văn bản lib/index.js đã build)", async () => {
    const build = (await import(join(here(PKG), "build.ts"))) as { buildPackage: (outDir?: string) => Promise<string> };
    const artifact = await build.buildPackage(mkdtempSync(join(tmpdir(), "gbh-session-stats-")));
    const artifactText = readFileSync(artifact, "utf8");
    const mine = exportNames(artifactText);
    const theirs = exportNames(readFileSync(join(here(STOCK), "lib", "index.js"), "utf8"));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual(["apply", "inject", "name"]);
    expect(mine).not.toContain("default");
    // Row HOST-ONLY: bundle không đăng ký id module nào, không đụng bộ nạp client.
    expect(artifactText.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifactText.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
  });

  test("ca 2: build.ts nhận thư mục đích qua process.argv[2] (thiếu ⇒ profile không có lib ⇒ không sinh entry)", () => {
    expect(readFileSync(join(here(PKG), "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("ca 3: artifact chỉ nạp ĐÚNG hai gói ngoài — zod (dependencies) + dsh-llm (peer trong bảng §3b)", async () => {
    const build = (await import(join(here(PKG), "build.ts"))) as { buildPackage: (outDir?: string) => Promise<string> };
    const artifact = readFileSync(await build.buildPackage(mkdtempSync(join(tmpdir(), "gbh-session-stats-deps-"))), "utf8");
    const specifiers = [...artifact.matchAll(/^import[^"']*["']([^"']+)["']/gm)]
      .map((match) => match[1] ?? "")
      .sort();
    expect(specifiers).toEqual(["@deepseek-ai/dsh-llm", "zod/v4"]);
  });

  test("ca 4: luật 000e — locale/{en,zh}.json chép BYTE-FOR-BYTE và có trong exports", () => {
    for (const locale of ["en", "zh"]) {
      const name = "locale/" + locale + ".json";
      expect(sha256(readFileSync(join(here(PKG), name), "utf8"))).toBe(
        sha256(readFileSync(join(here(STOCK), name), "utf8")),
      );
    }
    expect(readManifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

describe("peer — gbh.peers ⊆ peerDependencies, so PHẦN TỬ", () => {
  test("ca 5: manifest thật có 0 tên lệch, peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["zod"]);
    expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual([
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-session-projection",
    ]);
  });

  test("ca 6: ĐỐI CHỨNG ÂM — xoá MỌI peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG hai tên đó", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {};
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-llm", "@deepseek-ai/dsh-session-projection"]);
  });

  test("ca 7: đối chứng âm thứ hai — CÙNG số lượng mà lệch phần tử vẫn PHẢI bị bắt; thừa tên vẫn ĐẠT", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = { "@deepseek-ai/dsh-llm": "~0.2.1-alpha.4", "@deepseek-ai/cordis": "~4.0.5" };
    expect(Object.keys(broken.peerDependencies).length).toBe(2);
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-session-projection"]);
    const extra = cloneManifest(readManifest());
    extra.peerDependencies = { ...extra.peerDependencies, "@deepseek-ai/cordis": "~4.0.5" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("hành vi — A/B trực tiếp với chính bundle gốc trên CÙNG một giàn", () => {
  test("ca 8: đăng ký đúng MỘT đơn vị chiếu; name/inject/key/stateVersion/init khớp từng chữ", () => {
    const mine = install(ours.apply);
    const theirs = install(stock.apply);
    expect(mine.registrations).toBe(1);
    expect(theirs.registrations).toBe(1);
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("session-stats");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["sessionProjections"]);
    expect(ours.apply.length).toBe(1);
    expect(mine.definition.key).toBe(theirs.definition.key);
    expect(mine.definition.key).toBe("sessionStats");
    expect(mine.definition.stateVersion).toBe(theirs.definition.stateVersion);
    expect(mine.definition.stateVersion).toBe(1);
    expect(mine.definition.init()).toEqual(theirs.definition.init());
    expect(mine.definition.init()).toEqual({
      turns: 0,
      steps: 0,
      llmMs: 0,
      toolMs: 0,
      ttftMs: 0,
      ttftSteps: 0,
      decodeMs: 0,
      decodeTokens: 0,
      lastTurn: null,
      openStep: null,
      pendingCalls: {},
    });
  });

  test("ca 9: phép gộp khớp TỪNG BƯỚC trên kịch bản 23 sự kiện (giá trị + danh tính)", () => {
    const mine = foldTrace(ourDefinition, SCRIPT);
    const theirs = foldTrace(install(stock.apply).definition, SCRIPT);
    expect(mine.states.length).toBe(SCRIPT.length);
    for (let index = 0; index < SCRIPT.length; index += 1) {
      expect(mine.states[index]).toEqual(theirs.states[index]);
      expect(mine.sameReference[index]).toBe(theirs.sameReference[index]);
    }
    // Neo giá trị cụ thể để test không "xanh rỗng" khi cả hai cùng sai.
    expect(mine.states.at(-1)).toEqual({
      turns: 3,
      steps: 5,
      llmMs: 300,
      toolMs: 50,
      ttftMs: 75,
      ttftSteps: 3,
      decodeMs: 145,
      decodeTokens: 15,
      lastTurn: 3,
      openStep: null,
      pendingCalls: {},
    });
    // Sự kiện lạ và lần gọi KHÔNG có token đều trả CÙNG tham chiếu.
    expect(mine.sameReference.slice(0, 4)).toEqual([true, false, true, false]);
    // Lượt đã đếm: `step/end` thứ hai của cùng lượt chỉ +1 bước, KHÔNG +1 lượt.
    expect(mine.states[21]?.turns).toBe(3);
    expect(mine.states[21]?.steps).toBe(4);
    expect(mine.states[22]?.turns).toBe(3);
    expect(mine.states[22]?.steps).toBe(5);
  });

  test("ca 10: token đầu — mẩu delta rỗng bị bỏ qua, cụm đóng gói dựng lại mốc bằng time0 + dt", () => {
    const mine = foldTrace(ourDefinition, SCRIPT);
    // Bước 1: chunk rỗng ở 1030 bị bỏ, token đầu là "Xin" ở 1040 ⇒ ttft 40, llm 1100 − 1000 = 100.
    expect(mine.states[3]?.ttftMs).toBe(40);
    expect(mine.states[3]?.llmMs).toBe(100);
    // Bước 2: cụm texts ["", "Hel", "lo"] với dt [10, 20] ⇒ mẩu rỗng ở 1310 bị bỏ, "Hel" ở 1320.
    expect(mine.states[11]?.ttftMs).toBe(60);
    // Bước 3: cụm công cụ KHÔNG tên ⇒ mốc là mẩu args không rỗng ĐẦU TIÊN (1510 + 5 = 1515).
    expect(mine.states[15]?.ttftMs).toBe(75);
    // Cụm công cụ CÓ tên ⇒ mốc là time0 (1510 − 1000 = 510).
    const withName: readonly StatsEvent[] = [
      stepStart(1, 1, 1000),
      message(1, 1, [packedToolCall(1510, [5], ["{}"], "fs")], 1600, { outputTokens: 3 }),
    ];
    expect(foldTrace(ourDefinition, withName).states.at(-1)?.ttftMs).toBe(510);
  });

  test("ca 11: báo cáo usage hỏng bị BỎ QUA (không có decode) nhưng độ trễ token đầu VẪN đếm — 5 dạng", () => {
    const bad: readonly unknown[] = [undefined, null, { outputTokens: -1 }, { outputTokens: Number.NaN }, { outputTokens: "5" }];
    const theirs = install(stock.apply).definition;
    for (const usage of bad) {
      const script: readonly StatsEvent[] = [stepStart(1, 1, 1000), message(1, 1, [chunk("X", 1040)], 1100, usage)];
      const mine = foldTrace(ourDefinition, script);
      const reference = foldTrace(theirs, script);
      expect(mine.states).toEqual(reference.states);
      expect(mine.states.at(-1)?.ttftSteps).toBe(1);
      expect(mine.states.at(-1)?.decodeMs).toBe(0);
      expect(mine.states.at(-1)?.decodeTokens).toBe(0);
    }
    // Và usage HỢP LỆ thì decode có: 1100 − 1040 = 60 ms, 12 token.
    const good = foldTrace(ourDefinition, [stepStart(1, 1, 1000), message(1, 1, [chunk("X", 1040)], 1100, { outputTokens: 12 })]);
    expect(good.states.at(-1)?.decodeMs).toBe(60);
    expect(good.states.at(-1)?.decodeTokens).toBe(12);
  });

  test("ca 12: callId trùng tên prototype Object đọc là KHÔNG khớp (không đầu độc toolMs bằng NaN)", () => {
    const script: readonly StatsEvent[] = [stepStart(1, 1, 1000), toolResult("constructor", 1050), toolResult("toString", 1060)];
    const mine = foldTrace(ourDefinition, script);
    const theirs = foldTrace(install(stock.apply).definition, script);
    expect(mine.states).toEqual(theirs.states);
    expect(mine.states.at(-1)?.toolMs).toBe(0);
    expect(Number.isNaN(mine.states.at(-1)?.toolMs)).toBe(false);
    // Và lệnh gọi THẬT SỰ đã ghi thì vẫn ghép: 1050 − 1000 = 50.
    const matched = foldTrace(ourDefinition, [stepStart(1, 1, 1000), toolCall("call_a", 1000), toolResult("call_a", 1050)]);
    expect(matched.states.at(-1)?.toolMs).toBe(50);
    expect(matched.states.at(-1)?.pendingCalls).toEqual({});
  });

  test("ca 13: bước bị huỷ không lắp tin thì KHÔNG có llmMs; turn/end xoá lệnh gọi treo", () => {
    const cancelled: readonly StatsEvent[] = [stepStart(1, 1, 1000), attempt(1, 1, [chunk("X", 1010)], 1020), stepEnd(1, 1, 1030)];
    const mine = foldTrace(ourDefinition, cancelled);
    const theirs = foldTrace(install(stock.apply).definition, cancelled);
    expect(mine.states).toEqual(theirs.states);
    expect(mine.states.at(-1)?.steps).toBe(1);
    expect(mine.states.at(-1)?.llmMs).toBe(0);
    expect(mine.states.at(-1)?.ttftMs).toBe(0);
    // attempt ghi mốc token đầu (1010) nhưng KHÔNG lắp tin ⇒ mốc đó chết cùng bước.
    expect(mine.states[1]?.openStep).toEqual({ turn: 1, step: 1, startTime: 1000, firstTokenTime: 1010 });
    expect(mine.states.at(-1)?.openStep).toBeNull();
    const pending = foldTrace(ourDefinition, [toolCall("call_a", 1000), turnEnd(1010)]);
    expect(pending.states.at(-1)?.pendingCalls).toEqual({});
    expect(pending.sameReference.at(-1)).toBe(false);
    // turn/end khi không có lệnh gọi treo phải trả CÙNG tham chiếu.
    expect(foldTrace(ourDefinition, [turnEnd(1010)]).sameReference).toEqual([true]);
  });

  test("ca 14: attempt/message lệch lượt hoặc bước bị bỏ qua (cùng tham chiếu) — 4 dạng lệch", () => {
    const theirs = install(stock.apply).definition;
    const script: readonly StatsEvent[] = [
      stepStart(1, 2, 1000),
      attempt(1, 1, [chunk("X", 1010)], 1020),
      message(2, 2, [chunk("X", 1010)], 1030),
      attempt(1, 2, [chunk("X", 1040)], 1050),
      attempt(1, 2, [chunk("Y", 1060)], 1070),
      message(1, 2, [], 1100, { outputTokens: 1 }),
      message(1, 2, [chunk("Z", 1090)], 1200, { outputTokens: 1 }),
    ];
    const mine = foldTrace(ourDefinition, script);
    const reference = foldTrace(theirs, script);
    expect(mine.states).toEqual(reference.states);
    expect(mine.sameReference).toEqual(reference.sameReference);
    expect(mine.sameReference).toEqual([false, true, true, false, true, false, true]);
    // Mốc token đầu ĐẦU TIÊN thắng: 1040 (không phải 1060).
    expect(mine.states.at(-1)?.ttftMs).toBe(40);
  });

  test("ca 15: schema — cùng chấp nhận, cùng từ chối, cùng câu lỗi (7 dạng hỏng)", () => {
    const theirs = install(stock.apply).definition;
    const view = {
      turns: 1,
      steps: 2,
      llmMs: 3,
      toolMs: 4,
      ttftMs: 5,
      ttftSteps: 1,
      decodeMs: 6,
      decodeTokens: 7,
    };
    const valid = { ...view, lastTurn: 0, openStep: { turn: 0, step: 0, startTime: 0, firstTokenTime: null }, pendingCalls: { call_a: 1 } };
    expect(ourDefinition.stateSchema.parse(valid)).toEqual(theirs.stateSchema.parse(valid));
    expect(ourDefinition.wire.viewSchema.parse(view)).toEqual(theirs.wire.viewSchema.parse(view));
    const broken: readonly unknown[] = [
      { ...valid, llmMs: -1 },
      { ...valid, turns: 1.5 },
      { ...valid, extra: true },
      { ...valid, openStep: { turn: 1, step: 1, startTime: 1 } },
      { ...valid, pendingCalls: { call_a: -1 } },
      { ...valid, decodeTokens: Number.NaN },
      { ...valid, steps: "2" },
    ];
    for (const value of broken) {
      let mine = "ok";
      let reference = "ok";
      try {
        ourDefinition.stateSchema.parse(value);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        theirs.stateSchema.parse(value);
      } catch (error) {
        reference = (error as Error).message;
      }
      expect(mine).toBe(reference);
      expect(mine).not.toBe("ok");
    }
    // Khung nhìn dây TỪ CHỐI khoá thừa (strict) — đo cả hai bên.
    const withBoundary = { ...view, pendingCalls: {} };
    expect(() => ourDefinition.wire.viewSchema.parse(withBoundary)).toThrow();
    expect(() => theirs.wire.viewSchema.parse(withBoundary)).toThrow();
  });

  test("ca 16: khung nhìn — tám tổng, vật thể MỚI mỗi lần gọi (giữ nguyên hành vi bản gốc)", () => {
    const definition = ourDefinition;
    const state = definition.apply(definition.init(), stepStart(1, 1, 1000));
    expect(definition.wire.view(state)).toEqual({
      turns: 0,
      steps: 0,
      llmMs: 0,
      toolMs: 0,
      ttftMs: 0,
      ttftSteps: 0,
      decodeMs: 0,
      decodeTokens: 0,
    });
    expect(definition.wire.view(state)).not.toBe(definition.wire.view(state));
    const theirs = install(stock.apply).definition;
    expect(definition.wire.view(state)).toEqual(theirs.wire.view(state));
    expect(theirs.wire.view(state)).not.toBe(theirs.wire.view(state));
  });
});

describe("C6 — DANH TÍNH giữa các thực thể, không chỉ giá trị", () => {
  test("ca 17: hai lượt gộp độc lập ⇒ vật thể RIÊNG; sửa bên này KHÔNG lan bên kia", () => {
    const definition = ourDefinition;
    const a = definition.apply(definition.init(), stepStart(1, 1, 1000));
    const b = definition.apply(definition.init(), stepStart(1, 1, 1000));
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.openStep).not.toBe(b.openStep);
    expect(a.openStep?.startTime).toBe(1000);
    // Sửa một bên KHÔNG lan: đây là câu mà phép so SÂU không trả lời được (nó vẫn ĐẠT sau khi sửa).
    if (a.openStep !== null) a.openStep.turn = 99;
    expect(b.openStep?.turn).toBe(1);
    expect(a.openStep?.turn).toBe(99);
    // Bản gốc đo được Y HỆT (hành vi phải tái hiện, không phải khác biệt).
    const theirs = install(stock.apply).definition;
    expect(theirs.apply(theirs.init(), stepStart(1, 1, 1000)).openStep).not.toBe(
      theirs.apply(theirs.init(), stepStart(1, 1, 1000)).openStep,
    );
  });

  test("ca 18: init trả vật thể MỚI mỗi lần (KHÔNG dùng chung như row turn-outline) — đo cả hai bên", () => {
    expect(ourDefinition.init()).not.toBe(ourDefinition.init());
    expect(ourDefinition.init().pendingCalls).not.toBe(ourDefinition.init().pendingCalls);
    const theirs = install(stock.apply).definition;
    expect(theirs.init()).not.toBe(theirs.init());
    // Và schema trả vật thể MỚI mỗi lần parse — độc lập giữa hai lượt đọc.
    const first = ourDefinition.stateSchema.parse(ourDefinition.init());
    const second = ourDefinition.stateSchema.parse(ourDefinition.init());
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.pendingCalls).not.toBe(second.pendingCalls);
    // Sửa trạng thái của lượt này không đụng trạng thái kia.
    first.pendingCalls["call_a"] = 1;
    expect(second.pendingCalls).toEqual({});
  });

  test("ca 19: pendingCalls được COPY khi thêm lệnh gọi (không sửa vật thể trạng thái cũ)", () => {
    const definition = ourDefinition;
    const base = definition.apply(definition.init(), stepStart(1, 1, 1000));
    const withCall = definition.apply(base, toolCall("call_a", 1010));
    expect(withCall).not.toBe(base);
    expect(withCall.pendingCalls).not.toBe(base.pendingCalls);
    expect(base.pendingCalls).toEqual({});
    expect(withCall.pendingCalls).toEqual({ call_a: 1010 });
    // Đối chứng: bản gốc cũng copy y hệt.
    const theirs = install(stock.apply).definition;
    const theirBase = theirs.apply(theirs.init(), stepStart(1, 1, 1000));
    const theirCall = theirs.apply(theirBase, toolCall("call_a", 1010));
    expect(theirBase.pendingCalls).toEqual({});
    expect(theirCall.pendingCalls).toEqual(withCall.pendingCalls);
  });
});
