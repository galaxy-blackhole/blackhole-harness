<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-persona — port 1:1 row persona SCOPE-ONLY (stock lib/index.js 50 dong,
      host-only); khai gbh.nested vi row NAM LONG trong 4 preset; KHONG khai gbh.row
-->

# @galaxy-blackhole/gbh-persona

Bản viết lại Galaxy Blackhole của **@deepseek-ai/dsh-persona 0.2.1-alpha.4** — row Cordis tên `persona`, plugin
**host-only, một mặt** (stock chỉ có `lib/index.js` 50 dòng, không có `lib/client.js`, manifest gốc không có
`dsh.client`). Row đăng ký HAI section prompt (`deployment:persona-prefix`, `deployment:persona-suffix`) qua
dịch vụ `systemPrompt` và tắt runtime-context khi `includeRuntimeContext = false`.

Row này **scope-only**: `dsh-system-prompt` sở hữu persona toàn cục và đăng ký section đó vô điều kiện, nên row
chỉ đúng khi được mount TRONG một agent preset (nó che persona của deployment cho riêng phiên đó). Mount toàn cục
sẽ đụng chính đăng ký của prompt registry và fail-loud — đúng như tài liệu stock (lib/index.js 4–17).

## 0. Nguồn đối chiếu (CHỈ ĐỌC)

Nguồn duy nhất: `apps/host/node_modules/@deepseek-ai/dsh-persona/` — không sửa, không copy nguyên bundle.

| nguồn stock | dòng | nội dung | đích trong gói |
|---|---:|---|---|
| `lib/index.js` | 1–2 | `import z` + `PERSONA_PREFIX_SECTION` / `PERSONA_SUFFIX_SECTION` | `src/index.ts` 12–14 |
| `lib/index.js` | 4–17 | module doc: row persona là composable, scope-only, mount toàn cục thì đụng registry | header `src/index.ts` 1–10 + §4 dưới đây |
| `lib/index.js` | 18–19 | `name = "persona"` | `src/index.ts` 22–23 |
| `lib/index.js` | 20–21 | `inject = ["systemPrompt"]` | `src/index.ts` 25–26 |
| `lib/index.js` | 22–28 | schema Config: `prefix` required; `suffix` default `""`; `complete` default `false`; `includeRuntimeContext` default `true` | `src/index.ts` 28–55 |
| `lib/index.js` | 29–48 | `apply`: hai `ctx.effect(...)` + `suppressRuntimeContext()` | `src/index.ts` 57–77 |
| `lib/index.js` | 50 | danh sách export (6 tên) | `src/index.ts` 16–26, 49–77; artefact `lib/index.js` |
| `lib/types/index.d.ts` | 15–18 | `import type Context`, `import z`, re-export hai hằng section | `src/index.ts` 12–20 |
| `lib/types/index.d.ts` | 19–22 | `name`, `inject` | `src/index.ts` 22–26 |
| `lib/types/index.d.ts` | 24–40 | interface `Config` (4 trường, 3 tuỳ chọn) | `src/index.ts` 28–47 |
| `lib/types/index.d.ts` | 41–42 | `Config: z<Config>` | `src/index.ts` 49–55 |
| `lib/types/index.d.ts` | 43–49 | chữ ký `apply(ctx, config): void` | `src/index.ts` 57–77 |
| `package.json` stock | 31–42 | peer `dsh-system-prompt` 0.2.1-alpha.4 · `cordis` ~4.0.5-alpha.2; `schemastery` ~3.18.5-alpha.2 | `package.json` peer + dev |

Không port `locale/`, `README.md`, `README.zh.md` của stock: `apply` không đọc locale và row không có chuỗi
người dùng; đây là tài liệu/bản địa hoá của gói phát hành, không phải hành vi runtime.

## 1. Phạm vi & bề mặt export

Artefact `lib/index.js` (34 dòng) xuất **đúng 6 tên** như stock — A/B smoke đã so `Object.keys`:

| export | kiểu | hành vi |
|---|---|---|
| `name` | `"persona"` | tên plugin Cordis |
| `inject` | `string[]` = `["systemPrompt"]` | chờ dịch vụ prompt registry |
| `Config` | `z<Config>` (schema + type cùng tên) | `prefix` bắt buộc; `suffix=""`, `complete=false`, `includeRuntimeContext=true` |
| `apply` | `(ctx: Context, config: Config) => void` | 2 effect đăng ký section + 1 lần suppress có điều kiện |
| `PERSONA_PREFIX_SECTION` | `"deployment:persona-prefix"` | re-export nguyên văn từ `dsh-system-prompt` |
| `PERSONA_SUFFIX_SECTION` | `"deployment:persona-suffix"` | re-export nguyên văn từ `dsh-system-prompt` |

Chi tiết `apply` giữ nguyên từng bước (kể cả các `??` dư thừa của bản gốc):

