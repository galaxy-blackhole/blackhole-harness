<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-host-tool-skill — port 1:1 @deepseek-ai/dsh-tool-skill
      (tool `skill` + catalog kỹ năng bền vững trong phiên); đo dump-now2 cho row TOP-LEVEL dòng 290–292
      và row LỒNG trong 3 preset (869 · 1033 · 1427); khai gbh.row_unmounted_ly_do + gbh.nested; CHƯA mount/flip
-->

# @galaxy-blackhole/gbh-host-tool-skill

Port **1:1** gói `@deepseek-ai/dsh-tool-skill` (0.2.1-alpha.4) sang Galaxy Blackhole. Gói đăng ký **một**
tool hướng mô hình tên `skill` (nạp toàn văn một kỹ năng) và **hai** hook waterfall `agent/pre-step`:
một hook chèn kỹ năng theo gesture `/name` của người dùng, một hook công bố/thay thế/gỡ **catalog kỹ năng
bền vững** trong phiên (nguồn message `skill-catalog`, form `catalog`, `update: true` khi thay thế).

Thư mục gói là `packages/host/tool-skill` nhưng **tên package** là
`@galaxy-blackhole/gbh-host-tool-skill` — đúng tên dùng trong `gbh.row_unmounted_ly_do.row.moduleIds`.

## 0. Tóm tắt

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: stock chỉ có `lib/index.js` (1.124 dòng) + `lib/types/index.d.ts`; manifest gốc **KHÔNG** có `dsh.client`, không có `lib/client.js` |
| 2 | Entry? | **MỘT** entry build duy nhất: `src/index.ts` (cộng `src/config.ts` là module nội bộ) |
| 3 | Bề mặt export | **4 = 4** với stock: `Config` · `apply` · `inject` · `name` (artifact `lib/index.js` 444 dòng) |
| 4 | Row trong dump | **HAI TẦNG**: TOP-LEVEL dòng **290–292** (`disabled: true`) + LỒNG ở **3 preset** dòng **869** · **1033** · **1427** (chỉ `id` + `name`) |
| 5 | Trạng thái mount | **CHƯA mount/flip** — không khai `gbh.row`, không sửa `app.patch.yml`, không boot lại app |

## 1. Nguồn đối chiếu (G4)

| hạng mục | nguồn / số đo |
|---|---|
| Bản gốc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-tool-skill` — `lib/index.js` **1.124 dòng**, `lib/types/index.d.ts` |
| Manifest gốc | `type: module`, `main: lib/index.js`, `types: lib/types/index.d.ts`; `peerDependencies` 6 gói; **không** `dsh.client` |
| Từ điển | `locale/en.json` sha256 `d6eb799a8583f97922eff41c5edfed56ec3dba3edc876f5855fd4c1759fcec42` · `locale/zh.json` sha256 `c832975b48f42f9f409d688d81956ad09495630b42fa27a8b2af495e26d34e20` — **byte-for-byte** với stock |
| Bản của ta | `src/index.ts` **781 dòng** · `src/config.ts` **39 dòng** · `build.ts` **26 dòng** · artifact `lib/index.js` **444 dòng** |
| Cách dẫn xuất | **viết lại theo hành vi**: giữ nguyên văn chuỗi tiếng Anh, thứ tự kiểm, nhánh lỗi, hằng số; `Config` là `z.object` THẬT của schemastery; seam dịch vụ khai theo **CẤU TRÚC** (ADR 000d), không augment module |
| Peer khai trong manifest | 11 `peerDependencies` (kernel cấp) · `dependencies`: `@deepseek-ai/schemastery ~3.18.5` |

## 2. Vị trí row trong dump — ĐO bằng script bun, cắt block theo depth

Nguồn: **`/tmp/dump-now2.txt`** (dump MỚI NHẤT, **2.297 dòng**). Script đọc từng dòng `- id: <id>`, tính
`indent`/`depth` và **cắt block đến dòng `- id:` kế tiếp có thụt lề ≤` — không suy đoán từ ảnh chụp.

