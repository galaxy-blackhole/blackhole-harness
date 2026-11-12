<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README của @galaxy-blackhole/gbh-experimental-api-speech-to-text — port 1:1 host-only của
      @deepseek-ai/dsh-experimental-api-speech-to-text (stock lib/index.js 219 dòng + 2 manifest typert
      generated); GBH-ONLY: KHÔNG khai gbh.row, chỉ khai gbh.row_unmounted_ly_do.row (moduleIds/aliases/tests) để park
-->

# `@galaxy-blackhole/gbh-experimental-api-speech-to-text`

Bản viết lại Galaxy Blackhole của **@deepseek-ai/dsh-experimental-api-speech-to-text 0.2.1-alpha.4** — gói
**host-only, một mặt**: stock chỉ có `lib/index.js` 219 dòng, `lib/types/{index,types}.{js,d.ts}` và hai
manifest typert generated (`lib/typert.host.js` 505 dòng · `lib/typert.remote-client.js` 375 dòng).
Manifest gốc **không** có `dsh.client` lẫn `lib/client.js` ⇒ không có nửa client nào để port.

Gói phơi **Remote service `speechController`** (namespace `speech`) trên Typert Gateway: đọc catalog
provider + giới hạn ghi âm, theo dõi trạng thái sẵn sàng, lưu lựa chọn, chuẩn bị/huỷ tài nguyên và phiên
âm **một** bản ghi WAV qua đúng provider đã chọn — không thêm event Session, không dự phòng.

## 0. Nguồn đối chiếu (CHỈ ĐỌC)

Nguồn duy nhất: `apps/host/node_modules/@deepseek-ai/dsh-experimental-api-speech-to-text/` — không sửa,
không copy nguyên bundle.

| nguồn stock | dòng | nội dung | đích trong gói |
|---|---:|---|---|
| `lib/index.js` | 1–3 | import `z`, `Remote`/`RemoteError`/`TypertRemoteService`, `validateWave` | `src/index.ts` 12–26 |
| `lib/index.js` | 4–42 | helper decorator đã transpile (`__esDecorate`, `__runInitializers`) | không port — Bun sinh helper riêng khi build |
| `lib/index.js` | 43–217 | `class SpeechController extends TypertRemoteService` | `src/index.ts` 38–159 |
| `lib/index.js` | 135 | `static inject = ["speechToText", "typert"]` | `src/index.ts` 49 |
| `lib/index.js` | 136–139 | `static Config` (byte · giây) | `src/index.ts` 52–55 |
| `lib/index.js` | 140–143 | constructor `super(ctx, "speechController", { namespace: "speech" })` | `src/index.ts` 65–68 |
| `lib/index.js` | 148–153 | `catalog` | `src/index.ts` 75–80 |
| `lib/index.js` | 159–164 | `follow` (async generator) | `src/index.ts` 88–95 |
| `lib/index.js` | 170–172 | `configure` | `src/index.ts` 103–105 |
| `lib/index.js` | 178–180 | `prepare` | `src/index.ts` 113–115 |
| `lib/index.js` | 186–188 | `cancelPreparation` | `src/index.ts` 123–125 |
| `lib/index.js` | 195–215 | `transcribe` (kiểm base64/WAV, resolve, gọi provider) | `src/index.ts` 134–158 |
| `lib/index.js` | 219 | `export { SpeechController as default }` | `src/index.ts` 47 |
| `lib/typert.host.js` | 1–505 | manifest generated face HOST | `src/typert-host.ts` 11–515 = 10 dòng header + **505 nguyên văn** |
| `lib/typert.remote-client.js` | 1–375 | manifest generated face REMOTE-CLIENT | `src/typert-remote-client.ts` 9–383 = 8 dòng header + **375 nguyên văn** |
| `lib/types/index.d.ts` | 1–13 | module doc, import kiểu, `export type *`, augmentation `Context.speechController` | `src/index.ts` 12–28 · 161–167 |
| `lib/types/index.d.ts` | 14–20 | `interface Config` | `src/index.ts` 31–36 |
| `lib/types/index.d.ts` | 21–63 | hình dạng class + 6 method công khai | `src/index.ts` 38–159 |
| `lib/types/types.d.ts` | 1–14 | module doc + import + augmentation 2 mã lỗi | `src/types.ts` 11–25 |
| `lib/types/types.d.ts` | 15–21 | `TranscriptionRequest` | `src/types.ts` 27–35 |
| `lib/types/types.d.ts` | 22–25 | `SpeechCatalog extends SpeechSnapshot` | `src/types.ts` 37–43 |
| `lib/types/{index,types}.js` | 142 · 1 | bản dịch JS của hai tệp kiểu (trùng nội dung) | không port — chỉ nạp KIỂU, Bun xoá khi build |
| `package.json` stock | 1–61 | name/version/exports/dependencies/peerDependencies/devDependencies | `package.json` (đổi tên, `private`, 0.1.0) |

