<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row session-title của DSH — bảng nguồn đối chiếu G4.
-->

# @galaxy-blackhole/gbh-session-title

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `session-title` (tier **T1**) | `gbh-session-title` |
| Package | ```deepseek-ai/dsh-session-title` **0.2.1-alpha.4** | `galaxy-blackhole/gbh-session-title` |
| Đường dẫn gốc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-session-title` | — |
| Kích thước bản build | **651 dòng** `lib/index.js` (bản **đã bundle**; `lib/types/index.js` 675 dòng là bản chưa bundle) · `lib/types/index.d.ts` **204 dòng** | **648 dòng** `lib/index.js` · **9 tệp nguồn** (1.557 dòng `src/`) |
| Hai mặt? | **không** — `lib/client.js` **KHÔNG tồn tại**, `lib/types/client.js` chỉ là `export {}` (9 dòng, 0 lúc chạy), gói gốc **không có** `dsh.client` | một mặt (host-only) |
| Đơn vị chiếu | `title` (stateVersion **1**) và `titleInput` (stateVersion **3**) | y nguyên |
| `config` gốc (oracle dump) | `fallbackMaxWords: 5` · `fallbackMaxBytes: 40` · `maxTitleBytes: 80` — **scalar thuần, KHÔNG dạng `!!js`** | phải chép y nguyên khi khai `gbh.row.config` |

### 1b. Năm câu hỏi bắt buộc

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ.** `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **34–40**: cặp `- id: session-title` + `name: '@deepseek-ai/dsh-session-title'` **có thật**, khối row **không có** `disabled`. Row anh em `session-title-llm` (dòng **41**) là row KHÁC. |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** `lib/client.js` không tồn tại; không `__ModuleLoader__`; gói gốc không khai `dsh.client`. |
| 3 | Cần **seam** nào? | `extends Service` (`sessionTitle`) · seam `sessions` (`get`/`list`) · seam `sessionProjections` (`register`/`stateOf`) · hook `session/event` + `session/disposed` + waterfall `llm/stream` (cờ `global` + `prepend`). **Tất cả trong bảng §3b.** |
| 4 | **Hành vi đo được** là gì? | Bốn bề mặt: (a) **hai đơn vị chiếu** `title`/`titleInput`; (b) **sự kiện** `session/title` được ghi vào log (một đường DUY NHẤT); (c) **bốn phương thức** `get/rename/refresh/register`; (d) **tiêu đề dự phòng tất định** khi chưa có provider. |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG** — `python3 -c "...get('dsh').get('client')"` ⇒ `False`; đo lại bằng `ls`: `lib/client.js` vắng mặt. ⇒ row **MỘT MẶT**, thay được ngay. |

## 2. Vì sao cần

`ctx.sessionTitle` là **nguồn sự thật duy nhất** của tiêu đề phiên: tiêu đề nằm **trong log phiên**
dưới dạng sự kiện chỉ-ghi-log `session/title`, không nằm ở metadata khả biến. Ba người gọi chính:

- **hàng danh sách phiên** phía client ăn đơn vị chiếu `title` (một **chuỗi trần** hoặc `null`);
- **provider tiêu đề** (`optional-session-title-all-prompts` của ta, và `session-title-llm` của DSH)
  đăng ký qua `ctx.sessionTitle.register(...)` và nhận `messages` + `route` + `currentTitle`;
- **lệnh đổi tên** của người dùng đi qua `rename()`, ghim tiêu đề (nguồn `user`) và chặn mọi lần
  sinh tự động về sau.

Ba lớp hành vi phải giữ **nguyên văn** vì chúng là hợp đồng với bên ngoài:

1. **Đường ghi DUY NHẤT**: mọi tiêu đề (dự phòng · provider · người dùng) đi qua
   `session.append("session/title", …)`; không có đường thứ hai.
2. **Nhịp provider là BẤT ĐỒNG BỘ và bị HOÃN**: `first-prompt` chỉ lên lịch khi phiên **gốc** có tin
   hợp lệ **đầu tiên** và **chưa có tiêu đề**; lời gọi **chỉ chạy sau khi tuyến `request/header` đã
   vào log** (hoặc từ waterfall `llm/stream` khi tuyến KHÔNG đổi), nên provider luôn thấy `route`.
3. **Dự phòng LUÔN vật chất hoá TRƯỚC** provider: `runProvider` gọi `ensureFallback` trước khi
   `generate()`, nên `currentTitle` trong yêu cầu provider thường là tiêu đề dự phòng vừa ghi.

## 3. Peer

