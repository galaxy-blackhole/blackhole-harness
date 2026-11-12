<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-llm-deepseek-account — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-llm-deepseek-account

Bản viết lại của Galaxy Blackhole cho row **`llm-deepseek-account`** của DSH
(`@deepseek-ai/dsh-llm-deepseek-account`, bundle MỘT FILE **545 dòng** `lib/index.js` + 5 tệp
`lib/types/*.d.ts`, đọc từ `apps/host/node_modules/@deepseek-ai/dsh-llm-deepseek-account/` — CHỈ ĐỌC).

**Vai trò**: **tài khoản DeepSeek cho LLM**. Row khai route `deepseek-account` là provider **cấu hình
được** (để màn Models của web hiển thị/chẩn đoán), trao cho adapter DeepSeek của kernel bốn thứ:
ảnh chụp cấu hình **mới cho mỗi thao tác**, hàm phân giải **token tài khoản theo từng request**
(qua service `deepseekAccount`, KHÔNG có khoá API dự phòng), hàm nạp **danh mục từ `GET /models`
của tài khoản** (đệm theo credential + làm mới nền), và hàm **chặn model** trước I/O theo cổng
phiên bản client.

> ⚠️ **Row MỘT MẶT** — đã kiểm `lib/client.js` **KHÔNG tồn tại** (chỉ `lib/index.js` + `lib/types/`),
> và `package.json` gốc **KHÔNG** có khoá `dsh`/`dsh.client` (câu hỏi thứ 5: **không**).
> ⇒ disable+insert không làm mất nửa client nào.

> ⚠️ **`gbh.row` do LEAD khai NGOÀI phiên viết gói** (mtime `10:52` ngày 18/10/2026:
> `id: llm-deepseek-account` + `tests`, **không** `config`/`inject`/`moduleIds`/`aliases` — khớp
> đúng row trần của dump; patch đã sinh cặp disable+insert `llm-deepseek-account-ours`). Gói **không
> tự khai** và **không ghi đè** `package.json` (bài học race `bd9fbea`); test canh **HAI CHIỀU** khẳng
> định: vắng = trạng thái an toàn, có thì phải đúng id + tests và **cấm** `moduleIds`/`aliases`/`config`.