Không port `locale/{en,zh}.json`, `README.{md,zh.md}`: gói host-only không đọc locale và không có chuỗi UI.

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (stock) | SAU (gói này) |
|---|---|---|
| entry chính | `lib/index.js` 219 dòng (bundle transpiled) | `src/index.ts` 167 dòng TS (decorator gốc) → `lib/index.js` 169 dòng (Bun · ESM · dependency external) |
| manifest HOST | `lib/typert.host.js` 505 dòng · id gốc × 9 | `src/typert-host.ts` 515 dòng · id ta × 10 (9 body + 1 header) · **id gốc × 0** |
| manifest REMOTE | `lib/typert.remote-client.js` 375 dòng · id gốc × 8 | `src/typert-remote-client.ts` 383 dòng · id ta × 8 · **id gốc × 0** |
| artefact manifest | chính hai tệp trên | `lib/typert.host.js` 573 dòng · `lib/typert.remote-client.js` 373 dòng — Bun **in lại** định dạng; nội dung 1:1 đã đo (§6) |
| `exports` | `.` · `./types` · `./src/*` · `./package.json` · `./locale/*.json` · `./typert` · `./remote` | `.` · `./package.json` · `./src/*` · `./typert` · `./remote` |
| build | pipeline upstream (không có trong gói) | `build.ts` gọi `Bun.build` **riêng từng entry** (index · typert.host · typert.remote-client): gộp nhiều entry trong một lượt làm Bun sinh prelude chia sẻ ⇒ byte lệch (bài học task-130) |
| manifest package | public `0.2.1-alpha.4`, `publishConfig.access: public` | `private: true`, `0.1.0`, bốn peer gốc + `zod` |
| row | row `api-speech-to-text` chỉ có trong bundle patch `dsh-experimental-voice-input-bundle` (dump-now2 dòng 1563–1564, không `config`/`inject`/`disabled`) | **không** `gbh.row`/`gbh.nested`; chỉ `gbh.row_unmounted_ly_do.row` `{ id, moduleIds, aliases, tests }` — chưa mount/flip (§3) |
| hành vi | 6 method Remote (1 stream) | **không đổi** — cùng key/namespace/inject, cùng thứ tự method, cùng câu lỗi, cùng mặc định Config |

## 2. Bề mặt & plugin

**Plugin**: `export default class SpeechController extends TypertRemoteService` — class plugin Cordis,
đăng ký bằng `super(ctx, "speechController", { namespace: "speech" })`. Stock không có `apply`; gói giữ
đúng **một** default export.

**Config** (`static Config`, schemastery): `maxAudioBytes: z.natural().min(46).default(4 * 1024 * 1024)`
và `maxDurationSeconds: z.number().min(1).default(120)`.

