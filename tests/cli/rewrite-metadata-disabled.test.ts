/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test renderer `disabled` — phải sinh YAML HỢP LỆ cho row tắt-có-điều-kiện (giống DSH)
 */
import { describe, expect, test } from "bun:test";
import { parse } from "../../apps/host/node_modules/yaml/dist/index.js";
import { renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata";

describe("renderRewriteBlock · disabled", () => {
  test("bo trong => disabled: true (tat row stock nhu cu)", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-x", { id: "x" });
    expect(yaml).toContain("  disabled: true");
    const parsed = parse(yaml) as { disabled?: unknown }[];
    expect(parsed[0]?.disabled).toBe(true);
  });

  test("disabled: false => ghi false, KHONG tat", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-x", { id: "x", disabled: false });
    expect(yaml).toContain("  disabled: false");
    const parsed = parse(yaml) as { disabled?: unknown }[];
    expect(parsed[0]?.disabled).toBe(false);
  });

  test("disabled kieu { js } => !!js va YAML PARSE DUOC (khong hong)", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-pwsh-sandbox", {
      id: "pwsh-sandbox",
      disabled: { js: "process.platform !== 'win32'" },
    });
    // YAML phai parse duoc — day la phep kiem chinh (su co 17/10: !!js chua ' : ' lam hong YAML)
    expect(() => parse(yaml)).not.toThrow();
    // Bieu thuc phai con nguyen trong van ban patch
    expect(yaml).toContain("process.platform !== 'win32'");
    expect(yaml).toContain("!!js");
  });

  test("insertDisabled: true => row CHEN co disabled: true (mirror row stock dang tat)", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-session-title-first-prompt-llm", {
      id: "session-title-llm",
      insertDisabled: true,
    });
    // renderRewriteBlock phat HAI khoi YAML (row stock + insert) => parse tra ve mang 2 phan tu.
    const parsed = parse(yaml) as { disabled?: unknown }[];
    expect(parsed[0]?.disabled).toBe(true);
    const insertBlock = parsed[1] as { insert?: { disabled?: unknown }[] } | undefined;
    expect(insertBlock?.insert?.[0]?.disabled).toBe(true);
  });

  test("insertDisabled kieu { js } => !!js trong khoi insert va YAML parse duoc", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-x", {
      id: "x",
      insertDisabled: { js: "process.platform !== 'win32'" },
    });
    expect(() => parse(yaml)).not.toThrow();
    expect(yaml).toContain("!!js");
  });

  test("khong khai insertDisabled => khoi insert KHONG co disabled (giu nguyen hanh vi cu)", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-x", { id: "x" });
    const parsed = parse(yaml) as { insert?: { disabled?: unknown }[] }[];
    expect(parsed[1]?.insert?.[0]?.disabled).toBeUndefined();
  });

  test("disabled { js } chua ' : ' van quote => YAML parse duoc", () => {
    const yaml = renderRewriteBlock("@galaxy-blackhole/gbh-y", {
      id: "y",
      disabled: { js: "process.env.M === 'a' ? true : false" },
    });
    expect(() => parse(yaml)).not.toThrow();
    expect(yaml).toContain("!!js");
  });
});

