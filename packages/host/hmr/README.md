<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row hmr (host-only) — nguon doi chieu, peer, TRUOC/SAU, phan chua lam
-->

# @galaxy-blackhole/gbh-hmr

Bản viết lại của Galaxy Blackhole cho row **`hmr`** — `@deepseek-ai/dsh-hmr` (**host-only**, **1466 dòng**
bundle gốc), cấp seam `ctx.hmr`.

> ✅ **`gbh.row` do LEAD khai** (commit `80214e4`, sau ba phép tiền-mount: `row:cost` 1466 · tập export
> 1=1 · `gbh.peers ⊆ peerDependencies`) — **tác giả KHÔNG tự khai**, đúng luật `HOST-ROW-REWRITE.md` mục 00.
> Trạng thái hiện tại: `check:rows` **82 package TẤT CẢ đạt · 0 CHẶN**; **mount app 5439 + `lab:row` + hai lớp đo
> vẫn là việc CHƯA làm** (xem §5).

## 1. Bước 0 — nhận diện row (đo, không suy từ tên thư mục)

| phép | kết quả |
|---|---|
| cặp row trong `.parity/dumps/2026-10-17T23-54-01/ours.yml` | `- id: hmr` + `name: '@deepseek-ai/dsh-hmr'` — **dòng 10–11** ✓ |
| `lib/client.js` của gói gốc | **KHÔNG tồn tại** (`test -f` = false) ⇒ **MỘT MẶT** ✓ |
| khoá `dsh` / `dsh.client` trong `package.json` gốc | **không có** ⇒ câu hỏi #5 = KHÔNG ✓ |
| `bun run row:cost hmr` | **1466 dòng** (không phải 11), inject 0 · primitive 1 · từ điển 0 · **không** trạng thái sống |
| trạng thái row trong profile `blackhole` | `disabled: !!js '!ctx.get(''profileContext'')'` ⇒ trong profile **ĐANG BẬT** (không bị `app.patch.yml` tắt) |

## 2. Nguồn đối chiếu (G4) — chỉ ĐỌC bản gốc

| thứ đo | bản gốc | ta | kết quả |
|---|---|---|---|
| tập export trên **ARTIFACT** | `apps/host/node_modules/@deepseek-ai/dsh-hmr/lib/index.js` | `lib/index.js` | **`["default"]` = `["default"]`** |
| bề mặt service (method trên prototype) | 22 tên | 22 tên | **0 thiếu · 0 thừa** (test A) |
| static surface | `["Config"]` | `["Config","inject"]` | **khác ĐÚNG một tên**: ta dùng `static inject = ["loader","timer"]` thay hai decorator `@Inject` — cùng ngữ nghĩa, theo quy ước repo (`host/sandbox-policy`) |
| schema `Config` | `{ base, root: ["."], ignored: [4 mẫu], debounce: 100 }` | y hệt | `toEqual` trên 2 tổ hợp (test B) |
| `locale/{en,zh}.json` | 39 B / 131 B | chép nguyên | **byte-for-byte** (shasum khớp, test A) |
| bộ khớp `ignored` | `picomatch` | `src/ignore.ts` (tự viết) | **0 khác biệt** trên 12 đường dẫn × 4 mẫu mặc định (test F) |

### Mô-đun của gói

| tệp | dòng | nội dung |
|---|---|---|
| `src/service.ts` | ~700 | lớp `Hmr`: `[Service.init]` · watcher module · `analyzeChanges` · `partialReload` · `evict` · `planReplacement` · `reconcileProfile` · `runExclusive` |
| `src/loader-cache.ts` | ~330 | cache ESM/CJS của Node, đồ thị phụ thuộc, `EntryNamespaces`, `ReloadModules`, `profileRoots`, `packageManifests` |
| `src/package-manifests.ts` | ~330 | làm hết hạn cấu hình package qua hook `internal/modules/*` của Node (`readPackageJSON`, `getPackageScopeConfig`, `Module._load`) |
| `src/module-files.ts` | ~150 | danh tính tệp `ino:size:mtimeMs` + `now()` đọc đồng hồ hệ thống tệp |
| `src/watch-config.ts` | ~150 | theo dõi CHÍNH XÁC một tệp patch (kể cả cha chưa tồn tại) |
| `src/config.ts` · `src/ignore.ts` · `src/error.ts` · `src/index.ts` | ~150 | schema · bộ khớp glob · code frame · điểm vào (chỉ `default`) |

