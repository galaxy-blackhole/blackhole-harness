<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc PHỤ LỤC của docs/tien-do/chu-ky-tester.md — tách ra để giữ luật ≤1000 dòng/tệp (cổng file-length). Chứa các mục AUDIT/TỔNG HỢP/GHI CHÚ không có dòng chữ ký nào; KHÔNG chứa chữ ký tester.
-->

# PHỤ LỤC sổ chữ ký TESTER (tách 08/11/2026 vì tệp chính vượt 1000 dòng)

Tệp chính: `docs/tien-do/chu-ky-tester.md` (giữ toàn bộ DÒNG CHỮ KÝ). Tệp này giữ nguyên văn các mục chẩn đoán/audit đã tách, đúng thứ tự cũ.

## DANH SÁCH ĐỦ 3 CHỮ KÝ — bản 05:13 (66 gói, đã trừ 14 gói review TRA LAI)

client/client-hmr · client/connection · client/file-upload · client/locale · client/product-analytics · client/resources · client/settings-about · client/shortcuts · client/ui-agent-preset · client/ui-agent-team · client/ui-approval · client/ui-brand · client/ui-brand-official · client/ui-open-in-app · client/ui-permission · client/ui-primitives · client/ui-reference · client/ui-session-delete · client/ui-settings-plugins · client/ui-settings-web-search · client/ui-sidebar · host/account-controller · host/cordis · host/cordis-plugin-group · host/cordis-plugin-include · host/cordis-plugin-loader · host/cordis-plugin-timer · host/cosmokit · host/file-reference · host/file-reference-local · host/fs-observation-policy · host/host-directory-picker-native · host/image-offload · host/jobs-local · host/mcp-resources · host/plugin-market-index · host/ptc-runtime · host/pwsh-local · host/sandbox-local · host/schemastery · host/scope · host/session-checkpoint-policy · host/session-delete · host/session-format · host/session-format-catalog · host/session-format-v0-to-v1 · host/session-format-v1-to-v2 · host/session-format-v2-to-v3 · host/session-persistence · host/speech-to-text-phowhisper · host/storage-json · host/timer · host/tool-skill · host/tool-str-replace-editor · host/tool-todo · host/tool-workspace-dependencies · host/tool-worktree · host/tools · host/typert-protocol · host/typert-registry · host/util-code-language · host/util-crypto · host/util-time · host/web-runtime · host/web-search-deepseek · host/web-startup

### ⚠️ KIỂM LOCALE HÀNG LOẠT 66 GÓI (05:14) — 2 gói THIẾU locale, TẠM TREO hiệu lực tester

Cách kiểm: đọc `gbh.provenance.stock` của từng gói → so thư mục `locales` của stock trong `apps/host/node_modules/<stock>/locale` với `packages/<tầng>/<gói>/locale`.

| gói | bằng chứng | kết luận |
|---|---|---|
| host/cordis-plugin-timer | stock `@deepseek-ai/cordis-plugin-timer` CÓ `locale/{en.json 41 B, zh.json 122 B}`; gói ta **KHÔNG có thư mục locale**, nhưng `package.json:16` vẫn export `./locale/*.json` (export trỏ hư). Test hiện có (`tests/host/cordis-plugin-timer.test.ts`) chỉ so `lib/` byte-identical + package.json nên **không bắt** thiếu locale. | **TẠM TREO** chữ ký tester — cần dev chép `locale/{en,zh}.json` BYTE-IDENTICAL từ stock rồi tôi chạy lại. |
| host/tools | stock `@deepseek-ai/dsh-tools` CÓ `locale/{en.json 41 B, zh.json 125 B}`; gói ta **KHÔNG có locale**, `package.json:18` vẫn export `./locale/*.json`. | **TẠM TREO** — cùng cách sửa. |

⇒ Số gói ĐỦ 3 CHỮ KÝ **sẵn sàng backup: 64** (66 − 2), cho tới khi 2 gói trên được bổ sung locale và tôi ký lại.
Ghi chú: 11/66 gói trong danh sách không khai `gbh.provenance.stock` nên không đối chiếu được locale theo provenance — với các gói này tôi dựa vào test 000e của gói (nếu có).

## LỖ HỔNG TEST (danh sách ca cần bổ sung — Lead yêu cầu ghi tại đây)

| # | tệp test | lỗ hổng | ca cần thêm |
|---|---|---|---|
| 1 | `tests/host/cordis-plugin-timer.test.ts` · `tests/host/tools.test.ts` | **KHÔNG có ca 000e**: test chỉ so `lib/` byte-identical + `package.json`, nên gói THIẾU `locale/` (trong khi stock CÓ) vẫn XANH. Đây là lỗ hổng đã để lọt 2 gói tới sát giờ đóng băng. | Ca "000e — stock có `locale/` ⇒ ta phải có `locale/` với CÙNG tên tệp và sha256 từng byte", cộng đối chứng âm: xoá 1 tệp trong `packages/<gói>/locale/` ⇒ test PHẢI đỏ; và ca "`package.json` export `./locale/*.json` thì thư mục `locale/` phải tồn tại" (bắt export trỏ hư). |
| 2 | `tests/host/sdk-jsonrpc-server.test.ts:41-52` | Ca "tập export runtime khớp stock" bọc `try/catch`: nếu `import` ném thì rơi xuống nhánh chỉ so văn bản và vẫn XANH ⇒ có thể pass dù module không nạp được. | Bỏ `try/catch` (hoặc assert đã nạp thành công trước khi so). |
| 3 | `tests/host/session-delete.test.ts` | Không ca nào dựng `SessionDeleteService(ctx)` để kiểm `@Remote("delete")` (endpoint `sessionDelete/delete` là cơ chế giao hàng chính); thiếu 3 ca lỗi. | Thêm ca `@Remote` + 3 ca lỗi: delete-unavailable / delete-not-found / delete-ambiguous. |
| 4 | `tests/host/schemastery.test.ts:50-52` | Comment nói loại `types/index.d.ts` khỏi so byte vì "khác có chủ đích", nhưng 2 tệp trùng khít 211 dòng / 12.506 B ⇒ comment + dòng loại trừ đã lỗi thời. | Bật lại phép so byte cho `types/index.d.ts`. |

