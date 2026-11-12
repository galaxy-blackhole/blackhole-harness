<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README gói @galaxy-blackhole/gbh-attachment-local — bảng nguồn đối chiếu G4 (gốc 1079 dòng, host-only, 0 slot, 0 inject), lý do peer, cách build, bảng TRƯỚC/SAU (số do orchestrator điền), phần NỢ
-->

# `@galaxy-blackhole/gbh-attachment-local`

Bản viết lại của Galaxy Blackhole cho row **`attachment-local`** của DSH
(`@deepseek-ai/dsh-attachment-local`, bản gốc **1079 dòng** build trong một `lib/index.js`).

Vai trò: **kho đính kèm cục bộ** — ảnh và tệp thường của prompt được lưu bền vững dưới
`<DSH_HOME>/attachments/v1`, địa chỉ hoá theo nội dung (SHA-256); ảnh được kiểm điều kiện nhận,
chuẩn hoá độc lập nhà cung cấp rồi lưu; tệp thường lưu **nguyên byte**; mỗi tuyến model nhận một phiên
bản ảnh đã cache. Row này **KHÔNG có nửa browser** (không `lib/client.js`, manifest gốc **không** có
`dsh.client` ⇒ **0 slot**, **0 inject**) ⇒ **MỘT MẶT**, thuần host.

Bản gốc **không** khai `dsh`, **không** `static inject`, **không** `ctx.slot`/`ctx.inject` trong mã:
nó chỉ cấp seam `ctx.attachments` bằng cách kế thừa `AttachmentStore` của kernel.

---

## 1. G4 — BẢNG NGUỒN ĐỐI CHIẾU

Bản gốc là MỘT file có 9 vùng `//#region`; ta tách ĐÚNG theo các ranh giới ấy.

| Vùng gốc | Dòng gốc | Module của ta | Nội dung |
|---|---|---|---|
| `lib/types/compression-limiter.js` | 9–56 | `src/compression-limiter.ts` | `CompressionLimiter` (FIFO theo trần đồng thời) · `compressionFailure` |
| `lib/types/encoding.js` | 57–114 | `src/encoding.ts` | `IMAGE_ENCODING_QUALITIES` (85/75/60) · `encode` · thang chất lượng lười |
| `lib/types/sharp.js` | 115–119 | `src/sharp.ts` | nạp lười `sharp` qua `@deepseek-ai/dsh-lazy-require` |
| `lib/types/image.js` | 120–202 | `src/image.ts` | dò/giải mã ảnh nguồn, kiểm media + kích thước + điểm ảnh |
| `lib/types/normalization.js` | 203–272 | `src/normalization.ts` | `NormalizationPolicy` · `canPassThroughNormalization` · `normalizeImage` |
| `lib/types/store.js` | 273–615 | `src/store.ts` | `normalizedImagePath` · `validateImageFile` · `prepareImageFile` · `commitPreparedImageFile` · `publishImmutableObject*` · `saveImageFile` · `readImageFile` |
| `lib/types/file-store.js` | 616–746 | `src/file-store.ts` | `fileLeafName` · `storedFilePath` · `saveFileVerbatim` · `saveFileStreamVerbatim` · `readFileStreamVerbatim` |
| `lib/types/request-image.js` | 747–892 | `src/request-image.ts` | `REQUEST_IMAGE_TRANSFORM_VERSION` · `requestImageVariantId` · `readRequestImageFile` |
| `lib/types/index.js` | 893–1078 | `src/index.ts` | `abortReason` · `SharedRequest` · `LocalAttachmentStore` (mặt plugin) · **toàn bộ** hằng `DEFAULT_*`/`MAX_*` |
| `export { … }` | 1079 | `src/index.ts` | **21 tên**: 10 hằng · `LocalAttachmentStore` · `default` · 9 hàm |
| — | — | `src/ids.ts` | `PACKAGE_NAME` · `STOCK_PACKAGE_NAME` |

### So sánh gốc ↔ ta

| Chỉ số | Gốc | Ta |
|---|---|---|
| Số dòng host | **1079** (một `lib/index.js`) | tách theo 9 vùng, mỗi tệp ≤ 1000 dòng |
| Nửa browser | **không có** | **không có** |
| Slot | **0** | **0** |
| Inject | **0** (`static inject` vắng mặt) | **0** |
| Bề mặt export | 21 tên (dòng 1079) | **đúng 21 tên**, cùng tên, cùng thứ tự trong khối tái xuất |
| `locale/` | `en.json` · `zh.json` | **chép nguyên văn** (cmp từng byte, sha256 khớp) |
| `package.json` → `dsh.client` | **không** | **không** |
| `package.json` → `gbh.row` | — | **KHÔNG** khai (chờ Lead; `gbh.draft` ghi rõ) |

**Hành vi trung thành đáng chú ý** (dễ "tối ưu hoá" sai):

