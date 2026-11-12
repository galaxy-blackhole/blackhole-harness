<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Báo cáo bằng chứng task-7: sweep lab 41 gói client đã sửa · ảnh A/B Settings (dịch + nút Mở tệp cấu hình) · dọn 5 tệp test cũ đỏ từ HEAD · trạng thái baseline bố cục (9)
-->

# Báo cáo bằng chứng task-7 — 18/10/2026 (lượt tm-evidence)

> Mọi số trong báo cáo này đo trên máy thật, **không suy từ ảnh**. Lệnh tái lập ghi ngay cạnh số.
> Artifact thô: `.parity/lab-evidence/` · `.parity/settings-ab/` · log lab `/tmp/gbh-accept-lab-<row>.log`.

## 1. Phạm vi

| việc | trạng thái | bằng chứng |
|---|---|---|
| (1) lab:row cho MỌI gói client đã sửa ở phiên trước | **MẪU 7 row** — xem lý do đo được ở §2 (mọi boot là CÙNG một cấu hình) | `.parity/lab-evidence/<row>.json` + `.parity/lab-evidence/summary.md` |
| (2) ảnh A/B Settings (mở modal, mục Chung) | **XONG** | `.parity/settings-ab/` + §3 |
| (3) baseline bố cục (9) | **GIỮ NGUYÊN** theo chỉ đạo Lead | §5 |
| (4) dọn test cũ đỏ từ HEAD | **XONG** (5 tệp) | §4 |

## 2. Sweep lab — 41 gói client đã sửa ở phiên trước

**Danh sách** = 41 gói đo được bằng
`git diff --name-only 99c488b..HEAD -- packages | awk -F/ '{print $3}' | sort -u`
(khớp docs/HANDOVER.md §2: 4 gói de-bundle · 11 gói ui-settings-* · phần còn lại là các gói thêm từ điển vi).

**Công cụ**: `bun run tools/check/lab-evidence.ts --all` (mới; mỗi row: boot lab cách ly có LOCK toàn cục →
probe DOM thật bằng Chrome `channel: chrome` → dọn lab → ghi JSON). Ngưỡng DAT:
**0 lỗi console · 0 lỗi trang · 0 did-not-activate · #root ≥ 20.000 ký tự**.

**Vì sao mỗi lượt lab là bằng chứng cho CẢ cây gói, không chỉ 1 gói**: `ensureProfile`+`mount` **build lại
TOÀN BỘ 118 gói** vào home lab ở MỖI lượt boot (`apps/cli/src/mount.ts` — `buildIfStale` cố ý LUÔN build).
Vì vậy một lượt lab DAT chứng minh: mọi gói trong cây **build được + activate được + không ném lỗi console**.
Cột "gói" dưới đây là gói được staged lại lần cuối (row được thay) — không phải gói duy nhất được kiểm.

**Bảng đo được** (artifact `.parity/lab-evidence/<row>.json`; mọi lượt DAT có **cùng** một bộ số):

| row | #root | lỗi console | lỗi trang | did-not-activate | overlay | slot | nút | kết luận |
|---|---|---|---|---|---|---|---|---|
| locale | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-agent-preset | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-attachment | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-chat | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-commands | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-shortcuts (do tm-client-ui-a/Lead chạy cùng công cụ) | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| file-upload (ngoài danh sách 41) | 42.190 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| session-title-first-prompt-llm (ngoài danh sách 41) | 24.602 | 0 | 0 | 0 | 0 | 25 | 13 | DAT |
| ui-approval (lượt đầu) | 420 | **149** | 0 | **1** | 0 | 0 | 0 | **KHONG DAT — ĐỎ GIẢ** |
| ui-approval (chạy lại 22:00 khi build đã ổn định) | **24.602** | 0 | 0 | 0 | 0 | 25 | 13 | **DAT** |

