<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc G4 + bằng chứng hành vi của @galaxy-blackhole/gbh-settings (row settings)
-->

# `@galaxy-blackhole/gbh-settings` — bản viết lại row `settings`

Dịch vụ **`settings`**: chiếu schema Config của từng plugin trong profile thành biểu mẫu chỉ gồm
**trường SỐNG** (volatile), giữ **revision** cho từng entry, che secret theo cấu trúc, và ghi thay đổi
qua **tệp patch của profile** (seam `configEditor`).

## 1. Nguồn đối chiếu (G4)

| hạng mục | bản gốc | ta |
|---|---|---|
| gói | `@deepseek-ai/dsh-settings` (`apps/host/node_modules/…`) | `@galaxy-blackhole/gbh-settings` (`packages/host/settings`) |
| entry | `lib/index.js` **544 dòng** | **5 module nguồn** (`types` · `redact` · `schema` · `paths` · `service`) → `lib/index.js` **503 dòng** |
| export runtime | `SettingsConflictError` · `SettingsForms` · `default` (chính lớp đó) · `redactSecrets` | **4 = 4**, đo trên **ARTIFACT** đã build, đối chứng với chính `lib/index.js` gốc |
| locale | `locale/en.json` · `locale/zh.json` | chép **byte-for-byte** (sha256 `43ec5019…` · `e3e50a66…`) |
| kiểu phụ | `lib/types/*.d.ts` (118 + 37 + 24 + 76 dòng) | **không ship** — xem §7 |

## 2. BƯỚC 0 — bốn phép (dump `.parity/dumps/2026-10-18T01-31-57/ours.yml`)

| # | phép | kết quả |
|---|---|---|
| i | cặp `- id: settings` + `name: '@deepseek-ai/dsh-settings'` | **CÓ**, dòng **83–84**; tên gói này xuất hiện **đúng 1 lần** trong `ours.yml` (không suy từ tên thư mục) |
| ii | `dsh.client` trong `package.json` gốc · `lib/client.js` | **KHÔNG có** · **KHÔNG tồn tại** ⇒ **MỘT MẶT** |
| iii | `disabled:` | **CÓ** — `disabled: !!js '!ctx.get(''profileContext'')'` ⇒ **TẮT CÓ ĐIỀU KIỆN** (xem §10). **Lead đã khai `gbh.row` giữ NGUYÊN VĂN biểu thức này** (worker KHÔNG tự khai) |
| iv | `config:` · `inject:` của row ĐANG CHẠY | **KHÔNG có cả hai**; row chỉ có `name` + `disabled`. `disabled` dùng dạng `ctx.get(...)` — **không** phải `ctx.<X>`, nên luật *`ctx.X` ⇒ `inject X`* không áp |

## 3. Năm câu hỏi

1. **Row có đang BẬT không?** — Tắt **có điều kiện**: bật khi có `profileContext` (profile `blackhole` có), tắt trong ngữ cảnh không có profile.
2. **Thuần host hay có mặt client?** — **Thuần host**: manifest gốc không có `dsh.client`, không có `lib/client.js`.
3. **Cần seam nào?** — `configEditor` + `profileContext` (**`static inject`** nguyên văn), `root.loader.await()`, `ctx.effect`/`ctx.on`/`ctx.emit`, `ctx.logger`.
4. **Hành vi đo được là gì?** — Biểu mẫu trả về từ `describe()` (giá trị + lớp nền + lớp người dùng + sổ secret + revision), sự kiện `settings/document-updated`, và **nội dung tệp patch** sau mỗi lượt ghi.
5. **Gói gốc có `dsh.client` không?** — **Không** ⇒ không mất nửa client nào khi thay row.

## 4. Peer — `gbh.peers` ⊆ `peerDependencies` (so PHẦN TỬ)

| peer | bậc (`HOST-ROW-REWRITE.md` §3b) | vì sao |
|---|---|---|
| `@deepseek-ai/cordis` | 1 — kernel | `SettingsForms extends Service` phải **cùng một lớp**; `resolveConfig` phải là của kernel |
| `@deepseek-ai/schemastery` | 1 — kernel | `new Schema(schema.toJSON())` + `Schema.object(dict)` dựng biểu mẫu |
| `yaml` | 3 — thư viện npm | `parse` tài liệu `settings.yaml` cũ |
| `@deepseek-ai/cordis-plugin-loader` | **ngoài bảng §3b** | `interpolate` **chính là** phương ngữ `!!js` (`new Function` + `with (ctx)`) — viết lại là dựng bản sao thứ hai của bộ đánh giá của Loader ⇒ lớp thừa kế sẽ lệch. **Cần Lead xác nhận** (tiền lệ: `config-editor`) |

