<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của gói @galaxy-blackhole/gbh-client-ui-chat — row ui-chat (13.340 dòng gốc, row client LỚN NHẤT)
-->

> ⚠️ **KHÔNG SỬA TAY `src/parts/`.** Mọi lát trong `src/parts/part-NNN.ts` đều **SINH TỰ ĐỘNG** bằng cách cắt
> `@deepseek-ai/dsh-client-ui-chat/lib/client.js` (bản 0.2.1-alpha.4) theo mốc `//#region` — quy tắc cắt, bảng
> offset/số dòng và bài học chống trộn kiểu cắt nằm ở `docs/tien-do/so-cat-lat-ui-chat.md`. Sửa tay một lát là
> phá cổng byte của `build.ts`; muốn đổi nội dung thì cắt lại từ bundle gốc (08/11/2026, dev-1).

# @galaxy-blackhole/gbh-client-ui-chat

Bản viết lại của Galaxy Blackhole cho row `ui-chat` của DSH
(`@deepseek-ai/dsh-client-ui-chat`, **13.340 dòng** bundle gốc — row client lớn nhất của cả cây plugin).

## 1. Nguồn đối chiếu và mức độ dẫn xuất (bắt buộc theo packages/README.md §3, mục 4)

| Mục | Giá trị |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-client-ui-chat` 0.2.1-alpha.4 |
| File đối chiếu (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` (13.340 dòng) và `lib/index.js` (80 dòng) |
| Mức dẫn xuất | **chia lát nguyên văn theo** `//#region` cho nửa client + **viết lại có kiểu** cho nửa host và ba lát vỏ |

**Vì sao chia lát thay vì chép tay lại 13.340 dòng.** Row này gấp **3 lần** row lớn nhất đã viết tay
(`ui-tool`, 4.636 dòng gốc). Luật của dự án nói thẳng: *một row mount được mà render ÍT HƠN bản stock sẽ
làm app mất nội dung ÂM THẦM, `#root` nhỏ đi, 0 lỗi console*. Với 13.340 dòng, một bản chép tay trong
một lượt chắc chắn rơi vào đúng cái bẫy đó. Vì vậy nửa client được **cắt thành 18 lát theo đúng ranh giới**
`//#region` **của tsdown** (mỗi vùng là một file nguồn upstream trọn vẹn) và ghép lại **nguyên byte**:
thân bundle của ta trùng **từng byte** với vùng nguồn của bản gốc — có test canh (xem §6.7).

## 2. Gói này làm gì

| Mặt | Nội dung |
|---|---|
| `lib/index.js` (host) | lược đồ cài đặt Chat cho Settings: `Config` + 7 hằng + `apply` — **viết lại có kiểu** từ `lib/index.js` gốc (80 dòng), nguyên hành vi |
| `lib/client.js` (browser) | **đích Chat**: định nghĩa node hội thoại, 15 renderer khoá theo `key` của `conversation.chat.node`, view `chat` của `conversation.view`, 3 hàng cài đặt, 2 pill ở `conversation.composer.dock`, thông báo quota ở `shell.overlay`, chi tiết approval |

Tập slot (đo bằng **đúng hai regex của** `check:rows`**, bằng nhau với bản gốc**):

```text
conversation.approval.detail      conversation.chat.flow            conversation.chat.node
conversation.chat.reasoning.body  conversation.composer.dock        conversation.view
settings.general.item             shell.overlay
```

## 3. Khuôn bắt buộc (đã tuân thủ)

- **MỘT id module**: `@galaxy-blackhole/gbh-client-ui-chat`; id gốc chỉ khai ở `gbh.row.aliases`
  (đo trên artifact: `id: "@deepseek-ai` = **0**, `id: "@galaxy-blackhole` = **1**).
- `build.ts` nhận **`process.argv[2]`** (`buildPackage(outDir?)` + `outDir ?? join(import.meta.dir, "lib")` + `if (import.meta.main)`).
- Cổng `apply`: `let uiChatInstalled = false` **phạm vi module** + WeakSet, đặt **trước JSDoc** của hàm bọc,
  cờ **chỉ bật SAU KHI** `apply` gốc chạy xong; **không** dùng tên `installedContexts`/`lastCtx`; **không** khoá theo `ctx`.
- Tên slot **LITERAL** trong `register({ name: "…" })` (nguyên văn của bản gốc) · component là **THAM SỐ THỨ HAI**.
- Mọi file **≤ 1000 dòng** (lát lớn nhất 946), header 5 dòng ở mọi file `.ts`, JSDoc ở mọi hàm export.
- **CSS nguyên văn từng byte**: 18 module CSS nằm nguyên trong thân bundle, giữ **nguyên hash lớp** và nguyên
  `<style data-plugin-css="@deepseek-ai/dsh-client-ui-chat/<Tên>.module.css">` — có test đối chiếu từng khối.

## 4. Cấu trúc

| Nhóm | File |
|---|---|
| Hằng · mặt có kiểu | `src/ids.ts` · `src/client.ts` |
| Nửa host (viết lại có kiểu) | `src/chat-settings.ts` · `src/index.ts` |
| Ba lát vỏ VIẾT TAY | `src/parts/runtime-deps.ts` (6 dòng `require` nguyên văn) · `stock-exports.ts` (5 dòng `exports.*` nguyên văn) · `plugin-surface.ts` (`createPlugin` + cổng) |
| 18 lát cắt từ bundle gốc | `src/parts/part-01.ts` … `part-18.ts` |
| Công cụ cắt (nguồn sự thật của phép chia) | `tools/split-stock-bundle.ts` |
| Build | `build.ts` |