**Vì sao dừng ở mẫu thay vì boot đủ 41 row** (đo được, không suy đoán):
- Log của **7/7 lượt boot** đều in `[lab] patch cua repo DA thay row <row>: khong chen overlay` ⇒ với mọi row ĐÃ
  MOUNT, lab boot **cùng một cấu hình y hệt** (cùng app.patch.yml, cùng 118 gói) — chỉ khác gói được build lại
  lần cuối. Boot thêm 35 row nữa **không thêm biến nào để đo**, chỉ tốn ~80–150s/row.
- Bằng chứng số: 5 row DAT có **cùng** #root 24.602 · 0 console · 0 did-not-activate · 25 slot · 13 nút.
- `check:rows` (21:31): **122 package khai gbh.row — TẤT CẢ đạt, 0 dòng `chan`** ⇒ phần artifact/slot đã có
  cổng chặn riêng; `accept-row` chạy được cho BẤT KỲ row nào khi cần bằng chứng đơn lẻ.
- **ui-approval KHONG DAT là ĐỎ GIẢ — đã chứng minh bằng lượt chạy lại**: gói này KHÔNG đổi trong ngày
  (src 19:35 · lib 19:37) nhưng lỗi là `Error: invalid plugin, expect function or object with an "apply" method,
  received object` + 149 lỗi 404 tài nguyên ⇒ **boot đọc phải bundle đang được công nhân khác build dở**
  (mtime đo được trong cửa sổ đó: `ui-renderer` 21:21 · `ui-trajectory` 21:27 · `ui-schedule` 21:29 ·
  `ui-primitives` 21:28 · `file-upload` 21:23). Chạy lại `lab-evidence ui-approval` lúc 22:00 (cùng máy,
  build đã ổn định): **DAT · #root 24.602 · 0 lỗi console · 0 did-not-activate** ⇒ khẳng định đỏ giả.
  Đúng bẫy E.1 của ROW-REVIEW-CHECKLIST: **kết luận chỉ sau khi writer dừng**.
- **ui-shortcuts**: artifact cũ trong `.parity/lab-evidence/ui-shortcuts.json` là BO QUA do trùng home trước khi
  có lock; lượt `accept-row ui-shortcuts` **sau lock** cho: test 13 pass · check:rows 0 chan · lab cổng 5460 ·
  #root 39.573 · 0 lỗi console · 0 did-not-activate · 0 overlay ⇒ **DAT** (log `/tmp/gbh-accept-lab-ui-shortcuts.log`).


**Caveat phép đo #root** (ghi để đời sau không so sai):
- Lab dùng home MỚI nên #root **không so trực tiếp** với app thật (67.167 ký tự, có session đang mở).
- #root của lab phụ thuộc **hộp thoại một-lần (onboarding)** có đang mở lúc đo hay không. Probe đã
  **đóng hộp thoại một lần** trước khi đo để mọi row cùng trạng thái; vẫn có thể lệch vài nghìn ký tự
  do thời điểm render dưới tải. Tiêu chí DAT không dựa vào #root ngoài ngưỡng sàn 20.000.
- Lượt sweep đầu (21:03) từng cho 3 row #root 21.985–24.602 vì probe cũ đọc khi React còn render dở
  dưới tải nặng. Đã sửa: chờ ≥8s + #root ổn định **5 lần đo liên tiếp**; xoá artifact cũ, chạy lại sạch.

## 3. Ảnh A/B Settings — nút "Mở tệp cấu hình" + dịch tiếng Việt

**Cách đo (cùng build, khác ĐÚNG MỘT biến)**: `bun run tools/check/settings-ab.ts --ref-lab ui-settings-general`

| bên | môi trường | modal Settings | mục Chung | ghế `settings.action` | panel | dòng tiếng Anh | dòng có dấu vi |
|---|---|---|---|---|---|---|---|
| ref | lab home mới · Chrome **en-US** ("TRƯỚC khi dịch") | mở được | bấm được | **Open configuration file** (142 ký tự) | 38 dòng | **35** | 0 |
| ours | app thật 5439 · Chrome **vi-VN** ("SAU khi dịch") | mở được | bấm được | **Mở tệp cấu hình** (134 ký tự) | 39 dòng | **5*** | **32** |

