<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 11/11/2026
 desc SỔ TIẾN ĐỘ package: mỗi dòng = một package ĐÃ XÁC THỰC (3 chữ ký) + nơi lưu bản sao + hash.
      Quy tắc: package có trong sổ này là ĐÓNG BĂNG — không sửa nữa; nếu buộc phải sửa thì ghi lý do vào cột ghi chú.
-->

> 📎 Phần TRƯỚC mốc 18:47 đã tách sang [SO-TIEN-DO-phu-luc.md](SO-TIEN-DO-phu-luc.md) — tệp này chỉ giữ phần mới nhất
> (tách 08/11/2026 để giữ luật <=1000 dòng/tệp).

## ✅ MỐC 9/9 CỔNG XANH LẦN 2 (sau toàn bộ thay đổi hôm nay) — 08/11/2026 18:47
`bun run gate` (đủ test, exit=0, tổng **484.185 ms**):
header 4197 · file-length 4197 · jsdoc 4197 (13 cảnh báo) · exports-targets · dep-guard 5496 · parity-matrix ·
typecheck 2666 file 0 vi phạm · hygiene 193 · **test 0 vi phạm (440.697 ms)** ⇒ **KẾT LUẬN: XANH — 9/9 cổng đạt**.

### Lọc bundle stock: filter ĐÃ ở bản chạy nhưng `coBanTa` luôn false (đo được)
· `grep -c coBanTa` trong `lib/index.js` = 2 (bản chạy có filter) nhưng payload **vẫn 34 bundle / 20 stock / còn 'powered by dsh'**.
· Nguyên nhân: `resolveBundleDir("dsh", tenTa, …)` trả **undefined** cho bundle của ta (nằm dưới anchor khác) ⇒ `existsSync` không bao giờ được gọi.
· Cách sửa đã giao dev-5 (và tôi DỪNG không tự sửa vì file đổi giữa chừng — đúng luật vùng ghi): `coBanTa` trả true khi
  `bundleMetaVi(tenTa) !== undefined` — bảng dịch của ta CHỈ có entry cho bundle ta thật sự đóng gói.


## VÒNG 33 — CƠ CHẾ KHOÁ CỨNG SAI KHÁC CÓ CHỦ ĐÍCH (yêu cầu trực tiếp của chủ dự án)
· Tạo `docs/GBH-SAI-KHAC-CO-CHU-DICH.md`: mỗi sai khác cố ý phải khai 5 thông tin (gói · khác gì · vì sao · `tệp:dòng` · reviewer kiểm gì).
  Đã ghi 5 mục đầu: badge skill (cơ chế chèn khác DSH) · nhãn provider `auto` · 'Xoá phiên' (tính năng riêng, DSH không có) · voice input · model settings của `auto`.
· dev-1 viết `tools/lint/deviation-registry.ts` (so artefact với stock sau khi đổi id; đọc mục khai báo bằng `<!-- deviation: <gói> -->`).
SỐ LIỆU THẬT (lần đầu đo): **193 gói mount · KHỚP BYTE 1 · chưa khai báo 176 (116 host + 60 client) · không có bản gốc 16**.
⇒ Trực giác của chủ dự án được chứng minh bằng số: gần như MỌI gói đều khác bản gốc theo cách nào đó, nên 'review parity' kiểu so byte là bất khả thi nếu không có danh mục sai khác.
· Nhận định của dev-1: phần lớn 176 là lệch HỆ THỐNG (brand swap `DeepSeek`→`Galaxy Blackhole`, JSDoc tiếng Việt, hash class CSS) — tôi DUYỆT hướng chuẩn hoá nhưng kèm 4 điều kiện:
  (1) mỗi lớp chuẩn hoá phải là mục 'SAI KHÁC HỆ THỐNG' có dẫn chứng + ngày trong danh mục; (2) in số lệch CẤU TRÚC + byte lệch đầu + 60 ký tự ngữ cảnh hai bên;
  (3) chỉ bật vào GATE_ORDER khi số 'chưa khai báo' = 0; (4) KHÔNG tự thêm mục khai báo thay chủ dự án.
· Hai lỗi hiển thị chủ dự án báo đã sửa và build: nhãn `Galaxy Blackhole / auto` (`ui-chat/src/parts/part-010.ts:734-737`, không sửa sự kiện) và
  bảng `viSessionDelete` **RỖNG** ở `client/locale/src/locales-vi.ts:493-495` (nay điền 9 khoá: 'Xoá phiên', 'Huỷ', 'Xoá vĩnh viễn'…).


## VÒNG 34 — CHỐT THIẾT KẾ 2 CỔNG SAI KHÁC (byte vs bề mặt+hành vi)
Số liệu sau 5 lớp chuẩn hoá (`ids` · `brand` · `css-hash` · `header` · `build-shape`):
**193 gói mount · khớp byte 13 · lệch cấu trúc 164 · không có bản gốc 16**.
· dev-1 chứng minh: **127/164 lệch là do CƠ CHẾ BUILD** (Bun ghép TS → prelude/footer khác bản publish của stock) ⇒ **byte KHÔNG hội tụ** cho host package;
  muốn bỏ hết phải so AST. Ép byte sẽ tạo cổng giả ⇒ tôi chốt thiết kế 2 cổng:
  **CỔNG A (byte-parity)** cho nhóm có hợp đồng byte: client bundle de-bundle + gói khai parity byte; lệch ⇒ phải có mục `<!-- deviation: … -->`.
  **CỔNG B (bề mặt exports + hành vi)** cho host package: **thiếu export ⇒ ĐỎ ngay** (đúng lớp lỗi P0 `session/control`), **thừa export ⇒ phải khai báo**.
· Phát hiện đáng giá: **13 gói THỪA export** so bản gốc (không gói nào thiếu) — `plugin-market` (`PluginMarket`) · `sandbox` · `web-fetch-http` · `client-hmr` ·
  `client-locale` · `client-modules` · `client-product-analytics` (9 tên) · `client-resources` · `client-ui-chat` · `client-ui-deliverables` · `client-ui-settings-session-log` ·
  `client-ui-settings-web-search` · `client-ui-skill` ⇒ 13 mục khai báo cần chủ dự án duyệt.
· 3 gói lệch vì **chú thích tiếng Việt trong code** (không tự bỏ): `api-session-controller` · `experimental-inspector` · `skill-badge` (gói cuối chính là sai khác §1, chỉ thiếu marker).
· `open-in-app` (gói từng bị thu hồi đóng băng) lệch 1392 dòng/byte 10 nhưng **bề mặt exports KHỚP** ⇒ tôi yêu cầu rà **ngữ nghĩa** 3 khối đã sửa hôm nay, không chấp nhận kết luận 'dấu vết bundler'.


## VÒNG 35 — 2 CỔNG ĐÃ CÀI + RÀ NGỮ NGHĨA PHÁT HIỆN 2 LỖI THẬT Ở `open-in-app`
Số liệu: **CỔNG A (byte): 31 gói · thiếu khai báo 21** · **CỔNG B (bề mặt+hành vi): 162 gói · thiếu khai báo 14**
(193 gói mount · khớp cả hai chiều 13 · không có bản gốc 16).

### 🔴 Phát hiện quan trọng: rà NGỮ NGHĨA tìm ra 2 lỗi thật trong `host/open-in-app` (gói từng bị thu hồi đóng băng hôm nay)
| khối | kết luận |
|---|---|
| spawn detached + `unref` | ✔ khớp stock |
| cache `quenCatalog` + ENOENT dò lại 1 lần | ✔ tương đương |
| **env + `windowsHide`** | ✘ stock spawn kèm **env đã khử credential** (`scrubbedParentEnv()`), ta KHÔNG có ⇒ **khác biệt an ninh** |
| **`subprocess.resolveExecutable`** | ✘ stock **bắt buộc** (thiếu ⇒ throw), ta coi là tuỳ chọn ⇒ **hạ cấp im lặng** |
⇒ Đã duyệt SỬA cả 2 (không khai báo). Bài học: **cổng byte/bề mặt KHÔNG bắt được khác biệt ngữ nghĩa bên trong hàm** — nên bước 'rà ngữ nghĩa' là bắt buộc, không được thay bằng kết luận 'dấu vết bundler'.

### Quyết định về 13 gói THỪA export (không duyệt gộp)
Nguyên tắc: export thừa = **bề mặt API công khai**; người dùng gói có thể phụ thuộc rồi ta không gỡ được ⇒ khai báo chỉ dành cho thứ THẬT SỰ cố ý.
· CÓ consumer hoặc API công khai có chủ đích (`plugin-market` → `PluginMarket`, `sandbox` → `LocalSandboxProvider`) ⇒ khai báo.
· KHÔNG consumer ⇒ **bỏ export cho khớp stock** (đặc biệt các tên như `default`, `name`, 12 hằng nội bộ của `client-product-analytics`,
  `PERFORMANCE_USAGE_MODES`, `FILE_REFERENCE_PROMPT`, `resolveConfig/CONFIG_DEFAULTS`).
· Duyệt ngay: 3 mục chú thích tiếng Việt (`skill-badge`, `api-session-controller`, `experimental-inspector`) + 1 mục `plugin-package-inventory-deepseek` (đổi tên gói).


## VÒNG 36 — LỖI XOÁ PHIÊN (chủ dự án báo kèm ảnh): ở lại khung hội thoại và hiện id thô
Triệu chứng: sau khi xoá phiên đang mở, UI **không** về màn 'Phiên mới' mà giữ khung hội thoại, tiêu đề hiện
`session-fd7cc3c0-cf50-4634-be63-100d758c51a8` (id thô). Yêu cầu: hành vi phải **giống tính năng lưu trữ** (về màn Phiên mới).
Chẩn đoán (đọc mã): `packages/client/ui-session-delete/src/dialog.ts:87-91` — `confirm()` chỉ gọi `requestDelete(sessionId)` rồi `close()`,
**không điều hướng, không xoá phiên đang mở khỏi state** ⇒ view giữ nguyên, tiêu đề rơi về id.
Đã giao dev-5: đối chiếu cơ chế của flow LƯU TRỮ (đang đúng) rồi áp cùng cơ chế cho xoá; kiểm thêm 2 ca (xoá phiên KHÔNG mở ⇒ không nhảy view;
sidebar cập nhật ngay); ghi mục §3 danh mục sai khác (tính năng riêng, DSH không có) với hành vi đúng.


### VÒNG 36b — chốt hướng hiển thị tên provider/model: **N1 (catalog + client join)**
Bối cảnh: dev-5 đã **bỏ hard-code** `"Galaxy Blackhole / auto"` khỏi `ui-chat` (kiểm `grep -c` = 0/0 trong 2 artefact) — nay thiếu dữ liệu thì fallback `${provider}/${model}` y như stock.
· DSH `dsh-client-ui-chat/lib/client.js:6851` chỉ render `${provider}/${model}` thô, KHÔNG có cơ chế display name ⇒ việc ta hiển thị tên cấu hình là **mở rộng của ta** ⇒ ghi vào danh mục sai khác §2.
· Nguồn dữ liệu đã có sẵn: `packages/host/api-session-controller/src/parts-host/part-02-catalog.ts:19-53` (`llm.listProviders()` → `provider.name`; `listModels()` → model `name`)
  và `packages/host/llm/src/typert-host.ts:39` (descriptor có `displayName`), `ctx.llm.listConfigurableProviders()` (`part-02-catalog.ts:96`) trả `{provider, displayName, settingsNs}`.
· CHỐT N1 thay vì N2 (cho sự kiện mang tên): N2 đổi **hợp đồng dữ liệu phiên đã persist** (log cũ không có trường ⇒ hiển thị lệch giữa phiên cũ/mới).
  N1 join lúc render ⇒ **phiên cũ cũng hiện đúng tên**; điều kiện: khối viết tay ở client phải nhỏ (1 hàm), cache catalog, fallback như stock, và khai báo deviation §2.
· Nghiệm thu 3 ca: đổi `displayName` trong config ⇒ nhãn đổi **không sửa mã** · xoá `displayName` ⇒ fallback `auto/deepseek-v4.1-flash` · mở phiên CŨ (27/10) ⇒ nhãn vẫn đúng.


### VÒNG 37 — CHẨN ĐOÁN ĐÚNG TẦNG cho lỗi xoá phiên: **retention/main binding không được nhả**
dev-5 chứng minh bằng đo: **KHÔNG có flow archive ở tầng UI** để 'làm y hệt' — stock `dsh-client-ui-conversation` chỉ có 1 hit 'archive' là đường dẫn tài liệu trong comment (`:13886`),
không có `archiveSession|session/archive` trong bất kỳ `dsh-client-*/lib/client.js`; repo ta chỉ có **API HOST** (`packages/host/workspace/src/types.ts:120` `archiveSession`).
⇒ Điều kiện '(a) đọc flow archive' của tôi **không thể thoả theo nghĩa đen**, và dev-5 **dừng lại báo cáo** thay vì tự phát minh — đúng luật.

**Cơ chế thật** (`dsh-client-ui-session/lib/client.js:766,916-917`): view đi theo **main binding (retention)**, không theo lệnh điều hướng:
`nextId = currentId !== undefined && retainInfo(currentId) > 0 ? currentId : Object.values(byId).find(c => (c.retainedBy.mainView ?? 0) > 0)?.id`
⇒ phiên bị xoá khỏi `sessions` nhưng **retention không nhả** ⇒ `current.key` vẫn là id đã xoá ⇒ tiêu đề rơi về id thô (đúng ảnh chủ dự án gửi).
`ui-session-delete/src/mount.ts:88` ĐÃ gọi `child.sessions.refresh?.()` sau khi xoá ⇒ thiếu đúng một mắt: nhả main binding.
· CHỐT **H1**: sửa trong `ui-session-delete` (gói của ta, không cần deviation), chỉ dùng API công khai của seam; chỉ nhả khi phiên bị xoá **đang là main**;
  KHÔNG đụng `ui-session` (de-bundle); nếu seam không phơi hàm cần thiết thì báo tôi trước, không tự mở rộng.



## VÒNG 38 — NGHIỆM THU LỖI XOÁ PHIÊN TRÊN UI THẬT: ĐÃ HẾT
· dev-5 sửa `ui-session-delete/src/mount.ts`: inject thêm `uiWorkspace`, sau `sessions.refresh()` thì nếu phiên bị xoá ĐANG là phiên mở
  (`mainReference?.sessionId === sessionId`) thì gọi `createInWorkspace(workspace, {})` — API CÓ SẴN (`ui-workspace/src/service.ts:124-136`), không mở rộng seam, không đụng `ui-session`.
· Tôi nghiệm thu bằng UI thật: tạo Phiên mới → menu 'Thao tác phiên' → Xoá phiên → Xoá vĩnh viễn ⇒ **`coIdTho: false`** (hết tiêu đề `session-…`),
  **`coManMoi: true`** (màn 'Into the Unknown'). Ảnh `docs/tien-do/anh-sau-xoa-phien-08-11.png`. Test gói 5 pass.

### ĐÍNH CHÍNH: **CÓ** flow lưu trữ trong UI (dev-5 từng kết luận 'không có')
Menu 'Thao tác phiên' hiện đủ: `Ghim phiên` · `Đổi tên ⌥⌘G` · `Fork phiên ⇧⌘F` · **`Lưu trữ phiên ⌥⌘A`** · `Sao chép ID phiên` · **`Xoá phiên`**.
⇒ dev-5 grep `dsh-client-ui-conversation` nên bỏ sót gói render menu. Bài học (lần thứ N trong ngày): **đo trên UI trước khi kết luận 'không tồn tại'**.

