<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-plugin-manager cua DSH (M5, row HAI MAT trong MOT goi)
-->

# @galaxy-blackhole/gbh-client-ui-plugin-manager

Thay row `ui-plugin-manager`: **màn Plugins** (cài/bật/tắt/thử lại plugin, tab Installed/Discover, toast làm mới)
+ **nửa host** phơi service `PluginRegistryProbe` (đua ping npm vs npmmirror để chọn registry nhanh hơn).

> ⚠️ **TRẠNG THÁI: ĐANG VIẾT (task-57).** Chưa mount — theo luật của Lead: **chỉ mount khi ĐỦ**.
> Mount sớm sẽ tắt row stock trong khi trang chưa đủ ⇒ màn Plugins hỏng.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-plugin-manager` (T3, đang BẬT) | `ui-plugin-manager-ours` → `@galaxy-blackhole/gbh-client-ui-plugin-manager` |
| Package | `@deepseek-ai/dsh-client-ui-plugin-manager` | `@galaxy-blackhole/gbh-client-ui-plugin-manager` |
| Kích thước gốc | `lib/index.js` **142** · `lib/client.js` **4.493** · 12 file `.d.ts` · `locale/{en,zh}.json` | `row:cost` báo **4.637** dòng row |
| Hai mặt | **CÓ, trong MỘT row** | một gói hai mặt: host `src/index.ts` · browser `src/client.ts` |
| `inject` (client) | `slots · locale · remote · remote.pluginManager · remote.pluginInventory · remote.pluginRegistryProbe · configForms · layout` (**8**) | khai y hệt, đúng thứ tự |
| Từ điển | namespace `pluginManager` | **zh 221 khoá · en 221 khoá · lệch 0** (chép nguyên văn) |
| Nửa host | `class PluginRegistryProbe extends TypertRemoteService`, `@Remote fastest()`, `static Config` (`registryProbeEnabled/TimeoutMs/CacheTtlMs`), cache `expiresAt`, `AbortSignal.timeout` | cùng hành vi; khuôn theo `packages/host/plugin-inventory/**` |

## 2. Hợp đồng slot (đã trích từ bản gốc)

**Đăng ký 3 chỗ**: `shell.overlay` (id `plugin-manager.refresh-toast`, locale NS) · **`main`** (bản gốc dùng **hàm generator**, `inject: () => face` = trang quản lý) · `sidebar.panellist` (id **`plugins`**, order **0**, locale NS).

**Tiêu thụ**: `SLOTS = [plugins.item, plugins.bundle.config, plugins.row.config]` + `plugins.tab` — đọc qua `entries`/`getVersion`/`subscribe` ⇒ **trang phải phản ứng theo version của slot, không đọc một lần**.

Client còn có **`ctx.reflect.provide`** (phơi một service cho consumer khác).

## 3. Sáu khuôn bắt buộc của task-57 — trạng thái

| # | Khuôn | Trạng thái |
|---|---|---|
| 1 | Header 5 dòng · ≤1000 dòng/file · mô tả mọi export | ✅ đang giữ ở mọi file đã viết |
| 2 | `moduleIds` **chỉ** id ta · `aliases` giữ id stock · bundle đăng ký **MỘT** id | ⏳ làm ở bước ⑤ (`package.json` + `build.ts`) |
| 3 | Cổng `apply`: **boolean phạm vi module** + WeakSet, **trước JSDoc**, `applyInner`, `console.error` kèm id rồi **rethrow**; **KHÔNG** khoá theo ctx | ⏳ bước ⑤ |
| 4 | Bọc lớp bằng hàm dựng ⇒ **sao chép `static inject`** | ⏳ nếu bước ⑤ bọc lớp |
| 5 | **KHÔNG ném khi thiếu môi trường** (`document`/`window`/cầu Desktop) — tắt tính năng phụ + `console.warn`, ghi rõ **dị biệt có chủ đích** | ⏳ bước ③④ |
| 6 | **Bề mặt service phải đủ** (consumer stock đọc thuộc tính nào thì phải có) — chạy `bun run parity:surface` | ⏳ bước ⑤, trước khi mount |

## 4. Việc đã xong (đo được)

| File | Dòng | Bằng chứng |
|---|---|---|
| `src/ids.ts` | 53 | NS `pluginManager` · PANEL_ID `plugins` · 3 slot đăng ký · 3 slot tiêu thụ |
| `src/locales.ts` | 460 | **zh 221 · en 221 · lệch 0** — kiểm bằng `import` thật, không đếm tay |
| `src/sanitize-install-input.ts` | 19 | 3 luật regex y bản gốc; giữ tên gói/phien bản, `[git]`/`[url]`/`[path-or-other]` |
| `tests/client/ui-plugin-manager.test.ts` | 45 | **4 pass · 0 fail · 21 expect** |

## 5. Thứ tự còn lại (Lead đã chốt: giữ nguyên ①→⑥)

① `slot-contract` (`.d.ts` 208 dòng + phần runtime `SLOTS`/`keysOf`) → ② `presentation` + `manager-store` + `navigation-store` + `config-ledger`/`tab-ledger` → ③ `PluginsPanelIcon` + `PluginRefreshToast` → ④ `PluginManagerPage` + 2 CSS module →
⑤ `plugin.ts` (apply + 3 slot + `reflect.provide`) + `build.ts`/`package.json` + **nửa host `src/index.ts`** (142 dòng, khuôn `packages/host/plugin-inventory`) →
⑥ test đầy đủ + README §3.4 'Xác minh TRÊN APP THẬT' + mount (xin Lead một lượt boot) + A/B màn Plugins.

## 6. Danh sách nghiệm thu sau lượt boot ĐẦU TIÊN (số kỳ vọng — tm-parity đo trước)

| Chỉ số | Kỳ vọng | Ý nghĩa nếu lệch |
|---|---|---|
| `#root` | **99.183** | thấp hơn ⇒ màn Plugins chưa đủ, chưa được mount |
| `did not activate` | **0** | > 0 ⇒ một entry kẹt (xem `apply` guard + service surface) |
| lỗi console | **0** | dòng `apply nem loi` phải xuất hiện nếu có lỗi thật (không được im lặng) |
| `parity:graph` entry | **97 → 97** | thành **98** ⇒ row stock CHƯA bị tắt trọn ⇒ soi lại patch |
| `inject treo` | **4 = ref** | cao hơn ⇒ thiếu entry alias cho id stock của gói khác |
| `id chỉ có ở ref` | **0** | > 0 ⇒ gói ta thiếu khai `aliases` |

## 7. Recon bước ② (đã trích từ bản gốc — dùng thẳng, đừng đo lại)

**`presentation` API** (`.d.ts`): `registryText(registry, t, resolved)` · `managementText(error, t)` · `shortName(name)` · `packageText(pkg, resolveText)` · `rowText(row, resolveText)` · `restartText(key, reason, t)` · `noticeText(notice, t)`.

**Bảng khoá đã trích nguyên văn:**
- `REGISTRY_COPY = Map([["registry.npmmirror.com", "registryNpmmirror"]])`; `registryHost(url)` = `new URL(url).host`, **không parse được thì trả nguyên chuỗi**; `registryText` trả `{name, host}`: `url === null` ⇒ `t("registryDefault")`; host npm chính thức ⇒ `t("registryOfficial")`; có tên riêng ⇒ `t(REGISTRY_COPY.get(host))`; còn lại ⇒ chính host.
- `CODE_KEYS` (13 mã ⇒ khoá từ điển): `management-required→reasonManagementRequired` · `unaddressable→reasonUnaddressable` · `unknown-plugin→reasonUnknownPlugin` · `invalid-spec→reasonInvalidSpec` · `already-installed→reasonAlreadyInstalled` · `ambiguous-install→reasonAmbiguousInstall` · `not-bundle→reasonNotBundle` · `not-removable→reasonNotRemovable` · `stop-profile→reasonStopProfile` · `bundle-in-use→reasonBundleInUse` · `stale-approval→reasonStaleApproval` · `incompatible-version→reasonIncompatibleVersionUnnamed` · `operation-error→reasonOperationError`.
- `FAILED_KEYS` (5 ⇒ khoá): `enable→failedEnable` · `disable→failedDisable` · `uninstall→failedUninstall` · `rowEnable→failedRowEnable` · `rowDisable→failedRowDisable`.
- `managementText`: nhánh thường = câu của mã; riêng `incompatible-version` = **một câu cho mỗi gói được nêu tên** rồi câu khắc phục; `operation-error` = **nguyên văn chẩn đoán của Host**.

**Đã port (bước ②, phần kiểm được)**: `src/presentation.ts` — `OFFICIAL_NPM_HOST` · `REGISTRY_COPY` · **`CODE_KEYS` 13** · **`FAILED_KEYS` 5** · `registryHost` · `registryText` (4 nhánh) · `managementText` (nhánh mã + `operation-error` nguyên văn). Test: xem `tests/client/ui-plugin-manager.test.ts`.
⚠️ **HAI CHỖ CHƯA PORT, ghi rõ để không ai tưởng đã đủ**: (1) `managementText` nhánh `incompatible-version` **có tên gói** (một câu mỗi gói + câu khắc phục) — thuộc bước ④ vì cần nhãn của form; (2) `shortName` · `packageText` · `rowText` · `restartText` · `noticeText` — chưa trích được luật từ nguồn.
✅ **ĐÃ ĐỐI CHIẾU**: `OFFICIAL_NPM_HOST` = `registry.npmjs.org` — grep thẳng bản gốc ra `OFFICIAL_NPM_HOST = "registry.npmjs.org"` (khớp hằng tôi viết, không còn là giả định).

**Việc còn lại của bước ②**: `manager-store` · `navigation-store` → `config-ledger` · `tab-ledger`; rồi 6 hàm `presentation` còn lại.

## 8. Lệnh tái lập

```bash
bun test tests/client/ui-plugin-manager.test.ts   # 4 pass · 21 expect (buoc 1)
bun run check:rows                                # 0 dong CHAN cho goi nay
bun run gate                                      # 8/8 XANH
```