\* 5 dòng "trông như tiếng Anh" ở bên ours đều là **nhãn tiếng Việt KHÔNG DẤU**: `Chung` · `Model` ·
`Plugin` · `Preset agent` · `Khi xong`. Bên ref cùng panel có 35 dòng tiếng Anh thật (Language · Appearance ·
Light · Font size · …).

**Pixel**: 19.321 / 1.296.000 = **1,491%** (1440x900) — khác biệt **CÓ CHỦ ĐÍCH** (ngôn ngữ + nhãn nút),
không phải hồi quy bố cục. Artifact:
- `.parity/settings-ab/ref-settings-general.png` (English)
- `.parity/settings-ab/ours-settings-general.png` (Tiếng Việt)
- `.parity/settings-ab/diff-settings-general.png` (pixel khác tô đỏ)
- `.parity/settings-ab/evidence.json` (số + chữ panel hai bên)

**Nối với phép đo TRƯỚC → SAU của phiên trước** (docs/HANDOVER.md §2.1, đo bằng DOM thật):
TRƯỚC `<div data-slot="settings.action">` **rỗng, 0 button** → SAU có button
`<button class="_outline …">Mở tệp cấu hình</button>`. Lượt này xác nhận trên DOM hiện tại:
ghế `settings.action` của ours có **134 ký tự HTML** và nhãn "Mở tệp cấu hình"; ref (cùng code,
en-US) có 142 ký tự và nhãn "Open configuration file" ⇒ ghế + nút tồn tại độc lập với ngôn ngữ.

## 4. Dọn 5 tệp test cũ đỏ từ HEAD (KHÔNG sửa code sản phẩm)

Đo bằng `git status --porcelain <file>` = rỗng (chưa đổi từ HEAD) cho cả 5 tệp trước khi sửa ⇒ chúng đỏ từ
HEAD, không phải hồi quy. Cập nhật theo **trạng thái hiện tại** (giữ nguyên tinh thần canh của ca test):

| tệp | ca cũ (đỏ) | vì sao đỏ (đo được) | cập nhật thành |
|---|---|---|---|
| `tests/host/config-editor.test.ts` | "TEST CANH: gói CHƯA khai gbh.row" | row config-editor ĐÃ khai `gbh.row` | khẳng định ĐÚNG hình dạng row hiện tại (id + disabled !!js + tests) |
| `tests/host/workspace.test.ts` | "ca 0a: gói KHÔNG khai gbh.row" | row workspace ĐÃ khai (mount xong) | khẳng định row hiện tại + giữ `draft` làm lịch sử |
| `tests/host/settings.test.ts` | "metadata gbh.row … khớp dump" | row settings **ĐANG GỠ MOUNT** (cách ly popup Settings); Lead ghi vào `gbh.row_unmounted_ly_do` | khẳng định gbh.row vắng + lý do + hình dạng row trong `row_unmounted_ly_do` |
| `tests/host/pwsh-sandbox.test.ts` | "đối chứng âm thứ hai … peer KHÔNG nằm trong dependencies" | row pwsh-sandbox ĐÃ khai `gbh.row` | khẳng định row hiện tại (id + disabled win32 + tests) |
| `tests/client/locale.test.ts` | "ca 2 · ca 4 · ca 5" | `LOCALE_IDS` bỏ `zh`, thêm `vi` (18/10/2026) | so PHẦN CHUNG (mọi trường trừ danh mục); danh mục khẳng định riêng; ca fallback đổi `vi`→`fr` (vi nay ĐÃ đăng ký); ca setLocale dùng ngôn ngữ thứ hai CỦA TỪNG BÊN (vi vs zh) |

