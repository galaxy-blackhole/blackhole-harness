<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-session-projection-cache — bảng nguồn đối chiếu G4, lý do peer,
      bảng TRƯỚC/SAU và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-session-projection-cache

Bản viết lại của Galaxy Blackhole cho row **`session-projection-cache`** của DSH
(`@deepseek-ai/dsh-session-projection-cache`, bundle MỘT FILE **410 dòng** `lib/index.js` +
**167 dòng** `lib/types/index.d.ts`, đọc từ `apps/host/node_modules/@deepseek-ai/dsh-session-projection-cache/`
— CHỈ ĐỌC).

**Vai trò**: **cache chiếu phiên** — checkpoint bền vững trạng thái của mọi đơn vị chiếu, mỗi phiên MỘT
bản ghi trên miền `session_projcache` (bố cục `per-record`), ghi-sau có tiết lưu, và phép đọc liệt kê
**không I/O**. Cache là **lối tắt phép gộp**, KHÔNG BAO GIỜ là nguồn thẩm quyền: một dòng có thể CŨ
(`seq` của nó nói cũ bao nhiêu) nhưng KHÔNG BAO GIỜ SAI.

> ⚠️ **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (khoá `row` xuất hiện trong manifest khi phiên này
> đang viết; patch đã sinh cặp **disable + insert** `session-projection-cache-ours` trong
> `profiles/blackhole/app.patch.yml`). Hình dạng: `id` + **`config` GỐC hai khoá** + `tests`,
> **không** `moduleIds`/`aliases` (row MỘT MẶT). Ca 0c ghi lại hình dạng đó và đọc **CẢ HAI** dạng
> (`gbh.row ?? gbh.row_unmounted_ly_do?.row`) để một lượt gỡ mount không làm đỏ oan.

## 0. Bước 0 — ba phép bắt buộc (đo lại ngay trong phiên này)