_(4 mục trên: #1 do TESTER phát hiện khi kiểm locale hàng loạt 66 gói; #2–#4 do REVIEW (ra-soat) phát hiện khi đọc mã — đã chép lại để Lead giao việc bổ sung.)_

## ⚠️ QUÉT LOCALE TOÀN BỘ 175 GÓI ĐÃ KÝ (05:16) — TẠM TREO thêm 8 gói

Phương pháp: đọc `gbh.provenance.stock` của từng gói → so `apps/host/node_modules/<stock>/locale` với `packages/<tầng>/<gói>/locale` (tên tệp + sha256). Kết quả: **156 gói kiểm được theo provenance · 147 OK · 9 lỗi** (1 gói product-telemetry-otel đã bị review TRA LAI trước đó) · 19 gói không khai provenance (dựa vào test 000e của gói).

| # | gói | bằng chứng | trạng thái |
|---|---|---|---|
| 1 | host/experimental-speech-to-text | stock `@deepseek-ai/dsh-experimental-speech-to-text` có `locale/{en,zh}.json`; gói ta KHÔNG có `locale/` | **TẠM TREO** chữ ký tester |
| 2 | host/session | stock `@deepseek-ai/dsh-session` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 3 | host/token-meter | stock `@deepseek-ai/dsh-token-meter` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 4 | host/host-webserver | stock `@deepseek-ai/dsh-host-webserver` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 5 | host/llm | stock `@deepseek-ai/dsh-llm` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 6 | host/permission-presets | stock `@deepseek-ai/dsh-permission-presets` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 7 | host/user-approval | stock `@deepseek-ai/dsh-user-approval` có `locale/{en,zh}.json`; ta KHÔNG có | **TẠM TREO** |
| 8 | host/web-app | stock `@deepseek-ai/dsh-web-app` có `locale/{en.json, zh.json, startup}`; ta KHÔNG có | **TẠM TREO** |
| 9 | host/product-telemetry-otel | như trên (đã review TRA LAI trước đó) | giữ TRA LAI |

Cách sửa (giống 2 gói vừa xong): chép `locale/` **BYTE-IDENTICAL** từ `apps/host/node_modules/<stock>/locale` (không sửa tay, không tự dịch lại en/zh) → tester kiểm sha256 + chạy test của gói → ký lại. Gói nào stock có thêm thư mục con (vd `web-app/locale/startup`) thì chép cả cây.

## PHỤ LỤC — bảng sha256 locale 10 gói Lead chép + host-webserver (05:19)

Sinh bằng script đệ quy (`/tmp/sha-table10.ts`), so từng tệp với `apps/host/node_modules/<stock>/locale`.

| gói | tệp locale | B | sha256 (ta) | sha256 (stock) | kết quả |
|---|---|---|---|---|---|
| host/account-platform | `en.json` | 61 | `58aad9c4a2d7df9bd8ccba05443ba3c1e07c061c77fcd551dc94ff4d99be6852` | `58aad9c4a2d7df9bd8ccba05443ba3c1e07c061c77fcd551dc94ff4d99be6852` | KHỚP |
| host/account-platform | `zh.json` | 132 | `0811469700d0d51ae4b12fdcc23bbf46a23a8f52f822037a59220fefdbfa24e7` | `0811469700d0d51ae4b12fdcc23bbf46a23a8f52f822037a59220fefdbfa24e7` | KHỚP |
| host/web-app | `en.json` | 43 | `fb54a52d363b9326f7a766f404a34caa8beaf5b3a0002f7455ae2ccd73b62a13` | = ta | KHỚP |
| host/web-app | `startup/en.json` | 51 | `1215423a99cf15ca80d3cc5bdd1d1c796eaf541ff33f7a1e7f48ad4a8a214fd4` | = ta | KHỚP |
| host/web-app | `startup/zh.json` | 52 | `2d774916a08b3c7d5ce21269c31b8388d07b2068a27b7c5876330a7523ee09c4` | = ta | KHỚP |
| host/web-app | `zh.json` | 152 | `5620c558d8f6bb2b58ad4f8f910f3920a645e304f9203522a96a1a676b52dbca` | = ta | KHỚP |
| host/user-approval | `en.json` | 49 | `f83d9ad967cb3e6174a4424dc5fca9849dbe68f2057ceaf0e4926b389bce1f7b` | = ta | KHỚP |
| host/user-approval | `zh.json` | 137 | `c09baf56ed75193106e8430a857f463019b43130b65ba00d910ef43e105d503b` | = ta | KHỚP |
| host/permission-presets | `en.json` | 54 | `2e9a65becac1fad846c4c8ba73b0a99ea99b48c8049b5ac2a2c3279b040cf18d` | = ta | KHỚP |
| host/permission-presets | `zh.json` | 152 | `1ab700634fa535ea5169222de252c2932c884be7a49d80da0e93a4338a86de29` | = ta | KHỚP |
| host/llm | `en.json` | 39 | `e791c79da2f5f24d98e39f118b76a26be6b3114e588acb58ad5bfe9d8dfcbd2f` | = ta | KHỚP |
| host/llm | `zh.json` | 122 | `84b323d718b48a1d8350c9bf85c58de9b407c421a574d4e778a96f5681fdf113` | = ta | KHỚP |
| host/product-telemetry-otel | `en.json` | 58 | `b40f439f3efe522bbc238ffb77c2d057d5638397a5d8ee7e40417d27327f0cb5` | = ta | KHỚP |
| host/product-telemetry-otel | `zh.json` | 155 | `e14550e4d6aefaa1d5c5bf8741b0ce0a73806f2683a1abafb38fa37aeeed38b1` | = ta | KHỚP |
| host/token-meter | `en.json` | 47 | `be9695bb556f74ae93a2272d3b3b5139fbc8ebd43844f7820344f41fc467ccc9` | = ta | KHỚP |
| host/token-meter | `zh.json` | 144 | `7122aaf641afaecb82f6e71af61bc13ad9b9a85af4331758a50a9ebb59d1ef06` | = ta | KHỚP |
| host/subagent | `en.json` | 44 | `cd42d9a0320ce64bd9ec20713cc758a0e82acf4dbbc5655c625170b7bb8cac30` | = ta | KHỚP |
| host/subagent | `zh.json` | 140 | `70e28d769987f6c3cdfdd6f26bc93cd038134158a31dfe733a8ea070c2d18668` | = ta | KHỚP |
| host/agent-preset-registry | `en.json` | 57 | `51fedcb9bff819c17f5d5d77c4ade8d3a9f21f71f96eb63ce6a5b973156947d5` | = ta | KHỚP |
| host/agent-preset-registry | `zh.json` | 135 | `56f7a54b4711e8e6b159fb54beb318d9d5cf81051eb73beaa751eed7fa89471f` | = ta | KHỚP |
| host/session | `en.json` | 43 | `b201655c72e1dc61d393b46dae7bf5cb45463b8f94b2db390c98dc6f78210e28` | = ta | KHỚP |
| host/session | `zh.json` | 128 | `705afb5363274b498b805fb013311970793f9fc355dc1ad13995e69dc5a31ecf` | = ta | KHỚP |
| host/host-webserver | `en.json` | 45 | `ac266b30653884433cefa579038d25827a16b9ed1e2528b8234ffdd3e17ef87a` | = ta | KHỚP |
| host/host-webserver | `zh.json` | 120 | `6fc489ad3d9bae4d24ce9ad05fffbcc5cd70d6f1d33bd314bcbd2e04bfdf6c36` | = ta | KHỚP |

**24/24 tệp KHỚP** ⇒ 10 gói trên + host-webserver đều đạt 000e ở tầng nội dung locale.

## AUDIT `exports.*.types` CHO TOÀN BỘ 177 GÓI ĐÃ KÝ (10:40)

Cách kiểm: đọc MỌI subpath trong `exports` có trường `types`, kiểm tệp đích có tồn tại trên đĩa.

| chỉ số | số gói |
|---|---|
| Tổng đã ký tester | **177** |
| `types` trỏ tệp **TỒN TẠI** | **144** |
| `types` trỏ tệp **KHÔNG TỒN TẠI** (dangle) | **5** |
| Không khai trường `types` | 28 |

**5 gói dangle còn lại (đều CÓ `build.ts` nhưng build.ts KHÔNG sinh `.d.ts` — nó chỉ build `lib/index.js` và còn `rm(lib)` trước khi build):**

| gói | exports | tệp đích | build.ts sinh .d.ts? |
|---|---|---|---|
| host/file-reference-local | `.` | `./lib/types/index.d.ts` — KHÔNG có | KHÔNG |
| host/jobs-local | `.` | `./lib/types/index.d.ts` — KHÔNG có | KHÔNG |
| host/spill-local | `.` | `./lib/types/index.d.ts` — KHÔNG có | KHÔNG |
| host/tool-skill | `.` | `./lib/types/index.d.ts` — KHÔNG có | KHÔNG |
| client/connection | `.` | `./lib/types/index.d.ts` — KHÔNG có | KHÔNG |

Cách sửa (1 trong 2, giống cách Lead đã làm): **(a)** chạy `tools/gen-types.ts` cho 5 gói để sinh `lib/types/index.d.ts`; hoặc **(b)** trỏ `exports["."].types` → `./src/index.ts`.

**Đã HẾT dangle trong lượt này (kiểm lại 10:40, trước đó tôi báo ở 10:39):** host/persona · host/hmr · host/otel · host/mcp-resources · host/session-checkpoint-policy — nay `types` = `./src/index.ts` và tệp TỒN TẠI.

## AUDIT LẠI `exports.*.types` — **DANGLE = 0** (đo 2026-11-08 10:40:41 giờ máy)

| chỉ số | số gói |
|---|---|
| Tổng đã ký tester | 177 |
| `types` trỏ tệp **TỒN TẠI** | **149** |
| `types` trỏ tệp KHÔNG TỒN TẠI | **0** |
| Không khai trường `types` | 28 |

5 gói từng dangle trong ảnh chụp 10:40 đã được sửa NGAY trong phút đó (mtime `package.json` = 10:40:09–10:40:29 giờ VN) và nay đều trỏ `./src/index.ts` với tệp CÓ THẬT:
host/file-reference-local · host/jobs-local · host/spill-local · host/tool-skill · client/connection.

⇒ Lớp lỗi `exports.types` trỏ tệp không tồn tại: **đã đóng hoàn toàn trên 177 gói tôi đã ký**.

## TỔNG HỢP 10:41 — 103 gói đủ 3 chữ ký · 55 gói CHỜ REVIEW

| chỉ số | số gói |
|---|---|
| Dev đã ký | 281 |
| Review đã ký | 115 |
| Tester đã ký | 177 |
| Review TRA LAI | 25 |
| **ĐỦ 3 CHỮ KÝ (sẵn sàng backup)** | **103** |
| **Dev + Tester nhưng THIẾU review** | **55** |

**55 gói chờ review:** host/account-platform · host/agent-preset-registry · host/experimental-speech-to-text · host/persona · host/plan-mode · host/plugin-package-inventory-deepseek · host/repeat-tool-reminder · host/sandbox · host/sandbox-policy · host/sandbox-seam · host/session · host/session-format-v3-to-v4 · host/session-projection · host/session-projection-cache · host/session-title · host/session-title-llm · host/session-turn-outline · host/settings · host/shell-identity · host/skill-filesystem · host/spill-local · host/spill-policy · host/subprocess · host/terminal-bash · host/token-meter · host/tool-cordis · host/tool-fs · host/tool-fs-search · host/tool-jobs · host/tool-pwsh · host/tool-pwsh-persistent · host/tool-ralph · host/tool-session-query · host/tool-subagent · host/tool-subagent-control · host/tool-terminal · host/tool-workflow · host/tool-working-directory · host/typert-gateway · host/typert-loader · host/user-approval · host/user-questions · host/web · host/web-app · host/web-fetch-http · host/web-frontend · host/web-search-ollama · host/win32-process · host/workflow · host/workflow-ptc · host/working-directory · host/workspace · host/workspace-changes · host/worktree · tools/brand-rename

Ghi chú riêng: `host/spill-local` — tester đã ký (03:41, XANH) nhưng **review CHƯA TỪNG review**; review nói gói này ngoài hàng đợi-1 của họ ⇒ cần Lead giao review riêng.

**Độ tin cậy cột thời gian:** mọi mốc thời gian trong tệp này tôi lấy trực tiếp từ `date '+%H:%M:%S'` của máy (không ước lượng), nên cột `thời điểm` dùng được để đối chiếu.

## BẢNG ĐỐI CHIẾU ARTEFACT cho REVIEW (11:38) — tệp riêng để không phá luật ≤1000 dòng

Đã xuất `docs/tien-do/tester-sha-vendor.txt` (335 dòng) để REVIEW đối chiếu 2 chiều với `docs/tien-do/review-ky-chot.txt`:

- **A. VENDOR (src/*.ts RỖNG ⇒ phải byte-identical): 71 gói · KHỚP 71/71 · LỆCH 0** — mỗi dòng có `sha256(ta) | sha256(stock thật trong kernel) | khớp? | build.ts có cổng SHA? | có .debundled/parts?`.
- **B. REWRITE (có `src/*.ts`): 235 gói** — KHÔNG áp byte-identity (chỉ so hành vi/bề mặt ở test), ghi rõ số tệp src.
- **Không khai provenance: 26 gói** (không đối chiếu được theo stock).

**host/open-in-app** — lưu ý 2 tầng bằng chứng khác nhau:
- Tầng RUNTIME (tester đo): `Object.keys(require('packages/host/open-in-app/lib/index.js'))` = `[Config, apply, inject, name]` = **đúng stock**, MISS 0 / THUA 0; test `tests/host/open-in-app.test.ts` XANH (tôi đã ký tester 2 lần: 03:40 và 11:27).
- Tầng SRC/TYPE (review đo): R5 — thiếu tên trong bề mặt `src`/`.d.ts` so với stock ⇒ **review đang giữ TRA LAI** ⇒ chữ ký tester KHÔNG đủ điều kiện backup; chờ dev-3 sửa src rồi tôi chạy lại test + ký lại.

## BẢNG ARTEFACT — BẢN 2 (11:41) theo phản biện của review

Đã cập nhật `docs/tien-do/tester-sha-vendor.txt` (**bản 2, 372 dòng**), sửa đúng 3 điểm review nêu:

1. **Sửa lỗi đường dẫn**: bản 1 so cứng `lib/index.js` ⇒ SAI với `host/schemastery` (chỉ có `lib/index.cjs` + `lib/index.mjs` + `lib/types/`). Bản 2 so **TOÀN BỘ cây `lib/` từng tệp**, thêm cột **`tệp đã so`** + **`số tệp lib/`**. Kết quả schemastery: `lib/index.cjs` SHA `aca1c1a47c7b6034…` = stock, so 4 tệp ⇒ **KHỚP**.
2. **Không suy ra 'đã review' từ bảng sha**: đầu tệp đã ghi rõ *"bảng chỉ chứng minh artefact byte-identical, KHÔNG hàm ý gói đã được review/ký 3 chữ ký; quyền kết luận KÝ thuộc `chu-ky-review*.md` + danh sách chốt của Lead"*.
3. **Tách LỆCH có giải thích**: 71 gói vendor → **68 KHỚP toàn cây**; 3 gói lệch ở TỆP PHỤ (không phải phần lõi):
   · `host/gbh-experimental-session-inspector` — `lib/client.js` mang Δid (nửa client đổi id stock→GBH); `lib/index.js` KHỚP.
   · `host/permission-presets` — `lib/typert.host.*` + `lib/typert.remote-client.*` sinh lại theo id ta; `lib/index.js` KHỚP byte.
   · `host/product-telemetry-otel` — `lib/types/index.d.ts` sinh lại (gen-types); `lib/index.js` KHỚP byte.
   ⇒ Nếu chỉ so phần lõi `lib/index.js`: **71/71 gói vendor byte-identical**.

**host/open-in-app** — review xác nhận tôi đo đúng tầng runtime (`{name, inject, apply, Config}` = 4 tên như stock); TRA LAI của review đứng ở **R5-src**: ta 12 export vs stock **48**, lib 268 vs **1.404 dòng** ⇒ hai tầng không mâu thuẫn. Chữ ký tester của gói này **chưa đủ điều kiện backup** cho tới khi dev-3 sửa src.

## ĐỐI CHIẾU SỔ 3 BÊN (đo bằng máy, 15:29) — khớp 332/332

- Tổng gói trong `packages/`: **332**.
- TESTER: **332/332** (0 thiếu — sau khi ký `host/lazy-require`).
- DEV: **332/332** (0 thiếu; `host/message-feedback` ký bởi dev-denta với cột vai dị dạng `**ĐÃ KÝ (dev-denta ký)**`).
- REVIEW: **332/332** theo luật *dòng CUỐI mỗi gói trong từng sổ quyết định* — `host/session-inspector` KÝ ở `chu-ky-review-12.md:28` (review-3, 11:26, 'KY — R5 ĐÓNG'), `host/optional-session-title-all-prompts` dòng cuối là 'KÝ LẠI theo §2f — huỷ TRA LAI trước'.

**3 BẪY ĐỊNH DẠNG khi đếm sổ (tôi đã vấp cả 3, ghi lại để Lead đối chiếu cuối không bị lệch):**
1. Cột vai KHÔNG đồng nhất: `dev-1 (ký thay …)`, `**ĐÃ KÝ (dev-denta ký)**`, `review (KÝ LẠI theo §2f) — huỷ TRA LAI trước`, `review: **TRA LAI dev-3**` ⇒ lọc theo `^dev-\d+$`/`^review$` sẽ đếm THIẾU.
2. Ô tên gói có thể kèm hậu tố: `| host/session-inspector (kiểm lần 2) |` ⇒ so khớp tuyệt đối sẽ coi là 'chưa review'.
3. **Mốc thời gian giữa các sổ KHÔNG so được**: sổ review-2 có dòng tới `19:45` (lệch ~4h so với giờ thật), và trong `chu-ky-review.md` có dòng `11:15` được ghi SAU dòng `11:25` ⇒ phải dùng **thứ tự dòng trong sổ** (hoặc `review-ky-chot.txt`), KHÔNG sắp xếp theo timestamp toàn cục.


## [TESTER] P0 (prompt 200 nhưng 0 lượt) — ĐÃ ĐÓNG, ghi sổ kèm bằng chứng (08/11/2026 17:0x)

**Hai gốc đã xác định và đã vá trong ngày:**
1. `agent-loop` đòi cứng service `sessionPersistence` lúc apply ⇒ plugin không activate (`Error: agent-loop: thieu service 'sessionPersistence'` ⇒ `dsh: startup failed: 1 required plugin did not activate`). Bản CŨ (ép kiểu trần) thì `kick()` ném TypeError rồi **bị nuốt** ⇒ prompt 200 mà không lượt nào chạy.
2. `packages/host/session/package.json` khai `"./fork".default = "./src/fork.ts"` (runtime trỏ tệp `.ts`), trong khi bản mount chỉ ship `lib/` ⇒ `gbh-api-session-controller` chết `ERR_MODULE_NOT_FOUND` ⇒ **`sessionController` không được cấp** ⇒ `/api/session/*` = **404** ⇒ không có phiên/agent. (Lớp lỗi này KHÔNG lộ trong repo vì repo có `src/`.)

**Bằng chứng TESTER đo end-to-end (giao diện thật + log sự kiện phiên):**
- `POST /api/session/create` → `{"ok":true,"value":{"sessionId":"session-29959c7d-…","agentPreset":"standard"}}`
- `POST /api/session/prompt` → 200 · log host: `[agent-loop] send … wakeup: true phase: idle` + `[agent-loop] kick … pending: 1` · **không** `turn failed`
- `session.v4.jsonl.zstd`: 18.936 B → 30.806 B; chuỗi `turn/start=2 · step/start=2 · assistant/message=2 · step/end=2 · turn/end=2 (completed)` (turn 1 trả `4`, turn 2 hoàn tất) ⇒ **2 lượt liên tiếp chạy được**, không phải ăn may
- UI: `Đã làm việc · Xong sau 2s · 4 · Đã dùng 12.5K tok`; DOM có cả `2+2` và `4`

**Quét lớp lỗi `exports.*.default` trỏ `.ts` (gói CÓ THỂ mount): còn 2 điểm NGỦ ĐÔNG** — `host/agent-preset-registry` `./types` + `./display` (0 consumer runtime; chỉ có tham chiếu **type-only** ở `api-remotes` và `.d.ts`, dùng **id stock**). `packages/tools/brand-rename` cũng trỏ `.ts` nhưng **không được mount** (`grep` trong `bundle*/cordis.patch.yml` = 0) ⇒ vô hại.

## [TESTER] Bài học r28 (hồi quy do dọn chẩn đoán) — 08/11/2026 17:08

- Script dọn dòng theo chuỗi marker (`CHẨN ĐOÁN TẠM`) đã xoá **cả một câu lệnh thật** (`this.services.agents.withInitiator(this, () => this.kick()).then(...)`) vì comment marker nằm CÙNG dòng ⇒ `wakeDriver()` đặt pha `running` rồi không gọi `kick()` ⇒ inbox có message, **không có `turn/start`**, UI treo 'Đang suy nghĩ…'.
- **Không cổng tĩnh nào bắt được**: `tsc` 0 · `file-length` 0 · `jsdoc` 0 · test 26/0 đều XANH trên mã sai. Chỉ phép đo HÀNH VI (mở app → gửi prompt → đọc `session.v4.jsonl.zstd`) mới lộ.
- Quy tắc rút ra cho tester: (1) chẩn đoán tạm phải nằm trên DÒNG RIÊNG, không chung dòng với câu lệnh; (2) sau mỗi lần dọn chẩn đoán phải đo lại hành vi, không tin cổng tĩnh; (3) tiêu chí xác nhận lượt chạy = `turn/end completed` trong file phiên + UI hiện câu trả lời.
- Đã xác nhận lại sau fix (host r29): `session/create ok:true` → prompt 200 → `assistant/message "6 + 6 = **12**"` → `turn/end {completed}` → UI `Xong sau 2s · 6 + 6 = 12`.


## [TÁCH KHỎI SỔ CHÍNH 08/11/2026 — giữ luật ≤1000 dòng] Ghi chú TÁI KÝ ĐỢT 2

### CHƯA TÁI KÝ (đợt 2) — không ký khống

| gói | lý do (kèm phần đã kiểm được) |
|---|---|
| **host/open-in-app** | **ĐỎ 5 test** — KHÔNG phải lỗi mã: `src/index.ts:165-166` nay NÉM khi thiếu seam `subprocess.resolveExecutable` (đúng chủ đích Lead duyệt), nhưng **harness test cũ** tại `tests/host/open-in-app.test.ts:55` dựng ctx GIẢ **không có seam đó** ⇒ 5 ca 'plugin open-in-app' đỏ. Nội dung mới đã kiểm: artefact có `windowsHide` ×1 + `scrubbedParentEnv` ×2 ✓, sha `98d863fb9f0b1bcf` **KHỚP backup 193213**. ** Cần 1 dòng sửa harness** (thêm seam giả `subprocess: { resolveExecutable: async (ten) => ten }` vào ctx giả) — ai sửa xong tôi chạy lại và ký ngay. |
| **host/plugin-manager** | Test XANH · sha `1f131d3350fd8207` **KHỚP backup 193213** · artefact **0 chuỗi `powered by dsh`**, có `quyTenBundle` ×7 ✓. **NHƯNG** lượt đo UI không mở lại được trang Plugin sau restart (menu 'Cài đặt' không trả `button[role=menuitem]`) ⇒ **chưa có bằng chứng UI '≤22 bundle'** ⇒ chưa ký. |
| **client/locale** | Test XANH · sha `bfa76e020d854da2`/`43466b6ab32484c9` **KHỚP backup 193213** · artefact có `Xoá phiên` ×1 · `Huỷ` ×7 · `Xoá vĩnh viễn` ×2 ✓. **NHƯNG** chưa mở được menu 'Xoá phiên' trên UI ⇒ chưa ký. |
| **client/ui-chat** | **Backup KHÔNG khớp artefact hiện tại**: `src/plugin.ts` mtime **19:32:52** (sau mốc backup 19:32:13); `lib/client.js` hiện tại **595.505 B** vs backup **595.705 B** ⇒ backup thiếu nội dung mới nhất. Artefact có `providerDisplayName` ×3 (đúng hướng bỏ hard-code) nhưng **phải backup lại + build lại** rồi mới ký. |

Ảnh lượt đo UI đợt 2: `/tmp/rk2-plugin.png` (màn hình sau khi thử mở trang Plugin — dialog KHÔNG mở, làm bằng chứng cho lý do chưa ký).

**`host/plugin-manager` — ĐO ĐƯỢC SỐ LIỆU NGƯỢC KỲ VỌNG ⇒ GIỮ 'CHƯA TÁI KÝ' + TRA LAI dev:**
- Mở trang Plugin bằng click thật vào nav `Plugin` (KHÔNG dùng dialog Cài đặt — đúng chỉ dẫn của Lead); trang render: `Cài đặt, bật và cấu hình plugin` · `Thêm plugin` · `Đã cài` · `Khám phá` · `Cài đặt plugin có sẵn`; DOM **0 chuỗi `powered by dsh`** (và 0 chuỗi `dsh` trong innerText) ✓.
- Gọi đúng API của gói từ trong trang (`POST /api/pluginManager/listBundles`, RPC như client): **HTTP 200, 160.425 B, `result.value` = 34 phần tử**, trong đó **20 gói còn tên stock `@deepseek-ai/…`** (vd `dsh-subagent-claude-code`, `dsh-subagent-codex`, `dsh-acp-app`, `dsh-base`, `dsh-experimental-agent-team-profile`, …).
- **Kỳ vọng của Lead: ≤22 gói** ⇒ thực tế **34** (vượt 12) và **20 tên stock chưa lọc** ⇒ bộ lọc `quyTenBundle`/`bundleMetaVi` CHƯA có tác dụng trên API này. Không ký.

**Ca khoá hành vi sau khi đổi (giữ nguyên tinh thần, chỉ đổi CHỖ ném):**
- `expect(() => apply(ctxThieuSeam, Config({}))).not.toThrow();` ⇒ thiếu seam thì `apply()` vẫn đăng ký đủ 3 route (không chết cả plugin như DSH).
- `expect(() => resolveInternals({})).toThrow(/thieu seam subprocess\.resolveExecutable/);` ⇒ hàm thuần **fail-loud** đúng chỗ như stock.
- Đã thêm `resolveInternals` vào import của tệp test; harness giả vẫn cấp seam `subprocess` để các ca route chạy như kernel thật.



## [TÁCH KHỎI SỔ CHÍNH 08/11/2026 — prose, không có dòng chữ ký nào] Ghi chú chi tiết

<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc CHỮ KÝ TESTER: mỗi dòng = một gói đã chạy TEST LIÊN QUAN và XANH (hoặc ghi TRA LAI dev-N kèm 20 dòng log khi ĐỎ).
      Quy ước định dạng ở docs/GBH-QUY-TAC-PACKAGE.md §2 (dòng chữ ký 5 cột).
-->
Chỉ ký khi gói đã có: (1) chữ ký dev trong `chu-ky-dev-N.md`, (2) chữ ký review trong `chu-ky-review.md`.
Chạy TUẦN TỰ từng gói (tối đa 2 lệnh `bun test` song song). KHÔNG sửa mã, KHÔNG revert gói.
Nhóm 2A (03:18:33 → 03:18:39, log `/tmp/lo2a.log`, exit 0, `68 pass / 0 fail / 1037 expect`, 10 tệp / 5,82 s):
```
bun test tests/client/ui-brand.test.ts tests/client/ui-brand-official.test.ts tests/client/ui-settings-plugins.test.ts \
  tests/client/ui-settings-web-search.test.ts tests/client/ui-reference.test.ts tests/client/ui-session-delete.test.ts \
  tests/host/util-crypto.test.ts tests/host/util-time.test.ts tests/host/util-code-language.test.ts tests/host/schemastery.test.ts
```
Nhóm 2B (03:18:44 → 03:18:57, log `/tmp/lo2b.log`, exit 0, `166 pass / 0 fail / 523 expect`, 10 tệp / 12,29 s):
```
bun test tests/host/sandbox-windows-acl.test.ts tests/host/sdk-protocol.test.ts tests/host/plugin-market-index.test.ts \
  tests/host/product-telemetry-otel.test.ts tests/host/sdk-jsonrpc-server.test.ts tests/host/session-format-catalog.test.ts \
  tests/host/session-format-cluster.test.ts tests/host/ptc-runtime.test.ts tests/host/session-delete.test.ts \
  tests/host/session-persistence-jsonl.test.ts
```
Build (03:19:06 → 03:19:07, tuần tự TỪNG gói, log `/tmp/build-<tầng>-<gói>.log`, tất cả exit 0):
`host/scope` · `host/pwsh-local` · `host/session-format-v0-to-v1` · `host/session-format-v1-to-v2` ·
`host/session-format-v2-to-v3` · `host/session-format-v3-to-v4` · `host/package-manifest` · `client/settings-about` (outDir tạm `/tmp/gbh-build/settings-about`).
Máy tải cao ⇒ mọi lệnh chạy TUẦN TỰ (mỗi lần 1 lệnh `bun test`, build từng gói). Lượt này: **0 gói ĐỎ**.
KHÔNG chạm `locale/` của bất kỳ gói nào (tôn trọng lệnh ĐÓNG BĂNG LOCALE 03:20 của Lead); build chỉ ghi `lib/` (gitignore) hoặc thư mục `/tmp`.<!-- LƯỢT 03:36 — ký TRƯỚC review theo chốt của Lead (03:34): Lead CHỈ backup khi đủ 3 chữ ký. -->
<!-- LƯỢT 03:30 — sau khi Lead khôi phục locale; ký tiếp theo chốt "test trước review". -->
<!-- LƯỢT 03:38 — nhóm E + cordis-client-runner (đã gỡ chặn nhờ dev-4 trả peer id stock). -->
**6 gói đang khai peer id GBH (trái §2e, quét 03:38):** host/plugin-inventory · host/api-workspace-controller · host/session-delete · host/api-session-controller · host/acp · host/account-controller.
<!-- LƯỢT 03:39 — nhóm F (14 tệp XANH 206/0). -->
- `tests/host/sdk-jsonrpc-server.test.ts:41-52`: ca so tập export bọc try/catch ⇒ module không nạp được vẫn có thể XANH.
- `tests/host/session-delete.test.ts`: thiếu ca dựng `SessionDeleteService(ctx)` kiểm `@Remote("delete")` + 3 ca lỗi (unavailable / not-found / ambiguous).
- `tests/host/schemastery.test.ts:50-52`: comment loại `types/index.d.ts` khỏi so byte đã lỗi thời (2 tệp trùng khít 211 dòng / 12.506 B) ⇒ nên bật lại phép so.
<!-- LƯỢT 03:40 — nhóm G (16 tệp XANH 245/0). -->
<!-- LƯỢT 03:41 — nhóm H (16 tệp XANH 210/0). -->
<!-- LƯỢT 03:41 — nhóm I (14 tệp chạy được: 230 pass / 1 fail là host/workspace vì locale vừa bị xoá lại). -->
Lúc 03:26 đã sạch (0 tệp `D`), đến **03:41 lại có 24 tệp locale bị xoá trên 12 gói**: host/agent-default-model · host/goal · host/sandbox · host/sandbox-policy · host/session-projection · host/session-projection-cache · host/session-title · host/settings · host/skill · host/storage-domain · host/system-prompt · host/workspace.
Nguyên nhân đã chứng minh: `apps/cli/src/mount.ts:377-382` — `rmSync(<profile>/@galaxy-blackhole/gbh-X/locale)` ghi XUYÊN SYMLINK vào `packages/<tầng>/X/locale`, rồi `cpSync` thất bại vì nguồn vừa bị chính nó xoá. Lúc đo có **2 tiến trình đang chạy**: `bun run apps/cli/src/main.ts host --port 5439` (7 phút) và `bun run check:app` (1 phút 45) ⇒ mỗi lượt boot/check:app phá thêm vài gói.
**Hệ quả với chữ ký tester:** host/goal · host/settings · host/session-title · host/session-projection · host/sandbox-policy (tôi ký 03:30 khi vừa khôi phục XANH) NAY locale lại mất ⇒ **phải chạy lại test sau khi vá mount + khôi phục**; đừng backup các gói này trước khi tôi xác nhận lại.
<!-- LƯỢT 03:42 — nhóm J (9 tệp: 143 pass / 1 fail). -->
- Đã ký **169 gói** (sau lượt J), chạy **~20 lượt `bun test --timeout 60000` tuần tự**, mỗi lượt 8–16 tệp; tổng ~3.400 test đã chạy.
- **RÚT/HẾT hiệu lực theo review:** host/product-telemetry-otel · host/sandbox-windows-acl · host/sdk-protocol · host/sdk-jsonrpc-server.
- **CẦN KÝ LẠI khi dev sửa peer (§2e):** host/session-delete.
- **CẦN CHẠY LẠI sau khi vá mount + khôi phục locale:** host/goal · host/settings · host/session-title · host/session-projection · host/sandbox-policy · host/workspace · host/agent-default-model.
- **ĐỎ thật, TRA LAI dev-3:** host/llm-deepseek (provenance sai + locale thừa) · host/mcp-resources (@deepseek-ai/dsh-util-values trong gbh.peers nhưng thiếu peerDependencies).
- **Test/khai báo cần Lead quyết (không phải lỗi gói):** host/message-feedback (test liên gói stale) · host/plugin-inventory (peer id GBH).
<!-- LƯỢT 03:43 — mount.ts ĐÃ VÁ (03:37:18, hàm chepThuMucCon + trungNguon) ⇒ locale phục hồi; chạy lại 12 gói + 2 gói dev-3 sửa. -->
- ✅ **GỠ cảnh báo 'CẦN CHẠY LẠI'** cho 7 gói nêu lúc 03:41: goal · settings · session-title · session-projection · sandbox-policy · workspace · agent-default-model — đã chạy lại, 000e **XANH**.
- ✅ `apps/cli/src/mount.ts` mtime 03:37:18 có chốt thật: `chepThuMucCon()` + `if (trungNguon(dest, src)) return;` (so realpath, đích là symlink trỏ về nguồn thì bỏ qua) ⇒ không còn `rmSync` xuyên symlink. Locale đủ 12/12 gói (mỗi gói 2 tệp).
- ❌ **host/llm-deepseek: KHÔNG còn là lỗi gói — là TEST LỖI THỜI.** Bằng chứng: provenance nay = `@deepseek-ai/dsh-llm-deepseek-api-key`; stock đó **CÓ** locale và `locale/en.json` của ta **trùng sha256 từng byte** với `dsh-llm-deepseek-api-key/locale/en.json` (8aac55d34c6ff5d3 = 8aac55d34c6ff5d3). Nhưng `tests/host/llm-deepseek.test.ts:576` vẫn khoá nhánh cũ "stock KHÔNG có locale ⇒ ta CŨNG KHÔNG có locale" ⇒ đỏ. Cần Lead quyết: sửa test theo provenance mới (so byte với `dsh-llm-deepseek-api-key`), hoặc đổi provenance về `dsh-llm-deepseek` rồi xoá locale.
Nguồn: dev (261 gói trong `chu-ky-dev-*.md`) ∩ review (46 dòng vai `review`) ∩ tester (174 gói) = **43 gói**; đã trừ 11 gói review TRA LAI.
client/settings-about · client/ui-brand · client/ui-brand-official · client/ui-reference · client/ui-session-delete · client/ui-settings-plugins · client/ui-settings-web-search · host/cordis · host/cordis-plugin-group · host/cordis-plugin-include · host/cordis-plugin-loader · host/cordis-plugin-timer · host/cosmokit · host/file-reference · host/fs-observation-policy · host/mcp-resources · host/plugin-market-index · host/ptc-runtime · host/pwsh-local · host/sandbox-local · host/schemastery · host/scope · host/session-checkpoint-policy · host/session-delete · host/session-format · host/session-format-catalog · host/session-format-v0-to-v1 · host/session-format-v1-to-v2 · host/session-format-v2-to-v3 · host/session-persistence · host/tool-skill · host/tool-str-replace-editor · host/tool-todo · host/tool-workspace-dependencies · host/tool-worktree · host/tools · host/typert-protocol · host/typert-registry · host/util-code-language · host/util-crypto · host/util-time · host/web-runtime · host/web-startup
**11 gói review TRA LAI (KHÔNG backup dù có thể đủ dòng):** host/experimental-agent-team · host/experimental-tool-agent-team · host/fs-sandbox · host/pwsh-sandbox · host/time-context · host/session-telemetry-otel · host/tool-web · host/sandbox-windows-acl · host/sdk-protocol · host/product-telemetry-otel · host/sdk-jsonrpc-server.
**host/llm-deepseek:** giữ nguyên KHÔNG ký — review xác nhận 000e sẽ xanh nếu CẬP NHẬT TEST (không xoá locale), nhưng gói còn **R5/R6a CHO FIX** (src là api-key row, thiếu bề mặt adapter) ⇒ chưa ký review được.
<!-- LƯỢT 05:13 — HÀNG ĐỢI TESTER (tester-hang-doi-1.txt): host/account-controller. -->
**Hàng đợi tester 05:13:** `tester-hang-doi-1.txt` chỉ có 1 gói (host/account-controller) — đã ký; `tester-hang-doi-2.txt` không tồn tại. Đối chiếu lại toàn bộ chữ ký: **dev ∩ review − tester = 1** (đúng gói này) ⇒ không còn gói nào chờ tester. Số gói đủ 3 chữ ký: **66**.
**Còn TẠM TREO: `host/cordis-plugin-timer`** — lúc 05:15 vẫn chưa có `packages/host/cordis-plugin-timer/locale/` (dev-2 chưa chép). Chờ dev-2 xong sẽ kiểm sha + chạy `tests/host/cordis-plugin-timer.test.ts` rồi ký lại.
Đã đối chiếu thêm: cây `locale/` của 2 gói chỉ có `en.json + zh.json` đúng bằng stock (không thừa/thiếu tệp, không tạo `vi.json`). Hai gói này **chưa từng đóng băng** (không có dòng trong `SO-TIEN-DO.md`).
**CÒN TẠM TREO (5 gói):** host/session · host/token-meter · host/llm · host/permission-presets · host/web-app (+ host/user-approval đang **đã đóng băng** — chờ Lead mở lại).
Kiểm locale: script so **cả cây** `locale/` của ta với `apps/host/node_modules/<stock>/locale` (đi đệ quy, so sha256 từng tệp) ⇒ **cả 10 gói KHỚP** (web-app 4 tệp = en + zh + cây `startup` 2 tệp).
Đối chiếu nhanh quy mô: **214 gói** trong `packages/host/*/lib/types/index.d.ts` đã có tệp trên đĩa ⇒ lớp lỗi đúng là đã đóng phần lớn, chỉ 3 gói trên còn sót.
Trước đó (10:39) 3 gói này còn dangle `./lib/types/index.d.ts`; lúc 10:40–10:41 Lead đã trỏ sang `./src/index.ts` và tệp có thật ⇒ đủ điều kiện ký. Chạy lại test 3 gói: **42 pass / 0 fail**.
**Còn chặn (không ký): host/cordis-host-runner** — chuỗi `DSH restart` ở `src/service-support.ts:114` + `lib/index.js:1073` (chuỗi hiển thị ⇒ R4) + nợ re-export 10 type; types đã đạt nhưng mã chưa.
`lib/client.js` mtime **Nov 5 23:31:19** < các tệp `src/parts/*.ts` sửa hôm nay ⇒ test ném `artifact CU hon ma nguon` tại `tests/client/ui-schedule.test.ts:168`. Gói ĐÃ de-bundle nên `build.ts` không build đè; **dev phải chạy công cụ canon**:
`~/.bun/bin/bun run tools/debundle-client.ts packages/client/ui-schedule @deepseek-ai/dsh-client-ui-schedule @galaxy-blackhole/gbh-client-ui-schedule`
⇒ Cùng lớp với `client/ui-conversation` (lượt 1) ⇒ 2 gói de-bundle cần dev tái sinh artefact, sau đó tôi chạy lại.
**203 gói** trong repo nay có `exports["."].types = "./src/index.ts"` (đo 10:55). Mọi test kiểu `expect(ourManifest.exports).toEqual(stockManifest.exports)` sẽ ĐỎ vì stock ghi `./lib/types/index.d.ts`.
Các test đã đỏ vì lớp này:
- `tests/client/client-ui-directory-picker-browse.test.ts:463` (B2)
- `tests/client/client-ui-directory-picker-native.test.ts:321` (B3)
- `tests/host/api-session-controller.test.ts:562` (bề mặt export A/B)
⇒ Cần Lead chọn: (a) sửa các test cho phép `./src/index.ts` (hoặc so sau khi quy đổi), hoặc (b) trả 203 gói về `./lib/types/index.d.ts` + chạy `tools/gen-types.ts`, hoặc (c) ghi nhận là đỏ-tạm-do-chính-sách. Tôi KHÔNG trả các gói này cho dev vì không phải lỗi mã của họ.
**host/llm-deepseek** — vẫn 1 fail `luật 000e: stock KHÔNG có locale/ ⇒ ta CŨNG không có` tại `tests/host/llm-deepseek.test.ts` (~dòng 267 của log). Trạng thái: gói CÓ `locale/{en,zh}.json` trùng byte với `dsh-llm-deepseek-api-key` (provenance hiện tại) ⇒ **test pin theo stock CŨ**, cần cập nhật test theo provenance mới (review đã đồng ý hướng này). Không ký.
**12 gói build được (tuần tự, tất cả exit 0):**
**5 gói không có build.ts — xác nhận bằng kiểm cú pháp lib/*.js (vm.Script) + manifest + cây tệp:**
Ghi chú: `host/command-feedback` có thêm `locale/vi.json` (bản dịch vi của ta) ngoài `en/zh` — **en/zh vẫn KHỚP sha256 stock** (`758235488ee7078f`, `e4a937eed5c4d30e`) ⇒ hợp lệ (vi.json là của ta, không phải 000e).
**Đã sửa test (theo lệnh Lead, không phải tự ý):**
1. `tests/host/bundle-profile-patches.test.ts` — thêm nhánh cho `dsh-experimental-inspector-profile`: KHẲNG ĐỊNH entry `session-inspector` ĐANG bị gỡ (YAML parse ⇒ không có entry), còn ghi chú ngày `08/11/2026` + lý do + đường dẫn `docs/GBH-P4-DIEU-TRA-TERMINAL.md`; khi so 1:1 thì bỏ khối ghi chú ở bản ta và bỏ đúng entry đã gỡ ở bản gốc. KHÔNG bật lại entry.
2. `tests/host/api-session-controller.test.ts` — kỳ vọng `exports["."].types` đổi về `./lib/types/index.d.ts` (gói CÓ lib/types, đúng chính sách mới).
3. `tests/host/experimental-api-speech-to-text-harness.ts` — so `.` sau khi chuẩn hoá theo chính sách: CÓ lib/types thì lib/types, KHÔNG thì `./src/index.ts`.
4. `tests/host/llm-deepseek.test.ts` — ca 000e viết lại theo PROVENANCE HIỆN TẠI (`@deepseek-ai/dsh-llm-deepseek-api-key`): stock CÓ locale ⇒ ta phải chép byte-for-byte + khai export `./locale/*.json`.
Lệnh chung: `bun test --timeout 60000 tests/host/cordis-host-runner.test.ts tests/host/agent-loop.test.ts tests/client/ui-conversation.test.ts tests/client/ui-schedule.test.ts tests/client/ui-chat.test.ts tests/client/ui-trajectory.test.ts` → **102 test: 5 skip · 2 fail (đều của ui-schedule, mức NGUỒN)**.
**Nợ kỹ thuật của ui-schedule (ghi để không quên):** thiếu 2 tệp trong `packages/client/ui-schedule/src/parts/`: `00-requires.ts` và `plugin-surface.ts` (chính là `HANDWRITTEN_PARTS`). Hệ quả: `bun run build.ts` của gói sẽ NÉM lỗi cho tới khi khôi phục.
Lệnh: `bun test --timeout 60000 tests/host/llm-deepseek.test.ts tests/client/ui-plugin-market.test.ts tests/host/bundle-profile-patches.test.ts tests/host/bundle-extra-packages.test.ts` → **62 pass / 0 fail / 532 expect / 5,19 s**.
- `locale/en.json` của ta **LỆCH stock 1 từ**: ta `"title": "Git Worktree"` (143 B) vs stock `"title": "Git Worktrees"` (144 B) ⇒ đây là SỬA NỘI DUNG, không phải 'thiếu tệp'.
- `locale/zh.json` thiếu (stock có, 144 B).
- Stock **CÓ trong kernel** (`apps/host/node_modules/@deepseek-ai/dsh-experimental-tool-worktree/locale/{en,zh}.json`) ⇒ chép byte-identical được ngay.
⇒ **TẠM GIỮ chữ ký tester** cho tới khi Lead quyết: (a) trả `en.json` về đúng stock + chép `zh.json` (đúng 000e), hay (b) chấp nhận `"Git Worktree"` là đổi tên CÓ CHỦ ĐÍCH thì phải ghi ngoại lệ + cập nhật test.
Kiểm sha256 từng tệp với stock thật `apps/host/node_modules/@deepseek-ai/dsh-experimental-{auto-review,tool-worktree}/locale/` — **4/4 tệp KHỚP**; test bundle: **21 pass / 0 fail / 367 expect / 1,16 s**.
⇒ Hàng đợi-6 (38 gói) **hoàn tất 38/38**. Không còn gói nào bị treo vì locale.
**R4b — artefact byte-identical (cổng SHA), nợ rewrite src Phase C.**
Ghi chú theo chốt của Lead: các **id stock nằm bên trong artefact** là require NỘI BỘ của bản gốc (bằng chứng: artefact byte-identical với stock qua cổng SHA) ⇒ thuộc **§2d R4b (artefact nguyên văn)**, KHÔNG phải vi phạm R4. Nợ còn lại: **rewrite `src/` ở Phase C**.
⇒ 332/332 gói đủ điều kiện đóng băng (chờ dev-4 ký DEV + dev-denta/ra-soat ký REVIEW cho gói này).
**Lead chốt: KÝ kèm ghi chú** — *"R5 hoãn — bề mặt src hẹp có chủ đích; runtime khớp stock 4/4; nợ Phase C ~36 export resolver/shared"*.
Lý do chốt: tầng RUNTIME khớp tuyệt đối với stock + test XANH; phần thiếu nằm ở lớp resolver/shared — cùng lớp với `host/llm-deepseek` (Lead đã chốt "row API-KEY, lô riêng").
**Xác minh độc lập danh sách chốt của review** (đọc `docs/tien-do/review-ky-chot.txt` lúc 11:39): dòng 3 = `# TONG KY: 181 | TRA LAI: 0`; `host/open-in-app` nằm trong mục KÝ (dòng 131); mục "CON TRA LAI" rỗng.
⇒ **CUỐI PHIÊN: tester ký 332 gói · review KÝ 181 · 0 gói bị treo vì locale/types/artefact.**
Lệnh: `bun test --timeout 60000 tests/host/tool-fs.test.ts tests/client/ui-agent-preset.test.ts tests/client/ui-agent-preset-scope.test.ts` → **32 pass / 0 fail / 377 expect / 4,22 s**.
_(đính chính 11:56 — dòng cũ ghi nhầm `client/ui-agent-preset-scope` như một GÓI: **KHÔNG có package này**, chỉ có tệp `tests/client/ui-agent-preset-scope.test.ts` là test phụ của gói `client/ui-agent-preset` (XANH, 32 pass/0 fail cả lượt). Đã xoá dòng để số đếm gói không bị thổi lên.)_
**⚠️ R1 cần dev-5 sửa (không phải lỗi test):** `tests/host/tool-fs.test.ts` vừa được sửa hôm nay nhưng header còn `modify date 01/11/2026` ⇒ phải bump thành `08/11/2026` cho đúng luật R1. (`tests/client/ui-agent-preset.test.ts` đã đúng `08/11/2026`.)
**✔ ĐÃ ĐÓNG R1 (11:57):** dev-5 bump `tests/host/tool-fs.test.ts` → `modify date 08/11/2026`; tôi kiểm lại header đủ 5 trường đúng thứ tự và chạy lại `tests/host/tool-fs.test.ts` + `tests/client/ui-agent-preset.test.ts` = **31 pass / 0 fail / 370 expect / 3,95 s** ⇒ 2 gói `host/tool-fs` + `client/ui-agent-preset` XANH, chữ ký tester giữ nguyên hiệu lực.
**Ghi chú chốt (theo đề nghị của Lead):** *R5 — bề mặt hẹp CÓ CHỦ ĐÍCH: 0 consumer ngoài gói; 41 tên là helper nội bộ của bản gốc; đã port đủ 3 route + catalog.*
- **0 consumer**: `grep -rn 'gbh-open-in-app' packages apps/cli/src tests` (bỏ chính gói) = **RỖNG** ⇒ xác nhận độc lập với Lead.
- **Bề mặt RUNTIME của ta = stock**: `Object.keys(require('lib/index.js'))` — ta `[Config, apply, inject, name]`, stock `[Config, apply, inject, name]` ⇒ **4/4 TRÙNG**, không thiếu hành vi nào.
- **46 tên của stock là bề mặt KIỂU**: `lib/types/*.d.ts` khai 46 tên, trong đó phần lớn là helper nội bộ (`parseRegistryDump`, `xdgDataDirectories`, `execCommand`, `isFile`, `specFor`, `PATH_TOKEN`…). Bản thân stock cũng chỉ export 4 tên ở runtime.
⇒ Đồng ý với Lead: **KÝ kèm ghi chú**, KHÔNG port 41 tên (port helper nội bộ chỉ tăng bề mặt không ai dùng, trái tinh thần R5 'đủ cho consumer thật').
**GỠ TREO trước đây:** dòng "chữ ký tester chưa đủ điều kiện backup" của gói này (ghi lúc 11:39) **nay hết hiệu lực** — gói đã đủ 3 chữ ký và runtime parity 4/4.
Trước đây tôi GIỮ gói này vì `exports["."].types` trỏ `./lib/types/index.d.ts` KHÔNG tồn tại. Review-3 báo Lead đã vá types ⇒ tôi kiểm lại:
Phạm vi TESTER: chạy lại **self-test của gói** trên nội dung MỚI + dựng lại **giao diện thật** cho gói UI. Lệnh ghi theo nhóm (cùng một lệnh bun test); kết quả ghi theo nhóm + ghi chú riêng khi có bất thường.
**Gói UI — bằng chứng dựng lại bằng GIAO DIỆN THẬT (host r29, 17:0x):**
- `client/ui-chat`: gửi `6+6=?` bằng nút `Send message` → `POST /api/session/prompt` 200 → `turn/end {completed}` trong `session.v4.jsonl.zstd` → UI hiện **`Xong sau 2s · 6 + 6 = 12 · 12.6K tok`**
- `client/ui-theme`: `getComputedStyle(document.body).backgroundColor = rgb(21, 21, 23)` ⇒ token theme áp dụng
- `client/file-upload`: `document.querySelector("input[type=file]")` **có thật** trong DOM
- `client/connection`: app nạp phiên + 200 cho toàn bộ API đo được ⇒ kết nối hoạt động
- `client/shortcuts`: build exit 0 + app render đủ 55 `[data-slot]`/44 tên (không lỗi pageerror)
**Lỗi runtime ghi nhận trong lượt đo UI (không thuộc 75 gói, báo Lead):** `[session-controller] control stream failed: RemoteError: typert gateway: session/control: no active Remote method export` (1 console.error, 0 pageerror).
Công thức mở đúng (ghi lại để lần sau khỏi mò): click `[data-slot='settings.launcher']` → menu mở → click **`BUTTON[role=menuitem]` có text đúng `Cài đặt`** (KHÔNG click `SPAN` con — synthetic click trên SPAN không kích hoạt). Dialog có đúng 5 tab: `Chung · Model · Plugin · Preset agent · Thông tin`.
Ảnh bằng chứng (tôi tự chụp): `/tmp/rk-caidat.png` (dialog + tab Chung) · `/tmp/rk-plugin.png` (tab Plugin).
**`client/ui-settings-session-log` — GIỮ NGUYÊN 'CHƯA TÁI KÝ'**: tab Chung **KHÔNG có dòng `Nhật ký phiên`** (đo `document.body.innerText`: `hasNhatKy=false`), khớp kết luận của Lead ⇒ đây là **khuyết tật thật** (nghi thiếu namespace phía host), chờ dev-5 sửa rồi đo lại.
Đo bằng **sha256 artefact** (`lib/index.js` + `lib/client.js`), so với backup của Lead; test chạy lại trên nội dung mới; grep chuỗi đặc trưng trong artefact làm bằng chứng nội dung.
**`client/ui-chat` — GIỮ 'CHƯA TÁI KÝ' (backup vẫn lệch artefact đang có):**
- Test của gói **XANH** (nằm trong lượt 18 pass/0 fail ở trên).
- `lib/index.js` sha `58a81dc7d80948ac` **KHỚP** backup `193213`; nhưng `lib/client.js` hiện tại **595.505 B** (mtime 19:45:59, sha `d78fb7d963b7129c`) vs backup **595.705 B** (sha `b5813b29296f74bd`) ⇒ **lệch 200 B**. KHÔNG phải do khuôn loader (cả hai đều 1 dòng `load({ id: …, factory: factory })` tại dòng 13357) ⇒ khác ở chỗ khác trong bundle.
- Cần Lead chốt bản nào là CHUẨN: khôi phục `lib/client.js` từ backup `193213` (như đã làm cho `ui-deliverables`) **hoặc** backup lại đúng file đang có trên đĩa; xong tôi kiểm sha + ký.
**`host/open-in-app` — chữ ký hiện tại gắn với nội dung `98d863fb9f0b1bcf` (10 pass/0 fail)**: Lead chốt DỜI chỗ ném từ `apply()` sang `resolveInternals()` cho giống DSH ⇒ khi dev-1 sửa xong, ca test tôi thêm (`ctx thiếu seam ⇒ apply NÉM`) sẽ đổi thành **'hàm thuần resolve NÉM'**; tôi sẽ chạy lại + ký lại, giữ nguyên tinh thần khoá hành vi (không hạ cấp im lặng).
**`host/plugin-manager` — KHÔNG KÝ** (khớp chốt của Lead): API `pluginManager/listBundles` trả **34 bundle** (kỳ vọng ≤22) với **20 tên stock**; nguyên nhân theo Lead là **bản mount trong profile bị ghi đè artefact cũ** (repo 55 hit `dsh-experimental`, profile 1 hit) ⇒ dev-3 đang sửa tầng mount. Tôi sẽ gọi lại đúng API đó để nghiệm thu số sau khi mount được copy lại.
**Xác nhận cổng (đo độc lập 19:57):** `bun run gate --no-tests` ⇒ **XANH 8/8** (`header 4200 · file-length 4200 · jsdoc 4200 (13 cảnh báo) · exports-targets · dep-guard 5499 · parity-matrix · typecheck 2667 · hygiene 193`).
**Bối cảnh**: Lead + review chốt cách (a): chỗ NÉM phải nằm trong **hàm thuần** `resolveInternals`, đúng DSH stock (`lib/index.js:391-392`), KHÔNG ném trong `apply()`. Review đã sửa mã + build lại; tôi đổi lại ca khoá hành vi (việc Lead giao cho tester, review KHÔNG sửa `tests/`).
**`client/ui-chat` — CHỜ N1 (chốt của Lead 08/11/2026):** dev-5 đang sửa tiếp gói này (bước B: join tên provider từ catalog) ⇒ **backup sẽ làm lại SAU N1**; chữ ký hiện tại KHÔNG áp dụng. Khi dev-5 báo xong N1, Lead build + backup lại và gửi sha, tôi kiểm sha + chạy test rồi mới ký.
**Tách sổ (luật §2 ≤1000 dòng, 08/11/2026):** phần ghi chú dài của TÁI KÝ ĐỢT 2 đã chuyển sang `docs/tien-do/chu-ky-tester-phu-luc.md` (231 dòng); sổ chính còn **995 dòng** và giữ TOÀN BỘ dòng chữ ký (459 dòng · 332 gói duy nhất). Dòng trỏ giữa hai tệp có ở cả hai đầu.