**Augmentation**: `declare module "@deepseek-ai/cordis" { interface Context { speechController } }`
(nguồn `lib/types/index.d.ts`) + `export type * from "./types.ts"`.

| endpoint | mode | tham số (codec) | kết quả |
|---|---|---|---|
| `speech/catalog` | direct | — | `SpeechCatalog` (`…gbh-experimental-api-speech-to-text/types#SpeechCatalog`) |
| `speech/follow` | **stream** | `signal` (cancellation) | `SpeechCatalog` |
| `speech/configure` | direct | `patch: SpeechSelectionPatch` (gói speech-to-text) | void — `jsonSchemaError: unsupported void value` |
| `speech/prepare` | direct | `providerId: SpeechProviderId` · `options?: SpeechPreparationOptions` (`acceptsUndefined`) | void |
| `speech/cancelPreparation` | direct | `providerId: SpeechProviderId` | void |
| `speech/transcribe` | direct | `request: TranscriptionRequest` · `signal` (cancellation) | `Transcript` (gói speech-to-text) |

**Hai manifest typert — ownership**: `src/typert-host.ts` (515 dòng = 10 dòng header + **505 nguyên văn**
của stock) → `lib/typert.host.js` (573 dòng, Bun in lại); `src/typert-remote-client.ts` (383 dòng = 8 dòng
header + **375 nguyên văn**) → `lib/typert.remote-client.js` (373 dòng). Cả hai mang id gói **của ta** ở mọi
trường ownership (`package`, `id` của descriptor, typeSymbol của gói này) và **0** lần id gói gốc — đo bằng
`grep -c` (§6). Thân manifest không sửa một byte nào ngoài phép thay id.

**typeSymbol của gói KHÁC giữ nguyên** — `@deepseek-ai/dsh-experimental-speech-to-text/types#SpeechProviderId`,
`#SpeechSelectionPatch`, `#SpeechPreparationOptions`, `#Transcript` — chỉ typeSymbol thuộc gói này đổi sang
`@galaxy-blackhole/gbh-experimental-api-speech-to-text` (xem `src/typert-*.ts`).

| artifact | export lúc chạy |
|---|---|
| `lib/index.js` | `default` = `SpeechController` |
| `lib/typert.host.js` | `TYPERT` (face model host: `package` · `face` · `schemas` · `get invocations` · `model`) |
| `lib/typert.remote-client.js` | `TYPERT_REMOTE` + `default` (cùng một object, như stock) |

## 3. Vì sao KHÔNG có `gbh.row` (row gốc nằm trong bundle patch, đang tắt)

Row gốc **có** — nhưng nằm trong **bundle patch**, không nằm trong profile đang chạy:

- `packages/host/bundle-voice-input-bundle/cordis.patch.yml` dòng 15–16 (bản sao 1:1 của stock
  `@deepseek-ai/dsh-experimental-voice-input-bundle/cordis.patch.yml` dòng 10–11):
  `- id: api-speech-to-text` · `name: '@deepseek-ai/dsh-experimental-api-speech-to-text'`;
- dump-now2 ghi row đó ở **dòng 1563–1564** — **không** `config`, **không** `inject`, **không** `disabled`;
- bundle voice-input **đang tắt** trong preset, nên row không xuất hiện trong dump profile đang dùng:
  `grep -ril speech .parity/dumps/2026-10-18T01-31-57/ | wc -l` → `0`.

⇒ Row gốc **không bị thay** (patch của bundle vẫn trỏ id stock); gói ta **chưa mount, chưa flip**:

- **KHÔNG** khai `gbh.row` — mount bây giờ là bật một capability thử nghiệm mà profile chưa chọn;
- **KHÔNG** khai `gbh.nested` — không có entry lồng nào trong preset;
- **CHỈ** khai `gbh.row_unmounted_ly_do` theo hình
  `{ ly_do, row: { id: "api-speech-to-text", moduleIds, aliases, tests } }`.

