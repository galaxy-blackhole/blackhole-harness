<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc KHUNG README của @galaxy-blackhole/gbh-agent-instructions — port 1:1 ba vùng config (stock 10–89) ·
      digest (90–115) · render (116–465) của @deepseek-ai/dsh-agent-instructions; ghi nợ, lý do khai
      gbh.nested (row LỒNG trong preset) và các phép đo A/B.
-->

# @galaxy-blackhole/gbh-agent-instructions (KHUNG — 3 vùng config · digest · render)

Khung package cho `@deepseek-ai/dsh-agent-instructions` (0.2.1-alpha.4). **Lượt này** dựng khung gói và port
**ba vùng** của `lib/index.js` (**1.447 dòng**, host-only):

| vùng stock | dòng stock | tệp của ta | dòng ta |
|---|---|---|---:|
| `lib/types/config.js` | **10–89** (80 dòng) | `src/config.ts` | **157** |
| `lib/types/digest.js` | **90–115** (26 dòng) | `src/digest.ts` | **29** |
| `lib/types/render.js` | **116–465** (350 dòng) | `src/render.ts` | **611** |

Vùng **files** (466–871), **state/service** và `apply`/`inject` **KHÔNG phải** phần của lượt này — xem mục 3.

> **KHUNG.** Mục 0–4 là số đo + đối chiếu thật của lượt này. `src/index.ts` ban đầu là `export {}` để build
> khung chạy được; trong lúc đo, **subagent khác đã nối `src/index.ts`** (09:17) cùng `files.ts` · `state.ts` ·
> `service.ts` — xem mục 3. Mục 5 ghi đúng lệnh tái lập.

## 0. Năm câu hỏi

| # | câu hỏi | trả lời ngắn |
|---|---|---|
| 1 | Gói hai mặt? | **KHÔNG — MỘT MẶT**: chỉ `lib/index.js` 1.447 dòng, **không** `lib/client.js`, manifest stock **không** có khoá `dsh.client` |
| 2 | Entry phụ? | **KHÔNG**: một entry duy nhất `lib/index.js`; `package.json` stock chỉ có `main` + `exports` một điểm |
| 3 | Trùng tên service? | Không có service riêng: bề mặt stock là `apply` · `inject` · `Config` · `name` + 2 hàm files + `renderAgentInstructions`. `apply`/`inject`/`name` do subagent khác (`service.ts` · `state.ts`) |
| 4 | Row trong dump? | **CÓ, 4 chỗ**: 1 row top-level `- id: agent-instructions` **đang `disabled: true`** (dòng **252**) + **3 entry LỒNG** trong `preset-standard` · `preset-ptc` · `preset-cordis` (dòng **813 · 977 · 1244**) — chi tiết mục 4 |
| 5 | Vendor inline? | **0 dòng** vendor inline trong 1.447 dòng bundle; 0 phụ thuộc `@galaxy-stack/*` |

## 1. Nguồn đối chiếu theo dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-agent-instructions` (**CHỈ ĐỌC**), đối chiếu:
`lib/index.js` (1.447 dòng) + `lib/types/config.d.ts` (70) + `lib/types/digest.d.ts` (21) + `lib/types/render.d.ts` (151).

| Vùng stock `lib/index.js` | Region | Kiểu stock | Bản của ta | Dòng ta |
|---|---|---|---|---:|
| **10–89** (80 dòng) | `lib/types/config.js` | `lib/types/config.d.ts` | `src/config.ts` | **157** |
| **90–115** (26 dòng) | `lib/types/digest.js` | `lib/types/digest.d.ts` | `src/digest.ts` | **29** |
| **116–465** (350 dòng) | `lib/types/render.js` | `lib/types/render.d.ts` | `src/render.ts` | **611** |

Đối chiếu tới từng ký hiệu (dòng của ta là dòng khai báo trong tệp):

