/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Chính sách tràn ngữ cảnh: giữ kết quả tool trong ngân sách token ước lượng — chép bản đầy đủ
 *      vào kho tràn, giữ hai đầu nội dung, và phát thông báo có đường dẫn đọc lại. Bản viết lại của
 *      Galaxy Blackhole cho row spill-policy (@deepseek-ai/dsh-spill-policy) — nguồn đối chiếu: README.md.
 */

import z from "@deepseek-ai/schemastery";
import { createUserMessage, resolveImageAttachmentAccess } from "@galaxy-blackhole/gbh-llm";
import { estimateContent } from "@galaxy-blackhole/gbh-token-meter/estimate";
import type { ContentBlock, ImageBlock, LlmImageRequestPricing, TextBlock } from "@galaxy-blackhole/gbh-llm";
import { formatSpillNotice } from "./notice.ts";
import { retainContent } from "./retention.ts";
import type { RetainableBlock } from "./retention.ts";
import type { SpillPolicyContext, SpillPolicyExec, SpillRef, SpillStoreSeam } from "./types.ts";

export type { SpillPolicyExec } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "spill-policy";

/** Service bắt buộc: sổ tool (`tools`) — chính sách là listener trên hai ranh giới của nó. */
export const inject: string[] = ["tools"];

/** Cấu hình của row — cùng hình dạng với bản gốc (một trường tuỳ chọn). */
export interface Config {
  /**
   * Trần token ước lượng của một kết quả giữ lại, tính cả mô tả ảnh và thông báo tràn.
   * Vắng mặt nghĩa là TẮT chính sách; số âm hay số lẻ làm plugin ném lúc nạp.
   */
  maxInlineTokens?: number;
}

/** Schema cấu hình lúc chạy cho {@link Config}: đúng một trường số, không mặc định (như bản gốc). */
export const Config: z<Config> = z.object({ maxInlineTokens: z.number() }) as unknown as z<Config>;

/** Dấu ngăn giữa hai đầu đã giữ — một khối chữ như bản gốc. */
const GAP: TextBlock = { type: "text", text: "\n\n[...]\n\n" };

/**
 * Thu hẹp nội dung có thứ tự mà chính sách viết lại được: chỉ chữ và ảnh, KHÔNG đụng khối lạ.
 * Nhận: nội dung canonical của một kết quả tool.
 * Trả: `true` khi mọi khối đều là chữ hoặc ảnh (khi đó nội dung giữ được hai đầu).
 */
function retainable(content: readonly ContentBlock[]): content is readonly RetainableBlock[] {
  return content.every((block) => block.type === "text" || block.type === "image");
}

/**
 * Lắp chính sách giữ token cho kết quả tool đã được nhận và cho bản chép log PTC.
 * Nhận: context có sổ tool, định giá ảnh, kho tệp/đính kèm và kho tràn tuỳ chọn; cùng cấu hình
 * (trần token ước lượng; vắng `maxInlineTokens` thì plugin không đăng ký gì).
 * Trả: không; đăng ký hai listener waterfall — mọi lỗi tràn đều là best-effort (ghi cảnh báo và giữ
 * nguyên nội dung inline), riêng cấu hình sai thì NÉM ngay lúc nạp.
 */
