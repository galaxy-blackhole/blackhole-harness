<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 07/11/2026
 desc Báo cáo REVIEW 4 luật repo cho 15 tệp đã sửa trong phiên 07/11/2026 (header · JSDoc · ≤1000 dòng · không màu/số literal):
      kết quả từng tệp + dòng vi phạm + cách sửa đề xuất. KHÔNG sửa tệp nào khác ngoài tệp báo cáo này.
-->

# Review 4 luật — phiên 07/11/2026

- **Người review:** teammate `kiem-tra` (task board: `task-2`)
- **Thời điểm đo:** 2026-11-07 11:13 → 11:17 (Asia/Saigon)
- **Repo:** `galaxy-blackhole/blackhole-tauri`
- **Phạm vi:** ĐÚNG 15 tệp đã sửa trong phiên (không kiểm toàn repo — Lead đã chạy `bun run gate` XANH 8/8)
- **Ràng buộc đã giữ:** chỉ ghi đúng tệp báo cáo này; KHÔNG sửa mã nguồn, KHÔNG build, KHÔNG restart host.

## 0. Kết luận nhanh

| Luật | Kết quả | Số vi phạm | Chi tiết |
|---|---|---|---|
| **(a) Header 5 trường** | **KHÔNG ĐẠT** | **3** | V1 `packages/client/locale/src/plugin.ts:5` · V2 `tools/locale/gen-vi.ts:5` · V3 `tools/locale/gen-vi.ts:262` (hard-code ngày cho file sinh) |
| **(b) JSDoc export** | **ĐẠT** | 0 (2 lưu ý) | L1 JSDoc mồ côi + mô tả nhầm đối tượng `settings-about/src/client.ts:84-99` · L2 `items.ts` viết "Nhan:/Tra:" không dấu |
| **(c) ≤ 1000 dòng/tệp** | **ĐẠT** | 0 | Tệp dài nhất: `locales-vi.ts` **597/1000 dòng** |
| **(d) Không màu/số literal** | **KHÔNG ĐẠT** | **1 tệp / 20 vị trí** | `settings-about/src/client.ts`: 2 màu literal (dòng 130, 132) + 18 số literal trong inline style — **có sẵn từ trước phiên**, phiên này không thêm |

- Không có Tailwind, không có `@galaxy-stack/ai-coder-core`, không tệp nào vượt 1000 dòng.
- 3 vi phạm luật (a) đều là **ngày `modify date` cũ** (không phải thiếu header) — cổng `lint:header` không bắt được vì nó chỉ kiểm *định dạng* `dd/mm/yyyy`.
- 1 nhóm vi phạm luật (d) nằm ở tệp **đã có từ trước**; `git diff` chứng minh phiên này không thêm màu literal nào.

## 1. Phương pháp đo (bằng chứng tái lập được)

1. Đếm dòng thật: `wc -l` trên đúng 15 tệp (mục 2).
2. Chạy 3 cổng của repo (toàn cây):
   - `bun run lint:header` → `[OK header · kiểm 4165 file · 0 vi phạm · 0 cảnh báo · bỏ qua 2093]`
   - `bun run lint:length` → `[OK file-length · kiểm 4165 file · 0 vi phạm · 0 cảnh báo]`
   - `bun run lint:jsdoc` → `[OK jsdoc · kiểm 4165 file · 0 vi phạm · 21 cảnh báo]` — **21 cảnh báo không có cái nào thuộc 8 tệp .ts của phiên** (chúng nằm ở rpc-schema.ts, runtime.ts, speech-to-text-phowhisper, typert-registry, tests/host, tools/parity/hmr.ts).
   - `bun run tools/lint/jsdoc.ts --strict` lọc theo 8 tệp của phiên → **0 cảnh báo** (nên cũng không có cảnh báo NHẬN/TRẢ bị che).