| Ký hiệu trong bản của ta | Dòng stock tương ứng | Ghi chú |
|---|---:|---|
| `config.ts:14–26` — 5 hằng mặc định + `RESERVED_PATH_SEGMENTS` | `lib/index.js` 16–24 | nguyên văn giá trị |
| `config.ts:29` — `Config` (interface) | `config.d.ts` 8–25 | 5 trường, đúng thứ tự |
| `config.ts:49` — `Config` (schema schemastery) | `lib/index.js` 25–31 | `maxBytes.required()` · `maxSourceBytes.step(1).min(1).default(1048576)` |
| `config.ts:58` — `ResolvedDiscoveryConfig` | `config.d.ts` 27–33 | |
| `config.ts:72` — `ResolvedConfig` | `config.d.ts` 35–39 | |
| `config.ts:85` — `workspaceBaselineIdentity` | `lib/index.js` 39–48 | `JSON.stringify` 6 trường |
| `config.ts:102` — `resolveConfig` | `lib/index.js` 55–65 | spread CÓ ĐIỀU KIỆN: trường `undefined` không ghi đè |
| `config.ts:127` — `resolveDiscoveryConfig` | `lib/index.js` 77–85 | gốc lấy từ tiến trình, không từ row |
| `config.ts:153` — `resolveInstructionFileCandidates` (private) | `lib/index.js` 86–88 | bỏ rỗng · `.` · `..` · tên chứa dấu phân cách |
| `digest.ts:16` — `instructionContentSha1` | `lib/index.js` 101–103 | SHA-1 hex chữ thường |
| `digest.ts:27` — `trimmedInstructionDigest` | `lib/index.js` 112–114 | băm nội dung đã trim |
| `render.ts:79–105` — 6 hằng câu chữ | `lib/index.js` 122–127 + 257 | nguyên văn từng byte |
| `render.ts:109` — `byteLength` | `lib/index.js` 128–130 | `Buffer.byteLength(value, "utf8")` |
| `render.ts:118` — `truncateUtf8` (private) | `lib/index.js` 131–137 | cắt theo byte, lùi về đầu điểm mã |
| `render.ts:131` — `escapeInstructionFrameBody` (private) | `lib/index.js` 138–140 | thay thẻ đóng bằng dạng đã escape |
| `render.ts:140` — `sectionText` (private) | `lib/index.js` 141–143 | mục `Instructions from:` |
| `render.ts:145` — `USER_GLOBAL_DIRECTORY` | `lib/index.js` 145 | `"user-global"` |
| `render.ts:153` — `AGENTS_GLOBAL_DIRECTORY` | `lib/index.js` 146–153 | `"agents-global"` |
| `render.ts:161` — `USER_GLOBAL_DIRECTORIES` | `lib/index.js` 154–161 | tuple readonly đúng thứ tự |
| `render.ts:169` — `USER_GLOBAL_FILE` | `lib/index.js` 162–168 | `"AGENTS.md"` |
| `render.ts:176` — `scopeForDisplayPath` | `lib/index.js` 169–178 | so khớp cả dạng `~/.dsh` và `$DSH_HOME` |
| `render.ts:197` — `isUserGlobalDirectory` | `lib/index.js` 179–186 | |
| `render.ts:210` — `instructionCandidateGroup` | `lib/index.js` 187–199 | `agents-global` gộp về `user-global` |
| `render.ts:215` — `RESERVED_SCOPE_DIRECTORIES` (private) | `lib/index.js` 200–201 | `ReadonlySet<string>` để `.has(string)` không vỡ kiểu |
| `render.ts:225` — `escapeProjectDisplayPath` | `lib/index.js` 202–216 | thêm thành phần `.` ở đầu khi thành phần đầu trùng tên phạm vi |
| `render.ts:232` — `SCOPE_SEPARATOR` (private) | `lib/index.js` 217 | ký tự NUL |
| `render.ts:244` — `candidateScopeKey` | `lib/index.js` 218–231 | |
| `render.ts:253` — `instructionScopeKey` | `lib/index.js` 232–239 | |
| `render.ts:262` — `decodeScopeKey` | `lib/index.js` 240–256 | vẫn giữ nhánh `separator < 0` (stock có `v8 ignore`) |
| `render.ts:281` — `additionalSectionText` (private) | `lib/index.js` 257–268 | |
| `render.ts:296` — `BASELINE_RENDER_STYLE` (private) | `lib/index.js` 269–272 | |
| `render.ts:306` — `baselineRenderStyle` (private) | `lib/index.js` 273–279 | 3 câu mở đầu baseline |
| `render.ts:319` — `changedSectionText` (private) | `lib/index.js` 280–291 | set · remove · replace |
| `render.ts:343` — `renderInstructionChanges` | `lib/index.js` 292–316 | `Map` theo `absolutePath`; chỉ trả chuyển trạng thái được đại diện |
| `render.ts:373` — `markerText` (private) | `lib/index.js` 317–323 | |
| `render.ts:402` — `buildInstructionText` (private) | `lib/index.js` 324–334 | lọc khối rỗng, nối bằng hai xuống dòng, bọc system-reminder |
| `render.ts:429` — `withTruncatedContent` (private) | `lib/index.js` 335–340 | |
| `render.ts:442` — `truncateToFit` (private) | `lib/index.js` 341–360 | tìm nhị phân số byte vừa ngân sách |
| `render.ts:480` — `renderInstructionContext` (private) | `lib/index.js` 361–440 | bỏ dần tệp rộng nhất → cắt tệp cụ thể nhất → thông báo thu gọn |
| `render.ts:588` — `renderAgentInstructionSet` | `lib/index.js` 441–455 | `@internal`, trả `{ rendered, included }` |
| `render.ts:606` — `renderAgentInstructions` | `lib/index.js` 456–464 | trả `.rendered` |
| `render.ts:16` — `import type { InstructionFile, LoadedInstructionFile } from "./files.ts"` | `render.d.ts` 6 · `files.d.ts` 9–19 | **KHÔNG chép lại kiểu**: `files.ts` (subagent khác) đã sở hữu, đúng như stock |

