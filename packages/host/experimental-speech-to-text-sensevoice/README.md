<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc README gói experimental-speech-to-text-sensevoice: port 1:1 host-only (bundle 957 + 249 dòng, 8 module, assets/locale byte-identical) — nguồn đối chiếu dòng, TRƯỚC/SAU, bề mặt, vì sao KHÔNG có gbh.row, bằng chứng, nợ, lệnh
-->

# `@galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice`

Bản viết lại **1:1** của `@deepseek-ai/dsh-experimental-speech-to-text-sensevoice` — *nhận dạng tiếng nói CỤC BỘ*
bằng **SenseVoiceSmall ONNX + Silero VAD** trên CPU, qua **MỘT worker sherpa-onnx** do Host quản lý: chuẩn bị mô hình
ghim size/SHA-256, hàng đợi có hạn mức, huỷ theo từng yêu cầu, thu hồi worker khi rảnh. Kích hoạt plugin **không tải,
không nạp mô hình** — chỉ soi cache trên đĩa.

> **GBH-ONLY** — bản gốc **KHÔNG có row** nào trong cây plugin đang chạy, nên gói này **không khai `gbh.row`**;
> row tương lai được **park** trong `gbh.row_unmounted_ly_do.row` (id + config `!!js` + moduleIds + alias id stock + tests; **chưa mount/chưa flip**).

## 0. Nguồn đối chiếu dòng

Bản gốc trong kernel (**CHỈ ĐỌC**): `apps/host/node_modules/@deepseek-ai/dsh-experimental-speech-to-text-sensevoice/`.

| vùng gốc | dòng stock | nội dung | tệp của ta | dòng |
|---|---|---|---|---|
| `lib/index.js` | 1–11 | import (external giữ nguyên) | `src/*.ts` (mỗi module tự khai) | — |
| `lib/index.js` | **12–24** | `languages` · `SpeechInputError` (region input) | `src/input.ts` | 1–13 |
| `lib/index.js` | **25–69** | bảng mã lỗi · `classifyDownloadFailure` · `SpeechDownloadError` | `src/download-error.ts` | 1–73 |
| `lib/index.js` | **70–183** | `orderModelSources` (dò HEAD song song) | `src/model-sources.ts` | 1–51 |
| `lib/index.js` | **184–381** | `matchesAsset` · `resolveRuntime` · `verifyRuntime` · `inspectRuntime` · `downloadAsset` · `prepareRuntime` | `src/runtime.ts` | 1–301 |
| `lib/index.js` | **382–881** | `transcriptSchema` · `waitFor` · `readReady` · `readTranscript` · `SenseVoiceWorker` | `src/recognizer.ts` | 1–540 |
| `lib/index.js` | **883–910** | `Config` (schema schemastery) | `src/config.ts` | 13–88 |
| `lib/index.js` | **912–957** | `name` · `inject` · `apply` | `src/index.ts` | 1–64 |
| `lib/worker.js` | **8–35** | `Config` (bản sao trong bundle worker) | `src/config.ts` (dùng chung) | 13–88 |
| `lib/worker.js` | **37–66** | input + `validateInput` | `src/input.ts` + `src/worker.ts` | 1–13 / 186–199 |
| `lib/worker.js` | **67–155** | `createTranscriber` (sherpa + VAD) | `src/worker.ts` | 201–286 |
| `lib/worker.js` | **156–220** | `startRecognitionServer` (loopback có bearer) | `src/worker.ts` | 288–348 |
| `lib/worker.js` | **221–249** | `main` + in `{"port":N}` + thoát mã 1 | `src/worker.ts` | 350–375 |

Tài nguyên **copy byte-identical** (không sửa một byte):

| tệp | byte | sha256 (stock) | sha256 (ta) | so byte |
|---|---:|---|---|---|
| `runtime/assets.json` | **1.242** | `d46d8e9dd0493725535997100bd2c1389fd3d0ddc5d2e2aefa5495a996d3f5d5` | `d46d8e9dd0493725535997100bd2c1389fd3d0ddc5d2e2aefa5495a996d3f5d5` | `cmp` = giống |
| `locale/en.json` | 143 | `515415040abd38d44f8d719c35f0a952f2403b9c94ae59cf10df253cf19efade` | giống | `cmp` = giống |
| `locale/zh.json` | 133 | `9991b8f16929a85c0a74847e9ea0d590be4c30872d56db31a4129dc8f4403cb8` | giống | `cmp` = giống |

## 1. TRƯỚC → SAU

