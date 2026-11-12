<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ke hoach port row ui-conversation (20.064 dong) — chia 8 nhom module, nhieu luot cong nhan
-->

# Kế hoạch port `ui-conversation` — row lớn nhất còn lại

## Số đo (không phỏng đoán)

| hạng mục | giá trị |
|---|---|
| bundle gốc | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js` **20.064 dòng** |
| `slots.register` | **11** |
| `slots.inject` | **5** |
| chuỗi dạng slot | **416** |
| component cấp cao (`function Tên…`) | **31** |

## ⚠️ Ràng buộc kỹ thuật (đã đo, đừng cố lách)

**MỘT row = MỘT package.** Chỉ package khai `gbh.row` mới được mount; bundle build với `packages: "external"`
⇒ mọi `require` đi qua `requireFn` của bảng module trang, mà bảng đó **chỉ phơi plugin đã đăng ký** ⇒
**KHÔNG import được package anh em lúc chạy**. ⇒ Việc tách đúng chỗ là **tách MODULE trong `src/` của CHÍNH gói**.

## Chia 8 nhóm module (theo 31 component đo được)

| # | nhóm | component gốc | ghi chú |
|---|---|---|---|
| 1 | **vỏ phiên** | `ConversationRoot` · `ConversationPanel` · `ConversationMainPanel` · `ConversationContent` | khung ngoài, giữ slot `conversation.view` |
| 2 | **đầu phiên** | `ConversationHeader` · `ConversationSessionHeader` · `ConversationSession` · `ConversationSessionView` | header + chuyển phiên |
| 3 | **soạn tin** | `ComposerContentEditable` · `InputBar` · `DraftEditor` · `EnterBehaviorRow` | contenteditable + hành vi Enter |
| 4 | **chip tham chiếu** | `CommandChip` · `ReferenceChip` · `SessionReference` | chip lệnh/tệp/phiên |
| 5 | **văn bản người dùng** | `UserText` · `PlainUserText` | render text + markdown |
| 6 | **hàng đợi** | `QueueDock` · `QueueFile` · `QueueThumb` | `queue.sending`/`queue.edit`/`queue.steer`/`queue.remove` |
| 7 | **việc cần làm** | `TodoDock` · `TodoPanel` | `todo.title` |
| 8 | **hero + bề rộng + đo** | `HeroFish` · `HeroShell` · `ConversationWidthControls` · `NoConversationWidthControls` · `WidthHandle` · `ContextMeter` · `DecoratorPortals` · `DefaultConversationViews` | màn trống, kéo bề rộng, đồng hồ ngữ cảnh |

⇒ **8 module × ~2.500 dòng** ⇒ mỗi module vẫn có thể vượt 1.000 dòng ⇒ **chia tiếp trong từng nhóm** (ví dụ nhóm 3 và 8 nên tách 3–4 file).
⇒ Mục tiêu thực tế: **~25–30 file `src/`, mỗi file ≤ 1000 dòng**.

## Chia thành 3 LƯỢT công nhân (một người không đủ ngân sách)

| lượt | phạm vi | nghiệm thu riêng |
|---|---|---|
| **L1** | nhóm 1 · 2 + `ids.ts` + `plugin.ts` (khung + đăng ký **đủ 11 slot**) + `build.ts` + `client.ts` + `index.ts` | artifact **1 id** · test khuôn · `check:rows` 0 `chan` |
| **L2** | nhóm 3 · 4 · 5 (soạn tin + chip + văn bản) | test đối chứng **cây render** với bundle gốc |
| **L3** | nhóm 6 · 7 · 8 (hàng đợi + todo + hero/bề rộng) | test đối chứng + **CSS từng byte** |

⚠️ **L2 và L3 KHÔNG được chạy song song trên cùng gói** — hai người ghi một gói sẽ phá artifact của nhau
(đã xảy ra thật với `product-analytics`). ⇒ **tuần tự**, và mỗi lượt phải **báo cáo rồi Lead boot**.

## Luật bắt buộc (8 luật của khuôn + 2 luật riêng row này)

1. Header 5 dòng mọi file (kể cả `.module.css`) · **≤1000 dòng/file** · mọi export có mô tả.
2. Bundle đăng ký **ĐÚNG MỘT id — id CỦA TA**. Id gốc **chỉ** ở `gbh.row.aliases`.
3. `build.ts` nhận `outDir` qua **`process.argv[2]`** (thiếu ⇒ profile không có `lib/` ⇒ **không sinh entry**).
4. Cổng `apply`: **`let` phạm vi MODULE** + WeakSet, **cờ bật SAU khi đăng ký xong**; **không** dùng tên `installedContexts`/`lastCtx`.
5. Tên slot **LITERAL** trong `register({ name: "…" })` · slot LIST có **`id` nguyên văn** · **component là THAM SỐ THỨ HAI**.
6. Đăng ký **đủ 11 slot** + test khẳng định **tập slot của ta = tập slot bundle gốc**.
7. **KEYED**: `key` của slot **PHẢI BẰNG** `id` của định nghĩa loại tab (lệch ⇒ fallback ⇒ *'không khả dụng' **mà không có lỗi console***).
8. **STORE cấp cho slot gói khác**: `create()` phải trả **thể hiện ĐẦY ĐỦ** (`getSnapshot`/`subscribe`/`actions`) + **ca test hợp đồng**.

## Điều kiện mount (Lead)

- `#root` trên app thật **KHÔNG ĐƯỢC NHỎ HƠN bản stock** (bản lành hiện tại: **68.760**) — row mount được mà render ít hơn
  sẽ làm app **mất nội dung ÂM THẦM** (0 lỗi console).
- `(5)` 0 `did not activate` · `(8)` 0 lỗi console · `check:rows` 0 `chan`.
