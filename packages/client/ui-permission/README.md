<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-permission cua DSH (M5, row hai mat, 10 seam, 2 be mat quyen).
-->

# @galaxy-blackhole/gbh-client-ui-permission-presets

Thay row `ui-permission` của DSH: **hai bề mặt quyền** — (1) hàng *Permission* trong **Settings → General**
chọn chế độ quyền **mặc định cho phiên mới**, và (2) **chip quyền trên composer** đổi chế độ cho **phiên hiện tại**;
cộng thêm (3) **popup `/permission`** do `command.decorate` gắn vào lệnh slash có sẵn.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-permission` (tier T3, đang BẬT) | `ui-permission-ours` → `@galaxy-blackhole/gbh-client-ui-permission-presets` |
| Package | `@deepseek-ai/dsh-client-ui-permission-presets` | `@galaxy-blackhole/gbh-client-ui-permission-presets` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-permission-presets/` (`lib/index.js` **11 dòng** · `lib/client.js` **831 dòng** (`row:cost` đếm 844) · `lib/types/client/*.d.ts` **7 file** · `locale/{en,zh}.json`) | `vendor/dsh-reference` chưa có gói này |
| Kích thước bản build | 842 dòng JS | `lib/index.js` **291 B** · `lib/client.js` **32.813 B** (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`) | có đủ hai nửa |
| `dsh.client.inject` | `api-session-controller` · `client-connection` · `client-locale` · `ui-commands` · `ui-conversation` · `api-remotes` · `ui-settings` (**7**) | **khai y hệt** ⇒ entry trong `__DSH_BOOT__` có đúng 7 mối nối |
| Seam của plugin | `["commandUi","connection","sessions","slots","locale","remote","remote.permissionPresets","remote.settings","configForms","settingsSchema"]` (**10**) | y hệt, đúng thứ tự |
| Id MODULE bản gốc đăng ký | **1** (`__ModuleLoader__.load({ id, factory })`) | **2**: id của ta (chính) + id stock (phụ, để bundle khác `require("@deepseek-ai/dsh-client-ui-permission-presets")` vẫn thấy), khai kèm `gbh.row.moduleIds` |
| Export nửa client | factory trả `{ inject, apply }` | y hệt; nửa host `apply()` rỗng như bản gốc |
| Specifier nửa browser `require` | `react/jsx-runtime` · `react` · `ui-primitives` · `dsh-client-store` (**4**, đúng thứ tự) | y hệt |
| Từ điển | 2 namespace: `settings.permission` (**12 khoá**) · `permission.access` (**17 khoá**), en + zh | y hệt **từng chuỗi** (chép từ bundle gốc, xem §6) |
| Meta hàng (tiêu đề trong Plugins) | `locale/en.json` + `locale/zh.json`, khoá `meta.title` | **2 file chép byte-for-byte** (shasum khớp) + export `"./locale/*.json"` |
| CSS | 2 module, tên lớp hash `oY77xG_*` (hàng) và `iWlSmW_*` (chip) | 2 file `.module.css` **nguyên văn** + `class-names.ts` giữ nguyên hash ⇒ DOM không lệch |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**. Giữ nguyên mọi định danh quan sát được: tên slot · `id` occupant `permission` · `order -20` · namespace · event `permission-presets/catalog-changed` · `command.dismiss("permission")` · đường dẫn ghi `["defaultPreset"]` · nhãn hiệu ứng · `data-plugin-css` |

### Hành vi phải giữ

**`apply(ctx)`** theo đúng thứ tự bản gốc: chèn 2 thẻ `<style>` → `locale.register("permission.access", …)` →
dựng **thư mục catalog dùng chung cho cả tiến trình** (nghe `permission-presets/catalog-changed` + `connection.generation`) →
`locale.register("settings.permission", …)` → dựng **bộ điều khiển hàng cài đặt** → `slots.inject("settings.general.item", …)` →
`slots.inject("conversation.input.permission", …)` → `command.decorate({ name: "permission", ui: { kind: "popupSelect" } })`.

**MỘT đường ghi duy nhất cho cả hai bề mặt phiên**: `submit(sessionId, preset)` chạy `/permission <preset>` qua
phiên đang sống rồi mới trả `true`; `result.ok === false` ⇒ ném `permission switch failed: <code>: <message>`;
`result.value.matched !== true` ⇒ ném `the host offers no /permission command`. Hàng cài đặt KHÔNG đi đường đó:
nó ghi `remote.settings.mutate("permission", [{ op: "set", path: ["defaultPreset"], value: preset }], revision)`
— **đúng một đường dẫn, kèm revision** của descriptor.

**Chốt theo thế hệ**: kết quả đọc catalog về muộn bị bỏ nếu `epoch`/`generationId` đã đổi hoặc thư mục đã `dispose`
(`accepts()`), nên đổi kết nối không bao giờ để lại catalog của thế hệ cũ; mỗi lần vô hiệu còn gọi
`command.dismiss("permission")` để popup đang mở không hiện lựa chọn cũ.

**Hai preset rủi ro** (`danger-full-access` và `auto`) bắt buộc đi qua hộp xác nhận (RiskConfirmation) trước khi ghi;
`auto` (thí nghiệm) lấy nhãn/badge/mô tả từ từ điển (`auto.label` · `auto.badge` = `EXP` · `auto.description`).

## 2. Peer

**Không khai peer nào.** Bốn specifier nửa browser `require` do **bảng module của trang** cấp, đúng thứ tự như bản gốc.
Bản gốc khai `@deepseek-ai/cordis` nhưng chỉ để lấy KIỂU.

## 3. Bảng TRƯỚC / SAU

Đo trên **home cách ly + cổng riêng**, phép đo SAU **cô lập đúng một row của ta** (mọi package viết lại khác đều TẮT,
chỉ còn lớp overlay `disable ui-permission + insert ui-permission-ours`), nên hai bên chỉ khác nhau đúng row này.

| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row của ta) |
|---|---|---|
| `#root` (Chrome headless, đầu dò của `check:app`) | **57.501 ký tự** | **57.501 ký tự (bằng đúng)** |
| Lỗi console | **0** | **0** |
| Số dòng `did not activate` | **0** | **0** |
| Phần tử đo được (80 hộp đầu) | **80 hộp** | **80 hộp** |
| **Phần tử lạ** (hộp chỉ có ở một bên) | — | **0/0** (không bên nào có hộp lạ) |

⇒ Cùng điều kiện lab, row của ta **không đổi một ký tự `#root`**, **không thêm/bớt một hộp phần tử**, và **0 lỗi console**.
Hai bề mặt quyền **ẩn theo trạng thái** (hàng chỉ hiện khi mở Settings → General; chip chỉ hiện khi có phiên), nên phép đo
mặc định đúng ra là *không thấy chúng* ở cả hai bên — xem §5 và §6 để biết phần đã và chưa chứng minh.

### Lệnh tái lập

```bash
# TRƯỚC: home sạch, mọi row còn là stock
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-perm-ab bun run apps/cli/src/main.ts host --port 5471
# SAU: cùng điều kiện, chỉ thêm lớp overlay của đúng row này
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-lab-ui-permission bun run apps/cli/src/main.ts host --port 5472 \
  --patch /tmp/gbh-lab-ui-permission/overlay.patch.yml
# đo phía trang (tự quản cookie — curl trần LUÔN 401 dù app lành, xem AGENTS.md §5)
bun run tools/check/probe-once.ts "http://127.0.0.1:5471/?token=…"   # { rootChars: 57501, errors: [] }
bun run tools/check/probe-once.ts "http://127.0.0.1:5472/?token=…"   # { rootChars: 57501, errors: [] }
```

## 4. Nghiệm thu sức khoẻ toàn app (sau khi mount thật)

| Dấu hiệu | Kết quả |
|---|---|
| (1) Trang sống | **200 · 49.584 B** |
| (5) `did not activate` trong log boot | **0** |
| (6) Gói CỦA TA đang chạy thật | **24 gói**, trong đó có `gbh-client-ui-permission-presets` |
| (8) UI render thật | **99.183 ký tự `#root` · 0 lỗi console** |
| (9) Bố cục khớp đường nền | 1/80 phần tử (1 px, **có sẵn từ trước**, không phải row này) |
| (10) Bản mount mới nhất | **34 file khớp repo** |
| (11) HMR sống | HTTP 200 · `connected` |

## 5. Phần CHƯA làm / giới hạn

- **Chưa có ảnh A/B pixel cho hai bề mặt ở ĐÚNG trạng thái hiện** (mở Settings → General; mở menu quyền ở composer).
  Giàn `tools/features/run.ts` chạy hai màn `settings-general` và `composer-access-menu` đều **SKIP** vì cổng 5439 trả
  **HTTP 401 khi curl trần** (`AGENTS.md` §5: đó là bẫy đo, không phải app hỏng) — cần một lượt đo có cookie jar.
  Vì vậy tôi **KHÔNG** khẳng định pixel parity cho hai bề mặt; thay vào đó đã có: (a) bằng chứng **không đổi `#root`/không hộp lạ**
  ở lượt boot cô lập (§3), và (b) **test hành vi** ở hai tầng (bundle + đơn vị) trong `tests/client/ui-permission.test.ts`.
  Nếu sau này tự dựng trạng thái để chụp: **trạng thái đó do TA TỰ DỰNG, KHÔNG so với oracle** — phải ghi rõ như vậy.
- **React thật không có trong repo**: test dùng React giả (`useState`/`useEffect`) nên **nhánh re-render do projection đẩy tới**
  (catalog đổi ⇒ chip đổi nhãn) chưa được kiểm ở tầng runtime, chỉ kiểm được ở tầng dữ liệu/`derive()`.
- **Chưa bấm thật hộp xác nhận rủi ro**: test chỉ khẳng định cây element truyền đúng props (nhãn, `acknowledged`, `disabled`),
  chưa mở được hộp trong trình duyệt để chụp.
- **11/12 khoá `settings.permission` chép từ bundle gốc**, không phải từ `locale/*.json` (file đó chỉ có `meta`).
  Muốn chắc từng ký tự thì diff với `en`/`zh` của bundle — tôi đã chép nguyên văn nhưng **chưa có script tự động** canh việc này.
- **Meta hàng trong Plugins**: bản gốc có `locale/{en,zh}.json` (chỉ `meta.title`, riêng zh có `meta.description`); các gói
  viết lại khác trong repo **không ship file này**, nên tiêu đề hàng của họ rơi về tên package. Gói này đã bù (2 file chép
  byte-for-byte + export `"./locale/*.json"`) — **các gói khác nên làm theo**, nhưng việc đó ngoài vùng ghi của tôi.
- **`gbh.row.moduleIds` khai cả id stock** (đúng khuôn của `ui-approval`/`ui-goal`/`ui-jobs`): an toàn **chỉ khi** row stock
  bị `disabled` trong patch — lượt lab cô lập đã chứng minh không có `duplicate factory registration` (0 lỗi console).

## 6. Bẫy đã gặp khi làm row này

- **Stub phải nằm ở `globalThis`, không phải `window`**: bundle đăng ký qua `globalThis.__ModuleLoader__.load`, nên test
  truyền `new Function("window", code)(fakeWindow)` sẽ nổ `undefined is not an object` — trong trình duyệt hai thứ đó là một,
  trong Node thì không.
- **Require lúc VẬT CHẤT HOÁ, không phải lúc nạp script**: `createPlugin(require)` gọi 4 `require` ngay khi factory chạy,
  nên test gọi factory bằng stub rỗng sẽ nổ ở `dsh-client-store` — stub phải đúng hình dạng thật (không rộng hơn).
- **`curl` trần luôn 401**: xem §5. Đừng kết luận app hỏng từ một lần `curl` không cookie jar.

## 7. Test

```bash
bun test tests/client/ui-permission.test.ts   # 9 pass · 49 expect
```

Gồm: (1) bundle đăng ký **đúng 2 id module** và không có ESM · (2) `inject` đúng 10 seam + 2 từ diễn + 2 slot occupant
với `id`/`order`/`locale`/hình dạng `inject()` đúng bản gốc · (3) thư mục catalog: đọc được, vô hiệu khi event tới,
xoá giá trị khi đổi thế hệ · (4) hàng cài đặt: `derive()` ra giá trị + lựa chọn, `select()` ghi **đúng một đường dẫn** kèm
revision, **không ghi** khi không có quyền/không có namespace · (5) hiển thị: nhãn sản phẩm, kebab-case, nhãn của Host,
badge `EXP` chỉ cho `auto` · (6) chip quyền trả `null` khi thiếu projection/catalog và vẽ đúng nhãn khi đủ.
