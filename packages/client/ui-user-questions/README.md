<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README goi ui-user-questions: bang G4 vung->tep cua ban goc, ly do tach, va NO con lai (chua khai gbh.row)
-->

# `@galaxy-blackhole/gbh-client-ui-user-questions`

Bản viết lại **1:1** của `@deepseek-ai/dsh-client-ui-user-questions` — *Web ask_user_question composer
takeover and plan-review presentation UI* — **CẢ HAI NỬA**.

Wiring (nửa client + đóng gói) do Lead duyệt 19/10/2026 sau sự cố 2 writer (trùng ghi cùng package).

| nửa | nguồn (chỉ đọc) | kích thước gốc | bản của ta |
|---|---|---|---|
| host | `lib/index.js` (11 dòng) | 496 B | `src/index.ts` → `lib/index.js` (`apply()` RỖNG y bản gốc) |
| client | `lib/client.js` (1.942 dòng, 14 vùng `#region`) | 89.521 B | `src/*.ts` + `src/*.module.css` → `lib/client.js` (script classic, MỘT id) |

## 1. Bảng G4 — vùng của bản gốc → tệp của ta

| # | vùng `#region` trong `lib/client.js` | dòng gốc | tệp của ta (dòng) | lý do tách |
|---|---|---|---|---|
| 1 | `../../util/brand/src/index.ts` | 11–20 | `src/brand.ts` (16) | 1 vùng = 1 tệp; `brandString` là util thuần |
| 2 | `lib/types/client/contract/slots.js` | 21–424 | `src/contract.ts` (652) | giữ nguyên **một** tệp cho cả vùng (kiểu + `planReviewOf` + `createWaterfallRequest` + lớp `PendingQuestion`) để bảng vùng→tệp không nhoè |
| 3 | `lib/types/client/draft-store.js` | 425–454 | `src/draft-store.ts` (91) | 1 vùng = 1 tệp |
| 4 | `clsx@2.1.1/dist/clsx.mjs` (bundle nhúng sẵn) | 455–469 | `src/clsx.ts` (54) | vendor 1:1, không kéo dependency `clsx` vào gói |
| 5 | `…/PlanReviewPanel.module.css.mjs` | 470–493 | `src/PlanReviewPanel.module.css` (8) + `src/plan-review-panel.ts` (phần `CLASS`/`injectStyleTag`) | CSS tách thành tệp `.css` (nguồn sự thật), nhúng lúc build |
| 6 | `lib/types/client/PlanReviewPanel.js` | 494–606 | `src/plan-review-panel.ts` (220) | 1 vùng = 1 tệp |
| 7 | `…/QuestionComposer.module.css.mjs` | 607–657 | `src/QuestionComposer.module.css` (8) + `src/question-shared.ts` (`CLASS`) | như #5 |
| 8 | `lib/types/client/QuestionComposer.js` | 658–1233 | `src/question-composer.ts` (71) + `src/question-flow.ts` (681) + `src/question-shared.ts` (263) | vùng gốc 576 dòng nhưng bản TS kèm kiểu + JSDoc vượt ngưỡng đọc; tách theo **hàm**: router (`QuestionComposer`) · luồng thường (`QuestionFlow`) · phần dùng chung (`AnswerField`, `parseRecommendedLabel`, kiểm nháp, IME, `CLASS`) |
| 9 | `../../core/session/src/surface.ts` | 1234–1266 | `src/session-surface.ts` (36) | 1 vùng = 1 tệp; chỉ hai hàm thu hẹp sự kiện surface |
| 10 | `lib/types/client/question-reply.js` | 1267–1403 | `src/question-reply.ts` (204) | 1 vùng = 1 tệp |
| 11 | `…/QuestionReplyView.module.css.mjs` | 1404–1435 | `src/QuestionReplyView.module.css` (8) + `src/question-reply-view.ts` (`CLASS`) | như #5 |
| 12 | `lib/types/client/QuestionReplyView.js` | 1436–1559 | `src/question-reply-view.ts` (266) | 1 vùng = 1 tệp |
| 13 | `lib/types/client/locales.js` | 1560–1630 | `src/locales.ts` (82) | `zh` là nguồn tập khoá, `en` kiểm đủ theo `zh` |
| 14 | `lib/types/client/index.js` | 1631–1936 | `src/plugin.ts` (460) + `src/client.ts` (15) + `src/ids.ts` (66) | vùng cuối tách theo vai: thân plugin (`QuestionCards`, `answerQuestion`, `publishContinuedQuestions`, `apply`) · điểm vào factory · bảng định danh |