| Phép | Kết quả | Bằng chứng |
|---|---|---|
| (i) cặp row **có thật** trong dump MỚI NHẤT | ✅ | `.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **172–176**: `- id: session-projection-cache` + `name: '@deepseek-ai/dsh-session-projection-cache'`, row **ĐANG BẬT** |
| (ii) **KHÔNG** có `dsh.client` / `lib/client.js` | ✅ | `ls lib/` của gói gốc = `index.js` + `types/` (KHÔNG có `client.js`); `package.json` gốc KHÔNG có khoá `dsh`; `lib/index.js` **410 dòng** > 0 ⇒ **MỘT MẶT**, chỉ nửa HOST |
| (iii) `config` + `inject` đọc từ **ours.yml ĐANG CHẠY** | ✅ | `config: { writeEveryEvents: 200, writeIntervalMs: 5000 }`; **KHÔNG** `inject:` trong yml và **KHÔNG** `!!js` ⇒ không có `ctx.<X>` nào cần inject. (Ba seam `storageDomain` · `sessionProjections` · `sessions` do **chính lớp** khai ở `static inject`, nguyên văn bản gốc.) |

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| miền `session_projcache` | `lib/index.js` dòng 28–101 | `src/spec.ts` | ca 4: so **từng trường** của spec; ca 5: **pin** 14 giá trị vào schema của HAI bên, so `success` + `issues` (code · path · message) |
| `defineDomain` · `domainTable` | `dsh-storage-domain/lib/index.js` dòng 46–76 | `src/domain.ts` | ca 4: **11 spec** (hợp lệ + 10 dạng hỏng) ⇒ cùng object trả về hoặc **cùng CÂU LỖI** |
| `checkpointRow/Identity/Record` (zod) | `lib/index.js` dòng 28–65 | `src/spec.ts` | ca 5: `safeParse` 14 giá trị (kể cả `-0` · `NaN` · `undefined` · `seq: -1`) |
| `Config` (schemastery) | `lib/index.js` dòng 122–125 | `src/service.ts` | ca 6: 10 giá trị (kể cả `0` · `1.5` · `"200"` · thiếu trường) ⇒ cùng kết quả hoặc cùng câu lỗi |
| `SessionProjectionCache` (lớp dịch vụ) | `lib/index.js` dòng 135–361 | `src/service.ts` | ca 7–13: **chạy CẢ HAI bản cài** trên cùng một hình dạng giàn (Context cordis THẬT + sổ chiếu THẬT của kernel) rồi so bản ghi đã ghi, thứ tự flush, khối đã xem, cảnh báo, câu lỗi |
| bốn phép so nhân dạng | `lib/index.js` dòng 362–408 | `src/identity.ts` | ca 8: **10 bản ghi dựng tay** (lệch thế hệ định dạng · `createdAt` · `cwd` · `isSeeded` · `inheritedEventCount`) ⇒ cùng quyết định ở cả hai bề mặt |
| `SessionSeq` · `SessionLogOffset` | `dsh-session/lib/index.js` dòng 21–33 | `src/brand.ts` | ca 14: **7 dạng × 2 hàm** ⇒ cùng `TypeError` + cùng câu; hàm ĐỒNG NHẤT (`7 → 7`) |
| tập export lúc chạy | `export { Config, SessionProjectionCache, SessionProjectionCache as default, … }` | `src/index.ts` | ca 1: **đo trên ARTIFACT** — 7 tên, **bằng đúng** tập gốc |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | ca 2: **byte-for-byte** — sha256 `80cf67ef…` · `ec17f39f…` (luật 000e) |

## 2. Peer — vì sao, và thuộc bậc nào của bảng §3b

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | Bậc 1 (kernel) | `extends Service` + `ctx.on` · `ctx.effect` · `ctx.logger`; tên service `"sessionProjectionCache"` đăng ký qua chính lớp cha |
| `@deepseek-ai/schemastery` | Bậc 1 | schema `Config` để Settings/config-editor render được hai trường; dùng ĐÚNG như bản gốc |
| `@deepseek-ai/dsh-util-values` | **Bậc 2 — "tiện ích hạ tầng của DSH"** (cùng nhóm với `dsh-home-paths` · `dsh-atomic-write`) | `snapshotJsonValue` · `isJsonValue` là **cùng một luật JSON không mất mát** ở HAI chỗ: `val` của schema (chặn dòng hỏng) và đường `put` (chụp TÁCH RỜI). Luật đó gồm cả `-0` · chu trình · `undefined` · nguyên mẫu lạ ⇒ một bản sao lệch nghĩa sẽ **âm thầm** nhận dữ liệu mà medium không round-trip được. Gói tự mô tả là **"duplicate-install-safe"** ⇒ không có nguy cơ hai thể hiện |
| `zod` | Bậc 3 (npm thật) | schema bản ghi của miền. Nạp qua **`zod/v4`** vì `packages/client/ui-sidebar-right/src/externals.d.ts` khai ambient `declare module "zod"` **CÓ THÂN** (đè kiểu thật toàn cục — xem `settings-controller` · `llm-retry`) |

### Ba peer của bản gốc mà ta **BỎ** (đều ngoài bảng §3b) — và vì sao KHÔNG mất hành vi

| Peer gốc | Ta thay bằng | Chứng minh |
|---|---|---|
| `dsh-session` (`SessionSeq` · `SessionLogOffset`) | `src/brand.ts` viết lại **tại chỗ** | ca 14 A/B với **chính kernel**: 7 dạng × 2 hàm ⇒ cùng `TypeError` + **cùng câu**; `brandNumber` của kernel là hàm ĐỒNG NHẤT |
| `dsh-storage-domain` (`defineDomain` · `domainTable`) | `src/domain.ts` | ca 4: 11 spec; `domainTable` trả ĐÚNG `{ valueSchema }` (ca 4 so khoá của bảng). Spec là object THUẦN mà `ctx.storageDomain.open` đọc trường ⇒ không mất quan hệ `instanceof` nào |
| `dsh-session-projection` (kiểu `ProjectionSnapshot`) | `src/types.ts` khai theo **CẤU TRÚC** | bề mặt seam chỉ có 4 phương thức; ca 7–10 chạy với **sổ chiếu THẬT của kernel** nên kiểu khai phải khớp hành vi thật |

## 3. Bảng TRƯỚC/SAU

Gói **chưa được mount** (chưa khai `gbh.row`) ⇒ "SAU" là phép đo trên **ARTIFACT**, không phải trên
app 5439. Lệnh tái lập:

``bash
cd galaxy-blackhole/blackhole-tauri
bun test tests/host/session-projection-cache.test.ts      # 19 test · 233 expect · 0 fail
cd packages/host/session-projection-cache && bun run build.ts
grep -c "id: @deepseek-ai" lib/index.js                    # 0
grep -c "__ModuleLoader__" lib/index.js                    # 0
``

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| tập export `lib/index.js` | 7 tên | **7 tên — BẰNG ĐÚNG** (0 thiếu · 0 thừa) |
| spec miền | `session_projcache` v7 · compat `3,4,5,6` · `per-record` · `backup-and-skip` | **y hệt từng trường** |
| `defineDomain` với spec hỏng | 10 kiểu ném | **cùng 10 câu lỗi** |
| bản ghi đã lưu sau một kịch bản 6 sự kiện | — | **giống nhau từng byte** (`toEqual` trên `puts` của hai bên) |
| số lượt ghi ở 4 mốc bắt buộc + ngưỡng đếm 2 | — | **4 = 4**, cùng thứ tự |
| ngưỡng thời gian (`writeIntervalMs: 10`) | — | **2 = 2** lượt ghi, chờ có **trần 2000 ms** |
| cảnh báo fail-soft (medium hỏng) | 1 dòng/1 lượt | **cùng một câu** |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** |
| locale | sha256 hai tệp | **khớp byte-for-byte** |

## 4. Phần CHƯA làm

1. **Chưa nghiệm thu mount** — `gbh.row` do **Lead** khai (id + `config` + `tests`) và patch đã sinh
   cặp disable+insert, nhưng phiên viết gói **không** chạy `lab:row` và **không** có TRƯỚC/SAU trên app 5439 (luật:
   chỉ Lead boot). Bảng §3 vì vậy chỉ là phép đo **artifact**.
2. **Chưa đo trên medium THẬT** (`storage-json` + thư mục `<root>/session_projcache/sessions/`):
   giàn thử dùng miền GIẢ cùng hình dạng (`open` · `table` · `get`/`put`) để hai bên chạy trên
   CÙNG một hình dạng. Việc ghi đĩa/`backup-and-skip` thuộc tầng `storage-domain` (row 35), không
   phải row này.
3. **Chưa có ca `invalidRecords` thật** (tài liệu hỏng bị đổi tên thành `.bak.<stamp>`) — cùng lý do
   trên: đó là hành vi của tầng miền.
