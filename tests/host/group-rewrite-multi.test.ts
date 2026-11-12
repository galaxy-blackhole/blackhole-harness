/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test 2 PHA của renderGroupRewriteBlocksSingle: NHIỀU gói ta cùng nằm trong MỘT row cordis:group thì chỉ
 *      phát ĐÚNG MỘT khối insert, thay TẤT CẢ stockId thuộc nhóm, giữ isolate/config, fail-soft khi thiếu 1 gói,
 *      và tương thích ngược với ca 1-redirect/group (ADR 0011 · cụm terminal task-128).
 */
import { describe, expect, test } from "bun:test";
import { renderGroupRewriteBlocks } from "../../apps/cli/src/profile.ts";

/** Group persistent-shell THU NHỎ theo đúng hình dạng dump: 3 con thuộc cụm terminal + 2 con CHƯA khai. */
const SOURCE = [
  "- id: preset-standard",
  "  name: '@deepseek-ai/dsh-agent-preset'",
  "  config:",
  "    id: standard",
  "    plugins:",
  "      - id: persistent-shell",
  "        name: cordis:group",
  "        group: true",
  "        isolate:",
  "          terminals: true",
  "        config:",
  "          - id: pty",
  "            name: '@deepseek-ai/dsh-terminal'",
  "          - id: terminal-bash",
  "            name: '@deepseek-ai/dsh-terminal-bash'",
  "            config:",
  "              timeoutMs: 300000",
  "          - id: persistent-bash",
  "            name: '@deepseek-ai/dsh-tool-bash-persistent'",
  "          - id: terminal-pwsh",
  "            name: '@deepseek-ai/dsh-terminal-bash'",
  "            config:",
  "              shellDialect: pwsh",
  "          - id: persistent-pwsh",
  "            name: '@deepseek-ai/dsh-tool-pwsh-persistent'",
  "            disabled: !!js process.platform !== 'win32'",
  "- id: optional-persistent-terminals",
  "  name: cordis:group",
  "  group: true",
  "  isolate:",
  "    terminals: true",
  "  config:",
  "    - id: optional-terminal-registry",
  "      name: '@deepseek-ai/dsh-terminal'",
  "    - id: optional-tool-terminal",
  "      name: '@deepseek-ai/dsh-tool-terminal'",
].join("\n");

/** 3 redirect cùng group persistent-shell. */
const THREE = [
  { stockId: "@deepseek-ai/dsh-terminal", specifier: "@galaxy-blackhole/gbh-terminal", kind: "group" as const },
  { stockId: "@deepseek-ai/dsh-terminal-bash", specifier: "@galaxy-blackhole/gbh-terminal-bash", kind: "group" as const },
  { stockId: "@deepseek-ai/dsh-tool-bash-persistent", specifier: "@galaxy-blackhole/gbh-tool-bash-persistent", kind: "group" as const },
];

