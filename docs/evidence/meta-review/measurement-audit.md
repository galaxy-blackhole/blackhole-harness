<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc TASK-194 meta-review: audit cong cu do cua Lead (app-health, conversion-matrix, dsh-residue) va kiem cheo 3 tuyen bo.
-->
# Meta-review: audit "công cụ đo của Lead" (TASK-194)

- Người rà: **tm-reviewer** (độc lập, không dùng lại script của Lead để đo).
- Thời điểm: **2026-10-21 ~10:00–10:40** (Asia/Saigon).
- Trạng thái app lúc đo: `check:app` 79 entry · (5) 0 · gate 7/7 theo Lead; payload boot **79 entry / 11 batch**.
- Công cụ tự viết: `tools/check/audit-residue-gaps.ts`, `tools/check/audit-matrix-shim.ts`, `tools/check/audit-cdp-claims.ts`.
- Sự cố môi trường khi rà: `--dump-config` kích hoạt build và **fail ở `packages/client/ui-conversation`** (`ENOENT src/parts/01-requires.ts`) ⇒ mọi số liệu "entry gốc" phải đọc từ **patch đang sống + payload đang phục vụ** thay vì dump. (Bản thân sự cố này là rủi ro thật: lượt boot sau có thể chết vì gói đó.)

---

## 1. Bảng tổng hợp

| Công cụ | Đo cái gì (thật) | KHÔNG đo | Bằng chứng dương tính giả (tự chạy) | Oracle đề xuất |
|---|---|---|---|---|
| `tools/check/app-health.ts` (8) "#root + slot + lỗi" | Độ dài `innerHTML` của `#root`, số `[data-slot]`, lỗi console/pageerror | Nội dung có **đúng là UI DSH** không; phần tử có **hiển thị** không (đếm cả `display:none`); có **tương tác được** không | (a) nhánh `probed.skipped !== undefined` ⇒ `ok: true` khi Chrome không mở được (dòng 243–250) — Chrome hỏng = XANH. (b) 46 `[data-slot]` ẩn + 40.000 ký tự ẩn vẫn đạt cả hai ngưỡng. | So **DOM geometry + accessibility tree + text** với bản DSH stock ở cổng **5466** (tm-evidence dựng); fail-closed khi không có oracle. |
| `app-health.ts` (9) "bố cục khớp đường nền" | Diff hình học 80 hộp so với `.parity/layout-baseline.json` | Baseline lấy từ **chính app của ta** — không phải DSH stock ⇒ **tautology** (chỉ bắt hồi quy so với chính mình) | (a) baseline 80 box, class `div.pI_x6G_frame` là hash CSS-module **của ta**, mtime 20/10 00:39 — không có trường nguồn/commit/oracle. (b) thiếu baseline ⇒ `ok: true` (dòng 259). (c) `pct <= 2` ⇒ 1/80 lệch vẫn XANH; `total === 0` ⇒ XANH. | Baseline sinh từ **oracle 5466** (cùng viewport), có metadata `{sourceUrl, commit, capturedAt}`; fail-closed nếu thiếu; ngưỡng 0 lệch cho 80 hộp. |
| `app-health.ts` (5) "did not activate" | Đếm **dòng** chứa chuỗi `did not activate` trong `host-5439.log` | Log bị ghi đè mỗi lượt boot ⇒ lỗi cũ **bị xoá**; cảnh báo khác (vd `failed to import`) không khớp chuỗi ⇒ không đếm; log xoay vòng/không tồn tại ⇒ `-1` | Chạy boot 2 lần: log chỉ còn lượt cuối — sự kiện "did not activate" của lượt trước mất dấu. Ngoài ra log hiện có dòng `plugin-market … disabled expression failed` từng tồn tại mà (5) vẫn 0 vì khác chuỗi. | Lấy **audit khởi động có cấu trúc** (`auditStartupEntries`/event JSON) từ host, lưu log theo run-id, fail-closed nếu thiếu; đếm theo entry id chứ không theo dòng. |
| `app-health.ts` (3)/(7) "số entry" | Số phần tử `payload.entries` | Entry **là gói của ai**; entry có chạy thật/hiển thị không | Payload 79 entry nhưng URL batch vẫn chứa **2 tên stock**: `@deepseek-ai/dsh-client-ui-settings`, `@deepseek-ai/dsh-client-ui-directory-picker-native` ⇒ "entry gốc = 0" không suy ra được từ con số 79. | Đếm entry **theo nguồn gói** (path trong URL): `@galaxy-blackhole/*` vs `@deepseek-ai/*`; metric riêng "stock module trong payload" phải = 0. |
| `conversion-matrix.ts` "entry gốc còn chạy" | Cây `--dump-config` (offline) trừ `replacedIds` (id có `name: '@galaxy-blackhole/...'`, dòng 269–276) + `nestedRedirected()` | (a) Entry **client** (payload client vẫn chứa stock, xem trên). (b) Goi ta là **shim** nạp lại stock ⇒ bị trừ oan. (c) Row disabled bằng **biểu thức** `{js: …}` không phải `disabled: true` ⇒ bị tính là đang chạy (sai theo hướng ngược). | (a) Fixture: row stock `X` bị đổi `name: '@galaxy-blackhole/x'` ⇒ `replacedIds` loại X khỏi `activeStock` (che được) — đúng như dòng 269. (b) 2 tên stock trong payload **không** xuất hiện trong bất kỳ dòng matrix nào. | Đo **runtime resolution**: với mỗi entry đang phục vụ, đọc path thật (`profile
ode_modules` symlink → target); "stock" = target nằm trong `apps/host/node_modules/@deepseek-ai`. Đối chiếu **payload**, không chỉ dump. |
| `conversion-matrix.ts` dấu ✓ | `✓` = có **3 chữ ký** trong `conversion-signoff.json` **hoặc** `assetOnly` (dòng 321–325) | Chạy được không; đã mount chưa; đúng hành vi không | 20 gói `gbh.draft` (thư viện, chưa mount) và 2 binding win32 **không quan sát được trên darwin** vẫn `✓`; `dsh-web-frontend` `✓` bằng `assetOnly` không cần port. | `✓` cần thêm: (1) bằng chứng oracle A/B ở 5466; (2) mount/runtime proof; (3) gói không quan sát được đánh dấu **"?"** thay vì ✓. |
| `dsh-residue.ts` | Đếm chuỗi `DSH` + `dsh-[a-z0-9-]` trên **tài nguyên đang phục vụ** (index.html, bundle `plugins/??…`, CSS được nhắc trong index) | Repo sources, `.svg/.json/.css` không được tham chiếu, docs, binaries; `dshCamelCase`; `__dsh_`; `@deepseek-ai/`; **payload URL** (nơi lộ tên stock) | Tự đo trên bundle đang phục vụ: **DSH 178 · `dsh-` 1094 · `dshCamel` 17 · `@deepseek-ai/` 776**. Trong repo: **3208 / 6601 tệp** văn bản còn token (top: `packages/host/api-remotes/lib/client.js` 920, `tools/lint/parity-roles.ts` 395). Tool của Lead không thấy 17 camel + 776 scope refs. | Quét **repo + payload + tài nguyên phục vụ**, regex phủ `DSH|dsh-|dsh[A-Z]|dsh_|@deepseek-ai/`; tách 3 metric: (a) residue hiển thị, (b) refs nội bộ, (c) **stock package refs trong payload** = 0. |