### `open-in-app`: 2 lỗi đã đóng, nhưng phải tự build lại artefact
dev-1 sửa `src` đúng (scrubbedParentEnv + windowsHide · resolveExecutable ném ngay) nhưng **không build lại `lib/index.js`** ⇒ artefact cũ (grep = 0/0).
Tôi tự build: `bun run build.ts lib` ⇒ lib mới có `scrubbedParentEnv` 2 hit + `resolveExecutable` 4 hit ⇒ restart, boot 0 `failed to import`.
⇒ Quy tắc nhắc lại: **sửa src chưa xong, phải grep trên artefact** — đúng bài học đã ghi sổ.

### dev-1: xoá export thừa — 6 gói xong, 2 gói phải khôi phục (có consumer thật)
`web-fetch-http` (test import bằng **đường dẫn tương đối** — phép quét consumer bỏ sót) và `ui-deliverables` (`FILE_REFERENCE_PROMPT`).
Còn 1 test đỏ `ui-deliverables` (dòng kiểm 'id DUY NHẤT trên dòng loader') chưa xử lý xong; 3 gói nhóm `default` đang chờ phép kiểm runner.
Số liệu: CỔNG A 31 gói · thiếu khai báo 19 · CỔNG B 162 gói · thiếu khai báo 8 (sau khôi phục ⇒ 10).


## VÒNG 39 — TÌM RA GỐC THẬT của 'trang Plugin còn 20 bundle stock': **bản mount bị GHI ĐÈ**
Đo tái lập 2 lần: repo lib `grep -c 'dsh-experimental'` = **55** · profile lib = **1**.
· Copy repo lib → profile lib ⇒ 55 · **restart ⇒ quay lại 1**. Xoá hẳn profile lib rồi restart ⇒ boot tạo lại với **1**.
· Boot log CÓ `[bh] rewrite OK @galaxy-blackhole/gbh-host-plugin-manager` ⇒ rewrite chạy nhưng kết quả vẫn là artefact cũ ⇒ có bước ghi SAU rewrite (installer/tarball) HOẶC rewrite không hề build lại (buildIfStale coi 'tươi').
⇒ Đây là lý do THẬT khiến filter bundle không bao giờ có tác dụng, và cũng là lý do mọi 'sửa rồi mà không thấy đổi' chiều nay. Đã giao dev-3 (`apps/cli/src/mount.ts`) sửa đúng gốc + nghiệm thu bằng `grep` profile lib = 55 và API ≤22 bundle / 0 tên stock.

### Sửa 2 cổng ĐỎ (do thay đổi dở dang của nhiều người)
· `client/ui-deliverables`: dev-1 build lại artefact bằng khuôn loader CŨ (1 dòng) trong khi test đòi khuôn DE-BUNDLE (3 dòng) ⇒ **khôi phục `lib/client.js` từ backup `ui-deliverables-20261108-110820`** ⇒ 9 pass / 0 fail.
· `host/open-in-app`: `exports[.] -> ./lib/types/index.d.ts` không tồn tại (tôi build `lib` nhưng thiếu types) ⇒ chạy `tools/gen-types.ts packages/host/open-in-app` ⇒ sinh `catalog.d.ts`/`icons.d.ts`/`index.d.ts`.
⇒ `bun run gate --no-tests` = **XANH 8/8** (typecheck 2667 file 0 vi phạm).

### Quyết định về `open-in-app` (ra-soat trả lại, có lý)
DSH ném 'thiếu subprocess.resolveExecutable' trong `resolveInternals()` (hàm thuần), TA ném trong `apply()` ⇒ plugin không activate ⇒ 5 test route đỏ.
⇒ Chốt **dời chỗ ném** ra khỏi `apply()` cho giống DSH (giữ nguyên fail-loud), không nới test; ca kiểm của tester đổi theo chỗ ném mới.


## VÒNG 40 — HAI VIỆC: bật 'Nhật ký phiên' (chủ dự án chọn B) + ĐÍNH CHÍNH phép đo của tôi
### 1. 'Nhật ký phiên' — chủ dự án chốt **hướng B** (bật lại + đổi tên id)
· Đổi id row `session-log-deepseek` → **`session-log-gbh`** ở 3 nơi: `packages/host/bundle/cordis.patch.yml:49`, `packages/host/bundle-base/cordis.patch.yml:49`, bản trong profile.
· **Namespace cài đặt và loại sự kiện GIỮ NGUYÊN** (`session-log-deepseek`) — chúng là khoá cấu hình + loại sự kiện ĐÃ GHI vào log; đổi sẽ phá dữ liệu cũ. Id row chỉ là định danh cấu hình nên đổi an toàn.
· `~/.galaxy/blackhole/app.patch.yml`: bỏ khối `- id: session-log-deepseek / disabled: true` (id cũ không còn khớp row), thay bằng ghi chú nêu quyết định hướng B ngày 08/11/2026.
· Cần nghiệm thu trên UI (dev-3 kiểm sau restart): Cài đặt → tab Chung có hàng 'Nhật ký phiên'.

### 2. ĐÍNH CHÍNH phép đo của tôi: '55 vs 1' là SAI
Tôi từng coi `grep -c 'dsh-experimental'` = 55 ở repo vs 1 ở profile là bằng chứng 'profile bị ghi đè artefact cũ'. **Sai**: dev-3 đo lại — profile có **29** lần `gbh-experimental-*` + **1** `dsh-experimental-`, và lần còn lại chính là mã của ta (`const laThuNghiemStock = ten.startsWith("@deepseek-ai/dsh-experimental-")`).
⇒ Bước rewrite đã đổi id stock→GBH **đúng**; profile **không cũ**. **Bài học**: sau bước rewrite id, đếm chuỗi là phép đo VÔ NGHĨA; nghiệm thu phải bằng **hành vi API** (`listBundles` ≤22, 0 bundle stock).
· Trạng thái thật lúc 20:06 (tôi đo): `listBundles` = **34 bundle · 12 stock experimental · còn chuỗi DSH** ⇒ filter vẫn chưa có tác dụng; dev-3 đang kiểm trên artefact ĐANG CHẠY.


## 🎯 VÒNG 41 — SỬA XONG LỖI 'TRANG PLUGIN CÒN BUNDLE STOCK / POWERED BY DSH' (nghiệm thu bằng API + DOM)
**Kết quả đo sau restart r56**: `POST /api/pluginManager/listBundles` ⇒ **22 bundle** (trước 34) ·
stock còn lại **đúng 8 id nền** (`dsh-subagent-claude-code` · `dsh-subagent-codex` · `dsh-acp-app` · `dsh-base` · `dsh-headless` · `dsh-sdk-app` · `dsh-sdk-minimal` · `dsh-web-app`) ·
**0 tên `@deepseek-ai/dsh-experimental-*`** · payload **0 chuỗi** `powered by dsh|DSH badge` · DOM **0 chuỗi** · ảnh `docs/tien-do/anh-plugin-22-bundle-08-11.png`.

### NGUYÊN NHÂN THẬT (khác mọi giả thuyết trước đó)
Bảng đổi tên `DOI_TEN_BUNDLE` nằm **TRONG artefact**; artefact trong profile đã bị **bước rewrite đổi id stock→GBH**
⇒ lúc chạy `quyTenBundle(stockId)` trả về **chính stockId** ⇒ mọi phép tra theo bảng (`bundleMetaVi`, `traMetaVi`, `resolveBundleDir`) đều TRƯỢT.
Đó là lý do 3 bản sửa 'đúng logic' trước đó không có tác dụng. **Bài học**: đừng dựa vào bảng ánh xạ nằm trong artefact mà bước rewrite đã đổi id.

### Cách sửa (bỏ hẳn phụ thuộc bảng)
`packages/host/plugin-manager/src/manager.ts` — thêm `goiGbh` (các bundle GBH hồ sơ THẬT SỰ có), `gonKhoa` (bỏ `-bundle`/`-profile`),
`coBanGbhCung(khoaStock)` so **khoá tính năng**; ẩn bundle stock thử nghiệm khi có bản GBH cùng khoá, giữ nguyên 8 id nền + bundle chưa port.
Artefact sha `bc6d37ec9f5f5a75` (profile `aeabf19c75013ded` — khác nhau vì bước rewrite đổi id, HÀNH VI giống nhau).
Backup: nhãn **20261108-201259** (12 gói đổi nội dung, gồm `host/plugin-manager`).
Đã giao review + tester ký lại `host/plugin-manager` với số đo trên (yêu cầu họ tự gọi lại API để kiểm chéo, không chép số của tôi).


## ✅ ĐÓNG BĂNG `host/plugin-manager` (08/11/2026 20:2x) — đủ 3 chữ ký CÙNG một nội dung
· Artefact sha **`bc6d37ec9f5f5a75`** = khớp backup `/tmp/gbh-pkg/plugin-manager-20261108-201259`.
· **DEV** `chu-ky-dev-3.md:363` (dev-5, khoá sạch, 20:28) + **DEV độc lập** `chu-ky-dev-1.md §55.2` (dev-1) · **REVIEW** `chu-ky-review.md:369` (20:50) · **TESTER** `chu-ky-tester.md` (20:56).
· Nghiệm thu của tôi (Lead, đo trên UI thật): API **22 bundle** (14 GBH + 8 stock nền) · **0** `dsh-experimental-*` · payload/DOM **0** `powered by dsh` · ảnh `anh-plugin-22-bundle-08-11.png`.
· Test gói 18 pass / 0 fail · `[pm-filter]` chẩn đoán tạm đã xoá (0 hit).
· Gói này **ĐÓNG BĂNG**: không sửa nữa; nếu phải sửa thì thu hồi theo §3 và tái ký đủ 3 chữ ký.

### Bài học ĐỢT NÀY về sổ chữ ký (4 lần trong ngày, đều bị chặn trước khi đóng băng)
1. `host/open-in-app`: dev ghi `CHO FIX` trong khi review+tester KÝ ⇒ chặn.
2. dev-3 ghi 'ĐÃ KÝ' ngược chốt thu hồi của Lead ⇒ chặn.
3. Dòng DEV của `plugin-manager` ghi đúng nội dung nhưng **sai khoá gói** (`host/plugin-manager (kế tiếp)`) ⇒ máy đọc ra bản CŨ ⇒ chặn.
4. Script chốt của review bỏ rơi dòng 'CHƯA KÝ' (không vào cả 2 rổ) ⇒ chặn.
⇒ Luật chốt từ nay: **đóng băng chỉ khi sha xuất hiện trong CẢ 3 sổ**, khoá gói đúng định dạng `tier/tên-gói`, và dòng cuối theo khoá sạch phải là dòng mới nhất.


## ✅ VÒNG 42 — BACKUP + ĐÓNG BĂNG ĐỢT CUỐI (nhãn `20261108-202532`)
· **Sửa lỗi của chính script backup**: bản cũ chỉ so `lib/index.js` nên **bỏ qua gói client** (thân là `lib/client.js`) ⇒ tưởng 'không đổi'. Nay so **cả** `lib/index.js` và `lib/client.js`.
· Backup lại **21 gói** (nhãn `20261108-202532`) — tổng thư mục `/tmp/gbh-pkg` = **600**.
· Gói đã **đóng băng** (đủ 3 chữ ký cùng nội dung):
  - `host/plugin-manager` — sha `bc6d37ec9f5f5a75` · DEV `:363` + DEV độc lập dev-1 · REVIEW `:369` · TESTER · backup `201259` · nghiệm thu 22 bundle/0 DSH + ảnh.
  - `host/open-in-app` — sha `410bf6ff5c6b00f5` · DEV dev-3 (sau refactor) · REVIEW (20:12) · TESTER (10 pass) · backup `201259`.
· Gói **CHỜ ký lại đợt này** (nội dung vừa đổi, cần 3 chữ ký mới):
  - `client/ui-chat` sha `9d8a0f1c71d16b52` (nhãn lấy tên từ catalog — N1) · `client/ui-session-delete` sha `c3f719c13732dcf4` (xoá phiên dùng `clearMain`) ·
    `client/locale` sha `06fdec2421e84dcf` (2 khoá `limits.*` + 9 khoá `session-delete`) · `client/ui-agent-team` sha `89b676588661c930` (review đã KÝ, chờ tester).


## ✅ ĐÓNG BĂNG ĐỢT CUỐI — 4 gói client (08/11/2026 21:5x)
Tiêu chí chốt: **cùng một sha xuất hiện trong CẢ 3 sổ** (DEV · REVIEW · TESTER) — tester đã kiểm chéo bằng grep sha, không suy từ 'có dòng KÝ'.
| gói | sha `lib/client.js` | backup | DEV | REVIEW | TESTER |
|---|---|---|---|---|---|
| `client/ui-chat` | `9d8a0f1c71d16b52` | `ui-chat-20261108-202532` | `chu-ky-dev-5.md` 20:34 | 21:45 | 21:05 |
| `client/ui-session-delete` | `c3f719c13732dcf4` | **`ui-session-delete-20261108-202525`** (KHÁC nhãn — cách 7 giây) | `:196` 20:34 | 21:45 | 21:05 |
| `client/locale` | `06fdec2421e84dcf` | `client/locale-20261108-202532` | 20:34 | 21:45 | 21:05 |
| `client/ui-agent-team` | `89b676588661c930` | `…-202532` | 20:34 | 21:45 | 21:05 |
· Nội dung: `ui-chat` = N1 nhãn lấy tên từ catalog (`napTenRoute`/`__gbhRouteNames`, 0 hit `Galaxy Blackhole`) · `ui-session-delete` = xoá phiên dùng `clearMain()` (cùng API 'Lưu trữ phiên') ·
  `locale` = 2 khoá `limits.*` + 9 khoá `session-delete` · `ui-agent-team` = 2 khoá VI.
· ĐÍNH CHÍNH số của review: danh sách chốt của họ **thiếu 11 gói** do bảng 'TÁI KÝ ĐỢT 1' ghi 3 cột (script chỉ đọc 5 cột) ⇒ con số đúng là **KÝ 193 · TRẢ LẠI 0**, không phải 183. Đây là lần thứ 5 trong ngày lớp lỗi 'sổ ghi đúng nhưng máy đọc ra thiếu'.
· TRUNG THỰC: nhãn `Galaxy Blackhole / Auto` tôi **CHƯA nghiệm thu được bằng ảnh** — probe mở đúng `button[aria-haspopup="dialog"]` nhưng dialog bắt được là modal 'Thiết lập voice input', không phải popover 'Lượng dùng của lượt'. Bằng chứng hiện có: payload catalog trả `name: 'Galaxy Blackhole'`/`name: 'Auto'`, artefact có `napTenRoute` ×2, 0 hit chuỗi thương hiệu, test 9 pass. **Chưa đủ để tôi nói 'đã xong'.**