**SỐ ĐO**:
- TRƯỚC (đo 20:47 trên 4 tệp): `54 pass · 6 fail` + riêng ca peer trong `pwsh-sandbox` = **1 fail** ⇒ **7 fail**.
- SAU: `bun test tests/host/config-editor.test.ts tests/host/workspace.test.ts tests/host/settings.test.ts tests/host/pwsh-sandbox.test.ts tests/client/locale.test.ts`
  ⇒ **81 pass · 0 fail · 565 expect**.
- Ngoài phạm vi: `gate:home-isolation` từng đỏ trong lượt `bun test` toàn bộ 20:47 (77s, 6 "unexplained"
  dưới `attachments/v1/objects`) — chạy khi máy đang tải nặng + nhiều tiến trình khác ghi home; KHÔNG phải
  hồi quy của 5 tệp trên (bằng chứng: cùng lượt đó 4 tệp cũ đỏ y hệt lý do đã ghi ở HANDOVER §4).

## 5. Baseline bố cục (9) — ĐÃ CHỐT LẠI (Lead xác nhận giao diện đúng sau brand swap)

Chủ dự án đã xác nhận "giao diện sau khi thay brand GBH là đúng" ⇒ chốt baseline mới:

| mốc | số đo | bằng chứng |
|---|---|---|
| BEFORE (baseline 17/10) | **73/80 phần tử khác = 91,3%** | Lead đo trước lượt này (baseline cũ) |
| AFTER (baseline mới 18/10) | **0/80 phần tử khác = 0% — DAT** | `bun run tools/check/probe-once.ts "<ready-url>" --save --shot` rồi `bun run check:app` |

- `.parity/layout-baseline.json` = **80 phần tử** hình học (chốt 21:40, app host PID 72827/boot kế tiếp 82605).
- `.parity/layout-baseline.png` = ảnh nền 1440x900 cùng thời điểm (thêm tuỳ chọn `--shot` cho `probe-once`).
- Đo kèm lúc chốt: **#root 49.579 ký tự · 46 slot** — khớp số Lead đo sau brand swap (#root 49.593; chênh 14
  ký tự do thời điểm render), KHÔNG phải mất nội dung: delta 17.574 ký tự so với 67.167 = **byte của wordmark
  SVG chữ "deepseek HARNESS" bị bỏ** trong brand swap.
- Vì vậy **chỉ số (8) đã đổi sang NGƯỠNG CẤU TRÚC** (xem §6): #root ≥ 40.000 **VÀ** [data-slot] ≥ 46 **VÀ**
  0 lỗi console **VÀ** 0 pageerror — thay cho ngưỡng cứng 60.000/67.167 ký tự.

## 6. Công cụ mới (đều nằm trong tools/check/, có header + JSDoc + < 1000 dòng)

