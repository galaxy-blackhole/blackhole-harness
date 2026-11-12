<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bản viết lại của Galaxy Blackhole cho gói nền @deepseek-ai/dsh-deepseek-account (row host M6): nguồn đối chiếu G4, peer, bảng TRƯỚC/SAU, và phần CHƯA làm
-->

# @galaxy-blackhole/gbh-deepseek-account

Bản viết lại **trung thành** của gói nền `@deepseek-ai/dsh-deepseek-account` (bản gốc: **88 dòng**
`lib/index.js` + 264 dòng `.d.ts`): định nghĩa Service `deepseekAccount`, bốn helper dựng danh tính
client Platform cho request tài khoản, và chính sách huỷ việc đang chạy khi tài khoản đăng xuất.

> ⚠️ **GÓI NÀY KHÔNG PHẢI MỘT ROW.** Trong cây đang chạy, id row `deepseek-account` trỏ tới
> `@deepseek-ai/dsh-deepseek-account-platform` (**1.145 dòng**, xem `docs/PARITY-MATRIX.md` dòng 24), còn
> `@deepseek-ai/dsh-deepseek-account` là **thư viện nền** mà **9 gói khác khai phụ thuộc** (đo trên
> `apps/host/node_modules`: 4 gói ở `peerDependencies` — `dsh-deepseek-account-platform` ·
> `dsh-api-account-controller` · `dsh-llm-deepseek-account` · `dsh-web-search-deepseek`; 5 gói còn lại chỉ ở
> `devDependencies` cho kiểu: `dsh-api-remotes` · `dsh-client-product-analytics` ·
> `dsh-client-ui-settings-account` · `dsh-experimental-translator` · `dsh-llm-deepseek`). **Hai gói import nó
> lúc chạy**: `dsh-deepseek-account-platform` (`DeepSeekAccount` · `installAccountTaskCancellation` ·
> `mergePlatformCookies` · `platformClientHeaders` · `platformWireLocale`) và `dsh-api-account-controller`
> (`isRunningAccountTask`). Vì vậy gói này **CHƯA khai `gbh.row`**: khai `gbh.row.id = "deepseek-account"`
> sẽ tắt row `dsh-deepseek-account-platform` và **mất toàn bộ bề mặt PKCE** — đúng lớp lỗi "thay row ⇒ mất nửa
> kia" của `HOST-ROW-REWRITE.md` §0 câu 5. Việc mount thật thuộc về gói
> `@galaxy-blackhole/gbh-deepseek-account-platform` (chưa viết).

## 0. Năm câu hỏi bắt buộc (mục 0 của recipe)

| # | Câu hỏi | Trả lời (đo được) |
|---|---|---|
| 1 | Row này có **đang BẬT** không? | **Không có row riêng.** `deepseek-account` trong `stock.yml` trỏ tới `@deepseek-ai/dsh-deepseek-account-platform` và đang bật; `dsh-deepseek-account` **không xuất hiện** trong cây plugin (`grep -c dsh-deepseek-account .parity/dumps/*/stock.yml` = **0**), nó chỉ có mặt trong danh sách *package gốc không phải row* (`PARITY-MATRIX.md` §"Nguồn và quy tắc đếm"). |
| 2 | Thuần host hay có mount surface client? | **Thuần host.** Không có `loader.create/resolve`, không `__ModuleLoader__`, không `lib/client.js`. Artifact của ta: `__ModuleLoader__` = **0** lần. |
| 3 | Cần **seam** nào? | `extends Service` (`@deepseek-ai/cordis`) · `LlmError` (`@deepseek-ai/dsh-llm`) · ba kiểu `Branded` (`@deepseek-ai/dsh-brand`, **chỉ kiểu**). Không `node:` builtin nào. ⇒ nằm trong bảng §3b + nhóm peer đã cấp phép. |
| 4 | Hành vi đo được là gì? | Bốn hàm **thuần** (Cookie/header/locale) + hai hàm chính sách (nhận diện việc đi tuyến tài khoản · huỷ khi `deepseek-account/signed-out` · phát `deepseek-account/model-sign-in-required`) + định nghĩa Service tên `deepseekAccount`. Tất cả đo bằng A/B với chính bundle gốc. |
| 5 | Gói gốc có `dsh.client` không? | **KHÔNG** (`package.json` gốc không có khoá `dsh`). ⇒ một mặt; nếu sau này có row cho nó thì disable+insert không làm mất nửa client nào. |