`dependencies` **RỖNG**; `@deepseek-ai/cosmokit` chỉ ở `devDependencies` (test A/B với tham chiếu volatile THẬT — xem §7).
`static inject = ["configEditor", "profileContext"]` — hai seam lấy từ context, **không** import gói nào.

## 5. Bề mặt (đo trên ARTIFACT)

| phép | kết quả |
|---|---|
| `Object.getOwnPropertyNames(SettingsForms.prototype)` | **13 tên, TRÙNG THỨ TỰ** gốc: `constructor` · `importLegacyDocument` · `configure` · `invalidate` · `writable` · `documentPath` · `prepareDocument` · `describe` · `update` · `replace` · `mutate` · `write` · `schema` |
| `Object.keys(thể hiện)` | `ctx` · `name` · `ownerContext` · `revisions` · `closed` · `scheduled` · `presentations` (TRÙNG) |
| lớp nền | `Object.getPrototypeOf(SettingsForms)` **LÀ CÙNG** `Service` của kernel |
| `default` | chính lớp đó (`=== SettingsForms`) ở **cả hai** bản |
| `lib/index.js` | `grep -c "id: @deepseek-ai"` = **0**; `__ModuleLoader__` = **0** |

## 6. Bám sát bản gốc — những chỗ dễ lệch

- **Sổ revision khoá theo `entry.id`** (id đầy đủ đã ghép tổ tiên), còn `ns` gửi ra là `entry.options.id`. Hai giá trị này **khác nhau** trong cây Include; đổi chỗ sẽ làm revision va nhau.
- **`raw` của revision** = `JSON.stringify([fiber.uid, schema.toJSON(), options.config ?? {}])` — đổi **bất kỳ** thành phần nào là +1.
- **Che secret** đi qua đúng **5 nhánh** `object` · `dict` · `array` · `union`/`intersect` · `transform`; khoá lạ trong object được **giữ nguyên**, vị trí secret khử trùng theo `JSON.stringify(path)` với `set` **OR** giữa các nhánh union.
- **`describe()` chỉ nhận entry** có schema `toJSON`, `fiber.runtime !== null`, `fiber.state === 2` và **có ít nhất một trường sống**.
- **`replace()` đặt lại mọi trường sống** (nền = lớp thừa kế, không phải lớp hiện tại) nhưng **giữ trường thường** của row — ngữ nghĩa dễ viết sai nhất.
- **`mutate()` với `unset`**: nếu cha là **mảng** thì xoá phần tử (`splice`); nếu không, nó **khôi phục giá trị thừa kế** tại đúng đường dẫn (hoặc xoá hẳn khi không có) — nhờ vậy form đã che secret không cần khai lại secret.
- **`write()` kiểm revision NGAY trong callback của `edit`** (sau `describe()` mới), và **kiểm đường dẫn sống** hai lượt: trước khi gọi `edit` và trên cây kết quả.
- **Nhập `settings.yaml` cũ**: đổi tên tệp **trước** lượt ghi đầu tiên; mục lỗi chỉ **ghi log** và ở lại tệp `.imported`; `shell` ánh xạ theo `process.platform`.
- **Thông điệp lỗi** giữ **nguyên văn** (`Config field "…" is not volatile` · `Config array index "…" is out of range` · `Config … contains …` · `No configurable plugin entry "…"` · `Plugin entry "…" has no volatile fields` · `Plugin entry "…" is no longer configurable` · `Settings presentation is already configured for this plugin instance`).

## 7. Khác biệt CÓ Ý (đã cân nhắc, không phải thiếu sót)

