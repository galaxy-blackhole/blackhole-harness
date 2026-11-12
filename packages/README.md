<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban do package cua buoc 2: quy uoc ten, nhom, hop dong bat buoc cho moi package @galaxy-blackhole/gbh-*
-->

# Packages — bản đồ bước 2

Từ M4 trở đi, mỗi phần của harness được **viết lại thành một package riêng** trong thư mục này,
đặt tên `@galaxy-blackhole/gbh-<vai trò>` — quy đổi 1-1 từ `@deepseek-ai/dsh-<vai trò>`.

```text
@deepseek-ai/dsh-host-webserver   →   @galaxy-blackhole/gbh-host-webserver
@deepseek-ai/dsh-client-ui-chat   →   @galaxy-blackhole/gbh-client-ui-chat
@deepseek-ai/dsh-session          →   @galaxy-blackhole/gbh-session
```

> **Công thức từng bước**: [docs/recipes/HOST-ROW-REWRITE.md](../docs/recipes/HOST-ROW-REWRITE.md) — 4 câu phải trả lời trước khi viết ·
> khối `gbh.row` · luật viết plugin · ma trận mã lỗi gateway · 4 ca test tối thiểu · cách đọc bảng TRƯỚC/SAU · lưới an toàn `GBH_DISABLE_REWRITES=1`.
## 1. Cách một package của ta được nạp vào app

Kernel/core ở bước 2 **vẫn là DSH** (M3 làm cuối cùng). Vì vậy package của ta phải mount được vào cây
plugin đang chạy, đúng cơ chế mà `gbh-brand` đang dùng:

1. Package của ta được **link vào `<DSH_HOME>/profiles/node_modules/`** (symlink hoặc `file:` dep),
   nên loader resolve được tên gói.
2. Một **row patch** thay row cũ bằng tên gói của ta (theo `id`, xem hợp đồng C3).
3. `bh host` ghép patch đó vào lớp cuối `<DSH_HOME>/app.patch.yml` mỗi lần boot.

### Row patch là DỮ LIỆU của chính package (task-13)

Phần thay row KHÔNG nằm trong file dùng chung nữa: mỗi package khai nó trong `package.json` của mình (trường `gbh.row`),
`apps/cli` quét `packages/**` rồi sinh khối `disable + insert` (cơ chế bắt buộc vì `name` là guard — ADR 0004 §2).
Thêm một package = TẠO THƯ MỤC, không sửa `profile.ts` hay `parity.patch.yml`.

    "gbh": {
      "row": { "id": "webserver", "inject": ["webStartup"], "config": { "compression": "gzip" }, "tests": ["tests/host/webserver.test.ts"] },
      "peers": ["@deepseek-ai/dsh-typert-protocol"]   // chỉ gói thuộc seam của kernel (§3b)
    }

Quy tắc giá trị config: literal (`gzip`, `1024`, `true`) hoặc "{ "js": "…" }" khi cần `!!js` (ví dụ `ctx.webStartup.host`).
Mọi lần thay row đều đi qua cùng một đường: `bh host` build → mount vào `<DSH_HOME>/profiles/node_modules` → sinh khối patch.

Chi tiết + lý do: [ADR 0004](../docs/ADR/0004-mount-package-cua-ta-vao-profile.md).

## 2. Nhóm package (theo đúng nhóm của upstream để dễ đối chiếu)


> **Bài học (R12, 19/10/2026) — thay id package trong patch/bundle**: phải **longest-first + ranh giới quote**
> (`@deepseek-ai/dsh-session(?![\w-])`), nếu không `dsh-session` sẽ ăn vào `dsh-session-query-sqlite` và phép
> thay NGƯỢC không tái tạo được nguyên văn bản gốc. Mẫu chứng minh: 12 bundle `packages/host/bundle-*` — mỗi
> gói ghi `gbh.provenance.replacements` (id stock · id ta · số lần) và test assert hai chiều.

| Nhóm | Vai trò | Tầng | Thứ tự viết lại |
|---|---|---|---|
| `host/` | HTTP surface: webserver, index injection, static dist, directory picker, open-in-app | T2 | **M4 — đầu tiên** |
| `api/` | Remote BFF: gateway, remotes, các `*-controller` (session, workspace, settings, jobs, terminal, files) | T2 | M4 |
| `client/` + `client-ui/` | Shell client + 49 plugin UI (slots, inject, CSS Modules) | T3 | M5 |
| `tool/` | 19 tool plugin (bash, fs, fs-search, web, todo, skill, goal, jobs, present…) | T4 | M6 |
| `llm/` | Service `llm` + provider adapter (route `auto` → Ollama) + retry | T4 | M6 |
| `sandbox/`, `shell/`, `subprocess/` | Thực thi: bash/pwsh, sandbox policy, tiến trình | T4 | M6 |
| `session/`, `storage/`, `spill/` | Phiên (`session.v4.jsonl.zstd`), lưu trữ, spill | T1 | M6 (dùng hợp đồng C5) |
| `subagent/`, `goal/`, `schedule/`, `workflow/`, `mcp/`, `terminal/` | Năng lực agent nâng cao | T4 | M6 |
| `kernel/`, `core/` | Context/Service/effect/Loader + agent spine | T0/T1 | **M3 — cuối cùng** |
| `bundle/` | Các lớp patch (base, web-app, desktop) | — | M7 |

> **Bài học (19/10/2026)**: khi một tệp đang có **writer khác** ghi (subagent/agent đang chạy), **KHÔNG tách/ghi đè tệp đó** — tách giữa lúc ghi làm tệp cụt (`Unexpected end of file`) và mất ca test (sự cố `tests/host/tool-skill.test.ts` 1.016 dòng). Cách đúng: chờ writer xong → tách harness dùng chung + tệp test ≤1000 dòng.
>
> **Bài học 2 (19/10/2026)**: `write` là **GHI ĐÈ TOÀN BỘ** — trước khi write tệp của người khác phải **đọc HẾT tệp**; tệp **>200 dòng** chỉ dùng `edit` (chèn), KHÔNG `write` (đã xoá nhầm ~700 dòng README của `plugin-market`, gói chưa git track nên không khôi phục được).

## 3. Hợp đồng bắt buộc cho MỌI package trong thư mục này

| # | Yêu cầu | Cách kiểm |
|---|---|---|
| 1 | Header 5 dòng (author/email/create date/modify date/desc) | `bun run gate` |
| 2 | ≤ 1000 dòng/file, mọi export có mô tả (làm gì · nhận gì · trả gì) | `bun run gate` |
| 3 | Không phụ thuộc `@galaxy-stack/ai-coder-core` (kể cả transitive) | `gate:dep-guard` |
| 4 | **Ghi rõ nguồn đối chiếu** trong README của package: tên gói upstream + đường dẫn file trong
   `vendor/dsh-reference`, mức độ dẫn xuất (viết lại theo hành vi / copy có sửa / chỉ tham khảo) | review của Lead |
| 5 | **Test riêng** cho package (unit + hành vi), chạy được độc lập | `bun test <package>` |
| 6 | **Bằng chứng parity** khi thay một row: dump-config vẫn 0 thêm/0 thiếu/0 đổi so với oracle, và
   với UI thì phải có ảnh A/B | `bun run parity:dump` / `parity:report` |
| 7 | Package không được sửa file của package khác; giao tiếp qua service của kernel | review |

### 3b. Peer được phép (danh sách ĐÓNG — chốt 17/10/2026)

Chỉ được khai **peerDependency** vào các gói thuộc **seam của kernel**. Hiện là đúng ba cái:

| Peer | Vì sao thuộc seam | Thay thế ở đâu |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `Context`/`Service`/`effect` | M3 — kernel của ta phơi cùng tên |
| `@deepseek-ai/schemastery` | schema `Config` để Settings/config-editor render được field | M3 |
| `@deepseek-ai/dsh-typert-protocol` | lớp RPC của kernel (`TypertRemoteService`) | M3 |

Điều kiện bắt buộc: (a) luôn là **peer**, không bao giờ là dependency — để chỉ có ĐÚNG MỘT instance do kernel cấp;
(b) README của package ghi rõ vì sao cần và nó thuộc seam nào; (c) ở M3, kernel của ta phải phơi cùng tên đó.
Mọi thứ khác phải là code của ta hoặc `node:` builtins. Gói nào bắt buộc kéo thêm gói DSH ngoài bảng này thì **dừng lại hỏi Lead**.
## 4. Trạng thái các package

