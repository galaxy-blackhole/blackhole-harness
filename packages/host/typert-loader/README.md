<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho row typert-loader: bảng nguồn đối chiếu G4, lý do peer,
      bảng TRƯỚC/SAU, và phần CHƯA làm — CHƯA khai gbh.row (row do Lead khai sau khi mount).
-->

# `@galaxy-blackhole/gbh-typert-loader` — bộ nạp typert

Thay row **`typert-loader`** của DSH (`@deepseek-ai/dsh-typert-loader`). Vai trò: khi một entry của
Loader mount, plugin này giải `package.json` của gói entry đó; gói nào export `./typert` thì mặt host
của nó được import và vật thể `TYPERT` được đăng ký vào `ctx.typert`; khi entry xuống thì đăng ký
được GỠ theo đúng hàm dọn mà sổ đăng ký cấp.

## 0. Bước 0 — bằng chứng nhận row (đo trên dump MỚI NHẤT `.parity/dumps/2026-10-18T01-31-57/`)

| phép kiểm | kết quả |
|---|---|
| cặp `- id: typert-loader` + `name: '@deepseek-ai/dsh-typert-loader'` | **CÓ THẬT** — `ours.yml` dòng 34–35, `order: 9` trong `ours.normalised.json` |
| `config:` của row trong `ours.yml` | **KHÔNG CÓ** (row trần `{id, name}`) ⇒ không có `!!js` nào ⇒ **không cần `inject` cấp patch** |
| `inject:` của row trong `ours.yml` | **KHÔNG CÓ** |
| `lib/client.js` trong gói gốc | **KHÔNG TỒN TẠI** (chỉ `lib/index.js` + `lib/types/index.d.ts` + `locale/`) ⇒ **MỘT MẶT** |
| khoá `dsh` trong `package.json` gốc | **KHÔNG CÓ** ⇒ không mất nửa client nào khi thay row |

⚠️ Phân biệt hai loại `inject` (bài học sự cố app 404): `gbh.row.inject` là **danh sách service trong
khối patch**, còn `inject` **export của plugin** (`["typert", "loader"]`) là **yêu cầu service của cordis**.
Row này có `config` rỗng nên `gbh.row.inject` sẽ rỗng; hai service mà plugin CHỜ vẫn phải có mặt:
`typert` là row `typert` (`ours.yml` dòng 32–33), `loader` do `dsh-app-boot` cấp (không phải row trong profile).

## 1. Bảng nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Dùng để | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js` (**374 dòng**) | toàn bộ hành vi: quét entry · giải artefact · kiểm vật thể · sổ đăng ký · vòng đời | **viết lại theo hành vi**, giữ NGUYÊN VĂN mọi thông điệp lỗi và thứ tự kiểm |
| 2 | `…/dsh-typert-loader/lib/types/index.d.ts` | bề mặt export (`Config` · `TYPERT_HOST_EXPORT` · `apply` · `inject` · `name` · `validateTypertManifest`) | đối chiếu **tập export** trên artefact |
| 3 | `…/dsh-typert-loader/locale/{en,zh}.json` | luật 000e | **chép byte-for-byte** (`shasum` trùng: `b29837ab…` · `02762b9d…`) |
| 4 | `…/dsh-typert-registry/lib/types/{service,types}.d.ts` | hình dạng `TypertContribution` · `TypertDisposer` | khai lại **theo cấu trúc** trong `src/types.ts` |
| 5 | `…/cordis-plugin-loader/lib/types/config/{entry,tree}.d.ts` | hình dạng `Entry` (`options.name` · `fiber` · `disabled`) và `entries()` | khai lại **theo cấu trúc** |

**Vì sao kiểu seam được KHAI LẠI thay vì import:** `dsh-typert-registry` và `cordis-plugin-loader` đều
**ngoài bảng peer §3b**; import chúng sẽ tạo **thể hiện thứ hai** hoặc một peer không được duyệt. Cách đã
dùng (tiền lệ `llm-retry` · `approval`): khai đúng phần cấu trúc mà row chạm tới trong `src/types.ts`.

