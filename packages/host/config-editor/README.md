<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguon doi chieu (G4) + ly do peer + bang TRUOC/SAU cua goi @galaxy-blackhole/gbh-config-editor (row config-editor)
-->

# `@galaxy-blackhole/gbh-config-editor` — row `config-editor`

Bản viết lại của Galaxy Blackhole cho row **`config-editor`** của DSH
(`@deepseek-ai/dsh-config-editor`, **138 dòng** `lib/index.js`: dịch vụ `ctx.configEditor`).

**Trạng thái: ĐÃ VIẾT XONG, CHƯA khai `gbh.row`** (chờ lượt boot của Lead — chưa khai thì `bh host`
không sinh patch, nên gói KHÔNG THỂ làm hỏng app của người khác).

## 1. Ba phép BƯỚC 0 (đo trên đĩa, không đọc báo cáo)

| # | Phép | Kết quả |
|---|---|---|
| i | cặp `- id: config-editor` + `name: '@deepseek-ai/dsh-config-editor'` trong `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **CÓ THẬT** — dòng **80–82** |
| ii | `dsh.client` trong `package.json` GỐC · `lib/client.js` tồn tại? | **KHÔNG** · **KHÔNG** (chỉ `lib/index.js` + `lib/types/`) ⇒ **MỘT MẶT** |
| iii | `config:` / `inject:` của row trong `ours.yml` (ĐANG CHẠY) | **KHÔNG có `config`**, **KHÔNG có `inject`**; row chỉ có `disabled: !!js '!ctx.get(''profileContext'')'` |

⇒ Row **BẬT khi app chạy bằng profile của dsh** (có `profileContext`), tắt trong ngữ cảnh không có profile.
`disabled` dùng `ctx.get('profileContext')` — **không phải** dạng `ctx.<X>` nên luật *`ctx.X` ⇒ `inject X`* không áp dụng
(đã kiểm tường minh; hai seam thật của row do **chính lớp** khai: `loader` · `profileContext`).

## 2. Nguồn đối chiếu (G4)

| Nguồn (CHỈ ĐỌC) | Dùng để |
|---|---|
| `apps/host/node_modules/@deepseek-ai/dsh-config-editor/lib/index.js` (138 dòng) | toàn bộ hành vi: `flatten` · `entries` · `configuration` · `inherited` · `edit` · thứ tự thao tác trên tài liệu YAML |
| `…/lib/types/index.d.ts` (37 dòng) | chữ ký công khai (`entries()` · `configuration()` · `edit()` · `documentPath` · `static inject`) |
| `.parity/dumps/2026-10-18T01-31-57/ours.yml` L80–82 | row thật + `disabled` (KHÔNG lấy từ `oracleA_nopatch`) |
| bundle gốc nạp động trong test | **oracle của mọi phép A/B** (cùng rig, cùng Context cordis thật) |

## 3. Peer — bảng ba bậc (§3b) và lý do ĐO ĐƯỢC

| peer | bậc | vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | **1** | `Service` (lớp cha + `super(ctx, "configEditor")`) · `resolveConfig` (hợp lệ hoá config qua schema của plugin) |
| `@deepseek-ai/dsh-atomic-write` | **2** | `withFileLock` · `writeFileAtomic` — khoá liên tiến trình + ghi thay thế nguyên tử; **không thể tự chế** mà giữ đúng ngữ nghĩa |
| `yaml` | **3** | `parseDocument` · `visit` · `Scalar` · `isMap` · `isSeq` — phép sửa AST giữ nguyên định dạng tệp |
| `@deepseek-ai/dsh-app-boot` | **ngoài bảng** | `composeEntries` · `loadProfileDirectory` · `readProfilePatches` · `reconcileProfilePatches` — **giao thức recompose của profile**; bản gốc cũng khai peer này. Tiền lệ: `packages/host/hmr`, `packages/host/web-runtime`. **Cần Lead xác nhận** |
| `@deepseek-ai/cordis-plugin-include` | **ngoài bảng** | `entryListSchema` — **chính phương ngữ** `!!js` mà Loader dùng khi nạp tệp patch; chép lại schema là tự tạo nguồn sự thật thứ hai. Bản gốc cũng khai peer này. **Cần Lead xác nhận** |
| `@deepseek-ai/cordis-plugin-loader` | **ngoài bảng** | **chỉ mượn KIỂU** `Entry`/`EntryOptions` (bề mặt công khai `entries(): Entry[]`); xoá được khi build, không nạp lúc chạy. Bản gốc cũng khai peer này. **Cần Lead xác nhận** |
| `js-yaml` | **ngoài bảng** (`yaml` mới ở bậc 3) | `yaml.load(text, { schema: entryListSchema })` — `entryListSchema` **là** một `js-yaml.Schema`; không parser nào khác tiêu thụ được nó. Bản gốc cũng khai. **Cần Lead xác nhận** |

- `gbh.peers` **7 tên ⊆ `peerDependencies` 7 tên** (so **PHẦN TỬ**, có **3 đối chứng âm** trong test).
- `dependencies` **RỖNG** — peer luôn là `peerDependencies` (một thể hiện do kernel cấp).
- KHÔNG khai `@deepseek-ai/dsh-hmr`: seam HMR đọc qua `ctx.get("hmr")` và khai **theo CẤU TRÚC**
  (`HmrSeam.runExclusive`), nên gói vẫn chạy khi kernel không cấp HMR (`hmr === undefined` ⇒ chạy thẳng).
- **000e**: gói gốc **KHÔNG có `locale/`** ⇒ gói ta cũng không ship, manifest không export locale.
- **000d**: không có một `declare module` ambient nào; peer nạp qua **symlink thật** trong `node_modules` của gói.

## 4. Bằng chứng trên ARTIFACT (đo lại bằng lệnh ghi dưới đây)

| Phép | Kết quả |
|---|---|
| tập export `lib/index.js` | `ConfigEditor` · `default` — **2 = 2** với gốc (0 thiếu · 0 thừa), `default === ConfigEditor` |
| `grep -c "id: @deepseek-ai" lib/index.js` | **0** |
| prototype | `constructor · documentPath · entries · configuration · inherited · edit` — **trùng cả THỨ TỰ** |
| `static inject` | `["loader","profileContext"]` — trùng nguyên văn |
| lớp cha | `Object.getPrototypeOf(ta) === Object.getPrototypeOf(gốc)` ⇒ **cùng một `Service`** của kernel (`§2b`) |
| test | **16 pass / 0 fail / 60 expect** (`bun test tests/host/config-editor.test.ts`) |

```bash
cd packages/host/config-editor && bun run build.ts     # build.ts nhận process.argv[2]
grep -c "id: @deepseek-ai" lib/index.js                # PHAI = 0
cd ../.. && bun test tests/host/config-editor.test.ts
```

## 5. Đối chứng với CHÍNH bundle gốc (đo trong test, không phải suy luận)

Hai bản được cài trên **hai Context cordis THẬT** với **cùng một rig** rồi so từng bước:

1. **`entries()`** — 5 entry giả: 2 row thuộc Include gốc + 1 id trùng + 1 entry của cây khác ⇒ **cùng kết quả** (chỉ `alpha`, `beta`).
2. **`configuration()`** — profile TẠM mang **12 lớp bundle THẬT** (chép danh sách bundle của `profiles/blackhole`) +
   lớp người dùng có `!!js`: `inherited`/`override` của 5 row **khớp từng byte**, gồm
   `deepseek-account` (đi qua nhánh `inherited()`: bỏ ghi đè rồi soạn lại lớp) và `hmr` (`{root: []}` từ lớp bundle).
3. **`edit()` — ba đường lỗi** khớp **nguyên văn** `{name, message}`:
   *entry lạ* / *entry chưa có fiber* ⇒ `Configuration entry is no longer available`;
   *entry có fiber nhưng root Include CHƯA boot* ⇒ `dsh: profile reload requires the root Include entry`.
   Tệp patch **không bị chạm** ở cả ba ca.
4. **Nhánh HMR** — `runExclusive` được gọi **đúng MỘT lần** ở cả hai bản; kết cục khớp; phép chờ dùng
   **`waitFor` CÓ TRẦN** (kèm ca chứng minh `waitFor` kết thúc đúng hạn khi điều kiện không bao giờ đạt).
5. **C6 — DANH TÍNH**: mỗi lượt `configuration()` trả object **MỚI** (`toEqual` ĐẠT, `toBe` KHÁC), sửa bản này
   **không lan** sang bản kia — đo ở **CẢ HAI bản** (nên phép kiểm không rỗng nghĩa).

Phép sửa tệp patch (thêm / thay tại chỗ / xoá config / xoá cả row / `!!js` ⇒ `{__jsExpr}`) được kiểm bằng
**kỳ vọng viết tay suy từ bản gốc** — dán nhãn rõ: **KHÔNG phải A/B** (xem mục 7).

## 6. Bảng TRƯỚC / SAU (điền khi Lead mount)

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| entry `config-editor` trong manifest | stock `disabled: !!js '!ctx.get("profileContext")'` | stock **`disabled: true`**; row chèn `config-editor-ours` mang `disabled: !!js '!ctx.get("profileContext")'` |
| `ctx.configEditor` | lớp stock | lớp của ta — **cùng tên dịch vụ**, cùng `edit(entry, change)`; chỉ MỘT lớp đăng ký |
| ghi cấu hình một plugin | tệp `cordis.patch.yml` của profile đổi | **y hệt** (cùng thao tác trên AST + cùng `writeFileAtomic`) |

## 7. CHƯA làm (nói thẳng)

- ~~Chưa khai `gbh.row`~~ — ĐÃ khai; hợp đồng mount đã sửa ngày 18/10/2026, xem §8.
- ~~Chưa chạy lab / chưa mount~~ — ĐÃ có bằng chứng boot cách ly (log host 0 dòng `did not activate`), xem §8.
- **Đường THÀNH CÔNG của `edit()` chưa có ca test**: nó cần **root Include đã boot**
  (`reconcileProfilePatches` đọc một WeakMap do `app-boot` đặt lúc boot, **không export**), tức cần cả app thật.
  Vì vậy `edit()` mới được đo ở **ba đường lỗi + nhánh HMR**; phần sửa tài liệu được đo **riêng** ở mục 5.
- **Chưa augment `Context`** với `configEditor` như `.d.ts` gốc: gói tiêu thụ duy nhất trong repo
  (`agent-default-model`) đọc qua `ctx.get("configEditor")` với seam khai **theo CẤU TRÚC**, nên augmentation
  chỉ thêm nguy cơ `TS2717` giữa các gói (bài học `session-projection-cache`).
## 8. Sửa lỗi MOUNT 18/10/2026 (task-15) — dịch vụ `configEditor` đăng ký HAI LẦN

### Triệu chứng (log host THẬT của app, boot 21:56)

```text
dsh: warning: 3 entries did not activate
config-editor-ours (@galaxy-blackhole/gbh-config-editor): Error: service "configEditor" has been registered at <ConfigEditor>
```

`check:app` chỉ số (5) = **1 dòng `did not activate`** ⇒ KHÔNG ĐẠT. Nguyên nhân: metadata cũ khai
`disabled: {js: "!ctx.get('profileContext')"}` cho row **STOCK**, rồi chèn bản ta **KHÔNG disabled**;
khi `profileContext` CÓ, CẢ HAI cùng active ⇒ bản ta chết vì trùng tên dịch vụ.

### Cách sửa (mirror oracle theo TẦNG, không tắt tính năng)

| Row | Trước | Sau |
|---|---|---|
| `config-editor` (stock) | `disabled: !!js '!ctx.get(''profileContext'')'` | **`disabled: true`** |
| `config-editor-ours` (chèn) | *không có dòng `disabled`* | **`disabled: !!js '!ctx.get(''profileContext'')'`** (trường `insertDisabled` của CLI) |

Net plugin set y oracle: khi `profileContext` có ⇒ đúng MỘT `ctx.configEditor` (của ta); khi vắng ⇒ không lớp nào.

### Bằng chứng TRƯỚC → SAU (số đo)

| Phép đo | TRƯỚC (boot 21:56) | SAU (boot cách ly 22:26 + `--dump-config`) |
|---|---|---|
| log host: dòng `service "configEditor" has been registered` | **1** | **0** |
| log host: dòng `did not activate` | **1** (`3 entries did not activate`) | **0** |
| `--dump-config`: dòng `disabled` của `config-editor-ours` | **không có** | `disabled: !!js '!ctx.get(''profileContext'')'` |
| `--dump-config`: dòng `disabled` của row stock | `!!js` có điều kiện | **`disabled: true`** |
| mount (`ensureRewriteMounts`) gói này | `ok: false` (row rơi về DSH) | **`ok: true, built: true`** |
| test của gói | 17 ca (chưa có ca mount) | **17 ca · 17 pass · 67 expect** (2 ca canh metadata + `renderRewriteBlock`) |
| `check:rows` | — | **125 gói · 0 chặn** |

> **Ghi chú hạ tầng test (task-28):** test build artifact vào `<pkg>/lib/.test-build` (KHÔNG phải
> `<pkg>/.test-lib` như các test cũ). Lý do ĐO ĐƯỢC: `lib` nằm trong `EXEMPT_DIRS` của cổng lint, còn
> `.test-lib` thì không — nếu một lượt `bun test` chạy SONG SONG với `gate`, cổng `header` quét trúng
> artifact chưa có header 5 dòng và báo ĐỎ OAN. Vẫn nằm trong package nên phân giải peer y nguyên.

Tái lập: `bun test tests/host/config-editor.test.ts` · `bun run apps/cli/src/main.ts host --dump-config` ·
`bun run check:rows`. App THẬT cần một lượt boot của Lead để `(5)` về 0 (log 21:56 vẫn là boot CŨ).
