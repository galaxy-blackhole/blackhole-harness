<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-approval cua DSH (M5, row hai mat, 6 inject).
-->

# @galaxy-blackhole/gbh-client-ui-approval

Thay row `ui-approval` của DSH: **composer takeover** hiện một yêu cầu duyệt đang chờ và trả quyết định
của người dùng về waterfall Remote Event có phạm vi.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-approval` (tier T3, **đang BẬT**) | `ui-approval-ours` → `@galaxy-blackhole/gbh-client-ui-approval` |
| Package | `@deepseek-ai/dsh-client-ui-approval` | `@galaxy-blackhole/gbh-client-ui-approval` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-approval/` (`lib/index.js` 6 dòng · `lib/client.js` 365 dòng · `lib/types/**` 5 file `.d.ts`) | repo chưa có `vendor/dsh-reference` |
| Kích thước bản build | **371 dòng JS** (6 + 365) | `lib/index.js` 5 dòng · `lib/client.js` 426 dòng (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`) | có đủ hai nửa |
| `dsh.client.inject` | `dsh-api-remotes` · `dsh-api-session-controller` · `dsh-client-locale` · `dsh-client-ui-conversation` · `dsh-client-ui-renderer` · `dsh-client-ui-session` (**6**) | **khai y hệt** ⇒ entry trong `__DSH_BOOT__` có đúng 6 mối nối đó |
| Id MODULE bản gốc đăng ký | **1** (`__ModuleLoader__.load({ id, factory })`, không có `chunk:`) | **2**: id của ta (chính, khớp manifest + `rev` HMR) + id stock (phụ) |
| Slot | `conversation.composer` (`priority: 1`) + slot con `conversation.approval.detail` khai trong `children` (**không** phải lời gọi `slots.register` riêng) | y hệt |
| Mức độ dẫn xuất | — | **viết lại theo hành vi** (đọc `.d.ts` + `lib/client.js`, không chép code). Dữ liệu giữ nguyên vì ảnh A/B so từng pixel: 5 chuỗi copy en/zh · **CSS 8 rule + tên lớp hash `mna1RW_*`** · các định danh quan sát được (nhãn hiệu ứng `ui-approval: …`, id phím tắt `approval.allow`/`approval.reject`, sự kiện `approval/request`, thuộc tính `data-approval-key`/`data-approval-scroll`, `aria-*`) |

### Hành vi phải giữ

**`apply(ctx)`** — theo đúng thứ tự:

1. `ctx.effect(() => ctx.locale.register("approval", { zh, en }), "ui-approval: dictionaries")`.
2. `ctx.inject(["shortcuts"], …)` → hai phím **cố định**: `approval.allow` (Enter) và `approval.reject` (Esc),
   mỗi phím một hiệu ứng riêng trong **phạm vi shortcut** (`scope.effect`), nhãn `ui-approval: fixed …`.
3. `ctx.uiSession.registerPendingInteraction(() => 0)` → hàm đăng ký chỗ tương tác đang chờ (ưu tiên 0).
4. `ctx.slots.inject("conversation.composer", …)` → occupant `priority: 1`, `locale`, `select` theo
   `instanceof PendingApproval`, `inject: () => ({ resolveReason })`,
   `children: { "conversation.approval.detail": { kind: "single", scope: "session" } }`.
5. `ctx.remote.$on("approval/request", function (request, next) { … })` — **hàm thường, không phải arrow**,
   vì `this` là chủ sở hữu phạm vi mà `ctx.sessions.scopeOf(owner)` cần.
6. Không đăng ký namespace cài đặt nào: namespace `approval` do nơi khác cấp.

**`PendingApproval`** (contract mà `ui-session` và slot đọc):

| Thành phần | Hành vi |
|---|---|
| `kind = "approval"`, `key = "approval:<n>"` | `n` tăng dần; `key` là trục remount một lần + `data-approval-key` |
| `answer(outcome)` | settle `result` bằng `"allowed-once"`/`"rejected"`; chạy **qua promise** nên gọi lần hai bị **từ chối** với `pending approval <key> is already settled` |
| `delegate()` | từ chối `result` bằng **Symbol nội bộ**; lần hai là lệnh rỗng |
| `isDelegation(reason)` | true **chỉ** với Symbol của chính yêu cầu đó |
| `abort(reason)` | từ chối `result` bằng lý do; đã kết thúc thì bỏ qua |
| `signal` (AbortSignal) | gắn listener `{ once: true }`; tín hiệu **đã huỷ trước đó** thì kết thúc ngay; `finish` thì gỡ listener |

**Waterfall `answerApproval`**: `sessions.scopeOf(owner)` undefined ⇒ `next()` ngay (không đăng ký gì);
ngược lại tạo `PendingApproval`, đăng ký chỗ chờ rồi `await result`; từ chối mà `isDelegation` ⇒ `next()`,
còn lại ném lại; `finally` luôn `remove()` và mở hook chuyển tiếp (để `delegate` của ui-session không treo).

**Panel**: `ApprovalPanel` (chọn chi tiết theo `callId`) → `ApprovalFlow` (thẻ panel). Bàn phím:
Enter = cho phép một lần, Esc = từ chối, **chỉ** khi tiêu điểm còn trong panel, không nằm trong ô nhập/nút,
không có phím điều hợp, sự kiện chưa bị chặn, không phải lần giữ phím, và **không** đang composition/IME
(`isComposing`, `keyCode === 229`, hoặc vừa `compositionend` cho tới `keyup`).

## 2. Vì sao cần

Row này là **bài kiểm khuôn cho row nhiều phụ thuộc** trước khi bước vào nhóm row lớn (`ui-chat` 13k dòng,
`ui-conversation` 20k dòng): **6 inject** trải cả ba tầng — API (`api-remotes`, `api-session-controller`),
shell client (`client-locale`, `ui-conversation`, `ui-renderer`, `ui-session`) — và dùng gần hết seam nửa
client: slot, từ điển, phím tắt, trạng thái tương tác phiên, Remote Event waterfall, CSS module, React hooks.

## 3. Peer

**Không khai peer nào.** Bản gốc chỉ khai `@deepseek-ai/cordis`, nhưng nửa host của nó (và của ta) không
import gì. Ba specifier mà nửa browser `require` lúc vạt chất hoá — `react/jsx-runtime`, `react`,
`@galaxy-blackhole/gbh-client-ui-primitives` — **không phải peerDependency**: chúng do **bảng module của
trang** cấp, đúng ba specifier và đúng thứ tự như bản gốc.

## 4. Bảng TRƯỚC / SAU

Đo trên **home cách ly + cổng riêng**; phép đo "SAU" **cô lập đúng một row của ta** (boot một lần để mount
gói vào profile của home cách ly, rồi boot lại với `GBH_DISABLE_REWRITES=1` + lớp overlay `--patch` chỉ
chứa khối disable+insert của row này — **không** sửa `<home>/app.patch.yml`).

| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row của ta) |
|---|---|---|
| Trang | 200 · **39.326 B** | 200 · **39.351 B** (**+25 B** = id mới dài hơn 7 ký tự, xuất hiện vài chỗ trong đồ thị) |
| Số entry trong `__DSH_BOOT__` | **72** | **72 (không đổi)** |
| Id entry của row | `@deepseek-ai/dsh-client-ui-approval` | `@galaxy-blackhole/gbh-client-ui-approval` |
| `inject` của entry | **6 id** | **y hệt từng chữ** (đủ 6) |
| Dòng `did not activate` | **0** | **0** |
| `__DSH_BOOT__` trên trang | có | có |

Trên **app thật 5439** (row đã sống từ lượt restart gần nhất):

| Phép đo | Kết quả |
|---|---|
| Trang | 200 · 39.541 B · **72 entry** · có `__DSH_BOOT__` |
| Entry của row | `@galaxy-blackhole/gbh-client-ui-approval` với **đủ 6** mối nối `inject` |
| Byte phục vụ cho trình duyệt | combo `/plugins` (200 · 9.909.672 B) chứa `load({ id: "@galaxy-blackhole/gbh-client-ui-approval"` **và** `load({ id: "@deepseek-ai/dsh-client-ui-approval"` + `conversation.composer` + `ui-approval: dictionaries`; **0 dòng cú pháp ESM** |

### Lệnh tái lập

```bash
# (1) hợp đồng + panel + bàn phím + waterfall: build thật rồi chạy trong window/react/jsx GIẢ
bun test tests/client/ui-approval.test.ts        # 27 pass · 138 expect
bun run check:rows                               # gói này không có dòng nào
bun run gate                                     # 6/6 (file của ta 0 vi phạm)

# (2) TRƯỚC: home cách ly, MỌI row còn là stock
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-appr-before bun run apps/cli/src/main.ts host --port 5466

# (3) SAU (cô lập đúng row này): mount một lần, rồi boot lại với overlay
GBH_HOME=/tmp/gbh-appr-mine bun run apps/cli/src/main.ts host --port 5467            # mount rồi tắt
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-appr-mine bun run apps/cli/src/main.ts host --port 5468 \
  --patch <overlay: disable ui-approval + insert ui-approval-ours>                    # không sửa app.patch.yml
```

Lưới an toàn: `GBH_DISABLE_REWRITES=1 bh host` trả về row DSH trong 1 lệnh.

## 5. Nghiệm thu sức khoẻ toàn app (mục 4b)

| Dấu hiệu | Kết quả |
|---|---|
| (1) Trang sống | 200 · 39.541 B (app thật) · 39.351 B (home cách ly) — không teo về 68 B/12 KB |
| (2) `did not activate` trong log boot | **0** |
| (3) `__DSH_BOOT__` trên trang | **1** |
| (4) Row của ta có mặt | entry mang id của ta; `ui-approval-ours` trong dump, row stock `disabled: true`, tổng row thay **+1** |
| Nửa client thật sự được phục vụ | combo `/plugins` chứa **cả hai** id đăng ký + `conversation.composer` + nhãn hiệu ứng |

## 6. Phần CHƯA làm / giới hạn

- **Chưa có ảnh A/B cho khung duyệt** (giàn `parity:shot` của tm-ui-features phụ trách). Bằng chứng hiện
  có cho nửa UI: bundle phục vụ thật trên 5439 · 27 test (cây element theo đúng props gốc, 10 ca bàn
  phím/IME, contract `PendingApproval`, waterfall 5 ca) · entry đủ 6 mối nối `inject`.
- **Ca BYTE không áp dụng**: row không có thân phản hồi byte nào (không route, không RPC). Thay vào đó có
  ca khuôn bundle: `lib/client.js` phải là **script classic** (0 cú pháp ESM) và đăng ký **đúng 2 id**
  bằng **cùng một factory**; CSS phải **nhúng từ chính file .module.css** (test đối chiếu với file nguồn).
- **React/hooks chạy giả trong test**: repo không cài `react` nên test dùng React giả một lượt render.
  Hành vi khi re-render thật (nút chuyển sang `disabled`, `StateDot` đổi sang `ongoing`) chưa kiểm được ở
  tầng runtime — chỉ kiểm được cờ `answered` và các nhánh dữ liệu.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-approval` (shasum `en fdd19d0ba381...` · `zh 0131ba7e4cdf...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
