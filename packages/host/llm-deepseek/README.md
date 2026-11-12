<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc README của @galaxy-blackhole/gbh-llm-deepseek — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-llm-deepseek

Bản viết lại của Galaxy Blackhole cho row **`llm-deepseek`** của DSH
(`@deepseek-ai/dsh-llm-deepseek-api-key`, bundle MỘT FILE **75 dòng** `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-api-key/` — CHỈ ĐỌC).

> ⚠️ **KIỂM KÊ (Lead chốt 08/11/2026 — phương án (b))**: gói này triển khai **ROW API-KEY**
> (`@deepseek-ai/dsh-llm-deepseek-api-key`). **ROW ADAPTER `@deepseek-ai/dsh-llm-deepseek` CHƯA PORT**
> — bản gốc adapter có `DeepSeekAdapter` · `PUBLIC_BASE_URL` · `deepSeekConfigFields` ·
> `catalogModelInfo` · `registerDeepSeekProvider`… và CHƯA có bản GBH tương ứng (thuộc LÔ RIÊNG).
> Hệ quả kiểm kê: hiện **HAI** gói GBH cùng khai một stock row (`dsh-llm-deepseek-api-key`):
> gói này và `packages/host/llm-deepseek-api-key` (de-bundle 1:1). Parity matrix cần đọc đúng như vậy.

**Vai trò**: **khoá API DeepSeek cho LLM**. Row khai route `deepseek-official` là provider **cấu hình
được** (để màn Models của web ghi khoá), rồi trao cho adapter DeepSeek của kernel ba thứ: ảnh chụp cấu
hình **mới cho mỗi thao tác**, hàm phân giải khoá **theo từng request** (credentials trước, môi trường
khởi động sau), và hàm khám phá model **bị chặn bởi credential**.

> ⚠️ **Row MỘT MẶT** — đã kiểm `lib/client.js` **KHÔNG tồn tại** (chỉ có `lib/index.js` +
> `lib/types/`), và `package.json` **KHÔNG** có `dsh.client`. ⇒ disable+insert không làm mất nửa
> client nào (câu hỏi thứ 5 của recipe: **không**).

> ⚠️ **Gói CHƯA khai `gbh.row`** — theo chỉ đạo của Lead (boot do Lead thực hiện). Gói **không thể
> làm hỏng app**: `bh host` chỉ sinh patch từ package CÓ `gbh.row`, và `check:rows` chỉ kiểm package
> CÓ `gbh.row`. Có **test canh** khẳng định `gbh.row` vẫn chưa khai.