Bề mặt export của ba vùng: **7** ký hiệu `config.ts` (3 interface + 1 schema + 3 hàm), **2** hàm `digest.ts`,
**18** ký hiệu `render.ts` (4 interface + 4 hằng + 10 hàm) = **27**. Các hàm private giữ private y như stock
(`resolveInstructionFileCandidates` · `byteLength` · `truncateUtf8` · `escapeInstructionFrameBody` ·
`sectionText` · `additionalSectionText` · `baselineRenderStyle` · `changedSectionText` · `markerText` ·
`buildInstructionText` · `withTruncatedContent` · `truncateToFit` · `renderInstructionContext`).

## 2. TRƯỚC → SAU

| hạng mục | TRƯỚC | SAU |
|---|---|---|
| gói trong repo | **chưa tồn tại** | `packages/host/agent-instructions/`: `build.ts` · `tsconfig.json` · `package.json` · `README.md` · 11 symlink peer |
| vùng config | `lib/index.js` 10–89 | `src/config.ts` **157 dòng** |
| vùng digest | `lib/index.js` 90–115 | `src/digest.ts` **29 dòng** |
| vùng render | `lib/index.js` 116–465 | `src/render.ts` **611 dòng** |
| bề mặt export ba vùng | 27 ký hiệu | **y nguyên 27/27**, 13 hàm private vẫn private |
| kiểu `InstructionFile`/`LoadedInstructionFile` | `files.d.ts` 9–19 | import type từ `./files.ts` (stock `render.d.ts:6`) — **không** nhân bản |
| `src/index.ts` | — | lượt này để `export {}`; **09:17 subagent khác đã nối** bề mặt thật (15 dòng) |
| build | — | `bun run build.ts` **PASS**: 09:14 (index stub) → `lib/index.js` **0 B**; 09:19 (index đã nối) → **1.248 dòng / 48.114 B** |
| peer | — | **11/11 symlink** vào `apps/host/node_modules/@deepseek-ai`; **0 peer thiếu** |
| test | — | **chưa có** — `gbh.tests` đã khai đích `tests/host/agent-instructions.test.ts` |
| `gbh.row` | — | **KHÔNG khai** (mục 4); chỉ khai `gbh.nested` (`kind: 'preset'`) |

**Đo lượt port (19/10/2026, 09:12–09:19):**

