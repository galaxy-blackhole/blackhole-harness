<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-host-tool-jobs — port 1:1 bundle stock @deepseek-ai/dsh-tool-jobs
      (lib/index.js 418 dòng) + metadata row/nested đo từ /tmp/dump-now2.txt: row TOP-LEVEL dòng 261
      disabled: true, ba entry LỒNG dòng 863 · 1027 · 1294; trạng thái CHƯA mount/flip
-->

# @galaxy-blackhole/gbh-host-tool-jobs

Port **1:1** bundle `@deepseek-ai/dsh-tool-jobs` (0.2.1-alpha.4) sang Galaxy Blackhole: plugin cordis tên
`tool-jobs`, ba công cụ hướng model `job_output` · `job_list` · `job_kill` trên sổ `ctx.jobs`, một mục
system prompt `tool:jobs`, và đường phân phối hoàn tất job (followup/inject, trần byte, wake budget).

## 0. Tóm tắt

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: stock chỉ có `lib/index.js` **418 dòng / 15.427 B**, **KHÔNG** `dsh.client`, **KHÔNG** `exports["./client"]`, **KHÔNG** `lib/client.js` |
| 2 | Entry phụ? | **KHÔNG** — 1 entry duy nhất (service + tool) |
| 3 | Trùng tên plugin/service? | Plugin tên **`tool-jobs`** (chẩn đoán Loader); đăng ký **3 tool** qua `ctx.tools` + **1 mục prompt** `tool:jobs`; không tạo service mới |
| 4 | Row trong dump? | **HAI TẦNG**: row **TOP-LEVEL** `tool-jobs` **đang TẮT** (`/tmp/dump-now2.txt` dòng **261–263**) **và** row **LỒNG** trong **3 preset** (dòng **863–864** · **1027–1028** · **1294–1295**) |
| 5 | Trạng thái mount | **CHƯA mount/flip** — chỉ khai `gbh.row_unmounted_ly_do` + `gbh.nested`; **KHÔNG** khai `gbh.row` |
| 6 | Test | **41 ca / 320 expect · 0 fail** (30 ca A/B stock↔ours + 11 ca parity metadata) |
| 7 | Vendor inline? | **0 dòng** vendor; 0 phụ thuộc `@galaxy-stack/*` |

Bề mặt export của gói = **đúng 4 ký hiệu** như stock: `Config` · `apply` · `inject` · `name`.

## 1. Nguồn đối chiếu

Stock = `apps/host/node_modules/@deepseek-ai/dsh-tool-jobs` (**CHỈ ĐỌC**).

| hạng mục | stock | gói ta |
|---|---:|---:|
| `lib/index.js` | **418 dòng · 15.427 B** · SHA-256 `de5707b4…` | **478 dòng · 16.143 B** · SHA-256 `fe7aeb31…` |
| export | 4: `Config` · `apply` · `inject` · `name` | **4/4 y nguyên** |
| `name` / `inject` | `tool-jobs` / `["tools","jobs","systemPrompt"]` | nguyên văn |
| `Config` | `waitTimeoutMs` · `maxWaitTimeoutMs` · `completionDelivery` · `maxConsecutiveWakes` | nguyên văn (schemastery thật) |
| locale | `en.json` `b808d2e6…` · `zh.json` `12ad315d…` | **byte-for-byte** cùng hash |
| nửa client | **không có** | **không có** (đúng §4f: một mặt) |

Nguồn TS của gói (980 dòng, gồm `build.ts` 26): `src/config.ts` 42 · `src/index.ts` 134 ·
`src/messages.ts` 55 · `src/render.ts` 140 · `src/retention.ts` 83 · `src/tools.ts` 262 · `src/types.ts` 238.
Không tệp nào > 1.000 dòng.

## 2. Vị trí dump — đo bằng script bun cắt block theo depth

Nguồn đo: `/tmp/dump-now2.txt` (2.297 dòng). Script đọc từng dòng, cắt block của **mọi** dòng
`- id: tool-jobs` theo thụt lề, rồi `YAML.parse` block đã dedent (không đoán theo thứ tự). Kết quả:

| vị trí | dòng (dump-now2) | indent | depth | row cha | `config` | `inject` | `disabled` |
|---|---:|---:|---:|---|---|---|---|
| **TOP-LEVEL** | **261–263** | 0 | **0** | — | **KHÔNG** | **KHÔNG** | **`true`** |
| LỒNG `preset-standard` | **863–864** | 6 | **3** (config → plugins → entry) | dòng 835, `config.id: standard`, `order: 1` | **KHÔNG** | **KHÔNG** | **KHÔNG khai** |
| LỒNG `preset-ptc` | **1027–1028** | 6 | **3** | dòng 999, `config.id: ptc`, `order: 2` | **KHÔNG** | **KHÔNG** | **KHÔNG khai** |
| LỒNG `preset-cordis` | **1294–1295** | 6 | **3** | dòng 1266, `config.id: cordis`, `order: 4` | **KHÔNG** | **KHÔNG** | **KHÔNG khai** |