Hạ tầng không có vùng tương ứng ở bản gốc (thuần kiểu/tiện ích của bản viết lại):

| tệp | dòng | vai |
|---|---|---|
| `src/types.ts` | 424 | khai lại **cấu trúc** các seam mà nửa client đọc (React runtime, ui-primitives, client-store, ctx của vỏ, `AskUserQuestion*`) để typecheck hẹp không phải kéo `node_modules` của DSH |
| `src/styles.ts` | 24 | `injectStyleTag` — thay chuỗi `\0dsh-css` của bundler gốc, chèn `<style>` đúng một lần |
| `src/deferred.ts` | 32 | `Promise.withResolvers` (lib ES2023 của repo không khai báo) |
| `src/index.ts` | 19 | nửa host — `apply()` rỗng 1:1 |
| `build.ts` | 157 | **HAI** `Bun.build` (host + client) |

## 2. Hợp đồng đã khớp

| điều | cách kiểm | kết quả |
|---|---|---|
| `dsh.client` khớp TUYỆT ĐỐI bản gốc | so `JSON.stringify` với `package.json` gốc | **true** — `inject` 7 phần tử đúng thứ tự + `platform: "web"` |
| `exports["./client"]` | đọc manifest | `./lib/client.js` |
| **LUẬT MỘT-ID** | grep artifact | đúng **1** lời gọi `window.__ModuleLoader__.load`, id = `@galaxy-blackhole/gbh-client-ui-user-questions`; **0** lần id gốc xuất hiện trong `lib/client.js` |
| **≥2 `Bun.build`** | grep `build.ts` | **2** (host ESM → `lib/index.js` · client CJS bọc classic → `lib/client.js`) |
| chuỗi CSS module | so từng byte phần CSS nhúng với literal trong bundle gốc | 1.602 B · 6.333 B · 2.560 B — **bằng đúng** (hash `LVzXQa_`/`Mbwy4a_`/`ROF66W_` giữ nguyên) |
| `locale/en.json`, `locale/zh.json` | `shasum` với bản gốc | khớp tuyệt đối |

Bí danh `react`/`react/jsx-runtime`/`ui-primitives`/`client-store` được `require` **lúc vạt chất hoá factory**
(đúng thứ tự bản gốc: jsx-runtime → react → primitives → store), nên script chỉ đăng ký mà không kéo module.

## 3. Kiểm đã chạy

```bash
# test của gói (10 ca / 60 expect — ĐỔI các ca 'host-only' sang trạng thái HAI NỬA, không xoá ca nào)
bun test tests/client/ui-user-questions.test.ts

# typecheck hẹp (SẠCH)
cd galaxy-blackhole/blackhole-tauri && ~/.bun/bin/bun x tsc --noEmit --strict --target ES2023 \
  --module ESNext --moduleResolution bundler --allowImportingTsExtensions --skipLibCheck \
  --noUncheckedIndexedAccess --noImplicitOverride --verbatimModuleSyntax \
  --lib ES2023,DOM,DOM.Iterable --types bun --jsx react-jsx packages/client/ui-user-questions/src/*.ts

# build hai nửa
bun run packages/client/ui-user-questions/build.ts

# smoke artifact (giả lập loader + bốn module của bảng module)
#  → 1 load (id của ta) · 4 require · inject 7 seam · 3 style tag 1.602/6.333/2.560 B
#  → apply: dictionaries → cards → provide userQuestionPanels → continued → composer slot
#           → node question-reply → on user-questions/request
```