- **A/B chạy thật với bundle stock**: trích NGUYÊN VĂN ba vùng 10–89 · 90–115 · 116–465 từ
  `lib/index.js` ra module tạm, import song song với `src/config.ts` · `src/digest.ts` · `src/render.ts`
  rồi so `JSON.stringify` từng kết quả:
  - **lượt 1: 1.000 phép so sánh · 0 khác biệt**; **lượt 2 (sau khi đổi sang import type từ `files.ts`):
    1.136 phép so sánh · 0 khác biệt**.
  - Phủ: 8 chuỗi digest (rỗng · unicode · emoji · NUL · 10.000 ký tự); 5 cấu hình `Config` (parse +
    `resolveConfig`) và 7 biến thể `resolveDiscoveryConfig` (lọc `""` · `"."` · `".."` · `"a/b"` · tên có
    dấu phân cách); `workspaceBaselineIdentity`; 14 đường dẫn hiển thị (gồm `~/.dsh/AGENTS.md` ·
    `$DSH_HOME/AGENTS.md` · `~/.agents/AGENTS.md` · `$DSH_AGENTS_HOME/AGENTS.md` · `user-global/…`);
    5 khoá phạm vi; **5 bộ tệp cố định × 15 ngân sách** (−5 · 0 · 1 · … · 65.536 · `Infinity` · `NaN`) ×
    3 chế độ `replacePreviousBaseline` cho cả `renderAgentInstructions` và `renderAgentInstructionSet`;
    **200 baseline ngẫu nhiên** + **200 lô chuyển trạng thái ngẫu nhiên** (set/replace/remove, nội dung chứa
    thẻ đóng system-reminder · emoji · tệp rỗng).
- **Typecheck**: `tsc` strict đúng cờ `tsconfig.json` trên **cả gói** (kể cả `files.ts` · `state.ts` ·
  `service.ts` của subagent khác) → **0 lỗi**. Cổng `typecheck` toàn repo → **XANH, 2.066 tệp, 0 vi phạm**.
- **Lint**: `header` (2.745 tệp) · `file-length` · `jsdoc` · `dep-guard` → **XANH, 0 vi phạm cho gói này**
  (11 cảnh báo JSDoc của repo đều ở tệp khác).
- **`check:rows`**: 158 gói khai `gbh.row` đều đạt; gói này **không** nằm trong danh sách (đúng chủ ý).

## 3. Nợ

| phần nợ | số dòng stock | trạng thái / hệ quả |
|---|---:|---|
| vùng **files** (`lib/types/files.js`) | **406** (466–871) | `src/files.ts` **650 dòng** — subagent khác; lượt này chỉ **import type** |
| vùng **state** (`lib/types/state.js`) | — | `src/state.ts` **486 dòng** — subagent khác |
| vùng **service** + `apply`/`inject` | — | `src/service.ts` — subagent khác |
| `src/index.ts` | 1.447 (bề mặt cuối) | lượt này để `export {}`; **đã được subagent khác nối** lúc 09:17 (15 dòng, đúng bề mặt `index.d.ts` 14–21) |
| test | — | **chưa có** `tests/host/agent-instructions.test.ts`; `gbh.tests` đã trỏ sẵn |
| `exports` subpath | — | cố ý **chưa khai**; `main: lib/index.js` là đủ cho một entry |
| mount | — | **chưa mount**: chờ test + boot-smoke của Lead; `gbh.nested` đã khai đúng để registry thay module lúc mount |

**Vì sao kiểu không bị nhân bản:** `render.d.ts` của stock import `InstructionFile`/`LoadedInstructionFile`
từ `./files.ts`. Lượt này giữ đúng hướng đó: lúc đầu `files.ts` chưa có nên `render.ts` khai **KIỂU TẠM**;
khi `files.ts` xuất hiện (09:15), `render.ts` đã đổi sang `import type { … } from "./files.ts"` — **0 bản sao kiểu**.

## 4. Vì sao KHÔNG khai `gbh.row` mà khai `gbh.nested` (row LỒNG trong preset)

Gói stock xuất hiện **4 chỗ** trong profile chuẩn (dump `.parity/dumps/2026-10-18T01-31-57`):

| vị trí | `ours.yml` | `stock.yml` | trạng thái |
|---|---:|---:|---|
| row **top-level** `- id: agent-instructions` | **252** (config 254–255, `disabled: true` **256**) | 189 (disabled 193) | **TẮT** |
| entry trong `preset-standard` | **813** (name 814, config 815–816) | 636 | BẬT |
| entry trong `preset-ptc` | **977** | 800 | BẬT |
| entry trong `preset-cordis` | **1244** | 1067 | BẬT |