> ⚠️ **Row này ĐANG BỊ TẮT trong sản phẩm**: `profiles/blackhole/app.patch.yml:80-81`
> (`- id: llm-deepseek` / `disabled: true`) — app chạy route `auto` → Ollama, không dùng route
> chính thức của DeepSeek. Đó là lý do row có **0 ảnh hưởng** lên app 5439 cho tới khi ai đó bật lại.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `Config` (schemastery) | `lib/index.js` dòng 7–10 · `lib/types/config.d.ts` | `src/config.ts` | `String(Config) === String(Config gốc)` — **so nguyên chuỗi schema**, gồm cả `role("credential-ref")` + `.default("DEEPSEEK_API_KEY")` + `.volatile()` |
| `plainOptions` | `lib/index.js` dòng 15–20 | `src/config.ts` | A/B trên cùng cấu hình: bằng nhau **từng trường** (19 trường), `apiKeyEnv` lấy giá trị SỐNG |
| `resolveAdapterOptions` | `lib/index.js` dòng 26–31 | `src/config.ts` | A/B trên cùng cấu hình + cùng môi trường: bằng nhau **từng trường**; `apiKeyEnv` ĐÃ ĐÓNG DẤU; thiếu `apiKeyEnv` ⇒ `DEEPSEEK_API_KEY` |
| `name` · `inject` | `lib/index.js` dòng 34–35 | `src/index.ts` | so chuỗi + mảng với bản gốc |
| `apply` — đăng ký provider cấu hình được | `lib/index.js` dòng 52–57 | `src/index.ts` | A/B trên hai giàn giống hệt: `{provider, displayName, settingsNs, settingsPath}` bằng nhau; `settingsNs` = **id ROW đang nạp**, không có entry ⇒ `"llm-deepseek-api-key"` |
| `apply` — trao adapter | `lib/index.js` dòng 58–72 | `src/index.ts` | A/B: adapter đăng ký cho `["deepseek-official"]`, `providerName`, **tập khoá của `dependencies` bằng nhau (11 khoá)**, hiệu ứng `settings.configure({auto:false})`, listener `loader/volatile-update` |
| `resolveApiKey` | `lib/index.js` dòng 40–51 | `src/index.ts` | **6 ca** A/B: credentials HIT · credentials TRƯỢT (KHÔNG rơi sang môi trường) · không có seam ⇒ môi trường · biến môi trường RỖNG ⇒ thiếu · khoá rỗng/toàn khoảng trắng ⇒ `INVALID_CREDENTIAL` · ký tự không đi được trong header ⇒ `INVALID_CREDENTIAL` |
| `discoverModels` | `lib/index.js` dòng 62–71 | `src/index.ts` | **3 ca** A/B: có khoá ⇒ danh mục đầy đủ (`catalogModelInfo`) · thiếu khoá ⇒ `[]` **không ném** · khoá hỏng ⇒ **NÉM lại** (chỉ `MISSING_CREDENTIAL` được nuốt) |
| `credentialRef` thay cho tên biến thô | `lib/index.js` dòng 29 | `src/config.ts` | dùng **chính hàm của kernel** — không chép lại grammar, nên tham chiếu sai vẫn ném y bản gốc |
| `LlmError` · `assertUsableApiKey` | `@deepseek-ai/dsh-llm/lib/index.js` dòng 1659–1663 | `src/index.ts` | **ca danh tính**: lớp `LlmError` mà ta import **LÀ** lớp của kernel (`toBe`), nên `instanceof` ở mọi gói khác vẫn đúng |
| tập export lúc chạy | `export { Config, apply, inject, name, plainOptions, resolveAdapterOptions }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export bằng **đúng** tập gốc, **không** `default` |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum`/`sha256` hai bên khớp (luật 000e) |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/dsh-llm` | `LlmError` (lớp lỗi mà mọi tầng route theo `code`) + `assertUsableApiKey` + kiểu service `llm` (`ctx.llm`) | **bắt buộc là CÙNG thể hiện**: `discoverModels` nuốt lỗi bằng `instanceof LlmError` ⇒ bản sao lớp sẽ làm ca "thiếu khoá ⇒ `[]`" **ngừng hoạt động** mà không cổng nào thấy. Có ca test đo danh tính |
| `@deepseek-ai/dsh-llm-deepseek` | `deepSeekConfigFields` (schema) · `plainOptions`/`resolveAdapterOptions` (phân giải giao thức) · `catalogModelInfo` · **`registerDeepSeekProvider`** (đăng ký adapter) | Chính gói adapter đang chạy trong kernel. **Không viết lại** nó: bản gốc cũng chỉ **uỷ thác**, và một bản sao adapter sẽ là **thể hiện thứ hai** của cùng một route |
| `@deepseek-ai/dsh-launch-environment` | `launchEnvironmentOf(ctx)` — đọc `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY` từ các lớp môi trường đã chụp lúc khởi động | Bản gốc cũng là peer; dùng đúng cách ("một biến môi trường có sẵn trong phiên KHÔNG phải cấu hình của app") |
| `@deepseek-ai/dsh-credentials` | `credentialRef` (đóng dấu tham chiếu) + kiểu service `credentials` (`ctx.get("credentials")`) | Phân giải khoá **theo từng request** — đổi khoá không cần restart |
| `@deepseek-ai/cordis` | kiểu `Context`/`Volatile` + `ctx.fiber`·`ctx.inject`·`ctx.on` | bảng §3b; **chỉ mượn kiểu**, không import lúc chạy |
| `@deepseek-ai/schemastery` | schema `Config` để Settings/config-editor render được field | bảng §3b. Bản gốc để ở `dependencies`; ta để **peer** (một thể hiện do kernel cấp) — **khác hình dạng CÓ Ý**, ghi ở §5 |

### Bốn peer NGOÀI bảng §3b — lý do ĐO ĐƯỢC (đề nghị Lead xác nhận)

`dsh-llm` · `dsh-llm-deepseek` · `dsh-launch-environment` · `dsh-credentials`. Cả bốn **không thể**
là bản sao: `LlmError` phải **cùng lớp** thì `instanceof` trong `discoverModels` mới đúng (bản sao ⇒
ca "thiếu khoá ⇒ `[]`" **ngừng chạy mà 0 lỗi console**); `registerDeepSeekProvider` phải là **chính
adapter của kernel** (bản sao ⇒ hai thể hiện của cùng route); `credentialRef` phải **cùng grammar**;
`launchEnvironmentOf` phải đọc **cùng** ảnh chụp môi trường. `dsh-llm` đã được Lead duyệt làm ngoại lệ
ở commit `3d3f097` (*"dsh-tools và dsh-llm vì cần instanceof/Branded của kernel"*, tiền lệ
`user-questions`/`workflow`).

**Đã đo trên dump mới nhất**: `@deepseek-ai/dsh-llm-deepseek`, `dsh-launch-environment`,
`dsh-credentials` **KHÔNG phải row nào** (0 dòng trong `ours.yml`) ⇒ không có nguy cơ bị thay ⇒ một
thể hiện là **chắc chắn**. Riêng `@deepseek-ai/dsh-llm` **có** một row (`llm`): khi row đó được viết
lại, gói mới **PHẢI** giữ **cùng lớp** `LlmError` (hoặc `gbh.row.aliases` trỏ về cùng module), nếu
không mọi consumer dùng `instanceof` — kể cả gói này — sẽ hỏng **âm thầm**.

**`gbh.peers` ⊆ `peerDependencies`** (luật M6 §1d): 6/6 tên, so **PHẦN TỬ** chứ không so số lượng —
có **đối chứng âm** (thiếu một tên ⇒ phép kiểm PHẢI đỏ, kể cả khi hai danh sách **cùng độ dài**).
`mount.ts` chỉ symlink peer **đã khai** (`@deepseek-ai/cordis` + `@deepseek-ai/schemastery` luôn được
thêm sẵn), nên thiếu một tên ở đây là `Cannot find module` lúc boot.

### Vì sao KHÔNG khai `@deepseek-ai/cordis-plugin-loader` (bản gốc có, dạng optional)

Bản gốc dùng nó để có **kiểu** của `ctx.fiber.entry?.options.id` (`Fiber` được loader augment thêm
`entry`). Ta đọc đúng trường đó qua **một ép kiểu hẹp tại chỗ** (`entryIdOf`) và ghi rõ hình dạng
thật trong `src/index.ts` — đúng khuôn "khai lại theo CẤU TRÚC, KHÔNG import" mà `llm-retry` đã dùng,
và **không** thêm một peer chỉ để lấy kiểu.

## 3. Bảng TRƯỚC/SAU

Gói **chưa được mount** (chưa khai `gbh.row`), nên "SAU" dưới đây là phép đo **trên artifact** và
**trên hai giàn A/B**, không phải trên app 5439. Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/llm-deepseek
bun run build.ts                              # ⇒ lib/index.js
grep -c 'id: @deepseek-ai' lib/index.js       # ⇒ 0   (không có id module nào của gói gốc)
bun run build.ts /tmp/gbh-llm-deepseek-out    # ⇒ build theo process.argv[2]
cd ../../.. && bun test tests/host/llm-deepseek.test.ts
```

