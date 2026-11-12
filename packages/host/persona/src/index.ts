/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cổng 1:1 của @deepseek-ai/dsh-persona (stock lib/index.js 50 dòng + lib/types/index.d.ts
 *      50 dòng, host-only): row persona theo phạm vi (scope-only) đăng ký HAI section
 *      deployment:persona-prefix / deployment:persona-suffix qua ctx.effect và tắt runtime-context
 *      khi includeRuntimeContext = false — giữ nguyên name, inject, schema và hành vi bản gốc.
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION } from "@galaxy-blackhole/gbh-system-prompt";
// Nạp AUGMENTATION của module stock (declare module "@deepseek-ai/cordis" ⇒ Context.systemPrompt): chỉ mượn KIỂU,
// không tạo thể hiện thứ hai — §2c (id mang augmentation được giữ ở dạng type-only).
import type {} from "@deepseek-ai/dsh-system-prompt";

/**
 * Tên hai section mà row này đăng ký — re-export NGUYÊN VĂN từ @deepseek-ai/dsh-system-prompt
 * (stock lib/index.js dòng 50): "deployment:persona-prefix" và "deployment:persona-suffix".
 */
export { PERSONA_PREFIX_SECTION, PERSONA_SUFFIX_SECTION };

/** Cordis plugin name. */
export const name = "persona";

/** The prompt registry this row contributes to. */
export const inject: string[] = ["systemPrompt"];

/**
 * Plugin config: the persona text this composition contributes.
 */
export interface Config {
  /**
   * Persona prose rendered as the `deployment:persona-prefix` section. A template:
   * complete `{{…}}` groups interpolate strictly against registered prompt
   * variables. Empty text drops the section at render, matching the registry.
   */
  prefix: string;
  /**
   * Persona suffix template rendered after first-party guidance. Omitted or empty
   * text shadows the deployment suffix away; interpolation is strict.
   */
  suffix?: string;
  /** Make the prefix the complete system prompt, suppressing the suffix and every other section. */
  complete?: boolean;
  /** Suppress dynamic runtime-context snapshots for this persona's agent scope. */
  includeRuntimeContext?: boolean;
}

/** Runtime schema for the persona row. */
export const Config: z<Config> = z.object({
  prefix: z.string().required(),
  suffix: z.string().default(""),
  complete: z.boolean().default(false),
  includeRuntimeContext: z.boolean().default(true),
});

/**
 * Register the persona prefix and suffix sections for the mounting context's scope.
 * Nhận: ctx — một context có phạm vi agent (context không có phạm vi sẽ đụng đăng ký persona
 * của chính prompt registry và bị từ chối); config — prefix, suffix và chính sách complete.
 * Trả: void — hai đăng ký được treo bằng ctx.effect (nhãn "persona.section()" và
 * "persona.suffix()"), và runtime-context bị tắt khi includeRuntimeContext = false.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_PREFIX_SECTION,
    order: ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_PREFIX"),
    text: config.prefix,
    ...(config.complete ? { complete: true } : {}),
  }), "persona.section()");
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SUFFIX_SECTION,
    order: ctx.systemPrompt.getSectionOrder("DEPLOYMENT_PERSONA_SUFFIX"),
    text: config.suffix ?? "",
  }), "persona.suffix()");
  if (!(config.includeRuntimeContext ?? true)) ctx.systemPrompt.suppressRuntimeContext();
}
