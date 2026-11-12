<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-permission — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU,
      và phần CHƯA làm (row permission của M6)
-->

# @galaxy-blackhole/gbh-permission — row `permission`

Bản viết lại của Galaxy Blackhole cho row **`permission`** của DSH:
gói gốc **`@deepseek-ai/dsh-permission-presets`** v0.2.1-alpha.4 — *preset quyền hướng người dùng*
(`ctx.permissionPresets`): **MỘT** bảng preset gộp **chế độ sandbox** với **chính sách duyệt**, ghi qua
**đúng đường ghi của từng núm**, cộng **catalog cấp tiến trình** (Remote `catalog`), **đơn vị chiếu
`permissions`**, **preset Auto chỉ-sống-theo-tích hợp**, và **lệnh `/permission`**.

> Trạng thái: **đã viết xong bề mặt, CHƯA khai `gbh.row`** (trạng thái an toàn — chưa khai thì `bh host`
> không sinh khối patch nên gói **không thể** làm hỏng app của người khác). Xem §9.

## 1. Bảng nguồn đối chiếu (G4)

| # | Nguồn (CHỈ ĐỌC) | Dùng để | Mức dẫn xuất |
|---|---|---|---|
| 1 | `apps/host/node_modules/@deepseek-ai/dsh-permission-presets/lib/index.js` (**408 dòng**) | toàn bộ HÀNH VI: bảng preset, đường ghi, catalog, chiếu `permissions`, ghim quyền, Auto, lệnh | **viết lại theo hành vi** (không chép code) |
| 2 | `…/lib/types/index.d.ts` (204 dòng) | bề mặt lớp (public/private), kiểu `Config`, JSDoc nghĩa của từng nhánh | viết lại theo nghĩa |
| 3 | `…/lib/types/types.d.ts` (59 dòng) | `PresetOption` · `PermissionCatalog` · `PermissionSelection` · khai `Events` | viết lại theo nghĩa |
| 4 | `…/lib/types/client.d.ts` + `…/lib/types/client.js` | chứng minh `exports["./client"]` của bản gốc chỉ là **lối KIỂU** (`export {}`) | đọc để phân loại MỘT MẶT/HAI MẶT |
| 5 | `…/README.md` | nghĩa sản phẩm: preset, `custom`, Auto, mặc định phiên, giới hạn đã biết | tham khảo |
| 6 | `…/package.json` | danh sách peer gốc (9 gói) + `dependencies` (`schemastery` · `zod`) | đối chiếu peer |
| 7 | `apps/host/node_modules/@deepseek-ai/dsh-sandbox-policy` · `…/dsh-user-approval` · `…/dsh-commands/brand` | **setter chuẩn tắc** của hai núm + đóng thương hiệu `definitionId` | dùng NGUYÊN HÀM (peer) |
| 8 | `…/.parity/dumps/2026-10-18T01-31-57/ours.yml` dòng **212–224** | `config` ĐANG CHẠY của row | chép nguyên văn vào §4 |

## 2. BƯỚC 0 — ba phép bắt buộc (đo trên dump MỚI NHẤT `2026-10-18T01-31-57`)

| # | Phép | Kết quả |
|---|---|---|
| i | cặp `- id: permission` + `name: '@deepseek-ai/dsh-permission-presets'` | **CÓ THẬT**: `ours.yml` dòng **212–213**, row **ĐANG BẬT** (không `disabled`); `oracleA.yml` 190 · `stock.yml` 153 |
| ii | `dsh.client` trong `package.json` gốc **VÀ** `lib/client.js` | **KHÔNG** có `dsh` (⇒ không có `dsh.client`); **KHÔNG** tồn tại `lib/client.js`; `lib/index.js` = **408 dòng** > 0 ⇒ **MỘT MẶT** (gói thay được bằng disable+insert) |
| iii | `config`/`inject` chép từ **`ours.yml` đang chạy** (KHÔNG từ `oracleA_nopatch`) | `config.presets` ba mục — xem §4; `inject:` **KHÔNG có** trong ours.yml ⇒ không cần `inject` (config không có `!!js`/`ctx.<X>` nên không mượn seam nào ở tầng patch) |