3. Chạy lại 3 cổng trên **cây cô lập** chỉ chứa 15 tệp của phiên (`GBH_LINT_ROOT=/tmp/gbh-review-tree`) để chắc chắn các tệp này thực sự được kiểm (không bị miễn trừ oan):
   - `[OK header · kiểm 10 file · 0 vi phạm · bỏ qua 5]`
   - `[OK file-length · kiểm 10 file · 0 vi phạm · bỏ qua 5]`
   - `[OK jsdoc · kiểm 10 file · 0 vi phạm · 0 cảnh báo · bỏ qua 5]`
   (5 tệp bị bỏ qua đúng là 5 tệp `.json` — miễn header theo AGENTS §1 và `tools/lint/exemptions.ts`.)
4. Kiểm tay từng khối header (5 trường, đúng thứ tự) + so với ngày sửa thật (`ls -lT` mtime + `git diff --stat`) — đây là chỗ bắt được 3 vi phạm (a).
5. Kiểm tay `export` + khối JSDoc ngay trên nó cho 8 tệp `.ts` (31 dòng `export`), và quét literal màu/Tailwind/inline-style bằng grep có bằng chứng dòng.
6. Mốc thời gian: **cả 15 tệp đều có mtime 07/11/2026** (10:19 → 11:07), tức chúng thực sự được sửa trong phiên — dùng làm căn cứ cho `modify date`.

## 2. Bảng kết quả từng tệp (15 tệp + 1 mục đã chuyển ra)

| # | Tệp | Dòng | (a) Header | (b) JSDoc | (c) ≤1000 | (d) Màu/số |
|---|---|---|---|---|---|---|
| 1 | `packages/client/ui-settings-general/src/items.ts` | 121 | ĐẠT — `modify date 07/11/2026` | ĐẠT — 1 export `createItems`, doc có Nhan/Tra (xem L2) | ĐẠT | ĐẠT* — 2 token `--dsw-*`, không màu literal |
| 2 | `packages/client/settings-about/src/client.ts` | 198 | ĐẠT — 07/11/2026 | ĐẠT (xem L1) | ĐẠT | **KHÔNG ĐẠT** — V4 |
| 3 | `packages/client/settings-about/src/locales.ts` | 44 | ĐẠT — 07/11/2026 | ĐẠT — 4 export, mỗi export 1 doc | ĐẠT | ĐẠT — chỉ chuỗi |
| 4 | `packages/client/locale/src/plugin.ts` | 275 | **KHÔNG ĐẠT** — V1 | ĐẠT — 6 export đều có doc | ĐẠT | ĐẠT — không màu/số hiển thị |
| 5 | `packages/client/locale/src/locales-vi-stock.ts` | 306 | ĐẠT* — file SINH TỰ ĐỘNG, 5 trường đúng thứ tự | ĐẠT — 4 export, doc máy sinh có Nhận/Trả | ĐẠT | ĐẠT — dữ liệu |
| 6 | `packages/client/locale/src/locales-vi.ts` | 597 | ĐẠT* — như trên | ĐẠT — 13 export, doc máy sinh có Nhận/Trả | ĐẠT | ĐẠT — dữ liệu |
| 7 | `tools/locale/gen-vi.ts` | 328 | **KHÔNG ĐẠT** — V2 (+ V3 ở dòng 262) | ĐẠT — 0 export; mọi hàm nội bộ đều có doc | ĐẠT | ĐẠT — số là hằng thuật toán |
| 8 | `tools/dev/dom-text.ts` | 130 | ĐẠT — 07/11/2026 | ĐẠT — 4 hàm có doc Nhận/Trả | ĐẠT | ĐẠT* — số là tham số CDP của công cụ dev, không phải component |
| 9 | `docs/GBH-P4-PHIEN-07-11-2026.md` | 114 | ĐẠT — 07/11/2026 | — (tài liệu) | ĐẠT | — (tài liệu) |
| 10 | `docs/GBH-P4-RA-CHUOI-ANH.md` | 247 | ĐẠT — 07/11/2026 | — | ĐẠT | — |
| 11 | `tools/locale/gbh-locale-vi-manual.json` | 308 | **MIỄN** (dữ liệu, AGENTS §1) | — | ĐẠT | — (dữ liệu) |
| 12 | `packages/client/ui-agent-preset/locale/vi-chrome.json` | 30 | **MIỄN** (dữ liệu) | — | ĐẠT | — |
| 13 | `packages/client/ui-settings-models/locale/vi-chrome.json` | 112 | **MIỄN** (dữ liệu) | — | ĐẠT | — |
| 14 | `packages/host/session/package.json` | 87 | **MIỄN** (manifest) | — | ĐẠT | — |
| 15 | `packages/host/llm/package.json` | 98 | **MIỄN** (manifest) | — | ĐẠT | — |
| 16 | `packages/client/ui-settings-general/src/parts/` | — | **KHÔNG CÒN TRONG REPO** (đã chuyển ra khỏi gói) | — | — | — |