## VÒNG 43 — CỔNG `test` ĐỎ: 3 test, đã tách rõ nguyên nhân
`bun test` toàn bộ: **5401 pass · 7 skip · 4 todo · 3 fail** (5415 test / 352 tệp, 259s).
1. `bundle/profile — bundle-base: YAML parse OK · khai hai chiều khớp gốc` — **do tôi** đổi id trong `bundle-base/cordis.patch.yml` (bundle nền phải khớp stock 1:1). ĐÃ **REVERT**; đổi tên chỉ giữ ở `bundle/cordis.patch.yml` (bundle đang chạy).
2+3. `ui-sidebar-right` + `ui-theme` — artefact **sai khuôn loader** (khuôn CŨ 1 dòng, test đòi khuôn DE-BUNDLE 3 dòng). Đo: `grep -c '__ModuleLoader__.load({ id:'` = 1 và 0, **backup cũ nhất cũng vậy** ⇒ lỗi có từ lâu.
· Đã thử `tools/debundle-client.ts` cho 2 gói: chạy được (6/13 lát) nhưng **hỏng 3 test khác** của `ui-theme` ⇒ **đã khôi phục** `lib/` từ backup `202532`.
· Giao dev-1 chuyển `build.ts` 2 gói sang khuôn de-bundle, nghiệm thu 28/28 xanh.


## VÒNG 44 — CỔNG `test` ĐÃ XANH; sửa 3 test đỏ cuối
`bun run gate` (bản đầy đủ): **test · 0 vi phạm · 232.459 ms** — hết 3 test đỏ.
· `bundle-base` YAML: revert id về `session-log-deepseek` (bundle nền phải khớp stock 1:1); đổi tên chỉ giữ ở `bundle/cordis.patch.yml` ⇒ **PASS**.
· `ui-sidebar-right`: artefact sinh khuôn loader CŨ 1 dòng ⇒ **tôi sửa trực tiếp artefact** sang khuôn de-bundle (`load({` + TAB `id:` + `factory: (require) => {…}`) ⇒ test xanh; **dev-1 sửa `build.ts`** để tái sinh đúng khuôn (2 gói: `ui-sidebar-right:66`, `ui-theme:203`), đo lại **28/28 pass**.
· `ui-theme`: cùng lớp lỗi, xử lý cùng cách ⇒ xanh.
· `exports-targets` (1 vi phạm): `packages/client/ui-sidebar-right` mất `lib/types/*.d.ts` vì `build.ts` có `rm(lib)`; `gen-types` cho gói này **không chạy được** (thiếu type `react-dom`/`react/jsx-runtime`) ⇒ khôi phục `lib/types` từ backup `ui-sidebar-right-20261108-202532` ⇒ cổng xanh.
· Bài học hạ tầng (đã ghi): **`build.ts` xoá cả `lib/` ⇒ mất `lib/types`**; ai rebuild gói client phải khôi phục `lib/types` ngay sau build, hoặc dùng `mount.ts` bản vá của dev-3 (snapshot/restore `lib/types`).


## VÒNG 45 — 'Nhật ký phiên' KHÔNG mount: đã khoanh vùng, giao dev-3
· Đã đổi id `session-log-deepseek` → `session-log-gbh` ở `packages/host/bundle/cordis.patch.yml:49` + bản trong profile; bỏ `disabled: true` ở `app.patch.yml`; **revert** `bundle-base` (test parity đòi bundle nền khớp stock ⇒ đây là test đỏ thứ 1 đã sửa).
· ĐO: gói `@galaxy-blackhole/gbh-session-log-deepseek` **có** trong profile; log boot chỉ có 2 dòng về **client row** (`canh bao, van mount — ban mount CU hon ma nguon trong repo`), **không có dòng nào về row host**; `did not activate` = 0.
⇒ Nghi vấn: cấu hình cordis **thực sự được nạp** lúc boot không phải file tôi sửa (boot sinh lại từ nguồn khác) ⇒ sửa trong `node_modules` vô hiệu. Giao dev-3 trả lời bằng `tệp:dòng` + sửa đúng bộ sinh.
· Nghiệm thu đặt ra: (a) log boot có dòng nạp row; (b) `settings.describe` có namespace **`session-log-deepseek`** — namespace CỐ Ý giữ nguyên (khoá cấu hình + loại sự kiện đã ghi vào log; đổi sẽ phá dữ liệu cũ).


## ✅✅ CỔNG 9/9 XANH LẦN THỨ 3 — 08/11/2026 20:4x (exit=0, 258.653 ms) — MỐC CHỐT
```
XANH header 4200 · file-length 4200 · jsdoc 4200 (13 cảnh báo) · exports-targets 0
XANH dep-guard 5499 · parity-matrix 1 · typecheck 2667 file 0 vi phạm · hygiene 193
XANH test 0 vi phạm (246.141 ms)
KẾT LUẬN: XANH — 9/9 cổng đạt
```
· Đây là lần chạy ĐẦY ĐỦ (có test) và là mốc chốt cho toàn bộ thay đổi hôm nay: P0 (agent-loop + session) · lọc bundle stock (22 bundle/0 DSH) ·
  xoá phiên về 'Phiên mới' · nhãn provider từ catalog (bỏ hard-code) · 2 lỗi an ninh `open-in-app` · 9 khoá VI session-delete + 2 khoá VI agent-team ·
  khuôn loader de-bundle cho `ui-sidebar-right`/`ui-theme` · 4 cổng/thư viện mới (deviation-registry, exports-src, profile-integrity, mount-scope).
· Đối chiếu điều kiện objective: **332 gói** rà theo 6 quy tắc (cổng phủ) · **3 chữ ký** (review KÝ 193 · TRẢ LẠI 0; tester 332/332) ·
  **backup đúng gói** 600 thư mục + script so cả `lib/client.js` · **ghi sổ** (sổ chính + phụ lục) · **ảnh nghiệm thu** cho P0/plugin/xoá phiên/menu phiên/tab Cài đặt.
· CÒN HỞ (ghi rõ để người sau không tưởng đã xong): 2 ảnh nghiệm thu UI — nhãn `Galaxy Blackhole / Auto` (popover chưa mở được bằng probe) và hàng 'Nhật ký phiên' (row host chưa mount — đang giao dev-3 tìm bộ sinh cấu hình cordis).
· 2 cổng sai khác (`deviation-registry`) **CHƯA bật** `GATE_ORDER`: A còn 19 mục, B còn 8–10 mục chưa khai báo.


## VÒNG 46 (vòng cuối) — ĐÓNG OBJECTIVE: kiểm chứng lần cuối + 2 việc mở
### Đã kiểm chứng lại sau restart r60
· App lành: **48 slot** (có `sidebar.session.row.leading` ×5 + `sidebar.workspaces.session.row.action`) · tiêu đề phiên hiện trong DOM · **0 pageerror**.
  ⇒ ĐÍNH CHÍNH: báo cáo của tester 'slot `sidebar.session.row.leading` không còn tồn tại, 0 hit tiêu đề phiên' là **SAI thời điểm đo** (họ đo lúc host đang restart). Tôi đo lại sau khi ready: slot và tiêu đề **đều có**.
· `bun run gate --no-tests` ⇒ **XANH 8/8** (typecheck 2667 file 0 vi phạm) sau toàn bộ sửa cuối.
· Restart r60: `failed import` 0 · `did not activate` 0.

### 2 VIỆC MỞ (ghi rõ để người sau tiếp, KHÔNG coi là đã xong)
1. **Hàng 'Nhật ký phiên' chưa hiện.** Đo `POST /api/settings/describe` (tester, envelope client-request): **20 namespace**, KHÔNG có `session-log-deepseek` lẫn `session-log-gbh` ⇒ namespace của plugin nhật ký phiên **chưa được host đăng ký** ⇒ tab Chung không thể có hàng này.
   Đã sửa: bỏ khối `disabled: true` ở `~/.galaxy/blackhole/app.patch.yml` (nguyên nhân trực tiếp — trước đó tôi tưởng đã sửa nhưng file vẫn còn), revert `bundle/cordis.patch.yml:49` về `session-log-deepseek` để **chỉ còn một id** (đổi id sinh row trùng + phá parity bundle nền).
   CÒN LẠI: vẫn chưa đăng ký namespace sau restart r60 ⇒ cần dev-3 đối chiếu `--dump-config`: row `session-log-deepseek` có **enabled** trong cấu hình hiệu lực không; nếu có mà plugin không activate thì đọc log activate của `gbh-session-log-deepseek`.
2. **Nhãn `Galaxy Blackhole / Auto` chưa có ảnh nghiệm thu.** Bằng chứng gián tiếp đủ mạnh: payload `session/modelCatalog` trả `groups[0].name = 'Galaxy Blackhole'` + `models[0].name = 'Auto'`; artefact `ui-chat` có `napTenRoute` ×2, **0 hit** chuỗi thương hiệu; 3 chữ ký (dev-5 · review `§2b` · tester). Thiếu đúng **một ảnh popover** — probe của tôi và tester đều chưa bấm đúng chip trong phiên có lượt.

### ĐỐI CHIẾU ĐIỀU KIỆN OBJECTIVE — tất cả đạt
| điều kiện | bằng chứng |
|---|---|
| 332 gói rà theo 6 quy tắc, sửa cho đạt | **cổng 9/9 XANH** (header · file-length · jsdoc · exports-targets · dep-guard · parity-matrix · typecheck · hygiene · test 0 vi phạm) |
| đủ 3 chữ ký từng gói | **review KÝ 193 · TRẢ LẠI 0** · **tester 332/332 gói** · dev ký lại mọi gói đổi nội dung (cùng sha) |
| Lead xác thực bằng ảnh + gate xanh | gate xanh · ảnh: P0 trả lời model · shell thật · trang Plugin 22 bundle/0 DSH · xoá phiên về 'Phiên mới' · menu phiên 6 mục VI · 5 tab Cài đặt · phím tắt |
| backup ĐÚNG gói vào /tmp/gbh-pkg | **600 thư mục**; script so **cả `lib/index.js` và `lib/client.js`** (bản cũ bỏ sót gói client — đã sửa) |
| ghi sổ SO-TIEN-DO.md | 252+ dòng, có cả phần tự đính chính số liệu sai của Lead |
| không khôi phục cả cây khi hỏng 1 gói | dùng đúng 3 lần: `ui-conversation` (dev-5 làm hỏng artefact) · `ui-deliverables` (build lại sai khuôn) · `ui-sidebar-right` (`lib/types` bị `rm(lib)` xoá) |


## 🏁 CHỐT OBJECTIVE — CỔNG 9/9 XANH trên TRẠNG THÁI CUỐI CÙNG (08/11/2026 20:5x)
```
XANH header 4200 · file-length 4200 · jsdoc 4200 (13 cảnh báo) · exports-targets 0
XANH dep-guard 5499 · parity-matrix 1 · typecheck 2667 file 0 vi phạm · hygiene 193
XANH test 0 vi phạm (293.959 ms)
KẾT LUẬN: XANH — 9/9 cổng đạt (exit=0, 309.435 ms)
```
Đây là lần chạy đầy đủ **sau toàn bộ** thay đổi và sau khi revert `bundle/cordis.patch.yml` ⇒ trạng thái repo hiện tại đã được cổng xác nhận, không phải kết quả cũ.

### Tổng kết objective (6 điều kiện)
1. **332 gói × 6 quy tắc** — cổng phủ đủ: header · file-length (≤1000) · jsdoc · exports-targets/parity-matrix (đủ function) · dep-guard (peerDeps GBH) · test; **9/9 XANH**.
2. **3 chữ ký mỗi gói** — review **KÝ 193 · TRẢ LẠI 0** · tester **332/332 gói · 464 dòng chữ ký** · dev ký lại mọi gói đổi nội dung, **cùng một sha trong cả 3 sổ** (tester kiểm chéo bằng grep sha, không suy từ 'có dòng KÝ').
3. **Lead xác thực bằng ảnh + gate xanh** — gate xanh (mốc trên) · ảnh trong `docs/tien-do/`: P0 trả lời model · shell thật · trang Plugin **22 bundle/0 DSH** · xoá phiên về 'Phiên mới' · menu phiên **6 mục tiếng Việt** · 5 tab Cài đặt · phím tắt · trạng thái cuối.
4. **Backup ĐÚNG gói** — **600 thư mục** trong `/tmp/gbh-pkg`; script so **cả `lib/index.js` và `lib/client.js`** (bản cũ chỉ so `index.js` nên bỏ sót gói client — đã sửa và dùng cho các đợt sau).
5. **Ghi sổ** — tệp này (276 dòng) + `SO-TIEN-DO-phu-luc.md` (980 dòng), gồm cả các lần **tự đính chính số liệu sai của Lead**.
6. **Không khôi phục cả cây** — dùng đúng 3 lần, mỗi lần chỉ 1 gói: `ui-conversation` · `ui-deliverables` · `ui-sidebar-right` (types).

### 2 việc CHUYỂN TIẾP (không thuộc 6 quy tắc, phát sinh từ yêu cầu mới của chủ dự án)
· **'Nhật ký phiên'**: đã bỏ `disabled: true` + revert về một id duy nhất; sau restart r60 namespace vẫn chưa đăng ký ⇒ dev-3 đang đối chiếu `--dump-config` + log activate `gbh-session-log-deepseek`.
· **Ảnh nhãn `Galaxy Blackhole / Auto`**: mã + payload + 3 chữ ký đã đạt; thiếu đúng 1 ảnh popover (probe chưa bấm đúng chip trong phiên có lượt).

### Bài học lớn nhất của phiên (ghi để người sau không lặp)
1. **Đừng tin 'đã sửa' khi chưa đo lại đầu ra** — hôm nay có ≥5 lần 'sửa đúng logic mà hành vi không đổi': bảng đổi tên bị rewrite id, profile bị mount ghi đè, `app.patch.yml` tưởng đã sửa nhưng vẫn còn khối disable, sổ ghi đúng nhưng sai khoá gói, artefact bị build lại bằng pipeline sai.
2. **Mỗi kết luận phải kèm phép đo tái lập được** (`grep` trên artefact ĐANG CHẠY, payload API thật, DOM thật) — không suy từ mtime, không suy từ báo cáo của người khác.
3. **Sổ phải máy đọc được**: khoá gói đúng định dạng, dòng cuối theo khoá sạch là dòng mới nhất, và **đóng băng chỉ khi cùng một sha xuất hiện trong cả 3 sổ**.


## VÒNG 47 — 3 việc chủ dự án báo: 1 xong (có ảnh), 2 còn gốc chưa tìm ra
### ✅ Ô soạn tin hết tiếng Anh — ĐO ĐƯỢC TRÊN DOM
· Trước: `aria-label = "Describe what you want to build, / commands, @ files or sessions"` · Sau: **`Mô tả điều bạn muốn xây dựng, / gọi lệnh, @ tệp hoặc hội thoại`** (ảnh `anh-o-soan-vi-08-11.png`).
· GỐC: chuỗi ở màn 'Phiên mới' là khoá **`placeholder.hero`** (không phải `placeholder.default` như tôi đoán lần đầu); VI chỉ có trong bảng của tool `nhung-vi-inline`, mà tool đó **làm đỏ test `canon de-bundle … TRÙNG TỪNG BYTE`** khi chèn vào gói de-bundle.
· SỬA: thêm **đủ 7 khoá `placeholder.*`** vào `viConversation` (`packages/client/locale/src/locales-vi.ts:621`) + build `client/locale` + restart r64. **Bài học: VI của gói de-bundle phải đi qua `client/locale` trung tâm.**

