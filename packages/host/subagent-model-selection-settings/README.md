<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 11/11/2026
 desc README cua @galaxy-blackhole/gbh-subagent-model-selection-settings — ban viet lai cua row
      @deepseek-ai/dsh-tool-subagent/model-selection-settings (M6, row MOT MAT, 68 dong)
      11/11/2026: row nay do LOP BUNDLE cam (gbh.row.ownedByBundle) ⇒ config nam o bundle patch,
      khong con o metadata lan overlay (xem muc "Lop nao cam row nay")
-->

# @galaxy-blackhole/gbh-subagent-model-selection-settings

Bản viết lại của Galaxy Blackhole cho row `subagent-model-selection-settings` — **subpath**
`@deepseek-ai/dsh-tool-subagent/model-selection-settings` (68 dòng bundle gốc). Row này là **chủ sở hữu
DUY NHẤT** lựa chọn model cho tool giao việc: nó cấp dịch vụ `ctx.subagentModelSelection`, và tool
subagent đọc `current()` mỗi lần soạn Session để biết có được phép chọn model con hay không.

## Nguồn đối chiếu (G4)

| Hạng mục | Nguồn |
|---|---|
| Bề mặt dịch vụ (`current()`, tên dịch vụ, `Config`) | `@deepseek-ai/dsh-tool-subagent@0.2.1-alpha.4` — `lib/model-selection-settings.js` + `lib/types/model-selection-settings.d.ts` (đọc trong `apps/host/node_modules`, CHỈ ĐỌC) |
| Hình dạng tuyến (`provider`/`model`) + schema dùng chung | `lib/types/model-selection.d.ts` của cùng gói: `AllowedModelRouteSchema`, `modelRouteKey`, `assertAllowedModelRoutes` |
| Row gốc trong cây | `id: subagent-model-selection-settings` — `docs/PARITY-MATRIX.md` dòng 152 (T4) |
| Bản ghi cấu hình đang BẬT trong profile `blackhole` | `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng 480-486 (`enabled: true`, `allowedModels: [{ provider: auto, model: deepseek-v4.1-flash }]`) |
| Test hành vi | `tests/host/subagent-model-selection-settings.test.ts` (16 test / 78 expect) |

**Không chép code**: mã nguồn viết lại theo hợp đồng đọc từ `.d.ts` + bundle; chỉ `node:` builtins và
peer của kernel.

## Peer (theo luật seam của repo)

| Tên | Vì sao là peer |
|---|---|
| `@deepseek-ai/cordis` | `Service` + `Context`/`Volatile` — kernel cấp MỘT thể hiện |
| `@deepseek-ai/schemastery` | `Config` schema (hai trường `volatile()` để Settings sửa được tại chỗ) |
| `@deepseek-ai/dsh-llm` | **không dùng lúc chạy** — bản gốc mang `import "@deepseek-ai/dsh-llm";` ở ĐẦU module (dấu vết của `import type` upstream). Giữ nguyên để **đồ thị module khớp từng specifier**; khai peer để kernel cấp đúng một thể hiện thay vì kéo bản sao thứ hai |

Cả ba nằm trong `peerDependencies` (không bao giờ ở `dependencies`): `gbh.peers = ["@deepseek-ai/dsh-llm"]`
là phần **thêm vào** hai tên mà `mount.ts` luôn tự thêm (`cordis`, `schemastery`).

## Lớp nào cắm row này (11/11/2026 — sửa lỗi thật trên app 5439)

Row do **LỚP BUNDLE** cắm, không phải lớp overlay `app.patch.yml`:

| Nơi | Nội dung |
|---|---|
| `packages/host/bundle/web-app.patch.yml` | `- id: subagent-model-selection-settings` + `name: '@galaxy-blackhole/gbh-subagent-model-selection-settings'` + `config: {enabled, allowedModels}` (sinh bởi bảng `CONFIG_ROW_LOP_BUNDLE` + `GOI_RIENG_CUA_ROW` trong `tools/gen-bundle-patches.ts`) |
| `gbh.row` của gói này | `ownedByBundle: true` ⇒ `renderRewriteBlock` trả chuỗi rỗng, `bh host` KHÔNG sinh `disable + insert <id>-ours` |

Vì sao: tài liệu cài đặt của người dùng (`<profile>/cordis.patch.yml`) nằm SAU bundle nhưng TRƯỚC overlay.
Row bị overlay ghim ⇒ mỗi lượt `settings/mutate` ghi xong lại bị lớp cuối nuốt, Host ném
`overridden by a home patch or command-line overlay` ⇒ công tắc "Dùng đúng model chính" không lưu được.
Đo lại sau khi sửa (host thật, cùng home): `settings/mutate` trả `ok:true`, revision 0 → 1 → 2.

## Cơ chế (giống hệt oracle)

- **Tham chiếu SỐNG, không sao chép lúc dựng**: `config.enabled` / `config.allowedModels` là `Volatile`;
  mỗi lượt `current()` đọc lại `.get()`, nên giá trị vừa được Settings sửa là **thấy ngay**.
- **Bản chụp TÁCH RỜI (luật C6)**: mỗi lượt trả `{ enabled, allowedModels: routes.map(r => ({ ...r })) }` —
  mảng MỚI và từng tuyến là object MỚI. Sửa bản chụp **không** chạm cấu hình; hai thực thể dịch vụ **độc lập**.
- **Kiểm toàn vẹn ở biên** (`assertAllowedModelRoutes`): không phải mảng · phần tử không phải object ·
  object thiếu `provider`/`model` · chuỗi rỗng · tuyến TRÙNG (khoá `provider\0model`) ⇒ ném, đúng ba
  thông điệp của bản gốc.
- **Bật mà danh sách rỗng** ⇒ ném `enabled subagent model selection requires at least one allowed model`
  (mặc định của schema là TẮT + danh sách RỖNG, nên cấu hình trống vẫn hợp lệ).
- `name = "subagent-model-selection-settings"` **nguyên văn**; `export default` là chính lớp đó.

## Bằng chứng parity (18/10/2026) — đo trên ARTIFACT, đối chứng với chính bundle gốc

Hai bên cài trên **cùng một `Context` cordis thật** (`apps/host/node_modules/@deepseek-ai/cordis`), cùng
một cấu hình thô; số đo dưới đây là của cả HAI bên (bằng nhau từng ca):

| Phép đo | TRƯỚC (bundle gốc) | SAU (bản của ta) |
|---|---|---|
| Tập export trên artifact | `SubagentModelSelectionConfig` · `default` · `name` | **y hệt** (`lib/index.js`) |
| Đăng ký id module | 0 (`import "@deepseek-ai/dsh-llm"` là module ngoài) | **0** — `grep -c 'id: "@deepseek-ai'` = **0** |
| `String(Config)` | `{ enabled?: boolean, allowedModels?: { provider: string, model: string }[] }` | **y hệt từng chữ** |
| `current()` với cấu hình mặc định | `{ enabled: false, allowedModels: [] }` | **y hệt** |
| `current()` với `enabled: true` + 1 tuyến | `{ enabled: true, allowedModels: [{ provider: "auto", model: "m" }] }` | **y hệt** |
| Sửa `Volatile` tại chỗ rồi đọc lại | thấy giá trị mới | **y hệt** |
| Tuyến trùng · bật-mà-rỗng · mảng sai · phần tử `null` | 4 thông điệp lỗi | **y hệt từng chữ** |
| Danh tính bản chụp (C6) | mỗi lượt object/mảng/tuyến MỚI | **y hệt** |
| `Object.getOwnPropertyNames(prototype)` | `constructor` · `current` | **y hệt** |

Từ điển: `locale/{en,zh}.json` chép **byte-for-byte** từ `locale/model-selection-settings/{en,zh}.json`
của gói gốc (shasum `en d884ab95d5a2…` · `zh a48550901b66…`) + export `./locale/*.json` — runtime dùng
`meta.title` làm tiêu đề hàng trong màn Plugins, thiếu file thì tiêu đề rơi về tên package của ta (khác oracle).

## Phần CHƯA làm (điều kiện chặn mount, không phải ghi chú)

- **CHƯA khai `gbh.row`** — có **test canh** khẳng định điều đó (`TEST CANH (luật §7)`). Chưa mount ⇒
  **chưa có** số đo `(5) did not activate` · `(8) #root` · `check:app` trên app 5439, và **chưa** có dòng
  trong bảng "đã thay N row". Các phép đó thuộc **lượt boot của Lead**.
- Vì vậy bảng TRƯỚC/SAU ở trên là phép đo **trong harness chung**, KHÔNG phải A/B trên app thật.
- `profiles/node_modules/@galaxy-blackhole/gbh-subagent-model-selection-settings/lib/` chưa tồn tại
  (chỉ sinh ra ở lượt mount đầu tiên).

## Ghi chú cho người sau: peer được giải bằng SYMLINK, không bằng ambient `declare module`

Luật `000d` cấm ambient shim; ba peer thật (`cordis`, `schemastery`, `dsh-llm`) được trỏ bằng
**symlink** trong `node_modules/` của chính package này — cùng quy ước các gói host khác đang dùng.

⚠️ `node_modules/` và `packages/*/*/lib/` bị `.gitignore` ⇒ **symlink không đi theo bản sao khác**.
Sau khi clone (hoặc ai đó xoá `node_modules` của gói), phải tạo lại — nếu không `tsc`/`bun test` sẽ
không giải được peer:

```bash
cd packages/host/subagent-model-selection-settings
for p in cordis schemastery dsh-llm; do
  mkdir -p node_modules/@deepseek-ai
  ln -sfn "../../../../../apps/host/node_modules/@deepseek-ai/$p" "node_modules/@deepseek-ai/$p"
done
```