| vị trí | dòng | indent | depth | parent (dòng) | khoá CÓ trong block | khoá KHÔNG có |
|---|---:|---:|---:|---|---|---|
| **TOP-LEVEL** | **290–292** | 0 | 0 | — | `id: tool-skill` · `name: '@deepseek-ai/dsh-tool-skill'` · `disabled: true` (**literal**, KHÔNG phải `!!js`) | `config` · `inject` |
| **LỒNG** preset-standard | **869–870** | 6 | 1 | `preset-standard` (835) | `id` · `name` | `config` · `inject` · `disabled` |
| **LỒNG** preset-ptc | **1033–1034** | 6 | 1 | `preset-ptc` (999) | `id` · `name` | `config` · `inject` · `disabled` |
| **LỒNG** preset-cordis | **1427–1428** | 6 | 1 | `preset-cordis` (1266) | `id` · `name` | `config` · `inject` · `disabled` |
| preset-minimal | 1.169 (bắt đầu preset) | — | — | — | **KHÔNG có entry `tool-skill`** | — |

Số đo thô: toàn dump có **511** dòng `- id:`; `tool-skill` xuất hiện **đúng 4 entry** (8 dòng vì mỗi entry
2 dòng); `grep -c '@deepseek-ai/dsh-tool-skill'` = **4** (291 · 870 · 1034 · 1428 — tức không có entry nào
dùng `name` khác). Hai id **hàng xóm KHÁC GÓI**, không tính vào gói này: `- id: skill` dòng **283**
(`@deepseek-ai/dsh-skill`) và `- id: skill-filesystem` dòng **287** · 867 · 1031 · 1420
(`@deepseek-ai/dsh-skill-filesystem`).

**Ba preset LỒNG GIỐNG NHAU**: cả ba đều là entry trần (`id` + `name`), **không preset nào khai `disabled`**
⇒ không có khác biệt disabled giữa các preset; `preset-minimal` không có entry. Vì vậy `gbh.nested.presets`
chỉ gồm `preset-standard` · `preset-ptc` · `preset-cordis`.

Cổng manifest đo **dump oracle mới nhất trong repo** (`.parity/dumps/2026-10-18T01-31-57/oracleA_nopatch.yml`:
top-level **204**, lồng **663** · **827** · **1221**) và chỉ khẳng định **CẤU TRÚC** (đúng 4 vị trí, cùng
indent/parent/khoá). Bảng dòng ở trên là của **dump-now2** — hai dump khác số dòng nhưng cùng cấu trúc.

## 3. Metadata đã khai (package.json) — CHƯA flip

```json
{
  "gbh": {
    "nested": {
      "kind": "preset",
      "pluginId": "tool-skill",
      "stockId": "@deepseek-ai/dsh-tool-skill",
      "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
    },
    "row_unmounted_ly_do": {
      "ly_do": "PARK 19/10/2026: row TOP-LEVEL 'tool-skill' nằm trong /tmp/dump-now2.txt dòng 290–292 (indent 0, depth 0) = id + name + disabled: true LITERAL, KHÔNG config, KHÔNG inject; row bị @deepseek-ai/dsh-web-app patch tắt. CHƯA mount/flip: chưa có lab:row + boot-smoke + check:app; bản ta chỉ redirect row LỒNG ở 3 preset (dump-now2 dòng 869 · 1033 · 1427). Khi flip phải kèm insertDisabled: true nếu không sẽ BẬT thêm một bản top-level trùng (xem README gói §6).",
      "row": {
        "id": "tool-skill",
        "disabled": true,
        "moduleIds": ["@galaxy-blackhole/gbh-host-tool-skill"],
        "aliases": ["@deepseek-ai/dsh-tool-skill"],
        "tests": ["tests/host/tool-skill.test.ts", "tests/host/tool-skill-manifest.test.ts"]
      }
    },
    "tests": ["tests/host/tool-skill.test.ts", "tests/host/tool-skill-manifest.test.ts"]
  }
}
```

Vì sao khai đúng các khoá đó:

- `row` chỉ mang khoá **dump CÓ**: `id` + `disabled`. Dump ghi `disabled: true` **literal** (không phải biểu
  thức `!!js`) ⇒ `row.disabled = true`; **không** bịa `config`/`inject` vì stock không khai.