Ghi chú cột (d):
- `*` = tệp không phải component UI, hoặc số literal thuộc **hình học port nguyên văn** (CSS bản gốc / SVG icon), không phải màu/số tuỳ tiện trong logic. Lý do từng ca ở mục 3.4.
- 5 tệp `.json` hợp lệ JSON (đã parse thử bằng `bun -e JSON.parse`): manual 23 namespace · ui-agent-preset 28 khoá · ui-settings-models 109 khoá · host/session 14 khoá (có `exports` gồm `./src/*`) · host/llm 13 khoá (có `exports` gồm `./src/*`) — đúng mục đích sửa "thiếu subpath export" của phiên.

## 3. Vi phạm chi tiết + cách sửa đề xuất (KHÔNG tự sửa)

### 3.1. V1 — (a) Header: `modify date` cũ
- **Tệp:** `packages/client/locale/src/plugin.ts` — **dòng 5**
- **Hiện tại:** `* modify date 17/10/2026`
- **Bằng chứng tệp đã sửa trong phiên:** `git diff --stat` → `plugin.ts | 45 +++++++++---` (**+39 / −6**), mtime `Nov 7 10:52:54 2026`; diff có các dòng thêm ghi rõ "07/11/2026 — DỊCH TẤT CẢ đợt 2".
- **Vi phạm:** luật (a) yêu cầu `modify date <ngày sửa cuối>`; ngày sửa cuối thực tế là **07/11/2026**.
- **Đề xuất sửa:** đổi dòng 5 thành `* modify date 07/11/2026`.

### 3.2. V2 — (a) Header: `modify date` cũ ở tệp mới
- **Tệp:** `tools/locale/gen-vi.ts` — **dòng 5**
- **Hiện tại:** `* modify date 18/10/2026`
- **Bằng chứng:** tệp **mới** trong phiên (`git status` → `?? tools/locale/`), mtime `Nov 7 10:53:16 2026`, và chính nội dung tệp có 4 chỗ ghi ngày 07/11/2026 (dòng 40, 62, 67, 295).
- **Đề xuất sửa:** đổi dòng 5 thành `* modify date 07/11/2026`.

### 3.3. V3 — (a) Header của TỆP SINH: ngày bị hard-code
- **Tệp:** `tools/locale/gen-vi.ts` — **dòng 262**
- **Hiện tại:** `" * modify date 18/10/2026",` nằm trong hàm `header(pkg)` (dòng 256-268) → **mọi** tệp do công cụ sinh đều mang ngày 18/10/2026 bất kể sinh ngày nào.
- **Hệ quả:** `packages/client/locale/src/locales-vi.ts:5` và `packages/client/locale/src/locales-vi-stock.ts:5` đều ghi `modify date 18/10/2026` trong khi chúng được **sinh lại ngày 07/11/2026** (mtime `Nov 7 10:53:17 2026` của cả hai tệp).
- **Cách xử lý theo đúng chỉ đạo của Lead:** hai tệp sinh này **ĐẠT** luật (a) vì header do `gen-vi.ts` sinh và có **đủ 5 trường đúng thứ tự**; lỗi được tính **một lần** ở `gen-vi.ts:262` (V3), không nhân đôi thành 2 vi phạm nữa.
- **Đề xuất sửa (chọn 1):**
  1. Cho `header()` nhận ngày: `function header(pkg: string, modifyDate = new Date().toLocaleDateString("en-GB"))` → tự ra `dd/mm/yyyy`; hoặc
  2. Khai một hằng `const MODIFY_DATE = "07/11/2026"` ở đầu tệp và cập nhật mỗi lần sửa công cụ.
  Sau đó sinh lại **chỉ gói locale** để không đụng 40 gói khác: `bun run tools/locale/gen-vi.ts --write --only=locale`.

