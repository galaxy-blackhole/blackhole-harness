<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port NỬA HOST của @deepseek-ai/dsh-experimental-client-ui-voice-input: 6 dòng stock
      lib/index.js, marker apply() rỗng; nửa client 2.979 dòng do P5 de-bundle theo part; row PARK
      ui-voice-input theo dump-now2, KHÔNG khai gbh.row, KHÔNG mount/flip
-->

# @galaxy-blackhole/gbh-experimental-client-ui-voice-input — HOST 6 dòng + marker client, CHƯA mount

Port 1:1 **nửa HOST** của `@deepseek-ai/dsh-experimental-client-ui-voice-input` @0.2.1-alpha.4:
`lib/index.js` stock chỉ **6 dòng / 208 B** — hai dòng chú thích + `function apply() {}` +
`export { apply }`; `apply` **rỗng**, arity **0**, không chạm `Context`, không mạng/audio.

Nửa CLIENT stock **`lib/client.js` 2.979 dòng / 119.517 B** (micro, waveform, transcribe, hộp thoại cài
model, chọn input device) **đang được P5 de-bundle theo part** trong cùng package: 3 part nguyên văn + vỏ
loader, cổng byte/id ⇒ `lib/client.js` **2.979 dòng / 119.532 B** (chỉ khác id module 5 B × 3 lần).
Package khai `dsh.client` + `exports["./client"]` để sẵn sàng mount, nhưng **KHÔNG mount/flip** lượt này.

## 0. Đối chiếu dòng

Stock = `apps/host/node_modules/@deepseek-ai/dsh-experimental-client-ui-voice-input` (**CHỈ ĐỌC**):

| Vùng stock | Dòng stock | Tệp của ta | Dòng ta |
|---|---:|---|---:|
| `lib/index.js` — region `lib/types/index.js`, marker host 2 chú thích + `apply()` rỗng + export | **1–6** (6 dòng / 208 B) | `src/index.ts` — header 5 trường + **6 dòng stock nguyên văn** | 6 dòng stock (+ header) |
| `lib/types/index.d.ts` — `export declare function apply(): void` | 1–3 (3 dòng) | `src/index.ts` (một export duy nhất) | gộp vào `src/index.ts` |
| `package.json` — `exports`/`peer`/`dsh.client` | 1–82 | `package.json` (exports 4 mục, peer cordis, `dsh.client` nguyên văn) | JSON 2-space |
| `locale/en.json` · `locale/zh.json` | 6 · 6 | `locale/en.json` · `locale/zh.json` | **chép byte-identical** |
| `lib/client.js` — UI voice input | **2.979 dòng / 119.517 B** | `lib/client.js` — P5 ghép 3 part + vỏ, cổng byte/id | **2.979 dòng / 119.532 B** |
| `lib/types/client/*.d.ts` — kiểu UI | 13 tệp (**332 dòng**) | **CHƯA port** | 0 |
| build pipeline stock (`tsdown`) | — | `build.ts` — 2 lời gọi `Bun.build` RIÊNG + `buildClient()` | xem §5–§6 |
| `tsconfig.json` | stock không phát hành | copy `packages/host/plan-mode/tsconfig.json` | **27 dòng**, byte-identical |

Artifact HOST của ta: `lib/index.js` **5 dòng / 56 B** (Bun bỏ JSDoc/region) — bề mặt export **BẰNG**
stock `["apply"]`; artifact marker: `lib/client-entry.js` **5 dòng / 128 B**.

## 1. Host surface

**ĐÚNG một tên export: `apply`** — arity `0`, trả `undefined`, không có `name`/`inject`/`Config`/
`Service`/`default`. Gọi trên `undefined`/`null`/Context giả/Proxy thù địch: không ném, không chạm trap,
không gọi `provide/get/on/plugin/effect`. Nguồn `src/index.ts` giữ **nguyên văn 6 dòng stock**:

```ts
//#region lib/types/index.js
/** Host marker for the optional browser voice input contribution. */
/** Browser behavior is provided by the client export. */
function apply() {}
//#endregion
export { apply };
```

Không có hành vi người dùng ở host: micro/toolbar ghi âm/waveform/transcribe/hộp thoại cài model đều ở nửa
client. Locale `meta.title`/`meta.description` (`Voice recording` / `录音输入`) chỉ dùng cho tiêu đề row
khi mount. Nửa host không import cordis; peer khai để manifest khớp stock và nửa client dùng lại khi cần.

## 2. `dsh.client` — NGUYÊN VĂN từ stock

`package.json` stock @0.2.1-alpha.4 (7 mục `inject` + 1 `external`, `platform: "web"`):

```json
{
  "client": {
    "inject": [
      "@deepseek-ai/dsh-api-remotes",
      "@deepseek-ai/dsh-api-session-controller",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-conversation",
      "@galaxy-blackhole/gbh-client-ui-primitives",
      "@deepseek-ai/dsh-api-gateway",
      "@deepseek-ai/dsh-client-ui-plugin-manager"
    ],
    "platform": "web",
    "external": ["@deepseek-ai/dsh-api-gateway/client"]
  }
}
```

Brief ghi **"10 gói"**; số ĐO ĐƯỢC là **7 inject + 1 external** — ghi số đo, nêu lệch để Lead đối chiếu.
Manifest ta khai đúng object trên; `exports` = `{ ".": "./lib/index.js", "./client": "./lib/client.js",
"./locale/*.json": "./locale/*.json", "./package.json": "./package.json" }`. Peer + dev:
`@deepseek-ai/cordis ~4.0.5-alpha.2`; symlink `node_modules/@deepseek-ai/cordis` →
`apps/host/node_modules/@deepseek-ai/cordis` (đã kiểm tồn tại).

## 3. Locale — sha256 byte-identical

`cmp` + sha256 khớp stock **từng byte**:

| Tệp | Dòng | sha256 |
|---|---:|---|
| `locale/en.json` | 6 | `cda757109c5e2687819a307c0326c8e0a48488d665a6668b3581d3e5c1c48f4f` |
| `locale/zh.json` | 6 | `0cb96756eb42591583162e9271fd64bd70fe3cff5477d702e9cfac116546b881` |

Nội dung chỉ có `meta.title`/`meta.description`; namespace `voice-input` **chưa** đăng ký vào bộ locale
tập trung vì chưa mount.

## 4. Row theo `dump-now2` — `ui-voice-input`, KHÔNG `gbh.row`

`/tmp/dump-now2.txt` (dump mới nhất, sinh từ app đang chạy) dòng **1565–1566**:

```yml
- id: ui-voice-input
  name: '@deepseek-ai/dsh-experimental-client-ui-voice-input'
```

Row nằm **TRONG bundle patch** `dsh-experimental-voice-input-bundle` (dòng 1554),
**KHÔNG config/inject/disabled**. Vì thế:

* id đúng là `ui-voice-input` (không phải `voice-input`);
* row **tồn tại** ⇒ **không dùng `insertOnly`** (lượt 13:00 từng khai `insertOnly` vì chỉ grep top-level
  của dump cũ 2026-10-18T01-31-57; đính chính 13:06 bỏ `insertOnly`);
* vẫn **KHÔNG** khai `gbh.row` — chỉ PARK:

```json
{ "id": "ui-voice-input",
  "moduleIds": ["@galaxy-blackhole/gbh-experimental-client-ui-voice-input"],
  "aliases": ["@deepseek-ai/dsh-experimental-client-ui-voice-input"],
  "tests": ["tests/host/experimental-client-ui-voice-input.test.ts"] }
```