| Phép đo | Bản gốc (`@deepseek-ai/dsh-llm-deepseek-api-key`) | Bản của ta | Kết luận |
|---|---|---|---|
| Tập export lúc chạy (trên artifact) | `Config · apply · inject · name · plainOptions · resolveAdapterOptions` | **y hệt**, không `default` | BẰNG |
| `name` · `inject` | `"llm-deepseek-api-key"` · `["llm"]` | **y hệt** | BẰNG |
| `String(Config)` | chuỗi schema 19 trường | **y hệt từng ký tự** | BẰNG |
| `plainOptions(config)` | 19 trường, `apiKeyEnv` sống | **y hệt** | BẰNG |
| `resolveAdapterOptions(...)` | endpoint + giao thức + `apiKeyEnv` đóng dấu | **y hệt từng trường** | BẰNG |
| Mục provider cấu hình được | `deepseek-official` / `DeepSeek` / `settingsNs` = id row / `[]` | **y hệt** | BẰNG |
| Khoá `dependencies` trao adapter (11 khoá) | `options`·`resolveAuth`·`discoverModels`·`providerName` + 7 khoá adapter tự thêm | **y hệt** | BẰNG |
| `resolveAuth` 6 ca (hit · trượt · ambient · rỗng · blank · ký tự lạ) | mã + **nguyên văn thông điệp** | **y hệt từng ca** | BẰNG |
| `discoverModels` 3 ca (ok · thiếu khoá ⇒ `[]` · khoá hỏng ⇒ ném) | đúng vậy | **y hệt** | BẰNG |
| Cấu hình sai lúc nạp | ném ngay, **chưa đăng ký gì** | **y hệt** (cùng thông điệp) | BẰNG |
| Vật thể cấu hình (C6) | ảnh chụp **mới** mỗi lượt; sửa một không lan sang cái kia | **y hệt** (đo bằng danh tính) | BẰNG |
| Số file nguồn · số dòng nguồn | 1 file build 75 dòng | **2 file · 184 dòng** (mọi export có mô tả) | KHÁC HÌNH DẠNG CÓ Ý |
| `lib/index.js` (bản build) | — | **87 dòng** | — |
| id module của gói gốc trong bundle | 0 (row host-only) | **0** | BẰNG |