---

## 2. Thí nghiệm tái lập được

### E1 — (9) là tautology
``.parity/layout-baseline.json` 80 hộp, class `div.pI_x6G_frame`/`div.pI_x6G_sidebarCol` là **hash CSS-module của repo ta**; không có nguồn/commit. `tools/check/probe-once.ts --save` ghi baseline từ **app của ta**. ⇒ (9) chỉ phát hiện "UI đổi so với lần ta lưu", **không** chứng minh khớp DSH.
Mã nguồn: dòng 257–259 (thiếu baseline ⇒ `ok: true`), dòng 274–278 (`total === 0` ⇒ XANH; `pct <= 2` ⇒ 1/80 lệch vẫn XANH).
**Thay**: baseline chụp từ oracle **5466** + metadata nguồn; fail-closed.

### E2 — (8) có thể XANH khi Chrome chết
Dòng 243–250: `probed.skipped !== undefined … ok: true`. Tức sự cố "không mở được Chrome" được tính là **ĐẠT** — đúng lớp dương tính giả người dùng cảnh báo.
**Thay**: skip ⇒ **KHÔNG KẾT LUẬN** (exit 2) như nhánh 401 đang làm, không được tính ĐẠT.

### E3 — (5) đếm dòng trong log bị ghi đè
`host-5439.log` là log của **lượt chạy hiện tại**; mỗi restart ghi lại ⇒ lỗi "did not activate" của lượt trước biến mất. Đồng thời chỉ khớp đúng chuỗi tiếng Anh; các lỗi khác (`failed to import`, `disabled expression failed`) không được đếm — thực tế log từng có cả hai mà (5) vẫn 0.

### E4 — "entry gốc = 0" không đúng ở tầng client
Payload đang phục vụ (79 entry, 11 batch) có URL chứa **2 tên stock**:
`@deepseek-ai/dsh-client-ui-settings`, `@deepseek-ai/dsh-client-ui-directory-picker-native`.
Kiểm tra `~/.galaxy/blackhole/profiles/node_modules/@deepseek-ai/<tên>`: **không tồn tại** ⇒ 2 module này được phục vụ từ **stock node_modules của harness**, không phải qua profile redirect. Vậy phát biểu "entry gốc còn chạy = 0" chỉ đúng nếu giới hạn ở **row host**; ở tầng client đang có **2 gói stock chạy thật**.
Repro: `bun run tools/check/audit-matrix-shim.ts` và `bun run tools/check/audit-residue-gaps.ts`.

### E5 — residue bỏ sót
Tự đếm trên bundle phục vụ: `DSH 178 · dsh- 1094 · dshCamel 17 · @deepseek-ai/ 776`; repo: 3208/6601 tệp còn token. Regex của tool (`__DSH_[A-Z_]+__|dsh-[a-z0-9-]{2,40}`, dòng 79) bỏ `dshCamelCase`, `dsh_`, `@deepseek-ai/`, và tool không đọc payload URL.

---

## 3. Kiểm chéo 3 tuyên bố của Lead hôm nay

| Tuyên bố | Cách tôi kiểm | Kết quả |
|---|---|---|
| (i) "tab Trajectory đã hiện" | Chrome headless riêng + CDP tự viết (`audit-cdp-claims.ts`), mở app 5439 bằng token, đọc DOM + tìm text node `Trajectory`, click thử | **KHÔNG TÁI HIỆN** ở route mặc định: không có element nào có text `Trajectory`; body chỉ có màn hình chào. Bundle `ui-trajectory` **có** trong payload (được phục vụ) ⇒ gói đã load, nhưng "tab hiện" chưa chứng minh — cần mở một phiên hội thoại rồi mới quan sát. |
| (ii) "công tắc Show coding view lưu được" | Cùng probe: tìm text `Show coding view`, click, reload, đọc lại `aria-checked` + `localStorage` | **KHÔNG TÁI HIỆN trên route mặc định**: không có element (nhãn nằm trong `ui-settings-general`). Muốn kiểm phải vào Settings → General → Developer tools; probe hiện chưa điều hướng được (không có route trong DOM home). ⇒ **claim chưa được chứng minh độc lập**. |
| (iii) "entry gốc còn chạy = 0" | Đọc payload đang phục vụ + symlink profile (E4) | **KHÔNG ĐÚNG ở tầng client**: 2 tên stock trong URL batch (`dsh-client-ui-settings`, `dsh-client-ui-directory-picker-native`), profile không có 2 gói đó ⇒ phục vụ từ stock harness. Ở tầng host: chưa kết luận được vì `--dump-config` fail build `ui-conversation`. |

---

## 4. Đề xuất (thay oracle)

1. **Chuẩn hoá oracle**: mọi metric "khớp DSH" phải so với bản stock chạy ở **5466** (tm-evidence), không so với baseline tự sinh. Baseline JSON cần `{sourceUrl, commit, viewport, capturedAt}`; thiếu ⇒ **KHÔNG KẾT LUẬN**, không XANH.
2. **Fail-closed**: mọi nhánh "skip/không mở được/không đọc được" phải trả `KHONG KET LUAN` (exit 2) — hiện (8) skip ⇒ ĐẠT, (9) thiếu baseline ⇒ ĐẠT, (10) `compared === 0` ⇒ ĐẠT (dòng 363), (11) không có dữ liệu trong 6s ⇒ ĐẠT (dòng 316).
3. **Metric "stock module trong payload"**: quét URL `entries/batches` đang phục vụ; đòi **= 0**; đây là bằng chứng sống, không thể bị chữ ký che.
4. **Matrix ✓ phải kèm bằng chứng thực thi**: (a) oracle A/B ở 5466, (b) runtime resolution (symlink target), (c) mount state. Gói không quan sát được trên nền hiện tại ⇒ **"?"**, không ✓.
5. **Residue quét repo-wide + payload** với regex phủ thêm `dshCamel/dsh_/@deepseek-ai/`; tách "residue hiển thị" vs "refs nội bộ".
6. **Log theo run-id** thay vì một file ghi đè; đếm activation theo entry id từ audit có cấu trúc.
7. **Sự cố repo hiện tại**: `packages/client/ui-conversation` thiếu `src/parts/01-requires.ts` ⇒ build fail. App đang chạy bản cũ nên vẫn XANH; lượt boot sau sẽ chết. Cần sửa trước khi boot/mount tiếp.

---

## 5. Cách chạy lại

```bash
bun run tools/check/audit-residue-gaps.ts   # payload + bundle phục vụ + repo (tokens 4 kiểu)
bun run tools/check/audit-matrix-shim.ts    # patch + payload + symlink profile (không dùng --dump-config)
bun run tools/check/audit-cdp-claims.ts     # Chrome headless riêng (cổng 9333) + CDP tự viết: Trajectory / coding view
```