> ⚠️ **Row này ĐANG BẬT trong sản phẩm** (không `disabled` trong cả ba dump) — nên khi mount, row
> stock bị tắt và route `deepseek-account` do gói này phục vụ. Đó là lý do mọi ca test đối chứng
> **trực tiếp với chính bundle gốc** thay vì chỉ so giá trị kỳ vọng.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `Config` (schemastery) | `lib/index.js` dòng 253–267 · `lib/types/config.d.ts` | `src/config.ts` | `String(Config) === String(Config gốc)` — **so nguyên chuỗi schema** (1.140 ký tự), gồm ba trường danh mục volatile + `modelOverrides`; `models` **KHÔNG** có mặt |
| `plainAccountOptions` | dòng 268–275 | `src/config.ts` | `isVolatile` của kernel ⇒ giá trị SỐNG; trường thường đi nguyên; **schema điền `inputModalities: []` ⇒ bước phân giải mới bỏ** |
| `resolveAccountOptions` + `resolveOverride` | dòng 276–322 | `src/config.ts` | endpoint `/models` **cùng origin**; 8 **thông điệp lỗi nguyên văn** A/B qua `apply` (models bị cấm · timeout 0 · timeout > MAX · maxAge âm · maxAge lẻ · khoá rỗng · mục tự đặt `id` · trường hỏng) |
| `parseModelListing` | dòng 11–104 | `src/listing.ts` | lọc modalities theo **thứ tự danh sách**, `skipped`, requirement, capabilities; 3 thân hỏng ⇒ `INVALID_RESPONSE` (cùng câu) |
| `requestModelListing` | dòng 105–143 | `src/listing.ts` | **A/B qua seam**: 500 · JSON hỏng · thiếu `data` · chuyển hướng (`redirect: "error"`) · hết hạn ⇒ **cùng cảnh báo**, không treo; header `x-dsh-auth-token` + `accept` + `user-agent` |
| `AccountModelCatalog` | dòng 146–250 | `src/catalog.ts` | **A/B qua seam**: lượt đầu CHỜ nạp (1 request) · lượt sau KHÔNG xin lại · quá tuổi ⇒ làm mới NỀN · hỏng ⇒ GIỮ danh sách cũ + cảnh báo **một lần** · đổi token ⇒ phạm vi mới · dispose huỷ lượt đang chạy |
| `resolveAccountCatalog` (layered/listed/gateOf) | dòng 325–425 | `src/resolve-catalog.ts` | **A/B qua seam** (offered/resolution/refusals/problems/overrideErrors) + ca đơn vị; cổng `min_version` bằng **chính `semver`** |
| `name` · `inject` | dòng 428–429 | `src/index.ts` | so chuỗi + mảng với bản gốc |
| `apply` — provider + adapter | dòng 444–539 | `src/index.ts` | A/B trên hai giàn giống hệt: mục provider (`deepseek-account`/`DeepSeek Account`/`settingsNs` = **id ROW**), route của adapter, `injects`, hiệu ứng `settings.configure({auto:false})`, listener `loader/volatile-update`, **nhãn hiệu ứng**, **tập khoá `dependencies`** |
| `resolveAuth` + `onRequestError` | dòng 450–472 | `src/index.ts` | 6 ca A/B: chưa đăng nhập (và **không có service**) ⇒ `ACCOUNT_SIGN_IN_REQUIRED` · có token ⇒ header · `QUOTA` ⇒ `ACCOUNT_QUOTA` (giữ `cause`) · 401 ⇒ `ACCOUNT_TOKEN_INVALID` + `rejectToken` · 403 ⇒ **nguyên vật** · lỗi không phải `LlmError` ⇒ **nguyên vật** |
| `admit` (`refuse`) | dòng 435–443 | `src/index.ts` | A/B: `CLIENT_UPGRADE_REQUIRED` + `MODEL_UNSUPPORTED` **đúng mã + nguyên văn**; model không bị từ chối ⇒ không ném |
| `discoverModels` + `directory.replace` | dòng 515–538 | `src/index.ts` | A/B: chưa đăng nhập ⇒ `[]` · có token ⇒ `catalogModelInfo` · ghi đè hỏng ⇒ công bố `error` lên sổ provider **đúng một lần** |
| `LlmError` · `APP_IDENTITY` · hằng quota | `@deepseek-ai/dsh-llm` | `src/*` | **ca danh tính**: lớp `LlmError` mà ta import **LÀ** lớp của kernel (`toBe`) ⇒ `instanceof` ở adapter vẫn đúng |
| tập export lúc chạy | `export { Config, apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export bằng **đúng** tập gốc (**4 = 4**), **không** `default`; **nạp THẬT** cả hai artifact rồi so **phần tử** không gian tên |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — sha256 khớp (`b31b83f8…` · `3e054f45…`, luật 000e) |

## 2. Peer — vì sao, và thuộc bậc nào của §3b

| Peer | Bậc §3b | Vì sao KHÔNG thể là bản sao |
|---|---|---|
| `@deepseek-ai/cordis` | 1 | kiểu `Context`/`Volatile` + `ctx.fiber`·`ctx.effect`·`ctx.inject` |
| `@deepseek-ai/schemastery` | 1 | schema `Config` để Settings/config-editor render được field |
| `@deepseek-ai/dsh-llm` | 2 | `LlmError` phải **CÙNG LỚP**: `onRequestError` lọc bằng `instanceof`, `admit` ném lỗi mà tầng route đọc `code`; `APP_IDENTITY` là nguồn của `client_requirements` + câu thông điệp; hằng `QUOTA`/`ACCOUNT_QUOTA` |
| `@deepseek-ai/dsh-llm-deepseek` | 2 (tiền lệ `llm-deepseek`) | `deepSeekConfigFields`/`catalogModelFields` (cùng schema trường), `resolveAdapterOptions` (cùng bước kiểm), `catalogModelInfo`, và **`registerDeepSeekProvider`** — chính adapter của kernel; bản sao ⇒ **thể hiện thứ hai** của cùng route |
| `@deepseek-ai/dsh-launch-environment` | 2 (tiền lệ `llm-deepseek`) | `launchEnvironmentOf(ctx)` — phải đọc **cùng** ảnh chụp môi trường đã chụp lúc khởi động |
| `@deepseek-ai/dsh-timeout` | 2 | `deadline`/`timeoutOf`/`MAX_TIMER_DELAY_MS`: deadline danh sách phải **cùng `TimeoutReason`** thì `timeoutOf(signal, LISTING_TIMEOUT)` mới nhận đúng ⇒ nếu không, ca "hết hạn" biến thành `TRANSPORT` **âm thầm** |
| `@deepseek-ai/cosmokit` | 3 (thư viện) | `isVolatile` — **protocol chia sẻ** qua `Symbol.for("cosmokit.volatile.write")`; tự chế phép dò là **sai** với schema do kernel parse |
| `semver` | 3 (thư viện) | cổng `min_version` phải **đúng thứ tự semver** kể cả prerelease (`0.2.1` từ chối `0.2.1-alpha.2`); tự viết lại là rủi ro lệch âm thầm |

### Ba peer ngoài bảng §3b — lý do ĐO ĐƯỢC (đề nghị Lead xác nhận)

`cosmokit` · `semver` (Bậc 3, thư viện npm thật) và `dsh-llm-deepseek`/`dsh-launch-environment`
đã có **tiền lệ** trong `packages/host/llm-deepseek` (gói host ĐANG mount được, cùng Lead duyệt).
Bằng chứng **đo được** cho hai thư viện: (a) `isVolatile` dò bằng **symbol toàn cục** — bản địa
phương `typeof v.get === "function"` sẽ coi **mọi object có `get`** là tham chiếu; (b) `semver`
quyết định `upgrade-required` với **cùng grammar** như server đã dùng để khai `min_version` —
một bản rút gọn sẽ lệch ở prerelease/build-metadata mà **không cổng nào thấy**.

**Không khai** `@deepseek-ai/dsh-deepseek-account` (bản gốc khai optional): row này chỉ **gọi service**
`ctx.get("deepseekAccount")` theo **CẤU TRÚC** (hai chữ ký `resolveToken`/`rejectToken` khai tại chỗ),
không `import` gói tài khoản — chính row đó cũng đang được viết lại. Hệ quả: **không** thêm một peer
chỉ để lấy kiểu, và không buộc kernel cấp thêm một thể hiện.

**Không khai** `@deepseek-ai/cordis-plugin-loader` (bản gốc optional): chỉ dùng để có **kiểu** của
`ctx.fiber.entry?.options.id`; ta đọc đúng trường đó qua **một ép kiểu hẹp tại chỗ** (`entryIdOf`).

**`semver` nạp qua `createRequire`** (không `import` trần): kernel **KHÔNG ship `@types/semver`**, và
một `.d.ts` ambient `declare module "semver"` bị **luật 000d cấm** (nó đè kiểu của mọi gói khác).

**`gbh.peers` ⊆ `peerDependencies`** (luật M6 §1d): **8/8 tên**, so **PHẦN TỬ** chứ không so số lượng —
có **3 đối chứng âm** (thiếu một tên · cùng độ dài nhưng lệch phần tử · bỏ `semver` khỏi manifest THẬT
⇒ phép kiểm PHẢI đỏ). `mount.ts` chỉ symlink peer **đã khai** (`cordis` + `schemastery` luôn thêm sẵn)
và **chặn mount** nếu peer vắng trong kernel — nên thiếu một tên ở đây là `Cannot find module` lúc boot.

## 3. Bảng TRƯỚC/SAU

"SAU" dưới đây là phép đo **trên artifact** và **trên hai giàn A/B** (gói chưa được mount trong phiên
viết). Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/llm-deepseek-account
bun run build.ts                              # ⇒ lib/index.js (563 dòng)
grep -c 'id: @deepseek-ai' lib/index.js       # ⇒ 0
bun run build.ts /tmp/gbh-llm-deepseek-account-out   # ⇒ build theo process.argv[2]
cd ../../.. && bun test tests/host/llm-deepseek-account.test.ts   # ⇒ 23 pass / 0 fail
bun run check:rows                            # ⇒ 114 package có gbh.row, TẤT CẢ đạt, 0 dòng chan
bun run gate --no-tests                       # ⇒ 7/7 XANH
```