Cả ba entry preset đều có `config: { maxBytes: 65536 }` và nằm **giữa** các entry anh em
(`persona` → `agent-instructions` → `time-context` → `tool-*` …).

**Vì sao không thay row top-level:** row top-level **đang `disabled: true`** ⇒ thay nó **không** làm gói ta
chạy được trong 3 preset; còn nếu xoá/thay cả cụm preset thì **mất toàn bộ entry anh em** trong preset
(`persona` · `time-context` · `tool-bash` · `tool-fs` · `skill-filesystem` · …) — tức **mất 1 trong 3
preset**, đúng loại hỏng mà ADR 0007/0011 dựng `gbh.nested` để tránh.

**Vì sao `gbh.nested` là đúng:** `kind` mặc định là `preset` (`apps/cli/src/profile.ts:297–300`) và
`apps/cli/src/mount.ts` đọc `gbh.nested` từ `package.json` đã copy vào profile; `agent-preset-registry`
**thay tên module lúc mount**, nên chỉ entry `agent-instructions` đổi sang
`@galaxy-blackhole/gbh-agent-instructions`, các entry anh em và cả 3 preset **giữ nguyên**.
`renderGroupRewriteBlocks` chỉ xử lý `kind === "group"` (`profile.ts:381`) nên gói này **không** sinh patch
nhóm — đúng chủ ý.

`package.json` khai:

```json
"gbh": {
  "peers": [ "…11 peer…" ],
  "tests": [ "tests/host/agent-instructions.test.ts" ],
  "nested": {
    "kind": "preset",
    "pluginId": "agent-instructions",
    "stockId": "@deepseek-ai/dsh-agent-instructions",
    "presets": [ "preset-standard", "preset-ptc", "preset-cordis" ]
  },
  "draft": "ROW LỒNG trong 3 preset … TOP-LEVEL row dòng 252 đang disabled:true … KHÔNG khai gbh.row"
}
```

**KHÔNG có khoá `gbh.row`** trong `package.json` — đúng yêu cầu của lượt này.

## 5. Lệnh

```bash
# build entry service -> lib/index.js (ESM, target node, dependency external)
cd packages/host/agent-instructions && ~/.bun/bin/bun run build.ts

# typecheck RIÊNG gói (đúng cờ tsconfig.json) — chạy từ gốc repo
~/.bun/bin/bun node_modules/typescript/lib/tsc.js --noEmit --strict \
  --target ES2023 --module ESNext --moduleResolution bundler --allowImportingTsExtensions \
  --verbatimModuleSyntax --noUncheckedIndexedAccess --noImplicitOverride --noFallthroughCasesInSwitch \
  --skipLibCheck --jsx react-jsx --types bun packages/host/agent-instructions/src/*.ts \
  packages/host/agent-instructions/build.ts

# cổng lint + typecheck toàn repo (bỏ test của tầng khác)
~/.bun/bin/bun run gate --only header,file-length,jsdoc,dep-guard,typecheck --no-tests

# gói KHÔNG khai gbh.row nên không xuất hiện trong danh sách mount
~/.bun/bin/bun run check:rows

# tái lập A/B: trích nguyên văn stock 10–89 · 90–115 · 116–465 thành module tạm rồi so với src/
#   (sed -n '10,89p' … | grep -v '^//#region' | grep -v '^//#endregion')
```

**Peer (11):** `@deepseek-ai/cordis` (**4.0.5** cài đặt, khai `~4.0.5-alpha.2`) · `@deepseek-ai/dsh-agent`
· `@deepseek-ai/dsh-fs` · `@deepseek-ai/dsh-home-paths` · `@deepseek-ai/dsh-llm` ·
`@deepseek-ai/dsh-session` · `@deepseek-ai/dsh-session-projection` · `@deepseek-ai/dsh-tools` ·
`@deepseek-ai/dsh-util-values` · `@deepseek-ai/dsh-working-directory` (**0.2.1-alpha.4**) ·
`@deepseek-ai/schemastery` (**3.18.5**, khai `~3.18.5-alpha.2`) — **đều tồn tại**, đã symlink vào
`node_modules/@deepseek-ai/` của gói.
