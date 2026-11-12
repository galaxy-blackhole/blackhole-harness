<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README cua @galaxy-blackhole/gbh-experimental-speech-to-text — port 1:1 host-only
      cua @deepseek-ai/dsh-experimental-speech-to-text (stock lib/index.js 201 dong + lib/types/*.d.ts);
      row speech-to-text theo /tmp/dump-now2.txt dong 1555-1557, dang PARK (chua mount/flip)
-->

# @galaxy-blackhole/gbh-experimental-speech-to-text

Bản viết lại Galaxy Blackhole của **@deepseek-ai/dsh-experimental-speech-to-text 0.2.1-alpha.4** — gói
**host-only, một mặt**: stock chỉ có `lib/index.js` 201 dòng, `lib/types/index.js` 182 dòng (bản dịch
trùng nội dung), `lib/types/{types,wave}.js` và `lib/types/*.d.ts`. Manifest gốc **không** có
`dsh.client` lẫn `lib/client.js`.

Gói cấp **một registry provider phiên âm** dưới tên service `speechToText`: provider tự đăng ký kèm
vòng đời riêng, người gọi đọc danh sách + trạng thái chuẩn bị + lựa chọn mặc định, rồi **ghim đúng
một** provider cho mỗi lượt phiên âm — không có dự phòng nào gửi audio đi nơi khác.

## 0. Đối chiếu dòng (nguồn CHỈ ĐỌC)

Nguồn duy nhất: `apps/host/node_modules/@deepseek-ai/dsh-experimental-speech-to-text/` — không sửa,
không copy nguyên bundle.

| nguồn stock | dòng | nội dung | đích trong gói |
|---|---:|---|---|
| `lib/index.js` | 1–2 | import `Service`, `z` | `src/index.ts` 23 · 29 |
| `lib/index.js` | 4–5 | module doc 2 dòng | `src/index.ts` 11–21 |
| `lib/index.js` | 6–16 | `class SpeechToText` + `config` + `static Config` + 4 field | `src/index.ts` 69–93 (schema 78) |
| `lib/index.js` | 17–29 | constructor: `super(ctx,"speechToText")`, `entryId`, nghe `loader/volatile-update`, `ctx.effect` dọn dẹp | `src/index.ts` 101–113 |
| `lib/index.js` | 30–51 | `register` (id trùng hỏng, huỷ idempotent) | `src/index.ts` 123 |
| `lib/index.js` | 52–59 | `remove` (chặn đăng ký đã bị thay, abort, `allSettled`) | `src/index.ts` 150 |
| `lib/index.js` | 60–66 | `listProviders` | `src/index.ts` 166 |
| `lib/index.js` | 67–69 | `changed` | `src/index.ts` 174 |
| `lib/index.js` | 70–99 | `follow` (gộp tiến độ, dọn listener trong `finally`) | `src/index.ts` 186 |
| `lib/index.js` | 100–115 | `snapshot` (provider view + selection) | `src/index.ts` 219 |
| `lib/index.js` | 116–131 | `configure` (settings + entry id, chỉ ghi trường đã đổi) | `src/index.ts` 242 |
| `lib/index.js` | 132–137 | `selectedProvider` (kiểm provider + ngôn ngữ) | `src/index.ts` 263 |
| `lib/index.js` | 138–147 | `prepare` | `src/index.ts` 281 |
| `lib/index.js` | 148–157 | `cancelPreparation` | `src/index.ts` 295 |
| `lib/index.js` | 158–171 | `resolve` (mặc định composition → ghim provider) | `src/index.ts` 310 |
| `lib/index.js` | 172–198 | `transcribe` (ghim đúng đăng ký, signal gộp, chờ `allSettled`) | `src/index.ts` 330 |
| `lib/index.js` | 199–201 | đóng class + `export { SpeechToText as default }` | `src/index.ts` 356 |
| `lib/types/index.js` | 1–182 | bản dịch TRÙNG nội dung của `lib/index.js` (khác định dạng) | không port: một entry = một artifact, xem §1 |
| `lib/types/index.d.ts` | 1–11 | module doc, import kiểu, `export type *`, augmentation `Context.speechToText` (gói này KHÔNG khai lại — §2) | `src/index.ts` 11–54 |
| `lib/types/index.d.ts` | 12–18 | `interface Config` (hai `Volatile<string>`) | `src/index.ts` 49–54 |
| `lib/types/index.d.ts` | 20–91 | hình dạng class + 9 method công khai | `src/index.ts` 69–356 |
| `lib/types/types.d.ts` | 1–4 | module doc + `Branded` + `SpeechProviderId` | `src/types.ts` 11–22 |
| `lib/types/types.d.ts` | 5–22 | `SpeechSetupEstimate` + `SpeechProviderInfo` | `src/types.ts` 28–49 |
| `lib/types/types.d.ts` | 23–38 | `SpeechPreparationStepKind` + `SpeechPreparationStep` + `SpeechDownloadFailure` | `src/types.ts` 51–82 |
| `lib/types/types.d.ts` | 39–61 | `SpeechPreparationState` + `SpeechProviderView` | `src/types.ts` 84–107 |
| `lib/types/types.d.ts` | 62–76 | `SpeechSelection` + `SpeechSelectionPatch` + `SpeechSnapshot` | `src/types.ts` 109–125 |
| `lib/types/types.d.ts` | 77–95 | `SpeechPreparationOptions` + `SpeechPreparation` | `src/types.ts` 127–146 |
| `lib/types/types.d.ts` | 96–118 | `SpeechInput` + `Transcript` + `SpeechProvider` | `src/types.ts` 148–172 |
| `lib/types/types.d.ts` | 119–128 | `SpeechRequest` + `SpeechSpec` | `src/types.ts` 174–183 |
| `lib/types/wave.{d.ts,js}` | 1–8 · 8–23 | `validateWave` + nguyên văn điều kiện WAV | `src/wave.ts` 10–43 (khai báo 19) |
| `package.json` stock | 40–60 | 2 dependency + 3 peer (`peerDependenciesMeta`: loader optional) + dev | `package.json` peer/dev |

Không port `locale/` và `README*.md` của stock — lý do ở §4.

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (stock) | SAU (gói này) |
|---|---|---|
| entry chính | `lib/index.js` 201 dòng + bản trùng `lib/types/index.js` 182 dòng | `lib/index.js` 171 dòng — **một** artifact cho **một** entry `src/index.ts` |
| `./types` | `lib/types/types.js` (`export {}`) + `types.d.ts` | `lib/types.js` 0 byte (chỉ kiểu) + `src/types.ts` |
| `./wave` | `lib/types/wave.js` 24 dòng | `lib/wave.js` 14 dòng (cùng hàm, cùng câu lỗi) |
| build | một pipeline upstream gộp region | `build.ts` gọi `Bun.build` **riêng cho từng entry** (index · types · wave): gộp nhiều entry trong một lượt làm Bun sinh prelude chia sẻ ⇒ byte lệch (bài học task-130) |
| hành vi | registry `speechToText` | **không đổi** — cùng tên service, cùng class, cùng thứ tự member, cùng câu lỗi, cùng ngữ nghĩa huỷ |
| test | — | `tests/host/experimental-speech-to-text.test.ts` · **14 ca / 127 expect** · 0 fail |

Khác biệt DUY NHẤT là đóng gói: stock ship hai bản dịch trùng của cùng module (một bản bị bọc
`//#region`), gói này ship một bản. Vì `exports["."]` của stock trỏ `lib/index.js`, hành vi quan sát
được từ ngoài giống hệt.

### Hành vi giữ nguyên (11 điểm)

1. **Chu kỳ service**: `super(ctx, "speechToText")`; `entryId = ctx.fiber.entry?.options.id` (vắng khi
   mount không qua Loader); nghe `loader/volatile-update` để phát `changed()`; `ctx.effect` huỷ
   `lifetime` với `Error("Speech service disposed")`, rút mọi provider rồi xoá listener.
2. **`register`**: `lifetime.signal.throwIfAborted()` trước tiên; id trùng **không** thay bản gốc mà
   ném lỗi; đăng ký mới có `AbortController` riêng, `pending` riêng, và `unsubscribe` do
   `preparation.subscribe` cấp (không có preparation ⇒ no-op).
3. **`remove`**: chỉ rút khi đăng ký trong map **đúng là** đăng ký đó (đăng ký đã bị thay thì bỏ qua);
   huỷ nghe trước, phát `changed()`, abort với `Error("Speech provider unloaded")`, rồi
   `Promise.allSettled(pending)`.
4. **`follow`**: `AbortSignal.any([caller, lifetime.signal])`, `throwIfAborted()` ngay; vòng lặp
   `while (!aborted())` — không đổi thì chờ `wake.promise`, rồi dựng `wake` mới, đặt `changed = false`,
   và `yield snapshot()`; listener + `abort` một lần được gỡ trong `finally`.
5. **`snapshot`**: mỗi provider view là `{ ...info, preparation: preparation?.snapshot() ?? { phase: "ready" } }`;
   selection đọc hai tham chiếu Config **sống** ngay lúc gọi.
6. **`configure`**: thiếu settings **hoặc** thiếu entry id ⇒
   `Speech selection requires the settings service and a profile entry`; gọi `selectedProvider` TRƯỚC
   khi ghi; chỉ đưa vào patch đúng trường khác `undefined` (`defaultProvider` / `language`).
7. **`resolve`**: `providerId ?? config.defaultProvider.get()` và `language ?? config.language.get()`;
   provider thiếu ⇒ `Speech provider is unavailable: <id>`; ngôn ngữ ngoài `info.languages` ⇒
   `Speech provider <id> does not support language: <language>`.
8. **`transcribe`**: `signal.throwIfAborted()`; đăng ký hiện tại phải **đúng thể hiện** provider đã
   ghim (nếu không ⇒ `Resolved speech provider is no longer registered`); `pending` được thêm **trước**
   `await` và gỡ trong `finally`; sau khi provider trả, `combined.throwIfAborted()` kiểm lại lần nữa.
9. **Huỷ dây chuyền**: khi service xuống, mọi `register` mới hỏng ngay, mọi `transcribe` đang chạy
   nhận abort qua signal gộp, và `follow` kết thúc vòng lặp.
10. **`validateWave`**: nguyên văn — tối thiểu 46 byte; `RIFF`/`WAVE`/`fmt `/`data`; `fmt` = 16,
    PCM = 1, mono = 1, 16000 Hz, 32000 byte/s, block align 2, 16 bit; hai độ dài trong header phải khớp
    độ dài thật; dữ liệu chẵn byte; vượt `maxDurationSeconds` ⇒ `Audio exceeds <n> seconds`; trả
    `(length - 44) / 32000`.
11. **Không mạng, không audio thật**: gói này chỉ là registry + kiểm WAV; nó không mở socket, không
    chạm micro, không tải model.

## 2. Bề mặt

**Plugin**: `export default class SpeechToText extends Service` — dạng **class plugin** của Cordis.
Stock không có `apply`, không có object plugin, nên gói giữ đúng một default export; tên plugin =
tên service = `speechToText` (đăng ký bằng `super(ctx, "speechToText")`).

**Config** (`static Config`, schemastery): `defaultProvider: z.string().min(1).required().volatile()`
và `language: z.string().min(1).default("auto").volatile()` — hai **tham chiếu sống**, đọc lại mỗi lượt
`snapshot()`/`resolve()`/`configure()`. `String(Config)` = `{ defaultProvider: string, language?: string }`
(trùng từng ký tự với stock).

**Augmentation**: stock d.ts khai `declare module "@deepseek-ai/cordis" { interface Context { speechToText: SpeechToText } }`. Gói này **không khai lại**: `packages/host/experimental-api-speech-to-text/src/index.ts` đã `import type {}` từ d.ts stock, nên khai cùng thuộc tính với lớp CỦA TA sẽ làm TypeScript báo **TS2717** (hai `SpeechToText` khác bản). Runtime không đổi; kiểu `ctx.speechToText` vẫn do d.ts stock/gói tiêu thụ cấp.

| artifact | export lúc chạy | ghi chú |
|---|---|---|
| `lib/index.js` | `default` | `Object.keys` = `["default"]`, y stock |
| `lib/types.js` | không có | module rỗng như `types.js` gốc (`export {}`) |
| `lib/wave.js` | `validateWave` | y stock |

| thành viên công khai | hành vi (nguyên văn bản gốc) |
|---|---|
| `register(provider)` | từ chối khi service đã xuống; id trùng ⇒ `Speech provider already registered: <id>`; trả hàm huỷ idempotent |
| `listProviders()` | sự thật provider theo thứ tự đăng ký |
| `follow(caller)` | async generator: ảnh chụp đầu tiên, rồi mỗi lần đổi; người đọc chậm gộp tiến độ |
| `snapshot()` | `{ providers: [{...info, preparation}], selection: { providerId, language } }` |
| `configure(patch)` | thiếu settings/entry ⇒ lỗi; kiểm provider + ngôn ngữ TRƯỚC, rồi mới `settings.update` đúng trường đã đổi |
| `prepare(id, options?)` | chuyển tiếp cho `preparation.prepare` |
| `cancelPreparation(id)` | chờ `preparation.cancel()` |
| `resolve(request)` | áp mặc định composition, ghim `provider` |
| `transcribe(spec, signal)` | chỉ chạy đúng đăng ký đã ghim; signal gộp; chờ mọi việc đang chạy khi rút |

## 3. Row theo dump-now2

Row stock **có thật** trong bundle patch `dsh-experimental-voice-input-bundle`:

```yaml
# /tmp/dump-now2.txt
1555: - id: speech-to-text
1556:   name: '@deepseek-ai/dsh-experimental-speech-to-text'
1557:   config:
1558:     defaultProvider: sensevoice-local
1559: - id: speech-to-text-sensevoice
```

(Dump 18/10 `.parity/dumps/2026-10-18T01-31-57/` **không** có row này — đó là lý do bản nháp đầu tiên
ghi "GBH-ONLY"; dump mới 19/10 có, nên hình dạng row dưới đây theo **dump-now2**.)

`package.json` khai **PARK** — không có `gbh.row`, chỉ có `gbh.row_unmounted_ly_do`:

```json
{
  "ly_do": "row nam trong bundle patch dsh-experimental-voice-input-bundle (dump moi /tmp/dump-now2.txt dong 1555-1557); chua mount/flip.",
  "row": {
    "id": "speech-to-text",
    "config": { "defaultProvider": "sensevoice-local" },
    "moduleIds": ["@galaxy-blackhole/gbh-experimental-speech-to-text"],
    "tests": ["tests/host/experimental-speech-to-text.test.ts"]
  }
}
```

- **Chưa mount / chưa flip**: không có dòng `gbh.row`; `check:rows` bỏ qua gói này.
- **Không khai `aliases`**: gói host-only, không có nửa client ⇒ không có id bundle client nào để alias.
- **Mount lại = MỘT dòng**: đổi `gbh.row_unmounted_ly_do` → `gbh.row` (giữ nguyên id/config/moduleIds/tests),
  rồi boot-smoke home CÁCH LY + dòng `packages/README.md` §4 của Lead.
- **Hàng xóm trong cùng bundle**: `speech-to-text-sensevoice` · `api-speech-to-text` · `ui-voice-input` —
  chưa gói nào được port, nên nếu mount riêng row này thì app chỉ có registry rỗng (xem §4).

## 4. Nợ

- **Test đã có**: `tests/host/experimental-speech-to-text.test.ts` — **14 ca / 127 expect / 0 fail**,
  996 dòng, chạy A/B trên Context cordis THẬT + seam settings giả; phủ export · Config · service ·
  mount/dispose · register · snapshot · follow · resolve · prepare/cancel · transcribe · configure ·
  validateWave · metadata row. Không mạng, không audio/model thật.
- **Test không đọc `package.json`**: hợp đồng row được kiểm tay ở §3; gate `hygiene` không áp dụng vì
  `gbh.row` vắng. Khi ai đó flip row, nên thêm ca canh metadata.
- **Chưa mount**: gói park; `check:rows`/`check:app` chưa đo gói này. Mount phải qua boot-smoke home
  cách ly trước.
- **Hệ sinh thái provider chưa chuyển**: stock còn `dsh-experimental-api-speech-to-text`,
  `dsh-experimental-speech-to-text-sensevoice` và gói client voice input — chưa gói nào được port, nên
  registry này hiện **chưa có provider nào** đăng ký trong app.
- **Không port `locale/{en,zh}.json`**: `index.js` gốc không đọc locale; chuỗi hiển thị nằm ở gói client
  `dsh-experimental-client-ui-voice-input` (chưa port). Khi port nửa client phải chép lại locale
  byte-for-byte và thêm `"./locale/*.json"` vào `exports`.
- **Version loader lệch chỉ dẫn**: chỉ dẫn giao việc ghi `@deepseek-ai/cordis-plugin-loader
  0.2.1-alpha.4`, nhưng bản **đang cài** là `1.0.6` và stock khai `~1.0.6-alpha.2` ⇒ gói khai
  `~1.0.6-alpha.2` (khai `0.2.1-alpha.4` sẽ là một lời khai sai với symlink thực tế).
- **Ba phép ghim kiểu brand**: `snapshot`, `configure`, `resolve` đọc `defaultProvider.get()` (kiểu
  `string` y stock) rồi `as SpeechProviderId` để gán vào danh tính đã brand. Thuần kiểu — artifact
  không phát sinh lệnh nào.
- **Hai import chỉ-kiểu**: `@deepseek-ai/cordis-plugin-loader` (augmentation `Fiber.entry`) và
  `@deepseek-ai/dsh-settings` (augmentation `Context.settings`). Cả hai bị xoá khi build;
  `grep -c "cordis-plugin-loader\|dsh-settings" lib/index.js` = 0.
- **Không khai lại augmentation `Context.speechToText`**: lý do TS2717 ở §2; đây là khác biệt DUY NHẤT về khai báo kiểu so với d.ts stock.
- **Không ship `.d.ts`**: theo quy ước các gói khác của repo; `exports` trỏ thẳng `lib/*.js`.

## 5. Lệnh

```bash
# build (từ package) -> lib/index.js + lib/types.js + lib/wave.js
cd galaxy-blackhole/blackhole-tauri/packages/host/experimental-speech-to-text
/Users/buitronghieu/.bun/bin/bun run build.ts

# typecheck (từ repo root)
/Users/buitronghieu/.bun/bin/bun node_modules/typescript/lib/tsc.js -p packages/host/experimental-speech-to-text

# test A/B (từ repo root) — 14 pass / 127 expect
/Users/buitronghieu/.bun/bin/bun test tests/host/experimental-speech-to-text.test.ts

# lint scoped: copy gói + test vào cây tạm rồi trỏ GBH_LINT_ROOT (bỏ node_modules/lib)
SCOPE=$(mktemp -d)
mkdir -p "$SCOPE/packages/host" "$SCOPE/tests/host"
cp -R packages/host/experimental-speech-to-text "$SCOPE/packages/host/"
rm -rf "$SCOPE/packages/host/experimental-speech-to-text/node_modules"
cp tests/host/experimental-speech-to-text.test.ts "$SCOPE/tests/host/"
for t in header file-length jsdoc; do GBH_LINT_ROOT="$SCOPE" /Users/buitronghieu/.bun/bin/bun run tools/lint/$t.ts --strict; done
```

Số dòng hiện tại: `src/index.ts` 356 · `src/types.ts` 183 · `src/wave.ts` 43 · `build.ts` 74 ·
`tests/host/experimental-speech-to-text.test.ts` 996 · `lib/index.js` 171 · `lib/types.js` 0 ·
`lib/wave.js` 14.