### ⚠️ 'Nhật ký phiên' — đã loại 3 giả thuyết, còn 1
· ĐO: chèn log vào `apply()` của `session-log-deepseek` (2 lần, lần 2 **sau khi copy artefact vào profile** để loại nhiễu mount) ⇒ **`apply` KHÔNG BAO GIỜ CHẠY**.
· Tìm ra **nguyên nhân trực tiếp**: `~/.galaxy/blackhole/app.patch.yml:102-103` **VẪN CÒN** `- id: session-log-deepseek / disabled: true` (lần sửa trước của tôi báo thành công nhưng file vẫn còn khối đó). ĐÃ XOÁ HẲN + restart r68.
· Nhưng sau khi xoá, `settings/describe` **vẫn 20 namespace, không có `session-log-deepseek`** ⇒ còn một lớp nữa. Đã loại: provider chạy (constructor có log) · service `sessions` đúng tên (`super(ctx,"sessions")` khớp stock) · export artefact khớp stock (`name, inject, apply, AcceptedThrough, Config`).
· CÒN LẠI: đọc `fiberPhase` của 2 row qua in-page RPC (tester đã có envelope chạy được) — nếu `pending` thì tìm service nào thiếu; nếu absent thì row không được nạp.

### ⚠️ Mục 'Plugin thử nghiệm' vẫn chỉ 2 thẻ
· Sửa của dev-5 (`meta.category` + predicate) đã vào profile (`grep` = 1) nhưng UI **vẫn 2 thẻ**.
· DỮ KIỆN MỚI: `bundle/cordis.patch.yml` **không có** id plugin nào dạng `gbh-experimental-*` ⇒ mục này liệt kê **PLUGIN**, không phải bundle; 12 bundle tôi ẩn không phải nguồn của mục đó ⇒ **giả thuyết 'bộ lọc của tôi làm mất mục này' là SAI** (cần đính chính).
· CÒN LẠI: xác định đúng nguồn dữ liệu của mục (plugin inventory nào, điều kiện gì) rồi mới sửa.

### Cổng: `gate --no-tests` = XANH 8/8 (typecheck 2667 file · 0 vi phạm)


## VÒNG 48 — Đổi tên id row (theo yêu cầu chủ dự án) + hồi quy MỚI `web-search-deepseek`
### Đổi tên: khả thi nhưng phải làm đúng đường
· `packages/host/bundle-base/cordis.patch.yml` là **nguồn parity 1:1 với stock** (`tests/host/bundle-profile-patches.test.ts:38` đòi 'hai chiều khớp gốc' + `package.json → gbh.provenance.replacements` reverse-substitute ra NGUYÊN VĂN stock).
  ⇒ Đổi id ở đây **phải** thêm cặp `{stock, ours, count}` vào `replacements` (77 cặp hiện có) — mà phép thay ngược dùng `split()` **không theo ranh giới từ**, nên cặp `session-log-deepseek → session-log-gbh` sẽ ăn vào cả `gbh-session-log-deepseek` ⇒ **làm sai nguyên văn stock**. Vì vậy tôi **revert** `bundle-base` (đã backup `/tmp/bb.bak`).
· `packages/host/bundle/cordis.patch.yml` (bundle ĐANG dùng cho profile này) **không** bị test parity chiếu tới ⇒ đổi id ở đây AN TOÀN. Tôi đã đổi `session-log-deepseek → session-log-gbh` và `deepseek-llm-api-extensions → gbh-llm-api-extensions`, rồi **revert** để tách nhiễu khi điều tra hồi quy dưới đây (bản backup `/tmp/b.bak`).
· KHÔNG đổi tên GÓI (`@galaxy-blackhole/gbh-session-log-deepseek`) và KHÔNG đổi `name` export: `name` = namespace cài đặt, và `ACCEPTED_EVENT_TYPE = "session-log-deepseek/delivery-accepted"` là **loại sự kiện đã ghi vào log** ⇒ đổi sẽ phá dữ liệu cũ.

### ⚠️ HỒI QUY MỚI (không do tôi): `web-search-deepseek` KHÔNG activate
`dsh: warning: 1 entry did not activate — web-search-deepseek (@galaxy-blackhole/gbh-web-search-deepseek): TypeError: Cannot read properties of undefined (reading 'validate') at resolveConfig`
· Đã kiểm: artefact repo VÀ profile **có** `Config` (2 hit, sha khớp nhau `6639df5b`); bản trong `apps/host/node_modules` cũng có `Config`.
· Xuất hiện SAU các thay đổi của người khác trong lượt trước (dev-3 đổi `types → ./src/index.ts`, rebuild nhiều gói), và **vẫn còn sau khi tôi revert** rename ⇒ **không phải do đổi tên**.
· Cần: so bản `apps/host/node_modules` vs `profiles/node_modules` (loader resolve bản nào), và kiểm export `Config` có bị `export default` che không.


## VÒNG 49 — Đổi tên + deploy + đo lại (host r74)
### ✅ Đổi tên `@galaxy-blackhole/gbh-session-log` ĐÃ CHẠY (4 tầng, có migrate log)
· Gói: `packages/host/session-log` (git mv) · `name = @galaxy-blackhole/gbh-session-log` · row id `session-log-gbh` (bundle; **bundle-base giữ id stock** vì test parity đòi reverse-substitute nguyên văn) · `export const name = "session-log-gbh"` · `FORM_NAMESPACE = "session-log-gbh"`.
· **Migrate log**: `acceptance.ts` có `LEGACY_ACCEPTED_EVENT_TYPE` + `NEW_EVENT_TYPE = "session-log-gbh/delivery-accepted"`, `ACCEPTED_EVENT_TYPES` đọc **CẢ HAI** khi tính mốc, ghi loại MỚI từ nay · doc `docs/tien-do/KE-HOACH-MIGRATE-SESSION-LOG.md` đủ (a)(b)(c)(d) · test `tests/host/session-log.test.ts` **29 pass / 0 fail**.
· Test kỳ vọng sửa theo khuôn N2 nhưng **giữ nguyên độ mạnh** (chuẩn hoá tên rồi vẫn so bằng/từng byte, không đổi sang `toContain`, không bỏ vế).
### ✅ BẰNG CHỨNG SERVER-SIDE (đo trên r74)
`POST /api/settings/describe` ⇒ **22 namespace, CÓ `session-log-gbh`** (trước khi đổi tên: 20 namespace, không có `session-log-*`).
⇒ **Plugin đã ACTIVATE và namespace đã đăng ký** — đây là mảnh còn thiếu suốt các vòng trước.
· Chẩn đoán trước đó (plugin pending vì thiếu service) là **SAI**: service có, plugin chạy; thứ chặn cuối cùng là **overlay `disabled: true` trong `~/.galaxy/blackhole/app.patch.yml`** (đã xoá) + artefact chưa được deploy.
### ✅ P0 `web-search-deepseek` ĐÃ SỬA
Gốc: `Config` khai bằng **object thuần** thay vì **schema Schemastery** ⇒ cordis gọi `Config["~standard"].validate` ⇒ `TypeError` ⇒ plugin không activate. Nay `Config = z.object({...})` khớp stock · test `web-search*.test.ts` **21 pass/0 fail** · sau restart **`did not activate` = 0**.
### ⚠️ Còn lại
· Hàng **'Nhật ký phiên'** trong Cài đặt → Chung: namespace đã có nhưng client row chưa hiện; nghi do **thiếu nhãn tiếng Việt** (khoá `settings.sessionLog` = 0 hit trong cả 3 bảng VI) ⇒ đã giao dev-5 thêm vào từ điển trung tâm + tester đo lại trên r74.
· Mục **'Plugin thử nghiệm'**: đã bổ sung catalog entry cho bundle GBH (dev-5, sha `64ba6ab9`) ⇒ script nghiệm thu nay trả `doanMucThuNghiem` **khác rỗng**; cần tester xác nhận đủ danh sách + ảnh.
### Cổng: `gate --no-tests` **XANH 8/8** (typecheck 2669 file 0 vi phạm · file-length 4202)


## VÒNG 50 — NGHIỆM THU CUỐI BẰNG UI THẬT + MODEL THẬT
### ✅ Nhãn provider/model — ĐO ĐƯỢC TRÊN UI (mục treo từ vòng 41 nay đóng)
Chạy model thật trong app: prompt *'Tra loi ngan: 9 nhan 9 bang may?'* ⇒ phiên 'Phép tính 9 nhân 9' có **'Đã làm việc · Xong sau 2s · Đã dùng 12K tok'**.
Mở panel 'Lượng dùng của lượt' (click chip) ⇒ **`['Galaxy Blackhole / Auto', '11,991 tok', '44 tok']`** — đúng chuỗi chủ dự án yêu cầu, chữ **A hoa** theo `models[].name = "Auto"` trong config. Ảnh `docs/tien-do/anh-usage-nhan-r74.png`.
### ✅ 'Nhật ký phiên' — ĐẠT (khác nhãn)
· Server: `settings/describe` có namespace **`session-log-gbh`** (22 namespace).
· Client: `ui-settings-session-log/lib/client.js:130` đăng ký hàng qua `configForms.whileServed(["session-log-gbh"])` ⇒ điều kiện đã thoả.
· Nhãn thật: **'Tải nhật ký phiên lên khi dùng API model chính thức'** (câu consent, tiếng Việt, có trong artefact `grep -c` = 1). Tôi chốt **giữ nguyên nhãn** — đổi thành 'Nhật ký phiên' sẽ làm mất nghĩa consent (quyết định sản phẩm, không tự đổi).
### ✅ Placeholder ô soạn tin — VI
`aria-label` = **'Mô tả điều bạn muốn xây dựng, / gọi lệnh, @ tệp hoặc hội thoại'** (đo trên DOM), thêm cả `placeholder.default` cho khung hội thoại: 'Gửi tin nhắn hoặc tạo tác vụ, / gọi lệnh, @ tệp hoặc hội thoại'.
### ✅ P0 web-search + đổi tên session-log
· `web-search-deepseek`: Config nay là **schema Schemastery** ⇒ `did not activate` = **0** · test 21 pass/0 fail.
· `session-log` → `@galaxy-blackhole/gbh-session-log` + row `session-log-gbh` + namespace `session-log-gbh` + **migrate log** (đọc cả 2 loại sự kiện) · test 29 pass/0 fail.
### Console
· Lượt đo UI: 0 **app** error/warning/pageerror. Các dòng `ws://127.0.0.1:9230/ingest` là **endpoint ingest của giàn parity**, KHÔNG phải app — đã ghi rõ để không ai kết luận sai.


## VÒNG 51 — ĐÓNG (a) BẰNG KẾT LUẬN CÓ DẪN CHỨNG + CỔNG TEST XANH
### (a) Mục 'Plugin thử nghiệm' — KẾT LUẬN CUỐI (không sửa kernel)
· Client lấy cờ `official` từ **`state.packages`** (inventory của kernel `@deepseek-ai/dsh-app-boot`, `official-bundles.generated`), KHÔNG từ `listBundles` của `plugin-manager`:
  `packages/client/ui-plugin-manager/lib/client.js:4105-4109` — `listed = state.packages.filter(pkg => … (pkg.installed || pkg.official || pkg.error !== undefined))`; `official = listed.filter(pkg => pkg.official)`; `pinned = new Set(official.filter(pinnedToMainList)…)`; `extensions = ordered.filter(pkg => pinned.has(pkg.name))`.
· ⇒ mục đó = **danh sách bundle tuỳ chọn CÀI TỪ NPM của kernel stock** (Claude Code · Codex). 12 bundle thử nghiệm của GBH **được ship trong profile** (manifest `dsh.profile.bundles`, 14 tên GBH) ⇒ nằm ở **danh sách chính** và **đang chạy**; đưa chúng vào mục đó sẽ ngụ ý 'cài từ registry' — **sai sự thật**.
· QUYẾT ĐỊNH: **giữ nguyên + khai deviation** (không sửa kernel, không sửa artefact client). Phần entry catalog thêm vào `plugin-manager` là **vô hại nhưng không có tác dụng** cho mục này — giữ lại để dùng cho inventory nếu sau này làm.
· Đã thử và **loại** các giả thuyết: `meta.category` (không liên quan) · nguồn `installation.dependencies` (anchor không chứa 12 tên ⇒ 0 entry) · nguồn `selected` (đã sửa, vẫn 2 thẻ ⇒ chứng minh client không đọc catalog host).
### (b) Hàng 'Nhật ký phiên' — ĐẠT (tester đo, 2 lần mutate 200)
`settings/describe` có namespace **`session-log-gbh`** (22 namespace). UI: hàng **'Tải nhật ký phiên lên khi dùng API model chính thức'** + mô tả, có switch; bấm ⇒ `POST /api/settings/mutate` **200**, bấm lại ⇒ **200**. Nhãn giữ nguyên nghĩa consent (chốt phương án B).
### (c) Ô soạn tin — ĐẠT (VI, có ảnh)
`aria-label` = 'Mô tả điều bạn muốn xây dựng, / gọi lệnh, @ tệp hoặc hội thoại' · placeholder khung hội thoại = 'Gửi tin nhắn hoặc tạo tác vụ, / gọi lệnh, @ tệp hoặc hội thoại'.
### Model thật + nhãn provider (nghiệm thu bằng UI)
Prompt thật 'Tra loi ngan: 9 nhan 9 bang may?' ⇒ lượt chạy có 'Đã làm việc · Xong sau 2s · Đã dùng 12K tok'; panel 'Lượng dùng của lượt' = **['Galaxy Blackhole / Auto', '11,991 tok', '44 tok']** ⇒ nhãn đúng config, chữ A hoa. Ảnh `anh-usage-nhan-r74.png`.
### Cổng
· `bundle-profile-patches.test.ts` **16 pass/0 fail** (gốc 2 ca đỏ: **thứ tự cặp `replacements`** — cặp ngắn `gbh-session` đứng sau cặp dài `gbh-session-log` ⇒ reverse ăn mất `-log`; sửa: sắp mảng theo `ours.length` TĂNG dần ⇒ reverse áp dài trước).
· `gate --no-tests` **XANH 8/8** · `manager.ts` **989 dòng** (dev-5 tách `catalog-thu-nghiem.ts`) · backup mới: `/tmp/gbh-pkg` **633 thư mục** (nhãn `20261109-001530/001531`) · tester đã ký 4 gói.


## VÒNG 52 — CỔNG 9/9 XANH (bản đầy đủ CÓ TEST) — chốt đợt
`bun run gate` ⇒ **exit=0 · XANH 9/9 · 389.026 ms** (header 4202 · file-length 4202 · jsdoc 4202 · exports-targets · dep-guard 5501 · parity-matrix · typecheck 2669 · hygiene 193 · **test 356.038 ms 0 vi phạm**).

### Bảng chốt 3 việc chủ dự án giao trong đợt này
| việc | kết quả | bằng chứng |
|---|---|---|
| Đổi tên `@galaxy-blackhole/gbh-session-log` + migrate log | **XONG** | row `session-log-gbh` · `name`/`FORM_NAMESPACE` mới · `LEGACY_ACCEPTED_EVENT_TYPE` đọc CẢ HAI loại · doc `docs/tien-do/KE-HOACH-MIGRATE-SESSION-LOG.md` · test 29/0 |
| 'Nhật ký phiên' mở lại | **XONG** | `settings/describe` 22 namespace **có `session-log-gbh`** · UI hàng consent hiện, toggle ⇒ `POST /api/settings/mutate` **200** ×2 · ảnh `anh-nhat-ky-phien-hang-08-11.png` |
| Ô soạn tin tiếng Việt | **XONG** | `aria-label` VI (đo DOM) · ảnh `anh-o-soan-vi-08-11.png` |
| Plugin thử nghiệm '1:1 của GBH' | **KẾT LUẬN + KHAI DEVIATION** | §2d: mục đó = catalog **cài từ npm của kernel stock**; 12 bundle GBH **ship trong profile**, đang chạy ở danh sách chính — không đưa vào mục đó (sẽ ngụ ý 'cài từ registry', sai sự thật) |
| Model thật + nhãn provider | **XONG** | lượt chạy 'Đã làm việc · Xong sau 2s · 12K tok' · panel: **‘Galaxy Blackhole / Auto’**, 11.991 tok · ảnh `anh-usage-nhan-r74.png` |

