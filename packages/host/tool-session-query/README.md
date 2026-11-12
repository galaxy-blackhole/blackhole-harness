<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-tool-session-query — NUA HOST port NGUYEN VAN TUNG BYTE
      (bundle @deepseek-ai/dsh-tool-session-query 1.034 dong); metadata row LONG gbh.nested kind 'group'
      (KHONG gbh.row); CHUA mount/flip
-->

# @galaxy-blackhole/gbh-tool-session-query

Bản viết lại Galaxy Blackhole cho @deepseek-ai/dsh-tool-session-query (0.2.1-alpha.4) — công cụ truy vấn phiên
(plugin tên 'tool-session-query': đăng ký một tool cho agent để tìm/lọc dữ liệu phiên).

## 1. Đo §4f: vị trí row trong /tmp/dump-now2.txt (19/10/2026)

Phép đo bằng **script bun cắt block theo depth** (không đoán): 2.297 dòng · **511 entry** `- id:` ở mọi cấp.
Id gói trong dump là **'optional-tool-session-query'** (không phải 'tool-session-query'); tên package stock là
`@deepseek-ai/dsh-tool-session-query`.

| vị trí | dòng | indent | depth | id / name | disabled | config | inject |
|---|---:|---:|---:|---|---|---|---|
| **TOP-LEVEL stock** | — | 0 | 0 | **KHÔNG CÓ** 'tool-session-query' (và 'session-query') — 0 dòng ở depth 0 | — | — | — |
| **LỒNG trong nhóm** `optional-session-search` | **1494–1495** | 4 | **2** | `optional-tool-session-query` / `@deepseek-ai/dsh-tool-session-query` | không | không | không |
| nhóm CHỨA nó | 1483–1496 | 0 | 0 | `optional-session-search` / `cordis:group` (`group: true`, `isolate.sessionQuery: true`) | **CÓ** (dòng 1496) | MẢNG con: sqlite 1489–1492 + entry 1494–1495 | không |
| **lớp app.patch home** (trong dump 12:55, KHÔNG thuộc gói) | 2296 | 4 | 2 | `optional-tool-session-query` / `@galaxy-blackhole/gbh-tool-session-query` | không | không | không |
| nhóm thay thế trong app.patch home (dump 12:55) | 2285–2297 | 0 | 0 | `optional-session-search-ours` / `cordis:group` (`group: true`, `isolate.sessionQuery: true`) | không | như trên | không |

- Section chứa entry stock: **dòng 1482** `# == @deepseek-ai/dsh-experimental-session-search, patched by …/app.patch.yml`.
- **KHÔNG có entry này trong preset agent nào** (preset-standard · preset-ptc · preset-cordis · preset-minimal: **0 lần**).
- Entry con KHÔNG có `disabled`/`config`/`inject`; `disabled: true` nằm ở **nhóm cha** (dòng 1496), không phải ở entry.
- Anh em trong cùng nhóm `optional-session-query-sqlite` (dòng 1489–1492, stock) **vẫn stock** ở cả hai lớp; gói này không thay nó.
- Trong dump (12:55), lớp app.patch home (section dòng 1567) có nhóm thay thế `optional-session-search-ours` trỏ con
  sang gói ta (dòng 2296). **Đo lại lúc 15:08**: app.patch home đã sinh lại (**123 dòng**) và **KHÔNG còn khối này**
  ⇒ runtime hiện **CHƯA mount**. Lượt này không sửa app.patch/profile và không chạy boot; gói chỉ khai metadata.

## 2. Metadata row — LỒNG trong NHÓM ⇒ `gbh.nested`, KHÔNG `gbh.row`

```json
{
  "nested": {
    "kind": "group",
    "pluginId": "optional-tool-session-query",
    "stockId": "@deepseek-ai/dsh-tool-session-query",
    "presets": ["optional-session-search"]
  }
}
```

- **KHÔNG khai `gbh.row`** và **KHÔNG khai `gbh.row_unmounted_ly_do`**: không có row stock top-level để thay.
- `kind` là **`group`** (KHÔNG phải `preset`): dump dòng 1483–1496 là `cordis:group` (`group: true`,
  `isolate.sessionQuery: true`). Đây đúng nhánh `renderGroupRewriteBlocks` (apps/cli/src/profile.ts) và đúng
  kỳ vọng của `tests/host/nested-mount.test.ts` (cùng `stockId` này, `kind: "group"`). `presets` ghi id **nhóm chứa**
  (`optional-session-search`), cùng quy ước với `tool-terminal` (nhóm `optional-persistent-terminals`).
- Chỉ **MỘT** nhóm chứa entry ⇒ không có khác biệt `disabled` giữa các preset; khác biệt duy nhất là **nhóm cha**
  `disabled: true` ở lớp stock, còn nhóm thay thế trong app.patch home ở dump 12:55 thì BẬT (đo lại 15:08: khối đã
  biến mất ⇒ hiện CHƯA mount) — quyết định của lượt boot, không phải khoá metadata của gói.