`aliases` cho phép bước mount sau thay module stock bằng module của ta **mà không sửa patch của bundle**
(row vẫn ghi id stock); `moduleIds` khai module `@galaxy-blackhole/gbh-experimental-api-speech-to-text`.
Hai manifest typert đã sẵn sàng nên bước mount sau chỉ cần flip `gbh.row`, không phải sinh lại manifest.

## 4. Hành vi giữ nguyên

1. **Chu kỳ service**: `super(ctx, "speechController", { namespace: "speech" })` bind cùng key sang Typert
   Gateway; `static inject = ["speechToText", "typert"]` để cordis chờ đủ hai seam.
2. **Config**: `maxAudioBytes` tối thiểu **46** byte (đúng kích thước header WAV tối thiểu), mặc định
   **4 MiB**; `maxDurationSeconds` tối thiểu **1**, mặc định **120**.
3. **`catalog`**: trả `{ ...snapshot(), ...this.config }` — config đứng SAU nên thắng nếu trùng khoá; đọc
   provider **không** chuẩn bị recognizer.
4. **`follow`**: async generator chuyển tiếp từng `snapshot` của seam, rải config vào mỗi ảnh; gói không
   tự giữ listener/vòng đời — huỷ `signal` là huỷ luồng.
5. **`configure`**: chuyển tiếp promise của seam (chỉ ghi trường người dùng đã đổi).
6. **`prepare`**: chuyển tiếp **đồng bộ**, trả `void` — không chờ tác vụ chuẩn bị của Host.
7. **`cancelPreparation`**: chuyển tiếp promise, trả sau khi tác vụ chuẩn bị ổn định.
8. **`transcribe`** đúng thứ tự: `signal.throwIfAborted()` → cổng độ dài rẻ
   `encoded.length > ceil(maxAudioBytes / 3) * 4` ⇒ `RemoteError("speech/invalid-audio", …, { reason:
   "encoding-or-size" })` → `Buffer.from(base64)` → **kiểm base64 chuẩn** (mã hoá lại phải trùng chuỗi gốc)
   → kiểm số byte đã giải → `validateWave(audio, maxDurationSeconds)` → `resolve({ audio, providerId?,
   language? })` (chỉ thêm trường đã định nghĩa) → `await transcribe(spec, signal)`.
9. **Lỗi transcribe**: trong `catch` gọi lại `signal.throwIfAborted()` TRƯỚC, rồi mới ném
   `RemoteError("speech/transcription-failed", reason, { reason })` với `reason` = message của lỗi gốc.
10. **Không event Session, không Agent, không mạng/audio thật**: gói chỉ uỷ quyền registry + kiểm WAV
    (`validateWave` của peer); artifact không mở socket, không chạm micro, không tải model.
11. **Chỉ nạp KIỂU**: `import type {} from "@deepseek-ai/dsh-experimental-speech-to-text"` (augmentation
    `Context.speechToText`) bị xoá khi build; `lib/index.js` chỉ còn ba import runtime
    (`…/wave`, `dsh-typert-protocol`, `schemastery`).

## 5. Nợ

- **Chưa mount / chưa flip**: gói park bằng `gbh.row_unmounted_ly_do` (`moduleIds`/`aliases` cho bước
  mount sau); `check:rows` không áp dụng cho tới khi có `gbh.row`.
- **Test sát ngưỡng 1000 dòng**: `tests/host/experimental-api-speech-to-text.test.ts` 997 dòng, 22 ca A/B
  xanh (19/10/2026); thêm ca mới phải tách tệp. Test build lại ba entry bằng `buildPackage()` vào mkdtemp
  nên không đụng `lib/` của gói.
- **Định dạng artefact manifest khác stock**: Bun in lại (nháy kép, `var`, bỏ comment "do not edit") ⇒
  `lib/typert.host.js` 573 dòng thay vì 505. Nội dung (package · 6 method · typeSymbol · jsonSchema ·
  model types) đã đo **diff = 0** sau khi chuẩn hoá id. Nếu về sau cần **byte-identical**, đổi bước build
  của hai manifest thành copy nguyên văn thay vì `Bun.build`.