## 5. Nghiệm thu (đo trên ARTIFACT, không grep `src/`)

| Phép đo | Kết quả |
|---|---|
| `bun run build.ts` | `lib/index.js` (52 dòng) + `lib/client.js` (13.466 dòng) |
| `grep -c 'id: "@deepseek-ai' lib/client.js` | **0** |
| `grep -c 'id: "@galaxy-blackhole' lib/client.js` | **1** |
| `bun test tests/client/ui-chat.test.ts` | **14 pass · 0 fail · 142 expect** |
| `bun run check:rows` | **0 dòng cho row này** (không chặn, không cảnh báo) |
| `bun run gate --no-tests` | 0 vi phạm thuộc `packages/client/ui-chat` (header · độ dài · JSDoc · dep-guard · parity-matrix · typecheck) |
| `lab:row` (home cách ly `/tmp/gbh-lab-ui-chat`, cổng riêng 5472) | **`#root` 41.266 · 124 entry · 18 thẻ CSS của ta · 0 lỗi console · 0 lỗi page · 0 dòng "did not activate" của row này** |

Bằng chứng lab (payload `__DSH_BOOT__` của chính lượt boot):

- có entry `{"id":"@galaxy-blackhole/gbh-client-ui-chat","url":"plugins/??…,@galaxy-blackhole/gbh-client-ui-chat/client.js,…","rev":"e0a978b9ad06","inject":[…11 gói y hệt gốc…]}`;
- entry `"id":"@deepseek-ai/dsh-client-ui-chat"` **vẫn còn nhưng là ENTRY ALIAS**: cùng `url`, cùng `rev`,
  `inject: []` — đó là mục mà 9 row khác `inject` vào (`ui-user-questions` · `ui-attachment` · `ui-deliverables` ·
  `ui-goal` · `ui-plan` · `ui-settings-account` · `ui-subagent` · `ui-workflow-run` · `ui-cot-translation`),
  không phải bundle thứ hai.
- dòng "did not activate" duy nhất của lượt boot thuộc row KHÁC (`ui-sidebar-documentpreview-ours`), không phải row này.

## 6. Test canh điều gì

1. **một id**: artifact khai đúng một `load({ id })`, không có id gốc;
2. **tập slot của ta = tập slot của bundle gốc**, đo bằng **chính hai regex của** `check:rows`;
3. **chạy THẬT cả hai bundle** trong cùng một harness (`window` giả + bảng module giả) rồi so **từng** thứ tự
   `inject` · tên+key+id của mọi lần `register` · `registerFactory` · nhãn `effect` · namespace `locale` ·
   danh sách hook `uiSession.provide` — khớp **hoàn toàn**. (`react.memo`/forwardRef trong harness trả lại
   chính component, nếu không thì mọi `register(spec, Component)` sẽ đăng ký rỗng — đúng lớp lỗi "render ít hơn".)
4. **slot KEYED** `conversation.chat.node`: 15 `key` (`user` · `steering` · `context` · `turn-trigger` ·
   `system-prompt` · `assistant-step` · `command` · `manual-compaction` · `compaction` · `model-retry` ·
   `turn-error` · `turn-max-tokens` · `turn-process` · `turn-tail` · `unknown`) **bằng đúng bản gốc**;
5. **hợp đồng store (luật 8)**: `store` cấp cho slot `conversation.view` và `conversation.chat.flow` của gói khác
   là **thể hiện đầy đủ** `getSnapshot`/`subscribe`/`actions`, gọi được thật (`getSnapshot()` → `{ turnProcesses: [] }`),
   và đến từ `require("@galaxy-blackhole/gbh-client-store")` — không phải store tự chế;
6. **cổng chống cài hai lần**: `apply` lần hai không đăng ký thêm gì; cờ ở phạm vi module;
7. **parity từng byte**: thân bundle = vùng nguồn gốc + 5 dòng `exports.*`; **18 khối CSS** trùng từng byte;
8. **lát nguồn**: mọi lát ≤ 1000 dòng và có header 5 dòng.

## 7. Chưa xong (nợ kỹ thuật — nói thẳng)

1. **Nửa client là bản cắt nguyên văn, KHÔNG phải bản viết lại có kiểu.** 18 lát mang `// @ts-nocheck`
   (chúng là JS đã bỏ kiểu của tsdown). Hệ quả: (a) `gate:typecheck` **không** canh được nửa client này —
   thứ canh nó là test chạy thật ở §6.3 và lab; (b) sửa hành vi phải sửa **trong lát**, không có kiểu để dựa vào.
   Ba lát vỏ viết tay (`runtime-deps` · `stock-exports` · `plugin-surface`) thì có kiểm kiểu.
2. **Sáu gói upstream bị nhúng thẳng trong thân bundle** (giống hệt bản gốc: `util/workspace-path` ·
   `util/values` · `cosmokit` · `schemastery` · `session/surface` · `llm/assistant-stream` + `token-meter`).
   Chưa rút ra thành `require` cho bảng module — cố ý, để không thêm phụ thuộc vào bảng module của trang.
3. **Nửa host viết lại có kiểu nhưng chưa có test hành vi riêng** cho `settings.configure` (mới chỉ có test so
   tập export với bản gốc). Muốn đủ thì cần một harness `ctx.inject(["settings"])` giả.
4. **Chưa đo ảnh A/B trên app thật 5439** (đúng luật: chỉ Lead boot 5439). Số ở §5 là của **lab cách ly**.