## 3. Năm câu hỏi

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row đang BẬT? | **CÓ** — `ours.yml` dòng 212 không có `disabled`; patch của oracle không tắt nó |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST** — `exports["./client"]` chỉ là lối kiểu `export {}` (`lib/types/client.js` 10 dòng), không có bundle browser |
| 3 | Cần seam nào? | `shell` (đọc `sandboxMode`) · `approval` (đọc `config.policy`, ghi `setPolicy`) · `sessions` (`list`) · `sessionProjections` (`register`/`stateOf`) · `commands` (tuỳ chọn) · `settings` (tuỳ chọn) · `@deepseek-ai/dsh-typert-protocol` (`TypertRemoteService` + `@Remote`) |
| 4 | Hành vi ĐO ĐƯỢC? | `ctx.permissionPresets` + RPC **`permissionPresets/catalog`** (`{options, defaultOptions, defaultPreset}`) · chiếu **`permissions`** (`stateVersion 2`, khung nhìn `{currentValue}`) · ba sự kiện phiên `permission/preset`/`sandbox/mode`/`approval/policy` · sự kiện `permission-presets/catalog-changed` · lệnh `/permission` |
| 5 | Gói gốc có `dsh.client`? | **KHÔNG** (và không có `lib/client.js`) ⇒ câu 5 = KHÔNG ⇒ **MỘT MẶT** |

## 4. `config` + `inject` ĐANG CHẠY (chép từ `ours.yml` dòng 214–224)

```yaml
- id: permission
  name: '@deepseek-ai/dsh-permission-presets'
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: ask
      workspace-write:
        sandbox: workspace-write
        approval: ask
      danger-full-access:
        sandbox: danger-full-access
        approval: never
```

- **`inject`: KHÔNG có** trong `ours.yml` ⇒ khi khai `gbh.row` thì **không** khai `inject`.
- **`config` KHÔNG chứa `!!js`**, nên luật "*`!!js` dùng `ctx.<X>` ⇒ `inject` phải chứa `<X>`*" không áp.
- Row **không có `defaultPreset`** ⇒ mặc định suy ra từ mặc định thành phần (executor `workspace-write` +
  approval `ask` ⇒ `workspace-write`), đúng như bản gốc.

## 5. Bề mặt service (đo trên ARTIFACT)

| Hạng mục | Giá trị | Đối chiếu gốc |
|---|---|---|
| export `lib/index.js` | `AUTO_PRESET` · `CUSTOM_PRESET` · `PermissionPresetService` · `default` (= lớp) | **4 = 4**, 0 thiếu · 0 thừa |
| prototype | `constructor · names · catalog · registerAuto · defaultPreset · permissionState · current · derive · resolve · optionOf · set · apply · pinInitialPermission · emitCatalogChanged · specOf` | **TRÙNG TỪNG TÊN VÀ THỨ TỰ** |
| static | `length · name · prototype · Config · inject` | trùng; `inject = ["shell","approval","sessions","sessionProjections"]` |
| `String(Config)` | `{ presets?: { [key: string]: { sandbox: … }, … }, defaultPreset?: string }` | **trùng từng ký tự** |
| Remote | `@Remote("catalog")` → endpoint `permissionPresets/catalog` | trùng |
| Chiếu | `permissions` · `stateVersion 2` · `init {preset:null, sandbox:null, approval:null, seeded:false}` · `wire {currentValue}` | trùng |
| Lệnh | `definitionId "@deepseek-ai/dsh-permission-presets"` · `name "permission"` · `input {hint:"<preset>"}` | trùng |

`grep -c "id: @deepseek-ai" lib/index.js` = **0** (chuỗi `@deepseek-ai/dsh-permission-presets` duy nhất trong
artifact nằm trong `CommandDefinitionId("…")` — danh tính lệnh của gói gốc, **không** phải id module).

## 6. Peer — vì sao từng tên (và tên nào NGOÀI bảng §3b)

| Peer | Bậc §3b | Vì sao ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | `Context`/`Service`/`effect`/`inject` — mọi plugin đều cần; `Context` cũng là chỗ khai `ctx.permissionPresets` |
| `@deepseek-ai/schemastery` | 1 | `static Config` để kernel kiểm cấu hình row và Settings render từng trường |
| `@deepseek-ai/dsh-typert-protocol` | 2 | `TypertRemoteService` + `@Remote` — **cùng lớp nền** thì Gateway của kernel mới discovery được `catalog` |
| `@deepseek-ai/dsh-sandbox-policy` | 2 (row executor) | `SANDBOX_MODES` + `setSandboxMode` — **đường ghi chuẩn tắc** của núm sandbox: phải là **cùng hàm** để sự kiện `sandbox/mode` có đúng hình dạng |
| `@deepseek-ai/dsh-user-approval` | 2 (seam duyệt) | `APPROVAL_POLICIES` + `setApprovalPolicy` — như trên cho núm duyệt; bản gốc cũng gọi chính hai hàm này |
| `@deepseek-ai/dsh-commands` | 2 (seam lệnh) | `CommandDefinitionId` — **đóng thương hiệu** danh tính lệnh; tự chế một hàm copy sẽ làm danh tính lệnh lệch khỏi gói gốc |

