<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-goal cua DSH (M5, row hai mat, 7 inject).
-->

# @galaxy-blackhole/gbh-client-ui-goal

Thay row `ui-goal` của DSH: **dải mục tiêu (GoalBar) trong dock soạn tin** — nhãn pha, objective, bốn nút
biến đổi (tạm dừng · tiếp tục · sửa · xoá); cộng thêm **hai chiếu vào cây hội thoại** cho lệnh `/goal` và
**chip tham chiếu lệnh** trong văn bản người dùng.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-goal` (tier T3, **đang BẬT**) | `ui-goal-ours` → `@galaxy-blackhole/gbh-client-ui-goal` |
| Package | `@deepseek-ai/dsh-client-ui-goal` | `@galaxy-blackhole/gbh-client-ui-goal` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-goal/` (`lib/index.js` 11 dòng · `lib/client.js` 661 dòng · `lib/types/client/*.d.ts` 9 file) | repo chưa có `vendor/dsh-reference` |
| Kích thước bản build | **672 dòng JS** (11 + 661) | `lib/index.js` 16 dòng · `lib/client.js` ~1.000 dòng (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`) | có đủ hai nửa |
| `dsh.client.inject` | `api-remotes` · `api-session-controller` · `client-locale` · `ui-chat` · `ui-conversation` · `ui-renderer` · `ui-session` (**7**) | **khai y hệt** ⇒ entry trong `__DSH_BOOT__` có đúng 7 mối nối |
| Seam của plugin | `["slots","sessions","remote","remote.goals","locale","uiConversation"]` (**6**) | y hệt, đúng thứ tự |
| Id MODULE bản gốc đăng ký | **1** (`__ModuleLoader__.load({ id, factory })`, không có `chunk:`) | **2**: id của ta (chính) + id stock (phụ), khai kèm `gbh.row.moduleIds` |
| Export của nửa client | `{ GoalBar, GoalDock, apply, inject }` | y hệt bốn tên |
| Specifier nửa browser `require` | `react/jsx-runtime` · `react` · `ui-primitives` (**3**, đúng thứ tự) | y hệt |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**. Dữ liệu giữ nguyên vì ảnh A/B so từng pixel: **12 chuỗi copy en/zh** · **CSS hai module (2.038 B + 532 B, tên lớp hash `nLMEza_*`/`oRe1gG_*`)** · các định danh quan sát được (`goal/activation-changed` · `connection/reset` · nguồn tham chiếu `goalActivation` · nhãn hiệu ứng `ui-goal: dictionaries` · `data-goal-bar` · `data-command-input` · mã lỗi `no-current-goal` · neo `seq - 0.1`) |

### Hành vi phải giữ

**`apply(ctx)`** theo đúng thứ tự bản gốc: `uiConversation.events.register(định nghĩa chiếu lệnh)` →
`uiConversation.userText.register(rule chip)` → `effect(đăng ký từ điển, "ui-goal: dictionaries")` → ba
`slots.inject`:
  · `conversation.user.text.node` khoá `command`, **ưu tiên 100** → `GoalCommandReference`
  · `conversation.chat.node` khoá `command-input`, `locale: goal` → `GoalCommandInputView`
  · `conversation.input.dock` id `goal`, **thứ tự 10**, `locale: goal`, `inject(sessionId)` → `GoalDock`

**Bốn động từ** (`onEdit` · `onPause` · `onResume` · `onClear`): đọc tham chiếu CAS `{id, revision}` từ
projection `goal` của phiên **ngay lúc gọi** (không hàng rào cũ — CAS của RPC mới là chỗ chặn); phiên chưa
chiếu ra goal thì trả lỗi cục bộ `no-current-goal` và **không gọi wire**.

**Nguồn kích hoạt** (`createGoalActivationSource`): ba bộ đếm epoch (sự kiện · projection · lần đọc) để một
lần đọc Remote về muộn không ghi đè trạng thái mới hơn; `sameSnapshot` lọc trùng theo giá trị; **chỉ đăng ký
khi có hook quan sát** và nhả cả bốn nguồn nghe khi hook cuối gỡ; đọc hỏng thì `console.warn` chứ không ném.

**`GoalBar`**: không render khi chưa có goal / đã `complete` / vừa bị xoá (`clearedGoalId`); nhãn pha
`active` phân biệt **đã kích hoạt** (`armed`) hay chưa (`disarmed`); nút Tạm dừng **chỉ** khi `active` + `armed`,
nút Tiếp tục khi `paused` hoặc `active` + `disarmed`; `title` của hàng là lý do chặn khi pha `blocked`; mọi
động từ đi qua `runAction` (chặn gọi chồng bằng `pendingRef`, lỗi hiện tại chỗ dạng `thông điệp (mã)`); chế độ
sửa dùng `InlineEditor` với nút Lưu **tắt khi draft rỗng**.

**`GoalDock`**: đọc `useProjection("goal")` rồi chỉ nhận `activation` khi **khớp đúng cả id lẫn revision**.

**Rule chip**: chỉ nhận token `/tên` nằm **đúng trong dải đã xác nhận chạy** *và* ranh giới hai đầu là khoảng
trắng (hoặc đầu/cuối chuỗi) ⇒ chữ `/goal` nhắc lại trong objective vẫn là văn bản thường.

## 2. Vì sao cần

Đây là **bề mặt điều khiển mục tiêu bền** của DSH: người dùng thấy mục tiêu đang chạy, và ba thao tác
chính (tạm dừng · sửa · xoá) nằm ở đây. Sai `apply`/`inject` ở row này là mất luôn khả năng điều khiển
mục tiêu, chứ không chỉ lệch giao diện.

## 3. Peer

**Không khai peer nào.** Ba specifier nửa browser `require` (`react/jsx-runtime`, `react`,
`@galaxy-blackhole/gbh-client-ui-primitives`) do **bảng module của trang** cấp, đúng thứ tự như bản gốc — không
phải `peerDependency`. Bản gốc khai `@deepseek-ai/cordis` nhưng chỉ để lấy KIỂU.

## 4. Bảng TRƯỚC / SAU

Đo trên **home cách ly + cổng riêng**; phép đo "SAU" **cô lập đúng một row của ta** (boot một lần để mount,
rồi boot lại với `GBH_DISABLE_REWRITES=1` + lớp overlay `--patch` chỉ chứa khối disable+insert của row này).

| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row của ta) |
|---|---|---|
| Trang | 200 · **39.326 B** | 200 · **39.351 B** (+25 B: id mới dài hơn) |
| Số entry trong `__DSH_BOOT__` | **72** | **72 (không đổi)** |
| Id entry của row | `@deepseek-ai/dsh-client-ui-goal` | `@galaxy-blackhole/gbh-client-ui-goal` |
| `inject` của entry | **7 id** | **y hệt từng chữ** |
| Dòng `did not activate` | **0** | **0** |
| **(8) phía trang** (Chrome headless, đúng đầu dò của `check:app`) | **57.501 ký tự `#root` · 0 lỗi console** | **57.501 ký tự `#root` · 0 lỗi console** |

⇒ Cùng điều kiện lab, `#root` của ta **bằng đúng** bản stock và **0 lỗi console**.

### Lệnh tái lập

```bash
bun test tests/client/ui-goal.test.ts     # 34 pass · 144 expect (gồm 2 TEST CANH: CSS + runtime JSX)
bun run check:rows                          # gói này không có dòng nào
bun run gate                                # file của ta 0 vi phạm

# TRƯỚC: home cách ly, mọi row còn là stock
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-goal-before bun run apps/cli/src/main.ts host --port 5491
# SAU (cô lập đúng row này): mount một lần rồi boot lại với overlay
GBH_HOME=/tmp/gbh-goal-mine bun run apps/cli/src/main.ts host --port 5492       # mount rồi tắt
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-goal-mine bun run apps/cli/src/main.ts host --port 5493 \
  --patch <overlay: disable ui-goal + insert ui-goal-ours>                        # không sửa app.patch.yml
bun run /tmp/probe-lab.ts "http://127.0.0.1:5493/?<token>"   # { rootChars: 57501, errors: [] }
```

## 5. Nghiệm thu sức khoẻ toàn app

| Dấu hiệu | Kết quả |
|---|---|
| (1) Trang sống | 200 · 39.351 B (lab) — không teo về 68 B/12 KB |
| (2) `did not activate` trong log boot | **0** |
| (3) `__DSH_BOOT__` trên trang | có |
| (4) Row của ta có mặt | entry mang id của ta + `ui-goal-ours` trong dump, row stock `disabled: true`, tổng entry **72 không đổi** |
| (8) UI render thật | **57.501 ký tự `#root` · 0 lỗi console** (lab, Chrome headless) |
| (11) **RENDER dải GoalBar** — trạng thái do TA TỰ DỰNG trong lab, **KHÔNG so với oracle** | gửi `/goal …` bằng sự kiện bàn phím THẬT ⇒ **1 dải `data-goal-bar`** (x=312 y=550 **929×36**) · nhãn lấy đúng từ điển (`Ongoing Goal` = `en["phase.active"]`) · **1 node `data-command-input`** · `#root` 60.036 → **113.228 ký tự** · 0 lỗi console |

## 6. Phần CHƯA làm / giới hạn

- **KHÔNG có ảnh A/B pixel với oracle cho riêng dải**: dải chỉ render khi phiên CÓ mục tiêu đang sống, mà home
  lab sạch thì không có mục tiêu ⇒ hai bên đều không vẽ dải. Bù lại đã có **bằng chứng RENDER** ở chỉ số (11):
  tự dựng trạng thái trong lab rồi soát DOM. ⚠️ **Trạng thái đó do TA tự tạo trong lab, KHÔNG đối chiếu với
  oracle** — đừng đọc nó như một phép A/B. Muốn có A/B thật thì phải dựng cùng trạng thái ở CẢ hai bên
(phía oracle chưa làm).
- **Đường nhập giả**: gán `textContent` + sự kiện `input` KHÔNG vào được state của app (ô soạn tin là
  `contenteditable` có mô hình trạng thái riêng) — phải dùng sự kiện bàn phím thật (`page.keyboard.type`).
  Ghi lại đây để người sau không mất một vòng như tôi.
- **React/hook chạy giả trong test**: repo không cài `react`, nên test dùng React giả có theo dõi `deps` và
  giữ trạng thái giữa các lượt render. Nhánh re-render thật do projection đẩy tới chưa kiểm ở tầng runtime.
- **Ca BYTE không áp dụng**: row không có thân phản hồi byte nào. Thay vào đó có ca khuôn bundle (script
  classic, 2 id cùng factory, CSS nhúng khớp file nguồn) và hai ca test canh.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-goal` (shasum `en b151d3b21f8f...` · `zh e2e9093d8ff9...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