1. **`requestInflight` dùng chung phép biến đổi, huỷ theo TỪNG người chờ.** Người chờ cuối cùng bỏ đi
   mới huỷ tín hiệu dùng chung; một yêu cầu bị bỏ không được kéo theo yêu cầu khác. Lượt đã huỷ còn
   nằm trong sổ thì bị **xoá rồi dựng lại** (không tái dùng một `AbortController` đã huỷ).
2. **Chỗ trong `CompressionLimiter` được nhả TRƯỚC khi promise kết thúc**, nên tác vụ kế tiếp trong
   hàng đợi được đánh thức ngay — không phải sau một microtask nữa.
3. **`saveImages` kiểm CẢ LÔ trước khi ghi bất kỳ thành viên nào** (`validateImageBatch`), rồi chuẩn bị
   song song, rồi công bố tuần tự — nên một thành viên hỏng không để lại tham chiếu dở dang.
4. **Cấu hình chốt bằng `Object.freeze`** cho `imageLimits` và `normalizationPolicy`; `mediaTypes` là
   mảng đóng băng riêng (bốn kiểu: png/jpeg/webp/gif).
5. **Câu lỗi và biên số giữ NGUYÊN VĂN**: `imageCompressionConcurrency` viết cứng `8` trong cả phép so
   lẫn câu "attachment-local: imageCompressionConcurrency must be an integer from 1 through 8"; schema
   cũng dùng `max(8)` và `default(2)`; các giá trị dự phòng trong constructor là số literal
   (`20971520`, `209715200`, `64e6`, `8192`, `4194304`) đúng như bản gốc.

---

## 2. Peer — lý do ĐO ĐƯỢC

| peer | vì sao |
|---|---|
| `@deepseek-ai/cordis` | `Context` trong constructor; lớp cha `AttachmentStore` là `Service` của kernel |
| `@deepseek-ai/dsh-attachment` | `LocalAttachmentStore extends AttachmentStore` — phải là **CÙNG một lớp** với kernel, không phải bản sao (bản sao sẽ đăng ký seam `ctx.attachments` sai/không đăng ký), và 9 hàm tái xuất phải là **cùng thể hiện hàm** |
| `@deepseek-ai/dsh-home-paths` | `resolveDshHome` · `dshCachePath` — gốc lưu trữ và gốc cache do kernel quyết định |

Gói gốc còn khai `dependencies`: `@deepseek-ai/dsh-lazy-require`, `@deepseek-ai/schemastery`,
`sharp@0.35.5`. Ta **không** khai `sharp` (xem §5 NỢ 2).

---

## 3. Cách build

Chạy **một mình** (xuất ra `lib/index.js` cạnh package):

```bash
cd packages/host/attachment-local
bun run build.ts
```

Chạy theo cách **tầng mount** gọi (`apps/cli/src/mount.ts`, cwd = gốc package, đối số = thư mục `lib`
trong profile):

```bash
bun run build.ts /duong/dan/toi/profile/node_modules/@galaxy-blackhole/gbh-attachment-local/lib
```

`buildPackage(outDir?)` xoá sạch `outDir` rồi build **một** file ESM, `target: node`,
`packages: "external"` — mọi import (`sharp`, `@deepseek-ai/*`, `node:*`) không bị nhúng vào bundle.
Không truyền `outDir` thì dùng `lib` cạnh package. Lệnh trả về đường dẫn file đã build.

Kiểm hẹp (không chạy `gate`):

```bash
bun x tsc --noEmit --strict --target ES2023 --module ESNext --moduleResolution bundler \
  --allowImportingTsExtensions --skipLibCheck --noUncheckedIndexedAccess --noImplicitOverride \
  --verbatimModuleSyntax --lib ES2023,DOM,DOM.Iterable --types bun \
  packages/host/attachment-local/src/*.ts packages/host/attachment-local/build.ts
```

---

## 4. TRƯỚC / SAU

Row **CHƯA mount** (gói chưa khai `gbh.row` theo chỉ đạo của Lead) ⇒ **chưa có phép đo TRƯỚC/SAU trên
app 5439**. Bảng dưới để **TRỐNG SỐ** — orchestrator điền sau lượt boot `lab:row` + `check:app`.

| Phép đo | TRƯỚC (row gốc) | SAU (row của ta) |
|---|---|---|
| Số dòng host trong artifact | 1079 | ___ |
| Số tên export công khai | 21 | ___ |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | ___ (kỳ vọng 0) |
| `POST /api` gửi prompt có ảnh — tham chiếu trả về | `attachment:<sha256>` + `originalDimensions` | ___ |
| Đọc lại ảnh sau restart | đọc được, byte khớp | ___ |
| `ctx.attachments.imageHostPath(ref)` | đường dẫn tuyệt đối dưới `<DSH_HOME>/attachments/v1` | ___ |
| Số slot / inject của row | 0 / 0 | ___ |
| `check:app` chỉ số (10) số tệp khớp | — | ___ |

---

## 5. NỢ — những gì CHƯA CHẮC

1. **Không sinh `lib/types/**/*.d.ts`.** Bản gốc ship `types: lib/types/index.d.ts`; ta chỉ build
   `lib/index.js` (giống các gói đã port) và `package.json` **không** có trường `types`. Người tiêu thụ
   TypeScript sẽ không thấy kiểu của gói. Muốn có thì phải thêm một đầu ra `tsc --emitDeclarationOnly`
   — **chưa làm**, chưa đo ảnh hưởng.
