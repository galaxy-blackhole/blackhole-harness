/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test task-152 — FAIL-SOFT khi inspector source closed: artefact mang sai lệch có chủ đích, normalize đảo
 *      ngược về đúng stock (cổng byte), normalize NÉM khi 0/2 khối, setState KHÔNG ném + warn đúng 1 lần.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyHostDeviation, normalizeHostDeviation } from "../../packages/host/experimental-inspector/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Artefact host của ta. */
const OUR_HOST = join(REPO, "packages/host/experimental-inspector/lib/index.js");
/** Bundle stock CHỈ ĐỌC. */
const STOCK_HOST = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-experimental-inspector/lib/index.js");

describe("task-152 · fail-soft source closed (chống chết host)", () => {
  test("artefact có ĐÚNG 1 khối fail-soft + 1 field closedLogged; normalize ⇒ khớp byte stock", () => {
    const ours = readFileSync(OUR_HOST, "utf8");
    const stock = readFileSync(STOCK_HOST, "utf8");
    expect(ours.split("bo qua setState").length - 1).toBe(1);
    expect(ours.split("closedLogged = false;").length - 1).toBe(1);
    expect(normalizeHostDeviation(ours)).toBe(stock);
  });

  test("applyHostDeviation(stock) === artefact của ta (sai lệch đúng 1 chỗ, tất định)", () => {
    const stock = readFileSync(STOCK_HOST, "utf8");
    const ours = readFileSync(OUR_HOST, "utf8");
    expect(applyHostDeviation(stock)).toBe(ours);
  });

  test("normalize NÉM khi khối xuất hiện 0 lần hoặc 2 lần", () => {
    const stock = readFileSync(STOCK_HOST, "utf8");
    expect(() => normalizeHostDeviation(stock)).toThrow();
    expect(() => normalizeHostDeviation(applyHostDeviation(applyHostDeviation(stock)))).toThrow();
  });

  test("khối fail-soft đứng TRƯỚC lời gọi records.setState + có warn 1 lần trong mã", () => {
    const text = readFileSync(OUR_HOST, "utf8");
    const blockIndex = text.indexOf("bo qua setState");
    const callIndex = text.indexOf("this.records.setState(topic, payload, monotonicMs)", blockIndex);
    expect(blockIndex).toBeGreaterThan(0);
    expect(callIndex).toBeGreaterThan(blockIndex);
    // sau khi normalize về stock thì KHÔNG còn khối fail-soft
    expect(normalizeHostDeviation(text).includes("bo qua setState")).toBe(false);
  });
});