| peer | bậc §3b | vì sao **ĐO ĐƯỢC** (không phải cho có) |
|---|---|---|
| `deepseek-ai/cordis` | **Bậc 1** (kernel/core) | `SessionTitleService extends Service` và dùng `ctx.effect`/`ctx.on`/`ctx.fiber` — phải là **CÙNG một kernel**, bản sao thì `ctx.fiber.state` vô nghĩa. |
| `deepseek-ai/schemastery` | **Bậc 1** (schema `Config`) | `static Config` là schema **loader** dùng để kiểm config của row; thay bằng vật thể khác là đổi hợp đồng với tầng nạp. |
| `deepseek-ai/dsh-llm` | **Bậc 2** (seam `llm`) | `isAgentLoopRequest()` tra một **WeakSet CỤC BỘ TIẾN TRÌNH** (`AGENT_LOOP_REQUESTS`). Bản sao cục bộ **luôn** trả `false` ⇒ nhánh "tuyến KHÔNG đổi" của `onMainRequest` **chết âm thầm** mà **không cổng nào thấy**. |
| `deepseek-ai/dsh-session-projection` | **Bậc 2** (seam `sessionProjections`) | Hai đơn vị chiếu đăng ký vào seam này; kernel phải cấp **MỘT** thể hiện để `stateOf(session, "titleInput")` đọc đúng trạng thái đã gộp. |

**KHÔNG khai** (dù bản gốc có) — và lý do:

| peer bản gốc | vì sao ta bỏ | bằng chứng |
|---|---|---|
| `dsh-brand` (`Branded`) | **char bậc 0 lúc chạy** — brand chỉ tồn tại lúc biên dịch; gói đó tự ghi *"independently installed copies produce interchangeable values"* | `src/brand.ts` cài `SessionTitleProviderId` là **hàm đồng nhất**; ca test A/B đối chứng giá trị **TRÁO ĐƯỢC** |
| `dsh-session` (`SessionSeq`, `Session`, `SessionEvent`) | ngoài bảng §3b; `SessionSeq` là hàm **ĐỒNG NHẤT** và ba kiểu kia chỉ là **kiểu** | `src/brand.ts` (cùng câu `TypeError` của kernel) + `src/types.ts` khai **theo CẤU TRÚC** |
| `dsh-agent`, `dsh-util-values` | không chạm seam nào của `dsh-agent`; `assertNever`/`deepFreeze` là hàm **thuần** | `src/never.ts` · `src/snapshot.ts` cài lại **nguyên thuật** (vòng lặp + `WeakSet`, bỏ qua `AbortSignal`) |

**`gbh.peers ⊆ peerDependencies`: 4/4 — so PHẦN TỬ**, có **HAI ĐỐI CHỨNG ÂM** trong test
(xoá cả bảng · cùng-số-lượng-mà-lệch-phần-tử; thừa tên vẫn ĐẠT). Peer **KHÔNG** nằm trong
`dependencies` (chỉ `zod` ở đó).

## 4. Bảng TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| tập export trên **ARTIFACT** | 9 tên | **9 tên — 0 thiếu · 0 thừa** (`SessionTitleInvalidError` · `SessionTitleProviderId` · `SessionTitleService` · `default` · `fallbackSessionTitle` · `foldSessionTitle` · `normalizeSessionTitle` · `titleProjectionDefinition` · `truncateTitleUtf8`) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** (và `__ModuleLoader__` = 0) |
| `title` / `titleInput` | `title`/1 · `titleInput`/3 | **y nguyên**, phép gộp khớp **từng bước** trên kịch bản 6 sự kiện |
| chuẩn hoá (3 hàm) | — | khớp **từng ký tự** trên 8 văn bản × 5 ngân sách × 3 trần từ |
| nhịp provider | chờ `request/header` | **y nguyên** (kể cả `currentTitle` trong yêu cầu) |
| `bun test tests/host/session-title.test.ts` | — | **21 pass · 337 expect · 0 fail** |

Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri
~/.bun/bin/bun test tests/host/session-title.test.ts
~/.bun/bin/bun run build.ts packages/host/session-title && grep -c "id: @deepseek-ai" packages/host/session-title/lib/index.js
```

## 5. Phần CHƯA làm

- **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (phiên này viết ở trạng thái **chưa khai** theo chỉ
  đạo; khoá xuất hiện trong lúc phiên đang chạy). Hình dạng hiện tại — `id: session-title` +
  `config: { fallbackMaxWords: 5, fallbackMaxBytes: 40, maxTitleBytes: 80 }` + `tests`, **không**
  `moduleIds`/`aliases`/`insertAs` (row một mặt, không bundle) — được ghim bằng test `ca 0c`
  (đọc CẢ HAI dạng `row` và `row_unmounted_ly_do?.row`).
- **`lab:row` · mount 5439 · `check:app` + bảng TRƯỚC/SAU trên app thật: CHƯA chạy** (thuộc lượt
  boot của Lead — phiên này **không** tự boot 5439).
- **`./invariant` (companion plugin) KHÔNG có** — bản gốc **0.2.1-alpha.4** cũng **không** ship
  (`lib/invariant.js` vắng mặt, `exports` không có `./invariant`); bản **0.2.0-rc.2** cũ mới có.
  Nếu sau này kernel bật lại companion ấy thì đây là việc **mới**, không phải thiếu sót.
- **`zod` khác bản gốc một dòng**: gốc pin `4.4.3`, ta dùng `^4.6.7` — **phiên bản DUY NHẤT** có
  trong kho bun của repo. Hành vi schema đo được **trùng từng câu lỗi** trên 5 dạng hỏng.
- **`locale/` có ở bản gốc ⇒ đã chép byte-for-byte** (`en.json` sha256 `b461b883…`,
  `zh.json` sha256 `37a4245a…`) + `exports["./locale/*.json"]`.
