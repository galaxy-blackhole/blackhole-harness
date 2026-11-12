/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row ui-settings-account: phat tuy chon bang hoi cong khai truoc khi plugin phia browser kich hoat
 */

import z from "@deepseek-ai/schemastery";
import { CONTACT_CONFIG_GLOBAL } from "./ids.ts";

/** Tu chon cau hinh cua plugin, do Loader ap mac dinh cua schema truoc khi goi apply. */
export interface ConfigShape {
  /** Dia chi bang hoi khach hang (phai la https). */
  readonly contactFormUrl: string;
  /** Nhan nguon cua bang hoi. */
  readonly contactSource: string;
  /** Do tre thu lai xac nhan thuong (ms). */
  readonly bonusAckRetryDelayMs: number;
  /** Tran do tre thu lai xac nhan thuong (ms). */
  readonly bonusAckRetryMaxDelayMs: number;
}

/**
 * Schema cau hinh cua plugin — schemastery, de Settings/config-editor cua kernel render duoc field.
 *
 * Giu nguyen nhu ban goc: bon truong cua ContactConfigFields (pattern https + default dia chi Feishu,
 * contactSource rong, 1e3 va 6e4), kem bay truong onboarding "volatile" (version · step · purpose ·
 * process · completion · usage · developerTools) — volatile nghia la KHONG ghi vao tai lieu settings,
 * vi tien do onboarding da duoc ghi qua form rieng cua chinh plugin.
 */
export const Config = z.object({
  contactFormUrl: z.string().pattern(/^https:\/\/[^/\s]+\//).default("https://trtgsjkv6r.feishu.cn/share/base/form/shrcnlCoGElW7MQznGy9r3YYXcg?hide_uid=1&hide_device_info=1&hide_harness_version=1"),
  contactSource: z.string().default(""),
  bonusAckRetryDelayMs: z.number().min(1).default(1000),
  bonusAckRetryMaxDelayMs: z.number().min(1).default(60000),
  version: z.const(1).default(1).volatile(),
  step: z.union(["welcome", "credit", "purpose", "process", "done"]).default("welcome").volatile(),
  purpose: z.union(["office", "development", "both", z.const(null)]).volatile(),
  process: z.union(["compact", "standard", "detailed", z.const(null)]).volatile(),
  completion: z.union(["completed", "skipped", "api-key", z.const(null)]).volatile(),
  usage: z.union(["compact", "detailed"]).default("compact").volatile(),
  developerTools: z.boolean().default(false).volatile(),
});

/** Mot dong trong bang du lieu khoi tao trang cua webserver. */
export interface IndexInjectEntry {
  /** Loai gia tri: hang toan cuc cua trang. */
  readonly kind: "global";
  /** Ten bien toan cuc. */
  readonly name: string;
  /** Gia tri cong khai, khong kem credential. */
  readonly value: {
    /** Dia chi bang hoi. */
    readonly contactFormUrl: string;
    /** Nhan nguon. */
    readonly contactSource: string;
    /** Do tre thu lai xac nhan thuong. */
    readonly bonusAckRetryDelayMs: number;
    /** Tran do tre thu lai xac nhan thuong. */
    readonly bonusAckRetryMaxDelayMs: number;
  };
}

/** Be mat context phia host ma row nay dung. */
export interface HostCtx {
  /** Tiem them dich vu roi chay than callback voi pham vi da co du dich vu. */
  inject(names: readonly string[], run: (scope: HostCtx) => void): void;
  /** Dang ky hieu ung vong doi. */
  effect(run: () => void, label?: string): void;
  /** Cau hinh plugin chay o che do khong tu dong. */
  settings: { configure(options: { auto: boolean }, fiber: unknown): void };
  /** Fiber cua context (dung cho settings.configure). */
  fiber: unknown;
  /** Nghe mot su kien cua kernel; row nay chi dung webserver/index-inject. */
  on(event: "webserver/index-inject", run: (table: IndexInjectEntry[]) => void): void;
}

/**
 * Diem vao nua host: phat tuy chon bang hoi cong khai truoc khi plugin phia browser kich hoat.
 * @param ctx - context phia host.
 * @param config - tuy chon plugin sau khi Loader ap mac dinh cua schema.
 * @returns khong.
 */
export function apply(ctx: HostCtx, config: ConfigShape): void {
  ctx.inject(["settings"], (scope) => {
    scope.effect(() => scope.settings.configure({ auto: false }, ctx.fiber));
  });
  ctx.on("webserver/index-inject", (table) => {
    table.push({
      kind: "global",
      name: CONTACT_CONFIG_GLOBAL,
      value: {
        contactFormUrl: config.contactFormUrl,
        contactSource: config.contactSource,
        bonusAckRetryDelayMs: config.bonusAckRetryDelayMs,
        bonusAckRetryMaxDelayMs: config.bonusAckRetryMaxDelayMs,
      },
    });
  });
}