1. `ctx.effect(() => ctx.systemPrompt.section({ name: PERSONA_PREFIX_SECTION, order: getSectionOrder("DEPLOYMENT_PERSONA_PREFIX"), text: config.prefix, ...(complete ? { complete: true } : {}) }), "persona.section()")`
2. `ctx.effect(() => ctx.systemPrompt.section({ name: PERSONA_SUFFIX_SECTION, order: getSectionOrder("DEPLOYMENT_PERSONA_SUFFIX"), text: config.suffix ?? "" }), "persona.suffix()")`
3. `if (!(config.includeRuntimeContext ?? true)) ctx.systemPrompt.suppressRuntimeContext()`

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/persona/` — `src/index.ts` 77 dòng · `build.ts` 45 dòng · `tsconfig.json` 27 dòng · `package.json` 44 dòng · README này |
| nguồn | chỉ bundle stock `lib/index.js` + `lib/types/index.d.ts` | source TS strict port 1:1, JSDoc đầy đủ; build ra `lib/index.js` 34 dòng |
| bề mặt export | 6 tên | **đúng 6 tên**, cùng giá trị/kiểu (A/B smoke) |
| schema Config | 4 trường, default như trên | **y hệt** — `Config({ prefix: "P" })` cho `{"prefix":"P","suffix":"","complete":false,"includeRuntimeContext":true}`; thiếu `prefix` ném **cùng thông điệp** |
| `apply` | 2 section + suppress | **y hệt** — A/B smoke so trace 3 cấu hình: thứ tự effect, nhãn effect, nội dung section, cờ `complete`, lời gọi suppress |
| client | không có (`dsh.client` vắng) | **không có** — gói một mặt, không nợ nửa client |
| test | không có trong gói stock đã cài | **0 ca** — `tests/host/persona.test.ts` đã khai trong `gbh.tests` nhưng CHƯA viết (nợ §3) |
| row `persona` trong app | stock, LỒNG trong 4 preset | **vẫn stock** — chưa mount; `gbh.nested` chỉ có hiệu lực khi gói được copy vào profile (§4) |
| `gbh.row` | không khai | **không khai** (cố ý — §4) |

## 3. Nợ

1. **Test A/B chưa có.** `gbh.tests` trỏ `tests/host/persona.test.ts`, nhưng tệp này chưa tồn tại. Smoke trong
   lượt port (script tạm `/tmp`, không ghi vào repo) đã chứng minh 6 export · 3 trace `apply` · schema
   default · nhánh thiếu `prefix` khớp stock; vẫn cần test chính thức trong repo trước khi tính `accept-row`.
2. **Chưa mount.** Chưa copy gói vào `profiles/node_modules/@galaxy-blackhole/gbh-persona`, chưa chạy lab /
   boot-smoke / restart host 5439. Việc mount là task riêng, không phải thay đổi hành vi của gói.
3. **Không phát `lib/types`.** Build chỉ sinh `lib/index.js` (đúng yêu cầu `main`); kiểu được kiểm bằng
   `tsc -p` trên `src` + kiểu của stock qua symlink package. Nếu profile cần `d.ts` riêng thì bổ sung sau, không
   ảnh hưởng runtime.
4. **Không port locale/README stock.** `apply` không tham chiếu locale; không có chuỗi UI. Không phải nợ hành vi,
   chỉ là phạm vi tài liệu.

## 4. Vì sao KHÔNG khai `gbh.row` mà khai `gbh.nested`

- Row `persona` **nằm LỒNG trong preset**, không phải row top-level: dump
  `.parity/dumps/2026-10-18T01-31-57/ours.yml` có `- id: persona` tại dòng **809 (preset-standard) · 973
  (preset-ptc) · 1143 (preset-minimal) · 1240 (preset-cordis)** — cả bốn đều nằm trong danh sách
  `config.plugins` của preset tương ứng.
- Config dump: **preset-standard / preset-ptc / preset-cordis** dùng
  `prefix: 'You are a coding agent powered by the {{model}} model.'` + `suffix` / `complete` /
  `includeRuntimeContext` mặc định; **preset-minimal** dùng
  `prefix: 'You are a helpful software engineer assistant.'`, `complete: true`,
  `includeRuntimeContext: false`. Không entry nào đặt `suffix`.
- `gbh.row` dành cho **row top-level**: nó khiến tầng chuẩn bị profile thay entry ở tầng ngoài. Khai `gbh.row`
  cho `persona` sẽ thay cả **preset/entry top-level** thay vì một plugin LỒNG ⇒ mất các entry anh em trong
  `config.plugins` và mất chính preset. Đó là lý do tuyệt đối không khai `gbh.row` ở đây.
- `gbh.nested` đúng tầng: `agent-preset-registry` đọc manifest của gói đã copy vào profile, ánh xạ
  `stockId → @galaxy-blackhole/gbh-persona` cho các preset khai trong `presets`, rồi **chỉ viết lại `name`**
  của entry plugin trong preset trước khi import. `id`, `config`, `disabled` và mọi entry anh em giữ nguyên —
  đúng cơ chế ADR 0007 đang dùng cho các row lồng khác.
- Khai báo: `kind: "preset"` (không phải `group`), `pluginId: "persona"`,
  `stockId: "@deepseek-ai/dsh-persona"`, `presets: [preset-standard, preset-ptc, preset-minimal, preset-cordis]`.
- Với riêng `persona`, mount đúng tầng preset còn là **điều kiện đúng đắn**: row là scope-only, mount toàn cục
  sẽ đụng đăng ký persona của `dsh-system-prompt` và fail-loud. Nested rewrite bảo toàn đúng phạm vi đó.

## 5. Lệnh

```bash
# build (từ package)
cd galaxy-blackhole/blackhole-tauri/packages/host/persona
bun run build.ts                 # -> lib/index.js

# typecheck (từ repo root)
bun node_modules/typescript/lib/tsc.js -p packages/host/persona

# lint scoped: header · file-length · jsdoc (chạy từ repo root)
GBH_LINT_ROOT="$PWD/packages/host/persona" bun run tools/lint/header.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/persona" bun run tools/lint/file-length.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/persona" bun run tools/lint/jsdoc.ts --strict

# test khai trong gbh.tests (sau khi tệp test tồn tại)
bun test tests/host/persona.test.ts

# cổng đầy đủ của repo
bun run gate
```