- `moduleIds` = **đúng tên package của ta** (`@galaxy-blackhole/gbh-host-tool-skill`); `aliases` = **id stock**
  (`@deepseek-ai/dsh-tool-skill`) để tầng nạp sinh entry alias khi flip; `tests` trỏ tệp A/B hiện có.
- `gbh.nested` giữ **đúng 4 khoá** mà cổng parity đọc (`kind` · `pluginId` · `stockId` · `presets`) cho **3** entry lồng: `agent-preset-registry/src/nested-mount.ts` đọc
  `gbh.nested.stockId` từ gói đã copy vào profile rồi **chỉ viết lại `name`** của entry trong từng preset
  (`rewriteNestedNames`, idempotent, giữ `id`/`config`/`disabled` và mọi entry anh em).
- Không khai `gbh.row` ⇒ `check:rows` không coi gói là đã mount; cổng parity `tests/host/row-config-parity.test.ts`
  cũng khẳng định `gbh.row` vắng mặt và `gbh.nested` khớp dump.

## 4. Test A/B (26 ca · 275 expect) + cổng parity metadata (11 ca · 54 expect) — 0 fail

`tests/host/tool-skill.test.ts` (682 dòng) + harness `tests/host/tool-skill-harness.ts` (382 dòng, tách để
mỗi tệp ≤ 1.000 dòng). `beforeAll` **build artifact thật** rồi nạp **cả hai bản cài** (ta + chính bundle gốc)
trên **cùng một fixture giả**; URL trong fixture chỉ là **dữ liệu chuỗi** — test **không gọi mạng**, không
audio, không dịch vụ ngoài.

| nhóm | phép đo chính |
|---|---|
| A. Bề mặt + `name`/`inject` | tập export trên artifact **4 = 4** · `name = "tool-skill"` · `inject` 4 service nguyên văn · thiếu service ⇒ ném CÙNG chỗ |
| B. `Config` | `String(Config)` trùng từng ký tự · cùng `instanceof` lớp Schema của schemastery · default 500 · nhánh lỗi Standard Schema + `< 3`/`không nguyên` **cùng thông điệp** |
| C. Định nghĩa tool | đăng ký ĐÚNG 1 tool · schema tham số/kết quả · `render` 4 hình dạng `resourceBase` · `presentCall` (kể cả soft-validate) |
| D. `execute` | happy path (kết quả + lookup `cwd/signal/scope`, `resourceBase` là bản sao) · không agent ⇒ `cwd undefined` · mọi nhánh lỗi cùng lớp + thông điệp · validate tham số của `defineTool` |
| E. Hook gesture `/name` | đúng 2 hook theo thứ tự · khử trùng, bỏ nguồn không phải `user`, bỏ khối không phải chữ, token không hợp lệ · reject đi xuyên · signal đã huỷ ⇒ ném trước `ensure` |
| F. Hook catalog | công bố lần đầu (chỉ model-invocable) · digest trùng ⇒ giữ nguyên · digest khác ⇒ thay message · gỡ message khi đã nhìn thấy · chưa công bố + 0 kỹ năng ⇒ không catalog · gộp khoảng trắng + cắt theo `catalogDescriptionMaxLength` |

Cổng parity metadata của gói: `tests/host/tool-skill-manifest.test.ts` — **11 ca / 54 expect / 0 fail**:
A1–A4 khẳng định `gbh.nested` **đúng 4 khoá**, `gbh.row` vắng mặt, `ly_do` nêu đúng dump-now2 dòng 290 +
`CHƯA mount/flip`, row park đúng khoá `id/disabled/moduleIds/aliases/tests` (không `config`/`inject`), tên gói
+ `gbh.tests` trỏ cả hai tệp; B1–B5 đo **dump oracle mới nhất**: đúng **4** vị trí `- id: tool-skill`
(1 × indent 0 + 3 × indent 6) · top-level chỉ `id + name + disabled: true` · 3 entry lồng chỉ `id + name` và
nằm trong `preset-standard`/`preset-ptc`/`preset-cordis` (config.id `standard`/`ptc`/`cordis`) · manifest mirror
đúng số đo; C1–C2 khẳng định **MỘT MẶT** ở cả stock lẫn gói ta.

