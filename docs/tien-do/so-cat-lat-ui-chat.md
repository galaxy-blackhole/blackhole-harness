<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc Sổ cắt lát client của packages/client/ui-chat: mỗi lát = vùng liên tục của bundle gốc, kèm dòng bắt đầu
      và số dòng, để lần sau KHÔNG trộn hai kiểu cắt (sự cố 08/11/2026: 18 lát cũ vừa cắt cứng 908 dòng vừa cắt //#region ⇒ trùng khai báo).
-->

# Sổ cắt lát — client/ui-chat (08/11/2026, dev-1)

Nguồn: apps/host/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js (bản 0.2.1-alpha.4).
Thân bundle gốc bắt đầu ở dòng 13 (mốc //#region đầu tiên), tổng 13319 dòng.

## Quy tắc cắt (MỘT kiểu duy nhất)

1. Cắt theo mốc //#region … //#endregion của bundle gốc (mỗi vùng là một đơn vị).
2. Gộp các vùng liên tiếp cho tới ≤ 900 dòng/lát; vùng nào > 900 dòng thì cắt tiếp trong lòng vùng (vùng chat-snapshot-builder.js = 1.000 dòng).
3. Mỗi lát = header 5 dòng + // @ts-nocheck + NGUYÊN VĂN các dòng của bundle (không thêm/bớt ký tự, KHÔNG có newline ở cuối tệp) ⇒ clientBody() ghép lại đúng từng ký tự.

## Bảng lát

| lát | vùng bắt đầu | dòng trong bundle gốc | số dòng |
|---|---|---:|---:|
| part-001.ts | //#region ../../util/workspace-path/lib/index.js | 13 | 768 |
| part-002.ts | //#region lib/types/client/chat/use-scroll-follow.js | 781 | 512 |
| part-003.ts | //#region lib/types/client/chat/flow-motion.js | 1293 | 440 |
| part-004.ts | //#region lib/types/client/chat/use-chat-viewport.js | 1733 | 755 |
| part-005.ts | //#region lib/types/client/chat/use-chat-scroll.js | 2488 | 491 |
| part-006.ts | //#region ../../util/values/lib/index.js | 2979 | 891 |
| part-007.ts | //#region lib/types/client/chat/use-disclosure.js | 3870 | 544 |
| part-008.ts | //#region lib/types/client/chat/ContextBody.js | 4414 | 836 |
| part-009.ts | //#region lib/types/client/chat/MessageItem.js | 5250 | 877 |
| part-010.ts | //#region lib/types/client/chat/ReasoningRow.js | 6127 | 885 |
| part-011.ts | //#region lib/types/client/chat/turn-trigger.js | 7012 | 878 |
| part-012.ts | //#region lib/types/client/conversation-nodes/assistant.js | 7890 | 556 |
| part-013.ts | //#region lib/types/client/conversation-nodes/chat-snapshot-builder.js | 8446 | 900 |
| part-014.ts | (tiep noi) order: this.order, | 9328 | 764 |
| part-015.ts | //#region lib/types/client/conversation-nodes/tool.js | 10110 | 749 |
| part-016.ts | //#region ../../llm/token-meter/lib/types/turn-usage.js | 10859 | 866 |
| part-017.ts | //#region ../../../vendor/cosmokit/lib/index.js | 11725 | 887 |
| part-018.ts | //#region lib/types/chat-settings.js | 12612 | 720 |

## Kiểm chứng (08/11/2026)

- clientBody() ghép trong BỘ NHỚ: 591.747 B; new Function(body) CHẠY, không ném (trước khi cắt lại: ném 'Cannot declare a const variable twice: turnTailDefinition').
- Sau đó mới chạy build.ts ⇒ lib/client.js + lib/index.js; bun test ./tests/client/ui-chat.test.ts ⇒ 9 pass / 0 fail (trước: 1 fail).
- body không bằng byte thô với thân bundle gốc vì 6 dòng require (runtime-deps.ts) + 5 dòng exports.* (stock-exports.ts) + mặt plugin (plugin-surface.ts) là lát VIẾT TAY thay cho phần đầu/cuối bundle — đúng thiết kế build.ts.

## Bài học

- KHÔNG trộn kiểu cắt: 18 lát cũ gồm part-01..14 dài đúng 908 dòng (cắt cứng) và part-15/16/17/18 dài 727/877/947/682 (cắt //#region) ⇒ part-13 và part-16 cùng khai turnTailDefinition (47 dòng giống từng byte) và part-13/part-07 chồng lấn vùng của part-10/part-04.
- Cách kiểm RẺ, KHÔNG cần build: gọi clientBody() rồi new Function(body) — nếu trùng khai báo sẽ ném ngay.