## 2. Peer — vì sao mỗi tên có mặt

| peer | bậc §3b | lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | **bậc 1** (kernel) | chỉ dùng **kiểu** `Context` ở tầng seam + `ctx.effect` · `ctx.on`: phải là **cùng một kernel** đang chạy, không thể là bản sao |
| `@deepseek-ai/schemastery` | **bậc 1** | schema `Config` (`z.object({ packages: … })`) do kernel cấp một thể hiện — bản gốc khai nó ở `dependencies`, ta khai ở **`peerDependencies`** theo luật “peer luôn là peerDependencies” |

`gbh.peers` ⊆ `peerDependencies` — **so PHẦN TỬ**, kèm **ĐỐI CHỨNG ÂM** trong test (bỏ một tên khỏi bản
sao `peerDependencies` ⇒ phép kiểm bắt ĐÚNG tên đó). Gói **không khai `dependencies`**.

## 3. Bản đồ hành vi (đã viết lại)

| vùng | file | việc |
|---|---|---|
| ranh giới vật thể | `src/manifest.ts` | `typertExportOf` (nhận chuỗi và dạng điều kiện một tầng) · `validateTypertManifest` + 8 hàm kiểm (`requireObject` · `requireArray` · `requireString` · `requireOptionalString` · `requireDocumentation` · `requireMembers` · `requireTypes` · `requireInvocation` · `requireStrictCodec` · `requireSchemaProjection`) |
| thân plugin | `src/plugin.ts` | `name` · `inject` · `Config` · `apply` (giải artefact có cache **không hết hạn** · nạp manifest có cache · tập `dirty` theo tên entry · `flush` vi mô · `AggregateError` lúc kích hoạt · **ghi log** ở trạng thái ổn định) |
| seam | `src/types.ts` | `TypertContribution` · `LoaderSeam` · `TypertRegistrySeam` · `PluginPackagesSeam` · `TypertLoaderContext` |
| điểm vào | `src/index.ts` | **đúng SÁU tên** như bản gốc |

Ba chi tiết hành vi dễ mất khi viết lại, đã giữ:
1. **Cache KHÔNG hết hạn** — quyết định theo gói và vật thể đã import sống tới khi restart; đổi tập plugin
   KHÔNG có hiệu lực giữa phiên.
2. **Quét TĂNG DẦN** — mỗi `internal/plugin` chỉ đánh dấu **một tên** bẩn; lượt kích hoạt mồi cùng tập bẩn
   bằng **mọi** entry hiện có. Ở trạng thái ổn định lỗi **không ném** mà `ctx.logger.error`; chỉ lượt kích hoạt
   mới gom thành `AggregateError`.
3. **Gỡ đăng ký là bất đồng bộ** (`TypertDisposer = () => Promise<void>`) nên hàm dọn được **chờ** trong
   `flush` — không thả trôi.

### Khác biệt CÓ Ý (đã ghi, không phải nợ)

| # | khác biệt | vì sao KHÔNG đổi hành vi |
|---|---|---|
| 1 | bỏ helper `__rewriteRelativeImportExtension` của tsdown, import thẳng `pathToFileURL(path).href` | helper đó **viết lại đuôi `.ts`/`.tsx` thành `.js`** cho môi trường bundler; ở tầng chạy, mọi đường dẫn `./typert` trỏ tới tệp **đã biên dịch `.js`** nên hàm này là **đồng nhất** trên chúng |
| 2 | thân `apply` đọc `ctx.loader` / `ctx.typert` (đúng bản gốc) nhưng `pluginPackages` đọc bằng `ctx.get` (đúng bản gốc) | giữ **y nguyên cách truy cập** của bản gốc, không “cải tiến” |

## 4. TRƯỚC / SAU — phép đo đã chạy

