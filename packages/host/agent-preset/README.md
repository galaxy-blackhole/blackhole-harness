<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bảng nguồn đối chiếu (G4) + kết luận điều tra cho dạng BỐN ROW DÙNG CHUNG MỘT GÓI của gói gbh-agent-preset
-->

# `@galaxy-blackhole/gbh-agent-preset`

Bản viết lại của `@deepseek-ai/dsh-agent-preset` — **một lớp plugin** khai một preset agent
(`id` · `name` · `description` · `order` · `plugins`) lên sổ `agentPresets` của kernel.

* **Bản gốc**: `apps/host/node_modules/@deepseek-ai/dsh-agent-preset/lib/index.js` — **29 dòng**, **MỘT MẶT**
  (không có `lib/client.js`, không có khoá `dsh.client`).
* **Ta**: `lib/index.js` **28 dòng** build ra — cùng một lớp, cùng bốn static, cùng một generator.
* **Trạng thái**: **CHƯA khai `gbh.row`** — xem §2 (lý do là một **cơ chế còn thiếu**, không phải việc viết dở).

## 1. Bảng nguồn đối chiếu (G4)

| Thứ đo được | Bản gốc (bằng chứng) | Bản của ta |
|---|---|---|
| Tập export trên **ARTIFACT** | `["default"]` | `["default"]` — **0 thiếu · 0 thừa** (ca test đo trên `lib/index.js` đã build) |
| Hình dạng plugin | lớp `AgentPreset`, `export { AgentPreset as default }` | lớp `AgentPreset`, `export default class` ⇒ cùng tập export |
| Seam | `static inject = ["agentPresets"]` | nguyên văn |
| Khoá nhóm entry | `static [EntryGroup.key] = true` (`Symbol.for("cordis.group")`) | nguyên văn — **cùng một symbol toàn cục** (test so danh tính) |
| Schema cấu hình | `z.object({ id: required, name, description, order, plugins: required })` | nguyên văn; `String(Config)` **trùng từng chữ**: `{ id: string, name?: string, description?: string, order?: number, plugins: any[] }` |
| Chuẩn hoá + lỗi schema | `$.id missing required value` · `$.plugins missing required value` · `$.id expected string but got 5` | **trùng từng chữ** ở cả 5 ca sai (test so thông điệp của hai bên) |
| Đăng ký | `async *[Service.init]() { yield await this.ctx.agentPresets.register(this.config); }` | nguyên văn: **1** lượt `register`, chuyển tiếp **CÙNG** vật cấu hình, nhả **ĐÚNG MỘT** disposer = đúng hàm seam trả về (so danh tính) |
| Constructor | chỉ gán `ctx`/`config`, **0** lượt chạm seam | nguyên văn (`Object.keys(instance)` = `["ctx","config"]`) |
| Đường lỗi | lỗi của seam đi qua **nguyên vẹn** | nguyên văn (test khẳng định **cùng một vật lỗi**) |
| Nửa browser | không có | không có |

## 2. VÌ SAO CHƯA KHAI `gbh.row` — bốn row dùng CHUNG một gói

Cây thật có **BỐN cặp row** cùng trỏ gói này (xác nhận trong `.parity/dumps/*/ours.yml`; test đọc dump
mới nhất và khẳng định cả bốn):

| row id | tên gói | `config.id` |
|---|---|---|
| `preset-standard` | `@deepseek-ai/dsh-agent-preset` | `standard` |
| `preset-ptc` | `@deepseek-ai/dsh-agent-preset` | `ptc` |
| `preset-minimal` | `@deepseek-ai/dsh-agent-preset` | `minimal` |
| `preset-cordis` | `@deepseek-ai/dsh-agent-preset` | `cordis` |

**Đo trên trình sinh patch (`apps/cli/src/rewrite-metadata.ts` → `renderRewriteBlock`):**

```yaml
- id: <row.id>            # ĐÚNG MỘT id bị tắt
  disabled: true

- insert:                 # ĐÚNG MỘT row được chèn
    - id: <insertAs ?? row.id + "-ours">
      name: '<specifier>'
      aliases: [...]      # chỉ là id MODULE cho tầng nạp client
```

⇒ **`aliases: [cả bốn id]` KHÔNG tắt được cả bốn row stock.** Ba lý do đo được, theo thứ tự chặn:

1. `gbh.row` là **MỘT khoá dạng object** (`parseGbhMetadata` đọc `gbh.row.id` là **một** string);
   mảng hay nhiều khoá đều bị bỏ qua. Và `check:rows`/`row-ids.ts` canh **một `row.id` chỉ một package**.