```yaml
# TOP-LEVEL — dump-now2 dòng 261–263 (chỉ id + name + disabled)
- id: tool-jobs
  name: '@deepseek-ai/dsh-tool-jobs'
  disabled: true

# LỒNG preset-standard — dòng 863–864 (ptc 1027 · cordis 1294; entry chỉ id + name)
      - id: tool-jobs
        name: '@deepseek-ai/dsh-tool-jobs'
```

**Ba entry lồng GIỐNG HỆT NHAU** — cùng chỉ `id` + `name`, cùng **không** `config`/`inject`/`disabled`;
**không có preset nào khai `disabled` khác** nên không phát sinh ghi chú lệch trạng thái.

Dấu vết nguồn patch (đọc từ stock, không suy diễn):

- Top-level bị tắt bởi `@deepseek-ai/dsh-web-app`: dump-now2 dòng 254 ghi
  `# == @deepseek-ai/dsh-base, patched by @deepseek-ai/dsh-web-app`; bundle patch
  `apps/host/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml` dòng **493–494** = `- id: tool-jobs` + `disabled: true`.
- Ba entry lồng nằm trong `presets/{standard,ptc,cordis}.patch.yml` của cùng gói stock (dòng 33–34 · 33–34 · 36–37).
- Dump **mới nhất trong repo** `.parity/dumps/2026-10-18T01-31-57/oracleA_nopatch.yml` có **cùng cấu trúc**, vị trí
  `177–179` (top-level) · `657–658` · `821–822` · `1088–1089` (ba preset) — dùng làm fixture cho cổng test.

## 3. Metadata đã khai (package.json)

```json
{
  "gbh": {
    "row_unmounted_ly_do": {
      "ly_do": "PARK 19/10/2026: row TOP-LEVEL 'tool-jobs' nằm trong /tmp/dump-now2.txt dòng 261–263 (indent 0, depth 0) = id + name + disabled: true, KHÔNG config, KHÔNG inject; row bị @deepseek-ai/dsh-web-app patch tắt (cordis.patch.yml dòng 493–494). CHƯA mount/flip: chưa có lab:row + boot-smoke; bản ta chỉ redirect row LỒNG ở 3 preset (dump-now2 dòng 863 · 1027 · 1294).",
      "row": {
        "id": "tool-jobs",
        "disabled": true,
        "moduleIds": ["@galaxy-blackhole/gbh-host-tool-jobs"],
        "aliases": ["@deepseek-ai/dsh-tool-jobs"],
        "tests": [
          "tests/host/tool-jobs.test.ts",
          "tests/host/tool-jobs-manifest.test.ts"
        ]
      }
    },
    "nested": {
      "kind": "preset",
      "pluginId": "tool-jobs",
      "stockId": "@deepseek-ai/dsh-tool-jobs",
      "presets": ["preset-standard", "preset-ptc", "preset-cordis"]
    },
    "tests": [
      "tests/host/tool-jobs.test.ts",
      "tests/host/tool-jobs-manifest.test.ts"
    ]
  }
}
```

Vì sao **không** khai `gbh.row`: `gbh.row` là khoá của gói **đã flip/mount**. Gói này giữ trạng thái
**park** theo §4f — row top-level stock đang `disabled: true`, chưa có `lab:row` + `boot-smoke`. Chỉ khai
`row_unmounted_ly_do` (đúng một khoá row, không khai cả hai).

Vì sao row park **không** có `config`/`inject`: dump-now2 dòng 261–263 **không khai** hai khoá đó —
thêm vào là bịa, lệch dump. `disabled: true` là khoá dump **có**, nên giữ đúng `true`.
`moduleIds`/`aliases`/`tests` là metadata của gói (không phải khoá config dump).

`gbh.nested` giữ **đúng 4 khoá** mà cổng parity đọc (`kind` · `pluginId` · `stockId` · `presets`).
`agent-preset-registry/src/nested-mount.ts` dựng bản đồ `stockId -> @galaxy-blackhole/gbh-host-tool-jobs`
rồi **chỉ viết lại `name`** của entry lồng trong từng preset (`rewriteNestedNames`, idempotent, giữ nguyên
`id`/`config`/`disabled` và mọi entry anh em).

## 4. Trạng thái: CHƯA mount/flip

- **Row top-level**: **CHƯA** thay row stock. Stock đang `disabled: true`; mount mà không có
  `insertDisabled` sẽ **bật** một thứ sản phẩm đang tắt ⇒ đổi hành vi. Quyết định flip thuộc **Lead**.