| Package | Tầng | Trạng thái | Bằng chứng |
|---|---|---|--
| `host/session-title-all-prompts-llm` | T4 | ✅ de-bundle 1:1 (task-202) — **127 dòng**, byte-identical stock, có `.debundled`; row LONG `optional-session-title-all-prompts` (dump dòng 1507) ⇒ khai `gbh.row.id` + `gbh.nested` để registry redirect lúc mount preset | `cmp` + sha trùng · export `Config/apply/name/inject` khớp · test **7 ca** |
| `host/compaction-image-offload` | T4 | ✅ de-bundle 1:1 (task-207) — 9 tệp `lib/` + locale en/zh nguyên văn, `.debundled`, row `image-offload` | `cmp` + sha trùng · export khớp · test **6 ca** |
| `host/goal` | T4 | ✅ đã viết xong (**host-only**, bản gốc **906 dòng** `lib/index.js`, **MỘT MẶT** — `lib/client.js` KHÔNG tồn tại, manifest gốc KHÔNG có `dsh.client`), **CHƯA khai `gbh.row`** (chờ lượt boot của Lead) | row `goal` đã thay bằng bản viết lại **7 module** (`runtime` · `types` · `fold` · `projection` · `dispatch` · `service` · `index`): service `ctx.goals` — trạng thái goal **cùng phiên** hướng sự kiện + so-sánh-và-đặt theo revision + quyền tự động chạy tiếp **phạm vi tiến trình** · **bước 0 ĐẠT** (dump `2026-10-18T01-31-57`): cặp `- id: goal` + `name: '@deepseek-ai/dsh-goal'` ở `ours.yml` dòng **275–276**, **KHÔNG** `disabled`/`config`/`inject` (row trần) ⇒ luật *"`config` dùng `!!js ctx.X` phải có `inject X`"* không áp dụng (đã kiểm, không bỏ qua) · **tập export trên ARTIFACT = 10 = 10, 0 thiếu · 0 thừa** (`GOAL_CHANGE_VERSION` · `GoalError` · `GoalId` · `GoalService` · `default` · `applyGoalProjection` · `decodeGoalChange` · `foldGoal` · `goalChangeRef` · `goalProjectionDefinition`), prototype **25 = 25** trùng từng tên, `inject` `["agents","sessionProjections"]` và `String(Config)` trùng từng ký tự · **22 test / 96 expect · 0 fail**: **22 bước vòng đời chạy CẢ HAI bản** (ta + chính bundle gốc) trên **Context cordis THẬT** + **sổ chiếu phiên THẬT** ⇒ vết bước + vết sự kiện trùng **từng ký tự**; **8 giá trị trạng thái hỏng + 8 thay đổi hỏng** cho **cùng thông điệp zod/Error**; khung nhìn dây bị zod cắt khoá lạ y hệt · **C6 — DANH TÍNH** (`init()` hai lần là hai vật, `seenGoalIds` không chia sẻ, `foldGoal` trả bản sao, `get()` hai lần là hai khung nhìn, hai giàn độc lập) · **waitFor CÓ TRẦN** (người nghe `goal/changed` reject ⇒ log `listener rejected`, lượt ghi vẫn xong) · **`gbh.peers` ⊆ `peerDependencies` 5/5 (so PHẦN TỬ) + 3 ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch · thêm-tên), `dependencies` RỖNG; peer bậc 2 `dsh-typert-protocol` · `dsh-llm` · `dsh-scope` + bậc 1 `schemastery` + bậc 3 `zod`; cordis chỉ mượn kiểu · **ĐỐI CHỨNG ÂM của chính test** (đ... (line truncated to 2000 chars)
| `host/system-prompt` | T1 | ✅ đã viết xong (**host thuần**, bản gốc **409 dòng** build + **316 dòng** `.d.ts`, **MỘT MẶT**), **CHƯA khai `gbh.row`** (chờ lượt boot của Lead) | row `system-prompt` đã thay bằng bản viết lại **5 module** (`types` · `render` · `order` · `layer` · `index`): sổ lắp ghép system prompt — mục prompt có thứ tự (bảng `SECTION_ORDERS`/`CONTEXT_ORDERS` do trung tâm cấp), ngữ cảnh động (`required` sống sót khi deployment tắt ngữ cảnh tuỳ chọn), schema tool (`toolOrder` + mốc `<unlisted-tools>`, tách tham số bằng `structuredClone`), biến nội suy NGHIÊM NGẶT (`{{name}}`, giá trị đã thay KHÔNG quét lại, `interpolate:false` giữ nguyên văn), hai lớp đăng ký (global + scope) trên `NamedEntries`/`AnonymousEntries`/`ScopedLayers` của `dsh-scope`, waterfall `system-prompt/assemble` có lọc phạm vi (`scopeTarget`) và mục `complete` được phục hồi sau waterfall · **bước 0 ĐẠT** (dump `2026-10-18T01-31-57`): cặp `- id: system-prompt` + `name: '@deepseek-ai/dsh-system-prompt'` ở `ours.yml` dòng **465–466**; `config:` **chỉ** `personaPrefix: You are a coding agent powered by the {{model}} model.`, **`inject:` KHÔNG có** (row trần, không `!!js`); **`dsh.client` KHÔNG** và **`lib/client.js` KHÔNG** ⇒ MỘT MẶT · **tập export trên ARTIFACT = 9 = 9, 0 thiếu · 0 thừa** (`PERSONA_PREFIX_SECTION` · `PERSONA_SUFFIX_SECTION` · `SystemPrompt` · `TOOL_ORDER_REST` · `default` · `joinContextSections` · `renderContextSections` · `renderContextSnapshot` · `renderPrompt`), prototype `8 = 8`, `String(Config)` trùng từng ký tự · **16 test / 154 expect · 0 fail**: mọi ca chạy **CẢ HAI** bản (ta + bundle gốc) trên **Context cordis THẬT của hai bản cài** — `assemble()` trùng **từng ký tự** (canonical giữ cả `undefined`), 8 hình dạng nội suy + **17 hình dạng lỗi** (trùng/reference/`toolOrder`/complete kép/tên dành riêng) cho **cùng thông điệp**, mục/biến theo scope **che** global, `refreshContext` (giữ **tham chiếu** mục chỉ-do-waterfall khi BẬT, bỏ khi TẮT, `required` giải lại) · **... (line truncated to 2000 chars)
| `host/typert-loader` | T2 | ✅ đã viết xong (**host thuần**, bản gốc **374 dòng**), **CHƯA khai `gbh.row` — chờ lượt boot của Lead** | row `typert-loader` đã thay: bộ nạp typert tự đăng ký vật thể `TYPERT` của mọi gói plugin đã mount và GỠ khi entry xuống · **bước 0 ĐẠT** (dump `2026-10-18T01-31-57`): cặp `- id: typert-loader` + `name: '@deepseek-ai/dsh-typert-loader'` ở `ours.yml` dòng 34–35 · **`config:` rỗng · `inject:` rỗng** (row trần, không `!!js`) ⇒ `gbh.row` không cần inject/config; **KHÔNG có `lib/client.js`** và **không có khoá `dsh`** ⇒ MỘT MẶT · **tập export trên ARTIFACT = 6 = 6, 0 thiếu · 0 thừa** (`Config` · `TYPERT_HOST_EXPORT` · `apply` · `inject` · `name` · `validateTypertManifest`) · **12 test / 50 expect · 0 fail**: mọi ca chạy **CẢ HAI** bản (ta + bundle gốc) trên cùng giàn giả rồi so **từng thông điệp lỗi** (20 vật thể hỏng **trùng từng ký tự** · 4 ca `AggregateError` · ca thiếu `baseUrl` · 1 ca ghi log ở trạng thái ổn định) + **mount/unmount/gỡ đăng ký** · **C6 DANH TÍNH** (`Config` hai lần độc lập; hai lần `apply` không chia sẻ sổ đăng ký) · **`gbh.peers ⊆ peerDependencies` kèm ĐỐI CHỨNG ÂM** (2 peer bậc 1 §3b: `cordis` · `schemastery`) · `locale/{en,zh}.json` **byte-for-byte** (`shasum b29837ab…` · `02762b9d…`) · `grep -c 'id: @deepseek-ai' lib/index.js` = **0** · **2 khác biệt CÓ Ý đã ghi trong README gói** (bỏ helper `__rewriteRelativeImportExtension` của tsdown — đồng nhất trên artefact `.js`; kiểu seam khai **theo cấu trúc** vì `dsh-typert-registry`/`cordis-plugin-loader` ngoài bảng §3b) · `check:rows`: **0 dòng `chan`** (99 gói có `gbh.row` — TẤT CẢ đạt) · **CHƯA làm**: khai `gbh.row` + `lab:row` + mount 5439 + `check:app` (thuộc lượt boot của Lead) |
| `client/ui-chat` | T3 | ✅ M5 xong phần CẮT LÁT (chờ lượt boot của Lead để mount) | row `ui-chat` đã thay (**row client LỚN NHẤT: 13.340 dòng gốc**, nửa host 80 dòng) · nửa client **cắt thành 18 lát theo đúng ranh giới `//#region` của tsdown, ghép lại NGUYÊN BYTE** — test khẳng định thân bundle trùng **từng byte** với vùng nguồn gốc + 5 dòng `exports.*` (lý do: chép tay 13.340 dòng trong một lượt chắc chắn rơi vào bẫy "render ÍT HƠN bản stock ⇒ mất nội dung ÂM THẦM") · **18 module CSS nguyên văn từng byte**, giữ nguyên hash lớp + nguyên `<style data-plugin-css="@deepseek-ai/dsh-client-ui-chat/<Tên>.module.css">` · **tập 8 slot BẰNG tập slot của chính bundle gốc** (đo bằng đúng hai regex của `check:rows`) · **chạy THẬT cả hai bundle trong cùng harness** rồi so từng thứ tự `inject`/`register`/`registerFactory`/`effect`/`locale`/`provide` ⇒ **khớp hoàn toàn**, 15 `key` của slot KEYED `conversation.chat.node` (`user`…`unknown`) y hệt · **hợp đồng store (luật 8)**: `store` cấp cho `conversation.view` + `conversation.chat.flow` là thể hiện ĐẦY ĐỦ `getSnapshot`/`subscribe`/`actions` gọi được thật, đến từ `require("@galaxy-blackhole/gbh-client-store")` · cổng chống cài hai lần **phạm vi module** (cờ bật SAU `applyInner`, không khoá theo `ctx`) · `inject` 11 seam nguyên văn · **14 test / 142 expect** · artifact: **id ta = 1 · id gốc = 0** · `check:rows`: **0 dòng** · lab cách ly cổng 5472: **`#root` 41.266 · 124 entry · 18 thẻ CSS của ta · 0 lỗi console · 0 lỗi page · 0 dòng "did not activate" của row này** (entry `@deepseek-ai/dsh-client-ui-chat` còn lại chỉ là **alias** cùng `url`/`rev` cho 9 row `inject` vào) · **CHƯA XONG: 18 lát mang `// @ts-nocheck` (JS đã bỏ kiểu) nên `gate:typecheck` không canh nửa client — xem README gói §7** |
| `client/ui-workspace` | T3 | ✅ M5 xong (chờ lượt boot của Lead để mount) | row `ui-workspace` đã thay (bản gốc **5.354 dòng**) · **4 module CSS nguyên văn từng byte** — giữ nguyên tiền tố hash `YDXeBa_`/`Qg_5Eq_`/`_G5b-a_`/`bhn1Oq_`, trong đó `.Qg_5Eq_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}` là **lớp gây lệch bố cục +21px** (overlay tuyệt đối, không chiếm chỗ trong luồng) · **tập 6 slot BẰNG tập slot của chính bundle gốc** (đo bằng đúng hai regex của `check:rows`) · id người ngồi `pin`/`rename`/`fork`/`archive`/`session-id`/`workspace.session-rename`/`workspace.session-archive`/`workspace.row-toast` **nguyên văn** · từ điển `workspace` **119 khoá/bảng** (zh+en) đối chiếu bundle gốc · `inject` 9 seam nguyên văn · **8 test** (luật 1 id · tập slot · CSS từng byte · từ điển · cổng chặn cài hai lần phạm vi module: lần đầu NÉM ⇒ cờ vẫn `false` ⇒ lần hai đăng ký lại đủ 6 slot) · artifact: **id ta = 1 · id gốc = 0** |
| `client/ui-open-in-app` | T3 | ✅ M5 xong (chờ lượt boot của Lead để mount) | row `ui-open-in-app` đã thay (**nửa client**, 895 dòng gốc — nửa host RỖNG y như gốc, vì 3 route nằm ở row `host/open-in-app` đã xong M4b) · **6 test** (khuôn 1 id · `inject` y hệt 10 gói gốc · **tập 6 slot BẰNG tập slot của chính bundle gốc** · `id: "open-in-app"` + `order: -10` nguyên văn · **45 khoá từ điển đối chiếu với `locales.d.ts` gốc** · cổng chống cài hai lần) · artifact: **id ta = 1 · id gốc = 0** · `check:rows`: 0 dòng chặn (1 cảnh báo "chưa thấy artifact trong profile" — hết sau lượt boot của Lead) · lab cách ly cổng 5470: 93.573 B · **`#root` 58.588 · 0 lỗi console · 0 dòng `did not activate`** · 3 route nửa host trả 200 (apps 55 B: finder · vscode · xcode · iterm · terminal) |
| `client/ui-deliverables` | T3 | ✅ M5 xong (chờ lượt boot của Lead để mount) | row `ui-deliverables` đã thay (**hai mặt**, 2.614 dòng gốc: nửa client 2.341 dòng bundle + nửa host 271 dòng) · **18 file** — trong đó 5 module CSS **nguyên văn TỪNG BYTE** so với chính bundle gốc (giữ nguyên tiền tố hash `_93YTAG_`/`IP6KhG_`/`hz8-rW_`/`nyYjTG_`/`ZDDmpq_`) · **tập 3 slot BẰNG tập slot của chính bundle gốc** (`conversation.chat.turnTail` · `tool.call.toolview` · `sidebar.right.pane.tab`, đo bằng đúng hai regex của `check:rows`) · **đối chiếu trực tiếp với bản gốc**: nạp bundle gốc trong `window` giả rồi chạy `apply` của CẢ HAI trên cùng một context giả ⇒ khớp từng khoá spec, từng khoá `hooks`, từng thẻ `<style>` (id + CSS), `id` người ngồi + `key` + `children` + `locale` nguyên văn, `inject` 8 seam y hệt, từ điển `deliverables` (zh+en) khớp nguyên văn từng khoá · **9 test / 96 expect** · artifact: **id ta = 1 · id gốc = 0** |
LC_COLLATE="C"
LC_CTYPE="C"
LC_MESSAGES="C"
LC_MONETARY="C"
LC_NUMERIC="C"
LC_TIME="C"
LC_ALL= nguyên văn,  8 seam y hệt, từ điển  **129 khoá/bảng** (zh+en) khớp nguyên văn · **9 test / 96 expect** · artifact: **id ta = 1 · id gốc = 0** |
| `client/ui-brand-official` | T3 | M5 xong (row 154, 58 dong goc) | row ui-brand-official da thay · 2 slot nguyen van (sidebar.brand.mark · sidebar.brand.name) · FishLogo/BrandWordmark qua primitive · bundle MOT id (artifact id goc = 0) · test 4 ca · component la THAM SO THU HAI cua register |
| `client/ui-brand` | T3 | ✅ **DI CHUYỂN** (không tính vào chỉ số đã thay row) | row `ui-brand-official` gốc được thay bằng `gbh-brand` (`insertAs` để khớp vị trí oracle). **ĐÂY LÀ DI CHUYỂN, CHƯA VIẾT LẠI** — xem README gói và nợ kỹ thuật task-17 trên ROADMAP |
| `client/ui-jobs` | T3 | ✅ xong (dang chay that) | row da thay · JobListAction 252 dong (menu bung + portal + TerminalBlock + kill) · build 2 id literal · test 3/3 · check:rows dat · lab 0 loi console · **A/B: session-open 0 px + ours +0/ref +0** (tm-ui-features, .parity/features/2026-10-17T11-38-54) |
| `client/ui-settings-session-log` | T3 | ✅ xong (đang chạy thật) | row đã thay · có test · `check:rows` sạch |
| `client/ui-settings-general` | T3 | ✅ **M5 xong (đang chạy thật)** — còn **1 lệch bố cục +21px** đang đo | row `ui-settings-general` (bản gốc 1.327 dòng: **9 slot + 3 hook + 5 bề mặt service**) · `ids.ts` 53 · `locales.ts` (**zh 221… kiểm bằng import**) · hợp đồng ghi trong mô tả task-56 · **KHÔNG mount khi thiếu slot** (row stock đang bật, màn Settings vẫn chạy bằng bản gốc) — lý do: mount sớm ⇒ tắt row stock khi trang chưa đủ ⇒ màn Settings hỏng · khuôn tách UI: **7 file component** + `GeneralDeps`, vùng ghi theo FILE (tm-ui-features) |
| `client/ui-permission` | T3 | ✅ xong (đang chạy thật) | row `ui-permission` đã thay (hai mặt, 831 dòng gốc) · **9 test** (bundle 2 id · 10 seam · 2 từ điển 12+17 khoá · 2 slot occupant · catalog chốt thế hệ · hàng cài đặt ghi đúng 1 đường dẫn `defaultPreset` kèm revision · chip + badge EXP) · `check:rows` sạch · lab cô lập: `#root` **57.501 = 57.501**, 0 lỗi console, 0/0 phần tử lạ · `check:app` 11/11 (24 gói) · CSS 2 module giữ hash `oY77xG_*`/`iWlSmW_*` · `locale/{en,zh}.json` chép byte-for-byte |
| `client/ui-settings-web-search` | T3 | ✅ xong (đang chạy thật) | row đã thay · inject 5 service nguyên văn · slot occupant giữ tên nguyên văn · RPC credentials qua seam `remote` |-|
| `client/ui-message-feedback` | T3 | ✅ gói viết lại xong (chờ Lead mount/khai chạy thật) | row `ui-message-feedback` (bản gốc 881 dòng) · bundle **MỘT id** (artifact: id gốc = 0, id ta = 1) · **2 slot nguyên văn** (`conversation.chat.assistant-actions` id `feedback` order 10 · `conversation.input.overlay` id `feedback-dialog` order 2) · component là **THAM SỐ THỨ HAI** của `register(spec, Component)` · cổng chặn cài hai lần **phạm vi module**, cờ bật SAU `applyInner` · từ điển `zh`/`en` đủ **20 khoá** của bản gốc · CSS 2 module giữ hash `_6_jNJa_*` / `_8_XoUG_*` · **8 test** (khuôn bundle · mặt plugin · từ điển đối chiếu bundle gốc · 3 ca tầng điều khiển) · `check:rows`: 0 dòng cho row này (kết luận chung "43 package — TẤT CẢ đạt") · **lab cô lập cổng 5472** (`lab:row`): `#root` 58.588 ký tự · **0 lỗi console** (1 cảnh báo của `gbh-client-shortcuts`, không phải row này) · `FeedbackDialog` **có trong cây React** ⇒ plugin ĐÃ kích hoạt + occupant overlay đã đăng ký (Like/Dislike vắng mặt đúng vì lab chưa có tin nhắn assistant) · 2 thẻ CSS module của ta có trong DOM · boot lại có ghi stdout: **0 dòng "did not activate"** · lưu ý: `remote.sessionFeedback` VẪN có mặt dù patch tắt `command-feedback` (client mount theo catalog của `dsh-api-remotes`) |
| `host/webserver` | T2 | ✅ M4a xong (đang chạy thật) | parity row đã thay · 16 test · gzip/gzip-ngưỡng/Uint8Array (§8 ADR 0004) |
| `host/open-in-app` | T2 | ✅ M4b đợt 1 xong (đang chạy thật) | 3 route · apps 55 B y hệt oracle · icon PNG 12.418 B **byte-for-byte** · 401 khi không cookie · 9 test |
| `client/modules` | T3 | ✅ M5 đợt 1 xong (đang chạy thật) | row `modules` đã thay · **25 test** trên fixture thật C1 (72 entry · 3 batch · 2 chu trình · 1 id mồ côi · 1 ca BYTE) · app 200 · `__DSH_BOOT__` 72 entry · 0 lỗi console |
| `client/resources` | T3 | ✅ M5 dot 1 xong (dang chay that) | row `resources` da thay · 8 test · giu nguyen service `resources` + hook `resource` cho 5 row phu thuoc · app 200 · UI 99.349 ky tu · 0 loi console |
| `client/ui-settings-agent-loop` | T3 | ✅ xong (đang chạy thật) | row `ui-settings-agent-loop` đã thay (**hai mặt**, 186 dòng gốc) · **12 test** trên bản build thật (2 id module dùng chung 1 factory · slot `plugins.item`/`agent-loop`/`order 30` · hook `agentLoopCard` · render form · 3 ca đường lỗi) · home cách ly: **48.907 B · 72/72 entry** · inject của entry **y hệt gốc** · app 5439: 200 · 0 `did not activate` · combo `/plugins` phục vụ thật chứa **cả hai** id · `check:rows` sạch |
| `client/ui-settings-plugins` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-settings-plugins` đã thay (**hai mặt**, 234 dòng gốc) · **11 test** chạy A/B với chính bundle gốc trong `window` giả (định nghĩa section · cây element · ledger tab · CSS · bàn phím · HMR · đường lỗi) · **một id module** (đo được 0 bundle `require` id stock ⇒ không cần alias) · lab cách ly 5455: **49.047 B · 72 entry · 0 px lệch/921.600 px** so với lab stock 5457 · app 5439: 200 · `check:app` **7/7 ĐẠT** · parity 0/0/0 · `check:rows` sạch |
| `client/ui-settings-shell` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-settings-shell` đã thay (**hai mặt**, 211 dòng gốc) · **7 test** (so trực tiếp tập export với bản gốc + đếm hai id module + hành vi từ điển/2 cầu nối form/occupant slot) · lab cách ly `/tmp/gbh-lab-shell` + cổng 5458: entry 73→73 với id ta, **id gốc biến mất**, `#root` **57.510 ký tự** y hệt đường nền, 0 lỗi console · hai bẫy đã bắt: bundle client không được chứa cú pháp ESM, và package trong `profiles/node_modules` phải đúng TÊN PACKAGE |
| `client/ui-approval` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-approval` đã thay (**hai mặt**, 371 dòng gốc, **6 inject**) · **27 test / 138 expect** trên bản build thật (khuôn hai id · `PendingApproval` 7 ca gồm AbortSignal · waterfall 5 ca · panel theo đúng props gốc · 10 ca bàn phím/IME · CSS nhúng khớp file nguồn) · lab cách ly: TRƯỚC 39.326 B/72 entry → SAU **39.351 B/72 entry**, chỉ 1 entry đổi tên, `inject` y hệt, 0 `did not activate` · app 5439: 200 · combo `/plugins` phục vụ thật chứa **cả hai** id + `conversation.composer` · `check:rows` sạch |
| `client/ui-sidebar` | T3 | ✅ xong (đang chạy thật) | row `ui-sidebar` đã thay (**hai mặt**, 541 dòng gốc, **7 inject**) · **16 test / 118 expect** (khuôn 2 id · CSS cả hai module nhúng khớp file nguồn · **2 TEST CANH**: runtime JSX + CSS khớp bản gốc · `syncPanels` lọc trùng · `injectProps` + analytics `sidebar_menu_click` · cây `SidebarRoot`/`PanelRow` · nhánh macOS/windows-titlebar) · lab cách ly: TRƯỚC 39.326 B/72 entry → SAU **39.351 B/72 entry**, `inject` đủ 7 y hệt, 0 `did not activate` · **(8) phía trang: 57.501 → 57.501 ký tự `#root`, 0 lỗi console** · **ảnh A/B trên app thật: 0 px / 1.119.744 px ở cả HAI màn** (Plugins→Installed · Settings→General) · app 5439: `check:app` **8/8**, bố cục thanh bên khớp ref từng ô · `check:rows` sạch |
| `client/ui-reference` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-reference` đã thay (**hai mặt**, 475 dòng gốc, `inject` 9 service) · **9 test / 83 expect**, 6 ca A/B trực tiếp với chính bundle gốc trong `window` giả (định nghĩa occupant `key: file/folder` · nguồn `@` · hai rule văn bản · danh sách ứng viên tệp+phiên · crumb + `onPick` · địa chỉ `dsh-resource://file/session/…` · cây element 2 chip + hộp thoại lỗi · **một id module khớp tên package**) · `dsh.client.inject` **y hệt** 8 gói gốc · lab cách ly 5458: 200 · 48.262 B · 70 entry (72 − 2 row crash của người khác bị overlay tắt) · `mode: live` · **`#root` 89.015** · **0 lỗi console** · app 5439: `check:app` **8/8 ĐẠT** (49.234 B · 72/72 entry · **`#root` 99.183 · 0 lỗi console**) · parity row này **0 THÊM/0 THIẾU/0 ĐỔI** (đã thay 13 row) · `check:rows` sạch |
| `client/ui-workflow-run` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-workflow-run` đã thay (**hai mặt**, 676 dòng gốc) · **10 test / 114 expect**, 6 ca A/B với chính bundle gốc trong `window` giả (Definition `match/start/update/buildViewNode` · chiếu pha + `turnAbandoned` · máy trạng thái disclosure · cây element · tương tác header) · **CSS: 31 selector, 0 lệch thuộc tính** · `dsh.client.inject` **y hệt** 7 gói gốc · **1 id module khớp tên package** + `gbh.row.moduleIds` (đo 0 bundle `require` id stock) · lab 5460: 200 · 49.284 B · 72 entry · `mode: live` · **`#root` 89.015** · **0 lỗi console** · app 5439 `check:app` **(1)…(10) ĐẠT** (49.284 B · 72/72 · **`#root` 99.183 · 0 lỗi console** · bố cục **0/80** · mount mới nhất khớp repo) · parity **0 THÊM/0 THIẾU/0 ĐỔI** (đã thay **15** row) · `check:rows` sạch |
| `client/ui-goal` | T3 | ✅ xong (đang chạy thật) | row `ui-goal` đã thay (**hai mặt**, 672 dòng gốc, **7 inject**, 6 seam) · **34 test / 144 expect** (khuôn 2 id chung 1 factory · ba slot đúng thứ tự + bốn động từ CAS · nguồn kích hoạt ba epoch tự nhả · cây GoalBar/GoalDock · định nghĩa chiếu + rule chip ranh giới · **2 TEST CANH**: runtime JSX + CSS khớp bản gốc) · lab cách ly: TRƯỚC 39.326 B/72 entry → SAU **39.351 B/72 entry**, `inject` đủ 7 y hệt, 0 `did not activate` · **(8) phía trang: 57.501 → 57.501 ký tự `#root`, 0 lỗi console** · `check:rows` sạch |
| `client/locale` | T3 | ✅ M5 xong (**row NỀN — 48 row phụ thuộc**) | row `locale` đã thay thật · **5 test / 84 expect** A/B **tầng dịch vụ** với chính bundle gốc (6 môi trường dò ngôn ngữ · từ điển namespace→common→khoá · setLocale/revision/sự kiện/listener hỏng · addLanguage) · nửa host đủ **5 export** + `settings.configure({auto:false})` · nửa client phơi đủ 6 export như gốc · `inject` 4 gói + **`immediately:true`** y hệt · **1 id module khớp tên package** + `moduleIds` · lab 5462 **chỉ đổi row này**: 200 · 49.384 B · 72 entry · `mode: live` · `#root` 89.015 · 0 lỗi console · **chữ của row KHÁC render đúng, 0 khoá thô** (chứng minh hệ quả trên 48 row) · app 5439 `check:app` **(1)…(11) ĐẠT** (16 gói của ta, `gbh-client-locale` đứng đầu · `#root` 99.183 · 0 lỗi console · mount khớp repo) |
| `client/shortcuts` | T3 | ✅ M5 xong (đang chạy thật) | row `shortcuts` đã thay (**row NỀN — 10 row phụ thuộc**) · **12 test / 2.655 expect**: 6 ca A/B **tầng protocol** so từng hàm với chính `lib/protocol.js` gốc (ma trận 29 mã phím × 13 bộ phím bổ trợ × 3 thiết bị × 2 vỏ · mọi nhánh `invalid`/`future` · `ShortcutPersistence` từng byte ghi) + 6 ca **tầng dịch vụ** dựng cùng một "gia" giả cho cả hai bên · **chứng minh HỆ QUẢ**: "row phụ thuộc" đăng ký lệnh rồi **bấm phím qua chính adapter DOM** (Web) và **kênh native** (Desktop), hai bên y hệt và lệnh THẬT SỰ chạy · **3 đầu ra build** như gốc (host 874 B · `lib/protocol.js` 17.186 B `exports["./protocol"]` · client 39.833 B IIFE) · nửa client **export LỚP SERVICE** như gốc · `inject: dsh-client-locale` · **1 id module** + `moduleIds` (đo: 0 bundle require id stock) · lab 5463: 200 · 49.589 B · 72 entry · `mode: live` · `#root` 89.015 · **0 lỗi console · 0 `did not activate`** · app: có trong **24 gói của ta đang chạy thật**, `check:app` **11/11 ĐẠT** |
| `client/ui-secret-mask` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-secret-mask` đã thay (**hai mặt**, 698 dòng gốc) · **7 test** — trong đó có **test đối chứng với chính bundle gốc**: 4.000+ chuỗi + mọi vị trí truy vấn, so từng `start · end · mặt nạ`, **0 lệch** · lab: entry 73 với id ta, id gốc mất · `#root` 57.510 = đường nền · **kiểm RENDER đầu-cuối trong lab**: 1 node `[data-secret]` · `sk-A1b2C***************` · nút `Show secret` · 0 lỗi console · A/B `session-open` **0 px** + phần tử lạ **0/0** |
| `client/ui-settings-plugin-inventory` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-settings-plugin-inventory` đã thay (**hai mặt**, 773 dòng gốc) · **7 test** — có **ba phép đối chứng với chính bundle gốc**: từ điển 74 chuỗi · đăng ký slot · **cây render so TỪNG DÒNG (17 dòng giống hệt)** · mount: 14 gói của ta · A/B `settings-builtin-plugins` **0 px** (anchor 104/104) · phần tử lạ **0/0** |
| `client/ui-plugin-market` | T3 | ✅ M5 xong (**hai mặt**, 1.636 dòng gốc) — chờ lượt boot của Lead để mount lên app 5439 | row `ui-plugin-market` đã thay · slot `plugins.tab` + occupant `id: "discover"` **nguyên văn** · từ điển `pluginMarket` **78 khoá nguyên văn** · bundle **MỘT id** (artifact id gốc = 0) · **17 test** · `check:rows` 0 chặn · `gate` 7/7 · lab: xem báo cáo của row |
| `host/user-questions` | T4 | 🔄 đã viết xong (**host-only**, 695 dòng gốc), **CHƯA khai `gbh.row`** (chờ lượt boot của Lead) | row `user-questions` đã thay: seam `ctx.userQuestions` + **đơn vị chiếu phiên `userQuestions`** (`stateVersion` 2, ảnh chụp `{active, settled}` cho mọi Client) · **10 test / 65 expect**, trong đó **6 phép ĐỐI CHỨNG với chính bundle gốc** (tập export đo trên **ARTIFACT** · `isTimedAskUserQuestionSchema` 5 hình dạng · bề mặt Remote `answer`+`attachWait`(stream) cùng thứ tự · **12 ca taxonomy lỗi** chuỗi bằng nhau từng ca · **phép gấp chiếu so SAU TỪNG sự kiện** (14 sự kiện) · `askTimed` có người trả lời / bị từ chối `ASK_TIMED_OUT`) · **HAI hợp đồng liên gói có ca test riêng**: lỗi PHẢI là thể hiện của `HarnessError` **kernel cấp** (dsh-tools chỉ ghi `{name,code}` khi đó ⇒ thiếu là UI mất thẻ "đã huỷ") và `this` của vòng đua PHẢI là **vật mang của `@deepseek-ai/dsh-scope`** đo bằng `carrierKeyOf` (sai vật mang ⇒ `NO_PROVIDER` ⇒ UI không bao giờ thấy câu hỏi) · artifact: **0 đăng ký id module** (row host-only) · `locale/{en,zh}.json` chép **byte-for-byte** (sha khớp) · `check:rows`: **0 dòng cho gói này** (56 package TẤT CẢ đạt) · `gate --no-tests`: **gói này 0 vi phạm** (2 cổng còn đỏ vì gói KHÁC: `ui-settings-general` · `otel.test.ts`) · **2 peer NGOÀI bảng §3b đã khai rõ lý do đo được**: `dsh-scope` + `dsh-llm` (cần Lead xác nhận mở rộng §3b) · **CHƯA làm**: `lab:row` + mount + `check:app` + A/B pixel (thuộc lượt boot của Lead) · **khác biệt đã biết, có test khẳng định**: `dsh-plan-mode` bắt lỗi bằng `instanceof` lớp của GÓI GỐC nên nhánh `ASK_CANCELLED` của plan-review không khớp |
| `host/account-controller` | T2 | ✅ M4 xong (đang chạy thật) | row `account-controller` đã thay (**host-only**, 322 dòng gốc build JS, 11 phương thức Remote: 9 direct + 2 stream, namespace `account`) · **12 test / 40 expect** — có **đối chứng trực tiếp với chính bundle gốc** (`remoteMethods`: đúng 11 phương thức + chế độ stream + thứ tự) · lab cách ly 5461: stock 73 entry/239 ký tự `#root`/RPC 217 B → ours **y hệt** · app 5439: `check:app` **LÀNH 10/10** · RPC `account/getState` 220 B · `hasRunningAccountTasks` 78 B · 401/404 như oracle · parity **0/0/0** · **1 khác biệt cơ chế đã ghi rõ**: dùng `ctx.get` thay vì đọc thuộc tính (Gateway gọi trên context của bên gọi nên inject của row không áp) |
| `client/ui-sidebar-terminal` | T3 | ✅ M5 xong (đang chạy thật) | row `ui-sidebar-terminal` đã thay (**hai mặt**, **505 dòng code row** + chunk lazy 13.517 dòng phần lớn là thư viện xterm) · **6 test**, 4 phép đối chứng với bundle gốc (từ điển · đăng ký · **cây render trùng từng dòng** · hình dạng hai bundle) · **panel terminal kiểm bằng DOM**: 1 `[data-sidebar-terminal]` · `.xterm-screen` 61 hàng · api/terminal 200 · A/B ba màn **0 px** + phần tử lạ **0/0** |
| `client/ui-sidebar-files` | T3 | 🔄 đã viết xong, **chờ lượt boot của Lead để mount** (row chiếm slot) | row `ui-sidebar-files` đã thay (**hai mặt**, 1.025 dòng gốc) · **HAI slot** đúng tên nguyên văn (`sidebar.right.pane.tab` · `sidebar.right.pane.tab.title`) + slot con `sidebar.right.tab.files.actions` khai `{ kind: "list", scope: "session" }` · component là **THAM SỐ THỨ HAI** của `register(spec, Component)` · `key` của hai chỗ ngồi = id kiểu tab (sidebar phải tra theo `definition?.id ?? tab.kind`) · cổng chặn cài hai lần **phạm vi module**, cờ bật SAU `applyInner` (kèm WeakSet, KHÔNG khoá theo ctx) · từ điển `sidebarFiles` **17 khoá** × 2 ngữ đối chứng **từng chuỗi** với bundle gốc · **một id module** (đo artifact: id gốc = 0, id ta = 1) + `gbh.row.moduleIds` + `aliases` · `dsh.client.inject` **y hệt** 5 gói gốc, không `immediately` · `locale/{en,zh}.json` **byte-for-byte** · **7 test** (khuôn một-id · hai slot · **đối chứng cấu trúc với chính bundle gốc** · cổng idempotent · ca apply ném lỗi · hợp đồng export nửa host · locale) · `check:rows` sạch · `gate --no-tests`: **gói này 0 vi phạm** (2 cổng còn đỏ vì gói KHÁC: `ui-plan` · `product-analytics` · `ui-subagent`) · **`lab:row` ĐÃ chạy**: 200 · `#root` **58.588** ký tự · 110 entry · **0 lỗi console** · **0 `did not activate`** · bundle phục vụ chứa **đúng MỘT** `load()` (id ta), entry alias trỏ cùng URL · **còn chờ Lead**: mount + A/B pixel/phần tử lạ |
| `client/ui-sidebar-documentpreview` | T3 | 🔄 đã viết xong, **chờ lượt boot của Lead để mount** (row chiếm slot) | row `ui-sidebar-documentpreview` đã thay (**hai mặt**, **khoảng 3.930 dòng code row** — bundle gốc 7.269 dòng, trừ 3.340 dòng vendor `dompurify`/`cosmokit`/`schemastery`) · **ĐỦ MƯỜI HAI `slots.register` + MƯỜI HAI `slots.inject` + MỘT `sidebarRightTabs.register`** · **tập 5 tên slot BẰNG ĐÚNG tập slot của chính bundle gốc** (`sidebar.right.pane.tab` · `sidebar.right.pane.tab.title` · `sidebar.right.tab.document` · `sidebar.right.tab.document.action` · `sidebar.right.tab.document.office.pdf`, đo bằng đúng hai regex của `check:rows`) · **KEYED**: `key` của `sidebar.right.pane.tab` = `id` kiểu tab `text` = **tên package** (một giá trị cho cả hai, y bản gốc) · **hợp đồng STORE**: `store` cấp cho slot `sidebar.right.pane.tab` có đủ `getSnapshot`/`subscribe`/`actions` (**14 action**) — thiếu một trong ba là `TypeError: w.getSnapshot is not a function` ⇒ **cả thanh bên không vẽ** · **10 module CSS NGUYÊN VĂN TỪNG BYTE** giữ nguyên hash lớp gốc (`tKrPPq_` `dhJKeW_` `_0RKuNG_` `HyIruq_` `lyqg2a_` `rIfSMq_` `JFRUHG_` `Java6a_` `Ku8BfW_` `JqwYuG_`) · `dompurify@3.4.16` **vendor nguyên văn** trong `vendor/` (bảng module của trang KHÔNG có `dompurify` — bản gốc cũng nhúng thẳng vào bundle) · **BA chunk nội bộ chép nguyên văn từ gói gốc** (`client.pdf.js` 7,1 MB · `client.excel.js` 7,1 MB · `client.frontmatter-fields.js` 207 KB), `build.ts` chỉ sửa dòng `id` trong header `load({ id, chunk })` sang id của ta — không chép thì `.pdf`/`.xlsx`/frontmatter **mất nội dung âm thầm** · **tám bản xem dựng sẵn** (`text` · `markdown` · `html` · `image` · `pdf` · `code` · `office` · `excel`) · từ điển **8 namespace** (zh+en đủ khoá hai bên), `sidebarDocumentPreview` **22 khoá** đối chiếu từng chuỗi · cổng chặn cài hai lần **phạm vi module**, cờ bật SAU `applyInner` (kèm WeakSet, KHÔNG khoá theo ctx) · `dsh.client.inject` **y hệt 7 gói gốc** · **13 test / 111 expect** · artifac... (line truncated to 2000 chars)
| `host/directory-picker-auto` | T2 | ✅ M4 xong (đang chạy thật) | row `directory-picker` đã thay (**host-only**, 164 dòng gốc build JS, 8 export, KHÔNG có `default`) · **11 test / 51 expect** — bảng chân trị 13 ca **đối chứng trực tiếp với chính bundle gốc** + `isLoopbackHost` (14 dạng) + `canExecute` trên tệp thật + vòng mount/dọn cặp entry · lab 5460: cặp `directory-picker-native` + client **active**, 0 `did not activate`, 0 lỗi console · app 5439: `check:app` **LÀNH 11/11** · thay row xong: stock `enabled:false` → ours **`active`**, cặp picker động vẫn mount, **active 178 KHÔNG ĐỔI** (tổng entry 232→233) · parity **0/0/0** (đã thay 20 row) · ba thứ lấy từ gói ngoài bảng §3b đã viết lại: `isLoopbackHost`, `launchEnvironmentOf`+`launchedThroughSsh`, seam Loader |
| `host/settings-controller` | T2 | ✅ M4 xong (đang chạy thật) | row `api/settings-controller` (**host-only**, không có nửa browser): hai lớp `CredentialsController` + `SettingsController` kế thừa `TypertRemoteService`, 8 method `@Remote`, ánh xạ 5 mã lỗi Gateway; **4 test đối chứng với chính bundle gốc** (bề mặt export · tập method · thông điệp `gateway/internal` · thông điệp `gateway/bad-request` theo từng method) · **KHÁC HÌNH DẠNG CÓ Ý**: không ship artifact `./typert` (máy sinh) theo nguyên tắc của Lead |
| `host/sandbox-policy` | T4 | ✅ đã viết xong (**host-only**, 159 dòng build gốc), **CHƯA khai `gbh.row`** (chờ Lead) | row `sandbox-policy` đã thay bằng bản viết lại · **đối chứng với CHÍNH bundle gốc**: dựng cả hai service trên Context `cordis` THẬT của từng bản (hai bản cài khác nhau) rồi so `resolve()` (5 tổ hợp) · `overrideOf` · mặc định `read-only` · thông điệp ném khi gốc tương đối · gộp chiếu (`key` `sandboxMode` / `stateVersion 1` / `init` / `apply`) · đường ghi `sandbox/mode` · **chữ ngữ cảnh cho cả ba chế độ** ⇒ **0 lệch** · **5 test / 53 expect** đo trên **ARTIFACT** · tập export ta = tập export gốc (`SANDBOX_MODES` · `SandboxPolicyService` · `default` · `setSandboxMode`) + prototype trùng · `grep -c "id: @deepseek-ai" lib/index.js` = **0** · `locale/{en,zh}.json` chép **byte-for-byte** (sha khớp) · peer đúng bảng §3b (`cordis` + `schemastery`) · **CHƯA làm**: khai `gbh.row` + `lab:row` + mount + TRƯỚC/SAU trên app 5439 (chờ Lead) |
| `host/authorization` | T4 | ✅ đã viết xong (**host-only**, **253 dòng** build gốc, **MỘT MẶT** — KHÔNG có `lib/client.js`, KHÔNG `dsh.client`), **ĐÃ khai `gbh.row`** (Lead, commit `83164c5`) | row `authorization` đã thay bằng bản viết lại: seam uỷ quyền **`ctx.authorization`** — sổ luồng lấy credential qua hội thoại với người, **MỘT lượt cho mỗi khoá** (`ALREADY_IN_FLIGHT` cho bên thứ hai), xác nhận nửa hợp đồng commit (`NOT_COMMITTED` khi không commit **hoặc** đã commit rồi xoá bản ghi) và phát **`authorization/settled`** cho MỌI kết cục · **tập export ta = tập export gốc đo trên ARTIFACT** (`AuthorizationDeclinedError` · `AuthorizationError` · `AuthorizationService` · `default`; **4 = 4**, prototype **trùng tên từng phương thức**, `static inject = ["credentials"]`) · **ĐỐI CHỨNG với CHÍNH bundle gốc trên Context cordis THẬT của từng bản**: **ma trận 10 kịch bản** cho **cùng kết cục · cùng mã lỗi · cùng dấu vết commit · cùng chuỗi `authorization/settled` · cùng số phiên** — gồm 5 ranh giới dễ viết sai: huỷ TRƯỚC khi bắt đầu ⇒ `cancelled` NGAY và **KHÔNG** phát sự kiện; luồng **tự ném** `AuthorizationDeclinedError` (không qua `prompt`) ⇒ lỗi vẫn **ném ra** chứ không thành `cancelled`; `commit` khoá theo **danh tính tín hiệu** (`CANCELLED` nếu lượt đã bị thay); `cancel()` **không cắt** khi đang commit; người nghe `settled` **ném/reject được bao lại** (cả 3 người nghe vẫn chạy, kết cục không đổi, `notify` hỏng cũng được ghi log) · **C6 — danh tính**: hai thực thể độc lập, `describe`/`list` trả **vật thể MỚI** mỗi lần, **phiên của mỗi lượt RIÊNG** · **ca BYTE**: bản ghi đi qua seam **NGUYÊN VẸN** — cùng tham chiếu, `Uint8Array`/`DataView` còn nguyên byte (`String(view)` ≠ byte) · **`gbh.peers` ⊆ `peerDependencies` 3/3 (so PHẦN TỬ) + ĐỐI CHỨNG ÂM** (3 manifest thiếu phần tử) và `dependencies` RỖNG · peer đúng bảng §3b: `cordis` (bậc 1) · `dsh-llm` (cần **cùng lớp** `HarnessError`) · `dsh-credentials` (seam kho credential) · `locale/{en,zh}.json` **byte-for-byte** (sha... (line truncated to 2000 chars)
| `host/approval` | T4 | ✅ đã viết xong (**host-only**, **192 dòng** build gốc, **MỘT MẶT** — không có `lib/client.js`), **Lead ĐÃ khai `gbh.row`** (id `approval` + `config.policy` biểu thức `!!js` gốc + `tests`), chờ lượt boot của Lead | row `approval` đã thay bằng bản viết lại: seam duyệt của người `ctx.approval` — quyết định MỘT LẦN qua waterfall `approval/request` có phạm vi agent (`scopeTarget`), cặp kiểm toán `approval/asked` + `approval/decided` bao trong lượt, chính sách `ask`/`never` theo phiên + ngữ cảnh model `approval:policy` · **tập export ta = tập export gốc đo trên ARTIFACT** (`APPROVAL_POLICIES` · `ApprovalRequestId` · `ApprovalService` · `default` · `setApprovalPolicy`; **5 = 5**, prototype **6 = 6**) · **ĐỐI CHỨNG với CHÍNH bundle gốc trên Context cordis THẬT**: 6 kịch bản lượt hỏi cho **cùng outcome · cùng nhật ký (id chuẩn hoá) · cùng số lần hỏi người trả lời** (`never` cho `rejected` + **0 lần hỏi**; không người trả lời cho `unavailable`; giá trị lạ cho `unavailable`; người trả lời ném cho `unavailable`) · huỷ TRƯỚC/GIỮA lượt cho `cancelled`, câu trả lời muộn bị bỏ · 5 hình dạng nhật ký cho tiền đề "lượt mở" cho cùng ném/không ném + **không ghi gì** · `String(Config)` · `TypeError` · ngữ cảnh prompt (ask/never/không agent) **trùng từng ký tự** · **C6 — danh tính**: hai thực thể không dùng chung vật thể cấu hình, hai lượt hỏi cho hai vật thể kiểm toán RIÊNG, `setPolicy` hai agent cho hai message riêng (id riêng, đóng băng), ghi đè theo PHIÊN · **`gbh.peers` ⊆ `peerDependencies` 5/5 (so PHẦN TỬ) + ĐỐI CHỨNG ÂM** (manifest thiếu phần tử thì báo đúng tên thiếu) và `dependencies` RỖNG · peer `@deepseek-ai/dsh-session` (**ngoài bảng §3b**) vì `SessionSeq` **KHÔNG phải hàm đồng nhất** (ném khi seq không hợp lệ) — **cần Lead xác nhận**, như tiền lệ `user-questions`/`jobs-local`; `dsh-agent` **chỉ mượn KIỂU** nên ở `devDependencies` (tiền lệ `workflow`) · `locale/{en,zh}.json` **byte-for-byte** (shasum khớp) · `grep -c "id: @deepseek-ai" lib/index.js` = ... (line truncated to 2000 chars)
| `host/goal-round-driver` | T4 | ✅ đã viết xong (**host-only**, **377 dòng** build gốc, **MỘT MẶT** — `lib/client.js` KHÔNG tồn tại, `package.json` gốc KHÔNG có `dsh.client`), **CHƯA khai `gbh.row`** (chờ lượt boot của Lead) | row `goal-round-driver` đã thay bằng bản viết lại (**3 module**: `src/index.ts` · `src/types.ts` · `src/prompt.ts`): bộ điều khiển **vòng goal cùng phiên** — tự nhận **MỘT vòng kế tiếp** khi agent `idle` (checkpoint `sessions.flush` trước · chờ `subagents.waitForChildren` nếu seam có mặt · chặn `round-limit` khi chạm trần · `agent.followup` đúng một message mang nguồn `{kind:"goal", goalId, revision, round}`) và dựng **hàng rào** waterfall `agent/pre-step` để bản goal/revision đã đặt chỗ không bị dùng lại (từ chối bước + **đặt lại** message KHÁC về `next-step`); mọi đường lỗi log rồi **tự gỡ quyền** · **tập export ta = tập export gốc đo trên ARTIFACT** (`apply` · `inject` · `name` · `renderGoalRoundPrompt`; **4 = 4**, 0 thiếu · 0 thừa, `apply.length` 1 · `renderGoalRoundPrompt.length` 2, KHÔNG `default`, `grep -c 'id: "@deepseek-ai' lib/index.js` = **0**) · **ĐỐI CHỨNG với CHÍNH bundle gốc trên cùng một giàn giả**: **17 kịch bản** vòng đời cho **ảnh chụp giống nhau TỪNG PHẦN TỬ** (`goalCalls` · `flushes` · `logs` · `effectLabels` · `followups` nguồn+câu lệnh · `cancels` · `subagentWaits` · `removals` · trạng thái goal · hai ranh giới inbox), gồm 3 nhánh dễ viết sai: `disarm` là thao tác **phạm vi tiến trình** nên **KHÔNG đổi revision** (khác `pause`/`block`) · `roundsStarted` là dữ kiện **dẫn xuất** nên vòng được nhận **không** đổi revision (hàng rào sau quyết định kiểm `source.round === roundsStarted + 1` TRƯỚC khi vòng vào phiên) · hàng rào **đặt lại** message khác nhưng **KHÔNG** gọi `inbox.remove` · **C6 — danh tính**: mỗi lượt trả **mảng + khối MỚI**, hai giàn ⇒ hai sổ goal độc lập, hai vòng liên tiếp ⇒ **hai message riêng** (`randomUUID`) · **`gbh.peers` ⊆ `peerDependencies` 1/1 (so PHẦN TỬ) + ĐỐI CHỨNG ÂM** (xoá-một-tên · xoá-sạch · th... (line truncated to 2000 chars)
## Quy ước `gbh.provenance.sha` (chốt 19/10/2026)

`sha` = sha256 của **artefact CHÍNH theo loại gói**: gói có nửa client (`dsh.client` + `lib/client.js`) ⇒ sha của
`lib/client.js` của gói STOCK; gói host-only ⇒ sha của `lib/index.js` của gói STOCK. Trường `shaFile` ghi rõ tệp
được băm để reviewer đọc đúng loại gói (cổng byte/A-B của client so trên `client.js`, của host so trên `index.js`).
## 4z. Bang TU SINH — moi goi khai gbh.row (cap nhat 19/10/2026)

Bang nay duoc sinh bang script tu packages/*/*/package.json. Cong hygiene doi chieu tung goi khai gbh.row voi ten thu muc/ten package trong tep nay.

| thu muc | package | row id | test |
|---|---|---|---|
| host/account-controller | @galaxy-blackhole/gbh-api-account-controller | account-controller | tests/host/account-controller.test.ts |
| host/account-platform | @galaxy-blackhole/gbh-account-platform | deepseek-account | tests/host/account-platform.test.ts |
| host/agent | @galaxy-blackhole/gbh-agent | agent | tests/host/agent.test.ts |
| host/agent-default-model | @galaxy-blackhole/gbh-agent-default-model | agent-default-model | tests/host/agent-default-model.test.ts |
| host/agent-loop | @galaxy-blackhole/gbh-host-agent-loop | agent-loop | tests/host/agent-loop.test.ts |
| host/agent-preset-registry | @galaxy-blackhole/gbh-agent-preset-registry | agent-preset-registry | tests/host/agent-preset-registry.test.ts |
| host/api-job-controller | @galaxy-blackhole/gbh-api-job-controller | job-controller | tests/host/api-job-controller.test.ts |
| host/api-remote-access | @galaxy-blackhole/gbh-api-remote-access | remote-access | tests/host/api-remote-access.test.ts |
| host/api-remotes | @galaxy-blackhole/gbh-api-remotes | api-remotes | tests/host/api-remotes.test.ts |
| host/api-session-controller | @galaxy-blackhole/gbh-api-session-controller | session-controller | tests/host/api-session-controller.test.ts |
| host/api-terminal-controller | @galaxy-blackhole/gbh-api-terminal-controller | terminal-controller | tests/host/api-terminal-controller.test.ts |
| host/api-workspace-controller | @galaxy-blackhole/gbh-api-workspace-controller | workspace-controller | tests/host/api-workspace-controller.test.ts<br>tests/host/api-workspace-controller-faces.test.ts |
| host/api-workspace-files | @galaxy-blackhole/gbh-api-workspace-files | workspace-files | tests/host/api-workspace-files.test.ts |
| host/approval | @galaxy-blackhole/gbh-approval | approval | tests/host/approval.test.ts |
| host/attachment-local | @galaxy-blackhole/gbh-attachment-local | attachment-local | tests/host/attachment-local.test.ts |
| host/authorization | @galaxy-blackhole/gbh-authorization | authorization | tests/host/authorization.test.ts |
| host/auto-review | @galaxy-blackhole/gbh-auto-review | auto-review | tests/host/auto-review.test.ts |
| host/bash-sandbox | @galaxy-blackhole/gbh-bash-sandbox | bash-sandbox | tests/host/bash-sandbox.test.ts |
| host/command-feedback | @galaxy-blackhole/gbh-command-feedback | command-feedback | tests/host/host-utils-cluster.test.ts |
| host/command-goal | @galaxy-blackhole/gbh-command-goal | command-goal | tests/host/command-goal.test.ts |
| host/commands | @galaxy-blackhole/gbh-commands | commands | tests/host/commands.test.ts |
| host/config-editor | @galaxy-blackhole/gbh-config-editor | config-editor | tests/host/config-editor.test.ts |
| host/cordis-client-runner | @galaxy-blackhole/gbh-cordis-client-runner | cordis-client-runner | tests/host/cordis-client-runner.test.ts |
| host/cordis-host-runner | @galaxy-blackhole/gbh-host-cordis-host-runner | cordis-host-runner | tests/host/cordis-host-runner.test.ts |
| host/credentials-local | @galaxy-blackhole/gbh-credentials-local | credentials | tests/host/credentials-local.test.ts |
| host/deepseek-llm-api-extensions | @galaxy-blackhole/gbh-deepseek-llm-api-extensions | deepseek-llm-api-extensions | tests/host/deepseek-llm-api-extensions.test.ts |
| host/desktop-product-telemetry | @galaxy-blackhole/gbh-desktop-product-telemetry | desktop-product-telemetry | tests/host/desktop-product-telemetry.test.ts |
| host/directory-picker-auto | @galaxy-blackhole/gbh-host-directory-picker-auto | directory-picker | tests/host/directory-picker-auto.test.ts |
| host/experimental-agent-team | @galaxy-blackhole/gbh-experimental-agent-team | agent-team | tests/host/experimental-agent-team.test.ts |
| host/experimental-api-speech-to-text | @galaxy-blackhole/gbh-experimental-api-speech-to-text | api-speech-to-text | tests/host/experimental-api-speech-to-text.test.ts |
| host/experimental-client-ui-voice-input | @galaxy-blackhole/gbh-experimental-client-ui-voice-input | ui-voice-input | tests/host/experimental-client-ui-voice-input.test.ts |
| host/experimental-inspector | @galaxy-blackhole/gbh-experimental-inspector | experimental-inspector | tests/host/experimental-inspector.test.ts<br>tests/host/experimental-inspector-codec.test.ts<br>tests/host/experimental-inspector-faces.test.ts<br>tests/host/experimental-inspector-collision.test.ts |
| host/experimental-speech-to-text | @galaxy-blackhole/gbh-experimental-speech-to-text | speech-to-text | tests/host/experimental-speech-to-text.test.ts |
| host/experimental-speech-to-text-sensevoice | @galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice | speech-to-text-sensevoice | tests/host/experimental-speech-to-text-sensevoice.test.ts |
| host/experimental-tool-agent-team | @galaxy-blackhole/gbh-experimental-tool-agent-team | tool-agent-team | tests/host/experimental-tool-agent-team.test.ts |
| host/experimental-translator | @galaxy-blackhole/gbh-host-experimental-translator | translator | tests/host/experimental-translator.test.ts |
| host/file-reference-local | @galaxy-blackhole/gbh-file-reference-local | file-reference-local | tests/host/file-reference-local.test.ts |
| host/fs-observation-policy | @galaxy-blackhole/gbh-fs-observation-policy | fs-observation-policy | tests/host/fs-observation-policy.test.ts |
| host/fs-sandbox | @galaxy-blackhole/gbh-fs-sandbox | fs-sandbox | tests/host/fs-sandbox.test.ts |
| host/goal | @galaxy-blackhole/gbh-goal | goal | tests/host/goal.test.ts |
| host/goal-round-driver | @galaxy-blackhole/gbh-goal-round-driver | goal-round-driver | tests/host/goal-round-driver.test.ts |
| host/harness-dev-context | @galaxy-blackhole/gbh-harness-dev-context | harness-dev-context | tests/host/harness-dev-context.test.ts |
| host/hmr | @galaxy-blackhole/gbh-hmr | hmr | tests/host/hmr.test.ts |
| host/host-webserver | @galaxy-blackhole/gbh-host-webserver | webserver | tests/host/host-webserver.test.ts |
| host/image-offload | @galaxy-blackhole/gbh-image-offload | image-offload | tests/host/image-offload.test.ts |
| host/jobs-local | @galaxy-blackhole/gbh-jobs-local | jobs | tests/host/jobs-local.test.ts |
| host/llm | @galaxy-blackhole/gbh-llm | llm | tests/host/llm.test.ts |
| host/llm-deepseek-account | @galaxy-blackhole/gbh-llm-deepseek-account | llm-deepseek-account | tests/host/llm-deepseek-account.test.ts |
| host/llm-pi-ai | @galaxy-blackhole/gbh-host-llm-pi-ai | llm-pi-ai | tests/host/llm-pi-ai.test.ts |
| host/llm-retry | @galaxy-blackhole/gbh-llm-retry | llm-retry | tests/host/llm-retry.test.ts |
| host/mcp-resources | @galaxy-blackhole/gbh-mcp-resources | mcp-resources | tests/host/mcp-resources.test.ts |
| host/message-feedback | @galaxy-blackhole/gbh-message-feedback | message-feedback | tests/host/message-feedback.test.ts |
| host/office-to-pdf | @galaxy-blackhole/gbh-office-to-pdf | office-to-pdf | tests/host/office-to-pdf.test.ts |
| host/open-in-app | @galaxy-blackhole/gbh-host-open-in-app | open-in-app | tests/host/open-in-app.test.ts |
| host/optional-session-title-all-prompts | @galaxy-blackhole/gbh-optional-session-title-all-prompts | optional-session-title-all-prompts | tests/host/optional-session-title-all-prompts.test.ts |
| host/otel | @galaxy-blackhole/gbh-otel | otel | tests/host/otel.test.ts |
| host/permission | @galaxy-blackhole/gbh-permission | permission | tests/host/permission.test.ts |
| host/plan-mode | @galaxy-blackhole/gbh-plan-mode | plan-mode | tests/host/plan-mode.test.ts |
| host/plugin-inventory | @galaxy-blackhole/gbh-host-plugin-inventory | plugin-inventory | tests/host/plugin-inventory.test.ts |
| host/plugin-manager | @galaxy-blackhole/gbh-host-plugin-manager | plugin-manager | tests/host/plugin-manager.test.ts |
| host/plugin-market | @galaxy-blackhole/gbh-plugin-market | plugin-market | tests/host/plugin-market.test.ts |
| host/plugin-package-inventory-deepseek | @galaxy-blackhole/gbh-plugin-package-inventory-deepseek | plugin-package-inventory-deepseek | tests/host/plugin-package-inventory-deepseek.test.ts |
| host/ptc-runtime-node | @galaxy-blackhole/gbh-ptc-runtime-node | ptc-runtime | tests/host/ptc-runtime-node.test.ts |
| host/pwsh-sandbox | @galaxy-blackhole/gbh-pwsh-sandbox | pwsh-sandbox | tests/host/pwsh-sandbox.test.ts |
| host/repeat-tool-reminder | @galaxy-blackhole/gbh-host-repeat-tool-reminder | repeat-tool-reminder | tests/host/repeat-tool-reminder.test.ts |
| host/sandbox | @galaxy-blackhole/gbh-sandbox | sandbox | tests/host/sandbox.test.ts |
| host/sandbox-policy | @galaxy-blackhole/gbh-sandbox-policy | sandbox-policy | tests/host/sandbox-policy.test.ts |
| host/schedule | @galaxy-blackhole/gbh-schedule | schedule | tests/host/schedule.test.ts |
| host/session | @galaxy-blackhole/gbh-session | session | tests/host/session.test.ts<br>tests/host/session-replay.test.ts<br>tests/host/session-consumer-telemetry.test.ts<br>tests/host/session-alias.test.ts |
| host/session-checkpoint-policy | @galaxy-blackhole/gbh-session-checkpoint-policy | session-checkpoint-policy | tests/host/session-checkpoint-policy.test.ts |
| host/session-inspector | @galaxy-blackhole/gbh-session-inspector | session-inspector | tests/host/session-inspector.test.ts |
| host/session-log-deepseek | @galaxy-blackhole/gbh-session-log | session-log-deepseek | tests/host/session-log-deepseek.test.ts |
| host/session-log-export | @galaxy-blackhole/gbh-session-log-export | session-log-download | tests/host/session-log-export.test.ts |
| host/session-persistence-jsonl | @galaxy-blackhole/gbh-session-persistence-jsonl | session-persistence-jsonl | tests/host/session-persistence-jsonl.test.ts |
| host/session-projection | @galaxy-blackhole/gbh-session-projection | session-projection | tests/host/session-projection.test.ts |
| host/session-projection-cache | @galaxy-blackhole/gbh-session-projection-cache | session-projection-cache | tests/host/session-projection-cache.test.ts |
| host/session-query-sqlite | @galaxy-blackhole/gbh-session-query-sqlite | session-query-sqlite | tests/host/session-query-sqlite.test.ts |
| host/session-reference | @galaxy-blackhole/gbh-session-reference | session-reference | tests/host/session-reference.test.ts |
| host/session-stats | @galaxy-blackhole/gbh-session-stats | session-stats | tests/host/session-stats.test.ts |
| host/session-telemetry-otel | @galaxy-blackhole/gbh-session-telemetry-otel | session-telemetry-otel | tests/host/session-telemetry-otel.test.ts |
| host/session-title | @galaxy-blackhole/gbh-session-title | session-title | tests/host/session-title.test.ts |
| host/session-title-first-prompt-llm | @galaxy-blackhole/gbh-session-title-first-prompt-llm | session-title-llm | tests/host/session-title-first-prompt-llm.test.ts |
| host/session-turn-outline | @galaxy-blackhole/gbh-session-turn-outline | session-turn-outline | tests/host/session-turn-outline.test.ts |
| host/settings | @galaxy-blackhole/gbh-settings | settings | tests/host/settings.test.ts<br>tests/host/settings-safety.test.ts |
| host/settings-controller | @galaxy-blackhole/gbh-api-settings-controller | settings-controller | tests/host/settings-controller.test.ts |
| host/shell-env | @galaxy-blackhole/gbh-shell-env | shell-env | tests/host/shell-env.test.ts |
| host/shell-identity | @galaxy-blackhole/gbh-host-shell-identity | shell-identity | tests/host/shell-identity.test.ts |
| host/skill | @galaxy-blackhole/gbh-skill | skill | tests/host/skill.test.ts |
| host/skill-badge | @galaxy-blackhole/gbh-skill-badge | skill-badge | tests/host/skill-badge.test.ts |
| host/spill-local | @galaxy-blackhole/gbh-spill-local | spill-local | tests/host/spill-local.test.ts |
| host/spill-policy | @galaxy-blackhole/gbh-spill-policy | spill-policy | tests/host/spill-policy.test.ts |
| host/storage | @galaxy-blackhole/gbh-storage | storage | tests/host/storage.test.ts |
| host/storage-domain | @galaxy-blackhole/gbh-storage-domain | storage-domain | tests/host/storage-domain.test.ts |
| host/storage-json | @galaxy-blackhole/gbh-storage-json | storage-json | tests/host/storage-json.test.ts |
| host/subagent | @galaxy-blackhole/gbh-subagent | subagent | tests/host/subagent.test.ts<br>tests/host/subagent-faces.test.ts<br>tests/host/subagent-spawn-ab.test.ts |
| host/subagent-fork-in-process | @galaxy-blackhole/gbh-subagent-fork-in-process | subagent-fork-in-process | tests/host/subagent-fork-in-process.test.ts |
| host/subagent-model-selection-settings | @galaxy-blackhole/gbh-subagent-model-selection-settings | subagent-model-selection-settings | tests/host/subagent-model-selection-settings.test.ts |
| host/subagent-spawn-in-process | @galaxy-blackhole/gbh-subagent-spawn-in-process | subagent-spawn-in-process | tests/host/subagent-spawn-in-process.test.ts |
| host/subprocess-local | @galaxy-blackhole/gbh-subprocess-local | subprocess | tests/host/subprocess-local.test.ts |
| host/system-prompt | @galaxy-blackhole/gbh-system-prompt | system-prompt | tests/host/system-prompt.test.ts |
| host/timeout-policy | @galaxy-blackhole/gbh-timeout-policy | timeout-policy | tests/host/timeout-policy.test.ts |
| host/timer | @galaxy-blackhole/gbh-timer | timer | tests/host/timer.test.ts |
| host/token-meter | @galaxy-blackhole/gbh-token-meter | token-meter | tests/host/token-meter.test.ts |
| host/tool-goal | @galaxy-blackhole/gbh-tool-goal | tool-goal | tests/host/tool-goal.test.ts |
| host/tool-todo | @galaxy-blackhole/gbh-host-tool-todo | tool-todo | tests/host/tool-todo.test.ts |
| host/tool-web | @galaxy-blackhole/gbh-host-tool-web | tool-web | tests/host/tool-web.test.ts |
| host/tool-working-directory | @galaxy-blackhole/gbh-tool-working-directory | tool-working-directory | tests/host/tool-working-directory.test.ts |
| host/tool-worktree | @galaxy-blackhole/gbh-tool-worktree | tool-worktree | tests/host/tool-worktree.test.ts |
| host/web-search-ollama | @galaxy-blackhole/gbh-web-search-ollama | web-search-auto | tests/host/web-search-ollama.test.ts |
| host/speech-to-text-phowhisper | @galaxy-blackhole/gbh-speech-to-text-phowhisper | speech-to-text-phowhisper | tests/host/speech-to-text-phowhisper.test.ts |
| host/tools | @galaxy-blackhole/gbh-host-tools | tools | tests/host/tools.test.ts |
| host/typert-gateway | @galaxy-blackhole/gbh-host-typert-gateway | typert-gateway | tests/host/typert-gateway.test.ts |
| host/typert-loader | @galaxy-blackhole/gbh-typert-loader | typert-loader | tests/host/typert-loader.test.ts |
| host/typert-registry | @galaxy-blackhole/gbh-typert-registry | typert | tests/host/typert-registry.test.ts |
| host/user-questions | @galaxy-blackhole/gbh-user-questions | user-questions | tests/host/user-questions.test.ts |
| host/web | @galaxy-blackhole/gbh-web | web | tests/host/web.test.ts |
| host/web-fetch-http | @galaxy-blackhole/gbh-web-fetch-http | web-fetch-http | tests/host/web-fetch-http.test.ts |
| host/web-runtime | @galaxy-blackhole/gbh-web-runtime | web-runtime | tests/host/web-runtime.test.ts |
| host/web-startup | @galaxy-blackhole/gbh-web-startup | web-startup | tests/host/web-startup.test.ts |
| host/working-directory | @galaxy-blackhole/gbh-working-directory | working-directory | tests/host/working-directory.test.ts |
| host/workspace | @galaxy-blackhole/gbh-workspace | workspace | tests/host/workspace.test.ts |
| host/workspace-changes | @galaxy-blackhole/gbh-host-workspace-changes | workspace-changes | tests/host/workspace-changes.test.ts |
| host/worktree | @galaxy-blackhole/gbh-worktree | worktree | tests/host/worktree.test.ts |
| client/client-hmr | @galaxy-blackhole/gbh-client-hmr | client-hmr | tests/client/client-hmr.test.ts |
| client/connection | @galaxy-blackhole/gbh-client-connection | connection | tests/client/connection.test.ts |
| client/file-upload | @galaxy-blackhole/gbh-client-file-upload | file-upload | tests/client/file-upload.test.ts<br>tests/client/file-upload-host.test.ts<br>tests/client/file-upload-browser.test.ts<br>tests/client/file-upload-staged.test.ts |
| client/locale | @galaxy-blackhole/gbh-client-locale | locale | tests/client/locale.test.ts |
| client/modules | @galaxy-blackhole/gbh-client-modules | modules | tests/client/client-modules.test.ts |
| client/product-analytics | @galaxy-blackhole/gbh-client-product-analytics | product-analytics | tests/client/product-analytics.test.ts |
| client/resources | @galaxy-blackhole/gbh-client-resources | resources | tests/client/resources.test.ts |
| client/shortcuts | @galaxy-blackhole/gbh-client-shortcuts | shortcuts | tests/client/shortcuts-protocol.test.ts<br>tests/client/shortcuts-service.test.ts |
| client/ui-agent-preset | @galaxy-blackhole/gbh-client-ui-agent-preset | ui-agent-preset | tests/client/ui-agent-preset.test.ts |
| client/ui-agent-team | @galaxy-blackhole/gbh-client-ui-agent-team | ui-agent-team | tests/client/ui-agent-team.test.ts |
| host/session-delete | @galaxy-blackhole/gbh-session-delete | session-delete | tests/host/session-delete.test.ts |
| client/ui-session-delete | @galaxy-blackhole/gbh-client-ui-session-delete | ui-session-delete | tests/client/ui-session-delete.test.ts |
| client/ui-approval | @galaxy-blackhole/gbh-client-ui-approval | ui-approval | tests/client/ui-approval.test.ts |
| client/ui-attachment | @galaxy-blackhole/gbh-client-ui-attachment | ui-attachment | tests/client/ui-attachment.test.ts |
| client/ui-brand | @galaxy-blackhole/gbh-client-ui-brand | ui-brand | tests/client/ui-brand.test.ts |
| client/ui-brand-official | @galaxy-blackhole/gbh-client-ui-brand-official | ui-brand-official | tests/client/ui-brand-official.test.ts |
| client/ui-chat | @galaxy-blackhole/gbh-client-ui-chat | ui-chat | tests/client/ui-chat.test.ts |
| client/ui-commands | @galaxy-blackhole/gbh-client-ui-commands | ui-commands | tests/client/ui-commands.test.ts |
| client/ui-conversation | @galaxy-blackhole/gbh-client-ui-conversation | ui-conversation | tests/client/ui-conversation.test.ts |
| client/ui-cordis | @galaxy-blackhole/gbh-client-ui-cordis | ui-cordis | tests/client/ui-cordis.test.ts |
| client/ui-cot-translation | @galaxy-blackhole/gbh-client-ui-cot-translation | cot-translation | tests/client/ui-cot-translation.test.ts |
| client/ui-deliverables | @galaxy-blackhole/gbh-client-ui-deliverables | ui-deliverables | tests/client/ui-deliverables.test.ts |
| client/ui-goal | @galaxy-blackhole/gbh-client-ui-goal | ui-goal | tests/client/ui-goal.test.ts<br>tests/client/ui-goal-idempotent.test.ts |
| client/ui-input-trigger | @galaxy-blackhole/gbh-client-ui-input-trigger | ui-input-trigger | tests/client/ui-input-trigger.test.ts |
| client/ui-jobs | @galaxy-blackhole/gbh-client-ui-jobs | ui-jobs | tests/client/ui-jobs.test.ts |
| client/ui-layout | @galaxy-blackhole/gbh-client-ui-layout | ui-layout | tests/client/ui-layout.test.ts |
| client/ui-message-feedback | @galaxy-blackhole/gbh-client-ui-message-feedback | ui-message-feedback | tests/client/ui-message-feedback.test.ts |
| client/ui-model-selection | @galaxy-blackhole/gbh-client-ui-model-selection | ui-model-selection | tests/client/ui-model-selection.test.ts |
| client/ui-open-in-app | @galaxy-blackhole/gbh-client-ui-open-in-app | ui-open-in-app | tests/client/ui-open-in-app.test.ts |
| client/ui-permission | @galaxy-blackhole/gbh-client-ui-permission-presets | ui-permission | tests/client/ui-permission.test.ts |
| client/ui-plan | @galaxy-blackhole/gbh-client-ui-plan | ui-plan | tests/client/ui-plan.test.ts |
| client/ui-plugin-manager | @galaxy-blackhole/gbh-client-ui-plugin-manager | ui-plugin-manager | tests/client/ui-plugin-manager.test.ts<br>tests/client/ui-plugin-manager-ab-host.test.ts<br>tests/client/ui-plugin-manager-ab-client.test.ts |
| client/ui-plugin-market | @galaxy-blackhole/gbh-client-ui-plugin-market | ui-plugin-market | tests/client/ui-plugin-market.test.ts |
| client/ui-reference | @galaxy-blackhole/gbh-client-ui-reference | ui-reference | tests/client/ui-reference.test.ts |
| client/ui-renderer | @galaxy-blackhole/gbh-client-ui-renderer | ui-renderer | tests/client/ui-renderer.test.ts |
| client/ui-schedule | @galaxy-blackhole/gbh-client-ui-schedule | ui-schedule | tests/client/ui-schedule.test.ts |
| client/ui-secret-mask | @galaxy-blackhole/gbh-client-ui-secret-mask | ui-secret-mask | tests/client/ui-secret-mask.test.ts |
| client/ui-session | @galaxy-blackhole/gbh-client-ui-session | ui-session | tests/client/ui-session.test.ts |
| client/ui-settings | @galaxy-blackhole/gbh-client-ui-settings | ui-settings | tests/client/ui-settings.test.ts |
| client/ui-settings-account | @galaxy-blackhole/gbh-client-ui-settings-account | ui-settings-account | tests/client/ui-settings-account.test.ts |
| client/ui-settings-agent-loop | @galaxy-blackhole/gbh-client-ui-settings-agent-loop | ui-settings-agent-loop | tests/client/ui-settings-agent-loop.test.ts |
| client/ui-settings-general | @galaxy-blackhole/gbh-client-ui-settings-general | ui-settings-general | tests/client/ui-settings-general.test.ts |
| client/ui-settings-models | @galaxy-blackhole/gbh-client-ui-settings-models | ui-settings-models | tests/client/ui-settings-models.test.ts |
| client/ui-settings-plugin-inventory | @galaxy-blackhole/gbh-client-ui-settings-plugin-inventory | ui-settings-plugin-inventory | tests/client/ui-settings-plugin-inventory.test.ts |
| client/ui-settings-plugins | @galaxy-blackhole/gbh-client-ui-settings-plugins | ui-settings-plugins | tests/client/ui-settings-plugins.test.ts |
| client/ui-settings-session-log | @galaxy-blackhole/gbh-client-ui-settings-session-log | ui-settings-session-log | tests/client/ui-settings-session-log.test.ts |
| client/ui-settings-shell | @galaxy-blackhole/gbh-client-ui-settings-shell | ui-settings-shell | tests/client/ui-settings-shell.test.ts |
| client/ui-settings-subagent | @galaxy-blackhole/gbh-client-ui-settings-subagent | ui-settings-subagent | tests/client/ui-settings-subagent.test.ts |
| client/ui-settings-web-search | @galaxy-blackhole/gbh-client-ui-settings-web-search | ui-settings-web-search | tests/client/ui-settings-web-search.test.ts |
| client/ui-shortcuts | @galaxy-blackhole/gbh-client-ui-shortcuts | ui-shortcuts | tests/client/ui-shortcuts.test.ts |
| client/ui-sidebar | @galaxy-blackhole/gbh-client-ui-sidebar | ui-sidebar | tests/client/ui-sidebar.test.ts |
| client/ui-sidebar-browser | @galaxy-blackhole/gbh-client-ui-sidebar-browser | ui-sidebar-browser | tests/client/ui-sidebar-browser.test.ts |
| client/ui-sidebar-documentpreview | @galaxy-blackhole/gbh-client-ui-sidebar-documentpreview | ui-sidebar-documentpreview | tests/client/ui-sidebar-documentpreview.test.ts |
| client/ui-sidebar-files | @galaxy-blackhole/gbh-client-ui-sidebar-files | ui-sidebar-files | tests/client/ui-sidebar-files.test.ts |
| client/ui-sidebar-right | @galaxy-blackhole/gbh-client-ui-sidebar-right | ui-sidebar-right | tests/client/ui-sidebar-right.test.ts |
| client/ui-sidebar-terminal | @galaxy-blackhole/gbh-client-ui-sidebar-terminal | ui-sidebar-terminal | tests/client/ui-sidebar-terminal.test.ts |
| client/ui-skill | @galaxy-blackhole/gbh-client-ui-skill | ui-skill | tests/client/ui-skill.test.ts |
| client/ui-subagent | @galaxy-blackhole/gbh-client-ui-subagent | ui-subagent | tests/client/ui-subagent.test.ts |
| client/ui-theme | @galaxy-blackhole/gbh-client-ui-theme | ui-theme | tests/client/ui-theme.test.ts |
| client/ui-tool | @galaxy-blackhole/gbh-client-ui-tool | ui-tool | tests/client/ui-tool.test.ts |
| client/ui-trajectory | @galaxy-blackhole/gbh-client-ui-trajectory | ui-trajectory | tests/client/ui-trajectory.test.ts |
| client/ui-user-questions | @galaxy-blackhole/gbh-client-ui-user-questions | ui-user-questions | tests/client/ui-user-questions.test.ts |
| client/ui-workflow-run | @galaxy-blackhole/gbh-client-ui-workflow-run | ui-workflow-run | tests/client/ui-workflow-run.test.ts |
| client/ui-workspace | @galaxy-blackhole/gbh-client-ui-workspace | ui-workspace | tests/client/ui-workspace.test.ts |

| host/tool-subagent-control | @galaxy-blackhole/gbh-tool-subagent-control | tool-subagent-control | tests/host/tool-subagent-control.test.ts |
| host/tool-subagent | @galaxy-blackhole/gbh-host-tool-subagent | tool-subagent | tests/host/tool-subagent.test.ts |
| host/llm-deepseek-api-key | @galaxy-blackhole/gbh-llm-deepseek-api-key | llm-deepseek-api-key | tests/host/llm-deepseek-api-key.test.ts |
| host/tool-jobs | @galaxy-blackhole/gbh-host-tool-jobs | tool-jobs | tests/host/tool-jobs.test.ts |
| host/tool-workflow | @galaxy-blackhole/gbh-tool-workflow | tool-workflow | tests/host/tool-workflow.test.ts |
| host/tool-pwsh | @galaxy-blackhole/gbh-tool-pwsh | tool-pwsh | tests/host/tool-pwsh.test.ts |