`gbh.row_unmounted_ly_do.ly_do` ghi HAI MẶT + dump-now2 + **CHUA mount, CHUA flip**. Điều kiện flip (cả ba):
(a) nửa client + 7 inject + test UI xanh, (b) khai `gbh.row` đúng id/moduleIds/aliases/tests, (c) `lab:row` +
boot-smoke + reviewer ký. Lượt này **KHÔNG** chạy `lab:row`/boot-smoke, không mạng/audio thật.

## 5. Nợ nửa client

| # | Hạng mục | Trạng thái |
|---|---|---|
| 1 | `lib/client.js` stock **2.979 dòng / 119.517 B** — micro + toolbar + waveform + transcribe + hộp thoại cài model + chọn input device | **P5 đã de-bundle cơ học**: 3 part nguyên văn + vỏ loader, cổng byte + cổng id ⇒ **2.979 dòng / 119.532 B**, sha256 `fd677574012b0512b75cc3d792aff80d0108852a0c2b3b89f4c136d07842623d`; id gốc còn **0**, id ta **3** (1 dòng id + 2 asset CSS); +15 B = id ta dài hơn 5 B × 3 lần |
| 2 | `dsh.client` **7 inject + 1 external** | **ĐÃ khai nguyên văn** trong `package.json` (§2) |
| 3 | `exports["./client"]` | **ĐÃ khai** → `./lib/client.js` |
| 4 | 13 tệp `.d.ts` nửa client (**332 dòng**) | **CHƯA port** — bundle runtime không cần; chỉ cần nếu chuyển client sang TS |
| 5 | Test hành vi UI (ghi âm, quyền micro, huỷ, transcribe, chọn device) | **CHƯA có** — test hiện khoá host surface + manifest + locale + cổng byte/id client |
| 6 | `gbh.row` + `lab:row` + boot-smoke + reviewer ký | **CHƯA** (cố ý — chưa flip) |
| 7 | Namespace locale `voice-input` ở bộ locale tập trung | **CHƯA** đăng ký; chỉ 2 tệp `locale/*.json` byte-identical |

`build.ts` hiện có **2 lời gọi `Bun.build` RIÊNG** (host + marker `client-entry`) và **`buildClient()`**
(assemble part, cổng byte/id). Ghi chú kiến trúc trong `build.ts` khoá bất biến: khi sửa phải GIỮ entry
marker, không gộp hai `Bun.build`, không đưa `lib/client.js` qua Bun. `ENTRY_POINTS` chỉ host để test ca 11
vẫn xanh; marker build bằng hàm riêng.

### 5.1 Bằng chứng part (port cơ học)

Bundle gốc `lib/client.js` (**119.517 B**, sha256 `00b2b3334e01588489b0183cad54ab07ee716bcaccb2e8cdaf1159e61863f2a1`)
cắt theo **ranh giới dòng**: 3 dòng đầu + **2.970 dòng thân** + 7 dòng cuối. Ba part `.txt` là **tài sản
verbatim** (không header — luật repo chỉ kiểm các đuôi mã nguồn), mỗi part **990 dòng**:

| Part | Dòng | Byte | sha256 |
|---|---:|---:|---|
| `part-01.txt` | 990 | 37.056 | `8c278311bdbec20fc79120270b5c58ae764237a4849f8f470886e7de90f8f54d` |
| `part-02.txt` | 990 | 37.445 | `693f07e8851bf51fd3dfb9a0c91319b0b7927530ea358b5c16b03e553715d08a` |
| `part-03.txt` | 990 | 44.781 | `054d353d6435dfabca3f2537dabec2e9988779f973b5d3307d3363f70d7af1a1` |

`src/client-wrapper.json` giữ 3 dòng đầu + 7 dòng cuối; CHỈ dòng `id:` đổi sang id ta. Bốn cổng trong
`build.ts` → `buildClient()`:

1. **khuôn vỏ** — `head[0]`/`head[1]`/`head[2]` đúng khuôn, dòng id là id ta, không lẫn id gốc;
2. **byte** — bản ghép (vỏ + part nguyên văn) phải BẰNG stock **chỉ đổi dòng id module**: **119.522 B**,
   sha256 `f96ab186b789097247e518627f0fa84c8498d892f99294e426d476e33b5fea30`; lệch 1 byte ⇒ DỪNG;
3. **id** — id gốc **0 lần**, id ta **3 lần** (số ĐO TỪ stock: 1 dòng `id:` + 2 tham chiếu asset CSS
   `tagId`/`dataset.plugin`), dòng `id:` đúng **1 lần**;
4. **quy đổi** — bản cuối bằng `stock.split(STOCK_ID).join(OUR_ID)` → **119.532 B**, sha256
   `fd677574012b0512b75cc3d792aff80d0108852a0c2b3b89f4c136d07842623d`.

## 6. Lệnh

```bash
cd packages/host/experimental-client-ui-voice-input
bun run build.ts                    # → lib/index.js + lib/client-entry.js + lib/client.js (cổng byte/id)
bun run build.ts /tmp/out           # build vào thư mục khác (dọn đích trước)

cd <repo>
./node_modules/.bin/tsc -p packages/host/experimental-client-ui-voice-input/tsconfig.json   # tsc -p, 0 lỗi
bun test tests/host/experimental-client-ui-voice-input.test.ts                              # 13 ca / 133 expect / 0 fail
shasum -a 256 packages/host/experimental-client-ui-voice-input/locale/*.json                # khớp sha §3
bun run tools/lint/header.ts        # 5 trường header
bun run tools/lint/file-length.ts   # ≤ 1000 dòng/tệp
bun run tools/lint/jsdoc.ts         # JSDoc mọi export
bun run tools/lint/dep-guard.ts     # phụ thuộc khai báo
bun run gate --only header,file-length,jsdoc,dep-guard --no-tests
bun run check:rows                  # BỎ QUA gói này (KHÔNG khai gbh.row)
```

Build ghi rõ từng artifact: `built .../lib/index.js`, `built .../lib/client-entry.js`,
`built .../lib/client.js`. Không có bước mount/flip trong lượt này.

## 19/10/2026 13:1x — ĐÍNH CHÍNH cây hiện tại (Lead đính chính)

1. Row THẬT của gói nằm trong **bundle patch `dsh-experimental-voice-input-bundle`** (dump mới `/tmp/dump-now2.txt` 1565–1566):
   `- id: ui-voice-input` + name `@deepseek-ai/dsh-experimental-client-ui-voice-input`, KHÔNG config/inject/disabled.
   Park bằng `gbh.row_unmounted_ly_do.row = { id: "ui-voice-input", moduleIds, aliases, tests }` — **KHÔNG còn `insertOnly`** (đó là cho gói ta tự thêm).
2. **Nửa client ĐÃ port** (không còn nợ): de-bundle 3 part nguyên văn + vỏ loader, `lib/client.js` **2.979 dòng / 119.532 B**
   (stock 119.517 B; +15 B = id ta dài hơn 5 B × 3 lần xuất hiện), sha256 `fd677574…`; cổng byte + cổng id PASS trong `build.ts`.
3. `dsh.client` đã khai NGUYÊN VĂN stock: **7 inject + 1 external** (`@deepseek-ai/dsh-api-gateway/client`), platform `web`
   (brief ghi "10 gói" là SAI — số đo từ artefact là 7+1). `exports["./client"]` trỏ `./lib/client.js`.
4. Test hiện tại: **13 ca / 133 expect / 0 fail** (A/B với stock, build vào mkdtemp, không mạng/audio thật).
5. Còn nợ (ngoài lượt này): 13 tệp `.d.ts` client; test hành vi UI (ghi âm/quyền micro/transcribe); đăng ký namespace locale;
   `gbh.row` + `lab:row` + `boot-smoke` + reviewer ký khi Lead cho FLIP. **KHÔNG mount** ở lượt này.