export function apply(ctx: SpillPolicyContext, config: Config): void {
  const cap = config.maxInlineTokens;
  if (cap === undefined) return;
  if (!Number.isSafeInteger(cap) || cap < 0) {
    throw new Error("spill-policy: maxInlineTokens must be a non-negative integer (got " + String(cap) + ")");
  }
  const maxTokens = cap;

  /**
   * Định giá ảnh THẬT của request cùng phần chữ mô tả đi kèm, và định giá chữ bằng mét của kernel.
   * Nhận: lượt gọi tool (để tra tuyến model) và danh sách ảnh của nội dung đang xét.
   * Trả: hàm định giá một khối đã giữ; ảnh chưa có giá thì trả `NaN` (cùng ngữ nghĩa số học với bản
   * gốc, nơi hàm trả `undefined` — mọi phép so và phép tổng của mặt cắt này đều cho cùng kết quả).
   */
  function pricing(exec: SpillPolicyExec, images: readonly ImageBlock[]): (block: RetainableBlock) => number {
    const costs = new Map<ImageBlock, number>();
    if (images.length > 0) {
      const routed = exec.agent?.session.requestHeader()?.config;
      const provider = routed?.provider ?? exec.agent?.options.provider;
      const model = routed?.model ?? exec.agent?.options.model;
      const calculator: LlmImageRequestPricing | undefined =
        provider === undefined || model === undefined ? undefined : ctx.get("llm")?.imageRequestPricing(provider, model);
      if (calculator === undefined) throw new Error("the current model has no image token calculator");
      const prices = calculator.priceImages(images);
      if (prices.length !== images.length) throw new Error("image token calculator returned an inconsistent occurrence count");
      for (const [index, image] of images.entries()) {
        const cost = prices[index];
        if (cost === undefined) continue;
        costs.set(image, cost.visualTokens + estimateContent([{ type: "text", text: cost.text }]));
      }
    }
    return (block) => {
      if (block.type === "image") return costs.get(block) ?? Number.NaN;
      return estimateContent([block]);
    };
  }

  /**
   * Toàn bộ chữ của nội dung, kèm một dòng mô tả ảnh (có đường dẫn đọc được) ở mỗi vị trí ảnh.
   * Nhận: các khối chữ/ảnh đã giữ.
   * Trả: chữ ghép theo đúng thứ tự gốc; NÉM khi một ảnh không có đường dẫn đọc lại.
   */
  function fullText(content: readonly RetainableBlock[]): string {
    return content
      .map((block) => {
        if (block.type === "text") return block.text;
        const attachments = ctx.get("attachments");
        const fs = ctx.get("fs");
        // Vật mang `AttachmentStore` do kernel cấp: ta chỉ khai mặt cắt cấu trúc của nó.
        const access =
          attachments === undefined || fs === undefined
            ? undefined
            : resolveImageAttachmentAccess(
                attachments as unknown as Parameters<typeof resolveImageAttachmentAccess>[0],
                (hostPath) => fs.processPathFromHostPath(hostPath),
                block.attachment,
              );
        if (access === undefined) throw new Error("image " + String(block.attachment.attachmentId) + " has no readable attachment path");
        return (
          "\n[Image: " +
          JSON.stringify(access.readonlyPath) +
          "; " +
          block.attachment.mediaType +
          "; " +
          String(block.attachment.width) +
          "x" +
          String(block.attachment.height) +
          ". Use read_image to view it.]\n"
        );
      })
      .join("");
  }

  /**
   * Giới hạn MỘT bản hiển thị một cách CÓ THỂ KHÔI PHỤC; lỗi thì để nguyên nội dung tool đã thành công.
   * Nhận: lượt gọi tool, nội dung canonical, tên tool, mã lượt gọi, và nhãn bản ghi.
   * Trả: nội dung đã giới hạn (hai đầu + dấu ngăn + thông báo), hoặc `undefined` khi không cần/không
   * được giới hạn (trong ngân sách, khối lạ, hoặc lỗi đã ghi cảnh báo).
   */
  async function bound(
    exec: SpillPolicyExec,
    content: readonly ContentBlock[],
    toolName: string,
    callId: string,
    label: string,
  ): Promise<ContentBlock[] | undefined> {
    if (!retainable(content)) return undefined;
    try {
      const images = content.filter((block): block is ImageBlock => block.type === "image");
      const price = pricing(exec, images);
      if (content.reduce((total, block) => total + price(block), 0) <= maxTokens) return undefined;
      const owner = exec.agent?.session.header.id;
      if (owner === undefined) throw new Error("no session owner for " + toolName + " " + label);
      const spillStore: SpillStoreSeam | undefined = ctx.get("spillStore");
      if (spillStore === undefined) throw new Error("no ctx.spillStore backend loaded");
      const ref: SpillRef = await spillStore.saveText({
        owner: { sessionId: owner },
        source: { kind: "tool", toolName, callId, label },
        suggestedName: toolName + ".txt",
        content: fullText(content),
      });
      const textBytes = (blocks: readonly RetainableBlock[]): number =>
        blocks.reduce((total, block) => total + (block.type === "text" ? Buffer.byteLength(block.text, "utf8") : 0), 0);
      const totalBytes = textBytes(content);
      const notice = (bytes: number, count: number): TextBlock => ({
        type: "text",
        text: formatSpillNotice({ kind: "exact", count: bytes }, ref, count),
      });
      const worstNotice = notice(totalBytes, images.length);
      const reserved = price(GAP) + price({ type: "text", text: "\n\n" + worstNotice.text });
      if (price(worstNotice) > maxTokens) throw new Error("spill notice for " + toolName + " exceeds maxInlineTokens");
      const retained = retainContent(content, Math.max(0, maxTokens - reserved), price);
      const footer = notice(retained.omittedBytes, retained.omittedImages);
      const result: RetainableBlock[] =
        retained.head.length + retained.tail.length === 0
          ? [footer]
          : [...retained.head, GAP, ...retained.tail, { type: "text", text: "\n\n" + footer.text }];
      // Chữ liền nhau chỉ có MỘT phần khung trên dây và trong bản xem trước của kho tràn.
      const merged: RetainableBlock[] = [];
      for (const block of result) {
        const previous = merged[merged.length - 1];
        if (block.type === "text" && previous?.type === "text") previous.text += block.text;
        else merged.push(block.type === "text" ? { ...block } : block);
      }
      return merged;
    } catch (error) {
      ctx.logger.warn("spill-policy: " + String(error) + "; keeping the inline content");
      return undefined;
    }
  }

  ctx.on(
    "tools/post-execute",
    async (exec, result, next) => {
      const decision = await next();
      if (decision.kind !== "accept" || Object.hasOwn(decision, "value") || exec.name === "read") return decision;
      const content = decision.content ?? result.content;
      const hasImages = content.some((block) => block.type === "image");
      // Lời gọi PTC chỉ có chữ thì giữ đường tràn KHÔNG ĐỒNG BỘ (chỉ ghi log, không hoãn giá trị chương trình).
      if (exec.parent !== undefined && !hasImages) return decision;
      const retained = await bound(exec, content, exec.name, exec.callId, exec.parent === undefined ? "result" : "dispatch");
      if (retained === undefined) return decision;
      const additionalContexts: unknown[] = [...(decision.additionalContexts ?? [])];
      if (exec.parent !== undefined && !result.isError && hasImages && !retained.some((block) => block.type === "image")) {
        // `MessageSourceMap` của dsh-llm ĐÃ CÀI không khai khoá `ptc-mode` (khoá do tầng PTC khai; nó chỉ
        // xuất hiện trong log v3→v4), trong khi bản gốc viết thẳng khoá đó. Giữ NGUYÊN hành vi bằng MỘT
        // phép ép kiểu tại đúng chỗ — không nới kiểu nào khác, không khai ambient (luật 000d).
        additionalContexts.push(
          createUserMessage({
            content: retained,
            source: { kind: "ptc-mode" },
          } as unknown as Parameters<typeof createUserMessage>[0]),
        );
      }
      return {
        kind: "accept",
        content: retained,
        ...(additionalContexts.length > 0 ? { additionalContexts } : {}),
      };
    },
    { prepend: true },
  );

  ctx.on(
    "tools/ptc-dispatch-log",
    async (dispatch, next) => {
      const content = await next();
      return (await bound(dispatch.exec, content, dispatch.name, dispatch.subCallId, "dispatch")) ?? content;
    },
    { prepend: true },
  );
}