## 4. NỢ (chưa trả, có chủ ý)

1. **CHƯA khai `gbh.row`** — chỉ có `gbh.draft` + `gbh.tests`. Row id thật trong dump là `ui-user-questions`
   (Lead xác nhận); Lead sẽ đối chiếu lại bằng `--dump-config` **và** boot-smoke rồi mới khai row.
2. **Test** — `gbh.tests` trỏ `tests/client/ui-user-questions.test.ts` (**đã có, 10 ca / 60 expect**):
   host rỗng 1:1 · A/B trên Context thật · `dsh.client` deep-equal · `exports["./client"]` + artifact MOT id ·
   build.ts ≥ 2 `Bun.build` · slot/service có trong artifact · CSS + locale nguyên văn · `planReviewOf` nhận/loại ·
   `createWaterfallRequest` kết thúc đúng một lần. **Còn nợ**: `PendingQuestion` đếm ngược/giữ focus và
   `replyPairsOf` với payload hỏng (hành vi thuần, chưa có ca).
3. **`createQuestionDraftStore(defineStore)`** nhận seam `defineStore` làm tham số đầu (bản gốc lấy từ import).
   Đây là **khác biệt chữ ký DUY NHẤT**, theo đúng khuôn các row khác trong repo
   (`createTextStore(defineStore)`, `createZoomStore(defineStore)`…), để bán kính typecheck hẹp không phải kéo
   `node_modules` của DSH. Hành vi `init`/`persist`/`actions` giữ nguyên (`dsh.user-questions.drafts.v1`).
4. **`QuestionComposer.js` tách 3 tệp** (xem #8 ở bảng G4) — ranh giới theo hàm, không theo vùng; tên export
   công khai của gói (`apply`, `inject`) không đổi.
5. **`Promise.withResolvers` → `deferred()`** (`src/deferred.ts`), cùng khuôn `ui-agent-preset/src/deferred.ts`.
6. **Header của tệp `.css` bị bỏ khi nhúng** (`cssTextOf` trong `build.ts`) để chuỗi CSS vào DOM là **nguyên văn**
   bản gốc; header repo vẫn còn trong tệp nguồn.
7. **Ghi đồng thời**: lúc port, một tiến trình khác cũng ghi `src/*.module.css` của gói này (09:27–09:28,
   có lần đặt SAI nội dung composer = CSS của PlanReview). Lead cần chốt người sở hữu gói trước khi mở
   `gbh.row`, tránh hai bên ghi đè nhau.

## 5. Slot & service mà row này CHIẾM (đo 19/10/2026 bằng grep toàn repo)

| slot / seam | kiểu | ai đang đăng ký | ghi chú |
|---|---|---|---|
| `conversation.composer` | chain (có `select`) | **row này** + `ui-approval` + `ui-subagent` (đều của ta) | chain nhiều chủ; `select` quyết định ai thắng, nên KHÔNG phải single-slot |
| `conversation.chat.node` | keyed `key: "question-reply"` | **row này** | key không trùng `ui-chat` · `ui-tool` · `ui-goal` · `ui-workflow-run` (đã grep 4 gói đó) |
| `conversation.plan-review.actions` | slot CON khai trong `children` | không có occupant nào | row này KHAI BÁO slot, không đăng ký vào nó |
| `userQuestionPanels` | service (`ctx.reflect.provide`) | **row này** | `ui-tool/src/toolviews-ask.ts` ĐỌC qua `ctx.get("userQuestionPanels")` — port xong là seam có chủ |

⇒ Không có slot `single` nào bị tranh chấp (sự cố `sidebar.brand.mark` 18/10/2026 không lặp lại ở row này).
