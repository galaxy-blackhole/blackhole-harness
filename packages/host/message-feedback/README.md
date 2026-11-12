<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row message-feedback (DSH @deepseek-ai/dsh-message-feedback):
      phan hoi canonical tren log phien cho tin nhan assistant da chot
-->

# `@galaxy-blackhole/gbh-message-feedback` — row `message-feedback`

Bản viết lại của Galaxy Blackhole cho row **`message-feedback`** của DSH
(`@deepseek-ai/dsh-message-feedback`, **MỘT MẶT** — không có `lib/client.js`).

**Vai trò**: phản hồi trên thông điệp — người dùng thích/không thích một tin nhắn assistant ĐÃ CHỐT,
kèm ghi chú và nhóm lý do. Phản hồi là **event chỉ-ghi-log** của phiên (`feedback/message-put` ·
`feedback/message-delete`), **không bao giờ vào lịch sử mô hình**; trạng thái hiện tại luôn được
**suy ra lại từ log** chứ không lưu ở đâu khác.

## 1. Năm câu hỏi bắt buộc (đo trên dump mới nhất `2026-10-18T01-31-57`)

| # | Câu hỏi | Trả lời đo được |
|---|---|---|
| 1 | Row có đang BẬT không? | **BẬT**. `ours.yml` L512–515: `- id: message-feedback` · `name: '@deepseek-ai/dsh-message-feedback'` · **không** `disabled` |
| 2 | Thuần host hay có mặt client? | **Thuần host**. Gói gốc chỉ có `lib/index.js` + `lib/types/*` + `lib/typert.*`; **`lib/client.js` KHÔNG tồn tại** (và `ours.yml` có **0** dòng `lib/client.js`) |
| 3 | Cần seam nào? | `Service`/`Context` (cordis) · `s` (schemastery) · `TypertRemoteService`+`Remote` (typert) · `SessionSeq` + `deriveEventMessage`/`isAppendSurfaceEvent` (dsh-session) · `FEEDBACK_CATEGORIES` (dsh-command-feedback) · `zod` · ba builtin `node:` (`buffer` · `crypto` · `util`) |
| 4 | Hành vi ĐO ĐƯỢC là gì? | Ba RPC typert **`messageFeedback/list` · `put` · `delete`** (namespace `messageFeedback`) · hai event log `feedback/message-put`/`feedback/message-delete` · một event **`feedback/committed`** cho lượt ghi lạnh · service key `messageFeedback` |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** — manifest gốc **không có khoá `dsh`** ⇒ một mặt, thay được ngay |

**`config:` GỐC trong dump (nguyên văn)** — dạng MỘT DÒNG, **không** `!!js`:

```yaml
- id: message-feedback
  name: '@deepseek-ai/dsh-message-feedback'
  config:
    maxNoteBytes: 8192
```

⇒ `Config` của ta khai **đúng** `s.object({ maxNoteBytes: s.number().step(1).min(1).required() })`;
`String(Config)` **trùng từng chữ** với bản gốc (có ca test).

## 2. Bảng nguồn đối chiếu (G4)

| Bản gốc (CHỈ ĐỌC) | Dòng | Của ta | Ghi chú |
|---|---|---|---|
| `lib/index.js` | 331 | `src/service.ts` + `src/schema.ts` + `src/index.ts` | viết lại theo HÀNH VI, không chép code |
| `lib/types/types.js` | 8 (`export {}`) | `src/types.ts` → `lib/types.js` (**rỗng**) | từ vựng chỉ-có-kiểu, đúng hình dạng đầu ra phụ của gốc |
| `lib/types/types.d.ts` | 137 | `src/types.ts` | gồm cả khai kiểu `SessionEventMap` + `Context`/`Events` của cordis |
| `lib/types/index.d.ts` | 72 | `src/service.ts` (JSDoc trên từng thành viên) | `Config` · `inject` · `[Service.init]` · 3 method Remote |
| `lib/typert.host.js` (391) + `lib/typert.remote-client.js` (232) | máy sinh | **KHÔNG ship** | xem §7 — theo đúng nguyên tắc của Lead ở `host/settings-controller` |
| `locale/en.json` · `locale/zh.json` | 5 · 6 | `locale/en.json` · `locale/zh.json` | **byte-for-byte** (shasum khớp: `7d1e8be7…` · `97cd6f16…`) |