| Phép đo | Bản gốc (`@deepseek-ai/dsh-llm-deepseek-account`) | Bản của ta | Kết luận |
|---|---|---|---|
| Tập export lúc chạy (artifact) | `Config · apply · inject · name` | **y hệt**, không `default` (**4 = 4**) | BẰNG |
| `name` · `inject` | `"llm-deepseek-account"` · `["llm"]` | **y hệt** | BẰNG |
| `String(Config)` | chuỗi schema 1.140 ký tự | **y hệt từng ký tự** | BẰNG |
| `plainAccountOptions` | trường volatile lấy giá trị sống | **y hệt** | BẰNG |
| `resolveAccountOptions` | endpoint `/models` cùng origin + ghi đè đã lọc | **y hệt từng trường** | BẰNG |
| 8 cấu hình sai lúc nạp | ném **trước mọi đăng ký** | **y hệt nguyên văn** | BẰNG |
| Mục provider cấu hình được | `deepseek-account` / `DeepSeek Account` / `settingsNs` = id row / `[]` | **y hệt** | BẰNG |
| Khoá `dependencies` tra adapter | `options · connect · resolveAuth · admit · discoverModels · providerName` + khoá adapter tự thêm | **y hệt tập khoá** | BẰNG |
| `connect` với danh sách thật | offered/resolution/refusals/problems | **y hệt** (so `snapshotOf`) | BẰNG |
| `resolveAuth`/`onRequestError` 6 ca | mã + nguyên văn + `rejectToken` | **y hệt từng ca** | BẰNG |
| `admit` 3 ca | `CLIENT_UPGRADE_REQUIRED` · `MODEL_UNSUPPORTED` · đi qua | **y hệt** | BẰNG |
| `discoverModels` + chẩn đoán ghi đè | `[]` khi chưa đăng nhập; `error` công bố **một lần** | **y hệt** | BẰNG |
| Tầng vận chuyển danh sách (5 ca) | lượt hỏng bị **nuốt** + cảnh báo | **y hệt** | BẰNG |
| Đệm danh sách (4 ca) | chờ lần đầu · nền khi quá tuổi · giữ khi hỏng · phạm vi theo token | **y hệt** | BẰNG |
| Dọn `effect` | huỷ lượt đang chạy, sau đó **0 I/O** | **y hệt** | BẰNG |
| Vật thể cấu hình (C6) | ảnh chụp **mới** mỗi lượt | **y hệt** (đo bằng danh tính) | BẰNG |
| Số file nguồn · số dòng | 1 file build 545 dòng + 5 `.d.ts` | **5 file nguồn · 1.101 dòng** (`src/index.ts` 260 · `src/listing.ts` 232 · `src/resolve-catalog.ts` 219 · `src/catalog.ts` 201 · `src/config.ts` 189) + `build.ts` 36 | KHÁC HÌNH DẠNG CÓ Ý |
| `lib/index.js` | 545 dòng | **563 dòng** | — |
| id module của gói gốc trong bundle | 0 (row host-only) | **0** | BẰNG |

