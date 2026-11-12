/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Harness dùng chung cho test A/B gói tool-skill: import chéo, dựng Context cordis giả,
 *      helper so sánh chuẩn hoá — tách khỏi file test để mỗi file ≤1000 dòng.
 */
import { afterAll, beforeAll } from "bun:test";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-skill/build.ts";
import * as oursModule from "../../packages/host/tool-skill/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
export const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
export const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-skill");
/** Bundle gốc đã build — bản đối chứng. */
export const STOCK = join(STOCK_DIR, "lib", "index.js");
/** schemastery của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Schema. */
export const SCHEMASTER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs");

/** Hình dạng plugin tối thiểu mà test dùng (cả hai bản đều khớp). */
export interface PluginLike {
  readonly name: string;
  readonly inject: readonly string[];
  readonly Config: ConfigSchemaLike;
  readonly apply: (ctx: unknown, config?: unknown) => void;
}

/** Schema cấu hình nhìn theo CẤU TRÚC: gọi trực tiếp như schemastery + Standard Schema. */
interface ConfigSchemaLike {
  (value?: unknown): Record<string, unknown>;
  readonly type: unknown;
  readonly meta: unknown;
  readonly dict: Record<string, unknown>;
  readonly "~standard": {
    readonly version: number;
    readonly vendor: string;
    validate(value: unknown): unknown;
  };
  toString(): string;
}

/** Một mục catalog bền vững. */
export interface CatalogEntry {
  readonly name: string;
  readonly description: string;
}

/** Tóm tắt kỹ năng mà seam skills.list() trả. */
export interface SkillSummary {
  readonly name: string;
  readonly description: string;
  readonly invocation: { readonly modelInvocable: boolean; readonly userInvocable: boolean };
}

/** Gốc tài nguyên của một định nghĩa kỹ năng. */
export type SkillResourceBase =
  | { readonly kind: "directory"; readonly path: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "opaque"; readonly description: string };

/** Định nghĩa đầy đủ mà seam skills.get() trả. */
export interface SkillDefinition extends SkillSummary {
  readonly provider: string;
  readonly content: string;
  readonly resourceBase?: SkillResourceBase;
}

/** Khối nội dung message. */
interface ContentBlockLike {
  readonly type: string;
  readonly text?: string;
}

/** Message trong quyết định bước. */
export interface MessageLike {
  readonly id: string;
  readonly role: string;
  readonly content: readonly ContentBlockLike[];
  readonly source: Record<string, unknown>;
}

/** Quyết định bước mà hook trả (messages chỉ có ở nhánh enter). */
export interface DecisionLike {
  readonly kind: string;
  readonly messages?: readonly MessageLike[];
  readonly [key: string]: unknown;
}

/** Waterfall listener đã đăng ký. */
export type Hook = (payload: unknown, next: () => Promise<DecisionLike>) => Promise<DecisionLike>;

/** Định nghĩa công cụ đã đăng ký. */
export interface ToolLike {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
  readonly output: {
    readonly schema: unknown;
    render(args: unknown, value: unknown): readonly ContentBlockLike[];
  };
  execute(args: unknown, exec: unknown): Promise<unknown>;
  presentCall?(args: unknown): unknown;
}

/** Ngữ cảnh thực thi giả. */
export interface ExecLike {
  readonly agent?: unknown;
  readonly signal: AbortSignal;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  readonly tools: ToolLike[];
  readonly hooks: Hook[];
  readonly events: string[];
  readonly ensureCalls: { readonly agent: unknown; readonly signal: AbortSignal }[];
  readonly listLookups: unknown[];
  readonly getCalls: { readonly name: string; readonly lookup: unknown }[];
  readonly snapshotCalls: unknown[];
  readonly registered: () => ToolLike | undefined;
}

/** Tuỳ chọn dựng giàn. */
interface InstallOptions {
  readonly config?: unknown;
  readonly cwd?: string;
  readonly list?: (lookup: unknown) => Promise<readonly SkillSummary[]>;
  readonly get?: (name: string, lookup: unknown) => Promise<SkillDefinition | undefined>;
  readonly snapshot?: (options: unknown) => Promise<{ readonly skills: readonly SkillSummary[]; readonly complete: boolean }>;
  readonly toolLookup?: (name: string, agent: unknown) => unknown;
}