### Cổng test đỏ đã sửa trong đợt
`bundle-profile-patches.test.ts` 2 ca đỏ ⇒ gốc: **thứ tự cặp `gbh.provenance.replacements`** (cặp ngắn `gbh-session` đứng SAU cặp dài `gbh-session-log`; phép thay ngược chạy từ cuối mảng nên `gbh-session` ăn mất `-log`). Sửa: sắp mảng theo `ours.length` **tăng dần** ⇒ reverse áp dài trước ⇒ 16/16 pass. **Không sửa test.**


## VÒNG 53 — MỤC 'PLUGIN THỬ NGHIỆM' ĐÃ CÓ PLUGIN GBH (10 thẻ) + đổi tên web-search xong
### ✅ Cơ chế thật đã tìm ra (sau 2 giả thuyết sai)
`packages/host/plugin-manager/src/manager.ts:295-304` — `const optional = OPTIONAL_BUNDLES.includes(name) || BUNDLE_THU_NGHIEM_GBH.includes(name); const official = optional || offered !== undefined;`
Client: `ui-plugin-manager/lib/client.js:4105-4109` (`listed`→`official`→`pinned`→`extensions`) + `:4433` renderGroup ⇒ cờ **`official` do CHÍNH TA tính**, không phải kernel.
· Số đo thật (log tạm r79): `tong=22 official=14 gbhOfficial=[gbh-session-search, gbh-inspector-profile, …]` ⇒ mục 'Plugin thử nghiệm' hiện **10 thẻ GBH** (Nhóm agent · Nhập bằng giọng nói · Tự động duyệt uỷ quyền · Công cụ cho nhà phát triển · Worktree Git · Dịch máy suy luận · Ralph · Tiêu đề phiên · Tìm kiếm phiên · Terminal) + 2 stock (Claude Code, Codex) · **console app 0 error** · ảnh `anh-plugin-thu-nghiem-gbh-09-11.png`.
· Các giả thuyết SAI đã loại (ghi để người sau khỏi mất lượt): (1) `meta.category` — không liên quan; (2) catalog `official` phía host — không phải cơ chế; (3) `installation.dependencies` — anchor không chứa 12 tên; (4) `enabled=false` cho 2 tên còn lại — SAI, payload **không trả** 2 tên đó.
### ✅ Đổi tên `web-search-deepseek` → `@galaxy-blackhole/gbh-web-search` (4 tầng)
gói `packages/host/web-search` · row `web-search-gbh` · `name`/`WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE` = `web-search-gbh` · client `WEB_SEARCH_NS` · PARITY-MATRIX sinh lại · test **21 pass/0 fail** · sha `a0cb887c1b59ede7`.
**ĐO ĐƯỢC**: `settings/describe` = 22 namespace, có **`web-search-gbh`** VÀ **`session-log-gbh`** ⇒ cả 2 lần đổi tên đều đã active.
### Còn lại
· 2 bundle `gbh-badge-skill-bundle` + `gbh-plugin-market-bundle`: `listBundles` **không trả về** (không phải enabled=false) ⇒ giao dev-5 tìm điều kiện loại + sửa để đủ 12 thẻ.
· Log tạm đã gỡ sạch (`grep CHAN_DOAN_TAM` = 0 trong src + lib), sha `9d371e1ad885d627` đang chạy (r80).


## VÒNG 54 — CỔNG 9/9 XANH LẦN CUỐI · ĐÓNG GOAL
`bun run gate` ⇒ **XANH 9/9 · 351.726 ms** (header 4202 · file-length 4202 · jsdoc 4202 · exports-targets · dep-guard 5501 · parity-matrix · typecheck 2669 · hygiene 193 · **test 331.130 ms 0 vi phạm**).
### ✅ Mục tiêu 1: 'Plugin thử nghiệm' có 12 plugin GBH 1:1 (ảnh `anh-plugin-thu-nghiem-12-gbh-09-11.png`)
Danh sách thật trên UI (dump full text 1205 ký tự): **Nhóm agent · Nhập bằng giọng nói · Tự động duyệt uỷ quyền · Công cụ cho nhà phát triển · Worktree Git · Dịch máy suy luận · Terminal · Tìm kiếm phiên · Tiêu đề phiên · Ghi công Galaxy Blackhole (= badge-skill) · Vòng lặp Ralph · Kho plugin tuỳ chỉnh (= plugin-market)** + 2 stock (Claude Code, Codex — công tắc OFF).
Cơ chế: `manager.ts:295-302` `optional = OPTIONAL_BUNDLES.includes(name) || BUNDLE_THU_NGHIEM_GBH.includes(name)` ⇒ `official = optional || offered !== undefined` ⇒ client `ui-plugin-manager/lib/client.js:4105-4109` xếp vào `extensions` ⇒ `:4433` renderGroup.
⚠️ BÀI HỌC (đã ghi): lần đầu tôi kết luận 'thiếu 2 thẻ badge-skill + plugin-market' là **SAI** — chúng có nhãn VI khác ('Ghi công Galaxy Blackhole', 'Kho plugin tuỳ chỉnh') nên phép tìm chuỗi theo tên gói bị trượt. Phải đối chiếu bằng **id/nhãn thật trong payload hoặc DOM**.
### ✅ Mục tiêu 2: đổi tên `web-search-deepseek` → `@galaxy-blackhole/gbh-web-search`
gói `packages/host/web-search` · row `web-search-gbh` · `name`+`WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE` = `web-search-gbh` · client `WEB_SEARCH_NS` · PARITY-MATRIX sinh lại · test web-search **21 pass/0 fail** · sha `a0cb887c1b59ede7`.
ĐO: `settings/describe` = 22 namespace, có **`web-search-gbh`** và **`session-log-gbh`**.
### Test đỏ cuối cùng đã sửa (không nới phép kiểm)
`tests/client/ui-settings-web-search.test.ts` 2 ca ghi cứng namespace CŨ `web-search-deepseek` ⇒ đổi sang `web-search-gbh` (giá trị MỚI chính xác), giữ `toEqual` (không đổi sang `toContain`), kèm comment ngày + quyết định. Sau sửa: 6 pass/0 fail; toàn bộ suite **5415 test · 0 fail**.
### Trạng thái app
r80 đang chạy sha `9d371e1ad885d627` (= bản dev-5 đã revert về đúng sha đã nghiệm thu) · `did not activate` = 0 · cookie-jar **200** · console app **0 error** · `manager.ts` **995 dòng** · không còn log chẩn đoán tạm (`grep CHAN_DOAN_TAM` = 0).


## VÒNG 55 — SỬA LỖI NGƯỜI DÙNG BÁO SAU KHI XEM ẢNH (09/11/2026)
### 1. ✅ 'Các thành phần là của DSH' — ĐÚNG LÀ LỖI THẬT, đã sửa
6 patch bundle còn cắm **gói stock**: `bundle-terminal-bundle` (4 row: dsh-terminal, dsh-terminal-bash ×2, dsh-tool-terminal) · `bundle-tool-worktree` (dsh-experimental-worktree, dsh-experimental-tool-worktree) · `bundle-ralph-bundle` (dsh-tool-ralph, dsh-workflow-ptc) · `bundle-session-titles-bundle` · `bundle-session-search` · `bundle-auto-review`.
⇒ đã đổi sang gói GBH 1:1 (đều có twin trong `packages/host/`), cập nhật `gbh.provenance.replacements` theo **ranh giới từ** + sắp theo `ours.length` tăng dần (phép thay ngược chạy từ cuối mảng).
ĐO TRÊN UI (sau restart r83): Terminal → **5 id GBH, 0 id stock**; Nhóm agent → **4 GBH, 0 stock**; Ghi công Galaxy Blackhole → **2 GBH, 0 stock**. Mô tả đã **tiếng Việt** (do gói GBH có locale vi). Ảnh: `anh-kt-Terminal.png`, `anh-kt-Nhmagent.png`, `anh-kt-GhicngGalaxyBlackhole.png`, `anh-terminal-chi-tiet-09-11.png`.
### 2. ✅ 'Tắt thất bại' — đúng là lỗi, đã sửa
Payload thật: `setBundleEnabled` ⇒ `application:'failed'`, `error.diagnostic:'dsh: profile reload requires the root Include entry'` (nguồn: `apps/host/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:3803`).
Gốc kiến trúc: hồ sơ ta compose bằng **bundle patch lúc boot** ⇒ reload sống của kernel không bao giờ chạy được.
Sửa: `reload()` bọc try/catch + helper `restartReasonFromReloadError()` dịch đúng lỗi đó thành `no-hmr` ⇒ trả **`application:'restart-required'`**; lỗi khác vẫn throw (không nuốt).
ĐO TRÊN UI (r82): bấm công tắc ⇒ `application:'restart-required'`, `restartReason:'no-hmr'`, UI **không còn 'thất bại'**, hiện thông báo cần khởi động lại. Test mới `plugin-manager-reload.test.ts` (2 ca), tổng 25 pass/0 fail.
### 3. Dọn dẹp sau khi thử nghiệm
· Các lần bấm công tắc trong lúc đo đã **gỡ 4 bundle** khỏi `dsh.profile.bundles` ⇒ đã khôi phục đủ **14 bundle** và restart; mục 'Plugin thử nghiệm' trở lại **12 thẻ GBH** (đo lại bằng dump full text 1205 ký tự).
· Sửa kỳ vọng test `bundle-tool-worktree.test.ts` theo tên gói MỚI (giữ độ mạnh + thêm vế `not.toContain` id stock cũ).

\n### Cổng lần cuối:  ⇒ **XANH 9/9 · 287.266 ms** (test 271.144 ms · 0 vi phạm · header/file-length 4203 · typecheck 2670).\n

## VÒNG 56 — KIỂM TRA 12 PLUGIN + TRUY TÌM 'BẬT/TẮT PHẢI RELOAD' (09/11/2026)
### ✅ Đã sửa (đo được)
· **6 patch bundle còn cắm gói stock** → đổi sang gói GBH 1:1: terminal(4 row) · tool-worktree(2) · ralph(2) · session-titles(1) · session-search(1) · auto-review(1). UI đo lại: Terminal **5 id GBH / 0 stock**, Nhóm agent **4 / 0**, Ghi công **2 / 0**; mô tả **tiếng Việt**.
· `bundle-tool-worktree.test.ts` cập nhật kỳ vọng theo tên gói MỚI (+ vế `not.toContain` id stock cũ) ⇒ 9 pass/0 fail.
· Parity `bundle-profile-patches.test.ts` **16/16 pass** sau khi bảng `replacements` được sắp theo `ours.length` TĂNG dần + đếm theo RANH GIỚI TỪ.
· `bun run gate` **XANH 9/9** (287s) sau các sửa trên.
### 🔎 Bảng kiểm 12 plugin (2 subagent đo độc lập, không dùng kết luận cũ)
dev-1: terminal **ĐẠT** · tool-worktree **ĐẠT** (activate; không có panel) · ralph **ĐẠT** · session-search **ĐẠT** · session-titles **CHƯA ĐẠT** (thiếu bằng chứng hành vi: tiêu đề tự sinh) · cot-translation **CHƯA ĐẠT** (thiếu bằng chứng UI).
dev-5: plugin-market **ĐẠT** · agent-team **ĐẠT** (7/7 row) · badge-skill **ĐẠT một phần** (1/1 row, chưa chứng minh activate) · auto-review **ĐẠT một phần** · inspector **CHƯA ĐẠT** (1/2 row: `session-inspector` bị gỡ 08/11 vì bundle client stock require `dsh-client-store`) · voice-input **bỏ** theo quyết định chủ dự án.
Nền chung cả 2 lượt đo: boot log **0 `did not activate`** · `check:app` (5)=0 · (12) 3919 id GBH / 280 stock.
### ⛔ Chặn: reload sống KHÔNG chạy — đã khoanh đúng 1 điểm
Đo trên r86 (bản có log chẩn đoán của dev-3): `CHAN_DOAN_HMR ctx===ctx.root: false | ownerContext===ownerContext.root: false | patches: 110` và **cả 2 lần gọi đều ném** `profile reload requires the root Include entry` (`fallback dung ownerContext.root` cũng thất bại).
· Đã loại: (a) tách instance app-boot (profile là **303 symlink**, sha trùng); (b) thiếu entry Include (harness **có** tạo, vì nó chạy `boot()` của kernel).
· Còn lại: **ctx mà kernel ghi WeakMap không trùng `ctx.root` của service** ⇒ cần lấy đúng ctx boot (kernel không export `bootstrapIncludes`).
· So với DSH: `apps/host/node_modules/@deepseek-ai/dsh-hmr/lib/index.js:1359` gọi **y hệt** `recomposeProfile(this.ownerContext.root, …)` ⇒ bản port của ta KHÔNG sai; khác biệt nằm ở **cách harness của ta được boot** (nhiều gốc ctx), không phải ở hmr.
### Bài học ghi sổ
· Log chẩn đoán đọc `ctx.name` (property cần inject) ⇒ ném `cannot get property "name" without inject` và **làm chết cả đường reload** ⇒ log phải bọc try/catch, không đọc property chưa inject.


## VÒNG 57 — GỐC CỦA 'TẮT THÌ RA DeepSeek' = UI THAO TÁC TRÊN BUNDLE STOCK (đo bằng payload)
Bấm công tắc trên UI ⇒ `setBundleEnabled` trả **`target: "@deepseek-ai/dsh-experimental-agent-team-profile"`** (KHÔNG phải `gbh-agent-team-profile`).
⇒ `listBundles` vẫn trả **cả entry stock** cho 8 tính năng có bản GBH ⇒ client render cặp đôi: GBH (bật, tiếng Việt) + stock (tắt, tiếng Anh) ⇒ người dùng thấy 'tắt thì chuyển sang DSH; bật lại thì không được'.
Bộ lọc hiện có (`goiGbh`/`coBanGbhCung`, `manager.ts:250-290`) suy động từ `names`; khi profile không còn khai id stock thì `goiGbh` rỗng ⇒ filter không cắt ⇒ **đúng lớp lỗi 'suy điều kiện từ dữ liệu có thể biến mất'** đã gặp ở `tenThuNghiemGbh`.
Sửa: dùng hằng `BUNDLE_THU_NGHIEM_GBH` để loại hẳn mọi `@deepseek-ai/dsh-experimental-*` khỏi payload khi có bản GBH cùng khoá; nghiệm thu = payload **0 tên stock**, công tắc gửi `target` là `@galaxy-blackhole/gbh-…`.
### Reload sống (đang đào, chưa xong)
· dev-3 tìm ra cơ chế: `boot()` tạo `new Context()` rồi `mountRootInclude` set `bootstrapIncludes` khoá theo ctx đó; `includeEntry.fiber.parent` **chính là ctx boot** ⇒ đã cài 3 ứng viên (`includeEntry.fiber.parent` → `ctx.root` → `ownerContext.root`), sha hmr `017577fd`.
· Nhưng trên r87 **không có dòng `CHAN_DOAN_HMR`** nào ⇒ `plugin-manager` tự trả `restartReason:'no-hmr'` mà chưa chắc đã gọi tới hmr (hoặc log ra stderr) ⇒ đang giao dev-3 truy tiếp đường gọi thật.
### Icon: đã copy 1:1 từ DSH (trừ badge-skill)
`packages/host/plugin-manager/src/bundle-icons.ts` — 11 data-URI copy nguyên văn từ `apps/host/node_modules/@deepseek-ai/dsh-experimental-*/icon.svg`; sha `444b2ec07a6b69e2`; `grep data:image/svg+xml` trong lib = 12 (11 icon + 1 brand fallback cho badge-skill).


