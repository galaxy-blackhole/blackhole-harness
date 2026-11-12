<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi @galaxy-blackhole/gbh-client-ui-schedule — nguon doi chieu, muc do dan xuat, bang chung parity
-->

> ⚠️ **KHÔNG SỬA TAY (src/parts/*.ts)** — 50 lát trong (src/parts/\) là **NGUYÊN VĂN** bundle gốc
> (@deepseek-ai/dsh-client-ui-schedule\), đặt tên theo **ĐÚNG** `src/manifest.ts` (`PART_FILES`); khối VIẾT TAY duy nhất là
> `src/parts/plugin-surface.ts` (`HANDWRITTEN_PARTS`). Thứ tự ghép bắt buộc trong `build.ts`:
> `PART_FILES` → `rewriteIds` → thay placeholder CSS → `CLIENT_EXPORT_LINES` → khối viết tay → `CLIENT_TAIL_LINES`.
>
> **Cổng chứng minh (08/11/2026, dev-1 dựng lại toàn bộ lát sau sự cố công cụ de-bundle):**
> `bun run build.ts` phải tái sinh `lib/client.js` **BYTE-IDENTICAL** với artefact đang phát hành —
> sha256 `ea26831daad058b74077b6979e1dfea0e67d14fa64bbb4a04cf4b717f56409d7` (374.494 B). Lệch một byte là sai.
> Khi cần dựng lại: cắt bundle gốc theo mốc `//#region` (47 vùng), phần `00-requires` là đoạn TRƯỚC vùng đầu,
> vùng `TaskDetail.js` cắt 3 phần a/b/c tại ranh giới khai báo an toàn, và 9 vùng `*.module.css` thay bằng
> placeholder TRẦN (không bọc ngoặc kép — `build.ts` chèn `JSON.stringify(css)` vốn đã có ngoặc).

# @galaxy-blackhole/gbh-client-ui-schedule

Bản viết lại của Galaxy Blackhole cho row **`ui-schedule`** của DSH.

## 1. Nguồn đối chiếu (§3 điều 4 của packages/README.md)

| Mục | Giá trị |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-client-ui-schedule` **0.2.1-alpha.4** |
| Nguồn sự thật (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-schedule/lib/client.js` — **7.549 dòng**, 328.656 byte |
| Bản gốc TypeScript | không có trong cây này (`vendor/dsh-reference/` bị gitignore); mọi đối chiếu đều đo trên **bundle đã ship** |
| Mức độ dẫn xuất | **de-bundle nguyên văn** (§2) + **một khối thêm mới có chủ ý** là cổng chặn cài hai lần (§4) |

## 2. Cách gói này được tạo — de-bundle, không viết lại hành vi

`lib/client.js` là **bản biên dịch của gói gốc, tháo thành từng module theo đúng `//#region` của nó**,
rồi ghép lại theo thứ tự trong [`src/manifest.ts`](src/manifest.ts):

```
src/parts/00-requires.ts      ← 4 lệnh require (react/jsx-runtime · ui-primitives · react · react-dom)
src/parts/01..49-*.ts         ← 47 region gốc, giữ nguyên văn (region > 900 dòng bị cắt tại RANH GIỚI
                                 khai báo cấp cao nhất: TaskDetail.js → 34/35/36-TaskDetail{a,b,c}.ts)
src/styles/*.module.css       ← 9 khối CSS, GIẢI MÃ từ chuỗi trong bundle ⇒ nguyên văn từng byte
build.ts                      ← ghép các phần, thay định danh CSS bằng chính chuỗi CSS, bọc IIFE một id
```

Script tháo được giữ ở `.scratch/ui-schedule/extract.ts` (thư mục nháp, bị gitignore) để **tái lập được**:
nó đọc bundle gốc, cắt region, sinh `src/parts/*` + `src/styles/*.module.css` + `src/manifest.ts`.

**Vì sao không viết lại thành module TypeScript có kiểu:** hành vi của row này là 7.549 dòng máy sinh
(bao gồm cả một bản sao `partial-json` 630 dòng và `clsx` 16 dòng đã được nhúng sẵn trong bundle).
Viết lại tay sẽ tạo ra một bản *khác* — mà yêu cầu của row là **render KHÔNG ÍT HƠN bản stock**.
Vì vậy gói này chọn cách **giữ nguyên văn** và dồn toàn bộ nguồn lực vào **phép đo** (§3).

Các phần là **mảnh mã** (không phải module ESM độc lập): chúng chia sẻ một phạm vi sau khi ghép, nên mỗi
file mang `// @ts-nocheck` — chúng không được `tsc` kiểm kiểu (bản gốc là JavaScript đã biên dịch),
nhưng **vẫn chịu đủ ba cổng** `header` · `file-length` (≤ 1000 dòng) · `jsdoc` của repo.

## 3. Bằng chứng parity (đo trên ARTIFACT, không đo trên niềm tin)

`tests/client/ui-schedule.test.ts` — **9 test / 65 expect**:

1. **Một id**: artifact đăng ký đúng `@galaxy-blackhole/gbh-client-ui-schedule`; `id: "@deepseek-ai…"` = **0**.
2. **Tập slot của ta = tập slot của bundle gốc** — đo bằng **chính hai regex của `tools/check/rows.ts`**.
3. **Đủ chín slot** khi chạy `apply` trên context giả (component là **tham số thứ hai**), 2 từ điển ·
   1 loại tab · 1 định nghĩa Turn.
4. **`key` của slot keyed = `id` của định nghĩa loại tab** (`…/task` cho hai chỗ ngồi; `schedules` cho
   cặp `main` ↔ `sidebar.panellist`). Lệch ⇒ renderer rơi vào fallback **không có lỗi console**.
5. **Cổng chặn cài hai lần**: cùng ctx và ctx KHÁC đều chỉ đăng ký 9 slot **một lần**; artifact không
   chứa `lastCtx`/`installedContexts`.
6. **Hợp đồng STORE**: `inject` của `conversation.session.header.utilities` trả **thể hiện đầy đủ**
   (`hooks.catalog.getSnapshot` · `hooks.catalog.subscribe` · `onDelete` · `onRetry` · `openTaskDetail`,
   snapshot đủ 6 khoá) — thiếu một cái là `TypeError: …getSnapshot is not a function` ⇒ cả thanh bên không render.
7. **Nghiệp vụ của Store** đọc Remote và trả kết quả của Host (`onDelete` → `"deleted"`).
8. **Than factory TRÙNG TỪNG BYTE** với bundle gốc (sau khi bỏ 2 dòng wrapper và khối cổng).
9. **CSS chín module TRÙNG TỪNG BYTE** với chuỗi CSS trong bundle gốc.

## 4. Khác biệt DUY NHẤT có chủ ý so với bản gốc

Bản gốc **không có** cổng chặn cài hai lần. Tầng nạp của repo sinh **hai entry** cho một row (id của ta +
alias id gốc) ⇒ `loader.create` cho mỗi entry ⇒ **ctx mới** ⇒ mọi cổng khoá-theo-ctx không bao giờ kích
hoạt ⇒ `apply` chạy hai lần ⇒ `service has been registered`. Vì vậy `src/parts/49-plugin.ts` thêm:

```
let uiScheduleInstalled = false;            // PHẠM VI MODULE — không khoá theo ctx
const uiScheduleContexts = new WeakSet();
function apply(ctx) { … }                   // cổng: đã cài thì bỏ qua
function applyInner(ctx) { …bản gốc… }      // cờ CHỈ bật SAU khi đăng ký xong
```

Test số 8 chứng minh phần còn lại **không đổi một byte nào**.

## 5. Lệnh

```bash
bun run build.ts                 # → lib/index.js + lib/client.js (nhận outDir qua argv[2] cho bản mount)
bun test tests/client/ui-schedule.test.ts
bun run check:rows | grep ui-schedule
```