### 3.4. V4 — (d) Màu/số literal trong component
- **Tệp:** `packages/client/settings-about/src/client.ts` (2 component: `AboutIcon` dòng 59-79, `AboutPanel` dòng 109-144)
- **Màu literal — 2 vị trí:**
  - **dòng 130:** `background: "#3f5876"` (hex cứng — nền thẻ Zalo)
  - **dòng 132:** `color: "#fff"` (hex cứng)
- **Số literal trong inline style — 18 vị trí** (9 object `style: {…}`):
  - dòng 114: `gap: 6, fontSize: 14, lineHeight: "22px"` (3)
  - dòng 116: `opacity: 0.75` (1)
  - dòng 122: `gap: 6, fontSize: 14, lineHeight: "22px"` (3)
  - dòng 124: `opacity: 0.75` (1)
  - dòng 130: `marginTop: 16, width: 300, borderRadius: 10, padding: 16` (4)
  - dòng 132: `fontSize: 12, opacity: 0.9, marginBottom: 8` (3)
  - dòng 133: `borderRadius: 6` (1)
  - dòng 137: `fontSize: 22, fontWeight: 600, marginBottom: 12` (3)
  - dòng 143: `padding: 4` (1)
  → tổng **18 số** + 2 màu = **20 vị trí literal**.
- **So với luật:** `Không màu/số literal trong component — chỉ token --dsw-*` (AGENTS §2). Trong cùng tệp, dòng 125 đã dùng đúng token (`color: "var(--dsw-alias-brand-primary)"`) ⇒ chứng minh cách đúng đã có sẵn, chỗ còn lại là sót.
- **Không phải do phiên này:** `git diff` của `client.ts` chỉ có 5 hunk (đổi `modify date`, sửa doc, xoá dòng "Phiên bản gói" và `props.version`); **không hunk nào chạm dòng 130/132 hay các object style** ⇒ 20 vị trí literal này **có từ trước**.
- **Đề xuất sửa:**
  1. Thay 2 màu bằng token: nền thẻ Zalo → token nền phù hợp (ví dụ `var(--dsw-alias-bg-*)`); chữ trên thẻ → `var(--dsw-alias-label-primary)` nếu nền đổi theo theme, hoặc (nếu bắt buộc giữ đúng màu thương hiệu Zalo) khai **một biến CSS duy nhất** trong CSS Module của gói (`--gbh-zalo-card-bg`) rồi dùng `var()` — không rải hex trong component.
  2. Gom toàn bộ inline style thành **CSS Module** của gói (đúng luật DSH) hoặc tối thiểu thành một hằng `const STYLES = {…}` ở đầu tệp để không còn số nằm rải trong JSX.