Cổng parity dùng chung `tests/host/row-config-parity.test.ts` (khối `NESTED`): lọc `tool-skill` ⇒ **2 pass / 7 expect**
— khẳng định `gbh.row` vắng mặt, `gbh.nested.kind = "preset"` · `pluginId = "tool-skill"` ·
`stockId = "@deepseek-ai/dsh-tool-skill"`, và entry lồng trong dump oracle khớp `id` + `name`
(`gbh.nested.config` rỗng = config stock rỗng).

## 5. Lệnh + phép đo (19/10/2026)

```bash
cd galaxy-blackhole/blackhole-tauri

# build entry duy nhất (build.ts → Bun.build, ESM, target node, packages external)
# chạy TRONG gói để comment đường dẫn nguồn ổn định ("// src/index.ts", KHÔNG phải "// packages/host/...")
(cd packages/host/tool-skill && ~/.bun/bin/bun run build.ts)

# typecheck strict theo tsconfig của gói (src/**/*.ts + build.ts)
~/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/tool-skill

# lint scoped: cây tạm chỉ chứa gói + 3 test
# (dựng /tmp/gbh-lint-tool-skill bằng cp: package.json · build.ts · README.md · tsconfig.json · src/*.ts ·
#  locale/*.json · tests/host/tool-skill{,-harness,-manifest}.test.ts)
GBH_LINT_ROOT=/tmp/gbh-lint-tool-skill \
  ~/.bun/bin/bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests

# test A/B + cổng parity metadata + cổng parity row lồng
~/.bun/bin/bun test tests/host/tool-skill.test.ts
~/.bun/bin/bun test tests/host/tool-skill-manifest.test.ts
~/.bun/bin/bun test tests/host/row-config-parity.test.ts -t 'tool-skill'
```

| phép đo | kết quả |
|---|---|
| build | **PASS** — `lib/index.js` **444 dòng**, 4 export `Config · apply · inject · name`, sha256 `353ec09662d7…` |
| `tsc -p packages/host/tool-skill` | **PASS** — **0 lỗi** (strict · `noUncheckedIndexedAccess` · `verbatimModuleSyntax`) |
| lint scoped (header · file-length · jsdoc · dep-guard) | **XANH 4/4** — **0 vi phạm** (8 cảnh báo jsdoc MỀM ở harness có từ trước — không phải vi phạm) |
| `bun test tests/host/tool-skill.test.ts` | **PASS** — **26 test / 275 expect / 0 fail** |
| `bun test tests/host/tool-skill-manifest.test.ts` | **PASS** — **11 test / 54 expect / 0 fail** |
| `row-config-parity -t tool-skill` | **PASS** — **2 test / 7 expect / 0 fail** |

## 6. CHƯA mount/flip

- **KHÔNG** khai `gbh.row`; row top-level nằm trong `gbh.row_unmounted_ly_do` (trạng thái PARK).
- **KHÔNG** sửa `app.patch.yml`, **KHÔNG** mount row TOP-LEVEL, **KHÔNG** boot lại app 5439 — gói chưa được
  nghiệm thu bằng `lab:row` + `boot-smoke` + `check:app`. (Bản copy trong `profiles/node_modules` — nếu có —
  là cơ chế `gbh.nested` có từ trước: `mount.ts/rewritePackages` build + copy mọi gói khai `gbh.nested`; KHÔNG
  phải flip row và KHÔNG sinh dòng nào trong `app.patch.yml`.)
- Khi Lead flip (chuyển `row_unmounted_ly_do.row` → `gbh.row`): row stock top-level đang `disabled: true`,
  còn `renderRewriteBlock` chỉ tắt **row stock** và chèn row của ta **đang BẬT**. Vì cùng id còn sống trong
  3 preset, phải khai thêm `insertDisabled: true` (tiền lệ `tool-goal` · `session-title-first-prompt-llm`)
  nếu không sẽ **bật thêm một bản top-level trùng** ⇒ đổi hành vi sản phẩm. Preset chỉ được thay `name`
  qua `gbh.nested` (không thêm/bớt entry).