- **CHƯA mount/flip** bởi lượt này: không thêm `gbh.row`, không sửa app.patch/profile, không chạy boot.

## 3. Đo 4 bước TRƯỚC khi viết

| phép đo | kết quả | hệ quả |
|---|---|---|
| gói hai mặt? | **KHÔNG** — chỉ có lib/index.js **1.034 dòng**, không có lib/client.js, manifest KHÔNG có dsh.client | một mặt ⇒ nếu mount được thì không nợ nửa client |
| row trong dump | **KHÔNG top-level**; entry LỒNG `optional-tool-session-query` depth 2 trong nhóm `optional-session-search` (dòng 1494–1495) | **KHÔNG khai `gbh.row`**; khai `gbh.nested` kind 'group' |
| trùng tên plugin/service? | không có 'tool-session-query' trong packages của ta | an toàn |
| bề mặt export | { Config, DEFAULT_MAX_SEARCH_RESULTS, DEFAULT_SEARCH_TIMEOUT_MS, apply, inject, name } | artefact giữ đúng 6 tên |
| vendor trong bundle | schemastery/zod chỉ xuất hiện **1 lần** ⇒ **không có khối vendor nhúng** | không cần tách vendor |
| peer kernel | đủ 11 gói (cordis · dsh-agent · dsh-llm · dsh-session · dsh-session-projection · dsh-session-query · dsh-system-prompt · dsh-timeout · dsh-tools · dsh-brand · schemastery) | khai peer + symlink |

## 4. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | packages/host/tool-session-query/ (src 8 lát + build + tools) |
| nguồn | chỉ trong bundle stock | **artefact 1.034 dòng · sha256 b2feaf3164d81080c667d4a391316a3a9549b1bd380a4bf23dedddce5707df11 = sha256 bundle gốc** (build DỪNG nếu lệch 1 byte) |
| bề mặt kiểu | lib/types/* của stock | chép nguyên cây + lib/index.d.ts (export * from types/index.js) |
| metadata | chưa ghi số đo vào manifest | `gbh.nested` kind 'group' + `gbh.draft` chứa vị trí dump §4f |
| test | 0 | 29 ca / 150 expect (xem §6) |
| row `optional-tool-session-query` | stock (LỒNG trong nhóm) | **vẫn stock ở lớp stock**; metadata `gbh.nested` khai báo — **CHƯA mount/flip** |

## 5. De-bundle: 8 lát NGUYÊN VĂN (0 lát gãy, mọi lát ≤ 302 dòng)

| lát | dòng |
|---|---:|
| part-00-head.ts | 18 |
| part-01-input.ts | 302 |
| part-02-service-boundary.ts | 150 |
| part-03-workspace-access.ts | 164 |
| part-04-presentation.ts | 162 |
| part-05-operations.ts | 184 |
| part-06-index.ts | 130 |
| part-07-tail.ts | 13 |

tools/split-stock-bundle.ts cắt theo //#region + TRANSPILE THỬ từng lát; src/assemble.ts ghép lại; build.ts so TỪNG BYTE
với bundle gốc rồi mới ghi (kèm chép lib/types và sinh lib/index.d.ts).

## 6. Test A/B (tests/host/tool-session-query.test.ts)

**29 ca / 150 expect · 29 pass / 0 fail** (19/10/2026). Nguyên tắc: mỗi ca chạy CẢ artefact ta và bundle gốc trên
cùng đầu vào (Context cordis THẬT khi cần) rồi so kết quả/mã lỗi/thông điệp y hệt; ca nào không dựng được dịch vụ
thật thì chọn nhánh 'cùng ném cùng thông điệp' và ghi lý do ngay trong tên ca. Ngoài 27 ca hành vi A/B có sẵn,
thêm **2 ca metadata** canh đúng `gbh.nested` kind 'group' + KHÔNG `gbh.row`/`gbh.row_unmounted_ly_do` (chống flip nhầm).

## 7. Nợ kỹ thuật

1. **Row nằm trong NHÓM** ⇒ metadata là `gbh.nested` kind 'group'; muốn flip phải có **cửa sổ boot của Lead**
   (không phải khai `gbh.row` ở gói này).
2. Gói là **MỘT MẶT** nên khi overlay nhóm xong là đủ (không nợ nửa client).
3. Trạng thái lượt này: **CHƯA mount/flip** — chỉ khai metadata + test + README.

## 8. Ghi chú vận hành

- Symlink peer 11 cái nằm trong node_modules/@deepseek-ai/ (5 cấp ../../../../../apps/host/node_modules/...), đúng
  quy tắc đã rút ra ở gói api-terminal-controller: link trong node_modules/@scope/ = 5 cấp, link trực tiếp trong
  node_modules/ = 4 cấp.