2. `renderRewriteBlock` in **đúng một** `- id:` + `disabled: true` và **đúng một** `- insert:`.
   `aliases` được in vào **row ĐƯỢC CHÈN**, không phải danh sách row bị tắt — nó là **id module**
   cho tầng nạp client (copy `rev`, sinh entry alias), **không** phải cơ chế disable row cấu hình.
3. Ngay cả khi tắt được bốn row thì **chỉ có MỘT row được chèn**: `config` của `gbh.row` là **map phẳng**
   `string | number | boolean | { js }` (`readConfig`), nên **không chứa nổi** `plugins: [...]` lồng nhau —
   và bốn preset **khác nhau đúng ở `config.id` + `plugins`**.

⇒ **Cần cơ chế của M4** (ví dụ `gbh.rows: [...]` hoặc một khoá `extra` sinh nhiều cặp disable+insert, kèm
sửa `parseGbhMetadata`/`renderRewriteBlock`/`check:rows`/`row-ids.ts`/`hygiene`). **Gói này KHÔNG tự thêm cơ chế**
và **KHÔNG khai một row** — khai một row sẽ chỉ thay `1/4` preset và để ba row stock chạy với gói của ta.

## 3. Peer — vì sao ba tên này

| peer | vì sao | ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | `Service.init` (khoá generator) + kiểu `Context` | chuẩn, mọi gói host đều khai |
| `@deepseek-ai/schemastery` | `z.object` của `Config` | chuẩn |
| `@deepseek-ai/cordis-plugin-loader` | `EntryGroup.key` (`Symbol.for("cordis.group")`) — **phải là CÙNG một symbol** với tầng nạp; tự viết `Symbol.for` là tạo nguồn sự thật thứ hai | **ngoài bảng §3b**, giữ đúng hợp đồng peer của bản gốc (bản gốc khai đúng tên này) ⇒ **cần Lead xác nhận**, như tiền lệ `user-questions`/`jobs-local` |
| `@deepseek-ai/dsh-agent-preset-registry` | seam `agentPresets` + kiểu `PresetDefinition` (`type Config`) | **ngoài bảng §3b**, bản gốc cũng khai; đây là **nhà cung cấp seam** nên phải là peer (một thể hiện do kernel cấp) |

`gbh.peers` = hai tên **ngoài** cordis/schemastery ⇒ **`gbh.peers ⊆ peerDependencies` đúng 0 tên lệch**,
có **đối chứng âm** (xoá một tên ⇒ báo đúng tên đó; xoá sạch ⇒ báo đủ danh sách; thêm tên lạ ⇒ vẫn đạt).
`mount.ts` tự symlink `cordis` + `schemastery` + `gbh.peers`, nên profile có đủ cả bốn.

## 4. TRƯỚC / SAU

**Chưa có phép đo mount** vì gói này chưa (và chưa thể) khai `gbh.row` — xem §2. Không có số TRƯỚC/SAU để bịa.
Phép đo tương đương ở tầng gói là bảng §1 (mọi dòng đều đo trên **ARTIFACT** hoặc trên chính bundle gốc).

## 5. Phần CHƯA làm

1. **Cơ chế bốn row** — thuộc M4 (xem §2). Không có nó thì `gbh.row` không được khai: `packages/README.md` §4
   và test canh (`tests/host/agent-preset.test.ts`) đều ghi trạng thái này.
2. **`skills/` của bản gốc** (21 file · 136 KB: `agent-experience` · `cordis-plugin-development` ·
   `cordis-composition-reference` …) **chưa chép**. Lý do: cổng `header` đòi header 5 dòng cho **mọi** file
   `.md`/`.js` trong repo và **không có miễn trừ nào cho `skills/`**; nội dung này là tài liệu kỹ năng, không phải
   mã của ta. Đồng thời **config của bốn row hiện trỏ đường dẫn TUYỆT ĐỐI tới package gốc**
   (`require.resolve('@deepseek-ai/dsh-agent-preset/package.json')` + `'skills'`) nên `skills/` của bản gốc
   vẫn là nguồn đang chạy; khi thay row thật thì phải chép `skills/` **byte-for-byte** và đổi đường dẫn trong config.
3. **`lab:row` · mount · `check:app` · A/B pixel** — chờ Lead (và chỉ có nghĩa sau khi có cơ chế ở §2).

## 6. Phép kiểm đã chạy

```bash
bun test tests/host/agent-preset.test.ts     # 14 pass · 0 fail · 78 expect
bun run build.ts <dir>                       # artifact 28 dòng, export đúng ["default"]
grep -c 'id: @deepseek-ai' lib/index.js      # 0
shasum locale/{en,zh}.json                   # khớp byte-for-byte bản gốc (d4695d4f… · df326fbc…)
```