2. **Không khai `sharp` trong `dependencies`** (bản gốc khai `sharp@0.35.5`). Lý do: workspace root
   chưa có `sharp`, khai vào sẽ khiến `bun install` đi tải binary native; trong khi bản mount chạy
   trong `apps/host/node_modules` nơi `sharp` **đã có** (cùng chỗ gói gốc phân giải). **Chưa đo** trên
   profile thật — nếu profile không thấy `sharp` thì `src/sharp.ts` sẽ ném lúc nạp lười.
3. **Tên module import nội bộ là HỢP ĐỒNG với SA1/SA2.** `src/index.ts` import
   `./compression-limiter.ts` (`CompressionLimiter`, `compressionFailure`), `./normalization.ts`
   (`canPassThroughNormalization`, `normalizeImage`, `NormalizationPolicy`, `NormalizedImage`),
   `./store.ts` (`commitPreparedImageFile`, `normalizedImagePath`, `prepareImageFile`, `readImageFile`,
   `saveImageFile`, `validateImageFile`, `PreparedImageFile`), `./file-store.ts`
   (`readFileStreamVerbatim`, `saveFileStreamVerbatim`, `saveFileVerbatim`, `storedFilePath`),
   `./request-image.ts` (`readRequestImageFile`, `requestImageVariantId`). Hai tệp
   `store.ts`/`file-store.ts`/`request-image.ts`/`normalization.ts` do SA1/SA2 viết song song — nếu họ
   đổi tên tệp hoặc đổi tên hàm nội bộ thì **chỉ sửa khối import ở `src/index.ts`**, không sửa hành vi.
4. **Bỏ `exports["./src/*"]`** của bản gốc (gói gốc phơi mã nguồn). Ta chỉ phơi `.`, `./locale/*.json`,
   `./package.json`.
5. **Chưa có test** `tests/host/attachment-local.test.ts` (đã khai ở `gbh.tests` — cổng `hygiene` chỉ
   canh gói **có** `gbh.row`, nên hiện chưa đỏ; `check:rows`/signoff sẽ cần tệp này trước khi mount).
6. **Chưa đo** rằng bản mount thật sự **thay** được row gốc: cùng một `AttachmentStore` của kernel,
   cùng `DSH_HOME`, cùng `dshCachePath` — nhưng chưa có phép A/B byte-level trên `<DSH_HOME>/attachments/v1`.
## 6. TRƯỚC → SAU (số đo 19/10/2026, do orchestrator)

| Phép đo | TRƯỚC (row DSH `attachment-local`) | SAU (gói của ta) | Lệnh |
|---|---|---|---|
| Bề mặt export nửa host | 22 tên (21 named + default) | **22 tên, thiếu [] thừa []** | test A/B ca 2 |
| 10 hằng `DEFAULT_*`/`MAX_*` | 20971520 · 20 · 209715200 · 64e6 · 8192 · 4194304 · 8192 · 4194304 · 2 · 8 | **bằng từng cái** | test A/B ca 4 |
| `String(LocalAttachmentStore.Config)` | baseline | **trùng** | test A/B ca 5 |
| Hành vi ảnh/tệp/request-image trên Context cordis THẬT | baseline | **không khác biệt** (ref/byte/path sau scrub) | test A/B ca 6–11 |
| 8 thông điệp lỗi | baseline | **trùng tuyệt đối** | test A/B ca 12–19 |
| Test A/B | — | **19 pass / 0 fail · 92 expect** | `bun test tests/host/attachment-local.test.ts` |
| `lab:row attachment-local` | — | **#root 22.204 · 0 lỗi console** | `bun run lab:row attachment-local` |
| `boot-smoke attachment-local` | — | **HTML 112.118 B · __DSH_BOOT__ có · facade có · #root 22.204 · 0 lỗi console · 0 did-not-activate** | `bun run tools/check/boot-smoke.ts attachment-local` |
| App thật 5439 (8)(9)(5) | 47.181 · 0/80 · 0 | chờ cửa sổ boot của Lead | `bun run check:app` |

## 7. NỢ kỹ thuật (biết trước, không giấu)

1. **Không khai `dependencies`**: bản gốc có `dsh-lazy-require`, `schemastery`, `sharp@0.35.5`; gói ta khai chúng ở `gbh.peers` để `mount.ts` symlink từ kernel (sharp/schemastery/lazy-require không tải lại native binary).
2. **Không sinh `lib/types/**/*.d.ts`**, `package.json` không có `types` (gốc có) ⇒ consumer TS không thấy kiểu; chỉ ảnh hưởng DX, không ảnh hưởng runtime.
3. Bỏ `exports["./src/*"]` của gốc.
4. Các hàm nội bộ được export thêm cho test (`encode`, `imageMetadata`, `MEDIA_TYPES`, …) — bề mặt gói (index.ts) vẫn đúng 22 tên.