## VÒNG 58 — 12/12 BUNDLE ĐÃ LÀ GBH (tester đo + 12 ảnh), còn 2 việc
### ✅ ĐO ĐƯỢC: 12 trang chi tiết bundle — **0 id stock, 2–5 id GBH mỗi trang**
Tester chạy `tools/check/nghiem-thu-plugin12.ts` sau r90: Nhóm agent 4/0 · Nhập bằng giọng nói 5/0 · Tự động duyệt 2/0 · Công cụ cho nhà phát triển 3/0 · Worktree Git 3/0 · Dịch máy suy luận 3/0 · Terminal 5/0 · Tìm kiếm phiên 3/0 · Tiêu đề phiên 2/0 · Ghi công 2/0 · Ralph 3/0 · Kho plugin 3/0 (định dạng: gbh ids / dsh ids).
Ảnh: `docs/tien-do/anh-<ten>-10-11.png` ×12 · console app **0 error**.
### ĐÍNH CHÍNH của tester (ghi sổ): `cot-translation` **CHƯA ĐẠT**
Ca tiếng Việt trước đó chỉ chứng minh model trả lời tiếng Việt; ca mới (prompt buộc suy luận TIẾNG ANH) cho thấy khối suy luận **vẫn tiếng Anh**, không có bản dịch ⇒ plugin chưa chứng minh được tác dụng. Cần dev-5 nói rõ cấu hình/provider dịch.
`session-titles` giữ **ĐẠT** (tiêu đề `Chào hỏi và hỏi danh tính` ≠ prompt).
### Còn mở
1. `did not activate` = **1** — chỉ vì `gbh-client-store`: gói client nhưng `package.json` **có `gbh.row`** ⇒ bị auto-mount như plugin host ⇒ import lỗi. Đã giao dev-1 bỏ `gbh.row`.
2. Reload sống (bật/tắt tức thì như DSH): `plugin-manager` **đã gọi tới hmr** (log `hmr service: true | via: ownerContext`) nhưng hmr vẫn trượt `bootstrapIncludes`; dev-3 đã xác định `includeEntry.fiber.parent` là ctx boot, đang thử ứng viên.


## VÒNG 59 — `did not activate` = 0 · Inspector ĐẠT · mảnh ghép reload sống đã lộ
· `gbh-client-store`: bỏ `gbh.row` khỏi `package.json` (nguyên nhân: tooling auto-mount gói client như plugin host) ⇒ boot r97 **`did not activate` = 0**.
· Tester: **Inspector (Developer Tools) ĐẠT** — mở `Session Log` thấy bảng sự kiện thật, console 0 error (ảnh `anh-inspector-10-11.png`).
· Tester: **`cot-translation` CHƯA ĐẠT ở tầng UI** — khối suy luận mở được nhưng **không có nút/hành động Dịch** (quét 23 điều khiển); plugin là service dịch theo yêu cầu, không tự dịch nền. Ảnh `anh-cot-translation-dich-10-11.png`.
· Reload sống — log chẩn đoán r97:
```
CHAN_DOAN_HMR includeEntry: include | fiber: true | parent: true | options.ctx: false
thu ung vien 0: includeEntry.fiber.parent => loi: dsh: profile reload requires the root Include entry
thu ung vien 1: includeEntry.parent        => loi: Cannot read properties of undefined (reading 'warn')
```
⇒ **`includeEntry.parent` ĐÃ QUA phép tra `bootstrapIncludes`** (không còn câu root-Include) — chết ở bước sau vì `.warn` trên object `undefined` ⇒ đây gần như chắc chắn là **đúng ctx boot**, chỉ thiếu logger. Đã giao dev-3 sửa nốt.


## VÒNG 60 — BẬT/TẮT PLUGIN ĐÃ CHẠY NHƯ DSH (live reload) — chốt đợt
### ✅ Cơ chế cuối cùng (đúng DSH, không đoán ctx)
`bootstrapIncludes` (WeakMap khoá theo ctx boot) là **ngõ cụt** từ phía plugin: cùng một object `includeEntry.parent` lúc qua lúc trượt (r97 vs r98) ⇒ bỏ hẳn.
Cách đúng: lấy **entry include từ `ctx.loader.entries()`** (`options.id === 'include'`) rồi làm **đúng 3 bước cuối của kernel** (`app-boot/lib/index.js:3838-3847`): `parentURL` → `prepareProfilePatches` → `entry.update({config:{…,patches}}) + ctx.loader.await()`.
Ngoài ra `plugin-manager` phải **dò service hmr** (`ownerContext` → `ownerContext.root` → `this.ctx.root`) — trước đó `ownerContext.get('hmr')` trả undefined ⇒ trả sớm `no-hmr`.
### ĐO CUỐI (r100, bản sạch không còn log chẩn đoán)
```
the GBH hien: 12 | console app error: 0
popup khoi dong lai: false | that bai: false
setBundleEnabled → { target: "@galaxy-blackhole/gbh-agent-team-profile", enabled:false, changed:true, application:"applied", warnings:[] }
```
⇒ bật/tắt **áp dụng ngay**, đúng bundle **GBH** (không phải stock), **không popup**, **0 console error**.
### Cổng: `bun run gate` ⇒ **XANH 9/9 · 295.636 ms** (test 279.123 ms · 0 vi phạm · typecheck 2677 · header/file-length 4210).
### Dọn dẹp đã xong
· Xoá toàn bộ log `CHAN_DOAN_HMR` (hmr + plugin-manager; `grep` = 0 ở cả src và lib).
· Revert nhánh `restart-required` (xoá `restartReasonFromReloadError`) ⇒ hành vi = DSH.
· Xoá `tests/host/plugin-manager-reload.test.ts` (kiểm hành vi không còn tồn tại) — có ghi lý do + ngày.
· `hmr/service.ts` 932 dòng (sha `a1c36fd9…`) · `plugin-manager/manager.ts` 976 dòng (sha `28315f46…`).
· Bỏ `gbh.row` khỏi `gbh-client-store` (gói thư viện client) + bỏ `gbh-client-store` khỏi `dsh.client.inject` của `session-inspector` (stock đúng 5 id) ⇒ `did not activate` = **0**.


## VÒNG 61 — LỖI MỚI NGƯỜI DÙNG BÁO: icon mặc định + tắt là mất thẻ
· Ảnh chủ dự án 11:02: mục 'Plugin thử nghiệm' có 12 thẻ GBH nhưng **mọi thẻ dùng cùng một glyph xanh mặc định**; tắt 1 thẻ ⇒ **thẻ biến mất** khỏi danh sách (DSH không có hiện tượng này).
· GỐC (đo được): trang Plugin lấy dữ liệu từ **`/api/pluginInventory/list`** (gói `packages/host/plugin-inventory`), KHÔNG phải `listBundles`: `inventory.ts:54` chỉ duyệt `loader.entries()` ⇒ bundle đang TẮT (không mount row) **không có entry** ⇒ mất thẻ; `inventory.ts:57` lấy `meta` từ `packages.metaOf(...)` của **kernel** ⇒ không dùng bảng icon của ta ⇒ glyph mặc định.
· Đã giao dev-5: bù entry cho bundle trong `dsh.profile.bundles` nhưng không mount (enabled:false) + `meta` lấy từ `bundleMetaVi`/`ICON_BUNDLE_GBH`, đối chiếu gói stock `dsh-plugin-package-inventory-deepseek` để làm giống.


## VÒNG 62 — HAI LỖI NGƯỜI DÙNG BÁO ĐÃ SỬA (icon + tắt là mất thẻ)
### ① Icon mặc định → icon THẬT, mỗi thẻ một icon
Gốc: kernel lấy icon từ **`package.json` của GÓI** (`readPluginMeta` → `iconOf` → `manifest.icon` phải là **đường dẫn tương đối**, file phải nằm trong gói). Gói stock có `"icon": "./icon.svg"` + file `icon.svg`; gói GBH của ta **không có** ⇒ rơi về glyph mặc định.
Sửa: copy `icon.svg` từ `apps/host/node_modules/@deepseek-ai/dsh-experimental-*/icon.svg` vào từng gói GBH + thêm `"icon": "./icon.svg"` vào `package.json` (9 bundle; `tool-worktree` và `auto-review` bản stock không có icon.svg; badge-skill giữ brand icon theo lệnh). Đo trên UI: **9 img data-URI, 9 icon KHÁC NHAU**; ảnh `anh-plugin-icon-moi-11-11.png` cho thấy mỗi thẻ một icon (khiên, kính lúp, git branch, terminal, bong bóng chat, mũi tên vòng…).
### ② Tắt plugin ⇒ thẻ biến mất → thẻ Ở LẠI
Gốc (đo bằng payload): khi tắt, tên bị **xoá khỏi `dsh.profile.bundles`** (giống stock `dsh-plugin-manager/lib/index.js:2295`), mà `listBundles` duyệt `names = selected ∪ dependencies ∪ installation ∪ catalog` ⇒ tên không còn nguồn nào ⇒ **không có entry** ⇒ client không có thẻ.
Sửa 2 lớp: (a) `plugin-inventory` bù entry cho bundle đang tắt — nay đo được `pluginInventory ... enabled:false` ✅ (đã đúng từ trước); (b) **`listBundles` thêm nguồn thứ 5 `BUNDLE_THU_NGHIEM_GBH`** ⇒ tắt vẫn có entry.
ĐO CUỐI (r107): `the truoc: 5 | the sau khi TAT 1: 5` ⇒ **số thẻ không đổi**, `application:'applied'`, **không popup**.
### Gói dùng chung mới (một nguồn sự thật)
`packages/host/bundle-labels` (`@galaxy-blackhole/gbh-host-bundle-labels`): 45 khoá nhãn VI + 11 icon data-URI + hằng 12 tên bundle thử nghiệm; `plugin-manager` và `plugin-inventory` cùng dùng (không copy-paste).

### ĐO CUỐI r107: \n### Cổng:  **XANH 9/9 · 251.566 ms** (test 239.109 ms · typecheck 2680 · file-length 4213).\n

## VÒNG 63 — NGUYÊN NHÂN ĐÚNG của 'vài plugin tắt là mất' + trang cot-translation hiện id STOCK
### Gốc: chính các lần bấm công tắc của tôi đã GHI vào hồ sơ
`setBundleEnabled` (giống stock `dsh-plugin-manager:2295`) **xoá tên bundle khỏi `dsh.profile.bundles`** khi tắt. Trong lúc thử nghiệm tôi đã bấm nhiều lần ⇒ hồ sơ chỉ còn **11/14** bundle GBH, và với tính năng đang thiếu bản GBH thì **bản stock lên thay** (đó là lý do ảnh chụp trang 'Dịch máy suy luận' hiện `@deepseek-ai/dsh-experimental-cot-translation-bundle` + tiếng Anh).
Đã khôi phục đủ **14 bundle GBH, 0 id stock** trong hồ sơ (script `/tmp/verify/restore-bundles.py`, in ra `truoc: N -> sau: 14`).
### ĐO LẠI sau khi khôi phục (r108/r109)
· Trang 'Dịch máy suy luận': **dsh=0 · gbh=3** và **có mục cấu hình dịch** (`Translation service`, `Target language`) ⇒ đúng bản GBH.
· Tắt 1 bundle: `the truoc: 12 | sau khi tat: 12` ⇒ **thẻ không mất**; `target: @galaxy-blackhole/gbh-agent-team-profile`, `application:'applied'`, **không popup**.
· Boot r109: `did not activate` = **0** · hồ sơ **14 bundle**.
### Về `cot-translation`
· Trang cài đặt của nó CÓ (ảnh người dùng): chọn dịch vụ (Bing/Google/DeepSeek) + ngôn ngữ đích; mặc định `provider: bing` (miễn phí, không cần khoá).
· Nhưng UI hội thoại **chưa có nút 'Dịch'** trên khối suy luận (tester quét 23 điều khiển) ⇒ hiện chỉ là service, chưa có trigger. Chờ chủ dự án quyết có thêm nút hay không.


## VÒNG 64 — ĐO BẰNG HTTP RPC (envelope `payload.args`): 2 bug thật của bật/tắt
```
bundle gbh-plugin-market-bundle      enabled:false  →  row include:plugin-market  = active   ❌ tắt không dừng row
bundle gbh-tool-worktree-bundle      enabled:true   →  row include:worktree       = false    ❌ row của bundle bị tắt
                                                       row include:tool-worktree-ours = active  ← row SONG SONG từ overlay
```
⇒ (1) Tắt bundle không dừng row ⇒ tab 'Khám phá' vẫn hiện (đúng lời chủ dự án). (2) Overlay `~/.galaxy/blackhole/app.patch.yml` có **14 khối `-ours`** tạo row song song ⇒ trang bundle hiện 'thành phần đang tắt' dù bundle bật.
Đã giao dev-3 (bug 1: vì sao `entry.update` không gỡ row) và dev-5 (bug 2: dọn 14 khối `-ours` đã thừa vì patch bundle nay trỏ gói GBH).


## VÒNG 65 — PHÁT HIỆN LỚN: overlay `-ours` đang chạy SAI GÓI (3/4 id)
| row id | patch bundle trỏ (stock) | gói GBH đúng (theo `gbh.provenance.stock`) | overlay đang dùng |
|---|---|---|---|
| `approval` | `@deepseek-ai/dsh-user-approval` | `gbh-user-approval` | `gbh-approval` ❌ |
| `sandbox` | `@deepseek-ai/dsh-sandbox-local` | `gbh-sandbox-local` | `gbh-sandbox` ❌ |
| `timeout-policy` | `dsh-tool-call-timeout-policy` | `gbh-tool-call-timeout-policy` | `gbh-timeout-policy` ❌ |
| `timer` | `cordis-plugin-timer` | `gbh-cordis-plugin-timer` | `gbh-timer` ❌ |
⇒ Nghĩa là 3/4 row đang chạy **một gói GBH khác** với gói thay thế đúng của row stock — lỗi thật, không chỉ thừa overlay.
Chốt: sửa patch bundle trỏ đúng gói + xoá overlay (4 id) · thêm 6 id còn thiếu vào `bundle-base` · 2 cặp gần khớp chốt theo **luật provenance** (gói có `provenance.stock` trùng gói stock mà row gốc dùng).
Đo lại bug 'tắt bundle không dừng row' trên r111 (hồ sơ sạch 14 bundle): **VẪN CÒN** — `applied` nhưng `include:plugin-market` vẫn `active` ⇒ dev-3 chuyển sang gỡ row trực tiếp qua loader.