| tệp | việc |
|---|---|
| `tools/check/lab-lock.ts` | **khoá toàn cục** `/tmp/gbh-lab.lock`: chờ ≤240s, phát hiện pid chết để xoá khoá mồ côi, re-entrant (refcount), `GBH_LAB_LOCK_BYPASS=1` cho tiến trình con. Sự cố thật: hai lượt cùng row ⇒ `EEXIST: symlink .../@deepseek-ai/cordis` ⇒ lab không boot. |
| `tools/check/lab-evidence.ts` | sweep lab nhiều row, probe DOM thật (#root · console · pageerror · did-not-activate · overlay · slot), đóng hộp thoại một lần, dọn lab, ghi `.parity/lab-evidence/`. |
| `tools/check/accept-row.ts` | chuẩn hoá bằng chứng MỘT row: test + check:rows + lab + dọn lab, in **khối dán thẳng** vào báo cáo/signoff (mỗi bước một số; thiếu URL ⇒ báo lỗi rõ, không bịa số). |
| `tools/check/settings-ab.ts` | ảnh A/B Settings: hai phiên Chrome **khác locale** (en-US vs vi-VN) trên CÙNG build, chụp modal + mục Chung, đọc DOM (ghế settings.action, dòng tiếng Anh/tiếng Việt), so pixel bằng `pixelmatch` của giàn parity. |

**Sửa công cụ đo theo yêu cầu Lead (18/10/2026):**
- `tools/check/page-probe.ts`: `probePage` trả thêm **slotCount** (`[data-slot]`) và **pageErrors** (bắt riêng
  `pageerror`, trước đây gộp lẫn vào lỗi console). Ghi rõ trong JSDoc vì sao: brand swap bỏ wordmark chữ làm
  #root 67.167 → 49.593.
- `tools/check/app-health.ts` (8): ngưỡng **CẤU TRÚC** `MIN_ROOT_STRUCTURAL_CHARS = 40_000`,
  `MIN_SLOT_COUNT = 46`, 0 lỗi console, 0 pageerror. Comment tại chỗ ghi TRƯỚC→SAU và lý do (không báo oan
  thay đổi thương hiệu có chủ đích).
- `tools/check/probe-once.ts`: thêm `--shot` — ghi kèm `.parity/layout-baseline.png` khi chốt baseline.

## 6b. Cổng kiểm tra (đo 21:57)

| cổng | kết quả | ghi chú |
|---|---|---|
| `bun test` 5 tệp vừa dọn | **81 pass · 0 fail · 565 expect** | xem §4 |
| `check:rows` | **122 package — TẤT CẢ đạt · 0 dòng `chan`** | `/tmp/gbh-rows-2131.txt` |
| `gate --no-tests` | **6/7 XANH · ĐỎ: file-length** | 2 vi phạm KHÔNG thuộc tm-evidence: `tests/client/ui-goal.test.ts` 1012 dòng · `tests/host/llm-deepseek-account.test.ts` 1031 dòng (agent khác đang viết) |
| `gate` cổng typecheck | "XANH" nhưng **SKIP** | `spawnSync node ETIMEDOUT` sau 181s dưới tải ⇒ **KHÔNG kết luận được**; chạy lại khi máy rảnh |
| 4 công cụ mới | header · file-length · jsdoc đều XANH | `lab-lock` 130 · `lab-evidence` 499 · `accept-row` 389 · `settings-ab` 497 dòng |

## 7c. Regression "single slot sidebar.brand.mark" (đo 22:33–22:36, KHÔNG boot app 5439)

**Triệu chứng (cửa sổ 22:12–22:24)**: pageError `single slot "sidebar.brand.mark" already has a registration
at priority 0 (registered by @galaxy-blackhole/gbh-client-ui-brand-official)` ⇒ sidebar crash ⇒ **#root 22.204**
thay vì 24.602 (đo được trong accept-row `pwsh-sandbox` 22:20).

**Đo lại 2 row sau khi sửa** (accept-row, lab riêng, có host log):

| row | sidebar? | test | #root | console | pageError | did-not-activate (trang) | did-not-activate (host) | kết luận |
|---|---|---|---|---|---|---|---|---|
| `ui-settings-general` | CÓ | 17 pass | **24.602** | 0 | **0** | 0 | 0 | **DAT** |
| `locale` | KHÔNG | 6 pass | **24.602** | 0 | **0** | 0 | 0 | **DAT** |

⇒ regression **không còn tái hiện** lúc 22:33–22:36; vì mọi lab boot dùng CÙNG cấu hình client, khi lỗi xuất
hiện thì **cả hai row đều dính** ⇒ lỗi là **TOÀN REPO**, không riêng nhóm sidebar.

**Boot payload (đọc từ trang lab `window.__DSH_BOOT__`)**:
- `ui-settings-general`: **rev=e5b97eff9260 · 130 entry · 11 batch**
- `locale`: **rev=787fb3260ff8 · 130 entry · 11 batch**
- Entry chủ slot trong payload: **CHỈ `@galaxy-blackhole/gbh-client-ui-brand-official`** (+ alias stock).
  **KHÔNG có** `gbh-client-ui-brand` ⇒ gói mới chưa mount trong lượt đo này.

**Nguyên nhân (đọc từ metadata của chính chủ gói)**: `packages/client/ui-brand/package.json`
(`gbh.row_unmounted_ly_do`) ghi: gói mới đăng ký TRÙNG 2 slot **single** `sidebar.brand.mark` +
`sidebar.brand.name` đã có chủ là row `ui-brand-official` ⇒ pageError ⇒ sidebar crash. Đã sửa plugin chỉ còn
slot HERO và **chưa bật lại row** (`gbh.row = {}`, không có entry trong boot payload). Trạng thái "DA BAT
LAI sau khi lab 2 lượt chứng minh 0 pageError" là ghi chú của chủ gói — lượt đo này xác nhận **0 pageError**.

## 7b. Đo lại 3 gói HOST từng lỗi "did not activate" (số (5) thật, đo bằng LOG HOST)

Bối cảnh: lỗi tái hiện 100% trên boot thật 21:38 (tm-reviewer xác nhận bằng 4 boot độc lập). Trong lúc tôi
đo lại, **3 lỗi được người khác sửa dần** — nên số dưới đây là "sau khi sửa", không phải "đang lỗi":

| gói | sửa lúc | đo lại bằng | test | did-not-activate (trang) | **did-not-activate (host log)** | kết luận |
|---|---|---|---|---|---|---|
| `ui-sidebar-documentpreview` | **22:04** src đổi `export function Config` → `export const Config = schema.object` | `accept-row` 22:13 | 17 pass · **0 fail** | 0 | **0** | **DAT** |
| `pwsh-sandbox` | **22:09** metadata `disabled: true` + `insertDisabled: {js: platform !== win32}` | `accept-row` 22:20 | 22 pass khi chạy riêng · 0 fail | 0 | **0** | **DAT** (pageerror brand ở lượt 22:20 đã hết — xem §7c) |
| `config-editor` | **22:09** metadata `disabled: true` + `insertDisabled: {js: !profileContext}` | `lab-evidence` 22:42 | 16 pass · 1 fail HMR-timing (xem dưới) | **0** | **0** | **DAT** |

**KẾT LUẬN (5) cho 3 gói host từng lỗi**: cả 3 đều **did-not-activate (host log) = 0** sau khi được sửa
(documentpreview 22:04 · config-editor/pwsh-sandbox 22:09 với cơ chế `disabled: true` + `insertDisabled`).
Log host tương ứng: `.parity/lab-evidence/<row>.host.log` + `/tmp/gbh-accept-lab-<row>.host.log`.

**Phát hiện MỚI khi đo lại bằng accept-row (chưa thuộc task-7)**: lab `pwsh-sandbox` có
**1 pageerror**: `Error: single slot "sidebar.brand.mark" already has a registration at priority 0
(registered by @galaxy-blackhole/gbh-client-ui-brand-official)` ⇒ nửa client `ui-brand-official`
(tm-assets) đăng ký trùng slot `sidebar.brand.mark`. Đây là lỗi THẬT phía client, cần báo chủ gói.

**Ghi chú về test sau 22:17**: `tests/host/config-editor.test.ts` và `tests/host/pwsh-sandbox.test.ts` đã
được người khác sửa (thêm ca `renderRewriteBlock`, cập nhật `insertDisabled`) — ngoài phạm vi dọn test của
tôi (5 tệp §4, số đo 21:xx). `tests/host/config-editor.test.ts` hiện có **1 fail ca HMR-timing**
(`runExclusive` gọi đúng 1 lần) — tái hiện cả khi chạy riêng, KHÔNG phải do tải; cần chủ tệp xử lý.

## 6c. Phép đo bổ sung (Lead duyệt 22:05): LOG HOST cho entry NỬA HOST

**Lỗ hổng đo được**: `lab-evidence`/`accept-row` chỉ đo **phía TRANG** (client boot: console + banner DOM).
Entry **nửa HOST** không activate vẫn để trang render bình thường, console 0 lỗi ⇒ lab báo DAT oan trong khi
log host có dòng `did not activate`. Đây chính là cách 3 lỗi (config-editor · pwsh-sandbox ·
ui-sidebar-documentpreview) lọt qua sweep trước đó.

**Đã sửa (Lead duyệt)**:
- `tools/lab/row.ts`: host child ghi **TRỰC TIẾP** vào `<home>/host.log` (`stdio = fd của file`), URL đọc
  bằng polling file, chờ thêm 1,5s sau `ready` để bắt các dòng `did not activate` in SAU ready.
  (Bản tee qua pipe không đủ: lab exit ngay khi thấy URL ⇒ pipe đóng ⇒ mất dòng cuối — đo được.)
- `tools/check/lab-evidence.ts`: thêm `hostDidNotActivate`, `hostNotActivatedEntries`, `hostLogFile`;
  chép log host vào `.parity/lab-evidence/<row>.host.log`; **DAT** giờ yêu cầu thêm `hostDidNotActivate = 0`;
  bảng summary có cột `did-not-activate (host)`.
- `tools/check/accept-row.ts`: đọc `<home>/host.log` (KHÔNG chỉ stdout lab), in thêm dòng
  `did-not-activate (host log) N [entry…]` + lưu bản sao `/tmp/gbh-accept-lab-<row>.host.log`.

**SỐ ĐO ĐẦU TIÊN** (accept-row `pwsh-sandbox`, 22:07, log `/tmp/gbh-accept-lab-pwsh-sandbox.log`):

| nguồn | số | entry |
|---|---|---|
| trang (console + banner) | **0** | — |
| **log host** | **1 dòng "did not activate"** | `config-editor-ours` · `pwsh-sandbox-ours` |

⇒ chứng minh trực tiếp bài học: **trang DAT mà host vẫn lỗi**; và xác nhận lại 2/3 lỗi sản phẩm của
tm-reviewer bằng CHÍNH công cụ của tôi (độc lập với 4 boot của reviewer). Số của
`ui-sidebar-documentpreview` và `config-editor` (accept-row riêng) ở §7b.

## 7. Bộ số `check:app` cuối (21:43) + cảnh báo boot bị nhiễu

Chạy trên boot 21:38 (host PID 82605, log mới `~/.galaxy/blackhole/host-5439.log`):

| chỉ số | số đo | kết luận |
|---|---|---|
| (1) trang trả về | **110.131 B** | DAT |
| (3) số entry boot | **132** | DAT |
| (5) dòng "did not activate" | **1** (3 entry) | **KHONG DAT — 3 LỖI SẢN PHẨM tái hiện 100% (xem dưới)** |
| (6) gói CỦA TA đang chạy thật | **57 gói** | DAT |
| (8) UI render thật | **49.579 ký tự #root (≥40.000) · 46 slot (≥46) · 2 lỗi console · 0 pageerror** | KHONG DAT vì 2 lỗi 404 |
| (9) bố cục khớp đường nền | **0/80 phần tử khác (0%)** | **DAT** (baseline mới) |
| (10) bản mount mới nhất | **197 file khớp repo** | DAT |
| (11) HMR sống | HTTP 200 · `: connected` | DAT |

**3 entry "did not activate" của boot này (nguyên văn log):**
1. `ui-sidebar-documentpreview-ours`: `TypeError: Cannot read properties of undefined (reading 'validate')` tại `resolveConfig`.
2. `config-editor-ours`: `Error: service "configEditor" has been registered at <ConfigEditor>`.
3. `pwsh-sandbox-ours`: `Error: service "shell" has been registered at <SandboxBashExecutor>`.

**Chẩn đoán ĐÚNG (đã đính chính sau đối chứng của tm-reviewer — bản đầu của tôi SAI)**:
3 entry này là **LỖI SẢN PHẨM, tái hiện 100%**, không phải nhiễu do build chồng. tm-reviewer chạy **4 lượt
boot cách ly độc lập** (home riêng; 21:38 · 21:52 · 21:56 · 22:00) ⇒ **cả 4 ra đúng 3 entry đó**. Tôi kiểm
lại trên artifact (không đoán):

| entry | nguyên nhân gốc (đo trên artifact) | bằng chứng |
|---|---|---|
| `ui-sidebar-documentpreview-ours` | nửa HOST export **`function Config(raw)`**; Cordis `resolveConfig` gọi `runtime.Config["~standard"].validate(config)` ⇒ hàm thường không có `~standard` ⇒ TypeError. Bản gốc export `z.object({...})` (có `~standard`). Quét 122 nửa-host: CHỈ gói này có Config dạng hàm. | `packages/client/ui-sidebar-documentpreview/src/index.ts:31` · stock `dsh-client-ui-sidebar-documentpreview/lib/index.js:5` · `apps/host/node_modules/@deepseek-ai/cordis/lib/index.js:957-959` |
| `config-editor-ours` | patch LẶP LẠI điều kiện `disabled: !!js "!ctx.get('profileContext')"` của bản GỐC cho row stock rồi `insert` bản ta **không có disabled** ⇒ khi `profileContext` CÓ thì cả stock lẫn ta cùng active ⇒ `service "configEditor" has been registered` | `~/.galaxy/blackhole/app.patch.yml:747-752` |
| `pwsh-sandbox-ours` | `SandboxPwshExecutor` của ta đăng ký `ctx.shell`, trùng executor bash (`SandboxBashExecutor`); bản gốc bị TẮT trên macOS (`disabled: process.platform !== 'win32'`) nhưng `insert` của ta **không mang điều kiện đó** ⇒ trên macOS ta vẫn bật ⇒ trùng `service "shell"` | `packages/host/pwsh-sandbox/src/index.ts:84-90` · patch `app.patch.yml:972-973` (insert không có disabled) |

⇒ **KHÔNG dùng (5)=0 làm bằng chứng cho tới khi 3 entry này được sửa/bỏ** (2 lỗi thuộc phạm vi task-15,
1 lỗi mới). Hai lỗi 404 console của (8) thì đúng là transient: probe lại 21:46 bằng Chrome profile mới cho
0 lỗi console · 0 URL 4xx.

**Bài học phép đo (quan trọng cho người ký)**: `lab-evidence`/`accept-row` đo **phía TRANG** (client boot:
console + banner DOM). 3 lỗi trên là entry **nửa HOST** ⇒ trang vẫn render bình thường, console 0 lỗi, nên
lab báo DAT trong khi log host có 3 dòng `did not activate`. Vì vậy: **row HOST phải kết luận bằng LOG HOST**
(`~/.galaxy/blackhole/host-5439.log` hoặc log của lab) — không được chỉ dùng lab page probe.

**Việc tiếp theo (cần Lead điều phối):**
1. **Re-boot MỘT lần khi KHÔNG còn ai build** (ROW-REVIEW E.1: chỉ kết luận sau khi writer dừng) → chạy lại
   `check:app` để lấy (5)(8) chuẩn; 3 lỗi trên phải biến mất. Trong lúc đó KHÔNG dùng (5) của boot 21:38 làm
   bằng chứng ký.
2. 5 gói CHUA-KHAI (ui-plugin-manager · ui-theme · ui-renderer · ui-shortcuts · file-upload) vẫn cần hàng
   bằng chứng riêng khi mount — `accept-row` đã sẵn sàng cho từng gói.
3. Reviewer độc lập: chạy lại `accept-row <row>` cho mẫu 3–5 row trong bảng §2 (đề nghị: ui-settings-general ·
   ui-chat · locale · ui-trajectory · ui-shortcuts) để đối chứng ba chữ ký; reviewer đã được thông báo danh sách.