/** Tóm tắt alpha — model + người đều gọi được. */
export const ALPHA: SkillSummary = { name: "alpha", description: "Alpha skill", invocation: { modelInvocable: true, userInvocable: true } };
/** Tóm tắt beta — CHỈ người gọi được. */
export const BETA: SkillSummary = { name: "beta", description: "Beta skill", invocation: { modelInvocable: false, userInvocable: true } };
/** Tóm tắt gamma — model gọi được nhưng NGƯỜI không. */
export const GAMMA: SkillSummary = { name: "gamma", description: "Gamma skill", invocation: { modelInvocable: true, userInvocable: false } };
/** Định nghĩa alpha đầy đủ. */
export const ALPHA_DEFINITION: SkillDefinition = { ...ALPHA, provider: "provider-a", content: "# Alpha body" };
/** Định nghĩa beta đầy đủ (model không gọi được). */
export const BETA_DEFINITION: SkillDefinition = { ...BETA, provider: "provider-b", content: "beta body" };
/** Danh sách tóm tắt mặc định của giàn. */
export const DEFAULT_SUMMARIES: readonly SkillSummary[] = [ALPHA, BETA, GAMMA];
/** Định nghĩa mặc định theo tên. */
export const DEFAULT_DEFINITIONS: Readonly<Record<string, SkillDefinition>> = {
  alpha: ALPHA_DEFINITION,
  beta: BETA_DEFINITION,
  gamma: { ...GAMMA, provider: "provider-g", content: "gamma body" },
};
/** Mô tả dài 600 ký tự dùng cho ca cắt mô tả. */
export const LONG_DESCRIPTION = "x".repeat(600);
/** Ký tự backtick, dùng để dựng chuỗi kỳ vọng của catalog. */
export const TICK = String.fromCharCode(96);

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-skill-"));
  artifact = await buildPackage(outDir);
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
export const stock = (await import(STOCK)) as unknown as PluginLike;
/** Bản của ta nhìn qua CÙNG hình dạng để so hai bên. */
export const mine = oursModule as unknown as PluginLike;
/** Lớp `Schema` THẬT của schemastery (default export của gói): dùng cho phép thử `instanceof`. */
export const SchemaClass = (await import(SCHEMASTER)).default as abstract new (...args: never[]) => object;