1. **`isVolatile` tự viết** bằng `Symbol.for("cosmokit.volatile.write")` thay vì import `@deepseek-ai/cosmokit`: cosmokit khai **khoá toàn cục** nên phép nhận dạng tương đương tuyệt đối, mà gói bớt một peer. **Test A/B dùng `createVolatile` THẬT** của cosmokit để chứng minh.
2. **Không ship `lib/types/*`** và **không augment `Context.settings`**: bản build của ta chỉ có `lib/index.js` (như mọi row host khác trong repo). Augment toàn cục `@deepseek-ai/cordis` là **000d-nguy hiểm** (đè kiểu ở gói khác) nên cố ý bỏ.
3. **Không có subpath `./types`**: chỉ `.` · `./package.json` · `./src/*` · `./locale/*.json`.

## 8. Bằng chứng — `tests/host/settings.test.ts`

**21 test / 149 expect / 0 fail**, mọi ca chạy **CẢ HAI bản** trên **Context cordis THẬT**:

| nhóm | nội dung |
|---|---|
| ARTIFACT | tập export **4 = 4** so với chính bundle gốc; `id: @deepseek-ai` = 0; prototype **13 tên** trùng thứ tự; `Object.keys` thể hiện trùng; cùng `Service` nền |
| `describe()` | cùng kịch bản ⇒ **cùng biểu mẫu** (schema đã chuẩn hoá `uid`): `value`/`base`/`user`, biểu thức `!!js` phân giải bằng `fiber.ctx`, tham chiếu volatile được bóc; che secret: sổ `secrets` **từng phần tử**; revision ổn định/+1/sự kiện/entry biến mất |
| ghi | `update` · `replace` · `mutate` cho **cùng nội dung patch**; **9 đường lỗi TRÙNG NGUYÊN VĂN**; `SettingsConflictError` đủ `name`/`code`/`expected`/`actual` và **patch không bị chạm** |
| **C6** | hai lượt `describe` trả `value`/`secrets`/`schema` **KHÁC DANH TÍNH** (sửa bên này không lan); hai thể hiện dịch vụ có sổ `revisions`/`presentations` riêng; `configure` khoá theo **fiber** + đối chứng âm (lần hai vẫn bị chặn) |
| flaky | `waitFor` **CÓ TRẦN** 500ms cho lượt nhập `settings.yaml` và cho `app-boot/config-reload` (microtask), **+ ca chứng minh `waitFor` kết thúc đúng hạn** khi điều kiện không bao giờ đạt |
| peer | `gbh.peers ⊆ peerDependencies` so **PHẦN TỬ** + **3 ĐỐI CHỨNG ÂM** (xoá một · xoá sạch · thừa tên) + ca **cùng số lượng, khác phần tử** |
| 000e + metadata | locale **byte-for-byte** + có trong `exports`; **metadata `gbh.row` do LEAD khai khớp dump** (id `settings` · `disabled` giữ nguyên văn `!!js` · `tests`) |

## 9. Luật 000e

Bản gốc **có** `locale/` ⇒ ta ship đủ hai tệp, **byte-for-byte**:
`locale/en.json` sha256 `43ec5019c95f91fedc80864d587fce6592159ddb655806de763c20510374a5fe`,
`locale/zh.json` sha256 `e3e50a666a64e2f7acdf1a43ab7d8f1b817e1be2237345cddab10de3d2bb24ec`.

## 10. TRƯỚC/SAU và việc CHƯA làm

- **TRƯỚC/SAU: chưa có** — gói **chưa mount** (chưa có phép đo trên app 5439). `gbh.row` do **LEAD** khai sau khi gói xong: `id: settings` + `disabled: { js: '!ctx.get(''profileContext'')' }` + `tests` (worker KHÔNG tự khai).
- Lý do **không mount**: row `settings` có `disabled: !!js '!ctx.get(''profileContext'')'` — **tắt có điều kiện**. Cùng lớp với `config-editor` · `desktop-product-telemetry` · `llm-deepseek`: mount khi chưa có quyết định của Lead là đổi hành vi sản phẩm mà không có phép đo bù.
- **CHƯA làm**: `lab:row` · mount + `check:app` + A/B trên app thật (thuộc lượt boot của Lead) · `lib/types/*.d.ts` (không ship, xem §7).

## Mount (đã verify)
**mount 19/10/2026 bằng `disabled:true` + `insertDisabled`; verify app 11/11** — row stock tắt HẲN, row của ta giữ đúng điều kiện `!ctx.get('profileContext')`; không còn trùng service `settings`.