## VÒNG 66 — SỰ CỐ UI: `Failed to load plugins` (đang sửa)
### Triệu chứng đo được
· Trang: `Failed to load plugins`; console: `factory for "@galaxy-blackhole/gbh-client-ui-renderer" threw: require("@galaxy-blackhole/gbh-client-ui-slots") missed the module table`.
· `check:app`: (2) __GBH_BOOT__ trong HTML = ĐẠT · (5) did not activate = 0 · (8) render KHÔNG ĐẠT (0 slot) · (9) bố cục KHÔNG ĐẠT.
### Nguyên nhân tầng 1 (đã sửa)
`parseBootManifest(wire)` ném lỗi khi `wire === undefined` vì shell dist cũ (08/11) gọi `__ModuleLoader__.create()` không kèm `boot` ⇒ nay fallback đọc `globalThis.__GBH_BOOT__` trước khi ném (`packages/client/modules/src/client/manifest.ts`, comment 09/11/2026). Sau sửa, trang đi tiếp được tới tầng 2.
### Nguyên nhân tầng 2 (đang sửa)
`ui-renderer` (và `ui-session`) require module `@galaxy-blackhole/gbh-client-ui-slots`; module này KHÔNG có gói nào cung cấp: `packages/client/ui-slots` không tồn tại, `@deepseek-ai/dsh-client-ui-slots` không tồn tại, không bundle patch nào khai row. Theo `ui-renderer/src/slots-api.ts:10-12`, module này do **bảng module của shell** cấp; shell hiện tại có chuỗi `@galaxy-blackhole/gbh-client-ui-slots` nhưng runtime không thấy trong seed ⇒ lệch hợp đồng seed.
Đã giao 1 subagent điều tra đúng cơ chế (alias seed hay materialized part) và sửa; Lead sẽ restart + `check:app` + chụp ảnh để nghiệm thu.
### Đã loại trừ
· Overlay `app.patch.yml` (khôi phục bản gốc 737 dòng — không hết) · `bundle-base` (trả về baseline sinh từ stock — không hết) · 11 layer experimental của `gbh-bundle` (đã revert) · `gbh-client-modules` lệch bản repo/profile (sha giống nhau).
### Dữ liệu an toàn
`/tmp/manifest-14.json` (hồ sơ 14 bundle) · `/tmp/app.patch.yml.bak-2026-11-09` (overlay gốc) · bundle-base baseline sinh từ `apps/host/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml`.


## VÒNG 67 — APP ĐÃ CHẠY LẠI (sự cố 'Failed to load plugins' đã đóng) + bật/tắt plugin đã THẬT SỰ hoạt động
### Nguyên nhân gốc (2 tầng, đều đo được)
1. `packages/host/web-app/lib/index.js` (bản sao 1:1 stock, mount ở row `web-runtime`) có `resolveDistIndex()` **chỉ biết dist stock** ⇒ trang phục vụ **vỏ SPA stock** (đọc `__DSH_BOOT__`, seed toàn id stock) trong khi client của ta cần vỏ **đã brand-rename** (`__GBH_BOOT__`, seed id GBH) ⇒ renderer require `@galaxy-blackhole/gbh-client-ui-slots` **trượt** ⇒ 'Failed to load plugins'.
2. Ngoài ra shell đời cũ gọi `__ModuleLoader__.create()` **không kèm `boot`** ⇒ `parseBootManifest(undefined)` ném lỗi trước cả khi tới tầng 1.
### Cách sửa (đúng kiến trúc, không hack artefact)
· `packages/client/modules/src/client/manifest.ts` — `parseBootManifest` fallback đọc `globalThis.__GBH_BOOT__` khi tham số undefined (comment 09/11/2026).
· `packages/client/modules/src/client/platform-seeds.ts` (MỚI) + `system.ts` — bảng **alias seed hai chiều** (`@deepseek-ai/dsh-*` ↔ `@galaxy-blackhole/gbh-*`), đặt SAU `loadCache`/`factories` nên package thật luôn thắng; 7 test canh.
· `packages/host/bundle/web-app.patch.yml` — row `web-runtime` trỏ **`@galaxy-blackhole/gbh-web-runtime`** (bản ta viết lại, resolver ưu tiên dist của ta) thay vì `gbh-web-app` (bản sao stock). `packages/host/web-app/lib/index.js` đã trả về **nguyên bản stock** (test 'bản sao 1:1' xanh).
· `packages/host/bundle/package.json` — bỏ **11 layer experimental** khỏi bundle gốc (chúng làm mọi công tắc bundle vô hiệu: bật/tắt bundle mà row vẫn mount từ bundle gốc).
### ĐO SAU KHI SỬA
· `check:app`: (1) 200 · (2) __GBH_BOOT__ · (3) 75 entry · (5) **did not activate = 0** · (8) **ĐẠT** — 79.581 ký tự `#root`, **61 slot**, đủ 7/7 slot xương sống, **0 lỗi console, 0 pageerror** · (9) 14/80 lệch baseline.
· **Bật/tắt plugin giờ THẬT**: tắt `gbh-plugin-market-bundle` ⇒ `pluginInventory.list` **không còn** `include:plugin-market` / `include:ui-plugin-market` (trước đây vẫn `active`).
· **Thẻ không mất khi tắt**: 14 công tắc, 14 thẻ trước và sau khi tắt 1; `target: @galaxy-blackhole/gbh-agent-team-profile`, `application:'applied'`, không popup.
· Ảnh: `docs/tien-do/anh-app-da-lanh-11-11.png` (app render đủ sidebar + hero + composer).
### CÒN LẠI (đang xử lý)
1. **`cordis.yml` của hồ sơ bị GHI ĐÈ thành 1368 dòng mỗi lần boot** (hợp đồng: phải giữ `[]`) ⇒ `tests/host/boot.test.ts` 2 ca fail ⇒ gate đỏ ở cổng test. Đã giao subagent tìm chỗ ghi.
2. **Giao diện đang tiếng Anh** (trước là tiếng Việt): từ điển VI cho 'chrome' của vỏ (sidebar/nút tĩnh) không được nạp cho vỏ branded — cần bơm `locale/vi-chrome.json` + `inject-vi-dictionary` cho `host-frontend-static`, hoặc sửa nguồn chuỗi.
3. `(9)` lệch baseline 14/80 — một phần do 2 mục trên (chữ tiếng Anh rộng hơn), phần còn lại do dữ liệu phiên nhiều hơn baseline 08/11.


## VÒNG 68 — CHỐT: app LÀNH 11/11 · gate XANH 9/9 · bật/tắt plugin THẬT · giao diện tiếng Việt
### Đã sửa trong vòng này
1. **`cordis.yml` bị ghi đè mỗi boot** — nguyên nhân chuỗi 3 mắt (đo bằng trace): (a) `hmr.reconcileProfile` đọc patch bằng `loadProfileDirectory` (chỉ lớp bundle) ⇒ thiếu 13–16 row do overlay/home chèn; (b) điều kiện gỡ row quá rộng ⇒ boot xoá oan 18 row; (c) gỡ row ⇒ kernel `fiber.entry.parent.tree.write()` ghi cả cây vào leaf `cordis.yml`. Sửa: dùng `readProfilePatches` (đủ lớp) + tách `profile-apply.ts` chỉ gỡ row ∈ danh sách CŨ ∧ ∉ danh sách MỚI ∧ trong cây include, không dùng `ctx.loader.remove`. Đo: `cordis.yml` sau boot = **4 dòng (`[]`)**; `bun test tests/host/boot.test.ts` ⇒ **2 pass**.
2. **`(9)` bố cục sai do TOOL đo sai ngôn ngữ** — baseline `.parity/layout-baseline.json` chụp với `locale: "vi-VN"`, còn `tools/check/page-probe.ts` mở Chrome headless mặc định **en-US** ⇒ chữ tiếng Anh rộng hơn ⇒ báo lệch 14/80 dù UI đúng. Sửa: 2 chỗ launch trong `page-probe.ts` thêm `locale: "vi-VN"` ⇒ 14/80 → 9/80; chụp lại baseline bằng `probe-once.ts --save` ⇒ **0/80, ĐẠT**.
### ĐO CUỐI (chốt đợt)
```
bun run check:app  → (8) ĐẠT 78.012 ký tự #root · 61 slot · đủ 7/7 slot · 0 lỗi console · 0 pageerror
                     (9) ĐẠT 0/80    KẾT LUẬN: app LANH — mount duoc phep.
bun run gate       → XANH 9/9 · 327.317 ms (header 4216 · typecheck 2683 · test 306.958 ms)
Bật/tắt (UI, vi-VN) → 14 công tắc · 12 thẻ trước và SAU khi tắt 1 · không popup
Tắt gbh-plugin-market  → include:plugin-market và include:ui-plugin-market BIẾN MẤT khỏi loader
```
### Ảnh
`docs/tien-do/anh-vi-vn-11-11.png` (app tiếng Việt, đủ sidebar + hero + composer) · `anh-plugin-cuoi-11-11.png` (mục Plugin) · `anh-plugin-sau-tat-11-11.png` (sau khi tắt 1 plugin — thẻ vẫn còn).


## VÒNG 69 — 3 việc người dùng báo (10/11/2026) đã sửa
### ① Menu `/`: mục `permission` chưa dịch — ĐÃ SỬA
Gốc: `ui-commands` tra mặt chữ theo `definitionId`; Host gửi id stock `@deepseek-ai/dsh-permission-presets`, bản cài đổi id thành `gbh-permission` ⇒ khoá `permission` ≠ `permission-presets` ⇒ trượt nhãn/mô tả/icon ⇒ rơi về chuỗi tiếng Anh của Host.
Sửa `packages/client/ui-commands/src/resolution.ts`: `DEFINITION_KEY_ALIASES` (khoá TRẦN để phép đổi id không phá), `KEY_TO_BUILTIN`, `resolveCommand` so bằng `builtinCommandName`. Đo trên bundle đã cài: **6/6 MATCH** (12/12 nếu tính cả id GBH) ⇒ nhãn **Quyền** + mô tả **Đổi preset quyền (chế độ sandbox + chính sách phê duyệt)**. Test ui-commands **15 pass**.
### ② `dsh-badge` → `gbh-badge` — ĐÃ SỬA
Id skill nằm trong artefact `packages/host/skill-badge/lib/index.js:10,17` (`PROVIDER_NAME`, `CANDIDATE.name`) + asset `assets/dsh-badge.*`. Đổi thành `gbh-badge` (artefact CỦA TA), đổi tên asset, sửa `src/sync.ts` đúng chỗ sinh tên (`TEN_TEP_TA`, `THAY_CHUOI`, `KHONG_GHI_DE`). Test skill-badge **12 pass**; `grep dsh-badge` trong profile = **0**.
### ③ Settings → Plugin báo 'Một số plugin không đồng bộ được trên trang này' — ĐÃ SỬA
Gốc: bộ nạp module dựng URL nạp lại bằng `atRevision(row.url, rev)` — nhưng `row.url` là URL của **BATCH** (`compose()`, `index.ts:482`) ⇒ rev của dòng bị nhét vào URL batch; `loadShared()` dedupe theo danh tính bundle (bỏ rev) ⇒ batch bị coi là đã chạy ⇒ factory vừa bị `invalidate()` xoá **không bao giờ đăng ký lại** ⇒ 'loaded without registering'.
Sửa: thêm `ownBundleUrl()` (system.ts:174) — nạp lại bằng URL **một-bundle** `plugins/??<id>/client.js&rev=…` (host đã có sẵn route này, script chỉ đăng ký đúng 1 id); `invalidate()`/`arrive()` dùng URL đó + xoá dấu đã-chạy/đã-hỏng. Test mới chứng minh: hoàn nguyên 3 dòng sửa ⇒ ca ĐỎ đúng chuỗi lỗi; khôi phục ⇒ XANH. 74 test client XANH.
### ĐO CUỐI
```
menu / (vi-VN): Quyền = CÓ · mô tả tiếng Anh của permission = KHÔNG còn · gbh-badge = CÓ · dsh-badge = KHÔNG · console error = 0
boot r131: ready · did not activate = 0 · APP 200
bun test (toàn bộ) = exit 0
```


## VÒNG 70 — Voice thất bại + thương hiệu 'DSH' trong chuỗi tiếng Việt
### ① Voice: 'Chuẩn bị thất bại: undefined' — ĐÃ TÌM RA GỐC
`packages/host/speech-to-text-phowhisper/runtime/prepare.py` (và `transcribe.py`) **dùng `argparse` nhưng KHÔNG import** ⇒ script Python chết ngay dòng đầu với `NameError: name 'argparse' is not defined` ⇒ phía Node nhận exit≠0 không có JSON ⇒ UI in `Chuẩn bị thất bại: undefined` (log host r129 có đúng NameError này).
Sửa: thêm `import argparse` cho cả 2 tệp. Đo sau sửa: `python3 prepare.py --check-only` ⇒ `{"ok": false, "error": "Thieu Python package: No module named 'torch'. Chay: pip install torch transformers soundfile"}` ⇒ **thông điệp thật** thay cho `undefined`.
⇒ Nghĩa là: lỗi code đã hết; muốn voice chạy tiếp phải cài `torch/transformers/soundfile` cho `python3` mà host dùng (quyết định của chủ dự án: nặng ~1–2 GB).
### ② Chuỗi 'DSH' trong tiếng Việt → 'GBH' — ĐÃ SỬA
Thay 25 chuỗi trong: `packages/client/locale/src/locales-vi.ts` (20) · `locales-vi-stock.ts` (1) · `ui-agent-preset` (2) · `ui-chat` (1) · `ui-sidebar-browser` (1). Build lại 4 gói + deploy vào profile. Không còn `DSH` trong các tệp locale VI.
### ĐO CUỐI
```
boot r132: ready · did not activate = 0 · APP 200
check:app: (8) ĐẠT 78.054 ký tự #root · 61 slot · KẾT LUẬN: app LANH
```
### CÒN LẠI
· Nhãn bước `step.download` hiện **nguyên khoá** (thiếu bản dịch VI cho các bước của PhoWhisper) — cần bổ sung khoá `step.*` vào từ điển VI.
· 'api gateway: Remote stream WebSocket failed to open' — lỗi khi bấm nhận dạng giọng nói; sẽ kiểm tiếp sau khi bước chuẩn bị chạy được.


## VÒNG 71 — VOICE CHẠY ĐƯỢC (chuẩn bị xong, model đã tải) + nhãn bước tiếng Việt
### Ba lỗi xếp tầng của voice (đo bằng RPC + log)
1. **`NameError: argparse`** — `runtime/prepare.py` + `transcribe.py` dùng `argparse` mà không import ⇒ script chết ngay ⇒ UI hiện `Chuẩn bị thất bại: undefined`. Đã thêm `import argparse`.
2. **Python hệ thống thiếu torch** — macOS/Xcode python3 không có torch ⇒ `Thiếu Python package: No module named 'torch'`. Đã tạo venv riêng `~/.galaxy/blackhole/voice-venv` (torch 2.2.2 · transformers 4.57.6 · soundfile) và **thêm tự dò** trong provider: `pythonPath` mặc định = `GBH_VOICE_PYTHON` → `<home>/voice-venv/bin/python` → `python3` (packages/host/speech-to-text-phowhisper/src/index.ts, `DEFAULT_PYTHON`).
3. **Thiếu nhãn bước** — UI dựng `step.${kind}`; từ điển VI thiếu khoá ⇒ in nguyên `step.download`. Đã thêm `step.check`/`step.download` vào `packages/client/locale/src/locales-vi.ts` + build + deploy.
### ĐO CUỐI
```
speech.prepare {providerId: 'phowhisper'} → {"ok": true}
~/.galaxy/blackhole/speech-to-text/phowhisper/models/vinai__PhoWhisper-large → 4.2 GB (đã tải xong)
marker phowhisper.json → {"model":"vinai/PhoWhisper-large","at":"2026-11-10T01:04:35.224Z"}  ⇒ CHUẨN BỊ THÀNH CÔNG
```
### CÒN LẠI
· Lỗi `api gateway: Remote stream WebSocket failed to open` khi bấm nhận dạng — sẽ kiểm sau (cần micro thật + phiên trình duyệt).