## 3. Vì sao từng peer (bảng §3b + lý do ĐO ĐƯỢC cho phần ngoài bảng)

| peer | bậc | lý do |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | `Service` + `Service.init` — mọi `Hmr` phải là CÙNG lớp `Service` của kernel |
| `@deepseek-ai/schemastery` | 1 | schema `Hmr.Config` (Settings/config-editor đọc) |
| `@deepseek-ai/cordis-plugin-loader` | 2 (seam) | `ctx.loader`: `entries()` · `import()` · `unwrapExports()` · `internal` — **vật mang không thể tự chế** |
| `@deepseek-ai/cordis-plugin-timer` | 2 (seam) | `ctx.debounce()` — chính là `@Inject("timer")` của bản gốc |
| `@deepseek-ai/dsh-app-boot` | **ngoài bảng** | `PROFILE_PATCH_FILENAME` · `readProfileManifest` · `readProfilePatches` · `recomposeProfile` là **giao thức recompose của profile**, không thể tự chế (bản gốc cũng khai peer này) |
| `chokidar` | 3 | `watch()` + kiểu `ChokidarOptions` nằm NGUYÊN trong `HmrConfig` |

`gbh.peers ⊆ peerDependencies` **so PHẦN TỬ** (test G có ĐỐI CHỨNG ÂM: bỏ một tên khỏi `peerDependencies`
⇒ phép kiểm bắt đúng tên đó). Không peer nào nằm trong `dependencies`.

## 4. TRƯỚC / SAU

| phép đo | TRƯỚC (row stock) | SAU |
|---|---|---|
| mount | row stock trong profile `blackhole`, **đang BẬT** | `gbh.row` do Lead khai (commit `80214e4`) · **chưa boot lại** ⇒ app 5439 **chưa đổi** |
| `bun test tests/host/hmr.test.ts` | — | **20 pass · 0 fail · 41 expect** |
| tập export artifact | `["default"]` | `["default"]` |
| `grep -c 'id: "@deepseek-ai' lib/index.js` | — | **0** |
| `check:rows` | 0 dòng `chan` | **0 dòng mới** (gói không khai `gbh.row`) |

## 5. Phần CHƯA làm (điều kiện chặn mount)

1. **Chưa chạy `lab:row hmr`** (0 lỗi console · 0 `did not activate`) và **chưa mount lên app 5439** ⇒ chưa có
   `check:app` + hai lớp đo (pixel A/B + phần tử lạ). `gbh.row` đã do Lead khai nên gói **sẽ được mount** ở lượt
   boot kế tiếp — vì vậy mục 2 dưới đây là **nợ có điều kiện chặn** (`(5) did not activate` phải là 0).
2. **Chưa đo `reconcileProfile` trên app thật**: đường này cần `--expose-internals` + `profileContext` +
   `appReady` — chỉ có trong lượt boot thật. Test hiện đo `ModuleFiles` · `watchConfig` · `runExclusive` ·
   schema · bộ khớp glob, **chưa đo** `partialReload`/`planReplacement` (cần Loader sống).
3. **Hai khác biệt CÓ Ý đã ghi**:
   - **`@babel/code-frame` → tự viết** `renderCodeFrame` (`src/error.ts`): cùng thông tin (dòng · cột · thông
     điệp), không tô màu, không thêm peer ngoài bảng §3b.
   - **`picomatch` → tự viết** `globMatcher` (`src/ignore.ts`): chỉ hỗ trợ đúng 3 cú pháp mà cấu hình dùng;
     test F đối chứng với **chính picomatch của gói gốc** trên bảng đường dẫn.