## 1. Nguồn đối chiếu (G4)

| Phần của ta | Nguồn gốc (CHỈ ĐỌC) | Cách đối chiếu |
|---|---|---|
| `src/service.ts` (`DeepSeekAccount`, `PlatformSession`) | `lib/types/index.d.ts` dòng 18–120 + `lib/index.js` dòng 30–38 | `default === named`; **cùng lớp cha cordis** (`Object.getPrototypeOf`); `Object.getOwnPropertyNames(prototype)` bằng nhau; khởi tạo ⇒ cùng tên `deepseekAccount` |
| `src/types.ts` (13 kiểu + 2 sự kiện) | `lib/types/types.d.ts` (102 dòng) | chép **ngữ nghĩa + javadoc**, không chép mã; hai sự kiện `session-expired` · `model-sign-in-required` khai đúng dạng `@mode emit` |
| `src/account-tasks.ts` (`isRunningAccountTask`, `installAccountTaskCancellation`) | `lib/types/account-tasks.js` (30 dòng) | 5 hình dạng agent + 2 nhánh `agent/error` + nhánh `signed-out` (4 agent) chạy **cả hai bên**, so dấu vết `{inject, listeners, emitted, cancelled}` |
| `src/headers.ts` (4 hàm thuần) | `lib/index.js` dòng 39–86 + `lib/types/index.js` | 8 ca Cookie · 10 locale · 3 nền tảng · 3 tổ hợp header, so **từng giá trị** và **thứ tự khoá** |
| `src/index.ts` (barrel) | dòng export cuối của `lib/index.js` | tập export đo trên **ARTIFACT**: **8 = 8**, 0 thiếu · 0 thừa |

## 2. Peer — và vì sao `gbh.peers` là TẬP CON

`peerDependencies` khai **đúng bốn tên như bản gốc** (kernel cấp MỘT thể hiện):

| peer | vì sao | có trong `gbh.peers`? |
|---|---|---|
| `@deepseek-ai/cordis` | `Service` là **lớp cha thật** — bản sao sẽ làm lệch `instanceof` | **có** |
| `@deepseek-ai/dsh-llm` | `LlmError` phải là **cùng một lớp**: chính sách dùng `instanceof`, lớp khác ⇒ không bao giờ phát hướng dẫn đăng nhập | **có** |
| `@deepseek-ai/dsh-brand` | `Branded<…>` — **chỉ kiểu**, bị xoá lúc build | không |
| `@deepseek-ai/dsh-agent` | bản gốc khai `optional`; ta khai hình dạng agent **theo cấu trúc** (như `llm-retry`) nên không cần thể hiện lúc chạy | không |

`gbh.peers = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm"]` ⇒ **⊆** `peerDependencies`, so **PHẦN TỬ**
(không so số lượng). Đối chứng:

- **Đối chứng DƯƠNG**: 5/6 gói host đang chạy (`account-controller` · `directory-picker-auto` ·
  `open-in-app` · `plugin-inventory` · `webserver`) có hiệu = **rỗng**; `settings-controller` lệch **1 tên**
  `dsh-typert-protocol` — ngoại lệ đã ghi ở `M6-MOUNT-PLAN.md` §1d và test của ta khẳng định đúng ngoại lệ đó.
- **Đối chứng ÂM**: thêm một peer không có trong `peerDependencies` ⇒ phép kiểm **PHẢI** trả về đúng tên đó;
  và ca *"2 peer · 2 peerDeps nhưng lệch phần tử"* vẫn ĐỎ — chứng minh phép kiểm không rỗng nghĩa.

## 3. Bề mặt export — đo trên ARTIFACT

```bash
~/.bun/bin/bun run build.ts            # hoặc: bun run build.ts <outDir>  (nhận process.argv[2])
grep -c 'id: @deepseek-ai' lib/index.js   # = 0
```

Tập export (8 tên, **bằng đúng** bản gốc):
`DeepSeekAccount` · `default` (= chính lớp đó) · `desktopClientHeaders` · `installAccountTaskCancellation` ·
`isRunningAccountTask` · `mergePlatformCookies` · `platformClientHeaders` · `platformWireLocale`.

## 4. Test — 17 ca / 81 expect / 0 fail