- `zod` (4.4.3) là **dependency**, không phải peer: đây là **thư viện**, không phải seam (bậc 3 §3b).
- **Ba peer cuối** (`dsh-sandbox-policy` · `dsh-user-approval` · `dsh-commands`) **không có tên riêng** trong
  bảng §3b nhưng đều thuộc **bậc 2 — "seam dịch vụ của DSH, được phép khi row thật sự gọi seam đó"**; bản
  gốc khai **đúng ba gói này** trong `peerDependencies`. ⇒ **cần Lead xác nhận** việc giữ nguyên ba tên này
  (tiền lệ: `user-questions` · `jobs-local` · `workflow` · `subagent-*` đã khai peer ngoài danh sách liệt kê).
- `gbh.peers ⊆ peerDependencies` kiểm **THEO PHẦN TỬ** (không so số lượng) trong test, kèm **ĐỐI CHỨNG ÂM**
  (xoá-một-tên · xoá-sạch · thừa-tên · cùng-độ-dài-mà-lệch).

## 7. Khác biệt CÓ Ý so với bản gốc (ghi để người sau không tưởng là thiếu)

1. **Không ship các lối máy sinh/kiểu**: `./types` · `./client` · `./typert` · `./remote` của bản gốc là
   **lối kiểu** hoặc **artifact máy sinh** (`typert.host.js` 774 dòng). Ta giữ **`lib/index.js`** — đúng
   nguyên tắc đã dùng cho `settings-controller` (*"không ship artifact `./typert` máy sinh"*).
2. **Module augmentation**: chỉ khai trên `@deepseek-ai/cordis` (`Context.permissionPresets` +
   `Events["permission-presets/catalog-changed"]`). Các khai trên `@deepseek-ai/dsh-session/types` và
   `@deepseek-ai/dsh-session-projection/types` được thay bằng **kiểu CẤU TRÚC** trong `src/types.ts` —
   cùng quy ước với `session-title` · `session-stats` · `working-directory` (không import gói seam nào).
3. **Method `private` giữ nguyên như `.d.ts` gốc** (`permissionState` · `derive` · `apply` ·
   `pinInitialPermission` · `emitCatalogChanged` · `specOf`); ở tầng chạy chúng vẫn nằm trên prototype
   nên phép so prototype **trùng từng tên**.
4. **Không chép JSDoc dài** của bản gốc: mô tả viết lại theo nghĩa, giữ **thông điệp lỗi NGUYÊN VĂN**
   (11 thông điệp) vì chúng là hợp đồng quan sát được.

## 8. TRƯỚC / SAU — phép đo đã chạy

| Phép đo | Lệnh | Kết quả |
|---|---|---|
| `bun test tests/host/permission.test.ts` | — | **16 test · 188 expect · 0 fail** |
| tập export + prototype + static + `String(Config)` | trong test (đo trên ARTIFACT) | **4 = 4** · prototype **15 tên trùng thứ tự** · `Config` **trùng từng ký tự** |
| hành vi A/B với **chính bundle gốc** trên Context cordis THẬT | trong test | `catalog`/`optionOf`/`resolve`/`names` · `current` (8 tổ hợp) · `set` (4 lần chuyển) · ghim quyền (tươi/created/partial/seeded/auto) · **5 đường lỗi constructor** · đơn vị chiếu (5 sự kiện) · `registerAuto` vòng đời · lệnh `/permission` — **Y HỆT từng chuỗi JSON** |
| id trong artifact | `grep -c "id: @deepseek-ai" lib/index.js` | **0** |
| locale 000e | `shasum locale/*.json` | `en.json` `6368211c…` · `zh.json` `d88e32a6…` — **byte-for-byte** với gốc |

## 9. CHƯA làm (điều kiện chặn mount — nói thẳng)

- **CHƯA khai `gbh.row`** — theo chỉ đạo: gói viết xong bề mặt nhưng **chưa mount**; có **TEST CANH**
  khẳng định `gbh.row` vắng mặt (ai bật sớm thì test đỏ ngay).
- **CHƯA chạy `lab:row`** và **CHƯA mount lên app 5439** (thuộc lượt boot của Lead) ⇒ **chưa có bảng
  TRƯỚC/SAU trên app thật**; §8 là các phép đo **trên artifact + đối chứng bundle gốc**.
- **CHƯA đo A/B thị giác** — row host không vẽ gì lên màn hình nên phép đo tương ứng là `(5)` *did not
  activate* + entry trong manifest, sẽ làm ở lượt boot.