- **Không tính là vi phạm (đã cân nhắc, nêu rõ lý do):**
  - Hình học SVG icon riêng (dòng 65-68, 73, 75): `viewBox: "0 0 16 16", strokeWidth: 1.4, cx: 8, cy: 8, r: 6.2, r: 0.75` — là **toạ độ hình học của icon**, màu đã dùng `currentColor`/`none`; không phải màu/số tuỳ tiện.
  - `order: 900` (dòng 175) và mặc định `size = 16` (dòng 60): là **hằng đăng ký/tham số có ngữ nghĩa**, không phải giá trị hiển thị.
  - `items.ts` dòng 54 `DEV_CSS`: chuỗi CSS **port nguyên văn bản gốc** (class hash `Pt1bsG_*` để giữ parity), **màu đã dùng token** `var(--dsw-alias-border-l2)` và `var(--dsw-alias-label-secondary)`; các `px` là hình học CSS của bản gốc ⇒ ĐẠT.
  - `tools/dev/dom-text.ts`: cổng `9222`, timeout, `1600×1000` là **tham số CDP của công cụ dev**, không phải component ⇒ ĐẠT.

### 3.5. L1 — (b) Lưu ý chất lượng JSDoc (không tính vi phạm luật b)
- **Tệp:** `packages/client/settings-about/src/client.ts` — **dòng 84-99**
- Hiện trạng: có **hai khối JSDoc liền nhau**:
  - dòng 84-88: `/** Panel Thông tin — nội dung hiển thị khi bấm mục "Thông tin"… @param props… @returns phần tử jsx. */` → **mồ côi** (khối này không đứng trên khai báo nào; `AboutPanel` đã có JSDoc riêng ở dòng 104-108).
  - dòng 89-94: `/** Panel Thông tin — port TRUNG THÀNH từ galaxy-code/src/info.ts … */` → đứng ngay trên `const AUTHOR` (dòng 95), tức **mô tả sai đối tượng** (tả panel, không tả hằng `AUTHOR`).
- Vì sao **không** tính vi phạm (b): luật chỉ đòi "mọi function/hook/component **export** đều có mô tả" — `AUTHOR` là hằng nội bộ **không export**, và mọi export của tệp (`SECTION_ID`) đều có doc. Tuy vậy đây là **nợ tài liệu thật** vì người đọc bị dẫn sai.
- **Đề xuất sửa:** xoá khối 84-88 (trùng lặp); viết lại khối 89-94 thành: `Bảng tác giả ĐÓNG BĂNG (tên · email · website) — nguồn galaxy-code/src/info.ts AUTHOR. Nhận: không. Trả: hằng read-only.` (giữ 1 dòng ghi chú port).

### 3.6. L2 — (b) Lưu ý: "Nhan:/Tra:" không dấu
- **Tệp:** `packages/client/ui-settings-general/src/items.ts` — dòng 58-59, 94-95, 108-109 (ví dụ `*   Nhan: deps do plugin.ts cap.` / `*   Tra: component hop le cho slots.register.`)
- Vì sao vẫn ĐẠT: cổng `lint:jsdoc` nhận diện qua nhánh "mô tả dài ≥ 45 chữ cái" nên **xanh**, và tinh thần luật (nói rõ làm gì/nhận gì/trả gì) **đã đạt**.
- **Rủi ro:** nếu ai rút gọn mô tả xuống dưới 45 chữ, cảnh báo NHẬN/TRẢ sẽ bật (và đỏ khi chạy `--strict`).
- **Đề xuất:** đổi sang `Nhận:` / `Trả:` cho khớp quy ước chung của repo (không bắt buộc).

## 4. Ghi chú về 2 tệp SINH TỰ ĐỘNG

`packages/client/locale/src/locales-vi.ts` (597 dòng) và `packages/client/locale/src/locales-vi-stock.ts` (306 dòng):

- Header **đúng cấu trúc** (đủ 5 trường, đúng thứ tự) do `tools/locale/gen-vi.ts:256-268` sinh ra → **ĐẠT (a)** theo đúng chỉ đạo của Lead.
- Mỗi export đều có JSDoc máy sinh **có cả Nhận/Trả** (dòng 279-283 của `gen-vi.ts`), ví dụ `locales-vi-stock.ts:9-13`:
  `Từ điển tiếng Việt của namespace "chat" … Nhận: không. Trả: bảng khoá → chuỗi hiển thị tiếng Việt.` → **ĐẠT (b)**.