| hạng mục | TRƯỚC (DSH) | SAU (gói của ta) |
|---|---|---|
| entry plugin | `lib/index.js` **957 dòng** (bundle 7 region) | `src/index.ts` **64** + 6 module (`config` 88 · `input` 13 · `download-error` 73 · `model-sources` 51 · `runtime` 301 · `recognizer` 540) |
| entry worker | `lib/worker.js` **249 dòng** (bundle 5 region) | `src/worker.ts` **375** (dùng lại `config.ts` + `input.ts`, phần còn lại port 1:1) |
| build | một bundle có prelude `__addDisposableResource`/`__disposeResources` lặp 2 lần (116 dòng) | `build.ts` build **TỪNG entrypoint một lần `Bun.build` RIÊNG** (bài học task-130: gộp nhiều entry trong một lần build ⇒ Bun sinh prelude chia sẻ ⇒ byte lệch), naming = tên artifact |
| `buildPackage(outDir?)` | — | trả **object đường dẫn từng entry** `{ service, worker }`; `outDir` mặc định `lib` cạnh package |
| cú pháp TS | JS thuần sau build | `using` thay helper downlevel (hành vi y hệt: disposal đúng scope), `strict` + `noUncheckedIndexedAccess` |
| `Config` | const schemastery trong bundle (+ bản sao ở worker) | `src/config.ts` **một nguồn**; `String(Config)` và mọi mặc định trùng từng chữ với stock |
| export công khai | `Config` · `apply` · `inject` · `name` | **giống hệt** (không `default`) |
| `runtime/assets.json` | 1.242 B | **copy byte-identical** |
| locale | `en.json` · `zh.json` | **copy byte-identical** |
| test | — | **18 ca / 207 expect · 0 fail** (A/B với bundle gốc trên seam subprocess giả) |

## 2. Bề mặt / plugin

- **Export**: `name = "experimental-speech-to-text-sensevoice"`, `inject = ["speechToText", "subprocess"]`, `apply(ctx, config)`, `Config` (value + type). **Không** export `default`; `./worker` trỏ `lib/worker.js` và **không export gì** (entry tiến trình con).
- **`apply`**: kiểm mọi đường dẫn cấu hình phải TUYỆT ĐỐI → dựng `new URL(origin)` cho từng nguồn → tạo MỘT `SenseVoiceWorker` → trong `ctx.effect`: `ctx.speechToText.register({ info, preparation, transcribe })` rồi `worker.inspect()`; disposer gỡ đăng ký **rồi** `worker.dispose()`.
- **`info`**: `id` (mặc định `sensevoice-local`) · `name = SenseVoiceSmall (INT8|FP32)` · `location = "host-local"` · `languages = ["auto","zh","en","yue","ja","ko"]` · `downloadSources` (offline khi CẢ `modelDirectory` lẫn `vadModelPath` được khai) · `setupEstimate` 1e9/2e9 byte, 1–10 phút.
- **Chuẩn bị** (Host sở hữu, không thuộc trang/Session): `check → (model) → (vad) → verify → load`; tải về đi qua `orderModelSources` (HEAD song song, first-2xx trước, fallback giữ thứ tự) rồi `downloadAsset` (tệp `.part` duy nhất + SHA-256 + `rename` nguyên tử); huỷ/thất bại không phá cache đã xác minh.
- **Worker** (riêng tư): Host spawn `process.execPath lib/worker.js '<JSON config+paths>'` với `DSH_SPEECH_TOKEN` (64 hex, xoá khỏi env ngay khi đọc) và `ELECTRON_RUN_AS_NODE=1`; worker in **đúng một dòng** `{"port":N}` ra stdout sau khi nạp xong mô hình, rồi phục vụ `POST /transcribe?language=…` trên loopback với bearer + trần byte; WAV/ngôn ngữ sai ⇒ `400 invalid-input` (worker vẫn sống), lỗi suy luận ⇒ `500` (Host thu hồi worker).
- **Hàng đợi**: tuần tự (`tail`), trần `maxPending`, huỷ không bao giờ để suy luận chạy tiếp sau khi settle; `idleTimeoutMs > 0` ⇒ tự dừng worker khi rảnh; `dispose()` đóng cổng nhận việc, join việc đã nhận rồi chờ tiến trình con thoát.
- **`sherpa-onnx-node`**: dependency **NATIVE**, CHỈ cần ở runtime; **không symlink**, build/test **không nạp**; `worker.ts` khai **kiểu cục bộ tối thiểu** (`SherpaModule`/`NativeRecognizer`/`NativeVad`/…) thay cho `@types` vì gói không có trên npm.

## 3. Vì sao KHÔNG có `gbh.row`

- **ROW CÓ THẬT trong bundle patch, nhưng bundle CHƯA được mount**: bundle
  `dsh-experimental-voice-input-bundle` khai row `speech-to-text-sensevoice` tại **dump-now2 dòng 1559–1562**,
  với `config.dataRoot` là biểu thức **`!!js dshHomePath('speech-to-text', 'sensevoice')`** — giữ **NGUYÊN VĂN**
  (không đánh giá, không đổi thành đường dẫn tuyệt đối).
