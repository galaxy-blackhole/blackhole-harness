<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi agent-loop: port 1:1 bundle 2.023 dong (7 vung, khong vendor) — TRUOC/SAU, bang chung, no ky thuat
-->

# `@galaxy-blackhole/gbh-host-agent-loop`

Bản viết lại **1:1** của `@deepseek-ai/dsh-agent-loop` — vòng lặp agent: inbox, projection runtime-context,
stream assistant, thi hành tool call, và launcher `AgentLoop` (dựng agent theo scope, công bố qua sổ agent/phiên).

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| mã nguồn | 1 bundle **2.023 dòng** (7 vùng `lib/types/*`, KHÔNG có vendor ngoài gói) | **8 tệp · 3.215 dòng**: `agent.ts` 997 · `plugin.ts` 994 · `tool-calls.ts` 415 · `inbox.ts` 313 · `runtime-context.ts` 264 · `assistant-stream.ts` 204 · `constants.ts` 15 (+ `index.ts` 12) |
| export công khai | `AgentLoop` · `default` · `CONFIGURED_AGENT_IDENTITIES_KEY` · `DEFAULT_MAX_PARALLEL_TOOL_CALLS` · `turnBoundaryProjectionDefinition` | **giống hệt** (5 tên, `default === AgentLoop`) |
| `String(Config)` | `maxParallelToolCalls` + `agents` | **trùng từng ký tự**; mặc định `{ maxParallelToolCalls, agents: [] }` |
| locale | `en.json` · `zh.json` | **chép byte-for-byte** |
| test | — | **24 ca / 45 expect · 0 fail** |

## 2. Bằng chứng

- export 5 = 5; `default` LÀ cùng lớp; `DEFAULT_MAX_PARALLEL_TOOL_CALLS` + `CONFIGURED_AGENT_IDENTITIES_KEY` trùng.
- `turnBoundaryProjectionDefinition` trùng `key`/`stateVersion`; `inboxProjectionDefinition` key `inbox`.
- `String(Config)` trùng từng ký tự; mặc định + lỗi cấu hình agent (thiếu trường/trùng khoá) cùng thông điệp.
- helper thuần: `SOURCE`/`CLEARED` nguyên văn · `isOwned` · `textOf` (nguồn runtime-context ⇒ chuỗi, nguồn khác ⇒ undefined) · `eventsNewestFirst` (đảo ảnh chụp nhật ký) · `parseArguments` (JSON hợp lệ ⇒ object, hỏng ⇒ chuỗi gốc, rỗng ⇒ `{}`) · 13 phương thức `ReactLoopInbox`.

## 3. Trạng thái row — **PARKED**

`package.json` KHÔNG khai `gbh.row`; khối park `gbh.park = { ly_do, row: { id: "agent-loop", tests: [...] } }`.
Chỉ flip sau: (1) test A/B xanh ✅, (2) **Lead tự chạy `boot-smoke agent-loop` ĐẠT**, (3) dòng `packages/README.md` §4.

## 4. Nợ kỹ thuật

1. `plugin.ts` là MỘT tệp tự chứa 994 dòng (kiểu CẤU TRÚC + helper nội bộ) — không cần module phụ, mặt export không đổi.
2. `Promise.withResolvers` không có trong lib ES2023 ⇒ helper `withResolvers` cục bộ (giá trị y hệt).
3. Không augment module (ADR 000d): seam khai theo cấu trúc, ép kiểu tại biên.
4. Test chưa dựng cả vòng lặp agent (cần llm/session/tools giả đầy đủ) — phủ qua export/Config/projection/helper; vòng lặp thật sẽ đo ở boot-smoke của Lead.