- Ngày `modify date` vẫn 18/10/2026 vì bị hard-code — **đã tính là V3** ở `gen-vi.ts:262` (không nhân đôi vi phạm cho 2 tệp sinh).
- Không có màu/số literal (thuần dữ liệu chuỗi) → **ĐẠT (d)**.

## 5. Mục 15 của danh sách: `packages/client/ui-settings-general/src/parts/` đã chuyển ra

- `ls -d packages/client/ui-settings-general/src/parts` → **không tồn tại** (đúng như task ghi: đã chuyển ra khỏi gói).
- Không còn `import` nào trỏ tới `parts/` trong gói (`grep -rn 'parts/'` trên `src/` + gói → 0 kết quả) ⇒ không có tham chiếu gãy.
- `src/` hiện có 21 tệp (`badge.ts … types.ts`; `items.ts` import `./types.ts` — tệp này **tồn tại**, 4.760 byte) ⇒ hợp lệ.

## 6. Bảng việc cần làm (đề xuất, KHÔNG tự sửa)

| Ưu tiên | Việc | Tệp · dòng | Cách sửa | Rủi ro nếu bỏ |
|---|---|---|---|---|
| Cao | V1 sửa ngày header | `packages/client/locale/src/plugin.ts:5` | `17/10/2026` → `07/11/2026` | Header sai luật (a) ở tệp sửa nhiều nhất trong phiên |
| Cao | V2 sửa ngày header | `tools/locale/gen-vi.ts:5` | `18/10/2026` → `07/11/2026` | Header sai luật (a) |
| Cao | V3 bỏ hard-code ngày | `tools/locale/gen-vi.ts:262` | nhận ngày qua tham số/hằng; sinh lại `--only=locale` | Mọi lần sinh lại, header lại cũ ⇒ lỗi (a) tái diễn |
| Trung bình | V4 thay 2 màu literal | `settings-about/src/client.ts:130,132` | token `--dsw-*` hoặc 1 biến CSS `--gbh-zalo-card-bg` | Vi phạm luật (d); lệch theme sáng/tối |
| Trung bình | V4 gom 18 số literal | `settings-about/src/client.ts:114-143` | CSS Module / hằng `STYLES` | Vi phạm luật (d) tiếp diễn |
| Thấp | L1 dọn JSDoc mồ côi | `settings-about/src/client.ts:84-99` | xoá khối 84-88, viết lại doc `AUTHOR` | Người đọc hiểu sai đối tượng được mô tả |
| Thấp | L2 thống nhất "Nhận:/Trả:" | `ui-settings-general/src/items.ts` | đổi "Nhan:/Tra:" → có dấu | Chỉ là rủi ro khi mô tả bị rút ngắn |

## 7. Phụ lục — bằng chứng thô

**Số dòng (wc -l, đo 2026-11-07 11:15):**

```
  121  packages/client/ui-settings-general/src/items.ts
  198  packages/client/settings-about/src/client.ts
   44  packages/client/settings-about/src/locales.ts
  275  packages/client/locale/src/plugin.ts
  306  packages/client/locale/src/locales-vi-stock.ts
  597  packages/client/locale/src/locales-vi.ts
  328  tools/locale/gen-vi.ts
  130  tools/dev/dom-text.ts
  114  docs/GBH-P4-PHIEN-07-11-2026.md   (đang được Lead cập nhật lúc đo — mtime 11:14:57)
  247  docs/GBH-P4-RA-CHUOI-ANH.md
  308  tools/locale/gbh-locale-vi-manual.json
   30  packages/client/ui-agent-preset/locale/vi-chrome.json
  112  packages/client/ui-settings-models/locale/vi-chrome.json
   87  packages/host/session/package.json
   98  packages/host/llm/package.json
```