/** Liệt kê tên export của một file ESM đã build; trả mảng đã sắp xếp. */
export function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    const name = match[1];
    if (name !== undefined) out.add(name);
  }
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    const body = match[1] ?? "";
    for (const part of body.split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/** Dựng giàn giả với bốn service plugin chạm tới; options thay hành vi service. */
export function install(plugin: PluginLike, options: InstallOptions = {}): Harness {
  const tools: ToolLike[] = [];
  const hooks: Hook[] = [];
  const events: string[] = [];
  const ensureCalls: { readonly agent: unknown; readonly signal: AbortSignal }[] = [];
  const listLookups: unknown[] = [];
  const getCalls: { readonly name: string; readonly lookup: unknown }[] = [];
  const snapshotCalls: unknown[] = [];
  let registered: ToolLike | undefined;
  const ctx = {
    workingDirectory: {
      async ensure(agent: unknown, signal: AbortSignal): Promise<string> {
        ensureCalls.push({ agent, signal });
        return options.cwd ?? "/cwd";
      },
    },
    tools: {
      register(tool: unknown): () => void {
        registered = tool as ToolLike;
        tools.push(tool as ToolLike);
        return () => undefined;
      },
      get(): unknown {
        return options.toolLookup === undefined ? registered : options.toolLookup("skill", undefined);
      },
    },
    skills: {
      async list(lookup: unknown): Promise<readonly SkillSummary[]> {
        listLookups.push(lookup);
        return options.list === undefined ? DEFAULT_SUMMARIES : options.list(lookup);
      },
      async get(name: string, lookup: unknown): Promise<SkillDefinition | undefined> {
        getCalls.push({ name, lookup });
        return options.get === undefined ? DEFAULT_DEFINITIONS[name] : options.get(name, lookup);
      },
      async snapshot(snapshotOptions: unknown): Promise<{ readonly skills: readonly SkillSummary[]; readonly complete: boolean }> {
        snapshotCalls.push(snapshotOptions);
        return options.snapshot === undefined
          ? { skills: DEFAULT_SUMMARIES, complete: true }
          : options.snapshot(snapshotOptions);
      },
    },
    on(event: string, handler: Hook): void {
      events.push(event);
      if (event === "agent/pre-step") hooks.push(handler);
    },
  };
  plugin.apply(ctx, options.config === undefined ? plugin.Config({}) : options.config);
  return {
    tools,
    hooks,
    events,
    ensureCalls,
    listLookups,
    getCalls,
    snapshotCalls,
    registered: (): ToolLike | undefined => registered,
  };
}

/** Lấy định nghĩa công cụ DUY NHẤT đã đăng ký; ném khi plugin không đăng ký công cụ nào. */
export function toolOf(harness: Harness): ToolLike {
  const tool = harness.tools[0];
  if (tool === undefined) throw new Error("plugin không đăng ký công cụ nào");
  return tool;
}

/** Lấy hook agent/pre-step theo chỉ số; ném khi hook chưa được đăng ký. */
export function hookAt(harness: Harness, index: number): Hook {
  const hook = harness.hooks[index];
  if (hook === undefined) throw new Error("plugin không đăng ký hook " + String(index));
  return hook;
}

/** Một agent giả mang phiên đọc được lịch sử. */
interface AgentStub {
  readonly id: string;
  readonly session: {
    readonly seq: number;
    readonly surface: { readonly nodes: readonly number[] };
    eventAt(index: number): unknown;
  };
}

/** Dựng agent giả từ danh sách sự kiện + các seq đang nhìn thấy. */
export function agentWith(events: readonly unknown[] = [], nodes: readonly number[] = []): AgentStub {
  return {
    id: "agent-1",
    session: {
      seq: events.length,
      surface: { nodes },
      eventAt(index: number): unknown {
        return events[index];
      },
    },
  };
}

/** Dựng payload waterfall agent/pre-step. */
export function payload(messages: readonly MessageLike[], agent: unknown, signal: AbortSignal): unknown {
  return { agent, messages, turn: 1, step: 1, signal };
}

/** Dựng một user message thật; id mặc định cố định. */
export function userMessage(text: string, id = "u-1"): MessageLike {
  return { id, role: "user", content: [{ type: "text", text }], source: { kind: "user" } };
}

/** Dựng một message catalog đã có trong batch. */
export function catalogMessage(id: string, entries: readonly CatalogEntry[]): MessageLike {
  return {
    id,
    role: "user",
    content: [{ type: "text", text: "catalog " + id }],
    source: { kind: "skill-catalog", form: "catalog", entries },
  };
}

/** Dựng một sự kiện user/message mang catalog bền vững. */
export function catalogEvent(seq: number, entries: readonly CatalogEntry[]): unknown {
  return { seq, type: "user/message", data: { source: { kind: "skill-catalog", form: "catalog", entries } } };
}

/** Bỏ id khỏi mọi message để so hai bản (id là UUID ngẫu nhiên ở cả hai). */
export function normalized(decision: DecisionLike): unknown {
  if (decision.messages === undefined) return decision;
  return {
    ...decision,
    messages: decision.messages.map((message) => {
      const copy: Record<string, unknown> = { ...message };
      delete copy.id;
      return copy;
    }),
  };
}

/** Chạy một lời gọi execute và trả { value } hoặc { errorName, errorMessage }. */
export async function runExecute(
  tool: ToolLike,
  args: unknown,
  exec: ExecLike,
): Promise<{ readonly value?: unknown; readonly errorName?: string; readonly errorMessage?: string }> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    const failure = error as Error;
    return { errorName: failure.constructor.name, errorMessage: failure.message };
  }
}

/** Đọc thông điệp lỗi của một phép gọi đồng bộ; trả "không ném" khi không ném. */
export function messageOf(action: () => unknown): string {
  try {
    action();
    return "không ném";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Đường dẫn artifact đã build trong lượt chạy hiện tại (gán trong beforeAll của harness).
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối tới lib/index.js vừa build.
 */
export function artifactPath(): string {
  return artifact;
}

/**
 * Bảo đảm artifact đã được build (idempotent) — dùng trong beforeAll của file test.
 * Nhận: không.
 * Trả: đường dẫn artifact.
 */
export async function prepareArtifact(): Promise<string> {
  if (artifact === "") {
    outDir = mkdtempSync(join(tmpdir(), "gbh-tool-skill-"));
    artifact = await buildPackage(outDir);
  }
  return artifact;
}