- **Cây plugin đang chạy KHÔNG có row này**: `grep -ci speech .parity/dumps/2026-10-18T01-31-57/ours.yml` = **0**
  (và `grep -ci sensevoice` cũng **0**) ⇒ bundle chưa mount, nên không có row stock nào để thay/flip. Vì vậy gói
  **KHÔNG khai `gbh.row`** (khai sẽ khiến `check:rows` so với hư không).
- Row tương lai được **PARK** trong `gbh.row_unmounted_ly_do.row` **đúng hình dạng**
  `{ id: "speech-to-text-sensevoice", config: { dataRoot: { js: "dshHomePath('speech-to-text', 'sensevoice')" } },
  moduleIds: ["@galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice"],
  aliases: ["@deepseek-ai/dsh-experimental-speech-to-text-sensevoice"], tests: ["tests/host/experimental-speech-to-text-sensevoice.test.ts"] }`
  — đó là *ý định*, **không phải** mount: chưa thêm vào patch, chưa flip, chưa boot-smoke. `aliases` chỉ ghi id
  module STOCK cho lần mount sau (Loader cần entry aliases-only); KHÔNG `insertOnly` vì chưa có row stock nào bị tắt.
- Muốn mount thật (khi Lead cho phép): đổi khoá `gbh.row_unmounted_ly_do` → `gbh.row` (giữ nguyên `row`) rồi mount lại;
  **không sửa mã**. Khi đó `runtime/` phải đi cùng `lib/` trong profile (nợ §5.4).

## 4. Bằng chứng (đã chạy)

| phép đo | kết quả |
|---|---|
| `bun run build.ts` | `lib/index.js` **847 dòng** + `lib/worker.js` **210 dòng**, mỗi entry MỘT lần Bun.build, `packages: "external"` |
| `tsc -p` (TS strict, `types: ["bun"]`) | **0 lỗi** |
| `runtime/assets.json` | 1.242 B · sha256 `d46d8e9d…f5d5` **hai bên trùng** · `cmp` giống |
| `locale/en.json` · `locale/zh.json` | sha256 `51541504…fade` · `9991b8f1…cb8` **hai bên trùng** · `cmp` giống |
| `bun test tests/host/experimental-speech-to-text-sensevoice.test.ts` | **18 pass / 0 fail · 207 expect** — export surface · `String(Config)` + 10 cấu hình sai (cùng name/message) · assets/locale byte · `lib/worker.js` chạy THẬT khi thiếu model (cùng exit 1 + cùng byte stderr/stdout) · apply (đường dẫn tương đối, origin hỏng, 4 tổ hợp info) · state `standby`/`unprepared` · spec spawn · 3 nhánh khung sẵn sàng hỏng · transcribe thành công/thất bại · hàng đợi đầy · dispose · idle |
| lint phạm vi gói | header · file-length (≤ 1000 dòng/tệp) · jsdoc **0 vi phạm** |

## 5. Nợ kỹ thuật

1. **Chưa mount** (đúng chủ đích): row chỉ nằm trong `row_unmounted_ly_do` (không `insertOnly`; `aliases` chỉ trỏ id module stock cho lần mount sau); chờ Lead cho cửa sổ boot + `lab:row` + boot-smoke rồi mới flip.
2. **`sherpa-onnx-node`** không có trong `node_modules` của gói (native, chỉ runtime). Muốn chạy thật phải cài dependency native đó theo đúng phiên bản stock (`1.13.8`) trong profile của app; build/test **không** được nạp nó.
3. **Không ship `.d.ts`** (theo quy ước các gói khác của repo); kiểu công khai suy từ `src/*.ts`.
4. **`runtime/assets.json` phải đi cùng artifact**: `build.ts` chỉ ghi `lib/`, còn `resolveRuntime` đọc `../runtime/assets.json` so với `lib/index.js` ⇒ tầng mount phải copy `runtime/` cạnh `lib/` (test A/B tự copy để mô phỏng đúng điều đó).
5. **Không có test mạng/audio thật**: mọi nhánh HTTP dùng `fetch` giả, worker dùng `subprocess` giả; phần native (ONNX) chỉ chứng minh gián tiếp qua hợp đồng worker.

## 6. Lệnh

```bash
# build (index + worker, hai lần Bun.build riêng)
cd packages/host/experimental-speech-to-text-sensevoice && bun run build.ts

# typecheck strict
tsc -p packages/host/experimental-speech-to-text-sensevoice

# test A/B với bundle gốc (không mạng, không audio, không sherpa)
bun test tests/host/experimental-speech-to-text-sensevoice.test.ts

# lint phạm vi gói
bun run lint:header && bun run lint:length && bun run lint:jsdoc

# so byte tài nguyên
shasum -a 256 packages/host/experimental-speech-to-text-sensevoice/runtime/assets.json \
              apps/host/node_modules/@deepseek-ai/dsh-experimental-speech-to-text-sensevoice/runtime/assets.json
```