**mtime 15 tệp (chứng minh đều sửa trong phiên 07/11/2026):** 10:19:41 (items.ts, client.ts, locales.ts) · 10:46 (2 package.json host) · 10:51–10:53 (manual.json, plugin.ts, gen-vi.ts, locales-vi*.ts) · 11:06–11:07 (ui-settings-models vi-chrome, dom-text.ts, 2 tệp .md) · 11:14:57 (GBH-P4-PHIEN — Lead cập nhật tiếp).

**`git diff --stat` (5 tệp có trong git):**

```
 packages/client/locale/src/locales-vi.ts         | 112 +++++++++++++++++++++++
 packages/client/locale/src/plugin.ts             |  45 ++++++++--
 packages/client/settings-about/src/client.ts     |   9 +-
 packages/client/settings-about/src/locales.ts    |  16 ++--
 packages/client/ui-settings-general/src/items.ts |  49 ++++------
```

**Kiểm header từng tệp (5 trường, đúng thứ tự) — script tự viết:**

```
items.ts                        author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
settings-about/client.ts        author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
settings-about/locales.ts       author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
locale/plugin.ts                author=1 email=1 create=1 modify 17/10/2026 desc=1   -> SAI NGÀY (V1)
locale/locales-vi-stock.ts      author=1 email=1 create=1 modify 18/10/2026 desc=1   -> ĐẠT* (V3)
locale/locales-vi.ts            author=1 email=1 create=1 modify 18/10/2026 desc=1   -> ĐẠT* (V3)
tools/locale/gen-vi.ts          author=1 email=1 create=1 modify 18/10/2026 desc=1   -> SAI NGÀY (V2)
tools/dev/dom-text.ts           author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
docs/GBH-P4-PHIEN-07-11-2026.md author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
docs/GBH-P4-RA-CHUOI-ANH.md     author=1 email=1 create=1 modify 07/11/2026 desc=1   -> ĐẠT
```

**Quét luật (d) — không Tailwind, không hex ngoài 1 tệp:**

```
grep hex/rgb/hsl  -> chỉ settings-about/src/client.ts:130 (#3f5876) và :132 (#fff)
grep Tailwind    -> 0 kết quả (không có utility class nào trong 8 tệp)
token --dsw-*    -> items.ts:54 (--dsw-alias-label-secondary, --dsw-alias-border-l2) · client.ts:125 (--dsw-alias-brand-primary)
```

**Kiểm JSDoc export (31 dòng `export` trong 8 tệp .ts):** mọi `function/const arrow/interface/type` export đều có khối JSDoc ngay trên; riêng `export {}` (client.ts:197, dom-text.ts:130) là marker module nên không cần mô tả. Cổng `lint:jsdoc --strict` trên 8 tệp: **0 vi phạm · 0 cảnh báo**.

**Ngoài phạm vi 15 tệp (ghi để Lead cân nhắc, không phải vi phạm 4 luật):**
- `packages/client/ui-settings-general/src/locales-vi.ts:43` còn khoá `"general.currentVersion": "Phiên bản hiện tại: {version}"` — sau khi xoá hàng "Phiên bản hiện tại" (phiên này) khoá này **có thể là khoá chết** (không còn nơi đọc). Tệp không nằm trong 15 tệp nên tôi không kết luận vi phạm, chỉ nêu.
- `packages/client/settings-about/src/client.ts` còn nhắc `versionLine()/infoLines()` trong chú thích nguồn (dòng 91-92) — đúng vai trò "ghi nguồn port", không phải mã chết.

---

**Kết luận:** luật (b) và (c) **ĐẠT** toàn bộ 15 tệp; luật (a) có **3 vi phạm** (2 header sai ngày + 1 chỗ hard-code ngày trong generator); luật (d) có **1 tệp vi phạm** (`settings-about/src/client.ts`, 20 vị trí literal, có sẵn từ trước). Tất cả đều sửa được cục bộ, **không cần nới ngưỡng hay thêm miễn trừ** cho luật (c). Không tệp nào trong 15 tệp bị tôi sửa.