## 4. Test — 24 ca / 89 expect (0 fail)

- **Bề mặt (đo trên ARTIFACT)**: tập export **BẰNG ĐÚNG** tập gốc (đúng hai regex của `check:rows`) ·
  `grep` chuỗi `id: @deepseek-ai` trong bundle = **0** · `name`/`inject` · `String(Config)`.
- **Hành vi — A/B TRỰC TIẾP với chính bundle gốc**: mỗi ca dựng **hai giàn giống hệt nhau**, gọi
  `apply` của **cả hai** bản cài, rồi so `{ provider đã đăng ký, route của adapter, dependencies,
  hiệu ứng settings, listener }`; các ca khoá so **mã lỗi + nguyên văn thông điệp + quan hệ
  `instanceof LlmError` của kernel**.
- **Đường lỗi**: cấu hình sai ⇒ ném **trước mọi đăng ký** (fail loud) · thiếu khoá ⇒
  `MISSING_CREDENTIAL` · khoá rỗng/ký tự lạ ⇒ `INVALID_CREDENTIAL` · **không treo** ở mọi nhánh
  (mọi ca đều `await` và kết thúc).
- **C6 — vật thể cấu hình ĐỘC LẬP**: hai lần cài ⇒ hai mục provider **khác danh tính**, `settingsPath`
  khác danh tính, sửa một **không** lan sang cái kia; hai lượt `options()` ⇒ object/mảng/phần tử
  **mới**, sửa phần tử của lượt trước **không** rò sang lượt sau (và **bản gốc đo được y hệt**).
- **Metadata**: `gbh.peers` ⊆ `peerDependencies` so **phần tử**, kèm **đối chứng âm** (thiếu tên ⇒
  đỏ; cùng số lượng nhưng lệch phần tử ⇒ vẫn đỏ) · **test canh** `gbh.row` chưa khai · locale
  **byte-for-byte**.

> **Không có ca "an ninh" và không có ca BYTE**: row này **không** phục vụ route HTTP nào và **không**
> đọc thân phản hồi — nó chỉ trao ba hàm cho adapter của kernel. Mục 3.2/3.4 của recipe
> (*"ca byte"*, *"không cookie ⇒ 401"*) **không áp dụng**; nói rõ ở đây để người sau không tưởng đã bỏ sót.

## 5. Khác biệt CÓ Ý và phần CHƯA làm

1. **`schemastery` nằm ở `peerDependencies`** (bản gốc: `dependencies`). Lý do: một thể hiện do
   kernel cấp, đúng quy ước các gói host khác của repo; `mount.ts` vốn đã luôn symlink peer này.
2. **Không khai `@deepseek-ai/cordis-plugin-loader`** (bản gốc khai optional): chỉ dùng để lấy **kiểu**
   của `ctx.fiber.entry` — ta đọc trường đó qua một ép kiểu hẹp, hành vi **không đổi**.
3. **`settingsNs` phụ thuộc id ROW của lượt mount.** Patch sinh row mới với id `llm-deepseek-ours`
   ⇒ không gian tên cấu hình của provider thành `llm-deepseek-ours` (bản gốc khi mount cũng vậy — nó
   đọc **id entry**, không hard-code). Hệ quả cần biết **trước khi** bật row: cấu hình đã lưu dưới
   `llm-deepseek` **không** được đọc lại. Row đang **bị tắt** trong sản phẩm nên hiện chưa ảnh hưởng.
4. **Chưa khai `gbh.row`** — theo chỉ đạo của Lead. Hệ quả: `bh host` **không** mount gói này, và
   `check:rows` **không** kiểm nó. Muốn mount: khai `gbh.row: { id: "llm-deepseek", inject: ["llm"],
   tests: ["tests/host/llm-deepseek.test.ts"] }` **sau** khi Lead đồng ý bật lại route chính thức.
5. **Chưa đo trên app 5439**: chưa có `lab:row` · `check:app` · A/B pixel cho row này. Chúng chỉ có
   nghĩa sau lượt boot của Lead — và row này **không vẽ gì lên màn hình** (row host).
6. **Chưa có entry `./types`**: bản gốc ship `lib/types/*.d.ts`; ta build **một file** theo khuôn của
   repo và không phát `.d.ts`. Khác hình dạng **có ý**.
7. **Chưa đối chứng ở tầng request thật** (một lượt `stream` do `dsh-llm` gọi adapter). Ca A/B hiện
   gọi thẳng `dependencies.resolveAuth`/`discoverModels` — **đúng phần row này sở hữu**, nhưng
   **không phải** A/B trên app thật.