describe("2 pha · NHIỀU gói trong CÙNG một cordis:group", () => {
  test("3 gói cùng group thì ĐÚNG MỘT khối, thay CẢ 3 name, giữ isolate/config", () => {
    const result = renderGroupRewriteBlocks(SOURCE, THREE);
    expect(result.warnings).toEqual([]);
    // dsh-terminal + dsh-terminal-bash còn nằm ở group thứ hai ⇒ 2 khối (mỗi group đúng 1 lần).
    expect(result.blocks).toHaveLength(2);
    const block = result.blocks.find((item) => item.includes("- id: persistent-shell")) ?? "";
    expect(block).toContain("- id: persistent-shell\n  disabled: true");
    expect(block).toContain("- insert:\n    - id: persistent-shell-ours\n      name: cordis:group");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-terminal'");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-terminal-bash'");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-tool-bash-persistent'");
    expect(block).toContain("name: '@deepseek-ai/dsh-tool-pwsh-persistent'");
    expect(block).toContain("isolate:");
    expect(block).toContain("terminals: true");
    expect(block).toContain("timeoutMs: 300000");
    expect(block).toContain("shellDialect: pwsh");
    expect(block.includes("optional-persistent-terminals")).toBe(false);
  });

  test("FAIL-SOFT: 1 gói không tìm thấy thì 1 cảnh báo, khối vẫn thay 2 gói còn lại", () => {
    const result = renderGroupRewriteBlocks(SOURCE, [
      THREE[0]!,
      { stockId: "@deepseek-ai/dsh-khong-ton-tai", specifier: "@galaxy-blackhole/gbh-x", kind: "group" },
      THREE[1]!,
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0] ?? "").toContain("khong thay dong name");
    expect(result.blocks).toHaveLength(2);
    const block = result.blocks.find((item) => item.includes("- id: persistent-shell")) ?? "";
    expect(block).toContain("name: '@galaxy-blackhole/gbh-terminal'");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-terminal-bash'");
  });

  test("TƯƠNG THÍCH NGƯỢC: 1 redirect/group (stockId chỉ nằm ở 1 nhóm) cho khuôn khối y như trước", () => {
    // dsh-tool-bash-persistent CHỈ nằm ở persistent-shell ⇒ đúng 1 khối, các anh em giữ stock.
    const result = renderGroupRewriteBlocks(SOURCE, [THREE[2]!]);
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] ?? "";
    expect(block.startsWith("# Thay row NHOM persistent-shell")).toBe(true);
    expect(block).toContain("- id: persistent-shell\n  disabled: true");
    expect(block).toContain("- insert:\n    - id: persistent-shell-ours");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-tool-bash-persistent'");
    expect(block).toContain("name: '@deepseek-ai/dsh-terminal'");
    expect(block).toContain("name: '@deepseek-ai/dsh-terminal-bash'");
  });

  test("HAI group khác nhau thì 2 khối, mỗi group đúng 1 lần", () => {
    const result = renderGroupRewriteBlocks(SOURCE, [
      THREE[0]!,
      { stockId: "@deepseek-ai/dsh-tool-terminal", specifier: "@galaxy-blackhole/gbh-tool-terminal", kind: "group" },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    const ids = result.blocks.map((block) => (block.split("\n")[1] ?? "").trim()).sort();
    expect(ids).toEqual(["- id: optional-persistent-terminals", "- id: persistent-shell"]);
    const optional = result.blocks.find((block) => block.includes("- id: optional-persistent-terminals")) ?? "";
    expect(optional).toContain("name: '@galaxy-blackhole/gbh-tool-terminal'");
    expect(optional).toContain("terminals: true");
  });

  test("idempotent + KHÔNG sửa tham số vào", () => {
    const first = renderGroupRewriteBlocks(SOURCE, THREE);
    const second = renderGroupRewriteBlocks(SOURCE, THREE);
    expect(SOURCE).toContain("name: '@deepseek-ai/dsh-terminal'");
    expect(second.blocks).toEqual(first.blocks);
    expect(second.warnings).toEqual(first.warnings);
  });

  test("MỘT stockId nằm trong HAI nhóm thì cả HAI nhóm đều được thay (dsh-terminal)", () => {
    const result = renderGroupRewriteBlocks(SOURCE, [THREE[0]!]);
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toHaveLength(2);
    const shell = result.blocks.find((block) => block.includes("- id: persistent-shell")) ?? "";
    const optional = result.blocks.find((block) => block.includes("- id: optional-persistent-terminals")) ?? "";
    expect(shell).toContain("name: '@galaxy-blackhole/gbh-terminal'");
    expect(optional).toContain("name: '@galaxy-blackhole/gbh-terminal'");
  });

  test("cha KHÔNG phải cordis:group thì cảnh báo, không ném", () => {
    const plain = [
      "- id: preset-x",
      "  name: '@deepseek-ai/dsh-agent-preset'",
      "  config:",
      "    - id: child",
      "      name: '@deepseek-ai/dsh-terminal'",
    ].join("\n");
    const result = renderGroupRewriteBlocks(plain, [THREE[0]!]);
    expect(result.blocks).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