- **Nested**: `gbh.nested` chỉ có tác dụng **khi gói đã được copy vào profile**. Hiện gói chưa mount nên
  không lượt boot nào bị đổi; chưa chạy `lab:row`/`boot-smoke`/`check:app`.
- `check:rows` **không** được dùng làm bằng chứng an toàn cho gói này (§4f: nó chỉ so nửa HOST). Gói **một mặt**
  nên không có rủi ro mất nửa browser — nhưng vẫn giữ park đúng yêu cầu task.
- Không có `gbh.row`, không `insertDisabled`, không sửa patch nào của profile.

## 5. Test

| tệp | ca | expect | kết quả | nội dung |
|---|---:|---:|---|---|
| `tests/host/tool-jobs.test.ts` | **30** | **266** | **30 pass / 0 fail** | A/B: cài **cả hai** bản (ta + stock) lên **cùng** một `Context` cordis thật, cùng fixture giả; so export · `name`/`inject` · `Config` · dây đăng ký · 3 tool · execute · finalizeContent · phân phối hoàn tất |
| `tests/host/tool-jobs-manifest.test.ts` | **11** | **54** | **11 pass / 0 fail** | parity metadata: 4 vị trí dump, row park đúng khoá, nested 4 khoá, gói một mặt |
| **tổng** | **41** | **320** | **0 fail** | không mạng, không audio, không tiến trình thật |

Ca A/B không chỉ `deepEqual` vài giá trị: mỗi nhánh được chạy trên **cả hai** bản rồi so `toEqual` từng bước,
kèm khẳng định giá trị literal (ví dụ `String(Config)`, câu thông báo hoàn tất, `presentCall`, `render`).

## 6. Build · typecheck · lint

| phép đo | lệnh | kết quả |
|---|---|---|
| build | `cd packages/host/tool-jobs && ~/.bun/bin/bun run build.ts` | **PASS** — `lib/index.js` **478 dòng / 16.143 B**, 4 export |
| typecheck | `~/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/tool-jobs/tsconfig.json` | **PASS** — **0 lỗi** (strict · `noUncheckedIndexedAccess` · `verbatimModuleSyntax`) |
| lint scoped | `GBH_LINT_ROOT=<cây chỉ chứa gói + 2 test> bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests` | **PASS** — **0 vi phạm** ở cả 4 cổng (header · file-length · jsdoc · dep-guard) |
| test A/B | `~/.bun/bin/bun test tests/host/tool-jobs.test.ts` | **PASS** — 30 ca / 266 expect / 0 fail |
| test manifest | `~/.bun/bin/bun test tests/host/tool-jobs-manifest.test.ts` | **PASS** — 11 ca / 54 expect / 0 fail |

`tsconfig.json` của gói khai `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `types: ["bun"]`;
`include: ["src/**/*.ts", "build.ts"]`.

## 7. Lệnh chạy

Máy này không có `bun`/`node` trên `PATH` mặc định của shell ⇒ dùng `~/.bun/bin/bun`.

```bash
cd galaxy-blackhole/blackhole-tauri

# build artifact (CHỈ một entrypoint: src/index.ts; chạy trong gói để comment đường dẫn ổn định)
(cd packages/host/tool-jobs && ~/.bun/bin/bun run build.ts)

# typecheck strict theo tsconfig của gói
~/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/tool-jobs/tsconfig.json

# test A/B + parity metadata
~/.bun/bin/bun test tests/host/tool-jobs.test.ts tests/host/tool-jobs-manifest.test.ts

# lint scoped (cây tạm chỉ chứa gói + 2 test)
GBH_LINT_ROOT=/tmp/gbh-lint-tool-jobs \
  ~/.bun/bin/bun run tools/lint/gate.ts --only header,file-length,jsdoc,dep-guard --no-tests
```

## 8. Nợ / giới hạn

| phần nợ | hệ quả |
|---|---|
| `lib/types/*.d.ts` + `exports["./src/*"]` | stock có bề mặt kiểu và subpath `./src/*`; gói ta chỉ có `main` + `.` + locale + package.json. Consumer runtime không cần, nhưng `tsc` của consumer chưa đọc được kiểu — nợ như `time-context` |
| mount + `lab:row` + `boot-smoke` + `check:app` | thuộc **Lead**; gói **CHƯA mount/flip**, không có bằng chứng boot cho row này |
| `row:cost` | chưa đo — chưa mount nên chưa có mẫu |
| artifact không byte-identical | `lib/index.js` 16.143 B vs stock 15.427 B (Bun in lại từ 7 module nguồn); parity là **hành vi/export**, không phải byte |
| build phụ thuộc cwd | Bun.build ghi comment đường dẫn nguồn theo cwd: build trong gói = 16.143 B (`fe7aeb31…`), build từ repo root = 16.287 B (`61b8d473…`). Chỉ khác **comment**, export/hành vi y hệt; README lấy bản canonical `bun run build.ts` trong gói |