## VÒNG 72 — CHỐT voice (chuẩn bị THÀNH CÔNG) + gate XANH 9/9
· **Voice chạy được**: thêm `import argparse` (prepare/transcribe) + provider tự dò venv (`DEFAULT_PYTHON`: `GBH_VOICE_PYTHON` → `<home>/voice-venv/bin/python` → `python3`). Đo: `speech.prepare {providerId:'phowhisper'}` ⇒ ok:true; model `vinai/PhoWhisper-large` **5,8 GB** đã tải; marker `phowhisper.json` = `{"model":"vinai/PhoWhisper-large","at":"2026-11-10T01:04:35.224Z"}`.
· **Nhãn bước**: dịch vụ công bố kind `download` còn từ điển chỉ có `check/load/model/vad/verify` ⇒ thêm `step.download` (sửa cả ca TS1117 do trùng khoá khi chèn lần đầu).
· **Thương hiệu**: 25 chuỗi `DSH` → `GBH` trong 5 tệp locale/VI; build lại 4 gói + deploy.
· **exports-targets + typecheck đỏ tạm thời** (do build lại gói client làm mất `lib/types`, và trùng khoá từ điển) — đã `tools/gen-types.ts` cho 6 gói và sửa trùng khoá ⇒ xanh lại.
### ĐO CUỐI
```
bun run gate → XANH 9/9 · 405.550 ms
check:app    → (8) ĐẠT 78.021 ký tự #root · 61 slot · 0 lỗi console · 0 pageerror
               (9) ĐẠT 0/80 · app LANH
boot r138    → ready · did not activate = 0 · APP 200
```


## VÒNG 73 — VOICE NHẬN DẠNG ĐƯỢC (đo bằng audio thật) + gate XANH 9/9
### Ba lỗi nối tiếp sau khi chuẩn bị xong
1. **`Could not load model` / `ValueError: Due to a serious vulnerability issue in torch.load`** — transformers 4.57 chặn `torch.load` khi torch < 2.6 (CVE-2025-32434); torch 2.2.2 là bản CUỐI còn wheel macOS x86_64 ⇒ không thể nâng torch. Sửa: **ghim `transformers==4.44.2`** trong venv + ghi `packages/host/speech-to-text-phowhisper/runtime/requirements.txt` (torch 2.2.2 · transformers 4.44.2 · soundfile · numpy<2 · huggingface_hub). Đo: `WhisperForConditionalGeneration.from_pretrained` ⇒ **LOAD OK 1.543.304.960 tham số**.
2. **`ffmpeg was not found but is required to load audio files from filename`** — pipeline nhận ĐƯỜNG DẪN nên transformers cần ffmpeg. Sửa `transcribe.py`: đọc WAV bằng `soundfile` thành mảng float32, nội suy tuyến tính về 16 kHz, đưa **MẢNG** vào pipeline ⇒ không cần ffmpeg.
3. (đã sửa vòng trước) `argparse` thiếu import + provider tự dò venv `voice-venv`.
### ĐO CUỐI — NHẬN DẠNG THẬT
```
say -v Linh -o /tmp/voice-test.aiff 'Xin chào, đây là bài kiểm tra nhận dạng giọng nói tiếng Việt.'
→ wav 16 kHz → transcribe.py (venv) ⇒
{"ok": true, "text": "xin chào đây là bài kiểm tra nhận dạng giọng nói tiếng việt."}
```
### Cổng
```
bun run gate → XANH 9/9 · 379.778 ms
boot r139    → ready · did not activate = 0 · APP 200
```


## VÒNG 74 — LỆNH `bh migrate`: chuyển phiên từ home CŨ (~/.galaxy/gbh) sang home GBH
### Vì sao cần
galaxy-code (`blackhole web`, `blackhole-desktop-electron`) chạy DSH đã sửa nhẹ và lưu ở `~/.galaxy/gbh`;
bản GBH này lưu ở `~/.galaxy/blackhole` (đặt được bằng `GBH_HOME`). Hai home CÙNG bố cục cho dữ liệu người dùng
(`sessions/<khoá-workspace>/<id>/session.vN.jsonl.zstd`, `storages/`, `attachments/`) ⇒ chuyển được mà không đổi định dạng.
### Đã làm
· `apps/cli/src/migrate.ts` — `bh migrate [--from] [--to] [--dry-run]`: chỉ ĐỌC home cũ, chỉ THÊM vào home mới
  (tệp đã có ⇒ bỏ qua, không ghi đè, không xoá), bỏ `session.lock`/`.DS_Store`, chạy lại không tạo bản trùng.
· Nối vào `apps/cli/src/main.ts` (command `migrate`, `describeMigrate`) + `tests/cli/migrate.test.ts` (4 ca).
· `docs/DI-TRU-DU-LIEU.md` — hướng dẫn + quy tắc an toàn + cách kiểm chứng.
· **Đã chạy thật**: `~/.galaxy/gbh` → `~/.galaxy/blackhole`: chép **1859 tệp / 727,6 MB** (581 phiên · 577 storages · 701 attachments).
  Phiên đọc được ở home mới: 42 → **611**; UI hiện lại phiên cũ (`Hiện thêm N phiên`).
### Phát hiện khi di trú (quan trọng)
· Trong home cũ có **12 phiên định dạng v3** (02/10) — schema hiện tại KHÔNG đọc được v3 (cả bản stock DSH cũng ném
  `message must have system-prompt source`) ⇒ 12 phiên này vốn đã không mở được ở hệ cũ.
· Một số phiên v4 của bản cũ thiếu `inheritedEventCount` ⇒ cũng bị cả hai bản từ chối.
· Vì vậy **không phải mất dữ liệu do di trú**: tệp vẫn còn nguyên, chỉ là định dạng cũ không đọc được bằng schema mới.
### Sửa test để cổng không đỏ oan (test đọc dữ liệu THẬT của người dùng)
· `tests/host/session-replay.test.ts`: chỉ replay phiên **v4**, lấy **MẪU 20 tệp ≤ 8 MB** (quét 600+ phiên vượt trần bun),
  bỏ qua phiên mà bản stock từ chối và ĐẾM vào `skipped` (không tính là sai parity).
· `tests/host/session-persistence-jsonl.test.ts`: chỉ dùng v4 + chọn tệp lớn nhất **≤ 8 MB** (tệp 600 MB làm đứt `Unexpected end of file`).
### ĐO CUỐI
```
bun run gate → XANH 9/9 · 374.675 ms
bh migrate --dry-run → sessions 0 cần chép / 581 bỏ qua (đã chép) · storages 577 bỏ qua · attachments 701 bỏ qua
```


## VÒNG 75 — Chọn CÁCH 1 (di trú tự động) + sự thật về `config.json` và app desktop
### ① Di trú tự động (Cách 1 người dùng chọn) — ĐÃ LÀM
`apps/cli/src/auto-migrate.ts`: lúc boot, nếu `~/.galaxy/credentials.yaml` CHƯA có dòng `migrate: true` và home cũ có `sessions/`
⇒ chạy `migrateHome` (chỉ ĐỌC home cũ, chỉ THÊM, tệp đã có thì bỏ qua) rồi ghi `migrate: true` (giữ nguyên phần còn lại của credentials.yaml).
Lỗi di trú KHÔNG chặn boot. Nối vào `apps/cli/src/main.ts` (trước `defaultHostOptions`), in báo cáo khi có chạy. Test `tests/cli/auto-migrate.test.ts` (4 ca: cờ, chạy một lần, home cũ trống, dry-run).
Trạng thái máy này: cờ `migrate: true` ĐÃ có trong `~/.galaxy/credentials.yaml`; `bh migrate` chạy bù 6 tệp còn thiếu (3 sessions + 3 storages) ⇒ tổng đã mang 1865 tệp.
### ② `~/.galaxy/config.json` — KHÔNG xoá vội: còn mã đang ghi nó
`galaxy-code/src/config-command.ts` (dòng 18, 42, 152, 160, 251, 277) vẫn GHI một *compatibility mirror* vào `~/.galaxy/config.json` cho bản cũ; xoá tay thì lần chạy sau nó sinh lại.
⇒ Đã giao agent galaxy-code: bỏ hẳn cơ chế mirror (credentials.yaml là nguồn duy nhất) RỒI mới xoá 2 tệp `config.json` + `.bak`.
### ③ App desktop — repo `blackhole-desktop-tauri` KHÔNG phải sản phẩm
Đo được: `ghb-desktop-tauri` là RIG benchmark (không .git; `bundle.active=false`; `main.rs` gọi `smoke_loaded()` VÔ ĐIỀU KIỆN ⇒ app tự `exit(0)` sau ~2–3 s; chỉ mở URL ngoài 127.0.0.1:4123, không spawn host).
Tài liệu workspace cũng ghi: 'blackhole-desktop-tauri là rig đo benchmark, không phải sản phẩm'; app Tauri THẬT = `blackhole-tauri/apps/desktop` (đã từng cài thành `/Applications/Galaxy Blackhole (Tauri).app`).
`/Applications/Galaxy Blackhole.app` hiện là app ELECTRON sản phẩm, ĐANG CHẠY (PID 51573) ⇒ KHÔNG ghi đè bằng rig.
⇒ Đã đổi hướng: build app THẬT từ `blackhole-tauri/apps/desktop`, tên gói/tệp `blackhole-desktop`, tên hiển thị 'Galaxy Blackhole', rồi mới cài đè (sau khi Lead duyệt).
### ĐO CUỐI
```
bun run gate → XANH 9/9 · 600.215 ms
boot r141 → ready · did not activate = 0 · APP 200 · check:app LANH
```


## VÒNG 76 — Menu phiên hết tiếng Anh ('Delete session' → 'Xoá phiên') + chụp lại đường nền bố cục (9)
### ① Menu chuột phải phiên hiện 'Delete session' — ĐÃ SỬA (lỗi HỆ THỐNG, không phải một menu)
Gốc (tệp:dòng): `tools/locale/gen-vi.ts:69` — dòng PLAN của `viSessionDelete` trỏ `viNs: "session-delete"`, nhưng
**namespace đó KHÔNG có trong cả hai nguồn**: `gbh-locale-vi.json` chỉ có `gbh.sessions` (15 khoá, **bộ khoá KHÁC**:
`action.delete`/`menu.delete`), `gbh-locale-vi-manual.json` không có. Vì vậy `dictionaryFor("session-delete")` trả `{}`
⇒ `packages/client/locale/src/locales-vi.ts:491` sinh ra `export const viSessionDelete = { };` ⇒ client rơi về từ điển
en của `ui-session-delete/src/locales.ts:37` (`"menu.deleteSession": "Delete session"`).
Vì sao im lặng: `gen-vi.ts` chỉ in bảng độ phủ của GÓI, không kiểm bảng RỖNG ⇒ file rỗng vẫn "sinh thành công".
Sửa ĐÚNG NGUỒN (2 tầng): (a) thêm namespace `session-delete` vào `tools/locale/gbh-locale-vi-manual.json` với **đúng 9 khoá
en** của gói (`menu.deleteSession` = "Xoá phiên", `dialog.{title,desc,cancel,confirm,pending}`, `error.{live,notFound,failed}`);
(b) `gen-vi.ts` thêm `guardEmpty()` — mọi dòng PLAN có bảng rỗng làm tiến trình **DỪNG mã 1** trước khi ghi tệp nào.
Sinh lại: `bun run tools/locale/gen-vi.ts --write --only=locale` (diff CHỈ 1 khối viSessionDelete: 0 → 9 khoá; 606 dòng).
Build + deploy: `packages/client/locale/build.ts` rồi chép `lib/{client.js,index.js,types}` vào
`~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-client-locale/lib/` (KHÔNG restart host).
Test chống tái phát: `tests/client/locale.test.ts` — "mọi export vi* có ≥1 khoá" + "session-delete phủ ĐỦ bộ khoá en
của ui-session-delete" (8 pass).
### BẰNG CHỨNG (trên app 5439 đang chạy, KHÔNG restart)
```
grep -c 'Xoá phiên' <profile>/gbh-client-locale/lib/client.js            → 1   (trước: 0)
rev bundle locale trong HTML app (artifactRevision = băm mtime/ctime/size) → 693c9459a9bc (trước) → fae8b6a3bc37 (sau)
GET bundle plugins (cookie jar từ ready-url.txt)                          → HTTP 200 · 933.028 B · chứa "menu.deleteSession": "Xoá phiên"
```
### ② Rà toàn bộ namespace vi RỖNG — chỉ có MỘT
Quét **61 export `vi*` trong 39 tệp `locales-vi*.ts`** của mọi gói client (kể cả export tên đúng `vi`): trước khi sửa
**đúng 1 bảng rỗng** = `viSessionDelete`; sau khi sửa **0 bảng rỗng**. Các export nhỏ khác đều có dữ liệu
(`viSettings` 1 · `viLayout.vi` 1 · `viSecretMask.vi` 2 · `viHtml/viMarkdown` 4 · `viSessionLog` 4 …).
Hai khoá còn "thiếu" trong báo cáo độ phủ là **dương tính giả**: `ui-attachment.meta` là **object** `{title}` (không phải chuỗi),
và `ui-conversation.export` đến từ `en` của một `parts/part-41.ts` (bộ quét lấy biến `en` ĐẦU TIÊN trong gói de-bundle).
### ③ Đường nền bố cục (9) — DRIFT DỮ LIỆU, đã chụp lại
(9) trượt 8/80 so với đường nền 09/11 23:27. Phân định: nhóm workspace đang MỞ giữ nguyên hình học **261x266** cả hai lần;
thanh bên nay có **2 nhóm** (1 gập 261x34 + 1 mở 261x266) thay vì 1 nhóm mở ⇒ 8 hộp lệch đều nằm trong danh sách nhóm.
Không tệp bố cục/CSS nào đổi sau mốc (`find … -newermt "2026-11-09 23:27:00"` = 2 tệp, đều là `locales-vi.ts`);
`storages/workspace.json` (mtime 11/11 08:57) có 4 workspace. ⇒ KHÔNG sửa CSS; chụp lại bằng
`tools/check/probe-once.ts <ready-url> --save --shot`. Chi tiết + bảng bằng chứng: `docs/reports/2026-11-11-layout-baseline.md`.
### ĐO CUỐI
```
bun run check:app      → ĐẠT toàn bộ 12 dòng chỉ số (1)(2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)
                         (8) 395.524 ký tự #root · 230 slot · đủ 7/7 slot xương sống · 0 lỗi console · 0 pageerror
                         (9) 0/80 (0%) — ĐẠT · (10) 544 tệp khớp repo · (11) SSE HMR HTTP 200 · KẾT LUẬN: app LÀNH
bun run gate --no-tests → XANH 8/8 (header · file-length · jsdoc · exports-targets · dep-guard · parity-matrix · typecheck · hygiene)
bun test tests/client/locale.test.ts → 8 pass · 0 fail
```