## 4. Test — 23 ca / 227 expect (0 fail)

- **Bề mặt (đo trên ARTIFACT)**: tập export **BẰNG ĐÚNG** tập gốc · `grep "id: @deepseek-ai"` = **0** ·
  **nạp THẬT** hai artifact rồi so **phần tử** không gian tên · `name`/`inject` · `String(Config)` ·
  `plainAccountOptions`/`resolveAccountOptions` · `parseModelListing` · `resolveAccountCatalog`.
- **Hành vi — A/B TRỰC TIẾP với chính bundle gốc**: mỗi ca dựng **hai giàn giống hệt nhau** + **cùng một
  server `/models` cục bộ**, gọi `apply` của **cả hai** bản cài, rồi so mục provider · route · `injects` ·
  hiệu ứng settings · listener · nhãn hiệu ứng · **tập khoá `dependencies`** · kết quả `connect()` ·
  `resolveAuth`/`onRequestError` · `admit` · `discoverModels` · cảnh báo console.
- **Đường lỗi**: 8 cấu hình sai (ném trước mọi đăng ký) · 5 dạng hỏng của danh sách (500 · JSON ·
  thiếu `data` · chuyển hướng · hết hạn) · chưa đăng nhập · khoá bị từ chối · **không treo** ở mọi nhánh.