⚠️ **Row CHƯA mount** (chưa khai `gbh.row`, không boot 5439) nên chưa có bảng TRƯỚC/SAU **trên app thật**.
Bảng dưới là phép đo **đối chứng TRỰC TIẾP với chính bundle gốc** trên cùng một giàn giả, chạy trong test:

| phép đo | bản gốc (bundle stock) | bản của ta | kết luận |
|---|---|---|---|
| tập export trên ARTIFACT đã build | `Config · TYPERT_HOST_EXPORT · apply · inject · name · validateTypertManifest` (6) | **6 tên, TRÙNG TẬP** | khớp |
| 20 vật thể `TYPERT` HỎNG ⇒ thông điệp lỗi | 20/20 ném | 20/20 ném, **trùng từng ký tự** | khớp |
| vật thể HỢP LỆ | trả **chính** vật thể đó | trả **chính** vật thể đó | khớp |
| 3 entry (1 có `./typert` · 1 không export · 1 bị tắt) ⇒ số lần đăng ký | 1 | 1 | khớp |
| unmount entry ⇒ gỡ đăng ký | gọi hàm dọn | gọi hàm dọn | khớp |
| sau `unload` ⇒ phát `internal/plugin` | không đăng ký lại, không log | không đăng ký lại, không log | khớp |
| 4 ca cấu hình hỏng (`không giải được` · `không export ./typert` · `sai chủ sở hữu` · `subpath`) ⇒ `AggregateError` | 4/4 ném | 4/4 ném, **trùng thông điệp** | khớp |
| thiếu `ctx.baseUrl` | ném | ném, **trùng thông điệp** | khớp |
| gói hỏng mount SAU kích hoạt ⇒ `logger.error` | 1 dòng log | 1 dòng log, **trùng thông điệp** | khớp |
| `Config({})` hai lần ⇒ **C6 danh tính** (`packages` không chia sẻ) | — | độc lập, sửa một không lan | đạt |
| hai lần `apply` ⇒ sổ đăng ký độc lập | — | gỡ ở giàn A không lan giàn B | đạt |
| `grep -c 'id: @deepseek-ai' lib/index.js` | — | **0** | không có nửa client, không id lạ |

**Lệnh tái lập:**

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/typert-loader && ~/.bun/bin/bun run build.ts
grep -c "id: @deepseek-ai" lib/index.js            # PHAI = 0
cd ../../.. && ~/.bun/bin/bun test tests/host/typert-loader.test.ts   # 12 pass · 0 fail · 50 expect
cd packages/host/typert-loader && shasum locale/*.json               # trùng gốc byte-for-byte
```

> **Ghi chú về `id module`:** row này **thuần host** ⇒ gói **không có nửa client** ⇒ không có
> `__ModuleLoader__.load({ id })` nào để đếm, nên phép kiểm “id ta = 1” của row client **không áp dụng**.
> Bề mặt tương ứng ở M6 là **tập export** (M6-MOUNT-PLAN §1c) — đã đo: **6 = 6, 0 thiếu · 0 thừa**.

## 5. CHƯA làm (điều kiện chặn mount, không phải ghi chú cuối báo cáo)

1. **CHƯA khai `gbh.row`** — theo luật “KHAI `gbh.row` = NHẬN RỦI RO MOUNT”, và theo phân công M6 row này
   do **Lead** khai sau ba phép tiền-mount. Có **test canh** khẳng định gói KHÔNG có `gbh.row`.
2. **CHƯA mount + CHƯA `lab:row`** — `lab:row` đòi gói đã khai `gbh.row`; lượt này **không tự boot 5439**.
3. **CHƯA có bảng TRƯỚC/SAU trên app thật** — cần lượt boot của Lead: kỳ vọng `(5) did not activate = 0`,
   `(8) #root ≥ 68.000`, và **cặp patch** `- id: typert-loader` + `insert: - id: typert-loader-ours`.
4. **CHƯA đo lớp A/B pixel** — row host không vẽ gì lên màn hình nên lớp đo đúng là **chỉ số** `(5)` + `(8)`
   (M6-MOUNT-PLAN §1).