```bash
~/.bun/bin/bun test tests/host/deepseek-account.test.ts
```

| Nhóm | Ca | Đối chứng |
|---|---|---|
| Helper thuần | 4 | **A/B từng giá trị** với chính bundle gốc + giá trị tuyệt đối (Cookie `a=1; b=3; c=4` · `zh_CN`/`en_US` · header 5/6 khoá **kể cả thứ tự**) |
| Chính sách | 5 | A/B dấu vết `{inject, listeners, emitted, cancelled}`; ca **đường lỗi**: mã khác **hoặc** không phải `LlmError` ⇒ im lặng (giữ đúng `instanceof` của gốc, không "nới" thành so `code`) |
| Định nghĩa Service | 2 | cùng lớp cha cordis · prototype bằng nhau · khởi tạo đăng ký `deepseekAccount` |
| Bề mặt ARTIFACT | 2 | tập export **8 = 8**; `id: @deepseek-ai` = 0; `__ModuleLoader__` = 0; luật 000e (gốc không có `locale/`) |
| Metadata peer | 4 | `gbh.peers ⊆ peerDependencies` **so phần tử** + **đối chứng ÂM** + 6 gói đang chạy + **test canh** "chưa khai `gbh.row`" |

Hai nhóm ca của recipe **không áp dụng** và đây là lý do (không phải bỏ sót):
**ca BYTE** (row không có tầng vận chuyển, không đọc thân phản hồi) · **ca an ninh route** (không phục vụ
route/RPC nào). Nếu sau này gói platform dùng nó để dựng request, ca BYTE thuộc về **gói platform**.

## 5. Bảng TRƯỚC/SAU

**Chưa mount** (gói không khai `gbh.row`) ⇒ không có phép đo trên app 5439, và **không được** tự boot.
Trạng thái an toàn có **test canh**: `manifest.gbh.row === undefined`.

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| `check:rows` — số dòng `chan` | **0** | **0** (63 package, TẤT CẢ đạt; gói này không bị quét vì chưa khai `gbh.row`) |
| `gate --no-tests` | — | header · file-length · jsdoc · dep-guard · parity-matrix · hygiene **XANH**; typecheck: **0 vi phạm ở gói này**, còn đỏ vì `tests/host/subprocess.test.ts` (**gói khác**, không sửa) |
| `bun test tests/host/deepseek-account.test.ts` | — | **17 pass · 0 fail · 81 expect** |

## 6. Lệnh tái lập

```bash
cd galaxy-blackhole/blackhole-tauri
packages/host/deepseek-account $ ~/.bun/bin/bun run build.ts
~/.bun/bin/bun test tests/host/deepseek-account.test.ts
~/.bun/bin/bun run check:rows
~/.bun/bin/bun run tools/lint/gate.ts --no-tests
```

## 7. Phần CHƯA làm (điều kiện chặn mount, không phải ghi chú)

1. **Không khai `gbh.row`** — đúng yêu cầu của Lead cho row này, và vì gói gốc **không phải row**
   (xem cảnh báo đầu file). Muốn "thay row `deepseek-account`" thì phải viết
   `gbh-deepseek-account-platform` (1.145 dòng: PKCE, loopback callback, kho credential, RPC) — gói đó
   sẽ import **chính gói này**.
2. **Chưa có `lab:row` / mount / `check:app`** — thuộc lượt boot của Lead, và chỉ có nghĩa khi (1) xong.
3. **Không ship subpath `./types`** như bản gốc: ta chỉ phát một artifact JS (`.d.ts` của gói gốc là
   nguồn kiểu, không phải mã chạy). Hai consumer đã viết lại (`account-controller`, `product-analytics`)
   đọc `deepseekAccount` bằng **hình dạng cấu trúc**, không import kiểu của gói này.
4. **Không ship `locale/{en,zh}.json`** — luật 000e chỉ áp khi bản gốc có; bản gốc **không có** `locale/`
   (test khẳng định cả hai phía).

## 8. Vùng ghi

Chỉ `packages/host/deepseek-account/` (+ `node_modules/@deepseek-ai/{cordis,dsh-brand,dsh-llm}` là **symlink**
về kernel theo luật 000d, không phải bản sao), `tests/host/deepseek-account.test.ts`, và **một dòng** trong
`packages/README.md` §4.