- **Ca flaky dùng `waitFor` CÓ TRẦN** (3.000 ms, hết trần thì **ném**): làm mới **nền** · cảnh báo
  **đúng một lần** cho chuỗi hỏng · `dispose` giữa lượt nạp.
- **C6 — vật thể ĐỘC LẬP** (`not.toBe`, không so sâu): hai lần cài ⇒ hai mục provider + `settingsPath`
  riêng, sửa một không lan; hai đệm danh sách ⇒ `catalog`/`models`/`refusals`/`offered` riêng;
  hai lượt `options()` ⇒ object + mảng **mới**, sửa lượt trước không rò lượt sau.
- **Metadata**: `gbh.peers` ⊆ `peerDependencies` so **phần tử** + **3 đối chứng âm** · **test canh HAI
  CHIỀU** cho `gbh.row` · locale **byte-for-byte** · `LlmError` của ta **LÀ** lớp kernel.

> **Không có ca "an ninh" và không có ca BYTE** theo nghĩa mục 3.2/3.4 của recipe: row này **không** phục
> vụ route HTTP nào (nó chỉ xin `/models` rồi trao ba hàm cho adapter) và **không** đọc thân phản hồi nhị
> phân. Nói rõ ở đây để người sau không tưởng đã bỏ sót.

## 5. Khác biệt CÓ Ý và phần CHƯA làm

1. **5 file nguồn** thay vì một bundle (bản gốc build một file từ 5 `//#region`). Nội dung đối chiếu
   theo từng vùng — xem bảng §1. Không chép code; hành vi đo bằng A/B.
2. **`cosmokit`/`semver`/`dsh-llm-deepseek`/`dsh-launch-environment` ở `peerDependencies`** (bản gốc để
   một phần ở `dependencies`): một thể hiện do kernel cấp, đúng quy ước các gói host khác của repo.
3. **Không khai `dsh-deepseek-account`** (bản gốc optional): seam khai theo **cấu trúc** — xem §2.
4. **`semver` nạp qua `createRequire`** thay vì `import` trần — vì kernel không có `@types/semver` và
   luật 000d cấm shim ambient.
5. **Chưa đo trên app 5439**: `lab:row` · `check:app` (5)(8)(9)(10)(11) · TRƯỚC/SAU trên app thật thuộc
   **lượt boot của Lead**. Row host **không vẽ gì lên màn hình** nên các chỉ số UI chỉ có nghĩa sau boot.
6. **Chưa có entry `./types`**: bản gốc ship `lib/types/*.d.ts`; ta build **một file** theo khuôn của
   repo và không phát `.d.ts`. Khác hình dạng **có ý**.
7. **Chưa đối chứng ở tầng request thật** (một lượt `stream` do `dsh-llm` gọi adapter): ca A/B hiện gọi
   thẳng `dependencies.connect/resolveAuth/admit/discoverModels` — **đúng phần row này sở hữu**, nhưng
   **không phải** A/B trên app thật.
8. **Chưa thử với tài khoản thật**: mọi ca dùng server `/models` cục bộ + token giả; nhánh `rejectToken`
   đo bằng seam giả, **không** chạm credential thật của người dùng.