- **Không ship `.d.ts` cho hai manifest**: `exports["./typert"]`/`["./remote"]` là chuỗi trần; kiểu của
  manifest lấy từ `lib/typert.*.d.ts` của stock khi cần. Gói host-only chưa có consumer TypeScript.
- **Locale không port** (`locale/{en,zh}.json`): không có chuỗi UI trong nửa host.
- **Hệ sinh thái chưa nối**: `experimental-client-ui-voice-input` chưa trỏ `./remote` của gói này và
  `dsh-experimental-speech-to-text` bản của ta mới có registry — muốn chạy thật cần một provider đăng ký.
- **`zod` là peer runtime của manifest**: `zod ^4.4.3` (apps/host đang cài 4.4.3), không phải dependency
  của gói.

## 6. Lệnh

```bash
# build cả BA entry (mỗi entry một lượt Bun.build riêng) -> lib/index.js · lib/typert.host.js · lib/typert.remote-client.js
cd galaxy-blackhole/blackhole-tauri/packages/host/experimental-api-speech-to-text
/Users/buitronghieu/.bun/bin/bun run build.ts

# typecheck (từ repo root)
/Users/buitronghieu/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/experimental-api-speech-to-text

# ownership: id gói gốc phải = 0 trong hai manifest (nguồn + artefact)
grep -c '@deepseek-ai/dsh-experimental-api-speech-to-text' src/typert-host.ts src/typert-remote-client.ts \
  lib/typert.host.js lib/typert.remote-client.js            # -> 0 0 0 0

# test A/B (từ repo root) — 22 ca, build tạm ba entry vào mkdtemp, không đụng lib/ của gói
/Users/buitronghieu/.bun/bin/bun test tests/host/experimental-api-speech-to-text.test.ts

# lint scoped (từ repo root)
GBH_LINT_ROOT="$PWD/packages/host/experimental-api-speech-to-text" /Users/buitronghieu/.bun/bin/bun run tools/lint/header.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/experimental-api-speech-to-text" /Users/buitronghieu/.bun/bin/bun run tools/lint/file-length.ts --strict
GBH_LINT_ROOT="$PWD/packages/host/experimental-api-speech-to-text" /Users/buitronghieu/.bun/bin/bun run tools/lint/jsdoc.ts --strict
```

**Kết quả đo (19/10/2026)**: build 3 entry OK · `tsc -p` exit 0 · grep ownership = 0 · so runtime hai
manifest với stock (sau khi chuẩn hoá id) **diff = 0** cho cả `TYPERT` (face host) và `TYPERT_REMOTE`, kèm
`default === TYPERT_REMOTE`; `inject`, danh sách 6 method và `Config` của `lib/index.js` trùng stock.
Đo lại 19/10/2026: `bun test tests/host/experimental-api-speech-to-text.test.ts` **22 pass / 0 fail**;
lint scoped (header · file-length · jsdoc) **6 file · 0 vi phạm**.
A/B hành vi trên Context giả (seam `speechToText` giả — **không** mạng/audio thật): 6 marker Remote,
`catalog`, `follow`, chuỗi gọi `configure`/`prepare`/`cancelPreparation`, `transcribe` với WAV hợp lệ,
`speech/invalid-audio` (quá cỡ), `speech/transcription-failed` (base64 không chuẩn) và `AbortError` — **0 lệch**.

Số dòng hiện tại: `src/index.ts` 167 · `src/types.ts` 43 · `src/typert-host.ts` 515 ·
`src/typert-remote-client.ts` 383 · `build.ts` 85 · `lib/index.js` 169 · `lib/typert.host.js` 573 ·
`lib/typert.remote-client.js` 373.