## 3. Peer — vì sao từng tên (bảng §3b)

`gbh.peers` (3 tên; `mount.ts` tự thêm `cordis` + `schemastery`):

| peer | bậc §3b | lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/dsh-typert-protocol` | **bậc 2** | phải **kế thừa ĐÚNG** `TypertRemoteService` của kernel thì Gateway mới discovery được service `messageFeedback` (test khẳng định `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc)`) |
| `@deepseek-ai/dsh-session` | **NGOÀI bảng** ⚠️ | `SessionSeq` đánh số event khi ghi lạnh và `deriveEventMessage`/`isAppendSurfaceEvent` quyết định **đích hợp lệ** (`target-not-found`). Viết lại hai hàm đó là viết lại luật **surface** của kernel — lệch một chút là phản hồi gắn sai tin nhắn. **Cần Lead xác nhận mở rộng §3b** |
| `@deepseek-ai/dsh-command-feedback` | **NGOÀI bảng** ⚠️ | `FEEDBACK_CATEGORIES` là **tập giá trị của wire** (7 nhóm, `z.enum`). Chép cứng 7 chuỗi sẽ lệch âm thầm nếu kernel đổi tập. **Cần Lead xác nhận mở rộng §3b** |

`@deepseek-ai/cordis` + `@deepseek-ai/schemastery` là **bậc 1** (không cần khai trong `gbh.peers` vì
`mount.ts` đã tự thêm). `zod` là **thư viện bên thứ ba** và nằm ở `dependencies` — theo đúng tiền lệ
của repo (`llm-retry` · `session-stats` · `session-title` · `session-turn-outline` ·
`harness-dev-context` · `working-directory` · `user-questions` đều khai `zod` ở `dependencies`):
hai thể hiện zod không chia sẻ trạng thái nào, còn `gbh.peers` chỉ dùng để sinh `inject` dịch vụ.

**`gbh.peers ⊆ peerDependencies`** (so **PHẦN TỬ**, không so số lượng) — **0 tên lệch**, có
**ĐỐI CHỨNG ÂM** ba dạng: xoá MỘT tên · xoá sạch · lệch mà số lượng bằng nhau; và một **đối chứng âm
THẬT** đo lại ngay lúc chạy: `host/settings-controller` lệch 1 tên (`dsh-typert-protocol`), còn
`host/jobs-local` — mà `M6-MOUNT-PLAN §1d` ghi lệch 3 tên — **nay đã khớp** (đọc tài liệu thay vì đo
sẽ cho verdict RỖNG).

## 4. Hành vi đã viết lại (những chỗ dễ lệch âm thầm)

1. **Hai đường ghi khác nhau, không phải một**: phiên ĐANG SỐNG ⇒ ghi qua chủ sở hữu sống rồi ép
   `sessions.flush` **và** đọc lại 1 event từ handle lạnh để chứng minh tiền tố đã bền vững (hai
   thông điệp ném **trùng từng chữ** với gốc); phiên LẠNH ⇒ mở handle `write`/`read`, tự đánh
   `seq`/`time`, `flush`, rồi phát **`feedback/committed`**. Người quan sát NÉM ⇒ **chỉ cảnh báo**,
   thao tác vẫn thành công.
2. **So-sánh-và-đặt theo `version`**: `ifVersion` so với `existing?.version ?? null`; lượt **lặp y hệt**
   (cùng rating + note + category) **giữ nguyên version và KHÔNG ghi event** nhưng **vẫn chạm hàng rào
   bền vững** (`append()` không tham số).
3. **`createdAt` giữ nguyên qua mọi lượt sửa**, `updatedAt = max(now, cũ)` — đồng hồ lùi không làm
   `updatedAt` đi ngược.
4. **Đích hợp lệ** = event `assistant/message` **gốc-append** (`isAppendSurfaceEvent`) mà
   `deriveEventMessage(event).id` khớp. Event **thay thế** (`surfaceOp: "replace"`) ⇒ `target-not-found`.
5. **Ghi chú**: `undefined` ⇒ bỏ trường; rỗng-sau-cắt ⇒ `note-blank`; quá trần **byte UTF-8** ⇒
   `note-too-large` kèm `maxBytes`/`actualBytes`. Hai phép kiểm này chạy **TRƯỚC hàng đợi** (không chạm đĩa).
6. **Hàng đợi tuần tự theo phiên** + **cổng dọn**: `[Service.init]` đăng ký effect `message-feedback.drain`;
   khi chạy, service **từ chối** mọi đột biến mới với `message-feedback: service is disposing`.
7. **Gấp trạng thái**: quét TOÀN BỘ log, **kiểm schema zod từng thân** event phản hồi (hỏng ⇒ ném,
   fail-closed), lưu **CHÍNH vật trong event** (không phải bản `parse` trả về), thứ tự = **thứ tự tạo
   lần đầu** (Map giữ chỗ khoá đã có; xoá rồi tạo lại ⇒ xuống cuối).
8. **`z.enum(FEEDBACK_CATEGORIES)`** — dùng đúng hằng của kernel, không chép 7 chuỗi.

## 5. Test — 16 ca / 0 fail / 125 expect

```bash
cd galaxy-blackhole/blackhole-tauri
/Users/buitronghieu/.bun/bin/bun test tests/host/message-feedback.test.ts
```

| nhóm | nội dung |
|---|---|
| ARTIFACT | tập export **ta = gốc** (`MessageFeedbackService` + `default`, **0 thiếu · 0 thừa**) · `lib/types.js` rỗng như gốc · `grep -c 'id: @deepseek-ai' lib/index.js` = **0** · `build.ts` đọc `process.argv[2]` |
| lớp nền | `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc)` (`TypertRemoteService`) · `inject` y hệt |
| `Config` | `String(Config)` trùng từng chữ · ma trận 5 giá trị (nhận/ném) trùng · ctor ném đúng thông điệp |
| **A/B 14 bước** | cùng một giàn giả cho **CẢ HAI** bản: kết quả **và** log phản hồi khớp **từng bước**, kèm khẳng định nội dung 3 event đã ghi (không chỉ "hai bản giống nhau") |
| đường lỗi | `session-not-found` · `target-not-found` (gồm ca đích là event THAY THẾ) · `note-blank` · `note-too-large` (`"ế"×6 = 18 byte > 16`) · `version-conflict` · không lượt sai nào ghi event |
| LIVE | event đi thẳng vào phiên sống, **không** phát `feedback/committed` · hai lỗi bền vững trùng thông điệp **từng chữ** |
| cổng dọn | chạy effect ⇒ `put` bị từ chối (`service is disposing`) |
| **C6 danh tính** | hai lượt `list` trả **vật thể RIÊNG** (`!==`), ảnh chụp **đông băng**; sửa vật trong LOG **không** lan sang ảnh chụp đã trả |
| peer | `gbh.peers ⊆ peerDependencies` so **PHẦN TỬ** + **3 đối chứng âm** + **1 đối chứng âm THẬT** |
| 000e | `locale/en.json` + `zh.json` **byte-for-byte** (sha khớp) |
| hợp đồng metadata | `gbh.row` (do LEAD khai) trỏ ĐÚNG `id: message-feedback` · `config` = `{ maxNoteBytes: 8192 }` (nguyên văn dump) · `tests` trỏ ĐÚNG file test này · row MỘT MẶT **KHÔNG** có `moduleIds`/`aliases` |

## 6. TRƯỚC/SAU — đo trên ARTIFACT (chưa mount)

| phép đo | TRƯỚC (row stock) | SAU (gói của ta) |
|---|---|---|
| export của `lib/index.js` | `MessageFeedbackService` + `default` = **2** | **2** (0 thiếu · 0 thừa) |
| `lib/index.js` | 331 dòng (bundle gốc) | **8.907 byte** build từ 4 file nguồn |
| đăng ký id module trong artifact | 0 (row host) | **0** |
| `Config` (`String()`) | `{ maxNoteBytes: number }` | **trùng từng chữ** |
| `locale/*.json` | — | **byte-for-byte** |
| `gate --no-tests` | — | **7/7 XANH** (xem §7) |

Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/message-feedback
/Users/buitronghieu/.bun/bin/bun run build.ts            # ⇒ lib/index.js + lib/types.js
grep -c 'id: @deepseek-ai' lib/index.js                  # PHAI = 0
cd ../../.. && /Users/buitronghieu/.bun/bin/bun run check:rows | grep -c '| chan |'
```

## 7. CHƯA làm — nói thẳng

1. **`gbh.row` do LEAD khai** (18/10 08:55) — **tác giả gói KHÔNG tự khai** (đúng luật "khai `gbh.row` =
   nhận rủi ro mount"). Ca test tương ứng đã đổi chiều từ **TEST CANH** (khẳng định `gbh.row` vắng) thành
   **HỢP ĐỒNG METADATA**: id đúng row stock · `config` đúng cấu hình đang chạy `{ maxNoteBytes: 8192 }` ·
   `tests` trỏ đúng file test · row MỘT MẶT không có `moduleIds`/`aliases`.
2. **Chưa chạy**: `lab:row` · mount · `check:app` · phép đo TRƯỚC/SAU trên app 5439 (thuộc lượt boot của Lead).
3. **KHÔNG ship `./typert`** (descriptor máy sinh 391 dòng của gốc) — cùng nguyên tắc đã ghi ở
   `host/settings-controller`. Hệ quả: `api-remotes` của kernel vẫn dựng descriptor từ **bundle của nó**
   (đo được: nó nhúng `typeSymbol` dạng CHUỖI, không `require` gói của ta) ⇒ không mất chức năng.
4. **Kiểu brand được khai theo cấu trúc**: `MessageId`/`SessionId`/`MessageFeedbackVersion` là `string`
   (brand của `dsh-brand`/`dsh-llm` chỉ có nghĩa lúc biên dịch và bị xoá khi build); ràng buộc THẬT nằm ở
   schema zod (`z.uuid()` · `min(1)`) đã có test. `SessionHandle`/`SessionPersistence`/`SessionInspection`
   khai **hẹp bằng hoặc hẹp hơn** module thật (chỉ thành viên row này chạm) — nhờ vậy Context giả trong test
   đúng hình dạng mà không kéo `dsh-session-persistence` thành peer.
5. **Không mượn ambient shim** nào (`000d`): ba peer lạ (`dsh-session` · `dsh-command-feedback` ·
   `dsh-typert-protocol`) được **symlink thật** vào `node_modules` của chính package.

## 8. Khác biệt CÓ CHỦ Ý so với bản gốc

| điểm | bản gốc | của ta | vì sao |
|---|---|---|---|
| loại lỗi khi thân event đã lưu hỏng | `ZodError` | `ZodError` (**giống**) | vẫn dùng `zod`, chỉ khác phiên bản (kernel 4.4.3 · repo 4.6.7) |
| `feedback/committed` payload | `SessionInspection` của `dsh-session-persistence` | khai **cấu trúc** `{ meta, inheritedEventCount, events }` | tránh thêm peer chỉ để mượn một kiểu; hình dạng truyền đi **y hệt** (test so `meta`/`inheritedEventCount`/`events`) |
| `Service.init` | `ctx.effect(...)` | `ctx.effect(...)` (**giống**) | — |
| import zod | `from "zod"` | `from "zod/v4"` | repo có **ambient shim** `declare module "zod"` (của `client/ui-sidebar-right`) đè kiểu thật cho TOÀN chương trình `tsc`; `zod/v4` là đường 7 gói host khác đang dùng và không bị shim chi phối. Cùng một API v4 |
| khai kiểu của seam | mở rộng `Context`/`Events`/`SessionEventMap` TOÀN CỤC | khai **HẸP tại chỗ dùng** (`HostContext` · `MessageFeedbackLogEvent`) | khai toàn cục của ta **hợp nhất** với khai của gói gốc (gói gốc vẫn nằm trong chương trình `tsc` qua `import type {}` của `host/session-telemetry-otel`) ⇒ `inspection.meta.id` của HỌ thành `string | SessionId` ⇒ đỏ typecheck ở **file không phải của ta**. Đã đo và sửa 18/10/2026 |

---
